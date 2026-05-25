"""Phase 3 V2 Step 2 - Webhook signal ingestion tests.

Covers Twitch (HMAC-SHA256), Kick (RSA PKCS1v15 SHA-256 over the documented
{msg_id}.{timestamp}.{body} signing string), and YouTube PubSubHubbub
(HMAC-SHA1) endpoints exposed by webhooks.py. Uses FastAPI TestClient so
env-controlled secrets / test keypairs can be set per-test without touching
the running supervisor backend.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

# Disable background workers before importing server (they would conflict
# with the supervised uvicorn already running on 8001 by touching the same
# MongoDB collections).
os.environ.setdefault("PUTKI_HQ_DISABLE_WORKERS", "1")
os.environ.setdefault("PUTKI_HQ_DISABLE_SCHEDULER", "1")

# Set webhook secrets before app import so the lazy env readers see them.
# Use per-test-run random secrets so static analysers never see literal strings.
import secrets as _pysecrets
TWITCH_SECRET = _pysecrets.token_hex(24)
YOUTUBE_SECRET = _pysecrets.token_hex(24)
os.environ["TWITCH_EVENTSUB_SECRET"] = TWITCH_SECRET
os.environ["YOUTUBE_PUBSUB_SECRET"] = YOUTUBE_SECRET
# Kick now requires CLIENT_ID + CLIENT_SECRET (RSA verification, not HMAC).
os.environ["KICK_CLIENT_ID"] = _pysecrets.token_hex(8)
os.environ["KICK_CLIENT_SECRET"] = _pysecrets.token_hex(16)

# Generate an in-process RSA keypair for Kick test signing. Inject the public
# key into the Kick api module's cache so the webhook handler verifies
# against our keypair instead of fetching from Kick servers.
_kick_test_priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_kick_test_pub_pem = _kick_test_priv.public_key().public_bytes(
    serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
)

import sys  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Patch Kick public-key cache BEFORE app import so the first request finds
# our test key in the cache.
import kick_api as _kick_api  # noqa: E402
_kick_api._PUBKEY_CACHE["pem"] = _kick_test_pub_pem
_kick_api._PUBKEY_CACHE["fetched_at"] = 9999999999  # far future - never refreshes

from fastapi.testclient import TestClient  # noqa: E402
from server import app, db as server_db  # noqa: E402
from pymongo import MongoClient  # noqa: E402

_sync_client = MongoClient(os.environ["MONGO_URL"])
sync_db = _sync_client[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── helpers ──────────────────────────────────────────────────────────────
def _twitch_sign(secret: str, msg_id: str, ts: str, body: bytes) -> str:
    base = (msg_id + ts).encode("utf-8") + body
    return "sha256=" + hmac.new(secret.encode("utf-8"), base, hashlib.sha256).hexdigest()


def _kick_sign(msg_id: str, timestamp: str, body: bytes) -> str:
    """RSA PKCS1v15 SHA-256 signature over `{msg_id}.{timestamp}.{body}`,
    base64-encoded. Mirrors the documented Kick scheme."""
    signed = f"{msg_id}.{timestamp}.".encode("utf-8") + body
    sig = _kick_test_priv.sign(signed, padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(sig).decode("ascii")


def _youtube_sign(secret: str, body: bytes) -> str:
    return "sha1=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha1).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


# ─────────────────────────────────────────────────────────────────────────
# Status endpoint
# ─────────────────────────────────────────────────────────────────────────
class TestWebhookStatus:
    def test_status_reports_configured(self, client):
        r = client.get("/api/webhooks/status")
        assert r.status_code == 200
        d = r.json()
        assert d["twitch_configured"] is True
        assert d["kick_configured"] is True
        assert d["youtube_configured"] is True
        assert "last_webhook_signal_by_source" in d


# ─────────────────────────────────────────────────────────────────────────
# Twitch EventSub
# ─────────────────────────────────────────────────────────────────────────
class TestTwitchWebhook:
    def test_challenge_handshake(self, client):
        body = json.dumps({
            "challenge": "pogchamp_42",
            "subscription": {"type": "stream.online"},
        }).encode("utf-8")
        msg_id = str(uuid.uuid4())
        ts = _now_iso()
        sig = _twitch_sign(TWITCH_SECRET, msg_id, ts, body)
        r = client.post(
            "/api/webhooks/twitch",
            content=body,
            headers={
                "Twitch-Eventsub-Message-Id": msg_id,
                "Twitch-Eventsub-Message-Timestamp": ts,
                "Twitch-Eventsub-Message-Signature": sig,
                "Twitch-Eventsub-Message-Type": "webhook_callback_verification",
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 200
        assert r.text == "pogchamp_42"

    def test_notification_writes_signal(self, client):
        body = json.dumps({
            "subscription": {"type": "stream.online", "id": "sub-1"},
            "event": {
                "broadcaster_user_id": "12345",
                "broadcaster_user_login": "andypyro",
                "broadcaster_user_name": "AndyPyro",
                "type": "live",
                "started_at": _now_iso(),
            },
        }).encode("utf-8")
        msg_id = f"twitch-{uuid.uuid4()}"
        ts = _now_iso()
        sig = _twitch_sign(TWITCH_SECRET, msg_id, ts, body)
        r = client.post(
            "/api/webhooks/twitch",
            content=body,
            headers={
                "Twitch-Eventsub-Message-Id": msg_id,
                "Twitch-Eventsub-Message-Timestamp": ts,
                "Twitch-Eventsub-Message-Signature": sig,
                "Twitch-Eventsub-Message-Type": "notification",
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 204

        # Verify the signal made it to MongoDB.
        doc = sync_db.signals.find_one(
            {"source": "twitch", "ingress": "webhook", "payload.broadcaster_user_login": "andypyro"}
        )
        assert doc is not None
        assert doc["mocked"] is False
        assert doc["event_type"] == "stream.online"

    def test_signature_mismatch_returns_403(self, client):
        body = json.dumps({"subscription": {"type": "stream.online"}, "event": {}}).encode("utf-8")
        msg_id = f"twitch-bad-{uuid.uuid4()}"
        ts = _now_iso()
        r = client.post(
            "/api/webhooks/twitch",
            content=body,
            headers={
                "Twitch-Eventsub-Message-Id": msg_id,
                "Twitch-Eventsub-Message-Timestamp": ts,
                "Twitch-Eventsub-Message-Signature": "sha256=deadbeef",
                "Twitch-Eventsub-Message-Type": "notification",
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 403
        assert "signature_mismatch" in r.json()["detail"]

    def test_missing_headers_returns_403(self, client):
        body = b"{}"
        r = client.post(
            "/api/webhooks/twitch",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 403

    def test_replay_protection_dedupes(self, client):
        unique_login = f"replay_test_{uuid.uuid4().hex[:8]}"
        body = json.dumps({
            "subscription": {"type": "stream.online"},
            "event": {"broadcaster_user_login": unique_login},
        }).encode("utf-8")
        msg_id = f"twitch-replay-{uuid.uuid4()}"
        ts = _now_iso()
        sig = _twitch_sign(TWITCH_SECRET, msg_id, ts, body)
        headers = {
            "Twitch-Eventsub-Message-Id": msg_id,
            "Twitch-Eventsub-Message-Timestamp": ts,
            "Twitch-Eventsub-Message-Signature": sig,
            "Twitch-Eventsub-Message-Type": "notification",
            "Content-Type": "application/json",
        }
        r1 = client.post("/api/webhooks/twitch", content=body, headers=headers)
        assert r1.status_code == 204
        # Replay - same message_id → silently acknowledged, no second write.
        r2 = client.post("/api/webhooks/twitch", content=body, headers=headers)
        assert r2.status_code == 200

        count = sync_db.signals.count_documents(
            {"source": "twitch", "payload.broadcaster_user_login": unique_login}
        )
        assert count == 1


# ─────────────────────────────────────────────────────────────────────────
# Kick
# ─────────────────────────────────────────────────────────────────────────
class TestKickWebhook:
    def test_valid_signature_writes_signal(self, client):
        body = json.dumps({
            "type": "livestream.started",
            "data": {
                "slug": "pact",
                "channel": "pact",
                "is_live": True,
                "viewer_count": 5600,
                "category": "Slots & Casino",
                "session_title": "PACT KICK LIVE",
            },
        }).encode("utf-8")
        msg_id = f"kick-{uuid.uuid4()}"
        timestamp = _now_iso()
        sig = _kick_sign(msg_id, timestamp, body)
        r = client.post(
            "/api/webhooks/kick",
            content=body,
            headers={
                "Kick-Event-Signature": sig,
                "Kick-Event-Message-Timestamp": timestamp,
                "Kick-Event-Type": "livestream.started",
                "Kick-Event-Message-Id": msg_id,
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 200

        doc = sync_db.signals.find_one(
            {"source": "kick", "ingress": "webhook", "payload.slug": "pact"}
        )
        assert doc is not None
        assert doc["event_type"] == "livestream.started"
        assert doc["payload"]["viewer_count"] == 5600
        assert doc["mocked"] is False

    def test_signature_mismatch_returns_403(self, client):
        body = json.dumps({"type": "x", "data": {}}).encode("utf-8")
        r = client.post(
            "/api/webhooks/kick",
            content=body,
            headers={
                "Kick-Event-Signature": base64.b64encode(b"deadbeef" * 32).decode("ascii"),
                "Kick-Event-Message-Id": f"bad-{uuid.uuid4()}",
                "Kick-Event-Message-Timestamp": _now_iso(),
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 403

    def test_missing_signature_returns_403(self, client):
        r = client.post(
            "/api/webhooks/kick",
            content=b"{}",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 403


# ─────────────────────────────────────────────────────────────────────────
# YouTube PubSubHubbub
# ─────────────────────────────────────────────────────────────────────────
ATOM_FEED = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123XYZ</yt:videoId>
    <yt:channelId>UCchan42</yt:channelId>
    <title>New video</title>
  </entry>
</feed>"""


