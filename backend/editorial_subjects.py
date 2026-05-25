"""
PUTKI HQ - Phase 4 Week 2 editorial subjects store
==================================================

Loads the master subject dataset (`foundational_research_v02.json` containing
~305 entries across `streamers`, `athletes`, `operators`, `games`,
`regulatory`, `cultural`, `liiga_teams`) into the `editorial_subjects`
MongoDB collection.

This is intentionally separate from the existing `foundational_research`
collection - that one is a *cadence-driven* research store keyed by beat /
content_type; this one is a *subject knowledge base* keyed by `subject_id`,
which the ContentGenerator (Week 2) looks up when fetching bio/context for
LLM prompts.

Schema per document:
  {
    "subject_id":   str,             # e.g. "creator_lyijyleka"
    "subject_type": str,             # streamer / athlete / operator / ...
    "name":         str,
    "category":     str,             # free-form, dataset-defined
    "key_facts":    dict,            # flat key→value bag from the dataset
    "tags":         list[str],       # derived for indexing
    "source_path":  str,             # which top-level array the row came from
    "last_updated": ISO date
  }
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


SUBJECT_CATEGORIES = (
    "streamers", "athletes", "operators", "games",
    "regulatory", "cultural", "liiga_teams",
)


def _normalize(entry: Dict[str, Any], source_path: str) -> Optional[Dict[str, Any]]:
    sid = entry.get("subject_id") or entry.get("id")
    name = entry.get("name") or entry.get("title")
    if not sid or not name:
        return None
    return {
        "subject_id": str(sid),
        "subject_type": str(entry.get("subject_type") or source_path[:-1]),  # streamers→streamer
        "name": str(name),
        "category": str(entry.get("category") or source_path),
        "key_facts": dict(entry.get("key_facts") or {}),
        "tags": list(entry.get("tags") or []),
        "source_path": source_path,
        "last_updated": entry.get("last_updated") or datetime.now(timezone.utc).isoformat(),
    }


async def ensure_indexes(db) -> None:
    coll = db.editorial_subjects
    try:
        await coll.create_index("subject_id", unique=True)
        await coll.create_index("subject_type")
        await coll.create_index("category")
        await coll.create_index([("name", "text")])
    except Exception:
        logger.exception("Failed to ensure editorial_subjects indexes")


async def seed_from_file(db) -> Dict[str, Any]:
    """Idempotent loader. Reads the configured JSON dataset and upserts each
    subject by `subject_id`. Existing docs are updated in place so editorial
    can re-issue the file with corrections without admin manual cleanup."""
    path = os.environ.get(
        "EDITORIAL_SUBJECTS_FILE",
        str(Path(__file__).parent / "data" / "foundational_research_v02.json"),
    )
    p = Path(path)
    if not p.exists():
        return {"loaded": 0, "skipped": True, "reason": "file_not_found", "path": str(p)}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        return {"loaded": 0, "skipped": True, "reason": f"parse_error: {e}", "path": str(p)}

    await ensure_indexes(db)
    loaded = updated = 0
    by_type: Dict[str, int] = {}

    for category_key in SUBJECT_CATEGORIES:
        rows = raw.get(category_key) or []
        if not isinstance(rows, list):
            continue
        for entry in rows:
            norm = _normalize(entry, source_path=category_key)
            if not norm:
                continue
            existing = await db.editorial_subjects.find_one({"subject_id": norm["subject_id"]})
            if existing:
                await db.editorial_subjects.update_one(
                    {"subject_id": norm["subject_id"]},
                    {"$set": norm},
                )
                updated += 1
            else:
                await db.editorial_subjects.insert_one(dict(norm))
                loaded += 1
            by_type[norm["subject_type"]] = by_type.get(norm["subject_type"], 0) + 1

    return {
        "loaded": loaded,
        "updated": updated,
        "by_type": by_type,
        "path": str(p),
        "meta": raw.get("_meta", {}),
    }


async def get_subject(db, subject_id: str) -> Optional[Dict[str, Any]]:
    return await db.editorial_subjects.find_one({"subject_id": subject_id}, {"_id": 0})


async def find_by_name(db, name: str, *, subject_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    q: Dict[str, Any] = {"name": {"$regex": f"^{name}$", "$options": "i"}}
    if subject_type:
        q["subject_type"] = subject_type
    return await db.editorial_subjects.find_one(q, {"_id": 0})


async def list_subjects(
    db,
    *,
    subject_type: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if subject_type:
        q["subject_type"] = subject_type
    if category:
        q["category"] = category
    cur = db.editorial_subjects.find(q, {"_id": 0}).sort("name", 1).limit(max(1, min(500, limit)))
    return await cur.to_list(length=limit)


async def stats(db) -> Dict[str, Any]:
    total = await db.editorial_subjects.count_documents({})
    by_type_pipeline = [{"$group": {"_id": "$subject_type", "count": {"$sum": 1}}}]
    by_type_rows = await db.editorial_subjects.aggregate(by_type_pipeline).to_list(length=50)
    return {
        "total": total,
        "by_subject_type": {row["_id"]: row["count"] for row in by_type_rows},
    }
