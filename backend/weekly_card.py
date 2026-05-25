"""
Weekly Card gamification - Batch 2.

Persists user predictions for the weekly 5-fixture card, settles results,
and lets the back-office configure the cash prize + draw a winner.

Collections:
    weekly_meta    { _id: 'wk-<iso_year>-<iso_week>', week_key, prize_amount,
                     prize_currency, prize_label, locked, results: [...],
                     winner: { email_hash, drawn_at }, updated_at }
    weekly_picks   { id, week_key, email, channel ('email'|'sms'|'telegram'),
                     handle (phone or @user), picks: [{event_id, pick}],
                     correct_count, settled, submitted_at }
"""
from __future__ import annotations

import hashlib
import logging
import os
import random
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field, field_validator

log = logging.getLogger(__name__)

# Default config used on first-boot - overridable from back-office.
DEFAULT_PRIZE_AMOUNT = 100
DEFAULT_PRIZE_CURRENCY = "EUR"
DEFAULT_PRIZE_LABEL = "Weekly Card cash prize"

PickOption = Literal["1", "X", "2"]
Channel    = Literal["email", "sms", "telegram"]


def iso_week_key(dt: Optional[datetime] = None) -> str:
    """Return the canonical week identifier like '2026-W21' (Helsinki time)."""
    now = dt or datetime.now(timezone.utc)
    year, week, _ = now.isocalendar()
    return f"{year}-W{week:02d}"


def _email_hash(email: str) -> str:
    """Stable, irreversible hash so we can show a leaderboard without leaking PII."""
    norm = (email or "").strip().lower()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:12]


# ---------- Models ----------

class PickIn(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=120)
    pick:     PickOption


class WeeklySubmissionIn(BaseModel):
    email:    EmailStr
    channel:  Channel
    handle:   str = Field(..., min_length=3, max_length=64)
    picks:    List[PickIn] = Field(..., min_length=1, max_length=10)
    invite_code: Optional[str] = Field(None, max_length=24)

    @field_validator("handle")
    @classmethod
    def _validate_handle(cls, v: str, info):  # noqa: D401
        v = v.strip()
        channel = info.data.get("channel") if info and getattr(info, "data", None) else None
        if channel == "sms":
            digits = re.sub(r"\D", "", v)
            if len(digits) < 7:
                raise ValueError("phone number too short")
        elif channel == "telegram":
            if v.startswith("@"):
                v = v[1:]
            if not re.match(r"^[A-Za-z0-9_]{3,32}$", v):
                raise ValueError("invalid Telegram username")
        return v


class PrizeUpdateIn(BaseModel):
    prize_amount:   int = Field(..., ge=0, le=100_000)
    prize_currency: str = Field("EUR", min_length=2, max_length=4)
    prize_label:    str = Field("Weekly Card cash prize", min_length=2, max_length=120)


class ResultsUpdateIn(BaseModel):
    """Back-office settles each fixture with the actual 1/X/2 result."""
    results: List[PickIn]


# ---------- Helpers ----------

def _gen_invite_code(email: str) -> str:
    """Short, URL-safe invite code derived from email + random suffix."""
    seed = hashlib.sha256(f"{email}-{uuid.uuid4()}".encode()).hexdigest()
    return seed[:10].upper()


