"""
iter52 - Bell-icon alert manager (6-digit code → session token →
list/delete subscriptions). Hits the live backend end-to-end.
"""
from __future__ import annotations

import os
import time

import httpx
import pytest

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
ADMIN_H = {"X-Admin-Token": os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")}


def _fresh_email() -> str:
    return f"iter52+{int(time.time() * 1000)}@putkihq.fi"


def _get_admin(p: str) -> httpx.Response:
    return httpx.get(f"{BASE}{p}", headers=ADMIN_H, timeout=10.0)


def _post(p: str, body: dict | None = None, *, token: str | None = None) -> httpx.Response:
    headers: dict = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.post(f"{BASE}{p}", json=body or {}, headers=headers, timeout=10.0)


def _get(p: str, *, token: str | None = None) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.get(f"{BASE}{p}", headers=headers, timeout=10.0)


def _delete(p: str, *, token: str | None = None) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.delete(f"{BASE}{p}", headers=headers, timeout=10.0)


def _pull_code(email: str) -> str | None:
    r = _get_admin("/api/admin/alerts/preview-codes")
    assert r.status_code == 200
    for it in r.json()["items"]:
        if it.get("to") == email:
            return it.get("code")
    return None


# ─────────────────────── request-code endpoint ──────────────────────

def test_request_code_validates_email():
    r = _post("/api/alerts/streamer/request-code", {"email": "garbage"})
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_email"


def test_request_code_queues_email_outbox():
    email = _fresh_email()
    r = _post("/api/alerts/streamer/request-code", {"email": email})
    assert r.status_code == 200
    assert "expires_at" in r.json()
    code = _pull_code(email)
    assert code is not None and len(code) == 6 and code.isdigit()


# ─────────────────────── verify-code endpoint ──────────────────────

def test_verify_code_full_round_trip():
    email = _fresh_email()
    _post("/api/alerts/streamer/request-code", {"email": email})
    code = _pull_code(email)

    r = _post("/api/alerts/streamer/verify-code", {"email": email, "code": code})
    assert r.status_code == 200
    body = r.json()
    assert "token" in body and body["email"] == email
    assert len(body["token"]) >= 30


def test_verify_code_wrong_code_returns_400():
    email = _fresh_email()
    _post("/api/alerts/streamer/request-code", {"email": email})
    r = _post("/api/alerts/streamer/verify-code", {"email": email, "code": "000000"})
    assert r.status_code == 400
    assert r.json()["detail"] in ("code_mismatch", "code_expired_or_unknown")


def test_verify_code_unknown_email_returns_410_or_400():
    r = _post("/api/alerts/streamer/verify-code", {
        "email": _fresh_email(), "code": "123456",
    })
    assert r.status_code in (400, 410)


# ─────────────────────── subscriptions endpoints ───────────────────

@pytest.fixture
def session_token() -> str:
    email = _fresh_email()
    _post("/api/alerts/streamer/request-code", {"email": email})
    code = _pull_code(email)
    r = _post("/api/alerts/streamer/verify-code", {"email": email, "code": code})
    body = r.json()
    return body["token"]


def test_list_subscriptions_requires_token():
    r = _get("/api/alerts/streamer/subscriptions")
    assert r.status_code == 401
    r = _get("/api/alerts/streamer/subscriptions", token="garbage")
    assert r.status_code == 401


def test_list_subscriptions_empty_initially(session_token):
    r = _get("/api/alerts/streamer/subscriptions", token=session_token)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["items"] == []


def test_full_create_list_delete_round_trip(session_token):
    # Identify our session email so we can target the alert correctly
    me = _get("/api/alerts/streamer/subscriptions", token=session_token).json()
    email = me["email"]

    # Create a subscription via the public endpoint
    c = _post("/api/alerts/streamer", {
        "email": email,
        "streamer_login": "roshtein",
        "streamer_name": "Roshtein",
        "platform": "kick",
    })
    assert c.status_code == 200
    sub_id = c.json()["id"]

    # List → 1
    r = _get("/api/alerts/streamer/subscriptions", token=session_token)
    body = r.json()
    assert body["count"] == 1
    assert body["items"][0]["streamer_login"] == "roshtein"
    assert body["items"][0]["platform"] == "kick"

    # Delete
    d = _delete(f"/api/alerts/streamer/subscriptions/{sub_id}", token=session_token)
    assert d.status_code == 200
    assert d.json()["ok"] is True

    # Delete unknown → 404
    d2 = _delete(f"/api/alerts/streamer/subscriptions/{sub_id}", token=session_token)
    assert d2.status_code == 404

    # List → empty
    r2 = _get("/api/alerts/streamer/subscriptions", token=session_token)
    assert r2.json()["count"] == 0


def test_logout_revokes_token(session_token):
    r = _post("/api/alerts/streamer/logout", token=session_token)
    assert r.status_code == 200
    # After logout, the token must no longer authorise
    r2 = _get("/api/alerts/streamer/subscriptions", token=session_token)
    assert r2.status_code == 401


# ─────────────────────── admin preview endpoint ────────────────────

def test_admin_preview_codes_requires_admin():
    r = httpx.get(f"{BASE}/api/admin/alerts/preview-codes", timeout=6.0)
    assert r.status_code in (401, 403)


def test_admin_preview_codes_shape():
    r = _get_admin("/api/admin/alerts/preview-codes")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
