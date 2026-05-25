"""
PUTKI HQ - Voita refinements (recent-winners strip masking, paid status,
display_name, ?status=paid filter).
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
    return requests.Session()


@pytest.fixture(scope="module", autouse=True)
def voita_enabled(admin):
    prev = admin.get(f"{BASE_URL}/api/admin/settings", timeout=10).json()
    was_on = bool(prev.get("voita_feature_enabled"))
    if not was_on:
        admin.put(f"{BASE_URL}/api/admin/settings",
                  json={"voita_feature_enabled": True}, timeout=10)
    yield True
    if not was_on:
        admin.put(f"{BASE_URL}/api/admin/settings",
                  json={"voita_feature_enabled": False}, timeout=10)


def _future_iso(minutes_ahead: int = 60) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes_ahead)).isoformat()


# ── mask_email rules (Finnish small-market identifiability) ──

class TestMaskEmail:
    def test_major_provider_shows_domain(self):
        from voita_engine import mask_email
        assert mask_email("alice@gmail.com") == "a***@gmail.com"
        assert mask_email("bob@hotmail.com") == "b***@hotmail.com"
        assert mask_email("carol@outlook.com") == "c***@outlook.com"
        assert mask_email("dave@icloud.com") == "d***@icloud.com"
        assert mask_email("eve@proton.me") == "e***@proton.me"

    def test_non_major_domain_masked_to_tld(self):
        from voita_engine import mask_email
        assert mask_email("mikko@yritys.fi") == "m***@***.fi"
        assert mask_email("anna@startup.io") == "a***@***.io"
        assert mask_email("k@putkihq.fi") == "k***@***.fi"

    def test_firstname_lastname_masks_local_part_fully(self):
        from voita_engine import mask_email
        assert mask_email("mikko.virtanen@gmail.com") == "***@gmail.com"
        assert mask_email("anna.korhonen@hotmail.com") == "***@hotmail.com"
        # Stacks with TLD masking for non-major domains
        assert mask_email("jukka.lehto@yritys.fi") == "***@***.fi"

    def test_short_local_part_not_treated_as_full_name(self):
        from voita_engine import mask_email
        # "a.b@gmail.com" - parts are < 2 chars each, so NOT full-name
        assert mask_email("a.b@gmail.com") == "a***@gmail.com"

    def test_local_with_digits_not_treated_as_full_name(self):
        from voita_engine import mask_email
        # "mikko23@gmail.com" - no period, so just first-char + ***
        assert mask_email("mikko23@gmail.com") == "m***@gmail.com"
        # "mikko.99@gmail.com" - has period but second part is digits
        assert mask_email("mikko.99@gmail.com") == "m***@gmail.com"

    def test_empty_and_invalid_return_empty(self):
        from voita_engine import mask_email
        assert mask_email("") == ""
        assert mask_email("no-at-symbol") == ""
        assert mask_email(None) == ""


# ── display_name capture ──

class TestDisplayName:
    @pytest.fixture
    def open_raffle(self, admin):
        slug = f"pytest-displayname-{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/admin/voita/raffles", json={
            "slug": slug, "home_team": "HJK", "away_team": "Inter",
            "sport": "football",
            "kickoff_at": _future_iso(60),
            "entries_close_at": _future_iso(50),
            "prize_cap_eur": 500,
            "prize_distribution": {"mode": "single", "payouts": [
                {"position": 1, "amount_eur": 250, "type": "cash"},
            ]},
        }, timeout=10)
        rid = r.json()["created"]["id"]
        admin.put(f"{BASE_URL}/api/admin/voita/raffles/{rid}", json={
            "gating": {"rules_url_set": True, "prize_distribution_locked": True, "match_populated": True},
            "status": "open",
        }, timeout=10)
        yield {"id": rid, "slug": slug}
        admin.delete(f"{BASE_URL}/api/admin/voita/raffles/{rid}", timeout=10)

    def test_display_name_optional_capture(self, public, admin, open_raffle):
        email = f"dn-{uuid.uuid4().hex[:8]}@gmail.com"
        public.post(f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": email, "prediction_one_x_two": "1",
                  "predicted_home_goals": 2, "predicted_away_goals": 1,
                  "rules_accepted": True,
                  "display_name": "Mikko V."},
            timeout=10)
        entries = admin.get(f"{BASE_URL}/api/admin/voita/raffles/{open_raffle['id']}/entries", timeout=10).json()["items"]
        match = [e for e in entries if e["email_lower"] == email]
        assert len(match) == 1
        assert match[0]["display_name"] == "Mikko V."

    def test_display_name_sanitized(self, public, admin, open_raffle):
        email = f"sn-{uuid.uuid4().hex[:8]}@gmail.com"
        public.post(f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": email, "prediction_one_x_two": "1",
                  "predicted_home_goals": 0, "predicted_away_goals": 0,
                  "rules_accepted": True,
                  "display_name": "<script>alert(1)</script>"},
            timeout=10)
        entries = admin.get(f"{BASE_URL}/api/admin/voita/raffles/{open_raffle['id']}/entries", timeout=10).json()["items"]
        e = next(x for x in entries if x["email_lower"] == email)
        # Angle brackets stripped
        assert "<" not in e["display_name"]
        assert ">" not in e["display_name"]

    def test_missing_display_name_still_accepted(self, public, admin, open_raffle):
        email = f"no-dn-{uuid.uuid4().hex[:8]}@gmail.com"
        r = public.post(f"{BASE_URL}/api/voita/raffles/{open_raffle['slug']}/enter",
            json={"email": email, "prediction_one_x_two": "X",
                  "predicted_home_goals": 1, "predicted_away_goals": 1,
                  "rules_accepted": True},
            timeout=10)
        assert r.status_code == 200


# ── paid status + recent-winners filter ──

class TestPaidStatusAndRecentWinners:
    @pytest.fixture
    def drawn_raffle(self, admin, public):
        slug = f"pytest-paid-{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/admin/voita/raffles", json={
            "slug": slug, "home_team": "Pelicans", "away_team": "Tappara",
            "sport": "hockey", "league": "Liiga",
            "kickoff_at": _future_iso(60),
            "entries_close_at": _future_iso(50),
            "prize_distribution": {"mode": "single", "payouts": [
                {"position": 1, "amount_eur": 250, "type": "cash"},
            ]},
        }, timeout=10)
        rid = r.json()["created"]["id"]
        admin.put(f"{BASE_URL}/api/admin/voita/raffles/{rid}", json={
            "gating": {"rules_url_set": True, "prize_distribution_locked": True, "match_populated": True},
            "status": "open",
        }, timeout=10)
        # One entry with display name
        public.post(f"{BASE_URL}/api/voita/raffles/{slug}/enter",
            json={"email": "alice@gmail.com", "prediction_one_x_two": "1",
                  "predicted_home_goals": 2, "predicted_away_goals": 1,
                  "rules_accepted": True,
                  "display_name": "Alice K."},
            timeout=10)
        # Draw
        admin.post(f"{BASE_URL}/api/admin/voita/raffles/{rid}/draw",
            json={"home_goals": 2, "away_goals": 1}, timeout=10)
        yield {"id": rid, "slug": slug}
        # Cleanup - paid raffles can't be deleted, archive instead via
        # direct mongo? Simpler: just leave them; tests use unique slugs.

    def test_mark_paid_only_from_drawn(self, admin, drawn_raffle):
        r = admin.post(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}/mark-paid", timeout=10)
        assert r.status_code == 200
        assert r.json()["raffle"]["status"] == "paid"
        assert r.json()["raffle"]["paid_at"]
        # Re-mark fails (status is no longer drawn)
        r2 = admin.post(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}/mark-paid", timeout=10)
        assert r2.status_code == 400

    def test_paid_filter_returns_paid_raffles_with_masking(self, admin, public, drawn_raffle):
        # Ensure the raffle is paid (idempotent - if previous test ran)
        admin.post(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}/mark-paid", timeout=10)
        r = public.get(f"{BASE_URL}/api/voita/raffles?status=paid&limit=3", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("view") == "paid"
        assert d["feature_enabled"] is True
        # Find our raffle
        ours = [it for it in d["items"] if it["raffle_slug"] == drawn_raffle["slug"]]
        assert len(ours) == 1
        winners = ours[0]["winners"]
        assert len(winners) == 1
        w = winners[0]
        # Display name should be used when provided
        assert w["display_name"] == "Alice K."
        assert w["display_label"] == "Alice K."
        # Email mask still computed for fallback
        assert w["email_masked"] == "a***@gmail.com"
        # Paid timestamp surfaced at raffle level
        assert ours[0]["paid_at"]

    def test_drawn_but_not_paid_NOT_in_paid_filter(self, admin, public):
        slug = f"pytest-not-paid-{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/admin/voita/raffles", json={
            "slug": slug, "home_team": "HJK", "away_team": "Inter",
            "kickoff_at": _future_iso(60),
            "prize_distribution": {"mode": "single", "payouts": [
                {"position": 1, "amount_eur": 100, "type": "cash"},
            ]},
        }, timeout=10)
        rid = r.json()["created"]["id"]
        admin.put(f"{BASE_URL}/api/admin/voita/raffles/{rid}", json={
            "gating": {"rules_url_set": True, "prize_distribution_locked": True, "match_populated": True},
            "status": "open",
        }, timeout=10)
        public.post(f"{BASE_URL}/api/voita/raffles/{slug}/enter",
            json={"email": "x@gmail.com", "prediction_one_x_two": "1",
                  "predicted_home_goals": 1, "predicted_away_goals": 0,
                  "rules_accepted": True}, timeout=10)
        admin.post(f"{BASE_URL}/api/admin/voita/raffles/{rid}/draw",
            json={"home_goals": 1, "away_goals": 0}, timeout=10)
        # Drawn but NOT marked paid → must not be in ?status=paid filter
        d = public.get(f"{BASE_URL}/api/voita/raffles?status=paid&limit=10", timeout=10).json()
        slugs = [it["raffle_slug"] for it in d["items"]]
        assert slug not in slugs

    def test_paid_raffle_cannot_be_edited(self, admin, drawn_raffle):
        admin.post(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}/mark-paid", timeout=10)
        r = admin.put(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}",
            json={"title_fi": "edit-after-paid"}, timeout=10)
        assert r.status_code == 400

    def test_paid_raffle_cannot_be_deleted(self, admin, drawn_raffle):
        admin.post(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}/mark-paid", timeout=10)
        r = admin.delete(f"{BASE_URL}/api/admin/voita/raffles/{drawn_raffle['id']}", timeout=10)
        assert r.status_code == 400


# ── /api/voita/raffles?status=paid honors feature flag ──

class TestPaidFilterFeatureFlag:
    def test_returns_empty_when_flag_off(self, admin, public):
        admin.put(f"{BASE_URL}/api/admin/settings",
                  json={"voita_feature_enabled": False}, timeout=10)
        try:
            r = public.get(f"{BASE_URL}/api/voita/raffles?status=paid&limit=3", timeout=10)
            assert r.status_code == 200
            d = r.json()
            assert d["items"] == []
            assert d["feature_enabled"] is False
        finally:
            admin.put(f"{BASE_URL}/api/admin/settings",
                      json={"voita_feature_enabled": True}, timeout=10)
