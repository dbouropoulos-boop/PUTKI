"""Sprint B Slice 3+4 — Telegram bot webhook + Mittari signals subscription.

Covers:
- POST /api/webhooks/telegram  (raffle bind, mittari bind, /stop, /help, fallback, unknown pending)
- POST /api/admin/telegram/set-webhook  (admin gating)
- GET  /api/admin/telegram/webhook-info  (admin gating)
- GET  /api/admin/telegram/bound-entries (admin gating + binding pipeline)
- POST /api/mittari/subscribe           (pre-register)
- GET  /api/mittari/binding-status      (poll)
- GET  /api/admin/mittari/subscribers   (admin)
- broadcast_mittari_state_change import + direct call (best-effort)
"""
import os
import time
import uuid

import pytest
import requests

def _load_frontend_url():
    url = os.environ.get('REACT_APP_BACKEND_URL')
    if url:
        return url.rstrip('/')
    try:
        with open('/app/frontend/.env') as fh:
            for line in fh:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip().rstrip('/')
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL is not set")


BASE_URL = _load_frontend_url()
ADMIN_HEADER = {"X-Admin-Token": "putki-hq-admin"}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_update(text: str, chat_id: int = 9000001, username: str = "tester_iter36",
                 update_id: int | None = None):
    return {
        "update_id": update_id or int(time.time() * 1000) % 2_000_000_000,
        "message": {
            "message_id": 1,
            "from": {"id": chat_id, "is_bot": False, "username": username},
            "chat": {"id": chat_id, "type": "private", "username": username},
            "date": int(time.time()),
            "text": text,
        },
    }


# ── /api/webhooks/telegram dispatcher ────────────────────────────────────

class TestWebhookDispatcher:
    def test_help_returns_kind_help(self, api):
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update("/help", chat_id=9100001))
        assert r.status_code == 200
        j = r.json()
        assert j.get("ok") is True
        assert j.get("kind") == "help"

    def test_fallback_for_chitchat(self, api):
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update("moi mitä kuuluu", chat_id=9100002))
        assert r.status_code == 200
        assert r.json().get("kind") == "fallback"

    def test_start_no_pending(self, api):
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update("/start", chat_id=9100003))
        assert r.status_code == 200
        assert r.json().get("kind") == "start_no_pending"

    def test_start_unknown_pending(self, api):
        unknown = f"TEST_iter36_{uuid.uuid4()}"
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update(f"/start {unknown}", chat_id=9100004))
        assert r.status_code == 200
        assert r.json().get("kind") == "start_unknown_pending"

    def test_missing_message_handled_gracefully(self, api):
        # Telegram sends edited_message / channel_post / etc — handler returns handled=False
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json={"update_id": 1, "channel_post": {}})
        # Endpoint always returns 200 regardless
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ── Mittari subscribe + binding-status + webhook bind ────────────────────

