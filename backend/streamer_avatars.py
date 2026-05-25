"""
PUTKI HQ - streamer avatar resolver (iter54).

Pulls the streamer's REAL profile picture from the platform they're on
(Twitch / Kick / YouTube) and persists it on the `streamers` doc as
`avatar_url`. Replaces the stock/Unsplash placeholder grid that looked
like AI faces.

Sources:
  • Twitch  → Helix `GET /users?login=<login>` → `profile_image_url`
  • Kick    → OAuth-gated `api.kick.com/public/v1/channels?slug=<slug>`
              → `profile_picture`  (reuses the same client-credentials
              flow + slug-cache as kick_official.fetch_live)
  • YouTube → Data API `channels?part=snippet&forHandle=@handle` or
              `channels?part=snippet&id=UC…` → `snippet.thumbnails`

Honesty rules:
  • No fallback URL invented. If the platform can't be queried (missing
    creds, unresolved handle, 404), we leave `avatar_url` empty and the
    UI renders an initials block.
  • Stamps `avatar_resolved_at` + `avatar_source` on success.
  • Resolution failures stamp `avatar_resolved_at` + `avatar_failed=true`
    + `avatar_failure_reason` so we don't hammer the API every refresh.
  • Refresh cadence: weekly background tick. Manual refresh available via
    admin endpoint.

The module is INTENTIONALLY independent of the live-stream fetcher -
avatars rarely change so we don't want to refresh them on every 60s
live poll. One slow tick a week + boot-time backfill is enough.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_SECONDS = int(os.environ.get("STREAMER_AVATAR_REFRESH_INTERVAL", str(7 * 24 * 60 * 60)))  # 7d default
HTTP_TIMEOUT = 10.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ───────────────────────── Twitch avatar lookup ────────────────────────

async def _fetch_twitch_avatars(logins: List[str]) -> Dict[str, str]:
    """Return {login -> profile_image_url} for every login we can resolve.
    Helix /users accepts up to 100 ?login= params per request."""
    if not logins:
        return {}
    try:
        from twitch_eventsub import (
            TWITCH_HELIX_BASE, _client_id, get_app_access_token, is_configured,
        )
    except Exception:
        return {}
    if not is_configured():
        logger.info("streamer_avatars: twitch credentials missing - skipping Twitch")
        return {}

    try:
        token = await get_app_access_token()
    except Exception as e:
        logger.warning("streamer_avatars: twitch OAuth failed: %s", e)
        return {}

    out: Dict[str, str] = {}
    headers = {"Client-Id": _client_id(), "Authorization": f"Bearer {token}"}
    # Chunk 100 at a time (Helix limit).
    for i in range(0, len(logins), 100):
        chunk = logins[i:i + 100]
        params = [("login", lg) for lg in chunk]
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
                r = await http.get(f"{TWITCH_HELIX_BASE}/users", params=params, headers=headers)
                if r.status_code != 200:
                    logger.warning("streamer_avatars: twitch /users non-200 (%s): %s",
                                   r.status_code, r.text[:200])
                    continue
                data = r.json().get("data") or []
        except Exception as e:
            logger.warning("streamer_avatars: twitch /users errored: %s", e)
            continue
        for u in data:
            login = (u.get("login") or "").lower()
            img = u.get("profile_image_url") or ""
            if login and img:
                out[login] = img
    return out


# ───────────────────────── Kick avatar lookup ──────────────────────────

async def _fetch_kick_avatars(slugs: List[str]) -> Dict[str, str]:
    """Return {slug -> profile_picture}. Reuses kick_official's OAuth
    client-credentials token. The `/channels?slug=` payload carries the
    profile picture URL directly."""
    if not slugs:
        return {}
    try:
        from kick_official import _get_app_token, API_BASE, CHANNELS_BATCH_LIMIT
    except Exception:
        return {}

    token = await _get_app_token()
    if not token:
        logger.info("streamer_avatars: kick OAuth unavailable - skipping Kick")
        return {}

    out: Dict[str, str] = {}
    for i in range(0, len(slugs), CHANNELS_BATCH_LIMIT):
        chunk = slugs[i:i + CHANNELS_BATCH_LIMIT]
        params = [("slug", s) for s in chunk]
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
                r = await http.get(
                    f"{API_BASE}/channels",
                    params=params,
                    headers={"Authorization": f"Bearer {token}"},
                )
                if r.status_code != 200:
                    logger.warning("streamer_avatars: kick /channels non-200 (%s): %s",
                                   r.status_code, r.text[:200])
                    continue
                data = (r.json() or {}).get("data") or []
        except Exception as e:
            logger.warning("streamer_avatars: kick /channels errored: %s", e)
            continue
        for entry in data:
            slug = (entry.get("slug") or "").lower()
            # Kick v1 returns `profile_picture`. iter62.1: NEVER fall back to
            # the banner_picture - those are giant 1920x480 hero images, not
            # profile pics. Also reject default-banner placeholders.
            pic = (entry.get("profile_picture") or "").strip()
            if "default-banner" in pic or "default-avatar" in pic:
                pic = ""
            if slug and pic:
                out[slug] = pic
    return out


# ───────────────────────── YouTube avatar lookup ───────────────────────

async def _fetch_youtube_avatar(channel_ref: str, api_key: str) -> Optional[str]:
    """Resolve a channel reference (UC… id, @handle, or legacy username)
    to its profile thumbnail. Two-step: optional handle→id resolve, then
    `channels?id=…&part=snippet` fetch."""
    ref = (channel_ref or "").strip()
    if not ref:
        return None
    # Build the params: prefer forHandle for @-style, fall back to id.
    if ref.startswith("UC") and len(ref) >= 20:
        params = {"part": "snippet", "id": ref, "key": api_key}
    else:
        handle = ref if ref.startswith("@") else f"@{ref.lstrip('@')}"
        params = {"part": "snippet", "forHandle": handle, "key": api_key}
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
            r = await http.get("https://www.googleapis.com/youtube/v3/channels", params=params)
            if r.status_code != 200:
                return None
            data = r.json()
    except Exception:
        return None
    items = data.get("items") or []
    if not items:
        return None
    snip = items[0].get("snippet") or {}
    thumbs = snip.get("thumbnails") or {}
    # Prefer high > medium > default.
    for key in ("high", "medium", "default"):
        url = (thumbs.get(key) or {}).get("url")
        if url:
            return url
    return None


async def _fetch_youtube_avatars(refs: List[str]) -> Dict[str, str]:
    if not refs:
        return {}
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        logger.info("streamer_avatars: YOUTUBE_API_KEY missing - skipping YouTube")
        return {}
    out: Dict[str, str] = {}
    results = await asyncio.gather(
        *[_fetch_youtube_avatar(ref, api_key) for ref in refs],
        return_exceptions=True,
    )
    for ref, res in zip(refs, results):
        if isinstance(res, str) and res.startswith("http"):
            out[ref] = res
    return out


# ───────────────────────── Persistence + orchestration ─────────────────

def _streamer_lookup_key(streamer: Dict[str, Any]) -> str:
    """The string we pass to the platform API. Twitch/Kick: prefer
    `channel` over `slug` (admins override `channel` when login !=
    registry slug). YouTube: use `channel` (UC… id or @handle)."""
    return (streamer.get("channel") or streamer.get("slug") or "").strip().lstrip("@").lower()


async def refresh_all_avatars(db, *, force: bool = False) -> Dict[str, Any]:
    """One pass over the streamer registry, grouping by platform and
    persisting `avatar_url` + `avatar_resolved_at` on each doc.

    `force=True` ignores `avatar_resolved_at` and re-resolves every row
    (used by the admin refresh button).
    """
    cur = db.streamers.find(
        {"active": {"$ne": False}},
        {"_id": 0, "slug": 1, "platform": 1, "channel": 1, "avatar_url": 1, "avatar_resolved_at": 1},
    )
    rows = await cur.to_list(length=2000)
    cutoff = time.time() - REFRESH_INTERVAL_SECONDS

    def _needs_refresh(s: Dict[str, Any]) -> bool:
        if force:
            return True
        if not s.get("avatar_url"):
            return True
        ts = s.get("avatar_resolved_at_unix")
        if not ts:
            return True
        return ts < cutoff

    buckets: Dict[str, List[Tuple[str, str]]] = {"twitch": [], "kick": [], "youtube": []}
    for s in rows:
        if not _needs_refresh(s):
            continue
        platform = (s.get("platform") or "").lower()
        key = _streamer_lookup_key(s)
        if not (platform and key):
            continue
        if platform in buckets:
            # Pass the registry channel reference for YouTube (handle/id
            # both accepted). For Twitch/Kick lowercase login is canonical.
            ref = (s.get("channel") or s.get("slug") or "").strip()
            buckets[platform].append((s["slug"], ref if platform == "youtube" else key))

    twitch_logins = [k for _, k in buckets["twitch"]]
    kick_slugs = [k for _, k in buckets["kick"]]
    youtube_refs = [k for _, k in buckets["youtube"]]

    twitch_map, kick_map, youtube_map = await asyncio.gather(
        _fetch_twitch_avatars(twitch_logins),
        _fetch_kick_avatars(kick_slugs),
        _fetch_youtube_avatars(youtube_refs),
    )

    resolved = 0
    failed = 0
    now_iso = _now_iso()
    now_ts = time.time()

    async def _write(slug: str, url: Optional[str], source: str) -> None:
        nonlocal resolved, failed
        if url:
            await db.streamers.update_one(
                {"slug": slug},
                {"$set": {
                    "avatar_url": url,
                    "avatar_source": source,
                    "avatar_resolved_at": now_iso,
                    "avatar_resolved_at_unix": now_ts,
                    "avatar_failed": False,
                }, "$unset": {"avatar_failure_reason": ""}},
            )
            resolved += 1
        else:
            await db.streamers.update_one(
                {"slug": slug},
                {"$set": {
                    "avatar_source": source,
                    "avatar_resolved_at": now_iso,
                    "avatar_resolved_at_unix": now_ts,
                    "avatar_failed": True,
                    "avatar_failure_reason": f"{source}_lookup_returned_no_image",
                }},
            )
            failed += 1

    for slug, key in buckets["twitch"]:
        await _write(slug, twitch_map.get(key), "twitch")
    for slug, key in buckets["kick"]:
        await _write(slug, kick_map.get(key), "kick")
    for slug, ref in buckets["youtube"]:
        await _write(slug, youtube_map.get(ref), "youtube")

    return {
        "resolved": resolved,
        "failed": failed,
        "skipped_still_fresh": len(rows) - len(buckets["twitch"]) - len(buckets["kick"]) - len(buckets["youtube"]),
        "twitch_count": len(buckets["twitch"]),
        "kick_count": len(buckets["kick"]),
        "youtube_count": len(buckets["youtube"]),
        "force": force,
        "completed_at": now_iso,
    }


# ───────────────────────── Background worker ───────────────────────────

async def avatar_refresh_worker_loop(db) -> None:
    """Long-lived worker: refresh on boot (after a short delay to let
    Twitch/Kick OAuth settle), then once per `REFRESH_INTERVAL_SECONDS`."""
    # Initial delay: give the OAuth clients a moment to warm up + avoid
    # racing the workers.spawn() block on every boot.
    await asyncio.sleep(60)
    while True:
        try:
            summary = await refresh_all_avatars(db, force=False)
            logger.info("streamer_avatars: refresh complete %s", summary)
        except Exception as e:
            logger.warning("streamer_avatars: refresh tick errored: %s", e)
        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
