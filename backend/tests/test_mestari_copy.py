"""Phase 3 — Mestari copy editor endpoint tests.

Coverage:
  GET /api/mestari/copy         — public merged tree
  GET /api/admin/mestari/copy   — auth-gated raw+merged+defaults
  PUT /api/admin/mestari/copy   — deep-merge, reset, paste-bomb cap
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = os.environ.get("PUTKI_ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}

TOP_KEYS = ["header", "hero", "cred", "method", "stack", "steps",
            "clarity", "team", "faq", "final", "footer"]
DEFAULT_FI_HEADLINE = "Millainen analyytikko sinä olet?"


@pytest.fixture(autouse=True)
def _reset_overrides():
    # Start every test from a clean default state.
    requests.put(f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
                 json={}, timeout=15)
    yield
    requests.put(f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
                 json={}, timeout=15)


class TestPublicEndpoint:
    def test_public_returns_full_tree_with_all_keys(self):
        r = requests.get(f"{BASE_URL}/api/mestari/copy", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in TOP_KEYS:
            assert k in data, f"missing top-level key: {k}"
        assert data["hero"]["fi"]["headline"] == DEFAULT_FI_HEADLINE
        # array lengths are fixed
        assert len(data["cred"]) == 4
        assert len(data["method"]["cards"]) == 4
        assert len(data["stack"]["items"]) == 3
        assert len(data["steps"]["rows"]) == 3
        assert len(data["faq"]["items"]) == 4
        assert len(data["footer"]["links"]) == 4
        assert len(data["clarity"]["is_items_fi"]) == 4


class TestAdminAuth:
    def test_admin_get_without_token_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/mestari/copy", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_admin_get_with_bad_token_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/mestari/copy",
                         headers={"X-Admin-Token": "wrong"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_get_with_token_200(self):
        r = requests.get(f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("raw", "merged", "defaults"):
            assert k in j
        assert j["defaults"]["hero"]["fi"]["headline"] == DEFAULT_FI_HEADLINE

    def test_admin_put_without_token_401(self):
        r = requests.put(f"{BASE_URL}/api/admin/mestari/copy", json={}, timeout=15)
        assert r.status_code in (401, 403)


class TestDeepMergeAndReset:
    def test_put_partial_hero_deep_merges(self):
        new_headline = "E2E test headline FI"
        payload = {"hero": {"fi": {"headline": new_headline}}}
        r = requests.put(f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
                         json=payload, timeout=15)
        assert r.status_code == 200, r.text
        merged = r.json()["merged"]
        assert merged["hero"]["fi"]["headline"] == new_headline
        # The default sub must be preserved (deep-merge, not replace)
        assert merged["hero"]["fi"]["sub"].startswith("90 sekunnin")
        # EN side untouched
        assert merged["hero"]["en"]["headline"] == "What kind of analyst are you?"

        # Public endpoint reflects the new value
        pub = requests.get(f"{BASE_URL}/api/mestari/copy", timeout=15).json()
        assert pub["hero"]["fi"]["headline"] == new_headline
        assert pub["hero"]["fi"]["sub"].startswith("90 sekunnin")

    def test_put_empty_body_resets_all_overrides(self):
        # First put a custom value
        requests.put(f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
                     json={"hero": {"fi": {"headline": "tmp-custom"}}}, timeout=15)
        # Now reset
        r = requests.put(f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
                         json={}, timeout=15)
        assert r.status_code == 200
        merged = r.json()["merged"]
        assert merged["hero"]["fi"]["headline"] == DEFAULT_FI_HEADLINE
        pub = requests.get(f"{BASE_URL}/api/mestari/copy", timeout=15).json()
        assert pub["hero"]["fi"]["headline"] == DEFAULT_FI_HEADLINE


class TestSanitiser:
    def test_paste_bomb_truncated_silently(self):
        big = "X" * 5000
        r = requests.put(
            f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
            json={"hero": {"fi": {"headline": big}}}, timeout=15,
        )
        assert r.status_code == 200, r.text
        merged = r.json()["merged"]
        headline = merged["hero"]["fi"]["headline"]
        assert len(headline) <= 240, f"expected <=240, got {len(headline)}"
        assert headline.startswith("X")

    def test_bad_shape_does_not_break(self):
        # Wrong shape (string instead of dict) should not blow up
        r = requests.put(
            f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS,
            json={"hero": "nope", "cred": "not-a-list"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        merged = r.json()["merged"]
        # Defaults preserved
        assert merged["hero"]["fi"]["headline"] == DEFAULT_FI_HEADLINE
        assert len(merged["cred"]) == 4