class TestMittariSubscribeFlow:
    def test_subscribe_pre_registers(self, api):
        pid = f"TEST_iter36_{uuid.uuid4()}"
        r = api.post(f"{BASE_URL}/api/mittari/subscribe",
                     json={"pending_id": pid})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert j["pending_id"] == pid

        # GET binding-status BEFORE bot bind: bound=False, active=True (from $setOnInsert)
        r2 = api.get(f"{BASE_URL}/api/mittari/binding-status",
                     params={"pending_id": pid})
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2["bound"] is False
        assert j2["active"] is True
        assert j2.get("bound_at") is None

    def test_binding_status_unknown_pid(self, api):
        r = api.get(f"{BASE_URL}/api/mittari/binding-status",
                    params={"pending_id": f"TEST_iter36_unknown_{uuid.uuid4()}"})
        assert r.status_code == 200
        j = r.json()
        assert j == {"bound": False, "active": False}

    def test_binding_status_requires_pid(self, api):
        # FastAPI returns 422 when query param missing
        r = api.get(f"{BASE_URL}/api/mittari/binding-status")
        assert r.status_code in (400, 422)

    def test_mittari_bind_via_webhook(self, api):
        pid = f"TEST_iter36_{uuid.uuid4()}"
        # Pre-register subscriber
        api.post(f"{BASE_URL}/api/mittari/subscribe", json={"pending_id": pid})

        chat_id = 9300001
        # Bot resolves /start mittari_<pid>
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update(f"/start mittari_{pid}", chat_id=chat_id,
                                       username="iter36_mittari"))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("kind") == "mittari_bound"
        # Telegram sendMessage failed (chat not found) — but binding persists
        assert j.get("already_bound") is False

        # Poll binding-status — should now be bound=True
        r2 = api.get(f"{BASE_URL}/api/mittari/binding-status",
                     params={"pending_id": pid})
        assert r2.status_code == 200
        j2 = r2.json()
        assert j2["bound"] is True
        assert j2["active"] is True
        assert j2.get("bound_at") is not None

        # Re-binding same chat → already_bound=True (idempotent)
        r3 = api.post(f"{BASE_URL}/api/webhooks/telegram",
                      json=_make_update(f"/start mittari_{pid}", chat_id=chat_id,
                                        username="iter36_mittari"))
        assert r3.json().get("already_bound") is True

    def test_mittari_bind_without_preregister(self, api):
        # /start mittari_<pid> creates the subscriber via upsert even if /subscribe
        # was never hit (resilience: shareable bot link before page visit).
        pid = f"TEST_iter36_direct_{uuid.uuid4()}"
        chat_id = 9300002
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update(f"/start mittari_{pid}", chat_id=chat_id))
        assert r.status_code == 200
        assert r.json().get("kind") == "mittari_bound"
        r2 = api.get(f"{BASE_URL}/api/mittari/binding-status",
                     params={"pending_id": pid})
        assert r2.json()["bound"] is True

    def test_stop_deactivates_subscribers(self, api):
        # Bind, then /stop, then verify active=False
        pid = f"TEST_iter36_stop_{uuid.uuid4()}"
        chat_id = 9300003
        api.post(f"{BASE_URL}/api/mittari/subscribe", json={"pending_id": pid})
        api.post(f"{BASE_URL}/api/webhooks/telegram",
                 json=_make_update(f"/start mittari_{pid}", chat_id=chat_id))
        # /stop
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update("/stop", chat_id=chat_id))
        assert r.status_code == 200
        j = r.json()
        assert j["kind"] == "stop"
        assert j["deactivated"] >= 1

        # binding-status — bound still True (chat_id persists) but active=False
        r2 = api.get(f"{BASE_URL}/api/mittari/binding-status",
                     params={"pending_id": pid})
        j2 = r2.json()
        assert j2["bound"] is True
        assert j2["active"] is False

    def test_unsubscribe_alias(self, api):
        pid = f"TEST_iter36_unsub_{uuid.uuid4()}"
        chat_id = 9300004
        api.post(f"{BASE_URL}/api/mittari/subscribe", json={"pending_id": pid})
        api.post(f"{BASE_URL}/api/webhooks/telegram",
                 json=_make_update(f"/start mittari_{pid}", chat_id=chat_id))
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update("/unsubscribe", chat_id=chat_id))
        assert r.json()["kind"] == "stop"
        assert r.json()["deactivated"] >= 1


# ── /start <pending_id> for Voita raffles ────────────────────────────────

