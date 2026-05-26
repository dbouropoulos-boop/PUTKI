"""
iter76 (Slice 2) - Website signup capture + subscriber lookup.

Validates the strict capture rule (18+ + email + segment) and the
idempotent-by-email upsert that yields a stable pending_id deep link.
"""
from __future__ import annotations

import os
import uuid

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
ADMIN_HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


def _email() -> str:
    return f"qa.signup.{uuid.uuid4().hex[:8]}@putkihq-test.invalid"


class TestSignupHappyPath:
    def test_valid_signup_returns_deep_link(self):
        e = _email()
        r = requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={
                "email": e,
                "segment": "football",
                "age_confirmed": True,
                "marketing_consent": True,
            },
            timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["pending_id"].startswith("mittari_")
        assert body["segment"] == "football"
        assert body["telegram_deep_link"].startswith("https://t.me/")
        assert body["pending_id"] in body["telegram_deep_link"]

    def test_idempotent_upsert_same_pending_id(self):
        e = _email()
        first = requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={"email": e, "segment": "football", "age_confirmed": True},
            timeout=5,
        ).json()
        # Same email, different segment - must reuse pending_id so the
        # user keeps the same TG deep link.
        second = requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={"email": e, "segment": "hockey", "age_confirmed": True},
            timeout=5,
        ).json()
        assert first["pending_id"] == second["pending_id"]
        assert second["segment"] == "hockey"


class TestSignupRejections:
    def test_rejects_age_gate_off(self):
        r = requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={"email": _email(), "segment": "all", "age_confirmed": False},
            timeout=5,
        )
        assert r.status_code == 400
        assert r.json()["detail"] == "age_gate_required"

    def test_rejects_bad_segment(self):
        r = requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={"email": _email(), "segment": "esports", "age_confirmed": True},
            timeout=5,
        )
        assert r.status_code == 400
        assert r.json()["detail"] == "invalid_segment"

    def test_rejects_invalid_email(self):
        r = requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={"email": "not-an-email", "segment": "all", "age_confirmed": True},
            timeout=5,
        )
        assert r.status_code == 400
        assert r.json()["detail"] == "invalid_email"


class TestAdminSubscriberLookup:
    def test_lookup_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/subscribers/lookup?q=qa", timeout=5)
        assert r.status_code == 401

    def test_lookup_finds_by_email_prefix(self):
        e = _email()
        requests.post(
            f"{BASE_URL}/api/signup/mittari",
            json={"email": e, "segment": "all", "age_confirmed": True, "marketing_consent": False},
            timeout=5,
        )
        # Match by the local-part prefix (case-insensitive).
        prefix = e.split("@")[0][:12]
        r = requests.get(
            f"{BASE_URL}/api/admin/subscribers/lookup?q={prefix}",
            headers=ADMIN_HEADERS, timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["count"] >= 1
        emails = {it["email"] for it in body["items"]}
        assert e in emails

    def test_lookup_empty_q_returns_empty(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/subscribers/lookup?q=",
            headers=ADMIN_HEADERS, timeout=5,
        )
        assert r.status_code == 200
        assert r.json() == {"items": [], "count": 0}
