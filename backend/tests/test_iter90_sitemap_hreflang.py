"""
iter90 · Phase 4 capstone — sitemap xhtml:link hreflang emission
+ Trust hub canonical entry.
"""
from __future__ import annotations

import asyncio
import os

from fastapi import FastAPI
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient

from routes.seo import build_sitemap_router, LOCALE_PAIRS

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


def _client():
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    app = FastAPI()
    app.include_router(build_sitemap_router(db), prefix="/api")
    return TestClient(app)


def _fetch_sitemap() -> str:
    async def _run():
        return _client().get("/api/seo/sitemap.xml")
    res = asyncio.run(_run())
    assert res.status_code == 200, res.text
    return res.text


def test_urlset_declares_xhtml_namespace():
    body = _fetch_sitemap()
    assert 'xmlns:xhtml="http://www.w3.org/1999/xhtml"' in body


def test_locale_pair_emits_xhtml_link_alternates_for_both_halves():
    body = _fetch_sitemap()
    for fi_path, en_path, _, _ in LOCALE_PAIRS:
        fi_url = f"https://putkihq.com{fi_path}"
        en_url = f"https://putkihq.com{en_path}"
        # Both URLs must appear as <loc>.
        assert f"<loc>{fi_url}</loc>" in body, f"FI <loc> missing: {fi_path}"
        assert f"<loc>{en_url}</loc>" in body, f"EN <loc> missing: {en_path}"
        # Mutual hreflang alternates must be present (we don't enforce
        # ordering, just existence inside the sitemap body).
        assert f'hreflang="fi-FI" href="{fi_url}"' in body, f"missing fi-FI alt for {fi_path}"
        assert f'hreflang="en-FI" href="{en_url}"' in body, f"missing en-FI alt for {en_path}"
        assert f'hreflang="x-default" href="{fi_url}"' in body, f"missing x-default alt for {fi_path}"


def test_locale_paired_paths_not_duplicated_in_sitemap():
    body = _fetch_sitemap()
    # If a locale pair is also accidentally listed in STATIC_ROUTES,
    # the path would appear with a non-alternates row too. Check that
    # every paired path only appears with its xhtml:link block — i.e.,
    # the count of <loc> + <xhtml:link>-bearing rows match.
    for fi_path, en_path, _, _ in LOCALE_PAIRS:
        fi_url = f"https://putkihq.com{fi_path}"
        assert body.count(f"<loc>{fi_url}</loc>") == 1, f"{fi_path} emitted twice"
        en_url = f"https://putkihq.com{en_path}"
        assert body.count(f"<loc>{en_url}</loc>") == 1, f"{en_path} emitted twice"


def test_sitemap_contains_trust_hub_pair():
    body = _fetch_sitemap()
    assert "<loc>https://putkihq.com/luotettavuus</loc>" in body
    assert "<loc>https://putkihq.com/en/trust</loc>" in body
