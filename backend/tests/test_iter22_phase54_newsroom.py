"""
Iteration 22 - Phase 5.4 PizzINT-style newsroom overhaul
Backend tests for the 5 new newsroom endpoints:
  GET  /api/content/stats
  GET  /api/content/top-entities
  GET  /api/content/feed (severity / entity filters)
  GET  /api/entities/streamers/{id}
  POST /api/subscribe/dial-alerts
"""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /content/stats ----------
class TestContentStats:
    def test_stats_shape(self, client):
        r = client.get(f"{API}/content/stats", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "total_24h" in d and isinstance(d["total_24h"], int)
        assert "by_severity" in d
        sev = d["by_severity"]
        for k in ("scorching", "hot", "warm", "cool"):
            assert k in sev and isinstance(sev[k], int)
        assert "total_sources" in d and isinstance(d["total_sources"], int)
        assert "last_updated" in d and isinstance(d["last_updated"], str)

    def test_stats_consistency(self, client):
        d = client.get(f"{API}/content/stats", timeout=30).json()
        sev_sum = sum(d["by_severity"].values())
        # severity-sum should not exceed total
        assert sev_sum <= d["total_24h"]


# ---------- /content/top-entities ----------
class TestTopEntities:
    def test_top_entities_default(self, client):
        r = client.get(f"{API}/content/top-entities", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "entities" in d and isinstance(d["entities"], list)
        assert "counts" in d and isinstance(d["counts"], dict)

    def test_top_entities_limit(self, client):
        r = client.get(f"{API}/content/top-entities?limit=8", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["entities"]) <= 8
        for e in d["entities"]:
            assert {"id", "name", "type", "count"}.issubset(e.keys())
            assert e["type"] in ("streamer", "operator", "league", "topic")


# ---------- /content/feed ----------
class TestFeed:
    def test_feed_basic_annotation(self, client):
        r = client.get(f"{API}/content/feed?limit=3", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        for it in d["items"]:
            assert "severity" in it
            assert it["severity"] in ("SCORCHING", "HOT", "WARM", "COOL")
            assert "entity_tags" in it and isinstance(it["entity_tags"], list)
            assert "read_count" in it
            assert "source_count" in it

    def test_feed_severity_filter_hot(self, client):
        r = client.get(f"{API}/content/feed?severity=HOT&limit=20", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        for it in items:
            assert it["severity"] == "HOT", f"unexpected severity {it['severity']}"

    def test_feed_severity_filter_scorching(self, client):
        r = client.get(f"{API}/content/feed?severity=SCORCHING&limit=20", timeout=30)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["severity"] == "SCORCHING"

    def test_feed_entity_filter(self, client):
        r = client.get(f"{API}/content/feed?entity=veikkaus&limit=20", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        # If non-empty, every result must contain veikkaus in entity_tags
        for it in items:
            assert "veikkaus" in it["entity_tags"]


# ---------- /entities/streamers/{id} ----------
class TestEntityHub:
    def test_streamer_entity_shape(self, client):
        r = client.get(f"{API}/entities/streamers/jarttu84", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "entity" in d and "articles" in d and "total" in d
        ent = d["entity"]
        assert ent["id"] == "jarttu84"
        assert "name" in ent
        # platform/tier/etc. may be None if streamer not in roster - only assert keys exist
        for k in ("platform", "channel", "tier", "follower_count", "scene"):
            assert k in ent
        assert isinstance(d["articles"], list)
        assert isinstance(d["total"], int)

    def test_unknown_entity_type(self, client):
        r = client.get(f"{API}/entities/widgets/foo", timeout=30)
        assert r.status_code == 400


# ---------- /subscribe/dial-alerts ----------
class TestDialAlertSubscribe:
    EMAIL = "test_phase54_dial@example.com"

    def test_subscribe_create_and_update(self, client):
        # First call -> created
        r = client.post(
            f"{API}/subscribe/dial-alerts",
            json={"channel": "email", "contact": self.EMAIL, "min_state": "RUSH"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["status"] == "created"
        assert "id" in d and isinstance(d["id"], str)

        # Second call -> updated (idempotent)
        r2 = client.post(
            f"{API}/subscribe/dial-alerts",
            json={"channel": "email", "contact": self.EMAIL, "min_state": "JACKPOT"},
            timeout=30,
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["ok"] is True
        assert d2["status"] == "updated"

    def test_invalid_email(self, client):
        r = client.post(
            f"{API}/subscribe/dial-alerts",
            json={"channel": "email", "contact": "not-an-email", "min_state": "RUSH"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_invalid_channel(self, client):
        r = client.post(
            f"{API}/subscribe/dial-alerts",
            json={"channel": "carrier-pigeon", "contact": "a@b.c", "min_state": "RUSH"},
            timeout=30,
        )
        # Pydantic validation error -> 422
        assert r.status_code in (400, 422)