async def _ensure_meta(db: AsyncIOMotorDatabase, week_key: str) -> Dict[str, Any]:
    coll = db.weekly_meta
    doc = await coll.find_one({"_id": week_key})
    if doc:
        doc.pop("_id", None)
        return doc
    doc = {
        "_id": week_key,
        "week_key": week_key,
        "prize_amount": DEFAULT_PRIZE_AMOUNT,
        "prize_currency": DEFAULT_PRIZE_CURRENCY,
        "prize_label": DEFAULT_PRIZE_LABEL,
        "locked": False,
        "results": [],
        "winner": None,
        "entry_count": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await coll.insert_one(doc)
    out = dict(doc)
    out.pop("_id", None)
    return out


async def _refresh_entry_count(db, week_key: str) -> int:
    n = await db.weekly_picks.count_documents({"week_key": week_key})
    await db.weekly_meta.update_one({"_id": week_key}, {"$set": {"entry_count": n}})
    return n


async def _settle_entries(db, week_key: str, results: List[PickIn]) -> int:
    """Re-score every entry for this week against the new results."""
    result_map = {r.event_id: r.pick for r in results}
    cursor = db.weekly_picks.find({"week_key": week_key}, {"_id": 0})
    updated = 0
    async for entry in cursor:
        correct = 0
        for p in entry.get("picks", []):
            if result_map.get(p.get("event_id")) == p.get("pick"):
                correct += 1
        await db.weekly_picks.update_one(
            {"id": entry["id"]},
            {"$set": {"correct_count": correct, "settled": True}},
        )
        updated += 1
    return updated


# ---------- Router builder ----------

def build_weekly_router(db: AsyncIOMotorDatabase, require_admin) -> APIRouter:
    r = APIRouter()

    @r.get("/weekly/meta")
    async def get_meta(week: Optional[str] = None) -> Dict[str, Any]:
        wk = week or iso_week_key()
        await _ensure_meta(db, wk)
        await _refresh_entry_count(db, wk)
        meta = await _ensure_meta(db, wk)
        # Hide bare email hashes but expose entry count + winner.
        return {
            "week_key":       meta["week_key"],
            "prize_amount":   meta["prize_amount"],
            "prize_currency": meta["prize_currency"],
            "prize_label":    meta["prize_label"],
            "locked":         meta.get("locked", False),
            "results":        meta.get("results", []),
            "entry_count":    meta.get("entry_count", 0),
            "winner":         meta.get("winner"),
        }

    @r.post("/weekly/submit")
    async def submit_entry(data: WeeklySubmissionIn) -> Dict[str, Any]:
        wk = iso_week_key()
        meta = await _ensure_meta(db, wk)
        if meta.get("locked"):
            raise HTTPException(status_code=409, detail="Weekly card is locked - entries closed.")
        if not data.picks:
            raise HTTPException(status_code=400, detail="No picks supplied.")

        # Upsert by (week, email) so a user editing their card replaces the old entry.
        entry_id = str(uuid.uuid4())
        existing = await db.weekly_picks.find_one(
            {"week_key": wk, "email": data.email.lower()}, {"_id": 0},
        )
        invite_code = existing.get("invite_code") if existing else _gen_invite_code(data.email)
        if existing:
            entry_id = existing["id"]

        entry = {
            "id": entry_id,
            "week_key": wk,
            "email": data.email.lower(),
            "email_hash": _email_hash(data.email),
            "channel": data.channel,
            "handle": data.handle,
            "picks": [p.model_dump() for p in data.picks],
            "correct_count": 0,
            "settled": False,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "invite_code": invite_code,
            # Tickets in the random draw - 1 base + extras from successful invites
            # (set on the inviter's entry by /weekly/invite/use).
            "tickets": (existing.get("tickets") if existing else 1) or 1,
            "invite_count": (existing.get("invite_count") if existing else 0) or 0,
            "invited_by": data.invite_code.upper() if (not existing and data.invite_code) else (existing.get("invited_by") if existing else None),
        }
        await db.weekly_picks.update_one({"id": entry_id}, {"$set": entry}, upsert=True)

        # First-time entry came in with an invite - credit the inviter (+1 ticket).
        if not existing and data.invite_code:
            code = data.invite_code.upper().strip()
            if code and code != invite_code:
                await db.weekly_picks.update_one(
                    {"invite_code": code, "week_key": wk},
                    {"$inc": {"tickets": 1, "invite_count": 1}},
                )

        await _refresh_entry_count(db, wk)
        return {
            "ok": True,
            "entry_id": entry_id,
            "week_key": wk,
            "invite_code": invite_code,
            "tickets": entry["tickets"],
            "invite_count": entry["invite_count"],
        }

    @r.get("/weekly/invite/{code}")
    async def invite_lookup(code: str) -> Dict[str, Any]:
        """Public lookup so the share-landing page can show whose invite it is."""
        code = code.upper().strip()
        entry = await db.weekly_picks.find_one(
            {"invite_code": code}, {"_id": 0, "email_hash": 1, "week_key": 1, "tickets": 1, "invite_count": 1},
        )
        if not entry:
            raise HTTPException(status_code=404, detail="Invite code not found")
        return entry

    @r.get("/weekly/leaderboard")
    async def leaderboard(week: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        wk = week or iso_week_key()
        meta = await _ensure_meta(db, wk)
        # If unsettled, return entry-count only to avoid leaking ranking.
        settled = bool(meta.get("results"))
        if not settled:
            return {
                "week_key": wk,
                "entry_count": meta.get("entry_count", 0),
                "settled": False,
                "rows": [],
                "winner": meta.get("winner"),
            }
        cursor = db.weekly_picks.find(
            {"week_key": wk}, {"_id": 0, "email_hash": 1, "correct_count": 1, "submitted_at": 1},
        ).sort("correct_count", -1).limit(max(1, min(limit, 100)))
        rows = [doc async for doc in cursor]
        return {
            "week_key": wk,
            "entry_count": meta.get("entry_count", 0),
            "settled": True,
            "rows": rows,
            "winner": meta.get("winner"),
        }

    # ----- Admin endpoints -----

    @r.get("/admin/weekly/{week}")
    async def admin_get_week(week: str, _: bool = Depends(require_admin)) -> Dict[str, Any]:
        meta = await _ensure_meta(db, week)
        cursor = db.weekly_picks.find({"week_key": week}, {"_id": 0})
        entries = [doc async for doc in cursor]
        return {**meta, "entries": entries}

    @r.put("/admin/weekly/{week}/prize")
    async def admin_set_prize(
        week: str,
        data: PrizeUpdateIn,
        _: bool = Depends(require_admin),
    ) -> Dict[str, Any]:
        await _ensure_meta(db, week)
        update = {
            "prize_amount":   data.prize_amount,
            "prize_currency": data.prize_currency.upper(),
            "prize_label":    data.prize_label,
            "updated_at":     datetime.now(timezone.utc).isoformat(),
        }
        await db.weekly_meta.update_one({"_id": week}, {"$set": update})
        return await _ensure_meta(db, week)

    @r.post("/admin/weekly/{week}/lock")
    async def admin_lock(week: str, locked: bool = True, _: bool = Depends(require_admin)) -> Dict[str, Any]:
        await _ensure_meta(db, week)
        await db.weekly_meta.update_one(
            {"_id": week},
            {"$set": {"locked": locked, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return await _ensure_meta(db, week)

    @r.put("/admin/weekly/{week}/results")
    async def admin_set_results(
        week: str,
        data: ResultsUpdateIn,
        _: bool = Depends(require_admin),
    ) -> Dict[str, Any]:
        await _ensure_meta(db, week)
        await db.weekly_meta.update_one(
            {"_id": week},
            {"$set": {
                "results": [r.model_dump() for r in data.results],
                "locked":  True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        updated = await _settle_entries(db, week, data.results)
        return {"settled_entries": updated, **(await _ensure_meta(db, week))}

    @r.post("/admin/weekly/{week}/draw")
    async def admin_draw(week: str, _: bool = Depends(require_admin)) -> Dict[str, Any]:
        """Ticket-weighted random draw. Each entry gets `tickets` slots (1
        base + 1 per successful invite). Winner is picked from the highest
        correct_count cohort, weighted by tickets."""
        meta = await _ensure_meta(db, week)
        if not meta.get("results"):
            raise HTTPException(status_code=409, detail="Set results before drawing.")
        cursor = db.weekly_picks.find({"week_key": week}, {"_id": 0})
        entries = [doc async for doc in cursor]
        if not entries:
            raise HTTPException(status_code=409, detail="No entries to draw from.")
        top = max(entries, key=lambda e: e.get("correct_count", 0)).get("correct_count", 0)
        finalists = [e for e in entries if e.get("correct_count", 0) == top]
        # Build the weighted pool - repeat each finalist `tickets` times.
        pool = []
        for e in finalists:
            t = max(1, int(e.get("tickets") or 1))
            pool.extend([e] * t)
        # Raffle winner pick - `secrets.choice` so the draw is
        # cryptographically unbiased + not predictable from a seeded RNG.
        winner = secrets.choice(pool)
        winner_doc = {
            "email_hash":     winner["email_hash"],
            "correct_count":  top,
            "drawn_at":       datetime.now(timezone.utc).isoformat(),
            "finalist_count": len(finalists),
            "tickets":        int(winner.get("tickets") or 1),
            "pool_size":      len(pool),
        }
        await db.weekly_meta.update_one({"_id": week}, {"$set": {"winner": winner_doc}})
        return {"winner": winner_doc, "winner_email": winner["email"], "winner_handle": winner["handle"]}

    return r
