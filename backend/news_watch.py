"""
PUTKI HQ - News-watch editorial board (iter51).

The deterministic classifier already auto-decides between:
  • news_ticker_items   (relevance ≥ 45 - surfaces on /uutiset + homepage)
  • news_ticker_archive (relevance 20-44 - held back, editor-promotable)
  • silently dropped     (relevance < 20)

This module gives the editor one-click veto power over the classifier:
  • promote(url) - move an archive item up into the public ticker
  • demote(url)  - move a ticker item back to the archive (off-brand)
  • kill(url)    - permanently reject a URL; recorded in
                    `news_rejected_urls` so the next RSS tick won't
                    re-ingest it via the deterministic pipeline.

All mutations are admin-only and idempotent.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional


TICKER_COLL = "news_ticker_items"
ARCHIVE_COLL = "news_ticker_archive"
REJECTED_COLL = "news_rejected_urls"


async def ensure_indexes(db) -> None:
    """Create the `news_rejected_urls` indexes on first use."""
    try:
        await db[REJECTED_COLL].create_index("url", unique=True)
        await db[REJECTED_COLL].create_index("rejected_at")
    except Exception:
        pass


# ─────────────────────── Listing (read-only) ────────────────────────

async def list_items(
    db,
    coll: str,
    *,
    limit: int = 50,
    before: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    min_relevance: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """List items from either news_ticker_items or news_ticker_archive,
    newest first, with optional filters + `before` (ISO captured_at)
    cursor for pagination."""
    if coll not in (TICKER_COLL, ARCHIVE_COLL):
        raise ValueError(f"coll must be one of {TICKER_COLL!r} or {ARCHIVE_COLL!r}")

    q: Dict[str, Any] = {}
    if source:
        q["source"] = source
    if category:
        q["category"] = category
    if min_relevance is not None:
        q["relevance"] = {"$gte": int(min_relevance)}
    if before:
        q.setdefault("captured_at", {})["$lt"] = before

    cur = db[coll].find(q, {"_id": 0}).sort("captured_at", -1).limit(max(1, min(int(limit), 200)))
    items: List[Dict[str, Any]] = []
    async for d in cur:
        if isinstance(d.get("expires_at"), datetime):
            d["expires_at"] = d["expires_at"].isoformat()
        items.append(d)
    return items


async def stats(db) -> Dict[str, Any]:
    """Aggregate counts for the dashboard header."""
    ticker_n = await db[TICKER_COLL].count_documents({})
    archive_n = await db[ARCHIVE_COLL].count_documents({})
    rejected_n = await db[REJECTED_COLL].count_documents({})

    last_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    ticker_24h = await db[TICKER_COLL].count_documents({"captured_at": {"$gte": last_24h}})
    archive_24h = await db[ARCHIVE_COLL].count_documents({"captured_at": {"$gte": last_24h}})

    return {
        "ticker_total": ticker_n,
        "archive_total": archive_n,
        "rejected_total": rejected_n,
        "ticker_24h": ticker_24h,
        "archive_24h": archive_24h,
    }


# ─────────────────────── Mutations (editorial actions) ──────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def promote(db, url: str) -> Optional[Dict[str, Any]]:
    """Move an item from news_ticker_archive → news_ticker_items.

    Returns the promoted item (without Mongo _id / expires_at), or None
    if the URL isn't in the archive."""
    item = await db[ARCHIVE_COLL].find_one({"url": url}, {"_id": 0})
    if not item:
        return None
    item.pop("expires_at", None)
    item["promoted_at"] = _now_iso()
    item["promoted_by"] = "editor"
    new_expiry = datetime.now(timezone.utc) + timedelta(days=7)
    await db[TICKER_COLL].update_one(
        {"url": url},
        {"$set": {**item, "expires_at": new_expiry}},
        upsert=True,
    )
    await db[ARCHIVE_COLL].delete_one({"url": url})
    if isinstance(item.get("expires_at"), datetime):
        item["expires_at"] = item["expires_at"].isoformat()
    return item


async def demote(db, url: str) -> Optional[Dict[str, Any]]:
    """Move an item from news_ticker_items → news_ticker_archive."""
    item = await db[TICKER_COLL].find_one({"url": url}, {"_id": 0})
    if not item:
        return None
    item.pop("expires_at", None)
    item["demoted_at"] = _now_iso()
    item["demoted_by"] = "editor"
    new_expiry = datetime.now(timezone.utc) + timedelta(days=30)
    await db[ARCHIVE_COLL].update_one(
        {"url": url},
        {"$set": {**item, "expires_at": new_expiry}},
        upsert=True,
    )
    await db[TICKER_COLL].delete_one({"url": url})
    if isinstance(item.get("expires_at"), datetime):
        item["expires_at"] = item["expires_at"].isoformat()
    return item


async def kill(db, url: str, *, reason: Optional[str] = None) -> Dict[str, Any]:
    """Permanently reject a URL.

    Records it in `news_rejected_urls` so the RSS tick will skip it on
    the next ingestion, then removes any existing copy from both
    ticker and archive. Idempotent.
    """
    await ensure_indexes(db)
    await db[REJECTED_COLL].update_one(
        {"url": url},
        {"$set": {
            "url": url,
            "rejected_at": _now_iso(),
            "reason": (reason or "").strip()[:200] or None,
        }},
        upsert=True,
    )
    a = await db[ARCHIVE_COLL].delete_one({"url": url})
    t = await db[TICKER_COLL].delete_one({"url": url})
    return {
        "url": url,
        "deleted_from_archive": a.deleted_count,
        "deleted_from_ticker": t.deleted_count,
    }


async def unkill(db, url: str) -> bool:
    """Remove a URL from the rejection list (lets the next RSS tick
    re-ingest it via the deterministic pipeline)."""
    r = await db[REJECTED_COLL].delete_one({"url": url})
    return r.deleted_count > 0


async def rejected_urls(db) -> List[str]:
    """All currently-rejected URLs (used by `layer2_workers.rss_tick`
    to skip re-ingestion)."""
    out: List[str] = []
    async for d in db[REJECTED_COLL].find({}, {"_id": 0, "url": 1}):
        u = d.get("url")
        if u:
            out.append(u)
    return out


async def list_rejected(db, *, limit: int = 100) -> List[Dict[str, Any]]:
    cur = db[REJECTED_COLL].find({}, {"_id": 0}).sort("rejected_at", -1).limit(max(1, min(int(limit), 500)))
    return [d async for d in cur]
