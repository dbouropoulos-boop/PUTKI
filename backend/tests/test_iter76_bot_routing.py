"""
iter76 (Slice 1) - Bot & Routing admin endpoint coverage.

Asserts auth, config CRUD, partner upsert/delete, and subscriber-summary
shape for the new `/api/admin/bot/*` + `/api/admin/partners*` endpoints
introduced in `routes/bot_routing.py`.
"""
from __future__ import annotations

import os
import time
import uuid

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


def _key(prefix: str = "qa-bot") -> str:
    """Unique partner_key for an isolated test run."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# ─── bot_config ──────────────────────────────────────────────────────
class TestBotConfig:
    def test_get_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/bot/config", timeout=5)
        assert r.status_code == 401

    def test_get_returns_defaults_envelope(self):
        r = requests.get(f"{BASE_URL}/api/admin/bot/config", headers=HEADERS, timeout=5)
        assert r.status_code == 200, r.text
        body = r.json()
        # Every default key must be materialised, even on a fresh DB.
        for k in (
            "signal_unlock_mode",
            "require_verified_signup",
            "daily_signal_count",
            "daily_dm_enabled",
            "sharpness_min",
            "sport_whitelist",
            "stars_premium_enabled",
        ):
            assert k in body, f"missing default key {k}"
        assert body["signal_unlock_mode"] in {"informative", "routed"}

    def test_put_round_trip(self):
        # Flip daily_dm + sharpness floor, confirm GET reflects + restore.
        original = requests.get(
            f"{BASE_URL}/api/admin/bot/config", headers=HEADERS, timeout=5
        ).json()
        try:
            r = requests.put(
                f"{BASE_URL}/api/admin/bot/config",
                headers=HEADERS,
                json={"daily_dm_enabled": True, "sharpness_min": 65},
                timeout=5,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["daily_dm_enabled"] is True
            assert body["sharpness_min"] == 65
            # Defaults for fields we didn't touch must remain stable.
            assert body["signal_unlock_mode"] == original.get(
                "signal_unlock_mode", "informative"
            )
        finally:
            requests.put(
                f"{BASE_URL}/api/admin/bot/config",
                headers=HEADERS,
                json={
                    "daily_dm_enabled": original.get("daily_dm_enabled", False),
                    "sharpness_min": original.get("sharpness_min", 70),
                },
                timeout=5,
            )

    def test_put_rejects_bad_unlock_mode(self):
        r = requests.put(
            f"{BASE_URL}/api/admin/bot/config",
            headers=HEADERS,
            json={"signal_unlock_mode": "monetised"},
            timeout=5,
        )
        assert r.status_code == 400

    def test_put_rejects_empty_payload(self):
        r = requests.put(
            f"{BASE_URL}/api/admin/bot/config",
            headers=HEADERS,
            json={},
            timeout=5,
        )
        assert r.status_code == 400


# ─── partners CRUD ───────────────────────────────────────────────────
class TestPartners:
    def test_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/partners", timeout=5)
        assert r.status_code == 401

    def test_upsert_and_list_roundtrip(self):
        pkey = _key()
        try:
            r = requests.post(
                f"{BASE_URL}/api/admin/partners",
                headers=HEADERS,
                json={
                    "partner_key": pkey,
                    "display_name": "QA Test Partner",
                    "affiliate_base_url": "https://example.com/aff?cid={code}",
                    "target_geos": ["FI", "SE"],
                    "priority_weight": 33,
                    "status": "paused",
                },
                timeout=5,
            )
            assert r.status_code == 200, r.text
            row = r.json()
            assert row["partner_key"] == pkey
            assert row["priority_weight"] == 33
            assert row["status"] == "paused"
            assert "created_at" in row and "updated_at" in row

            # Lower-cased on persist (the route normalises).
            r2 = requests.get(
                f"{BASE_URL}/api/admin/partners", headers=HEADERS, timeout=5
            )
            assert r2.status_code == 200
            listing = r2.json()
            assert "items" in listing and "total" in listing
            keys = {p["partner_key"] for p in listing["items"]}
            assert pkey in keys

            # Upsert toggles status without losing other fields.
            r3 = requests.post(
                f"{BASE_URL}/api/admin/partners",
                headers=HEADERS,
                json={
                    "partner_key": pkey,
                    "display_name": "QA Test Partner",
                    "affiliate_base_url": "https://example.com/aff?cid={code}",
                    "status": "live",
                    "priority_weight": 33,
                },
                timeout=5,
            )
            assert r3.status_code == 200
            assert r3.json()["status"] == "live"
        finally:
            requests.delete(
                f"{BASE_URL}/api/admin/partners/{pkey}", headers=HEADERS, timeout=5
            )

    def test_upsert_rejects_bad_status(self):
        pkey = _key()
        r = requests.post(
            f"{BASE_URL}/api/admin/partners",
            headers=HEADERS,
            json={
                "partner_key": pkey,
                "display_name": "QA Bad Status",
                "affiliate_base_url": "https://example.com/aff",
                "status": "draft",
            },
            timeout=5,
        )
        assert r.status_code == 400

    def test_delete_returns_count(self):
        pkey = _key()
        # Seed first so the delete actually does work.
        requests.post(
            f"{BASE_URL}/api/admin/partners",
            headers=HEADERS,
            json={
                "partner_key": pkey,
                "display_name": "QA Delete Me",
                "affiliate_base_url": "https://example.com/aff",
            },
            timeout=5,
        )
        r = requests.delete(
            f"{BASE_URL}/api/admin/partners/{pkey}", headers=HEADERS, timeout=5
        )
        assert r.status_code == 200, r.text
        assert r.json()["deleted"] == 1

        # Second delete is a no-op (idempotent).
        r2 = requests.delete(
            f"{BASE_URL}/api/admin/partners/{pkey}", headers=HEADERS, timeout=5
        )
        assert r2.status_code == 200
        assert r2.json()["deleted"] == 0


# ─── subscriber summary ──────────────────────────────────────────────
class TestSubscriberSummary:
    def test_requires_admin(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/subscribers/summary", timeout=5
        )
        assert r.status_code == 401

    def test_summary_envelope_shape(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/bot/subscribers/summary",
            headers=HEADERS,
            timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("total", "active_bound", "consent_marketing", "by_status", "by_segment"):
            assert k in body, f"missing summary key {k}"
        assert isinstance(body["by_status"], dict)
        assert isinstance(body["by_segment"], dict)
        # Counts are non-negative ints.
        for k in ("total", "active_bound", "consent_marketing"):
            assert isinstance(body[k], int) and body[k] >= 0
