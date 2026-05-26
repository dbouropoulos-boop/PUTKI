"""
PUTKI HQ - Website Signup Flow (iter76, Slice 2).

Implements Doc 2 §A.1 (web signup capture) + the strict bot-rule gate
the user locked in during clarification (require_verified_signup=True).

Public endpoint:
    POST /api/signup/mittari
        body: { email, segment, age_confirmed, marketing_consent }
        returns: {
            ok: bool,
            pending_id: str,                # mittari_<uuid8>
            telegram_deep_link: str,        # t.me/Putkihq_bot?start=<pending_id>
            segment: str,
        }

Admin endpoint:
    GET /api/admin/subscribers/lookup?q=<email-or-chat_id-or-pending_id>
        Lightweight quick-find for the back-office; returns up to 10
        partial-match rows scrubbed of internal ObjectIds.

Schema (mittari_subscribers): additive to the existing collection.
    status: "pending" | "active" | "blocked"     (new)
    segment: "football" | "hockey" | "all"        (new)
    age_confirmed: bool                            (new, must be True)
    consent_marketing: bool                        (new)
    accept_language: str                           (new, geo hint)
    signup_ip: str | None                          (new, captured from header)
    pending_id: str                                (already used by bot)
"""
from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from routes._helpers import get_db, require_admin


_ALLOWED_SEGMENTS = {"football", "hockey", "all"}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bot_username() -> str:
    """Strip the t.me/ prefix off TELEGRAM_BOT_URL so we can compose deep
    links cleanly. Falls back to the production handle."""
    raw = (os.environ.get("TELEGRAM_BOT_URL") or "https://t.me/Putkihq_bot").strip()
    return raw.rstrip("/").rsplit("/", 1)[-1] or "Putkihq_bot"


def _deep_link(pending_id: str) -> str:
    return f"https://t.me/{_bot_username()}?start={pending_id}"


class _SignupPayload(BaseModel):
    """Strict capture - every gate is a hard requirement. The page is
    a one-screen funnel; if the gates aren't met we fail closed."""
    email: str = Field(..., max_length=240)
    segment: str = Field(..., max_length=16)         # football | hockey | all
    age_confirmed: bool = False
    marketing_consent: bool = False
    # Optional - the page may pass these for analytics; safe to drop.
    referrer: Optional[str] = Field(default=None, max_length=240)


def make_router() -> APIRouter:
    router = APIRouter()

    @router.post("/signup/mittari")
    async def signup_mittari(
        payload: _SignupPayload,
        request: Request,
        db = Depends(get_db),
    ):
        email = (payload.email or "").strip().lower()
        if not _EMAIL_RE.match(email):
            raise HTTPException(400, "invalid_email")
        segment = (payload.segment or "").strip().lower()
        if segment not in _ALLOWED_SEGMENTS:
            raise HTTPException(400, "invalid_segment")
        if not payload.age_confirmed:
            raise HTTPException(400, "age_gate_required")
        # marketing_consent is optional in EU law for transactional DMs,
        # so we accept False but record the choice for audit.

        # Geo hint: first language token off Accept-Language (e.g. "fi-FI").
        accept_language = (request.headers.get("accept-language") or "").split(",")[0].strip()[:32]
        # Trust the proxy chain; pick the first hop client provided.
        signup_ip = (
            (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
            or (request.client.host if request.client else "")
        )[:64]

        # Re-use existing pending_id for the same email so a user retrying
        # the form ends up bound to the same Telegram link they were given
        # the first time. Idempotent by design.
        existing = await db.mittari_subscribers.find_one(
            {"email": email}, {"_id": 0, "pending_id": 1, "status": 1}
        )
        pending_id = (existing or {}).get("pending_id") or f"mittari_{secrets.token_hex(4)}"

        now = _utc_iso()
        await db.mittari_subscribers.update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "segment": segment,
                    "age_confirmed": True,
                    "consent_marketing": bool(payload.marketing_consent),
                    "accept_language": accept_language,
                    "signup_ip": signup_ip,
                    "consent_tag": "mittari_alerts",
                    "source": "web_signup",
                    "pending_id": pending_id,
                    "last_seen_at": now,
                    "referrer": (payload.referrer or "")[:240],
                },
                # New rows land as "pending" and stay there until the bot
                # binds a Telegram chat_id (Slice 3 finalises the flip).
                "$setOnInsert": {"created_at": now, "status": "pending", "active": True},
            },
            upsert=True,
        )

        return {
            "ok": True,
            "pending_id": pending_id,
            "telegram_deep_link": _deep_link(pending_id),
            "segment": segment,
        }

    # ─── Admin quick-search (back-office "find a subscriber") ──────
    @router.get("/admin/subscribers/lookup")
    async def admin_subscribers_lookup(
        q: str = "",
        limit: int = 10,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        q = (q or "").strip()
        if not q:
            return {"items": [], "count": 0}
        # Match against email (prefix), pending_id (exact-ish), or chat_id.
        clauses = [
            {"email": {"$regex": f"^{re.escape(q.lower())}", "$options": "i"}},
            {"pending_id": q},
        ]
        if q.isdigit():
            try:
                clauses.append({"telegram_chat_id": int(q)})
            except ValueError:
                pass
        clauses.append({"telegram_username": q.lstrip("@")})

        proj = {
            "_id": 0, "email": 1, "segment": 1, "status": 1, "active": 1,
            "pending_id": 1, "telegram_chat_id": 1, "telegram_username": 1,
            "telegram_bound_at": 1, "created_at": 1, "accept_language": 1,
            "consent_marketing": 1,
        }
        cur = db.mittari_subscribers.find({"$or": clauses}, proj).limit(max(1, min(50, limit)))
        items = [d async for d in cur]
        return {"items": items, "count": len(items)}

    return router
