"""Iter32 — /voita listing restructure: active/paid split + editable voita_hero."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "putki-hq-admin"
ADMIN_HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}

HERO_KEYS = [
    "eyebrow_fi", "eyebrow_en", "title_fi", "title_en",
    "subtitle_fi", "subtitle_en", "image_url", "photo_credit",
]


# ── Raffles listing (active vs paid split) ──
class TestVoitaRaffles:
    def test_raffles_total_count_and_statuses(self):
        r = requests.get(f"{BASE_URL}/api/voita/raffles", timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 4, f"Expected 4 raffles, got {len(items)}"
        statuses = sorted([x["status"] for x in items])
        assert statuses == ["open", "open", "paid", "paid"], f"Got {statuses}"

    def test_active_raffles_seeded(self):
        r = requests.get(f"{BASE_URL}/api/voita/raffles", timeout=10)
        items = r.json()["items"]
        open_slugs = sorted([x["slug"] for x in items if x["status"] == "open"])
        assert "kups-hjk-veikkausliiga-final-2026" in open_slugs
        assert "tappara-karpat-liiga-final-2026" in open_slugs

    def test_paid_raffles_have_winners(self):
        r = requests.get(f"{BASE_URL}/api/voita/raffles", timeout=10)
        items = r.json()["items"]
        paid = [x for x in items if x["status"] == "paid"]
        assert len(paid) == 2
        for p in paid:
            assert p.get("result", {}).get("winners"), f"{p['slug']} missing winners"


# ── Settings: voita_hero ──
class TestVoitaHeroSettings:
    def test_public_settings_returns_voita_hero_with_all_8_fields(self):
        r = requests.get(f"{BASE_URL}/api/settings/public", timeout=10)
        assert r.status_code == 200
        hero = r.json().get("voita_hero")
        assert hero is not None, "voita_hero missing from /api/settings/public"
        for k in HERO_KEYS:
            assert k in hero, f"Missing hero field {k}"
            assert isinstance(hero[k], str)

    def test_admin_put_voita_hero_saves_and_rereads(self):
        # Snapshot current values for restore
        cur = requests.get(f"{BASE_URL}/api/admin/settings", headers=ADMIN_HEADERS, timeout=10).json()
        original_hero = cur.get("voita_hero") or {}

        new_hero = {
            "eyebrow_fi": "TEST EYEBROW FI",
            "eyebrow_en": "TEST EYEBROW EN",
            "title_fi": "TEST TITLE FI",
            "title_en": "TEST TITLE EN",
            "subtitle_fi": "TEST SUBTITLE FI",
            "subtitle_en": "TEST SUBTITLE EN",
            "image_url": "/hero/voita-test.jpg",
            "photo_credit": "Photo: Test Credit",
        }
        try:
            r = requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json={"voita_hero": new_hero},
                timeout=10,
            )
            assert r.status_code == 200
            saved = r.json().get("voita_hero")
            for k, v in new_hero.items():
                assert saved[k] == v, f"{k}: got {saved.get(k)}"

            # Re-read via public endpoint
            pub = requests.get(f"{BASE_URL}/api/settings/public", timeout=10).json()
            for k, v in new_hero.items():
                assert pub["voita_hero"][k] == v
        finally:
            # Restore
            requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json={"voita_hero": original_hero},
                timeout=10,
            )

    def test_partial_update_merges_with_defaults(self):
        cur = requests.get(f"{BASE_URL}/api/admin/settings", headers=ADMIN_HEADERS, timeout=10).json()
        original_hero = cur.get("voita_hero") or {}

        try:
            partial = {"title_fi": "PARTIAL ONLY FI"}
            r = requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json={"voita_hero": partial},
                timeout=10,
            )
            assert r.status_code == 200
            hero = r.json()["voita_hero"]
            assert hero["title_fi"] == "PARTIAL ONLY FI"
            # other fields fall back to defaults — must not be blank
            for k in HERO_KEYS:
                if k == "title_fi":
                    continue
                assert hero[k] and isinstance(hero[k], str) and len(hero[k]) > 0, f"{k} was blanked"
        finally:
            requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json={"voita_hero": original_hero},
                timeout=10,
            )

    def test_oversize_strings_clamped(self):
        cur = requests.get(f"{BASE_URL}/api/admin/settings", headers=ADMIN_HEADERS, timeout=10).json()
        original_hero = cur.get("voita_hero") or {}
        try:
            oversize = {
                "title_fi": "T" * 500,
                "title_en": "U" * 500,
                "subtitle_fi": "S" * 500,
                "subtitle_en": "Z" * 500,
                "eyebrow_fi": "E" * 500,
                "eyebrow_en": "Y" * 500,
            }
            r = requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json={"voita_hero": oversize},
                timeout=10,
            )
            assert r.status_code == 200
            hero = r.json()["voita_hero"]
            assert len(hero["title_fi"]) == 200
            assert len(hero["title_en"]) == 200
            assert len(hero["subtitle_fi"]) == 320
            assert len(hero["subtitle_en"]) == 320
            assert len(hero["eyebrow_fi"]) == 80
            assert len(hero["eyebrow_en"]) == 80
        finally:
            requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json={"voita_hero": original_hero},
                timeout=10,
            )

    def test_combined_hero_and_quiz_config_save(self):
        cur = requests.get(f"{BASE_URL}/api/admin/settings", headers=ADMIN_HEADERS, timeout=10).json()
        original_hero = cur.get("voita_hero") or {}
        original_quiz = cur.get("voita_quiz_config")
        # Use existing public quiz config so structure is valid
        pub = requests.get(f"{BASE_URL}/api/settings/public", timeout=10).json()
        quiz_cfg = pub.get("voita_quiz_config") or []
        try:
            payload = {
                "voita_hero": {"title_fi": "COMBINED FI", "title_en": "COMBINED EN"},
                "voita_quiz_config": quiz_cfg,
            }
            r = requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json=payload,
                timeout=10,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["voita_hero"]["title_fi"] == "COMBINED FI"
            assert body["voita_hero"]["title_en"] == "COMBINED EN"
            assert body.get("voita_quiz_config") is not None
            assert isinstance(body["voita_quiz_config"], list)
            assert len(body["voita_quiz_config"]) == len(quiz_cfg)
        finally:
            restore = {"voita_hero": original_hero}
            if original_quiz is not None:
                restore["voita_quiz_config"] = original_quiz
            requests.put(
                f"{BASE_URL}/api/admin/settings",
                headers=ADMIN_HEADERS,
                json=restore,
                timeout=10,
            )
