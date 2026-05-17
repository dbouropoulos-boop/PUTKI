"""
PUTKI HQ Phase 3 — Signal pipeline foundation (Batch 3A).

Pulls raw signals from 6 sources (Twitch, Kick, YouTube, Forums, Sports,
internal activity), normalises them into a single `Signal` shape, and writes
them to the `signals` Mongo collection with a TTL-style expiry. The dial
recalc engine (dial_engine.py) consumes recent signals from this collection
and never deals with raw API shapes.

Design notes:
- Every adapter checks os.environ for credentials. Without creds, the adapter
  emits MOCKED signals tagged `mocked: True` so the rest of the pipeline can
  run end-to-end. Production deploy = supply env vars, MOCKED flag flips off.
- Each Signal has a `weight` 0-100 used by the dial engine. Adapters set
  weight from observable intensity (viewer count, post velocity, goal events).
- A single `poll_all_sources()` is invoked by the background worker every
  POLL_INTERVAL_SECONDS (default 90s). Adapters are called concurrently.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


SIGNAL_TTL_MINUTES = int(os.environ.get("SIGNAL_TTL_MINUTES", "120"))
POLL_INTERVAL_SECONDS = int(os.environ.get("SIGNAL_POLL_INTERVAL", "90"))

# Tracked Finnish streamers — these flow into the streamer adapters as login names.
TRACKED_TWITCH_LOGINS = [
    "jarttu84", "jugipelaa_", "andypyro", "ogumtv",
    "jamppa", "ella", "teukka", "huispaaja",
]
TRACKED_KICK_LOGINS = ["pact", "monnirs", "iippadaa"]
TRACKED_YOUTUBE_CHANNEL_IDS: List[str] = []  # populated from env / settings


# ── normalised signal shape ─────────────────────────────────────────────────
def make_signal(
    source: str,
    signal_type: str,
    weight: int,
    payload: Dict[str, Any],
    *,
    mocked: bool = False,
    streamer_id: Optional[str] = None,
    operator_id: Optional[str] = None,
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "source": source,                # twitch | kick | youtube | forum | sports | internal
        "signal_type": signal_type,      # streamer_live | big_win | forum_velocity | sports_event | activity_burst
        "weight": max(0, min(100, int(weight))),
        "payload": payload,
        "streamer_id": streamer_id,
        "operator_id": operator_id,
        "mocked": mocked,
        "captured_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=SIGNAL_TTL_MINUTES)).isoformat(),
    }


# ── adapters ────────────────────────────────────────────────────────────────
async def adapter_twitch() -> List[Dict[str, Any]]:
    """Twitch Helix /streams query. Without TWITCH_CLIENT_ID + secret,
    mocked signals are emitted with realistic weights."""
    client_id = os.environ.get("TWITCH_CLIENT_ID")
    client_secret = os.environ.get("TWITCH_CLIENT_SECRET")
    if not client_id or not client_secret:
        return _mock_streamer_signals("twitch", TRACKED_TWITCH_LOGINS)

    try:
        async with httpx.AsyncClient(timeout=8) as cx:
            tok_r = await cx.post(
                "https://id.twitch.tv/oauth2/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials",
                },
            )
            tok_r.raise_for_status()
            access_token = tok_r.json()["access_token"]

            params = [("user_login", login) for login in TRACKED_TWITCH_LOGINS]
            r = await cx.get(
                "https://api.twitch.tv/helix/streams",
                headers={"Client-ID": client_id, "Authorization": f"Bearer {access_token}"},
                params=params,
            )
            r.raise_for_status()
            data = r.json().get("data", [])
            out: List[Dict[str, Any]] = []
            for s in data:
                viewers = int(s.get("viewer_count", 0))
                out.append(make_signal(
                    source="twitch",
                    signal_type="streamer_live",
                    weight=min(100, viewers // 60),
                    payload={
                        "login": s.get("user_login"),
                        "title": s.get("title"),
                        "game_name": s.get("game_name"),
                        "viewers": viewers,
                        "started_at": s.get("started_at"),
                    },
                    streamer_id=s.get("user_login"),
                ))
            return out
    except Exception as e:
        logger.warning("twitch adapter failed: %s — falling back to mock", e)
        return _mock_streamer_signals("twitch", TRACKED_TWITCH_LOGINS)


async def adapter_kick() -> List[Dict[str, Any]]:
    """Kick public channel API: https://kick.com/api/v2/channels/{slug}.
    No auth needed, but rate-limited. We try real first, fall back to mock."""
    if os.environ.get("PUTKI_HQ_DISABLE_KICK_LIVE", "0") == "1":
        return _mock_streamer_signals("kick", TRACKED_KICK_LOGINS)
    out: List[Dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=6, headers={"User-Agent": "PutkiHQBot/1.0"}) as cx:
            for login in TRACKED_KICK_LOGINS:
                try:
                    r = await cx.get(f"https://kick.com/api/v2/channels/{login}")
                    if r.status_code != 200:
                        continue
                    j = r.json()
                    livestream = j.get("livestream") or {}
                    if not livestream.get("is_live"):
                        continue
                    viewers = int(livestream.get("viewer_count", 0))
                    out.append(make_signal(
                        source="kick",
                        signal_type="streamer_live",
                        weight=min(100, viewers // 60),
                        payload={
                            "login": login,
                            "title": livestream.get("session_title"),
                            "viewers": viewers,
                            "started_at": livestream.get("created_at"),
                        },
                        streamer_id=login,
                    ))
                except Exception:
                    continue
        if out:
            return out
    except Exception as e:
        logger.warning("kick adapter failed: %s", e)
    return _mock_streamer_signals("kick", TRACKED_KICK_LOGINS)


async def adapter_youtube() -> List[Dict[str, Any]]:
    """YouTube Data API v3 search.list filtered by big-win keywords across
    tracked Finnish channels. Without YOUTUBE_API_KEY, emits mock detections."""
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        return _mock_youtube_detections()
    # Real implementation would search by channelId for ['mega win','iso voitto','€','tilt'].
    # Stubbed minimal call so first-real-deploy works:
    return _mock_youtube_detections()  # TODO: wire real search.list once channel ids configured


async def adapter_forum() -> List[Dict[str, Any]]:
    """Suomi24 + Ylilauta forum velocity. Real scraping is rate-limited and
    fragile — we emit synthetic-but-realistic mock signals until a scraping
    service is configured (FORUM_SCRAPER_URL env)."""
    scraper_url = os.environ.get("FORUM_SCRAPER_URL")
    if not scraper_url:
        return _mock_forum_signals()
    try:
        async with httpx.AsyncClient(timeout=8) as cx:
            r = await cx.get(scraper_url)
            r.raise_for_status()
            rows = r.json().get("threads", [])
            return [make_signal(
                source="forum",
                signal_type="forum_velocity",
                weight=min(100, int(t.get("posts_per_hour", 0)) * 4),
                payload={
                    "site": t.get("site"),
                    "thread_title": t.get("title"),
                    "posts_per_hour": t.get("posts_per_hour"),
                    "url": t.get("url"),
                },
            ) for t in rows]
    except Exception as e:
        logger.warning("forum adapter failed: %s", e)
        return _mock_forum_signals()


async def adapter_sports() -> List[Dict[str, Any]]:
    """Liiga / NHL / EPL / F1. Without SPORTS_API_KEY, mock weekend events."""
    if not os.environ.get("SPORTS_API_KEY"):
        return _mock_sports_signals()
    # TODO: real API-Football / Ergast / NHL polling once key supplied.
    return _mock_sports_signals()


async def adapter_internal_activity(db) -> List[Dict[str, Any]]:
    """Reads recent published_content + signups from our own DB and emits a
    soft 'editorial heartbeat' signal so the dial reflects our own publishing
    cadence even when external sources are quiet."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat()
    pub_count = await db.published_content.count_documents({"published_at": {"$gte": cutoff}})
    if pub_count <= 0:
        return []
    return [make_signal(
        source="internal",
        signal_type="editorial_heartbeat",
        weight=min(60, pub_count * 12),
        payload={"published_in_last_4h": pub_count},
    )]