class TestYouTubePubSub:
    def test_get_challenge_handshake(self, client):
        r = client.get(
            "/api/webhooks/youtube/pubsub",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": "yt-challenge-token-42",
                "hub.topic": "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCchan42",
            },
        )
        assert r.status_code == 200
        assert r.text == "yt-challenge-token-42"

    def test_get_invalid_verify_returns_400(self, client):
        r = client.get("/api/webhooks/youtube/pubsub")
        assert r.status_code == 400

    def test_post_notification_writes_signal(self, client):
        sig = _youtube_sign(YOUTUBE_SECRET, ATOM_FEED)
        r = client.post(
            "/api/webhooks/youtube/pubsub",
            content=ATOM_FEED,
            headers={"X-Hub-Signature": sig, "Content-Type": "application/atom+xml"},
        )
        assert r.status_code == 204

        doc = sync_db.signals.find_one(
            {"source": "youtube", "ingress": "webhook", "payload.video_id": "abc123XYZ"}
        )
        assert doc is not None
        assert doc["event_type"] == "video.published"
        assert doc["payload"]["channel_id"] == "UCchan42"

    def test_post_bad_signature_returns_202_silent(self, client):
        """Per WebSub spec - still 2xx even when verification fails."""
        r = client.post(
            "/api/webhooks/youtube/pubsub",
            content=ATOM_FEED,
            headers={"X-Hub-Signature": "sha1=deadbeef", "Content-Type": "application/atom+xml"},
        )
        assert r.status_code == 202


