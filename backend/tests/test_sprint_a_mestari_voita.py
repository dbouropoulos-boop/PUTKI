"""Sprint A - Mestari standalone + Voita stripped flow backend tests.

Coverage:
  1. POST /api/voita/lead source field semantics
     - source='mestari'  → surface=mestari_landing + consent_tag=mestari_lead
     - source missing    → surface=voita_landing + consent_tag=voita_lead
     - source invalid    → falls back to voita
  2. POST /api/voita/raffles/{slug}/enter - new fields persisted
     - confidence (1..5), contact_channel ('telegram'|'email'), pending_id (<=64)

Test data is prefixed TEST_iter35_ for cleanup.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")
SLUG = "kups-hjk-veikkausliiga-final-2026"

_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(_MONGO_URL)
_db = _mongo[_DB_NAME]


def _u(tag):
    return f"TEST_iter35_{tag}_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module", autouse=True)
def _ensure_voita_enabled():
    """Sprint A endpoints require voita_feature_enabled - flip it on."""
    r = requests.put(
        f"{BASE_URL}/api/admin/settings",
        headers={"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"},
        json={"voita_feature_enabled": True},
        timeout=15,
    )
    assert r.status_code == 200, f"could not enable voita feature: {r.status_code} {r.text[:200]}"
    yield


# ── /api/voita/lead source variants ──────────────────────────────────────
class TestVoitaLeadSource:
    def _payload(self, email, source=None):
        body = {
            "email": email,
            "raffle_slug": None,
            "age_18_plus": True,
            "favorite_sport": None,
            "bet_frequency": None,
            "sportsbooks": [],
            "confidence": None,
            "quiz_tags": {"q1": "bias_favorite"},
            "lang": "en",
        }
        if source is not None:
            body["source"] = source
        return body

    def _admin_lookup(self, email):
        # Verify directly in mongo - there is no admin /leads HTTP endpoint
        # (leads land in optin_consents with surface=<x>_landing).
        doc = _db.optin_consents.find_one({"identifier": email.lower()})
        return doc

    def test_source_mestari_tags_mestari_landing(self):
        email = _u("mestari")
        r = requests.post(f"{BASE_URL}/api/voita/lead", json=self._payload(email, source="mestari"), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True or data.get("status") == "ok" or "id" in data

        doc = self._admin_lookup(email)
        assert doc is not None, f"lead not persisted for {email}"
        assert doc.get("surface") == "mestari_landing", doc
        assert doc.get("consent_tag") == "mestari_lead", doc

    def test_source_missing_defaults_to_voita(self):
        email = _u("nosrc")
        r = requests.post(f"{BASE_URL}/api/voita/lead", json=self._payload(email, source=None), timeout=15)
        assert r.status_code == 200, r.text
        doc = self._admin_lookup(email)
        assert doc is not None
        assert doc.get("surface") == "voita_landing"
        assert doc.get("consent_tag") == "voita_lead"

    def test_source_empty_string_defaults_to_voita(self):
        email = _u("empty")
        r = requests.post(f"{BASE_URL}/api/voita/lead", json=self._payload(email, source=""), timeout=15)
        assert r.status_code == 200, r.text
        doc = self._admin_lookup(email)
        assert doc is not None
        assert doc.get("surface") == "voita_landing"
        assert doc.get("consent_tag") == "voita_lead"

    def test_source_invalid_falls_back_to_voita(self):
        email = _u("bogus")
        r = requests.post(f"{BASE_URL}/api/voita/lead", json=self._payload(email, source="totally-invalid"), timeout=15)
        assert r.status_code == 200, r.text
        doc = self._admin_lookup(email)
        assert doc is not None
        assert doc.get("surface") == "voita_landing"
        assert doc.get("consent_tag") == "voita_lead"


# ── /api/voita/raffles/{slug}/enter - new optional fields ────────────────
class TestVoitaEntryNewFields:
    def _payload(self, email, **overrides):
        body = {
            "email": email,
            "prediction_one_x_two": "1",
            "predicted_home_goals": 2,
            "predicted_away_goals": 1,
            "rules_accepted": True,
            "display_name": "TEST",
            "confidence": 4,
            "contact_channel": "telegram",
            "pending_id": uuid.uuid4().hex,
        }
        body.update(overrides)
        return body

    def _admin_lookup_entry(self, email):
        # admin entries endpoint takes raffle_id not slug; just hit mongo
        doc = _db.voita_entries.find_one({"email_lower": email.lower()})
        return doc

    def test_entry_telegram_channel_with_confidence_and_pending_id(self):
        email = _u("tg")
        pid = uuid.uuid4().hex
        r = requests.post(
            f"{BASE_URL}/api/voita/raffles/{SLUG}/enter",
            json=self._payload(email, contact_channel="telegram", confidence=5, pending_id=pid),
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("entry_id") or body.get("ok") or "position" in body
        doc = self._admin_lookup_entry(email)
        assert doc is not None, f"entry not found for {email}"
        assert doc.get("confidence") == 5, doc
        assert doc.get("contact_channel") == "telegram", doc
        assert doc.get("pending_id") == pid, doc

    def test_entry_email_channel(self):
        email = _u("em")
        pid = uuid.uuid4().hex
        r = requests.post(
            f"{BASE_URL}/api/voita/raffles/{SLUG}/enter",
            json=self._payload(email, contact_channel="email", confidence=2, pending_id=pid),
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        doc = self._admin_lookup_entry(email)
        assert doc is not None
        assert doc.get("contact_channel") == "email"
        assert doc.get("confidence") == 2
        assert doc.get("pending_id") == pid

    def test_entry_invalid_channel_normalised_to_none(self):
        email = _u("bad")
        r = requests.post(
            f"{BASE_URL}/api/voita/raffles/{SLUG}/enter",
            json=self._payload(email, contact_channel="whatsapp", confidence=3),
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        doc = self._admin_lookup_entry(email)
        assert doc is not None
        assert doc.get("contact_channel") in (None, "")

    def test_entry_confidence_out_of_range_rejected(self):
        email = _u("conf")
        r = requests.post(
            f"{BASE_URL}/api/voita/raffles/{SLUG}/enter",
            json=self._payload(email, confidence=99),
            timeout=15,
        )
        assert r.status_code == 422, f"expected 422 on conf=99, got {r.status_code}: {r.text[:200]}"

    def test_entry_pending_id_truncated_at_64(self):
        email = _u("trunc")
        long_pid = "a" * 200
        r = requests.post(
            f"{BASE_URL}/api/voita/raffles/{SLUG}/enter",
            json=self._payload(email, pending_id=long_pid),
            timeout=15,
        )
        # pydantic max_length=64 should 422 it
        assert r.status_code == 422, f"expected 422 on long pending_id, got {r.status_code}"
