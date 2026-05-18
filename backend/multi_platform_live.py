"""
PUTKI HQ — Multi-platform live streamer fetcher.

Aggregates "who's live RIGHT NOW" across Twitch + Kick + YouTube into a
unified payload for the homepage carousel.

Twitch:
  • Helix `GET /streams?language=fi` (already wired in streamer_live.py)

Kick:
  • Public `GET https://kick.com/api/v2/channels/{login}` per curated
    streamer. Response includes `livestream` (null if offline). Cached.

YouTube:
  • YouTube Data API v3 `search?eventType=live` per curated channel id.
    Requires YOUTUBE_API_KEY. If no YouTube streamers are in the registry
    we surface an honest empty payload (no fake placeholders).

All three lookups are cached per-platform with `MULTI_LIVE_CACHE_TTL` (60s).
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

CACHE_TTL = int(os.environ.get("MULTI_LIVE_CACHE_TTL", "60"))
_cache: Dict[str, Dict[str, Any]] = {}
_locks: Dict[str, asyncio.Lock] = {
    "kick": asyncio.Lock(),
    "youtube": asyncio.Lock(),
}


def _now() -> float:
    return time.time()


def _expired(platform: str) -> bool:
    entry = _cache.get(platform)
    return not entry or entry.get("expires_at", 0) < _now()


def _store(platform: str, payload: Dict[str, Any]) -> None:
    _cache[platform] = {"payload": payload, "expires_at": _now() + CACHE_TTL}


async def _fetch_kick_channel(login: str) -> Optional[Dict[str, Any]]:
    """Hit kick.com/api/v2/channels/{login} and return normalised live entry
    if the channel is currently live, else None. Returns the string
    "blocked" when Kick's Cloudflare layer rejects the request — caller
    uses this to flag the whole platform as dormant rather than silently
    returning empty.
    Public endpoint, no auth needed.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://kick.com/",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as http:
            r = await http.get(f"https://kick.com/api/v2/channels/{login}", headers=headers)
            if r.status_code == 403 or r.status_code == 429:
                return "blocked"
            if r.status_code != 200:
                return None
            data = r.json()
    except Exception:
        return None

    livestream = data.get("livestream")
    if not livestream or not livestream.get("is_live"):
        return None

    return {
        "platform": "kick",
        "user_login": login,
        "user_name": data.get("user", {}).get("username") or login,
        "title": livestream.get("session_title") or "",
        "viewer_count": int(livestream.get("viewer_count", 0) or 0),
        "game_name": (livestream.get("categories") or [{}])[0].get("name"),
        "thumbnail_url": livestream.get("thumbnail", {}).get("url")
            or data.get("user", {}).get("profile_pic"),
        "profile_url": f"https://kick.com/{login}",
        "started_at": livestream.get("start_time"),
        "follower_count": data.get("followersCount"),
    }


async def fetch_kick_live(db) -> Dict[str, Any]:
    """Iterate the streamer registry's Kick channels and return only those
    currently live. Caches per `CACHE_TTL`."""
    if not _expired("kick"):
        return _cache["kick"]["payload"]

    async with _locks["kick"]:
        if not _expired("kick"):
            return _cache["kick"]["payload"]

        try:
            from rosters import list_streamers as _list_streamers
            streamers = await _list_streamers(db)
        except Exception:
            streamers = []

        logins = [
            (s.get("channel") or s.get("slug") or "").lower()
            for s in streamers
            if (s.get("platform") or "").lower() == "kick"
            and (s.get("channel") or s.get("slug"))
        ]

        if not logins:
            payload = {"streamers": [], "platform": "kick", "count": 0,
                       "dormant": False, "reason": "no_kick_streamers_in_registry",
                       "fetched_at": _now()}
            _store("kick", payload)
            return payload

        results = await asyncio.gather(
            *[_fetch_kick_channel(login) for login in logins],
            return_exceptions=True,
        )
        # If all probes came back as "blocked", surface that as dormant so
        # the UI can show an honest "Kick API unavailable" message instead
        # of a silently empty grid.
        all_blocked = bool(results) and all(r == "blocked" for r in results)
        live = [r for r in results if isinstance(r, dict)]
        live.sort(key=lambda r: -(r.get("viewer_count") or 0))
        if all_blocked and not live:
            payload = {"streamers": [], "platform": "kick", "count": 0,
                       "dormant": True, "reason": "kick_api_blocked",
                       "fetched_at": _now()}
        else:
            payload = {"streamers": live, "platform": "kick", "count": len(live),
                       "dormant": False, "fetched_at": _now()}
        _store("kick", payload)
        return payload


async def _fetch_youtube_live(channel_id: str, api_key: str) -> Optional[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as http:
            r = await http.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "channelId": channel_id,
                    "eventType": "live",
                    "type": "video",
                    "key": api_key,
                },
            )
            if r.status_code != 200:
                return None
            data = r.json()
    except Exception:
        return None

    items = data.get("items") or []
    if not items:
        return None
    item = items[0]
    snip = item.get("snippet", {})
    vid = item.get("id", {}).get("videoId")
    if not vid:
        return None
    return {
        "platform": "youtube",
        "user_login": channel_id,
        "user_name": snip.get("channelTitle"),
        "title": snip.get("title"),
        "viewer_count": None,  # YT search endpoint doesn't return live viewers
        "game_name": None,
        "thumbnail_url": (snip.get("thumbnails", {}).get("high") or {}).get("url"),
        "profile_url": f"https://www.youtube.com/watch?v={vid}",
        "started_at": snip.get("publishedAt"),
        "follower_count": None,
    }


async def fetch_youtube_live(db) -> Dict[str, Any]:
    if not _expired("youtube"):
        return _cache["youtube"]["payload"]

    async with _locks["youtube"]:
        if not _expired("youtube"):
            return _cache["youtube"]["payload"]

        api_key = os.environ.get("YOUTUBE_API_KEY")
        if not api_key:
            payload = {"streamers": [], "platform": "youtube", "count": 0,
                       "dormant": True, "reason": "youtube_api_key_not_configured",
                       "fetched_at": _now()}
            _store("youtube", payload)
            return payload

        try:
            from rosters import list_streamers as _list_streamers
            streamers = await _list_streamers(db)
        except Exception:
            streamers = []

        channel_ids = [
            (s.get("channel") or "")
            for s in streamers
            if (s.get("platform") or "").lower() == "youtube"
            and (s.get("channel") or "").startswith("UC")
        ]

        if not channel_ids:
            payload = {"streamers": [], "platform": "youtube", "count": 0,
                       "dormant": False, "reason": "no_youtube_streamers_in_registry",
                       "fetched_at": _now()}
            _store("youtube", payload)
            return payload

        results = await asyncio.gather(
            *[_fetch_youtube_live(cid, api_key) for cid in channel_ids],
            return_exceptions=True,
        )
        live = [r for r in results if isinstance(r, dict)]
        payload = {"streamers": live, "platform": "youtube", "count": len(live),
                   "dormant": False, "fetched_at": _now()}
        _store("youtube", payload)
        return payload
