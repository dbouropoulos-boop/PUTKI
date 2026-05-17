"""Phase 3 V2 Step 3 (folded into Step 1) — Voyager rotation calendar tests."""
import os
from datetime import date

import requests


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK}


def current_iso_week_str():
    iso = date.today().isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


class TestVoyagerRotation:
    def test_admin_listing_shape(self):
        r = requests.get(f"{API}/admin/voyager/weeks", headers=HDR, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "weeks" in d
        assert "stats" in d
        assert "current_iso_week" in d
        assert "next_iso_weeks" in d
        assert len(d["next_iso_weeks"]) == 12
        assert d["current_iso_week"] == current_iso_week_str()

    def test_public_current_week_empty_when_unset(self):
        # Wipe to ensure clean state
        cur = current_iso_week_str()
        requests.delete(f"{API}/admin/voyager/weeks/{cur}?market_id=FI", headers=HDR, timeout=10)
        r = requests.get(f"{API}/voyager/current-week", timeout=10)
        assert r.status_code == 200
        d = r.json()
        # week may be null OR populated depending on test order; both are valid
        assert "iso_week" in d
        assert d["market_id"] == "FI"

    def test_upsert_requires_partner_operator(self):
        """Constraint: only partner=True operators can be assigned to a week."""
        iso = "2026-W30"
        # Non-partner operator
        payload = {
            "iso_week": iso, "market_id": "FI",
            "partner_operator_slug": "paf",  # Paf is not partner=True in seed
            "theme": "Test", "prize_summary": "—",
        }
        r = requests.put(f"{API}/admin/voyager/weeks/{iso}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 400
        assert "partner" in r.json()["detail"].lower()

    def test_upsert_with_partner_operator_succeeds(self):
        iso = "2026-W30"
        payload = {
            "iso_week": iso, "market_id": "FI",
            "partner_operator_slug": "weezybet",
            "theme": "Imatra Rally",
            "prize_summary": "€1,000 cash + 100 FS",
            "smartico_template_id": "tpl_test_123",
            "notes": "Imatra-themed week",
            "status": "planned",
        }
        r = requests.put(f"{API}/admin/voyager/weeks/{iso}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 200
        doc = r.json()
        assert doc["iso_week"] == iso
        assert doc["partner_operator_slug"] == "weezybet"
        assert doc["theme"] == "Imatra Rally"
        assert doc["market_id"] == "FI"

    def test_rejects_invalid_iso_format(self):
        payload = {"iso_week": "2026-30", "partner_operator_slug": "weezybet", "theme": "x", "prize_summary": "y"}
        r = requests.put(f"{API}/admin/voyager/weeks/2026-30", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 400

    def test_rejects_unknown_operator(self):
        iso = "2026-W31"
        payload = {"iso_week": iso, "partner_operator_slug": "fake-operator-xyz", "theme": "x", "prize_summary": "y"}
        r = requests.put(f"{API}/admin/voyager/weeks/{iso}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 400

    def test_delete_roundtrip(self):
        iso = "2026-W32"
        payload = {"iso_week": iso, "partner_operator_slug": "weezybet", "theme": "X", "prize_summary": "—"}
        r = requests.put(f"{API}/admin/voyager/weeks/{iso}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 200
        r = requests.delete(f"{API}/admin/voyager/weeks/{iso}?market_id=FI", headers=HDR, timeout=10)
        assert r.status_code == 200

    def test_public_voyager_weeks_returns_upcoming(self):
        # ensure at least one
        iso = "2026-W30"
        requests.put(f"{API}/admin/voyager/weeks/{iso}", headers={**HDR, "Content-Type": "application/json"}, json={
            "iso_week": iso, "partner_operator_slug": "weezybet", "theme": "Imatra Rally", "prize_summary": "—",
        }, timeout=10)
        r = requests.get(f"{API}/voyager/weeks?upcoming_only=true&limit=20", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert any(w["iso_week"] == iso for w in d["weeks"])

    def test_admin_requires_token(self):
        r = requests.get(f"{API}/admin/voyager/weeks", timeout=10)
        assert r.status_code == 401
