"""
PUTKI HQ Phase 3 V2 - Editorial seed scheduler.

A cadence-driven worker that emits editorial seeds into the approval queue at
defined rhythms per content type. Seeds are NOT auto-generated content - they
are scheduled prompts that the topic_generator turns into a real Claude call,
producing 3 variants per the editorial pipeline. The system produces; the
editor judges.

Architecture per V2 brief:
    scheduler tick (hourly)
        → for each cadence row that is due
            → fact-mine foundational_research (filtered by beat / content_type)
            → topic_generator builds the topic prompt
            → content_engine.generate_content_for_signal() fires Claude
            → row lands in generated_content with status="queued"
        → if foundational_research is empty for a beat, skip silently (don't
           fabricate. Architecture sits ready until the dataset is populated.)

LLM-502 tolerance:
    Variant generation is wrapped. If the gateway returns an error, the
    scheduler still writes a `seed_attempt` row (status="awaiting_variants")
    with the topic prompt frozen. A separate _seed_variant_filler retries
    these every 15 minutes.

Environment:
    SEED_SCHEDULER_INTERVAL_SECONDS  default 3600 (1h)
    SEED_VARIANT_FILLER_INTERVAL_SECONDS  default 900 (15m)
    PUTKI_HQ_DISABLE_SCHEDULER  set to "1" to disable in tests
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from content_engine import (
    CONTENT_TYPES,
    distribute_content,
    generate_content_for_signal,
)
from foundational_research import (
    CONTENT_TYPE_TO_BEATS,
    list_entries as list_research_entries,
)
from source_map import TRACKED_SOURCES


logger = logging.getLogger(__name__)


SCHEDULER_INTERVAL_SECONDS = int(os.environ.get("SEED_SCHEDULER_INTERVAL_SECONDS", "3600"))
VARIANT_FILLER_INTERVAL_SECONDS = int(os.environ.get("SEED_VARIANT_FILLER_INTERVAL_SECONDS", "900"))


# ─── Cadence config - V2 §editorial-cadence ────────────────────────────────
# Schedule keys map to RRULE-lite semantics. The scheduler fires for a given
# content_type when:
#   weekday matches AND no seed of that content_type has been emitted since
#   `min_gap_hours` ago (idempotency guard - restart-safe).
#
# All cadences are configurable from /api/admin/scheduler/cadences via PUT,
# so the user can re-tune without code changes.
DEFAULT_CADENCES: List[Dict[str, Any]] = [
    {
        "content_type": "regulatory_update",
        "weekdays": [0],          # Monday
        "frequency": "weekly",
        "min_gap_hours": 144,     # 6d safety
        "surface_label": "/saantely",
        "enabled": True,
    },
    {
        "content_type": "sponsorship_update",
        "weekdays": [2],          # Wednesday
        "frequency": "weekly",
        "min_gap_hours": 144,
        "surface_label": "/sponsoroinnit",
        "enabled": True,
    },
    {
        "content_type": "lifestyle_gambler_profile",
        "weekdays": [4],          # Friday
        "frequency": "biweekly",  # every 2nd Friday - enforced via min_gap_hours
        "min_gap_hours": 312,     # 13d
        "surface_label": "/profiilit",
        "enabled": True,
    },
    {
        "content_type": "scene_news",
        "weekdays": [0, 2, 4],    # Mon, Wed, Fri
        "frequency": "weekly_3x",
        "min_gap_hours": 36,
        "surface_label": "/skene",
        "enabled": True,
    },
    {
        "content_type": "industry_business_analysis",
        "weekdays": [3],          # Thursday
        "frequency": "weekly",
        "min_gap_hours": 144,
        "surface_label": "/skene/talous",
        "enabled": True,
    },
    {
        "content_type": "streamer_observation",
        "weekdays": [1, 4],       # Tuesday, Friday
        "frequency": "weekly_2x",
        "min_gap_hours": 60,
        "surface_label": "/striimaajat",
        "enabled": True,
    },
    {
        "content_type": "money_commentary",
        "weekdays": [1],          # Tuesday
        "frequency": "weekly",
        "min_gap_hours": 144,
        "surface_label": "/raha",
        "enabled": True,
    },
    {
        "content_type": "game_literacy",
        "weekdays": [5],          # Saturday
        "frequency": "weekly",
        "min_gap_hours": 144,
        "surface_label": "/pelit",
        # Sub-page rotates per fire - handled by topic_generator
        "enabled": True,
    },
    {
        "content_type": "cultural_feature",
        "weekdays": [4],          # Friday (every 2nd)
        "frequency": "biweekly",
        "min_gap_hours": 312,
        "surface_label": "/kulttuuri",
        "enabled": True,
    },
    {
        "content_type": "bonus_mathematics",
        "weekdays": [5],          # Saturday (monthly)
        "frequency": "monthly",
        "min_gap_hours": 672,     # 28d
        "surface_label": "/pelit/bonusmatematiikka",
        "enabled": True,
    },
    {
        "content_type": "international_research_synthesis",
        "weekdays": [3],          # Thursday (monthly)
        "frequency": "monthly",
        "min_gap_hours": 672,
        "surface_label": "/pelit",
        "enabled": True,
    },
]


CADENCE_SETTINGS_KEY = "editorial_cadences"


async def seed_default_cadences(db) -> None:
    existing = await db.settings.find_one({"_id": CADENCE_SETTINGS_KEY})
    if existing and existing.get("cadences"):
        return
    await db.settings.update_one(
        {"_id": CADENCE_SETTINGS_KEY},
        {"$set": {
            "cadences": DEFAULT_CADENCES,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": "seed",
        }},
        upsert=True,
    )


async def get_cadences(db) -> List[Dict[str, Any]]:
    doc = await db.settings.find_one({"_id": CADENCE_SETTINGS_KEY}, {"_id": 0})
    if doc and doc.get("cadences"):
        return doc["cadences"]
    return DEFAULT_CADENCES


async def set_cadences(db, cadences: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    await db.settings.update_one(
        {"_id": CADENCE_SETTINGS_KEY},
        {"$set": {
            "cadences": cadences,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": "admin",
        }},
        upsert=True,
    )
    return cadences


# ─── Topic generator ────────────────────────────────────────────────────────
def _pick_sources_for_beat(beat: str, max_n: int = 5) -> List[Dict[str, Any]]:
    """Return tier-sorted named sources whose category aligns with the beat."""
    beat_to_categories = {
        "regulatory":    ["regulatory"],
        "sponsorship":   ["regulatory", "sports_media"],
        "scene":         ["streamer_data", "sports_media", "culture", "betting_discourse"],
        "money":         ["regulatory", "sports_media"],
        "culture":       ["culture", "sports_media"],
        "industry":      ["regulatory", "operator_signal", "sports_media"],
        "streamer":      ["streamer_data", "betting_discourse"],
        "game_literacy": [],
        "international": [],
        "lifestyle":     ["culture", "streamer_data", "sports_media"],
    }
    cats = beat_to_categories.get(beat, [])
    if not cats:
        return []
    matched = [s for s in TRACKED_SOURCES if s["category"] in cats]
    matched.sort(key=lambda s: s.get("tier", 9))
    return matched[:max_n]


def _rotating_game_literacy_subpage() -> str:
    """game_literacy rotates through /blackjack /poker /slotit /craps /ruletti /live."""
    pages = ["blackjack", "poker", "slotit", "craps", "ruletti", "live"]
    week = datetime.now(timezone.utc).isocalendar().week
    return pages[week % len(pages)]


async def build_topic_payload(
    db, *, content_type: str, cadence: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Resolve the next topic for a content type by surfacing foundational
    research entries + their named sources. Returns the signal_payload that
    feeds content_engine.generate_content_for_signal(), OR None when the
    foundational_research collection is empty for this content type's beats."""
    research_pool = await list_research_entries(db, content_type=content_type, active_only=True, limit=50)
    if not research_pool:
        return None

    # Cheapest "freshest + least-recently-used" heuristic - shuffle within
    # last_updated descending, but bias against entries used in last 30d.
    cutoff_recent = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    used_recently = set()
    async for row in db.generated_content.find(
        {"source_signal_type": "scheduled_seed", "generated_at": {"$gte": cutoff_recent}},
        {"_id": 0, "signal_payload.research_id": 1},
    ):
        rid = (row.get("signal_payload") or {}).get("research_id")
        if rid:
            used_recently.add(rid)
    candidates = [r for r in research_pool if r["id"] not in used_recently] or research_pool
    chosen = random.choice(candidates)

    sources = _pick_sources_for_beat(chosen["beat"], max_n=5)
    facts_text = "\n".join(
        f"- {f['fact']} ({f.get('source_attribution', '-')}, {f.get('confidence', 'medium')})"
        for f in chosen.get("key_facts", [])
    ) or "-"
    sources_text = ", ".join(s["name"] for s in sources) or "-"

    # Build a per-content-type signal_payload aligned with prompt placeholders.
    payload: Dict[str, Any] = {
        "research_id": chosen["id"],
        "topic": chosen.get("topic_area", ""),
        "angle": chosen.get("editorial_angle", ""),
        "research_notes": facts_text,
        "named_sources": sources_text,
        "beat": chosen.get("beat"),
        "sub_beat": chosen.get("sub_beat"),
        "context": chosen.get("editorial_angle", ""),
        "source_notes": facts_text,
        "source_materials": facts_text,
        "data_points": facts_text,
        "source_url": (sources[0]["url"] if sources else ""),
        "finnish_angle": chosen.get("editorial_angle", ""),
        "focus_area": chosen.get("sub_beat") or chosen.get("topic_area", ""),
        "regulatory_event": chosen.get("topic_area", ""),
        "impact_summary": chosen.get("editorial_angle", ""),
        "deal_summary": chosen.get("topic_area", ""),
        "parties": ", ".join(chosen.get("named_sources_cited", []) or []) or "-",
        "value": "-",
        "operator": "-",
        "bonus_type": "-",
        "mechanics": facts_text,
        "subject_name": chosen.get("topic_area", ""),
        "background": chosen.get("editorial_angle", ""),
        "business_structure": "-",
        "cultural_significance": chosen.get("editorial_angle", ""),
        "event_summary": chosen.get("topic_area", ""),
        "scheduled_surface_label": cadence.get("surface_label"),
    }
    if content_type == "game_literacy":
        payload["focus_area"] = _rotating_game_literacy_subpage()
        payload["scheduled_surface_label"] = f"/pelit/{payload['focus_area']}"
    return payload


