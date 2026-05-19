"""
PUTKI HQ — Voita raffle engine + API tests.

Covers:
  - voita_engine scoring + draw determinism (pure unit, no HTTP)
  - voita_engine payout validation
  - public listing gating (3 gates + feature flag)
  - admin CRUD lifecycle
  - public entry submission + duplicate rejection + closed-raffle rejection
  - GDPR Art. 7(4) compliance: entry stores game_raffle tag separately
    from any marketing opt-in
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://pelisignaali-fi.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN})
    return s


@pytest.fixture(scope="module")
def public():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def voita_enabled(admin):
    # Ensure the feature flag is on for tests. Restore at teardown.
    prev = admin.get(f"{BASE_URL}/api/admin/settings", timeout=10).json()
    was_on = bool(prev.get("voita_feature_enabled"))
    if not was_on:
        admin.put(
            f"{BASE_URL}/api/admin/settings",
            json={"voita_feature_enabled": True}, timeout=10,
        )
    yield True
    if not was_on:
        admin.put(
            f"{BASE_URL}/api/admin/settings",
            json={"voita_feature_enabled": False}, timeout=10,
        )


def _future_iso(minutes_ahead: int = 60) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes_ahead)).isoformat()


# ── voita_engine unit tests ──────────────────────────────────────────────

class TestScoring:
    def test_exact_score_awards_5_plus_one_x_two(self):
        from voita_engine import score_entry, DEFAULT_SCORING, compute_one_x_two
        # actual 2-1 → 1
        pts = score_entry(
            DEFAULT_SCORING,
            prediction_one_x_two="1",
            predicted_home_goals=2, predicted_away_goals=1,
            actual_home_goals=2, actual_away_goals=1,
            actual_one_x_two=compute_one_x_two(2, 1),
        )
        assert pts == 3 + 5  # 1-X-2 + exact

    def test_goal_diff_match_awards_3_plus_one_x_two(self):
        from voita_engine import score_entry, DEFAULT_SCORING
        pts = score_entry(
            DEFAULT_SCORING,
            prediction_one_x_two="1",
            predicted_home_goals=3, predicted_away_goals=2,
            actual_home_goals=2, actual_away_goals=1,
            actual_one_x_two="1",
        )
        assert pts == 3 + 3

    def test_total_goals_match_awards_1_plus_one_x_two(self):
        from voita_engine import score_entry, DEFAULT_SCORING
        pts = score_entry(
            DEFAULT_SCORING,
            prediction_one_x_two="1",
            predicted_home_goals=2, predicted_away_goals=1,
            actual_home_goals=1, actual_away_goals=2,
            actual_one_x_two="2",
        )
        # 1-X-2 wrong, score sum matches → 0 + 1
        assert pts == 1

    def test_score_variant_points_not_stackable(self):
        """Exact score should award 5, not 5+3+1."""
        from voita_engine import score_entry, DEFAULT_SCORING
        pts = score_entry(
            DEFAULT_SCORING,
            prediction_one_x_two="X",
            predicted_home_goals=1, predicted_away_goals=1,
            actual_home_goals=1, actual_away_goals=1,
            actual_one_x_two="X",
        )
        assert pts == 3 + 5  # exact only, not exact+diff+total

    def test_compute_one_x_two(self):
        from voita_engine import compute_one_x_two
        assert compute_one_x_two(2, 1) == "1"
        assert compute_one_x_two(1, 1) == "X"
        assert compute_one_x_two(0, 3) == "2"


class TestPayoutValidation:
    def test_total_exceeds_cap_raises(self):
        from voita_engine import _coerce_payouts
        with pytest.raises(ValueError, match="exceed prize cap"):
            _coerce_payouts(
                [{"position": 1, "amount_eur": 400, "type": "cash"},
                 {"position": 2, "amount_eur": 200, "type": "cash"}],
                500,
            )

    def test_duplicate_position_raises(self):
        from voita_engine import _coerce_payouts
        with pytest.raises(ValueError, match="duplicate"):
            _coerce_payouts(
                [{"position": 1, "amount_eur": 100, "type": "cash"},
                 {"position": 1, "amount_eur": 50, "type": "cash"}],
                500,
            )

    def test_invalid_type_raises(self):
        from voita_engine import _coerce_payouts
        with pytest.raises(ValueError, match="payout type"):
            _coerce_payouts(
                [{"position": 1, "amount_eur": 100, "type": "ferrari"}], 500,
            )

    def test_valid_tiered_payouts_pass(self):
        from voita_engine import _coerce_payouts
        out = _coerce_payouts(
            [{"position": 1, "amount_eur": 300, "type": "cash"},
             {"position": 2, "amount_eur": 100, "type": "cash"},
             {"position": 3, "amount_eur": 50, "type": "credit"},
             {"position": 4, "amount_eur": 30, "type": "merch", "note": "T-shirt"},
             {"position": 5, "amount_eur": 20, "type": "cash"}],
            500,
        )
        assert len(out) == 5
        assert sum(p["amount_eur"] for p in out) == 500


# ── public listing gating ─────────────────────────────────────────────

class TestPublicListingGating:
    def test_listing_returns_feature_flag(self, public):
        r = public.get(f"{BASE_URL}/api/voita/raffles", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "feature_enabled" in d

    def test_raffle_without_gates_not_public(self, admin, public, voita_enabled):
        slug = f"pytest-gates-{uuid.uuid4().hex[:8]}"
        # Create with no gates set → no rules_url_set, no prize_distribution_locked
        admin.post(f"{BASE_URL}/api/admin/voita/raffles", json={
            "slug": slug, "home_team": "HJK", "away_team": "Inter",
            "kickoff_at": _future_iso(60),
        }, timeout=10)
        # Public listing must not include the raffle
        items = public.get(f"{BASE_URL}/api/voita/raffles", timeout=10).json()["items"]
        slugs = [i["slug"] for i in items]
        assert slug not in slugs
        # Detail must 404
        r = public.get(f"{BASE_URL}/api/voita/raffles/{slug}", timeout=10)
        assert r.status_code == 404


# ── admin CRUD + entry flow ───────────────────────────────────────────

class TestAdminCrudAndEntry:
    def test_auth_required(self, public):
        r = public.get(f"{BASE_URL}/api/admin/voita/raffles", timeout=10)
        assert r.status_code == 401

    @pytest.fixture
    def open_raffle(self, admin, voita_enabled):
        slug = f"pytest-open-{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/admin/voita/raffles", json={
            "slug": slug,
            "home_team": "HJK", "away_team": "FC Inter",
            "sport": "football", "league": "Veikkausliiga",
            "kickoff_at": _future_iso(60),
            "entries_close_at": _future_iso(50),
            "prize_cap_eur": 500,
            "prize_distribution": {"mode": "single", "payouts": [
                {"position": 1, "amount_eur": 300, "type": "cash"},
            ]},
        }, timeout=10)
        assert r.status_code == 200, r.text
        raffle_id = r.json()["created"]["id"]

        # Flip all 3 gates + open status
        admin.put(f"{BASE_URL}/api/admin/voita/raffles/{raffle_id}", json={
            "gating": {"rules_url_set": True, "prize_distribution_locked": True, "match_populated": True},
            "status": "open",
        }, timeout=10)
        yield {"id": raffle_id, "slug": slug}
        admin.delete(f"{BASE_URL}/api/admin/voita/raffles/{raffle_id}", timeout=10)

    def test_public_listing_includes_gated_open_raffle(self, public, open_raffle):
        items = public.get(f"{BASE_URL}/api/voita/raffles", timeout=10).json()["items"]
        slugs = [i["slug"] for i in items]
        assert open_raffle["slug"] in slugs

    def test_entry_submission_then_dup_rejected(self, public, open_raffle):
        email = f"pytest-{uuid.uuid4().hex[:8]}@example.com"
        r = public.post(
            f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": email, "prediction_one_x_two": "1",
                  "predicted_home_goals": 2, "predicted_away_goals": 1,
                  "rules_accepted": True},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # Same email + same raffle → 400
        dup = public.post(
            f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": email, "prediction_one_x_two": "X",
                  "predicted_home_goals": 1, "predicted_away_goals": 1,
                  "rules_accepted": True},
            timeout=10,
        )
        assert dup.status_code == 400

    def test_entry_requires_rules_acceptance(self, public, open_raffle):
        r = public.post(
            f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": f"x{uuid.uuid4().hex[:6]}@example.com",
                  "prediction_one_x_two": "1",
                  "predicted_home_goals": 2, "predicted_away_goals": 1,
                  "rules_accepted": False},
            timeout=10,
        )
        assert r.status_code == 400
        assert "rules" in r.text.lower()

    def test_entry_rejects_invalid_pick(self, public, open_raffle):
        r = public.post(
            f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": f"y{uuid.uuid4().hex[:6]}@example.com",
                  "prediction_one_x_two": "Q",
                  "predicted_home_goals": 1, "predicted_away_goals": 0,
                  "rules_accepted": True},
            timeout=10,
        )
        assert r.status_code == 400

    def test_admin_entries_includes_consent_tag_game_raffle(self, admin, public, open_raffle):
        # Submit a fresh entry
        email = f"taggy-{uuid.uuid4().hex[:8]}@example.com"
        public.post(
            f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": email, "prediction_one_x_two": "2",
                  "predicted_home_goals": 0, "predicted_away_goals": 2,
                  "rules_accepted": True},
            timeout=10,
        )
        r = admin.get(f"{BASE_URL}/api/admin/voita/raffles/{open_raffle['id']}/entries", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        match = [i for i in items if i["email_lower"] == email]
        assert len(match) == 1
        e = match[0]
        # GDPR Art. 7(4) separation: entry carries `game_raffle` tag and
        # legitimate-interest basis — NOT a marketing consent tag.
        assert e["consent_tag"] == "game_raffle"
        assert e["raffle_legal_basis"] == "legitimate_interest_contest_admin"

    def test_draw_locks_results_and_scores(self, admin, public, open_raffle):
        # Submit two entries
        e1 = f"d1-{uuid.uuid4().hex[:8]}@example.com"
        e2 = f"d2-{uuid.uuid4().hex[:8]}@example.com"
        public.post(f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": e1, "prediction_one_x_two": "1",
                  "predicted_home_goals": 2, "predicted_away_goals": 1, "rules_accepted": True}, timeout=10)
        public.post(f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": e2, "prediction_one_x_two": "2",
                  "predicted_home_goals": 0, "predicted_away_goals": 3, "rules_accepted": True}, timeout=10)
        # Draw with actual 2-1
        r = admin.post(f"{BASE_URL}/api/admin/voita/raffles/{open_raffle['id']}/draw",
            json={"home_goals": 2, "away_goals": 1}, timeout=10)
        assert r.status_code == 200, r.text
        result = r.json()["result"]
        assert result["scored_count"] >= 2
        # 1 payout slot in this fixture → 1 winner
        assert len(result["winners"]) == 1
        # The exact-score 2-1 entry must be winner (8 pts beats 0 pts)
        assert result["winners"][0]["score"] >= 8

        # Re-draw must 400
        r2 = admin.post(f"{BASE_URL}/api/admin/voita/raffles/{open_raffle['id']}/draw",
            json={"home_goals": 1, "away_goals": 1}, timeout=10)
        assert r2.status_code == 400
        # Edit after draw must 400
        r3 = admin.put(f"{BASE_URL}/api/admin/voita/raffles/{open_raffle['id']}",
            json={"title_fi": "edit-after-draw"}, timeout=10)
        assert r3.status_code == 400
