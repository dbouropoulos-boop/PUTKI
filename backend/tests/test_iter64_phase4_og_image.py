"""
iter64 Phase 4 - Tournament re-scope + OG share image regression.

Verifies:
  • mini_game_tournament.ACTIVE_GAME_SLUGS is now ONLY ["scenario_decisions"]
  • Legacy Snake/Tap/Insight/Quiz are retained in _LEGACY_GAME_SLUGS for
    historical analytics access but no longer enter the tournament close.
  • GET /api/profiler/share/og.png returns a real 1200×630 PNG.
  • GET /api/profiler/share/u/{persona_key} returns the unfurl HTML
    landing page with the correct og:image meta tag.
  • Route precedence: og.png does NOT collide with /u/{persona_key}.
"""
import io
import os

import requests
from PIL import Image

API = os.environ.get("BACKEND_API", "http://localhost:8001/api")
BASE_NO_API = API.rsplit("/api", 1)[0]


def test_tournament_active_slugs_scoped_to_profiler_only():
    import sys
    sys.path.insert(0, "/app/backend")
    from mini_game_tournament import ACTIVE_GAME_SLUGS, _LEGACY_GAME_SLUGS
    assert ACTIVE_GAME_SLUGS == ["scenario_decisions"], (
        f"ACTIVE_GAME_SLUGS must be exactly ['scenario_decisions'], got {ACTIVE_GAME_SLUGS}"
    )
    # Legacy slugs retained for historical analytics, NOT for closing
    for slug in ("quiz_gambling_literacy", "insight_reveal", "arcade_snake", "arcade_tap"):
        assert slug in _LEGACY_GAME_SLUGS, f"{slug} should be in _LEGACY_GAME_SLUGS"
        assert slug not in ACTIVE_GAME_SLUGS, f"{slug} must NOT be in ACTIVE_GAME_SLUGS"


def test_og_png_endpoint_returns_real_1200x630_png():
    r = requests.get(f"{API}/profiler/share/og.png",
                     params={"persona_key": "cold_calculator", "lang": "fi"},
                     timeout=15)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/png")
    assert "max-age" in r.headers.get("cache-control", "")
    img = Image.open(io.BytesIO(r.content))
    assert img.size == (1200, 630), f"expected 1200×630, got {img.size}"
    assert img.mode == "RGB"


def test_og_png_works_for_every_persona_key():
    for key in ("cold_calculator", "patient_tactician", "streak_chaser",
                "comeback_believer", "tilt_risk"):
        r = requests.get(f"{API}/profiler/share/og.png",
                         params={"persona_key": key}, timeout=15)
        assert r.status_code == 200, f"{key}: {r.text[:200]}"
        assert r.headers["content-type"].startswith("image/png")
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (1200, 630)


def test_unfurl_landing_returns_html_with_og_meta():
    for lang in ("fi", "en"):
        r = requests.get(f"{API}/profiler/share/u/streak_chaser",
                         params={"lang": lang}, timeout=10,
                         allow_redirects=False)
        assert r.status_code == 200
        body = r.text
        assert "og:image" in body
        assert "persona_key=streak_chaser" in body
        assert "1200" in body and "630" in body
        if lang == "en":
            assert "I'm The Streak Chaser" in body
        else:
            assert "Putken jahti" in body  # FI display name
        assert 'twitter:card" ' in body and "summary_large_image" in body


def test_unfurl_landing_falls_back_for_unknown_persona():
    r = requests.get(f"{API}/profiler/share/u/not_a_real_key", timeout=10,
                     allow_redirects=False)
    assert r.status_code == 200
    assert "og:image" in r.text


def test_og_png_does_not_collide_with_landing_route():
    """Regression - `og.png` must not be matched by the parametric
    /u/{persona_key} landing handler."""
    r = requests.get(f"{API}/profiler/share/og.png",
                     params={"persona_key": "cold_calculator"}, timeout=10)
    assert r.headers["content-type"].startswith("image/png"), (
        f"og.png returned non-PNG content-type - route collision regressed: {r.headers}"
    )
