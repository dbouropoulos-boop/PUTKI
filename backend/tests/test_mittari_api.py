"""Backend tests for Mittari.fi Phase 1 API."""
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
        assert data.get("service") == "Mittari.fi API"
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
        # Current state should be KUUMA per spec
        assert st["key"] == "KUUMA"
        assert st["label"] == "KUUMA"
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
