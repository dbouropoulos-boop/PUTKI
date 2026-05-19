"""
PUTKI HQ — Slot registry + extraction (Phase 1 sprint follow-up).

Editorial reads stream titles and extracts which slot game is being played
right now across the tracked live streamers. The data is surfaced as the
homepage "PELISSÄ NYT / NOW PLAYING" ticker and as the click-to-filter
mechanism on the streamer band.

Matching rules (per user spec)
------------------------------
Longest-match-wins. When the registry contains overlapping variants
(`Sugar Rush 1000` vs `Sugar Rush`, `Gates of Olympus 1000` vs
`Gates of Olympus`, `Big Bass Splash` vs `Big Bass Bonanza`), the most
specific (longest name) variant matches first. Sorting registry by name
length descending before matching achieves this without a real trie.

A registry entry is **enabled** by default; setting `enabled: false`
keeps the editorial record but excludes it from live matching.

Both reel slots and live tables share the same registry — the ticker
treats them uniformly per `Q1: a` from the spec lock-in.

Public functions
----------------
    seed_default_registry(db)       — idempotent bulk-insert of the
                                      editorially-approved seed list
                                      (called once on FastAPI startup)
    list_registry(db, include_disabled=False) → list[dict]
    add_entry(db, name, category, …) → dict
    update_entry(db, entry_id, …) → dict | None
    delete_entry(db, entry_id) → bool
    extract_now_playing(db, live_streamers) → list[dict]
        — per-slot counts + per-slot streamer handles, sorted desc
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

CATEGORY_SLOT = "slot"
CATEGORY_LIVE_TABLE = "live_table"
CATEGORIES = {CATEGORY_SLOT, CATEGORY_LIVE_TABLE}

# Editorially-approved seed list (Sprint follow-up · 2026-05-19).
# Order doesn't matter — extraction sorts by name length desc at match time.
DEFAULT_REGISTRY: List[Dict[str, str]] = [
    # ── Pragmatic Play ─────────────────────────────────────────────────
    {"name": "Sweet Bonanza",                "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Sugar Rush",                   "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Sugar Rush 1000",              "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Gates of Olympus",             "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Gates of Olympus 1000",        "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Big Bass Bonanza",             "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Big Bass Splash",              "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Big Bass Hold & Spinner",      "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Starlight Princess",           "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "The Dog House",                "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Fruit Party",                  "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Wild West Gold",               "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "Madame Destiny Megaways",      "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},
    {"name": "John Hunter and the Tomb of the Scarab Queen", "category": CATEGORY_SLOT, "provider": "Pragmatic Play"},

    # ── Nolimit City ───────────────────────────────────────────────────
    {"name": "Tombstone R.I.P.",             "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Mental",                       "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Mental 2",                     "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Punk Toilet",                  "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Fire in the Hole",             "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "San Quentin",                  "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Misery Mining",                "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Outsourced",                   "category": CATEGORY_SLOT, "provider": "Nolimit City"},
    {"name": "Pirots",                       "category": CATEGORY_SLOT, "provider": "Nolimit City"},

    # ── Push Gaming ────────────────────────────────────────────────────
    {"name": "Razor Shark",                  "category": CATEGORY_SLOT, "provider": "Push Gaming"},
    {"name": "Razor Returns",                "category": CATEGORY_SLOT, "provider": "Push Gaming"},
    {"name": "Wild Swarm",                   "category": CATEGORY_SLOT, "provider": "Push Gaming"},
    {"name": "Jammin' Jars",                 "category": CATEGORY_SLOT, "provider": "Push Gaming"},
    {"name": "Jammin' Jars 2",               "category": CATEGORY_SLOT, "provider": "Push Gaming"},
    {"name": "The Shadow Order",             "category": CATEGORY_SLOT, "provider": "Push Gaming"},
    {"name": "Mystery Museum",               "category": CATEGORY_SLOT, "provider": "Push Gaming"},

    # ── Hacksaw Gaming ─────────────────────────────────────────────────
    {"name": "Hand of Anubis",               "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "Le Bandit",                    "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "Wanted Dead or a Wild",        "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "RIP City",                     "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "Stick 'em",                    "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "Chaos Crew",                   "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "Bompers",                      "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "Cubes 2",                      "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},
    {"name": "The Borgias",                  "category": CATEGORY_SLOT, "provider": "Hacksaw Gaming"},

    # ── Play'n GO ──────────────────────────────────────────────────────
    {"name": "Reactoonz",                    "category": CATEGORY_SLOT, "provider": "Play'n GO"},
    {"name": "Reactoonz 2",                  "category": CATEGORY_SLOT, "provider": "Play'n GO"},
    {"name": "Book of Dead",                 "category": CATEGORY_SLOT, "provider": "Play'n GO"},
    {"name": "Rich Wilde and the Tome of Madness", "category": CATEGORY_SLOT, "provider": "Play'n GO"},

    # ── Relax / ELK / Other ────────────────────────────────────────────
    {"name": "Money Train 2",                "category": CATEGORY_SLOT, "provider": "Relax Gaming"},
    {"name": "Money Train 3",                "category": CATEGORY_SLOT, "provider": "Relax Gaming"},
    {"name": "Money Train 4",                "category": CATEGORY_SLOT, "provider": "Relax Gaming"},
    {"name": "Hugo's Adventure",             "category": CATEGORY_SLOT, "provider": "Play'n GO"},
    {"name": "Iron Bank",                    "category": CATEGORY_SLOT, "provider": "Relax Gaming"},
    {"name": "The Wild Class",               "category": CATEGORY_SLOT, "provider": "Relax Gaming"},

    # ── NetEnt ─────────────────────────────────────────────────────────
    {"name": "Dead or Alive 2",              "category": CATEGORY_SLOT, "provider": "NetEnt"},
    {"name": "Gonzo's Quest",                "category": CATEGORY_SLOT, "provider": "NetEnt"},

    # ── Live tables (Evolution / Pragmatic Live) ───────────────────────
    {"name": "Live Roulette",                "category": CATEGORY_LIVE_TABLE, "provider": "Evolution"},
    {"name": "Crazy Time",                   "category": CATEGORY_LIVE_TABLE, "provider": "Evolution"},
    {"name": "Lightning Roulette",           "category": CATEGORY_LIVE_TABLE, "provider": "Evolution"},
    {"name": "Monopoly Live",                "category": CATEGORY_LIVE_TABLE, "provider": "Evolution"},
    {"name": "Mega Ball",                    "category": CATEGORY_LIVE_TABLE, "provider": "Evolution"},
]

# Stream categories that are NEVER slot streams. If a streamer's
# `game_name` is one of these AND no slot name matches the title, we
# return zero match — the streamer simply isn't running gambling content
# right now.
NON_SLOT_CATEGORIES = {
    "just chatting", "irl", "music", "talk shows & podcasts",
    "art", "software and game development", "esports",
}


# ── DB helpers ────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> None:
    await db.slot_registry.create_index("name_lower", unique=True)
    await db.slot_registry.create_index("enabled")


async def seed_default_registry(db) -> Dict[str, int]:
    """Idempotent — every default entry is upserted by `name_lower`. Existing
    rows (with manual edits / disabled state) are left untouched."""
    now = datetime.now(timezone.utc).isoformat()
    inserted = 0
    for row in DEFAULT_REGISTRY:
        key = row["name"].lower().strip()
        existing = await db.slot_registry.find_one({"name_lower": key})
        if existing:
            continue
        await db.slot_registry.insert_one({
            "id": uuid.uuid4().hex,
            "name": row["name"],
            "name_lower": key,
            "category": row["category"],
            "provider": row.get("provider", ""),
            "enabled": True,
            "created_at": now,
            "created_by": "seed",
        })
        inserted += 1
    total = await db.slot_registry.count_documents({})
    return {"inserted": inserted, "total": total}


async def list_registry(db, include_disabled: bool = True) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {} if include_disabled else {"enabled": True}
    cur = db.slot_registry.find(q, {"_id": 0}).sort([("category", 1), ("name", 1)])
    return [doc async for doc in cur]


async def add_entry(db, *, name: str, category: str,
                    provider: str = "", enabled: bool = True,
                    created_by: str = "admin") -> Dict[str, Any]:
    name = (name or "").strip()
    if not name:
        raise ValueError("name required")
    if category not in CATEGORIES:
        raise ValueError(f"category must be one of {sorted(CATEGORIES)}")
    key = name.lower()
    if await db.slot_registry.find_one({"name_lower": key}):
        raise ValueError("entry already exists")
    doc = {
        "id": uuid.uuid4().hex,
        "name": name,
        "name_lower": key,
        "category": category,
        "provider": provider.strip(),
        "enabled": bool(enabled),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": created_by,
    }
    await db.slot_registry.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


async def update_entry(db, entry_id: str, *,
                       enabled: Optional[bool] = None,
                       category: Optional[str] = None,
                       provider: Optional[str] = None) -> Optional[Dict[str, Any]]:
    update: Dict[str, Any] = {}
    if enabled is not None:
        update["enabled"] = bool(enabled)
    if category is not None:
        if category not in CATEGORIES:
            raise ValueError(f"category must be one of {sorted(CATEGORIES)}")
        update["category"] = category
    if provider is not None:
        update["provider"] = provider.strip()
    if not update:
        return None
    r = await db.slot_registry.find_one_and_update(
        {"id": entry_id}, {"$set": update}, return_document=True, projection={"_id": 0},
    )
    return r


async def delete_entry(db, entry_id: str) -> bool:
    r = await db.slot_registry.delete_one({"id": entry_id})
    return r.deleted_count > 0


# ── Matching / extraction ────────────────────────────────────────────────

def _build_match_index(registry: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort enabled entries by name length desc so longer/more-specific
    variants match before their shorter parents (`Sugar Rush 1000` wins
    over `Sugar Rush`)."""
    return sorted(
        [r for r in registry if r.get("enabled", True)],
        key=lambda r: len(r["name"]),
        reverse=True,
    )


