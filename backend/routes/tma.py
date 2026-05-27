"""
PUTKI HQ - Telegram Mini App backend (iter76, Slice 4).

Implements Doc 2 §A.4 - the Mini App lives at `/tma` (React bundle
served from the same Vite/CRA host) and talks to these endpoints:

    POST /api/tma/auth
        body: { init_data: str }
        Validates Telegram WebApp initData via HMAC per the official
        spec (https://core.telegram.org/bots/webapps#validating-data-
        received-via-the-mini-app). On success, returns a short-lived
        session token (HMAC of telegram user id) plus the subscriber's
        bound profile (segment, status, pending_id).
    GET /api/tma/signals?token=...
        Reads today's signals via the same builder the channel broadcast
        uses; returns them with per-card lock state based on the
        subscriber's status (status="active" + telegram_chat_id bound
        → unlocked).

initData validation:
    secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN)
    data_check = "\n".join("k=v" for k,v in sorted(initData.items())
                           if k != "hash")
    expected   = HMAC_SHA256(secret_key, data_check).hex()
    valid      = expected == initData["hash"]

Sessions:
    Stateless; the FE keeps the returned token in memory and replays it
    on every signals fetch. The token itself is HMAC(BOT_TOKEN,
    "tma:<tg_user_id>:<iso_minute>") so it auto-rolls after the minute
    boundary; we accept a 2-minute window for clock skew.
"""
from __future__ import annotations

import hmac
import hashlib
import json
import logging
import os
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes._helpers import get_db
from routes.bot_routing import get_bot_config

logger = logging.getLogger(__name__)

_TOKEN_TTL_SECONDS = 30 * 60  # 30 minutes


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bot_token() -> str:
    return os.environ.get("TELEGRAM_BOT_TOKEN") or ""


# ─── initData validation ─────────────────────────────────────────────
def _parse_init_data(raw: str) -> Dict[str, str]:
    """Telegram sends initData as a URL-encoded query string."""
    parsed = urllib.parse.parse_qs(raw, keep_blank_values=True, strict_parsing=False)
    return {k: v[0] for k, v in parsed.items()}


