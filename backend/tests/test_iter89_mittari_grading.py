"""
iter89 · Phase 4 wave 4 — Mittari grading operator job tests.

Pattern: hits the LIVE backend via httpx (mirrors test_iter83
convention). Direct MongoDB IO uses synchronous pymongo so we never
mix sync + async event loops.

Coverage:
  - Auth gate on status + grade.
  - Status envelope shape.
  - Grade endpoint: rejects empty payload, writes outcome, idempotent
    on signal_id (re-grade updates the existing row, never inserts a
    duplicate), skips unsnapshotted + invalid outcomes.
  - Pending endpoint: returns only commenced + ungraded signals.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta

import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": TOKEN, "Content-Type": "application/json"}
TIMEOUT = 60.0

STATUS = f"{BASE}/api/admin/mittari/grading/status"
PENDING = f"{BASE}/api/admin/mittari/grading/pending"
GRADE = f"{BASE}/api/admin/mittari/grading/grade"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


def _db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _seed_snapshot(db, sid: str, *, commence_past: bool = True, signal_class: str = "sports.football"):
    ct = (datetime.now(timezone.utc) + timedelta(days=-2 if commence_past else 2)).isoformat()
    db.mittari_signal_history.update_one(
        {"signal_id": sid, "snapshot_date": ct[:10]},
        {"$setOnInsert": {
            "signal_id": sid,
            "snapshot_date": ct[:10],
            "snapshot_at": datetime.now(timezone.utc).isoformat(),
            "commence_time": ct,
            "sport_key": "soccer_epl",
            "signal_class": signal_class,
            "pick_name": "Arsenal",
            "pick_price": 1.55,
            "home_team": "Arsenal",
            "away_team": "Chelsea",
        }},
        upsert=True,
    )


def _cleanup(db, prefix: str):
    db.mittari_signal_history.delete_many({"signal_id": {"$regex": f"^{prefix}"}})
    db.mittari_signal_outcomes.delete_many({"signal_id": {"$regex": f"^{prefix}"}})


# ── Auth ──────────────────────────────────────────────────────────

def test_status_requires_admin_token():
    r = httpx.get(STATUS, timeout=TIMEOUT)
    assert r.status_code in (401, 403)


def test_grade_requires_admin_token():
    r = httpx.post(GRADE, json={"grades": []}, timeout=TIMEOUT)
    assert r.status_code in (401, 403)


# ── Status envelope ──────────────────────────────────────────────

def test_status_envelope_shape():
    r = httpx.get(STATUS, headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ["snapshotted_total", "graded_total", "window_n_90d", "ungraded_count", "last_graded_at", "computed_at"]:
        assert k in body, f"status envelope missing key {k}"
    assert isinstance(body["snapshotted_total"], int)
    assert isinstance(body["graded_total"], int)


# ── Grade endpoint ───────────────────────────────────────────────

def test_grade_rejects_empty_payload():
    r = httpx.post(GRADE, headers=HEADERS, json={"grades": []}, timeout=TIMEOUT)
    assert r.status_code == 400


def test_grade_writes_outcome_for_snapshotted_signal_and_is_idempotent():
    db = _db()
    _cleanup(db, "iter89-test-")
    _seed_snapshot(db, "iter89-test-A")

    r = httpx.post(GRADE, headers=HEADERS, json={"grades": [{"signal_id": "iter89-test-A", "outcome": "hit"}]}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["written"] == 1
    assert body["skipped"] == []

    doc = db.mittari_signal_outcomes.find_one({"signal_id": "iter89-test-A"}, {"_id": 0})
    assert doc is not None
    assert doc["hit"] is True
    assert doc["outcome"] == "hit"
    assert doc["signal_class"] == "sports.football"

    # Idempotent: re-grade same signal as 'miss' → updates in place, never duplicates.
    r2 = httpx.post(GRADE, headers=HEADERS, json={"grades": [{"signal_id": "iter89-test-A", "outcome": "miss"}]}, timeout=TIMEOUT)
    assert r2.status_code == 200
    assert r2.json()["written"] == 1

    doc2 = db.mittari_signal_outcomes.find_one({"signal_id": "iter89-test-A"}, {"_id": 0})
    assert doc2["outcome"] == "miss"
    assert doc2["hit"] is False
    cnt = db.mittari_signal_outcomes.count_documents({"signal_id": "iter89-test-A"})
    assert cnt == 1

    _cleanup(db, "iter89-test-")


def test_grade_skips_unsnapshotted_and_invalid_outcomes():
    db = _db()
    _cleanup(db, "iter89-test-")

    r = httpx.post(
        GRADE,
        headers=HEADERS,
        json={"grades": [
            {"signal_id": "iter89-test-MISSING", "outcome": "hit"},
            {"signal_id": "iter89-test-X", "outcome": "garbage"},
        ]},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["written"] == 0
    reasons = {s["reason"] for s in body["skipped"]}
    assert "no_snapshot" in reasons
    assert "invalid_payload" in reasons


# ── Pending endpoint ─────────────────────────────────────────────

def test_pending_returns_only_commenced_and_ungraded():
    db = _db()
    _cleanup(db, "iter89-test-")

    _seed_snapshot(db, "iter89-test-PAST-1", commence_past=True)
    _seed_snapshot(db, "iter89-test-PAST-2-GRADED", commence_past=True)
    _seed_snapshot(db, "iter89-test-FUTURE", commence_past=False)
    # Pre-grade the second one so it's filtered out of pending.
    db.mittari_signal_outcomes.update_one(
        {"signal_id": "iter89-test-PAST-2-GRADED"},
        {"$set": {
            "signal_id": "iter89-test-PAST-2-GRADED",
            "signal_class": "sports.football",
            "hit": True,
            "outcome": "hit",
            "graded_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    r = httpx.get(PENDING, headers=HEADERS, params={"limit": 50}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    sids = [row["signal_id"] for row in body["rows"]]
    assert "iter89-test-PAST-1" in sids
    assert "iter89-test-PAST-2-GRADED" not in sids
    assert "iter89-test-FUTURE" not in sids

    _cleanup(db, "iter89-test-")
