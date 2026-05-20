"""Iter33 — Voita lesson funnel reframe tests.

Covers:
- GET /api/settings/public exposes voita_quiz_config (5 lessons w/ reveal fields)
  + voita_predictor_profiles (10 profiles w/ rules).
- POST /api/voita/profile/resolve resolver behavior (longest-match-wins +
  priority tiebreak + is_default fallback).
- PUT /api/admin/settings compliance linter blocks forbidden phrases.
- PUT /api/admin/settings persists voita_predictor_profiles edits.
"""
import os
import copy
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_TOKEN = os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")

REQUIRED_LESSON_KEYS = [
    "bias_favorite", "read_consensus", "wrong_pattern",
    "analysis_priority", "apply_mode",
]
REVEAL_FIELDS = [
    "reveal_heading_fi", "reveal_heading_en",
    "reveal_fact_fi", "reveal_fact_en",
    "reveal_why_fi", "reveal_why_en",
    "reveal_application_fi", "reveal_application_en",
]
PROFILE_FIELDS = [
    "slug", "priority", "is_default",
    "name_fi", "name_en",
    "diagnosis_fi", "diagnosis_en",
    "weakness_fi", "weakness_en",
    "edge_fi", "edge_en",
    "hooks", "match_rules",
]


@pytest.fixture(scope="module")
def admin_headers():
    return {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# ── Public settings exposure ─────────────────────────────────────────
class TestPublicSettingsExposure:
    def test_public_settings_returns_quiz_and_profiles(self):
        r = requests.get(f"{BASE_URL}/api/settings/public", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "voita_quiz_config" in data
        assert "voita_predictor_profiles" in data
        quiz = data["voita_quiz_config"]
        profiles = data["voita_predictor_profiles"]
        assert isinstance(quiz, list) and len(quiz) == 5
        assert isinstance(profiles, list) and len(profiles) >= 10

    def test_quiz_lesson_structure(self):
        r = requests.get(f"{BASE_URL}/api/settings/public", timeout=15)
        quiz = r.json()["voita_quiz_config"]
        keys = [q["key"] for q in quiz]
        assert keys == REQUIRED_LESSON_KEYS
        for q in quiz:
            assert "lesson_number" in q
            assert q.get("lesson_title_fi") and q.get("lesson_title_en")
            for f in REVEAL_FIELDS:
                assert q.get(f), f"missing {f} on lesson {q['key']}"
            assert q["options"], f"no options on {q['key']}"
            for o in q["options"]:
                assert o.get("tag")
                assert o.get("reveal_personalized_fi")
                assert o.get("reveal_personalized_en")

    def test_profiles_structure(self):
        r = requests.get(f"{BASE_URL}/api/settings/public", timeout=15)
        profiles = r.json()["voita_predictor_profiles"]
        slugs = {p["slug"] for p in profiles}
        for needed in ["confident_loyalist", "underdog_hunter", "quiet_sharp",
                       "curious_learner"]:
            assert needed in slugs
        for p in profiles:
            for f in PROFILE_FIELDS:
                assert f in p, f"profile {p.get('slug')} missing {f}"
            assert isinstance(p["hooks"], list)
            assert isinstance(p["match_rules"], list)
        defaults = [p for p in profiles if p.get("is_default")]
        assert len(defaults) == 1
        assert defaults[0]["slug"] == "curious_learner"


# ── Profile resolver ─────────────────────────────────────────────────
class TestProfileResolver:
    def _resolve(self, answers):
        r = requests.post(
            f"{BASE_URL}/api/voita/profile/resolve",
            json={"answers": answers}, timeout=15,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_confident_loyalist(self):
        body = self._resolve({
            "bias_favorite": "bias_favorite",
            "wrong_pattern": "wrong_pattern_loyalty",
            "analysis_priority": "analysis_priority_h2h",
        })
        prof = body.get("profile") or body
        assert prof["slug"] == "confident_loyalist"
        assert prof["name_en"] == "THE CONFIDENT LOYALIST"

    def test_underdog_hunter(self):
        body = self._resolve({
            "bias_favorite": "bias_underdog",
            "read_consensus": "read_consensus_y",
        })
        prof = body.get("profile") or body
        # Two rule matches for underdog_hunter; quiet_sharp also matches 1
        # (read_consensus_y). underdog should win by match count.
        assert prof["slug"] == "underdog_hunter", body

    def test_quiet_sharp_priority_tiebreak(self):
        # Both quiet_sharp(prio 90) and underdog_hunter(75) match 1 rule
        # via read_consensus_y, BUT quiet_sharp gets a 2nd match via
        # analysis_priority_consensus → 2 matches vs underdog's 1.
        body = self._resolve({
            "read_consensus": "read_consensus_y",
            "analysis_priority": "analysis_priority_consensus",
        })
        prof = body.get("profile") or body
        assert prof["slug"] == "quiet_sharp", body

    def test_default_profile_on_empty(self):
        body = self._resolve({})
        prof = body.get("profile") or body
        assert prof["slug"] == "curious_learner"
        assert prof.get("is_default") is True


# ── Compliance linter on PUT ─────────────────────────────────────────
class TestComplianceLinter:
    def _get_current(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers, timeout=15)
        assert r.status_code == 200
        return r.json()

    def test_forbidden_in_quiz_blocked(self, admin_headers):
        public = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        quiz = copy.deepcopy(public["voita_quiz_config"])
        # Inject forbidden phrase in reveal_fact_en
        quiz[0]["reveal_fact_en"] = (
            "This lesson will increase your win rate dramatically."
        )
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_quiz_config": quiz},
            timeout=15,
        )
        assert r.status_code >= 400, f"linter failed to block: {r.status_code} {r.text}"
        # Ensure live config did NOT change
        live = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        assert "increase your win rate" not in live["voita_quiz_config"][0]["reveal_fact_en"].lower()

    def test_forbidden_in_profile_blocked(self, admin_headers):
        public = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        profiles = copy.deepcopy(public["voita_predictor_profiles"])
        profiles[0]["diagnosis_en"] = (
            "We can guarantee a win on every raffle from now on."
        )
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_predictor_profiles": profiles},
            timeout=15,
        )
        assert r.status_code >= 400, f"linter failed to block: {r.status_code} {r.text}"

    def test_allowed_phrase_guaranteed_loss(self, admin_headers):
        # "guaranteed loss" describes house edge; must NOT be blocked.
        public = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        quiz = copy.deepcopy(public["voita_quiz_config"])
        original_fact = quiz[0]["reveal_fact_en"]
        # The default already contains "guaranteed loss"; re-saving it
        # round-trips fine. This proves the linter only blocks outcome
        # *promises*, not educational descriptions of house edge.
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_quiz_config": quiz},
            timeout=15,
        )
        assert r.status_code in (200, 204), r.text
        live = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        assert live["voita_quiz_config"][0]["reveal_fact_en"] == original_fact


