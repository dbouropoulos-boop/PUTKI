"""
Phase 4 Week 3 (cont.) — validation gate · /api/content/stats · LegalDisclaimer
visibility · Activity-stats endpoint sanity.
"""
from __future__ import annotations

import os
import requests
import pytest
import content_generator as cg


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK}


class TestValidationGate:
    def test_missing_betting_angle_blocks_auto_publish(self):
        # Stub LLM omits betting_angle → validation fails → auto downgrades to draft
        from tests.test_phase4_w2_content_generator import _MemDB

        async def bad_llm(_sp, _up):
            return ('{"headline":"NHL recap","subhead":"sub",'
                    '"body":"<p>' + ("Body. " * 30) + '</p>",'
                    '"betting_angle":"",'  # <-- empty -> fails validation
                    '"facts_used":["x","y"],'
                    '"og_title":"a","og_description":"b","twitter_description":"c",'
                    '"og_image_url":null,"article_tags":["t"]}')

        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=bad_llm)
        from tests.test_phase4_w2_content_generator import _run
        r = _run(gen.generate_from_signal("nhl_recap", {
            "game_id": 700, "home": "FLA", "away": "TBL",
            "home_score": 4, "away_score": 2, "game_state": "OFF",
        }))
        assert r["status"] == "rate_limited_to_draft", f"expected downgrade, got {r['status']}"
        draft = db.content_drafts.docs[0]
        assert draft["status"] == "draft"
        # Validation report stored on the draft
        v = draft.get("validation", {})
        assert v.get("passed") is False
        assert any("betting_angle" in e for e in v.get("errors", []))

    def test_skip_reason_short_circuits(self):
        from tests.test_phase4_w2_content_generator import _MemDB, _run

        async def skip_llm(_sp, _up):
            return ('{"skip_reason":"No Finnish player impact",'
                    '"headline":null,"body":null,"betting_angle":"","facts_used":[]}')

        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=skip_llm)
        r = _run(gen.generate_from_signal("nhl_recap", {
            "game_id": 800, "home": "ANA", "away": "SJS",
            "home_score": 2, "away_score": 1, "game_state": "OFF",
        }))
        assert r["status"] == "skipped"
        assert r["skip_reason"] == "No Finnish player impact"
        # Nothing persisted
        assert len(db.content_drafts.docs) == 0

    def test_forbidden_phrase_blocks_auto(self):
        from tests.test_phase4_w2_content_generator import _MemDB, _run

        body = "<p>" + "Pelaajan vire on hyvä. " * 25 + "Lähteiden mukaan tilanne jatkuu.</p>"

        async def bad_llm(_sp, _up):
            return ('{"headline":"Hyvä otsikko","subhead":"sub",'
                    f'"body":"{body}",'
                    '"betting_angle":"Kerroinmuutos vaikuttaa playoff-veikkauksiin selvästi.",'
                    '"facts_used":["x","y"],'
                    '"og_title":"a","og_description":"b","twitter_description":"c",'
                    '"og_image_url":null,"article_tags":["t"]}')

        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=bad_llm)
        r = _run(gen.generate_from_signal("nhl_recap", {
            "game_id": 900, "home": "CHI", "away": "DET",
            "home_score": 3, "away_score": 0, "game_state": "OFF",
        }))
        assert r["status"] == "rate_limited_to_draft"
        v = db.content_drafts.docs[0]["validation"]
        assert any("forbidden_phrase" in e for e in v.get("errors", []))


class TestContentStatsEndpoint:
    def test_stats_endpoint_shape(self):
        r = requests.get(f"{API}/content/stats", timeout=8)
        assert r.status_code == 200
        d = r.json()
        for k in ("articles_today", "articles_this_week", "articles_total",
                  "last_published_at", "computed_at"):
            assert k in d
        # types
        assert isinstance(d["articles_today"], int)
        assert isinstance(d["articles_this_week"], int)
        assert isinstance(d["articles_total"], int)


class TestDefaultOGImage:
    def test_streamer_alert_gets_category_default_when_no_image(self):
        from tests.test_phase4_w2_content_generator import _MemDB, _run, _fake_llm
        db = _MemDB()
        gen = cg.ContentGenerator(db, llm_callable=_fake_llm)
        r = _run(gen.generate_from_signal("streamer_alert", {
            "user_login": "no_image_streamer", "user_name": "NoImage",
            "viewer_count": 100, "game_name": "X",
        }))
        assert r["status"] == "generated"
        pub = db.published_content.docs[0]
        # Fallback to category default OG SVG
        assert pub["social"]["og_image_url"] == "/og-defaults/striimaajat.svg"
        # Image present → twitter_card upgrades to summary_large_image
        assert pub["social"]["twitter_card"] == "summary_large_image"


class TestEditorialGuidelinesDirective:
    def test_directive_constants_present(self):
        # Both directives must be defined and contain the locked phrases
        assert "Bloomberg Crypto" in cg.EDITORIAL_GUIDELINES_DIRECTIVE
        assert "VEDONLYÖNTIKULMA" in cg.EDITORIAL_GUIDELINES_DIRECTIVE
        assert "peliongelmista" in cg.EDITORIAL_GUIDELINES_DIRECTIVE.lower()
        assert "alaikäisten" in cg.EDITORIAL_GUIDELINES_DIRECTIVE.lower()
        # And every LLM template embeds it
        for tid, t in cg.TEMPLATES.items():
            if not t["uses_llm"]:
                continue
            assert "Complex × GQ × Bloomberg Crypto" in t["system_prompt"], f"{tid} missing editorial directive"