# ─── Cadence due check ──────────────────────────────────────────────────────
async def _is_cadence_due(db, cadence: Dict[str, Any], *, now: datetime) -> bool:
    if not cadence.get("enabled", True):
        return False
    weekdays = cadence.get("weekdays") or []
    if weekdays and now.weekday() not in weekdays:
        return False
    min_gap_hours = int(cadence.get("min_gap_hours", 24))
    threshold = (now - timedelta(hours=min_gap_hours)).isoformat()
    recent = await db.generated_content.find_one({
        "content_type": cadence["content_type"],
        "source_signal_type": "scheduled_seed",
        "generated_at": {"$gte": threshold},
    })
    return recent is None


# ─── Main scheduler tick ────────────────────────────────────────────────────
async def run_scheduler_tick(db, *, force_content_type: Optional[str] = None) -> Dict[str, Any]:
    """One pass of the scheduler. Returns a summary of what fired / what was
    skipped (and why). Idempotent - safe to call repeatedly."""
    now = datetime.now(timezone.utc)
    cadences = await get_cadences(db)
    fired: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []

    for cad in cadences:
        ct = cad.get("content_type")
        if ct not in CONTENT_TYPES:
            skipped.append({"content_type": ct, "reason": "unknown_content_type"})
            continue
        if force_content_type and ct != force_content_type:
            continue
        if not force_content_type and not await _is_cadence_due(db, cad, now=now):
            skipped.append({"content_type": ct, "reason": "not_due"})
            continue
        payload = await build_topic_payload(db, content_type=ct, cadence=cad)
        if not payload:
            skipped.append({"content_type": ct, "reason": "no_foundational_research"})
            continue

        attempt = await _attempt_seed(db, content_type=ct, cadence=cad, payload=payload)
        fired.append(attempt)

    return {"fired": fired, "skipped": skipped, "ran_at": now.isoformat()}


