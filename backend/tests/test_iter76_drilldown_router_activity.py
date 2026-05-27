"""
iter76g - Drill-down + router activity feeds + subscriber search.

Coverage:
    GET /api/admin/bot/funnel/drilldown?stage=
    GET /api/admin/router/clicks
    GET /api/admin/router/conversions
    GET /api/admin/subscribers/lookup  (covered in test_iter76_signup_flow already)
"""
from __future__ import annotations

import os

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


class TestDrilldown:
    def test_requires_admin(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/drilldown?stage=signup", timeout=5,
        )
        assert r.status_code == 401

    def test_rejects_unknown_stage(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/drilldown?stage=ghost",
            headers=HEADERS, timeout=5,
        )
        assert r.status_code == 400

    def test_envelope_shape_for_every_stage(self):
        for stage in ("signup", "bound", "dm_sent", "tma_open", "unlock_click"):
            r = requests.get(
                f"{BASE_URL}/api/admin/bot/funnel/drilldown?stage={stage}&hours=24&limit=5",
                headers=HEADERS, timeout=10,
            )
            assert r.status_code == 200, f"{stage}: {r.text}"
            body = r.json()
            assert body["stage"] == stage
            assert body["count"] == len(body["items"])
            assert body["count"] <= 5
            for it in body["items"]:
                assert "label" in it
                assert "sub_label" in it
                assert "ts" in it


class TestRouterClicks:
    def test_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/router/clicks", timeout=5)
        assert r.status_code == 401

    def test_envelope_and_filter(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/router/clicks?limit=10",
            headers=HEADERS, timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and "count" in body
        assert body["count"] == len(body["items"])
        # status=ok filter only returns ok rows.
        r2 = requests.get(
            f"{BASE_URL}/api/admin/router/clicks?limit=10&status=ok",
            headers=HEADERS, timeout=5,
        )
        assert r2.status_code == 200
        for it in r2.json()["items"]:
            assert it["status"] == "ok"


class TestRouterConversions:
    def test_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/router/conversions", timeout=5)
        assert r.status_code == 401

    def test_envelope_includes_totals(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/router/conversions?limit=10",
            headers=HEADERS, timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert "verified_amount_total" in body
        assert isinstance(body["verified_amount_total"], (int, float))
