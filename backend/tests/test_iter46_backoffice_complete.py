"""
Iter46 - Back-office completeness sprint regression.

Covers:
  - Email template catalogue + CRUD + render preview
  - Leads timeline join (signups + optin_consents + voita + mestari +
    email_outbox + telegram_bindings)
  - Mestari diagnostic landing-copy CRUD + public surface
"""
from __future__ import annotations

import os

import httpx
import pytest

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
ADMIN_HEADERS = {"X-Admin-Token": os.environ.get("PUTKI_HQ_ADMIN_TOKEN", "putki-hq-admin")}


def _get(path):
    try:
        return httpx.get(f"{BASE}{path}", headers=ADMIN_HEADERS, timeout=10.0)
    except httpx.HTTPError:
        pytest.skip(f"preview backend not reachable: {path}")
        return None


def _put(path, json):
    try:
        return httpx.put(f"{BASE}{path}", json=json, headers=ADMIN_HEADERS, timeout=10.0)
    except httpx.HTTPError:
        pytest.skip(f"preview backend not reachable: {path}")
        return None


def _post(path, json):
    try:
        return httpx.post(f"{BASE}{path}", json=json, headers=ADMIN_HEADERS, timeout=10.0)
    except httpx.HTTPError:
        pytest.skip(f"preview backend not reachable: {path}")
        return None


# ── Email templates ──────────────────────────────────────────────────

def test_email_templates_catalogue_complete():
    r = _get("/api/admin/email-templates")
    assert r and r.status_code == 200
    d = r.json()
    slugs = {c["slug"] for c in d["catalogue"]}
    expected = {
        "voita_playbook", "voita_winner", "streamer_alert_welcome",
        "telegram_welcome", "telegram_bound",
        *[f"mestari_sports_day{i}" for i in range(1, 6)],
        *[f"mestari_poker_day{i}" for i in range(1, 6)],
        *[f"mestari_blackjack_day{i}" for i in range(1, 6)],
    }
    assert expected.issubset(slugs), f"missing slugs: {expected - slugs}"
    assert len(d["templates"]) >= len(expected)
    assert "dispatch_ready_flag" in d
    assert "resend_configured" in d


def test_email_templates_preview_renders_vars():
    r = _post("/api/admin/email-templates/preview",
              {"slug": "voita_playbook", "lang": "fi"})
    assert r and r.status_code == 200
    out = r.json()
    # Default sample vars include name='Antti' + raffle_title='HJK vs Lahti'
    assert "Antti" in out["body_text"]
    assert "HJK vs Lahti" in out["subject"]
    assert out["gated"] is False


def test_email_templates_preview_gated_flag():
    r = _post("/api/admin/email-templates/preview",
              {"slug": "mestari_poker_day1", "lang": "fi"})
    assert r and r.status_code == 200
    assert r.json()["gated"] is True


def test_email_templates_preview_unknown_slug_404():
    r = _post("/api/admin/email-templates/preview",
              {"slug": "does_not_exist", "lang": "fi"})
    assert r and r.status_code == 404


def test_email_templates_save_idempotent():
    # Read current → write same → read again, confirm no shape changes.
    r1 = _get("/api/admin/email-templates")
    assert r1.status_code == 200
    payload = {"templates": r1.json()["templates"]}
    r2 = _put("/api/admin/email-templates", payload)
    assert r2.status_code == 200 and r2.json()["ok"] is True
    r3 = _get("/api/admin/email-templates")
    assert r3.status_code == 200
    # Both reads return the same slug set.
    assert set(r1.json()["templates"].keys()) == set(r3.json()["templates"].keys())


def test_email_templates_only_known_slugs_persist():
    """Saving an unknown slug must be silently dropped - no schema bypass."""
    r1 = _get("/api/admin/email-templates")
    before = set(r1.json()["templates"].keys())
    payload = {"templates": {
        "voita_playbook": r1.json()["templates"]["voita_playbook"],
        "INJECTED_SLUG_THAT_SHOULD_BE_DROPPED": {"subject_fi": "x"},
    }}
    r2 = _put("/api/admin/email-templates", payload)
    assert r2.status_code == 200
    r3 = _get("/api/admin/email-templates")
    after = set(r3.json()["templates"].keys())
    assert "INJECTED_SLUG_THAT_SHOULD_BE_DROPPED" not in after
    assert before == after


