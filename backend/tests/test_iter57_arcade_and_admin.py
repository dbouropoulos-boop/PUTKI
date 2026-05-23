"""
Iter57 — Arcade games, champions banner, admin question editor tests.
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


def test_hub_promotes_arcade_games_to_active():
    r = httpx.get(f"{BASE}/api/mini-games/hub", timeout=15.0).json()
    by_slug = {g["slug"]: g for g in r["games"]}
    assert by_slug["arcade_snake"]["status"] == "active"
    assert by_slug["arcade_snake"]["play_url"] == "/peliareena/aikatappo-mato"
    assert by_slug["arcade_tap"]["status"] == "active"
    assert by_slug["arcade_tap"]["play_url"] == "/peliareena/aikatappo-napautus"


# ─────────────────────── arcade snake flow ───────────────────────

def test_arcade_snake_start_then_score_then_unlock():
    s = httpx.post(f"{BASE}/api/mini-games/arcade/snake/start", timeout=15.0).json()
    assert "play_id" in s and "anon_id" in s
    time.sleep(2.5)
    sub = httpx.post(
        f"{BASE}/api/mini-games/arcade/snake/submit",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"], "score": 5},
        timeout=15.0,
    ).json()
    assert sub["score"] == 5
    assert sub["valid_for_leaderboard"] is True
    assert sub["personalized_locked"] is True

    no_cons = httpx.post(
        f"{BASE}/api/mini-games/arcade/snake/unlock",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"],
              "email": "x@example.fi", "consent": False},
        timeout=15.0,
    )
    assert no_cons.status_code == 400

    u = httpx.post(
        f"{BASE}/api/mini-games/arcade/snake/unlock",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"],
              "email": f"snk-{int(time.time())}@example.fi", "consent": True},
        timeout=15.0,
    ).json()
    assert u["score"] == 5
    assert u["rank"] >= 1


def test_arcade_cheat_detection_blocks_leaderboard():
    """50pts in 0.2s — server detects + flags `valid_for_leaderboard=False`."""
    s = httpx.post(f"{BASE}/api/mini-games/arcade/snake/start", timeout=15.0).json()
    time.sleep(0.2)
    sub = httpx.post(
        f"{BASE}/api/mini-games/arcade/snake/submit",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"], "score": 50},
        timeout=15.0,
    ).json()
    assert sub["valid_for_leaderboard"] is False
    u = httpx.post(
        f"{BASE}/api/mini-games/arcade/snake/unlock",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"],
              "email": f"cheat-{int(time.time())}@example.fi", "consent": True},
        timeout=15.0,
    ).json()
    # Lead still captured (consent honoured), but score zeroed for leaderboard.
    assert u["score"] == 0


# ─────────────────────── arcade tap flow ───────────────────────

def test_arcade_tap_flow_basic():
    s = httpx.post(f"{BASE}/api/mini-games/arcade/tap/start", timeout=15.0).json()
    time.sleep(3.0)
    sub = httpx.post(
        f"{BASE}/api/mini-games/arcade/tap/submit",
        json={"play_id": s["play_id"], "anon_id": s["anon_id"], "score": 4},
        timeout=15.0,
    ).json()
    assert sub["score"] == 4
    assert sub["valid_for_leaderboard"] is True


def test_arcade_unknown_game_rejected():
    r = httpx.post(f"{BASE}/api/mini-games/arcade/foobar/start", timeout=15.0)
    assert r.status_code == 400


# ─────────────────────── champions banner ───────────────────────

def test_champions_endpoint_shape():
    r = httpx.get(f"{BASE}/api/mini-games/champions", timeout=15.0).json()
    assert "week_iso" in r and r["week_iso"].startswith("20")
    assert "champions" in r and isinstance(r["champions"], list)
    assert "has_data" in r
    if r["champions"]:
        c = r["champions"][0]
        for key in ("game_slug", "game_title_fi", "play_url",
                    "champion_name", "champion_score", "score_label"):
            assert key in c, f"missing {key} in champion: {c!r}"


# ─────────────────────── admin question editor ───────────────────────

def test_admin_questions_list_requires_auth():
    r = httpx.get(f"{BASE}/api/admin/mini-games/questions", timeout=15.0)
    assert r.status_code in (401, 403, 422)


def test_admin_questions_list_returns_seeded_rows():
    r = httpx.get(
        f"{BASE}/api/admin/mini-games/questions?slug=quiz_gambling_literacy",
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15.0,
    ).json()
    assert "questions" in r
    assert len(r["questions"]) == 10  # the quiz seed has 10 questions
    for q in r["questions"]:
        assert q["slug"] == "quiz_gambling_literacy"
        assert q["prompt_fi"] and q["options"]


def test_admin_upsert_and_delete_question_lifecycle():
    payload = {
        "slug": "quiz_gambling_literacy",
        "order": 999,
        "prompt_fi": "Iter57 test question",
        "options": [{"key": "a", "label_fi": "yes"}, {"key": "b", "label_fi": "no"}],
        "correct": "a",
        "explanation_fi": "Because.",
        "topic_tag": "test",
        "active": False,
    }
    # Create
    r = httpx.post(
        f"{BASE}/api/admin/mini-games/questions",
        json=payload,
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15.0,
    ).json()
    assert r.get("created") or r.get("updated")
    qid = r["id"]

    # Update (same order → update)
    r2 = httpx.post(
        f"{BASE}/api/admin/mini-games/questions",
        json={**payload, "prompt_fi": "Iter57 test question UPDATED"},
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15.0,
    ).json()
    assert r2.get("updated") is True

    # Delete
    d = httpx.delete(
        f"{BASE}/api/admin/mini-games/questions/{qid}",
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=15.0,
    ).json()
    assert d["deleted"] == qid
