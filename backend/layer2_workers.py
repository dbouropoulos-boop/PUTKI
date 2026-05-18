"""
PUTKI HQ — Phase 4 Week 1
==========================
Layer 2 real-time signal workers.

Four independent background pollers, each writing into its own MongoDB
collection so the dial engine + frontend SSE feed can react to event-driven
state changes instead of running on a flat 6-hour cadence.

Pollers:
  - Twitch (every 60s) → `stream_signals`
  - Reddit (every 1h)  → `social_signals`
  - NHL    (every 5m)  → `sports_signals`
  - RSS    (every 15m) → `news_signals`

Design notes:
  - All loops use asyncio.sleep and tolerate exceptions per-tick so a single
    upstream flake never kills the worker.
  - Each tick writes ONE summary document (not one per item) so retention
    stays manageable; per-item details live in the `items` array.
  - Kill-switch: PUTKI_HQ_DISABLE_LAYER2=1
  - Per-worker kill switches: PUTKI_HQ_DISABLE_TWITCH_POLLER=1, ...
  - Reddit uses the public JSON endpoint (no OAuth) per user spec; capped
    at <60 req/min by the hourly cadence + at-most 2 subs/tick.
  - NHL focuses on Finnish-roster games only per user spec.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import xml.etree.ElementTree as ET

import httpx

logger = logging.getLogger(__name__)


# ─────────────────────── Tuning constants ───────────────────────

TWITCH_POLL_SECONDS = int(os.environ.get("LAYER2_TWITCH_INTERVAL", "60"))
REDDIT_POLL_SECONDS = int(os.environ.get("LAYER2_REDDIT_INTERVAL", "3600"))
NHL_POLL_SECONDS    = int(os.environ.get("LAYER2_NHL_INTERVAL", "300"))
RSS_POLL_SECONDS    = int(os.environ.get("LAYER2_RSS_INTERVAL", "900"))
F1_POLL_SECONDS     = int(os.environ.get("LAYER2_F1_INTERVAL", "3600"))       # Ergast — race weekends only
FOOTBALL_POLL_SECONDS = int(os.environ.get("LAYER2_FOOTBALL_INTERVAL", "600")) # 10 min during match windows

HTTP_TIMEOUT_SECONDS = 15.0

# Reddit user-agent per user spec
REDDIT_USER_AGENT = "PUTKI-HQ/1.0 (by /u/putkihq)"
REDDIT_SUBREDDITS = ["jaska", "Suomi"]
REDDIT_KEYWORDS = ["kasino", "slotti", "vedonlyönti", "pelaaminen", "weezybet"]

# NHL — Phase 1: all NHL games (no Finnish-roster filter). Phase 2 may add
# nationality weighting via the NHL API directly to avoid stale hardcoded IDs.

# RSS feeds + keywords per user spec
# RSS feeds + keywords per user spec
RSS_FEEDS = [
    # Direct Finnish news feeds — primary signal sources
    {"source": "YLE Uutiset",       "url": "https://yle.fi/rss/uutiset/tuoreimmat"},
    {"source": "Helsingin Sanomat", "url": "https://www.hs.fi/rss/tuoreimmat.xml"},
    {"source": "Iltalehti",         "url": "https://www.iltalehti.fi/rss.xml"},
    # Google News aggregation — volume + breadth (Dioni's launch spec).
    # URL dedup downstream collapses cross-source repeats.
    {"source": "Google News · uhkapeli",      "url": "https://news.google.com/rss/search?q=uhkapeli+finland&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · veikkaus",      "url": "https://news.google.com/rss/search?q=veikkaus&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · rahapeli",      "url": "https://news.google.com/rss/search?q=rahapeli+suomi&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · NHL suomi",     "url": "https://news.google.com/rss/search?q=NHL+suomi&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · veikkausliiga", "url": "https://news.google.com/rss/search?q=veikkausliiga&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · Liiga",         "url": "https://news.google.com/rss/search?q=liiga+jääkiekko&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · kasino",        "url": "https://news.google.com/rss/search?q=kasino+suomi&hl=fi&gl=FI&ceid=FI:fi"},
    {"source": "Google News · nettikasinot",  "url": "https://news.google.com/rss/search?q=nettikasinot&hl=fi&gl=FI&ceid=FI:fi"},
]
NEWS_KEYWORDS = ["uhkapeli", "rahapeli", "veikkaus", "kasino", "pelaaminen", "vedonlyönti"]


# ─────────────────────── Retention helpers ───────────────────────

LAYER2_COLLECTIONS = (
    "stream_signals", "social_signals", "sports_signals",
    "news_signals", "f1_signals", "football_signals",
)
LAYER2_TTL_DAYS = int(os.environ.get("LAYER2_TTL_DAYS", "14"))


async def ensure_indexes(db) -> None:
    """Create TTL index on `expires_at` for each Layer 2 collection.

    A TTL index lets MongoDB auto-prune stale signal documents instead of us
    running another worker just to delete rows.
    """
    for coll_name in LAYER2_COLLECTIONS:
        coll = db[coll_name]
        try:
            await coll.create_index("captured_at")
            await coll.create_index("expires_at", expireAfterSeconds=0)
        except Exception:
            logger.exception("Failed to ensure indexes on %s", coll_name)


def _expires_at(days: int = LAYER2_TTL_DAYS) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


# ─────────────────────── Twitch poller ───────────────────────

async def _fetch_twitch_streams(client_id: str, oauth_token: str) -> List[Dict[str, Any]]:
    """Pull currently-live streams from the entire Finnish Twitch scene.

    Uses Helix `/streams?language=fi&first=100` so the dial reflects the
    actual size of the Finnish-language live audience — not just the
    couple of streamers we've manually rostered. "Scene Heat" is a scene-
    level metric, not a roster-level one.
    """
    headers = {"Client-Id": client_id, "Authorization": f"Bearer {oauth_token}"}
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as http:
        r = await http.get(
            "https://api.twitch.tv/helix/streams?language=fi&first=100",
            headers=headers,
        )
        r.raise_for_status()
        return r.json().get("data", [])


async def twitch_tick(db) -> Dict[str, Any]:
    """One Twitch poll tick. Writes summary to stream_signals."""
    from rosters import list_streamers as _list_streamers

    try:
        from twitch_eventsub import get_app_access_token, is_configured, _client_id
    except Exception:
        logger.warning("twitch_eventsub module unavailable; skipping tick")
        return {"skipped": "module_unavailable"}

    if not is_configured():
        # Honest dormant state — no fake numbers when API is unconfigured
        doc = {
            "captured_at": datetime.now(timezone.utc),
            "expires_at": _expires_at(),
            "platform": "twitch",
            "total_viewers": 0,
            "active_streams": 0,
            "streams": [],
            "dormant": True,
            "reason": "twitch_credentials_not_configured",
        }
        await db.stream_signals.insert_one(dict(doc))
        return {"dormant": True}

    try:
        token = await get_app_access_token()
    except Exception as e:
        logger.warning("Twitch OAuth token fetch failed: %s", e)
        return {"error": "oauth_failed"}

    streamers = await _list_streamers(db)
    tracked_logins = {(s.get("channel") or s.get("slug") or "").lower()
                      for s in streamers
                      if (s.get("platform") or "").lower() == "twitch"
                      and (s.get("channel") or s.get("slug"))}

    try:
        streams = await _fetch_twitch_streams(_client_id(), token)
    except Exception as e:
        logger.warning("Twitch streams fetch failed: %s", e)
        return {"error": "fetch_failed"}

    # "Scene Heat" reads the WHOLE Finnish-language live scene, not only the
    # subset we've rostered. We still flag which entries are part of our
    # editorial roster so individual UI surfaces (alert CTAs) can use that.
    matched = []
    total_viewers = 0
    for s in streams:
        login = (s.get("user_login") or "").lower()
        viewers = int(s.get("viewer_count", 0) or 0)
        matched.append({
            "user_login": login,
            "user_name": s.get("user_name"),
            "title": s.get("title"),
            "viewer_count": viewers,
            "game_name": s.get("game_name"),
            "started_at": s.get("started_at"),
            "tracked": login in tracked_logins,
        })
        total_viewers += viewers

    doc = {
        "captured_at": datetime.now(timezone.utc),
        "expires_at": _expires_at(),
        "platform": "twitch",
        "total_viewers": total_viewers,
        "active_streams": len(matched),
        "streams": matched,
        "dormant": False,
    }
    await db.stream_signals.insert_one(dict(doc))
    return {"active_streams": len(matched), "total_viewers": total_viewers}


# ─────────────────────── Reddit poller ───────────────────────

async def _fetch_subreddit_new(subreddit: str) -> List[Dict[str, Any]]:
    headers = {"User-Agent": REDDIT_USER_AGENT}
    url = f"https://www.reddit.com/r/{subreddit}/new.json?limit=50"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS, headers=headers) as http:
        r = await http.get(url)
        r.raise_for_status()
        data = r.json()
        return [c.get("data", {}) for c in data.get("data", {}).get("children", [])]


async def reddit_tick(db) -> Dict[str, Any]:
    """One Reddit poll tick. Counts keyword mentions across configured subs."""
    summary = {"mentions": 0, "matched_posts": []}
    for sub in REDDIT_SUBREDDITS:
        try:
            posts = await _fetch_subreddit_new(sub)
        except Exception as e:
            logger.warning("Reddit fetch failed for /r/%s: %s", sub, e)
            continue

        for p in posts:
            title = (p.get("title") or "").lower()
            body = (p.get("selftext") or "").lower()
            text = f"{title}\n{body}"
            matched_kw = [kw for kw in REDDIT_KEYWORDS if kw.lower() in text]
            if not matched_kw:
                continue
            summary["mentions"] += 1
            summary["matched_posts"].append({
                "subreddit": sub,
                "title": p.get("title"),
                "url": f"https://reddit.com{p.get('permalink', '')}",
                "score": p.get("score", 0),
                "num_comments": p.get("num_comments", 0),
                "keywords_matched": matched_kw,
                "created_utc": p.get("created_utc"),
            })

    doc = {
        "captured_at": datetime.now(timezone.utc),
        "expires_at": _expires_at(),
        "platform": "reddit",
        "subreddits": REDDIT_SUBREDDITS,
        "keywords": REDDIT_KEYWORDS,
        "mention_count": summary["mentions"],
        "matched_posts": summary["matched_posts"],
    }
    await db.social_signals.insert_one(dict(doc))
    return summary


# ─────────────────────── NHL poller ───────────────────────

async def _fetch_nhl_schedule_today() -> List[Dict[str, Any]]:
    """NHL has multiple endpoints; api-web.nhle.com is the public CDN today.

    `/v1/schedule/{YYYY-MM-DD}` returns the schedule starting from that date
    grouped by gameWeek; we take only today's games.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    url = f"https://api-web.nhle.com/v1/schedule/{today}"
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as http:
        r = await http.get(url)
        r.raise_for_status()
        data = r.json()
        games = []
        for week in data.get("gameWeek", []):
            if week.get("date") == today:
                games.extend(week.get("games", []))
        return games


