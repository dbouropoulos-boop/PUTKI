"""
iter76 - Strict signup enforcement on Telegram bot /start.

When `bot_config.require_verified_signup=True` (the user-locked default),
`/start mittari_<pending_id>` must reject unknown pending_ids with an
on-bot message rather than silently creating a row.
"""
from __future__ import annotations

import asyncio
import os
import secrets
import sys
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from telegram_bot import _handle_mittari_start  # noqa: E402


class _StubCollection:
    def __init__(self):
        self.rows = {}
        self.sent = []
    async def find_one(self, q, proj=None):
        # Only supports the queries the handler issues in this code path.
        pid = q.get("pending_id")
        if pid:
            row = self.rows.get(pid)
            if row is None:
                return None
            return {k: v for k, v in row.items() if k != "_id"}
        return None
    async def update_one(self, q, update, upsert=False):
        pid = q.get("pending_id")
        if not pid:
            return None
        row = self.rows.get(pid) or {}
        row.update(update.get("$set", {}))
        if upsert and pid not in self.rows:
            row.update(update.get("$setOnInsert", {}))
        self.rows[pid] = row
        return None


class _StubDB:
    def __init__(self, *, require_verified=True, cfg_doc=None):
        self.mittari_subscribers = _StubCollection()
        cfg = {"require_verified_signup": require_verified}
        if cfg_doc:
            cfg.update(cfg_doc)
        self.bot_config = _CfgCollection(cfg)


class _CfgCollection:
    def __init__(self, cfg):
        self._cfg = cfg
    async def find_one(self, q, proj=None):
        if q.get("_id") == "bot_config":
            return self._cfg
        return None


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_unverified_pending_id_is_blocked(monkeypatch):
    db = _StubDB(require_verified=True)
    sent = []

    async def fake_send(chat_id, text, **kw):
        sent.append((chat_id, text))
        return {"ok": True}

    import telegram_bot
    monkeypatch.setattr(telegram_bot, "send_message", fake_send)

    out = _run(_handle_mittari_start(
        db, chat_id=12345, username="walkup_user",
        pending_id=f"mittari_{secrets.token_hex(4)}",
    ))
    assert out["kind"] == "mittari_unverified_blocked"
    # Row was NOT created.
    assert db.mittari_subscribers.rows == {}
    # User got the gate message pointing to /signup.
    assert sent and "/signup" in sent[0][1]


def test_known_pending_id_binds_and_flips_status(monkeypatch):
    db = _StubDB(require_verified=True)
    pid = f"mittari_{secrets.token_hex(4)}"
    # Seed a pending row from the website signup flow.
    db.mittari_subscribers.rows[pid] = {
        "pending_id": pid, "email": "qa@example.com",
        "segment": "football", "status": "pending",
        "consent_tag": "mittari_alerts", "source": "web_signup",
        "created_at": "2026-05-27T00:00:00+00:00",
    }
    import telegram_bot

    async def fake_send(chat_id, text, **kw):
        return {"ok": True}
    monkeypatch.setattr(telegram_bot, "send_message", fake_send)
    # latest_snapshot is imported inside the handler from dial_engine.
    import dial_engine
    async def _snap(_db): return {}
    monkeypatch.setattr(dial_engine, "latest_snapshot", _snap)

    out = _run(_handle_mittari_start(db, chat_id=98765, username="alice", pending_id=pid))
    assert out["kind"] == "mittari_bound"
    assert out["already_bound"] is False
    # Status flipped to active.
    row = db.mittari_subscribers.rows[pid]
    assert row["status"] == "active"
    assert str(row["telegram_chat_id"]) == "98765"


def test_lax_mode_still_accepts_walkups(monkeypatch):
    # require_verified_signup=False - legacy behaviour for tests / dev.
    db = _StubDB(require_verified=False)
    import telegram_bot

    async def fake_send(chat_id, text, **kw):
        return {"ok": True}
    monkeypatch.setattr(telegram_bot, "send_message", fake_send)
    import dial_engine
    async def _snap(_db): return {}
    monkeypatch.setattr(dial_engine, "latest_snapshot", _snap)

    pid = f"mittari_{secrets.token_hex(4)}"
    out = _run(_handle_mittari_start(db, chat_id=42, username=None, pending_id=pid))
    assert out["kind"] == "mittari_bound"
    # Row was created from scratch in lax mode.
    assert pid in db.mittari_subscribers.rows
