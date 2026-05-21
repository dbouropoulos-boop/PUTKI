"""
PUTKI HQ — Kick official API client (iter52).

Replaces the legacy `kick.com/api/v2/channels/...` scraping path (which
sat behind Cloudflare bot-protection and returned 403 on every server-side
request, leaving Kick permanently dormant) with the official OAuth-gated
`api.kick.com/public/v1/...` endpoints.

Flow:
  1. OAuth client-credentials → app access token (cached until ~60s
     before its `expires_in`).
  2. Resolve our roster slugs → numeric `broadcaster_user_id` via
     `GET /public/v1/channels?slug=...`. Persistent cache in Mongo
     `kick_channel_cache` (slug → user_id, name) survives restarts since
     these are stable.
  3. Batched live query: `GET /public/v1/livestreams?broadcaster_user_id=...`.
     Response `data[]` contains ONLY channels currently live; absent
     channels are offline. Repeated `?broadcaster_user_id=` params are
     accepted by Kick (verified 2026-05-21 against the live API).

`dormant: true` is now reserved for genuine OAuth / 5xx failures —
otherwise we always return real results (empty array = nobody live).
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

OAUTH_URL = "https://id.kick.com/oauth/token"
API_BASE = "https://api.kick.com/public/v1"
CHANNELS_BATCH_LIMIT = 50  # safe batch size for repeated ?slug= / ?broadcaster_user_id=
HTTP_TIMEOUT = 10.0

_token_cache: Dict[str, Any] = {"value": None, "expires_at": 0.0}
_token_lock = asyncio.Lock()


def _now() -> float:
    return time.time()


# ─────────────────────── OAuth token (client-credentials) ──────────────

async def _get_app_token() -> Optional[str]:
    """Return a cached app access token, refreshing if within 60s of
    expiry. Returns None if credentials are missing or auth fails."""
    cid = os.environ.get("KICK_CLIENT_ID")
    sec = os.environ.get("KICK_CLIENT_SECRET")
    if not (cid and sec):
        return None

    if _token_cache["value"] and _token_cache["expires_at"] > _now() + 60:
        return _token_cache["value"]

    async with _token_lock:
        if _token_cache["value"] and _token_cache["expires_at"] > _now() + 60:
            return _token_cache["value"]
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
                r = await http.post(OAUTH_URL, data={
                    "grant_type": "client_credentials",
                    "client_id": cid, "client_secret": sec,
                })
                if r.status_code != 200:
                    logger.warning("Kick OAuth failed (HTTP %s): %s",
                                   r.status_code, r.text[:200])
                    return None
                data = r.json()
        except Exception as e:
            logger.warning("Kick OAuth request errored: %s", e)
            return None

        token = data.get("access_token")
        ttl = int(data.get("expires_in", 3600))
        if not token:
            return None
        _token_cache["value"] = token
        _token_cache["expires_at"] = _now() + ttl
        return token


# ─────────────────────── Slug → broadcaster_user_id ────────────────────

CHANNEL_CACHE_COLL = "kick_channel_cache"


async def _ensure_cache_indexes(db) -> None:
    try:
        await db[CHANNEL_CACHE_COLL].create_index("slug", unique=True)
    except Exception:
        pass


async def _resolve_slugs(db, slugs: List[str], token: str) -> Dict[str, int]:
    """Return {slug -> broadcaster_user_id} for every input slug we can
    resolve. Persistent cache: results are written back to Mongo so we
    don't re-resolve on every poll."""
    await _ensure_cache_indexes(db)
    out: Dict[str, int] = {}
    missing: List[str] = []

    async for d in db[CHANNEL_CACHE_COLL].find(
        {"slug": {"$in": slugs}}, {"_id": 0, "slug": 1, "broadcaster_user_id": 1}
    ):
        uid = d.get("broadcaster_user_id")
        if isinstance(uid, int):
            out[d["slug"]] = uid

    for s in slugs:
        if s not in out:
            missing.append(s)

    if not missing:
        return out

    # Resolve missing slugs in chunks (`?slug=a&slug=b&...` works).
    for i in range(0, len(missing), CHANNELS_BATCH_LIMIT):
        chunk = missing[i:i + CHANNELS_BATCH_LIMIT]
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
                r = await http.get(
                    f"{API_BASE}/channels",
                    params=[("slug", s) for s in chunk],
                    headers={"Authorization": f"Bearer {token}"},
                )
                if r.status_code != 200:
                    logger.warning("Kick /channels resolve failed (HTTP %s) for slugs=%s: %s",
                                   r.status_code, chunk, r.text[:200])
                    continue
                data = (r.json() or {}).get("data") or []
        except Exception as e:
            logger.warning("Kick /channels resolve errored: %s", e)
            continue

        for entry in data:
            slug = (entry.get("slug") or "").lower()
            uid = entry.get("broadcaster_user_id")
            if not (slug and isinstance(uid, int)):
                continue
            out[slug] = uid
            # Persist for the next boot.
            try:
                await db[CHANNEL_CACHE_COLL].update_one(
                    {"slug": slug},
                    {"$set": {
                        "slug": slug,
                        "broadcaster_user_id": uid,
                        "channel_description": entry.get("channel_description"),
                        "stream_title": entry.get("stream_title"),
                        "resolved_at": _now(),
                    }},
                    upsert=True,
                )
            except Exception:
                pass

    return out


