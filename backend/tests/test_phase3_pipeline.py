"""Phase 3 — Batch 3A/3B/3C smoke tests.

Hits the new endpoints behind the admin token and verifies the signal
pipeline + dial recalc produce the expected shapes.
"""
import os
import requests

API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HDR = {"X-Admin-Token": TOK}


class TestPhase3SignalPipeline:
    def test_force_poll_returns_summary(self):
        r = requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "poll" in d and "snapshot" in d
        for k in ("polled_at", "total", "by_source", "errors"):
            assert k in d["poll"], f"missing {k}"
        for src in ("twitch", "kick", "youtube", "forum", "sports", "internal"):
            assert src in d["poll"]["by_source"]
        snap = d["snapshot"]
        for k in ("composite_score", "state", "sub_scores", "primary_driver"):
            assert k in snap, f"snapshot missing {k}"

    def test_admin_signals_listing(self):
        # Ensure something has been polled
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/admin/signals?limit=10", headers=HDR, timeout=8)
        assert r.status_code == 200
        d = r.json()
        assert "signals" in d
        assert "counts" in d
        for src in ("twitch", "kick", "youtube", "forum", "sports", "internal"):
            assert src in d["counts"]

    def test_admin_signals_filter(self):
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/admin/signals?source=twitch&limit=5", headers=HDR, timeout=8)
        assert r.status_code == 200
        for s in r.json()["signals"]:
            assert s["source"] == "twitch"

    def test_admin_dial_history(self):
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/admin/dial/history?limit=3", headers=HDR, timeout=8)
        assert r.status_code == 200
        d = r.json()
        assert "history" in d
        if d["history"]:
            row = d["history"][0]
            for k in ("computed_at", "composite_score", "state_key", "primary_driver"):
                assert k in row

    def test_dial_endpoint_uses_snapshot(self):
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/dial", timeout=8)
        assert r.status_code == 200
        d = r.json()
        assert "any_real" in d
        # composite_score should be present after at least one poll
        assert "composite_score" in d

    def test_cockpit_has_full_snapshot_shape(self):
        requests.post(f"{API}/admin/signals/poll", headers=HDR, timeout=15)
        r = requests.get(f"{API}/cockpit", timeout=8)
        assert r.status_code == 200
        d = r.json()
        assert "primary_driver" in d
        assert "primary_driver_label" in d
        assert "fi" in d["primary_driver_label"]
        assert "en" in d["primary_driver_label"]


class TestPhase3DistributionFanout:
    def test_approve_writes_distribution_results(self):
        # Generate a moment_commentary item (which fans out to site+archive+telegram)
        gen = requests.post(
            f"{API}/admin/queue/generate",
            headers={**HDR, "Content-Type": "application/json"},
            json={
                "content_type": "moment_commentary",
                "signal_payload": {"streamer_name": "TestStreamer", "game": "Sweet Bonanza", "amount": "€10 000", "event_type": "big_win"},
            },
            timeout=30,
        )
        assert gen.status_code == 200, gen.text
        item_id = gen.json()["id"]

        approve = requests.post(
            f"{API}/admin/queue/{item_id}/approve",
            headers={**HDR, "Content-Type": "application/json"},
            json={"selected_variant_index": 0},
            timeout=15,
        )
        assert approve.status_code == 200
        published = approve.json()["published"]
        results = published.get("distribution_results", [])
        channels = {r["channel"] for r in results}
        assert "site" in channels
        assert "telegram" in channels
        # telegram should be mocked since no token configured in test env
        tg = next(r for r in results if r["channel"] == "telegram")
        assert tg["status"] in ("mocked", "delivered", "skipped", "error")

    def test_distribution_log_persisted(self):
        gen = requests.post(
            f"{API}/admin/queue/generate",
            headers={**HDR, "Content-Type": "application/json"},
            json={
                "content_type": "moment_commentary",
                "signal_payload": {"streamer_name": "LogTest", "game": "Razor Returns", "amount": "€5 000", "event_type": "big_win"},
            },
            timeout=30,
        )
        item_id = gen.json()["id"]
        requests.post(
            f"{API}/admin/queue/{item_id}/approve",
            headers={**HDR, "Content-Type": "application/json"},
            json={"selected_variant_index": 0},
            timeout=15,
        )
        # The /admin/queue/{id} endpoint should now show distribution_results on the item
        item = requests.get(f"{API}/admin/queue/{item_id}", headers=HDR, timeout=8).json()
        assert "distribution_results" in item
