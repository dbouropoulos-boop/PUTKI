"""
iter88 · Phase 4 wave 4 — trust-signal data endpoints.

Three GET endpoints power the new long-form trust pages:

  GET /api/data/mestari/dataset-summary
      Anonymised quartiles + N for every Mestari diagnostic run.
      Pulled from `mestari_diagnostic_leads`.

  GET /api/data/voita/ledger
      Every Voita raffle with a `paid` status + winner stamp.
      Pulled from `voita_raffles`.

  GET /api/data/mittari/accuracy-90d
      Rolling 90-day signal-class hit rate.
      Pulled from `mittari_signal_outcomes` IF the collection exists;
      falls back to an explicit "scaffold" payload (N=0) otherwise so
      the public page can render an honest "back-test in progress"
      block instead of fabricated numbers.

Everything in this router is PUBLIC. No admin token. The numbers
exposed are aggregates and never expose PII; identity fields are
projected out of every cursor.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter


def _quartiles(sorted_values: List[float]) -> Dict[str, float]:
    """Return p25 / p50 / p75 / min / max — for a sorted input list."""
    n = len(sorted_values)
    if n == 0:
        return {"min": 0, "p25": 0, "p50": 0, "p75": 0, "max": 0}

    def pct(p: float) -> float:
        # Linear interpolation, mirrors NumPy's "linear" interpolation
        # method on a sorted input.
        if n == 1:
            return float(sorted_values[0])
        idx = p * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        frac = idx - lo
        return float(sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * frac)

    return {
        "min": float(sorted_values[0]),
        "p25": round(pct(0.25), 2),
        "p50": round(pct(0.50), 2),
        "p75": round(pct(0.75), 2),
        "max": float(sorted_values[-1]),
    }


def build_data_pages_router(db) -> APIRouter:
    router = APIRouter(prefix="/data", tags=["data-pages"])

    # ── Mestari diagnostic dataset summary ────────────────────────────
    @router.get("/mestari/dataset-summary")
    async def mestari_dataset_summary() -> Dict[str, Any]:
        # The leads collection carries one row per completed diagnostic.
        # We bucket by `diagnostic` field (sports / poker / blackjack),
        # and compute axis quartiles where available.
        cursor = db.mestari_diagnostic_leads.find(
            {},
            {"_id": 0, "diagnostic": 1, "axes": 1, "scored_at": 1, "result": 1},
        )

        per_diag: Dict[str, Dict[str, Any]] = {}
        total = 0
        last_scored: datetime | None = None
        async for row in cursor:
            total += 1
            diag = (row.get("diagnostic") or "unknown").lower()
            entry = per_diag.setdefault(
                diag,
                {"n": 0, "process": [], "discipline": [], "recovery": []},
            )
            entry["n"] += 1
            axes = row.get("axes") or {}
            for axis_key in ("process", "discipline", "recovery"):
                v = axes.get(axis_key)
                if isinstance(v, (int, float)):
                    entry[axis_key].append(float(v))
            scored = row.get("scored_at")
            if isinstance(scored, str) and (last_scored is None or scored > (last_scored.isoformat() if isinstance(last_scored, datetime) else last_scored)):
                last_scored = scored

        per_diag_payload = []
        for diag, entry in per_diag.items():
            payload = {"diagnostic": diag, "n": entry["n"]}
            for axis_key in ("process", "discipline", "recovery"):
                values = sorted(entry[axis_key])
                payload[axis_key] = _quartiles(values)
            per_diag_payload.append(payload)
        # Stable ordering for the UI.
        per_diag_payload.sort(key=lambda p: p["diagnostic"])

        return {
            "total_runs": total,
            "per_diagnostic": per_diag_payload,
            "last_scored_at": last_scored if isinstance(last_scored, str) else (last_scored.isoformat() if isinstance(last_scored, datetime) else None),
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "schema_version": 1,
        }

    # ── Voita raffle outcomes ledger ─────────────────────────────────
    @router.get("/voita/ledger")
    async def voita_ledger() -> Dict[str, Any]:
        """Every concluded raffle with a winner stamp. Paid + drawn."""
        cursor = db.voita_raffles.find(
            {"status": {"$in": ["paid", "drawn"]}},
            {
                "_id": 0,
                "slug": 1,
                "headline": 1,
                "prize_label": 1,
                "drawn_at": 1,
                "paid_at": 1,
                "winner_display_name": 1,
                "winner_city": 1,
                "status": 1,
                "entries_count": 1,
            },
        ).sort([("paid_at", -1), ("drawn_at", -1)])

        rows: List[Dict[str, Any]] = []
        async for r in cursor:
            display = r.get("winner_display_name") or "—"
            city = r.get("winner_city") or ""
            rows.append({
                "slug": r.get("slug"),
                "headline": r.get("headline") or r.get("slug"),
                "prize_label": r.get("prize_label") or "",
                "winner_display": f"{display}" + (f" · {city}" if city else ""),
                "drawn_at": r.get("drawn_at"),
                "paid_at": r.get("paid_at"),
                "status": r.get("status"),
                "entries_count": int(r.get("entries_count") or 0),
            })

        return {
            "rows": rows,
            "count": len(rows),
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "schema_version": 1,
        }

    # ── Mittari accuracy back-test ───────────────────────────────────
    @router.get("/mittari/accuracy-90d")
    async def mittari_accuracy_90d() -> Dict[str, Any]:
        """Rolling 90-day per-signal-class hit rate.

        Reads `mittari_signal_outcomes` if present. The collection is
        opt-in (back-test outcomes are graded by an operator job, not
        automatically). When the collection is empty we return an
        honest scaffold so the public page renders a "back-test in
        progress" block instead of fabricated numbers.
        """
        ninety = datetime.now(timezone.utc) - timedelta(days=90)
        ninety_iso = ninety.isoformat()

        per_class: Dict[str, Dict[str, int]] = {}
        try:
            cursor = db.mittari_signal_outcomes.find(
                {"graded_at": {"$gte": ninety_iso}},
                {"_id": 0, "signal_class": 1, "hit": 1},
            )
            async for row in cursor:
                cls = (row.get("signal_class") or "unknown").lower()
                entry = per_class.setdefault(cls, {"n": 0, "hits": 0})
                entry["n"] += 1
                if bool(row.get("hit")):
                    entry["hits"] += 1
        except Exception:  # noqa: BLE001 — defensive, never break the page
            pass

        per_class_payload = []
        for cls, agg in per_class.items():
            n = agg["n"]
            hits = agg["hits"]
            per_class_payload.append({
                "signal_class": cls,
                "n": n,
                "hits": hits,
                "hit_rate": round(hits / n, 4) if n > 0 else 0,
            })
        per_class_payload.sort(key=lambda p: p["signal_class"])

        total_n = sum(p["n"] for p in per_class_payload)
        total_hits = sum(p["hits"] for p in per_class_payload)
        return {
            "rolling_days": 90,
            "since": ninety_iso,
            "per_class": per_class_payload,
            "total_n": total_n,
            "total_hits": total_hits,
            "total_hit_rate": round(total_hits / total_n, 4) if total_n > 0 else 0,
            "status": "live" if total_n > 0 else "scaffold",
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "schema_version": 1,
        }

    return router
