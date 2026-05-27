"""
PUTKI HQ - Phase 4 Dial recalc engine (Layer 2 edition)
========================================================

Replaces the old 6-signal formula (streamers / sports / youtube / forum /
internal / bonus) with a new 4-signal weighted composite computed off the
Layer 2 worker collections.

New formula (locked-in user spec):
    composite = 0.40 * stream_intensity   (Twitch live viewers)
              + 0.30 * social_intensity   (Reddit keyword mentions)
              + 0.20 * sports_intensity   (Finnish-roster NHL games active)
              + 0.10 * news_intensity     (regulatory-keyword RSS hits)

State mapping unchanged:
    composite < 20  → KYLMA
    composite < 45  → HAALEA
    composite < 70  → KUUMA
    composite < 88  → MYRSKY
    composite >=88  → KIIRASTULI

Output shape unchanged so existing /api/dial + /api/cockpit consumers
(frontend + pytest) keep working - `state`, `state_key`, `composite_score`,
`sub_scores`, `primary_driver`, `primary_driver_label{fi,en}`, `signal_count`,
`any_real`, `computed_at` are all still present.
"""
from __future__ import annotations

import logging
import asyncio
import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ─────────────────── 3-signal weights (Reddit dropped, awaiting OAuth approval) ───────────────────
SOURCE_WEIGHTS: Dict[str, int] = {
    "stream":  57,   # Twitch live viewer count (was 40 before Reddit dropped)
    "sports":  29,   # NHL games active today  (was 20)
    "news":    14,   # gambling/regulatory RSS keyword hits (was 10)
    # `social` retained at 0 in the snapshot for back-compat - re-enable when
    # Reddit OAuth approval lands by restoring a non-zero weight here.
    "social":   0,
}

STATE_THRESHOLDS = [
    (20, "KYLMA"),
    (45, "HAALEA"),
    (70, "KUUMA"),
    (88, "MYRSKY"),
    (101, "KIIRASTULI"),
]

STATE_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "KYLMA":      {"key": "KYLMA",      "label": "KYLMÄ",      "color": "#2C5F8D", "headline": "Mittari on KYLMÄ. Skene nukkuu."},
    "HAALEA":     {"key": "HAALEA",     "label": "HAALEA",     "color": "#7A7E83", "headline": "Mittari on HAALEA. Tasaista taustakohinaa."},
    "KUUMA":      {"key": "KUUMA",      "label": "KUUMA",      "color": "#E8924A", "headline": "Mittari on KUUMA. Slot-skene lämpenee illaksi."},
    "MYRSKY":     {"key": "MYRSKY",     "label": "MYRSKY",     "color": "#C8423C", "headline": "Mittari on MYRSKY. Striimit täynnä, klippejä syntyy."},
    "KIIRASTULI": {"key": "KIIRASTULI", "label": "KIIRASTULI", "color": "#8B1E1A", "headline": "Mittari on KIIRASTULI. Älä katso pois."},
}

DRIVER_LABELS: Dict[str, Dict[str, str]] = {
    "stream":           {"fi": "STRIIMAAJAT LIVENÄ",        "en": "STREAMERS LIVE"},
    "social":           {"fi": "REDDIT KESKUSTELEE",        "en": "REDDIT BUZZ"},
    "sports":           {"fi": "SUOMALAINEN NHL-PELI",      "en": "FINNISH NHL GAME"},
    "news":             {"fi": "UUTISVIRTA LÄMPENEE",       "en": "NEWSFLOW HEATING"},
    # Back-compat labels retained for legacy snapshots created before Phase 4
    "streamers":        {"fi": "STRIIMAAJAT LIVENÄ",        "en": "STREAMERS LIVE"},
    "youtube":          {"fi": "YOUTUBE-VOITTO TUNNISTETTU","en": "YOUTUBE WIN DETECTED"},
    "forum":            {"fi": "FOORUMI HERÄSI",            "en": "FORUM ACTIVITY"},
    "internal":         {"fi": "TOIMITUS JULKAISI",         "en": "EDITORIAL PUBLISHED"},
    "approved_content": {"fi": "TOIMITUS JULKAISI",         "en": "EDITORIAL PUBLISHED"},
    "default":          {"fi": "MITTARI LEPOTILASSA",       "en": "MITTARI IDLE"},
}


# ─────────────────── State helpers ───────────────────

def _state_for_score(score: float) -> Dict[str, Any]:
    for threshold, key in STATE_THRESHOLDS:
        if score < threshold:
            return STATE_DEFINITIONS[key]
    return STATE_DEFINITIONS["KIIRASTULI"]


# ─────────────────── Intensity functions (0.0 → 1.0) ───────────────────

