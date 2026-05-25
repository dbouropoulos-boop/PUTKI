"""
PUTKI HQ - Voyager rotation calendar.

The /voyager page is a recurring editorial pick: a game + an operator,
chosen and written up by the editor each week. The URL stays /voyager;
only the content rotates.

This module is the back-office source-of-truth for that rotation:

  • DEFAULT_VOYAGER tracks the locked week-1 content (mirrored in
    Voyager.jsx as WEEK_1) so a missing/empty doc still renders the
    page correctly.
  • settings._id='voyager_rotation' holds an admin-managed list of
    weekly entries plus an `active_slug` pointer.
  • get_active_voyager(db) is what the public endpoint serves - it
    picks the entry the editor flagged active, falling back to the
    earliest non-expired one, then to defaults.

Storage shape (Mongo doc, sanitised on every read so paste-bombs in
any cell silently truncate):

  {
    _id: "voyager_rotation",
    updated_at: ISO-8601 string,
    value: {
       active_slug: "weezy-rally-week-1" | null,
       weeks: [ <week entry>, ... ],
    },
  }

Each week entry mirrors the WEEK_1 object shape in Voyager.jsx - the
adapter on the frontend reads the merged result directly.
"""
from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional


# Field-length caps. Anything beyond is silently truncated.
_SHORT = 80
_MED = 240
_LONG = 800
_PARA = 2000
_HREF = 600

# Maximum weeks the editor can keep on file. Past this point a save is
# truncated; the calendar isn't meant as a history log.
MAX_WEEKS = 24
# Maximum review bullets per operator card (spec §4.4 - 4 was reference,
# we allow up to 6 so the editor has room).
MAX_REVIEW_POINTS = 6


DEFAULT_VOYAGER: Dict[str, Any] = {
    "active_slug": "weezy-rally-week-1",
    "weeks": [
        {
            "slug": "weezy-rally-week-1",
            "week_label_fi": "VIIKKO 1",
            "week_label_en": "WEEK 1",
            "next_rotation_iso": "2026-05-27T09:00:00+03:00",
            "game": {
                "title_fi": "Weezy Rally",
                "title_en": "Weezy Rally",
                "template_id": 3383,
                "brand_key": "7f2db034",
                "visitor_key": "9250d6a7-1401-4205-a36b-14caba30b8d9-7",
            },
            "operator": {
                "name": "Weezybet",
                "redirect_url": "https://weezybet.com/register?source=putki-voyager",
                "partnership_label": True,
            },
            "prize": {
                "label_fi": "ilmaiskierrosta",
                "label_en": "free spins",
                "min": 5,
                "max": 20,
                "slot_fi": "valitulla slotilla",
                "slot_en": "on a featured slot",
            },
            "verdict_fi": "Suomenkielinen rekisteröitymätön Pay N Play -kasino, jonka kotiutukset ovat oikeasti nopeita ja julkaistuja - testattu toimituksessa.",
            "verdict_en": "A Finnish-language Pay N Play casino whose payouts are genuinely fast and publicly tracked - vetted by our editor.",
            "tried_fi": "Kokeilimme itse: talletus 50 €, kotiutus saapui 12 minuutissa.",
            "tried_en": "We tried it ourselves: €50 deposit, payout in 12 minutes.",
            "review_points": [
                {
                    "headline_fi": "Pay N Play (Trustly-virta)",
                    "headline_en": "Pay N Play (Trustly flow)",
                    "body_fi": "Ei rekisteröitymistä. Pankkitunnukset, talletus, peli - sama istunto.",
                    "body_en": "No registration. Bank ID, deposit, play - single session.",
                },
                {
                    "headline_fi": "Kotiutukset alle 15 min",
                    "headline_en": "Payouts under 15 min",
                    "body_fi": "Toimitusseuranta: 38/40 viime kotiutusta alle 15 minuutissa. Lista julkaistu.",
                    "body_en": "Editorial tracking: 38 of the last 40 payouts settled in <15 min. List is published.",
                },
                {
                    "headline_fi": "Suomenkielinen tuki",
                    "headline_en": "Finnish-speaking support",
                    "body_fi": "Chat-tuki suomeksi 09-24, mediaanivasteaika alle 2 min toimituksen testeissä.",
                    "body_en": "Live chat in Finnish 09:00-24:00, median response under 2 min in our tests.",
                },
                {
                    "headline_fi": "Pelivalinta",
                    "headline_en": "Game selection",
                    "body_fi": "Yli 3 000 nimikettä, mukana NetEnt, Pragmatic, Hacksaw - ei pakkokierrätyspaketteja.",
                    "body_en": "3,000+ titles incl. NetEnt, Pragmatic, Hacksaw - no forced wagering bundles.",
                },
            ],
        }
    ],
}


_SLUG_RE = re.compile(r"[^a-z0-9-]+")


def _slug(s: str) -> str:
    """Normalise a slug - lowercase + dashed, max 80 chars."""
    if not isinstance(s, str):
        return ""
    out = _SLUG_RE.sub("-", s.lower().strip()).strip("-")
    return out[:_SHORT] or ""


def _trunc(value: Any, cap: int) -> str:
    if value is None or not isinstance(value, str):
        return ""
    v = value.strip()
    return v[:cap]


def _coerce_iso(value: Any) -> str:
    """Accept ISO-8601 strings; pass through unchanged when parseable,
    otherwise return empty string. We don't reformat - the editor's UI
    handles tz the way the user typed it."""
    if not isinstance(value, str):
        return ""
    v = value.strip()
    if not v:
        return ""
    try:
        # Allow trailing Z (UTC) per ISO-8601.
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return v[:64]
    except ValueError:
        return ""


