"""Phase 3 V2 Step 1 — Operators + Streamers registry tests."""
import os
import uuid

import requests


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "mittari-admin")
HDR = {"X-Admin-Token": TOK}


class TestOperatorsRegistry:
    def test_public_list_returns_seeded_operators(self):
        r = requests.get(f"{API}/operators", timeout=10)
        assert r.status_code == 200
        d = r.json()
        ops = d["operators"]
        assert len(ops) >= 12
        slugs = {o["slug"] for o in ops}
        assert "weezybet" in slugs
        assert "paf" in slugs

    def test_seeded_have_market_id_fi(self):
        r = requests.get(f"{API}/operators", timeout=10)
        for op in r.json()["operators"]:
            assert op.get("market_id") == "FI"
            assert "oneLiner" in op  # camelCase contract for frontend

    def test_partner_filter(self):
        r = requests.get(f"{API}/operators?partner_only=true", timeout=10)
        assert r.status_code == 200
        ops = r.json()["operators"]
        assert all(op["partner"] is True for op in ops)
        assert any(op["slug"] == "weezybet" for op in ops)

    def test_public_get_by_slug(self):
        r = requests.get(f"{API}/operators/weezybet", timeout=10)
        assert r.status_code == 200
        assert r.json()["name"] == "Weezybet"

    def test_admin_crud_roundtrip(self):
        slug = f"test-op-{uuid.uuid4().hex[:6]}"
        payload = {"name": "Test Op", "logo": "X", "score": 50, "oneLiner": "Test.", "offer": "—", "payout": "—", "license": "MGA", "trustpilot": 3.5, "year": 2026, "partner": False, "active": True, "market_id": "FI"}
        # CREATE via PUT (upsert)
        r = requests.put(f"{API}/admin/operators/{slug}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 200
        # READ via public
        r = requests.get(f"{API}/operators/{slug}", timeout=10)
        assert r.status_code == 200
        # UPDATE
        payload["score"] = 65
        r = requests.put(f"{API}/admin/operators/{slug}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.json()["score"] == 65
        # DELETE
        r = requests.delete(f"{API}/admin/operators/{slug}", headers=HDR, timeout=10)
        assert r.status_code == 200
        r = requests.get(f"{API}/operators/{slug}", timeout=10)
        assert r.status_code == 404

    def test_admin_endpoints_require_token(self):
        r = requests.get(f"{API}/admin/operators", timeout=10)
        assert r.status_code == 401


class TestStreamersRegistry:
    def test_public_list_market_filter(self):
        r = requests.get(f"{API}/streamers?market=fi", timeout=10)
        assert r.status_code == 200
        rows = r.json()["streamers"]
        assert all(s["scene"] == "finnish" for s in rows)
        assert len(rows) >= 15

    def test_public_list_intl_includes_all_scenes(self):
        r = requests.get(f"{API}/streamers?market=intl", timeout=10)
        d = r.json()
        rows = d["streamers"]
        scenes = {s["scene"] for s in rows}
        assert scenes.issubset({"intl_global", "intl_swedish", "intl_dutch", "intl_norwegian"})
        # intl_scenes meta surfaces in same response
        assert "intl_scenes" in d
        assert "intl_global" in d["intl_scenes"]
        assert "iso" in d["intl_scenes"]["intl_global"]

    def test_seeded_have_market_id_fi(self):
        r = requests.get(f"{API}/streamers", timeout=10)
        for s in r.json()["streamers"]:
            assert s.get("market_id") == "FI"

    def test_public_get_by_slug(self):
        r = requests.get(f"{API}/streamers/jarttu84", timeout=10)
        assert r.status_code == 200
        assert r.json()["name"] == "Jarttu84"

    def test_admin_crud_roundtrip(self):
        slug = f"test-str-{uuid.uuid4().hex[:6]}"
        payload = {"name": "TestStreamer", "platform": "Twitch", "channel": "teststreamer", "tier": 2, "scene": "finnish", "photo": "", "followers": "1k", "sub": "Test bio", "active": True, "market_id": "FI"}
        r = requests.put(f"{API}/admin/streamers/{slug}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 200
        r = requests.get(f"{API}/streamers/{slug}", timeout=10)
        assert r.status_code == 200
        r = requests.delete(f"{API}/admin/streamers/{slug}", headers=HDR, timeout=10)
        assert r.status_code == 200


class TestPublicDialHistory:
    def test_public_dial_history_endpoint(self):
        r = requests.get(f"{API}/dial/history?limit=10", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "history" in d
        assert isinstance(d["history"], list)
