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
DEFAULT_TEMPLATES = [
    "nhl_recap",
    "f1_recap",
    "football_recap",
    "streamer_alert",
    "regulatory_analysis",
    "operator_news",
]

# Real / synthetic signal scaffolding per template. Editor can swap to
# editorial_subjects-driven lookups later if richer context is desired.

NHL_TEAMS = [
    ("Florida Panthers", "Tampa Bay Lightning"),
    ("Colorado Avalanche", "Dallas Stars"),
    ("Boston Bruins", "Toronto Maple Leafs"),
    ("Edmonton Oilers", "Vancouver Canucks"),
    ("Carolina Hurricanes", "New Jersey Devils"),
    ("Vegas Golden Knights", "Los Angeles Kings"),
    ("Rangers", "Islanders"),
    ("Pittsburgh Penguins", "Washington Capitals"),
]
FOOTBALL_FIXTURES = [
    ("Manchester City", "Arsenal"),
    ("Real Madrid", "Barcelona"),
    ("Liverpool", "Manchester United"),
    ("Bayern Munich", "Borussia Dortmund"),
    ("Inter", "Juventus"),
    ("PSG", "Marseille"),
    ("HJK", "KuPS"),
    ("Inter Turku", "SJK"),
]
F1_RACES = ["Monaco GP", "Silverstone GP", "Monza GP", "Spa GP", "Suzuka GP", "Imola GP"]
F1_DRIVERS = ["Verstappen", "Hamilton", "Leclerc", "Norris", "Russell", "Sainz"]
FI_STREAMERS = [
    ("jarttu84", "Jarttu84"), ("aikapoika", "Aikapoika"), ("pact_", "PACT"),
    ("slotsbyander", "SlotsByAnder"), ("vippikingi", "Vippikingi"),
    ("slottimanu", "SlottiManu"), ("herraherrasmies", "HerraHerrasmies"),
]
SLOT_GAMES = ["Sweet Bonanza", "Gates of Olympus", "Sugar Rush", "The Dog House",
              "Wanted Dead or Alive", "Big Bass Bonanza", "Money Train 3"]
REG_TOPICS = [
    ("Veikkaus monopoli päivittyy 2027", "yle.fi"),
    ("Suomen rahapelilaki uudistuu — mitä se tarkoittaa pelaajille", "hs.fi"),
    ("EU komissio puuttuu Suomen monopoliin", "iltalehti.fi"),
    ("Sisäministeriö julkaisi uudet lisenssimallin yksityiskohdat", "yle.fi"),
    ("Peluuri raportoi kasvavasta ongelmapelaamisesta", "hs.fi"),
]
OPERATORS = [
    "Casinia", "Mr Vegas", "Wildz", "Casinoly", "PlayOJO",
    "Nitro Casino", "Spinz", "LeoVegas", "Hajper",
]
OPERATOR_NEWS = [
    "lanseeraa uuden bonustuotteen Suomeen",
    "ilmoittaa nopeammat kotiutukset",
    "lisää uuden pelivalmistajan kirjastoonsa",
    "saa MGA-lisenssin päivityksen",
    "ottaa käyttöön suomenkielisen asiakaspalvelun",
]


def _synth_signal(template_id: str) -> Dict[str, Any]:
    """Build a synthetic signal_data dict that satisfies the prompt template
    for the given content type."""
    if template_id == "nhl_recap":
        home, away = random.choice(NHL_TEAMS)
        return {
            "home": home,
            "away": away,
            "home_score": random.randint(1, 6),
            "away_score": random.randint(0, 5),
            "start_time_utc": datetime.now(timezone.utc).isoformat(),
            "game_state": "FINAL",
            "game_id": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    if template_id == "f1_recap":
        race = random.choice(F1_RACES)
        winner = random.choice(F1_DRIVERS)
        return {
            "race": race,
            "winner": winner,
            "podium": random.sample(F1_DRIVERS, 3),
            "round": random.randint(1, 24),
            "year": 2026,
            "race_id": f"backfill-{uuid.uuid4().hex[:10]}",
        }
    if template_id == "football_recap":
        home, away = random.choice(FOOTBALL_FIXTURES)
        return {
            "home": home,
            "away": away,
            "home_score": random.randint(0, 4),
            "away_score": random.randint(0, 4),
            "competition": "Premier League",
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


async def run_backfill(
    db,
    generator,
    *,
    count: int,
    days: int = 60,
    templates: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Generate `count` articles across the given templates, back-dating each
    published_at. Returns per-template stats."""
    if count <= 0:
        return {"generated": 0, "stats": {}}
    count = min(int(count), 50)  # hard cap per call

    tmpls = [t for t in (templates or DEFAULT_TEMPLATES) if t in DEFAULT_TEMPLATES]
    if not tmpls:
        tmpls = list(DEFAULT_TEMPLATES)

    stats: Dict[str, Dict[str, int]] = {t: {"ok": 0, "skip": 0, "err": 0} for t in tmpls}
    generated_ids: List[str] = []

    for i in range(count):
        template_id = tmpls[i % len(tmpls)]
        signal = _synth_signal(template_id)
        try:
            res = await generator.generate_from_signal(template_id, signal, force=True)
            status = res.get("status")
            if status in ("generated", "rate_limited_to_draft"):
                stats[template_id]["ok"] += 1
                draft_id = res.get("draft_id")
                if draft_id:
                    # Auto-publish draft if not already auto-published
                    pub = res.get("published") or {}
                    published_id = pub.get("published_id")
                    if not published_id and status == "rate_limited_to_draft":
                        # Promote rate-limited draft to published
                        try:
                            pub2 = await generator.publish_draft(draft_id, reviewed_by="backfill")
                            published_id = pub2.get("published_id")
                        except Exception:
                            pass
                    if published_id:
                        # Backdate the published article
                        backdated = _random_past_iso(days)
                        await db.published_content.update_one(
                            {"id": published_id},
                            {"$set": {"published_at": backdated, "backfilled": True}},
                        )
                        await db.content_drafts.update_one(
                            {"id": draft_id},
                            {"$set": {"published_at": backdated, "backfilled": True}},
                        )
                        generated_ids.append(published_id)
            elif status == "skipped":
                stats[template_id]["skip"] += 1
            else:
                stats[template_id]["err"] += 1
        except Exception as e:
            logger.exception("backfill iter failed: %s", e)
            stats[template_id]["err"] += 1

    return {
        "generated": len(generated_ids),
        "requested": count,
        "days": days,
        "stats": stats,
        "ids": generated_ids,
    }
