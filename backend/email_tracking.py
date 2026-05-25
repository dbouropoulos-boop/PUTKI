"""
PUTKI HQ - Email tracking pixel + click tracking.

Industry-standard 1×1 transparent GIF pixel injected into outbound
playbook (and future) emails to track opens, plus a redirect endpoint
for click tracking.

GDPR posture:
  - We only track aggregate counters (open_count, click_count) and the
    first/last open/click timestamp on each outbox row.
  - We do NOT log IP addresses or user-agents by default (a single hash
    suffix is stored to detect re-opens from the same client without
    re-identifying them).
  - Killswitch via env: `EMAIL_TRACKING_ENABLED=0` disables BOTH the
    pixel injection AND the link rewriting.
  - The user-data-deletion cascade on `voita_entry_id` removes tracking
    counters with the rest of the row.

Token format: 24-char URL-safe base64 (no padding). Random per outbox row
- never reused, never derived from PII.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple
from urllib.parse import quote, urlparse

logger = logging.getLogger(__name__)

# 1×1 transparent GIF (smallest legal GIF, 43 bytes).
TRANSPARENT_GIF_1x1 = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00"
    b"!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
    b"\x00\x02\x02D\x01\x00;"
)

_TRACK_ENABLED_FLAG = os.environ.get("EMAIL_TRACKING_ENABLED", "1").strip()

# Trusted host allowlist for click redirects - refuses anything else so
# the redirector cannot be weaponised as an open redirect.
_ALLOWED_HOSTS = {
    "putkihq.fi",
    "www.putkihq.fi",
    "weezybet.com",
    "www.weezybet.com",
    "t.me",
    "peluuri.fi",
    "www.peluuri.fi",
}


def tracking_enabled() -> bool:
    return _TRACK_ENABLED_FLAG not in {"0", "false", "False", ""}


def new_token() -> str:
    return secrets.token_urlsafe(18)  # ~24 char string


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client_fingerprint(user_agent: Optional[str]) -> str:
    """Short hash of UA so we can collapse repeat opens from one client.
    Not a PII identifier - full UA is never stored alongside email."""
    src = (user_agent or "").strip()[:200]
    return hashlib.sha256(src.encode("utf-8")).hexdigest()[:10]


def _public_base() -> str:
    """Public base URL the EMAIL recipient will hit (NOT the internal
    cluster URL). We prefer EMAIL_PUBLIC_BASE_URL (set in prod) and fall
    back to REACT_APP_BACKEND_URL which works in preview."""
    base = (
        os.environ.get("EMAIL_PUBLIC_BASE_URL")
        or os.environ.get("REACT_APP_BACKEND_URL")
        or ""
    ).strip()
    return base.rstrip("/")


def build_pixel_url(token: str) -> str:
    return f"{_public_base()}/api/track/o/{token}.gif"


def build_click_url(token: str, target_url: str) -> str:
    """Wraps target URL behind the click tracker. Returns the original
    URL untouched if tracking is disabled or the target host isn't on
    the allowlist (so we never become an open redirector)."""
    if not tracking_enabled() or not target_url:
        return target_url
    try:
        host = (urlparse(target_url).hostname or "").lower()
    except Exception:
        return target_url
    if host not in _ALLOWED_HOSTS:
        return target_url
    u_b64 = base64.urlsafe_b64encode(target_url.encode("utf-8")).rstrip(b"=").decode("ascii")
    return f"{_public_base()}/api/track/c/{token}?u={quote(u_b64)}"


def inject_tracking_into_html(html: str, token: str) -> str:
    """Append the open pixel + (best-effort) rewrite any inline anchors
    to the click tracker. Always returns valid HTML (no-op on errors)."""
    if not tracking_enabled() or not token:
        return html
    try:
        pixel = (
            f'<img src="{build_pixel_url(token)}" alt="" width="1" height="1" '
            f'style="display:block;width:1px;height:1px;border:0;opacity:0" />'
        )
        # If the body already ends with </div>/</body>, slot the pixel just before.
        for closer in ("</body>", "</html>", "</div>"):
            if closer in html:
                return html.replace(closer, pixel + closer, 1)
        return html + pixel
    except Exception:
        logger.exception("inject_tracking_into_html failed (non-fatal)")
        return html


# ── Mongo recorders ───────────────────────────────────────────────────

async def record_open(db, token: str, user_agent: Optional[str] = None) -> bool:
    """Increment open_count on the outbox row matching this token.
    Returns True if a row was updated, False otherwise."""
    if not token:
        return False
    fp = _client_fingerprint(user_agent)
    now = _now_iso()
    set_op = {
        "last_opened_at": now,
        "last_opened_fp": fp,
    }
    # Use $setOnInsert via upsert=False trick: $set only if first time
    res = await db.email_outbox.update_one(
        {"track_token": token, "first_opened_at": {"$exists": False}},
        {"$set": {**set_op, "first_opened_at": now}, "$inc": {"open_count": 1}},
    )
    if res.modified_count > 0:
        return True
    # Repeat open path: skip first_opened_at, just bump counter + last_*.
    res2 = await db.email_outbox.update_one(
        {"track_token": token},
        {"$set": set_op, "$inc": {"open_count": 1}},
    )
    return res2.modified_count > 0


async def record_click(db, token: str, target_url: str,
                       user_agent: Optional[str] = None) -> bool:
    if not token or not target_url:
        return False
    fp = _client_fingerprint(user_agent)
    now = _now_iso()
    res = await db.email_outbox.update_one(
        {"track_token": token, "first_clicked_at": {"$exists": False}},
        {"$set": {
            "last_clicked_at": now,
            "last_clicked_url": target_url[:300],
            "last_clicked_fp": fp,
            "first_clicked_at": now,
        }, "$inc": {"click_count": 1}},
    )
    if res.modified_count > 0:
        return True
    res2 = await db.email_outbox.update_one(
        {"track_token": token},
        {"$set": {
            "last_clicked_at": now,
            "last_clicked_url": target_url[:300],
            "last_clicked_fp": fp,
        }, "$inc": {"click_count": 1}},
    )
    return res2.modified_count > 0


def decode_target(u_b64: Optional[str]) -> Optional[str]:
    """Decode the base64url-encoded target URL from the click query string."""
    if not u_b64:
        return None
    try:
        pad = "=" * (-len(u_b64) % 4)
        raw = base64.urlsafe_b64decode((u_b64 + pad).encode("ascii"))
        url = raw.decode("utf-8")
    except Exception:
        return None
    if not url.lower().startswith(("http://", "https://")):
        return None
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return None
    if host not in _ALLOWED_HOSTS:
        return None
    return url


# ── Aggregate summary helper ─────────────────────────────────────────

async def tracking_summary(db) -> Tuple[int, int, int]:
    """Return (outbox_total, opens_total, clicks_total) for the playbook
    surface. Used by the back-office to surface the new tracking columns
    without a second round-trip."""
    pipeline = [
        {"$match": {"source": "voita_playbook"}},
        {"$group": {
            "_id": None,
            "n": {"$sum": 1},
            "opens": {"$sum": {"$ifNull": ["$open_count", 0]}},
            "clicks": {"$sum": {"$ifNull": ["$click_count", 0]}},
        }},
    ]
    async for row in db.email_outbox.aggregate(pipeline):
        return (int(row.get("n", 0)), int(row.get("opens", 0)), int(row.get("clicks", 0)))
    return (0, 0, 0)
