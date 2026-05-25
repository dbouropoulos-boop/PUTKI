"""
iter68 phase 1 — `routes/admin.py` extraction smoke tests.

Validates that the four admin copy endpoints (GET/PUT × mittari/mestari)
still respond correctly after being lifted from `server.py` into the
new `routes/admin.py` router module.

What we assert
──────────────
1. The endpoint URLs are unchanged (`/api/admin/{mittari,mestari}/copy`).
2. Without a token they 401 (auth gate intact).
3. With the admin token they return the editor envelope
   `{raw, merged, defaults, updated_at}` shape.
4. PUT round-trips: an admin can persist a tiny override and the next
   GET reflects it inside the `merged` tree.
"""
from __future__ import annotations

import os
import time

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


def _editor_envelope(r):
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("raw", "merged", "defaults", "updated_at"):
        assert key in body, f"missing {key} in editor envelope"
    return body


class TestMittariCopyExtraction:
    def test_get_requires_admin_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/mittari/copy", timeout=5)
        assert r.status_code == 401

    def test_get_returns_editor_envelope(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/mittari/copy", headers=HEADERS, timeout=5
        )
        body = _editor_envelope(r)
        # The merged tree should expose at least the hero block.
        assert "hero" in body["merged"]

    def test_put_round_trip(self):
        # Save a tiny override.
        new_lead = f"iter68-test-{int(time.time())}"
        put = requests.put(
            f"{BASE_URL}/api/admin/mittari/copy",
            json={"hero": {"fi": {"page_title_lead": new_lead}}},
            headers=HEADERS,
            timeout=5,
        )
        assert put.status_code == 200, put.text
        # GET must reflect the new value inside merged.
        get = requests.get(
            f"{BASE_URL}/api/admin/mittari/copy", headers=HEADERS, timeout=5
        )
        body = _editor_envelope(get)
        assert body["merged"]["hero"]["fi"]["page_title_lead"] == new_lead
        # Cleanup — reset by saving an empty override.
        requests.put(
            f"{BASE_URL}/api/admin/mittari/copy",
            json={},
            headers=HEADERS,
            timeout=5,
        )


class TestMestariCopyExtraction:
    def test_get_requires_admin_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/mestari/copy", timeout=5)
        assert r.status_code == 401

    def test_get_returns_editor_envelope(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/mestari/copy", headers=HEADERS, timeout=5
        )
        body = _editor_envelope(r)
        assert "hero" in body["merged"]


class TestStreamerMetaExtraction:
    """iter68 phase 2 — streamer-meta cluster lives in routes/admin.py."""

    def test_legacy_listing_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/streamer-meta", timeout=5)
        assert r.status_code == 401

    def test_legacy_listing_returns_items_array(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/streamer-meta", headers=HEADERS, timeout=5
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)

    def test_v2_listing_returns_status_aware_rows(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/streamer-meta/v2", headers=HEADERS, timeout=5
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)
        assert "rate_limit" in body
        # Rate-limit envelope from streamer_meta_drafter
        for key in ("remaining", "limit_per_hour", "window_seconds"):
            assert key in body["rate_limit"], f"missing {key} in rate_limit"

    def test_history_requires_admin(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/streamer-meta/history/twitch/some_login",
            timeout=5,
        )
        assert r.status_code == 401

    def test_history_returns_items_array(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/streamer-meta/history/twitch/some_login",
            headers=HEADERS,
            timeout=5,
        )
        # 200 with an empty list is the expected shape for a streamer
        # that has no publish history yet.
        assert r.status_code == 200, r.text
        assert "items" in r.json()


class TestSlotRegistryExtraction:
    """iter68 phase 3a — slot-registry cluster lives in routes/admin.py."""

    def test_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/slot-registry", timeout=5)
        assert r.status_code == 401

    def test_list_returns_items_array(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/slot-registry", headers=HEADERS, timeout=5
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)

    def test_seed_is_idempotent(self):
        # Seed twice — second call must not raise nor mutate.
        r1 = requests.post(
            f"{BASE_URL}/api/admin/slot-registry/seed",
            headers=HEADERS,
            timeout=10,
        )
        r2 = requests.post(
            f"{BASE_URL}/api/admin/slot-registry/seed",
            headers=HEADERS,
            timeout=10,
        )
        assert r1.status_code == 200, r1.text
        assert r2.status_code == 200, r2.text


class TestVoyagerRotationExtraction:
    """iter68 phase 3b — voyager rotation cluster lives in routes/admin.py."""

    def test_weeks_listing_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/voyager/weeks", timeout=5)
        assert r.status_code == 401

    def test_weeks_listing_envelope_shape(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/voyager/weeks", headers=HEADERS, timeout=5
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for key in ("weeks", "stats", "current_iso_week", "next_iso_weeks"):
            assert key in body, f"missing {key} in voyager weeks envelope"

    def test_rotation_endpoint_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/voyager/rotation", timeout=5)
        assert r.status_code == 401

    def test_rotation_endpoint_returns_editor_envelope(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/voyager/rotation", headers=HEADERS, timeout=5
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # voyager_rotation uses `sanitised` instead of `merged` because
        # the sanitiser does more than a deep-merge — it enforces game
        # template references + redirect-URL constraints.
        for key in ("raw", "sanitised", "defaults"):
            assert key in body, f"missing {key} in rotation envelope"
