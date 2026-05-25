"""Iter40 - Mittari lead-capture optimization backend tests.

Validates the new GET /api/mittari/stats endpoint contract, plus regression
on POST /api/voita/lead (mittari surface) and POST /api/mittari/subscribe.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── /api/mittari/stats ────────────────────────────────────────────────
class TestMittariStats:
    def test_stats_contract_and_no_id_leak(self, api):
        r = api.get(f"{BASE_URL}/api/mittari/stats", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body.get("subscribers_count"), int)
        assert isinstance(body.get("fresh_24h"), int)
        assert isinstance(body.get("latest_signups"), list)
        # No mongo _id leakage anywhere
        assert "_id" not in body
        for row in body["latest_signups"]:
            assert "_id" not in row
            assert set(row.keys()).issubset({"name", "channel", "created_at"})
            assert isinstance(row.get("name"), str) and row["name"]
            assert row.get("channel") in {"email", "telegram", "sms"} or isinstance(
                row.get("channel"), str
            )
            assert row.get("created_at")

    def test_stats_no_apostrophe_literal(self, api):
        r = api.get(f"{BASE_URL}/api/mittari/stats", timeout=15)
        assert r.status_code == 200
        assert "\\u2019" not in r.text


# ── POST /api/voita/lead with mittari surface ─────────────────────────
class TestVoitaLeadMittariSurfaces:
    @pytest.mark.parametrize("surface", ["mittari_gate_hero", "mittari_gate_final"])
    def test_lead_persists_and_returns_ok(self, api, surface):
        unique = uuid.uuid4().hex[:10]
        email = f"TEST_iter40_{surface}_{unique}@example.com"
        payload = {
            "email": email,
            "age_18_plus": True,
            "source": "mittari",
            "quiz_tags": {"surface": surface},
        }
        r = api.post(f"{BASE_URL}/api/voita/lead", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True

        # Verify lead surfaces via /api/mittari/stats (within fresh_24h)
        time.sleep(0.5)
        r2 = api.get(f"{BASE_URL}/api/mittari/stats", timeout=15)
        assert r2.status_code == 200
        stats = r2.json()
        assert stats["subscribers_count"] >= 1
        assert stats["fresh_24h"] >= 1


# ── POST /api/mittari/subscribe ───────────────────────────────────────
class TestMittariSubscribe:
    def test_subscribe_with_pending_id(self, api):
        pending = f"test-iter40-{uuid.uuid4().hex[:12]}"
        r = api.post(
            f"{BASE_URL}/api/mittari/subscribe",
            json={"pending_id": pending},
            timeout=15,
        )
        assert r.status_code == 200, r.text


# ── Sprint regression: ensure odds/featured + dial + cockpit remain OK ─
class TestSprintRegression:
    def test_dial_ok(self, api):
        r = api.get(f"{BASE_URL}/api/dial", timeout=10)
        assert r.status_code == 200
        assert "_id" not in r.json()

    def test_cockpit_ok(self, api):
        r = api.get(f"{BASE_URL}/api/cockpit", timeout=10)
        assert r.status_code == 200

    def test_odds_featured_contract(self, api):
        r = api.get(f"{BASE_URL}/api/odds/featured", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "picks" in body
        assert isinstance(body["picks"], list)
