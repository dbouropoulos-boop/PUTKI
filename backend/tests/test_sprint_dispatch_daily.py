"""
PUTKI HQ — Daily dispatch + bell-icon + newsroom alerts metric tests.
"""
import os
import asyncio
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://pelisignaali-fi.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN})
    return s


@pytest.fixture(scope="module")
def public():
    return requests.Session()


# ── /api/newsroom/live-stats now exposes alerts_dispatched_24h ──

class TestNewsroomAlertsMetric:
    def test_field_present(self, public):
        r = public.get(f"{BASE_URL}/api/newsroom/live-stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "alerts_dispatched_24h" in d
        assert isinstance(d["alerts_dispatched_24h"], int)
        assert d["alerts_dispatched_24h"] >= 0


# ── /api/streamers/recent-alerts powers the bell pulse ──

class TestStreamersRecentAlerts:
    def test_default_window(self, public):
        r = public.get(f"{BASE_URL}/api/streamers/recent-alerts", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["within_minutes"] == 60
        assert isinstance(d["by_streamer"], dict)

    def test_custom_window_clamped(self, public):
        r = public.get(f"{BASE_URL}/api/streamers/recent-alerts?within_minutes=999999", timeout=10)
        assert r.status_code == 200
        # Clamped to 1440 (24h)
        assert r.json()["within_minutes"] == 1440

    def test_minimum_window_floor(self, public):
        r = public.get(f"{BASE_URL}/api/streamers/recent-alerts?within_minutes=0", timeout=10)
        assert r.status_code == 200
        assert r.json()["within_minutes"] == 1


# ── /api/admin/dispatch/* ──

class TestDispatchEndpoints:
    def test_auth_required(self, public):
        r = public.post(f"{BASE_URL}/api/admin/dispatch/run", json={"dry_run": True}, timeout=10)
        assert r.status_code == 401
        r2 = public.get(f"{BASE_URL}/api/admin/dispatch/log", timeout=10)
        assert r2.status_code == 401
        r3 = public.get(f"{BASE_URL}/api/admin/dispatch/summary", timeout=10)
        assert r3.status_code == 401

    def test_run_dry_run_writes_audit(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/dispatch/run", json={"dry_run": True}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "cycle"
        assert d["dry_run"] is True
        results = d["results"]
        channels = {row["channel"] for row in results}
        assert channels == {"email", "sms", "telegram"}
        # In dry-run mode no row can have delivered>0
        for row in results:
            assert row["delivered"] == 0
            assert row["errors"] == 0

    def test_log_returns_cycle_rows(self, admin):
        # Trigger fresh cycle so we always have rows
        admin.post(f"{BASE_URL}/api/admin/dispatch/run", json={"dry_run": True}, timeout=30)
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/log?limit=10", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        kinds = {it.get("kind") for it in items}
        assert "cycle" in kinds or "send" in kinds

    def test_summary_aggregates(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/dispatch/summary?days=7", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["window_days"] == 7
        assert "rows" in d
        assert isinstance(d["rows"], list)
        # When rows exist, each row carries the required shape
        for row in d["rows"]:
            assert "channel" in row and "mode" in row and "segment" in row and "count" in row


# ── dispatch_daily module unit tests ──

class TestDispatchModuleUnit:
    def test_helsinki_now_returns_tz_aware(self):
        from dispatch_daily import _helsinki_now
        dt = _helsinki_now()
        assert dt.tzinfo is not None

    def test_today_key_format(self):
        from dispatch_daily import _today_key
        key = _today_key()
        # YYYY-MM-DD
        assert len(key) == 10 and key[4] == "-" and key[7] == "-"

    def test_channel_live_mode_dry_run_when_no_keys(self, monkeypatch):
        import dispatch_daily
        monkeypatch.setattr(dispatch_daily, "RESEND_API_KEY", "")
        monkeypatch.setattr(dispatch_daily, "RESEND_FROM", "")
        is_live, provider = dispatch_daily._channel_live_mode("email")
        assert is_live is False
        assert provider == "resend"

    def test_channel_live_mode_live_when_keys_present(self, monkeypatch):
        import dispatch_daily
        monkeypatch.setattr(dispatch_daily, "RESEND_API_KEY", "rk_test")
        monkeypatch.setattr(dispatch_daily, "RESEND_FROM", "noreply@x.com")
        is_live, provider = dispatch_daily._channel_live_mode("email")
        assert is_live is True
        assert provider == "resend"

    def test_render_sms_text_no_picks(self):
        from dispatch_daily import _render_sms_text
        out = _render_sms_text({"picks": []})
        assert "Ei tänään" in out

    def test_render_sms_text_with_picks_within_limit(self):
        from dispatch_daily import _render_sms_text
        out = _render_sms_text({"picks": [
            {"pick": "HJK", "odds_decimal": 1.85, "sharpness": 82},
            {"pick": "Inter", "odds_decimal": 2.10, "sharpness": 78},
        ]})
        # SMS body should fit Twilio's segment-friendly window
        assert len(out) <= 480
        assert "HJK" in out and "Inter" in out
        assert "S82" in out

    def test_render_email_text_includes_mittari_section(self):
        from dispatch_daily import _render_email_text
        out = _render_email_text({"sections": [
            {"kind": "mittari", "label": "KUUMA", "value": 65, "headline": "Skene käy"},
            {"kind": "news", "items": [{"source": "Yle", "title": "Otsikko", "url": "https://x"}]},
            {"kind": "skene", "news_24h": 47},
        ]})
        assert "KUUMA" in out and "65" in out
        assert "Yle" in out and "Otsikko" in out
        assert "47" in out
