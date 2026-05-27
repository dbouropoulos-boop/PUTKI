"""
iter76d - Funnel snapshot endpoint + TMA beacon.

Snapshot stages:
    signup → bound → dm_sent → tma_open → unlock_click

Verifies:
    1. Auth gate.
    2. Default 24h envelope shape with all 5 stages + end-to-end rate.
    3. TMA beacon writes a row that the snapshot picks up.
    4. Range param accepts 24 / 168 / 720 hours.
"""
from __future__ import annotations

import os

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


class TestFunnelSnapshot:
    def test_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/bot/funnel/snapshot", timeout=5)
        assert r.status_code == 401

    def test_default_envelope_shape(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/snapshot",
            headers=HEADERS, timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["hours"] == 24
        assert "cutoff" in body
        assert "end_to_end_rate" in body
        stages = body["stages"]
        assert len(stages) == 5
        keys = [s["key"] for s in stages]
        assert keys == ["signup", "bound", "dm_sent", "tma_open", "unlock_click"]
        for s in stages:
            assert "count" in s and s["count"] >= 0
            assert "label" in s
        # rate_vs_prev exists on stages 2+
        for s in stages[1:]:
            assert "rate_vs_prev" in s

    def test_range_param_honoured(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/snapshot?hours=168",
            headers=HEADERS, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["hours"] == 168


class TestFunnelHistory:
    def test_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/bot/funnel/history", timeout=5)
        assert r.status_code == 401

    def test_default_envelope_shape(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/history?days=7",
            headers=HEADERS, timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["days"] == 7
        # 7 days requested → 8 buckets (oldest..today inclusive)
        assert len(body["rows"]) == 8
        for row in body["rows"]:
            for k in ("day", "signup", "bound", "dm_sent", "tma_open", "unlock_click"):
                assert k in row
            assert len(row["day"]) == 10  # YYYY-MM-DD
        for k in ("signup", "bound", "dm_sent", "tma_open", "unlock_click"):
            assert k in body["totals"]
            assert body["totals"][k] >= 0

    def test_range_param_clamped(self):
        # Negative / oversize values must clamp to [1..90].
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/history?days=500",
            headers=HEADERS, timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["days"] == 90


class TestTmaBeacon:
    def test_beacon_accepts_unauthed(self):
        # Beacons are fire-and-forget - no auth required.
        r = requests.post(
            f"{BASE_URL}/api/tma/event",
            json={"event": "tma_open", "tg_user_id": 9999911},
            timeout=5,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_beacon_rejects_empty_event(self):
        r = requests.post(
            f"{BASE_URL}/api/tma/event",
            json={"event": "", "tg_user_id": 1},
            timeout=5,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is False

    def test_beacon_lands_in_snapshot(self):
        # Beacon then snapshot - the count must include our event.
        before = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/snapshot?hours=24",
            headers=HEADERS, timeout=10,
        ).json()
        before_tma = next(s["count"] for s in before["stages"] if s["key"] == "tma_open")

        # Use a fresh tg_user_id so the "distinct user" pipeline counts it.
        import time
        uid = int(time.time())
        requests.post(
            f"{BASE_URL}/api/tma/event",
            json={"event": "tma_open", "tg_user_id": uid},
            timeout=5,
        )

        after = requests.get(
            f"{BASE_URL}/api/admin/bot/funnel/snapshot?hours=24",
            headers=HEADERS, timeout=10,
        ).json()
        after_tma = next(s["count"] for s in after["stages"] if s["key"] == "tma_open")
        assert after_tma >= before_tma + 1
