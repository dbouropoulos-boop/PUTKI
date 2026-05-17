"""
Phase 4 Week 1 — Layer 2 backend tests.

Covers:
  - dial_engine.recalculate_dial 4-signal formula (intensities + weights)
  - Layer 2 collection writes via the tick functions (with mocked HTTP)
  - /api/dial/stream SSE endpoint produces valid event/data chunks
  - /api/admin/layer2/status and /api/admin/layer2/tick admin shape
  - Honest empty state when no Layer 2 docs exist
"""
from __future__ import annotations

import asyncio
import os
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
import requests

import dial_engine
import dial_sse


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK}


# ─────────── pure-function tests for the new dial formula ───────────

class _StubDB:
    """In-memory shim emulating the four Layer 2 collections + dial_snapshots."""

    def __init__(self, latest_per_coll: dict):
        self._latest = latest_per_coll
        self._snapshots = []

    def __getitem__(self, name):
        return _StubColl(self._latest.get(name), self._snapshots if name == "dial_snapshots" else None)

    @property
    def dial_snapshots(self):
        return _StubColl(None, self._snapshots)


class _StubColl:
    def __init__(self, latest_doc, snapshots_list):
        self._latest = latest_doc
        self._snapshots = snapshots_list

    async def find_one(self, *args, **kwargs):
        if self._snapshots is not None and self._snapshots:
            return self._snapshots[-1]
        return self._latest

    async def insert_one(self, doc):
        if self._snapshots is not None:
            self._snapshots.append(dict(doc))
        return type("R", (), {"inserted_id": "stub"})

    async def count_documents(self, _q):
        return len(self._snapshots) if self._snapshots is not None else 0

    def find(self, *args, **kwargs):
        return _StubCursor([])


class _StubCursor:
    def __init__(self, items):
        self._items = items

    def sort(self, *a, **k): return self
    def skip(self, *a): return self
    def limit(self, *a): return self
    async def to_list(self, length=None): return self._items


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class TestDialFormula:
    def test_all_empty_yields_kylma_zero(self):
        db = _StubDB({})
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["composite_score"] == 0.0
        assert snap["state_key"] == "KYLMA"
        assert snap["primary_driver"] == "default"
        assert snap["sub_scores"] == {"stream": 0.0, "social": 0.0, "sports": 0.0, "news": 0.0}
        assert "any_real" in snap
        assert snap["primary_driver_label"]["fi"] and snap["primary_driver_label"]["en"]

    def test_twitch_max_viewers_dominates(self):
        # 20 000 viewers → stream intensity ≈ 1 → sub_scores.stream ≈ 57
        db = _StubDB({
            "stream_signals": {"total_viewers": 20_000, "active_streams": 12, "captured_at": "x"},
        })
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["primary_driver"] == "stream"
        assert snap["sub_scores"]["stream"] >= 56.0
        # 57% weight cap so composite alone never exceeds 57 from stream
        assert snap["sub_scores"]["stream"] <= 57.0

    def test_weights_sum_correctly(self):
        # Force every signal to max so we can verify the weights sum to 100
        db = _StubDB({
            "stream_signals":   {"total_viewers": 20_000, "active_streams": 5},
            "social_signals":   {"mention_count": 20},
            "sports_signals":   {"games_active": 3},
            "news_signals":     {"matched_count": 10},
            "f1_signals":       {"race_active": True, "dormant": False},
            "football_signals": {"matches_active": 10, "dormant": False},
        })
        snap = _run(dial_engine.recalculate_dial(db))
        # Each sub_score should equal its weight when intensity = 1
        for cat, weight in dial_engine.SOURCE_WEIGHTS.items():
            assert snap["sub_scores"][cat] == pytest.approx(weight, abs=0.5)
        assert snap["composite_score"] == 100.0
        assert snap["state_key"] == "KIIRASTULI"

    def test_news_intensity_partial(self):
        # 5 matched articles → news intensity = 0.5 → sub_score = 7 (0.5 × 14% weight)
        db = _StubDB({"news_signals": {"matched_count": 5}})
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["sub_scores"]["news"] == pytest.approx(7.0, abs=0.5)
        assert snap["primary_driver"] == "news"

    def test_sports_binary(self):
        # Phase 4 W3b: sports intensity now spans NHL + F1 + Football. One
        # NHL game alone → 1/3 of the 29-weight band ≈ 9.67. All three sports
        # active simultaneously would yield the full 29.
        db = _StubDB({"sports_signals": {"games_active": 1}})
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["sub_scores"]["sports"] == pytest.approx(29.0 / 3, abs=0.5)
        assert snap["primary_driver"] == "sports"

    def test_sports_all_three_active_caps_at_weight(self):
        # NHL game + F1 race + finished football match → intensity = 1
        # Stub all three Layer 2 collections.
        from tests.test_phase4_w1_layer2 import _StubColl
        # Build a stub that returns one doc per collection.
        latests = {
            "sports_signals":   {"games_active": 1},
            "f1_signals":       {"race_active": True, "dormant": False},
            "football_signals": {"matches_active": 5, "dormant": False},
        }
        db = _StubDB(latests)
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["sub_scores"]["sports"] == pytest.approx(29.0, abs=0.5)
        assert snap["primary_driver"] == "sports"

    def test_state_thresholds_boundary_haalea(self):
        # Tune intensities so composite lands in HAALEA range 20-44.
        # NHL+F1+Football all active → 29 × 1.0 = 29 → HAALEA.
        db = _StubDB({
            "sports_signals":   {"games_active": 1},
            "f1_signals":       {"race_active": True, "dormant": False},
            "football_signals": {"matches_active": 1, "dormant": False},
        })
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["composite_score"] == pytest.approx(29.0, abs=0.5)
        assert snap["state_key"] == "HAALEA"

    def test_reddit_weight_zero_phase1(self):
        # Phase 1 has Reddit dropped — social weight = 0 means no matter how
        # many mentions appear, dial doesn't move from social signal alone.
        db = _StubDB({"social_signals": {"mention_count": 100}})
        snap = _run(dial_engine.recalculate_dial(db))
        assert snap["sub_scores"]["social"] == 0.0
        assert snap["composite_score"] == 0.0

    def test_dormant_twitch_flag_propagates(self):
        db = _StubDB({"stream_signals": {"dormant": True, "total_viewers": 0, "active_streams": 0}})
        snap = _run(dial_engine.recalculate_dial(db))
        # Dormant doc still counts as "present" but `any_real` must be False
        # since the only doc is the placeholder.
        assert snap["any_real"] is False