def _stream_intensity(stream_doc: Optional[Dict[str, Any]]) -> float:
    """Twitch live viewers → log-scaled intensity. 0 viewers → 0; 20 000+ → 1."""
    if not stream_doc:
        return 0.0
    total = int(stream_doc.get("total_viewers", 0) or 0)
    if total <= 0:
        return 0.0
    # log10(1) = 0; log10(20 000) ≈ 4.30 - saturate at 20k viewers
    val = math.log10(total + 1) / math.log10(20_001)
    return max(0.0, min(1.0, val))


def _social_intensity(social_doc: Optional[Dict[str, Any]]) -> float:
    """Reddit keyword mentions in last poll. 0 → 0; 20+ → 1."""
    if not social_doc:
        return 0.0
    mentions = int(social_doc.get("mention_count", 0) or 0)
    return max(0.0, min(1.0, mentions / 20.0))


def _sports_intensity(sports_doc: Optional[Dict[str, Any]],
                       f1_doc: Optional[Dict[str, Any]] = None,
                       football_doc: Optional[Dict[str, Any]] = None) -> float:
    """Combined sports intensity across NHL + F1 + Football.

    Each sub-sport contributes a binary signal (active=1, idle=0). Three
    sub-sports → divide by 3 so a single active sport returns ~0.33 and all
    three active returns 1.0. Dormant docs (no API key) are excluded.
    """
    def _active(doc, key):
        if not doc or doc.get("dormant"):
            return 0
        return 1 if int(doc.get(key, 0) or 0) > 0 else 0
    nhl_active = _active(sports_doc, "games_active")
    f1_active  = _active(f1_doc, "race_active") if f1_doc and not f1_doc.get("dormant") else 0
    # F1 is event-driven; race_active is a bool not a count
    if f1_doc and not f1_doc.get("dormant"):
        f1_active = 1 if f1_doc.get("race_active") else 0
    fb_active = _active(football_doc, "matches_active")
    score = (nhl_active + f1_active + fb_active) / 3.0
    return max(0.0, min(1.0, score))


def _news_intensity(news_doc: Optional[Dict[str, Any]]) -> float:
    """Gambling-keyword RSS hits in last poll. 0 → 0; 10+ → 1."""
    if not news_doc:
        return 0.0
    matched = int(news_doc.get("matched_count", 0) or 0)
    return max(0.0, min(1.0, matched / 10.0))


# ─────────────────── Layer 2 fetchers ───────────────────

async def _latest(db, coll_name: str) -> Optional[Dict[str, Any]]:
    return await db[coll_name].find_one({}, {"_id": 0}, sort=[("captured_at", -1)])


