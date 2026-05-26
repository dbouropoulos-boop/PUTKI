"""iter63 - Identity Result Card backend payload tests.

Verifies that POST /api/mini-games/{quiz|scenario|insight|arcade}/finish|submit
return a `card` object with the full bilingual psychological payload
required by the new IdentityResultCard + MicroYesGate frontend.
"""
import os
import uuid
import re
import pytest
import requests

def _load_backend_url():
    # iter75d - prefer localhost during pytest runs. The previous code
    # routed every request through the public ingress
    # (REACT_APP_BACKEND_URL), which slows + occasionally times out
    # during the broad-sweep pytest run. The internal port is faster +
    # bypasses the proxy. PUTKI_TEST_USE_INGRESS=1 forces the old
    # behaviour for e2e validation.
    if not os.environ.get("PUTKI_TEST_USE_INGRESS"):
        return "http://localhost:8001"
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # fallback - read from frontend/.env (cannot hardcode)
        envp = "/app/frontend/.env"
        if os.path.exists(envp):
            with open(envp) as f:
                for line in f:
                    if line.strip().startswith("REACT_APP_BACKEND_URL="):
                        url = line.strip().split("=", 1)[1]
                        break
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

EXPECTED_CARD_KEYS = {
    "profile_index",
    "stat_value",
    "stat_label_fi", "stat_label_en",
    "stat_footnote_fi", "stat_footnote_en",
    "verdict_fi", "verdict_en",
    "hook_text_fi", "hook_text_en",
    "read_line_fi", "read_line_en",
    "weak_topic_tag",
}


def _assert_card_shape(card):
    assert isinstance(card, dict), "card must be an object"
    missing = EXPECTED_CARD_KEYS - set(card.keys())
    assert not missing, f"card missing keys: {missing}"
    # stat_value 0..100
    assert isinstance(card["stat_value"], int)
    assert 0 <= card["stat_value"] <= 100
    # profile_index pattern "NN / NN"
    assert re.match(r"^\d{2} / \d{2}$", card["profile_index"]), card["profile_index"]
    # FI/EN strings non-empty
    for k in ["verdict_fi", "verdict_en", "hook_text_fi", "hook_text_en",
              "read_line_fi", "read_line_en", "stat_label_fi", "stat_label_en"]:
        assert isinstance(card[k], str) and card[k].strip(), f"{k} empty"
    # hook_text has <em>...</em>
    assert "<em>" in card["hook_text_fi"] and "</em>" in card["hook_text_fi"]
    assert "<em>" in card["hook_text_en"] and "</em>" in card["hook_text_en"]
    # Footnote copy
    assert "Korkeampi kuin" in card["stat_footnote_fi"]
    assert "pelaajista" in card["stat_footnote_fi"]
    assert "Higher than" in card["stat_footnote_en"]
    assert "players this week" in card["stat_footnote_en"]


# ─────────────── Quiz ───────────────
class TestQuizCard:
    def test_quiz_finish_returns_card(self):
        start = requests.post(f"{API}/mini-games/quiz/start", timeout=15)
        assert start.status_code == 200, start.text
        data = start.json()
        play_id = data["play_id"]
        anon_id = data["anon_id"]
        questions = data["questions"]

        # Answer all questions with the first option
        answers = [
            {"q_id": q["id"], "picked": q["options"][0]["key"]}
            for q in questions
        ]
        finish = requests.post(
            f"{API}/mini-games/quiz/finish",
            json={"play_id": play_id, "anon_id": anon_id, "answers": answers},
            timeout=15,
        )
        assert finish.status_code == 200, finish.text
        body = finish.json()
        assert "card" in body, f"missing 'card' in: {list(body.keys())}"
        _assert_card_shape(body["card"])
        # Quiz-specific labels
        assert body["card"]["stat_label_fi"] == "Tieto-indeksi"
        assert body["card"]["stat_label_en"] == "Awareness index"


