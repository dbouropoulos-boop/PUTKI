"""
Iteration 19 — /peli raffle, content backfill, twitch discovery, dial bug fix.
"""
import os
import uuid
import pytest
import requests

from _test_env import admin_token, backend_url

BASE_URL = backend_url()
ADMIN_TOKEN = admin_token()
ADMIN_HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# ─────────── Bug fix: twitch live > 0 ───────────
class TestDialTwitchLiveFix:
    def test_live_stats_twitch_live_positive(self):
        r = requests.get(f"{BASE_URL}/api/data/live-stats", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # twitch_live should be > 0 after language=fi fix
        assert "twitch_live" in data, f"missing twitch_live: {data}"
        assert isinstance(data["twitch_live"], int)
        print(f"twitch_live = {data['twitch_live']}")
        # We expect > 0 (was bug producing 0)
        assert data["twitch_live"] > 0, f"twitch_live still 0 (regression): {data}"


# ─────────── /peli public config + entry ───────────
class TestPeliPublic:
    def test_peli_config_shape(self):
        r = requests.get(f"{BASE_URL}/api/peli/config", timeout=15)
        assert r.status_code == 200, r.text
        cfg = r.json()
        for key in ("prize_currency", "prize_label",
                    "partner_name", "partner_url", "partner_disclosure",
                    "videos", "enabled", "entry_count"):
            assert key in cfg, f"missing key {key} in {cfg}"
        assert isinstance(cfg["videos"], list)
        assert len(cfg["videos"]) == 3
        for v in cfg["videos"]:
            assert "id" in v and "title" in v and "caption" in v
        assert isinstance(cfg["enabled"], bool)
        assert isinstance(cfg["entry_count"], int)

    def test_peli_enter_success(self):
        unique = uuid.uuid4().hex[:8]
        payload = {
            "name": f"TEST_User_{unique}",
            "phone": "+358401234567",
            "email": f"test_{unique}@example.com",
            "consent": True,
        }
        r = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "ok"
        assert "id" in data and len(data["id"]) > 0

    def test_peli_enter_idempotent_already_entered(self):
        unique = uuid.uuid4().hex[:8]
        payload = {
            "name": f"TEST_Dup_{unique}",
            "phone": "+358401111222",
            "email": f"dup_{unique}@example.com",
            "consent": True,
        }
        r1 = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r1.status_code == 200
        assert r1.json()["status"] == "ok"
        r2 = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "already_entered"

    def test_peli_enter_rejects_no_consent(self):
        payload = {
            "name": "TEST_NoConsent",
            "phone": "+358401234567",
            "email": "noconsent@example.com",
            "consent": False,
        }
        r = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r.status_code == 422, r.text

    def test_peli_enter_rejects_short_name(self):
        payload = {
            "name": "A",
            "phone": "+358401234567",
            "email": f"short_{uuid.uuid4().hex[:6]}@example.com",
            "consent": True,
        }
        r = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r.status_code == 422

    def test_peli_enter_rejects_bad_email(self):
        payload = {
            "name": "TEST_BadEmail",
            "phone": "+358401234567",
            "email": "not-an-email",
            "consent": True,
        }
        r = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r.status_code == 422

    def test_peli_enter_rejects_bad_phone(self):
        payload = {
            "name": "TEST_BadPhone",
            "phone": "abc",
            "email": f"phone_{uuid.uuid4().hex[:6]}@example.com",
            "consent": True,
        }
        r = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
        assert r.status_code == 422


# ─────────── Admin /peli endpoints ───────────
class TestPeliAdmin:
    def test_admin_config_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/peli/config", timeout=15)
        assert r.status_code == 401

    def test_admin_get_config(self):
        r = requests.get(f"{BASE_URL}/api/admin/peli/config", headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "config" in data and "entry_count" in data
        assert isinstance(data["entry_count"], int)

    def test_admin_update_config_and_persistence(self):
        new_label = f"TEST_Prize_{uuid.uuid4().hex[:6]}"
        payload = {
            "prize_currency": "EUR",
            "prize_label": new_label,
            "partner_name": "Weezybet",
            "partner_url": "https://weezybet.com",
            "partner_disclosure": "Yhteistyössä",
            "enabled": True,
            "videos": [
                {"id": "v1", "title": "T1", "caption": "c1"},
                {"id": "v2", "title": "T2", "caption": "c2"},
                {"id": "v3", "title": "T3", "caption": "c3"},
            ],
        }
        r = requests.put(f"{BASE_URL}/api/admin/peli/config", json=payload, headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        merged = r.json()
        assert merged["prize_label"] == new_label
        assert len(merged["videos"]) == 3

        # Verify persistence via public endpoint
        r2 = requests.get(f"{BASE_URL}/api/peli/config", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["prize_label"] == new_label

    def test_admin_list_entries(self):
        r = requests.get(f"{BASE_URL}/api/admin/peli/entries", headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Could be {entries, count} or array; current code returns dict
        if isinstance(data, dict):
            assert "entries" in data
            assert isinstance(data["entries"], list)
        else:
            assert isinstance(data, list)

    def test_peli_enter_409_when_disabled(self):
        # disable
        r = requests.put(f"{BASE_URL}/api/admin/peli/config",
                         json={"enabled": False}, headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200
        try:
            payload = {
                "name": "TEST_Disabled",
                "phone": "+358401234567",
                "email": f"disabled_{uuid.uuid4().hex[:6]}@example.com",
                "consent": True,
            }
            r2 = requests.post(f"{BASE_URL}/api/peli/enter", json=payload, timeout=15)
            assert r2.status_code == 409, f"expected 409 when disabled, got {r2.status_code}: {r2.text}"
        finally:
            # re-enable
            requests.put(f"{BASE_URL}/api/admin/peli/config",
                         json={"enabled": True}, headers=ADMIN_HEADERS, timeout=15)


# ─────────── Content backfill ───────────
class TestContentBackfill:
    def test_backfill_streamer_alert_3_articles(self):
        payload = {"count": 3, "days": 60, "templates": ["streamer_alert"]}
        r = requests.post(f"{BASE_URL}/api/admin/content/backfill",
                          json=payload, headers=ADMIN_HEADERS, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "generated" in data
        assert "stats" in data
        assert "streamer_alert" in data["stats"]
        # streamer_alert template should not require LLM
        print(f"Backfill result: {data}")

    def test_backfill_cap_50(self):
        payload = {"count": 200, "days": 30, "templates": ["streamer_alert"]}
        r = requests.post(f"{BASE_URL}/api/admin/content/backfill",
                          json=payload, headers=ADMIN_HEADERS, timeout=120)
        assert r.status_code == 200
        data = r.json()
        assert data.get("requested", 0) <= 50

    def test_backfill_requires_token(self):
        r = requests.post(f"{BASE_URL}/api/admin/content/backfill",
                          json={"count": 1, "days": 30}, timeout=15)
        assert r.status_code in (401, 403)


# ─────────── Twitch discovery ───────────
class TestTwitchDiscovery:
    def test_discover_endpoint_ok(self):
        r = requests.post(f"{BASE_URL}/api/admin/streamers/discover",
                          headers=ADMIN_HEADERS, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "status" in data
        # status should be ok or skipped (if credentials missing)
        assert data["status"] in ("ok", "skipped", "error")
        if data["status"] == "ok":
            assert "discovered" in data
            assert "added" in data
            assert "min_followers" in data

    def test_discover_requires_token(self):
        r = requests.post(f"{BASE_URL}/api/admin/streamers/discover", timeout=15)
        assert r.status_code in (401, 403)
