"""
PUTKI HQ - Geo-aware Affiliate Router (iter76, Slice 5).

Implements Doc 2 §A.5 - dormant at launch, monetisation-ready behind a
single back-office flip (`bot_config.signal_unlock_mode = "routed"`).

Endpoints (mounted on the API router, NO global rewrite):
    POST /api/admin/links/mint        - admin-only; mints a short code.
    GET  /api/r/{code}                - public; logs click + geo-routes.
    POST /api/r/postback/{partner_key} - public; partner conversion event.

Schema:
    link_codes (one row per opaque code):
        code:           str (8 hex chars; unique)
        signal_id:      str | None  (the picked signal, for reporting)
        campaign:       str | None
        segment:        str | None  (football / hockey / all)
        subscriber_id:  str | None  (pending_id of the subscriber who got
                                     this link in their DM, if any)
        partner_key:    str | None  (explicit override; usually None so
                                     the router picks by priority+geo)
        created_at:     iso str

    redirect_click_log:
        code, ts, geo (str), partner_key, status (ok/no_partner/blocked),
        ip_tail (last octet), user_agent[:200]

    conversions:
        partner_key, ts, code, subid, amount, currency, raw (truncated body)

The router is purely additive. Until `signal_unlock_mode` flips to
"routed" the bot keeps serving the in-app reveal - the router still
works (admin can test-drive it) but no real user traffic lands here.
"""
from __future__ import annotations

import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from routes._helpers import get_db, require_admin
from routes.bot_routing import get_bot_config

logger = logging.getLogger(__name__)

_FALLBACK_URL = (os.environ.get("PUTKI_HQ_SITE_URL") or "https://putkihq.fi").rstrip("/")


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _geo_from_request(request: Request) -> str:
    """Best-effort geo without GeoIP integration. Reads:
        1. Cloudflare's CF-IPCountry header (set in front of FastAPI)
        2. Accept-Language locale tail (e.g. "fi-FI" → FI)
        3. Defaults to "ZZ" (unknown).

    ISO-3166-1 alpha-2 uppercase. Cheap enough to call on every redirect.
    """
    cf = (request.headers.get("cf-ipcountry") or "").strip().upper()
    if cf and len(cf) == 2 and cf.isalpha():
        return cf
    al = (request.headers.get("accept-language") or "").split(",")[0].strip()
    m = re.search(r"-([A-Z]{2})$", al.upper())
    if m:
        return m.group(1)
    return "ZZ"


def _ip_tail(request: Request) -> str:
    raw = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if not raw:
        raw = request.client.host if request.client else ""
    if not raw:
        return ""
    # IPv4 last octet, or last IPv6 hextet - just enough for rough dedup
    # while staying GDPR-shy (no full IP retention).
    if "." in raw:
        return raw.rsplit(".", 1)[-1][:4]
    return raw.rsplit(":", 1)[-1][:4]


async def _select_partner(db, geo: str, override_key: Optional[str]) -> Optional[Dict[str, Any]]:
    """Pick a LIVE partner for the requested geo, ordered by
    priority_weight desc then partner_key asc for determinism.

    If `override_key` is set, that exact key is used (still must be
    LIVE and geo-eligible - prevents stale links from outliving a pause).
    """
    if override_key:
        p = await db.partners.find_one({"partner_key": override_key}, {"_id": 0})
        if not p or p.get("status") != "live":
            return None
        if p.get("target_geos") and geo not in set(p["target_geos"]):
            return None
        return p

    cur = db.partners.find(
        {"status": "live"}, {"_id": 0},
    ).sort([("priority_weight", -1), ("partner_key", 1)])
    async for p in cur:
        geos = p.get("target_geos") or []
        if not geos or geo in set(geos):
            return p
    return None


def _build_partner_url(partner: Dict[str, Any], code: str, subid: Optional[str]) -> str:
    base = partner.get("affiliate_base_url") or ""
    # Two supported template tokens; partner ops chooses which to embed.
    out = base.replace("{code}", code).replace("{subid}", subid or code)
    return out or _FALLBACK_URL


# ─── Payloads ─────────────────────────────────────────────────────────
class _MintPayload(BaseModel):
    signal_id: Optional[str] = None
    campaign: Optional[str] = None
    segment: Optional[str] = None
    subscriber_id: Optional[str] = None
    partner_key: Optional[str] = None     # explicit override (rare)