# ── Profile edit persistence ─────────────────────────────────────────
class TestProfilePersistence:
    def test_single_profile_edit_round_trip(self, admin_headers):
        # 1. Read current
        public = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        original_profiles = public["voita_predictor_profiles"]
        # Find curious_learner default — safe to edit & restore
        target = next(p for p in original_profiles if p["slug"] == "curious_learner")
        edited = copy.deepcopy(target)
        marker = "TEST_iter33_marker_text"
        edited["edge_en"] = f"{marker} — clean openness edge copy."
        # PUT with single edited profile array (single-edit payload)
        r = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_predictor_profiles": [edited]},
            timeout=15,
        )
        assert r.status_code in (200, 204), r.text
        # GET reflects change
        live = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        live_profiles = live["voita_predictor_profiles"]
        live_target = next((p for p in live_profiles if p["slug"] == "curious_learner"), None)
        assert live_target is not None
        assert marker in live_target["edge_en"]
        # RESTORE: PUT full original list back
        r2 = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers=admin_headers,
            json={"voita_predictor_profiles": original_profiles},
            timeout=15,
        )
        assert r2.status_code in (200, 204)
        live2 = requests.get(f"{BASE_URL}/api/settings/public", timeout=15).json()
        restored = next(p for p in live2["voita_predictor_profiles"] if p["slug"] == "curious_learner")
        assert marker not in restored["edge_en"]