async def recalculate_dial(db) -> Dict[str, Any]:
    """Read the most recent Layer 2 signal docs, compute composite, persist snapshot.

    Each Layer 2 worker writes its own summary doc on every tick - we pull the
    latest one per collection rather than aggregating a window. This keeps the
    dial responsive to event-driven shifts (Twitch viewers spike → dial moves
    on the next 60s tick).
    """
    stream_doc = await _latest(db, "stream_signals")
    social_doc = await _latest(db, "social_signals")
    sports_doc = await _latest(db, "sports_signals")
    news_doc   = await _latest(db, "news_signals")
    f1_doc       = await _latest(db, "f1_signals")
    football_doc = await _latest(db, "football_signals")

    intensities = {
        "stream":  _stream_intensity(stream_doc),
        "social":  _social_intensity(social_doc),
        "sports":  _sports_intensity(sports_doc, f1_doc, football_doc),
        "news":    _news_intensity(news_doc),
    }
    sub_scores = {cat: round(intensities[cat] * SOURCE_WEIGHTS[cat], 2)
                  for cat in SOURCE_WEIGHTS}

    composite = round(min(100.0, max(0.0, sum(sub_scores.values()))), 1)

    # Primary driver = the sub_score with the largest contribution (weighted, not raw intensity)
    primary = max(sub_scores.items(), key=lambda kv: kv[1])[0] if sub_scores else "default"
    if sub_scores.get(primary, 0) <= 0:
        primary = "default"

    # "any_real" = at least one Layer 2 doc exists AND it's not the dormant
    # placeholder (twitch dormant=true means credentials missing).
    real_docs = [d for d in (stream_doc, social_doc, sports_doc, news_doc) if d]
    any_real = any(not d.get("dormant", False) for d in real_docs)

    signal_count = sum([
        int(stream_doc.get("active_streams", 0)) if stream_doc else 0,
        int(social_doc.get("mention_count", 0)) if social_doc else 0,
        int(sports_doc.get("games_active", 0)) if sports_doc else 0,
        int(news_doc.get("matched_count", 0)) if news_doc else 0,
        (1 if (f1_doc and not f1_doc.get("dormant") and f1_doc.get("race_active")) else 0),
        int(football_doc.get("matches_active", 0)) if football_doc and not football_doc.get("dormant") else 0,
    ])

    state_def = _state_for_score(composite)
    snapshot = {
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "composite_score": composite,
        "state_key": state_def["key"],
        "state": state_def,
        "sub_scores": sub_scores,
        "intensities": {k: round(v, 3) for k, v in intensities.items()},
        "primary_driver": primary,
        "primary_driver_label": DRIVER_LABELS.get(primary, DRIVER_LABELS["default"]),
        "signal_count": signal_count,
        "any_real": any_real,
        "layer2": {
            "stream":   {"present": bool(stream_doc),   "captured_at": str(stream_doc.get("captured_at")) if stream_doc else None},
            "social":   {"present": bool(social_doc),   "captured_at": str(social_doc.get("captured_at")) if social_doc else None},
            "sports":   {"present": bool(sports_doc),   "captured_at": str(sports_doc.get("captured_at")) if sports_doc else None},
            "news":     {"present": bool(news_doc),     "captured_at": str(news_doc.get("captured_at")) if news_doc else None},
            "f1":       {"present": bool(f1_doc),       "captured_at": str(f1_doc.get("captured_at")) if f1_doc else None,
                         "race_active": bool(f1_doc.get("race_active")) if f1_doc else False},
            "football": {"present": bool(football_doc), "captured_at": str(football_doc.get("captured_at")) if football_doc else None,
                         "matches_active": int(football_doc.get("matches_active", 0)) if football_doc else 0},
        },
    }

    await db.dial_snapshots.insert_one(dict(snapshot))

    # Phase 1 (Sprint 4) - record STATE CHANGE events to a separate collection
    # with a 365-day TTL. Powers the Mittari streak counter on the homepage
    # and the /m/{state-slug}-{date} permalink share pages.
    prev = await db.dial_snapshots.find_one(
        {"computed_at": {"$lt": snapshot["computed_at"]}},
        {"_id": 0, "state": 1},
        sort=[("computed_at", -1)],
    )
    prev_key = (prev or {}).get("state", {}).get("key")
    if prev_key != snapshot["state"]["key"]:
        try:
            await db.dial_state_events.create_index("captured_at")
            await db.dial_state_events.create_index("state_key")
            await db.dial_state_events.create_index(
                "expires_at", expireAfterSeconds=0,
            )
        except Exception:
            pass
        await db.dial_state_events.insert_one({
            "captured_at":      snapshot["computed_at"],
            "expires_at":       datetime.now(timezone.utc) + timedelta(days=365),
            "state_key":        snapshot["state"]["key"],
            "state_label":      snapshot["state"].get("label"),
            "state_color":      snapshot["state"].get("color"),
            "composite_score":  snapshot.get("composite_score"),
            "primary_driver":   snapshot.get("primary_driver"),
            "previous_state":   prev_key,
            "twitch_live":      (snapshot.get("sub_scores") or {}).get("twitch_live"),
            "twitch_viewers":   (snapshot.get("sub_scores") or {}).get("twitch_viewers"),
        })

        # Phase 1 Sprint 4 - fire-and-forget Mittari OG image generation
        # for this state-change event. Idempotent on the og side (cached
        # by {state}-{date}), so re-entrancy is safe; errors are swallowed
        # inside the generator. The dial loop must NEVER block on this.
        try:
            from og_image_generator import ensure_mittari_state_og
            # Build a Finnish reading line synchronously so the prompt has
            # context even if the dial state recurs later in the day.
            sub = snapshot.get("sub_scores") or {}
            streams = sub.get("twitch_live")
            viewers = sub.get("twitch_viewers")
            counts = ""
            if streams is not None and viewers is not None:
                counts = f" {streams} striimiä, {viewers} katsojaa."
            cycle = {
                "KYLMA": "", "HAALEA": "",
                "KUUMA": " Uutiskello aktiivinen.",
                "MYRSKY": " Uutiskello kiihtynyt.",
                "KIIRASTULI": " Uutiskello tulinen.",
            }.get(snapshot["state"]["key"], "")
            base = {
                "KYLMA":      f"Skene on hiljainen.{counts}",
                "HAALEA":     f"Skene käy.{counts}",
                "KUUMA":      f"Skenessä on vipinää.{counts}{cycle}",
                "MYRSKY":     f"Skenessä on meininkiä.{counts}{cycle}",
                "KIIRASTULI": f"Skene on perkele-tasolla.{counts}{cycle}",
            }.get(snapshot["state"]["key"], "")
            date_iso = snapshot["computed_at"].date().isoformat() \
                if hasattr(snapshot["computed_at"], "date") \
                else datetime.now(timezone.utc).date().isoformat()
            asyncio.create_task(
                ensure_mittari_state_og(snapshot["state"]["key"], date_iso, base)
            )
        except Exception as e:
            logger.debug("Mittari OG dispatch skipped: %s", e)

        # Sprint B Slice 4 - fan-out state-change Telegram pings to every
        # bound Mittari subscriber. Fire-and-forget; dial loop never
        # blocks on Telegram round-trips.
        try:
            # Late local import is intentional: dial_engine ↔ telegram_bot
            # form a soft cycle (telegram_bot reads latest_snapshot for the
            # welcome card, dial_engine notifies telegram_bot on state
            # flips). Local imports break the cycle at module-load time
            # without needing a shared interface module - canonical Python
            # pattern, verified working since iter36.
            from telegram_bot import broadcast_mittari_state_change
            asyncio.create_task(broadcast_mittari_state_change(
                db,
                from_state=prev_key or "",
                to_state=snapshot["state"]["key"],
                score=snapshot.get("composite_score") or 0,
            ))
        except Exception as e:
            logger.debug("Mittari Telegram broadcast skipped: %s", e)

    # Retention: keep last 500 raw snapshots (the live UI only needs recent history).
    count = await db.dial_snapshots.count_documents({})
    if count > 500:
        old = await db.dial_snapshots.find({}, {"_id": 1}).sort("computed_at", -1).skip(500).to_list(length=count)
        if old:
            await db.dial_snapshots.delete_many({"_id": {"$in": [o["_id"] for o in old]}})

    snapshot.pop("_id", None)
    return snapshot


