"""
PUTKI HQ — `routes/admin.py`

iter68 phase 1 → mittari/mestari copy endpoints (GET/PUT × 2)
iter68 phase 2 → streamer-meta admin cluster (7 endpoints):

    GET  /api/admin/streamer-meta                 — legacy listing
    PUT  /api/admin/streamer-meta                 — manual upsert
    GET  /api/admin/streamer-meta/v2              — status-aware listing
    POST /api/admin/streamer-meta/generate-draft  — AI draft a meta line
    POST /api/admin/streamer-meta/publish         — promote draft → live
    POST /api/admin/streamer-meta/suppress        — mark suppressed
    GET  /api/admin/streamer-meta/history/{p}/{u} — GDPR publish history

Why these next
──────────────
1. **Isolated dependencies.** All handlers delegate to two cohesive
   modules — `streamer_snapshots` (legacy) and `streamer_meta_drafter`
   (AI workflow). Zero cross-cutting deps in server.py.
2. **Heavy back-office traffic.** Powers the streamer-meta editor at
   `/back-office/streamers` (one of the most-used admin surfaces).
3. **Clear payload contracts.** Three small `BaseModel` payloads moved
   alongside the handlers — they were already prefixed `_`, signalling
   private/internal use.

Subsequent clusters: slot-registry · voyager rotation · scheduler ·
dispatch · feed rebuild · users + audit log.
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


def make_router() -> APIRouter:
    """Return an `APIRouter` populated with the admin endpoints.

    Mounted under `/api` by server.py so each handler reaches the public
    URL `/api/admin/...` exactly as it did when it lived directly on
    `api_router`."""

    router = APIRouter()

    # ════════════════════════════════════════════════════════════════
    # Phase 1 — Mittari / Mestari copy
    # ════════════════════════════════════════════════════════════════

    @router.get("/admin/mittari/copy")
    async def admin_get_mittari_copy(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only — returns raw override + merged + defaults for the editor."""
        from mittari_copy import get_mittari_copy_raw
        return await get_mittari_copy_raw(db)

    @router.put("/admin/mittari/copy")
    async def admin_save_mittari_copy(
        payload: Dict[str, Any],
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only — persist a new override doc (deep-merge w/ defaults)."""
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
        """Admin-only — returns raw override + merged + defaults for the editor."""
        from mestari_copy import get_mestari_copy_raw
        return await get_mestari_copy_raw(db)

    @router.put("/admin/mestari/copy")
    async def admin_save_mestari_copy(
        payload: Dict[str, Any],
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only — persist a new override doc (deep-merge w/ defaults)."""
        from mestari_copy import save_mestari_copy
        try:
            return await save_mestari_copy(db, payload)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ════════════════════════════════════════════════════════════════
    # Phase 2 — Streamer meta (legacy + AI drafter + GDPR history)
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
        """Status-aware listing — every row carries derived status
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
            # `published_by` carries token prefix + length only — useful
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

    return router
