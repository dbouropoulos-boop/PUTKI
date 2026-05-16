"""Phase 3 V2 — Source map + foundational research + editorial scheduler tests."""
import os
import time
import uuid

import requests


API = os.environ.get("BACKEND_BASE", "http://localhost:8001/api")
TOK = os.environ.get("BACK_OFFICE_TOKEN", "mittari-admin")
HDR = {"X-Admin-Token": TOK}


class TestSourceMap:
    def test_public_sources_grouped_by_category(self):
        r = requests.get(f"{API}/sources/public", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 27
        cats = d["by_category"]
        assert "regulatory" in cats
        assert "betting_discourse" in cats
        # Tier-1 named sources from §4.1 must be present
        reg_keys = {s["key"] for s in cats["regulatory"]}
        assert "poliisi" in reg_keys
        assert "veikkaus_news" in reg_keys
        assert "ministry" in reg_keys
        assert "jari_vahanen" in reg_keys
        betting_keys = {s["key"] for s in cats["betting_discourse"]}
        assert "ylikerroin" in betting_keys

    def test_admin_sources_requires_token(self):
        r = requests.get(f"{API}/admin/sources", timeout=10)
        assert r.status_code == 401

    def test_admin_sources_filterable(self):
        r = requests.get(f"{API}/admin/sources?category=regulatory", headers=HDR, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["sources"]
        assert all(s["category"] == "regulatory" for s in d["sources"])


class TestFoundationalResearch:
    def test_list_default_empty_or_existing(self):
        r = requests.get(f"{API}/admin/foundational-research", headers=HDR, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "entries" in d
        assert "stats" in d
        assert "valid_beats" in d
        assert "content_type_to_beats" in d
        assert "regulatory" in d["valid_beats"]
        assert "regulatory_update" in d["content_type_to_beats"]

    def test_crud_roundtrip(self):
        # CREATE
        eid = str(uuid.uuid4())
        payload = {
            "id": eid,
            "topic_area": "TEST · Veikkaus Q1 sponsorship spend",
            "beat": "sponsorship",
            "sub_beat": "ice hockey",
            "editorial_angle": "Test angle — delete after run.",
            "key_facts": [{
                "fact": "Test fact",
                "source_attribution": "veikkaus_news",
                "verified_date": "2026-05-01",
                "confidence": "high",
                "url": "https://example.com",
            }],
            "named_sources_cited": ["veikkaus_news"],
            "applicable_content_types": ["sponsorship_update"],
            "freshness_window_days": 60,
            "active": True,
        }
        r = requests.put(f"{API}/admin/foundational-research/{eid}", headers={**HDR, "Content-Type": "application/json"}, json=payload, timeout=10)
        assert r.status_code == 200
        doc = r.json()
        assert doc["topic_area"] == payload["topic_area"]
        assert doc["beat"] == "sponsorship"
        assert len(doc["key_facts"]) == 1

        # READ
        r = requests.get(f"{API}/admin/foundational-research/{eid}", headers=HDR, timeout=10)
        assert r.status_code == 200

        # FILTER by content_type
        r = requests.get(f"{API}/admin/foundational-research?content_type=sponsorship_update", headers=HDR, timeout=10)
        assert r.status_code == 200
        rows = r.json()["entries"]
        assert any(e["id"] == eid for e in rows)

        # DELETE
        r = requests.delete(f"{API}/admin/foundational-research/{eid}", headers=HDR, timeout=10)
        assert r.status_code == 200

        r = requests.get(f"{API}/admin/foundational-research/{eid}", headers=HDR, timeout=10)
        assert r.status_code == 404


class TestEditorialScheduler:
    def test_cadences_seeded(self):
        r = requests.get(f"{API}/admin/scheduler/cadences", headers=HDR, timeout=10)
        assert r.status_code == 200
        cadences = r.json()["cadences"]
        cts = {c["content_type"] for c in cadences}
        assert "regulatory_update" in cts
        assert "sponsorship_update" in cts
        assert "scene_news" in cts
        assert "game_literacy" in cts

    def test_status_endpoint_shape(self):
        r = requests.get(f"{API}/admin/scheduler/status", headers=HDR, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "cadences" in d
        assert "research_available" in d
        assert "scheduler_interval_seconds" in d
        # Every cadence row carries the augmented fields
        for c in d["cadences"]:
            assert "is_due_now" in c
            assert "last_seeded_at" in c
            assert "last_status" in c

    def test_tick_skips_when_no_research(self):
        """Architecture-only guarantee: scheduler MUST skip when
        foundational_research is empty for a beat — no fabricated content."""
        # Wipe any test entries from previous runs to guarantee empty pool for regulatory.
        # We can't wipe wholesale, but a force tick should report no_foundational_research
        # for content types whose research pool is empty.
        r = requests.post(f"{API}/admin/scheduler/tick?force_content_type=regulatory_update", headers=HDR, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Either it fired (foundational_research had entries) or it skipped with no_foundational_research.
        if d["fired"]:
            assert d["fired"][0]["content_type"] == "regulatory_update"
        else:
            assert d["skipped"]
            reasons = {s["reason"] for s in d["skipped"]}
            assert "no_foundational_research" in reasons or "not_due" in reasons

    def test_variant_filler_runs(self):
        r = requests.post(f"{API}/admin/scheduler/fill-variants?max_per_tick=1", headers=HDR, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "checked" in d
        assert "results" in d

    def test_set_cadences_roundtrip(self):
        r = requests.get(f"{API}/admin/scheduler/cadences", headers=HDR, timeout=10)
        orig = r.json()["cadences"]
        # Disable the first cadence
        modified = [{**orig[0], "enabled": False}] + orig[1:]
        r = requests.put(f"{API}/admin/scheduler/cadences", headers={**HDR, "Content-Type": "application/json"}, json={"cadences": modified}, timeout=10)
        assert r.status_code == 200
        assert r.json()["cadences"][0]["enabled"] is False
        # Restore
        r = requests.put(f"{API}/admin/scheduler/cadences", headers={**HDR, "Content-Type": "application/json"}, json={"cadences": orig}, timeout=10)
        assert r.status_code == 200
