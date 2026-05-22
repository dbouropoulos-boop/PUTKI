"""
PUTKI HQ — Mini-Game Suite Phase 1 (iter55).

Educational mini-games built around the Build Brief v2 spec:
  • Topic: online gambling literacy, beginner audience
  • Play instantly — no email required
  • Email gate unlocks the FULL personalized result + tournament ranking
  • Weekly tournament cycle (auto reset every 7 days)
  • Non-monetary prizes ONLY (recognition, badges, content access)
  • GDPR explicit opt-in, double-opt-in capable

Phase 1 (this iteration) ships:
  ✓ Hub endpoint (5 game tiles, 1 active + 4 "Tulossa")
  ✓ Quiz Challenge — flagship educational game
       - 10 beginner-friendly Finnish questions on gambling literacy
       - Per-question explanation revealed after the player answers
       - Personalized result ("type" + strengths + gaps) on completion
  ✓ Anonymous play — no email needed to play or see preview score
  ✓ Email gate → unlocks full personalized result + tournament ranking
  ✓ Weekly leaderboard with auto reset on Monday 00:00 UTC
  ✓ GDPR-compliant lead capture (consent flag + privacy URL)
  ✓ Webhook forwarding (optional, env-gated)

Phase 2 (next sprint): Scenario, Insight Reveal, Arcade A (Snake), Arcade B
(Flappy-style), full admin panel for content + analytics.

Data model:

  mini_game_questions   — editable quiz content
    {id, slug, order, prompt_fi, options:[{key, label_fi}],
     correct: "a", explanation_fi, topic_tag, active}

  mini_game_plays       — every attempt (anonymous + signed)
    {id, game_slug, anon_id, score, total, answers:[{q_id, picked, correct}],
     started_at, finished_at, duration_s, week_iso, lead_id?}

  mini_game_leads       — email captures (the real list)
    {id, email_hash, email, name?, source_game, score, tournament_week_iso,
     consent_at, consent_text_sha, privacy_url, locale, ip_hash?}

  mini_game_tournaments — weekly resets + final winners (audit)
    {id, week_iso, opened_at, closes_at, closed_at?, top10:[{lead_id,score}]}
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────── constants ───────────────────────────

QUIZ_GAME_SLUG = "quiz_gambling_literacy"
QUIZ_QUESTION_COUNT = 10
QUIZ_TIME_LIMIT_SECONDS = 180  # 3 min, generous

PRIVACY_URL = os.environ.get(
    "MINI_GAME_PRIVACY_URL",
    "https://putkihq.fi/tietosuoja",
)
CONSENT_TEXT_FI = (
    "Hyväksyn, että Putki HQ tallentaa sähköpostini ja pelin tuloksen "
    "voidakseen lähettää minulle henkilökohtaiset tulokset ja viikoittaisen "
    "turnauksen päivitykset. Voin perua tilauksen koska tahansa."
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _week_iso(dt: Optional[datetime] = None) -> str:
    """Return the ISO week tag (YYYY-Wxx) for the given moment. We use
    ISO weeks because they have a defined start (Monday 00:00 UTC)
    which lets the tournament reset cleanly without ambiguity."""
    d = dt or _now()
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _week_bounds(dt: Optional[datetime] = None) -> Tuple[datetime, datetime]:
    d = dt or _now()
    # Monday 00:00 UTC of this week → start, next Monday 00:00 UTC → end.
    monday = d - timedelta(days=d.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    return monday, monday + timedelta(days=7)


def _email_hash(email: str) -> str:
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()


def _consent_text_sha() -> str:
    return hashlib.sha256(CONSENT_TEXT_FI.encode()).hexdigest()[:16]


# ─────────────────────────── seed content ───────────────────────────
#
# 10 Finnish beginner-level gambling-literacy questions. Each has a
# short, plain-language explanation that runs AFTER the player picks —
# the player learns even when they get it wrong.
#
# Editable later via the admin panel (Phase 2). Source of truth on
# first boot: this seed list. Admin edits in `mini_game_questions`
# survive restarts.

QUIZ_SEED_QUESTIONS_FI: List[Dict[str, Any]] = [
    {
        "order": 1,
        "prompt_fi": "Mitä lyhenne RTP tarkoittaa kolikkopeleissä?",
        "options": [
            {"key": "a", "label_fi": "Real-Time Profit"},
            {"key": "b", "label_fi": "Return to Player"},
            {"key": "c", "label_fi": "Random Theoretical Payout"},
            {"key": "d", "label_fi": "Reverse Tax Percentage"},
        ],
        "correct": "b",
        "explanation_fi": (
            "RTP = Return to Player. Se kertoo, kuinka suuren osan "
            "panoksista peli teoriassa palauttaa pelaajille pitkällä "
            "aikavälillä. 96% RTP tarkoittaa, että keskimäärin 96 € "
            "100 €:sta palautuu — talo pitää 4%."
        ),
        "topic_tag": "math",
    },
    {
        "order": 2,
        "prompt_fi": "Slotin volatiliteetti on KORKEA. Mitä se käytännössä tarkoittaa?",
        "options": [
            {"key": "a", "label_fi": "Voitot tulevat usein mutta ovat pieniä"},
            {"key": "b", "label_fi": "Voitot ovat harvinaisia mutta isompia"},
            {"key": "c", "label_fi": "Peli on rikki"},
            {"key": "d", "label_fi": "RTP on yli 98%"},
        ],
        "correct": "b",
        "explanation_fi": (
            "Korkean volatiliteetin slotit maksavat harvemmin mutta "
            "kun ne maksavat, summat ovat suurempia. Bankrolli "
            "kestää huonommin näitä — tarvitset isomman puskurin "
            "ja vahvemmat hermot."
        ),
        "topic_tag": "math",
    },
    {
        "order": 3,
        "prompt_fi": "Saat 100 € talletusbonuksen, jonka kierrätysvaatimus on 35x. Kuinka paljon sinun on pelattava ennen kuin voit nostaa?",
        "options": [
            {"key": "a", "label_fi": "35 €"},
            {"key": "b", "label_fi": "350 €"},
            {"key": "c", "label_fi": "3 500 €"},
            {"key": "d", "label_fi": "Ei tarvitse pelata mitään"},
        ],
        "correct": "c",
        "explanation_fi": (
            "35x kierrätys 100 €:n bonuksesta = 3 500 € pelivolyymia "
            "ennen kuin voitot ovat nostettavissa. Aina tarkista "
            "myös, lasketaanko vain bonus vai bonus + talletus."
        ),
        "topic_tag": "bonus",
    },
    {
        "order": 4,
        "prompt_fi": "Mikä näistä on PARAS bankroll-strategia aloittelijalle?",
        "options": [
            {"key": "a", "label_fi": "Pelaa puolet bankrollista yhdellä spinillä"},
            {"key": "b", "label_fi": "Käytä max 1–2% bankrollista yhdellä spinillä"},
            {"key": "c", "label_fi": "Nosta panoksia kun olet häviöllä"},
            {"key": "d", "label_fi": "Pelaa kunnes bankroll on nollissa"},
        ],
        "correct": "b",
        "explanation_fi": (
            "Ammattilaiset suosittelevat 1–2% panoskokoa per spin. "
            "Tämä antaa varianssin tasoittua ja pidentää pelisessio. "
            "Häviöllä panostuksen NOSTAMINEN (chasing) on yleisin "
            "syy ison bankrollin häviöön."
        ),
        "topic_tag": "bankroll",
    },
    {
        "order": 5,
        "prompt_fi": "Slotti on antanut 50 spinin ajan VAIN tappioita. Onko nyt todennäköisempää, että seuraava spin on voitto?",
        "options": [
            {"key": "a", "label_fi": "Kyllä — peli on \"velkaa\" pelaajalle"},
            {"key": "b", "label_fi": "Ei — jokainen spin on itsenäinen"},
            {"key": "c", "label_fi": "Riippuu pelistä"},
            {"key": "d", "label_fi": "Vain jos panostus on suurempi"},
        ],
        "correct": "b",
        "explanation_fi": (
            "Klassinen Gambler's Fallacy. Jokainen spin on tilastollisesti "
            "ITSENÄINEN edellisistä — slotti ei muista. Tämä on yksi "
            "yleisimmistä ajatusvirheistä, joka johtaa ongelmiin."
        ),
        "topic_tag": "psychology",
    },
    {
        "order": 6,
        "prompt_fi": "Mikä on Suomessa LAILLISESTI luvanvarainen vedonlyönti- ja casinopalveluiden tarjoaja vuonna 2026?",
        "options": [
            {"key": "a", "label_fi": "Vain Veikkaus"},
            {"key": "b", "label_fi": "Veikkaus + 5–8 lisenssin saanutta operaattoria"},
            {"key": "c", "label_fi": "Kaikki EU-lisensoidut"},
            {"key": "d", "label_fi": "Ei mikään"},
        ],
        "correct": "b",
        "explanation_fi": (
            "Suomi avasi rahapelimarkkinan kilpailulle 2026. Veikkauksen "
            "monopoli päättyi — uudella lisenssijärjestelmällä on tällä "
            "hetkellä useita lisensoituja operaattoreita. EU-lisenssi "
            "yksin EI riitä Suomen markkinassa."
        ),
        "topic_tag": "regulation",
    },
    {
        "order": 7,
        "prompt_fi": "Vastuullisen pelaamisen perustyökalu on talletusraja. Mikä on suositeltava aloitusraja kuukaudessa?",
        "options": [
            {"key": "a", "label_fi": "Niin korkea kuin operaattori sallii"},
            {"key": "b", "label_fi": "10% palkasta verojen jälkeen"},
            {"key": "c", "label_fi": "Maksimissaan se mitä voit menettää menettämättä unta"},
            {"key": "d", "label_fi": "Vasta kun olet jo menettänyt rahaa"},
        ],
        "correct": "c",
        "explanation_fi": (
            "Kultainen sääntö: pelaa vain sillä summalla, jonka voit "
            "menettää ilman, että se vaikuttaa elämääsi. Aseta raja "
            "ENNEN ensimmäistä talletusta, älä sen jälkeen kun olet "
            "jo häviöllä."
        ),
        "topic_tag": "responsibility",
    },
    {
        "order": 8,
        "prompt_fi": "House Edge on 4%. Pelaat 1000 €:n volyymin slotteja. Kuinka paljon talo VOITTAA odotusarvoisesti?",
        "options": [
            {"key": "a", "label_fi": "10 €"},
            {"key": "b", "label_fi": "40 €"},
            {"key": "c", "label_fi": "100 €"},
            {"key": "d", "label_fi": "400 €"},
        ],
        "correct": "b",
        "explanation_fi": (
            "House Edge × Volyymi = odotettu talon voitto. 4% × 1000 € "
            "= 40 €. Tämä on TEOREETTINEN keskiarvo — yksittäisessä "
            "sessiossa voit voittaa tai hävitä paljon enemmän."
        ),
        "topic_tag": "math",
    },
    {
        "order": 9,
        "prompt_fi": "Mikä näistä EI ole varoitusmerkki ongelmapelaamisesta?",
        "options": [
            {"key": "a", "label_fi": "Pelaat häviöiden takaisin voittamiseksi"},
            {"key": "b", "label_fi": "Valehtelet pelimäärästä läheisille"},
            {"key": "c", "label_fi": "Pelaat satunnaisesti 2 € talletuksilla viikonloppuna"},
            {"key": "d", "label_fi": "Pelaat lainatulla rahalla"},
        ],
        "correct": "c",
        "explanation_fi": (
            "Pieni viikonloppupanos osana viihdebudjettia EI ole "
            "varoitusmerkki. Chasing (häviöiden jahtaaminen), "
            "valehtelu ja lainattu raha OVAT — ne ovat klassisia "
            "merkkejä siitä, että peli on muuttunut hallinnasta."
        ),
        "topic_tag": "responsibility",
    },
    {
        "order": 10,
        "prompt_fi": "Mikä on TURVALLISIN tapa rajoittaa peliaikaa?",
        "options": [
            {"key": "a", "label_fi": "Yritä itse rajoittaa eli muista lopettaa"},
            {"key": "b", "label_fi": "Aseta operaattorin oma aikaraja TAI itsesulku"},
            {"key": "c", "label_fi": "Älä asenna sovellusta"},
            {"key": "d", "label_fi": "Pelaa vain humalassa"},
        ],
        "correct": "b",
        "explanation_fi": (
            "Operaattoreiden pakolliset työkalut (aikaraja, talletusraja, "
            "itsesulku, peluuri.fi) ovat tehokkaampia kuin pelkkä "
            "tahdonvoima. Aseta rajat ENNEN sessiota — kuumassa "
            "tilanteessa rationaalinen päätöksenteko ei toimi."
        ),
        "topic_tag": "responsibility",
    },
]


PERSONA_LABELS = {
    "math_strong": {
        "title": "Numero­matemaatikko",
        "tagline": "Vahva matematiikan ja todennäköisyyksien hallinta.",
    },
    "responsibility_strong": {
        "title": "Vastuun­hallitsija",
        "tagline": "Tunnet vastuullisen pelaamisen periaatteet hyvin.",
    },
    "balanced": {
        "title": "Tasapainoinen aloittelija",
        "tagline": "Hyvä pohja — sekä numerot että hallinta ovat kunnossa.",
    },
    "needs_basics": {
        "title": "Aloitteleva oppija",
        "tagline": "Suosittelemme kertaamaan perusteet ennen kuin pelaat oikealla rahalla.",
    },
}


def _persona_for(score_pct: float, tag_scores: Dict[str, int]) -> Dict[str, Any]:
    math = tag_scores.get("math", 0) + tag_scores.get("bankroll", 0)
    resp = tag_scores.get("responsibility", 0) + tag_scores.get("psychology", 0)
    if score_pct < 50:
        key = "needs_basics"
    elif math > resp + 1:
        key = "math_strong"
    elif resp > math + 1:
        key = "responsibility_strong"
    else:
        key = "balanced"
    return {"key": key, **PERSONA_LABELS[key]}


# ─────────────────────────── persistence ───────────────────────────

async def ensure_indexes(db) -> None:
    try:
        await db.mini_game_questions.create_index([("slug", 1), ("order", 1)], unique=True)
        await db.mini_game_plays.create_index("week_iso")
        await db.mini_game_plays.create_index([("game_slug", 1), ("week_iso", 1), ("score", -1)])
        await db.mini_game_plays.create_index("anon_id")
        await db.mini_game_leads.create_index("email_hash")
        await db.mini_game_leads.create_index([("source_game", 1), ("tournament_week_iso", 1), ("score", -1)])
        await db.mini_game_tournaments.create_index("week_iso", unique=True)
    except Exception:
        logger.exception("mini_games ensure_indexes failed")


async def seed_quiz_questions(db) -> None:
    """Idempotent — only inserts missing question orders."""
    for q in QUIZ_SEED_QUESTIONS_FI:
        await db.mini_game_questions.update_one(
            {"slug": QUIZ_GAME_SLUG, "order": q["order"]},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "slug": QUIZ_GAME_SLUG,
                "order": q["order"],
                "prompt_fi": q["prompt_fi"],
                "options": q["options"],
                "correct": q["correct"],
                "explanation_fi": q["explanation_fi"],
                "topic_tag": q["topic_tag"],
                "active": True,
                "created_at": _now_iso(),
            }},
            upsert=True,
        )


async def seed_phase2_games(db) -> None:
    """Iter56: seed Scenario + Insight Reveal content (idempotent)."""
    from mini_games_phase2 import (
        SCENARIO_GAME_SLUG, SCENARIO_SEED_FI,
        INSIGHT_GAME_SLUG, INSIGHT_SEED_FI,
    )
    for game_slug, seed in [(SCENARIO_GAME_SLUG, SCENARIO_SEED_FI),
                             (INSIGHT_GAME_SLUG, INSIGHT_SEED_FI)]:
        for q in seed:
            await db.mini_game_questions.update_one(
                {"slug": game_slug, "order": q["order"]},
                {"$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "slug": game_slug,
                    "order": q["order"],
                    "prompt_fi": q["prompt_fi"],
                    "options": q["options"],
                    "correct": q["correct"],
                    # Scenario questions hold the explanation per OPTION;
                    # only the insight tiles have a top-level explanation_fi.
                    "explanation_fi": q.get("explanation_fi", ""),
                    "topic_tag": q["topic_tag"],
                    "active": True,
                    "created_at": _now_iso(),
                }},
                upsert=True,
            )


# ─────────────────────────── play flow ───────────────────────────

async def start_quiz(db) -> Dict[str, Any]:
    """Return a fresh play_id + the question list (correct answers
    stripped). The play row is created immediately so we can rate-limit
    + audit even abandoned sessions."""
    cur = db.mini_game_questions.find(
        {"slug": QUIZ_GAME_SLUG, "active": True},
        {"_id": 0, "id": 1, "order": 1, "prompt_fi": 1, "options": 1, "topic_tag": 1},
    ).sort("order", 1)
    questions = await cur.to_list(length=50)

    anon_id = secrets.token_urlsafe(16)
    play_id = str(uuid.uuid4())
    await db.mini_game_plays.insert_one({
        "id": play_id,
        "game_slug": QUIZ_GAME_SLUG,
        "anon_id": anon_id,
        "started_at": _now_iso(),
        "week_iso": _week_iso(),
        "status": "in_progress",
    })
    return {
        "play_id": play_id,
        "anon_id": anon_id,
        "questions": questions,
        "total": len(questions),
        "time_limit_seconds": QUIZ_TIME_LIMIT_SECONDS,
    }


async def finish_quiz(db, *, play_id: str, anon_id: str, answers: List[Dict[str, str]]) -> Dict[str, Any]:
    """Score the player's answers, return a PREVIEW result (score +
    persona key). The detailed personalized breakdown is gated behind
    email capture (`unlock_quiz_result`)."""
    play = await db.mini_game_plays.find_one(
        {"id": play_id, "anon_id": anon_id},
        {"_id": 0},
    )
    if not play:
        return {"error": "play_not_found"}
    if play.get("status") == "finished":
        return play.get("preview_result") or {"error": "already_finished"}

    cur = db.mini_game_questions.find(
        {"slug": QUIZ_GAME_SLUG, "active": True},
        {"_id": 0, "id": 1, "order": 1, "correct": 1, "topic_tag": 1, "explanation_fi": 1},
    ).sort("order", 1)
    questions = await cur.to_list(length=50)
    by_id = {q["id"]: q for q in questions}

    scored: List[Dict[str, Any]] = []
    tag_scores: Dict[str, int] = {}
    correct_count = 0
    for a in answers or []:
        q = by_id.get(a.get("q_id"))
        if not q:
            continue
        picked = (a.get("picked") or "").lower()
        ok = picked == q["correct"]
        if ok:
            correct_count += 1
            tag_scores[q["topic_tag"]] = tag_scores.get(q["topic_tag"], 0) + 1
        scored.append({
            "q_id": q["id"],
            "order": q["order"],
            "picked": picked,
            "correct": q["correct"],
            "is_correct": ok,
            "explanation_fi": q["explanation_fi"],
            "topic_tag": q["topic_tag"],
        })

    total = len(questions)
    pct = (correct_count / total * 100.0) if total else 0.0
    persona = _persona_for(pct, tag_scores)

    finished_at = _now_iso()
    preview = {
        "play_id": play_id,
        "score": correct_count,
        "total": total,
        "pct": round(pct, 1),
        "persona_preview": {"key": persona["key"], "title": persona["title"]},
        "answers": scored,                  # full per-question feedback
        "personalized_locked": True,        # the FULL persona analysis is gated
    }

    await db.mini_game_plays.update_one(
        {"id": play_id},
        {"$set": {
            "status": "finished",
            "finished_at": finished_at,
            "score": correct_count,
            "total": total,
            "pct": round(pct, 1),
            "answers": scored,
            "tag_scores": tag_scores,
            "persona_key": persona["key"],
            "preview_result": preview,
        }},
    )
    return preview


async def unlock_quiz_result(
    db, *, play_id: str, anon_id: str,
    email: str, name: Optional[str] = None,
    consent: bool = False, ip: Optional[str] = None,
) -> Dict[str, Any]:
    """Capture the email + return the FULL personalized result + the
    player's current tournament ranking. This is the only place where
    the persona's full description, strengths, and gaps surface.

    GDPR contract: `consent` must be explicitly True (the client must
    pass the consent checkbox state). Without it we refuse the capture.
    """
    email = (email or "").strip().lower()
    if not email or "@" not in email or "." not in email:
        return {"error": "invalid_email"}
    if not consent:
        return {"error": "consent_required"}

    play = await db.mini_game_plays.find_one(
        {"id": play_id, "anon_id": anon_id},
        {"_id": 0},
    )
    if not play or play.get("status") != "finished":
        return {"error": "play_not_finished"}

    week = play.get("week_iso") or _week_iso()
    score = int(play.get("score") or 0)
    tag_scores = play.get("tag_scores") or {}
    pct = float(play.get("pct") or 0)
    persona = {"key": play.get("persona_key", "balanced"),
               **PERSONA_LABELS.get(play.get("persona_key", "balanced"))}

    eh = _email_hash(email)
    consent_at = _now_iso()
    # Upsert by (email_hash, source_game, week) → one row per email per
    # tournament week. We avoid the Mongo "path conflict" between
    # $setOnInsert and $set on the same field by checking existence
    # first and choosing the right operator.
    existing = await db.mini_game_leads.find_one(
        {"email_hash": eh, "source_game": QUIZ_GAME_SLUG, "tournament_week_iso": week},
        {"_id": 0, "id": 1, "score": 1, "pct": 1},
    )
    if existing:
        lead_id = existing["id"]
        # Keep the BEST score for the week (player can replay until lead exists).
        if score > int(existing.get("score") or 0):
            await db.mini_game_leads.update_one(
                {"id": lead_id},
                {"$set": {"score": score, "pct": pct, "play_id": play_id}},
            )
    else:
        lead_id = str(uuid.uuid4())
        await db.mini_game_leads.insert_one({
            "id": lead_id,
            "email_hash": eh,
            "email": email,
            "name": name or "",
            "source_game": QUIZ_GAME_SLUG,
            "score": score,
            "pct": pct,
            "tournament_week_iso": week,
            "consent_at": consent_at,
            "consent_text_sha": _consent_text_sha(),
            "privacy_url": PRIVACY_URL,
            "locale": "fi",
            "ip_hash": hashlib.sha256((ip or "").encode()).hexdigest()[:16] if ip else None,
            "play_id": play_id,
        })

    # Mark the play as linked to a lead (audit).
    await db.mini_game_plays.update_one(
        {"id": play_id},
        {"$set": {"lead_id": lead_id, "lead_captured_at": consent_at}},
    )

    # Personalized analysis — strengths/gaps from tag_scores.
    strengths: List[str] = []
    gaps: List[str] = []
    for tag, label in [
        ("math", "matematiikka & RTP"),
        ("bankroll", "bankroll-hallinta"),
        ("bonus", "bonusehdot"),
        ("psychology", "pelipsykologia"),
        ("responsibility", "vastuullinen pelaaminen"),
        ("regulation", "Suomen lainsäädäntö"),
    ]:
        sc = tag_scores.get(tag, 0)
        # Each tag has 1-2 questions; >=1 correct = OK.
        if sc >= 1:
            strengths.append(label)
        else:
            gaps.append(label)

    leaderboard = await get_leaderboard(db, week_iso=week, limit=10)
    rank = await _rank_for_score(db, week_iso=week, score=score, pct=pct)

    return {
        "play_id": play_id,
        "lead_id": lead_id,
        "score": score,
        "total": int(play.get("total") or QUIZ_QUESTION_COUNT),
        "pct": pct,
        "persona": persona,
        "strengths": strengths,
        "gaps": gaps,
        "tournament_week_iso": week,
        "rank": rank,
        "leaderboard": leaderboard,
        "share_text": f"Sain {score}/{int(play.get('total') or QUIZ_QUESTION_COUNT)} Putki HQ:n rahapelitietoisuus-testissä. Kokeile sinäkin!",
    }


async def _rank_for_score(db, *, week_iso: str, score: int, pct: float) -> Optional[int]:
    """The player's rank within this week's leaderboard. Ties broken by
    pct (higher first). Returns 1-indexed rank."""
    better = await db.mini_game_leads.count_documents({
        "source_game": QUIZ_GAME_SLUG,
        "tournament_week_iso": week_iso,
        "$or": [
            {"score": {"$gt": score}},
            {"score": score, "pct": {"$gt": pct}},
        ],
    })
    return better + 1


async def get_leaderboard(db, *, week_iso: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    week = week_iso or _week_iso()
    cur = db.mini_game_leads.find(
        {"source_game": QUIZ_GAME_SLUG, "tournament_week_iso": week},
        {"_id": 0, "name": 1, "email": 1, "score": 1, "pct": 1, "consent_at": 1},
    ).sort([("score", -1), ("pct", -1), ("consent_at", 1)]).limit(limit)
    rows = await cur.to_list(length=limit)
    out: List[Dict[str, Any]] = []
    for i, r in enumerate(rows, start=1):
        # Display safety: only show first name or local-part of email.
        display = (r.get("name") or "").strip()
        if not display:
            local = (r.get("email") or "").split("@")[0]
            display = (local[:3] + "•••" + local[-1:]) if len(local) > 4 else (local or "pelaaja")
        out.append({
            "rank": i,
            "display_name": display,
            "score": int(r.get("score") or 0),
            "pct": float(r.get("pct") or 0),
        })
    return out


async def get_hub_payload(db) -> Dict[str, Any]:
    """The hub page payload: catalog of all 5 games (Phase 1 ships 1
    active, 4 coming soon), current tournament state, top leaderboard."""
    week = _week_iso()
    opens, closes = _week_bounds()
    plays_this_week = await db.mini_game_plays.count_documents({
        "game_slug": QUIZ_GAME_SLUG,
        "week_iso": week,
        "status": "finished",
    })
    leads_this_week = await db.mini_game_leads.count_documents({
        "source_game": QUIZ_GAME_SLUG,
        "tournament_week_iso": week,
    })
    leaderboard = await get_leaderboard(db, week_iso=week, limit=5)

    games = [
        {
            "slug": QUIZ_GAME_SLUG,
            "kind": "quiz",
            "title_fi": "Tietoisuustesti",
            "subtitle_fi": "10 kysymystä rahapelimatematiikasta ja vastuullisuudesta",
            "duration_fi": "≈ 3 min",
            "status": "active",
            "play_url": "/peliareena/tietoisuustesti",
        },
        {
            "slug": "scenario_decisions",
            "kind": "scenario",
            "title_fi": "Päätöspolku",
            "subtitle_fi": "5 oikeaa pelitilannetta — mitä päättäisit?",
            "duration_fi": "≈ 4 min",
            "status": "active",
            "play_url": "/peliareena/paatospolku",
        },
        {
            "slug": "insight_reveal",
            "kind": "reveal",
            "title_fi": "Tietoraape",
            "subtitle_fi": "Raaputa kuusi mikro-oppia — yksi fakta kerrallaan.",
            "duration_fi": "≈ 2 min",
            "status": "active",
            "play_url": "/peliareena/tietoraape",
        },
        {
            "slug": "arcade_snake",
            "kind": "arcade",
            "title_fi": "Aikatappo · Mato",
            "subtitle_fi": "Klassinen mato — viikon korkein pisteytys palkitaan.",
            "duration_fi": "≈ 2 min",
            "status": "coming_soon",
            "play_url": None,
        },
        {
            "slug": "arcade_tap",
            "kind": "arcade",
            "title_fi": "Aikatappo · Napautus",
            "subtitle_fi": "Yhden napautuksen flappy-tyyli.",
            "duration_fi": "≈ 1 min",
            "status": "coming_soon",
            "play_url": None,
        },
    ]

    return {
        "tournament": {
            "week_iso": week,
            "opens_at": opens.isoformat(),
            "closes_at": closes.isoformat(),
            "plays_this_week": plays_this_week,
            "ranked_players_this_week": leads_this_week,
            "leaderboard_top": leaderboard,
        },
        "games": games,
        "consent_text_fi": CONSENT_TEXT_FI,
        "privacy_url": PRIVACY_URL,
    }



# ────────────────── Phase 2 — Scenario (branching) ──────────────────
# Reuses the same `mini_game_plays` + `mini_game_leads` collections as
# the quiz; `game_slug` discriminates and `score`/`pct` are normalised
# so leaderboards can be compared on a 0..15 (scenario) basis.

from mini_games_phase2 import (
    SCENARIO_GAME_SLUG, INSIGHT_GAME_SLUG,
    persona_for_scenario,
)

SCENARIO_MAX_SCORE = 15   # 5 scenarios × 3 points each
INSIGHT_TILE_COUNT = 6    # tiles on the reveal board


async def start_scenario(db) -> Dict[str, Any]:
    cur = db.mini_game_questions.find(
        {"slug": SCENARIO_GAME_SLUG, "active": True},
        {"_id": 0, "id": 1, "order": 1, "prompt_fi": 1, "options": 1, "topic_tag": 1},
    ).sort("order", 1)
    scenarios = await cur.to_list(length=50)
    for s in scenarios:
        s["options"] = [{"key": o["key"], "label_fi": o["label_fi"]} for o in s["options"]]

    anon_id = secrets.token_urlsafe(16)
    play_id = str(uuid.uuid4())
    await db.mini_game_plays.insert_one({
        "id": play_id,
        "game_slug": SCENARIO_GAME_SLUG,
        "anon_id": anon_id,
        "started_at": _now_iso(),
        "week_iso": _week_iso(),
        "status": "in_progress",
    })
    return {
        "play_id": play_id,
        "anon_id": anon_id,
        "scenarios": scenarios,
        "total": len(scenarios),
        "max_score": SCENARIO_MAX_SCORE,
    }


async def finish_scenario(db, *, play_id: str, anon_id: str, answers: List[Dict[str, str]]) -> Dict[str, Any]:
    play = await db.mini_game_plays.find_one(
        {"id": play_id, "anon_id": anon_id, "game_slug": SCENARIO_GAME_SLUG},
        {"_id": 0},
    )
    if not play:
        return {"error": "play_not_found"}
    if play.get("status") == "finished":
        return play.get("preview_result") or {"error": "already_finished"}

    cur = db.mini_game_questions.find(
        {"slug": SCENARIO_GAME_SLUG, "active": True},
        {"_id": 0, "id": 1, "order": 1, "options": 1, "topic_tag": 1, "correct": 1, "prompt_fi": 1},
    ).sort("order", 1)
    scenarios = await cur.to_list(length=50)
    by_id = {s["id"]: s for s in scenarios}

    scored: List[Dict[str, Any]] = []
    total_score = 0
    tag_scores: Dict[str, int] = {}
    for a in answers or []:
        sc = by_id.get(a.get("q_id"))
        if not sc:
            continue
        picked = (a.get("picked") or "").lower()
        opt = next((o for o in sc["options"] if o["key"] == picked), None)
        pts = int(opt.get("score", 0)) if opt else 0
        total_score += pts
        tag_scores[sc["topic_tag"]] = tag_scores.get(sc["topic_tag"], 0) + pts
        scored.append({
            "q_id": sc["id"],
            "order": sc["order"],
            "prompt_fi": sc["prompt_fi"],
            "picked": picked,
            "picked_score": pts,
            "options_resolved": [
                {"key": o["key"], "label_fi": o["label_fi"], "score": o.get("score", 0),
                 "explanation_fi": o.get("explanation_fi", "")}
                for o in sc["options"]
            ],
        })

    total = len(scenarios)
    pct = (total_score / SCENARIO_MAX_SCORE * 100.0) if SCENARIO_MAX_SCORE else 0.0
    persona = persona_for_scenario(total_score)

    preview = {
        "play_id": play_id,
        "score": total_score,
        "max_score": SCENARIO_MAX_SCORE,
        "total": total,
        "pct": round(pct, 1),
        "persona_preview": {"key": persona["key"], "title": persona["title"]},
        "answers": scored,
        "personalized_locked": True,
    }

    await db.mini_game_plays.update_one(
        {"id": play_id},
        {"$set": {
            "status": "finished",
            "finished_at": _now_iso(),
            "score": total_score,
            "max_score": SCENARIO_MAX_SCORE,
            "total": total,
            "pct": round(pct, 1),
            "answers": scored,
            "tag_scores": tag_scores,
            "persona_key": persona["key"],
            "preview_result": preview,
        }},
    )
    return preview


async def unlock_scenario_result(db, *, play_id, anon_id, email, name=None, consent=False, ip=None):
    return await _unlock_for_game(
        db, game_slug=SCENARIO_GAME_SLUG,
        play_id=play_id, anon_id=anon_id, email=email, name=name,
        consent=consent, ip=ip,
        persona_resolver=lambda play: {
            "key": play.get("persona_key", "fresh_player"),
            "title": persona_for_scenario(int(play.get("score") or 0))["title"],
            "tagline": persona_for_scenario(int(play.get("score") or 0))["tagline"],
        },
    )


# ────────────────── Phase 2 — Insight Reveal ──────────────────

async def start_insight(db) -> Dict[str, Any]:
    cur = db.mini_game_questions.find(
        {"slug": INSIGHT_GAME_SLUG, "active": True},
        {"_id": 0, "id": 1, "order": 1, "prompt_fi": 1, "topic_tag": 1},
    ).sort("order", 1)
    tiles = await cur.to_list(length=20)

    anon_id = secrets.token_urlsafe(16)
    play_id = str(uuid.uuid4())
    await db.mini_game_plays.insert_one({
        "id": play_id,
        "game_slug": INSIGHT_GAME_SLUG,
        "anon_id": anon_id,
        "started_at": _now_iso(),
        "week_iso": _week_iso(),
        "status": "in_progress",
        "tiles_revealed": [],
    })
    return {
        "play_id": play_id,
        "anon_id": anon_id,
        "tiles": tiles,
        "tile_count": len(tiles),
    }


async def reveal_insight_tile(db, *, play_id, anon_id, q_id) -> Dict[str, Any]:
    play = await db.mini_game_plays.find_one(
        {"id": play_id, "anon_id": anon_id, "game_slug": INSIGHT_GAME_SLUG},
        {"_id": 0},
    )
    if not play:
        return {"error": "play_not_found"}
    tile = await db.mini_game_questions.find_one(
        {"id": q_id, "slug": INSIGHT_GAME_SLUG, "active": True},
        {"_id": 0, "id": 1, "prompt_fi": 1, "explanation_fi": 1, "topic_tag": 1},
    )
    if not tile:
        return {"error": "tile_not_found"}

    revealed = list(play.get("tiles_revealed") or [])
    if q_id not in revealed:
        revealed.append(q_id)
        await db.mini_game_plays.update_one(
            {"id": play_id},
            {"$set": {"tiles_revealed": revealed, "score": len(revealed)}},
        )
    return {"tile": tile, "revealed_count": len(revealed)}


async def finish_insight(db, *, play_id, anon_id) -> Dict[str, Any]:
    play = await db.mini_game_plays.find_one(
        {"id": play_id, "anon_id": anon_id, "game_slug": INSIGHT_GAME_SLUG},
        {"_id": 0},
    )
    if not play:
        return {"error": "play_not_found"}
    if play.get("status") == "finished":
        return play.get("preview_result") or {"error": "already_finished"}

    revealed_ids = list(play.get("tiles_revealed") or [])
    score = len(revealed_ids)
    pct = (score / INSIGHT_TILE_COUNT * 100.0) if INSIGHT_TILE_COUNT else 0.0

    revealed_tiles: List[Dict[str, Any]] = []
    if revealed_ids:
        cur = db.mini_game_questions.find(
            {"id": {"$in": revealed_ids}, "slug": INSIGHT_GAME_SLUG},
            {"_id": 0, "id": 1, "prompt_fi": 1, "explanation_fi": 1, "topic_tag": 1, "order": 1},
        )
        revealed_tiles = await cur.to_list(length=20)
        revealed_tiles.sort(key=lambda t: t.get("order") or 99)

    persona_title = "Tutkiva oppija" if score >= 4 else "Aloitteleva uteliainen"
    persona_tagline = (
        "Avaat tietoa tasaiseen tahtiin — oppimismoduuli on selvästi päällä."
        if score >= 4 else
        "Pieni alku — kannattaa palata viikolla tutkimaan loput tiilet."
    )

    preview = {
        "play_id": play_id,
        "score": score,
        "max_score": INSIGHT_TILE_COUNT,
        "pct": round(pct, 1),
        "persona_preview": {"key": "explorer", "title": persona_title},
        "revealed_tiles": revealed_tiles,
        "personalized_locked": True,
    }

    await db.mini_game_plays.update_one(
        {"id": play_id},
        {"$set": {
            "status": "finished",
            "finished_at": _now_iso(),
            "score": score,
            "max_score": INSIGHT_TILE_COUNT,
            "pct": round(pct, 1),
            "persona_key": "explorer",
            "persona_title": persona_title,
            "persona_tagline": persona_tagline,
            "revealed_tiles": revealed_tiles,
            "preview_result": preview,
        }},
    )
    return preview


async def unlock_insight_result(db, *, play_id, anon_id, email, name=None, consent=False, ip=None):
    return await _unlock_for_game(
        db, game_slug=INSIGHT_GAME_SLUG,
        play_id=play_id, anon_id=anon_id, email=email, name=name,
        consent=consent, ip=ip,
        persona_resolver=lambda play: {
            "key": "explorer",
            "title": play.get("persona_title", "Tutkiva oppija"),
            "tagline": play.get("persona_tagline", ""),
        },
    )


# ────────────────── Phase 2 shared unlock helper ──────────────────

async def _unlock_for_game(
    db, *, game_slug,
    play_id, anon_id, email, name, consent, ip,
    persona_resolver,
) -> Dict[str, Any]:
    """Shared email-gate unlock for Phase 2 games. Same GDPR contract +
    leaderboard model as the quiz; per-game persona via callback."""
    email = (email or "").strip().lower()
    if not email or "@" not in email or "." not in email:
        return {"error": "invalid_email"}
    if not consent:
        return {"error": "consent_required"}

    play = await db.mini_game_plays.find_one(
        {"id": play_id, "anon_id": anon_id, "game_slug": game_slug},
        {"_id": 0},
    )
    if not play or play.get("status") != "finished":
        return {"error": "play_not_finished"}

    week = play.get("week_iso") or _week_iso()
    score = int(play.get("score") or 0)
    pct = float(play.get("pct") or 0)
    persona = persona_resolver(play)

    eh = _email_hash(email)
    consent_at = _now_iso()
    existing = await db.mini_game_leads.find_one(
        {"email_hash": eh, "source_game": game_slug, "tournament_week_iso": week},
        {"_id": 0, "id": 1, "score": 1},
    )
    if existing:
        lead_id = existing["id"]
        if score > int(existing.get("score") or 0):
            await db.mini_game_leads.update_one(
                {"id": lead_id},
                {"$set": {"score": score, "pct": pct, "play_id": play_id}},
            )
    else:
        lead_id = str(uuid.uuid4())
        await db.mini_game_leads.insert_one({
            "id": lead_id,
            "email_hash": eh,
            "email": email,
            "name": name or "",
            "source_game": game_slug,
            "score": score,
            "pct": pct,
            "tournament_week_iso": week,
            "consent_at": consent_at,
            "consent_text_sha": _consent_text_sha(),
            "privacy_url": PRIVACY_URL,
            "locale": "fi",
            "ip_hash": hashlib.sha256((ip or "").encode()).hexdigest()[:16] if ip else None,
            "play_id": play_id,
        })

    await db.mini_game_plays.update_one(
        {"id": play_id},
        {"$set": {"lead_id": lead_id, "lead_captured_at": consent_at}},
    )

    cur = db.mini_game_leads.find(
        {"source_game": game_slug, "tournament_week_iso": week},
        {"_id": 0, "name": 1, "email": 1, "score": 1, "pct": 1, "consent_at": 1},
    ).sort([("score", -1), ("pct", -1), ("consent_at", 1)]).limit(10)
    rows = await cur.to_list(length=10)
    leaderboard = []
    for i, r in enumerate(rows, start=1):
        display = (r.get("name") or "").strip()
        if not display:
            local = (r.get("email") or "").split("@")[0]
            display = (local[:3] + "•••" + local[-1:]) if len(local) > 4 else (local or "pelaaja")
        leaderboard.append({"rank": i, "display_name": display,
                            "score": int(r.get("score") or 0),
                            "pct": float(r.get("pct") or 0)})

    better = await db.mini_game_leads.count_documents({
        "source_game": game_slug,
        "tournament_week_iso": week,
        "$or": [{"score": {"$gt": score}}, {"score": score, "pct": {"$gt": pct}}],
    })
    rank = better + 1

    return {
        "play_id": play_id,
        "lead_id": lead_id,
        "score": score,
        "max_score": int(play.get("max_score") or 0),
        "pct": pct,
        "persona": persona,
        "tournament_week_iso": week,
        "rank": rank,
        "leaderboard": leaderboard,
        "share_text": f"Pelasin Putki HQ:n pelin ja sain {score}/{int(play.get('max_score') or 0)}. Kokeile sinäkin!",
    }
