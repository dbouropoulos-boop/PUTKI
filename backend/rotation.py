"""
PUTKI HQ Phase 3 V2 — Voyager rotation calendar (Step 3 folded into Step 1 surface).

Stores one row per ISO week per market for the rotating-operator Voyager mechanic.
Per FINAL ARCHITECTURE §5: each ISO week, one partnered operator becomes the
featured Voyager partner. This module is the source of truth for which operator
that is, what the week's theme is, what prize structure applies, and which
Smartico template renders the mini-game.

Constraint per FINAL ARCHITECTURE §5.1: only `operators.partner == True` rows
can be assigned to a Voyager week. Enforced at write time.

Schema (Mongo collection: `voyager_weeks`):
    {
        "id":                       str (uuid4),
        "iso_week":                 str  "YYYY-Www"  (e.g. "2026-W21"),
        "market_id":                str  default "FI",
        "partner_operator_slug":    str | None,           # FK to operators.slug
        "theme":                    str,                  # "Imatra Rally", "Lapin Bingo"...
        "prize_summary":            str,
        "smartico_template_id":     str | None,
        "notes":                    str | None,
        "status":                   "planned"|"live"|"archived",
        "created_at":               iso str,
        "updated_at":               iso str,
        "updated_by":               str,
    }

Indexing: unique (iso_week, market_id) at the application layer (enforced via
`upsert_week` which keys on that pair).
"""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


DEFAULT_MARKET_ID = "FI"
ISO_WEEK_RE = re.compile(r"^\d{4}-W\d{2}$")
VALID_STATUS = {"planned", "live", "archived"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_iso_week() -> str:
    today = date.today()
    iso = today.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def next_iso_weeks(n: int = 12) -> List[str]:
    """Returns `n` upcoming ISO week strings, starting from this week."""
    today = date.today()
    out: List[str] = []
    for i in range(n):
        d = today + timedelta(weeks=i)
        iso = d.isocalendar()
        out.append(f"{iso.year}-W{iso.week:02d}")
    return out


def _validate_iso_week(value: str) -> str:
    if not ISO_WEEK_RE.match(value or ""):
        raise ValueError(f"Invalid iso_week format '{value}' — expected 'YYYY-Www'")
    return value


def _normalise(data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "iso_week": _validate_iso_week(data.get("iso_week")),
        "market_id": data.get("market_id") or DEFAULT_MARKET_ID,
        "partner_operator_slug": (data.get("partner_operator_slug") or "").strip() or None,
        "theme": (data.get("theme") or "").strip(),
        "prize_summary": (data.get("prize_summary") or "").strip(),
        "smartico_template_id": (data.get("smartico_template_id") or "").strip() or None,
        "notes": (data.get("notes") or "").strip() or None,
        "status": data.get("status") if data.get("status") in VALID_STATUS else "planned",
    }


async def _validate_partner(db, slug: Optional[str]) -> None:
    """Enforce: only operators with partner=True can be assigned to a week."""
    if not slug:
        return
    op = await db.operators.find_one({"slug": slug}, {"_id": 0, "partner": 1, "slug": 1})
    if not op:
        raise ValueError(f"Operator '{slug}' not found")
    if not op.get("partner"):
        raise ValueError(f"Operator '{slug}' is not flagged partner=True — cannot assign to a Voyager week")


async def upsert_week(db, data: Dict[str, Any], *, updated_by: str = "admin") -> Dict[str, Any]:
    norm = _normalise(data)
    await _validate_partner(db, norm["partner_operator_slug"])
    key = {"iso_week": norm["iso_week"], "market_id": norm["market_id"]}
    existing = await db.voyager_weeks.find_one(key)
    if existing:
        norm["updated_at"] = _now_iso()
        norm["updated_by"] = updated_by
        await db.voyager_weeks.update_one(key, {"$set": norm})
    else:
        norm.update({
            "id": str(uuid.uuid4()),
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "updated_by": updated_by,
        })
        await db.voyager_weeks.insert_one(norm)
    return await db.voyager_weeks.find_one(key, {"_id": 0})


async def list_weeks(
    db,
    *,
    market_id: Optional[str] = None,
    upcoming_only: bool = False,
    past_only: bool = False,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if market_id:
        q["market_id"] = market_id
    if upcoming_only:
        q["iso_week"] = {"$gte": current_iso_week()}
    elif past_only:
        q["iso_week"] = {"$lt": current_iso_week()}
    cur = db.voyager_weeks.find(q, {"_id": 0}).sort("iso_week", 1).limit(max(1, min(500, limit)))
    return await cur.to_list(length=limit)


async def get_week(db, iso_week: str, market_id: str = DEFAULT_MARKET_ID) -> Optional[Dict[str, Any]]:
    _validate_iso_week(iso_week)
    return await db.voyager_weeks.find_one(
        {"iso_week": iso_week, "market_id": market_id},
        {"_id": 0},
    )


async def get_current_week(db, market_id: str = DEFAULT_MARKET_ID) -> Optional[Dict[str, Any]]:
    return await get_week(db, current_iso_week(), market_id)


async def delete_week(db, iso_week: str, market_id: str = DEFAULT_MARKET_ID) -> bool:
    _validate_iso_week(iso_week)
    r = await db.voyager_weeks.delete_one({"iso_week": iso_week, "market_id": market_id})
    return r.deleted_count > 0


async def stats(db, market_id: str = DEFAULT_MARKET_ID) -> Dict[str, Any]:
    total = await db.voyager_weeks.count_documents({"market_id": market_id})
    planned = await db.voyager_weeks.count_documents({"market_id": market_id, "status": "planned"})
    live = await db.voyager_weeks.count_documents({"market_id": market_id, "status": "live"})
    archived = await db.voyager_weeks.count_documents({"market_id": market_id, "status": "archived"})
    return {"total": total, "planned": planned, "live": live, "archived": archived}
