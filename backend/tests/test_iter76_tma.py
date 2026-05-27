"""
iter76 (Slice 4) - Telegram Mini App auth + signals endpoint.

The HMAC dance:
    secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN)
    data_check = sorted "k=v" lines joined by "\n", excluding `hash`
    expected   = HMAC_SHA256(secret_key, data_check).hex()
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
import urllib.parse

import pytest
import requests

# Use the dotenv-loaded bot token so we sign with the same secret the
# backend uses.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")


def _bot_token() -> str:
    # Load from the same .env the backend reads at boot.
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    return os.environ.get("TELEGRAM_BOT_TOKEN") or ""


def _sign_init_data(token: str, user: dict, *, auth_date: int | None = None) -> str:
    """Produce a valid Telegram WebApp initData query string for tests."""
    data = {
        "auth_date": str(auth_date or int(time.time())),
        "query_id": "AAH-test",
        "user": json.dumps(user, separators=(",", ":")),
    }
    data_check = "\n".join(f"{k}={data[k]}" for k in sorted(data.keys()))
    secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
    data["hash"] = h
    # Telegram passes it as URL-encoded query string.
    return urllib.parse.urlencode(data)


_TOKEN = _bot_token()


def _has_token() -> bool:
    return bool(_TOKEN)


@pytest.mark.skipif(not _has_token(), reason="TELEGRAM_BOT_TOKEN required for HMAC tests")
class TestTmaAuth:
    def test_auth_rejects_blank_init_data(self):
        r = requests.post(
            f"{BASE_URL}/api/tma/auth",
            json={"init_data": ""}, timeout=5,
        )
        assert r.status_code == 401

    def test_auth_rejects_tampered_hash(self):
        init_data = _sign_init_data(_TOKEN, {"id": 1001, "first_name": "Test"})
        # Flip a byte in the hash to invalidate.
        tampered = init_data.replace("hash=", "hash=0")
        r = requests.post(
            f"{BASE_URL}/api/tma/auth",
            json={"init_data": tampered}, timeout=5,
        )
        assert r.status_code == 401

    def test_auth_happy_path_returns_token(self):
        init_data = _sign_init_data(_TOKEN, {"id": 2002, "first_name": "Slice4"})
        r = requests.post(
            f"{BASE_URL}/api/tma/auth",
            json={"init_data": init_data}, timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["tg_user"]["id"] == 2002
        assert body["token"]
        # Subscriber may or may not exist - just verify the envelope.
        assert "subscriber" in body


@pytest.mark.skipif(not _has_token(), reason="TELEGRAM_BOT_TOKEN required for HMAC tests")
class TestTmaSignals:
    def _auth(self, user_id: int):
        init_data = _sign_init_data(_TOKEN, {"id": user_id, "first_name": "Sig"})
        r = requests.post(
            f"{BASE_URL}/api/tma/auth",
            json={"init_data": init_data}, timeout=5,
        )
        assert r.status_code == 200
        return r.json()

    def test_signals_requires_valid_session(self):
        # Wrong token, valid user id - must 401.
        r = requests.get(
            f"{BASE_URL}/api/tma/signals?tg_user_id=3003&token=deadbeef",
            timeout=5,
        )
        assert r.status_code == 401

    def test_signals_returns_card_array(self):
        auth = self._auth(3003)
        r = requests.get(
            f"{BASE_URL}/api/tma/signals"
            f"?tg_user_id={auth['tg_user']['id']}&token={urllib.parse.quote(auth['token'])}",
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert "picks" in body
        assert "subscriber" in body
        assert body["unlock_mode"] in ("informative", "routed")
        # First two cards are always public for unbound users.
        for c in body["picks"]:
            assert "index" in c
            assert "locked" in c
        for c in body["picks"][:2]:
            assert c["locked"] is False