# ─── Router builder ───────────────────────────────────────────────────
def make_admin_router() -> APIRouter:
    """Admin endpoints stay under /api/admin/* so they share the
    require_admin gate + audit log."""
    router = APIRouter()

    @router.post("/admin/links/mint")
    async def admin_mint_link(
        payload: _MintPayload,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        code = secrets.token_hex(4)  # 8 hex chars; 4B options
        # Retry once on the off-chance of a collision; the unique index
        # will surface a duplicate-key error which we recover from.
        for _attempt in range(2):
            try:
                doc = {
                    "code": code,
                    "signal_id": payload.signal_id,
                    "campaign": payload.campaign,
                    "segment": payload.segment,
                    "subscriber_id": payload.subscriber_id,
                    "partner_key": payload.partner_key,
                    "created_at": _utc_iso(),
                    "id": uuid.uuid4().hex,
                }
                await db.link_codes.insert_one(doc)
                break
            except Exception as exc:
                if "duplicate key" in str(exc).lower():
                    code = secrets.token_hex(4)
                    continue
                raise
        site = (os.environ.get("PUTKI_HQ_SITE_URL") or "").rstrip("/")
        return {
            "ok": True, "code": code,
            "redirect_url": f"{site}/api/r/{code}" if site else f"/api/r/{code}",
        }

    return router


def make_public_router() -> APIRouter:
    """Public endpoints exposed under /api/r/* (no admin gate)."""
    router = APIRouter()

    @router.get("/r/{code}")
    async def affiliate_redirect(
        code: str, request: Request, db = Depends(get_db),
    ):
        code = (code or "").strip().lower()
        if not code or len(code) > 32:
            raise HTTPException(400, "bad_code")

        link = await db.link_codes.find_one({"code": code}, {"_id": 0})
        cfg = await get_bot_config(db)
        geo = _geo_from_request(request)
        ua = (request.headers.get("user-agent") or "")[:200]
        ip_tail = _ip_tail(request)

        async def _log(status: str, partner_key: Optional[str], destination: str):
            try:
                await db.redirect_click_log.insert_one({
                    "id": uuid.uuid4().hex,
                    "code": code,
                    "ts": _utc_iso(),
                    "geo": geo,
                    "partner_key": partner_key,
                    "status": status,
                    "destination": destination,
                    "ip_tail": ip_tail,
                    "user_agent": ua,
                })
            except Exception:
                logger.exception("redirect_click_log insert failed for %s", code)

        # Router is dormant unless flipped to 'routed'. In informative
        # mode we 302 back to /mittari so a leaked link never silently
        # leaves the site - the user sees the public signal page instead.
        if cfg.get("signal_unlock_mode") != "routed":
            dest = f"{_FALLBACK_URL}/mittari"
            await _log("informative_mode", None, dest)
            return RedirectResponse(url=dest, status_code=302)

        if not link:
            dest = f"{_FALLBACK_URL}/mittari"
            await _log("unknown_code", None, dest)
            return RedirectResponse(url=dest, status_code=302)

        partner = await _select_partner(db, geo, link.get("partner_key"))
        if not partner:
            dest = f"{_FALLBACK_URL}/mittari"
            await _log("no_partner_for_geo", None, dest)
            return RedirectResponse(url=dest, status_code=302)

        subid = link.get("subscriber_id") or code
        dest = _build_partner_url(partner, code, subid)
        await _log("ok", partner.get("partner_key"), dest)
        return RedirectResponse(url=dest, status_code=302)

    @router.post("/r/postback/{partner_key}")
    async def affiliate_postback(
        partner_key: str, request: Request, db = Depends(get_db),
    ):
        """Generic postback landing zone. Verifies the partner exists +
        has matching `postback_secret` if configured; persists the raw
        payload for back-office reconciliation. Always 200s to keep
        partner CRMs quiet - mismatches are flagged in the row body."""
        partner_key = (partner_key or "").strip().lower()
        partner = await db.partners.find_one({"partner_key": partner_key}, {"_id": 0})
        body: Dict[str, Any] = {}
        try:
            body = await request.json()
        except Exception:
            # Some networks send url-encoded form posts.
            try:
                form = await request.form()
                body = dict(form)
            except Exception:
                body = {}

        secret_expected = (partner or {}).get("postback_secret")
        secret_sent = (
            request.headers.get("x-postback-secret")
            or body.get("secret")
            or request.query_params.get("secret")
        )
        verified = bool(
            partner and (
                not secret_expected or secret_sent == secret_expected
            )
        )

        doc = {
            "id": uuid.uuid4().hex,
            "partner_key": partner_key,
            "ts": _utc_iso(),
            "code": body.get("code") or request.query_params.get("code"),
            "subid": body.get("subid") or request.query_params.get("subid"),
            "amount": body.get("amount"),
            "currency": (body.get("currency") or "EUR")[:8],
            "verified": verified,
            "raw": {k: str(v)[:200] for k, v in body.items()},
            "ip_tail": _ip_tail(request),
        }
        try:
            await db.conversions.insert_one(doc)
        except Exception:
            logger.exception("conversion insert failed for %s", partner_key)
        return {"ok": True, "verified": verified}

    return router
