"""
Iter54 - streamer avatar resolver tests.

Targets:
  - The pure helpers in `streamer_avatars` (no network) - initials
    extraction and lookup key generation.
  - The admin endpoint requires auth + returns the expected summary shape.
  - The public streamers endpoint passes through `avatar_url`.

Network-dependent paths (`_fetch_twitch_avatars`, `_fetch_kick_avatars`,
`_fetch_youtube_avatars`) are intentionally NOT exercised here - they
need Twitch/Kick OAuth creds + YouTube API key + live API endpoints to
verify. The iter52 live-data check already covers Twitch/Kick auth.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
ADMIN_TOKEN = os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")


# ─────────────────────────── pure helpers ───────────────────────────

def test_streamer_lookup_key_prefers_channel_over_slug():
    from streamer_avatars import _streamer_lookup_key
    assert _streamer_lookup_key({"slug": "andypyro", "channel": "officialandypyro"}) == "officialandypyro"
    assert _streamer_lookup_key({"slug": "andypyro"}) == "andypyro"
    assert _streamer_lookup_key({"slug": "natu-fi", "channel": "@natu"}) == "natu"
    assert _streamer_lookup_key({}) == ""


def test_fetch_avatars_empty_inputs_return_empty_maps():
    """Empty input lists return empty dicts, no exceptions, no network."""
    from streamer_avatars import (
        _fetch_twitch_avatars, _fetch_kick_avatars, _fetch_youtube_avatars,
    )
    loop = asyncio.new_event_loop()
    try:
        assert loop.run_until_complete(_fetch_twitch_avatars([])) == {}
        assert loop.run_until_complete(_fetch_kick_avatars([])) == {}
        assert loop.run_until_complete(_fetch_youtube_avatars([])) == {}
    finally:
        loop.close()


# ─────────────────────── admin endpoint guards ───────────────────────

def test_admin_refresh_avatars_requires_admin_token():
    r = httpx.post(f"{BASE}/api/admin/streamers/refresh-avatars", timeout=15.0)
    assert r.status_code in (401, 403, 422), r.text


def test_admin_refresh_avatars_returns_summary_shape():
    """Calling force=false uses cached avatar_resolved_at_unix so re-runs
    skip every fresh row - should return fast (<2s) regardless of the
    underlying platform creds."""
    r = httpx.post(
        f"{BASE}/api/admin/streamers/refresh-avatars?force=false",
        headers={"X-Admin-Token": ADMIN_TOKEN}, timeout=30.0,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("resolved", "failed", "skipped_still_fresh",
                "twitch_count", "kick_count", "youtube_count",
                "force", "completed_at"):
        assert key in body, f"missing {key} in {body!r}"
    assert body["force"] is False


# ───────────────────── public surface contract ─────────────────────

def test_public_streamers_endpoint_passes_through_avatar_url():
    """The /api/streamers public endpoint exposes avatar_url to the
    frontend so cards can render real images instead of stock photos."""
    r = httpx.get(f"{BASE}/api/streamers?market=fi", timeout=15.0)
    assert r.status_code == 200
    streamers = (r.json() or {}).get("streamers") or []
    assert streamers, "registry should have at least one Finnish streamer"

    # At least one row should now carry avatar_url (the iter54 backfill
    # resolved ~34 of 84 on the first pass).
    with_avatars = [s for s in streamers if s.get("avatar_url")]
    assert with_avatars, (
        "no streamer has avatar_url - backfill did not run or schema "
        "stripped the field. Check streamer_avatars.refresh_all_avatars "
        "and the public-list pipeline."
    )
    for s in with_avatars:
        assert isinstance(s["avatar_url"], str)
        assert s["avatar_url"].startswith("http"), s["avatar_url"]