# ─────────── Layer 2 worker tick functions (HTTP mocked) ───────────

from layer2_workers import (  # noqa: E402
    reddit_tick, rss_tick, nhl_tick,
)


class _StubInsertCollection:
    def __init__(self):
        self.docs = []
    async def insert_one(self, doc):
        self.docs.append(dict(doc))


class _StubDBLayer2:
    def __init__(self):
        self.stream_signals = _StubInsertCollection()
        self.social_signals = _StubInsertCollection()
        self.sports_signals = _StubInsertCollection()
        self.news_signals   = _StubInsertCollection()

    def __getitem__(self, k): return getattr(self, k)


class TestLayer2Ticks:
    def test_reddit_tick_counts_keywords(self):
        sample = [
            {"title": "Iso voitto Weezybet kasinolla", "selftext": "", "permalink": "/r/jaska/x", "score": 9, "num_comments": 2, "created_utc": 1.0},
            {"title": "Politiikkaa", "selftext": "ei mainintaa", "permalink": "/r/jaska/y", "score": 1, "num_comments": 0, "created_utc": 2.0},
            {"title": "Slotti pyörii", "selftext": "kasino tänään", "permalink": "/r/Suomi/z", "score": 5, "num_comments": 1, "created_utc": 3.0},
        ]
        db = _StubDBLayer2()
        with patch("layer2_workers._fetch_subreddit_new", new=AsyncMock(return_value=sample)):
            result = _run(reddit_tick(db))
        assert result["mentions"] == 4  # 2 subs × 2 matched posts each
        assert len(db.social_signals.docs) == 1
        doc = db.social_signals.docs[0]
        assert doc["platform"] == "reddit"
        assert doc["mention_count"] == 4
        assert {"jaska", "Suomi"}.issubset(set(doc["subreddits"]))

    def test_rss_tick_parses_and_filters(self):
        xml = """<?xml version="1.0"?><rss><channel>
          <item><title>Veikkaus avaa uuden palvelun</title><link>https://x/1</link><pubDate>now</pubDate></item>
          <item><title>Sää muuttuu</title><link>https://x/2</link><pubDate>now</pubDate></item>
          <item><title>Rahapeli-laki uusiksi</title><link>https://x/3</link><pubDate>now</pubDate></item>
        </channel></rss>"""

        async def _fake_get(self, url, *a, **k):
            class R:
                text = xml
                status_code = 200
                def raise_for_status(self_): return None
            return R()

        db = _StubDBLayer2()
        import httpx, layer2_workers as lw
        with patch.object(httpx.AsyncClient, "get", new=_fake_get):
            result = _run(rss_tick(db))
        # New behaviour: each feed yields the same 2 matching items, but URL
        # dedup inside the tick collapses cross-source repeats to 2 unique
        # articles. Old non-dedup math (2 × feed_count) would be wrong now.
        feed_count = len(lw.RSS_FEEDS)
        assert feed_count >= 3, f"expected baseline feed count >=3, got {feed_count}"
        assert result["matched_count"] == 2, f"dedup expected 2, got {result['matched_count']}"
        assert db.news_signals.docs[0]["matched_count"] == 2

    def test_nhl_tick_phase1_all_games(self):
        games = [
            {"id": 101, "homeTeam": {"abbrev": "TBL", "placeName": {"default": "Tampa Bay"}},
             "awayTeam": {"abbrev": "FLA", "placeName": {"default": "Florida"}},
             "startTimeUTC": "2026-05-17T23:00:00Z", "gameState": "PRE", "venue": {"default": "Amalie"}},
        ]
        db = _StubDBLayer2()
        with patch("layer2_workers._fetch_nhl_schedule_today", new=AsyncMock(return_value=games)):
            result = _run(nhl_tick(db))
        assert result["games_active"] == 1
        doc = db.sports_signals.docs[0]
        assert doc["games_active"] == 1
        assert doc["scope"] == "all_games"
        assert doc["games"][0]["home"] == "TBL"


