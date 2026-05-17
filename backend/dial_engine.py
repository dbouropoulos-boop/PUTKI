"""
PUTKI HQ Phase 3 — Dial recalc engine (Batch 3B).

Reads recent signals from `signals` collection, computes a weighted composite
score 0-100, maps it to one of five dial states, and persists a snapshot to
`dial_snapshots`. The /api/dial endpoint reads from this collection so the
frontend cockpit always reflects the most recent computation.

Composite formula (Phase 3 brief):
    composite = 0-100 weighted by source_weight × signal.weight, capped.

Source weights (sum=100):
    streamers (twitch+kick): 35
    sports:                   20
    youtube_wins:             15
    forum_velocity:           15
    internal_heartbeat:       10
    big_event_bonus:           5  (any single signal weight ≥ 90 adds +5)

State mapping:
    composite < 20  -> KYLMA
    composite < 45  -> HAALEA
    composite < 70  -> KUUMA
    composite < 88  -> MYRSKY
    composite >=88  -> KIIRASTULI

The "primary driver" is the source category contributing the highest
sub-score in the latest snapshot — surfaced in /api/cockpit.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


SOURCE_WEIGHTS = {
    "streamers": 35,   # twitch + kick combined
    "sports":    20,
    "youtube":   15,
    "forum":     15,
    "internal":  10,
    "bonus":      5,
}

STATE_THRESHOLDS = [
    (20, "KYLMA"),
    (45, "HAALEA"),
    (70, "KUUMA"),
    (88, "MYRSKY"),
    (101, "KIIRASTULI"),
]

STATE_DEFINITIONS = {
    "KYLMA":     {"key": "KYLMA",     "label": "KYLMÄ",     "color": "#2C5F8D", "headline": "Mittari on KYLMÄ. Skene nukkuu."},
    "HAALEA":    {"key": "HAALEA",    "label": "HAALEA",    "color": "#7A7E83", "headline": "Mittari on HAALEA. Tasaista taustakohinaa."},
    "KUUMA":     {"key": "KUUMA",     "label": "KUUMA",     "color": "#E8924A", "headline": "Mittari on KUUMA. Slot-skene lämpenee illaksi."},
    "MYRSKY":    {"key": "MYRSKY",    "label": "MYRSKY",    "color": "#C8423C", "headline": "Mittari on MYRSKY. Striimit täynnä, klippejä syntyy."},
    "KIIRASTULI": {"key": "KIIRASTULI", "label": "KIIRASTULI", "color": "#8B1E1A", "headline": "Mittari on KIIRASTULI. Älä katso pois."},
}

DRIVER_LABELS = {
    "streamers":         {"fi": "STRIIMAAJAT LIVENÄ",         "en": "STREAMERS LIVE"},
    "sports":            {"fi": "URHEILUTAPAHTUMA AKTIIVINEN", "en": "SPORTS EVENT ACTIVE"},
    "youtube":           {"fi": "YOUTUBE-VOITTO TUNNISTETTU", "en": "YOUTUBE WIN DETECTED"},
    "forum":             {"fi": "FOORUMI HERÄSI",             "en": "FORUM ACTIVITY"},
    "internal":          {"fi": "TOIMITUS JULKAISI",          "en": "EDITORIAL PUBLISHED"},
    "approved_content":  {"fi": "TOIMITUS JULKAISI",          "en": "EDITORIAL PUBLISHED"},
    "default":           {"fi": "MITTARI LEPOTILASSA",        "en": "MITTARI IDLE"},
}


def _state_for_score(score: float) -> Dict[str, Any]:
    for threshold, key in STATE_THRESHOLDS:
        if score < threshold:
            return STATE_DEFINITIONS[key]
    return STATE_DEFINITIONS["KIIRASTULI"]


def _aggregate_by_category(signals: List[Dict[str, Any]]) -> Dict[str, float]:
    """Returns 0-1 normalized intensity per category."""
    buckets: Dict[str, List[int]] = {"streamers": [], "sports": [], "youtube": [], "forum": [], "internal": []}
    for s in signals:
        src = s.get("source")
        cat = "streamers" if src in ("twitch", "kick") else src if src in buckets else None
        if not cat:
            continue
        buckets[cat].append(int(s.get("weight", 0)))
    norm = {}
    for cat, weights in buckets.items():
        if not weights:
            norm[cat] = 0.0
            continue
        # Use the top-3 mean — single hot signal still contributes, but a
        # quiet long tail doesn't dominate a single big one.
        top = sorted(weights, reverse=True)[:3]
        norm[cat] = (sum(top) / len(top)) / 100.0
    return norm


async def recalculate_dial(db) -> Dict[str, Any]:
    """Pull last 30min of signals, compute composite, persist snapshot."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    cur = db.signals.find({"captured_at": {"$gte": cutoff}}, {"_id": 0})
    signals = await cur.to_list(length=1000)

    intensities = _aggregate_by_category(signals)
    sub_scores = {cat: intensities.get(cat, 0.0) * SOURCE_WEIGHTS[cat] for cat in ("streamers", "sports", "youtube", "forum", "internal")}

    composite = sum(sub_scores.values())
    if any(int(s.get("weight", 0)) >= 90 for s in signals):
        composite = min(100.0, composite + SOURCE_WEIGHTS["bonus"])
    composite = round(min(100.0, max(0.0, composite)), 1)

    primary = max(sub_scores.items(), key=lambda kv: kv[1])[0] if sub_scores else "default"
    if sub_scores.get(primary, 0) <= 0:
        primary = "default"

    state_def = _state_for_score(composite)
    snapshot = {
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "composite_score": composite,
        "state_key": state_def["key"],
        "state": state_def,
        "sub_scores": sub_scores,
        "primary_driver": primary,
        "primary_driver_label": DRIVER_LABELS.get(primary, DRIVER_LABELS["default"]),
        "signal_count": len(signals),
        "any_real": any(not s.get("mocked") for s in signals),
    }
    await db.dial_snapshots.insert_one(dict(snapshot))
    # Keep last 500 snapshots for change-log; trim older.
    count = await db.dial_snapshots.count_documents({})
    if count > 500:
        old = await db.dial_snapshots.find({}, {"_id": 1}).sort("computed_at", -1).skip(500).to_list(length=count)
        if old:
            await db.dial_snapshots.delete_many({"_id": {"$in": [o["_id"] for o in old]}})
    snapshot.pop("_id", None)
    return snapshot


async def latest_snapshot(db) -> Optional[Dict[str, Any]]:
    doc = await db.dial_snapshots.find_one({}, {"_id": 0}, sort=[("computed_at", -1)])
    return doc


async def dial_history(db, limit: int = 60) -> List[Dict[str, Any]]:
    cur = db.dial_snapshots.find({}, {"_id": 0, "sub_scores": 0}).sort("computed_at", -1).limit(max(1, min(200, limit)))
    return await cur.to_list(length=limit)
