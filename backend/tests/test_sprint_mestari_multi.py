"""
Mestari multi-diagnostic regression — poker + blackjack.

Covers:
  - Question metadata shape (5 questions × N options each per diagnostic)
  - Deterministic resolver: same answers → same profile
  - Poker TAG path (tight+aggressive choices → 'strategist')
  - Poker Rock path (tight+passive choices → 'rock')
  - Blackjack Disciplined path → 'disciplined'
  - Blackjack Hunch path → 'hunch'
  - Lead capture writes both optin_consents and mestari_diagnostic_leads
    with playbook_dispatch_ready=False (placeholders must not ship)
  - Lead capture is idempotent on (email, diagnostic)
  - Unknown diagnostic returns 404 from public endpoints
"""
from __future__ import annotations

import asyncio
import os

import httpx
import pytest

from mestari_diagnostics import (
    BLACKJACK_PROFILES,
    BLACKJACK_QUESTIONS,
    POKER_PROFILES,
    POKER_QUESTIONS,
    capture_diagnostic_lead,
    resolve_blackjack,
    resolve_poker,
)

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")


def test_poker_question_shape():
    assert len(POKER_QUESTIONS) == 5
    for q in POKER_QUESTIONS:
        assert q["id"] and q["fi"] and q["en"]
        assert q["options"] and len(q["options"]) >= 3
        for opt in q["options"]:
            assert opt["id"] and isinstance(opt["axis_score"], dict)


def test_blackjack_question_shape():
    assert len(BLACKJACK_QUESTIONS) == 5
    for q in BLACKJACK_QUESTIONS:
        assert q["id"] and q["fi"] and q["en"]
        assert q["options"] and len(q["options"]) >= 3


def test_poker_resolve_strategist_path():
    """All-tight + all-aggressive choices land on the TAG profile."""
    answers = [
        {"q": "p1_starting_hands", "opt": "tight"},
        {"q": "p2_marginal_facing_bet", "opt": "raise"},
        {"q": "p3_pot_action", "opt": "pressure"},
        {"q": "p4_position", "opt": "drives"},
        {"q": "p5_bluffing", "opt": "frequent"},
    ]
    out = resolve_poker(answers)
    assert out["profile"]["key"] == "strategist"
    assert out["scores"]["selectivity"] >= 2
    assert out["scores"]["aggression"] >= 2
    assert len(out["playbook"]) == 5
    assert "value_block" in out


def test_poker_resolve_rock_path():
    answers = [
        {"q": "p1_starting_hands", "opt": "tight"},
        {"q": "p2_marginal_facing_bet", "opt": "fold"},
        {"q": "p3_pot_action", "opt": "check"},
        {"q": "p4_position", "opt": "drives"},
        {"q": "p5_bluffing", "opt": "rare"},
    ]
    out = resolve_poker(answers)
    assert out["profile"]["key"] == "rock"


def test_poker_resolver_is_deterministic():
    """Spec promise: 0 overrides. Re-running the same answers MUST give
    the same profile + scores every time."""
    answers = [
        {"q": "p1_starting_hands", "opt": "wide"},
        {"q": "p2_marginal_facing_bet", "opt": "call"},
        {"q": "p3_pot_action", "opt": "value_bet"},
        {"q": "p4_position", "opt": "little"},
        {"q": "p5_bluffing", "opt": "spot"},
    ]
    a = resolve_poker(answers)
    b = resolve_poker(answers)
    assert a["profile"]["key"] == b["profile"]["key"]
    assert a["scores"] == b["scores"]


def test_blackjack_resolve_disciplined_path():
    answers = [
        {"q": "b1_16_vs_10", "opt": "hit"},
        {"q": "b2_insurance", "opt": "never"},
        {"q": "b3_bet_size", "opt": "flat"},
        {"q": "b4_basic_strategy", "opt": "chart"},
        {"q": "b5_losing_streak", "opt": "plan"},
    ]
    out = resolve_blackjack(answers)
    assert out["profile"]["key"] == "disciplined"
    assert out["scores"]["knowledge"] >= 2
    assert out["scores"]["discipline"] >= 2


