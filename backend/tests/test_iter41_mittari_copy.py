"""Iter41 backend tests — /mittari editable copy system.

Covers:
- GET /api/mittari/copy (public, merged tree, all sections present)
- GET /api/admin/mittari/copy auth (401/403 without token, 200 with token)
- PUT /api/admin/mittari/copy partial payload → persists + merged reflects it
- PUT /api/admin/mittari/copy {} → reset to defaults
- Field-length cap: 5000-char hero.fi.headline_lead → truncates ≤240
- Sanitizer: blank receipts/testimonials are dropped
- Restore defaults at end (cleanup so other tests aren't affected)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_TOKEN = "putki-hq-admin"
H_ADMIN = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def _restore_defaults_after_module():
    """Cleanup: after all tests, reset mittari_copy override to {}."""
    yield
    try:
        requests.put(f"{BASE_URL}/api/admin/mittari/copy", json={}, headers=H_ADMIN, timeout=10)
    except Exception:
        pass


# ── Public endpoint ──
class TestPublicMittariCopy:
    def test_public_endpoint_returns_full_tree(self):
        r = requests.get(f"{BASE_URL}/api/mittari/copy", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # Top-level keys
        for key in ["back_home", "hero", "gate", "signals", "explain", "receipts",
                    "testimonials", "founder", "press", "final_gate", "feed", "sticky"]:
            assert key in data, f"missing {key}"
        # Per-locale required
        for sec in ["hero", "gate", "signals", "explain"]:
            assert "fi" in data[sec] and "en" in data[sec]
        # Explain steps = 3
        assert len(data["explain"]["fi"]["steps"]) == 3
        assert len(data["explain"]["en"]["steps"]) == 3
        # Steps have title+body
        for step in data["explain"]["fi"]["steps"]:
            assert "title" in step and "body" in step
        # Arrays present
        assert isinstance(data["receipts"]["items"], list)
        assert isinstance(data["testimonials"]["items"], list)
        assert isinstance(data["press"]["items"], list)


# ── Admin auth ──
class TestAdminAuth:
    def test_admin_get_without_token_rejected(self):
        r = requests.get(f"{BASE_URL}/api/admin/mittari/copy", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_admin_get_with_token_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/mittari/copy", headers=H_ADMIN, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("raw", "merged", "defaults", "updated_at"):
            assert key in data, f"missing {key}"
        assert isinstance(data["merged"], dict)
        assert isinstance(data["defaults"], dict)
        assert "hero" in data["defaults"]

    def test_admin_put_without_token_rejected(self):
        r = requests.put(f"{BASE_URL}/api/admin/mittari/copy", json={}, timeout=10)
        assert r.status_code in (401, 403)


# ── Mutation flow ──
class TestPutAndPersistence:
    def test_partial_put_persists_and_reflected_in_public(self):
        custom = "CUSTOM HEADLINE ITER41"
        payload = {"hero": {"fi": {"headline_lead": custom}}}
        r = requests.put(f"{BASE_URL}/api/admin/mittari/copy", json=payload, headers=H_ADMIN, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["merged"]["hero"]["fi"]["headline_lead"] == custom
        # Subsequent public GET reflects it
        r2 = requests.get(f"{BASE_URL}/api/mittari/copy", timeout=10)
        assert r2.status_code == 200
        assert r2.json()["hero"]["fi"]["headline_lead"] == custom
        # Other defaults intact
        assert r2.json()["hero"]["en"]["headline_lead"] == "Five strongest picks"

    def test_empty_put_resets_to_defaults(self):
        # First mutate
        requests.put(f"{BASE_URL}/api/admin/mittari/copy",
                     json={"hero": {"fi": {"headline_lead": "TEMP"}}}, headers=H_ADMIN, timeout=10)
        # Reset
        r = requests.put(f"{BASE_URL}/api/admin/mittari/copy", json={}, headers=H_ADMIN, timeout=10)
        assert r.status_code == 200
        merged = r.json()["merged"]
        assert merged["hero"]["fi"]["headline_lead"] == "Viisi vahvinta poimintaa"

    def test_field_length_cap_truncates(self):
        big = "A" * 5000
        payload = {"hero": {"fi": {"headline_lead": big}}}
        r = requests.put(f"{BASE_URL}/api/admin/mittari/copy", json=payload, headers=H_ADMIN, timeout=10)
        assert r.status_code == 200
        # Sanitizer truncates on read
        r2 = requests.get(f"{BASE_URL}/api/mittari/copy", timeout=10)
        val = r2.json()["hero"]["fi"]["headline_lead"]
        assert len(val) <= 240, f"truncation failed: len={len(val)}"
        # Reset
        requests.put(f"{BASE_URL}/api/admin/mittari/copy", json={}, headers=H_ADMIN, timeout=10)

    def test_blank_receipt_row_dropped(self):
        # Override receipt with blank signal_fi+signal_en → dropped
        payload = {
            "receipts": {
                "items": [
                    {"date_fi": "X", "date_en": "X", "time": "00:00",
                     "signal_fi": "", "signal_en": "",
                     "outcome_fi": "", "outcome_en": "", "status": "hit"},
                ]
            }
        }
        r = requests.put(f"{BASE_URL}/api/admin/mittari/copy", json=payload, headers=H_ADMIN, timeout=10)
        assert r.status_code == 200
        items = r.json()["merged"]["receipts"]["items"]
        # First item shouldn't be the empty one — should still have real content from defaults
        # because override row was empty → skipped → defaults stay for that index
        assert items[0].get("signal_fi"), "blank row was not dropped properly"
        requests.put(f"{BASE_URL}/api/admin/mittari/copy", json={}, headers=H_ADMIN, timeout=10)

    def test_blank_testimonial_dropped(self):
        payload = {
            "testimonials": {
                "items": [
                    {"id": "t1", "name": "X", "quote_fi": "", "quote_en": ""},
                ]
            }
        }
        r = requests.put(f"{BASE_URL}/api/admin/mittari/copy", json=payload, headers=H_ADMIN, timeout=10)
        assert r.status_code == 200
        items = r.json()["merged"]["testimonials"]["items"]
        # Default index 0 testimonial has quote — but override blanked it → row dropped, so the
        # output items[0] should now be the default t2 quote OR length<3
        # Importantly: no testimonial in the output should have BOTH quote_fi & quote_en blank.
        for t in items:
            assert t.get("quote_fi") or t.get("quote_en"), "blank testimonial leaked through"
        requests.put(f"{BASE_URL}/api/admin/mittari/copy", json={}, headers=H_ADMIN, timeout=10)