def _match_one(text: str, sorted_registry: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    haystack = text.lower()
    for entry in sorted_registry:
        if entry["name_lower"] in haystack:
            return entry
    return None


async def extract_now_playing(db, live_streamers: Iterable[Dict[str, Any]],
                              *, platform: str = "twitch") -> List[Dict[str, Any]]:
    """Returns the now-playing slot table for the homepage ticker.

    Each row: `{name, category, provider, count, streamers: [{platform, handle}]}`
    sorted by `count` descending. Empty list when nothing matches — frontend
    renders the "Pure scene mode" empty state.
    """
    registry = await list_registry(db, include_disabled=False)
    sorted_index = _build_match_index(registry)
    by_slot: Dict[str, Dict[str, Any]] = {}
    for s in live_streamers:
        title = (s.get("title") or "").strip()
        game = (s.get("game_name") or "").strip()
        # Skip explicit non-slot categories unless the title itself matches
        # — that handles a streamer whose channel category is "Just Chatting"
        # but who's actually running a slot stream right now.
        text = f"{title} {game}"
        if not text.strip():
            continue
        # If game category is purely non-slot AND title has no slot mention,
        # short-circuit before the regex sweep
        if (game.lower() in NON_SLOT_CATEGORIES) and not title:
            continue
        match = _match_one(text, sorted_index)
        if not match:
            continue
        key = match["name_lower"]
        if key not in by_slot:
            by_slot[key] = {
                "name": match["name"],
                "category": match["category"],
                "provider": match.get("provider", ""),
                "count": 0,
                "streamers": [],
            }
        by_slot[key]["count"] += 1
        handle = s.get("user_login") or s.get("user_name") or s.get("channel")
        if handle:
            by_slot[key]["streamers"].append({"platform": platform, "handle": handle})

    rows = list(by_slot.values())
    rows.sort(key=lambda r: (-r["count"], r["name"]))
    return rows
