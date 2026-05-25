"""
iter64 - Profiler pivot regression tests.

Covers:
  • Scenario seed now has 6 items (was 5) with max_score=18
  • New 5-profile spectrum (cold_calculator / patient_tactician /
    streak_chaser / comeback_believer / tilt_risk)
  • POST /api/profiler/event records funnel events
  • GET /api/admin/profiler/funnel returns counts + rate breakdown
  • Scenario unlock returns `three_traps_fi` and `three_traps_en`
"""
import os
import requests

API = os.environ.get("BACKEND_API", "http://localhost:8001/api")
ADMIN_TOKEN = os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")


def _start_scenario():
    r = requests.post(f"{API}/mini-games/scenario/start", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _finish_scenario_picking(picks_letter):
    """Finish a scenario play where every answer picks the same key."""
    data = _start_scenario()
    play_id, anon_id = data["play_id"], data["anon_id"]
    scenarios = data["scenarios"]
    assert len(scenarios) == 6, f"expected 6 scenarios, got {len(scenarios)}"
    answers = [{"q_id": s["id"], "picked": picks_letter} for s in scenarios]
    r = requests.post(
        f"{API}/mini-games/scenario/finish",
        json={"play_id": play_id, "anon_id": anon_id, "answers": answers},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return play_id, anon_id, r.json()


def test_scenario_has_six_items_and_max_score_18():
    data = _start_scenario()
    assert len(data["scenarios"]) == 6
    assert data["max_score"] == 18


def test_all_b_picks_resolve_to_cold_calculator():
    """All 'b' picks give max points (18) → top-tier profile."""
    _, _, body = _finish_scenario_picking("b")
    assert body["persona_preview"]["key"] == "cold_calculator"
    assert body["score"] == 18
    assert body["card"]["profile_index"] == "01 / 05"


def test_all_a_picks_resolve_to_tilt_risk():
    """All 'a' picks give zero points → bottom-tier profile."""
    _, _, body = _finish_scenario_picking("a")
    assert body["persona_preview"]["key"] == "tilt_risk"
    assert body["score"] == 0
    assert body["card"]["profile_index"] == "05 / 05"


def test_scenario_unlock_returns_three_traps_bilingual():
    play_id, anon_id, _ = _finish_scenario_picking("b")
    r = requests.post(
        f"{API}/mini-games/scenario/unlock",
        json={
            "play_id": play_id, "anon_id": anon_id,
            "email": f"iter64+traps-{play_id[:8]}@putkihq.fi", "consent": True,
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    persona = body["persona"]
    assert isinstance(persona.get("three_traps_fi"), list) and len(persona["three_traps_fi"]) == 3
    assert isinstance(persona.get("three_traps_en"), list) and len(persona["three_traps_en"]) == 3
    assert persona.get("blind_spot_fi") and persona.get("blind_spot_en")


def test_profiler_event_endpoint_records_and_summarises():
    session_id = "pytest-iter64-funnel-001"
    for ev in ["session_start", "scenario_view", "session_complete",
               "reveal_view", "gate_view", "gate_submit_attempt",
               "gate_unlocked"]:
        r = requests.post(
            f"{API}/profiler/event",
            json={"session_id": session_id, "event": ev},
            timeout=10,
        )
        assert r.status_code == 200, f"{ev}: {r.text}"
        assert r.json()["ok"] is True

    # Reject invalid event types (boundary defense)
    bad = requests.post(
        f"{API}/profiler/event",
        json={"session_id": session_id, "event": "not_a_real_event"},
        timeout=10,
    )
    assert bad.status_code == 400

    # Admin summary returns counts + rates
    summary = requests.get(
        f"{API}/admin/profiler/funnel?since_days=1",
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=10,
    )
    assert summary.status_code == 200, summary.text
    s = summary.json()
    assert s["counts"]["session_start"] >= 1
    assert "completion_rate" in s["rates"]
    assert "end_to_end_rate" in s["rates"]


def test_funnel_admin_endpoint_requires_auth():
    r = requests.get(f"{API}/admin/profiler/funnel", timeout=10)
    assert r.status_code in (401, 403), f"unauthenticated access should be blocked, got {r.status_code}"
