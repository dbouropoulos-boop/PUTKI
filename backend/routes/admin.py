"""
PUTKI HQ - `routes/admin.py`

iter68 phase 1 → mittari/mestari copy endpoints (GET/PUT × 2)
iter68 phase 2 → streamer-meta admin cluster (7 endpoints)
iter68 phase 3 → slot-registry (5) + voyager rotation (5) = 10 endpoints

Cumulative footprint: 21 admin endpoints relocated out of server.py.

Subsequent clusters: scheduler · dispatch · feed rebuild · users + audit log.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from routes._helpers import get_db, require_admin


# ─── Pydantic payloads (private to this router) ─────────────────────
class _StreamerMetaPayload(BaseModel):
    """Manual streamer-meta upsert payload."""
    platform: str
    user_login: str
    meta_fi: Optional[str] = ""
    meta_en: Optional[str] = ""
    suppressed: Optional[bool] = False


class _DraftGeneratePayload(BaseModel):
    """Trigger an AI draft for a single streamer."""
    platform: str
    user_login: str
    force: Optional[bool] = False


class _PublishMetaPayload(BaseModel):
    """Promote a draft to live + record publish history."""
    platform: str
    user_login: str
    meta_line_fi: str
    meta_line_en: str


class _SuppressMetaPayload(BaseModel):
    """Toggle suppressed flag for a streamer."""
    platform: str
    user_login: str
    suppressed: bool


class _SlotEntryAdd(BaseModel):
    """Add a new slot/live-table entry to the editorial registry."""
    name: str
    category: str  # slot | live_table
    provider: Optional[str] = ""
    enabled: Optional[bool] = True


class _SlotEntryUpdate(BaseModel):
    """Partial-update an existing slot registry entry."""
    enabled: Optional[bool] = None
    category: Optional[str] = None
    provider: Optional[str] = None


class _VoyagerWeekPayload(BaseModel):
    """Single rotation-calendar week. iso_week format: 'YYYY-Www'."""
    iso_week: str
    market_id: str = "FI"
    partner_operator_slug: Optional[str] = None
    theme: Optional[str] = ""
    prize_summary: Optional[str] = ""
    smartico_template_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "planned"


# ─── Phase 4 payloads · scheduler + dispatch ────────────────────────
class _CadencesPayload(BaseModel):
    """Editor-driven cadence map: { content_type: {weekday, hour, ...} }."""
    cadences: Dict[str, Any]


class _DispatchRunPayload(BaseModel):
    """Manual dispatch trigger. dry_run defaults to True so the audit
    trail stays honest until provider keys land."""
    dry_run: Optional[bool] = True


class _DispatchTestSendPayload(BaseModel):
    """Targeted dispatch to a tiny recipient list - go-live smoke test."""
    recipients: list
    channels: Optional[list] = None


class _DispatchFlagPayload(BaseModel):
    """Review-flag a single dispatch send."""
    reason: str
    note: Optional[str] = None
    flagged_by: Optional[str] = None


class _DispatchSegmentOverridePayload(BaseModel):
    """Per-channel/segment override (dry_run | live_segment_only | live_global)."""
    channel: str
    consent_tag: str
    mode: str


def make_router() -> APIRouter:
    """Return an `APIRouter` populated with the admin endpoints.

    Mounted under `/api` by server.py so each handler reaches the public
    URL `/api/admin/...` exactly as it did when it lived directly on
    `api_router`."""

    router = APIRouter()

    # ════════════════════════════════════════════════════════════════
    # Phase 1 - Mittari / Mestari copy
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/mittari/copy")
    async def admin_get_mittari_copy(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only - returns raw override + merged + defaults for the editor."""
        from mittari_copy import get_mittari_copy_raw
        return await get_mittari_copy_raw(db)

    @router.put("/admin/mittari/copy")
    async def admin_save_mittari_copy(
        payload: Dict[str, Any],
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only - persist a new override doc (deep-merge w/ defaults)."""
        from mittari_copy import save_mittari_copy
        try:
            return await save_mittari_copy(db, payload)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.get("/admin/mestari/copy")
    async def admin_get_mestari_copy(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only - returns raw override + merged + defaults for the editor."""
        from mestari_copy import get_mestari_copy_raw
        return await get_mestari_copy_raw(db)

    @router.put("/admin/mestari/copy")
    async def admin_save_mestari_copy(
        payload: Dict[str, Any],
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only - persist a new override doc (deep-merge w/ defaults)."""
        from mestari_copy import save_mestari_copy
        try:
            return await save_mestari_copy(db, payload)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ════════════════════════════════════════════════════════════════
    # Phase 2 - Streamer meta (legacy + AI drafter + GDPR history)
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/streamer-meta")
    async def admin_list_streamer_meta(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from streamer_snapshots import list_meta
        return {"items": await list_meta(db)}

    @router.put("/admin/streamer-meta")
    async def admin_upsert_streamer_meta(
        payload: _StreamerMetaPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from streamer_snapshots import upsert_meta
        try:
            doc = await upsert_meta(
                db,
                platform=payload.platform.lower(),
                user_login=payload.user_login,
                meta_fi=payload.meta_fi or "",
                meta_en=payload.meta_en or "",
                suppressed=bool(payload.suppressed),
            )
            return {"saved": doc}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.get("/admin/streamer-meta/v2")
    async def admin_list_streamer_meta_v2(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Status-aware listing - every row carries derived status
        (NO_META | DRAFT_NEEDS_REVIEW | PUBLISHED | SUPPRESSED)."""
        from streamer_meta_drafter import list_meta_with_status, rate_limit_status
        rows = await list_meta_with_status(db)
        rl = await rate_limit_status(db)
        return {"items": rows, "rate_limit": rl}

    @router.post("/admin/streamer-meta/generate-draft")
    async def admin_generate_streamer_meta_draft(
        payload: _DraftGeneratePayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from streamer_meta_drafter import generate_draft
        result = await generate_draft(
            db,
            platform=payload.platform,
            user_login=payload.user_login,
            force=bool(payload.force),
        )
        if not result.get("ok"):
            reason = result.get("reason")
            status_code = {
                "rate_limited": 429,
                "ai_disabled": 503,
                "llm_unavailable": 503,
                "llm_parse_failed": 502,
                "streamer_not_found": 404,
                "invalid_user_login": 400,
            }.get(reason, 500)
            # JSON body even on error so the UI can show the reason in a
            # status pill rather than a generic toast.
            raise HTTPException(status_code=status_code, detail=result)
        return result

    @router.post("/admin/streamer-meta/publish")
    async def admin_publish_streamer_meta(
        payload: _PublishMetaPayload,
        x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from streamer_meta_drafter import publish_meta
        try:
            # `published_by` carries token prefix + length only - useful
            # audit signal without leaking the full secret.
            published_by = f"admin-{(x_admin_token or '')[:4]}-{len(x_admin_token or '')}"
            result = await publish_meta(
                db,
                platform=payload.platform,
                user_login=payload.user_login,
                meta_line_fi=payload.meta_line_fi,
                meta_line_en=payload.meta_line_en,
                published_by=published_by,
            )
            return result
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.post("/admin/streamer-meta/suppress")
    async def admin_suppress_streamer_meta(
        payload: _SuppressMetaPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from streamer_meta_drafter import set_suppressed
        try:
            return await set_suppressed(
                db,
                platform=payload.platform,
                user_login=payload.user_login,
                suppressed=bool(payload.suppressed),
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.get("/admin/streamer-meta/history/{platform}/{user_login}")
    async def admin_streamer_meta_history(
        platform: str,
        user_login: str,
        limit: int = 50,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """GDPR compliance: full publish history for one streamer."""
        cur = db.streamer_meta_history.find(
            {"platform": platform.lower(), "user_login": (user_login or "").lower()},
            {"_id": 0},
        ).sort([("published_at", -1)]).limit(max(1, min(int(limit or 50), 200)))
        return {"items": [d async for d in cur]}

    # ════════════════════════════════════════════════════════════════
    # Phase 3a - Slot registry (editorial slot/live-table catalogue)
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/slot-registry")
    async def admin_list_slot_registry(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from slot_registry import list_registry
        return {"items": await list_registry(db, include_disabled=True)}

    @router.post("/admin/slot-registry")
    async def admin_add_slot_registry(
        payload: _SlotEntryAdd,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from slot_registry import add_entry
        try:
            doc = await add_entry(
                db,
                name=payload.name,
                category=payload.category,
                provider=payload.provider or "",
                enabled=bool(payload.enabled if payload.enabled is not None else True),
            )
            return {"added": doc}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.patch("/admin/slot-registry/{entry_id}")
    async def admin_update_slot_registry(
        entry_id: str,
        payload: _SlotEntryUpdate,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from slot_registry import update_entry
        try:
            doc = await update_entry(
                db, entry_id,
                enabled=payload.enabled,
                category=payload.category,
                provider=payload.provider,
            )
            if not doc:
                raise HTTPException(status_code=404, detail="not found")
            return {"updated": doc}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.delete("/admin/slot-registry/{entry_id}")
    async def admin_delete_slot_registry(
        entry_id: str,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from slot_registry import delete_entry
        ok = await delete_entry(db, entry_id)
        if not ok:
            raise HTTPException(status_code=404, detail="not found")
        return {"deleted": entry_id}

    @router.post("/admin/slot-registry/seed")
    async def admin_seed_slot_registry(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Idempotent seed of the default editorial registry. Safe to re-run."""
        from slot_registry import seed_default_registry
        return await seed_default_registry(db)

    # ════════════════════════════════════════════════════════════════
    # Phase 3b - Voyager rotation calendar
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/voyager/rotation")
    async def admin_get_voyager_rotation(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin - full rotation calendar with raw, sanitised, defaults."""
        from voyager_rotation import get_voyager_rotation_raw
        return await get_voyager_rotation_raw(db)

    @router.put("/admin/voyager/rotation")
    async def admin_save_voyager_rotation(
        payload: Dict[str, Any],
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin - overwrite the rotation calendar. Sanitiser runs server-side."""
        from voyager_rotation import save_voyager_rotation
        try:
            return await save_voyager_rotation(db, payload)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.get("/admin/voyager/weeks")
    async def admin_list_voyager_weeks(
        market_id: str = "FI",
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from rotation import (
            list_weeks as rotation_list,
            stats as rotation_stats,
            current_iso_week,
            next_iso_weeks,
        )
        weeks = await rotation_list(db, market_id=market_id, limit=500)
        return {
            "weeks": weeks,
            "stats": await rotation_stats(db, market_id=market_id),
            "current_iso_week": current_iso_week(),
            "next_iso_weeks": next_iso_weeks(12),
        }

    @router.put("/admin/voyager/weeks/{iso_week}")
    async def admin_upsert_voyager_week(
        iso_week: str,
        data: _VoyagerWeekPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from rotation import upsert_week as rotation_upsert
        payload = data.dict()
        payload["iso_week"] = iso_week
        try:
            return await rotation_upsert(db, payload, updated_by="admin")
        except ValueError as e:
            raise HTTPException(400, str(e))

    @router.delete("/admin/voyager/weeks/{iso_week}")
    async def admin_delete_voyager_week(
        iso_week: str,
        market_id: str = "FI",
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from rotation import delete_week as rotation_delete
        ok = await rotation_delete(db, iso_week, market_id=market_id)
        if not ok:
            raise HTTPException(404, "Not found")
        return {"deleted": iso_week, "market_id": market_id}

    # ════════════════════════════════════════════════════════════════
    # Phase 4a - Scheduler (cadences + status + tick + variant filler)
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/scheduler/cadences")
    async def admin_get_cadences(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from seed_scheduler import get_cadences
        return {"cadences": await get_cadences(db)}

    @router.put("/admin/scheduler/cadences")
    async def admin_set_cadences(
        data: _CadencesPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from seed_scheduler import set_cadences
        return {"cadences": await set_cadences(db, data.cadences)}

    @router.get("/admin/scheduler/status")
    async def admin_scheduler_status(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from seed_scheduler import schedule_status
        return await schedule_status(db)

    @router.post("/admin/scheduler/tick")
    async def admin_scheduler_tick(
        force_content_type: Optional[str] = None,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Force-fire the scheduler now. With `force_content_type` set, bypass
        the weekday/min-gap check for that single content type."""
        from seed_scheduler import run_scheduler_tick
        return await run_scheduler_tick(db, force_content_type=force_content_type)

    @router.post("/admin/scheduler/fill-variants")
    async def admin_fill_variants(
        max_per_tick: int = 5,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from seed_scheduler import run_variant_filler
        return await run_variant_filler(db, max_per_tick=max_per_tick)

    # ════════════════════════════════════════════════════════════════
    # Phase 4b - Feed (admin list + rebuild)
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/feed")
    async def admin_feed(
        source: Optional[str] = None,
        kind: Optional[str] = None,
        market_id: Optional[str] = None,
        limit: int = 50,
        include_mocked: bool = True,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from feed import list_feed
        # Default market matches the public endpoint's `FEED_DEFAULT_MARKET`.
        mid = market_id or "FI"
        items = await list_feed(
            db, source=source, kind=kind, market_id=mid,
            limit=limit, include_mocked=include_mocked,
        )
        return {"items": items, "count": len(items),
                "market_id": mid, "include_mocked": include_mocked}

    @router.post("/admin/feed/rebuild")
    async def admin_feed_rebuild(
        market_id: Optional[str] = None,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from feed import rebuild_feed
        return await rebuild_feed(db, market_id=market_id or "FI")

    # ════════════════════════════════════════════════════════════════
    # Phase 4c - Dispatch (daily worker + previewer + flags + overrides)
    # ════════════════════════════════════════════════════════════════

    @router.post("/admin/dispatch/run")
    async def admin_dispatch_run(
        payload: _DispatchRunPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Manually fire the daily dispatch cycle. Dry-run by default."""
        from dispatch_daily import run_daily_dispatch
        return await run_daily_dispatch(db, dry_run=bool(payload.dry_run))

    @router.get("/admin/dispatch/log")
    async def admin_dispatch_log(
        limit: int = 100,
        kind: Optional[str] = None,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import list_recent_log
        items = await list_recent_log(db, limit=limit, kind=kind)
        return {"items": items, "count": len(items)}

    @router.get("/admin/dispatch/summary")
    async def admin_dispatch_summary(
        days: int = 7,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import cycle_summary
        return await cycle_summary(db, days=days)

    @router.get("/admin/dispatch/cycles")
    async def admin_dispatch_cycles(
        days: int = 14, limit: int = 50,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import list_cycles
        items = await list_cycles(db, days=days, limit=limit)
        return {"items": items, "count": len(items)}

    @router.get("/admin/dispatch/cycles/{cycle_id}")
    async def admin_dispatch_cycle_detail(
        cycle_id: str,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import cycle_detail
        try:
            return await cycle_detail(db, cycle_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    @router.post("/admin/dispatch/logs/{send_id}/flag")
    async def admin_dispatch_flag_send(
        send_id: str,
        payload: _DispatchFlagPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import flag_send
        try:
            return await flag_send(db, send_id,
                                   reason=payload.reason,
                                   note=payload.note,
                                   flagged_by=payload.flagged_by)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.delete("/admin/dispatch/logs/{send_id}/flag")
    async def admin_dispatch_unflag_send(
        send_id: str,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import unflag_send
        removed = await unflag_send(db, send_id)
        return {"removed": removed}

    @router.get("/admin/dispatch/review-flags")
    async def admin_dispatch_review_flags(
        status: Optional[str] = None, limit: int = 200,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import list_flags
        items = await list_flags(db, status=status, limit=limit)
        return {"items": items, "count": len(items)}

    @router.get("/admin/dispatch/segment-overrides")
    async def admin_dispatch_segment_overrides_list(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import list_segment_overrides
        items = await list_segment_overrides(db)
        return {"items": items, "count": len(items)}

    @router.put("/admin/dispatch/segment-overrides")
    async def admin_dispatch_segment_overrides_set(
        payload: _DispatchSegmentOverridePayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        from dispatch_daily import set_segment_override
        try:
            return await set_segment_override(
                db, payload.channel, payload.consent_tag, payload.mode,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    @router.post("/admin/dispatch/test-send")
    async def admin_dispatch_test_send(
        payload: _DispatchTestSendPayload,
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Trigger a targeted dispatch - only readers in the opt-in
        segment whose identifier is in `recipients`."""
        from dispatch_daily import run_daily_dispatch
        if not payload.recipients:
            raise HTTPException(status_code=400, detail="recipients required")
        return await run_daily_dispatch(
            db, dry_run=False,
            recipients_override=payload.recipients,
            channels=payload.channels,
        )

    return router
