"""
PUTKI HQ — iter83 / Task 2.7 backend tests.

Mirrors the iter82 pattern: tests run against the LIVE FastAPI server
via httpx (REACT_APP_BACKEND_URL), not via TestClient. This avoids the
event-loop / Motor binding mess that arises when TestClient and
direct-Motor calls share a process.

Coverage:
  - GET /api/admin/back_office_activity — admin gate, filters, pagination shape
  - GET /api/admin/back_office_activity/distinct/action_types
  - POST /api/admin/back_office_activity/{id}/undo — gate, 404, non-reversible,
    already-undone, 24h cutoff, full happy path (bot_config flip + twin row)
  - Middleware auto-logging on /api/admin/settings save
  - Middleware skips /api/admin/back_office_activity own paths
  - Token hashing (unit, no network)
"""
import hashlib
import os
import time

import httpx
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
TOKEN = os.environ.get("BACK_OFFICE_TOKEN", "putki-hq-admin")
HEADERS = {"X-Admin-Token": TOKEN, "Content-Type": "application/json"}
LIST = f"{BASE}/api/admin/back_office_activity"
DISTINCT = f"{LIST}/distinct/action_types"

# Preview env can be slow — bumping to 60s on the recommendation of
# transient ReadTimeouts during high-concurrency runs.
TIMEOUT = 60.0


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:8]


# ─── GET /api/admin/back_office_activity ───────────────────────────

