"""
Operator's runbook served via API (iter76h).

The actual content lives in `/app/memory/OPS.md` (committed to the repo
so changes can be reviewed) and is served raw to the back-office page
at `/back-office/runbook`. We don't render markdown server-side - the
FE uses a tiny client-side renderer so the file stays the single source
of truth.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from routes._helpers import require_admin


_OPS_PATH = Path(os.environ.get("PUTKI_OPS_RUNBOOK_PATH")
                 or "/app/memory/OPS.md")


def make_router() -> APIRouter:
    router = APIRouter()

    @router.get("/admin/docs/runbook")
    async def admin_runbook(_: bool = Depends(require_admin)):
        try:
            text = _OPS_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise HTTPException(404, "runbook_missing")
        return {"path": str(_OPS_PATH), "bytes": len(text), "markdown": text}

    return router
