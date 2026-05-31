"""
iter86 · Phase 4 — sitemap exposes the new Reform 2027 hub
+ the deep /pelit/* guide routes.

Mirrors the existing pytest pattern in this repo (no pytest-asyncio
decorator — uses asyncio.run() per the in-tree convention).
"""
from __future__ import annotations

import asyncio
import os
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient

from routes.seo import build_sitemap_router

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


def _make_client():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    app = FastAPI()
    app.include_router(build_sitemap_router(db), prefix="/api")
    return TestClient(app)


def test_sitemap_contains_reform_2027_hub():
    async def _run():
        return _make_client().get("/api/seo/sitemap.xml")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    assert "/saantely/reform-2027" in body
    assert "/saantely</loc>" in body or "/saantely<" in body


def test_sitemap_contains_deep_pelit_guides():
    async def _run():
        return _make_client().get("/api/seo/sitemap.xml")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    for path in [
        "/pelit/blackjack",
        "/pelit/slotit",
        "/pelit/bonusmatematiikka",
    ]:
        assert path in body, f"missing {path} from sitemap"


def test_sitemap_is_well_formed_xml():
    async def _run():
        return _make_client().get("/api/seo/sitemap.xml")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    # Must start with the XML declaration + sitemap urlset namespace.
    assert body.startswith('<?xml version="1.0"')
    assert "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">" in body
    assert body.rstrip().endswith("</urlset>")
    # Every <loc> must be an absolute URL on the canonical host.
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("<loc>") and line.endswith("</loc>"):
            url = line[5:-6]
            parsed = urlparse(url)
            assert parsed.scheme == "https", f"non-https loc: {url}"
            assert parsed.netloc == "putkihq.com", f"wrong host on loc: {url}"


def test_robots_txt_points_at_canonical_sitemap():
    async def _run():
        return _make_client().get("/api/seo/robots.txt")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    assert "User-agent: *" in body
    assert "Disallow: /back-office" in body
    assert "Disallow: /api/admin" in body
    assert "Sitemap: https://putkihq.com/api/seo/sitemap.xml" in body
