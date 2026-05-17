"""
Phase 4 Week 3 — preview endpoint + article surface tests.
"""
from __future__ import annotations

import os
import requests

API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK, "Content-Type": "application/json"}


class TestPreviewEndpoint:
    def test_preview_streamer_alert_returns_full_meta(self):
        r = requests.post(
            f"{API}/admin/content/preview",
            headers=HDR,
            json={
                "template_id": "streamer_alert",
                "signal_data": {
                    "user_login": "preview_dummy", "user_name": "Preview Dummy",
                    "viewer_count": 250, "game_name": "Gates of Olympus",
                },
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["template_id"] == "streamer_alert"
        assert d["tier"] == 1
        assert d["uses_llm"] is False
        pd = d["preview_draft"]
        for k in ("headline", "url_slug", "category", "social"):
            assert k in pd
        social = pd["social"]
        for f in ("og_title", "og_description", "og_image_url",
                  "twitter_card", "twitter_description", "article_tags"):
            assert f in social
        # Character limits enforced even on the preview path
        assert len(social["og_title"]) <= 60
        assert len(social["og_description"]) <= 155
        assert len(social["twitter_description"]) <= 200

    def test_preview_does_not_persist(self):
        # Capture current draft count
        before = requests.get(f"{API}/content/drafts?status=draft", headers=HDR, timeout=5).json()["count"]
        requests.post(
            f"{API}/admin/content/preview",
            headers=HDR,
            json={
                "template_id": "streamer_alert",
                "signal_data": {"user_login": "preview_no_persist", "viewer_count": 1},
            },
            timeout=15,
        )
        after = requests.get(f"{API}/content/drafts?status=draft", headers=HDR, timeout=5).json()["count"]
        assert before == after, "preview must not persist into content_drafts"

    def test_preview_unknown_template_400(self):
        r = requests.post(
            f"{API}/admin/content/preview",
            headers=HDR,
            json={"template_id": "no_such", "signal_data": {}},
            timeout=5,
        )
        assert r.status_code == 400

    def test_preview_requires_auth(self):
        r = requests.post(
            f"{API}/admin/content/preview",
            json={"template_id": "streamer_alert", "signal_data": {}},
            timeout=5,
        )
        assert r.status_code == 401
