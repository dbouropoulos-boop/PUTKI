"""Phase 1 Final Restructure · Chunk A - News portal backend tests.

Covers:
- GET /api/news/chronological (homepage chrono list)
- GET /api/news/featured (homepage 2 featured + og:image enrichment)
- /api/admin/og-blocklist CRUD (back-office removal-request handling)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://pelisignaali-fi.preview.emergentagent.com",
).rstrip("/")
ADMIN_TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN})
    return s


# ── /api/news/chronological ──
class TestChronological:
    def test_returns_items_with_expected_shape(self, api):
        r = api.get(f"{BASE_URL}/api/news/chronological?limit=5", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d
        items = d["items"]
        assert isinstance(items, list)
        assert len(items) <= 5
        if items:
            for k in ("source", "title", "url", "category", "captured_at"):
                assert k in items[0], f"missing {k}"

    def test_sorted_desc_by_captured_at(self, api):
        r = api.get(f"{BASE_URL}/api/news/chronological?limit=10", timeout=15)
        items = r.json().get("items", [])
        if len(items) < 2:
            pytest.skip("not enough items")
        prev = items[0]["captured_at"]
        for it in items[1:]:
            assert it["captured_at"] <= prev
            prev = it["captured_at"]

    def test_limit_clamped_to_40(self, api):
        r = api.get(f"{BASE_URL}/api/news/chronological?limit=9999", timeout=15)
        assert r.status_code == 200
        assert len(r.json().get("items", [])) <= 40


# ── /api/news/featured ──
class TestFeatured:
    def test_returns_max_2_by_default(self, api):
        r = api.get(f"{BASE_URL}/api/news/featured?limit=2", timeout=120)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) <= 2

    def test_each_item_has_hero_fields(self, api):
        r = api.get(f"{BASE_URL}/api/news/featured?limit=2", timeout=120)
        items = r.json().get("items", [])
        for it in items:
            # Both keys must always be present; values may be null when og fetch fails.
            assert "hero_image_url" in it
            assert "photo_credit" in it

    def test_hero_when_present_carries_photo_credit(self, api):
        """Editorial invariant: hero image without credit is forbidden."""
        r = api.get(f"{BASE_URL}/api/news/featured?limit=2", timeout=120)
        items = r.json().get("items", [])
        for it in items:
            if it.get("hero_image_url"):
                credit = it.get("photo_credit") or ""
                assert credit.startswith("Photo: "), \
                    f"hero present but no 'Photo: ' credit on {it.get('source')}"

    def test_hero_url_is_locally_cached_not_hotlinked(self, api):
        r = api.get(f"{BASE_URL}/api/news/featured?limit=2", timeout=120)
        for it in r.json().get("items", []):
            hero = it.get("hero_image_url")
            if hero:
                assert hero.startswith("/api/static/news_hero/"), \
                    f"hero must be locally cached: {hero}"


# ── /api/admin/og-blocklist ──
class TestOgBlocklist:
    def test_list_requires_admin_token(self, api):
        r = api.get(f"{BASE_URL}/api/admin/og-blocklist", timeout=10)
        assert r.status_code == 401

    def test_full_crud_cycle(self, admin_api):
        domain = "chunk-a-test-domain.example"
        # add
        r = admin_api.post(
            f"{BASE_URL}/api/admin/og-blocklist",
            json={"domain": domain, "reason": "unit-test"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["added"]["domain"] == domain
        # list
        r = admin_api.get(f"{BASE_URL}/api/admin/og-blocklist", timeout=10)
        domains = [it["domain"] for it in r.json()["items"]]
        assert domain in domains
        # remove
        r = admin_api.delete(
            f"{BASE_URL}/api/admin/og-blocklist/{domain}", timeout=10,
        )
        assert r.status_code == 200
        # confirm removed
        r = admin_api.get(f"{BASE_URL}/api/admin/og-blocklist", timeout=10)
        domains = [it["domain"] for it in r.json()["items"]]
        assert domain not in domains

    def test_rejects_invalid_domain(self, admin_api):
        r = admin_api.post(
            f"{BASE_URL}/api/admin/og-blocklist",
            json={"domain": "not_a_domain", "reason": ""},
            timeout=10,
        )
        assert r.status_code == 400

    def test_strips_www_and_lowercases(self, admin_api):
        r = admin_api.post(
            f"{BASE_URL}/api/admin/og-blocklist",
            json={"domain": "www.WWW-STRIP-CHECK.com", "reason": ""},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["added"]["domain"] == "www-strip-check.com"
        admin_api.delete(
            f"{BASE_URL}/api/admin/og-blocklist/www-strip-check.com", timeout=10,
        )
