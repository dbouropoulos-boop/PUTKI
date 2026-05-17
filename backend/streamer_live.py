"""
PUTKI HQ — Live Twitch streamer discovery for the homepage "Mitä tapahtuu nyt"
strip. 100% REAL data from Twitch Helix.

Strategy:
  • Pull live streams filtered by `language=fi` (Helix supports this server-side).
  • Optionally augment with follower counts (one extra request per channel).
  • Cache the merged response for 60s in-process to stay well under Helix
    rate limits (800 req/min app token) regardless of homepage traffic.

If Twitch credentials are missing the endpoint returns a dormant payload
(`{streamers: [], dormant: true, reason: ...}`) — never fabricated data.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

from twitch_eventsub import (
    TWITCH_HELIX_BASE,
    _client_id,
    get_app_access_token,
    is_configured,
)

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = int(os.environ.get("STREAMER_LIVE_CACHE_TTL", "60"))
LIVE_LANGUAGE = os.environ.get("STREAMER_LIVE_LANGUAGE", "fi")
MAX_RESULTS = int(os.environ.get("STREAMER_LIVE_MAX_RESULTS", "12"))

_cache: Dict[str, Any] = {"payload": None, "expires_at": 0.0}
_lock = asyncio.Lock()


async def _helix_get(path: str, params: Dict[str, Any], token: str) -> Dict[str, Any]:
    headers = {"Client-Id": _client_id(), "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(f"{TWITCH_HELIX_BASE}{path}", params=params, headers=headers)
        r.raise_for_status()
        return r.json()


async def _fetch_followers(broadcaster_id: str, token: str) -> Optional[int]:
    try:
        data = await _helix_get(
            "/channels/followers",
            {"broadcaster_id": broadcaster_id, "first": 1},
            token,
        )
        total = data.get("total")
        return int(total) if total is not None else None
    except Exception:
        return None


async def _build_payload() -> Dict[str, Any]:
    if not is_configured():
        return {
            "streamers": [],
            "dormant": True,
            "reason": "twitch_credentials_not_configured",
            "fetched_at": time.time(),
        }

    try:
        token = await get_app_access_token()
    except Exception as e:
        logger.warning("Twitch OAuth fetch failed: %s", e)
        return {
            "streamers": [],
            "dormant": True,
            "reason": "twitch_oauth_failed",
            "fetched_at": time.time(),
        }

    try:
        raw = await _helix_get(
            "/streams",
            {"language": LIVE_LANGUAGE, "first": MAX_RESULTS},
            token,
        )
    except Exception as e:
        logger.warning("Twitch streams fetch failed: %s", e)
        return {
            "streamers": [],
            "dormant": True,
            "reason": "twitch_streams_failed",
            "fetched_at": time.time(),
        }

    streams = raw.get("data", []) or []
    if not streams:
        return {
            "streamers": [],
            "dormant": False,
            "reason": "no_live_streamers_in_language",
            "language": LIVE_LANGUAGE,
            "fetched_at": time.time(),
        }

    # Fetch follower counts in parallel — bounded by MAX_RESULTS.
    ids = [s.get("user_id") for s in streams if s.get("user_id")]
    follower_tasks = {uid: asyncio.create_task(_fetch_followers(uid, token)) for uid in ids}
    follower_results: Dict[str, Optional[int]] = {}
    for uid, task in follower_tasks.items():
        try:
            follower_results[uid] = await task
        except Exception:
            follower_results[uid] = None

    out: List[Dict[str, Any]] = []
    for s in streams:
        login = (s.get("user_login") or "").lower()
        uid = s.get("user_id")
        out.append({
            "user_login": login,
            "user_name": s.get("user_name"),
            "title": s.get("title"),
            "viewer_count": int(s.get("viewer_count", 0) or 0),
            "game_name": s.get("game_name"),
            "thumbnail_url": (s.get("thumbnail_url") or "")
                .replace("{width}", "640").replace("{height}", "360"),
            "profile_url": f"https://www.twitch.tv/{login}" if login else None,
            "started_at": s.get("started_at"),
            "follower_count": follower_results.get(uid),
            "tags": s.get("tags", []) or [],
        })

    return {
        "streamers": out,
        "dormant": False,
        "language": LIVE_LANGUAGE,
        "count": len(out),
        "fetched_at": time.time(),
    }


async def get_live_streamers() -> Dict[str, Any]:
    """Cached entrypoint. 60s TTL by default."""
    now = time.time()
    if _cache["payload"] and _cache["expires_at"] > now:
        return _cache["payload"]

    async with _lock:
        # Double-check after acquiring the lock.
        now = time.time()
        if _cache["payload"] and _cache["expires_at"] > now:
            return _cache["payload"]

        payload = await _build_payload()
        _cache["payload"] = payload
        _cache["expires_at"] = now + CACHE_TTL_SECONDS
        return payload
