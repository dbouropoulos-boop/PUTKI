"""
PUTKI HQ - /peli raffle backend.

REPLACES the previous Smartico game leaderboard. The new /peli is a simple
editorial raffle: visitor leaves name + phone + email and the editorial team
draws a winner. NO betting. NO deposit. NO stakes. NO gambling activity
takes place - this is a media-company promotional contest.

Endpoints:
  • GET  /api/peli/config           - public read-only config (prize, videos,
                                        partner, enabled, entry_count)
  • POST /api/peli/enter            - public raffle entry (name, phone, email,
                                        consent)
  • GET  /api/admin/peli/config     - admin read
  • PUT  /api/admin/peli/config     - admin update (prize_amount, prize_label,
                                        currency, partner_*, videos, enabled)
  • GET  /api/admin/peli/entries    - admin list entries (latest first)

Collections:
  • peli_meta    - singleton config (_id="config")
  • peli_entries - one doc per submitted entry
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field, validator

logger = logging.getLogger(__name__)

ADMIN_TOKEN_ENV = "BACK_OFFICE_TOKEN"
CONFIG_ID = "config"

_DEFAULT_CONFIG: Dict[str, Any] = {
    "_id": CONFIG_ID,
    "prize_amount": None,             # None until editor fills it in
    "prize_currency": "EUR",
    "prize_label": "",                # e.g. "500 € cash" or "Weezybet bonus"
    "partner_name": "Weezybet",
    "partner_url": "https://weezybet.com",
    "partner_disclosure": "Yhteistyössä · julkistettu päivämäärällä",
    "videos": [
        {"id": "v1", "title": "", "caption": ""},
        {"id": "v2", "title": "", "caption": ""},
        {"id": "v3", "title": "", "caption": ""},
    ],
    "enabled": True,
    "updated_at": None,
}


# ─────────────────────── Pydantic models ───────────────────────

class VideoConfig(BaseModel):
    id: str = Field(..., max_length=16)
    title: str = Field("", max_length=120)
    caption: str = Field("", max_length=240)


class PeliConfigUpdate(BaseModel):
    prize_currency: Optional[str] = Field(None, max_length=8)
    prize_label: Optional[str] = Field(None, max_length=120)
    partner_name: Optional[str] = Field(None, max_length=80)
    partner_url: Optional[str] = Field(None, max_length=240)
    partner_disclosure: Optional[str] = Field(None, max_length=240)
    videos: Optional[List[VideoConfig]] = None
    enabled: Optional[bool] = None


class PeliEntryIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=4, max_length=32)
    email: EmailStr
    consent: bool

    @validator("name")
    def _name_no_url(cls, v):
        if "http" in v.lower() or "www." in v.lower():
            raise ValueError("invalid name")
        return v.strip()

    @validator("phone")
    def _phone_digits(cls, v):
        # allow + and digits/spaces/dashes only
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.fullmatch(r"\+?\d{4,20}", cleaned):
            raise ValueError("invalid phone")
        return v.strip()

    @validator("consent")
    def _consent_required(cls, v):
        if not v:
            raise ValueError("consent required")
        return v


# ─────────────────────── Helpers ───────────────────────

def _admin_required(token: Optional[str]) -> None:
    expected = os.environ.get(ADMIN_TOKEN_ENV)
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_view(cfg: Dict[str, Any], entry_count: int) -> Dict[str, Any]:
    return {
        "prize_amount": cfg.get("prize_amount"),
        "prize_currency": cfg.get("prize_currency", "EUR"),
        "prize_label": cfg.get("prize_label", ""),
        "partner_name": cfg.get("partner_name"),
        "partner_url": cfg.get("partner_url"),
        "partner_disclosure": cfg.get("partner_disclosure"),
        "videos": cfg.get("videos", []),
        "enabled": bool(cfg.get("enabled", True)),
        "entry_count": entry_count,
    }


async def _get_or_seed(db) -> Dict[str, Any]:
    doc = await db.peli_meta.find_one({"_id": CONFIG_ID})
    if doc:
        return doc
    seed = dict(_DEFAULT_CONFIG)
    seed["updated_at"] = _now_iso()
    await db.peli_meta.insert_one(dict(seed))
    return seed


# ─────────────────────── Router ───────────────────────

def build_peli_router(db) -> APIRouter:
    router = APIRouter(prefix="/peli", tags=["peli"])

    @router.get("/config")
    async def get_public_config():
        cfg = await _get_or_seed(db)
        entry_count = await db.peli_entries.count_documents({})
        return _public_view(cfg, entry_count)

    @router.post("/enter")
    async def submit_entry(payload: PeliEntryIn):
        cfg = await _get_or_seed(db)
        if not cfg.get("enabled", True):
            raise HTTPException(status_code=409, detail="raffle_closed")
        entry = {
            "id": uuid.uuid4().hex,
            "name": payload.name,
            "phone": payload.phone,
            "email": payload.email.lower(),
            "consent": True,
            "submitted_at": _now_iso(),
            "ip_hash": None,  # privacy: not persisted at this layer
        }
        # Light idempotency: same email+phone within the same draw silently ok
        existing = await db.peli_entries.find_one(
            {"email": entry["email"], "phone": entry["phone"]}
        )
        if existing:
            return {"status": "already_entered", "id": existing.get("id")}
        await db.peli_entries.insert_one(dict(entry))
        return {"status": "ok", "id": entry["id"]}

    return router


def build_peli_admin_router(db) -> APIRouter:
    router = APIRouter(prefix="/admin/peli", tags=["peli-admin"])

    @router.get("/config")
    async def admin_get_config(x_admin_token: Optional[str] = Header(None)):
        _admin_required(x_admin_token)
        cfg = await _get_or_seed(db)
        entry_count = await db.peli_entries.count_documents({})
        return {
            "config": {**{k: v for k, v in cfg.items() if k != "_id"}},
            "entry_count": entry_count,
        }

    @router.put("/config")
    async def admin_update_config(
        body: PeliConfigUpdate,
        x_admin_token: Optional[str] = Header(None),
    ):
        _admin_required(x_admin_token)
        await _get_or_seed(db)
        patch: Dict[str, Any] = {
            k: v for k, v in body.dict(exclude_unset=True).items() if v is not None
        }
        if "videos" in patch:
            patch["videos"] = [v.dict() if hasattr(v, "dict") else v for v in patch["videos"]]
        patch["updated_at"] = _now_iso()
        await db.peli_meta.update_one({"_id": CONFIG_ID}, {"$set": patch})
        cfg = await db.peli_meta.find_one({"_id": CONFIG_ID})
        return {k: v for k, v in cfg.items() if k != "_id"}

    @router.get("/entries")
    async def admin_list_entries(
        limit: int = 200,
        x_admin_token: Optional[str] = Header(None),
    ):
        _admin_required(x_admin_token)
        limit = max(1, min(int(limit or 100), 1000))
        cur = db.peli_entries.find({}, {"_id": 0}).sort([("submitted_at", -1)]).limit(limit)
        rows = [doc async for doc in cur]
        return {"entries": rows, "count": len(rows)}

    return router
