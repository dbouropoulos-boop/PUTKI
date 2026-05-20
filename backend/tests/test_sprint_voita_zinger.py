"""Iter34 — Voita SHRINK reframe (zingers + 11 profiles + new tag vocab).

Validates:
- voita_quiz_config: zinger_fi/en per lesson; Q3 has bias_* tags; Q5 has 4 mode_* tags.
- Q3 options carry zinger_personalized_fi/en.
- voita_predictor_profiles: 11 profiles incl. second_guesser, chaos_bettor, rival_hunter,
  honest_beginner; on_site_tease_fi/en present; balanced_observer + situational_chaser NOT present.
- POST /api/voita/profile/resolve with the new vocab → expected profiles.
- PUT /api/admin/settings compliance linter blocks forbidden zinger_en + on_site_tease_en.
- POST /api/voita/raffles/{slug}/enter still works (existing endpoint, no regression).
"""
import os
import copy
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_TOKEN = os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")
ACTIVE_SLUG = "kups-hjk-veikkausliiga-final-2026"


@pytest.fixture(scope="module")
def public_settings():
    r = requests.get(f"{BASE_URL}/api/settings/public", timeout=15)
    assert r.status_code == 200, f"settings/public failed: {r.status_code}"
    return r.json()


@pytest.fixture(scope="module")
def admin_headers():
    return {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# ── Quiz config (zingers + new vocab) ────────────────────────────────
class TestQuizConfigShape:
    def test_five_lessons_all_have_zinger_fi_en(self, public_settings):
        quiz = public_settings["voita_quiz_config"]
        assert isinstance(quiz, list) and len(quiz) == 5
        for q in quiz:
            assert q.get("zinger_fi"), f"missing zinger_fi on {q.get('key')}"
            assert q.get("zinger_en"), f"missing zinger_en on {q.get('key')}"
            assert isinstance(q["zinger_fi"], str) and len(q["zinger_fi"]) > 0
            assert isinstance(q["zinger_en"], str) and len(q["zinger_en"]) > 0

    def test_q1_zinger_en_mentions_favorites(self, public_settings):
        quiz = public_settings["voita_quiz_config"]
        q1 = next(q for q in quiz if q["key"] == "bias_favorite")
        # Expect the lesson 1 zinger copy per the spec
        assert "67%" in q1["zinger_en"] and "62%" in q1["zinger_en"]
        assert "Lesson 1" in q1["zinger_en"]

    def test_q3_tags_are_bias_vocab(self, public_settings):
        quiz = public_settings["voita_quiz_config"]
        q3 = next(q for q in quiz if q["key"] == "wrong_pattern")
        tags = {o["tag"] for o in q3["options"]}
        expected = {"bias_loyalty", "bias_gut", "bias_crowd", "bias_overthink", "bias_unknown"}
        assert expected.issubset(tags), f"missing tags {expected - tags}, got {tags}"

    def test_q3_options_have_zinger_personalized_fi_en(self, public_settings):
        quiz = public_settings["voita_quiz_config"]
        q3 = next(q for q in quiz if q["key"] == "wrong_pattern")
        for o in q3["options"]:
            assert o.get("zinger_personalized_fi"), f"missing zinger_personalized_fi on {o['v']}"
            assert o.get("zinger_personalized_en"), f"missing zinger_personalized_en on {o['v']}"

    def test_q3_overthink_personalized_zinger_copy(self, public_settings):
        quiz = public_settings["voita_quiz_config"]
        q3 = next(q for q in quiz if q["key"] == "wrong_pattern")
        ov = next(o for o in q3["options"] if o["tag"] == "bias_overthink")
        # Spec: "Your first read is usually correct. Lesson 3 says why."
        assert "first read" in ov["zinger_personalized_en"].lower()
        assert "lesson 3" in ov["zinger_personalized_en"].lower()

    def test_q5_has_four_mode_options(self, public_settings):
        quiz = public_settings["voita_quiz_config"]
        q5 = next(q for q in quiz if q["key"] == "apply_mode")
        tags = {o["tag"] for o in q5["options"]}
        expected = {"mode_snap", "mode_slow", "mode_social", "mode_chaos"}
        assert tags == expected, f"expected exactly {expected}, got {tags}"
        # Old vocab MUST be gone
        assert not ({"mode_data", "mode_gut", "mode_editorial"} & tags)


# ── Profiles (11 total, new slugs, on_site_tease) ────────────────────
class TestPredictorProfiles:
    def test_eleven_profiles_total(self, public_settings):
        profiles = public_settings["voita_predictor_profiles"]
        assert isinstance(profiles, list)
        assert len(profiles) == 11, f"expected 11 profiles, got {len(profiles)}"

    def test_required_new_slugs_present(self, public_settings):
        slugs = {p["slug"] for p in public_settings["voita_predictor_profiles"]}
        required = {"second_guesser", "chaos_bettor", "rival_hunter", "honest_beginner",
                    "curious_learner", "confident_loyalist", "gut_player", "underdog_hunter",
                    "quiet_sharp", "cautious_analyst", "crowd_follower"}
        assert required == slugs, f"diff: missing={required - slugs} extra={slugs - required}"

    def test_dropped_profiles_absent(self, public_settings):
        slugs = {p["slug"] for p in public_settings["voita_predictor_profiles"]}
        assert "balanced_observer" not in slugs
        assert "situational_chaser" not in slugs

    def test_each_profile_has_on_site_tease_fi_en(self, public_settings):
        for p in public_settings["voita_predictor_profiles"]:
            assert p.get("on_site_tease_fi"), f"{p['slug']} missing on_site_tease_fi"
            assert p.get("on_site_tease_en"), f"{p['slug']} missing on_site_tease_en"

    def test_only_curious_learner_is_default(self, public_settings):
        defaults = [p for p in public_settings["voita_predictor_profiles"] if p.get("is_default")]
        assert len(defaults) == 1
        assert defaults[0]["slug"] == "curious_learner"


# ── Resolver with the new tag vocab ──────────────────────────────────
class TestResolverNewVocab:
    @pytest.mark.parametrize("answers,expected_slug", [
        ({"bias_favorite": "bias_favorite", "wrong_pattern": "bias_loyalty"}, "confident_loyalist"),
        ({"wrong_pattern": "bias_overthink", "apply_mode": "mode_slow"}, "cautious_analyst"),
        ({"wrong_pattern": "bias_overthink", "apply_mode": "mode_chaos"}, "second_guesser"),
        ({"apply_mode": "mode_chaos", "bias_favorite": "bias_situational"}, "chaos_bettor"),
        ({"wrong_pattern": "bias_unknown"}, "honest_beginner"),
        ({"wrong_pattern": "bias_gut", "apply_mode": "mode_snap"}, "gut_player"),
        ({"wrong_pattern": "bias_gut", "bias_favorite": "bias_situational"}, "rival_hunter"),
        ({}, "curious_learner"),
    ])
    def test_resolver_matrix(self, answers, expected_slug):
        r = requests.post(
            f"{BASE_URL}/api/voita/profile/resolve",
            json={"answers": answers}, timeout=15,
        )
        assert r.status_code == 200, f"resolve failed {r.status_code}: {r.text[:200]}"
        body = r.json()
        # Profile may come back nested or flat
        profile = body.get("profile") or body
        assert profile.get("slug") == expected_slug, (
            f"answers={answers} -> got {profile.get('slug')}, expected {expected_slug}"
        )


# ── Compliance linter on PUT /api/admin/settings ─────────────────────
class TestComplianceLinter:
    def test_forbidden_zinger_en_in_quiz_config_blocked(self, admin_headers, public_settings):
        bad_quiz = copy.deepcopy(public_settings["voita_quiz_config"])
        bad_quiz[0]["zinger_en"] = "We guarantee a win every time you bet."
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_quiz_config": bad_quiz},
            timeout=15,
        )
        assert 400 <= r.status_code < 500, (
            f"expected 4xx, got {r.status_code}: {r.text[:300]}"
        )

    def test_forbidden_on_site_tease_en_in_profile_blocked(self, admin_headers, public_settings):
        bad_profiles = copy.deepcopy(public_settings["voita_predictor_profiles"])
        bad_profiles[0]["on_site_tease_en"] = (
            bad_profiles[0]["on_site_tease_en"] + " We guarantee a win."
        )
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_predictor_profiles": bad_profiles},
            timeout=15,
        )
        assert 400 <= r.status_code < 500, (
            f"expected 4xx, got {r.status_code}: {r.text[:300]}"
        )


# ── Raffle entry endpoint still works ────────────────────────────────
class TestRaffleEntryRegression:
    def test_post_raffle_enter_returns_2xx(self):
        payload = {
            "email": f"TEST_iter34_{uuid.uuid4().hex[:6]}@example.com",
            "prediction_one_x_two": "1",
            "predicted_home_goals": 2,
            "predicted_away_goals": 1,
            "rules_accepted": True,
            "display_name": "TEST_iter34",
        }
        r = requests.post(
            f"{BASE_URL}/api/voita/raffles/{ACTIVE_SLUG}/enter",
            json=payload, timeout=20,
        )
        # Accept 200/201; tolerate validation differences in payload shape
        assert r.status_code in (200, 201), (
            f"enter endpoint returned {r.status_code}: {r.text[:400]}"
        )
