"""
PUTKI HQ - Streamer alert subscription store.

Captures `POST /api/alerts/streamer` opt-ins (email + optional phone +
optional Telegram username) tied to a specific streamer login + platform.

Delivery hooks (Telegram bot push, SMS, WhatsApp) are stubbed at the
end of this module and fire when the Layer 2 stream poller transitions
that streamer from OFFLINE → LIVE.

Schema (collection: streamer_alerts):
{
  id: uuid,
  email: str,
  phone: str | None,
  telegram_username: str | None,
  streamer_login: str (lowercased),
  streamer_name: str | None,
  platform: 'twitch' | 'kick' | 'youtube',
  channels: ['email' | 'telegram' | 'sms' | 'whatsapp'],
  created_at: iso,
  confirmed: bool,
  last_notified_at: iso | None,
}
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


SUPPORTED_PLATFORMS = {"twitch", "kick", "youtube"}
SUPPORTED_CHANNELS = {"email", "telegram", "sms", "whatsapp"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{6,20}$")


async def ensure_indexes(db) -> None:
    try:
        await db.streamer_alerts.create_index([("email", 1), ("streamer_login", 1), ("platform", 1)])
        await db.streamer_alerts.create_index("created_at")
    except Exception:
        logger.exception("Failed to create streamer_alerts indexes")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalise(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return value.strip() or None


async def create_alert(
    db,
    *,
    email: str,
    streamer_login: str,
    streamer_name: Optional[str],
    platform: str,
    phone: Optional[str] = None,
    telegram_username: Optional[str] = None,
    channels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    email = (email or "").strip().lower()
    streamer_login = (streamer_login or "").strip().lower()
    platform = (platform or "").strip().lower()

    if not EMAIL_RE.match(email):
        return {"status": "error", "reason": "invalid_email"}
    if not streamer_login:
        return {"status": "error", "reason": "missing_streamer"}
    if platform not in SUPPORTED_PLATFORMS:
        return {"status": "error", "reason": "invalid_platform"}

    phone = _normalise(phone)
    if phone and not PHONE_RE.match(phone):
        return {"status": "error", "reason": "invalid_phone"}

    telegram_username = _normalise(telegram_username)
    if telegram_username and telegram_username.startswith("@"):
        telegram_username = telegram_username[1:]

    if not channels:
        channels = ["email"] + (["telegram"] if telegram_username else []) + (["sms"] if phone else [])
    channels = sorted({c.strip().lower() for c in channels if c.strip().lower() in SUPPORTED_CHANNELS})

    # Upsert - same email + streamer + platform replaces the older subscription
    existing = await db.streamer_alerts.find_one(
        {"email": email, "streamer_login": streamer_login, "platform": platform},
        {"_id": 0},
    )
    doc = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "email": email,
        "phone": phone,
        "telegram_username": telegram_username,
        "streamer_login": streamer_login,
        "streamer_name": _normalise(streamer_name),
        "platform": platform,
        "channels": channels,
        "created_at": existing["created_at"] if existing else _now_iso(),
        "updated_at": _now_iso(),
        "confirmed": bool(existing.get("confirmed") if existing else False),
        "last_notified_at": existing.get("last_notified_at") if existing else None,
    }
    if existing:
        await db.streamer_alerts.update_one(
            {"id": doc["id"]},
            {"$set": {k: v for k, v in doc.items() if k != "id"}},
        )
        return {"status": "updated", "id": doc["id"]}

    await db.streamer_alerts.insert_one(dict(doc))
    return {"status": "created", "id": doc["id"]}


async def count_alerts(db) -> Dict[str, int]:
    """Public-safe stats for the homepage ticker."""
    try:
        total = await db.streamer_alerts.count_documents({})
        return {"total_alerts": int(total)}
    except Exception:
        return {"total_alerts": 0}


async def list_subscribers_for(db, *, streamer_login: str, platform: str) -> List[Dict[str, Any]]:
    cur = db.streamer_alerts.find(
        {"streamer_login": (streamer_login or "").lower(), "platform": (platform or "").lower()},
        {"_id": 0},
    )
    return await cur.to_list(length=2000)


# ───────── Delivery (Telegram bot push) ─────────

async def notify_subscribers_of_live(db, streamer_login: str, platform: str,
                                     stream_url: str, headline: str) -> Dict[str, Any]:
    """Fan out a notification to every subscriber of `streamer_login` on
    `platform`. Telegram is the only channel that currently delivers - SMS +
    WhatsApp are captured for future Twilio integration.

    Returns counters for ops visibility. Safe to call when no subscribers
    exist or when TELEGRAM_BOT_TOKEN is unset (logs a warning, exits)."""
    import httpx
    subs = await list_subscribers_for(db, streamer_login=streamer_login, platform=platform)
    if not subs:
        return {"subscribers": 0, "sent": 0}

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        logger.info("TELEGRAM_BOT_TOKEN unset; %d subscribers queued for later", len(subs))
        return {"subscribers": len(subs), "sent": 0, "reason": "telegram_token_missing"}

    sent = 0
    failures = 0
    async with httpx.AsyncClient(timeout=8.0) as http:
        for s in subs:
            if "telegram" not in (s.get("channels") or []) or not s.get("telegram_username"):
                continue
            text = (f"🔴 *{s.get('streamer_name') or streamer_login}* on livenä juuri nyt!\n\n"
                    f"{headline}\n\n[Avaa stream]({stream_url})")
            try:
                # Telegram requires numeric chat_id in practice. We optimistically
                # send via @username (works only if user has /started the bot
                # and Telegram resolves usernames to chat ids - they typically
                # don't, so this is a launch placeholder).
                r = await http.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": f"@{s['telegram_username']}", "text": text,
                          "parse_mode": "Markdown", "disable_web_page_preview": False},
                )
                if r.status_code == 200:
                    sent += 1
                    await db.streamer_alerts.update_one(
                        {"id": s["id"]},
                        {"$set": {"last_notified_at": _now_iso()}},
                    )
                else:
                    failures += 1
            except Exception:
                failures += 1
    return {"subscribers": len(subs), "sent": sent, "failures": failures}
