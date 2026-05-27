"""
iter76h - Operator's runbook served via admin API.
"""
from __future__ import annotations

import os

import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": ADMIN_TOKEN}


class TestRunbookEndpoint:
    def test_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/docs/runbook", timeout=5)
        assert r.status_code == 401

    def test_returns_markdown_envelope(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/docs/runbook", headers=HEADERS, timeout=5,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["path"].endswith("/OPS.md")
        assert body["bytes"] > 0
        md = body["markdown"]
        # Sanity-check the runbook has the headings we expect.
        assert "Operator's Runbook" in md
        assert "daily ritual" in md.lower()
        assert "Cookbook" in md
        assert "/back-office/bot-routing" in md
