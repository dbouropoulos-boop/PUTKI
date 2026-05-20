"""
Iter47 — Notify-winner + 24h funnel regression.
"""
from __future__ import annotations

import os

import httpx
import pytest

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
H = {"X-Admin-Token": os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")}


def _get(p):
    try: return httpx.get(f"{BASE}{p}", headers=H, timeout=10.0)
    except httpx.HTTPError: pytest.skip(p); return None


def _post(p, body=None):
    try: return httpx.post(f"{BASE}{p}", json=body or {}, headers=H, timeout=10.0)
    except httpx.HTTPError: pytest.skip(p); return None


# ── Funnel ───────────────────────────────────────────────────────────

def test_funnel_shape_default_24h():
    r = _get("/api/admin/leads/funnel")
    assert r.status_code == 200
    d = r.json()
    assert d["hours"] == 24
    assert d["buckets"] == 24
    assert set(d["order"]) == {"signups", "queued", "sent", "opened", "clicked", "returned"}
    for s in d["order"]:
        stage = d["stages"][s]
        assert isinstance(stage["count"], int)
        assert len(stage["spark"]) == d["buckets"]


def test_funnel_hours_clamped():
    """hours param is clamped to [1, 168]."""
    r1 = _get("/api/admin/leads/funnel?hours=999")
    r2 = _get("/api/admin/leads/funnel?hours=0")
    assert r1.json()["hours"] == 168
    assert r2.json()["hours"] == 1


def test_funnel_requires_admin():
    try:
        r = httpx.get(f"{BASE}/api/admin/leads/funnel", timeout=8.0)
    except httpx.HTTPError:
        pytest.skip(""); return
    assert r.status_code in (401, 403)


# ── Notify-winner ────────────────────────────────────────────────────

def test_notify_winner_404_on_unknown_raffle():
    r = _post("/api/admin/voita/raffles/NONEXISTENT/notify-winner")
    assert r.status_code == 404


def test_notify_winner_400_if_not_drawn():
    """Find an open raffle (not drawn) → notify must 400."""
    rl = _get("/api/admin/voita/raffles")
    if rl.status_code != 200:
        pytest.skip("no raffles endpoint")
    open_raffles = [r for r in rl.json().get("raffles", [])
                    if r.get("status") not in ("drawn", "paid")]
    if not open_raffles:
        pytest.skip("no open raffles to test against")
    rid = open_raffles[0]["id"]
    r = _post(f"/api/admin/voita/raffles/{rid}/notify-winner")
    assert r.status_code == 400
    assert r.json()["detail"] == "raffle_not_drawn"


def test_notify_winner_requires_admin():
    try:
        r = httpx.post(f"{BASE}/api/admin/voita/raffles/X/notify-winner", timeout=8.0)
    except httpx.HTTPError:
        pytest.skip(""); return
    assert r.status_code in (401, 403)
