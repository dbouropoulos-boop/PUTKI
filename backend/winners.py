"""
Winners Corner — Batch 4.

Maintains a small editorial track-record of settled betting tips that hit.
Public `/api/winners/recent` reads the latest N. Admin can append a winner
from the back-office.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field


class WinnerIn(BaseModel):
    pick_team:  str = Field(..., min_length=1, max_length=120)
    opponent:   str = Field(..., min_length=1, max_length=120)
    sport:      str = Field("", max_length=60)
    odds:       float = Field(..., gt=1.0, le=100.0)
    units:      float = Field(1.0, gt=0, le=100)
    settled_at: Optional[str] = None
    note:       Optional[str] = Field(None, max_length=240)


def build_winners_router(db: AsyncIOMotorDatabase, require_admin) -> APIRouter:
    r = APIRouter()

    @r.get("/winners/recent")
    async def public_winners_recent(limit: int = 6) -> Dict[str, Any]:
        limit = max(1, min(20, limit))
        cursor = db.winners.find({}, {"_id": 0}).sort("settled_at", -1).limit(limit)
        rows = [doc async for doc in cursor]
        total = await db.winners.count_documents({})
        return {"winners": rows, "total": total}

    @r.post("/admin/winners")
    async def admin_create_winner(data: WinnerIn, _: bool = Depends(require_admin)) -> Dict[str, Any]:
        doc = {
            "id":         str(uuid.uuid4()),
            "pick_team":  data.pick_team,
            "opponent":   data.opponent,
            "sport":      data.sport,
            "odds":       round(data.odds, 2),
            "units":      round(data.units, 2),
            "profit":     round((data.odds - 1) * data.units, 2),
            "settled_at": data.settled_at or datetime.now(timezone.utc).isoformat(),
            "note":       data.note,
        }
        await db.winners.insert_one(dict(doc))
        return doc

    @r.delete("/admin/winners/{wid}")
    async def admin_delete_winner(wid: str, _: bool = Depends(require_admin)) -> Dict[str, Any]:
        res = await db.winners.delete_one({"id": wid})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail="Winner not found")
        return {"ok": True}

    return r
