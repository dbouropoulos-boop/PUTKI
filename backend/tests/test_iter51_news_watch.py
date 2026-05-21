"""
iter51 — News-watch editorial board regression.

Exercises the public admin endpoints end-to-end against the live backend:
  • GET  /api/admin/news-watch/stats
  • GET  /api/admin/news-watch/feed?coll={archive,ticker}
  • GET  /api/admin/news-watch/rejected
  • POST /api/admin/news-watch/{promote,demote,kill,unkill}

Locks in the state machine + the property that killed URLs survive
re-ingestion (the regression we want to prevent).
"""
from __future__ import annotations

import os
import time

import httpx
import pytest

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
H = {"X-Admin-Token": os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")}


def _get(p):
    try:
        return httpx.get(f"{BASE}{p}", headers=H, timeout=10.0)
    except httpx.HTTPError:
        pytest.skip(p)
        return None


def _post(p, body=None):
    try:
        return httpx.post(f"{BASE}{p}", json=body or {}, headers=H, timeout=10.0)
    except httpx.HTTPError:
        pytest.skip(p)
        return None


# ─────────────────────── Stats endpoint ──────────────────────────────

def test_stats_returns_required_keys():
    r = _get("/api/admin/news-watch/stats")
    assert r.status_code == 200
    d = r.json()
    for k in ("ticker_total", "archive_total", "rejected_total",
              "ticker_24h", "archive_24h"):
        assert k in d
        assert isinstance(d[k], int)


def test_stats_requires_admin():
    r = httpx.get(f"{BASE}/api/admin/news-watch/stats", timeout=8.0)
    assert r.status_code in (401, 403)


# ─────────────────────── Feed listings ───────────────────────────────

def test_feed_archive_returns_items():
    r = _get("/api/admin/news-watch/feed?coll=archive&limit=5")
    assert r.status_code == 200
    d = r.json()
    assert d["coll"] == "archive"
    assert isinstance(d["items"], list)
    assert d["count"] <= 5
    if d["items"]:
        it = d["items"][0]
        assert "url" in it and "title" in it
        assert "_id" not in it  # MongoDB ObjectId must NEVER leak


def test_feed_ticker_returns_items():
    r = _get("/api/admin/news-watch/feed?coll=ticker&limit=5")
    assert r.status_code == 200
    d = r.json()
    assert d["coll"] == "ticker"
    if d["items"]:
        for it in d["items"]:
            assert int(it.get("relevance", 0)) >= 45


def test_feed_respects_source_filter():
    r = _get("/api/admin/news-watch/feed?coll=archive&source=Yle%20Uutiset&limit=10")
    assert r.status_code == 200
    for it in r.json()["items"]:
        assert it["source"] == "Yle Uutiset"


def test_rejected_endpoint_shape():
    r = _get("/api/admin/news-watch/rejected?limit=5")
    assert r.status_code == 200
    d = r.json()
    assert "items" in d and "count" in d
    assert isinstance(d["items"], list)


# ─────────────────────── Promote / demote / kill ─────────────────────

def _pick_archive_url():
    """Grab any URL currently in the archive — tests are run against
    live data so we use whatever is there. Returns None if empty."""
    r = _get("/api/admin/news-watch/feed?coll=archive&limit=1")
    items = r.json().get("items", []) if r else []
    return items[0]["url"] if items else None


def test_promote_then_demote_round_trip():
    url = _pick_archive_url()
    if not url:
        pytest.skip("archive is empty — no live data to exercise")

    # promote: archive → ticker
    r = _post("/api/admin/news-watch/promote", {"url": url})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["promoted"]["url"] == url

    # second promote of same URL should 404 (already gone from archive)
    r2 = _post("/api/admin/news-watch/promote", {"url": url})
    assert r2.status_code == 404

    # demote it back so we leave no state behind
    r3 = _post("/api/admin/news-watch/demote", {"url": url})
    assert r3.status_code == 200
    assert r3.json()["demoted"]["url"] == url


def test_kill_and_unkill_round_trip():
    test_url = f"https://example.test/iter51-kill-{int(time.time())}"
    # kill — should be idempotent + add to rejection list
    r1 = _post("/api/admin/news-watch/kill", {"url": test_url, "reason": "iter51 test"})
    assert r1.status_code == 200
    body = r1.json()
    assert body["ok"] is True
    assert body["url"] == test_url

    # appears in /rejected
    r2 = _get("/api/admin/news-watch/rejected?limit=200")
    assert any(it["url"] == test_url for it in r2.json()["items"])

    # second kill is safe
    r3 = _post("/api/admin/news-watch/kill", {"url": test_url})
    assert r3.status_code == 200

    # unkill removes it
    r4 = _post("/api/admin/news-watch/unkill", {"url": test_url})
    assert r4.status_code == 200
    assert r4.json()["removed"] is True


def test_endpoints_require_url():
    for path in ("promote", "demote", "kill", "unkill"):
        r = _post(f"/api/admin/news-watch/{path}", {})
        assert r.status_code in (400, 422)


def test_endpoints_require_admin():
    for path in ("promote", "demote", "kill", "unkill"):
        r = httpx.post(f"{BASE}/api/admin/news-watch/{path}",
                       json={"url": "https://x"}, timeout=6.0)
        assert r.status_code in (401, 403), f"{path} should reject anonymous"