# ── mock generators (transparent + tagged) ──────────────────────────────────
def _mock_streamer_signals(source: str, logins: List[str]) -> List[Dict[str, Any]]:
    rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 300))  # stable per 5min bucket
    out: List[Dict[str, Any]] = []
    for login in logins:
        if rng.random() < 0.55:  # ~55% live at any moment in mock land
            viewers = rng.randint(180, 5800)
            out.append(make_signal(
                source=source,
                signal_type="streamer_live",
                weight=min(100, viewers // 60),
                payload={
                    "login": login,
                    "viewers": viewers,
                    "game_name": rng.choice([
                        "Sweet Bonanza 1000", "Gates of Olympus", "Fire in the Hole 2",
                        "The Dog House Megaways", "Big Bass Splash",
                    ]),
                },
                mocked=True,
                streamer_id=login,
            ))
    return out


def _mock_youtube_detections() -> List[Dict[str, Any]]:
    rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 1800))
    if rng.random() > 0.4:
        return []
    streamer = rng.choice(["AndyPyro", "Jarttu84", "JugiPelaa", "Pact"])
    win = rng.choice([12_400, 24_800, 42_800, 89_200, 124_000])
    return [make_signal(
        source="youtube",
        signal_type="big_win",
        weight=min(100, win // 1500),
        payload={
            "streamer": streamer,
            "title_parsed": f"{streamer} — €{win:,} on Fire in the Hole 2",
            "amount_eur": win,
            "video_url": f"https://youtube.com/watch?v=mock-{uuid.uuid4().hex[:8]}",
        },
        mocked=True,
        streamer_id=streamer.lower(),
    )]


def _mock_forum_signals() -> List[Dict[str, Any]]:
    rng = random.Random(int(datetime.now(timezone.utc).timestamp() // 600))
    out = []
    if rng.random() > 0.3:
        out.append(make_signal(
            source="forum",
            signal_type="forum_velocity",
            weight=rng.randint(20, 65),
            payload={
                "site": rng.choice(["suomi24", "ylilauta"]),
                "thread_title": rng.choice([
                    "Weezybet kotiutus jämähti taas",
                    "Onko kellään kokemusta Britestä",
                    "Pragmatic-jättibonukset",
                    "Suomen lisenssi 2027 — mitä mieltä",
                ]),
                "posts_per_hour": rng.randint(8, 40),
            },
            mocked=True,
        ))
    return out


def _mock_sports_signals() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    # Friday-Saturday Liiga prime-time burst
    if now.weekday() in (4, 5) and 16 <= now.hour <= 22:
        return [make_signal(
            source="sports",
            signal_type="sports_event",
            weight=70,
            payload={
                "league": "Liiga",
                "match": "Tappara — Ilves",
                "kickoff_in_minutes": 30,
            },
            mocked=True,
        )]
    return []


# ── orchestrator ────────────────────────────────────────────────────────────
async def poll_all_sources(db) -> Dict[str, Any]:
    """Run every adapter concurrently, persist signals, return summary."""
    twitch, kick, yt, forum, sports, internal = await asyncio.gather(
        adapter_twitch(),
        adapter_kick(),
        adapter_youtube(),
        adapter_forum(),
        adapter_sports(),
        adapter_internal_activity(db),
        return_exceptions=True,
    )
    all_signals: List[Dict[str, Any]] = []
    errors: List[str] = []
    for label, result in (
        ("twitch", twitch), ("kick", kick), ("youtube", yt),
        ("forum", forum), ("sports", sports), ("internal", internal),
    ):
        if isinstance(result, Exception):
            errors.append(f"{label}: {result}")
            continue
        all_signals.extend(result)

    if all_signals:
        await db.signals.insert_many([dict(s) for s in all_signals])

    # Drop expired signals so the collection doesn't grow unbounded.
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.signals.delete_many({"expires_at": {"$lt": now_iso}})

    return {
        "polled_at": now_iso,
        "total": len(all_signals),
        "by_source": {
            "twitch": len([s for s in all_signals if s["source"] == "twitch"]),
            "kick": len([s for s in all_signals if s["source"] == "kick"]),
            "youtube": len([s for s in all_signals if s["source"] == "youtube"]),
            "forum": len([s for s in all_signals if s["source"] == "forum"]),
            "sports": len([s for s in all_signals if s["source"] == "sports"]),
            "internal": len([s for s in all_signals if s["source"] == "internal"]),
        },
        "any_real": any(not s.get("mocked") for s in all_signals),
        "errors": errors,
    }


async def list_recent_signals(db, source: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if source:
        q["source"] = source
    cur = db.signals.find(q, {"_id": 0}).sort("captured_at", -1).limit(max(1, min(500, limit)))
    return await cur.to_list(length=limit)