async def _attempt_seed(
    db, *, content_type: str, cadence: Dict[str, Any], payload: Dict[str, Any]
) -> Dict[str, Any]:
    """Call Claude. On LLM error, write an `awaiting_variants` stub so the
    filler can retry. On success, the real generated_content row was already
    written by generate_content_for_signal()."""
    try:
        doc = await generate_content_for_signal(
            db,
            content_type=content_type,
            signal_payload=payload,
            source_signal_type="scheduled_seed",
            source_signal_id=payload.get("research_id"),
        )
        return {
            "content_type": content_type,
            "status": "generated",
            "generated_content_id": doc.get("id"),
            "research_id": payload.get("research_id"),
        }
    except Exception as e:
        # LLM gateway flake (e.g. 502). Park the seed as awaiting_variants so
        # the filler can retry without losing topic context.
        stub_id = str(uuid.uuid4())
        cfg = CONTENT_TYPES[content_type]
        await db.generated_content.insert_one({
            "id": stub_id,
            "content_type": content_type,
            "source_signal_type": "scheduled_seed",
            "source_signal_id": payload.get("research_id"),
            "signal_payload": payload,
            "generated_text": "",
            "generated_variants": [],
            "selected_variant_index": 0,
            "proposed_publication_surface": cfg["target_surface"],
            "proposed_streamer_id": None,
            "proposed_operator_id": None,
            "status": "awaiting_variants",
            "approval_action": None,
            "edited_text": None,
            "reviewed_by": None,
            "reviewed_at": None,
            "published_at": None,
            "distribution_targets": cfg["distribution"],
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "last_attempt_at": datetime.now(timezone.utc).isoformat(),
            "attempt_count": 1,
            "last_error": str(e)[:500],
        })
        logger.warning("Seed %s parked as awaiting_variants: %s", content_type, e)
        return {
            "content_type": content_type,
            "status": "awaiting_variants",
            "generated_content_id": stub_id,
            "research_id": payload.get("research_id"),
            "error": str(e)[:200],
        }


