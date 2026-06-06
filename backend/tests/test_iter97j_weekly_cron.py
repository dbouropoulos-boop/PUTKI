"""
iter97j · Sunday 08:00 Helsinki weekly cron + weekly fire endpoint tests.

Coverage:
  - `_is_weekly_window()` returns True only on Sunday between 08:00 and
    08:00+grace Helsinki, False on every other day/time.
  - `run_weekly_dispatch` with no draft writes a "weekly_cycle"
    skip row to dispatch_log AND fires an ops watchdog alert (idempotent).
  - `run_weekly_dispatch` with a `draft_override` renders + records a
    cycle row in dry-run mode.
  - `POST /api/admin/dispatch/fire` rejects type='weekly' without the
    confirm flag (400).
  - `POST /api/admin/dispatch/fire` with type='weekly' + confirm=True
    delegates to `run_weekly_dispatch` and returns an outcome envelope
    that includes the weekly cycle doc.

Pattern: httpx against live preview backend + sync pymongo for seed +
asyncio.run for direct invocations (matches iter89/93 convention).
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
TIMEOUT = 30.0
FIRE = f"{BASE}/api/admin/dispatch/fire"

# ── unit: weekly window detection ────────────────────────────────────────

def test_is_weekly_window_only_fires_sunday_morning():
    from dispatch_daily import _is_weekly_window, HELSINKI, WEEKLY_DISPATCH_HOUR

    # A known Sunday at 08:00 Helsinki — Feb 1, 2026 was Sunday.
    sunday_target = datetime(2026, 2, 1, WEEKLY_DISPATCH_HOUR, 0, tzinfo=HELSINKI)
    assert _is_weekly_window(sunday_target) is True

    # Same Sunday inside the grace window.
    sunday_grace = sunday_target + timedelta(minutes=2)
    assert _is_weekly_window(sunday_grace) is True

    # Same Sunday past the grace window.
    sunday_late = sunday_target + timedelta(minutes=30)
    assert _is_weekly_window(sunday_late) is False

    # Sunday early (before 08:00).
    sunday_early = sunday_target - timedelta(minutes=30)
    assert _is_weekly_window(sunday_early) is False

    # Monday at 08:00 — no fire.
    monday = sunday_target + timedelta(days=1)
    assert _is_weekly_window(monday) is False

    # Saturday at 08:00 — no fire.
    saturday = sunday_target - timedelta(days=1)
    assert _is_weekly_window(saturday) is False


# ── integration: run_weekly_dispatch direct invocation ───────────────────

def _get_db():
    """Sync motor-equivalent DB handle for direct dispatch calls.
    Uses the same loop the function is invoked from."""
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.environ.get("DB_NAME") or "test_database"
    return AsyncIOMotorClient(mongo_url)[db_name]


def test_weekly_dispatch_dry_run_with_override_writes_cycle_row():
    """Confirm a passed-in draft renders successfully in dry-run mode
    and writes a weekly_cycle row with eligible_total tally."""
    from dispatch_daily import run_weekly_dispatch

    draft = {
        "id": "test-weekly-iter97j",
        "type": "weekly",
        "fields": {
            "week_no": "06",
            "eyebrow": "VIIKKO 06 · TESTI",
            "headline_pre": "Testi",
            "headline_ember": "viikkokatsaus",
            "summary": "Yksikkötesti varmistaa että renderöinti toimii.",
            "articles": [],
            "sign_off": "— D.",
        },
    }

    async def _run():
        db = _get_db()
        return await run_weekly_dispatch(db, dry_run=True, draft_override=draft)

    result = asyncio.run(_run())
    assert result["kind"] == "weekly_cycle"
    assert result["dry_run"] is True
    assert result["draft_id"] == "test-weekly-iter97j"
    assert result["week_no"] == "06"
    assert "attempted" in result
    assert "eligible_total" in result
    assert "started_at" in result and "finished_at" in result


def test_weekly_dispatch_no_draft_writes_skip_row_and_alerts():
    """When no weekly draft is scheduled for today, the function must
    silent-skip with `skipped_reason=no_weekly_draft_scheduled`, write a
    weekly_cycle log row (for idempotency), and idempotently record an
    ops alert in dispatch_ops_alerts."""
    from dispatch_daily import run_weekly_dispatch, _today_ymd
    from pymongo import MongoClient

    mongo_url = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.environ.get("DB_NAME") or "test_database"
    sync_db = MongoClient(mongo_url)[db_name]

    # Clean slate: remove any prior test draft for today + any prior alert
    # row for today's "weekly_no_draft" reason so the test is hermetic.
    today = _today_ymd()
    sync_db.dispatch_drafts.delete_many({"type": "weekly", "scheduled_for": {"$regex": f"^{today}"}})
    sync_db.dispatch_ops_alerts.delete_many({"alert_key": f"{today}::weekly_no_draft"})

    async def _run():
        db = _get_db()
        return await run_weekly_dispatch(db, dry_run=True, draft_override=None)

    result = asyncio.run(_run())
    assert result["skipped_reason"] == "no_weekly_draft_scheduled"
    assert result["kind"] == "weekly_cycle"

    # Verify dispatch_log row exists.
    log_row = sync_db.dispatch_log.find_one(
        {"kind": "weekly_cycle", "cycle_date": today, "skipped_reason": "no_weekly_draft_scheduled"}
    )
    assert log_row is not None

    # Verify ops alert idempotency row created.
    alert = sync_db.dispatch_ops_alerts.find_one({"alert_key": f"{today}::weekly_no_draft"})
    assert alert is not None

    # Calling again must NOT create a second alert (idempotency via unique index).
    asyncio.run(_run())
    alerts = list(sync_db.dispatch_ops_alerts.find({"alert_key": f"{today}::weekly_no_draft"}))
    assert len(alerts) == 1


# ── integration: POST /api/admin/dispatch/fire ───────────────────────────

def _login_cookie() -> httpx.Cookies:
    """Get a logged-in admin cookie session."""
    with httpx.Client(timeout=TIMEOUT) as c:
        r = c.post(f"{BASE}/api/admin/auth/login", json={"token": TOKEN})
        assert r.status_code == 200, f"admin login failed: {r.text}"
        return c.cookies


def test_fire_weekly_rejects_missing_confirm_flag():
    cookies = _login_cookie()
    with httpx.Client(timeout=TIMEOUT, cookies=cookies) as c:
        r = c.post(FIRE, json={"type": "weekly", "fields": {}, "confirm": False})
        assert r.status_code == 400


def test_fire_weekly_with_confirm_delegates_to_run_weekly_dispatch():
    """Hit the live preview endpoint in dry_run mode so we don't actually
    send to subscribers. Must return a cycle doc with kind='weekly_cycle'."""
    cookies = _login_cookie()
    payload = {
        "type": "weekly",
        "fields": {
            "week_no": "06",
            "eyebrow": "TEST FIRE",
            "headline_pre": "Test",
            "headline_ember": "weekly",
            "summary": "Fire endpoint smoke test.",
            "articles": [],
            "sign_off": "— Test",
        },
        "channels": ["email"],
        "confirm": True,
        "dry_run": True,
    }
    with httpx.Client(timeout=TIMEOUT, cookies=cookies) as c:
        r = c.post(FIRE, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert "weekly" in body["outcome"]
        weekly = body["outcome"]["weekly"]
        assert weekly["kind"] == "weekly_cycle"
        # No 'skipped_reason: no_weekly_draft_scheduled' — we passed a draft override.
        assert weekly.get("skipped_reason") != "no_weekly_draft_scheduled"
        # dry_run path must NOT have called Resend.
        assert weekly["dry_run"] is True


def test_fire_rejects_unsupported_type():
    cookies = _login_cookie()
    with httpx.Client(timeout=TIMEOUT, cookies=cookies) as c:
        r = c.post(FIRE, json={"type": "welcome", "fields": {}, "confirm": True})
        assert r.status_code == 400
