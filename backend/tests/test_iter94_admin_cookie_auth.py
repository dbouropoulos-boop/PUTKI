"""
iter94 · Admin auth → httpOnly cookie session tests.

Coverage:
  - POST /api/admin/auth/login rejects bad token (401), accepts good
    token (sets cookie + returns actor/role).
  - GET  /api/admin/auth/whoami returns authed=true via cookie session.
  - GET  /api/admin/auth/whoami falls back to legacy X-Admin-Token
    header during the migration window.
  - GET  /api/admin/auth/whoami returns 401 when neither cookie nor
    header is present.
  - POST /api/admin/auth/logout clears the cookie so subsequent whoami
    returns 401.
  - require_admin accepts the cookie alone (no header) on a real
    admin endpoint (/api/admin/settings).
  - require_admin still accepts the legacy header alone (no cookie).
  - require_admin rejects an expired cookie even when no header is set.
"""
from __future__ import annotations

import os

import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
TIMEOUT = 60.0

LOGIN = f"{BASE}/api/admin/auth/login"
LOGOUT = f"{BASE}/api/admin/auth/logout"
WHOAMI = f"{BASE}/api/admin/auth/whoami"
SETTINGS = f"{BASE}/api/admin/settings"

COOKIE_NAME = "putki_admin_session"


def _client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT)


def test_login_rejects_bad_token():
    with _client() as c:
        r = c.post(LOGIN, json={"token": "definitely-wrong-token-iter94"})
        assert r.status_code == 401
        assert COOKIE_NAME not in r.cookies


def test_login_sets_cookie_and_returns_actor():
    with _client() as c:
        r = c.post(LOGIN, json={"token": TOKEN})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["authed"] is True
        assert body["actor"]  # populated
        assert body["role"] in {"owner", "editor"}
        assert body["expires_at"]
        assert body["ttl_seconds"] >= 60
        assert COOKIE_NAME in r.cookies


def test_whoami_via_cookie_session():
    with _client() as c:
        c.post(LOGIN, json={"token": TOKEN})
        r = c.get(WHOAMI)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["authed"] is True
        assert body["source"] == "cookie_session"
        assert body["exp"] > 0


def test_whoami_via_legacy_header_fallback():
    # Fresh client, no cookies — only the legacy header
    with _client() as c:
        r = c.get(WHOAMI, headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["authed"] is True
        assert body["source"] == "legacy_header"


def test_whoami_unauthenticated_returns_401():
    with _client() as c:
        r = c.get(WHOAMI)
        assert r.status_code == 401


def test_logout_clears_cookie_and_blocks_subsequent_whoami():
    with _client() as c:
        login = c.post(LOGIN, json={"token": TOKEN})
        assert login.status_code == 200
        c.post(LOGOUT)
        # Subsequent whoami without re-login → 401
        r = c.get(WHOAMI)
        assert r.status_code == 401


def test_admin_endpoint_accepts_cookie_alone():
    """Verifies require_admin's cookie-first path: `/api/admin/settings`
    must succeed with ONLY the session cookie set (no X-Admin-Token
    header)."""
    with _client() as c:
        c.post(LOGIN, json={"token": TOKEN})
        r = c.get(SETTINGS)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "smartico_template_id" in body


def test_admin_endpoint_accepts_legacy_header_alone():
    """Back-compat assertion: no cookie, only X-Admin-Token header
    succeeds on the same endpoint."""
    with _client() as c:
        r = c.get(SETTINGS, headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 200, r.text


def test_admin_endpoint_rejects_expired_cookie():
    """Forge an expired JWT, send it as the session cookie, expect 401.
    Exercises the failure path of `decode_session`."""
    from routes.admin_auth_cookie import COOKIE_NAME as CN, encode_session
    bundle = encode_session(
        {"actor_id": "test", "actor": "test", "role": "owner"},
        ttl_seconds=-10,  # already expired
    )
    with _client() as c:
        # Inject the expired cookie directly
        c.cookies.set(CN, bundle["token"], domain=httpx.URL(BASE).host)
        r = c.get(SETTINGS)
        # No header, no valid cookie → 401
        assert r.status_code == 401
