"""
PUTKI HQ — `routes/admin.py` (iter68 phase 1)

First cluster extracted from the `server.py` admin monolith:

    GET  /api/admin/mittari/copy   → editor source-of-truth
    PUT  /api/admin/mittari/copy   → persist override doc
    GET  /api/admin/mestari/copy   → editor source-of-truth
    PUT  /api/admin/mestari/copy   → persist override doc

Why these four first
────────────────────
1. **Tight, isolated dependencies.** Each handler is a 4-line shim over
   the existing `mittari_copy` / `mestari_copy` modules (the data layer
   already lived outside server.py). Lift-and-shift, zero refactor risk.
2. **High back-office traffic.** These are the endpoints behind the
   `/back-office/mittari-copy` and `/back-office/mestari-copy` editors —
   moving them first means the new file gets exercised on every admin
   edit.
3. **Clean test surface.** Both modules already have `test_mestari_copy.py`
   + `test_iter40_mittari_optimization.py` covering the full GET/PUT
   contract — no behavioural changes, so those tests just keep passing.

The full ~70-endpoint extraction will happen in subsequent clusters
(streamers admin · voyager rotation · scheduler · dispatch · feed
rebuild · users + audit log).
"""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from routes._helpers import get_db, require_admin


def make_router() -> APIRouter:
    """Return an `APIRouter` populated with the four admin copy endpoints.

    The router is mounted under `/api` by server.py's `api_router.include_router`
    so each handler reaches the public URL `/api/admin/...` exactly as it did
    when it lived directly on `api_router`."""

    router = APIRouter()

    # ─── Mittari copy ────────────────────────────────────────────────
    @router.get("/admin/mittari/copy")
    async def admin_get_mittari_copy(
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only — returns raw override + merged + defaults for the editor."""
        # Local import keeps this module importable even if the data
        # layer fails to load (e.g. during a partial test fixture).
        from mittari_copy import get_mittari_copy_raw
        return await get_mittari_copy_raw(db)

    @router.put("/admin/mittari/copy")
    async def admin_save_mittari_copy(
        payload: Dict[str, Any],
        db = Depends(get_db),
        _: bool = Depends(require_admin),
    ):
        """Admin-only — persist a new override doc (deep-merge w/ defaults).

        Empty/missing fields fall back to defaults; field-length caps applied
        at read time, so a bad save self-recovers on the next reload."""
        from mittari_copy import save_mittari_copy
        try:
            return await save_mittari_copy(db, payload)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ─── Mestari copy ────────────────────────────────────────────────
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
        """Admin-only — persist a new override doc (deep-merge w/ defaults).

        Sanitiser re-runs on every read so a bad save self-recovers."""
        from mestari_copy import save_mestari_copy
        try:
            return await save_mestari_copy(db, payload)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return router
