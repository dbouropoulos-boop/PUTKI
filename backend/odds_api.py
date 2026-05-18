"""
PUTKI HQ — The Odds API client for the "Päivän Vitoset" homepage strip.

Fetches REAL match odds for hockey + relevant football leagues. The 5
strongest picks (highest single-outcome implied probability) get surfaced
on the homepage. No fabrication: if the API key is missing or the upstream
returns no events, the endpoint responds with `dormant: true` + reason.

Free plan: 500 req/month. We aggressively cache (15 min default) and only
query 2-3 sports per refresh, leaving plenty of headroom.

Reference:
  GET /v4/sports/{sport_key}/odds?regions=eu&markets=h2h&oddsFormat=decimal
    Authorization via apiKey query param.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

ODDS_API_BASE = "https://api.the-odds-api.com/v4"

# Sport keys per https://the-odds-api.com/sports-odds-data/sports-apis.html
# - icehockey_nhl: real every winter
# - soccer_epl / soccer_uefa_champs_league: high-prestige football the
#   Finnish gambling audience actually bets on
# - soccer_finland_veikkausliiga: home league (in season only)
SPORTS = [
    {"key": "icehockey_nhl",                 "label_fi": "NHL",            "icon": "🏒"},
    {"key": "soccer_epl",                    "label_fi": "Valioliiga",     "icon": "⚽"},
    {"key": "soccer_uefa_champs_league",     "label_fi": "Mestarien liiga","icon": "⚽"},
    {"key": "soccer_finland_veikkausliiga",  "label_fi": "Veikkausliiga",  "icon": "⚽"},
]

ODDS_CACHE_TTL = int(os.environ.get("ODDS_CACHE_TTL_SECONDS", "900"))  # 15 min
TOP_PICKS = int(os.environ.get("ODDS_TOP_PICKS", "5"))
REGION = os.environ.get("ODDS_REGION", "eu")  # EU bookmakers (Bet365, Pinnacle, Unibet, etc.)

_cache: Dict[str, Any] = {"payload": None, "expires_at": 0.0}
_lock = asyncio.Lock()


def _api_key() -> str:
    return os.environ.get("ODDS_API_KEY", "")


def is_configured() -> bool:
    return bool(_api_key())


async def _fetch_sport(sport_key: str) -> List[Dict[str, Any]]:
    """Return the upcoming events list for one sport key."""
    params = {
        "apiKey": _api_key(),
        "regions": REGION,
        "markets": "h2h",
        "oddsFormat": "decimal",
        "dateFormat": "iso",
    }
    async with httpx.AsyncClient(timeout=12.0) as http:
        r = await http.get(f"{ODDS_API_BASE}/sports/{sport_key}/odds", params=params)
        if r.status_code == 404:
            # Out-of-season sport (Veikkausliiga in February) — not an error.
            return []
        r.raise_for_status()
        return r.json() or []


def _best_pick_from_event(event: Dict[str, Any], sport_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """For a single event, choose the favourite outcome from the best
    bookmaker price across all returned books. Returns None if no usable
    h2h market is found.
    """
    home = event.get("home_team")
    away = event.get("away_team")
    commence = event.get("commence_time")
    if not home or not away:
        return None

    # For each outcome name, track the BEST (highest) decimal price across books.
    best_per_outcome: Dict[str, Dict[str, Any]] = {}
    bookmaker_count = 0
    for bm in event.get("bookmakers", []) or []:
        bookmaker_count += 1
        for market in bm.get("markets", []) or []:
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []) or []:
                name = outcome.get("name")
                price = outcome.get("price")
                if not name or not isinstance(price, (int, float)):
                    continue
                if name not in best_per_outcome or price > best_per_outcome[name]["price"]:
                    best_per_outcome[name] = {
                        "price": float(price),
                        "bookmaker": bm.get("title") or bm.get("key"),
                    }

    if not best_per_outcome:
        return None

    # The favourite has the LOWEST best price (everyone agrees they're likely).
    fav_name, fav_data = min(best_per_outcome.items(), key=lambda kv: kv[1]["price"])
    price = fav_data["price"]
    if price <= 1.0:
        return None
    implied = round(100.0 / price, 1)

    # Side label for the pick — clearer than just "home_team".
    if fav_name == home:
        side = "home"
    elif fav_name == away:
        side = "away"
    else:
        side = "draw"

    return {
        "sport_key": event.get("sport_key"),
        "sport_label": sport_meta.get("label_fi"),
        "sport_icon": sport_meta.get("icon"),
        "event_id": event.get("id"),
        "home_team": home,
        "away_team": away,
        "commence_time": commence,
        "pick_team": fav_name,
        "pick_side": side,
        "decimal_odds": price,
        "implied_probability": implied,
        "bookmaker": fav_data["bookmaker"],
        "bookmaker_count": bookmaker_count,
    }


async def _build_payload() -> Dict[str, Any]:
    if not is_configured():
        return {
            "picks": [],
            "dormant": True,
            "reason": "odds_api_key_not_configured",
            "fetched_at": time.time(),
        }

    all_picks: List[Dict[str, Any]] = []
    sport_errors: List[Dict[str, Any]] = []
    sport_summaries: List[Dict[str, Any]] = []

    for sport in SPORTS:
        try:
            events = await _fetch_sport(sport["key"])
        except httpx.HTTPStatusError as e:
            # 401/422 = key issue, 429 = quota. Surface honestly.
            logger.warning("Odds API %s failed: %s", sport["key"], e)
            sport_errors.append({"sport": sport["key"], "status": e.response.status_code})
            continue
        except Exception as e:
            logger.warning("Odds API %s exception: %s", sport["key"], e)
            sport_errors.append({"sport": sport["key"], "error": str(e)})
            continue

        sport_picks = []
        for ev in events:
            pick = _best_pick_from_event(ev, sport)
            if pick:
                sport_picks.append(pick)
        sport_summaries.append({"sport": sport["key"], "events": len(events), "picks": len(sport_picks)})
        all_picks.extend(sport_picks)

    if not all_picks:
        return {
            "picks": [],
            "dormant": False,
            "reason": "no_upcoming_events",
            "sport_summaries": sport_summaries,
            "sport_errors": sport_errors,
            "fetched_at": time.time(),
        }

    # Sort by IMPLIED PROBABILITY descending — strongest favourites first.
    # Then secondary sort by soonest kickoff so the top 5 feels fresh.
    all_picks.sort(key=lambda p: (-p["implied_probability"], p.get("commence_time") or ""))
    top = all_picks[:TOP_PICKS]

    return {
        "picks": top,
        "all_picks": all_picks,
        "dormant": False,
        "total_events_scanned": sum(s["events"] for s in sport_summaries),
        "sport_summaries": sport_summaries,
        "sport_errors": sport_errors,
        "fetched_at": time.time(),
    }


async def get_featured_picks() -> Dict[str, Any]:
    """Cached entrypoint — 15 min TTL."""
    now = time.time()
    if _cache["payload"] and _cache["expires_at"] > now:
        return _cache["payload"]

    async with _lock:
        now = time.time()
        if _cache["payload"] and _cache["expires_at"] > now:
            return _cache["payload"]

        payload = await _build_payload()
        _cache["payload"] = payload
        _cache["expires_at"] = now + ODDS_CACHE_TTL
        return payload


async def get_upcoming_picks(days: int = 7, top_per_day: int = 5) -> Dict[str, Any]:
    """Return picks grouped by calendar day (Helsinki) for the betting-tips hub.

    Re-uses the same cached payload as get_featured_picks so we don't burn
    extra Odds API quota.
    """
    from datetime import datetime, timezone, timedelta
    cached = await get_featured_picks()
    all_picks = cached.get("all_picks") or cached.get("picks") or []
    out: Dict[str, List[Dict[str, Any]]] = {}
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=days)
    for p in all_picks:
        ct = p.get("commence_time")
        if not ct:
            continue
        try:
            day = datetime.fromisoformat(ct.replace("Z", "+00:00")).date()
        except Exception:
            continue
        if day < today or day > horizon:
            continue
        out.setdefault(day.isoformat(), []).append(p)
    # Trim per-day and sort each bucket strongest-first.
    grouped = []
    for day, picks in sorted(out.items()):
        picks.sort(key=lambda p: -p["implied_probability"])
        grouped.append({"date": day, "picks": picks[:top_per_day]})
    return {
        "dormant": cached.get("dormant", False),
        "reason": cached.get("reason"),
        "days": grouped,
        "fetched_at": cached.get("fetched_at"),
    }
