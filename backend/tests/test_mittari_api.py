"""Backend tests for PUTKI HQ Phase 1 API."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fall back to reading frontend/.env so tests work in this preview env
    from pathlib import Path
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health / Root ----------
class TestRoot:
    def test_root_ok(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("service") == "PUTKI HQ API"
        assert data.get("phase") == 1


# ---------- Dial ----------
class TestDial:
    def test_get_dial_current(self, session):
        r = session.get(f"{API}/dial")
        assert r.status_code == 200
        data = r.json()
        assert "state" in data
        st = data["state"]
        # All required keys per spec
        for k in ("key", "label", "color", "value", "headline"):
            assert k in st, f"missing key {k}"
        # Dial is dynamically computed by the recalc engine — any of the 5 valid states is acceptable
        assert st["key"] in {"KYLMA", "HAALEA", "KUUMA", "MYRSKY", "KIIRASTULI"}
        assert st["color"].startswith("#")
        assert isinstance(st["value"], int)
        assert "updated_at" in data
        assert "context" in data

    def test_get_dial_states_all_five(self, session):
        r = session.get(f"{API}/dial/states")
        assert r.status_code == 200
        data = r.json()
        states = data.get("states", [])
        assert len(states) == 5
        keys = {s["key"] for s in states}
        assert keys == {"KYLMA", "HAALEA", "KUUMA", "MYRSKY", "KIIRASTULI"}
        # color & value present
        for s in states:
            assert s["color"].startswith("#")
            assert isinstance(s["value"], int)
            assert s["headline"]


# ---------- Signup ----------
class TestSignup:
    def test_signup_minimal(self, session):
        payload = {"email": "TEST_minimal@example.com", "streamers": [], "channels": []}
        r = session.post(f"{API}/signup", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == payload["email"]
        assert data["streamers"] == []
        assert data["channels"] == []
        assert "id" in data and len(data["id"]) > 0
        assert "created_at" in data

    def test_signup_with_selections(self, session):
        payload = {
            "email": "TEST_full@example.com",
            "streamers": ["jarttu84", "jugipelaa", "andypyro"],
            "channels": ["email", "telegram"],
        }
        r = session.post(f"{API}/signup", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["streamers"] == payload["streamers"]
        assert data["channels"] == payload["channels"]
        assert data["email"] == payload["email"]

    def test_signup_invalid_email(self, session):
        r = session.post(f"{API}/signup", json={"email": "not-an-email"})
        assert r.status_code == 422


# ---------- Predictions ----------
class TestPredictions:
    def test_prediction_with_email(self, session):
        payload = {"fixture_id": "fixture-1", "pick": "1", "user_email": "TEST_pred@example.com"}
        r = session.post(f"{API}/predictions", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["fixture_id"] == "fixture-1"
        assert data["pick"] == "1"
        assert data["user_email"] == payload["user_email"]
        assert "id" in data and data["id"]
        assert "created_at" in data

    def test_prediction_without_email(self, session):
        payload = {"fixture_id": "fixture-2", "pick": "X"}
        r = session.post(f"{API}/predictions", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["pick"] == "X"
        assert data.get("user_email") is None

    def test_prediction_pick_2(self, session):
        r = session.post(f"{API}/predictions", json={"fixture_id": "fixture-3", "pick": "2"})
        assert r.status_code == 200
        assert r.json()["pick"] == "2"

    def test_prediction_missing_fields(self, session):
        r = session.post(f"{API}/predictions", json={"pick": "1"})
        assert r.status_code == 422


# ---------- Phase 2.0: Site settings / back-office ----------
from _test_env import admin_token
ADMIN_TOKEN = admin_token()


class TestSiteSettings:
    """Public + admin settings endpoints (Phase 2.0)."""

    def test_public_settings_no_auth(self, session):
        r = session.get(f"{API}/settings/public")
        assert r.status_code == 200
        data = r.json()
        # contract: only telegram_channel key exposed
        assert "telegram_channel" in data
        # value must be either string or null (no other admin-only keys)
        assert "updated_at" not in data

    def test_admin_get_settings_requires_token(self, session):
        r = requests.get(f"{API}/admin/settings")  # no header
        assert r.status_code == 401

    def test_admin_get_settings_wrong_token(self, session):
        r = requests.get(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": "wrong-token"},
        )
        assert r.status_code == 401

    def test_admin_get_settings_valid_token(self, session):
        r = requests.get(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN},
        )
        assert r.status_code == 200
        data = r.json()
        assert "telegram_channel" in data
        assert "updated_at" in data

    def test_admin_put_settings_wrong_token(self, session):
        r = requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": "bad", "Content-Type": "application/json"},
            json={"telegram_channel": "https://t.me/x"},
        )
        assert r.status_code == 401

    def test_admin_put_then_public_get_reflects(self, session):
        target = "https://t.me/mittarifi"
        r = requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
            json={"telegram_channel": target},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["telegram_channel"] == target
        assert data.get("updated_at")

        # public reflects it
        rp = session.get(f"{API}/settings/public")
        assert rp.status_code == 200
        assert rp.json()["telegram_channel"] == target

        # admin GET also reflects it
        ra = requests.get(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN},
        )
        assert ra.status_code == 200
        assert ra.json()["telegram_channel"] == target

    def test_admin_put_settings_null_clears(self, session):
        # set then clear
        requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
            json={"telegram_channel": "https://t.me/temp"},
        )
        r = requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
            json={"telegram_channel": None},
        )
        assert r.status_code == 200
        assert r.json()["telegram_channel"] is None
        rp = session.get(f"{API}/settings/public")
        assert rp.json()["telegram_channel"] is None


# ---------- Phase 2.6 Batch A: Smartico template id in settings ----------
class TestSmarticoTemplateId:
    def test_put_with_smartico_template_id(self, session):
        payload = {
            "telegram_channel": "https://t.me/x",
            "smartico_template_id": "tpl-test-001",
        }
        r = requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
            json=payload,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["telegram_channel"] == payload["telegram_channel"]
        assert data["smartico_template_id"] == "tpl-test-001"

        # public reflects both fields, no auth
        rp = session.get(f"{API}/settings/public")
        assert rp.status_code == 200
        pdata = rp.json()
        assert pdata["telegram_channel"] == payload["telegram_channel"]
        assert pdata["smartico_template_id"] == "tpl-test-001"
        # Public should not leak admin metadata
        assert "updated_at" not in pdata

    def test_put_clear_smartico_template_id(self, session):
        # set first
        requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
            json={"telegram_channel": "https://t.me/x", "smartico_template_id": "tpl-clear-me"},
        )
        # clear
        r = requests.put(
            f"{API}/admin/settings",
            headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
            json={"telegram_channel": "https://t.me/x", "smartico_template_id": None},
        )
        assert r.status_code == 200
        assert r.json()["smartico_template_id"] is None
        rp = session.get(f"{API}/settings/public")
        assert rp.status_code == 200
        assert rp.json()["smartico_template_id"] is None

    def test_public_settings_contains_smartico_key(self, session):
        r = session.get(f"{API}/settings/public")
        assert r.status_code == 200
        data = r.json()
        # contract: smartico_template_id key always present (value may be null)
        assert "smartico_template_id" in data
        assert "telegram_channel" in data
