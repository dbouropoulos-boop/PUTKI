"""
Mittari Phase 3 V2 — Final Architecture Step 4: Live-feed aggregation layer.

Aggregates `signals` (poller + webhook ingress) + `published_content`
(editorial pipeline output) into a single normalised `feed_items` view that
Home.jsx and the future Pulssi hub can consume without any source-specific
logic.

Schema for feed_items:
  {
    id:         uuid,
    source:     "twitch" | "kick" | "youtube" | "editorial" | "sports" | "forum" | "internal",
    kind:       "stream_live" | "video_published" | "moment" | "match" | "forum_burst" | "editorial_drop",
    title:      str        — short, hub-card-friendly headline
    body:       str | None — optional 1-line context
    eyebrow:    str | None — small uppercase tag (channel name, league, content_type)
    url:        str | None — outbound link
    slug:       str | None — operator/streamer slug if applicable
    weight:     int        — 0..100 importance (signal weight or editorial bias)
    market_id:  str        — default "FI"
    surfaced_at: ISO-8601  — when this should rank in the hub
    created_at:  ISO-8601
    expires_at:  ISO-8601  — TTL window so stale stream cards drop out
    mocked:     bool       — passthrough from signal source
    source_ref: dict       — pointer back to signals.id / published_content.id for traceability
  }

Honesty contract: aggregation NEVER fabricates new items — every feed_item is
backed by either a real signal row (incl. webhook ingress) or a real
published_content row. Mock signals propagate `mocked=True` so the hub can
visually distinguish if needed.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional


logger = logging.getLogger(__name__)


FEED_TTL_MINUTES = int(os.environ.get("FEED_TTL_MINUTES", "180"))
FEED_REBUILD_INTERVAL_SECONDS = int(os.environ.get("FEED_REBUILD_INTERVAL_SECONDS", "60"))
FEED_DEFAULT_MARKET = os.environ.get("FEED_DEFAULT_MARKET", "FI")


# ── tiny in-memory cache (per-process) ──────────────────────────────────────
_FEED_CACHE: Dict[str, tuple] = {}  # key -> (expires_epoch, payload)
_FEED_CACHE_TTL_SECONDS = int(os.environ.get("FEED_CACHE_TTL_SECONDS", "10"))


def _cache_key(source: Optional[str], kind: Optional[str], market_id: str, limit: int) -> str:
    return f"{source or '*'}|{kind or '*'}|{market_id}|{limit}"


def _cache_get(key: str) -> Optional[Any]:
    row = _FEED_CACHE.get(key)
    if not row:
        return None
    expires, payload = row
    if expires < time.time():
        _FEED_CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: Any) -> None:
    _FEED_CACHE[key] = (time.time() + _FEED_CACHE_TTL_SECONDS, payload)


def _cache_clear() -> None:
    _FEED_CACHE.clear()


# ── normalisers ─────────────────────────────────────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _feed_item(
    *,
    source: str,
    kind: str,
    title: str,
    body: Optional[str] = None,
    eyebrow: Optional[str] = None,
    url: Optional[str] = None,
    slug: Optional[str] = None,
    weight: int = 50,
    market_id: str = FEED_DEFAULT_MARKET,
    surfaced_at: Optional[datetime] = None,
    mocked: bool = False,
    source_ref: Optional[Dict[str, Any]] = None,
    dedup_key: Optional[str] = None,
) -> Dict[str, Any]:
    now = _now()
    sat = surfaced_at or now
    return {
        "id": str(uuid.uuid4()),
        "source": source,
        "kind": kind,
        "title": title,
        "body": body,
        "eyebrow": eyebrow,
        "url": url,
        "slug": slug,
        "weight": max(0, min(100, int(weight))),
        "market_id": market_id,
        "surfaced_at": _iso(sat),
        "created_at": _iso(now),
        "expires_at": _iso(now + timedelta(minutes=FEED_TTL_MINUTES)),
        "mocked": bool(mocked),
        "source_ref": source_ref or {},
        "dedup_key": dedup_key,
    }


def _signal_to_feed_item(sig: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map a signals collection row → feed_item shape. Returns None if the
    signal is not hub-card-worthy (e.g. internal heartbeats)."""
    src = sig.get("source")
    stype = sig.get("signal_type") or sig.get("event_type")
    payload = sig.get("payload") or {}
    weight = int(sig.get("weight") or 50)
    mocked = bool(sig.get("mocked"))

    if src == "twitch":
        login = payload.get("login") or payload.get("broadcaster_user_login")
        if not login:
            return None
        viewers = payload.get("viewers")
        game = payload.get("game_name") or payload.get("category_name")
        title = payload.get("title") or f"{login} live"
        body = f"{viewers:,} katsojaa · {game}" if viewers and game else (game or (payload.get("title") or ""))
        return _feed_item(
            source="twitch",
            kind="stream_live",
            title=title,
            body=body or None,
            eyebrow=f"TWITCH · {login.upper()}",
            url=f"https://twitch.tv/{login}",
            slug=login,
            weight=weight if weight else (min(100, (viewers or 0) // 60)),
            mocked=mocked,
            source_ref={"signals_id": sig.get("id")},
            dedup_key=f"twitch:{login}",
        )

    if src == "kick":
        login = payload.get("slug") or payload.get("channel") or payload.get("login")
        if not login:
            return None
        viewers = payload.get("viewers") or payload.get("viewer_count")
        title = payload.get("session_title") or payload.get("title") or f"{login} live"
        body = f"{viewers:,} katsojaa" if viewers else None
        return _feed_item(
            source="kick",
            kind="stream_live",
            title=title,
            body=body,
            eyebrow=f"KICK · {str(login).upper()}",
            url=f"https://kick.com/{login}",
            slug=str(login),
            weight=weight if weight else (min(100, (viewers or 0) // 60)),
            mocked=mocked,
            source_ref={"signals_id": sig.get("id")},
            dedup_key=f"kick:{login}",
        )

    if src == "youtube":
        if stype in ("big_win", "video.published", "video_published"):
            video_id = payload.get("video_id")
            channel = payload.get("channel_id") or payload.get("streamer")
            title = payload.get("title_parsed") or payload.get("title") or f"YouTube · {channel}"
            url = (
                payload.get("video_url")
                or (f"https://youtube.com/watch?v={video_id}" if video_id else None)
            )
            return _feed_item(
                source="youtube",
                kind="video_published" if stype != "big_win" else "moment",
                title=title,
                body=None,
                eyebrow=f"YOUTUBE · {(channel or 'KANAVA').upper()}" if channel else "YOUTUBE",
                url=url,
                slug=payload.get("streamer", "").lower() if payload.get("streamer") else None,
                weight=weight,
                mocked=mocked,
                source_ref={"signals_id": sig.get("id")},
                dedup_key=f"youtube:{video_id or url}",
            )

    if src == "sports":
        match = payload.get("match")
        league = payload.get("league")
        if not match:
            return None
        kickoff = payload.get("kickoff_in_minutes")
        body = f"Alkamiseen {kickoff} min" if isinstance(kickoff, int) else None
        return _feed_item(
            source="sports",
            kind="match",
            title=match,
            body=body,
            eyebrow=(league or "URHEILU").upper(),
            weight=weight,
            mocked=mocked,
            source_ref={"signals_id": sig.get("id")},
            dedup_key=f"sports:{match}",
        )

    if src == "forum":
        title = payload.get("thread_title")
        site = payload.get("site")
        pph = payload.get("posts_per_hour")
        if not title:
            return None
        body = f"{pph} viestiä/tunti" if pph else None
        return _feed_item(
            source="forum",
            kind="forum_burst",
            title=title,
            body=body,
            eyebrow=(site or "FOORUMI").upper(),
            url=payload.get("url"),
            weight=weight,
            mocked=mocked,
            source_ref={"signals_id": sig.get("id")},
            dedup_key=f"forum:{title}",
        )

    # internal heartbeats and unknown sources are intentionally not surfaced.
    return None


def _published_to_feed_item(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = row.get("text") or row.get("variant_text")
    if not text:
        return None
    ct = (row.get("content_type") or "editorial").replace("_", " ").upper()
    surfaced_iso = row.get("published_at") or row.get("created_at")
    try:
        surfaced_dt = datetime.fromisoformat(surfaced_iso.replace("Z", "+00:00")) if surfaced_iso else _now()
    except Exception:
        surfaced_dt = _now()
    title = str(text)
    if len(title) > 140:
        title = title[:137] + "…"
    return _feed_item(
        source="editorial",
        kind="editorial_drop",
        title=title,
        eyebrow=ct,
        body=row.get("surface") or None,
        weight=60,
        surfaced_at=surfaced_dt,
        source_ref={"published_id": row.get("id")},
        dedup_key=f"editorial:{row.get('id')}",
    )


# ── aggregator ──────────────────────────────────────────────────────────────
async def rebuild_feed(db, *, market_id: str = FEED_DEFAULT_MARKET, signal_limit: int = 200, pub_limit: int = 40) -> Dict[str, Any]:
    """Walk recent signals + published_content → upsert into feed_items.

    Idempotent on (dedup_key, market_id). Drops expired items by `expires_at`."""
    now = _now()
    now_iso = _iso(now)

    # 1) pull recent signals (newest first)
    sig_cur = (
        db.signals.find({}, {"_id": 0})
        .sort("captured_at", -1)
        .limit(signal_limit)
    )
    signals = await sig_cur.to_list(length=signal_limit)

    # 2) pull recently published content (newest first)
    pub_cur = (
        db.published_content.find({}, {"_id": 0})
        .sort("published_at", -1)
        .limit(pub_limit)
    )
    pubs = await pub_cur.to_list(length=pub_limit)

    upserts: List[Dict[str, Any]] = []
    for s in signals:
        item = _signal_to_feed_item(s)
        if item:
            item["market_id"] = market_id
            upserts.append(item)
    for p in pubs:
        item = _published_to_feed_item(p)
        if item:
            item["market_id"] = market_id
            upserts.append(item)

    # 3) upsert each on (dedup_key, market_id) — keep newest surfaced_at + bump expires.
    written = 0
    for item in upserts:
        if not item.get("dedup_key"):
            continue
        filt = {"dedup_key": item["dedup_key"], "market_id": item["market_id"]}
        update = {
            "$set": {
                "title": item["title"],
                "body": item["body"],
                "eyebrow": item["eyebrow"],
                "url": item["url"],
                "slug": item["slug"],
                "weight": item["weight"],
                "kind": item["kind"],
                "source": item["source"],
                "surfaced_at": item["surfaced_at"],
                "expires_at": item["expires_at"],
                "mocked": item["mocked"],
                "source_ref": item["source_ref"],
            },
            "$setOnInsert": {
                "id": item["id"],
                "created_at": item["created_at"],
                "dedup_key": item["dedup_key"],
                "market_id": item["market_id"],
            },
        }
        await db.feed_items.update_one(filt, update, upsert=True)
        written += 1

    # 4) prune expired feed items
    pruned = await db.feed_items.delete_many({"expires_at": {"$lt": now_iso}})

    # 5) invalidate cache
    _cache_clear()

    return {
        "rebuilt_at": now_iso,
        "candidates": len(upserts),
        "upserted": written,
        "pruned": pruned.deleted_count,
        "signals_scanned": len(signals),
        "published_scanned": len(pubs),
    }


async def list_feed(
    db,
    *,
    source: Optional[str] = None,
    kind: Optional[str] = None,
    market_id: str = FEED_DEFAULT_MARKET,
    limit: int = 12,
    include_mocked: bool = False,
) -> List[Dict[str, Any]]:
    """Hub-card query. Cached for FEED_CACHE_TTL_SECONDS per-process.

    Honesty contract: mocked signals are EXCLUDED by default. Pass
    include_mocked=True only from admin / back-office surfaces."""
    limit = max(1, min(50, int(limit)))
    key = _cache_key(source, kind, market_id, limit) + ("|m" if include_mocked else "|nomock")
    cached = _cache_get(key)
    if cached is not None:
        return cached

    q: Dict[str, Any] = {"market_id": market_id}
    if source:
        q["source"] = source
    if kind:
        q["kind"] = kind
    if not include_mocked:
        q["mocked"] = False
    # Hide expired in case the pruner is mid-tick.
    q["expires_at"] = {"$gte": _iso(_now())}

    cur = (
        db.feed_items.find(q, {"_id": 0})
        .sort("surfaced_at", -1)
        .limit(limit)
    )
    rows = await cur.to_list(length=limit)
    _cache_set(key, rows)
    return rows


async def feed_stats(db, *, market_id: str = FEED_DEFAULT_MARKET) -> Dict[str, Any]:
    """Editor surface — how full is the feed and from which sources."""
    pipeline = [
        {"$match": {"market_id": market_id, "expires_at": {"$gte": _iso(_now())}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
    ]
    rows = await db.feed_items.aggregate(pipeline).to_list(length=20)
    by_source = {r["_id"]: r["count"] for r in rows}
    total = sum(by_source.values())
    return {
        "total": total,
        "by_source": by_source,
        "market_id": market_id,
        "cache_ttl_seconds": _FEED_CACHE_TTL_SECONDS,
        "rebuild_interval_seconds": FEED_REBUILD_INTERVAL_SECONDS,
        "ttl_minutes": FEED_TTL_MINUTES,
    }


async def ensure_indexes(db) -> None:
    """Create compound + TTL-style indexes on feed_items. Idempotent."""
    try:
        await db.feed_items.create_index(
            [("dedup_key", 1), ("market_id", 1)],
            unique=True,
            name="uniq_dedup_market",
        )
    except Exception:
        logger.exception("Failed to create feed_items uniq_dedup_market index")
    try:
        await db.feed_items.create_index([("market_id", 1), ("surfaced_at", -1)], name="market_surfaced")
    except Exception:
        logger.exception("Failed to create feed_items market_surfaced index")


# ── background worker ──────────────────────────────────────────────────────
async def feed_worker_loop(db) -> None:
    """Background rebuild loop. Disable via MITTARI_DISABLE_FEED_WORKER=1."""
    await asyncio.sleep(8)  # let signals/dial worker run first
    while True:
        try:
            await rebuild_feed(db)
        except Exception:
            logger.exception("Feed rebuild tick failed")
        await asyncio.sleep(FEED_REBUILD_INTERVAL_SECONDS)
