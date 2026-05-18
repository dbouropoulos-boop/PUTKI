"""
PUTKI HQ — Iteration 20 / Phase 5.2 batch 2 acceptance tests.

Covers:
  • Streamer roster_summary (81 total, 49/20/12 split)
  • Article views: POST /api/content/:slug/view + dedup
  • GET /api/content/:slug/stats
  • POST /api/content/stats/bulk
  • Winners recent: 5 historical archive entries
"""
import os
import uuid
from pathlib import Path

import pytest
import requests


def _load_backend_url() -> str:
    env_val = os.environ.get("REACT_APP_BACKEND_URL")
    if env_val:
        return env_val.rstrip("/")
    env_file = Path("/app/frontend/.env")
    for line in env_file.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = _load_backend_url()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def sample_article(api):
    r = api.get(f"{BASE_URL}/api/published?limit=5", timeout=15)
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert items, "no published items in feed"
    return items[0]


# ── streamer roster ────────────────────────────────────────────────────────
class TestRosterSummary:
    def test_roster_summary_totals(self, api):
        r = api.get(f"{BASE_URL}/api/streamers/roster_summary", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tracked_total"] == 81, data
        by = data["by_platform"]
        assert by["twitch"] == 49, by
        assert by["kick"] == 20, by
        assert by["youtube"] == 12, by


# ── article views ─────────────────────────────────────────────────────────
class TestArticleViews:
    def test_bump_view_and_dedup(self, api, sample_article):
        slug = sample_article["url_slug"]
        r1 = api.post(f"{BASE_URL}/api/content/{slug}/view", timeout=15)
        assert r1.status_code == 200, r1.text
        v1 = r1.json()["views"]
        assert isinstance(v1, int) and v1 >= 1

        # dedup: same UA + IP + UTC day → same count
        r2 = api.post(f"{BASE_URL}/api/content/{slug}/view", timeout=15)
        assert r2.status_code == 200
        v2 = r2.json()["views"]
        assert v2 == v1, f"dedup failed: v1={v1} v2={v2}"

    def test_get_stats(self, api, sample_article):
        slug = sample_article["url_slug"]
        api.post(f"{BASE_URL}/api/content/{slug}/view", timeout=15)
        r = api.get(f"{BASE_URL}/api/content/{slug}/stats", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "views" in data and isinstance(data["views"], int)
        assert data["views"] >= 1

    def test_stats_unknown_slug(self, api):
        bogus = f"TEST_{uuid.uuid4().hex[:8]}-no-such-article"
        r = api.get(f"{BASE_URL}/api/content/{bogus}/stats", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"views": 0}

    def test_bulk_stats(self, api):
        # grab 3 ids
        r = api.get(f"{BASE_URL}/api/published?limit=3", timeout=15)
        items = r.json()["items"]
        ids = [i["id"] for i in items]
        # bump one so we know it has views
        slug0 = items[0]["url_slug"]
        api.post(f"{BASE_URL}/api/content/{slug0}/view", timeout=15)
        r = api.post(f"{BASE_URL}/api/content/stats/bulk",
                     json={"ids": ids}, timeout=15)
        assert r.status_code == 200
        stats = r.json()["stats"]
        assert isinstance(stats, dict)
        # at least the bumped one is present
        assert ids[0] in stats
        assert isinstance(stats[ids[0]], int) and stats[ids[0]] >= 1

    def test_bulk_stats_empty_ids(self, api):
        r = api.post(f"{BASE_URL}/api/content/stats/bulk",
                     json={"ids": []}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"stats": {}}


# ── winners recent (historical archive) ───────────────────────────────────
class TestWinnersRecent:
    def test_five_historical_entries(self, api):
        r = api.get(f"{BASE_URL}/api/winners/recent", timeout=15)
        assert r.status_code == 200
        winners = r.json()["winners"]
        assert len(winners) == 5, f"expected 5, got {len(winners)}"
        for w in winners:
            assert w.get("editorial_placeholder") is True, w
            assert w.get("editorial_kind") == "historical_archive", w
            assert "Editorial archive" in w.get("note", ""), w
            assert w.get("settled_at"), w

    def test_includes_known_matches(self, api):
        r = api.get(f"{BASE_URL}/api/winners/recent", timeout=15)
        winners = r.json()["winners"]
        teams = {(w.get("pick_team"), w.get("opponent")) for w in winners}
        expected_picks = {
            "Spain", "Real Madrid", "Florida Panthers",
            "Manchester City", "Inter",
        }
        picks = {t[0] for t in teams}
        # All 5 expected picks must appear
        missing = expected_picks - picks
        assert not missing, f"missing picks: {missing} got {picks}"
