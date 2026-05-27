"""
iter76 (Slice 5) - Geo-aware affiliate router + admin link minting.
"""
from __future__ import annotations

import os

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


def _set_mode(mode: str):
    requests.put(
        f"{BASE_URL}/api/admin/bot/config",
        headers=HEADERS, json={"signal_unlock_mode": mode}, timeout=5,
    )


def _mint(extra=None) -> str:
    body = {"signal_id": "qa-router", "segment": "all"}
    if extra:
        body.update(extra)
    r = requests.post(
        f"{BASE_URL}/api/admin/links/mint",
        headers=HEADERS, json=body, timeout=5,
    )
    assert r.status_code == 200, r.text
    return r.json()["code"]


class TestMintAuth:
    def test_mint_requires_admin(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/links/mint",
            json={"signal_id": "x"}, timeout=5,
        )
        assert r.status_code == 401

    def test_mint_returns_code_and_url(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/links/mint",
            headers=HEADERS, json={"signal_id": "x", "campaign": "qa"}, timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert len(body["code"]) == 8
        assert body["code"].isalnum()
        assert "/api/r/" in body["redirect_url"]


class TestRedirectInformativeMode:
    """Default mode is `informative` - the router 302s to /mittari and
    never leaks to a partner. This is the safety rail at launch."""

    def setup_method(self, method):
        _set_mode("informative")

    def test_known_code_routes_to_mittari(self):
        code = _mint()
        r = requests.get(f"{BASE_URL}/api/r/{code}", allow_redirects=False, timeout=5)
        assert r.status_code == 302
        assert "/mittari" in r.headers.get("location", "")

    def test_unknown_code_falls_back_too(self):
        r = requests.get(f"{BASE_URL}/api/r/deadbeef", allow_redirects=False, timeout=5)
        assert r.status_code == 302
        assert "/mittari" in r.headers.get("location", "")

    def test_bad_code_400(self):
        r = requests.get(
            f"{BASE_URL}/api/r/{'x' * 64}",
            allow_redirects=False, timeout=5,
        )
        assert r.status_code == 400


class TestRedirectRoutedMode:
    """Routed mode with no LIVE partner still falls back to /mittari -
    we never 500 on an empty router."""

    def setup_method(self, method):
        # First clear stale partners so the test is deterministic.
        # (We can't list everything cheaply; rely on the unique key delete
        # of the partner we'll add.)
        self._pkey = f"qa-affiliate-{os.getpid()}"
        requests.delete(
            f"{BASE_URL}/api/admin/partners/{self._pkey}",
            headers=HEADERS, timeout=5,
        )
        # Need at least one LIVE partner so the "ROUTED" toggle is even
        # allowed; the back-office flow guards this server-side too.
        requests.post(
            f"{BASE_URL}/api/admin/partners", headers=HEADERS, timeout=5,
            json={
                "partner_key": self._pkey,
                "display_name": "QA Affiliate",
                "affiliate_base_url": "https://example.invalid/aff?cid={code}&sub={subid}",
                "target_geos": ["FI"],
                "priority_weight": 50,
                "status": "live",
            },
        )
        _set_mode("routed")

    def teardown_method(self, method):
        _set_mode("informative")
        requests.delete(
            f"{BASE_URL}/api/admin/partners/{self._pkey}",
            headers=HEADERS, timeout=5,
        )

    def test_routes_to_partner_for_matching_geo(self):
        code = _mint()
        r = requests.get(
            f"{BASE_URL}/api/r/{code}",
            allow_redirects=False, timeout=5,
            headers={"Accept-Language": "fi-FI,fi;q=0.9"},
        )
        assert r.status_code == 302
        loc = r.headers.get("location", "")
        assert "example.invalid/aff" in loc, loc
        assert code in loc  # code substituted into the template

    def test_falls_back_when_geo_not_in_target(self):
        code = _mint()
        r = requests.get(
            f"{BASE_URL}/api/r/{code}",
            allow_redirects=False, timeout=5,
            headers={"Accept-Language": "en-US"},
        )
        assert r.status_code == 302
        assert "/mittari" in r.headers.get("location", "")


class TestPostback:
    def test_postback_accepts_unverified(self):
        # Unknown partner_key, no secret - should still 200 (we record
        # the row with verified=False).
        r = requests.post(
            f"{BASE_URL}/api/r/postback/qa-unknown-partner",
            json={"code": "abc", "subid": "abc", "amount": 12.5},
            timeout=5,
        )
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True, "verified": False}
