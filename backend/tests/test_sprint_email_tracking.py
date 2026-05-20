"""
Regression tests for the email tracking pixel + click redirect.

Covers:
  - new_token() returns a unique URL-safe string per call
  - build_pixel_url / build_click_url construct the expected paths
  - inject_tracking_into_html slots the pixel before </body>
  - decode_target enforces the allowlist and rejects unsafe hosts
  - record_open / record_click increment counters idempotently
  - enqueue_playbook_email writes track_token + 0 counters
  - public /api/track/o/{token}.gif always returns the GIF
  - public /api/track/c/{token} 302s to the decoded URL and 400s
    on an untrusted host
"""
from __future__ import annotations

import asyncio
import base64
import os
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("PUTKI_HQ_DISABLE_WORKERS", "1")
os.environ.setdefault("EMAIL_TRACKING_ENABLED", "1")

# Import server.py once (creates the FastAPI app + the test client).
from server import app  # noqa: E402
from email_tracking import (  # noqa: E402
    build_click_url,
    build_pixel_url,
    decode_target,
    inject_tracking_into_html,
    new_token,
    record_click,
    record_open,
)
from playbook import enqueue_playbook_email  # noqa: E402

client = TestClient(app)


def _b64(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode()).rstrip(b"=").decode()


def test_new_token_is_unique_and_urlsafe():
    seen = {new_token() for _ in range(20)}
    assert len(seen) == 20
    for t in seen:
        # URL-safe base64 ⇒ no `/` or `+` and no padding `=`
        assert "/" not in t and "+" not in t and "=" not in t
        assert len(t) >= 22


def test_build_pixel_url_uses_token_path():
    url = build_pixel_url("abc123")
    parsed = urlparse(url)
    assert parsed.path == "/api/track/o/abc123.gif"


def test_build_click_url_wraps_allowlisted_only():
    wrapped = build_click_url("tok", "https://weezybet.com/register?x=1")
    assert "/api/track/c/tok?u=" in wrapped
    # Untrusted host falls through to the original URL.
    same = build_click_url("tok", "https://evil.example.com/x")
    assert same == "https://evil.example.com/x"


def test_inject_tracking_appends_pixel_before_closer():
    html = "<div>hello</div>"
    out = inject_tracking_into_html(html, "tok-x")
    assert "/api/track/o/tok-x.gif" in out
    # Pixel sits at the end (just before </div>).
    assert out.endswith("</div>")
    assert out.index("track/o/tok-x") < out.index("</div>")


def test_decode_target_allowlist():
    assert decode_target(_b64("https://weezybet.com/register")) == "https://weezybet.com/register"
    assert decode_target(_b64("https://putkihq.fi/voyager")) == "https://putkihq.fi/voyager"
    assert decode_target(_b64("https://evil.example.com/x")) is None
    assert decode_target("not-base64") is None
    assert decode_target(None) is None


def test_track_open_pixel_returns_gif():
    r = client.get("/api/track/o/anytoken.gif")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/gif")
    # Smallest legal GIF is 43 bytes.
    assert len(r.content) == 43


def test_track_click_redirect_to_allowlisted_url():
    r = client.get(
        "/api/track/c/tok?u=" + _b64("https://weezybet.com/register"),
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert r.headers["location"] == "https://weezybet.com/register"


def test_track_click_rejects_untrusted_host():
    r = client.get(
        "/api/track/c/tok?u=" + _b64("https://evil.example.com/x"),
        follow_redirects=False,
    )
    assert r.status_code == 400


def test_enqueue_writes_track_token_and_zero_counters():
    from motor.motor_asyncio import AsyncIOMotorClient

    async def run():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        entry_id = "pytest-pixel-1"
        await db.email_outbox.delete_many({"voita_entry_id": entry_id})
        await enqueue_playbook_email(
            db, email="qa+px@example.com", display_name="QA",
            raffle_title="Test Raffle", entry_id=entry_id,
            entry_position=3, lang="fi",
        )
        row = await db.email_outbox.find_one({"voita_entry_id": entry_id})
        assert row is not None
        assert row.get("track_token")
        assert row.get("open_count") == 0
        assert row.get("click_count") == 0
        # Token is embedded in the rendered body_html (pixel URL).
        assert row["track_token"] in row["body_html"]

        # Two opens — counter increments idempotently per call.
        await record_open(db, row["track_token"], user_agent="test")
        await record_open(db, row["track_token"], user_agent="test")
        row = await db.email_outbox.find_one({"voita_entry_id": entry_id})
        assert row["open_count"] == 2
        assert row.get("first_opened_at")
        assert row.get("last_opened_at")

        # One click on an allowlisted URL.
        await record_click(
            db, row["track_token"],
            "https://weezybet.com/register", user_agent="test",
        )
        row = await db.email_outbox.find_one({"voita_entry_id": entry_id})
        assert row["click_count"] == 1

        await db.email_outbox.delete_many({"voita_entry_id": entry_id})

    # Use an isolated event loop so we don't close the one the global
    # FastAPI TestClient depends on for sibling tests.
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(run())
    finally:
        loop.close()


def test_aaa_outbox_summary_includes_tracking_totals():
    """Smoke check on /api/admin/playbook → outbox.tracking shape.
    Hits the running preview backend directly via httpx so we don't
    fight pytest's event-loop teardown."""
    import httpx
    base = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
    headers = {"X-Admin-Token": os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")}
    try:
        r = httpx.get(f"{base}/api/admin/playbook", headers=headers, timeout=8.0)
    except httpx.HTTPError:
        pytest.skip("preview backend not reachable from test environment")
        return
    assert r.status_code == 200
    data = r.json()
    assert "outbox" in data
    assert "tracking" in data["outbox"]
    keys = data["outbox"]["tracking"].keys()
    assert {"outbox_total", "opens_total", "clicks_total"}.issubset(set(keys))
