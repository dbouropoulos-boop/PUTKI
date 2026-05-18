"""Iteration 23 — Phase 1 PUTKI HQ homepage restructure backend tests.

Covers:
- GET /api/news/ticker (ticker items shape + relevance >= 45)
- GET /api/odds/featured (nested sharpness object + _avg_implied_now stripped)
- GET /api/odds/market-watch (score/band/sparkline shape)
- POST /api/subscribe/dial-alerts (new + legacy min_state values)
"""

import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- News ticker ----------
class TestNewsTicker:
    def test_news_ticker_shape(self, api):
        r = api.get(f"{BASE_URL}/api/news/ticker?limit=20", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "count" in data and "as_of" in data
        assert isinstance(data["items"], list)
        # tolerate near-empty ticker right after restart but normally >= 5
        if data["count"] >= 1:
            item = data["items"][0]
            for k in ("source", "title", "url", "category", "severity", "relevance", "captured_at", "entity_tags"):
                assert k in item, f"missing key {k} in ticker item"
            assert item["relevance"] >= 45, "relevance gate (>=45) violated"

    def test_news_ticker_all_items_above_threshold(self, api):
        r = api.get(f"{BASE_URL}/api/news/ticker?limit=20", timeout=20)
        data = r.json()
        for it in data["items"]:
            assert it["relevance"] >= 45


# ---------- Odds featured: Sharpness contract + _avg_implied_now stripped ----------
class TestOddsFeatured:
    def test_picks_have_sharpness_object(self, api):
        r = api.get(f"{BASE_URL}/api/odds/featured", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "picks" in data
        assert len(data["picks"]) > 0
        for p in data["picks"]:
            assert "sharpness" in p, "pick missing nested sharpness"
            s = p["sharpness"]
            assert isinstance(s["sharpness"], int)
            assert 0 <= s["sharpness"] <= 100
            comp = s["components"]
            for k in ("implied_prob_score", "consensus_tightness", "recency_momentum"):
                assert k in comp
            w = s["weights"]
            assert w["implied_prob"] == 0.5
            assert w["tightness"] == 0.3
            assert w["momentum"] == 0.2
            assert s["band"] in ("tight", "clear", "mixed", "loose", "scattered")
            assert s["modifier"] in (None, "tightened", "softened")
            assert isinstance(s["book_count"], int)
            assert isinstance(s["has_momentum_history"], bool)

    def test_avg_implied_now_stripped(self, api):
        r = api.get(f"{BASE_URL}/api/odds/featured", timeout=30)
        assert "_avg_implied_now" not in r.text, "internal field _avg_implied_now leaked to client"
        data = r.json()
        for p in data["picks"]:
            assert "_avg_implied_now" not in p


# ---------- Market watch ----------
class TestMarketWatch:
    def test_market_watch_shape(self, api):
        r = api.get(f"{BASE_URL}/api/odds/market-watch", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "score" in data and "band" in data and "sparkline" in data and "as_of" in data
        assert 0 <= data["score"] <= 100
        assert data["band"] in ("tight", "clear", "mixed", "loose", "scattered")
        assert isinstance(data["sparkline"], list)
        assert len(data["sparkline"]) >= 1
        for pt in data["sparkline"]:
            assert "date" in pt and "score" in pt
            assert 0 <= pt["score"] <= 100


# ---------- Dial alerts: new + legacy min_state values ----------
class TestDialAlertSubscribe:
    @pytest.mark.parametrize("min_state", [
        "VIPINÄ", "MEININKI", "PERKELE", "ACTIVE", "ROLLING",       # new
        "WARM", "RUSH", "JACKPOT", "TULOSSA", "VOITTOPUTKI", "RYÖSTÖPUTKI",  # legacy
    ])
    def test_subscribe_accepts_min_state(self, api, min_state):
        payload = {
            "channel": "email",
            "contact": f"TEST_iter23_{min_state.lower()}@example.com",
            "min_state": min_state,
        }
        r = api.post(f"{BASE_URL}/api/subscribe/dial-alerts", json=payload, timeout=15)
        assert r.status_code in (200, 201), f"{min_state} -> {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("status") in ("created", "updated")

    def test_subscribe_rejects_unknown_state(self, api):
        r = api.post(
            f"{BASE_URL}/api/subscribe/dial-alerts",
            json={"channel": "email", "contact": "TEST_iter23_bogus@example.com", "min_state": "BOGUS"},
            timeout=15,
        )
        assert r.status_code == 422