# ─── Variant filler - retries awaiting_variants rows ────────────────────────
async def run_variant_filler(db, *, max_per_tick: int = 5) -> Dict[str, Any]:
    """Retry seeds that parked without variants. LLM-502 tolerant."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    cur = db.generated_content.find(
        {"status": "awaiting_variants", "last_attempt_at": {"$lte": cutoff}},
        {"_id": 0},
    ).sort("last_attempt_at", 1).limit(max(1, min(20, max_per_tick)))
    rows = await cur.to_list(length=max_per_tick)
    results: List[Dict[str, Any]] = []
    for row in rows:
        try:
            # Re-fire generation; a fresh row gets written. Mark the stub as
            # superseded so it disappears from the queue UI.
            doc = await generate_content_for_signal(
                db,
                content_type=row["content_type"],
                signal_payload=row.get("signal_payload") or {},
                source_signal_type="scheduled_seed",
                source_signal_id=(row.get("signal_payload") or {}).get("research_id"),
            )
            await db.generated_content.update_one(
                {"id": row["id"]},
                {"$set": {
                    "status": "superseded",
                    "superseded_by": doc.get("id"),
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            results.append({"id": row["id"], "status": "filled", "new_id": doc.get("id")})
        except Exception as e:
            await db.generated_content.update_one(
                {"id": row["id"]},
                {"$set": {
                    "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                    "last_error": str(e)[:500],
                },
                 "$inc": {"attempt_count": 1}},
            )
            results.append({"id": row["id"], "status": "retry_failed", "error": str(e)[:200]})
    return {"checked": len(rows), "results": results}


# ─── Background workers ─────────────────────────────────────────────────────
async def scheduler_worker_loop(db) -> None:
    """Hourly: tick scheduler. Disabled by PUTKI_HQ_DISABLE_SCHEDULER=1."""
    await asyncio.sleep(10)
    while True:
        try:
            await run_scheduler_tick(db)
        except Exception:
            logger.exception("scheduler tick failed")
        await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)


async def variant_filler_worker_loop(db) -> None:
    await asyncio.sleep(20)
    while True:
        try:
            await run_variant_filler(db)
        except Exception:
            logger.exception("variant filler tick failed")
        await asyncio.sleep(VARIANT_FILLER_INTERVAL_SECONDS)


# ─── Schedule status (for back-office UI) ──────────────────────────────────
async def schedule_status(db) -> Dict[str, Any]:
    """Per-content-type: when did it last fire, what is the gap, is it due/overdue."""
    cadences = await get_cadences(db)
    out: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    for cad in cadences:
        ct = cad["content_type"]
        last = await db.generated_content.find_one(
            {"content_type": ct, "source_signal_type": "scheduled_seed"},
            {"_id": 0, "generated_at": 1, "status": 1, "id": 1},
            sort=[("generated_at", -1)],
        )
        last_at = last.get("generated_at") if last else None
        is_due = await _is_cadence_due(db, cad, now=now)
        out.append({
            **cad,
            "last_seeded_at": last_at,
            "last_status": last.get("status") if last else None,
            "is_due_now": is_due,
            "weekday_today": now.weekday(),
        })
    # research availability per content type
    avail: Dict[str, int] = {}
    for ct in {c["content_type"] for c in cadences}:
        rows = await list_research_entries(db, content_type=ct, active_only=True, limit=200)
        avail[ct] = len(rows)
    return {
        "cadences": out,
        "research_available": avail,
        "checked_at": now.isoformat(),
        "scheduler_interval_seconds": SCHEDULER_INTERVAL_SECONDS,
        "variant_filler_interval_seconds": VARIANT_FILLER_INTERVAL_SECONDS,
    }
