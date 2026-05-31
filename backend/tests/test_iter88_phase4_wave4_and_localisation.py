"""
iter88 · Phase 4 wave 4 + localisation — sitemap + data-page endpoint tests.

Follows the existing in-tree pattern (no pytest-asyncio decorator —
uses asyncio.run() per the convention) to stay compatible with the
Motor event-loop binding behaviour.
"""
from __future__ import annotations

import asyncio
import os

from fastapi import FastAPI
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient

from routes.data_pages import build_data_pages_router
from routes.seo import build_sitemap_router

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


def _make_data_client():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    app = FastAPI()
    app.include_router(build_data_pages_router(db), prefix="/api")
    return TestClient(app)


def _make_seo_client():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    app = FastAPI()
    app.include_router(build_sitemap_router(db), prefix="/api")
    return TestClient(app)


# ── Sitemap — Phase 4 wave 2 localisation + wave 4 routes ─────────────

def test_sitemap_contains_en_localised_wave2_routes():
    async def _run():
        return _make_seo_client().get("/api/seo/sitemap.xml")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    for path in [
        "/en/mestari/methodology",
        "/en/mittari/sources",
        "/en/voita/faq",
        "/en/profiilit/dioni-q-and-a",
    ]:
        assert path in body, f"missing localised EN path {path} from sitemap"


def test_sitemap_contains_wave4_trust_pages():
    async def _run():
        return _make_seo_client().get("/api/seo/sitemap.xml")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    for path in [
        "/trust/mestari-aineisto",
        "/trust/voita-tilikirja",
        "/trust/mittari-tarkkuus",
        "/en/trust/mestari-dataset",
        "/en/trust/voita-ledger",
        "/en/trust/mittari-accuracy",
    ]:
        assert path in body, f"missing wave-4 trust path {path} from sitemap"


def test_sitemap_contains_en_localised_wave1_routes():
    """iter89 · Phase 4 localisation — Reform 2027 + 7 deep /pelit guides EN canonicals."""
    async def _run():
        return _make_seo_client().get("/api/seo/sitemap.xml")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.text
    for path in [
        "/en/regulation/reform-2027",
        "/en/games/blackjack",
        "/en/games/poker",
        "/en/games/slots",
        "/en/games/craps",
        "/en/games/roulette",
        "/en/games/live",
        "/en/games/bonus-math",
    ]:
        assert path in body, f"missing wave-1 EN path {path} from sitemap"


# ── Data endpoints — shape + safety ───────────────────────────────────

def test_mestari_dataset_summary_envelope():
    async def _run():
        return _make_data_client().get("/api/data/mestari/dataset-summary")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.json()
    for k in ["total_runs", "per_diagnostic", "computed_at", "schema_version"]:
        assert k in body
    assert isinstance(body["per_diagnostic"], list)
    # If any rows exist, the first one must carry the quartile shape.
    if body["per_diagnostic"]:
        first = body["per_diagnostic"][0]
        for axis in ("process", "discipline", "recovery"):
            assert axis in first
            for q in ("min", "p25", "p50", "p75", "max"):
                assert q in first[axis]


def test_voita_ledger_envelope_and_no_id_leak():
    async def _run():
        return _make_data_client().get("/api/data/voita/ledger")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.json()
    for k in ["rows", "count", "computed_at", "schema_version"]:
        assert k in body
    assert isinstance(body["rows"], list)
    assert body["count"] == len(body["rows"])
    # No MongoDB _id leak anywhere in the response.
    for r in body["rows"]:
        assert "_id" not in r


def test_mittari_accuracy_envelope_and_status():
    async def _run():
        return _make_data_client().get("/api/data/mittari/accuracy-90d")

    res = asyncio.run(_run())
    assert res.status_code == 200
    body = res.json()
    for k in ["rolling_days", "since", "per_class", "total_n", "total_hits", "total_hit_rate", "status", "computed_at"]:
        assert k in body
    assert body["rolling_days"] == 90
    assert body["status"] in {"live", "scaffold"}
    assert isinstance(body["per_class"], list)
    # If there is no outcome ledger data, the status must be scaffold AND total_n must be 0.
    if body["status"] == "scaffold":
        assert body["total_n"] == 0
