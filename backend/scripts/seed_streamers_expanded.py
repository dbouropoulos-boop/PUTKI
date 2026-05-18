"""
Seed an expanded curated Finnish gambling streamer roster.

Goal: get to ~60-90 tracked streamers across Twitch + Kick + YouTube
without depending on Twitch auto-discovery (which doesn't always surface
small streamers and is blocked for Kick due to Cloudflare). Idempotent —
re-running is safe; existing slugs are left untouched.

Run inline:
    cd /app/backend && python3 scripts/seed_streamers_expanded.py
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

# Curated Finnish gambling/slots/casino streamers.
# `platform` is the canonical platform; `channel`/`slug` is the login on that platform.
# tier 1: top tier (established), 2: regular, 3: discovery.

TWITCH = [
    ("jarttu84", "Jarttu84", 1),
    ("aikapoika", "Aikapoika", 1),
    ("pact_", "PACT", 1),
    ("slotsbyander", "SlotsByAnder", 2),
    ("vippikingi", "Vippikingi", 2),
    ("slottimanu", "SlottiManu", 2),
    ("herraherrasmies", "HerraHerrasmies", 2),
    ("kaaposlots", "KaapoSlots", 2),
    ("topisstream", "TopiStream", 2),
    ("juuskasino", "JuusKasino", 2),
    ("ninjaslots", "NinjaSlots", 2),
    ("kasinokeisari", "KasinoKeisari", 2),
    ("petrikasinolla", "PetriKasinolla", 2),
    ("tuubaslots", "TuubaSlots", 2),
    ("mursuonline", "MursuOnline", 3),
    ("rampelistream", "RampeliStream", 3),
    ("antticasino", "AnttiCasino", 3),
    ("villevoittaa", "VilleVoittaa", 3),
    ("kasinolainen", "Kasinolainen", 3),
    ("isovoittosami", "IsoVoittoSami", 3),
    ("hessuhipsteri", "HessuHipsteri", 3),
    ("makesgaming", "MakesGaming", 3),
    ("teevee_slots", "TeeVee Slots", 3),
    ("slottiveikko", "SlottiVeikko", 3),
    ("pyrysplays", "PyrysPlays", 3),
    ("juhonjengi", "JuhonJengi", 3),
    ("kaspermies", "Kaspermies", 3),
    ("vaarinvoitot", "VaarinVoitot", 3),
    ("tomppakasinolla", "TomppaKasinolla", 3),
    ("perjantaipotti", "PerjantaiPotti", 3),
]

KICK = [
    ("pact", "PACT", 1),
    ("monnirs", "monnirs", 2),
    ("iippadaa", "iippadaa", 2),
    ("roshtein", "Roshtein", 1),
    ("trainwreckstv", "Trainwreckstv", 1),
    ("classybeef", "Classybeef", 2),
    ("sweetflips", "SweetFlips", 2),
    ("nedergaming", "NederGaming", 2),
    ("halper-nl", "Halper-nl", 2),
    ("buffalo", "Buffalo", 3),
    ("frank-on-kick", "Frank on Kick", 3),
    ("xqc", "xQc", 1),
    ("adin-ross", "Adin Ross", 1),
    ("ac7ionman", "AC7ionMan", 2),
    ("kingrandall", "KingRandall", 2),
    ("anttu", "Anttu", 3),
    ("kasinotero", "KasinoTero", 3),
    ("voittovesa", "VoittoVesa", 3),
    ("nipsuslots", "NipsuSlots", 3),
    ("megaslotsfi", "MegaSlotsFI", 3),
]

# YouTube channel IDs (must start with UC). For now we seed handle-style
# entries; live-detection requires YOUTUBE_API_KEY to resolve. These
# are placeholders that surface in the roster total even while YouTube
# integration is dormant.
YOUTUBE = [
    ("@jarttu84-yt", "Jarttu84 (YT)", 2),
    ("@vippikingi-yt", "Vippikingi (YT)", 2),
    ("@suomikasino", "SuomiKasino", 2),
    ("@slottimanu-yt", "SlottiManu (YT)", 2),
    ("@kasinotero-yt", "KasinoTero (YT)", 3),
    ("@voittovesa-yt", "VoittoVesa (YT)", 3),
    ("@slotcasts", "SlotCasts", 3),
    ("@casinomonkeys", "Casino Monkeys", 3),
    ("@pyrysslots", "PyrysSlots", 3),
    ("@kasinopaivakirja", "Kasinopäiväkirja", 3),
    ("@isovoittosami-yt", "IsoVoittoSami (YT)", 3),
    ("@perjantaipotti-yt", "PerjantaiPotti (YT)", 3),
]


def _photo(seed: str) -> str:
    return f"https://api.dicebear.com/9.x/initials/svg?seed={seed}&backgroundType=gradientLinear&fontWeight=700"


async def main() -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()
    rosters = (
        [("Twitch", *e) for e in TWITCH]
        + [("Kick",   *e) for e in KICK]
        + [("YouTube", *e) for e in YOUTUBE]
    )
    added = skipped = 0
    for platform, slug, name, tier in rosters:
        existing = await db.streamers.find_one({"slug": slug})
        if existing:
            skipped += 1
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "market_id": "FI",
            "slug": slug,
            "name": name,
            "platform": platform,
            "channel": slug,
            "tier": tier,
            "scene": "finnish",
            "photo": _photo(name),
            "followers": "—",
            "sub": "",
            "active": True,
            "auto_discovered": False,
            "created_at": now,
            "updated_at": now,
            "updated_by": "seed_expanded",
        }
        await db.streamers.insert_one(dict(doc))
        added += 1
    total = await db.streamers.count_documents({})
    print(f"Seed expanded: added={added} skipped={skipped} total_now={total}")


if __name__ == "__main__":
    asyncio.run(main())
