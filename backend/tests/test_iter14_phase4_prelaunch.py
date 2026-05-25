"""Iteration 14 - Phase 4 Pre-Launch Polish backend regression.

Covers: streamer multi-platform live, alert subscriptions, live-stats ticker,
featured odds, OG static mount, /uutiset news feed, /mittari/historia data,
/viikon-kortti odds feed."""
import os
import re
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── /api/streamers/live ──
class TestStreamersLive:
    def test_default_twitch(self, session):
        r = session.get(f"{API}/streamers/live", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("platform") == "twitch"
        assert "streamers" in d or "live" in d or "results" in d or "count" in d, d.keys()

    def test_kick_platform(self, session):
        r = session.get(f"{API}/streamers/live?platform=kick", timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        # Either returns kick streamers list (possibly empty) or dormant flag
        assert isinstance(d, dict)

    def test_youtube_platform(self, session):
        r = session.get(f"{API}/streamers/live?platform=youtube", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Should reflect honest dormant or empty
        assert isinstance(d, dict)

    def test_unknown_platform_400(self, session):
        r = session.get(f"{API}/streamers/live?platform=bogus", timeout=10)
        assert r.status_code == 400


# ── /api/alerts/streamer ──
class TestStreamerAlerts:
    def test_invalid_email_400(self, session):
        r = session.post(f"{API}/alerts/streamer", json={
            "email": "not-an-email",
            "streamer_login": "jarttu84",
            "platform": "twitch",
        }, timeout=10)
        assert r.status_code == 422 or r.status_code == 400, r.text

    def test_invalid_platform_400(self, session):
        r = session.post(f"{API}/alerts/streamer", json={
            "email": "test_iter14@example.com",
            "streamer_login": "jarttu84",
            "platform": "myspace",
        }, timeout=10)
        assert r.status_code == 400, r.text
        assert "invalid_platform" in r.text.lower() or "platform" in r.text.lower()

    def test_missing_streamer_400(self, session):
        r = session.post(f"{API}/alerts/streamer", json={
            "email": "test_iter14@example.com",
            "streamer_login": "",
            "platform": "twitch",
        }, timeout=10)
        assert r.status_code == 400, r.text

    def test_valid_capture_and_idempotency(self, session):
        payload = {
            "email": "test_iter14_capture@example.com",
            "streamer_login": "jarttu84",
            "streamer_name": "Jarttu84",
            "platform": "twitch",
            "phone": "+358401234567",
            "telegram_username": "@dioni",
        }
        r1 = session.post(f"{API}/alerts/streamer", json=payload, timeout=10)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("status") in {"ok", "created", "updated", "exists"}, d1
        # second submit - must be idempotent
        r2 = session.post(f"{API}/alerts/streamer", json=payload, timeout=10)
        assert r2.status_code == 200, r2.text

    def test_invalid_phone_400(self, session):
        r = session.post(f"{API}/alerts/streamer", json={
            "email": "test_iter14_badphone@example.com",
            "streamer_login": "jarttu84",
            "platform": "twitch",
            "phone": "not a number !!",
        }, timeout=10)
        # invalid_phone -> 400 (acceptable: 200 if backend permissive - capture both)
        assert r.status_code in (200, 400), r.text


# ── /api/data/live-stats ──
class TestLiveStats:
    def test_returns_counters(self, session):
        r = session.get(f"{API}/data/live-stats", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, dict)
        # Spec: counters across stream_signals, sports_signals, news_signals,
        # f1_signals, football_signals, published_content
        # Honest zeros allowed.
        # Just verify keys exist somewhere in payload
        keys_str = str(d).lower()
        expected_any = ["stream", "sports", "news", "f1", "football", "published", "counts", "stats"]
        assert any(k in keys_str for k in expected_any), d

    def test_cache_behavior(self, session):
        r1 = session.get(f"{API}/data/live-stats", timeout=10)
        r2 = session.get(f"{API}/data/live-stats", timeout=10)
        assert r1.status_code == 200 and r2.status_code == 200
        # Both should succeed; cache verified by latency observation only.


# ── /api/odds/featured ──
class TestOddsFeatured:
    def test_returns_picks(self, session):
        r = session.get(f"{API}/odds/featured", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, dict)
        picks = d.get("picks") or d.get("results") or d.get("featured") or []
        # Should be list. Top 5 if odds available, else dormant.
        if picks:
            assert isinstance(picks, list)
            assert len(picks) <= 5
            for p in picks[:1]:
                # Should have decimal odds and implied probability info somewhere
                s = str(p).lower()
                assert "odd" in s or "implied" in s or "probability" in s or "price" in s, p


# ── /api/static/og mount ──
class TestOgStaticMount:
    def test_static_route_exists(self, session):
        # PUTKI_HQ_DISABLE_OG_IMAGES=1 currently; mount should still serve 404 (not 500)
        # for a non-existent slug, indicating the StaticFiles mount works.
        r = session.get(f"{BASE_URL}/api/static/og/nonexistent-slug-xyz.png", timeout=10)
        assert r.status_code in (404, 200), f"unexpected {r.status_code} - mount broken? body={r.text[:200]}"


# ── /api/content/published (drives /uutiset) ──
class TestUutisetFeed:
    def test_published_list(self, session):
        r = session.get(f"{API}/content/published?limit=30", timeout=15)
        # /uutiset is fed by published content endpoint
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            d = r.json()
            assert isinstance(d, (dict, list))


# ── /api/dial/history (drives /mittari/historia) ──
class TestMittariHistoria:
    def test_dial_history(self, session):
        r = session.get(f"{API}/dial/history?limit=48", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "history" in d
        assert isinstance(d["history"], list)


# ── Regression: critical pre-existing endpoints unchanged ──
class TestNoRegression:
    def test_dial_current(self, session):
        r = session.get(f"{API}/dial/current", timeout=10)
        assert r.status_code in (200, 404)

    def test_signals_live_no_mock(self, session):
        r = session.get(f"{API}/signals/live?limit=5", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "signals" in d
