"""
PUTKI HQ — alert-manager session auth (iter52).

Email-link-of-the-decade flow. No passwords; users prove they own the
email by entering a 6-digit code we send to it. Verified codes mint an
opaque session token (30-day TTL) the bell-icon UI uses to read +
delete that user's streamer alert subscriptions.

Collections:
  - alert_login_codes  TTL 10 min  {email, code_hash, attempts, created_at, expires_at}
  - alert_sessions     TTL 30 day  {token_hash, email, created_at, expires_at, last_used_at}

We hash the code + the token before storing so a DB leak doesn't surface
plaintext credentials. Rate-limiting: max 5 verify attempts per code.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CODE_TTL_MINUTES = 10
SESSION_TTL_DAYS = 30
MAX_VERIFY_ATTEMPTS = 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


async def ensure_indexes(db) -> None:
    try:
        await db.alert_login_codes.create_index("email")
        await db.alert_login_codes.create_index(
            "expires_at", expireAfterSeconds=0,
        )
        await db.alert_sessions.create_index("token_hash", unique=True)
        await db.alert_sessions.create_index(
            "expires_at", expireAfterSeconds=0,
        )
    except Exception:
        logger.exception("alert_sessions index ensure failed")


# ─────────────────────── Step 1 — request a code ──────────────────────

async def request_code(db, email: str) -> Dict[str, Any]:
    """Generate + persist a 6-digit code for `email`. Queues an email
    (real Resend send when RESEND_API_KEY is set; otherwise an
    `email_outbox` row for the back-office to read).

    Returns `{status, expires_at}`. Never echoes the code itself —
    that's only available to the admin via the preview endpoint."""
    email = (email or "").strip().lower()
    if not EMAIL_RE.match(email):
        return {"status": "error", "reason": "invalid_email"}

    code = f"{secrets.randbelow(1_000_000):06d}"
    now = _now()
    expires = now + timedelta(minutes=CODE_TTL_MINUTES)

    # Invalidate any prior outstanding codes for this email.
    await db.alert_login_codes.delete_many({"email": email})
    await db.alert_login_codes.insert_one({
        "email": email,
        "code_hash": _hash(code),
        "attempts": 0,
        "created_at": now,
        "expires_at": expires,
    })

    # Queue the email. Resend dispatch path lives in `email_outbox`
    # (real send when keys arrive; mock + visible in /back-office/leads
    # until then).
    try:
        await db.email_outbox.insert_one({
            "to": email,
            "subject": "PUTKI HQ — sisäänkirjautumiskoodi",
            "template": "alert_login_code",
            "text": (
                f"Putki HQ -hälytysten hallinta\n\n"
                f"Vahvistuskoodisi: {code}\n\n"
                f"Koodi vanhenee {CODE_TTL_MINUTES} minuutin kuluttua.\n"
                f"Jos et pyytänyt tätä, voit ohittaa viestin."
            ),
            "html": (
                f"<p>Putki HQ — hälytysten hallinta</p>"
                f"<p>Vahvistuskoodisi: <b style='font-size:22px;letter-spacing:6px'>{code}</b></p>"
                f"<p>Koodi vanhenee {CODE_TTL_MINUTES} minuutin kuluttua.</p>"
                f"<p style='color:#888;font-size:12px'>Jos et pyytänyt tätä, voit ohittaa viestin.</p>"
            ),
            "queued_at": now.isoformat(),
            "status": "queued",
            "kind": "alert_login_code",
        })
    except Exception:
        logger.exception("alert_sessions: email_outbox insert failed")

    return {"status": "ok", "expires_at": expires.isoformat()}


# ─────────────────────── Step 2 — verify the code ─────────────────────