async def nhl_tick(db) -> Dict[str, Any]:
    """One NHL poll tick (Phase 1: all NHL games).

    Flags sports_active=true if ANY NHL game is scheduled today. Finnish
    bettors follow NHL broadly, not just Finnish-roster games. Phase 2 may
    add dynamic Finnish-nationality weighting later — for now we keep the
    code simple and roster-free.
    """
    try:
        games = await _fetch_nhl_schedule_today()
    except Exception as e:
        logger.warning("NHL schedule fetch failed: %s", e)
        games = []

    summarized: List[Dict[str, Any]] = []
    for g in games:
        home = g.get("homeTeam", {}) or {}
        away = g.get("awayTeam", {}) or {}
        summarized.append({
            "game_id": g.get("id"),
            "home": home.get("abbrev"),
            "away": away.get("abbrev"),
            "home_name": (home.get("placeName") or {}).get("default") if isinstance(home.get("placeName"), dict) else home.get("placeName"),
            "away_name": (away.get("placeName") or {}).get("default") if isinstance(away.get("placeName"), dict) else away.get("placeName"),
            "start_time_utc": g.get("startTimeUTC"),
            "game_state": g.get("gameState"),
            "venue": (g.get("venue") or {}).get("default") if isinstance(g.get("venue"), dict) else g.get("venue"),
        })

    doc = {
        "captured_at": datetime.now(timezone.utc),
        "expires_at": _expires_at(),
        "sport": "nhl",
        "games_active": len(summarized),
        "games": summarized,
        "scope": "all_games",
    }
    await db.sports_signals.insert_one(dict(doc))
    return {"games_active": len(summarized)}


