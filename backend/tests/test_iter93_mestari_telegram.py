"""
iter93 · Phase 3 — Mestari Telegram-first conversion tests.

Pattern (matches iter89): hits the LIVE backend via httpx + sync pymongo
for direct DB introspection. Avoids motor/event-loop binding issues.

Coverage:
  - POST /api/mestari/lead/telegram writes a pending row with the
    resolved profile_slug.
  - GET  /api/mestari/profile-content/<token> returns the profile.
  - POST /api/telegram/bind/<token> binds chat_id.
  - 404 on unknown magic_token (both GET and bind).
  - Telegram bot's `mestari_<token>` prefix invokes the bind handler
    and updates the row + sends a welcome message (mocked transport).
"""
from __future__ import annotations

import asyncio
import os
import uuid

import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from pymongo import MongoClient  # noqa: E402

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TIMEOUT = 60.0
HEADERS_JSON = {"Content-Type": "application/json"}

LEAD = f"{BASE}/api/mestari/lead/telegram"
CONTENT = f"{BASE}/api/mestari/profile-content"
BIND = f"{BASE}/api/telegram/bind"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


def _db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _mint() -> str:
    return f"itr93-{uuid.uuid4().hex[:16]}"


def _cleanup(db, tok: str):
    db.optin_consents.delete_many({
        "channel": "telegram",
        "surface": "mestari_landing",
        "identifier": tok,
    })


# ── lead-telegram endpoint ────────────────────────────────────────────────

