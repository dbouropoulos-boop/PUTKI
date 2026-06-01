"""Public-URL regression for Mestari diagnostic suite (iter45).
Covers /api/mestari/diagnostic/{dx}/meta, /resolve, /api/mestari/diagnostic/lead,
plus regression for /api/track/o/<tok>.gif + /api/track/c/<tok>?u=.
"""
import base64
import os
import time

import pytest
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"


def test_meta_poker():
    r = requests.get(f"{BASE}/api/mestari/diagnostic/poker/meta", timeout=12)
    assert r.status_code == 200, r.text
    j = r.json()
    assert len(j["questions"]) == 5
    assert len(j["profiles"]) >= 4
    assert len(j["playbook"]) == 5
    vb = j["value_block"]
    for k in ("kicker_fi", "kicker_en", "body_fi", "body_en"):
        assert vb.get(k), f"missing {k} in value_block"
    assert "honest placement on the established model of poker style" in vb["body_en"].lower() \
        or "honest placement" in vb["body_en"].lower()


def test_meta_blackjack():
    r = requests.get(f"{BASE}/api/mestari/diagnostic/blackjack/meta", timeout=12)
    assert r.status_code == 200, r.text
    j = r.json()
    assert len(j["questions"]) == 5
    assert "against the known mathematics of blackjack" in j["value_block"]["body_en"].lower()


def test_meta_roulette_404():
    r = requests.get(f"{BASE}/api/mestari/diagnostic/roulette/meta", timeout=12)
    assert r.status_code == 404


def test_resolve_poker_strategist():
    payload = {"answers": [
        {"q": "p1_starting_hands", "opt": "tight"},
        {"q": "p2_marginal_facing_bet", "opt": "raise"},
        {"q": "p3_pot_action", "opt": "pressure"},
        {"q": "p4_position", "opt": "drives"},
        {"q": "p5_bluffing", "opt": "frequent"},
    ]}
    r = requests.post(f"{BASE}/api/mestari/diagnostic/poker/resolve", json=payload, timeout=12)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["profile"]["key"] == "strategist"
    assert "scores" in j and "playbook" in j and "value_block" in j


def test_resolve_blackjack_folk_rule():
    payload = {"answers": [
        {"q": "b1_16_vs_10", "opt": "stand"},
        {"q": "b2_insurance", "opt": "sometimes"},
        {"q": "b3_bet_size", "opt": "flat"},
        {"q": "b4_basic_strategy", "opt": "heard"},
        {"q": "b5_losing_streak", "opt": "careful"},
    ]}
    r = requests.post(f"{BASE}/api/mestari/diagnostic/blackjack/resolve", json=payload, timeout=12)
    assert r.status_code == 200, r.text
    assert r.json()["profile"]["key"] == "folk_rule"


def test_lead_idempotency_and_validation():
    email = "qa+regression@example.com"
    body = {
        "email": email,
        "diagnostic": "poker",
        "profile_key": "rock",
        "scores": {"selectivity": 2, "aggression": -1},
        "lang": "fi",
    }
    r1 = requests.post(f"{BASE}/api/mestari/diagnostic/lead", json=body, timeout=12)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1["ok"] is True
    assert j1["playbook_dispatch_ready"] is False

    # second submit idempotent
    r2 = requests.post(f"{BASE}/api/mestari/diagnostic/lead", json=body, timeout=12)
    assert r2.status_code == 200

    # invalid email
    bad = dict(body)
    bad["email"] = "not-an-email"
    rb = requests.post(f"{BASE}/api/mestari/diagnostic/lead", json=bad, timeout=12)
    assert rb.status_code in (400, 422), rb.text

    # invalid diagnostic
    bad2 = dict(body)
    bad2["diagnostic"] = "roulette"
    rb2 = requests.post(f"{BASE}/api/mestari/diagnostic/lead", json=bad2, timeout=12)
    assert rb2.status_code in (400, 422), rb2.text


def test_tracking_pixel_and_click():
    # pixel always returns 200 gif even with unknown token
    r = requests.get(f"{BASE}/api/track/o/anytoken.gif", timeout=12)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/gif")

    # click - supply allow-listed host (weezybet.fi)
    u = base64.urlsafe_b64encode(b"https://weezybet.com/promo").decode().rstrip("=")
    r2 = requests.get(f"{BASE}/api/track/c/sometok?u={u}", timeout=12, allow_redirects=False)
    assert r2.status_code in (302, 307), f"got {r2.status_code} {r2.text[:200]}"
