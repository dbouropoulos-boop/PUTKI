"""Iter13: Kick live wiring + dry-run/confirm flow endpoints."""
import os
import requests

from _test_env import admin_token, backend_url

BASE_URL = backend_url()
TOKEN = admin_token()
HEAD = {"X-Admin-Token": TOKEN}


# ---- /api/webhooks/status ----
def test_status_kick_configured_true():
    r = requests.get(f"{BASE_URL}/api/webhooks/status", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("kick_configured") is True, j


# ---- /api/webhooks/kick/verify ----
def test_kick_verify_unauth():
    r = requests.get(f"{BASE_URL}/api/webhooks/kick/verify", timeout=15)
    assert r.status_code == 401


def test_kick_verify_ok():
    r = requests.get(f"{BASE_URL}/api/webhooks/kick/verify", headers=HEAD, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    assert isinstance(j.get("oauth_token_length"), int) and j["oauth_token_length"] > 0
    assert j.get("public_key_reachable") is True
    assert j.get("callback_url") == "https://putkihq.fi/api/webhooks/kick"
    subs = j.get("subscriptions")
    assert isinstance(subs, dict)
    assert "total" in subs and "by_event" in subs


# ---- /api/webhooks/kick/subscriptions ----
def test_kick_subscriptions_unauth():
    r = requests.get(f"{BASE_URL}/api/webhooks/kick/subscriptions", timeout=15)
    assert r.status_code == 401


def test_kick_subscriptions_ok():
    r = requests.get(f"{BASE_URL}/api/webhooks/kick/subscriptions", headers=HEAD, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    assert isinstance(j.get("subscriptions"), list)


# ---- Twitch verify (baseline pre-dryrun) ----
def _twitch_total():
    r = requests.get(f"{BASE_URL}/api/webhooks/twitch/verify", headers=HEAD, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["subscriptions"]["total"]


# ---- Resubscribe dry-run ----
def test_resubscribe_twitch_dry_run():
    before = _twitch_total()
    r = requests.post(f"{BASE_URL}/api/webhooks/resubscribe/twitch?dry_run=true", headers=HEAD, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("status") == "dry_run"
    assert "streamer_count" in j and "plan_count" in j
    wc = j.get("would_create", [])
    assert isinstance(wc, list)
    # plan_count = 2 * resolved streamers (online + offline); resolved = streamer_count - errors
    resolved = j["streamer_count"] - len(j.get("would_error", []))
    assert j["plan_count"] == 2 * resolved, j
    # `would_create` is a capped preview (max 50 entries) so we can't
    # assert exact equality once the roster grows past 25 streamers.
    # Either it's the full plan, or it's exactly the 50-entry cap.
    assert len(wc) == min(j["plan_count"], 50), \
        f"would_create len={len(wc)} should equal min(plan_count={j['plan_count']}, 50)"
    # events present
    events = {x["event"] for x in wc}
    assert {"stream.online", "stream.offline"}.issubset(events) or len(wc) == 0
    # No real subs created
    after = _twitch_total()
    assert before == after, f"twitch subs changed: {before}->{after}"


def test_resubscribe_kick_dry_run():
    r = requests.post(f"{BASE_URL}/api/webhooks/resubscribe/kick?dry_run=true", headers=HEAD, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("status") == "dry_run"
    wc = j.get("would_create", [])
    if wc:
        events = {x["event"] for x in wc}
        assert events.issubset({"channel.subscription.gifts", "channel.subscription.renewal"}), events


def test_resubscribe_unknown_source_400():
    r = requests.post(f"{BASE_URL}/api/webhooks/resubscribe/foo?dry_run=true", headers=HEAD, timeout=15)
    assert r.status_code == 400
    body = r.text.lower()
    assert "unknown_source" in body or "unknown" in body
