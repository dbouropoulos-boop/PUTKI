"""
PUTKI HQ - Article view counts.

Tracks reads per published article via a lightweight `article_views`
collection (one upsert per article id) and exposes:
  • POST /api/content/:slug/view   - public, bumps counter
  • GET  /api/content/:slug/stats  - returns {views}
  • GET  /api/content/stats/bulk   - returns {[id]: views} for many ids
                                      (used by the feed/news index for
                                      per-card view counts)

Schema (`article_views`):
  { article_id, slug, views, updated_at }

We dedupe per (article, viewer-fingerprint, day) to avoid trivially
inflating counts from page reloads. The fingerprint is a lightweight
hash of UA + IP (best-effort - not PII-grade, just spam protection).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _fingerprint(req: Request) -> str:
    ua = (req.headers.get("user-agent") or "")[:160]
    ip = req.headers.get("x-forwarded-for", req.client.host if req.client else "") or ""
    raw = f"{ua}|{ip.split(',')[0].strip()}|{_today_key()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class _BulkBody(BaseModel):
    ids: List[str]


def build_views_router(db) -> APIRouter:
    router = APIRouter(prefix="/content", tags=["views"])

    @router.post("/{slug}/view")
    async def bump_view(slug: str, req: Request) -> Dict[str, Any]:
        if not slug or len(slug) > 200:
            raise HTTPException(status_code=400, detail="bad_slug")
        # Resolve article by slug → id
        art = await db.published_content.find_one(
            {"url_slug": slug}, {"_id": 0, "id": 1}
        )
        if not art:
            return {"views": 0, "skipped": "not_found"}
        article_id = art["id"]
        fp = _fingerprint(req)
        # Dedup: same fingerprint can't bump same article in same UTC day
        dedup_doc = await db.article_view_dedup.find_one(
            {"article_id": article_id, "fp": fp, "day": _today_key()}
        )
        if dedup_doc:
            doc = await db.article_views.find_one({"article_id": article_id}, {"_id": 0})
            return {"views": int((doc or {}).get("views", 0))}
        await db.article_view_dedup.insert_one({
            "article_id": article_id,
            "fp": fp,
            "day": _today_key(),
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        res = await db.article_views.find_one_and_update(
            {"article_id": article_id},
            {"$inc": {"views": 1},
             "$set": {"slug": slug, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
            return_document=True,
        )
        return {"views": int((res or {}).get("views", 1))}

    @router.get("/{slug}/stats")
    async def get_stats(slug: str) -> Dict[str, Any]:
        art = await db.published_content.find_one(
            {"url_slug": slug}, {"_id": 0, "id": 1}
        )
        if not art:
            return {"views": 0}
        doc = await db.article_views.find_one(
            {"article_id": art["id"]}, {"_id": 0, "views": 1}
        )
        return {"views": int((doc or {}).get("views", 0))}

    @router.post("/stats/bulk")
    async def bulk_stats(body: _BulkBody) -> Dict[str, Any]:
        ids = [i for i in (body.ids or []) if isinstance(i, str) and i][:200]
        if not ids:
            return {"stats": {}}
        cursor = db.article_views.find({"article_id": {"$in": ids}},
                                       {"_id": 0, "article_id": 1, "views": 1})
        out: Dict[str, int] = {}
        async for d in cursor:
            out[d["article_id"]] = int(d.get("views", 0))
        return {"stats": out}

    @router.get("/most-read")
    async def get_most_read(hours: int = 1, limit: int = 5) -> Dict[str, Any]:
        hours = max(1, min(int(hours) if hours else 1, 168))   # cap 1h..7d
        limit = max(1, min(int(limit) if limit else 5, 20))
        items = await most_read(db, hours=hours, limit=limit)
        return {"hours": hours, "items": items, "count": len(items)}

    return router


async def total_views(db) -> int:
    """Sum of all article views - used by SocialProofBar / activity totals."""
    try:
        cur = db.article_views.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$views"}}},
        ])
        async for d in cur:
            return int(d.get("total", 0))
        return 0
    except Exception:
        return 0


async def _window_counts(db, *, since_iso: str) -> Dict[str, int]:
    """Aggregate article views in the window. Returns {article_id: count}."""
    rows: Dict[str, int] = {}
    cur = db.article_view_dedup.find({"ts": {"$gte": since_iso}}, {"_id": 0, "article_id": 1})
    async for d in cur:
        aid = d.get("article_id")
        if aid:
            rows[aid] = rows.get(aid, 0) + 1
    return rows


async def _fetch_articles_meta(db, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Bulk-fetch published_content rows for the given ids → {id: meta}."""
    if not ids:
        return {}
    out: Dict[str, Dict[str, Any]] = {}
    cur = db.published_content.find(
        {"id": {"$in": ids}},
        {"_id": 0, "id": 1, "headline": 1, "url_slug": 1,
         "published_at": 1, "category": 1, "type": 1},
    )
    async for a in cur:
        out[a["id"]] = a
    return out


async def _coldstart_fillers(db, *, need: int, exclude: set) -> List[Dict[str, Any]]:
    """All-time-top fallback so the rail never reads empty on a fresh
    deployment with no in-window views. Returns at most `need` items
    each marked with `fallback=True`."""
    if need <= 0:
        return []
    candidates: List[Dict[str, Any]] = []
    cur = db.article_views.find({}, {"_id": 0, "article_id": 1, "views": 1}).sort(
        [("views", -1)]
    ).limit(need * 3 + 5)
    async for d in cur:
        aid = d.get("article_id")
        if aid and aid not in exclude:
            candidates.append({"id": aid, "views": int(d.get("views", 0))})
    if not candidates:
        return []
    meta = await _fetch_articles_meta(db, [c["id"] for c in candidates])
    out: List[Dict[str, Any]] = []
    for c in candidates:
        if len(out) >= need:
            break
        art = meta.get(c["id"])
        if art:
            out.append({**art, "views_window": c["views"], "fallback": True})
    return out


async def most_read(db, *, hours: int = 1, limit: int = 5) -> List[Dict[str, Any]]:
    """Top N most-read articles in the last `hours` hours.

    Strategy:
      • Pull article_view_dedup entries with ts > now - hours
      • Aggregate counts per article_id, sort desc, top `limit`
      • Join against published_content to surface headline + url_slug + ago
      • If we don't have enough recent activity yet (cold start), fall back
        to all-time top by `article_views.views` so the rail never reads
        empty on a fresh deployment.

    iter66 refactor: was a single 64-line function with cyclomatic 16 +
    16 locals. Split into focused step helpers (`_window_counts`,
    `_fetch_articles_meta`, `_coldstart_fillers`). Identical output.
    """
    from datetime import datetime, timezone, timedelta
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    # 1. window counts
    rows = await _window_counts(db, since_iso=since)

    # 2. join with published_content for the top `limit`
    items: List[Dict[str, Any]] = []
    if rows:
        ranked = sorted(rows.items(), key=lambda kv: -kv[1])[:limit]
        ranked_ids = [aid for aid, _ in ranked]
        meta = await _fetch_articles_meta(db, ranked_ids)
        for aid, reads in ranked:
            art = meta.get(aid)
            if art:
                items.append({**art, "views_window": reads})

    # 3. cold-start fillers
    if len(items) < limit:
        fillers = await _coldstart_fillers(
            db, need=limit - len(items),
            exclude={it["id"] for it in items},
        )
        items.extend(fillers)

    return items
