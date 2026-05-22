"""
Iter56 — Phase 2 mini-game suite tests.

Targets Scenario (branching decisions) + Insight Reveal (scratch tiles)
plus the CSV lead export. The shared `_unlock_for_game` helper is
exercised transitively via both games.
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


# ─────────────────────── persona unit ───────────────────────

def test_scenario_persona_thresholds():
    from mini_games_phase2 import persona_for_scenario
    assert persona_for_scenario(15)["key"] == "patient_tactician"
    assert persona_for_scenario(12)["key"] == "patient_tactician"
    assert persona_for_scenario(11)["key"] == "growing_judge"
    assert persona_for_scenario(7)["key"] == "growing_judge"
    assert persona_for_scenario(6)["key"] == "fresh_player"
    assert persona_for_scenario(0)["key"] == "fresh_player"


# ─────────────────────── hub catalog ───────────────────────

def test_hub_promotes_phase2_games_to_active():
    r = httpx.get(f"{BASE}/api/mini-games/hub", timeout=15.0).json()
    by_slug = {g["slug"]: g for g in r["games"]}
    assert by_slug["scenario_decisions"]["status"] == "active"
    assert by_slug["scenario_decisions"]["play_url"] == "/peliareena/paatospolku"
    assert by_slug["insight_reveal"]["status"] == "active"
    assert by_slug["insight_reveal"]["play_url"] == "/peliareena/tietoraape"


# ─────────────────────── scenario flow ───────────────────────

def test_scenario_full_flow():
    s = httpx.post(f"{BASE}/api/mini-games/scenario/start", timeout=15.0).json()
    assert s["total"] == 5
    assert s["max_score"] == 15
    for sc in s["scenarios"]:
        # Option scores must NOT be exposed in the start payload
        for opt in sc["options"]:
            assert "score" not in opt, "option scores leaked to client"
            assert "explanation_fi" not in opt, "explanations leaked pre-finish"

    answers = [{"q_id": sc["id"], "picked": "b"} for sc in s["scenarios"]]
    fin = httpx.post(
        f"{BASE}/api/mini-games/scenario/finish",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"], "answers": answers},
        timeout=15.0,
    ).json()
    assert "score" in fin and "max_score" in fin and fin["max_score"] == 15
    assert fin["personalized_locked"] is True
    # After finish, all option scores + explanations ARE present
    for a in fin["answers"]:
        for o in a["options_resolved"]:
            assert "score" in o and "explanation_fi" in o
            assert o["explanation_fi"]

    # Consent guard
    no_c = httpx.post(
        f"{BASE}/api/mini-games/scenario/unlock",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"],
              "email": "x@example.fi", "consent": False},
        timeout=15.0,
    )
    assert no_c.status_code == 400 and "consent" in no_c.text.lower()

    # Unlock OK
    email = f"iter56-sc-{int(time.time())}@example.fi"
    u = httpx.post(
        f"{BASE}/api/mini-games/scenario/unlock",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"],
              "email": email, "consent": True},
        timeout=15.0,
    ).json()
    assert u["persona"]["title"]
    assert u["persona"]["tagline"]
    assert u["rank"] >= 1
    assert u["max_score"] == 15
    assert u["leaderboard"]


# ─────────────────────── insight flow ───────────────────────

def test_insight_full_flow():
    s = httpx.post(f"{BASE}/api/mini-games/insight/start", timeout=15.0).json()
    assert s["tile_count"] == 6
    assert len(s["tiles"]) == 6
    # `explanation_fi` MUST NOT be in the start payload
    for t in s["tiles"]:
        assert "explanation_fi" not in t, "tile body leaked to client pre-reveal"
        assert t["prompt_fi"]  # the headline IS visible

    # Reveal 3 of 6
    for tile in s["tiles"][:3]:
        r = httpx.post(
            f"{BASE}/api/mini-games/insight/reveal",
            json={"play_id": s["play_id"], "anon_id": s["anon_id"], "q_id": tile["id"]},
            timeout=15.0,
        ).json()
        assert r["tile"]["explanation_fi"]
        assert r["tile"]["id"] == tile["id"]

    # Idempotent re-reveal (same tile twice) — count must NOT grow past 3
    r = httpx.post(
        f"{BASE}/api/mini-games/insight/reveal",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"], "q_id": s["tiles"][0]["id"]},
        timeout=15.0,
    ).json()
    assert r["revealed_count"] == 3

    fin = httpx.post(
        f"{BASE}/api/mini-games/insight/finish",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"]},
        timeout=15.0,
    ).json()
    assert fin["score"] == 3 and fin["max_score"] == 6
    assert len(fin["revealed_tiles"]) == 3
    for t in fin["revealed_tiles"]:
        assert t["explanation_fi"]

    email = f"iter56-ins-{int(time.time())}@example.fi"
    u = httpx.post(
        f"{BASE}/api/mini-games/insight/unlock",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"],
              "email": email, "consent": True},
        timeout=15.0,
    ).json()
    assert u["persona"]["title"]
    assert u["rank"] >= 1


# ─────────────────────── CSV export ───────────────────────

def test_admin_csv_export_requires_auth():
    r = httpx.get(f"{BASE}/api/admin/mini-games/leads.csv", timeout=15.0)
    assert r.status_code in (401, 403, 422)


def test_admin_csv_export_returns_csv():
    r = httpx.get(
        f"{BASE}/api/admin/mini-games/leads.csv",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        timeout=15.0,
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("text/csv")
    body = r.text
    first_line = body.splitlines()[0]
    for col in ("email", "name", "source_game", "tournament_week_iso",
                "score", "pct", "consent_at"):
        assert col in first_line, f"CSV header missing {col}"


def test_admin_csv_export_filters_by_game():
    r = httpx.get(
        f"{BASE}/api/admin/mini-games/leads.csv?game=scenario_decisions",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        timeout=15.0,
    )
    assert r.status_code == 200
    body = r.text
    lines = body.splitlines()[1:]
    for line in lines:
        # Each row should mention the filtered game slug
        assert "scenario_decisions" in line, f"unexpected game in CSV row: {line}"
