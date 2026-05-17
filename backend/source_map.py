"""
PUTKI HQ V2 Master Brief §4.1 — Named Finnish source map.

Curated registry of authoritative sources PUTKI HQ's editorial pipeline monitors
manually or via RSS. Seeded into Mongo collection `tracked_sources` on startup
(idempotent). Back-office can edit. Public list surfaces on /lehdisto and
internally drives editor seed material + citation patterns.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List


TRACKED_SOURCES: List[Dict[str, Any]] = [
    # Betting discourse + tipster culture
    {"key": "ylikerroin",     "name": "Ylikerroin.com",       "category": "betting_discourse", "url": "https://ylikerroin.com",        "tier": 1, "note": "Finland's largest betting forum. Value-betting culture, complaints, payment issues. Forum layer > homepage."},
    {"key": "vedonlyonti",    "name": "Vedonlyönti.com",      "category": "betting_discourse", "url": "https://vedonlyonti.com",       "tier": 2, "note": "Major Finnish betting portal. Daily long-bet tips, bookmaker comparisons, commercial Finnish betting tone."},
    {"key": "ristikaksi",     "name": "Ristikaksi",           "category": "betting_discourse", "url": "https://x.com/ristikaksi",      "tier": 2, "note": "X-based tipster, 20K+ long-bet tips since 2019. Verify performance claims manually."},
    {"key": "tipsimaatti",    "name": "Tipsimaatti",          "category": "betting_discourse", "url": "https://tipsimaatti.fi",        "tier": 3, "note": "Betting-tips portal, editorial-style tip writing around stories/stats/match nuance."},

    # Regulatory + industry (Tier-1 — directly feed /saantely + /sponsoroinnit)
    {"key": "poliisi",        "name": "Poliisi · Arpajaishallinto",                "category": "regulatory",        "url": "https://poliisi.fi/arpajaishallinto",            "tier": 1, "note": "National Police Board gambling enforcement. Enforcement actions, blocking decisions, warning letters, influencer cases."},
    {"key": "veikkaus_news",  "name": "Veikkaus Group Newsroom",                   "category": "regulatory",        "url": "https://www.veikkaus.fi/fi/yritys/uutiset",     "tier": 1, "note": "Incumbent communications. Telegraphs sponsorship strategy, PR framing, defensive positioning."},
    {"key": "ministry",       "name": "Ministry of the Interior Finland",          "category": "regulatory",        "url": "https://intermin.fi/en/arpajaishallinto",       "tier": 1, "note": "Core legislative layer. Implementation changes, amendments, advertising definitions."},
    {"key": "nordia_law",     "name": "Nordia Law",                                "category": "regulatory",        "url": "https://nordialaw.com",                          "tier": 2, "note": "Best practical explainer of the new Finnish gambling market regulation."},
    {"key": "jari_vahanen",   "name": "Jari Vähänen · Finnish Gambling Consultants", "category": "regulatory",      "url": "https://www.linkedin.com/in/jarivahanen/",       "tier": 1, "note": "Most important Finnish gambling-policy commentator. Affiliate restrictions, black-market risk, channelisation, regulatory realism."},
    {"key": "antti_koivula",  "name": "Antti Koivula · Hippos ATG",                "category": "regulatory",        "url": "https://www.linkedin.com/in/antti-koivula/",     "tier": 2, "note": "Operator/compliance commentator. Insight into how licensed betting will work locally."},
    {"key": "igb",            "name": "iGB · iGaming Business",                    "category": "regulatory",        "url": "https://igamingbusiness.com",                    "tier": 2, "note": "International trade publication covering Finnish licensing."},
    {"key": "next_io",        "name": "Next.io",                                   "category": "regulatory",        "url": "https://next.io",                                "tier": 3, "note": "Gambling industry trade publication with Finnish reform coverage."},

    # Sports media — Pulssi tracking + editorial seeds
    {"key": "jatkoaika",      "name": "Jatkoaika",            "category": "sports_media",     "url": "https://jatkoaika.com",         "tier": 1, "note": "Finnish hockey culture infrastructure. Liiga narratives, fan sentiment, transfer rumors."},
    {"key": "suomifutis",     "name": "Suomifutis",           "category": "sports_media",     "url": "https://suomifutis.com",        "tier": 2, "note": "Veikkausliiga narratives, football culture, betting-market-relevant news."},
    {"key": "urheilucast",    "name": "Urheilucast",          "category": "sports_media",     "url": "https://urheilucast.fi",        "tier": 3, "note": "Finnish sports-media personality ecosystem. Hot takes, gambling-adjacent narratives."},
    {"key": "yle_urheilu",    "name": "Yle Urheilu",          "category": "sports_media",     "url": "https://yle.fi/urheilu",        "tier": 2, "note": "Mainstream sports framing."},
    {"key": "il_urheilu",     "name": "Iltalehti Urheilu",    "category": "sports_media",     "url": "https://www.iltalehti.fi/urheilu", "tier": 2, "note": "Mainstream sports framing."},
    {"key": "is_urheilu",     "name": "Ilta-Sanomat Urheilu", "category": "sports_media",     "url": "https://www.is.fi/urheilu",     "tier": 2, "note": "Mainstream sports framing."},
    {"key": "mtv_urheilu",    "name": "MTV Urheilu",          "category": "sports_media",     "url": "https://www.mtvuutiset.fi/urheilu", "tier": 2, "note": "Mainstream sports framing."},

    # Streamer ecosystem data
    {"key": "twitchmetrics",  "name": "TwitchMetrics · Finnish Slots",             "category": "streamer_data",    "url": "https://www.twitchmetrics.net",                  "tier": 1, "note": "Primary Finnish Twitch slots roster reference. Followers, growth, partner status."},
    {"key": "streams_charts", "name": "Streams Charts",                            "category": "streamer_data",    "url": "https://streamscharts.com",                      "tier": 2, "note": "Kick + broader streamer ecosystem data."},
    {"key": "kick_profiles",  "name": "Kick.com profile pages",                    "category": "streamer_data",    "url": "https://kick.com",                               "tier": 2, "note": "Direct primary source for Kick streamers."},

    # Esports references
    {"key": "hltv",           "name": "HLTV",                                      "category": "esports",          "url": "https://www.hltv.org",                           "tier": 1, "note": "Counter-Strike Bloomberg terminal. Tournaments, rosters, rankings."},
    {"key": "liquipedia",     "name": "Liquipedia",                                "category": "esports",          "url": "https://liquipedia.net",                         "tier": 2, "note": "Esports roster + tournament structure + player history reference."},

    # Cultural references
    {"key": "rumba",          "name": "Rumba",                                     "category": "culture",          "url": "https://rumba.fi",                               "tier": 2, "note": "Finnish hip-hop music media."},
    {"key": "soundi",         "name": "Soundi",                                    "category": "culture",          "url": "https://soundi.fi",                              "tier": 3, "note": "Finnish music media."},
    {"key": "ylex",           "name": "YleX",                                      "category": "culture",          "url": "https://yle.fi/ylex",                            "tier": 3, "note": "Finnish youth culture media."},

    # Uniquely-Finnish coverage categories
    {"key": "casino_guru_fi", "name": "Casino Guru Finland",                       "category": "operator_signal",  "url": "https://casino.guru/fi",                         "tier": 2, "note": "Complaint tracking, player disputes, operator behavior. Enforcement-signal patterns, not affiliate value."},
]


async def seed_tracked_sources(db) -> None:
    """Idempotent seed of the named source map into `tracked_sources` collection.
    Existing rows are preserved (back-office may have edited them); only missing
    keys are inserted."""
    now_iso = datetime.now(timezone.utc).isoformat()
    for src in TRACKED_SOURCES:
        existing = await db.tracked_sources.find_one({"key": src["key"]})
        if not existing:
            await db.tracked_sources.insert_one({
                "id": str(uuid.uuid4()),
                **src,
                "active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
                "updated_by": "seed",
            })


async def list_sources(db, category: str | None = None) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {"active": True}
    if category:
        q["category"] = category
    cur = db.tracked_sources.find(q, {"_id": 0}).sort([("category", 1), ("tier", 1), ("key", 1)])
    return await cur.to_list(length=500)