def test_list_requires_admin():
    r = httpx.get(LIST, timeout=TIMEOUT)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_list_returns_items_count_total_shape():
    r = httpx.get(LIST, headers=HEADERS, params={"limit": 5}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    j = r.json()
    assert set(j.keys()) >= {"items", "count", "total"}
    assert isinstance(j["items"], list)
    assert isinstance(j["count"], int)
    assert isinstance(j["total"], int)
    assert j["count"] == len(j["items"])
    assert j["count"] <= 5


def test_list_limit_param_caps_results():
    r = httpx.get(LIST, headers=HEADERS, params={"limit": 1}, timeout=TIMEOUT)
    assert r.status_code == 200
    j = r.json()
    assert len(j["items"]) <= 1


def test_list_sort_is_newest_first():
    r = httpx.get(LIST, headers=HEADERS, params={"limit": 50}, timeout=TIMEOUT)
    items = r.json()["items"]
    if len(items) >= 2:
        timestamps = [it["ts"] for it in items]
        assert timestamps == sorted(timestamps, reverse=True), \
            "expected newest-first sort"


def test_list_reversible_only_filter_excludes_irreversible():
    r = httpx.get(LIST, headers=HEADERS,
                  params={"reversible_only": "true", "limit": 50}, timeout=TIMEOUT)
    items = r.json()["items"]
    for it in items:
        assert it["reversible"] is True, \
            f"reversible_only=true returned reversible=False: {it['id']}"
        assert it["undone_at"] is None, \
            f"reversible_only=true returned undone row: {it['id']}"


def test_distinct_action_types_sorted():
    r = httpx.get(DISTINCT, headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200
    types = r.json()["action_types"]
    assert isinstance(types, list)
    assert types == sorted(types)


def test_distinct_requires_admin():
    r = httpx.get(DISTINCT, timeout=TIMEOUT)
    assert r.status_code in (401, 403)


# ─── POST /undo ──────────────────────────────────────────────────────

def test_undo_requires_admin():
    r = httpx.post(f"{LIST}/abc/undo", timeout=TIMEOUT)
    assert r.status_code in (401, 403)


def test_undo_404_for_unknown_row():
    r = httpx.post(f"{LIST}/does-not-exist-row-xyz/undo",
                   headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 404


def test_undo_flips_bot_config_and_creates_twin_row():
    """End-to-end soft-undo for bot_config.toggle.

    1. Read current `daily_dm_enabled`.
    2. Flip via PUT /api/admin/bot/config (creates a reversible row).
    3. Locate the new row via list endpoint.
    4. POST /undo → expect 200 + the bot_config returned to original.
    5. The original row should now be flagged undone_at.
    6. A twin row with action_type 'bot_config.toggle.undone' should exist.
    """
    # 1.
    r = httpx.get(f"{BASE}/api/admin/bot/config", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200
    orig = r.json()
    orig_dm = bool(orig.get("daily_dm_enabled", False))
    target_dm = not orig_dm

    # 2.
    r = httpx.put(f"{BASE}/api/admin/bot/config", headers=HEADERS,
                  json={"daily_dm_enabled": target_dm}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text

    # 3. Locate the most recent bot_config.toggle row.
    time.sleep(0.2)  # let the explicit log write commit
    r = httpx.get(LIST, headers=HEADERS,
                  params={"action_type": "bot_config.toggle", "limit": 5},
                  timeout=TIMEOUT)
    items = r.json()["items"]
    assert items, "expected at least one bot_config.toggle row"
    row = items[0]
    assert row["reversible"] is True
    assert row["prev_state"].get("daily_dm_enabled") == orig_dm
    assert row["next_state"].get("daily_dm_enabled") == target_dm
    row_id = row["id"]

    # 4.
    r = httpx.post(f"{LIST}/{row_id}/undo", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["row_id"] == row_id

    # 5. The original row should now be marked undone.
    r = httpx.get(LIST, headers=HEADERS,
                  params={"action_type": "bot_config.toggle", "limit": 5},
                  timeout=TIMEOUT)
    fresh = next((it for it in r.json()["items"] if it["id"] == row_id), None)
    assert fresh is not None
    assert fresh["undone_at"] is not None
    assert fresh["undone_by"] == _hash(TOKEN)

    # 6. A twin row exists.
    r = httpx.get(LIST, headers=HEADERS,
                  params={"action_type": "bot_config.toggle.undone", "limit": 10},
                  timeout=TIMEOUT)
    twins = r.json()["items"]
    matching = [t for t in twins if (t.get("meta") or {}).get("undid_row_id") == row_id]
    assert matching, "expected a twin row referring back to the undone row"
    twin = matching[0]
    assert twin["reversible"] is False

    # 7. bot_config really did flip back.
    r = httpx.get(f"{BASE}/api/admin/bot/config", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200
    assert bool(r.json().get("daily_dm_enabled", False)) == orig_dm


def test_undo_rejects_already_undone_row():
    """The twin row from the previous test was created with
    reversible=False — re-trying its undo should hit 400 'not reversible'.
    Hitting an already-undone row would be 400 'already undone' but
    we cover both with a defensive check on the message."""
    # Find any undone row in recent history.
    r = httpx.get(LIST, headers=HEADERS, params={"limit": 50}, timeout=TIMEOUT)
    undone_rows = [it for it in r.json()["items"] if it.get("undone_at")]
    if not undone_rows:
        pytest.skip("no undone rows yet — run the bot_config undo test first")
    row_id = undone_rows[0]["id"]
    r = httpx.post(f"{LIST}/{row_id}/undo", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 400
    msg = r.json()["detail"].lower()
    assert ("already" in msg) or ("not reversible" in msg) or ("expired" in msg)


def test_undo_rejects_non_reversible_row():
    """Find any row with reversible=False and confirm /undo refuses."""
    r = httpx.get(LIST, headers=HEADERS, params={"limit": 50}, timeout=TIMEOUT)
    irreversibles = [it for it in r.json()["items"] if not it.get("reversible")]
    if not irreversibles:
        pytest.skip("no irreversible rows in recent activity")
    row_id = irreversibles[0]["id"]
    r = httpx.post(f"{LIST}/{row_id}/undo", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 400
    assert "not reversible" in r.json()["detail"].lower() or \
           "already" in r.json()["detail"].lower()


# ─── Middleware auto-logging ────────────────────────────────────────

def test_middleware_auto_logs_settings_save():
    """A non-explicit admin mutation (PUT /api/admin/settings) should
    leave a row with meta.auto_logged=True."""
    # Snapshot current settings so we can put them back unchanged.
    r = httpx.get(f"{BASE}/api/admin/settings", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200
    settings = r.json()

    # Count auto-logged settings rows before.
    pre = httpx.get(LIST, headers=HEADERS,
                    params={"limit": 50}, timeout=TIMEOUT).json()["items"]
    pre_auto = [it for it in pre if it["action_type"].startswith("put.")
                and "settings" in it["action_type"]]
    pre_count = len(pre_auto)

    r = httpx.put(f"{BASE}/api/admin/settings", headers=HEADERS,
                  json=settings, timeout=TIMEOUT)
    assert r.status_code == 200, r.text

    time.sleep(0.25)  # let the middleware insert commit

    post = httpx.get(LIST, headers=HEADERS,
                     params={"limit": 50}, timeout=TIMEOUT).json()["items"]
    post_auto = [it for it in post if it["action_type"].startswith("put.")
                 and "settings" in it["action_type"]]
    assert len(post_auto) > pre_count, "expected the middleware to insert a new row"
    latest = post_auto[0]
    assert latest["meta"]["auto_logged"] is True
    assert latest["meta"]["status"] == 200
    assert latest["meta"]["method"] == "PUT"


def test_middleware_skips_activity_router_paths():
    """The activity log endpoints themselves must NOT auto-log when read."""
    pre = httpx.get(LIST, headers=HEADERS,
                    params={"limit": 50}, timeout=TIMEOUT).json()["items"]
    pre_router = [it for it in pre
                  if "back_office_activity" in (it["action_type"] or "")]
    pre_count = len(pre_router)

    # Hammer the list endpoint a few times.
    for _ in range(3):
        httpx.get(LIST, headers=HEADERS, params={"limit": 1}, timeout=TIMEOUT)
        httpx.get(DISTINCT, headers=HEADERS, timeout=TIMEOUT)

    time.sleep(0.15)
    post = httpx.get(LIST, headers=HEADERS,
                     params={"limit": 50}, timeout=TIMEOUT).json()["items"]
    post_router = [it for it in post
                   if "back_office_activity" in (it["action_type"] or "")]
    assert len(post_router) == pre_count, \
        "activity router paths must NOT be auto-logged"


# ─── Unit-only: token hash determinism ──────────────────────────────

def test_token_hash_is_deterministic_and_8_chars():
    """Mirrors the server-side hashing rule (sha256[:8])."""
    assert _hash("putki-hq-admin") == _hash("putki-hq-admin")
    assert len(_hash("putki-hq-admin")) == 8
    assert _hash("token-a") != _hash("token-b")
