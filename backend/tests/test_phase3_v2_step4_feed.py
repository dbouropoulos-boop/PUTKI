"""Phase 3 V2 Step 4 — Live-feed aggregation tests."""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK}


@pytest.fixture(scope="module", autouse=True)
def force_rebuild():
    """Make sure the feed has been built at least once before assertions."""
    r = requests.post(f"{API}/admin/feed/rebuild", headers=HDR, timeout=15)
    assert r.status_code == 200, r.text
    yield


class TestPublicFeed:
    def test_feed_returns_envelope(self):
        r = requests.get(f"{API}/feed?limit=5", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) >= {"items", "count", "market_id"}
        assert d["market_id"] == "FI"
        assert isinstance(d["items"], list)
        assert d["count"] == len(d["items"])

    def test_feed_excludes_mocked_by_default(self):
        r = requests.get(f"{API}/feed?limit=50", timeout=10)
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item.get("mocked") is False, f"mocked item leaked into public feed: {item}"

    def test_feed_items_have_required_shape(self):
        r = requests.get(f"{API}/feed?limit=10", timeout=10)
        for item in r.json()["items"]:
            for k in ("id", "source", "kind", "title", "weight", "market_id", "surfaced_at", "created_at", "expires_at"):
                assert k in item, f"missing key {k} in {item}"
            assert "_id" not in item  # no MongoDB ObjectId leak

    def test_feed_sorted_newest_first(self):
        r = requests.get(f"{API}/feed?limit=10", timeout=10)
        items = r.json()["items"]
        if len(items) >= 2:
            times = [i["surfaced_at"] for i in items]
            assert times == sorted(times, reverse=True)

    def test_feed_source_filter(self):
        r = requests.get(f"{API}/feed?source=editorial&limit=10", timeout=10)
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["source"] == "editorial"

    def test_feed_kind_filter(self):
        r = requests.get(f"{API}/feed?kind=editorial_drop&limit=10", timeout=10)
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["kind"] == "editorial_drop"

    def test_feed_limit_respected(self):
        r = requests.get(f"{API}/feed?limit=3", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["items"]) <= 3

    def test_feed_market_id_default_fi(self):
        r = requests.get(f"{API}/feed?limit=2", timeout=10)
        for item in r.json()["items"]:
            assert item["market_id"] == "FI"


class TestFeedStats:
    def test_stats_envelope(self):
        r = requests.get(f"{API}/feed/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) >= {"total", "by_source", "market_id", "cache_ttl_seconds", "rebuild_interval_seconds", "ttl_minutes"}
        assert d["market_id"] == "FI"


class TestAdminFeed:
    def test_admin_feed_requires_auth(self):
        r = requests.get(f"{API}/admin/feed?limit=5", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_feed_can_include_mocked(self):
        r = requests.get(f"{API}/admin/feed?limit=20&include_mocked=true", headers=HDR, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["include_mocked"] is True
        # Should typically include at least some mocked items since pollers run mock mode.
        # Not asserting truthy here because dataset can be empty in CI.
        assert "items" in d

    def test_admin_rebuild_returns_summary(self):
        r = requests.post(f"{API}/admin/feed/rebuild", headers=HDR, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("rebuilt_at", "candidates", "upserted", "pruned", "signals_scanned", "published_scanned"):
            assert k in d


class TestFeedAggregator:
    """Direct module-level checks for the aggregator."""

    def test_signal_to_feed_item_filters_unknown(self):
        from feed import _signal_to_feed_item
        assert _signal_to_feed_item({"source": "internal", "signal_type": "editorial_heartbeat", "payload": {}}) is None
        assert _signal_to_feed_item({"source": "unknown", "signal_type": "x", "payload": {}}) is None

    def test_signal_to_feed_item_twitch_shape(self):
        from feed import _signal_to_feed_item
        item = _signal_to_feed_item({
            "id": str(uuid.uuid4()),
            "source": "twitch",
            "signal_type": "streamer_live",
            "weight": 65,
            "payload": {"login": "andypyro", "viewers": 4200, "game_name": "Sweet Bonanza"},
            "mocked": False,
        })
        assert item is not None
        assert item["source"] == "twitch"
        assert item["slug"] == "andypyro"
        assert item["url"] == "https://twitch.tv/andypyro"
        assert "ANDYPYRO" in item["eyebrow"]
        assert item["mocked"] is False
        assert item["dedup_key"] == "twitch:andypyro"