def test_lead_telegram_writes_pending_row_with_resolved_profile():
    tok = _mint()
    db = _db()
    _cleanup(db, tok)
    try:
        r = httpx.post(LEAD, json={
            "magic_token": tok,
            "quiz_tags": {
                "bias_favorite": "bias_favorite",
                "wrong_pattern": "bias_loyalty",
            },
            "lang": "fi",
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["profile_slug"] == "confident_loyalist"
        assert body["profile_name_fi"] == "ITSEVARMA LOJAALI"
        row = db.optin_consents.find_one({
            "channel": "telegram",
            "surface": "mestari_landing",
            "identifier": tok,
        })
        assert row is not None
        assert row["consent_tag"] == "mestari_lead"
        assert row["source"] == "mestari"
        assert row["mestari_profile_slug"] == "confident_loyalist"
        assert row.get("telegram_chat_id") in (None, "")
    finally:
        _cleanup(db, tok)


def test_lead_telegram_idempotent_on_magic_token():
    tok = _mint()
    db = _db()
    _cleanup(db, tok)
    try:
        for _ in range(2):
            r = httpx.post(LEAD, json={"magic_token": tok, "lang": "fi"},
                           timeout=TIMEOUT)
            assert r.status_code == 200, r.text
        count = db.optin_consents.count_documents({
            "channel": "telegram",
            "surface": "mestari_landing",
            "identifier": tok,
        })
        assert count == 1
    finally:
        _cleanup(db, tok)


# ── profile-content endpoint ──────────────────────────────────────────────

def test_profile_content_404_when_token_unknown():
    r = httpx.get(f"{CONTENT}/iter93-unknown-{uuid.uuid4().hex[:8]}",
                  timeout=TIMEOUT)
    assert r.status_code == 404


def test_profile_content_returns_resolved_profile_after_lead():
    tok = _mint()
    db = _db()
    _cleanup(db, tok)
    try:
        httpx.post(LEAD, json={
            "magic_token": tok,
            "quiz_tags": {"bias_favorite": "bias_favorite",
                          "wrong_pattern": "bias_loyalty"},
            "lang": "en",
        }, timeout=TIMEOUT)
        r = httpx.get(f"{CONTENT}/{tok}", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["magic_token"] == tok
        assert body["bound"] is False
        assert body["lang"] == "en"
        assert body["profile"]["slug"] == "confident_loyalist"
        assert body["profile"]["name_en"].startswith("THE CONFIDENT")
        assert body["profile"]["tease_fi"]
        assert body["profile"]["tease_en"]
    finally:
        _cleanup(db, tok)


# ── telegram/bind endpoint ────────────────────────────────────────────────

def test_bind_404_when_token_unknown():
    r = httpx.post(f"{BIND}/iter93-unknown-{uuid.uuid4().hex[:8]}",
                   json={"telegram_chat_id": "12345"}, timeout=TIMEOUT)
    assert r.status_code == 404


def test_bind_sets_chat_id_on_pending_row():
    tok = _mint()
    db = _db()
    _cleanup(db, tok)
    try:
        httpx.post(LEAD, json={"magic_token": tok, "lang": "fi"},
                   timeout=TIMEOUT)
        r = httpx.post(f"{BIND}/{tok}", json={
            "telegram_chat_id": "98765",
            "telegram_username": "testuser",
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["bound"] is True
        row = db.optin_consents.find_one({
            "channel": "telegram",
            "surface": "mestari_landing",
            "identifier": tok,
        })
        assert row["telegram_chat_id"] == "98765"
        assert row["telegram_username"] == "testuser"
        assert row.get("telegram_bound_at")
        content = httpx.get(f"{CONTENT}/{tok}", timeout=TIMEOUT).json()
        assert content["bound"] is True
    finally:
        _cleanup(db, tok)


# ── Telegram bot mestari handler ──────────────────────────────────────────

def test_bot_mestari_start_binds_via_update_handler(monkeypatch=None):
    """Drive `_handle_mestari_start` directly with a stubbed send_message
    so we never touch the live Telegram API. Verifies the bot binds and
    composes the welcome card text from profile content."""
    from motor.motor_asyncio import AsyncIOMotorClient
    import telegram_bot as tb

    captured = []

    async def fake_send_message(chat_id, text, **kwargs):
        captured.append({"chat_id": chat_id, "text": text})
        return {"ok": True}

    tok = _mint()
    sync_db = _db()
    _cleanup(sync_db, tok)
    try:
        httpx.post(LEAD, json={
            "magic_token": tok,
            "quiz_tags": {"bias_favorite": "bias_favorite",
                          "wrong_pattern": "bias_loyalty"},
            "lang": "fi",
        }, timeout=TIMEOUT)

        async def runner():
            client = AsyncIOMotorClient(MONGO_URL)
            try:
                db = client[DB_NAME]
                orig = tb.send_message
                tb.send_message = fake_send_message
                try:
                    res = await tb._handle_mestari_start(
                        db, chat_id=11111, username="tester",
                        magic_token=tok,
                    )
                finally:
                    tb.send_message = orig
                return res
            finally:
                client.close()

        res = asyncio.run(runner())
        assert res["handled"] is True
        assert res["kind"] == "mestari_bound"
        assert res["profile_slug"] == "confident_loyalist"
        assert res["already_bound"] is False

        # Bot wrote the chat_id back to the optin row
        row = sync_db.optin_consents.find_one({
            "channel": "telegram",
            "surface": "mestari_landing",
            "identifier": tok,
        })
        assert row["telegram_chat_id"] == "11111"
        assert row["telegram_username"] == "tester"

        # Welcome card mentions the matched profile name + bind state
        assert len(captured) == 1
        text = captured[0]["text"]
        assert "ITSEVARMA LOJAALI" in text
        assert "MESTARI" in text
    finally:
        _cleanup(sync_db, tok)


def test_bot_mestari_start_unknown_token_warns_and_no_bind():
    import telegram_bot as tb
    from motor.motor_asyncio import AsyncIOMotorClient

    captured = []

    async def fake_send_message(chat_id, text, **kwargs):
        captured.append({"chat_id": chat_id, "text": text})
        return {"ok": True}

    bogus = f"iter93-bogus-{uuid.uuid4().hex[:10]}"

    async def runner():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            db = client[DB_NAME]
            orig = tb.send_message
            tb.send_message = fake_send_message
            try:
                res = await tb._handle_mestari_start(
                    db, chat_id=22222, username="tester",
                    magic_token=bogus,
                )
            finally:
                tb.send_message = orig
            return res
        finally:
            client.close()

    res = asyncio.run(runner())
    assert res["handled"] is True
    assert res["kind"] == "mestari_unknown_token"
    assert len(captured) == 1
    # Polite Finnish error pointing back at /mestari
    assert "putkihq.fi/mestari" in captured[0]["text"].lower()