# ─────────────────────── RSS poller ───────────────────────

def _parse_rss(xml_text: str) -> List[Dict[str, Any]]:
    """Minimal RSS 2.0 / Atom parser — pulls title/link/pubDate from items."""
    items: List[Dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    # RSS 2.0 <channel><item>
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        items.append({"title": title, "url": link, "published": pub})

    # Atom <entry>
    if not items:
        ns = "{http://www.w3.org/2005/Atom}"
        for entry in root.iter(f"{ns}entry"):
            title = (entry.findtext(f"{ns}title") or "").strip()
            link_el = entry.find(f"{ns}link")
            link = link_el.get("href") if link_el is not None else ""
            pub = (entry.findtext(f"{ns}updated") or entry.findtext(f"{ns}published") or "").strip()
            items.append({"title": title, "url": link, "published": pub})
    return items


async def rss_tick(db) -> Dict[str, Any]:
    """One RSS poll tick. Counts gambling-keyword matches across feeds.

    With Google News aggregation enabled, the same article appears across
    multiple searches — we dedupe by URL inside the tick so the matched
    count and downstream content generation see each story once.
    """
    matched_articles: List[Dict[str, Any]] = []
    seen_urls: set = set()

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS,
                                 headers={"User-Agent": REDDIT_USER_AGENT}) as http:
        for feed in RSS_FEEDS:
            try:
                r = await http.get(feed["url"])
                r.raise_for_status()
                xml_text = r.text
            except Exception as e:
                logger.warning("RSS fetch failed for %s: %s", feed["source"], e)
                continue

            items = _parse_rss(xml_text)
            for it in items:
                title_l = (it.get("title") or "").lower()
                kw_hits = [kw for kw in NEWS_KEYWORDS if kw.lower() in title_l]
                if not kw_hits:
                    continue
                # Strip Google News URL wrapping so dedup hits real article
                # URLs (Google wraps as /url?... but their RSS uses direct
                # publisher links — we still normalize to be safe).
                url = (it.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                matched_articles.append({
                    "source": feed["source"],
                    "title": it["title"],
                    "url": url,
                    "published": it["published"],
                    "keywords_matched": kw_hits,
                })

    doc = {
        "captured_at": datetime.now(timezone.utc),
        "expires_at": _expires_at(),
        "feeds": [f["source"] for f in RSS_FEEDS],
        "keywords": NEWS_KEYWORDS,
        "matched_count": len(matched_articles),
        "matched_articles": matched_articles,
    }
    await db.news_signals.insert_one(dict(doc))
    return {"matched_count": len(matched_articles)}


# ─────────────────────── F1 poller (Ergast public API) ───────────────────────

ERGAST_FINNISH_DRIVERS = ("Valtteri Bottas", "Bottas")


async def f1_tick(db) -> Dict[str, Any]:
    """Poll Ergast for the most recent F1 race result. Stores once per race so
    repeated ticks during the same week are deduped downstream in
    ContentGenerator via the fingerprint (season + round)."""
    url = "https://api.jolpi.ca/ergast/f1/current/last/results.json"
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as http:
            r = await http.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning("Ergast F1 fetch failed: %s", e)
        doc = {"captured_at": datetime.now(timezone.utc), "expires_at": _expires_at(),
               "sport": "f1", "race_active": False, "dormant": True,
               "reason": f"fetch_error:{e.__class__.__name__}"}
        await db.f1_signals.insert_one(dict(doc))
        return {"dormant": True}

    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", []) or []
    race = races[0] if races else {}
    results = race.get("Results", []) or []

    finnish_drivers: List[Dict[str, Any]] = []
    for res in results:
        drv = res.get("Driver", {}) or {}
        full = f"{drv.get('givenName', '')} {drv.get('familyName', '')}".strip()
        nat = (drv.get("nationality") or "").lower()
        if nat == "finnish" or full in ERGAST_FINNISH_DRIVERS:
            finnish_drivers.append({
                "name": full,
                "position": res.get("position"),
                "constructor": (res.get("Constructor", {}) or {}).get("name"),
                "points": res.get("points"),
                "status": res.get("status"),
            })

    doc = {
        "captured_at": datetime.now(timezone.utc),
        "expires_at": _expires_at(),
        "sport": "f1",
        "race_id": f"{race.get('season', '')}-{race.get('round', '')}",
        "race_name": race.get("raceName"),
        "season": race.get("season"),
        "round": race.get("round"),
        "circuit": (race.get("Circuit", {}) or {}).get("circuitName"),
        "date": race.get("date"),
        "race_active": bool(results),
        "podium": [
            {"position": r.get("position"),
             "driver": f"{(r.get('Driver', {}) or {}).get('givenName', '')} {(r.get('Driver', {}) or {}).get('familyName', '')}".strip(),
             "constructor": (r.get("Constructor", {}) or {}).get("name")}
            for r in results[:3]
        ],
        "finnish_drivers": finnish_drivers,
    }
    await db.f1_signals.insert_one(dict(doc))
    return {"race_active": bool(results), "race": race.get("raceName"),
            "finnish_drivers": len(finnish_drivers)}


# ─────────────────────── Football poller (football-data.org) ───────────────────────

FOOTBALL_COMPETITIONS = ("PL", "BL1", "PD", "SA", "FL1", "CL", "EL")
FINNISH_FOOTBALL_NAMES = (
    "Pukki", "Pohjanpalo", "Kallman", "Hetemaj", "Antman", "Walta",
    "Niskanen", "O'Shaughnessy", "Hradecky", "Markkanen",
)


async def football_tick(db) -> Dict[str, Any]:
    """Poll football-data.org for matches finished in the last 24h across the
    top European competitions. Retains all matches; downstream template
    decides whether to recap based on Finnish-player participation."""
    api_key = os.environ.get("FOOTBALL_DATA_API_KEY")
    if not api_key:
        doc = {"captured_at": datetime.now(timezone.utc), "expires_at": _expires_at(),
               "sport": "football", "matches_active": 0, "matches": [],
               "dormant": True, "reason": "no_api_key"}
        await db.football_signals.insert_one(dict(doc))
        return {"dormant": True}

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    headers = {"X-Auth-Token": api_key}

    finished_matches: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS, headers=headers) as http:
        try:
            url = (f"https://api.football-data.org/v4/matches?"
                   f"dateFrom={yesterday}&dateTo={today}&status=FINISHED")
            r = await http.get(url)
            if r.status_code == 429:
                doc = {"captured_at": datetime.now(timezone.utc), "expires_at": _expires_at(),
                       "sport": "football", "matches_active": 0, "matches": [],
                       "dormant": True, "reason": "rate_limited"}
                await db.football_signals.insert_one(dict(doc))
                return {"dormant": True, "reason": "rate_limited"}
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            logger.warning("football-data fetch failed: %s", e)
            doc = {"captured_at": datetime.now(timezone.utc), "expires_at": _expires_at(),
                   "sport": "football", "matches_active": 0, "matches": [],
                   "dormant": True, "reason": f"fetch_error:{e.__class__.__name__}"}
            await db.football_signals.insert_one(dict(doc))
            return {"dormant": True}

        for m in data.get("matches", []) or []:
            comp = (m.get("competition", {}) or {}).get("code")
            if comp not in FOOTBALL_COMPETITIONS:
                continue
            home = (m.get("homeTeam", {}) or {}).get("shortName") or (m.get("homeTeam", {}) or {}).get("name")
            away = (m.get("awayTeam", {}) or {}).get("shortName") or (m.get("awayTeam", {}) or {}).get("name")
            full_score = (m.get("score", {}) or {}).get("fullTime", {}) or {}
            scorers = [(g.get("scorer") or {}).get("name") or "" for g in (m.get("goals") or [])]
            finnish_scorers = [s for s in scorers if any(fn in s for fn in FINNISH_FOOTBALL_NAMES)]
            finished_matches.append({
                "match_id": m.get("id"),
                "competition": comp,
                "competition_name": (m.get("competition", {}) or {}).get("name"),
                "home": home,
                "away": away,
                "home_score": full_score.get("home"),
                "away_score": full_score.get("away"),
                "utc_date": m.get("utcDate"),
                "scorers": scorers[:10],
                "finnish_scorers": finnish_scorers,
            })

    doc = {
        "captured_at": datetime.now(timezone.utc),
        "expires_at": _expires_at(),
        "sport": "football",
        "matches_active": len(finished_matches),
        "matches": finished_matches,
        "competitions_polled": list(FOOTBALL_COMPETITIONS),
    }
    await db.football_signals.insert_one(dict(doc))
    return {"matches_active": len(finished_matches),
            "finnish_scoring": sum(1 for m in finished_matches if m["finnish_scorers"])}



