"""Phase 1 Final Restructure · Chunk B — landing pages backend tests."""

import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://pelisignaali-fi.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN})
    return s


# ── /api/settings/public — voita_feature_enabled flag ──
class TestSettings:
    def test_public_exposes_voita_flag(self, api):
        r = api.get(f"{BASE_URL}/api/settings/public", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "voita_feature_enabled" in d
        # Default MUST be False (Sako sign-off gate)
        assert d["voita_feature_enabled"] in (False, True)

    def test_admin_can_toggle_voita_flag(self, admin_api, api):
        # Turn on
        r = admin_api.put(
            f"{BASE_URL}/api/admin/settings",
            json={"voita_feature_enabled": True},
            timeout=10,
        )
        assert r.status_code == 200
        # Public reflects it
        r2 = api.get(f"{BASE_URL}/api/settings/public", timeout=10)
        assert r2.json()["voita_feature_enabled"] is True
        # Turn off again (leave at default)
        r3 = admin_api.put(
            f"{BASE_URL}/api/admin/settings",
            json={"voita_feature_enabled": False},
            timeout=10,
        )
        assert r3.status_code == 200
        assert api.get(f"{BASE_URL}/api/settings/public", timeout=10) \
            .json()["voita_feature_enabled"] is False


# ── /api/optin ──
class TestOptin:
    def test_email_capture_creates_record(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "email", "surface": "pelisignaalit",
                  "email": "chunkb-pytest@example.com"},
            timeout=10,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["channel"] == "email"
        assert d["surface"] == "pelisignaalit"
        # default consent tag for email = sentiment
        assert d["consent_tag"] == "email_sentiment"

    def test_sms_capture_with_default_bets_tag(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "sms", "surface": "mittari",
                  "phone": "+358401234567"},
            timeout=10,
        )
        assert r.status_code == 200
        d = r.json()
        # default consent tag for sms = bets
        assert d["consent_tag"] == "sms_bets"

    def test_telegram_capture_strips_at_and_lowercases(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "telegram", "surface": "pelisignaalit",
                  "telegram_username": "@TestUser"},
            timeout=10,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["consent_tag"] == "telegram_bets"

    def test_email_required_for_email_channel(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "email", "surface": "pelisignaalit"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_phone_required_for_sms_channel(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "sms", "surface": "pelisignaalit"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_unknown_channel_rejected(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "smoke-signal", "surface": "mittari", "email": "x@y.com"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_unknown_surface_rejected(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "email", "surface": "kuukauden-vekkari",
                  "email": "x@y.com"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_idempotent_resubmit_does_not_duplicate(self, api, admin_api):
        # Submit twice with same identifier
        body = {"channel": "email", "surface": "voita",
                "email": "idempotency-test@putkihq.example"}
        r1 = api.post(f"{BASE_URL}/api/optin", json=body, timeout=10)
        assert r1.status_code == 200
        first_new = r1.json()["new_record"]
        r2 = api.post(f"{BASE_URL}/api/optin", json=body, timeout=10)
        assert r2.status_code == 200
        second_new = r2.json()["new_record"]
        assert first_new is True
        assert second_new is False

    def test_custom_consent_tag_override(self, api):
        r = api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "sms", "surface": "mittari",
                  "phone": "+358409999998",
                  "consent_tag": "sms_state_changes"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["consent_tag"] == "sms_state_changes"


# ── Admin optin stats ──
class TestOptinStats:
    def test_stats_endpoint_requires_admin(self, api):
        r = api.get(f"{BASE_URL}/api/admin/optin/stats", timeout=10)
        assert r.status_code == 401

    def test_stats_returns_segments_and_total(self, admin_api):
        # ensure at least one row exists
        admin_api.post(
            f"{BASE_URL}/api/optin",
            json={"channel": "email", "surface": "homepage",
                  "email": "stats-seed@putkihq.example"},
            timeout=10,
        )
        r = admin_api.get(f"{BASE_URL}/api/admin/optin/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "by_segment" in d
        assert "total" in d
        assert d["total"] >= 1
