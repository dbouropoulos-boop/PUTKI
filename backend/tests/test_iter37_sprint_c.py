"""Iter 37 — Sprint C: Lead aggregate + Telegram log + admin auth gating."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
ADMIN = {"X-Admin-Token": "putki-hq-admin"}


# ---- /api/admin/leads/summary ----
class TestLeadsSummary:
    def test_summary_ok_and_shape(self):
        r = requests.get(f"{BASE_URL}/api/admin/leads/summary", headers=ADMIN, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # counts shape
        assert "counts" in d
        for k in ("mestari", "voita", "mittari", "total"):
            assert k in d["counts"], f"missing counts.{k}"
            assert isinstance(d["counts"][k], int), f"counts.{k} not int"
        # fresh_24h shape
        assert "fresh_24h" in d
        for k in ("mestari", "voita", "mittari"):
            assert isinstance(d["fresh_24h"][k], int)
        # telegram shape
        assert "telegram" in d
        assert "voita_bound" in d["telegram"]
        assert "mittari_bound_active" in d["telegram"]
        assert isinstance(d["telegram"]["voita_bound"], int)
        assert isinstance(d["telegram"]["mittari_bound_active"], int)

    def test_summary_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/leads/summary", timeout=15)
        assert r.status_code in (401, 403)


# ---- /api/admin/leads ----
class TestLeads:
    @pytest.mark.parametrize("source,tag", [
        ("mestari", "mestari_lead"),
        ("voita", "voita_lead"),
        ("mittari", "mittari_lead"),
    ])
    def test_filter_by_source(self, source, tag):
        r = requests.get(f"{BASE_URL}/api/admin/leads?source={source}&limit=10",
                         headers=ADMIN, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d
        assert "counts" in d
        assert "fresh_24h" in d
        assert d.get("filter") == source
        for item in d["items"]:
            assert item.get("consent_tag") == tag, f"item leaked: {item}"

    def test_no_source_returns_all(self):
        r = requests.get(f"{BASE_URL}/api/admin/leads?limit=10",
                         headers=ADMIN, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "counts" in d
        # filter should be None/missing
        assert d.get("filter") in (None, "", "all")

    def test_leads_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/leads?limit=1", timeout=15)
        assert r.status_code in (401, 403)


# ---- /api/admin/telegram/log ----
class TestTelegramLog:
    def test_log_ok_and_shape(self):
        r = requests.get(f"{BASE_URL}/api/admin/telegram/log?limit=5",
                         headers=ADMIN, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d
        assert "total" in d
        assert "fresh_24h" in d
        assert isinstance(d["total"], int)
        assert isinstance(d["fresh_24h"], int)
        if d["items"]:
            it = d["items"][0]
            for k in ("received_at", "update_id", "chat_id", "result"):
                assert k in it, f"missing {k} in log item"
            assert "handled" in it["result"]
            # newest-first
            ts = [i["received_at"] for i in d["items"]]
            assert ts == sorted(ts, reverse=True), "log not sorted desc"

    def test_log_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/telegram/log?limit=1", timeout=15)
        assert r.status_code in (401, 403)


# ---- counts consistency (summary == leads aggregate) ----
class TestConsistency:
    def test_summary_and_leads_counts_match(self):
        rs = requests.get(f"{BASE_URL}/api/admin/leads/summary", headers=ADMIN, timeout=15).json()
        rl = requests.get(f"{BASE_URL}/api/admin/leads?source=mestari&limit=1",
                          headers=ADMIN, timeout=15).json()
        assert rs["counts"] == rl["counts"], f"mismatch: {rs['counts']} vs {rl['counts']}"
