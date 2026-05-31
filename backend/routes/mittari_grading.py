"""
iter89 · Phase 4 wave 4 — Mittari outcome-grading operator job.

Architecture
============
Mittari signals are computed live from `odds_api.get_featured_picks()`
(real bookmaker odds via The Odds API). There is no historical store
in the database by default — the cache is in-process and rotates
every 15 min.

To populate `mittari_signal_outcomes` (which powers the rolling 90-day
back-test on `/trust/mittari-tarkkuus`), we need two things:

  1. SNAPSHOT — capture each day's live picks into a durable Mongo
     collection (`mittari_signal_history`) at run time so we can grade
     them later. Idempotent per (signal_id + utc-date).

  2. GRADE   — once an event has concluded, an operator marks each
     snapshotted signal hit / miss / push. The grader writes one row
     per graded signal into `mittari_signal_outcomes` so the public
     back-test page can read it.

Public endpoints (all admin-gated via X-Admin-Token):

  POST /api/admin/mittari/grading/snapshot
       Snapshot today's live picks. Returns {written, skipped, total}.
       Idempotent — re-running on the same UTC day no-ops the duplicates.

  GET  /api/admin/mittari/grading/pending
       Return all snapshotted signals where commence_time is in the
       past AND no outcome has been recorded yet.

  POST /api/admin/mittari/grading/grade
       Body: {grades: [{signal_id, outcome, note?}]}
       outcome ∈ {hit, miss, push}.
       Writes one row per grade to `mittari_signal_outcomes`. Idempotent
       on signal_id (re-grading updates the existing row).

  GET  /api/admin/mittari/grading/status
       Aggregated counters: snapshotted_total, graded_total, ungraded_count,
       window_n_90d, last_graded_at.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException

VALID_OUTCOMES = {"hit", "miss", "push"}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _signal_class(pick: Dict[str, Any]) -> str:
    """Coarse classification used by the back-test bucketing.

    We expose 3 classes that map cleanly onto the public dial:
      - "sports.football"  → soccer + football
      - "sports.hockey"    → ice hockey
      - "sports.other"     → anything else (basketball, formula1, …)
    """
    sport = (pick.get("sport_key") or "").lower()
    if "soccer" in sport or "football" in sport:
        return "sports.football"
    if "icehockey" in sport or "hockey" in sport:
        return "sports.hockey"
    return "sports.other"


def build_mittari_grading_router(require_admin: Callable, db) -> APIRouter:
    router = APIRouter(prefix="/admin/mittari/grading", tags=["mittari-grading"])

    # ── SNAPSHOT ─────────────────────────────────────────────────────
    @router.post("/snapshot")
    async def snapshot_today(_: bool = Depends(require_admin)) -> Dict[str, Any]:
        # Late import — odds_api hits an external API; we keep that
        # off the import chain of the router module itself.
        from odds_api import get_featured_picks

        try:
            payload = await get_featured_picks()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=503, detail=f"odds_api_unavailable: {exc}") from exc

        picks = payload.get("all_picks") or payload.get("picks") or []
        if not isinstance(picks, list):
            picks = []

        today_iso = datetime.now(timezone.utc).date().isoformat()
        written = 0
        skipped = 0
        for p in picks:
            sid = p.get("signal_id") or p.get("event_id") or p.get("id")
            if not sid:
                skipped += 1
                continue
            doc = {
                "signal_id": str(sid),
                "snapshot_date": today_iso,
                "snapshot_at": _utcnow_iso(),
                "commence_time": p.get("commence_time"),
                "sport_key": p.get("sport_key"),
                "signal_class": _signal_class(p),
                "pick_name": (p.get("pick") or {}).get("name") if isinstance(p.get("pick"), dict) else p.get("pick_name"),
                "pick_price": (p.get("pick") or {}).get("price") if isinstance(p.get("pick"), dict) else p.get("pick_price"),
                "home_team": p.get("home_team"),
                "away_team": p.get("away_team"),
            }
            res = await db.mittari_signal_history.update_one(
                {"signal_id": doc["signal_id"], "snapshot_date": today_iso},
                {"$setOnInsert": doc},
                upsert=True,
            )
            if res.upserted_id is not None:
                written += 1
            else:
                skipped += 1

        return {
            "written": written,
            "skipped": skipped,
            "total_picks_in_payload": len(picks),
            "snapshot_date": today_iso,
            "computed_at": _utcnow_iso(),
        }

    # ── PENDING ──────────────────────────────────────────────────────
    @router.get("/pending")
    async def list_pending(
        limit: int = 100,
        _: bool = Depends(require_admin),
    ) -> Dict[str, Any]:
        limit = max(1, min(int(limit or 100), 500))
        now_iso = _utcnow_iso()

        # Signals whose commence_time has passed AND have no outcome row.
        cursor = db.mittari_signal_history.find(
            {"commence_time": {"$lt": now_iso}},
            {"_id": 0},
        ).sort([("commence_time", -1)]).limit(limit * 3)

        rows: List[Dict[str, Any]] = []
        async for s in cursor:
            sid = s.get("signal_id")
            if not sid:
                continue
            graded = await db.mittari_signal_outcomes.find_one({"signal_id": sid}, {"_id": 0, "signal_id": 1})
            if graded:
                continue
            rows.append(s)
            if len(rows) >= limit:
                break

        return {
            "rows": rows,
            "count": len(rows),
            "computed_at": now_iso,
        }

    # ── GRADE ────────────────────────────────────────────────────────
    @router.post("/grade")
    async def grade_signals(
        payload: Dict[str, Any] = Body(...),
        _: bool = Depends(require_admin),
    ) -> Dict[str, Any]:
        grades = payload.get("grades") or []
        if not isinstance(grades, list) or not grades:
            raise HTTPException(status_code=400, detail="grades_required")

        written = 0
        skipped: List[Dict[str, Any]] = []
        now_iso = _utcnow_iso()
        for g in grades:
            sid = (g or {}).get("signal_id")
            outcome = ((g or {}).get("outcome") or "").lower()
            note = (g or {}).get("note") or ""
            if not sid or outcome not in VALID_OUTCOMES:
                skipped.append({"signal_id": sid, "reason": "invalid_payload"})
                continue
            snap = await db.mittari_signal_history.find_one({"signal_id": sid}, {"_id": 0})
            if not snap:
                skipped.append({"signal_id": sid, "reason": "no_snapshot"})
                continue
            doc = {
                "signal_id": sid,
                "signal_class": snap.get("signal_class") or "sports.other",
                "hit": outcome == "hit",
                "outcome": outcome,
                "note": note,
                "graded_at": now_iso,
                "snapshot_date": snap.get("snapshot_date"),
                "commence_time": snap.get("commence_time"),
            }
            await db.mittari_signal_outcomes.update_one(
                {"signal_id": sid},
                {"$set": doc},
                upsert=True,
            )
            written += 1

        return {
            "written": written,
            "skipped": skipped,
            "computed_at": now_iso,
        }

    # ── STATUS ───────────────────────────────────────────────────────
    @router.get("/status")
    async def status(_: bool = Depends(require_admin)) -> Dict[str, Any]:
        ninety_iso = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        snapshotted_total = await db.mittari_signal_history.estimated_document_count()
        graded_total = await db.mittari_signal_outcomes.estimated_document_count()
        window_n_90d = await db.mittari_signal_outcomes.count_documents({"graded_at": {"$gte": ninety_iso}})

        # Ungraded count uses the same pending criteria as /pending but
        # capped at 500 so the count is bounded for the dashboard chip.
        now_iso = _utcnow_iso()
        ungraded_count = 0
        cursor = db.mittari_signal_history.find(
            {"commence_time": {"$lt": now_iso}},
            {"_id": 0, "signal_id": 1},
        ).limit(500)
        async for s in cursor:
            sid = s.get("signal_id")
            if not sid:
                continue
            exists = await db.mittari_signal_outcomes.find_one(
                {"signal_id": sid}, {"_id": 0, "signal_id": 1}
            )
            if not exists:
                ungraded_count += 1

        last_graded: Optional[str] = None
        latest_cursor = db.mittari_signal_outcomes.find(
            {}, {"_id": 0, "graded_at": 1}
        ).sort([("graded_at", -1)]).limit(1)
        async for row in latest_cursor:
            last_graded = row.get("graded_at")

        return {
            "snapshotted_total": snapshotted_total,
            "graded_total": graded_total,
            "window_n_90d": window_n_90d,
            "ungraded_count": ungraded_count,
            "last_graded_at": last_graded,
            "computed_at": now_iso,
        }

    return router
