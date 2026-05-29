"""
iter80 / Task 2.4 - OG-images admin router tests.

Covers the public surface of /api/admin/og-images/* — auth, preview,
upload, delete, and the graceful-disabled regenerate path.
"""
import io
import os

import httpx
from PIL import Image

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": TOKEN}
SLUG = "iter80-pytest-smoke"


def _png_bytes(rgb=(217, 70, 30), size=(10, 10)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, rgb).save(buf, "PNG")
    return buf.getvalue()


def test_list_requires_auth():
    r = httpx.get(f"{BASE}/api/admin/og-images/list", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_list_envelope_shape():
    r = httpx.get(f"{BASE}/api/admin/og-images/list?limit=5", headers=HEADERS, timeout=15)
    assert r.status_code == 200
    body = r.json()
    for k in ("items", "count", "enabled"):
        assert k in body
    assert isinstance(body["items"], list)


def test_preview_returns_missing_for_unknown_slug():
    r = httpx.get(
        f"{BASE}/api/admin/og-images/preview",
        params={"slug": "iter80-definitely-not-a-real-slug"},
        headers=HEADERS, timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["exists"] is False and body["url"] is None


def test_upload_preview_delete_roundtrip():
    # 1. upload
    r = httpx.post(
        f"{BASE}/api/admin/og-images/upload",
        headers=HEADERS,
        data={"slug": SLUG},
        files={"file": ("test.png", _png_bytes(), "image/png")},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    up = r.json()
    assert up["slug"] == SLUG
    assert up["url"].endswith(f"{SLUG}.png")
    assert up["size_bytes"] > 0

    # 2. preview reflects the upload
    r = httpx.get(
        f"{BASE}/api/admin/og-images/preview",
        params={"slug": SLUG}, headers=HEADERS, timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["exists"] is True
    assert body["url"] and body["url"].endswith(f"{SLUG}.png")

    # 3. delete
    r = httpx.delete(f"{BASE}/api/admin/og-images/{SLUG}", headers=HEADERS, timeout=15)
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # 4. preview is gone
    r = httpx.get(
        f"{BASE}/api/admin/og-images/preview",
        params={"slug": SLUG}, headers=HEADERS, timeout=15,
    )
    assert r.status_code == 200
    assert r.json()["exists"] is False


def test_upload_rejects_unsupported_mime():
    r = httpx.post(
        f"{BASE}/api/admin/og-images/upload",
        headers=HEADERS,
        data={"slug": "iter80-bad-mime"},
        files={"file": ("evil.txt", b"hello", "text/plain")},
        timeout=15,
    )
    assert r.status_code == 415, r.text


def test_upload_rejects_path_traversal_slug():
    r = httpx.post(
        f"{BASE}/api/admin/og-images/upload",
        headers=HEADERS,
        data={"slug": "../../../etc/passwd"},
        files={"file": ("test.png", _png_bytes(), "image/png")},
        timeout=15,
    )
    # _safe_slug strips dotdots via _slugify; either the slug normalises
    # to a clean form (200) or it falls through to 400 invalid_slug.
    # Either way it must NOT escape the OG_DIR.
    if r.status_code == 200:
        clean = r.json()["slug"]
        assert ".." not in clean and "/" not in clean
        # cleanup
        httpx.delete(f"{BASE}/api/admin/og-images/{clean}", headers=HEADERS, timeout=15)
    else:
        assert r.status_code == 400


def test_regenerate_gracefully_handles_disabled_generator():
    """If the env hasn't configured a Gemini key, regenerate must
    return HTTP 503 with `og_generation_disabled`, not 500."""
    r = httpx.post(
        f"{BASE}/api/admin/og-images/regenerate",
        headers=HEADERS,
        json={"slug": "iter80-regen-test", "headline": "Test headline"},
        timeout=30,
    )
    # Either 503 (no key in this env) or 200 (key present). Never 500.
    assert r.status_code in (200, 503), r.text
    if r.status_code == 200:
        # Real generator returned something — clean up
        httpx.delete(
            f"{BASE}/api/admin/og-images/iter80-regen-test",
            headers=HEADERS, timeout=10,
        )
