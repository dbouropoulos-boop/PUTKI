"""
PUTKI HQ - Sprint follow-up: AI-assisted streamer meta + slot registry
back-office endpoints (2026-05-19).

Covers the new admin surfaces:
    POST   /api/admin/streamer-meta/generate-draft
    POST   /api/admin/streamer-meta/publish
    POST   /api/admin/streamer-meta/suppress
    GET    /api/admin/streamer-meta/v2
    GET    /api/admin/streamer-meta/history/{platform}/{user_login}

    GET    /api/admin/slot-registry
    POST   /api/admin/slot-registry
    PATCH  /api/admin/slot-registry/{id}
    DELETE /api/admin/slot-registry/{id}
    POST   /api/admin/slot-registry/seed

LLM calls are unit-tested via direct import of `streamer_meta_drafter`
so we don't burn the Universal Key budget every CI run.
"""
import os
import asyncio
import uuid
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
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─────────────────────── streamer_meta v2 (listing) ───────────────────────

class TestStreamerMetaV2Listing:
    def test_auth_required(self, public):
        r = public.get(f"{BASE_URL}/api/admin/streamer-meta/v2", timeout=10)
        assert r.status_code == 401

    def test_listing_returns_rate_limit(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/streamer-meta/v2", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and isinstance(d["items"], list)
        assert "rate_limit" in d
        rl = d["rate_limit"]
        assert rl["limit_per_hour"] == 10
        assert rl["window_seconds"] == 3600
        assert isinstance(rl["remaining"], int)
        assert rl["ai_enabled"] in (True, False)


# ─────────────────────── publish + suppress + history ───────────────────────

class TestStreamerMetaPublishFlow:
    def test_publish_writes_history_and_visible_via_v2(self, admin):
        login = f"pytest-user-{uuid.uuid4().hex[:8]}"
        # Publish (creates a fresh row + 1 history entry)
        r = admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/publish",
            json={
                "platform": "twitch",
                "user_login": login,
                "meta_line_fi": "FI testirivi - vain testi.",
                "meta_line_en": "EN test line - testing only.",
            },
            timeout=10,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        published = d["published"]
        assert published["status"] == "published"
        assert published["meta_line_fi"].startswith("FI testirivi")

        # History endpoint returns at least 1 row
        r2 = admin.get(
            f"{BASE_URL}/api/admin/streamer-meta/history/twitch/{login}",
            timeout=10,
        )
        assert r2.status_code == 200
        h = r2.json()["items"]
        assert len(h) >= 1
        assert h[0]["published_line_fi"].startswith("FI testirivi")

        # v2 listing surfaces the row with status=published
        r3 = admin.get(f"{BASE_URL}/api/admin/streamer-meta/v2", timeout=10)
        items = r3.json()["items"]
        match = [it for it in items if it["user_login"] == login]
        assert len(match) == 1
        assert match[0]["status"] == "published"

    def test_publish_rejects_empty_body(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/publish",
            json={
                "platform": "twitch",
                "user_login": f"empty-{uuid.uuid4().hex[:8]}",
                "meta_line_fi": "",
                "meta_line_en": "",
            },
            timeout=10,
        )
        assert r.status_code == 400

    def test_suppress_toggles_status(self, admin):
        login = f"pytest-suppress-{uuid.uuid4().hex[:8]}"
        admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/publish",
            json={"platform": "twitch", "user_login": login,
                  "meta_line_fi": "x", "meta_line_en": "y"},
            timeout=10,
        )
        r = admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/suppress",
            json={"platform": "twitch", "user_login": login, "suppressed": True},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["row"]["status"] == "suppressed"
        # Unsuppress restores published
        r2 = admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/suppress",
            json={"platform": "twitch", "user_login": login, "suppressed": False},
            timeout=10,
        )
        assert r2.json()["row"]["status"] == "published"

    def test_suppress_missing_row_400(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/suppress",
            json={"platform": "twitch",
                  "user_login": f"nobody-{uuid.uuid4().hex[:8]}",
                  "suppressed": True},
            timeout=10,
        )
        assert r.status_code == 400


# ─────────────────────── AI draft endpoint ───────────────────────