# ─────────────────────────────────────────────────────────────────────────
# 503 - endpoints dormant when secrets unset
# ─────────────────────────────────────────────────────────────────────────
class TestUnconfiguredDormant:
    """Verifies endpoints return 503 when their respective secrets are
    missing. Done by clearing env per call inside a separate TestClient."""

    def test_twitch_503_when_secret_missing(self, monkeypatch):
        monkeypatch.delenv("TWITCH_EVENTSUB_SECRET", raising=False)
        from importlib import reload
        import webhooks as wh
        reload(wh)
        from fastapi import FastAPI
        app2 = FastAPI()
        app2.include_router(wh.build_webhook_router(server_db), prefix="/api")
        with TestClient(app2) as c2:
            r = c2.post("/api/webhooks/twitch", content=b"{}",
                        headers={"Content-Type": "application/json"})
            assert r.status_code == 503

    def test_kick_503_when_secret_missing(self, monkeypatch):
        monkeypatch.delenv("KICK_CLIENT_ID", raising=False)
        monkeypatch.delenv("KICK_CLIENT_SECRET", raising=False)
        from importlib import reload
        import webhooks as wh
        reload(wh)
        from fastapi import FastAPI
        app2 = FastAPI()
        app2.include_router(wh.build_webhook_router(server_db), prefix="/api")
        with TestClient(app2) as c2:
            r = c2.post("/api/webhooks/kick", content=b"{}",
                        headers={"Content-Type": "application/json"})
            assert r.status_code == 503

    def test_youtube_503_when_secret_missing(self, monkeypatch):
        monkeypatch.delenv("YOUTUBE_PUBSUB_SECRET", raising=False)
        from importlib import reload
        import webhooks as wh
        reload(wh)
        from fastapi import FastAPI
        app2 = FastAPI()
        app2.include_router(wh.build_webhook_router(server_db), prefix="/api")
        with TestClient(app2) as c2:
            r1 = c2.get("/api/webhooks/youtube/pubsub", params={"hub.mode": "subscribe",
                                                                 "hub.challenge": "x"})
            assert r1.status_code == 503
            r2 = c2.post("/api/webhooks/youtube/pubsub", content=b"<feed/>",
                         headers={"X-Hub-Signature": "sha1=00"})
            assert r2.status_code == 503
