"""
PUTKI HQ — Phase 4 Dial recalc engine (Layer 2 edition)
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
(frontend + pytest) keep working — `state`, `state_key`, `composite_score`,
`sub_scores`, `primary_driver`, `primary_driver_label{fi,en}`, `signal_count`,
`any_real`, `computed_at` are all still present.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ─────────────────── 3-signal weights (Reddit dropped, awaiting OAuth approval) ───────────────────
SOURCE_WEIGHTS: Dict[str, int] = {
    "stream":  57,   # Twitch live viewer count (was 40 before Reddit dropped)
    "sports":  29,   # NHL games active today  (was 20)
    "news":    14,   # gambling/regulatory RSS keyword hits (was 10)
    # `social` retained at 0 in the snapshot for back-compat — re-enable when
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
    # log10(1) = 0; log10(20 000) ≈ 4.30 — saturate at 20k viewers
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

    Each Layer 2 worker writes its own summary doc on every tick — we pull the
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

    # Retention: keep last 500 snapshots.
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
