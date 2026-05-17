"""
Mittari Phase 3 Batch 3A V2 — content-type registry + new V2 content types end-to-end.

Covers:
- GET /api/admin/content-types returns 19 types incl 13 new V2 types
- GET /api/admin/guidelines exposes 20 rows with new V2 prompt keys
- putki_hq_voice_system_prompt references Complex/GQ/Bloomberg
- End-to-end generate→approve→publish for cultural_feature (surface=kulttuuri)
- End-to-end generate→approve→publish for lifestyle_gambler_profile (surface=profiilit, full fanout)
- End-to-end generate→approve→publish for money_commentary (surface=raha)
- End-to-end generate→approve→publish for game_literacy (surface=pelit)
"""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
ADMIN_HEADERS = {"X-Admin-Token": "putki-hq-admin", "Content-Type": "application/json"}

EXPECTED_19 = {
    "moment_commentary", "sports_take", "streamer_observation",
    "operator_update", "activity_feed_event", "dial_state_change",
    "cultural_feature", "lifestyle_gambler_profile", "scene_news",
    "industry_business_analysis", "money_commentary", "game_literacy",
    "bonus_mathematics", "sponsorship_update", "regulatory_update",
    "tracked_x_post", "x_trend_annotation", "editor_x_pull",
    "international_research_synthesis",
}

V2_NEW_PROMPT_KEYS = [
    "cultural_feature_prompt", "lifestyle_gambler_profile_prompt",
    "scene_news_prompt", "industry_business_analysis_prompt",
    "money_commentary_prompt", "game_literacy_prompt",
    "bonus_mathematics_prompt", "sponsorship_update_prompt",
    "regulatory_update_prompt", "tracked_x_post_prompt",
    "x_trend_annotation_prompt", "editor_x_pull_prompt",
    "international_research_synthesis_prompt",
]


# ─── Registry tests ──────────────────────────────────────────────────────────
class TestContentTypeRegistry:
    def test_content_types_returns_19(self):
        r = requests.get(f"{BASE_URL}/api/admin/content-types", headers=ADMIN_HEADERS, timeout=30)
        assert r.status_code == 200
        body = r.json()
        types = body.get("content_types") or body
        # Could be dict-of-key→meta or list-of-dicts
        if isinstance(types, dict):
            keys = set(types.keys())
        else:
            keys = {t.get("key") or t.get("name") or t.get("type") for t in types}
        assert keys == EXPECTED_19, f"missing={EXPECTED_19 - keys}, extra={keys - EXPECTED_19}"

    def test_content_types_have_target_surface(self):
        r = requests.get(f"{BASE_URL}/api/admin/content-types", headers=ADMIN_HEADERS, timeout=30)
        types = r.json().get("content_types") or r.json()
        # spot check surfaces critical for routing
        expected_surfaces = {
            "cultural_feature": "kulttuuri",
            "lifestyle_gambler_profile": "profiilit",
            "money_commentary": "raha",
            "game_literacy": "pelit",
            "scene_news": "skene",
            "industry_business_analysis": "skene_talous",
            "bonus_mathematics": "bonusmatematiikka",
            "sponsorship_update": "sponsoroinnit",
            "regulatory_update": "saantely",
        }
        if isinstance(types, dict):
            for k, surf in expected_surfaces.items():
                assert types[k].get("target_surface") == surf, f"{k} surface mismatch"


# ─── Guidelines tests ────────────────────────────────────────────────────────
class TestGuidelines:
    def test_guidelines_has_20_rows(self):
        r = requests.get(f"{BASE_URL}/api/admin/guidelines", headers=ADMIN_HEADERS, timeout=30)
        assert r.status_code == 200
        body = r.json()
        rows = body.get("guidelines") or body
        assert isinstance(rows, list)
        keys = {row.get("key") for row in rows}
        assert "putki_hq_voice_system_prompt" in keys
        for prompt_key in V2_NEW_PROMPT_KEYS:
            assert prompt_key in keys, f"missing guideline {prompt_key}"
        assert len(keys) >= 20, f"expected >=20 guideline rows got {len(keys)}"

    def test_system_prompt_references_v2_register(self):
        r = requests.get(f"{BASE_URL}/api/admin/guidelines", headers=ADMIN_HEADERS, timeout=30)
        rows = r.json().get("guidelines") or r.json()
        sys_row = next(r for r in rows if r.get("key") == "putki_hq_voice_system_prompt")
        text = (sys_row.get("text") or "").lower()
        # V2 voice register markers — Complex/GQ/Bloomberg-Crypto explicitly named
        assert "complex" in text and "gq" in text and "bloomberg" in text
        # V2 editorial instruction blocks (lifestyle profile + game literacy rules)
        assert "elintapaprofiili" in text or "lifestyle" in text, "missing lifestyle/profiili rules block"
        assert "pelilukutaito" in text, "missing pelilukutaito (game-literacy) rules block"