class TestStreamerMetaDraftEndpoint:
    """Calls through HTTP without burning LLM credits - we expect either
    `llm_unavailable` (no key / budget) or `200 OK`. Either response
    proves the endpoint is reachable and the rate-limit/auth gates
    work. The deep LLM-output unit tests live in the drafter module."""

    def test_auth_required(self, public):
        r = public.post(
            f"{BASE_URL}/api/admin/streamer-meta/generate-draft",
            json={"platform": "twitch", "user_login": "anyone"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_invalid_login_400(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/streamer-meta/generate-draft",
            json={"platform": "twitch", "user_login": ""},
            timeout=10,
        )
        assert r.status_code == 400


# ─────────────────────── slot_registry ───────────────────────

class TestSlotRegistry:
    def test_auth_required(self, public):
        r = public.get(f"{BASE_URL}/api/admin/slot-registry", timeout=10)
        assert r.status_code == 401

    def test_listing_returns_seed(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/slot-registry", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 10
        names = {it["name"].lower() for it in items}
        assert "sweet bonanza" in names
        assert "crazy time" in names

    def test_add_patch_delete_lifecycle(self, admin):
        unique_name = f"PYTEST SLOT {uuid.uuid4().hex[:6]}"
        r = admin.post(
            f"{BASE_URL}/api/admin/slot-registry",
            json={"name": unique_name, "category": "slot", "provider": "Pytest"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        added = r.json()["added"]
        assert added["name"] == unique_name
        entry_id = added["id"]

        # PATCH disable
        r2 = admin.patch(
            f"{BASE_URL}/api/admin/slot-registry/{entry_id}",
            json={"enabled": False},
            timeout=10,
        )
        assert r2.status_code == 200
        assert r2.json()["updated"]["enabled"] is False

        # DELETE
        r3 = admin.delete(
            f"{BASE_URL}/api/admin/slot-registry/{entry_id}",
            timeout=10,
        )
        assert r3.status_code == 200

        # Listing no longer shows it
        r4 = admin.get(f"{BASE_URL}/api/admin/slot-registry", timeout=10)
        assert not any(it["id"] == entry_id for it in r4.json()["items"])

    def test_duplicate_name_400(self, admin):
        # Sweet Bonanza is in the seed list
        r = admin.post(
            f"{BASE_URL}/api/admin/slot-registry",
            json={"name": "Sweet Bonanza", "category": "slot", "provider": "Pragmatic"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_invalid_category_400(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/slot-registry",
            json={"name": f"x-{uuid.uuid4().hex[:6]}", "category": "bogus"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_reseed_is_idempotent(self, admin):
        r1 = admin.post(f"{BASE_URL}/api/admin/slot-registry/seed", timeout=10)
        assert r1.status_code == 200
        d1 = r1.json()
        # Second seed adds zero - idempotency contract
        r2 = admin.post(f"{BASE_URL}/api/admin/slot-registry/seed", timeout=10)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["inserted"] == 0
        assert d2["total"] >= d1["total"]


# ─────────────────────── now-playing extraction unit test ───────────────────────

class TestSlotRegistryExtraction:
    """Pure unit test against the longest-match-wins rule. No HTTP."""

    def test_longest_match_wins(self):
        from slot_registry import _build_match_index, _match_one

        registry = [
            {"name": "Sugar Rush", "name_lower": "sugar rush", "enabled": True, "category": "slot", "provider": "x"},
            {"name": "Sugar Rush 1000", "name_lower": "sugar rush 1000", "enabled": True, "category": "slot", "provider": "x"},
        ]
        idx = _build_match_index(registry)
        # The 1000 variant should be first in the sort (longest)
        assert idx[0]["name"] == "Sugar Rush 1000"
        # Match against a title containing "Sugar Rush 1000 grind"
        m = _match_one("Sugar Rush 1000 grind", idx)
        assert m["name"] == "Sugar Rush 1000"
        # And against a title with only the parent
        m2 = _match_one("Sugar Rush bonus hunt", idx)
        assert m2["name"] == "Sugar Rush"


# ─────────────────────── drafter module unit tests ───────────────────────

class TestDrafterModule:
    """Unit-level tests against the parser + cache helpers. No HTTP, no LLM."""

    def test_parse_llm_json_extracts_object_from_markdown_fence(self):
        from streamer_meta_drafter import _parse_llm_json
        raw = """Here is the JSON:
```json
{"draft_line_fi": "FI line", "draft_line_en": "EN line", "confidence": "medium", "notes_for_reviewer": "ok"}
```
"""
        parsed = _parse_llm_json(raw)
        assert parsed is not None
        assert parsed["draft_line_fi"] == "FI line"
        assert parsed["confidence"] == "medium"

    def test_parse_llm_json_rejects_missing_field(self):
        from streamer_meta_drafter import _parse_llm_json
        assert _parse_llm_json('{"draft_line_fi": "only fi"}') is None

    def test_parse_llm_json_clamps_invalid_confidence(self):
        from streamer_meta_drafter import _parse_llm_json
        p = _parse_llm_json('{"draft_line_fi": "x", "draft_line_en": "y", "confidence": "bogus"}')
        assert p["confidence"] == "low"

    def test_cache_freshness_helper(self):
        from streamer_meta_drafter import _is_cache_fresh
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        assert _is_cache_fresh({"draft_generated_at": now.isoformat()}) is True
        assert _is_cache_fresh({"draft_generated_at": (now - timedelta(days=60)).isoformat()}) is False
        assert _is_cache_fresh({}) is False
        assert _is_cache_fresh(None) is False
