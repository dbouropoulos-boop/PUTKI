"""
PUTKI HQ — Per-raffle match context.

Aggregates real data for the prediction game-beats UI:
  * Bookmaker consensus (The Odds API) — 1X2 implied probabilities + n_books
  * Team form stats (football-data.org) — gracefully degraded for leagues
    outside the free tier (Veikkausliiga, Liiga, etc. → returns None,
    FE falls back to raffle-internal data)
  * Editorial pick — admin-editable field on the raffle doc itself
  * Raffle-internal pick distribution — % of entrants who picked 1/X/2

The entire payload is honest: every field is real, missing data shows as
null (UI must degrade), no fabrication.
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# football-data.org competition codes for leagues we can serve stats for.
# Keys are normalized league strings on the raffle doc.
LEAGUE_TO_FD_CODE: Dict[str, str] = {
    "premier league": "PL",
    "premier_league": "PL",
    "championship": "ELC",
    "bundesliga": "BL1",
    "serie a": "SA",
    "serie_a": "SA",
    "ligue 1": "FL1",
    "ligue_1": "FL1",
    "la liga": "PD",
    "primera division": "PD",
    "eredivisie": "DED",
    "primeira liga": "PPL",
    "champions league": "CL",
    "uefa champions league": "CL",
    "europa league": "EL",
}

# Cache: (league_code, season) → standings dict. Refreshed daily.
_FD_STANDINGS_CACHE: Dict[str, Dict[str, Any]] = {}
_FD_CACHE_TTL = timedelta(hours=12)


# ── The Odds API — per-match consensus ─────────────────────────────────

_ODDS_SPORT_KEY = {
    "football": "soccer",  # The Odds API uses sport-specific subkeys; we
    "soccer": "soccer",     # search across all soccer leagues.
    "icehockey": "icehockey",
    "ice_hockey": "icehockey",
    "nhl": "icehockey_nhl",
    "tennis": "tennis",
    "basketball": "basketball",
    "f1": "motorsport_motogp",
    "mma": "mma_mixed_martial_arts",
}


def _normalize(s: str) -> str:
    """Lowercase + strip punctuation + collapse whitespace — for fuzzy team-name matching."""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", (s or "").lower())).strip()


def _team_match(api_team: str, our_team: str) -> bool:
    """Fuzzy match — `_team_match("HJK Helsinki", "HJK")` → True."""
    a, b = _normalize(api_team), _normalize(our_team)
    if not a or not b:
        return False
    if a == b:
        return True
    return b in a or a in b


async def _fetch_odds_for_sport(sport_key: str) -> list[Dict[str, Any]]:
    """Pull all upcoming events for a sport_key. Falls back to soccer
    if the precise sport_key 404s (out of season). 15-min cache via the
    caller; this function makes raw HTTP."""
    key = os.environ.get("ODDS_API_KEY") or ""
    if not key:
        return []
    base = "https://api.the-odds-api.com/v4"
    params = {
        "apiKey": key, "regions": "eu", "markets": "h2h",
        "oddsFormat": "decimal", "dateFormat": "iso",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as http:
            r = await http.get(f"{base}/sports/{sport_key}/odds", params=params)
            if r.status_code == 404:
                return []
            r.raise_for_status()
            return r.json() or []
    except Exception as exc:
        logger.warning("odds api fetch failed for %s: %s", sport_key, exc)
        return []


async def odds_for_match(
    *, home_team: str, away_team: str, sport: str,
) -> Optional[Dict[str, Any]]:
    """Find the bookmaker consensus for one specific match.
    Returns None when no h2h market matches (sport out of season, league
    not covered, or names don't fuzzy-match)."""
    sport_key = _ODDS_SPORT_KEY.get((sport or "").lower(), "soccer")
    events = await _fetch_odds_for_sport(sport_key)

    # Try precise key first, fall back to "soccer" hub for any football league.
    if not events and sport_key != "soccer" and sport == "football":
        events = await _fetch_odds_for_sport("soccer")

    match = None
    for ev in events:
        h, a = ev.get("home_team", ""), ev.get("away_team", "")
        if _team_match(h, home_team) and _team_match(a, away_team):
            match = ev
            break
        # Some leagues swap home/away — accept reversed match too.
        if _team_match(a, home_team) and _team_match(h, away_team):
            match = ev
            break
    if not match:
        return None

    # Aggregate consensus probabilities across all books.
    sums: Dict[str, list[float]] = {"home": [], "draw": [], "away": []}
    book_count = 0
    for bm in match.get("bookmakers") or []:
        for mk in bm.get("markets") or []:
            if mk.get("key") != "h2h":
                continue
            for outcome in mk.get("outcomes") or []:
                name, price = outcome.get("name"), outcome.get("price")
                if not name or not isinstance(price, (int, float)) or price <= 1.0:
                    continue
                if _team_match(name, match.get("home_team", "")):
                    sums["home"].append(float(price))
                elif _team_match(name, match.get("away_team", "")):
                    sums["away"].append(float(price))
                else:
                    sums["draw"].append(float(price))
        book_count += 1

    def _agg(prices: list[float]) -> Optional[Dict[str, float]]:
        if not prices:
            return None
        avg = sum(prices) / len(prices)
        return {
            "avg_decimal": round(avg, 2),
            "best_decimal": round(max(prices), 2),
            "implied_pct": round(100.0 / avg, 1),
            "n_books": len(prices),
        }

    home, draw, away = _agg(sums["home"]), _agg(sums["draw"]), _agg(sums["away"])
    if not (home and (draw or sport.lower() != "football") and away):
        return None

    # Difficulty inference: tightness = max(implied) - min(implied)
    implied_set = [x["implied_pct"] for x in (home, draw, away) if x]
    spread = max(implied_set) - min(implied_set)
    if spread > 45:
        difficulty = "easy"      # heavy favourite
        difficulty_fi = "selvä suosikki"
    elif spread > 18:
        difficulty = "tight"
        difficulty_fi = "tasainen"
    else:
        difficulty = "coin_flip"
        difficulty_fi = "kuin kolikonheitto"

    return {
        "home": home, "draw": draw, "away": away,
        "n_books": book_count,
        "difficulty": difficulty,
        "difficulty_fi": difficulty_fi,
        "commence_time": match.get("commence_time"),
        "api_home_team": match.get("home_team"),
        "api_away_team": match.get("away_team"),
    }


# ── football-data.org — team form ──────────────────────────────────────

async def _fetch_fd_standings(competition_code: str) -> Optional[Dict[str, Any]]:
    key = os.environ.get("FOOTBALL_DATA_KEY") or ""
    if not key:
        return None
    cache_key = f"standings:{competition_code}"
    cached = _FD_STANDINGS_CACHE.get(cache_key)
    if cached and (datetime.now(timezone.utc) - cached["fetched_at"]) < _FD_CACHE_TTL:
        return cached["data"]
    try:
        async with httpx.AsyncClient(timeout=12.0) as http:
            r = await http.get(
                f"https://api.football-data.org/v4/competitions/{competition_code}/standings",
                headers={"X-Auth-Token": key},
            )
            if r.status_code != 200:
                return None
            data = r.json() or {}
    except Exception as exc:
        logger.warning("football-data standings fetch failed: %s", exc)
        return None
    _FD_STANDINGS_CACHE[cache_key] = {"data": data, "fetched_at": datetime.now(timezone.utc)}
    return data


def _team_form_from_standings(
    standings: Dict[str, Any], team_name: str,
) -> Optional[Dict[str, Any]]:
    for st in (standings or {}).get("standings", []):
        if st.get("type") != "TOTAL":
            continue
        for row in st.get("table", []) or []:
            t = (row.get("team") or {}).get("name") or ""
            if _team_match(t, team_name):
                played = row.get("playedGames") or 0
                if played < 1:
                    return None
                return {
                    "position": row.get("position"),
                    "played": played,
                    "wins": row.get("won"),
                    "draws": row.get("draw"),
                    "losses": row.get("lost"),
                    "goals_for": row.get("goalsFor"),
                    "goals_against": row.get("goalsAgainst"),
                    "goals_per_game": round((row.get("goalsFor") or 0) / played, 2),
                    "goals_conceded_per_game": round((row.get("goalsAgainst") or 0) / played, 2),
                    "form": row.get("form"),
                    "api_team_name": t,
                }
    return None


async def team_form_for_match(
    *, league: Optional[str], home_team: str, away_team: str,
) -> Optional[Dict[str, Any]]:
    """Returns {home, away, league_label} when league is covered by
    football-data.org free tier. Returns None for Veikkausliiga, Liiga,
    NHL, etc. — caller must gracefully degrade.
    """
    code = LEAGUE_TO_FD_CODE.get((league or "").lower().strip())
    if not code:
        return None
    standings = await _fetch_fd_standings(code)
    if not standings:
        return None
    home = _team_form_from_standings(standings, home_team)
    away = _team_form_from_standings(standings, away_team)
    if not (home and away):
        return None
    return {
        "home": home, "away": away,
        "competition": code,
        "league_label": (standings.get("competition") or {}).get("name") or league,
        "season": ((standings.get("season") or {}).get("startDate") or "")[:4] or None,
    }


# ── Pick distribution — from voita_entries ─────────────────────────────

async def pick_distribution(db, raffle_id: str) -> Dict[str, Any]:
    """% of entrants per 1/X/2 + total count. Used in mode_with_data
    Beat 2 ('32 entries so far · 56% picked HJK')."""
    pipeline = [
        {"$match": {"raffle_id": raffle_id}},
        {"$group": {"_id": "$prediction_one_x_two", "n": {"$sum": 1}}},
    ]
    counts = {"1": 0, "X": 0, "2": 0}
    total = 0
    async for r in db.voita_entries.aggregate(pipeline):
        k = r.get("_id")
        if k in counts:
            counts[k] = int(r.get("n") or 0)
            total += counts[k]
    if total == 0:
        return {"total": 0, "by_pick": counts, "pct": {"1": 0, "X": 0, "2": 0}}
    pct = {k: round(100.0 * v / total, 1) for k, v in counts.items()}
    return {"total": total, "by_pick": counts, "pct": pct}


# ── Aggregator ─────────────────────────────────────────────────────────

async def build_match_context(db, raffle: Dict[str, Any]) -> Dict[str, Any]:
    home = raffle.get("home_team")
    away = raffle.get("away_team")
    sport = raffle.get("sport") or "football"
    league = raffle.get("league")
    odds = None
    team_form = None
    if home and away:
        odds = await odds_for_match(home_team=home, away_team=away, sport=sport)
        team_form = await team_form_for_match(league=league, home_team=home, away_team=away)
    dist = await pick_distribution(db, raffle.get("id"))
    return {
        "odds": odds,
        "team_form": team_form,
        "editorial_pick": raffle.get("editorial_pick"),
        "pick_distribution": dist,
        "entries_count": raffle.get("entries_count", 0),
        "kickoff_at": raffle.get("kickoff_at"),
        "league": league,
        "sport": sport,
    }
