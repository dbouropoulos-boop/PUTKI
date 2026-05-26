"""
PUTKI HQ - Twitch auto-discovery for Finnish casino/slots streamers.

Strategy:
  • Helix /streams?language=fi&first=100 → all FI live streams
  • Filter to "Slots" / "Casino" / "Virtual Casino" categories
  • For each candidate, fetch follower count via /channels/followers
  • Auto-register streamers with ≥1000 followers into the streamer registry
    (idempotent - upserted by slug)

Targets 60-90 discovered streamers over a few cycles. Runs every 6h to
avoid hammering Twitch.

Kill switch: PUTKI_HQ_DISABLE_AUTO_DISCOVERY=1
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

DISCOVERY_INTERVAL_SECONDS = int(os.environ.get("TWITCH_DISCOVERY_INTERVAL", "21600"))
MIN_FOLLOWERS = int(os.environ.get("TWITCH_DISCOVERY_MIN_FOLLOWERS", "1000"))
ALLOWED_CATEGORIES = {
    c.strip().lower() for c in os.environ.get(
        "TWITCH_DISCOVERY_CATEGORIES",
        "slots,casino,virtual casino,gambling",
    ).split(",") if c.strip()
}
HTTP_TIMEOUT_SECONDS = 15.0


async def _helix_get(path: str, params: Dict[str, Any], client_id: str, token: str) -> Dict[str, Any]:
    headers = {"Client-Id": client_id, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as http:
        r = await http.get(f"https://api.twitch.tv/helix{path}", params=params, headers=headers)
        r.raise_for_status()
        return r.json()


async def _fetch_follower_count(broadcaster_id: str, client_id: str, token: str) -> Optional[int]:
    try:
        data = await _helix_get(
            "/channels/followers",
            {"broadcaster_id": broadcaster_id, "first": 1},
            client_id, token,
        )
        total = data.get("total")
        return int(total) if total is not None else None
    except Exception:
        return None


async def discover_once(db) -> Dict[str, Any]:
    """One discovery pass. Returns summary of additions."""
    try:
        from twitch_eventsub import is_configured, get_app_access_token, _client_id
    except Exception:
        return {"status": "skipped", "reason": "twitch_eventsub_module_missing"}

    if not is_configured():
        return {"status": "skipped", "reason": "twitch_credentials_not_configured"}

    try:
        token = await get_app_access_token()
    except Exception as e:
        logger.warning("Auto-discovery OAuth failed: %s", e)
        return {"status": "skipped", "reason": "oauth_failed"}

    client_id = _client_id()
    try:
        data = await _helix_get(
            "/streams",
            {"language": "fi", "first": 100},
            client_id, token,
        )
    except Exception as e:
        logger.warning("Auto-discovery /streams failed: %s", e)
        return {"status": "error", "reason": "streams_fetch_failed"}

    streams = data.get("data", []) or []
    candidates = [
        s for s in streams
        if (s.get("game_name") or "").strip().lower() in ALLOWED_CATEGORIES
        and s.get("user_id") and s.get("user_login")
    ]

    if not candidates:
        # iter75d - early-return must still carry the constant shape
        # (`promoted`, `min_followers`) so consumers don't need to
        # branch on "ok" sub-states. Test contract requires
        # `min_followers` on every ok response.
        return {"status": "ok", "discovered": 0, "added": 0,
                "promoted": [], "skipped_category": len(streams),
                "min_followers": MIN_FOLLOWERS}

    # Fetch follower counts for candidates in parallel
    follower_tasks = [_fetch_follower_count(s["user_id"], client_id, token) for s in candidates]
    follower_results = await asyncio.gather(*follower_tasks, return_exceptions=True)

    added = 0
    promoted: List[str] = []
    for s, follow in zip(candidates, follower_results):
        if not isinstance(follow, int) or follow < MIN_FOLLOWERS:
            continue
        login = (s.get("user_login") or "").lower()
        if not login:
            continue
        existing = await db.streamers.find_one({"slug": login})
        if existing:
            # Refresh follower count + last_seen if tracked
            await db.streamers.update_one(
                {"slug": login},
                {"$set": {
                    "follower_count": follow,
                    "auto_discovered": existing.get("auto_discovered", False),
                    "last_seen_live_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            continue
        doc = {
            "slug": login,
            "name": s.get("user_name") or login,
            "platform": "twitch",
            "channel": login,
            "scene": "fi",
            "market_id": "FI",
            "tier": 3,  # auto-discovered = tier 3 (below editorial tiers 1/2)
            "auto_discovered": True,
            "follower_count": follow,
            "category": s.get("game_name"),
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "last_seen_live_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.streamers.insert_one(dict(doc))
        added += 1
        promoted.append(login)

    return {
        "status": "ok",
        "discovered": len(candidates),
        "added": added,
        "promoted": promoted,
        "min_followers": MIN_FOLLOWERS,
    }


async def discovery_worker_loop(db) -> None:
    """Long-running background loop. Pauses for DISCOVERY_INTERVAL_SECONDS
    between runs."""
    while True:
        try:
            res = await discover_once(db)
            logger.info("twitch auto-discovery tick: %s", res)
        except Exception:
            logger.exception("twitch auto-discovery loop error")
        await asyncio.sleep(DISCOVERY_INTERVAL_SECONDS)