# ─────────────────────── Worker loops ───────────────────────

async def _loop(name: str, fn, db, interval: int, env_disable_key: str,
                on_tick=None) -> None:
    """Generic loop driver for a Layer 2 worker."""
    if os.environ.get(env_disable_key, "0") == "1":
        logger.info("layer2.%s disabled via %s=1", name, env_disable_key)
        return
    # Stagger startup so we don't hammer the DB the second the app boots.
    await asyncio.sleep(5)
    while True:
        try:
            result = await fn(db)
            logger.info("layer2.%s tick ok: %s", name, result)
            if on_tick:
                try:
                    await on_tick(name, result)
                except Exception:
                    logger.exception("layer2.%s on_tick callback failed", name)
        except Exception:
            logger.exception("layer2.%s tick raised", name)
        await asyncio.sleep(interval)


async def start_layer2_workers(db, on_tick=None) -> List[asyncio.Task]:
    """Spawn the active pollers as background tasks. Returns the tasks so
    callers can cancel them on shutdown.

    Reddit poller is OFF by default since Reddit blocks datacenter IPs;
    flip back on by setting PUTKI_HQ_ENABLE_REDDIT_POLLER=1 once OAuth
    credentials are wired.
    """
    if os.environ.get("PUTKI_HQ_DISABLE_LAYER2", "0") == "1":
        logger.info("Layer 2 workers fully disabled via PUTKI_HQ_DISABLE_LAYER2=1")
        return []
    await ensure_indexes(db)
    tasks = [
        asyncio.create_task(_loop("twitch", twitch_tick, db, TWITCH_POLL_SECONDS,
                                  "PUTKI_HQ_DISABLE_TWITCH_POLLER", on_tick)),
        asyncio.create_task(_loop("nhl", nhl_tick, db, NHL_POLL_SECONDS,
                                  "PUTKI_HQ_DISABLE_NHL_POLLER", on_tick)),
        asyncio.create_task(_loop("rss", rss_tick, db, RSS_POLL_SECONDS,
                                  "PUTKI_HQ_DISABLE_RSS_POLLER", on_tick)),
        asyncio.create_task(_loop("f1", f1_tick, db, F1_POLL_SECONDS,
                                  "PUTKI_HQ_DISABLE_F1_POLLER", on_tick)),
        asyncio.create_task(_loop("football", football_tick, db, FOOTBALL_POLL_SECONDS,
                                  "PUTKI_HQ_DISABLE_FOOTBALL_POLLER", on_tick)),
    ]
    if os.environ.get("PUTKI_HQ_ENABLE_REDDIT_POLLER", "0") == "1":
        tasks.append(asyncio.create_task(_loop("reddit", reddit_tick, db, REDDIT_POLL_SECONDS,
                                               "PUTKI_HQ_DISABLE_REDDIT_POLLER", on_tick)))
    else:
        logger.info("Reddit poller dormant (set PUTKI_HQ_ENABLE_REDDIT_POLLER=1 once OAuth approved)")
    return tasks