async def verify_code(db, email: str, code: str) -> Dict[str, Any]:
    """Verify the 6-digit code. On success returns `{token, expires_at}`."""
    email = (email or "").strip().lower()
    code = (code or "").strip()
    if not EMAIL_RE.match(email):
        return {"status": "error", "reason": "invalid_email"}
    if not re.fullmatch(r"\d{6}", code):
        return {"status": "error", "reason": "invalid_code"}

    doc = await db.alert_login_codes.find_one({"email": email})
    if not doc:
        return {"status": "error", "reason": "code_expired_or_unknown"}

    # `expires_at` is the TTL marker — Mongo cleans it up but the worker
    # may not have run yet, so guard manually. Mongo strips tzinfo on
    # round-trip; treat naive datetimes as UTC.
    expires = doc.get("expires_at")
    if isinstance(expires, datetime):
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < _now():
            await db.alert_login_codes.delete_one({"_id": doc["_id"]})
            return {"status": "error", "reason": "code_expired_or_unknown"}

    if doc.get("attempts", 0) >= MAX_VERIFY_ATTEMPTS:
        return {"status": "error", "reason": "too_many_attempts"}

    if _hash(code) != doc.get("code_hash"):
        await db.alert_login_codes.update_one(
            {"_id": doc["_id"]}, {"$inc": {"attempts": 1}},
        )
        return {"status": "error", "reason": "code_mismatch"}

    # Success — burn the code, mint a session token.
    await db.alert_login_codes.delete_one({"_id": doc["_id"]})
    token = secrets.token_urlsafe(32)
    now = _now()
    session_expires = now + timedelta(days=SESSION_TTL_DAYS)
    await db.alert_sessions.insert_one({
        "token_hash": _hash(token),
        "email": email,
        "created_at": now,
        "expires_at": session_expires,
        "last_used_at": now,
    })
    return {"status": "ok", "token": token, "expires_at": session_expires.isoformat(),
            "email": email}


# ─────────────────────── Token resolution ─────────────────────────────

async def resolve_session(db, token: Optional[str]) -> Optional[str]:
    """Return the email tied to `token`, or None. Touches `last_used_at`
    on hit. O(1) via the unique `token_hash` index."""
    if not token:
        return None
    th = _hash(token.strip())
    s = await db.alert_sessions.find_one({"token_hash": th}, {"_id": 0, "email": 1, "expires_at": 1})
    if not s:
        return None
    exp = s.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < _now():
            await db.alert_sessions.delete_one({"token_hash": th})
            return None
    await db.alert_sessions.update_one({"token_hash": th}, {"$set": {"last_used_at": _now()}})
    return s.get("email")


async def revoke_session(db, token: str) -> None:
    if not token:
        return
    await db.alert_sessions.delete_one({"token_hash": _hash(token.strip())})


# ─────────────────────── Subscription ops (per-session) ───────────────

async def list_subscriptions(db, email: str) -> list:
    """Return every streamer_alerts row for this email, newest first."""
    cur = db.streamer_alerts.find(
        {"email": (email or "").strip().lower()},
        {"_id": 0, "id": 1, "streamer_login": 1, "streamer_name": 1,
         "platform": 1, "channels": 1, "phone": 1, "telegram_username": 1,
         "created_at": 1, "updated_at": 1, "last_notified_at": 1},
    ).sort("created_at", -1)
    return [d async for d in cur]


async def delete_subscription(db, email: str, sub_id: str) -> bool:
    r = await db.streamer_alerts.delete_one({
        "id": sub_id,
        "email": (email or "").strip().lower(),
    })
    return r.deleted_count > 0


# ─────────────────────── Admin preview hatch ──────────────────────────

async def list_pending_codes(db) -> list:
    """Admin-only — see codes queued for delivery (used in preview when
    Resend isn't wired). Includes the email_outbox row so the admin can
    extract the code from the rendered HTML."""
    out = []
    async for d in db.email_outbox.find(
        {"kind": "alert_login_code", "status": {"$in": ["queued", "pending"]}},
        {"_id": 0, "to": 1, "queued_at": 1, "text": 1, "status": 1},
    ).sort("queued_at", -1).limit(20):
        # Pull the 6-digit code out of the queued text so the admin
        # doesn't have to eyeball.
        m = re.search(r"\b(\d{6})\b", d.get("text") or "")
        if m:
            d["code"] = m.group(1)
        out.append(d)
    return out