async def latest_snapshot(db) -> Optional[Dict[str, Any]]:
    return await db.dial_snapshots.find_one({}, {"_id": 0}, sort=[("computed_at", -1)])


async def dial_history(db, limit: int = 60) -> List[Dict[str, Any]]:
    cur = db.dial_snapshots.find({}, {"_id": 0, "sub_scores": 0}).sort("computed_at", -1).limit(max(1, min(200, limit)))
    return await cur.to_list(length=limit)


async def state_streak(db, current_state_key: str) -> Dict[str, Any]:
    """Phase 1 Sprint 4 - Mittari streak counter.

    Returns `{kind, days, last_event_at, label_fi, label_en}` for the
    homepage streak line under the dial.

    Behaviour:
      • If current state is the highest (KIIRASTULI / PERKELE), shows
        "first time in N days" since the previous PERKELE event.
      • Otherwise, shows "days since the last PERKELE event".

    Empty/silent fallback when no events recorded yet.
    """
    last_perkele = await db.dial_state_events.find_one(
        {"state_key": "KIIRASTULI"},
        {"_id": 0, "captured_at": 1},
        sort=[("captured_at", -1)],
    )
    if not last_perkele:
        return {"kind": "no_history", "days": None, "last_event_at": None}

    last_at = last_perkele["captured_at"]
    if isinstance(last_at, str):
        try:
            last_at = datetime.fromisoformat(last_at.replace("Z", "+00:00"))
        except ValueError:
            return {"kind": "no_history", "days": None, "last_event_at": str(last_at)}
    if last_at.tzinfo is None:
        last_at = last_at.replace(tzinfo=timezone.utc)

    days = max(0, (datetime.now(timezone.utc) - last_at).days)

    if current_state_key == "KIIRASTULI":
        return {
            "kind":            "during_perkele",
            "days":            days,
            "last_event_at":   last_at.isoformat(),
            "label_fi":        f"PERKELE - ensimmäinen kerta {days} päivään",
            "label_en":        f"PERKELE - first time in {days} days",
        }
    return {
        "kind":            "between",
        "days":            days,
        "last_event_at":   last_at.isoformat(),
        "label_fi":        f"Viimeisin PERKELE: {days} päivää sitten",
        "label_en":        f"Last PERKELE: {days} days ago",
    }


async def state_event_for_permalink(db, state_key: str, date_iso: str) -> Optional[Dict[str, Any]]:
    """Phase 1 Sprint 4 - /m/{state-slug}-{date} permalink lookup.

    Returns the dial state event for `state_key` on `date_iso` (YYYY-MM-DD,
    UTC), or None if nothing recorded that day.
    """
    try:
        start = datetime.fromisoformat(date_iso).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    end = start + timedelta(days=1)
    return await db.dial_state_events.find_one(
        {
            "state_key":   state_key,
            "captured_at": {"$gte": start, "$lt": end},
        },
        {"_id": 0},
        sort=[("captured_at", 1)],
    )
