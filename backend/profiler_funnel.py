"""
PUTKI HQ - Profiler Funnel Analytics (iter64).

Lightweight funnel telemetry for the /peliareena behavioral profiler.
Captures one event per beat so we can answer:

    start_rate    →  /api/profiler/event  type=session_start
    complete_rate →  /api/profiler/event  type=session_complete
    reveal_view   →  /api/profiler/event  type=reveal_view
    gate_view     →  /api/profiler/event  type=gate_view
    gate_submit   →  /api/profiler/event  type=gate_submit_attempt | gate_unlocked
    share_click   →  /api/profiler/event  type=share_click
    tg_click      →  /api/profiler/event  type=tg_click

All event docs share a single `profiler_events` MongoDB collection with
a 30-day TTL. No PII - just session_id, event type, optional small meta
dict (e.g. picked_option, profile_key).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

VALID_EVENTS = {
    "session_start", "scenario_view", "scenario_pick",
    "session_complete", "reveal_view",
    "gate_view", "gate_submit_attempt", "gate_unlocked",
    "share_click", "tg_click",
}

EVENT_TTL_DAYS = 30


async def ensure_funnel_indexes(db) -> None:
    try:
        await db.profiler_events.create_index("session_id")
        await db.profiler_events.create_index("event")
        await db.profiler_events.create_index("ts")
        await db.profiler_events.create_index(
            "expires_at", expireAfterSeconds=0,
        )
    except Exception:
        pass


async def record_event(
    db, *, event: str, session_id: str,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if event not in VALID_EVENTS:
        return {"error": "invalid_event"}
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "event": event,
        "meta": meta or {},
        "ts": now.isoformat(),
        "expires_at": now + timedelta(days=EVENT_TTL_DAYS),
    }
    await db.profiler_events.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


async def funnel_summary(
    db, *, since_days: int = 7,
) -> Dict[str, Any]:
    """Aggregate counts per event type for the back-office widget."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
    pipeline = [
        {"$match": {"ts": {"$gte": cutoff}}},
        {"$group": {"_id": "$event", "n": {"$sum": 1}}},
    ]
    rows = await db.profiler_events.aggregate(pipeline).to_list(length=50)
    counts = {r["_id"]: int(r["n"]) for r in rows}
    # Funnel steps in order - every step downstream is a subset of the
    # one above it; rates are computed against `session_start`.
    starts = counts.get("session_start", 0) or 0
    completes = counts.get("session_complete", 0) or 0
    reveals = counts.get("reveal_view", 0) or 0
    gate_views = counts.get("gate_view", 0) or 0
    gate_submits = counts.get("gate_submit_attempt", 0) or 0
    gate_unlocked = counts.get("gate_unlocked", 0) or 0
    shares = counts.get("share_click", 0) or 0
    tg = counts.get("tg_click", 0) or 0

    def _pct(n: int, d: int) -> float:
        return round((n / d * 100.0), 1) if d > 0 else 0.0

    return {
        "since_days": since_days,
        "counts": {
            "session_start": starts,
            "session_complete": completes,
            "reveal_view": reveals,
            "gate_view": gate_views,
            "gate_submit_attempt": gate_submits,
            "gate_unlocked": gate_unlocked,
            "share_click": shares,
            "tg_click": tg,
        },
        "rates": {
            "completion_rate": _pct(completes, starts),
            "reveal_view_rate": _pct(reveals, completes),
            "gate_view_rate": _pct(gate_views, reveals),
            "gate_submit_rate": _pct(gate_submits, gate_views),
            "gate_unlock_rate": _pct(gate_unlocked, gate_submits),
            "end_to_end_rate": _pct(gate_unlocked, starts),
            "share_rate": _pct(shares, gate_unlocked),
            "tg_rate": _pct(tg, gate_unlocked),
        },
    }