# ─── End-to-end pipeline helpers ─────────────────────────────────────────────
def _generate(content_type: str, signal_payload: dict, timeout: int = 90):
    body = {"content_type": content_type, "signal_payload": signal_payload}
    return requests.post(
        f"{BASE_URL}/api/admin/queue/generate",
        json=body, headers=ADMIN_HEADERS, timeout=timeout,
    )


def _approve(queue_id: str, variant_index: int = 0):
    return requests.post(
        f"{BASE_URL}/api/admin/queue/{queue_id}/approve",
        json={"selected_variant_index": variant_index},
        headers=ADMIN_HEADERS, timeout=30,
    )


def _published(surface: str, limit: int = 24):
    return requests.get(f"{BASE_URL}/api/published?surface={surface}&limit={limit}", timeout=30)


# ─── End-to-end content tests ────────────────────────────────────────────────
class TestEndToEndV2ContentTypes:
    """Real Claude generation. Each test: generate → assert variant text → approve → assert published_at surface."""

    def _run_e2e(self, content_type: str, payload: dict, expected_surface: str,
                 expect_distribution_channels: list = None):
        # 1. Generate
        gen = _generate(content_type, payload)
        if gen.status_code == 502:
            pytest.skip(f"upstream LLM gateway 502 (transient) for {content_type}")
        assert gen.status_code == 200, f"generate failed {gen.status_code} {gen.text[:300]}"
        gen_body = gen.json()
        # Doc shape: id, generated_variants[]
        doc = gen_body.get("item") or gen_body
        variants = doc.get("generated_variants") or doc.get("variants")
        assert variants and len(variants) >= 1
        assert isinstance(variants[0].get("text"), str) and len(variants[0]["text"].strip()) > 20, \
            f"variant text empty/short: {variants[0]}"
        queue_id = doc.get("id") or doc.get("_id")
        assert queue_id

        # 2. Approve
        appr = _approve(queue_id)
        assert appr.status_code == 200, f"approve failed {appr.status_code} {appr.text[:300]}"
        appr_body = appr.json()

        # 3. Validate distribution channels (mocked status acceptable)
        if expect_distribution_channels:
            dist = (appr_body.get("item") or appr_body).get("distribution_results") or {}
            # Distribution may be dict of channel→status or list — accept either
            if isinstance(dist, dict):
                got = set(dist.keys())
            else:
                got = {d.get("channel") for d in dist}
            for ch in expect_distribution_channels:
                assert ch in got, f"channel {ch} missing from distribution_results (got {got})"

        # 4. Verify it landed on expected surface (give it a moment to commit)
        time.sleep(1)
        pub = _published(expected_surface, limit=24)
        assert pub.status_code == 200, f"/api/published failed {pub.status_code}"
        items = pub.json().get("items") or []
        ids = [it.get("id") or it.get("queue_id") or it.get("source_queue_id") for it in items]
        # ID may be remapped on publish — fall back to text match
        if queue_id not in ids:
            texts = [it.get("text", "")[:60] for it in items]
            assert any(variants[0]["text"][:40] in (it.get("text") or "") for it in items), \
                f"approved content not found on surface={expected_surface}; ids={ids}; text-heads={texts}"
        return queue_id

    def test_cultural_feature_e2e(self):
        self._run_e2e(
            "cultural_feature",
            {
                "topic": "TEST_Suomalaisen jääkiekkokulttuurin ja vedonlyönnin risteyskohta",
                "angle": "Tappara-fani ekonomian näkökulmasta",
                "research_notes": "Liiga-katsojaluvut 2024-25, vedonlyöntimarkkinan koko Suomessa.",
            },
            expected_surface="kulttuuri",
        )

    def test_lifestyle_gambler_profile_e2e_with_full_fanout(self):
        self._run_e2e(
            "lifestyle_gambler_profile",
            {
                "subject_name": "TEST_Profile Subject",
                "background": "Suomalainen lifestyle-pelaaja 2020-2025 kaaressa.",
                "business_structure": "Stake-sponsorointi + omat brändit + Youtube.",
                "cultural_significance": "Symboloi 2020-luvun rahapelikulttuurin valtavirtaistumista.",
                "source_notes": "Twitch/YouTube julkiset luvut; ei sisäpiiritietoja.",
            },
            expected_surface="profiilit",
            expect_distribution_channels=["site", "archive", "telegram", "x_twitter", "shareable_card", "email"],
        )

    def test_money_commentary_e2e(self):
        self._run_e2e(
            "money_commentary",
            {
                "topic": "TEST_Suomalaisen 30-vuotiaan miehen mediaanitulot vs varallisuuden rakentaminen",
                "angle": "Skeptinen krypto-spekulaatiota kohtaan",
            },
            expected_surface="raha",
        )

    def test_game_literacy_e2e(self):
        self._run_e2e(
            "game_literacy",
            {
                "topic": "TEST_Blackjack basic strategy",
                "focus_area": "House edge minimointi optimaalisstrategialla",
            },
            expected_surface="pelit",
        )