def _coerce_int(value: Any, default: int = 0, lo: int = 0, hi: int = 10_000) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    if n < lo:
        return lo
    if n > hi:
        return hi
    return n


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "on"}
    return default


def _sanitise_review_point(rp: Any) -> Dict[str, str]:
    if not isinstance(rp, dict):
        rp = {}
    return {
        "headline_fi": _trunc(rp.get("headline_fi"), _MED),
        "headline_en": _trunc(rp.get("headline_en"), _MED),
        "body_fi": _trunc(rp.get("body_fi"), _PARA),
        "body_en": _trunc(rp.get("body_en"), _PARA),
    }


def _sanitise_week(week: Any, idx: int) -> Dict[str, Any]:
    """Coerce one week entry - never raises. A garbage payload becomes
    an entry with empty strings + numeric defaults; the editor sees that
    on reload and fixes it. Better than refusing the whole save."""
    if not isinstance(week, dict):
        week = {}
    slug = _slug(week.get("slug") or f"week-{idx + 1}")
    game = week.get("game") if isinstance(week.get("game"), dict) else {}
    operator = week.get("operator") if isinstance(week.get("operator"), dict) else {}
    prize = week.get("prize") if isinstance(week.get("prize"), dict) else {}
    review_points = week.get("review_points") if isinstance(week.get("review_points"), list) else []

    return {
        "slug": slug or f"week-{idx + 1}",
        "week_label_fi": _trunc(week.get("week_label_fi"), _SHORT),
        "week_label_en": _trunc(week.get("week_label_en"), _SHORT),
        "next_rotation_iso": _coerce_iso(week.get("next_rotation_iso")),
        "game": {
            "title_fi": _trunc(game.get("title_fi"), _MED),
            "title_en": _trunc(game.get("title_en"), _MED),
            "template_id": _coerce_int(game.get("template_id"), 0, 0, 10_000_000),
            "brand_key": _trunc(game.get("brand_key"), _MED),
            "visitor_key": _trunc(game.get("visitor_key"), _MED),
        },
        "operator": {
            "name": _trunc(operator.get("name"), _MED),
            "redirect_url": _trunc(operator.get("redirect_url"), _HREF),
            "partnership_label": _coerce_bool(operator.get("partnership_label"), True),
        },
        "prize": {
            "label_fi": _trunc(prize.get("label_fi"), _MED),
            "label_en": _trunc(prize.get("label_en"), _MED),
            "min": _coerce_int(prize.get("min"), 1, 0, 10_000),
            "max": _coerce_int(prize.get("max"), 1, 0, 10_000),
            "slot_fi": _trunc(prize.get("slot_fi"), _MED),
            "slot_en": _trunc(prize.get("slot_en"), _MED),
        },
        "verdict_fi": _trunc(week.get("verdict_fi"), _LONG),
        "verdict_en": _trunc(week.get("verdict_en"), _LONG),
        "tried_fi": _trunc(week.get("tried_fi"), _LONG),
        "tried_en": _trunc(week.get("tried_en"), _LONG),
        "review_points": [
            _sanitise_review_point(rp) for rp in review_points[:MAX_REVIEW_POINTS]
        ],
    }


def sanitise(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deep-merge sanitiser. Idempotent against bad input."""
    p = payload if isinstance(payload, dict) else {}
    raw_weeks = p.get("weeks") if isinstance(p.get("weeks"), list) else []
    weeks = [
        _sanitise_week(w, i)
        for i, w in enumerate(raw_weeks[:MAX_WEEKS])
    ]
    slugs = {w["slug"] for w in weeks}
    active = _slug(p.get("active_slug") or "")
    if active not in slugs:
        active = weeks[0]["slug"] if weeks else ""
    return {"active_slug": active, "weeks": weeks}


async def get_voyager_rotation_raw(db) -> Dict[str, Any]:
    """Admin view - raw override + sanitised + defaults + updated_at.
    When the override is missing/empty we hand back the defaults as the
    sanitised tree so the editor opens with the locked week-1 already on
    screen instead of an empty calendar."""
    doc = await db.settings.find_one(
        {"_id": "voyager_rotation"},
        {"_id": 0, "value": 1, "updated_at": 1},
    )
    raw = (doc or {}).get("value") or {}
    has_weeks = bool(raw.get("weeks")) if isinstance(raw, dict) else False
    sanitised = sanitise(raw) if has_weeks else sanitise(DEFAULT_VOYAGER)
    return {
        "raw": raw,
        "sanitised": sanitised,
        "defaults": DEFAULT_VOYAGER,
        "updated_at": (doc or {}).get("updated_at"),
    }


async def get_active_voyager(db) -> Dict[str, Any]:
    """Public - returns just the currently-active week entry the page
    should render. Falls back to the defaults when nothing is set up."""
    doc = await db.settings.find_one(
        {"_id": "voyager_rotation"}, {"_id": 0, "value": 1},
    )
    raw = (doc or {}).get("value") or {}
    s = sanitise(raw) if raw else sanitise(DEFAULT_VOYAGER)
    for week in s.get("weeks", []):
        if week["slug"] == s.get("active_slug"):
            return {"active": week, "active_slug": week["slug"]}
    if s.get("weeks"):
        return {"active": s["weeks"][0], "active_slug": s["weeks"][0]["slug"]}
    fallback = sanitise(DEFAULT_VOYAGER)
    return {"active": fallback["weeks"][0], "active_slug": fallback["active_slug"]}


async def save_voyager_rotation(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Admin write. Sanitises before persisting so a bad save can't break
    the page on the next read either."""
    if not isinstance(payload, dict):
        raise ValueError("payload_must_be_object")
    sanitised = sanitise(payload)
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"_id": "voyager_rotation"},
        {"$set": {"value": sanitised, "updated_at": now}},
        upsert=True,
    )
    return await get_voyager_rotation_raw(db)
