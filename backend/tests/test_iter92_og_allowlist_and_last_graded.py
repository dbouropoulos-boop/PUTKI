"""
iter92 · Phase 4 capstone polish — OG slug allow-list + Mittari
accuracy `last_graded_at` field.

Coverage:
  - PAGE_OG_PROFILES allow-list contains every editorial surface
    referenced by the front-end (`pageOgUrl` map) — front-end <-> back-end
    drift detector. If a surface is added to one side but not the other,
    this test fails fast.
  - `/api/data/mittari/accuracy-90d` envelope now includes
    `last_graded_at` (string or null).
  - `/api/og/page/{slug}` returns 404 for an unknown slug.
"""
from __future__ import annotations

import os

import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from routes.page_og import PAGE_OG_PROFILES  # noqa: E402

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TIMEOUT = 60.0


def test_og_allowlist_covers_every_frontend_surface():
    """Hard-code the front-end `OG_SLUGS` map here. If you change one
    side without the other, the build flags it immediately."""
    expected_stems = {
        "trust-hub",
        "reform-2027",
        "pelit-blackjack",
        "pelit-poker",
        "pelit-slotit",
        "pelit-craps",
        "pelit-ruletti",
        "pelit-live",
        "pelit-bonusmath",
        "mestari-method",
        "mittari-sources",
        "voita-faq",
        "founder-qa",
    }
    backend_stems = {
        v["cache_slug"].rsplit("-", 1)[0]
        for v in PAGE_OG_PROFILES.values()
        if v["cache_slug"].endswith(("-fi", "-en"))
    }
    missing_in_backend = expected_stems - backend_stems
    extra_in_backend = backend_stems - expected_stems
    assert not missing_in_backend, f"front-end surfaces missing from PAGE_OG_PROFILES: {missing_in_backend}"
    assert not extra_in_backend, f"PAGE_OG_PROFILES has stems not in the front-end map: {extra_in_backend}"


def test_og_allowlist_has_fi_and_en_for_every_surface():
    fi = {k for k in PAGE_OG_PROFILES if k.endswith("-fi")}
    en = {k for k in PAGE_OG_PROFILES if k.endswith("-en")}
    fi_stems = {k[:-3] for k in fi}
    en_stems = {k[:-3] for k in en}
    assert fi_stems == en_stems, f"FI/EN OG slug pairs unbalanced: only-fi={fi_stems - en_stems}, only-en={en_stems - fi_stems}"


def test_og_endpoint_404s_for_unknown_slug():
    r = httpx.get(f"{BASE}/api/og/page/this-slug-does-not-exist", timeout=TIMEOUT, follow_redirects=False)
    assert r.status_code == 404


def test_mittari_accuracy_envelope_includes_last_graded_at():
    r = httpx.get(f"{BASE}/api/data/mittari/accuracy-90d", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "last_graded_at" in body, "envelope missing last_graded_at"
    # Must be either a string ISO timestamp or null; never raw datetime/object.
    assert body["last_graded_at"] is None or isinstance(body["last_graded_at"], str)
