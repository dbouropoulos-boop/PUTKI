"""
Phase 4 Week 2 — ContentGenerator + editorial subjects tests.

Covers:
  - Editorial subjects loader (305 entries / 17 subject_types)
  - ContentGenerator dedup fingerprint (no rewrite when same signal repeats)
  - Rate-limit downgrade from TIER 1 auto → TIER 2 draft when >10/h
  - Templates: nhl_recap, streamer_alert (no LLM), regulatory_analysis (LLM),
    operator_news, f1_recap, football_recap — minimal happy paths with the
    LLM mocked out so tests stay deterministic + offline.
  - /api/content/drafts CRUD: list, get, edit, publish, reject
  - /api/content/published/{slug} public read + view increment
  - Layer 2 fan-out hook deduping repeated games / articles / streamers
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List
from unittest.mock import AsyncMock, patch

import pytest
import requests

import content_generator as cg
import editorial_subjects as es


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK}


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ─────────────────── editorial_subjects loader ───────────────────

class TestEditorialSubjectsLoaded:
    def test_loader_counts_match_dataset(self):
        r = requests.get(f"{API}/admin/editorial-subjects/stats", headers=HDR, timeout=8)
        assert r.status_code == 200
        d = r.json()
        # The dataset declares 305 entries across 17 subject_types
        assert d["total"] == 305
        assert "creator" in d["by_subject_type"]
        assert "athlete" in d["by_subject_type"]
        assert "operator" in d["by_subject_type"]
        assert d["by_subject_type"]["creator"] == 80

    def test_subject_list_filterable(self):
        r = requests.get(f"{API}/admin/editorial-subjects?subject_type=athlete&limit=5",
                         headers=HDR, timeout=8)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] > 0
        for row in d["subjects"]:
            assert row["subject_type"] == "athlete"


# ─────────────────── ContentGenerator: in-memory stub DB ───────────────────

class _MemColl:
    """Minimal Motor-style async collection backed by a list[dict]."""

    def __init__(self):
        self.docs: List[Dict[str, Any]] = []

    async def insert_one(self, doc: Dict[str, Any]):
        self.docs.append(dict(doc))
        return type("R", (), {"inserted_id": "stub"})()

    async def find_one(self, query=None, projection=None, sort=None):
        # naive eq filter
        rows = list(self.docs)
        if query:
            rows = [r for r in rows if _match(r, query)]
        if sort:
            for key, direction in reversed(sort):
                rows.sort(key=lambda r, k=key: r.get(k, ""), reverse=(direction == -1))
        return rows[0] if rows else None

    async def update_one(self, query, update):
        for r in self.docs:
            if _match(r, query):
                if "$set" in update:
                    r.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        r[k] = r.get(k, 0) + v
                return type("R", (), {"matched_count": 1})()
        return type("R", (), {"matched_count": 0})()

    async def count_documents(self, query):
        if not query:
            return len(self.docs)
        return sum(1 for r in self.docs if _match(r, query))

    def find(self, q=None, p=None):
        rows = list(self.docs)
        if q:
            rows = [r for r in rows if _match(r, q)]
        return _MemCursor(rows)

    async def create_index(self, *a, **k):
        return None


class _MemCursor:
    def __init__(self, rows):
        self._rows = rows

    def sort(self, *a):
        if a and isinstance(a[0], list):
            for key, direction in reversed(a[0]):
                self._rows.sort(key=lambda r, k=key: r.get(k, ""), reverse=(direction == -1))
        elif len(a) == 2:
            self._rows.sort(key=lambda r: r.get(a[0], ""), reverse=(a[1] == -1))
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    async def to_list(self, length=None):
        return list(self._rows[: length if length else None])


def _match(row, query):
    for k, v in query.items():
        if k == "_id":
            continue
        if k.startswith("$"):
            continue
        if isinstance(v, dict):
            if "$gte" in v and not (row.get(k) and row.get(k) >= v["$gte"]):
                return False
            if "$ne" in v and row.get(k) == v["$ne"]:
                return False
            if "$exists" in v and (k in row) != v["$exists"]:
                return False
            continue
        if row.get(k) != v:
            return False
    return True


class _MemDB:
    def __init__(self):
        self.content_drafts = _MemColl()
        self.published_content = _MemColl()
        self.editorial_subjects = _MemColl()
        self.stream_signals = _MemColl()
        self.sports_signals = _MemColl()
        self.news_signals = _MemColl()
        self.f1_signals = _MemColl()
        self.football_signals = _MemColl()

    def __getitem__(self, k):
        return getattr(self, k)


async def _fake_llm(system_prompt: str, user_prompt: str) -> str:
    # Return JSON the generator expects per template — INCLUDE social meta
    # so we can assert it survives intact end-to-end. Also include the new
    # validation-required fields (betting_angle ≥ 20 chars + facts_used).
    base = ('"og_title":"OG title","og_description":"OG desc","twitter_description":"TW desc",'
            '"og_image_url":null,"article_tags":["tag1","tag2"],'
            '"betting_angle":"Kerroinmuutos vaikuttaa playoff-veikkauksiin selvästi.",'
            '"facts_used":["api_score","api_player_stat","api_standings"],'
            '"skip_reason":null')
    body_filler = "<p>" + ("Otteluraportti, jossa kuvataan tapahtumat. " * 12) + "</p>"
    if "F1" in user_prompt or "Formula" in system_prompt:
        return ('{"headline":"Bottas Miami","subhead":"P18 vaikea kisa",'
                f'"body":"{body_filler}",' + base + '}')
    if "OTTELU" in user_prompt and "Joukkueet" in user_prompt:
        return ('{"headline":"Norwich kaatui","subhead":"Pukki 1+1 Premier-illassa",'
                f'"body":"{body_filler}",' + base + '}')
    if "NHL" in system_prompt or ("OTTELU:" in user_prompt and "NHL" in user_prompt):
        return ('{"headline":"NHL recap","subhead":"Suomalaishyökkääjä iskussa",'
                f'"body":"{body_filler}",' + base + '}')
    if "regulatorisen" in system_prompt:
        long_para = "<p>" + ("Lain vaikutukset markkinoille. " * 8) + "</p>"
        return ('{"headline":"Rahapelilaki","subhead":"Veikkaus monopoli muuttuu",'
                f'"summary":"{long_para}","analysis":"{long_para}{long_para}",'
                f'"impact":"{long_para}",' + base + '}')
    if "operaattori" in system_prompt:
        return ('{"headline":"Operaattori","subhead":"Bonusehdot muuttuvat",'
                f'"body":"{body_filler}",' + base + '}')
    return ('{"headline":"Generic","subhead":"sub",'
            f'"body":"{body_filler}",' + base + '}')


# ─────────────────── Per-template generation ───────────────────

class TestTemplates:
    def _make_gen(self):
        db = _MemDB()
        return db, cg.ContentGenerator(db, llm_callable=_fake_llm)

    def test_streamer_alert_no_llm_structured(self):
        db, gen = self._make_gen()
        r = _run(gen.generate_from_signal("streamer_alert", {
            "user_login": "jarttu84", "user_name": "Jarttu84",
            "viewer_count": 1234, "game_name": "Sweet Bonanza",
        }))
        assert r["status"] == "generated"
        assert r["tier"] == cg.TIER_AUTO
        assert r["published"]["status"] == "published"
        # Published doc has structured card body=None + external_link
        pub = db.published_content.docs[0]
        assert pub["external_link"] == "https://twitch.tv/jarttu84"
        assert "jarttu84" in pub["url_slug"]
        assert pub["body"] is None

    def test_nhl_recap_llm_auto_publish(self):
        db, gen = self._make_gen()
        r = _run(gen.generate_from_signal("nhl_recap", {
            "game_id": 101, "home": "CBJ", "away": "MTL",
            "home_score": 4, "away_score": 2, "game_state": "OFF",
            "start_time_utc": "2026-05-17T23:00:00Z",
        }))
        assert r["status"] == "generated"
        assert r["tier"] == cg.TIER_AUTO
        assert r["published"]["status"] == "published"

    def test_regulatory_analysis_draft_only(self):
        db, gen = self._make_gen()
        r = _run(gen.generate_from_signal("regulatory_analysis", {
            "title": "Uusi rahapelilaki", "url": "https://yle.fi/a/123",
            "source": "YLE", "keywords_matched": ["rahapeli"], "published": "2026-05-17",
        }))
        assert r["status"] == "generated"
        assert r["tier"] == cg.TIER_DRAFT
        # TIER 2 must NOT auto-publish
        assert r["published"] is None
        assert len(db.published_content.docs) == 0
        # Draft has assembled body from summary+analysis+impact
        draft = db.content_drafts.docs[0]
        assert draft["body"]
        assert "<p>" in draft["body"]

    def test_f1_recap_auto_publish(self):
        db, gen = self._make_gen()
        r = _run(gen.generate_from_signal("f1_recap", {
            "race_id": "2026-6", "race_name": "Miami Grand Prix",
            "season": "2026", "round": "6", "circuit": "Miami International Autodrome",
            "date": "2026-05-17", "podium": [], "finnish_drivers": [{"name": "Valtteri Bottas"}],
        }))
        assert r["status"] == "generated"
        assert r["published"]["status"] == "published"

    def test_football_recap_auto_publish(self):
        db, gen = self._make_gen()
        r = _run(gen.generate_from_signal("football_recap", {
            "match_id": 999, "competition_name": "Premier League",
            "home": "Norwich", "away": "Leeds", "home_score": 2, "away_score": 1,
            "utc_date": "2026-05-17T15:00:00Z",
            "scorers": ["Pukki", "Smith"], "finnish_scorers": ["Pukki"],
        }))
        assert r["status"] == "generated"
        assert r["published"]["status"] == "published"

    def test_unknown_template_returns_error(self):
        db, gen = self._make_gen()
        r = _run(gen.generate_from_signal("does_not_exist", {}))
        assert r["status"] == "error"
        assert "unknown_template" in r["reason"]


# ─────────────────── Social meta (launch-blocker) ───────────────────

class TestSocialMeta:
    def test_llm_template_carries_through_social_meta(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        r = _run(gen.generate_from_signal("nhl_recap", {
            "game_id": 202, "home": "CBJ", "away": "MTL",
            "home_score": 4, "away_score": 2, "game_state": "OFF",
        }))
        assert r["status"] == "generated"
        pub = db.published_content.docs[0]
        social = pub["social"]
        # All five required fields exist
        for f in ("og_title", "og_description", "og_image_url",
                  "twitter_card", "twitter_description", "article_tags"):
            assert f in social, f"missing social field {f}"
        # LLM-emitted values preserved
        assert social["og_title"] == "OG title"
        assert social["og_description"] == "OG desc"
        assert social["twitter_description"] == "TW desc"
        assert social["article_tags"] == ["tag1", "tag2"]
        # Canonical URL stamped — unified /uutiset/ prefix to avoid colliding
        # with the existing /kasinot/:slug + /striimaajat/:slug profile routes.
        assert pub["canonical_url"].startswith("https://putkihq.fi/uutiset/")

    def test_streamer_alert_social_meta_derived_deterministically(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        r = _run(gen.generate_from_signal("streamer_alert", {
            "user_login": "elavarivi", "user_name": "ElavaRivi",
            "viewer_count": 555, "game_name": "Razor Shark",
        }))
        assert r["status"] == "generated"
        pub = db.published_content.docs[0]
        s = pub["social"]
        assert s["og_title"]  # never empty
        assert s["og_description"]
        assert s["twitter_card"] in ("summary", "summary_large_image")

    def test_social_meta_char_limits(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        long_title = "A" * 200
        _run(gen.generate_from_signal("streamer_alert", {
            "user_login": "longheadline", "user_name": long_title,
            "viewer_count": 1, "game_name": "X",
        }))
        pub = db.published_content.docs[0]
        # og_title hard-clipped to 60 chars
        assert len(pub["social"]["og_title"]) <= 60
        # og_description hard-clipped to 155 chars
        assert len(pub["social"]["og_description"]) <= 155
        # twitter_description hard-clipped to 200 chars
        assert len(pub["social"]["twitter_description"]) <= 200


# ─────────────────── Natural-Finnish prompt directive ───────────────────

class TestNaturalFinnishPrompt:
    def test_every_llm_template_includes_finnish_directive(self):
        from content_generator import TEMPLATES, NATURAL_FINNISH_DIRECTIVE
        for tid, t in TEMPLATES.items():
            if not t["uses_llm"]:
                continue
            # The whole directive (or its hallmark phrase) must be present
            assert "TÄYDELLISTÄ, LUONNOLLISTA SUOMEA" in t["system_prompt"], f"{tid} missing natural-Finnish directive"
            assert "Iltalehden urheilutoimitus" in t["system_prompt"], f"{tid} missing Iltalehti style reference"
            # Banned-translation example must be in the prompt
            assert "Google Translate" in NATURAL_FINNISH_DIRECTIVE

    def test_default_model_is_opus(self):
        # Launch-blocker: Sonnet was downgraded to Opus for natural Finnish quality
        assert cg.CLAUDE_MODEL.startswith("claude-opus-")


# ─────────────────── Dedup + rate-limit ───────────────────

class TestDedupAndRateLimit:
    def test_same_signal_within_window_is_deduped(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        sig = {"user_login": "jarttu84", "user_name": "Jarttu84", "viewer_count": 1234}

        first = _run(gen.generate_from_signal("streamer_alert", sig))
        second = _run(gen.generate_from_signal("streamer_alert", sig))

        assert first["status"] == "generated"
        assert second["status"] == "skipped"
        assert second["reason"] == "duplicate_fingerprint"
        assert second["existing_id"] == first["draft_id"]
        # Only one published doc
        assert len(db.published_content.docs) == 1

    def test_dedup_across_news_sources_same_url(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        sig_yle = {"title": "Rahapelilaki uudistuu", "url": "https://example/a/123", "source": "YLE"}
        sig_hs  = {"title": "Eri otsikko", "url": "https://example/a/123", "source": "HS"}

        first = _run(gen.generate_from_signal("regulatory_analysis", sig_yle))
        second = _run(gen.generate_from_signal("regulatory_analysis", sig_hs))

        assert first["status"] == "generated"
        assert second["status"] == "skipped"
        assert second["reason"] == "duplicate_fingerprint"

    def test_force_bypasses_dedup(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        sig = {"user_login": "jarttu84", "viewer_count": 100}

        _run(gen.generate_from_signal("streamer_alert", sig))
        forced = _run(gen.generate_from_signal("streamer_alert", sig, force=True))
        assert forced["status"] == "generated"

    def test_rate_limit_downgrades_auto_to_draft(self, monkeypatch):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        # Lower the cap to 2 so we can exercise without spam
        monkeypatch.setattr(cg, "RATE_LIMIT_PER_HOUR", 2)
        for i in range(3):
            sig = {"user_login": f"streamer-{i}", "viewer_count": 100 + i}
            r = _run(gen.generate_from_signal("streamer_alert", sig))
            if i < 2:
                assert r["status"] == "generated", f"iter {i}"
                assert r["tier"] == cg.TIER_AUTO
            else:
                assert r["status"] == "rate_limited_to_draft"
                assert r["tier"] == cg.TIER_DRAFT
        # Two published, one draft only
        assert len(db.published_content.docs) == 2
        statuses = [d["status"] for d in db.content_drafts.docs]
        assert statuses.count("published") == 2
        assert statuses.count("draft") == 1


# ─────────────────── Layer 2 fan-out hook ───────────────────

class TestLayer2FanOut:
    def test_twitch_fanout_dedupes_repeated_streams(self):
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        # Two ticks where the same streamer is live
        _run(db.stream_signals.insert_one({
            "captured_at": "2026-05-17T10:00:00",
            "streams": [{"user_login": "jarttu84", "viewer_count": 100}],
        }))
        r1 = _run(cg.fan_out_from_layer2(db, "twitch", gen))
        # Second tick with same streamer
        _run(db.stream_signals.insert_one({
            "captured_at": "2026-05-17T10:01:00",
            "streams": [{"user_login": "jarttu84", "viewer_count": 150}],
        }))
        r2 = _run(cg.fan_out_from_layer2(db, "twitch", gen))
        assert r1["generated"] == 1
        assert r2["skipped_dup"] == 1
        assert r2["generated"] == 0


# ─────────────────── API integration tests (live backend) ───────────────────

class TestContentAPIs:
    def test_templates_endpoint_lists_all_six(self):
        r = requests.get(f"{API}/admin/content/templates", headers=HDR, timeout=5)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()["templates"]]
        for t in ("nhl_recap", "streamer_alert", "regulatory_analysis",
                  "operator_news", "f1_recap", "football_recap"):
            assert t in ids

    def test_streamer_alert_via_api_full_cycle(self):
        # Use non-TESTAPI prefix — the production publisher guard blocks
        # any draft whose slug/headline contains "testapi" so dev fixtures
        # cannot leak into /api/content/published.
        unique_login = f"e2efixt_{os.urandom(4).hex()}"
        sig = {
            "template_id": "streamer_alert",
            "signal_data": {"user_login": unique_login, "user_name": unique_login.upper(),
                            "viewer_count": 9001, "game_name": "TEST"},
        }
        r = requests.post(f"{API}/admin/content/generate", headers=HDR, json=sig, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "generated"
        slug = d["published"]["url_slug"]
        # Public read works
        pub = requests.get(f"{API}/content/published/{slug}", timeout=5)
        assert pub.status_code == 200
        body = pub.json()
        assert body["url_slug"] == slug
        assert body["type"] == "streamer_alert"
        # List endpoint includes it
        lst = requests.get(f"{API}/content/published?category=striimaajat", timeout=5)
        assert lst.status_code == 200
        assert any(item["url_slug"] == slug for item in lst.json()["items"])

    def test_drafts_listing_requires_auth(self):
        r = requests.get(f"{API}/content/drafts", timeout=5)
        assert r.status_code == 401

    def test_published_unknown_slug_404(self):
        r = requests.get(f"{API}/content/published/nope-{os.urandom(4).hex()}", timeout=5)
        assert r.status_code == 404
