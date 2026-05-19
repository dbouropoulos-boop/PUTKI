"""
PUTKI HQ — Streamer viewer-count snapshots + editorial meta.

`streamer_viewers_24h` — periodic snapshots of every live streamer's viewer
count, used to compute the change indicators surfaced on the homepage
streamer band (`410 ▲ 47 last hour`). Snapshots accumulate via the existing
streamer poll loop; once ≥24h of data has been collected, the per-streamer
trend becomes meaningful. Until then, the frontend suppresses the indicator
and shows just the raw viewer count.

`streamer_meta` — editorially-maintained per-streamer context lines (FI+EN
+ suppressed flag). One row per (platform, user_login). Surfaced on the
homepage streamer card hover/expand affordance.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)

SNAPSHOT_TTL_HOURS = 30  # keep 24h of snapshots + 6h buffer


# ── Indexes ──────────────────────────────────────────────────────────────
async def ensure_indexes(db) -> None:
    try:
        await db.streamer_viewers_24h.create_index(
            [("platform", 1), ("user_login", 1), ("ts", -1)]
        )
        await db.streamer_viewers_24h.create_index(
            "ts", expireAfterSeconds=SNAPSHOT_TTL_HOURS * 3600,
        )
        await db.streamer_meta.create_index(
            [("platform", 1), ("user_login", 1)], unique=True,
        )
    except Exception:
        logger.exception("streamer_snapshots.ensure_indexes failed")


# ── Snapshot writer ──────────────────────────────────────────────────────
async def record_snapshot_batch(db, *, platform: str, items: Iterable[Dict[str, Any]]) -> int:
    """Records a batch of viewer-count snapshots in a single insert_many.

    Called from the streamer poll loop after each successful Twitch / Kick /
    YouTube fetch. Silently no-ops on empty input.
    """
    now = datetime.now(timezone.utc)
    docs = []
    for it in items:
        login = (it.get("user_login") or it.get("user_name") or it.get("channel") or "").strip()
        viewers = it.get("viewer_count")
        if not login or viewers is None:
            continue
        docs.append({
            "platform": platform,
            "user_login": login.lower(),
            "viewer_count": int(viewers),
            "ts": now,
        })
    if not docs:
        return 0
    try:
        res = await db.streamer_viewers_24h.insert_many(docs, ordered=False)
        return len(res.inserted_ids)
    except Exception:
        logger.exception("record_snapshot_batch failed")
        return 0


# ── Change indicator lookup ──────────────────────────────────────────────
async def viewer_delta_last_hour(db, *, platform: str, user_login: str) -> Optional[Dict[str, Any]]:
    """Returns the change indicator for a streamer's viewer count compared
    to ~1h ago. Returns `None` when there's insufficient data (we don't
    fake direction).
    """
    login = (user_login or "").strip().lower()
    if not login:
        return None
    now = datetime.now(timezone.utc)
    # Snapshot from ~1h ago. Pick the row closest to (now - 1h).
    target = now - timedelta(hours=1)
    window_lo = target - timedelta(minutes=15)
    window_hi = target + timedelta(minutes=15)
    earlier = await db.streamer_viewers_24h.find_one(
        {
            "platform": platform, "user_login": login,
            "ts": {"$gte": window_lo, "$lte": window_hi},
        },
        sort=[("ts", -1)],
        projection={"_id": 0, "viewer_count": 1, "ts": 1},
    )
    if not earlier:
        return None  # data not yet meaningful; suppress indicator
    latest = await db.streamer_viewers_24h.find_one(
        {"platform": platform, "user_login": login},
        sort=[("ts", -1)],
        projection={"_id": 0, "viewer_count": 1, "ts": 1},
    )
    if not latest:
        return None
    delta = int(latest["viewer_count"]) - int(earlier["viewer_count"])
    direction = "up" if delta > 0 else ("down" if delta < 0 else "flat")
    return {
        "delta": delta,
        "direction": direction,
        "earlier_viewers": int(earlier["viewer_count"]),
        "latest_viewers": int(latest["viewer_count"]),
    }


# ── Editorial meta CRUD ──────────────────────────────────────────────────
async def get_meta(db, *, platform: str, user_login: str) -> Optional[Dict[str, Any]]:
    login = (user_login or "").strip().lower()
    if not login:
        return None
    doc = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": login},
        {"_id": 0},
    )
    return doc


async def list_meta(db) -> List[Dict[str, Any]]:
    cur = db.streamer_meta.find({}, {"_id": 0}).sort(
        [("platform", 1), ("user_login", 1)]
    )
    return [doc async for doc in cur]


async def upsert_meta(db, *, platform: str, user_login: str,
                     meta_fi: str = "", meta_en: str = "",
                     suppressed: bool = False) -> Dict[str, Any]:
    login = (user_login or "").strip().lower()
    if not login:
        raise ValueError("user_login required")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "platform": platform,
        "user_login": login,
        "meta_fi": (meta_fi or "").strip()[:600],
        "meta_en": (meta_en or "").strip()[:600],
        "suppressed": bool(suppressed),
        "updated_at": now,
    }
    await db.streamer_meta.update_one(
        {"platform": platform, "user_login": login},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return doc


async def attach_meta(db, items: List[Dict[str, Any]], platform: str) -> List[Dict[str, Any]]:
    """Mutates each item with `meta_fi`/`meta_en` when an editorial line
    exists AND is not suppressed. Items without meta carry `None`s, which
    the frontend reads as "no hover affordance for this card"."""
    if not items:
        return items
    logins = [
        (it.get("user_login") or it.get("user_name") or it.get("channel") or "").strip().lower()
        for it in items
    ]
    logins = [x for x in logins if x]
    if not logins:
        return items
    cur = db.streamer_meta.find(
        {"platform": platform, "user_login": {"$in": logins}},
        {"_id": 0},
    )
    by_login = {}
    async for d in cur:
        if d.get("suppressed"):
            continue
        by_login[d["user_login"]] = d
    for it in items:
        login = (it.get("user_login") or it.get("user_name") or it.get("channel") or "").strip().lower()
        m = by_login.get(login)
        it["meta_fi"] = (m or {}).get("meta_fi") or None
        it["meta_en"] = (m or {}).get("meta_en") or None
    return items
