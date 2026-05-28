"""
iter78 - Phase 0 trust cleanup tests.

Verifies:
  1. mittari_copy now says "28" not "11"
  2. testimonials block carries the consent_line strings
  3. founder block carries pseudonym_disclosure_* strings
  4. press items are objects with name + url (not bare strings)
  5. /api/peli/config defaults reject enabling without partner
"""
import os
import httpx

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")


def test_mittari_copy_says_28_sources():
    r = httpx.get(f"{BASE}/api/mittari/copy", timeout=15)
    assert r.status_code == 200
    body = r.json()
    payload = repr(body).lower()
    assert "11 julkista" not in payload, "stale '11 julkista' string still present"
    assert "11 public sources" not in payload
    assert "0 toimituksellista" not in payload
    assert "0 editorial overrides" not in payload
    # New language present somewhere
    assert "28" in payload, "new '28' source count not present"


def test_mittari_copy_carries_testimonials_consent_line():
    r = httpx.get(f"{BASE}/api/mittari/copy", timeout=15)
    assert r.status_code == 200
    tst = r.json().get("testimonials") or {}
    assert tst.get("consent_line_fi"), "testimonials.consent_line_fi missing"
    assert tst.get("consent_line_en"), "testimonials.consent_line_en missing"
    assert "luvan" in tst["consent_line_fi"].lower() or "lupa" in tst["consent_line_fi"].lower()
    assert "consent" in tst["consent_line_en"].lower()


def test_mittari_copy_carries_founder_pseudonym_disclosure():
    r = httpx.get(f"{BASE}/api/mittari/copy", timeout=15)
    assert r.status_code == 200
    fnd = r.json().get("founder") or {}
    assert fnd.get("pseudonym_disclosure_fi"), "founder.pseudonym_disclosure_fi missing"
    assert fnd.get("pseudonym_disclosure_en"), "founder.pseudonym_disclosure_en missing"
    assert "pseudonyymi" in fnd["pseudonym_disclosure_fi"].lower()
    assert "pseudonym" in fnd["pseudonym_disclosure_en"].lower()
    assert "/toimitus" in fnd["pseudonym_disclosure_fi"]


def test_mittari_copy_press_items_are_objects():
    r = httpx.get(f"{BASE}/api/mittari/copy", timeout=15)
    assert r.status_code == 200
    press = (r.json().get("press") or {}).get("items") or []
    assert press, "press.items empty"
    for item in press:
        assert isinstance(item, dict), f"expected dict, got {type(item).__name__}: {item!r}"
        assert "name" in item and "url" in item
        # URL is allowed to be empty string until Dioni provides links


def test_peli_config_returns_partner_fields():
    r = httpx.get(f"{BASE}/api/peli/config", timeout=15)
    assert r.status_code == 200
    cfg = r.json()
    # Fields exist even if empty
    for k in ("partner_name", "partner_url", "partner_disclosure", "enabled"):
        assert k in cfg, f"peli config missing key {k}"


def test_peli_admin_enable_requires_partner():
    """Admin cannot enable a raffle without partner_name + disclosure."""
    headers = {"X-Admin-Token": TOKEN, "Content-Type": "application/json"}
    # First, force the config to empty + disabled so we can test the gate
    httpx.put(
        f"{BASE}/api/admin/peli/config",
        json={"partner_name": "", "partner_disclosure": "", "enabled": False},
        headers=headers, timeout=15,
    )
    # Now try to enable without setting partner fields - must fail.
    r = httpx.put(
        f"{BASE}/api/admin/peli/config",
        json={"enabled": True},
        headers=headers, timeout=15,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    assert "partner" in r.text.lower()
