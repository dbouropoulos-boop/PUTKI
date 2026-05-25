"""
PUTKI HQ — Historical content backfill.

Generates N articles across the 6 content templates and back-dates their
published_at across the last `days` (default 60). Powers the editorial
"site has been alive for months" effect on day one.

Usage:
  POST /api/admin/content/backfill
    {
      "count": 20,                    # max 50 per call (to fit in <120s)
      "days": 60,                     # backdate window in days
      "templates": ["nhl_recap", ...] # optional filter (default all 6)
    }

The endpoint is **synchronous** — it generates articles in-process. Call it
multiple times to reach 100–200 total. Each call returns the per-template
breakdown of successes / skips / errors.
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Templates available — the 6 from content_generator.py.
# Default backfill uses the 5 LLM-driven templates (each produces unique
# headlines per fixture via Claude). streamer_alert is deterministic
# ("X aloitti striimin · N katsojaa · Y") so we exclude it from the default
# rotation to avoid topic-monoculture — callers can still opt in via
# `templates=["streamer_alert"]`.
DEFAULT_TEMPLATES = [
    "nhl_recap",
    "f1_recap",
    "football_recap",
    "regulatory_analysis",
    "operator_news",
]
ALL_TEMPLATES = DEFAULT_TEMPLATES + ["streamer_alert"]

# Real / synthetic signal scaffolding per template. Editor can swap to
# editorial_subjects-driven lookups later if richer context is desired.

NHL_TEAMS = [
    ("Florida Panthers", "Tampa Bay Lightning"),
    ("Colorado Avalanche", "Dallas Stars"),
    ("Boston Bruins", "Toronto Maple Leafs"),
    ("Edmonton Oilers", "Vancouver Canucks"),
    ("Carolina Hurricanes", "New Jersey Devils"),
    ("Vegas Golden Knights", "Los Angeles Kings"),
    ("New York Rangers", "New York Islanders"),
    ("Pittsburgh Penguins", "Washington Capitals"),
    ("Winnipeg Jets", "Minnesota Wild"),
    ("Nashville Predators", "St. Louis Blues"),
    ("Detroit Red Wings", "Buffalo Sabres"),
    ("Calgary Flames", "Seattle Kraken"),
    ("Ottawa Senators", "Montréal Canadiens"),
    ("Philadelphia Flyers", "Columbus Blue Jackets"),
    ("Anaheim Ducks", "San Jose Sharks"),
]
NHL_FI_PLAYERS = [
    ("Mikko Rantanen", "Colorado Avalanche"),
    ("Aleksander Barkov", "Florida Panthers"),
    ("Patrik Laine", "Montréal Canadiens"),
    ("Sebastian Aho", "Carolina Hurricanes"),
    ("Mikael Granlund", "Dallas Stars"),
    ("Esa Lindell", "Dallas Stars"),
    ("Roope Hintz", "Dallas Stars"),
    ("Juuse Saros", "Nashville Predators"),
    ("Kaapo Kakko", "Seattle Kraken"),
]
FOOTBALL_FIXTURES = [
    ("Manchester City", "Arsenal", "Premier League"),
    ("Real Madrid", "Barcelona", "La Liga"),
    ("Liverpool", "Manchester United", "Premier League"),
    ("Bayern Munich", "Borussia Dortmund", "Bundesliga"),
    ("Inter", "Juventus", "Serie A"),
    ("PSG", "Marseille", "Ligue 1"),
    ("HJK", "KuPS", "Veikkausliiga"),
    ("Inter Turku", "SJK", "Veikkausliiga"),
    ("Ilves", "Haka", "Veikkausliiga"),
    ("Chelsea", "Tottenham", "Premier League"),
    ("Atlético Madrid", "Sevilla", "La Liga"),
    ("Napoli", "AC Milan", "Serie A"),
    ("Ajax", "PSV Eindhoven", "Eredivisie"),
    ("Porto", "Benfica", "Primeira Liga"),
    ("VPS", "FC Honka", "Veikkausliiga"),
]
F1_RACES = [
    "Monaco GP", "Silverstone GP", "Monza GP", "Spa GP", "Suzuka GP",
    "Imola GP", "Bahrain GP", "Miami GP", "Austrian GP", "Hungarian GP",
    "Dutch GP", "Singapore GP", "Las Vegas GP", "Abu Dhabi GP", "Mexico GP",
    "Brazilian GP", "Australian GP", "Canadian GP", "British GP",
]
F1_DRIVERS = [
    "Verstappen", "Hamilton", "Leclerc", "Norris", "Russell", "Sainz",
    "Piastri", "Alonso", "Pérez", "Stroll", "Hülkenberg", "Albon",
]
FI_STREAMERS = [
    ("jarttu84", "Jarttu84"), ("aikapoika", "Aikapoika"), ("pact_", "PACT"),
    ("slotsbyander", "SlotsByAnder"), ("vippikingi", "Vippikingi"),
    ("slottimanu", "SlottiManu"), ("herraherrasmies", "HerraHerrasmies"),
    ("kaaposlots", "KaapoSlots"), ("topisstream", "TopiStream"),
    ("juuskasino", "JuusKasino"), ("ninjaslots", "NinjaSlots"),
]
SLOT_GAMES = [
    "Sweet Bonanza", "Gates of Olympus", "Sugar Rush", "The Dog House",
    "Wanted Dead or Alive", "Big Bass Bonanza", "Money Train 3",
    "Reactoonz", "Fire in the Hole", "Book of Dead", "Bonanza Megaways",
    "San Quentin xWays", "Madame Destiny Megaways", "Starburst",
]
REG_TOPICS = [
    ("Veikkaus monopoli päivittyy 2027 — uusi lisenssimallin runko julkaistu", "yle.fi"),
    ("Suomen rahapelilaki uudistuu — mitä se tarkoittaa pelaajille käytännössä", "hs.fi"),
    ("EU komissio puuttuu Suomen monopoliin uudella valitusprosessilla", "iltalehti.fi"),
    ("Sisäministeriö julkaisi uudet lisenssimallin yksityiskohdat", "yle.fi"),
    ("Peluuri raportoi kasvavasta ongelmapelaamisesta nuorten keskuudessa", "hs.fi"),
    ("Veikkaus laskee jackpot-pottien rajaa uuden lainsäädännön mukaan", "yle.fi"),
    ("Ulkomaiset operaattorit saavat kahden vuoden siirtymäajan Suomeen", "iltalehti.fi"),
    ("Slot-pelien panostusrajat tiukkenevat — uudet säännöt 2027 alkaen", "hs.fi"),
    ("Mainonnan rajat Suomen rahapelimarkkinoilla — uusi linjaus", "yle.fi"),
    ("AML-direktiivin vaikutus suomalaisiin kasinopelaajiin", "iltalehti.fi"),
    ("Veikkauksen liikevoitto laskee historiallisen alas — syyt avattu", "hs.fi"),
    ("Suomi vetoaa CJEU:hun monopolin pysyvyyden puolesta", "yle.fi"),
    ("Liikenne- ja viestintävirasto valvoo verkkokasinoita uudella tavalla", "iltalehti.fi"),
]
OPERATORS = [
    "Casinia", "Mr Vegas", "Wildz", "Casinoly", "PlayOJO",
    "Nitro Casino", "Spinz", "LeoVegas", "Hajper", "BitStarz",
    "Casino Days", "FortuneJack", "Mr Green", "Caxino", "Slotsmagic",
    "Boomerang Casino", "N1 Casino", "Cobra Casino",
]
OPERATOR_NEWS = [
    "lanseeraa uuden bonustuotteen Suomeen",
    "ilmoittaa nopeammat kotiutukset — alle 2 tuntia",
    "lisää uuden pelivalmistajan kirjastoonsa",
    "saa MGA-lisenssin päivityksen",
    "ottaa käyttöön suomenkielisen asiakaspalvelun 24/7",
    "lopettaa toimintansa Suomen markkinalla",
    "siirtyy Pay-N-Play-malliin koko valikoimassaan",
    "julkaisee transparenttisuusraportin pelivolyymista",
    "ottaa käyttöön Trustlyn pikamaksun",
    "menettää MGA-lisenssin compliance-rikkomuksen vuoksi",
    "avaa Live Casino -studion Riikaan",
    "saa uuden CEO:n — strategiaa muutetaan",
    "lopettaa bonusten markkinoinnin Suomeen",
    "yhdistyy isompaan eurooppalaiseen kasino-operaattoriin",
    "lanseeraa cashback-ohjelman ilman kierrätysvaatimuksia",
]


def _synth_signal(template_id: str) -> Dict[str, Any]:
    """Build a synthetic signal_data dict that satisfies the prompt template
    for the given content type."""
    if template_id == "nhl_recap":
        home, away = random.choice(NHL_TEAMS)
        # Inject a Finnish player so the LLM has a Finland angle to work with
        fi_player, fi_team = random.choice(NHL_FI_PLAYERS)
        return {
            "home": home,
            "away": away,
            "home_score": random.randint(1, 6),
            "away_score": random.randint(0, 5),
            "start_time_utc": datetime.now(timezone.utc).isoformat(),
            "game_state": "FINAL",
            "game_id": f"backfill-{uuid.uuid4().hex[:10]}",
            "finnish_players": [{"name": fi_player, "team": fi_team,
                                  "points": random.randint(1, 3),
                                  "toi_minutes": random.randint(15, 24)}],
            "context": f"{fi_player} ({fi_team}) merkityksellisellä roolilla",
        }
    if template_id == "f1_recap":
        race = random.choice(F1_RACES)
        winner = random.choice(F1_DRIVERS)
        podium = random.sample(F1_DRIVERS, 3)
        if winner not in podium:
            podium[0] = winner
        return {
            "race": race,
            "winner": winner,
            "podium": podium,
            "round": random.randint(1, 24),
            "year": 2026,
            "race_id": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    if template_id == "football_recap":
        home, away, comp = random.choice(FOOTBALL_FIXTURES)
        return {
            "home": home,
            "away": away,
            "home_score": random.randint(0, 4),
            "away_score": random.randint(0, 4),
            "competition": comp,
            "kickoff_utc": datetime.now(timezone.utc).isoformat(),
            "match_id": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    if template_id == "streamer_alert":
        login, name = random.choice(FI_STREAMERS)
        game = random.choice(SLOT_GAMES)
        return {
            "user_login": login,
            "user_name": name,
            "platform": "twitch",
            "title": f"{game} — illan striimi",
            "game_name": game,
            "viewer_count": random.randint(80, 2400),
            "started_at": datetime.now(timezone.utc).isoformat(),
            "alert_key": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    if template_id == "regulatory_analysis":
        title, source = random.choice(REG_TOPICS)
        return {
            "title": title,
            "source": source,
            "url": f"https://example.com/regulatory/{uuid.uuid4().hex[:10]}",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "summary": title,
            "news_id": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    if template_id == "operator_news":
        op = random.choice(OPERATORS)
        action = random.choice(OPERATOR_NEWS)
        return {
            "operator": op,
            "headline": f"{op} {action}",
            "summary": f"{op} {action}. PUTKI HQ -toimituksen analyysi tarkastelee mitä tämä tarkoittaa suomalaiselle pelaajalle.",
            "source_url": f"https://example.com/operator/{uuid.uuid4().hex[:10]}",
            "news_id": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    return {}


def _random_past_iso(days: int) -> str:
    delta = timedelta(
        seconds=random.randint(0, max(1, days * 86400)),
    )
    return (datetime.now(timezone.utc) - delta).isoformat()


async def _force_publish_if_draft(generator, *, draft_id: str,
                                   published_id_existing: Optional[str]) -> Optional[str]:
    """If the draft wasn't auto-published, force-publish it. Returns the
    final published_id or None on failure. Backfill is a bulk one-shot
    operation — the manual-review gate is intentionally bypassed here."""
    if published_id_existing:
        return published_id_existing
    try:
        pub = await generator.publish_draft(draft_id, reviewed_by="backfill")
        return pub.get("published_id")
    except Exception:
        return None


async def _backdate_publication(db, *, published_id: str, draft_id: str,
                                  days: int) -> None:
    """Apply a random past-date stamp across both the published and
    draft collections so the homepage rail surfaces backfilled rows
    in a believable order."""
    backdated = _random_past_iso(days)
    await db.published_content.update_one(
        {"id": published_id},
        {"$set": {"published_at": backdated, "backfilled": True}},
    )
    await db.content_drafts.update_one(
        {"id": draft_id},
        {"$set": {"published_at": backdated, "backfilled": True}},
    )


async def _run_one_backfill_iter(db, generator, *, template_id: str,
                                   days: int, stats: Dict[str, Dict[str, int]],
                                   generated_ids: List[str]) -> None:
    """Generate one article + publish + backdate. Mutates stats in place."""
    signal = _synth_signal(template_id)
    try:
        res = await generator.generate_from_signal(template_id, signal, force=True)
    except Exception as e:
        logger.exception("backfill iter failed: %s", e)
        stats[template_id]["err"] += 1
        return

    status = res.get("status")
    if status == "skipped":
        stats[template_id]["skip"] += 1
        return
    if status not in ("generated", "rate_limited_to_draft"):
        stats[template_id]["err"] += 1
        return

    stats[template_id]["ok"] += 1
    draft_id = res.get("draft_id")
    if not draft_id:
        return

    pub = res.get("published") or {}
    published_id = await _force_publish_if_draft(
        generator, draft_id=draft_id,
        published_id_existing=pub.get("published_id"),
    )
    if not published_id:
        return

    await _backdate_publication(db, published_id=published_id,
                                draft_id=draft_id, days=days)
    generated_ids.append(published_id)


async def run_backfill(
    db,
    generator,
    *,
    count: int,
    days: int = 60,
    templates: Optional[List[str]] = None,
    concurrency: int = 4,
) -> Dict[str, Any]:
    """Generate `count` articles across the given templates, back-dating each
    published_at. Returns per-template stats. Articles run with bounded
    concurrency so LLM templates (NHL/F1/Football/Regulatory/Operator news)
    don't sit idle waiting on each other.

    iter66 refactor: the nested 5-level callback `_one` was extracted into
    `_run_one_backfill_iter`, `_force_publish_if_draft`, and
    `_backdate_publication`. Identical output.
    """
    if count <= 0:
        return {"generated": 0, "stats": {}}
    count = min(int(count), 50)  # hard cap per call

    tmpls = [t for t in (templates or DEFAULT_TEMPLATES) if t in ALL_TEMPLATES]
    if not tmpls:
        tmpls = list(DEFAULT_TEMPLATES)

    stats: Dict[str, Dict[str, int]] = {t: {"ok": 0, "skip": 0, "err": 0} for t in tmpls}
    generated_ids: List[str] = []

    import asyncio as _aio
    sem = _aio.Semaphore(max(1, int(concurrency)))

    async def _bounded(i: int) -> None:
        async with sem:
            await _run_one_backfill_iter(
                db, generator,
                template_id=tmpls[i % len(tmpls)],
                days=days, stats=stats, generated_ids=generated_ids,
            )

    await _aio.gather(*[_bounded(i) for i in range(count)])

    return {
        "generated": len(generated_ids),
        "requested": count,
        "days": days,
        "stats": stats,
        "ids": generated_ids,
    }
