"""
Iter55 - Telegram throttling + mini-game suite tests.

These exercise the new daily-broadcast guard and the Phase 1 quiz flow
end-to-end against the live preview backend.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
ADMIN_TOKEN = os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")


# ─────────────────────── Telegram throttling (unit) ───────────────────────

def test_meets_sharpness_threshold_basic():
    from dispatch_daily import _meets_sharpness_threshold
    picks_low = [{"sharpness": 50}, {"sharpness": 60}, {"sharpness": 65}]
    picks_high = [{"sharpness": 50}, {"sharpness": 88}, {"sharpness": 65}]
    meets_low, top_low = _meets_sharpness_threshold(picks_low)
    meets_high, top_high = _meets_sharpness_threshold(picks_high)
    assert top_low == 65
    assert top_high == 88
    assert meets_low is False
    assert meets_high is True


def test_meets_sharpness_threshold_handles_garbage():
    from dispatch_daily import _meets_sharpness_threshold
    meets, top = _meets_sharpness_threshold([{"sharpness": None}, {}, {"sharpness": "abc"}])
    assert top == 0
    assert meets is False


# ─────────────────────── Mini-game backend ───────────────────────

def test_mini_games_hub_payload_shape():
    r = httpx.get(f"{BASE}/api/mini-games/hub", timeout=15.0)
    assert r.status_code == 200
    body = r.json()
    assert "games" in body and len(body["games"]) == 5
    assert any(g["status"] == "active" and g["kind"] == "quiz" for g in body["games"])
    t = body["tournament"]
    assert "week_iso" in t and t["week_iso"].startswith("20")
    assert "opens_at" in t and "closes_at" in t
    assert isinstance(t["plays_this_week"], int)
    assert isinstance(t["ranked_players_this_week"], int)
    assert "leaderboard_top" in t
    assert "consent_text_fi" in body and "Putki HQ" in body["consent_text_fi"]


def test_quiz_full_flow_with_email_capture():
    """Anonymous play → finish → email gate → unlocked full result."""
    # Start
    start = httpx.post(f"{BASE}/api/mini-games/quiz/start", timeout=15.0).json()
    assert "play_id" in start and "anon_id" in start
    assert len(start["questions"]) == 10
    play_id, anon_id, questions = start["play_id"], start["anon_id"], start["questions"]

    # Finish - pick "c" for everything
    answers = [{"q_id": q["id"], "picked": "c"} for q in questions]
    fin = httpx.post(
        f"{BASE}/api/mini-games/quiz/finish",
        json={"play_id": play_id, "anon_id": anon_id, "answers": answers},
        timeout=15.0,
    ).json()
    assert "score" in fin and "total" in fin and fin["total"] == 10
    assert fin["personalized_locked"] is True
    assert len(fin["answers"]) == 10
    for a in fin["answers"]:
        assert "explanation_fi" in a and a["explanation_fi"], "explanations must be present"

    # Unlock without consent → 400
    no_cons = httpx.post(
        f"{BASE}/api/mini-games/quiz/unlock",
        json={"play_id": play_id, "anon_id": anon_id, "email": "x@example.fi", "consent": False},
        timeout=15.0,
    )
    assert no_cons.status_code == 400
    assert "consent" in no_cons.text.lower()

    # Unlock with consent → 200 + persona + leaderboard
    email = f"iter55-test-{int(time.time())}@example.fi"
    unlock = httpx.post(
        f"{BASE}/api/mini-games/quiz/unlock",
        json={"play_id": play_id, "anon_id": anon_id, "email": email,
              "name": "Iter55", "consent": True},
        timeout=15.0,
    ).json()
    assert "persona" in unlock and "title" in unlock["persona"]
    assert "strengths" in unlock and "gaps" in unlock
    assert "tournament_week_iso" in unlock
    assert isinstance(unlock["rank"], int) and unlock["rank"] >= 1
    assert "leaderboard" in unlock and isinstance(unlock["leaderboard"], list)


def test_quiz_unlock_rejects_invalid_email():
    start = httpx.post(f"{BASE}/api/mini-games/quiz/start", timeout=15.0).json()
    answers = [{"q_id": q["id"], "picked": "a"} for q in start["questions"]]
    httpx.post(
        f"{BASE}/api/mini-games/quiz/finish",
        json={"play_id": start["play_id"], "anon_id": start["anon_id"], "answers": answers},
        timeout=15.0,
    )
    r = httpx.post(
        f"{BASE}/api/mini-games/quiz/unlock",
        json={"play_id": start["play_id"], "anon_id": start["anon_id"],
              "email": "not-an-email", "consent": True},
        timeout=15.0,
    )
    assert r.status_code == 400
    assert "invalid_email" in r.text


def test_quiz_finish_requires_valid_anon_id():
    """Mismatched anon_id must NOT be allowed to finish a play."""
    start = httpx.post(f"{BASE}/api/mini-games/quiz/start", timeout=15.0).json()
    answers = [{"q_id": q["id"], "picked": "a"} for q in start["questions"]]
    r = httpx.post(
        f"{BASE}/api/mini-games/quiz/finish",
        json={"play_id": start["play_id"], "anon_id": "wrong-anon-id", "answers": answers},
        timeout=15.0,
    )
    assert r.status_code == 400
    assert "play_not_found" in r.text


def test_leaderboard_endpoint_returns_rows_after_capture():
    r = httpx.get(f"{BASE}/api/mini-games/leaderboard", timeout=15.0).json()
    assert "leaderboard" in r
    assert isinstance(r["leaderboard"], list)


def test_admin_leads_export_requires_auth():
    r = httpx.get(f"{BASE}/api/admin/mini-games/leads", timeout=15.0)
    assert r.status_code in (401, 403, 422)


def test_admin_leads_export_returns_capture_rows():
    r = httpx.get(
        f"{BASE}/api/admin/mini-games/leads",
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15.0,
    ).json()
    assert "leads" in r and isinstance(r["leads"], list)
    if r["leads"]:
        sample = r["leads"][0]
        assert "email" in sample and "score" in sample and "consent_at" in sample


# ─────────────────────── Streamer Excel backfill ───────────────────────

def test_finnish_excel_streamers_are_seeded():
    """The TOP FI STREAMERS Excel rows must be present in the public
    /api/streamers payload after seed."""
    r = httpx.get(f"{BASE}/api/streamers?market=fi", timeout=15.0).json()
    slugs = {s.get("slug") for s in (r.get("streamers") or [])}
    expected = {"roosteeni", "kp2times", "sainirs6", "huneasd", "occei",
                "tepitee", "rsnakes88", "hukkaw"}
    missing = expected - slugs
    assert not missing, f"missing Excel-sourced Finnish streamers: {missing}"
