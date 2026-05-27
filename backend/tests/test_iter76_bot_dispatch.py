"""
iter76 (Slice 3) - Per-subscriber DM fan-out (`/api/admin/bot/dispatch/*`).
"""
from __future__ import annotations

import os
import uuid

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


class TestDispatchAuthGate:
    def test_preview_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/bot/dispatch/preview", timeout=5)
        assert r.status_code == 401

    def test_run_requires_admin(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/bot/dispatch/run",
            json={"dry_run": True}, timeout=5,
        )
        assert r.status_code == 401


class TestDispatchOffByDefault:
    """daily_dm_enabled defaults to False - the preview must say so
    and a live run must be rejected with 409 until it's flipped on."""

    def _ensure_off(self):
        requests.put(
            f"{BASE_URL}/api/admin/bot/config",
            headers=HEADERS,
            json={"daily_dm_enabled": False},
            timeout=5,
        )

    def test_preview_reports_disabled(self):
        self._ensure_off()
        r = requests.post(
            f"{BASE_URL}/api/admin/bot/dispatch/preview",
            headers=HEADERS, timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is False
        assert body["reason"] == "daily_dm_enabled is False"

    def test_live_run_rejected_when_disabled(self):
        self._ensure_off()
        r = requests.post(
            f"{BASE_URL}/api/admin/bot/dispatch/run",
            headers=HEADERS, json={"dry_run": False}, timeout=10,
        )
        assert r.status_code == 409


class TestDispatchEnabled:
    def setup_method(self, method):
        requests.put(
            f"{BASE_URL}/api/admin/bot/config",
            headers=HEADERS,
            json={"daily_dm_enabled": True},
            timeout=5,
        )

    def teardown_method(self, method):
        requests.put(
            f"{BASE_URL}/api/admin/bot/config",
            headers=HEADERS,
            json={"daily_dm_enabled": False},
            timeout=5,
        )

    def test_dry_run_reports_envelope(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/bot/dispatch/run",
            headers=HEADERS, json={"dry_run": True}, timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["enabled"] is True
        for k in (
            "attempted", "delivered", "dry_run", "errors",
            "skipped_by_segment", "today",
        ):
            assert k in body
        # No real subscribers bound in QA - eligible_total may be 0 or
        # whatever the test fixtures have left behind, but the envelope
        # must always be valid.
        assert body.get("eligible_total", 0) >= 0
