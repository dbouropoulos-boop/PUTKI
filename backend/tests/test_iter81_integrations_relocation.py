"""
iter81 / Task 2.5 - Integrations page round-trip tests.

Verifies that PUT /api/admin/settings handles the Smartico-only payload
correctly without nullifying unrelated settings, and that GET endpoints
remain consistent.
"""
import os

import httpx

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": TOKEN, "Content-Type": "application/json"}


def _admin_get():
    r = httpx.get(f"{BASE}/api/admin/settings",
                  headers={"X-Admin-Token": TOKEN}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _admin_put(payload):
    r = httpx.put(f"{BASE}/api/admin/settings",
                  headers=HEADERS, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _public_get():
    r = httpx.get(f"{BASE}/api/settings/public", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_admin_settings_exposes_all_three_smartico_fields():
    body = _admin_get()
    for k in ("smartico_template_id", "smartico_loader_url", "smartico_brand_key"):
        assert k in body, f"missing key {k}"


def test_smartico_round_trip_preserves_unrelated_settings():
    """Per task spec: relocation must NOT regress other settings.
    Capture the existing site_tagline + voita flag, do a smartico PUT,
    assert tagline + flag survived, then reset."""
    before = _admin_get()
    tag_fi = before.get("site_tagline_fi")
    tag_en = before.get("site_tagline_en")
    voita = before.get("voita_feature_enabled")

    after = _admin_put({
        "smartico_template_id": "test-3383",
        "smartico_loader_url": "https://example.test/loader.js",
        "smartico_brand_key": "test-brand-key",
    })

    assert after["smartico_template_id"] == "test-3383"
    assert after["smartico_loader_url"] == "https://example.test/loader.js"
    assert after["smartico_brand_key"] == "test-brand-key"
    # Critically: other settings preserved by the relocation
    assert after.get("site_tagline_fi") == tag_fi, "tagline (FI) regressed"
    assert after.get("site_tagline_en") == tag_en, "tagline (EN) regressed"
    assert after.get("voita_feature_enabled") == voita, "voita flag regressed"

    # Reset to original null state for the next test run
    reset = _admin_put({
        "smartico_template_id": before.get("smartico_template_id"),
        "smartico_loader_url": before.get("smartico_loader_url"),
        "smartico_brand_key": before.get("smartico_brand_key"),
    })
    assert reset["smartico_template_id"] == before.get("smartico_template_id")


def test_public_settings_endpoint_serves_smartico_values_unchanged():
    """The renderer at /voita-palkinto consumes /api/settings/public.
    A PUT must propagate to that endpoint within a single request cycle."""
    _admin_put({
        "smartico_template_id": "pub-test-99",
        "smartico_loader_url": "https://example.test/pub.js",
        "smartico_brand_key": "pub-brand",
    })
    try:
        pub = _public_get()
        assert pub["smartico_template_id"] == "pub-test-99"
        assert pub["smartico_loader_url"] == "https://example.test/pub.js"
        assert pub["smartico_brand_key"] == "pub-brand"
    finally:
        # Reset
        _admin_put({
            "smartico_template_id": None,
            "smartico_loader_url": None,
            "smartico_brand_key": None,
        })


def test_admin_settings_requires_auth():
    """No token → 401/403, never 200."""
    r = httpx.put(f"{BASE}/api/admin/settings",
                  json={"smartico_template_id": "x"}, timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"