# ─────────── SSE + admin HTTP integration ───────────

class TestSSEEndpoint:
    def test_dial_stream_yields_event(self):
        # Pre-publish a snapshot so the initial bootstrap delivers immediately
        snap = {"composite_score": 50.0, "state_key": "KUUMA", "computed_at": "now"}
        _run(dial_sse.publish(snap))

        r = requests.get(f"{API}/dial/stream", stream=True, timeout=6)
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        # Read until we see a complete event (terminated by blank line)
        buf = b""
        for chunk in r.iter_content(chunk_size=128):
            buf += chunk
            if b"event: dial" in buf and b"\n\n" in buf.split(b"event: dial", 1)[1]:
                break
            if len(buf) > 8192:
                break
        r.close()
        assert b"event: dial" in buf
        text = buf.decode("utf-8", errors="ignore")
        # Find the first complete event block after "event: dial"
        block = text.split("event: dial", 1)[1].split("\n\n", 1)[0]
        data_line = next(line for line in block.split("\n") if line.startswith("data: "))
        json.loads(data_line[len("data: "):])

    def test_admin_layer2_status_shape(self):
        r = requests.get(f"{API}/admin/layer2/status", headers=HDR, timeout=8)
        assert r.status_code == 200
        d = r.json()
        assert "collections" in d
        for c in ("stream_signals", "social_signals", "sports_signals", "news_signals"):
            assert c in d["collections"]
            assert "doc_count" in d["collections"][c]
        assert "sse_subscribers" in d

    def test_admin_layer2_tick_recomputes_dial(self):
        r = requests.post(f"{API}/admin/layer2/tick?worker=nhl", headers=HDR, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "workers" in d and "nhl" in d["workers"]
        assert "dial" in d
        for k in ("composite_score", "state_key", "sub_scores", "primary_driver"):
            assert k in d["dial"]

    def test_admin_layer2_tick_unknown_worker_400(self):
        r = requests.post(f"{API}/admin/layer2/tick?worker=bogus", headers=HDR, timeout=5)
        assert r.status_code == 400

    def test_admin_layer2_status_requires_auth(self):
        r = requests.get(f"{API}/admin/layer2/status", timeout=5)
        assert r.status_code == 401
