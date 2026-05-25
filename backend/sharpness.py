"""
PUTKI HQ - Sharpness scoring engine.

Deterministic 0-100 composite score over bookmaker market behaviour, per
the Phase 1 brief (Section 6). NO LLM in the loop - the AI never generates
the numbers; this module does. The picks-generator AI only writes the
surrounding paragraph.

Formula (locked, published verbatim on /menetelma):

    Sharpness = round(
        0.50 * implied_prob_score
      + 0.30 * consensus_tightness_score
      + 0.20 * recency_momentum_score
    )

Where:
    implied_prob_score      = clamp((1 / best_decimal_odds) * 100, 0, 100)
    consensus_tightness     = 100 - clamp(stdev(implied_per_book) * 7, 0, 100)
    recency_momentum        = clamp(50 + (avg_implied_now - avg_implied_24h_ago) * 500, 0, 100)
                              # >50 means consensus tightened in last 24h
                              # <50 means softened
                              # default 50 when no 24h history yet

Bands (label + machine-readable):
    >=90  → tight     / "Markkinat ovat tiukat"      / "Markets are tight"
    75-89 → clear     / "Markkinat ovat selkeät"     / "Markets are clear"
    60-74 → mixed     / "Markkinat ovat sekoittuneet"/ "Markets are mixed"
    40-59 → loose     / "Markkinat ovat löysät"      / "Markets are loose"
    <40   → scattered / "Markkinat ovat hajallaan"   / "Markets are scattered"

Momentum modifier (per-pick):
    momentum >= 60 → "tightened today" / "tiukentunut tänään"
    momentum <= 40 → "softened today"  / "löystynyt tänään"
    else           → (no modifier)
"""
from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

WEIGHT_IMPLIED = 0.50
WEIGHT_TIGHTNESS = 0.30
WEIGHT_MOMENTUM = 0.20

BAND_TIGHT_MIN = 90
BAND_CLEAR_MIN = 75
BAND_MIXED_MIN = 60
BAND_LOOSE_MIN = 40

MOMENTUM_TIGHTEN_MIN = 60
MOMENTUM_SOFTEN_MAX = 40


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def implied_prob_score(best_decimal_odds: float) -> float:
    """50% weight component. 1.11 odds → 90.09, 2.00 → 50.0."""
    if not best_decimal_odds or best_decimal_odds <= 1.0:
        return 0.0
    return _clamp((1.0 / float(best_decimal_odds)) * 100.0)


def consensus_tightness_score(book_implied_probs: List[float]) -> float:
    """
    30% weight component. 100 = all books agree exactly. Lower as they
    spread. Computed from population stdev of per-book implied probs
    (each on a 0-100 percentage-point scale).

    Calibration (per-percentage-point stdev → tightness):
      0.5 pp  → ~96.5  (very tight market)
      1.0 pp  → ~93    (tight)
      3.0 pp  → ~79    (clear, normal h2h spread)
      5.0 pp  → ~65    (mixed)
      10.0 pp → ~30    (scattered)

    Typical EU h2h favourites cluster at stdev 0.5-3pp.
    """
    valid = [p for p in book_implied_probs if isinstance(p, (int, float))]
    if len(valid) < 2:
        # Single bookmaker or none → conservative mid-band.
        return 60.0
    sigma = statistics.pstdev(valid)
    return _clamp(100.0 - sigma * 7.0)


def recency_momentum_score(avg_implied_now: float,
                           avg_implied_24h_ago: Optional[float]) -> float:
    """
    20% weight component. Default 50 (no opinion) when 24h history
    unavailable. Delta scaled by 500: a 1pp consensus tightening
    moves the score by 5 points.
    """
    if avg_implied_24h_ago is None:
        return 50.0
    delta_pp = (avg_implied_now - avg_implied_24h_ago) / 100.0  # 0..1 delta
    return _clamp(50.0 + delta_pp * 500.0)


