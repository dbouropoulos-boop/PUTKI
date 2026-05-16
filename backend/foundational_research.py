"""
Mittari Phase 3 V2 — Foundational research store.

A structured knowledge base that backs the editorial_seed_scheduler. Topic
generation reads from this collection (filtered by beat / content_type / freshness)
to surface relevance-current research that Claude then turns into Mittari-voice
editorial seeds.

Schema (Mongo collection: `foundational_research`):
    {
        "id":               str (uuid4),
        "topic_area":       str,                    # e.g. "Veikkaus sponsorship contracts"
        "beat":             str,                    # "regulatory" | "sponsorship" | "scene" | "money" | "culture" | "game_literacy" | "industry" | "international" | "lifestyle"
        "sub_beat":         str | None,             # narrower categorisation, e.g. "Liiga sponsorships"
        "editorial_angle":  str,                    # one-line angle for editor to riff on
        "key_facts":        [                       # structured fact objects
            {
                "fact":              str,
                "source_attribution":str,           # named source from source_map (key or display name)
                "verified_date":     str (ISO),
                "confidence":        "high"|"medium"|"low",
                "url":               str | None,
            },
            ...
        ],
        "named_sources_cited": [str, ...],          # source_map keys
        "applicable_content_types": [str, ...],     # content_engine.CONTENT_TYPES keys this powers
        "freshness_window_days": int,               # how long this remains useable (default 90)
        "active":             bool,
        "last_updated":       str (ISO),
        "created_at":         str (ISO),
        "created_by":         str,
    }

This module is data-only. Authoring happens via /back-office/foundational-research
or by dropping a JSON file at /app/backend/data/foundational_research_v02.json
(an idempotent loader picks it up at boot).
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


VALID_BEATS = {
    "regulatory",
    "sponsorship",
    "scene",
    "money",
    "culture",
    "game_literacy",
    "industry",
    "international",
    "lifestyle",
    "streamer",
}

VALID_CONFIDENCE = {"high", "medium", "low"}

# Map content_engine content types to the beat(s) they draw from.
CONTENT_TYPE_TO_BEATS: Dict[str, List[str]] = {
    "regulatory_update":              ["regulatory"],
    "sponsorship_update":             ["sponsorship", "regulatory"],
    "scene_news":                     ["scene", "lifestyle"],
    "industry_business_analysis":     ["industry", "regulatory", "sponsorship"],
    "money_commentary":               ["money"],
    "cultural_feature":               ["culture", "lifestyle"],
    "lifestyle_gambler_profile":      ["lifestyle", "culture"],
    "game_literacy":                  ["game_literacy"],
    "bonus_mathematics":              ["game_literacy"],
    "streamer_observation":           ["streamer", "scene"],
    "international_research_synthesis": ["international", "game_literacy"],
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalise_entry(entry: Dict[str, Any], *, created_by: str = "import") -> Dict[str, Any]:
    """Light validation + defaults — never raises, fills missing fields."""
    return {
        "id": entry.get("id") or str(uuid.uuid4()),
        "topic_area": (entry.get("topic_area") or "").strip(),
        "beat": entry.get("beat") if entry.get("beat") in VALID_BEATS else "scene",
        "sub_beat": entry.get("sub_beat"),
        "editorial_angle": (entry.get("editorial_angle") or "").strip(),
        "key_facts": [
            {
                "fact": (f.get("fact") or "").strip(),
                "source_attribution": (f.get("source_attribution") or "").strip(),
                "verified_date": f.get("verified_date") or _now_iso(),
                "confidence": f.get("confidence") if f.get("confidence") in VALID_CONFIDENCE else "medium",
                "url": f.get("url"),
            }
            for f in (entry.get("key_facts") or [])
            if (f.get("fact") or "").strip()
        ],
        "named_sources_cited": list(entry.get("named_sources_cited") or []),
        "applicable_content_types": list(entry.get("applicable_content_types") or []),
        "freshness_window_days": int(entry.get("freshness_window_days") or 90),
        "active": bool(entry.get("active", True)),
        "last_updated": entry.get("last_updated") or _now_iso(),
        "created_at": entry.get("created_at") or _now_iso(),
        "created_by": entry.get("created_by") or created_by,
    }


async def seed_from_file(db) -> Dict[str, Any]:
    """Idempotent loader: if `/app/backend/data/foundational_research_v02.json`
    (or the env-pointed file) exists, upsert its entries by `id`.

    The collection sits empty by design until the user delivers the v0.2 dataset.
    """
    path = os.environ.get(
        "FOUNDATIONAL_RESEARCH_FILE",
        str(Path(__file__).parent / "data" / "foundational_research_v02.json"),
    )
    p = Path(path)
    if not p.exists():
        return {"loaded": 0, "skipped": True, "reason": "file_not_found", "path": str(p)}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return {"loaded": 0, "skipped": True, "reason": f"parse_error: {e}", "path": str(p)}
    entries = raw if isinstance(raw, list) else raw.get("entries", [])
    loaded = 0
    for entry in entries:
        norm = _normalise_entry(entry, created_by="seed_from_file")
        existing = await db.foundational_research.find_one({"id": norm["id"]})
        if existing:
            continue
        await db.foundational_research.insert_one(norm)
        loaded += 1
    return {"loaded": loaded, "skipped": False, "path": str(p), "total_in_file": len(entries)}


async def list_entries(
    db,
    *,
    beat: Optional[str] = None,
    content_type: Optional[str] = None,
    active_only: bool = True,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if active_only:
        q["active"] = True
    if beat:
        q["beat"] = beat
    if content_type:
        beats = CONTENT_TYPE_TO_BEATS.get(content_type)
        if beats:
            q["beat"] = {"$in": beats}
    cur = db.foundational_research.find(q, {"_id": 0}).sort("last_updated", -1).limit(max(1, min(500, limit)))
    return await cur.to_list(length=limit)


async def get_entry(db, entry_id: str) -> Optional[Dict[str, Any]]:
    return await db.foundational_research.find_one({"id": entry_id}, {"_id": 0})


async def upsert_entry(db, entry: Dict[str, Any], *, updated_by: str = "admin") -> Dict[str, Any]:
    norm = _normalise_entry(entry, created_by=updated_by)
    norm["last_updated"] = _now_iso()
    existing = await db.foundational_research.find_one({"id": norm["id"]})
    if existing:
        norm["created_at"] = existing.get("created_at", norm["created_at"])
        norm["created_by"] = existing.get("created_by", norm["created_by"])
        await db.foundational_research.update_one({"id": norm["id"]}, {"$set": norm})
    else:
        await db.foundational_research.insert_one(norm)
    return await db.foundational_research.find_one({"id": norm["id"]}, {"_id": 0})


async def delete_entry(db, entry_id: str) -> bool:
    res = await db.foundational_research.delete_one({"id": entry_id})
    return res.deleted_count > 0


async def stats(db) -> Dict[str, Any]:
    total = await db.foundational_research.count_documents({})
    active = await db.foundational_research.count_documents({"active": True})
    by_beat: Dict[str, int] = {}
    for beat in VALID_BEATS:
        by_beat[beat] = await db.foundational_research.count_documents({"beat": beat, "active": True})
    return {"total": total, "active": active, "by_beat": by_beat}