# ─────────────── Scenario ───────────────
class TestScenarioCard:
    def test_scenario_finish_returns_card(self):
        start = requests.post(f"{API}/mini-games/scenario/start", timeout=15)
        assert start.status_code == 200, start.text
        data = start.json()
        play_id = data["play_id"]
        anon_id = data["anon_id"]
        scenarios = data.get("scenarios") or data.get("questions") or []
        assert scenarios, f"no scenarios in start payload: {list(data.keys())}"
        answers = [
            {"q_id": s["id"], "picked": s["options"][0]["key"]}
            for s in scenarios
        ]
        finish = requests.post(
            f"{API}/mini-games/scenario/finish",
            json={"play_id": play_id, "anon_id": anon_id, "answers": answers},
            timeout=15,
        )
        assert finish.status_code == 200, finish.text
        body = finish.json()
        assert "card" in body, f"missing 'card' in: {list(body.keys())}"
        _assert_card_shape(body["card"])
        assert body["card"]["stat_label_fi"] == "Kurin indeksi"


# ─────────────── Insight ───────────────
class TestInsightCard:
    def test_insight_finish_returns_card(self):
        start = requests.post(f"{API}/mini-games/insight/start", timeout=15)
        assert start.status_code == 200, start.text
        data = start.json()
        play_id = data["play_id"]
        anon_id = data["anon_id"]
        tiles = data.get("tiles") or data.get("questions") or []

        assert tiles, f"no tiles in start payload: {list(data.keys())}"

        # Reveal at least 3 tiles
        for t in tiles[:3]:
            r = requests.post(
                f"{API}/mini-games/insight/reveal",
                json={"play_id": play_id, "anon_id": anon_id, "q_id": t["id"]},
                timeout=15,
            )
            assert r.status_code == 200, r.text

        finish = requests.post(
            f"{API}/mini-games/insight/finish",
            json={"play_id": play_id, "anon_id": anon_id},
            timeout=15,
        )
        assert finish.status_code == 200, finish.text
        body = finish.json()
        assert "card" in body, f"missing 'card' in: {list(body.keys())}"
        _assert_card_shape(body["card"])
        assert body["card"]["stat_label_fi"] == "Avaus-indeksi"


# ─────────────── Arcade (Snake + Tap) ───────────────
@pytest.mark.parametrize("game", ["snake", "tap"])
class TestArcadeCard:
    def test_arcade_submit_returns_card(self, game):
        start = requests.post(f"{API}/mini-games/arcade/{game}/start", timeout=15)
        assert start.status_code == 200, start.text
        sdata = start.json()
        play_id = sdata["play_id"]
        anon_id = sdata["anon_id"]
        submit = requests.post(
            f"{API}/mini-games/arcade/{game}/submit",
            json={"play_id": play_id, "anon_id": anon_id, "score": 250},
            timeout=15,
        )
        assert submit.status_code == 200, submit.text
        body = submit.json()
        assert "card" in body, f"missing 'card' in: {list(body.keys())}"
        _assert_card_shape(body["card"])
        assert body["card"]["stat_label_fi"] == "Refleksi-indeksi"
        assert body["card"]["stat_label_en"] == "Reflex index"


# ─────────────── Percentile copy contract ───────────────
class TestPercentileCopy:
    def test_quiz_percentile_format(self):
        start = requests.post(f"{API}/mini-games/quiz/start", timeout=15).json()
        play_id = start["play_id"]
        anon_id = start["anon_id"]
        answers = [
            {"q_id": q["id"], "picked": q["options"][0]["key"]}
            for q in start["questions"]
        ]
        body = requests.post(
            f"{API}/mini-games/quiz/finish",
            json={"play_id": play_id, "anon_id": anon_id, "answers": answers},
            timeout=15,
        ).json()
        card = body["card"]
        # Exact phrase contract
        assert re.match(r"^Korkeampi kuin \d{1,2}% pelaajista tällä viikolla\.$",
                        card["stat_footnote_fi"]), card["stat_footnote_fi"]
        assert re.match(r"^Higher than \d{1,2}% of players this week\.$",
                        card["stat_footnote_en"]), card["stat_footnote_en"]
