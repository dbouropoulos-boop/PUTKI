"""
Iter60 - Bilingual (FI + EN) content exposure tests.

Verifies that quiz/scenario/insight start endpoints expose both
`prompt_fi`+`prompt_en` and per-option `label_fi`+`label_en`. The
backend MUST seed _en fields idempotently (existing rows are
backfilled via `$set`).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")


def test_quiz_start_returns_fi_and_en():
    r = httpx.post(f"{BASE}/api/mini-games/quiz/start", json={}, timeout=15.0)
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert qs, "no questions returned"
    for q in qs:
        assert q.get("prompt_fi"), f"missing prompt_fi for q{q.get('order')}"
        assert q.get("prompt_en"), f"missing prompt_en for q{q.get('order')}"
        for o in q["options"]:
            assert o.get("label_fi"), f"missing label_fi {q.get('order')}/{o['key']}"
            assert o.get("label_en"), f"missing label_en {q.get('order')}/{o['key']}"


def test_scenario_start_returns_fi_and_en():
    r = httpx.post(f"{BASE}/api/mini-games/scenario/start", json={}, timeout=15.0)
    assert r.status_code == 200
    qs = r.json()["scenarios"]
    assert len(qs) == 6  # iter64 pivot: scenario expanded from 5 → 6 (added 1am stop-loss)
    for q in qs:
        assert q.get("prompt_fi") and q.get("prompt_en")
        for o in q["options"]:
            assert o.get("label_fi") and o.get("label_en")


def test_insight_start_returns_fi_and_en():
    r = httpx.post(f"{BASE}/api/mini-games/insight/start", json={}, timeout=15.0)
    assert r.status_code == 200
    tiles = r.json()["tiles"]
    assert len(tiles) == 6
    for t in tiles:
        assert t.get("prompt_fi") and t.get("prompt_en")


def test_hub_games_carry_en_titles():
    r = httpx.get(f"{BASE}/api/mini-games/hub", timeout=15.0)
    assert r.status_code == 200
    games = r.json()["games"]
    assert len(games) == 5
    for g in games:
        assert g.get("title_fi") and g.get("title_en"), f"{g['slug']} missing title_en"
        assert g.get("subtitle_fi") and g.get("subtitle_en")
        assert g.get("duration_fi") and g.get("duration_en")
