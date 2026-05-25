"""Iter38: /mittari landing page rebuild - backend lead capture tests.
Verifies POST /api/voita/lead with source='mittari' persists with
consent_tag='mittari_lead' and surface='mittari_landing'.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env load
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

ADMIN_TOKEN = os.environ.get("PUTKI_ADMIN_TOKEN", "putki-hq-admin")


def _uniq(tag):
    return f"TEST_iter38_{tag}_{uuid.uuid4().hex[:8]}@example.com"


# ---------- /api/voita/lead with source=mittari ----------
class TestMittariLeadCapture:
    def test_mittari_lead_success(self):
        email = _uniq("hero")
        r = requests.post(f"{BASE_URL}/api/voita/lead", json={
            "email": email,
            "age_18_plus": True,
            "source": "mittari",
            "quiz_tags": {"surface": "mittari_landing"},
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["consent_tag"] == "mittari_lead"
        assert data["source"] == "mittari"

    def test_mittari_lead_invalid_age(self):
        r = requests.post(f"{BASE_URL}/api/voita/lead", json={
            "email": _uniq("badage"),
            "age_18_plus": False,
            "source": "mittari",
        }, timeout=15)
        assert r.status_code == 400

    def test_mittari_lead_invalid_email(self):
        r = requests.post(f"{BASE_URL}/api/voita/lead", json={
            "email": "not-an-email",
            "age_18_plus": True,
            "source": "mittari",
        }, timeout=15)
        # FastAPI/Pydantic validation
        assert r.status_code in (400, 422)

    def test_two_independent_leads_persist(self):
        """Hero form + Gate form both submit, both must persist."""
        email_a = _uniq("hero_indep")
        email_b = _uniq("gate_indep")
        for em in (email_a, email_b):
            r = requests.post(f"{BASE_URL}/api/voita/lead", json={
                "email": em,
                "age_18_plus": True,
                "source": "mittari",
                "quiz_tags": {"surface": "mittari_landing"},
            }, timeout=15)
            assert r.status_code == 200, r.text

        # Verify via admin endpoint
        time.sleep(0.5)
        r = requests.get(
            f"{BASE_URL}/api/admin/leads?source=mittari",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        identifiers = {it.get("identifier", "").lower() for it in data.get("items", [])}
        assert email_a.lower() in identifiers, f"hero email not persisted: {email_a}"
        assert email_b.lower() in identifiers, f"gate email not persisted: {email_b}"
        # Verify consent_tag stamped correctly
        for it in data.get("items", []):
            if it.get("identifier", "").lower() in (email_a.lower(), email_b.lower()):
                assert it.get("consent_tag") == "mittari_lead"
                assert it.get("source") == "mittari"


class TestAdminLeadsSummaryReflectsMittari:
    def test_summary_includes_mittari(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/leads/summary",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data
        assert "mittari" in data["counts"]
        assert isinstance(data["counts"]["mittari"], int)
        assert data["counts"]["mittari"] >= 1  # at least our test inserts above


# ---------- Regression: /api/mittari/subscribe still works ----------
class TestMittariSubscribeRegression:
    def test_mittari_subscribe_ok(self):
        # Mittari telegram subscribe endpoint should still respond.
        r = requests.post(f"{BASE_URL}/api/mittari/subscribe", json={
            "email": _uniq("subreg"),
            "age_18_plus": True,
        }, timeout=15)
        # Accept 200 (created) or 409 (already exists) - anything < 500
        assert r.status_code < 500, r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
