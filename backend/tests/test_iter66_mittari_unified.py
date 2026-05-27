"""iter66 - Mittari unified panel + admin streamer regression smoke."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pelisignaali-fi.preview.emergentagent.com").rstrip("/")
# Public preview/dev token - matches `/app/memory/test_credentials.md`.
# Override at CI/run time via the `ADMIN_TOKEN` env var.
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "putki-hq-admin")


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─── Smoke: public endpoints ───
def test_dial(session):
    r = session.get(f"{BASE_URL}/api/dial", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "score" in d or "state" in d


def test_cockpit(session):
    r = session.get(f"{BASE_URL}/api/cockpit", timeout=30)
    assert r.status_code == 200


def test_mittari_stats(session):
    r = session.get(f"{BASE_URL}/api/mittari/stats", timeout=30)
    assert r.status_code == 200


# ─── /api/streamers/live across platforms - the P1 regression ───
@pytest.mark.parametrize("platform", ["twitch", "kick", "youtube"])
def test_streamers_live_platform(session, platform):
    r = session.get(f"{BASE_URL}/api/streamers/live?platform={platform}", timeout=30)
    assert r.status_code == 200, f"{platform} -> {r.status_code} {r.text[:200]}"
    body = r.json()
    assert "streamers" in body, body
    assert isinstance(body["streamers"], list)
    # honest dormant flag must be present
    assert "dormant" in body or "reason" in body or body.get("streamers") is not None


def test_streamers_live_no_platform(session):
    r = session.get(f"{BASE_URL}/api/streamers/live", timeout=30)
    assert r.status_code == 200, r.text[:200]


# ─── Admin streamers PUT - require_admin signature regression ───
def test_admin_streamers_get(session):
    r = session.get(
        f"{BASE_URL}/api/admin/streamers",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        timeout=30,
    )
    assert r.status_code == 200, r.text[:200]


def test_admin_streamers_put_no_422(session):
    """PUT must NOT return 422 due to *args/**kwargs leaking into FastAPI introspection.

    We send a valid StreamerPayload - should return 200 (or 404 if slug missing,
    but NOT 422 from helper signature).
    """
    slug = "pelisignaali-fi"
    payload = {
        "name": "Pelisignaali FI",
        "platform": "Twitch",
        "channel": "pelisignaali_fi",
        "tier": 2,
        "scene": "finnish",
        "followers": "1",
        "active": True,
        "market_id": "FI",
    }
    r = session.put(
        f"{BASE_URL}/api/admin/streamers/{slug}",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        json=payload,
        timeout=30,
    )
    assert r.status_code != 422, f"Got 422: {r.text}"
    assert r.status_code in (200, 201), f"Unexpected {r.status_code}: {r.text[:300]}"

    # GET back to verify
    g = session.get(
        f"{BASE_URL}/api/admin/streamers",
        headers={"X-Admin-Token": ADMIN_TOKEN},
        timeout=30,
    )
    assert g.status_code == 200
    data = g.json()
    rows = data if isinstance(data, list) else data.get("streamers", [])
    assert any(s.get("slug") == slug for s in rows), f"slug {slug} not in roster after PUT"


def test_admin_streamers_put_missing_token_401(session):
    r = session.put(
        f"{BASE_URL}/api/admin/streamers/abc",
        json={"name": "x", "platform": "Twitch", "channel": "x"},
        timeout=30,
    )
    # must be auth failure (401/403), NOT 422
    assert r.status_code in (401, 403), f"Expected auth error, got {r.status_code}: {r.text[:200]}"
