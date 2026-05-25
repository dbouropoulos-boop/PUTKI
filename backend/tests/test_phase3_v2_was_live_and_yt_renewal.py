"""Phase 3 V2 - WAS LIVE demotion + YouTube lease auto-renewal tests."""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest

os.environ.setdefault("PUTKI_HQ_DISABLE_WORKERS", "1")
os.environ.setdefault("PUTKI_HQ_DISABLE_SCHEDULER", "1")

import sys  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Load backend/.env so MONGO_URL / DB_NAME are visible to test fixtures.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from pymongo import MongoClient  # noqa: E402

_sync_client = MongoClient(os.environ["MONGO_URL"])
sync_db = _sync_client[os.environ["DB_NAME"]]


# ── helpers ──────────────────────────────────────────────────────────────
def _iso(dt: datetime) -> str: return dt.isoformat()


@pytest.fixture
def isolated_db():
    """A throw-away db handle that we clean between tests."""
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    test_db = cli[os.environ["DB_NAME"] + "_was_live_test"]
    # ensure clean slate
    asyncio.get_event_loop().run_until_complete(test_db.signals.delete_many({}))
    asyncio.get_event_loop().run_until_complete(test_db.published_content.delete_many({}))
    asyncio.get_event_loop().run_until_complete(test_db.feed_items.delete_many({}))
    asyncio.get_event_loop().run_until_complete(test_db.youtube_pubsub_leases.delete_many({}))
    asyncio.get_event_loop().run_until_complete(test_db.settings.delete_many({}))
    yield test_db
    cli.close()


# ─────────────────────────────────────────────────────────────────────────
# WAS LIVE demotion
# ─────────────────────────────────────────────────────────────────────────
class TestWasLiveDemotion:
    def test_stream_offline_demotes_live_tile(self, isolated_db):
        from feed import rebuild_feed

        async def scenario():
            # 1) Streamer is live → live signal lands first
            live_sig = {
                "id": str(uuid.uuid4()),
                "source": "twitch",
                "signal_type": "streamer_live",
                "weight": 70,
                "payload": {"login": "wastest_streamer", "viewers": 3200, "game_name": "Sweet Bonanza"},
                "mocked": False,
                "captured_at": _iso(datetime.now(timezone.utc) - timedelta(minutes=5)),
            }
            await isolated_db.signals.insert_one(live_sig)
            res1 = await rebuild_feed(isolated_db)
            assert res1["upserted"] >= 1
            live_doc = await isolated_db.feed_items.find_one(
                {"dedup_key": "twitch:wastest_streamer", "market_id": "FI"}, {"_id": 0}
            )
            assert live_doc is not None
            assert live_doc["kind"] == "stream_live"

            # 2) Offline signal lands (newer timestamp)
            offline_sig = {
                "id": str(uuid.uuid4()),
                "source": "twitch",
                "signal_type": "stream.offline",
                "weight": 70,
                "payload": {"login": "wastest_streamer"},
                "mocked": False,
                "captured_at": _iso(datetime.now(timezone.utc)),
            }
            await isolated_db.signals.insert_one(offline_sig)
            res2 = await rebuild_feed(isolated_db)
            assert res2.get("demoted", 0) >= 1

            demoted = await isolated_db.feed_items.find_one(
                {"dedup_key": "twitch:wastest_streamer", "market_id": "FI"}, {"_id": 0}
            )
            assert demoted is not None
            assert demoted["kind"] == "stream_was_live"
            assert demoted["title"].startswith("Juuri päättyi · ")
            assert demoted["weight"] < 70  # bumped down
            assert demoted["source_ref"].get("offline_observed_at")

            # 3) expires_at is within the grace window - ≤ 35s from now
            exp = datetime.fromisoformat(demoted["expires_at"].replace("Z", "+00:00"))
            seconds_left = (exp - datetime.now(timezone.utc)).total_seconds()
            assert 0 < seconds_left < 60

        asyncio.get_event_loop().run_until_complete(scenario())

    def test_offline_only_no_demotion_when_no_live_tile(self, isolated_db):
        from feed import rebuild_feed

        async def scenario():
            offline_sig = {
                "id": str(uuid.uuid4()),
                "source": "kick",
                "signal_type": "livestream.ended",
                "weight": 60,
                "payload": {"slug": "neverlive_streamer"},
                "mocked": False,
                "captured_at": _iso(datetime.now(timezone.utc)),
            }
            await isolated_db.signals.insert_one(offline_sig)
            res = await rebuild_feed(isolated_db)
            assert res.get("demoted", 0) == 0
            count = await isolated_db.feed_items.count_documents(
                {"dedup_key": "kick:neverlive_streamer"}
            )
            assert count == 0

        asyncio.get_event_loop().run_until_complete(scenario())


# ─────────────────────────────────────────────────────────────────────────
# YouTube lease auto-renewal worker
# ─────────────────────────────────────────────────────────────────────────
class TestYTLeaseAutoRenewal:
    def test_due_leases_are_renewed(self, isolated_db, monkeypatch):
        # Stub subscribe() so we don't hit the real WebSub hub.
        from youtube_lease_worker import renew_due_leases
        import youtube_pubsub as ytmod

        captured: list[str] = []

        async def fake_subscribe(channel_id, *, lease_seconds=None):
            captured.append(channel_id)
            return {"ok": True, "status_code": 202, "topic": f"https://yt/{channel_id}",
                    "lease_seconds": lease_seconds, "body": None}

        monkeypatch.setattr(ytmod, "subscribe", fake_subscribe)
        monkeypatch.setattr(ytmod, "is_configured", lambda: True)

        async def scenario():
            now_ts = datetime.now(timezone.utc).timestamp()
            # 2 leases due (expiring in 12 h), 1 healthy (expiring in 5 days)
            await isolated_db.youtube_pubsub_leases.insert_many([
                {"channel_id": "UCdue1", "slug": "@due1", "market_id": "FI",
                 "expires_at_ts": now_ts + 12 * 3600, "topic": "x"},
                {"channel_id": "UCdue2", "slug": "@due2", "market_id": "FI",
                 "expires_at_ts": now_ts + 6 * 3600, "topic": "x"},
                {"channel_id": "UChealthy", "slug": "@healthy", "market_id": "FI",
                 "expires_at_ts": now_ts + 5 * 86400, "topic": "x"},
            ])
            res = await renew_due_leases(isolated_db)
            assert res["ok"] is True
            assert res["due_count"] == 2
            assert res["renewed_count"] == 2
            assert set(captured) == {"UCdue1", "UCdue2"}

            # Both expires_at_ts now pushed > 48h out.
            row = await isolated_db.youtube_pubsub_leases.find_one(
                {"channel_id": "UCdue1"}, {"_id": 0}
            )
            assert row["expires_at_ts"] > now_ts + 48 * 3600

            # Global lease surface updated.
            setting = await isolated_db.settings.find_one(
                {"key": "webhook_youtube_pubsub_lease"}, {"_id": 0}
            )
            assert setting is not None
            assert setting["expires_at"]

        asyncio.get_event_loop().run_until_complete(scenario())

    def test_renew_skips_when_not_configured(self, isolated_db, monkeypatch):
        from youtube_lease_worker import renew_due_leases
        import youtube_pubsub as ytmod
        monkeypatch.setattr(ytmod, "is_configured", lambda: False)

        async def scenario():
            res = await renew_due_leases(isolated_db)
            assert res["ok"] is False
            assert res["reason"] == "youtube_pubsub_not_configured"
            assert res["renewed"] == 0

        asyncio.get_event_loop().run_until_complete(scenario())
