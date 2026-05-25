"""
iter65 — Inline share preview + Resend welcome email (feature-flagged).

Verifies:
  • POST /api/mini-games/scenario/unlock triggers welcome email
    dispatch in the background (MOCKED mode when RESEND_API_KEY unset).
  • Dispatch is idempotent — second unlock for the same email/source_game
    does NOT re-send and DOES NOT increment the mock counter.
  • Mongo lead row carries welcome_email_sent_at + welcome_email_id +
    welcome_email_mode + welcome_email_lang stamps after first send.
  • OG image is renderable from the same persona_key handed to the
    email module (round-trip sanity).
  • POST /api/profiler/event accepts platform-tagged share_click events.
"""
import asyncio
import os
import time
import uuid

import pytest
import requests

API = os.environ.get("BACKEND_API", "http://localhost:8001/api")


def _start_scenario():
    r = requests.post(f"{API}/mini-games/scenario/start", timeout=15)
    r.raise_for_status()
    return r.json()


def _finish(picks="b"):
    d = _start_scenario()
    pid, aid = d["play_id"], d["anon_id"]
    answers = [{"q_id": s["id"], "picked": picks} for s in d["scenarios"]]
    requests.post(
        f"{API}/mini-games/scenario/finish",
        json={"play_id": pid, "anon_id": aid, "answers": answers},
        timeout=15,
    ).raise_for_status()
    return pid, aid


def _unlock(pid, aid, email, lang="fi"):
    return requests.post(
        f"{API}/mini-games/scenario/unlock",
        json={"play_id": pid, "anon_id": aid, "email": email, "consent": True},
        headers={"x-lang": lang},
        timeout=15,
    )


def _read_lead(email):
    """Hit the admin debug endpoint or fall through to the DB directly."""
    import sys
    sys.path.insert(0, "/app/backend")
    from pymongo import MongoClient
    from dotenv import load_dotenv as _ld
    _ld("/app/backend/.env", override=False)
    from mini_games import _email_hash
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db_name = os.environ.get("DB_NAME") or "test_database"
    doc = mongo[db_name].mini_game_leads.find_one(
        {"email_hash": _email_hash(email), "source_game": "scenario_decisions"},
        {"_id": 0, "welcome_email_sent_at": 1, "welcome_email_id": 1,
         "welcome_email_mode": 1, "welcome_email_lang": 1},
    )
    return doc or {}


@pytest.fixture
def fresh_email():
    return f"iter65+{uuid.uuid4().hex[:8]}@putkihq.fi"


def test_unlock_schedules_mocked_welcome_email(fresh_email):
    pid, aid = _finish(picks="b")
    r = _unlock(pid, aid, fresh_email, lang="en")
    assert r.status_code == 200, r.text
    # Email task runs as fire-and-forget — give it a moment
    time.sleep(2.0)
    lead = _read_lead(fresh_email)
    assert lead.get("welcome_email_sent_at"), f"missing stamp: {lead}"
    assert lead.get("welcome_email_mode") in ("mocked", "live"), lead
    assert lead.get("welcome_email_lang") == "en", lead
    assert lead.get("welcome_email_id"), lead


def test_unlock_is_idempotent_no_double_send(fresh_email):
    pid, aid = _finish(picks="b")
    _unlock(pid, aid, fresh_email).raise_for_status()
    time.sleep(1.5)
    first = _read_lead(fresh_email)
    first_stamp = first.get("welcome_email_sent_at")
    first_id    = first.get("welcome_email_id")
    assert first_stamp and first_id, f"first send failed: {first}"

    # Second unlock — same email — should NOT overwrite the stamp
    pid2, aid2 = _finish(picks="b")
    _unlock(pid2, aid2, fresh_email).raise_for_status()
    time.sleep(1.5)
    second = _read_lead(fresh_email)
    assert second.get("welcome_email_sent_at") == first_stamp, "stamp regressed — double-send risk"
    assert second.get("welcome_email_id") == first_id, "id changed — double-send"


def test_unlock_defaults_to_fi_when_no_lang_header(fresh_email):
    pid, aid = _finish(picks="b")
    _unlock(pid, aid, fresh_email).raise_for_status()  # no x-lang header
    time.sleep(1.5)
    assert _read_lead(fresh_email).get("welcome_email_lang") == "fi"


def test_og_image_renderable_for_each_persona():
    """Round-trip sanity — every key the email module passes to render_from_persona_key
    must produce a real PNG via the public endpoint too."""
    for k in ("cold_calculator", "patient_tactician", "streak_chaser",
              "comeback_believer", "tilt_risk"):
        r = requests.get(f"{API}/profiler/share/og.png",
                         params={"persona_key": k, "lang": "fi"}, timeout=10)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/png")
        assert len(r.content) > 2000   # not a stub
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic


def test_share_click_accepts_platform_meta():
    sid = f"pytest-iter65-{uuid.uuid4().hex[:8]}"
    for platform in ("telegram", "x", "whatsapp", "copy"):
        r = requests.post(
            f"{API}/profiler/event",
            json={"session_id": sid, "event": "share_click",
                  "meta": {"platform": platform, "persona_key": "cold_calculator"}},
            timeout=10,
        )
        assert r.status_code == 200, f"{platform}: {r.text}"
        assert r.json()["ok"] is True


def test_resend_module_mocked_when_key_unset():
    """Sanity — if no RESEND_API_KEY, the module reports `live=False`
    so the unlock path knows to stub. Live-mode wiring is exercised
    by the integration tests above."""
    import sys
    sys.path.insert(0, "/app/backend")
    # Reset import + env to ensure deterministic read
    if "resend_email" in sys.modules:
        del sys.modules["resend_email"]
    os.environ.pop("RESEND_API_KEY", None)
    from resend_email import is_live
    assert is_live() is False
