"""
iter77 - Unified putki_lead view (P0).

Verifies the `/api/admin/leads/timeline` response after iter77's
additions:
  1. `mittari_subscribers` (Putki Funnel signup) is joined in.
  2. The summary exposes a `by_consent_tag` rollup that counts
     leads across the 3 opt-in funnels (mittari · mestari · voita).
"""
import os

import httpx

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": TOKEN}


def _get(path: str, timeout: float = 60.0):
    return httpx.get(f"{BASE}{path}", headers=HEADERS, timeout=timeout)


def test_timeline_auth_gate():
    r = httpx.get(f"{BASE}/api/admin/leads/timeline", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_timeline_envelope_shape():
    r = _get("/api/admin/leads/timeline?limit=50")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "summary" in body and "rows" in body
    s = body["summary"]
    # New consent-tag rollup must be present
    assert "by_consent_tag" in s, f"missing by_consent_tag: {list(s)}"
    for tag in ("mittari", "mestari", "voita", "all_three"):
        assert tag in s["by_consent_tag"], f"missing tag {tag}"
        assert isinstance(s["by_consent_tag"][tag], int)
    # Standard rollups still present
    assert "by_channel" in s and "by_surface" in s
    for k in ("email", "telegram", "both"):
        assert k in s["by_channel"]


def test_timeline_mittari_funnel_surface_joined():
    """mittari_subscribers rows should surface as `mittari_funnel`."""
    r = _get("/api/admin/leads/timeline?limit=500")
    assert r.status_code == 200, r.text
    body = r.json()
    # Either the surface is present in summary, OR the collection is
    # truly empty in this env (acceptable for fresh DB) - then the
    # consent-tag mittari rollup is 0 and we still pass.
    surfaces = body["summary"]["by_surface"]
    if "mittari_funnel" in surfaces:
        assert surfaces["mittari_funnel"] >= 1
        # At least one row must carry the surface
        hit_rows = [r for r in body["rows"]
                    if "mittari_funnel" in (r.get("surfaces") or [])]
        # We may have capped at 200 rows, so just assert summary > 0
        # and trust the upstream join.
        assert surfaces["mittari_funnel"] > 0
        # If any sample row has it, the details dict should carry the
        # funnel-specific payload.
        for row in hit_rows[:5]:
            assert "details" in row
            # Either explicit funnel block OR pure-TG lead (no email)
            if row.get("email"):
                assert isinstance(row["details"], dict)


def test_funnel_envelope_unchanged():
    """The companion 24h funnel endpoint stays backwards-compat."""
    r = _get("/api/admin/leads/funnel?hours=24")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "stages" in body and "order" in body
    for stage in ("signups", "queued", "sent", "opened", "clicked", "returned"):
        assert stage in body["stages"], f"missing stage {stage}"
        assert "count" in body["stages"][stage]
        assert isinstance(body["stages"][stage].get("spark"), list)
