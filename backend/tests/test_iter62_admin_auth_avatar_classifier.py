"""
Iter62 — Admin auth v2, audit log, avatar fallback, classifier Tier 2.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
LEGACY_TOKEN = "putki-hq-admin"


# ─── Admin auth ──────────────────────────────────────────────────────────

def test_legacy_token_still_works():
    r = httpx.get(f"{BASE}/api/admin/users",
                  headers={"X-Admin-Token": LEGACY_TOKEN}, timeout=15.0)
    assert r.status_code == 200
    users = r.json()["users"]
    assert any(u["username"] == "root" for u in users), \
        "root user should be bootstrapped from BACK_OFFICE_TOKEN"


def test_bad_token_rejected_with_401():
    r = httpx.get(f"{BASE}/api/admin/users",
                  headers={"X-Admin-Token": "definitely-wrong"}, timeout=15.0)
    assert r.status_code == 401


def test_missing_token_rejected_with_401():
    r = httpx.get(f"{BASE}/api/admin/users", timeout=15.0)
    assert r.status_code == 401


def test_audit_log_returns_recent_actions():
    r = httpx.get(f"{BASE}/api/admin/audit-log?limit=5",
                  headers={"X-Admin-Token": LEGACY_TOKEN}, timeout=15.0)
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert isinstance(rows, list)
    for row in rows:
        assert {"id", "ts", "actor", "role", "action", "resource"} <= set(row.keys())


# ─── Per-streamer avatar refresh ─────────────────────────────────────────

def test_refresh_one_avatar_404_on_unknown():
    r = httpx.post(f"{BASE}/api/admin/streamers/nonexistent-xyz123/refresh-avatar",
                   headers={"X-Admin-Token": LEGACY_TOKEN}, timeout=20.0)
    assert r.status_code == 404


def test_refresh_one_avatar_returns_source():
    """A known streamer slug must come back with `avatar_source` populated
    even if the platform API is unavailable — the fallback cascade must
    return at least 'exhausted_all_fallbacks'.
    """
    streamers = httpx.get(f"{BASE}/api/admin/streamers",
                          headers={"X-Admin-Token": LEGACY_TOKEN}, timeout=15.0).json()["streamers"]
    if not streamers:
        return  # nothing to test
    slug = streamers[0]["slug"]
    r = httpx.post(f"{BASE}/api/admin/streamers/{slug}/refresh-avatar",
                   headers={"X-Admin-Token": LEGACY_TOKEN}, timeout=30.0)
    assert r.status_code == 200
    j = r.json()
    assert j["slug"] == slug
    assert j["avatar_source"] in {
        "platform_api", "channel_og", "ddg_search", "wikipedia", "exhausted_all_fallbacks",
    }


# ─── Classifier Tier 2 integration ───────────────────────────────────────

def test_classifier_tier1_only_when_flag_off():
    """When NEWS_CLASSIFIER_AI_FALLBACK_ENABLED is unset/0 the wrapper
    must NEVER call Haiku — verify by asserting `_tier2` is absent."""
    os.environ.pop("NEWS_CLASSIFIER_AI_FALLBACK_ENABLED", None)
    from news_classifier import classify_item_with_fallback
    import asyncio
    out = asyncio.run(classify_item_with_fallback(
        title="Random local politician makes minor statement about budget",
        source="generic-newswire",
        source_tier=3,
    ))
    assert "_tier2" not in out or not out["_tier2"], \
        "Tier 2 must NOT fire when env flag is unset"
    assert "category" in out
    assert "relevance" in out