# ── Leads timeline ───────────────────────────────────────────────────

def test_leads_timeline_summary_shape():
    r = _get("/api/admin/leads/timeline?limit=200")
    assert r and r.status_code == 200
    d = r.json()
    assert "summary" in d and "rows" in d
    s = d["summary"]
    for k in ("rows_total", "by_surface", "by_channel", "email_outbox"):
        assert k in s
    for k in ("queued", "sent", "failed", "opens_total", "clicks_total"):
        assert k in s["email_outbox"]


def test_leads_timeline_includes_known_surfaces():
    r = _get("/api/admin/leads/timeline?limit=500")
    assert r.status_code == 200
    surfaces = r.json()["summary"]["by_surface"]
    # We know `voita` and `mestari_*` and `pelisignaalit` are live.
    assert any(k.startswith("mestari") or k == "voita" or "pelisignaal" in k
               for k in surfaces)


def test_leads_timeline_row_shape():
    r = _get("/api/admin/leads/timeline?limit=10")
    assert r.status_code == 200
    rows = r.json()["rows"]
    if not rows:
        pytest.skip("no leads in preview yet")
    row = rows[0]
    for k in ("identity_key", "channels", "surfaces", "email_metrics"):
        assert k in row, f"missing {k} in row"
    for k in ("queued", "sent", "failed", "opened_total", "clicked_total"):
        assert k in row["email_metrics"]


def test_leads_timeline_requires_admin():
    try:
        r = httpx.get(f"{BASE}/api/admin/leads/timeline", timeout=8.0)
    except httpx.HTTPError:
        pytest.skip("preview backend not reachable")
        return
    assert r.status_code in (401, 403)


# ── Mestari diagnostic landing copy ──────────────────────────────────

def test_diagnostic_landing_public_shape():
    try:
        r = httpx.get(f"{BASE}/api/mestari/diagnostic/landing", timeout=8.0)
    except httpx.HTTPError:
        pytest.skip("preview backend not reachable")
        return
    assert r.status_code == 200
    d = r.json()
    for k in ("hub", "poker", "blackjack"):
        assert k in d
        assert "headline_fi" in d[k] or "card_sports_title_fi" in d[k]


def test_diagnostic_meta_surfaces_landing_copy():
    try:
        r = httpx.get(f"{BASE}/api/mestari/diagnostic/poker/meta", timeout=8.0)
    except httpx.HTTPError:
        pytest.skip("preview backend not reachable")
        return
    assert r.status_code == 200
    d = r.json()
    assert "landing" in d
    assert d["landing"].get("headline_fi")


def test_diagnostic_copy_admin_save_then_revert():
    r1 = _get("/api/admin/mestari/diagnostic-copy")
    assert r1.status_code == 200
    snapshot = r1.json()["merged"]
    # Tweak hub headline FI then revert.
    edited = {**snapshot, "hub": {**snapshot["hub"], "headline_fi": "TEST_HEADLINE_PYTEST"}}
    r2 = _put("/api/admin/mestari/diagnostic-copy", {"copy": edited})
    assert r2.status_code == 200
    r3 = _get("/api/admin/mestari/diagnostic-copy")
    assert r3.json()["merged"]["hub"]["headline_fi"] == "TEST_HEADLINE_PYTEST"
    # Revert.
    r4 = _put("/api/admin/mestari/diagnostic-copy",
              {"copy": {"hub": {"headline_fi": snapshot["hub"]["headline_fi"]}}})
    assert r4.status_code == 200
    r5 = _get("/api/admin/mestari/diagnostic-copy")
    assert r5.json()["merged"]["hub"]["headline_fi"] == snapshot["hub"]["headline_fi"]
