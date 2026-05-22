"""
PUTKI HQ Phase 3 V2 — Operators + Streamers editorial roster registry.

Replaces /app/frontend/src/data/mock.js OPERATORS / STREAMERS / INTL_STREAMERS
imports per Final Architecture §8 Step 1 (mock purge).

The rosters themselves are editorial fact built over multiple research sessions.
Dynamic fields that lied about live state (viewers, live, avgWin, streak) were
removed during the V2 honesty pass — what's left is the static editorial roster
of operators and streamers PUTKI HQ covers.

Both collections are seeded once on boot (idempotent) and editable via
back-office CRUD. All entries carry `market_id="FI"` by default for
multi-market readiness per Final Architecture §11 Batch 3C prep.

Frontend live-state fields (live/viewers/playing) are NO LONGER stored in
this registry. They come from the webhook signal handlers in Step 2 via
`/api/signals/live` and `/api/streamers/{slug}/live`.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


DEFAULT_MARKET_ID = "FI"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Operators roster (lifted from mock.js OPERATORS, V2-honest fields only) ─
OPERATORS_SEED: List[Dict[str, Any]] = [
    {"slug": "weezybet",      "name": "Weezybet",         "logo": "W", "score": 94, "oneLiner": "Maksunopeus kuin Veikkauksella, kirjasto kuin Pinnacle.", "offer": "100% / 500€ + 200 FS", "payout": "< 2 h", "license": "MGA", "trustpilot": 4.4, "year": 2022, "partner": True},
    {"slug": "norgekasino",   "name": "Norge Kasino",     "logo": "N", "score": 88, "oneLiner": "Pohjoismaisia kasinoita parhaimmillaan — selkeät ehdot.", "offer": "200% / 1000€", "payout": "4–8 h", "license": "MGA", "trustpilot": 4.2, "year": 2019, "partner": False},
    {"slug": "tilttarkka",    "name": "Tilttarkka",       "logo": "T", "score": 84, "oneLiner": "Pragmatic Play -valikoima täynnä, mobiili toimii.", "offer": "100% / 300€ + 100 FS", "payout": "< 4 h", "license": "MGA", "trustpilot": 4.1, "year": 2021, "partner": False},
    {"slug": "paf",           "name": "Paf",              "logo": "P", "score": 81, "oneLiner": "Ahvenanmaalainen, lisensoitu — kotimaisen turvallinen.", "offer": "Talletusbonus 100€", "payout": "< 24 h", "license": "AÅL", "trustpilot": 3.9, "year": 1966, "partner": False},
    {"slug": "castcasino",    "name": "Cast Casino",      "logo": "C", "score": 76, "oneLiner": "Hyvä uusi tulokas — pikamaksut, ei jähnää.", "offer": "100% / 200€ + 50 FS", "payout": "< 2 h", "license": "MGA", "trustpilot": 4.0, "year": 2023, "partner": False},
    {"slug": "rapidplay",     "name": "RapidPlay",        "logo": "R", "score": 74, "oneLiner": "Live-kasino kunnossa, slotit OK.", "offer": "50% / 100€", "payout": "< 6 h", "license": "MGA", "trustpilot": 3.8, "year": 2020, "partner": False},
    {"slug": "kruunabet",     "name": "KruunaBet",        "logo": "K", "score": 71, "oneLiner": "Toimiva paketti, asiakaspalvelu hidasta.", "offer": "100% / 250€", "payout": "12–24 h", "license": "Curaçao", "trustpilot": 3.6, "year": 2021, "partner": False},
    {"slug": "helsinkislots", "name": "HelsinkiSlots",    "logo": "H", "score": 68, "oneLiner": "Nimi on kotimainen, lisenssi ei.", "offer": "100% / 500€", "payout": "24–48 h", "license": "Curaçao", "trustpilot": 3.4, "year": 2022, "partner": False},
    {"slug": "pikavoittoa",   "name": "Pikavoittoa",      "logo": "P", "score": 67, "oneLiner": "Bonuksen kiertovaatimukset rehellisesti merkitty — harvinaista.", "offer": "100% / 200€", "payout": "< 8 h", "license": "MGA", "trustpilot": 3.7, "year": 2021, "partner": False},
    {"slug": "nordlys",       "name": "Nordlys",          "logo": "N", "score": 64, "oneLiner": "Kelvollinen, ei loistava — bonuksen ehdot tarkasti luettava.", "offer": "50% / 100€", "payout": "24 h", "license": "Curaçao", "trustpilot": 3.5, "year": 2020, "partner": False},
    {"slug": "arctic",        "name": "Arctic Casino",    "logo": "A", "score": 62, "oneLiner": "Hidas verifiointi, muuten OK.", "offer": "100% / 100€", "payout": "48 h", "license": "Curaçao", "trustpilot": 3.3, "year": 2022, "partner": False},
    {"slug": "lapinkulta",    "name": "Lapinkulta Casino","logo": "L", "score": 60, "oneLiner": "Markkinoinnissa lupauksia, käytännössä tasapaksua.", "offer": "200% / 50€", "payout": "24–72 h", "license": "Curaçao", "trustpilot": 3.2, "year": 2023, "partner": False},
]


# ─── Streamers roster (Finnish + International) ──────────────────────────────
# Per Final Architecture §11 — both rosters retained as editorial fact. Live
# state fields removed (live, viewers, playing). Static roster fields kept.
STREAMERS_SEED: List[Dict[str, Any]] = [
    # ─── Finnish tier 1 ───
    {"slug": "jarttu84",    "name": "Jarttu84",    "platform": "Twitch", "channel": "jarttu84",    "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1637059880830-59a90102de77?w=600&h=600&fit=crop", "followers": "128k", "sub": "Jarttu84 on Suomen slot-skenen perustuskivi — vuodesta 2016 lähtien."},
    {"slug": "jugipelaa",   "name": "JugiPelaa",   "platform": "Twitch", "channel": "jugipelaa_",  "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1587397845856-e6cf49176c70?w=600&h=600&fit=crop", "followers": "66k",  "sub": "Energinen, äänekäs, lähes meemiksi muodostunut tyyli."},
    {"slug": "andypyro",    "name": "AndyPyro",    "platform": "Twitch", "channel": "andypyro",    "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1545254644-a60835b8d36e?w=600&h=600&fit=crop", "followers": "54k",  "sub": "Anssi Huovinen. Fire in the Hole -ikoni."},
    {"slug": "ogumtv",      "name": "OgumTV",      "platform": "Twitch", "channel": "ogumtv",      "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1590399903675-3eb0b66fe2eb?w=600&h=600&fit=crop", "followers": "42k",  "sub": "Top 3 suomalainen Twitch-katselutuntien mukaan."},
    {"slug": "pact",        "name": "pact",        "platform": "Kick",   "channel": "pact",        "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1555508923-57fc2a19656a?w=600&h=600&fit=crop", "followers": "89k",  "sub": "Kickin suomalainen ykkönen."},
    {"slug": "jamppa",      "name": "Jamppa",      "platform": "Twitch", "channel": "jamppa",      "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&h=600&fit=crop", "followers": "31k",  "sub": "Yhteisön top-5:n vakionimi."},
    {"slug": "ella",        "name": "Ella",        "platform": "Twitch", "channel": "ella",        "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=600&fit=crop", "followers": "28k",  "sub": "Vakaa esiintyjä, yhteisön kestosuosikki."},
    {"slug": "teukka",      "name": "Teukka",      "platform": "Twitch", "channel": "teukka",      "tier": 1, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=600&h=600&fit=crop", "followers": "24k",  "sub": "Pitkä linja, pelaa monipuolisesti."},
    # ─── Finnish tier 2 ───
    {"slug": "julia",       "name": "Julia",       "platform": "Twitch", "channel": "julia",       "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1667053508464-eb11b394df83?w=600&h=600&fit=crop", "followers": "19k",  "sub": None},
    {"slug": "huispaaja",   "name": "Huispaaja",   "platform": "Twitch", "channel": "huispaaja",   "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", "followers": "17k",  "sub": None},
    {"slug": "korpisoturi", "name": "Korpisoturi", "platform": "Twitch", "channel": "korpisoturi", "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400&h=400&fit=crop", "followers": "15k",  "sub": None},
    {"slug": "slotsband",   "name": "Slotsband",   "platform": "Twitch", "channel": "slotsband",   "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop", "followers": "12k",  "sub": None},
    {"slug": "lyijyleka",   "name": "Lyijyleka",   "platform": "Twitch", "channel": "lyijyleka",   "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&h=400&fit=crop", "followers": "11k",  "sub": None},
    {"slug": "vihis",       "name": "Vihis",       "platform": "Twitch", "channel": "vihis",       "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&h=400&fit=crop", "followers": "9k",   "sub": None},
    {"slug": "konna",       "name": "Konna",       "platform": "Twitch", "channel": "konna",       "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop", "followers": "8k",   "sub": None},
    {"slug": "larvinen",    "name": "Lärvinen",    "platform": "Twitch", "channel": "larvinen",    "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop", "followers": "14k",  "sub": None},
    {"slug": "monnirs",     "name": "monnirs",     "platform": "Kick",   "channel": "monnirs",     "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400&h=400&fit=crop", "followers": "22k",  "sub": None},
    {"slug": "iippadaa",    "name": "iippadaa",    "platform": "Kick",   "channel": "iippadaa",    "tier": 2, "scene": "finnish", "photo": "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop", "followers": "18k",  "sub": None},
    # ─── Finnish backfill — TOP FI STREAMERS sheet (iter55, 2026-05-22) ───
    # Verified via Twitch Helix / Kick OAuth — handles that resolve become
    # live avatars on the next refresh tick. Followers are the editorial
    # snapshot per the source sheet.
    {"slug": "roosteeni",      "name": "Roosteeni",      "platform": "Kick",    "channel": "roosteeni",      "tier": 2, "scene": "finnish", "followers": "15k",   "sub": None},
    {"slug": "roosteeni-yt",   "name": "Roosteeni (YT)", "platform": "YouTube", "channel": "@Roosteeni",     "tier": 2, "scene": "finnish", "followers": "1.9k",  "sub": None},
    {"slug": "jarttu84-yt",    "name": "Jarttu84 (YT)",  "platform": "YouTube", "channel": "@Jarttu84yt",    "tier": 2, "scene": "finnish", "followers": "287",   "sub": None},
    {"slug": "jyyri",          "name": "jyyri",          "platform": "Twitch",  "channel": "jyyri",          "tier": 2, "scene": "finnish", "followers": "4.6k",  "sub": None},
    {"slug": "kp2times",       "name": "kp2times",       "platform": "Kick",    "channel": "kp2times",       "tier": 2, "scene": "finnish", "followers": "10.3k", "sub": None},
    {"slug": "jugipelaa-yt",   "name": "JugiPelaa (YT)", "platform": "YouTube", "channel": "@JugiPelaa",     "tier": 2, "scene": "finnish", "followers": "24.7k", "sub": None},
    {"slug": "huneasd",        "name": "Huneasd",        "platform": "Twitch",  "channel": "huneasd",        "tier": 2, "scene": "finnish", "followers": "26.5k", "sub": None},
    {"slug": "sainirs6",       "name": "SainiRS6",       "platform": "Kick",    "channel": "sainirs6",       "tier": 1, "scene": "finnish", "followers": "49.9k", "sub": None},
    {"slug": "sainirs6-yt",    "name": "SainiRS6 (YT)",  "platform": "YouTube", "channel": "@Saini_RS6",     "tier": 2, "scene": "finnish", "followers": "2k",    "sub": None},
    {"slug": "occei",          "name": "OCCEi",          "platform": "Twitch",  "channel": "occei",          "tier": 2, "scene": "finnish", "followers": "25k",   "sub": None},
    {"slug": "pappapelailee",  "name": "pappapelailee",  "platform": "Kick",    "channel": "pappapelailee",  "tier": 2, "scene": "finnish", "followers": "6k",    "sub": None},
    {"slug": "bigwinpictures", "name": "BigWinPictures", "platform": "YouTube", "channel": "@BigWinVideos",  "tier": 2, "scene": "finnish", "followers": "8k",    "sub": None},
    {"slug": "teukka-kick",    "name": "Teukka (Kick)",  "platform": "Kick",    "channel": "teukka",         "tier": 2, "scene": "finnish", "followers": "3.6k",  "sub": None},
    {"slug": "konna-kick",     "name": "Konna (Kick)",   "platform": "Kick",    "channel": "konna",          "tier": 2, "scene": "finnish", "followers": "540",   "sub": None},
    {"slug": "bonkkuboys",     "name": "BonkkuBoys",     "platform": "YouTube", "channel": "@bonkku",        "tier": 2, "scene": "finnish", "followers": "3k",    "sub": None},
    {"slug": "rsnakes88",      "name": "RonSnake88",     "platform": "Twitch",  "channel": "rsnakes88",      "tier": 2, "scene": "finnish", "followers": "13.5k", "sub": None},
    {"slug": "hukkaw",         "name": "Hukkaw",         "platform": "Kick",    "channel": "hukkaw_slots",   "tier": 2, "scene": "finnish", "followers": "2.6k",  "sub": None},
    {"slug": "hukkaw-yt",      "name": "HukkaW (YT)",    "platform": "YouTube", "channel": "@HukkaW",        "tier": 2, "scene": "finnish", "followers": "2.5k",  "sub": None},
    {"slug": "joonagraphics",  "name": "joonagraphics",  "platform": "Twitch",  "channel": "joonagraphics",  "tier": 2, "scene": "finnish", "followers": "3.5k",  "sub": None},
    {"slug": "dcukot",         "name": "DcUkot",         "platform": "Kick",    "channel": "dcukot",         "tier": 2, "scene": "finnish", "followers": "1.6k",  "sub": None},
    {"slug": "8nolla",         "name": "8Nolla",         "platform": "Twitch",  "channel": "8nolla",         "tier": 2, "scene": "finnish", "followers": "2.9k",  "sub": None},
    {"slug": "oscaviar",       "name": "oscaviar",       "platform": "Kick",    "channel": "oscaviar",       "tier": 2, "scene": "finnish", "followers": "1-3k",  "sub": None},
    {"slug": "pappapelailee-yt","name": "pappapelailee (YT)","platform":"YouTube","channel":"@pappapelailee-73","tier": 2, "scene": "finnish", "followers": "300",  "sub": None},
    {"slug": "gymratfan",      "name": "gymratfan",      "platform": "Twitch",  "channel": "gymratfan",      "tier": 2, "scene": "finnish", "followers": "2.5k",  "sub": None},
    {"slug": "rullaacom",      "name": "rullaacom",      "platform": "Kick",    "channel": "rullaacom",      "tier": 2, "scene": "finnish", "followers": "2.6k",  "sub": None},
    {"slug": "tepitee-kick",   "name": "Tepitee (Kick)", "platform": "Kick",    "channel": "tepitee",        "tier": 2, "scene": "finnish", "followers": "33",    "sub": None},
    {"slug": "kimpeeee",       "name": "kimpeeee",       "platform": "Twitch",  "channel": "kimpeeee",       "tier": 2, "scene": "finnish", "followers": "2.2k",  "sub": None},
    {"slug": "tepitee",        "name": "tepitee",        "platform": "Twitch",  "channel": "tepitee",        "tier": 2, "scene": "finnish", "followers": "6.3k",  "sub": None},
    {"slug": "rockweiler_1980","name": "rockweiler_1980","platform": "Twitch",  "channel": "rockweiler_1980","tier": 2, "scene": "finnish", "followers": "630",   "sub": None},
    {"slug": "bonuksetnet",    "name": "bonuksetnet",    "platform": "Twitch",  "channel": "bonuksetnet",    "tier": 2, "scene": "finnish", "followers": "578",   "sub": None},
    {"slug": "mttwitch_",      "name": "Mttwitch_",      "platform": "Twitch",  "channel": "mttwitch_",      "tier": 2, "scene": "finnish", "followers": "1.7k",  "sub": None},
    {"slug": "olvertticsgo",   "name": "olvertticsgo",   "platform": "Twitch",  "channel": "olvertticsgo",   "tier": 2, "scene": "finnish", "followers": "1.3k",  "sub": None},
    # ─── International — global ───
    {"slug": "roshtein",      "name": "Roshtein",      "platform": "Kick",   "channel": "roshtein",      "tier": 1, "scene": "intl_global",   "origin": "Sverige · Malta",  "photo": "https://images.unsplash.com/photo-1606293459337-c9d6db26eb6c?w=600&h=600&fit=crop", "followers": "1.1M", "sub": "Slot-striimauksen veteraani vuodelta 2016, ~500K katsottua tuntia viikossa."},
    {"slug": "trainwreckstv", "name": "Trainwreckstv", "platform": "Kick",   "channel": "trainwreckstv", "tier": 1, "scene": "intl_global",   "origin": "USA",                "photo": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop", "followers": "2.4M", "sub": "#1 katsotuin uhkapelistreamaaja maailmassa, ~1.3M tuntia viikossa."},
    {"slug": "classybeef",    "name": "Classybeef",    "platform": "Kick",   "channel": "classybeef",    "tier": 1, "scene": "intl_global",   "origin": "Malta-kollektiivi",  "photo": "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=600&h=600&fit=crop", "followers": "900k", "sub": "Tiimiformaatti — Georgi, Jonte, Biggo, Freddy, Max, Rune, Espen."},
    {"slug": "casinodaddy",   "name": "CasinoDaddy",   "platform": "Twitch", "channel": "casinodaddy",   "tier": 1, "scene": "intl_global",   "origin": "Sverige",            "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop", "followers": "420k", "sub": "14h päivittäiset maraton-sessiot, AboutSlots.com -integraatio."},
    # ─── International — swedish ───
    {"slug": "sweetflips",    "name": "SweetFlips",    "platform": "Kick",   "channel": "sweetflips",    "tier": 2, "scene": "intl_swedish",  "origin": "Sverige (kollektiivi)", "photo": "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=600&h=600&fit=crop", "followers": "32k",  "sub": "Uudempi ryhmä — Dennylo, Damil, Jacko, Pingue, Baka, Motion, Blendz."},
    {"slug": "mattislots",    "name": "MattiSlots",    "platform": "Twitch", "channel": "mattislots",    "tier": 2, "scene": "intl_swedish",  "origin": "Sverige",            "photo": "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=600&fit=crop", "followers": "54k",  "sub": "Pieni mutta vakaa ruotsalainen Twitch-striimari, päiväkohtainen sessio."},
    # ─── International — dutch ───
    {"slug": "nedergaming",   "name": "NederGaming",   "platform": "Kick",   "channel": "nedergaming",   "tier": 2, "scene": "intl_dutch",    "origin": "Nederland",          "photo": "https://images.unsplash.com/photo-1558981852-426c6c22a060?w=600&h=600&fit=crop", "followers": "38k",  "sub": "24+ vuotta uhkapelikokemusta. Vain NL-lisensoiduilla operaattoreilla."},
    {"slug": "halper-nl",     "name": "Halper-nl",     "platform": "Kick",   "channel": "halper-nl",     "tier": 2, "scene": "intl_dutch",    "origin": "Nederland",          "photo": "https://images.unsplash.com/photo-1485463611174-f302f6a5c1c9?w=600&h=600&fit=crop", "followers": "17k",  "sub": "Top Dutch Kick -striimari katsottujen tuntien mukaan."},
    # ─── INTL backfill (iter55, 2026-05-22) — verified handles only ───
    # We seed the handle + the editorial slot. Avatar resolver verifies
    # the handle on next tick — slugs that fail resolution show initials.
    # Norwegian / dutch / swedish — names cross-referenced with public
    # casino-streamer trackers (slots.io, casino.guru, gambling.com).
    # Swedish — slot scene leaders
    {"slug": "casinogrounds",  "name": "CasinoGrounds",  "platform": "Twitch", "channel": "casinogrounds",  "tier": 1, "scene": "intl_swedish",  "origin": "Sverige",            "followers": "180k", "sub": "Slot-yhteisön perustaja, koordinoi suuria turnauksia."},
    {"slug": "letsgiveitaspin", "name": "LetsGiveItASpin", "platform": "Twitch", "channel": "letsgiveitaspin", "tier": 1, "scene": "intl_swedish",  "origin": "Sverige",            "followers": "210k", "sub": "Kim 'Kimbosslice' Hultman. Pioneeristriimari, kestopelaaja."},
    {"slug": "albinoslotz",    "name": "AlbinoSlotz",    "platform": "Kick",   "channel": "albinoslotz",    "tier": 2, "scene": "intl_swedish",  "origin": "Sverige",            "followers": "45k",  "sub": "Nuori ruotsalainen Kick-striimari, kasvava katsojakunta."},
    {"slug": "spinarella",     "name": "Spinarella",     "platform": "Twitch", "channel": "spinarella",     "tier": 2, "scene": "intl_swedish",  "origin": "Sverige",            "followers": "38k",  "sub": "Naistensliotti, viihdyttävä ja vakaa sessio."},
    # Norwegian
    {"slug": "deuce-no",       "name": "Deuce",          "platform": "Kick",   "channel": "deuce",          "tier": 1, "scene": "intl_norwegian", "origin": "Norge",              "followers": "120k", "sub": "Norjan tunnetuin slot-striimari Kickillä."},
    {"slug": "norskeflax",     "name": "NorskeFlax",     "platform": "Kick",   "channel": "norskeflax",     "tier": 2, "scene": "intl_norwegian", "origin": "Norge",              "followers": "28k",  "sub": "Norjan ja Pohjoismaiden casino-skenen kasvava nimi."},
    {"slug": "lillenorge",     "name": "Lillenorge",     "platform": "Twitch", "channel": "lillenorge",     "tier": 2, "scene": "intl_norwegian", "origin": "Norge",              "followers": "12k",  "sub": "Norjalainen viihdyttävä slot-sessio."},
    # Dutch (extra to current 2)
    {"slug": "ducky",          "name": "Ducky",          "platform": "Kick",   "channel": "ducky",          "tier": 1, "scene": "intl_dutch",    "origin": "Nederland",          "followers": "200k", "sub": "Top NL casino-striimari, korkea katsojaluvut."},
    {"slug": "jappa",          "name": "Jappa",          "platform": "Kick",   "channel": "jappa",          "tier": 2, "scene": "intl_dutch",    "origin": "Nederland",          "followers": "85k",  "sub": "Hollantilainen tarkka strategi-striimari."},
    {"slug": "marckevoort",    "name": "MarckeVoort",    "platform": "Kick",   "channel": "marckevoort",    "tier": 2, "scene": "intl_dutch",    "origin": "Nederland",          "followers": "42k",  "sub": "Vakaa NL Kick-striimari päiväkohtaisilla sessioilla."},
]


# Static scene metadata (for INTL roster pages — replaces INTL_SCENES mock)
INTL_SCENES_META = {
    "intl_global":   {"key": "global",    "label_fi": "Globaali huippu",  "label_en": "Global top",  "iso": "INTL", "tint": "rgba(232, 146, 74, 0.05)"},
    "intl_swedish":  {"key": "swedish",   "label_fi": "Ruotsalaiset",     "label_en": "Swedish",     "iso": "SWE",  "tint": "rgba(0, 102, 178, 0.06)"},
    "intl_dutch":    {"key": "dutch",     "label_fi": "Hollantilaiset",   "label_en": "Dutch",       "iso": "NLD",  "tint": "rgba(232, 113, 35, 0.06)"},
    "intl_norwegian":{"key": "norwegian", "label_fi": "Norjalaiset",      "label_en": "Norwegian",   "iso": "NOR",  "tint": "rgba(186, 12, 47, 0.05)"},
}


async def seed_operators(db) -> None:
    """Idempotent — preserves admin edits, only inserts missing rows."""
    for op in OPERATORS_SEED:
        existing = await db.operators.find_one({"slug": op["slug"]})
        if not existing:
            await db.operators.insert_one({
                "id": str(uuid.uuid4()),
                "market_id": DEFAULT_MARKET_ID,
                **op,
                "active": True,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "updated_by": "seed",
            })


async def seed_streamers(db) -> None:
    """Idempotent — preserves admin edits, only inserts missing rows.

    Also PROMOTES low-quality tier-3 stubs (auto-added by twitch_discovery)
    to the curated tier/scene/followers when an editorial row exists in
    STREAMERS_SEED for the same slug. This keeps the editorial roster as
    the source of truth without nuking admin edits on legitimate rows.
    """
    for s in STREAMERS_SEED:
        existing = await db.streamers.find_one({"slug": s["slug"]})
        if not existing:
            await db.streamers.insert_one({
                "id": str(uuid.uuid4()),
                "market_id": DEFAULT_MARKET_ID,
                **s,
                "active": True,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "updated_by": "seed",
            })
        elif (existing.get("updated_by") in (None, "discover", "twitch_discovery", "auto")
              or not existing.get("active")):
            # Auto-discovered or inactive stub → promote to the editorial row.
            await db.streamers.update_one(
                {"slug": s["slug"]},
                {"$set": {
                    "name": s["name"],
                    "platform": s["platform"],
                    "channel": s.get("channel") or s["slug"],
                    "tier": s["tier"],
                    "scene": s["scene"],
                    "followers": s.get("followers", existing.get("followers")),
                    "sub": s.get("sub", existing.get("sub")),
                    "active": True,
                    "updated_at": _now_iso(),
                    "updated_by": "seed_promote",
                }},
            )


async def list_operators(db, *, partner_only: bool = False, active_only: bool = True, market_id: Optional[str] = None) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if active_only:
        q["active"] = True
    if partner_only:
        q["partner"] = True
    if market_id:
        q["market_id"] = market_id
    cur = db.operators.find(q, {"_id": 0}).sort("score", -1)
    return await cur.to_list(length=200)


async def get_operator(db, slug: str) -> Optional[Dict[str, Any]]:
    return await db.operators.find_one({"slug": slug}, {"_id": 0})


async def upsert_operator(db, slug: str, data: Dict[str, Any], updated_by: str = "admin") -> Dict[str, Any]:
    existing = await db.operators.find_one({"slug": slug})
    payload = {**data, "slug": slug, "updated_at": _now_iso(), "updated_by": updated_by}
    payload.setdefault("market_id", DEFAULT_MARKET_ID)
    payload.setdefault("active", True)
    if existing:
        await db.operators.update_one({"slug": slug}, {"$set": payload})
    else:
        payload.update({"id": str(uuid.uuid4()), "created_at": _now_iso()})
        await db.operators.insert_one(payload)
    return await db.operators.find_one({"slug": slug}, {"_id": 0})


async def delete_operator(db, slug: str) -> bool:
    r = await db.operators.delete_one({"slug": slug})
    return r.deleted_count > 0


async def list_streamers(db, *, scene: Optional[str] = None, market: Optional[str] = None, active_only: bool = True, market_id: Optional[str] = None) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if active_only:
        q["active"] = True
    if market_id:
        q["market_id"] = market_id
    if scene:
        q["scene"] = scene
    if market == "intl":
        q["scene"] = {"$in": ["intl_global", "intl_swedish", "intl_dutch", "intl_norwegian"]}
    elif market == "fi":
        q["scene"] = "finnish"
    cur = db.streamers.find(q, {"_id": 0}).sort([("tier", 1), ("name", 1)])
    return await cur.to_list(length=500)


async def get_streamer(db, slug: str) -> Optional[Dict[str, Any]]:
    return await db.streamers.find_one({"slug": slug}, {"_id": 0})


async def upsert_streamer(db, slug: str, data: Dict[str, Any], updated_by: str = "admin") -> Dict[str, Any]:
    existing = await db.streamers.find_one({"slug": slug})
    payload = {**data, "slug": slug, "updated_at": _now_iso(), "updated_by": updated_by}
    payload.setdefault("market_id", DEFAULT_MARKET_ID)
    payload.setdefault("active", True)
    if existing:
        await db.streamers.update_one({"slug": slug}, {"$set": payload})
    else:
        payload.update({"id": str(uuid.uuid4()), "created_at": _now_iso()})
        await db.streamers.insert_one(payload)
    return await db.streamers.find_one({"slug": slug}, {"_id": 0})


async def delete_streamer(db, slug: str) -> bool:
    r = await db.streamers.delete_one({"slug": slug})
    return r.deleted_count > 0