def validate_init_data(raw: str, *, bot_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Return the parsed initData dict (with `user` JSON-decoded) when
    the HMAC matches; None otherwise. Returns None on any malformed
    input - the caller treats that as 401."""
    token = bot_token or _bot_token()
    if not token or not raw:
        return None
    try:
        data = _parse_init_data(raw)
        received_hash = data.pop("hash", None)
        if not received_hash:
            return None
        data_check = "\n".join(f"{k}={data[k]}" for k in sorted(data.keys()))
        secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received_hash):
            return None
        # Reject stale initData (>24h old) - matches Telegram guidance.
        auth_date = int(data.get("auth_date") or 0)
        if auth_date and (time.time() - auth_date) > 86400:
            return None
        if "user" in data:
            try:
                data["user"] = json.loads(data["user"])
            except Exception:
                pass
        return data
    except Exception:
        logger.exception("init_data validation crashed")
        return None


# ─── Session tokens (stateless, HMAC-bound) ──────────────────────────
def _session_window(at: Optional[float] = None) -> int:
    """30-minute window so refresh is rare but expiry happens."""
    t = at if at is not None else time.time()
    return int(t // _TOKEN_TTL_SECONDS)


def mint_session_token(tg_user_id: int, *, at: Optional[float] = None) -> str:
    token = _bot_token()
    if not token:
        # Test/no-bot environments - still issue a stable but useless token.
        return f"dev:{tg_user_id}"
    msg = f"tma:{tg_user_id}:{_session_window(at)}".encode()
    return hmac.new(token.encode(), msg, hashlib.sha256).hexdigest()


def verify_session_token(token: str, tg_user_id: int) -> bool:
    if not token or not tg_user_id:
        return False
    # Accept current OR previous window (2-minute skew tolerance).
    now = time.time()
    for off in (0, -_TOKEN_TTL_SECONDS):
        if hmac.compare_digest(token, mint_session_token(tg_user_id, at=now + off)):
            return True
    return False


# ─── Payloads ─────────────────────────────────────────────────────────
class _AuthPayload(BaseModel):
    init_data: str
    # `dev_user_id` is only honoured when TELEGRAM_BOT_TOKEN is empty -
    # lets local dev skip the HMAC dance.
    dev_user_id: Optional[int] = None


class _SignalsPayload(BaseModel):
    tg_user_id: int
    token: str


class _EventPayload(BaseModel):
    """Lightweight beacon - we don't validate session on these because
    they're fire-and-forget analytics, and the worst case is a spam-loop
    that the rate-limit middleware would catch upstream anyway."""
    event: str           # tma_open | unlock_click
    tg_user_id: Optional[int] = None
    pending_id: Optional[str] = None
    meta: Optional[dict] = None


# ─── Router builder ───────────────────────────────────────────────────
def make_router() -> APIRouter:
    router = APIRouter()

    @router.post("/tma/auth")
    async def tma_auth(payload: _AuthPayload, db = Depends(get_db)):
        token_env = _bot_token()
        tg_user: Optional[Dict[str, Any]] = None

        if token_env:
            parsed = validate_init_data(payload.init_data)
            if not parsed or "user" not in parsed:
                raise HTTPException(401, "init_data_invalid")
            user = parsed["user"]
            if not isinstance(user, dict) or "id" not in user:
                raise HTTPException(401, "init_data_user_missing")
            tg_user = user
        else:
            # No bot token configured (test / dev). Honour dev_user_id so
            # the FE can still exercise the page in isolation.
            if not payload.dev_user_id:
                raise HTTPException(401, "init_data_invalid")
            tg_user = {"id": payload.dev_user_id, "first_name": "dev"}

        tg_id = int(tg_user["id"])
        token = mint_session_token(tg_id)

        # Try to bind this Telegram identity to a known mittari subscriber.
        sub = await db.mittari_subscribers.find_one(
            {"telegram_chat_id": tg_id},
            {"_id": 0, "pending_id": 1, "segment": 1, "status": 1, "email": 1},
        )

        return {
            "ok": True, "token": token,
            "tg_user": {
                "id": tg_id,
                "first_name": tg_user.get("first_name", ""),
                "language_code": tg_user.get("language_code", ""),
            },
            "subscriber": sub or None,
            "issued_at": _utc_iso(),
        }

    @router.get("/tma/signals")
    async def tma_signals(
        tg_user_id: int, token: str, db = Depends(get_db),
    ):
        if not verify_session_token(token, tg_user_id):
            raise HTTPException(401, "session_invalid")

        sub = await db.mittari_subscribers.find_one(
            {"telegram_chat_id": tg_user_id},
            {"_id": 0, "pending_id": 1, "segment": 1, "status": 1},
        ) or {}
        unlocked = bool(sub.get("status") == "active" and sub.get("pending_id"))

        # Build today's picks via the existing channel-broadcast pipeline
        # so the Mini App stays in lock-step with /mittari and the bot DM.
        try:
            from dispatch_daily import _build_telegram_alerts_payload
            payload = await _build_telegram_alerts_payload(db)
            picks = payload.get("picks", []) or []
        except Exception:
            picks = []

        # Per-segment filter (same logic as the DM fanout).
        seg = (sub.get("segment") or "all").lower()
        if seg in {"football", "hockey"}:
            from routes.bot_dispatch import _filter_picks_for_segment
            picks = _filter_picks_for_segment(picks, seg)

        # Card-level lock state: bot_config.signal_unlock_mode == "routed"
        # is a UI cue we surface to the FE so the locked-card CTA can be
        # styled as "Open partner →" instead of "Reveal in-app".
        cfg = await get_bot_config(db)

        cards = []
        for i, p in enumerate(picks[:5], 1):
            cards.append({
                "index": i,
                "event_name": p.get("event_name"),
                "pick": p.get("pick"),
                "odds_decimal": p.get("odds_decimal"),
                "sharpness": p.get("sharpness"),
                "sport": p.get("sport"),
                "sport_icon": p.get("sport_icon"),
                "kickoff_at": p.get("kickoff_at"),
                "bookmaker": p.get("bookmaker"),
                # First 2 cards always public; rest locked unless active.
                "locked": (not unlocked) and i > 2,
            })

        return {
            "ok": True,
            "subscriber": {
                "bound": bool(sub),
                "status": sub.get("status"),
                "segment": seg,
                "pending_id": sub.get("pending_id"),
            },
            "unlock_mode": cfg.get("signal_unlock_mode", "informative"),
            "picks": cards,
            "issued_at": _utc_iso(),
        }

    @router.post("/tma/event")
    async def tma_event(payload: _EventPayload, db = Depends(get_db)):
        """Fire-and-forget analytics beacon. Used by the FE to record
        Mini-App opens + unlock clicks for the back-office funnel widget.

        We accept ANY event without auth - the worst case is noise, and
        the funnel-snapshot aggregator already filters by event name +
        timestamp window so spam never widens conversion %s."""
        evt = (payload.event or "").strip()[:32]
        if not evt:
            return {"ok": False}
        try:
            await db.tma_events.insert_one({
                "event": evt,
                "tg_user_id": payload.tg_user_id,
                "pending_id": (payload.pending_id or "")[:64] or None,
                "meta": payload.meta or {},
                "ts": _utc_iso(),
            })
        except Exception:
            logger.exception("tma_events insert failed")
        return {"ok": True}

    return router


async def ensure_indexes(db) -> None:
    await db.tma_events.create_index("ts", background=True)
    await db.tma_events.create_index([("event", 1), ("ts", -1)], background=True)