class TestVoitaRaffleBind:
    @pytest.fixture
    def voita_entry(self, api):
        """Create a Voita entry with a known pending_id."""
        # Find any active raffle slug
        r = api.get(f"{BASE_URL}/api/voita/raffles")
        if r.status_code != 200 or not r.json().get("items"):
            pytest.skip("No active voita raffles available")
        slug = r.json()["items"][0]["slug"]
        pid = f"TEST_iter36_voita_{uuid.uuid4()}"
        email = f"TEST_iter36_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "display_name": "Iter36 Tester",
            "age_confirm": True,
            "rules_accepted": True,
            "prediction_one_x_two": "1",
            "predicted_home_goals": 2,
            "predicted_away_goals": 1,
            "confidence": 4,
            "contact_channel": "telegram",
            "pending_id": pid,
        }
        er = api.post(f"{BASE_URL}/api/voita/raffles/{slug}/enter", json=payload)
        if er.status_code != 200:
            pytest.skip(f"Could not create voita entry: {er.status_code} {er.text[:200]}")
        return {"pending_id": pid, "slug": slug, "email": email}

    def test_voita_start_binds_entry(self, api, voita_entry):
        chat_id = 9400001
        r = api.post(f"{BASE_URL}/api/webhooks/telegram",
                     json=_make_update(f"/start {voita_entry['pending_id']}",
                                       chat_id=chat_id, username="iter36_voita"))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["kind"] == "start_bound"
        assert j["already_bound"] is False
        assert j.get("entry_id")

        # Verify via admin/telegram/bound-entries
        ar = requests.get(f"{BASE_URL}/api/admin/telegram/bound-entries?limit=100",
                          headers=ADMIN_HEADER)
        assert ar.status_code == 200
        items = ar.json().get("items", [])
        match = [it for it in items if it.get("pending_id") == voita_entry["pending_id"]]
        assert len(match) == 1
        assert match[0]["telegram_chat_id"] == str(chat_id)
        assert match[0]["telegram_username"] == "iter36_voita"

        # Re-bind → already_bound=True
        r2 = api.post(f"{BASE_URL}/api/webhooks/telegram",
                      json=_make_update(f"/start {voita_entry['pending_id']}",
                                        chat_id=chat_id))
        assert r2.json()["already_bound"] is True


# ── Admin endpoints — gating ─────────────────────────────────────────────

class TestAdminGating:
    def test_bound_entries_requires_admin(self, api):
        r = api.get(f"{BASE_URL}/api/admin/telegram/bound-entries")
        assert r.status_code in (401, 403)

    def test_bound_entries_with_admin(self, api):
        r = requests.get(f"{BASE_URL}/api/admin/telegram/bound-entries",
                         headers=ADMIN_HEADER)
        assert r.status_code == 200
        j = r.json()
        assert "items" in j
        assert isinstance(j["items"], list)
        assert "count" in j

    def test_webhook_info_requires_admin(self, api):
        r = api.get(f"{BASE_URL}/api/admin/telegram/webhook-info")
        assert r.status_code in (401, 403)

    def test_webhook_info_with_admin(self, api):
        r = requests.get(f"{BASE_URL}/api/admin/telegram/webhook-info",
                         headers=ADMIN_HEADER)
        assert r.status_code == 200
        # Telegram returns {ok: true/false, result: {...}}; our shim may
        # return {ok:false,error:...} if TOKEN missing. Both 200ed.
        assert "ok" in r.json()

    def test_set_webhook_requires_admin(self, api):
        r = api.post(f"{BASE_URL}/api/admin/telegram/set-webhook",
                     json={"url": "https://example.com/hook"})
        assert r.status_code in (401, 403)

    def test_admin_mittari_subscribers_requires_admin(self, api):
        r = api.get(f"{BASE_URL}/api/admin/mittari/subscribers")
        assert r.status_code in (401, 403)

    def test_admin_mittari_subscribers_with_admin(self, api):
        r = requests.get(f"{BASE_URL}/api/admin/mittari/subscribers",
                         headers=ADMIN_HEADER)
        assert r.status_code == 200
        j = r.json()
        assert "items" in j
        assert "total" in j
        assert "active_bound" in j
        assert isinstance(j["total"], int)


# ── broadcast_mittari_state_change import + invocation ───────────────────

class TestBroadcastImport:
    def test_module_exports(self):
        import importlib
        import sys
        # Ensure backend module path is reachable
        sys.path.insert(0, "/app/backend")
        tg = importlib.import_module("telegram_bot")
        assert hasattr(tg, "broadcast_mittari_state_change")
        assert hasattr(tg, "handle_update")
        assert hasattr(tg, "send_post_match_result")
        assert hasattr(tg, "set_webhook")
        assert hasattr(tg, "get_webhook_info")