def compute_sharpness(best_decimal_odds: float,
                      book_implied_probs: List[float],
                      avg_implied_now: float,
                      avg_implied_24h_ago: Optional[float] = None) -> Dict[str, Any]:
    """Return the full Sharpness payload for one pick."""
    ip = implied_prob_score(best_decimal_odds)
    ct = consensus_tightness_score(book_implied_probs)
    rm = recency_momentum_score(avg_implied_now, avg_implied_24h_ago)
    score = WEIGHT_IMPLIED * ip + WEIGHT_TIGHTNESS * ct + WEIGHT_MOMENTUM * rm
    score_rounded = int(round(score))

    band = _band_for(score_rounded)
    modifier = _momentum_modifier(rm)

    return {
        "sharpness": score_rounded,
        "components": {
            "implied_prob_score":    round(ip, 1),
            "consensus_tightness":   round(ct, 1),
            "recency_momentum":      round(rm, 1),
        },
        "weights": {
            "implied_prob":  WEIGHT_IMPLIED,
            "tightness":     WEIGHT_TIGHTNESS,
            "momentum":      WEIGHT_MOMENTUM,
        },
        "band": band,        # "tight"|"clear"|"mixed"|"loose"|"scattered"
        "modifier": modifier, # "tightened"|"softened"|null
        "book_count": len(book_implied_probs),
        "has_momentum_history": avg_implied_24h_ago is not None,
    }


def _band_for(score: int) -> str:
    if score >= BAND_TIGHT_MIN:
        return "tight"
    if score >= BAND_CLEAR_MIN:
        return "clear"
    if score >= BAND_MIXED_MIN:
        return "mixed"
    if score >= BAND_LOOSE_MIN:
        return "loose"
    return "scattered"


def _momentum_modifier(rm: float) -> Optional[str]:
    if rm >= MOMENTUM_TIGHTEN_MIN:
        return "tightened"
    if rm <= MOMENTUM_SOFTEN_MAX:
        return "softened"
    return None


# ─────────────────────── Daily Market Watch ───────────────────────

async def daily_market_watch(db, picks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute the section-level Daily Market Watch score:
    arithmetic mean of all today's pick Sharpness scores.

    Returns the score, band, 30-day sparkline data (one point per day),
    and persists today's average to `sharpness_daily` so the sparkline
    grows. Empty if no picks today.
    """
    if not picks:
        return {"score": None, "band": None, "sparkline": [], "as_of": None}

    today_score = int(round(sum(p.get("sharpness", 0) for p in picks) / len(picks)))
    today_band = _band_for(today_score)
    now = datetime.now(timezone.utc)
    today_key = now.date().isoformat()

    # Upsert today's daily average.
    try:
        await db.sharpness_daily.update_one(
            {"_id": today_key},
            {"$set": {"avg_score": today_score, "n_picks": len(picks),
                      "updated_at": now.isoformat()}},
            upsert=True,
        )
    except Exception:
        # Don't let DB writes block the response.
        pass

    # Fetch last 30 days, oldest first.
    sparkline: List[Dict[str, Any]] = []
    cutoff = (now - timedelta(days=30)).date().isoformat()
    try:
        cur = db.sharpness_daily.find(
            {"_id": {"$gte": cutoff}},
            {"_id": 1, "avg_score": 1},
        ).sort([("_id", 1)])
        async for row in cur:
            sparkline.append({"date": row["_id"], "score": int(row.get("avg_score", 0))})
    except Exception:
        sparkline = [{"date": today_key, "score": today_score}]

    return {
        "score": today_score,
        "band": today_band,
        "sparkline": sparkline,
        "as_of": now.isoformat(),
    }


# ─────────────────────── Bookmaker helpers ───────────────────────

def extract_book_implied_probs(event: Dict[str, Any], fav_name: str) -> List[float]:
    """
    For each bookmaker offering h2h on this event, return the implied
    probability for the favourite outcome `fav_name` (on a 0-100 scale).
    """
    out: List[float] = []
    for bm in event.get("bookmakers", []) or []:
        for market in bm.get("markets", []) or []:
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []) or []:
                if outcome.get("name") == fav_name:
                    price = outcome.get("price")
                    if isinstance(price, (int, float)) and price > 1.0:
                        out.append(100.0 / float(price))
    return out


def avg_implied_for_fav(event: Dict[str, Any], fav_name: str) -> float:
    """Arithmetic mean of implied probabilities for the favourite across all books."""
    probs = extract_book_implied_probs(event, fav_name)
    if not probs:
        return 0.0
    return sum(probs) / len(probs)
