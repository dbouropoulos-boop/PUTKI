"""
PUTKI HQ - Tournament closing worker + analytics aggregation (iter58).

Two halves:

  1. `tournament_closing_worker_loop` - fires once per day, detects whether
     the just-closed ISO week's winners have already been announced via
     Telegram; if not, composes a Finnish recap message and posts it to
     `TELEGRAM_CHANNEL_ID`. Idempotent via `tournament_closings` collection
     with unique index on `week_iso`.

  2. `mini_game_analytics` - aggregates plays/finishes/captures/conversion
     per game (and optionally per ISO week) for the back-office dashboard.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = int(os.environ.get("TOURNAMENT_CLOSING_CHECK_INTERVAL", "3600"))  # 1h


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _week_iso(dt: datetime) -> str:
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def _last_completed_week_iso() -> str:
    """The just-closed ISO week (i.e. 'last Monday 00:00 UTC was N hours ago')."""
    return _week_iso(_now() - timedelta(days=7))


async def ensure_indexes(db) -> None:
    try:
        await db.tournament_closings.create_index("week_iso", unique=True)
        await db.mini_game_share_events.create_index([("game_slug", 1), ("week_iso", 1)])
        await db.mini_game_share_events.create_index("at")
    except Exception:
        logger.exception("mini_game_tournament ensure_indexes failed")


# ─────────────────────── Analytics aggregation ────────────────────────

# ─── iter64 pivot - Snake/Tap/Insight/Quiz killed from the active set.
# `scenario_decisions` is now the sole profiler. Snake/Tap/Insight/Quiz
# slugs remain registered in `_LEGACY_GAME_SLUGS` so the analytics
# endpoint can still surface historical data when the user opts to
# inspect a past week, but the tournament closing worker only awards
# the scenario winner.
ACTIVE_GAME_SLUGS = [
    "scenario_decisions",
]
_LEGACY_GAME_SLUGS = [
    "quiz_gambling_literacy",
    "insight_reveal",
    "arcade_snake",
    "arcade_tap",
]
GAME_TITLES_FI = {
    "scenario_decisions":     "Pelaajaprofiili",
    "quiz_gambling_literacy": "Tietoisuustesti",
    "insight_reveal":         "Tietoraape",
    "arcade_snake":           "Aikatappo · Mato",
    "arcade_tap":             "Aikatappo · Napautus",
}


async def aggregate_metrics(db, *, week_iso: Optional[str] = None) -> Dict[str, Any]:
    """Per-game metrics for the dashboard.

    Returns a list of rows, one per active game:
      • plays_started - `mini_game_plays` rows
      • plays_finished - `status == finished`
      • leads_captured - unique emails in `mini_game_leads`
      • conversion_pct - leads / finished
      • returning_pct - % of leads that have ≥2 plays under the same email
      • shares - count from `mini_game_share_events`
      • top_score / top_player - current rank-1
    """
    rows: List[Dict[str, Any]] = []
    week_filter: Dict[str, Any] = {"week_iso": week_iso} if week_iso else {}
    lead_filter: Dict[str, Any] = {"tournament_week_iso": week_iso} if week_iso else {}
    share_filter: Dict[str, Any] = {"week_iso": week_iso} if week_iso else {}

    # iter66: legacy slugs (Snake/Tap/Insight/Quiz) iterate too so historical
    # rows stay queryable per the "keep historical data, hide routes" policy.
    for slug in list(ACTIVE_GAME_SLUGS) + list(_LEGACY_GAME_SLUGS):
        started = await db.mini_game_plays.count_documents({"game_slug": slug, **week_filter})
        finished = await db.mini_game_plays.count_documents(
            {"game_slug": slug, "status": "finished", **week_filter}
        )
        # Leads collection is keyed on (email_hash, source_game, tournament_week_iso).
        # `leads_captured` = unique email rows in the window.
        captured = await db.mini_game_leads.count_documents(
            {"source_game": slug, **lead_filter}
        )

        # Returning rate: how many emails captured for THIS slug also have
        # an earlier lead row for the same slug? We use email_hash + earlier
        # consent_at to detect.
        returning = 0
        if captured:
            pipeline = [
                {"$match": {"source_game": slug, **lead_filter}},
                {"$group": {"_id": "$email_hash", "count": {"$sum": 1},
                            "weeks": {"$addToSet": "$tournament_week_iso"}}},
                {"$match": {"$or": [{"count": {"$gt": 1}}, {"weeks.1": {"$exists": True}}]}},
                {"$count": "returning"},
            ]
            agg = await db.mini_game_leads.aggregate(pipeline).to_list(length=1)
            returning = (agg[0]["returning"] if agg else 0)
            # If filtered to a specific week we count only across earlier weeks
            if week_iso:
                pipeline2 = [
                    {"$match": {"source_game": slug, "tournament_week_iso": week_iso}},
                    {"$lookup": {
                        "from": "mini_game_leads",
                        "let": {"eh": "$email_hash"},
                        "pipeline": [
                            {"$match": {"$expr": {"$and": [
                                {"$eq": ["$email_hash", "$$eh"]},
                                {"$eq": ["$source_game", slug]},
                                {"$lt": ["$tournament_week_iso", week_iso]},
                            ]}}},
                            {"$limit": 1},
                        ],
                        "as": "earlier",
                    }},
                    {"$match": {"earlier.0": {"$exists": True}}},
                    {"$count": "returning"},
                ]
                agg2 = await db.mini_game_leads.aggregate(pipeline2).to_list(length=1)
                returning = (agg2[0]["returning"] if agg2 else 0)

        shares = await db.mini_game_share_events.count_documents(
            {"game_slug": slug, **share_filter}
        )

        top = await db.mini_game_leads.find_one(
            {"source_game": slug, **lead_filter, "score": {"$gt": 0}},
            {"_id": 0, "name": 1, "email": 1, "score": 1, "consent_at": 1},
            sort=[("score", -1), ("pct", -1), ("consent_at", 1)],
        )
        top_player = ""
        top_score = 0
        if top:
            top_score = int(top.get("score") or 0)
            top_player = (top.get("name") or "").strip()
            if not top_player:
                local = (top.get("email") or "").split("@")[0]
                top_player = (local[:3] + "•••" + local[-1:]) if len(local) > 4 else (local or "pelaaja")

        rows.append({
            "game_slug": slug,
            "game_title_fi": GAME_TITLES_FI[slug],
            "plays_started": started,
            "plays_finished": finished,
            "leads_captured": captured,
            "conversion_pct": round((captured / finished * 100.0) if finished else 0.0, 1),
            "returning_pct": round((returning / captured * 100.0) if captured else 0.0, 1),
            "returning_count": returning,
            "shares": shares,
            "top_score": top_score,
            "top_player": top_player,
        })

    totals = {
        "plays_started": sum(r["plays_started"] for r in rows),
        "plays_finished": sum(r["plays_finished"] for r in rows),
        "leads_captured": sum(r["leads_captured"] for r in rows),
        "shares": sum(r["shares"] for r in rows),
    }
    totals["conversion_pct"] = round(
        (totals["leads_captured"] / totals["plays_finished"] * 100.0)
        if totals["plays_finished"] else 0.0, 1,
    )

    return {
        "week_iso": week_iso,
        "rows": rows,
        "totals": totals,
        "generated_at": _now().isoformat(),
    }


# ───────────────────────── Share tracking ─────────────────────────

async def track_share(db, *, game_slug: str, play_id: Optional[str] = None) -> None:
    """Fire-and-forget telemetry - increments `mini_game_share_events`."""
    if game_slug not in ACTIVE_GAME_SLUGS:
        return
    try:
        await db.mini_game_share_events.insert_one({
            "game_slug": game_slug,
            "play_id": play_id or "",
            "week_iso": _week_iso(_now()),
            "at": _now().isoformat(),
        })
    except Exception:
        logger.exception("track_share failed for %s", game_slug)


# ─────────────────── Tournament closing telegram bot ────────────────────

async def _build_closing_message(db, *, week_iso: str) -> Optional[str]:
    """Compose the Finnish weekly profiler recap for the just-closed week.
    iter64 pivot: this no longer ranks across 5 games - it surfaces only
    the top scenario_decisions performer. Returns None when no winner
    exists (the worker silently skips empty weeks)."""
    top = await db.mini_game_leads.find_one(
        {"source_game": "scenario_decisions", "tournament_week_iso": week_iso, "score": {"$gt": 0}},
        {"_id": 0, "name": 1, "email": 1, "score": 1, "consent_at": 1, "persona_key": 1},
        sort=[("score", -1), ("pct", -1), ("consent_at", 1)],
    )
    if not top:
        return None
    score = int(top.get("score") or 0)
    name = (top.get("name") or "").strip()
    if not name:
        local = (top.get("email") or "").split("@")[0]
        name = (local[:3] + "•••" + local[-1:]) if len(local) > 4 else (local or "pelaaja")
    persona_key = top.get("persona_key") or ""
    profile_label = {
        "cold_calculator": "Kylmä laskija",
        "patient_tactician": "Kärsivällinen taktikko",
        "streak_chaser": "Putken jahti",
        "comeback_believer": "Comeback-uskoja",
        "tilt_risk": "Tilt-riski",
    }.get(persona_key, "")
    lines = [
        f"🎯 *VIIKON PROFILOIJA · {week_iso}*",
        "",
        "Putki HQ:n pelaajaprofiilin viikkokierros on suljettu.",
        "",
        f"• *{name}* - {score} / 18 p." + (f" · _{profile_label}_" if profile_label else ""),
        "",
        "Tämä ei ole tappiokisa eikä rahaa pelaava turnaus - se on rehellinen kuukauden snapshot omasta profiilistasi.",
        "",
        "👉 Tee profilointi tällä viikolla: putkihq.fi/peliareena",
    ]
    return "\n".join(lines)


async def _already_announced(db, *, week_iso: str) -> bool:
    return bool(await db.tournament_closings.find_one({"week_iso": week_iso}, {"_id": 1}))


async def announce_tournament_closing(db, *, week_iso: Optional[str] = None,
                                       force: bool = False) -> Dict[str, Any]:
    """One-shot announcement. Idempotent via `tournament_closings.week_iso`
    unique index.  `force=True` ignores the dedupe row (admin override)."""
    week = week_iso or _last_completed_week_iso()
    if not force and await _already_announced(db, week_iso=week):
        return {"announced": False, "reason": "already_announced", "week_iso": week}

    message = await _build_closing_message(db, week_iso=week)
    if not message:
        return {"announced": False, "reason": "no_winners", "week_iso": week}

    # Reuse the dispatch telegram channel sender.
    from dispatch_daily import TELEGRAM_CHANNEL_ID, _attempt_telegram_send
    if not TELEGRAM_CHANNEL_ID:
        return {"announced": False, "reason": "telegram_channel_not_configured",
                "week_iso": week, "message_preview": message[:200]}

    # `_attempt_telegram_send` expects a payload shape; we craft one that
    # the renderer can pass through. We bypass the canonical renderer by
    # injecting `raw_text` and patching `_render_telegram_text` upstream
    # would couple modules; cleaner: post directly to the Telegram API.
    import httpx
    from dispatch_daily import TELEGRAM_BOT_TOKEN
    if not TELEGRAM_BOT_TOKEN:
        return {"announced": False, "reason": "telegram_bot_token_missing", "week_iso": week}

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(url, json={
                "chat_id": TELEGRAM_CHANNEL_ID,
                "text": message,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True,
            })
            ok = (r.status_code == 200 and (r.json() or {}).get("ok") is True)
    except Exception as e:
        logger.exception("tournament closing telegram send errored")
        return {"announced": False, "reason": f"send_errored:{e}", "week_iso": week}

    if not ok:
        return {"announced": False, "reason": "telegram_send_failed", "week_iso": week,
                "telegram_status": r.status_code if 'r' in dir() else None}

    # Record idempotency row AFTER successful send.
    await db.tournament_closings.insert_one({
        "week_iso": week,
        "announced_at": _now().isoformat(),
        "channel": "telegram",
        "channel_id": TELEGRAM_CHANNEL_ID,
        "message": message,
    })
    return {"announced": True, "week_iso": week, "channel": "telegram"}


async def tournament_closing_worker_loop(db) -> None:
    """Long-lived worker. Once per hour, checks whether the previous ISO
    week has been announced; if not, fires the Telegram broadcast. The
    first opportunity is always Monday 00:01 UTC (when the new ISO week
    rolls over) so a "no_winners" early-week tick is impossible to confuse
    with a real recap."""
    await asyncio.sleep(120)  # boot warmup
    while True:
        try:
            now = _now()
            # Only attempt on Monday 00:00-06:00 UTC, OR when the week
            # was simply never closed (force=False is idempotent so a
            # missed Monday auto-recovers on Tuesday).
            is_monday_morning = now.weekday() == 0 and now.hour < 6
            last_week = _last_completed_week_iso()
            already = await _already_announced(db, week_iso=last_week)
            if (is_monday_morning or not already) and not already:
                summary = await announce_tournament_closing(db, week_iso=last_week)
                logger.info("tournament_closing_worker tick: %s", summary)
        except Exception:
            logger.exception("tournament_closing_worker tick failed")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
