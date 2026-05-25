"""
PUTKI HQ — Streamer routes (iter66 modularisation phase 3a).

Extracts every public + admin endpoint under `/api/streamers/*` and
`/api/admin/streamers/*` from server.py. ~290 LOC moved.

Public:
    GET  /api/streamers
    GET  /api/streamers/{slug}
    GET  /api/streamers/live
    GET  /api/streamers/recent-alerts
    GET  /api/streamers/viewer-delta
    GET  /api/streamers/now-playing
    GET  /api/streamers/roster_summary

Admin (Depends(require_admin)):
    GET    /api/admin/streamers
    PUT    /api/admin/streamers/{slug}
    DELETE /api/admin/streamers/{slug}
    POST   /api/admin/streamers/discover
    POST   /api/admin/streamers/refresh-avatars
    POST   /api/admin/streamers/{slug}/refresh-avatar
    POST   /api/admin/streamers/refresh-failed-avatars
"""
from __future__ import annotations

import asyncio
import logging
import time as _t
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from rosters import (
    INTL_SCENES_META, StreamerPayload, delete_streamer, get_streamer,
    list_streamers, upsert_streamer,
)
from routes._helpers import get_db, require_admin

logger = logging.getLogger(__name__)


def build_streamers_router() -> APIRouter:
    """Composed APIRouter — mounted under /api by the caller."""
    router = APIRouter()

    # ─── Public ──────────────────────────────────────────────────────

    @router.get("/streamers")
    async def public_list_streamers(
        scene: Optional[str] = None,
        market: Optional[str] = None,
        market_id: Optional[str] = None,
        db = Depends(get_db),
    ):
        """Public — list streamers. `market` filter: 'fi' or 'intl' (convenience)."""
        return {
            "streamers": await list_streamers(db, scene=scene, market=market, market_id=market_id),
            "intl_scenes": INTL_SCENES_META,
        }

    @router.get("/streamers/live")
    async def public_streamers_live(platform: Optional[str] = None,
                                     db = Depends(get_db)):
        """Pre-launch polish — REAL live streamers across Twitch + Kick + YouTube.

        `platform` query param: omit for Twitch (default Helix `language=fi`),
        or pass `kick` / `youtube` to hit the multi-platform aggregator.
        60s in-process cache per platform. Returns `dormant:true` if creds for
        the requested platform are missing so the frontend can render an
        honest empty state instead of fake data."""
        p = (platform or "twitch").lower()
        if p == "twitch":
            from streamer_live import get_live_streamers
            d = await get_live_streamers()
            d["platform"] = "twitch"
        elif p == "kick":
            from multi_platform_live import fetch_kick_live
            d = await fetch_kick_live(db)
        elif p == "youtube":
            from multi_platform_live import fetch_youtube_live
            d = await fetch_youtube_live(db)
        else:
            raise HTTPException(status_code=400, detail="unknown platform")

        # Record viewer-count snapshots for change indicators (24h TTL)
        try:
            from streamer_snapshots import record_snapshot_batch, attach_meta
            items = d.get("streamers") or d.get("items") or []
            if items:
                await record_snapshot_batch(db, platform=p, items=items)
                await attach_meta(db, items, platform=p)
        except Exception:
            logger.exception("snapshot/meta enrichment failed for %s", p)
        return d

    @router.get("/streamers/recent-alerts")
    async def public_streamers_recent_alerts(within_minutes: int = 60,
                                              db = Depends(get_db)):
        """Returns a map of streamer_login → dispatched count for streamers
        whose subscribers were notified within the last N minutes."""
        within = max(1, min(int(within_minutes), 1440))
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=within)).isoformat()
        cur = db.streamer_alerts.aggregate([
            {"$match": {"last_notified_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": {"login": "$streamer_login", "platform": "$platform"},
                "count": {"$sum": 1},
                "latest": {"$max": "$last_notified_at"},
            }},
        ])
        by_streamer: Dict[str, Dict[str, Any]] = {}
        async for r in cur:
            login = (r["_id"]["login"] or "").lower()
            if not login:
                continue
            by_streamer[login] = {
                "platform": r["_id"]["platform"],
                "count": int(r["count"]),
                "latest": r["latest"],
            }
        return {
            "within_minutes": within,
            "by_streamer": by_streamer,
            "as_of": datetime.now(timezone.utc).isoformat(),
        }

    @router.get("/streamers/viewer-delta")
    async def public_streamer_viewer_delta(platform: str, user_login: str,
                                            db = Depends(get_db)):
        """Returns the change indicator for a streamer's viewer count vs ~1h ago.
        Returns 200 with `null` fields when 24h-snapshot data isn't yet
        meaningful so the frontend cleanly suppresses the indicator."""
        from streamer_snapshots import viewer_delta_last_hour
        p = (platform or "").lower()
        if p not in {"twitch", "kick", "youtube"}:
            raise HTTPException(status_code=400, detail="unknown platform")
        res = await viewer_delta_last_hour(db, platform=p, user_login=user_login)
        if not res:
            return {"delta": None, "direction": None}
        return res

    @router.get("/streamers/now-playing")
    async def public_streamers_now_playing(db = Depends(get_db)):
        """Aggregates currently-live streamers across Twitch + Kick + YouTube,
        matches their stream titles + game categories against the slot registry
        using longest-match-wins, and returns the per-slot count table for the
        homepage "NOW PLAYING" ticker.

        iter52: also reports `slot_category_streams_count` — the number of
        live streams whose `game_name` is in the slot/casino category set."""
        from slot_registry import extract_now_playing
        SLOT_CATEGORY_LABELS = {
            "slots", "slot", "slots & casino", "slot & casino",
            "casino", "virtual casino", "online casino",
        }
        all_rows: List[Dict[str, Any]] = []
        category_stream_count = 0
        for p in ("twitch", "kick", "youtube"):
            try:
                if p == "twitch":
                    from streamer_live import get_live_streamers
                    d = await get_live_streamers()
                elif p == "kick":
                    from multi_platform_live import fetch_kick_live
                    d = await fetch_kick_live(db)
                else:
                    from multi_platform_live import fetch_youtube_live
                    d = await fetch_youtube_live(db)
                items = d.get("streamers") or d.get("items") or []
                for s in items:
                    cat = (s.get("game_name") or "").strip().lower()
                    if cat in SLOT_CATEGORY_LABELS:
                        category_stream_count += 1
                rows = await extract_now_playing(db, items, platform=p)
                for r in rows:
                    hit = next((x for x in all_rows if x["name"] == r["name"]), None)
                    if hit:
                        hit["count"] += r["count"]
                        hit["streamers"].extend(r["streamers"])
                    else:
                        all_rows.append(r)
            except Exception:
                logger.exception("now-playing platform %s failed", p)
        all_rows.sort(key=lambda r: (-r["count"], r["name"]))
        return {
            "slots": all_rows,
            "total_streams_matched": sum(r["count"] for r in all_rows),
            "slot_category_streams_count": category_stream_count,
            "as_of": datetime.now(timezone.utc).isoformat(),
        }

    @router.get("/streamers/roster_summary")
    async def public_streamers_roster_summary(db = Depends(get_db)):
        """Lightweight summary of the streamer roster for the SocialProofBar.
        Returns TOTAL tracked across all platforms + per-platform breakdown +
        currently-live count (best-effort from public_stats cache)."""
        tracked_total = await db.streamers.count_documents({})
        by_platform: Dict[str, int] = {}
        cursor = db.streamers.find({}, {"_id": 0, "platform": 1})
        async for s in cursor:
            p = (s.get("platform") or "twitch").lower()
            by_platform[p] = by_platform.get(p, 0) + 1
        try:
            from public_stats import get_live_stats
            stats = await get_live_stats(db)
            live = int(stats.get("twitch_live", 0) or 0)
        except Exception:
            live = 0
        return {
            "tracked_total": tracked_total,
            "by_platform": by_platform,
            "live": live,
        }

    @router.get("/streamers/{slug}")
    async def public_get_streamer(slug: str, db = Depends(get_db)):
        s = await get_streamer(db, slug)
        if not s:
            raise HTTPException(404, "Not found")
        return s

    # ─── Admin · CRUD ────────────────────────────────────────────────

    @router.get("/admin/streamers")
    async def admin_list_streamers(
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        return {"streamers": await list_streamers(db, active_only=False)}

    @router.put("/admin/streamers/{slug}")
    async def admin_upsert_streamer(
        slug: str, data: StreamerPayload,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        return await upsert_streamer(db, slug, data.dict(), updated_by="admin")

    @router.delete("/admin/streamers/{slug}")
    async def admin_delete_streamer(
        slug: str,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        ok = await delete_streamer(db, slug)
        if not ok:
            raise HTTPException(404, "Not found")
        return {"deleted": slug}

    @router.post("/admin/streamers/discover")
    async def admin_twitch_discover(
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """Manually trigger one Twitch auto-discovery pass. Adds new FI casino
        streamers with ≥1000 followers to the registry."""
        from twitch_discovery import discover_once
        return await discover_once(db)

    @router.post("/admin/streamers/refresh-avatars")
    async def admin_refresh_avatars(
        force: bool = True,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """Re-resolve avatar URLs for every active streamer."""
        from streamer_avatars import refresh_all_avatars
        return await refresh_all_avatars(db, force=force)

    @router.post("/admin/streamers/{slug}/refresh-avatar")
    async def admin_refresh_one_avatar(
        slug: str,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """iter62: Force-refresh a single streamer's avatar with the FULL
        multi-stage cascade — platform API → channel OG image → DDG image
        search → Wikipedia. No initials placeholder ever."""
        s = await db.streamers.find_one(
            {"slug": slug},
            {"_id": 0, "slug": 1, "platform": 1, "channel": 1, "name": 1, "name_en": 1},
        )
        if not s:
            raise HTTPException(404, "streamer_not_found")

        from streamer_avatars import _fetch_twitch_avatars, _fetch_kick_avatars, _fetch_youtube_avatars
        from streamer_avatar_fallback import resolve_avatar_with_fallback

        platform = (s.get("platform") or "").lower()
        channel = (s.get("channel") or s.get("slug") or "").strip().lstrip("@")
        primary = None
        try:
            if platform == "twitch":
                res = await _fetch_twitch_avatars([channel.lower()])
                primary = res.get(channel.lower())
            elif platform == "kick":
                res = await _fetch_kick_avatars([channel.lower()])
                primary = res.get(channel.lower())
            elif platform == "youtube":
                res = await _fetch_youtube_avatars([s.get("channel") or channel])
                primary = res.get(s.get("channel") or channel)
        except Exception as e:
            logger.warning("primary avatar fetch failed for %s: %s", slug, e)

        name_for_search = (s.get("name") or s.get("name_en") or s.get("slug") or "").strip()
        url, source = await resolve_avatar_with_fallback(
            name=name_for_search, platform=platform, channel=channel,
            primary_url=primary,
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        if url:
            await db.streamers.update_one(
                {"slug": slug},
                {"$set": {"avatar_url": url, "avatar_source": source,
                          "avatar_resolved_at": now_iso,
                          "avatar_resolved_at_unix": _t.time(),
                          "avatar_failed": False},
                 "$unset": {"avatar_failure_reason": ""}},
            )
        else:
            await db.streamers.update_one(
                {"slug": slug},
                {"$set": {"avatar_source": "exhausted_all_fallbacks",
                          "avatar_resolved_at": now_iso,
                          "avatar_resolved_at_unix": _t.time(),
                          "avatar_failed": True,
                          "avatar_failure_reason": "all_4_stages_failed"}},
            )

        from admin_auth import write_audit
        await write_audit(db, actor="admin", role="editor",
                          action="streamer.refresh_avatar",
                          resource=f"streamer:{slug}",
                          meta={"source": source, "ok": bool(url)})

        return {"slug": slug, "avatar_url": url, "avatar_source": source,
                "ok": bool(url)}

    @router.post("/admin/streamers/refresh-failed-avatars")
    async def admin_refresh_failed_avatars(
        request: Request, limit: int = 30,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """iter62.1: Re-run the full 4-stage avatar cascade for streamers
        currently flagged `avatar_failed=true` OR with no `avatar_url`.

        Runs streamers in parallel batches (concurrency=6) to stay under the
        60s ingress timeout. Caller can paginate with `?limit=`."""
        from streamer_avatars import _fetch_twitch_avatars, _fetch_kick_avatars, _fetch_youtube_avatars
        from streamer_avatar_fallback import resolve_avatar_with_fallback

        cur = db.streamers.find(
            {"$or": [
                {"avatar_failed": True},
                {"avatar_url": {"$in": [None, ""]}},
                {"avatar_url": {"$exists": False}},
            ]},
            {"_id": 0, "slug": 1, "platform": 1, "channel": 1, "name": 1, "name_en": 1},
        ).limit(max(1, min(limit, 100)))
        targets = await cur.to_list(length=100)

        async def _resolve_one(s):
            platform = (s.get("platform") or "").lower()
            channel = (s.get("channel") or s.get("slug") or "").strip().lstrip("@")
            primary = None
            try:
                if platform == "twitch":
                    res = await _fetch_twitch_avatars([channel.lower()])
                    primary = res.get(channel.lower())
                elif platform == "kick":
                    res = await _fetch_kick_avatars([channel.lower()])
                    primary = res.get(channel.lower())
                elif platform == "youtube":
                    res = await _fetch_youtube_avatars([s.get("channel") or channel])
                    primary = res.get(s.get("channel") or channel)
            except Exception:
                pass
            name = (s.get("name") or s.get("name_en") or s.get("slug") or "").strip()
            url, source = await resolve_avatar_with_fallback(
                name=name, platform=platform, channel=channel, primary_url=primary,
            )
            now_iso = datetime.now(timezone.utc).isoformat()
            if url:
                await db.streamers.update_one(
                    {"slug": s["slug"]},
                    {"$set": {"avatar_url": url, "avatar_source": source,
                              "avatar_resolved_at": now_iso,
                              "avatar_resolved_at_unix": _t.time(),
                              "avatar_failed": False},
                     "$unset": {"avatar_failure_reason": ""}},
                )
            else:
                await db.streamers.update_one(
                    {"slug": s["slug"]},
                    {"$set": {"avatar_source": "exhausted_all_fallbacks",
                              "avatar_resolved_at": now_iso,
                              "avatar_resolved_at_unix": _t.time(),
                              "avatar_failed": True,
                              "avatar_failure_reason": "all_4_stages_failed"}},
                )
            return {"slug": s["slug"], "name": name, "source": source, "ok": bool(url)}

        sem = asyncio.Semaphore(6)
        async def _bounded(s):
            async with sem:
                return await _resolve_one(s)
        results = await asyncio.gather(*[_bounded(s) for s in targets],
                                        return_exceptions=False)

        actor = request.state.admin_actor
        from admin_auth import write_audit
        await write_audit(db, actor=actor["actor"], role=actor["role"],
                          action="streamer.refresh_failed_avatars",
                          resource="streamers:*",
                          meta={"attempted": len(results),
                                "succeeded": sum(1 for r in results if r["ok"])})

        return {
            "attempted": len(results),
            "succeeded": sum(1 for r in results if r["ok"]),
            "still_failed": sum(1 for r in results if not r["ok"]),
            "results": results,
        }

    return router
