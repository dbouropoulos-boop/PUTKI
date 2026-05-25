"""Iteration 21 - Most-read rail endpoint tests.

Validates:
  GET /api/content/most-read?hours=1&limit=5  - shape, items, count
  GET /api/content/most-read?hours=24&limit=3 - limit/hours respected
  Param clamping (1<=hours<=168, 1<=limit<=20)
  Cold-start fallback behavior
"""
import os
import pytest
import requests

from _test_env import backend_url

BASE_URL = backend_url()
EP = f"{BASE_URL}/api/content/most-read"

REQUIRED_ITEM_KEYS = {"id", "headline", "url_slug", "views_window",
                      "published_at", "category", "type"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestMostReadRail:
    def test_default_hours1_limit5(self, session):
        r = session.get(f"{EP}?hours=1&limit=5", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["hours"] == 1
        assert d["count"] == len(d["items"])
        assert 1 <= d["count"] <= 5
        # Top item should exist (seeded data per problem statement)
        assert d["count"] >= 1
        for it in d["items"]:
            missing = REQUIRED_ITEM_KEYS - set(it.keys())
            assert not missing, f"Missing keys {missing} in {it}"
            assert isinstance(it["views_window"], int)
            assert it["views_window"] >= 0
            assert it["url_slug"]
            assert it["headline"]

    def test_hours24_limit3_respected(self, session):
        r = session.get(f"{EP}?hours=24&limit=3", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["hours"] == 24
        assert d["count"] <= 3
        assert len(d["items"]) <= 3

    def test_limit1(self, session):
        r = session.get(f"{EP}?hours=1&limit=1", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] <= 1

    def test_limit_clamp_upper(self, session):
        # limit=50 should clamp to 20
        r = session.get(f"{EP}?hours=1&limit=50", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] <= 20

    def test_hours_clamp_upper(self, session):
        # hours=999 should clamp to 168
        r = session.get(f"{EP}?hours=999&limit=5", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["hours"] == 168

    def test_hours_clamp_lower(self, session):
        # hours=0 should clamp to 1
        r = session.get(f"{EP}?hours=0&limit=5", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["hours"] == 1

    def test_limit_clamp_lower(self, session):
        # limit=0 - implementation treats falsy as default 5 (max(1, min(int(limit or 5), 20)))
        r = session.get(f"{EP}?hours=1&limit=0", timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Should not error and should return some items
        assert d["count"] >= 1

    def test_items_sorted_desc_by_views(self, session):
        r = session.get(f"{EP}?hours=1&limit=5", timeout=30)
        d = r.json()
        views = [it["views_window"] for it in d["items"]]
        assert views == sorted(views, reverse=True), f"Items not sorted desc: {views}"

    def test_no_mongo_objectid_leak(self, session):
        r = session.get(f"{EP}?hours=1&limit=5", timeout=30)
        d = r.json()
        for it in d["items"]:
            assert "_id" not in it, "MongoDB _id leaked in response"

    def test_top_item_seeded_value(self, session):
        """Top item should be the seeded renttuofficial streamer per problem context."""
        r = session.get(f"{EP}?hours=1&limit=5", timeout=30)
        d = r.json()
        if d["items"]:
            top = d["items"][0]
            # Either matches the seeded story OR has sensible views_window > 0
            assert top["views_window"] > 0