def test_blackjack_resolve_hunch_path():
    answers = [
        {"q": "b1_16_vs_10", "opt": "gut"},
        {"q": "b2_insurance", "opt": "usually"},
        {"q": "b3_bet_size", "opt": "chase_loss"},
        {"q": "b4_basic_strategy", "opt": "new"},
        {"q": "b5_losing_streak", "opt": "chase"},
    ]
    out = resolve_blackjack(answers)
    assert out["profile"]["key"] == "hunch"


def test_poker_profiles_have_required_fields():
    for prof in POKER_PROFILES.values():
        for k in ("key", "name_fi", "name_en", "tagline_fi", "tagline_en",
                  "desc_fi", "desc_en", "playbook_focus"):
            assert prof.get(k), f"poker {prof.get('key')} missing {k}"


def test_blackjack_profiles_have_required_fields():
    for prof in BLACKJACK_PROFILES.values():
        for k in ("key", "name_fi", "name_en", "tagline_fi", "tagline_en",
                  "desc_fi", "desc_en", "playbook_focus"):
            assert prof.get(k), f"blackjack {prof.get('key')} missing {k}"


def test_capture_diagnostic_lead_persists_and_is_idempotent():
    from motor.motor_asyncio import AsyncIOMotorClient

    async def run():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        email = "qa+pytest-poker-1@example.com"
        await db.mestari_diagnostic_leads.delete_many({"email": email})
        await db.optin_consents.delete_many({"email": email, "consent_tag": "mestari_poker_lead"})

        r1 = await capture_diagnostic_lead(
            db, email=email, name="QA", diagnostic="poker",
            profile_key="strategist", scores={"selectivity": 4, "aggression": 5},
            lang="en",
        )
        assert r1["ok"]
        # Playbook copy not signed off yet ⇒ dispatch flag false.
        assert r1["playbook_dispatch_ready"] is False

        # Second submit must NOT create a duplicate row.
        await capture_diagnostic_lead(
            db, email=email, name="QA", diagnostic="poker",
            profile_key="strategist", scores={"selectivity": 4, "aggression": 5},
            lang="en",
        )
        rows = []
        async for d in db.mestari_diagnostic_leads.find({"email": email}, {"_id": 0}):
            rows.append(d)
        assert len(rows) == 1
        assert rows[0]["consent_tag"] == "mestari_poker_lead"
        assert rows[0]["profile_key"] == "strategist"

        await db.mestari_diagnostic_leads.delete_many({"email": email})
        await db.optin_consents.delete_many({"email": email, "consent_tag": "mestari_poker_lead"})

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(run())
    finally:
        loop.close()


def test_capture_diagnostic_lead_rejects_invalid_inputs():
    async def run():
        from motor.motor_asyncio import AsyncIOMotorClient
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        bad_email = await capture_diagnostic_lead(
            db, email="not-an-email", name=None, diagnostic="poker",
            profile_key=None, scores=None, lang="fi",
        )
        assert bad_email["ok"] is False
        bad_dx = await capture_diagnostic_lead(
            db, email="ok@example.com", name=None, diagnostic="roulette",
            profile_key=None, scores=None, lang="fi",
        )
        assert bad_dx["ok"] is False

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(run())
    finally:
        loop.close()


def test_aaa_public_endpoints_smoke():
    """Hit the live preview backend (uses httpx to dodge pytest event-loop
    quirks). Verifies the public meta + resolve routes for both new
    diagnostics and the 404 on unknown."""
    try:
        m_poker = httpx.get(f"{BASE}/api/mestari/diagnostic/poker/meta", timeout=8.0)
        m_black = httpx.get(f"{BASE}/api/mestari/diagnostic/blackjack/meta", timeout=8.0)
        m_404 = httpx.get(f"{BASE}/api/mestari/diagnostic/roulette/meta", timeout=8.0)
    except httpx.HTTPError:
        pytest.skip("preview backend not reachable")
        return
    assert m_poker.status_code == 200 and len(m_poker.json()["questions"]) == 5
    assert m_black.status_code == 200 and len(m_black.json()["questions"]) == 5
    assert m_404.status_code == 404
