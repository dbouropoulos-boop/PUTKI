"""
PUTKI HQ — Public live-data stats endpoint for the homepage ticker.

Aggregates honest "we're watching everything in real-time" counters from
the existing Layer 2 + content collections. No fabrication: if a worker
hasn't fired yet, its counter is 0.

Cached 10s in-process so a homepage burst can't smash MongoDB.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

_CACHE: Dict[str, Any] = {"payload": None, "expires_at": 0.0}
_LOCK = asyncio.Lock()
TTL_SECONDS = 10


async def _build(db) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    last_24h = now - timedelta(hours=24)

    async def _latest(coll: str, sort_field: str = "captured_at") -> Optional[Dict[str, Any]]:
        try:
            return await db[coll].find_one({}, {"_id": 0}, sort=[(sort_field, -1)])
        except Exception:
            return None

    async def _count_since(coll: str, since, field: str = "captured_at") -> int:
        try:
            return await db[coll].count_documents({field: {"$gte": since}})
        except Exception:
            return 0

    # Stream signals → active Twitch streams in latest snapshot
    stream_latest = await _latest("stream_signals")
    twitch_live = int(stream_latest.get("active_streams", 0)) if stream_latest else 0
    twitch_viewers = int(stream_latest.get("total_viewers", 0)) if stream_latest else 0

    # Sports signals → active NHL games tracked
    sports_latest = await _latest("sports_signals")
    sports_games = int(sports_latest.get("games_active", 0)) if sports_latest else 0

    # News signals → matched articles in last 24h
    news_today = 0
    try:
        cur = db.news_signals.find({"captured_at": {"$gte": last_24h}}, {"_id": 0})
        async for doc in cur:
            news_today += int(doc.get("matched_count", 0) or 0)
    except Exception:
        pass

    # Football + F1 latest
    f1_latest = await _latest("f1_signals")
    f1_race_active = bool(f1_latest and f1_latest.get("race_active"))
    football_latest = await _latest("football_signals")
    football_matches = int(football_latest.get("matches_active", 0)) if football_latest else 0

    # Published content articles today
    articles_today = 0
    try:
        articles_today = await db.published_content.count_documents(
            {"published_at": {"$gte": today_start.isoformat()}},
        )
    except Exception:
        pass

    # Latest update timestamp — max(captured_at) across Layer 2 colls
    latest_ts = None
    for coll in ("stream_signals", "sports_signals", "news_signals",
                 "f1_signals", "football_signals"):
        doc = await _latest(coll)
        if doc and doc.get("captured_at"):
            ts = doc["captured_at"]
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    continue
            if latest_ts is None or ts > latest_ts:
                latest_ts = ts

    return {
        "twitch_live": twitch_live,
        "twitch_viewers": twitch_viewers,
        "sports_games_tracked": sports_games,
        "football_matches": football_matches,
        "f1_race_active": f1_race_active,
        "news_articles_today": news_today,
        "articles_published_today": articles_today,
        "latest_update_at": latest_ts.isoformat() if latest_ts else None,
        "fetched_at": now.isoformat(),
    }


async def get_live_stats(db) -> Dict[str, Any]:
    now = time.time()
    if _CACHE["payload"] and _CACHE["expires_at"] > now:
        return _CACHE["payload"]
    async with _LOCK:
        now = time.time()
        if _CACHE["payload"] and _CACHE["expires_at"] > now:
            return _CACHE["payload"]
        payload = await _build(db)
        _CACHE["payload"] = payload
        _CACHE["expires_at"] = now + TTL_SECONDS
        return payload