# ─────────────────────── Live query ────────────────────────────────────

async def _query_livestreams(
    user_ids: List[int], token: str,
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """Batch-query Kick for live state. Returns (data, error_reason).
    data is `None` only on real API failure (so caller flags dormant)."""
    if not user_ids:
        return [], None

    out: List[Dict[str, Any]] = []
    for i in range(0, len(user_ids), CHANNELS_BATCH_LIMIT):
        chunk = user_ids[i:i + CHANNELS_BATCH_LIMIT]
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
                r = await http.get(
                    f"{API_BASE}/livestreams",
                    params=[("broadcaster_user_id", str(u)) for u in chunk],
                    headers={"Authorization": f"Bearer {token}"},
                )
                if r.status_code == 401:
                    return None, "kick_oauth_invalid"
                if r.status_code >= 500:
                    return None, f"kick_api_5xx_{r.status_code}"
                if r.status_code != 200:
                    logger.warning("Kick /livestreams non-200 (%s): %s",
                                   r.status_code, r.text[:200])
                    return None, f"kick_api_http_{r.status_code}"
                data = (r.json() or {}).get("data") or []
                out.extend(data)
        except Exception as e:
            logger.warning("Kick /livestreams errored: %s", e)
            return None, "kick_api_exception"

    return out, None


# ─────────────────────── Public entrypoint ─────────────────────────────

def _normalise(entry: Dict[str, Any], slug_by_uid: Dict[int, str]) -> Dict[str, Any]:
    """Map Kick's /livestreams response shape onto our unified live row."""
    uid = entry.get("broadcaster_user_id")
    slug = slug_by_uid.get(uid) or entry.get("slug") or ""
    category = entry.get("category") or {}
    cat_name = category.get("name") if isinstance(category, dict) else None
    return {
        "platform": "kick",
        "user_login": slug,
        "user_name": entry.get("channel_name") or slug or str(uid),
        "title": entry.get("stream_title") or "",
        "viewer_count": int(entry.get("viewer_count") or 0),
        "game_name": cat_name,
        "thumbnail_url": entry.get("thumbnail"),
        "profile_url": f"https://kick.com/{slug}" if slug else None,
        "started_at": entry.get("started_at"),
        "follower_count": None,
    }


async def fetch_live(db, slugs: List[str]) -> Dict[str, Any]:
    """One-shot resolve-then-query for the given roster slugs.

    Returns the same shape `multi_platform_live.fetch_kick_live` used to
    produce. `dormant: true` is set ONLY for real failures (missing creds,
    OAuth failure, 5xx) — an empty `data[]` from Kick (= nobody live)
    returns `dormant: false, count: 0` honestly.
    """
    slugs = [s.lower() for s in slugs if s]
    if not slugs:
        return {"streamers": [], "platform": "kick", "count": 0,
                "dormant": False, "reason": "no_kick_streamers_in_registry",
                "fetched_at": _now()}

    token = await _get_app_token()
    if not token:
        return {"streamers": [], "platform": "kick", "count": 0,
                "dormant": True, "reason": "kick_oauth_unavailable",
                "fetched_at": _now()}

    resolved = await _resolve_slugs(db, slugs, token)
    if not resolved:
        return {"streamers": [], "platform": "kick", "count": 0,
                "dormant": True, "reason": "kick_slugs_unresolved",
                "fetched_at": _now()}

    slug_by_uid = {uid: slug for slug, uid in resolved.items()}
    data, err = await _query_livestreams(list(resolved.values()), token)
    if data is None:
        return {"streamers": [], "platform": "kick", "count": 0,
                "dormant": True, "reason": err or "kick_api_failed",
                "fetched_at": _now()}

    live = [_normalise(e, slug_by_uid) for e in data]
    live.sort(key=lambda r: -(r.get("viewer_count") or 0))
    return {"streamers": live, "platform": "kick", "count": len(live),
            "dormant": False, "fetched_at": _now()}
