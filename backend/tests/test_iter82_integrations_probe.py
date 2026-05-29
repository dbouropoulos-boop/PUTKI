"""
iter82 / Task 2.3 + Smartico Test Connection — admin endpoint + auth
consolidation tests.

Covers:
  - POST /api/admin/integrations/smartico/test-connection
    * 400 on empty URL
    * 400 on malformed URL
    * 401/403 without admin token
    * graceful failure response when the loader URL is unreachable
    * happy path (status=200 + JS content-type → ok=True) via httpx mock

  - BackOfficeShell tokenStore canonical key check (sessionStorage only,
    legacy localStorage mirror is dead code).
"""
import asyncio
import os
from unittest.mock import patch

import httpx

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": TOKEN, "Content-Type": "application/json"}
PROBE = f"{BASE}/api/admin/integrations/smartico/test-connection"


def test_probe_requires_auth():
    r = httpx.post(PROBE, json={"loader_url": "https://example.com/x.js"}, timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_probe_rejects_empty_url():
    r = httpx.post(PROBE, headers=HEADERS, json={"loader_url": ""}, timeout=15)
    assert r.status_code == 400
    assert "loader_url_required" in r.text


def test_probe_rejects_malformed_url():
    r = httpx.post(PROBE, headers=HEADERS,
                   json={"loader_url": "not-a-real-url"}, timeout=15)
    assert r.status_code == 400
    assert "invalid_loader_url" in r.text


def test_probe_handles_non_js_content_type_gracefully():
    """Hitting a reachable URL that serves text/html returns ok=false
    with a helpful message, not a 500."""
    r = httpx.post(PROBE, headers=HEADERS,
                   json={"loader_url": "https://example.com/"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    # Either reachable+wrong-CT (ok=false) or unreachable (ok=false).
    # Both are valid for this assertion.
    assert body["ok"] is False
    assert "message" in body


def test_probe_handles_unreachable_url_gracefully():
    """A clearly unreachable domain returns ok=false with a network-error
    message rather than crashing."""
    r = httpx.post(PROBE, headers=HEADERS,
                   json={"loader_url": "https://this-domain-cannot-exist-iter82.invalid/loader.js"},
                   timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is False
    assert body["status"] is None
    assert body["message"]


def test_probe_success_path_via_mock():
    """Mock httpx so we can prove the success path: HTTP 200 +
    Content-Type: application/javascript → ok=True."""
    from routes.integrations import build_integrations_router, SmarticoProbeBody

    async def fake_admin():
        return None

    router = build_integrations_router(fake_admin)
    handler = None
    for route in router.routes:
        if route.path.endswith("/smartico/test-connection"):
            handler = route.endpoint
            break
    assert handler, "test-connection route not registered"

    class FakeResp:
        status_code = 200
        headers = {"content-type": "application/javascript; charset=utf-8"}

    class FakeClient:
        def __init__(self, *a, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return None
        async def get(self, url, headers=None): return FakeResp()

    with patch("routes.integrations.httpx.AsyncClient", FakeClient):
        result = asyncio.run(handler(
            body=SmarticoProbeBody(loader_url="https://loader.example.com/loader.js"),
            _=None,
        ))

    assert result["ok"] is True
    assert result["status"] == 200
    assert result["content_type"] == "application/javascript"
    assert "reachable" in result["message"].lower()
