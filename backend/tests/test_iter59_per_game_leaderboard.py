"""
Iter59 — Per-game public leaderboard endpoint tests.

Adds coverage for `GET /api/mini-games/leaderboard/{game_slug}` introduced
to power the standalone game-page intros (each /peliareena/* sub-page).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")


def test_per_game_leaderboard_known_game_returns_contract():
    r = httpx.get(f"{BASE}/api/mini-games/leaderboard/quiz_gambling_literacy?limit=5", timeout=15.0)
    assert r.status_code == 200
    j = r.json()
    assert j["game_slug"] == "quiz_gambling_literacy"
    assert "week_iso" in j and j["week_iso"]
    assert isinstance(j["leaderboard"], list)
    assert "ranked_players" in j and isinstance(j["ranked_players"], int)
    # Display names must be anonymised (no full emails leaked)
    for row in j["leaderboard"]:
        assert {"rank", "display_name", "score", "pct"} <= set(row.keys())
        assert "@" not in row["display_name"]


def test_per_game_leaderboard_all_active_games_resolve():
    """Each of the 5 active game slugs must be reachable; bogus slugs 404."""
    slugs = [
        "quiz_gambling_literacy",
        "scenario_decisions",
        "insight_reveal",
        "arcade_snake",
        "arcade_tap",
    ]
    for slug in slugs:
        r = httpx.get(f"{BASE}/api/mini-games/leaderboard/{slug}", timeout=15.0)
        assert r.status_code == 200, f"{slug} returned {r.status_code}"
        assert r.json()["game_slug"] == slug


def test_per_game_leaderboard_rejects_unknown_game():
    r = httpx.get(f"{BASE}/api/mini-games/leaderboard/totally_bogus_slug", timeout=15.0)
    assert r.status_code == 404


def test_per_game_leaderboard_respects_limit_clamp():
    r = httpx.get(f"{BASE}/api/mini-games/leaderboard/quiz_gambling_literacy?limit=200", timeout=15.0)
    assert r.status_code == 200
    # Internal clamp is 50 — list cannot exceed that even on garbage input
    assert len(r.json()["leaderboard"]) <= 50
