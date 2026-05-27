"""
PUTKI HQ - Daily dispatch worker (Email digest + SMS alerts + Telegram alerts).

Default mode: DRY RUN. Until Resend / Twilio / Telegram bot tokens land in
`/app/backend/.env`, the worker assembles every payload it WOULD send and
writes the full audit row to `dispatch_log`. No external call is made.
The moment the credentials show up, the dispatcher hot-switches to real
sends without code changes - purely env-driven.

Cadence
-------
Once per day at 10:00 Europe/Helsinki. The worker loops every 60 s and
checks two conditions before kicking off:

  * It's between 10:00 and 10:05 Helsinki local time, AND
  * `dispatch_log` has no row for today with `kind == 'cycle'`.

This means a missed minute (process restart) still fires inside the
five-minute grace window, and a successful cycle never double-fires.

Manual triggers
---------------
`POST /api/admin/dispatch/run` calls `run_daily_dispatch(db, dry_run=...)`
directly. Useful for back-office QA + once-off catch-up dispatches.

Audit + observability
---------------------
Every individual would-be send writes a `dispatch_log` row with:
    { id, kind, channel, segment, recipient, payload, mode, sent_at,
      provider, provider_response, error }
`mode` is `dry_run` or `live`. `provider_response` and `error` stay
empty in dry-run.

The cycle itself writes a single `kind == 'cycle'` row at the end so the
"once per day" gate has something to look at.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta, time as dtime
from typing import Any, Dict, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo  # py>=3.9
except ImportError:  # pragma: no cover - fallback for older runtimes
    ZoneInfo = None  # type: ignore

logger = logging.getLogger(__name__)

HELSINKI = ZoneInfo("Europe/Helsinki") if ZoneInfo else timezone(timedelta(hours=2))
DISPATCH_HOUR = int(os.environ.get("DISPATCH_HOUR_LOCAL", "10"))
DISPATCH_GRACE_MINUTES = int(os.environ.get("DISPATCH_GRACE_MINUTES", "5"))
WORKER_INTERVAL_SECONDS = int(os.environ.get("DISPATCH_WORKER_INTERVAL", "60"))

# Provider tokens - when absent the channel falls through to dry-run.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY") or ""
RESEND_FROM = os.environ.get("RESEND_FROM") or ""
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID") or ""
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN") or ""
TWILIO_FROM = os.environ.get("TWILIO_FROM") or ""
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or ""
# Optional channel for broadcast mode. When set, the telegram channel
# sends ONE message per cycle to this @handle / chat_id (no per-subscriber
# DM fan-out). Recommended for editorial dispatches where there's no
# need for personalised delivery and Telegram's bot-must-/start barrier
# would otherwise leave most subscribers unreachable.
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID") or ""

# Worker kill switch - set to "1" in test/preview to keep the loop quiet.
DISABLE_WORKER = os.environ.get("PUTKI_HQ_DISABLE_DISPATCH_WORKER", "0") == "1"

# ── Telegram throttling (iter55) ─────────────────────────────────────────
#
# Two gates control whether the daily Telegram broadcast fires:
#
#   1. SHARPNESS THRESHOLD - at least one of today's 5 picks must exceed
#      `TELEGRAM_BROADCAST_SHARPNESS_MIN`. Default 70 - keeps Telegram
#      readers from getting low-conviction noise on quiet market days.
#
#   2. ONCE PER DAY - the broadcast is idempotent per UTC date. A new
#      `telegram_broadcasts` collection records `{date_ymd, fired_at,
#      payload_picks_count, top_sharpness}`. If today's entry already
#      exists, we skip - even manual `run_daily_dispatch` calls won't
#      double-fire. Both the scheduled cycle and manual triggers share
#      this lock.
#
# Both gates are skippable via env (`TELEGRAM_THROTTLE_DISABLED=1`) for
# preview / QA. The cycle audit row still records the throttle outcome
# (fired vs. throttled-low-sharpness vs. throttled-already-sent).
TELEGRAM_BROADCAST_SHARPNESS_MIN = int(
    os.environ.get("TELEGRAM_BROADCAST_SHARPNESS_MIN", "70")
)
TELEGRAM_THROTTLE_DISABLED = os.environ.get("TELEGRAM_THROTTLE_DISABLED", "0") == "1"


# ── Indexes ──────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> None:
    try:
        await db.dispatch_log.create_index("sent_at")
        await db.dispatch_log.create_index([("kind", 1), ("sent_at", -1)])
        await db.dispatch_log.create_index([("cycle_id", 1), ("kind", 1)])
        await db.dispatch_review_flags.create_index("send_id", unique=True)
        await db.dispatch_review_flags.create_index([("status", 1), ("created_at", -1)])
        await db.dispatch_segment_overrides.create_index(
            [("channel", 1), ("consent_tag", 1)], unique=True,
        )
        # iter55: one row per UTC date - guarantees a Telegram broadcast
        # fires AT MOST once per day even across worker restarts + manual
        # POSTs to /api/admin/dispatch/run.
        await db.telegram_broadcasts.create_index("date_ymd", unique=True)
    except Exception:
        logger.exception("dispatch_daily.ensure_indexes failed")


# ── Telegram throttle helpers (iter55) ───────────────────────────────────

def _today_ymd() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _telegram_already_sent_today(db) -> bool:
    """True if a row exists in `telegram_broadcasts` for today's UTC date.
    Disabled via env TELEGRAM_THROTTLE_DISABLED=1 (preview/QA only)."""
    if TELEGRAM_THROTTLE_DISABLED:
        return False
    try:
        return bool(await db.telegram_broadcasts.find_one(
            {"date_ymd": _today_ymd()}, {"_id": 1}
        ))
    except Exception:
        logger.exception("telegram throttle check failed; allowing broadcast")
        return False


def _meets_sharpness_threshold(picks: List[Dict[str, Any]]) -> Tuple[bool, int]:
    """Return (meets_threshold, top_sharpness). Picks list = the
    rendered Telegram payload entries (each with `sharpness` int).
    When TELEGRAM_THROTTLE_DISABLED=1, meets_threshold is always True."""
    top = 0
    for p in picks:
        try:
            s = int(p.get("sharpness") or 0)
        except (TypeError, ValueError):
            s = 0
        if s > top:
            top = s
    if TELEGRAM_THROTTLE_DISABLED:
        return True, top
    return top >= TELEGRAM_BROADCAST_SHARPNESS_MIN, top


async def _record_telegram_broadcast(
    db, *, picks_count: int, top_sharpness: int, mode: str,
) -> None:
    """Idempotent insert of today's broadcast row. Unique index on
    date_ymd absorbs duplicate-insert races silently."""
    try:
        await db.telegram_broadcasts.update_one(
            {"date_ymd": _today_ymd()},
            {"$setOnInsert": {
                "date_ymd": _today_ymd(),
                "fired_at": datetime.now(timezone.utc).isoformat(),
                "payload_picks_count": picks_count,
                "top_sharpness": top_sharpness,
                "mode": mode,
            }},
            upsert=True,
        )
    except Exception:
        logger.exception("telegram broadcast record failed")


# ── Segment-channel mode overrides ───────────────────────────────────────
#
# Mode states (per channel × segment):
#   * `dry_run`            - default. Audit-only. Records intent.
#   * `live_segment_only`  - provider hit IF this segment is the recipient set.
#                            Other segments on the same channel remain dry-run.
#   * `live_global`        - channel is globally live (creds permitting); this
#                            segment is part of the unlocked set.
#
# `live_segment_only` and `live_global` are functionally the same at the
# per-segment dispatch level (both → real send for this segment). The
# distinction is intent recorded for audit + a UI hint: `live_global` means
# the admin intends to flip the entire channel live across all unlocked
# segments. The worker honors both as "this segment goes live".

VALID_OVERRIDE_MODES = {"dry_run", "live_segment_only", "live_global"}


async def get_segment_override(db, channel: str, consent_tag: str) -> str:
    """Returns mode for (channel, consent_tag). Defaults to `dry_run`."""
    doc = await db.dispatch_segment_overrides.find_one(
        {"channel": channel, "consent_tag": consent_tag},
        {"_id": 0, "mode": 1},
    )
    if not doc:
        return "dry_run"
    mode = doc.get("mode") or "dry_run"
    return mode if mode in VALID_OVERRIDE_MODES else "dry_run"


async def set_segment_override(db, channel: str, consent_tag: str, mode: str) -> Dict[str, Any]:
    if mode not in VALID_OVERRIDE_MODES:
        raise ValueError(f"mode must be one of {sorted(VALID_OVERRIDE_MODES)}")
    if channel not in {"email", "sms", "telegram"}:
        raise ValueError("channel must be email|sms|telegram")
    now = datetime.now(timezone.utc).isoformat()
    await db.dispatch_segment_overrides.update_one(
        {"channel": channel, "consent_tag": consent_tag},
        {"$set": {"channel": channel, "consent_tag": consent_tag,
                   "mode": mode, "updated_at": now}},
        upsert=True,
    )
    return {"channel": channel, "consent_tag": consent_tag,
            "mode": mode, "updated_at": now}


async def list_segment_overrides(db) -> List[Dict[str, Any]]:
    cur = db.dispatch_segment_overrides.find({}, {"_id": 0})
    return [d async for d in cur]


# ── Review flags ─────────────────────────────────────────────────────────

VALID_FLAG_REASONS = {"tone_off", "factually_incorrect", "legal_concern", "formatting", "other"}


async def flag_send(db, send_id: str, reason: str,
                    note: Optional[str] = None,
                    flagged_by: Optional[str] = None) -> Dict[str, Any]:
    if reason not in VALID_FLAG_REASONS:
        raise ValueError(f"reason must be one of {sorted(VALID_FLAG_REASONS)}")
    # Confirm the send exists.
    send = await db.dispatch_log.find_one(
        {"id": send_id, "kind": "send"}, {"_id": 0, "id": 1, "channel": 1, "segment": 1, "cycle_id": 1},
    )
    if not send:
        raise ValueError(f"send {send_id} not found")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": uuid.uuid4().hex,
        "send_id": send_id,
        "cycle_id": send.get("cycle_id"),
        "channel": send.get("channel"),
        "segment": send.get("segment"),
        "reason": reason,
        "note": (note or "").strip()[:600],
        "status": "open",
        "flagged_by": (flagged_by or "admin")[:120],
        "created_at": now,
        "updated_at": now,
    }
    # Upsert by send_id so flagging twice updates the existing row.
    await db.dispatch_review_flags.update_one(
        {"send_id": send_id},
        {"$set": doc},
        upsert=True,
    )
    stored = await db.dispatch_review_flags.find_one({"send_id": send_id}, {"_id": 0})
    return stored


async def unflag_send(db, send_id: str) -> bool:
    result = await db.dispatch_review_flags.delete_one({"send_id": send_id})
    return result.deleted_count > 0


async def list_flags(db, *, status: Optional[str] = None,
                     limit: int = 200) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    cur = db.dispatch_review_flags.find(q, {"_id": 0}).sort([("created_at", -1)]).limit(
        max(1, min(int(limit or 200), 500))
    )
    return [d async for d in cur]


# ── Cycle list + detail (for the previewer) ──────────────────────────────

async def list_cycles(db, *, days: int = 14, limit: int = 50) -> List[Dict[str, Any]]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
    cur = db.dispatch_log.find(
        {"kind": "cycle", "$or": [
            {"finished_at": {"$gte": cutoff}},
            {"started_at": {"$gte": cutoff}},
        ]},
        {"_id": 0},
    ).sort([("finished_at", -1), ("started_at", -1)]).limit(
        max(1, min(int(limit or 50), 100))
    )
    return [d async for d in cur]


async def cycle_detail(db, cycle_id: str) -> Dict[str, Any]:
    """Full cycle bundle: cycle doc + per-channel grouped sends + payloads
    + flag overlay. Powers the side-by-side previewer."""
    cycle = await db.dispatch_log.find_one(
        {"kind": "cycle", "id": cycle_id}, {"_id": 0},
    )
    if not cycle:
        raise ValueError(f"cycle {cycle_id} not found")
    sends_cur = db.dispatch_log.find(
        {"kind": "send", "cycle_id": cycle_id}, {"_id": 0},
    ).sort([("sent_at", 1)])
    sends = [d async for d in sends_cur]

    # Flags keyed by send_id.
    flag_cur = db.dispatch_review_flags.find(
        {"cycle_id": cycle_id}, {"_id": 0},
    )
    flag_map: Dict[str, Dict[str, Any]] = {}
    async for f in flag_cur:
        flag_map[f["send_id"]] = f

    # Group sends by channel, surface one representative payload per channel.
    per_channel: Dict[str, Dict[str, Any]] = {}
    for ch in ("email", "sms", "telegram"):
        ch_sends = [s for s in sends if s.get("channel") == ch]
        # One representative payload - they're identical within a channel.
        payload = ch_sends[0].get("payload") if ch_sends else None
        rendered = render_preview(ch, payload or {}) if payload else None
        per_channel[ch] = {
            "channel": ch,
            "segment": ch_sends[0].get("segment") if ch_sends else None,
            "recipient_count": len(ch_sends),
            "payload": payload,
            "rendered_text": rendered,
            "mode": ch_sends[0].get("mode") if ch_sends else None,
            "sends": [
                {**s, "flag": flag_map.get(s.get("id"))}
                for s in ch_sends
            ],
        }

    return {
        "cycle": cycle,
        "per_channel": per_channel,
        "flag_count": len(flag_map),
    }


def render_preview(channel: str, payload: Dict[str, Any]) -> str:
    """Channel-aware text renderer reused for both real sends + UI preview."""
    if channel == "email":
        return _render_email_text(payload or {})
    return _render_sms_text(payload or {})


# ── Helpers ──────────────────────────────────────────────────────────────

def _helsinki_now() -> datetime:
    return datetime.now(HELSINKI)


def _today_key(at: Optional[datetime] = None) -> str:
    dt = at or _helsinki_now()
    return dt.strftime("%Y-%m-%d")


def _is_dispatch_window(at: Optional[datetime] = None) -> bool:
    dt = at or _helsinki_now()
    target = dt.replace(hour=DISPATCH_HOUR, minute=0, second=0, microsecond=0)
    grace = target + timedelta(minutes=DISPATCH_GRACE_MINUTES)
    return target <= dt < grace


async def _cycle_already_ran_today(db) -> bool:
    key = _today_key()
    found = await db.dispatch_log.find_one(
        {"kind": "cycle", "cycle_date": key},
        projection={"_id": 1},
    )
    return found is not None


def _channel_live_mode(channel: str) -> Tuple[bool, str]:
    """Returns (is_live, provider). Dry-run when creds missing."""
    if channel == "email":
        return (bool(RESEND_API_KEY and RESEND_FROM), "resend")
    if channel == "sms":
        return (bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM), "twilio")
    if channel == "telegram":
        return (bool(TELEGRAM_BOT_TOKEN), "telegram_bot")
    return (False, "unknown")


# ── Payload assemblers ───────────────────────────────────────────────────

async def _build_email_digest_payload(db) -> Dict[str, Any]:
    """Email digest = Mittari state + 4 top news + skene tunnelma.

    `email_sentiment` is the slow channel - we DON'T put pelisignaalit picks
    in here. Picks go to SMS/Telegram. Keeping the channel/purpose split
    strict per the architecture invariants.
    """
    payload: Dict[str, Any] = {"sections": []}

    # 1) Mittari state
    try:
        from dial_engine import latest_dial_snapshot
        snap = await latest_dial_snapshot(db)
        if snap:
            state = snap.get("state", {})
            payload["sections"].append({
                "kind": "mittari",
                "label": state.get("label"),
                "value": int(round(snap.get("composite_score") or 0)),
                "headline": state.get("headline"),
            })
    except Exception:
        logger.exception("email digest: mittari lookup failed")

    # 2) Top 4 news (most recent classified ticker items)
    try:
        cur = db.news_ticker_items.find(
            {}, {"_id": 0, "source": 1, "title": 1, "url": 1,
                 "category": 1, "severity": 1, "captured_at": 1}
        ).sort([("captured_at", -1)]).limit(4)
        items = [d async for d in cur]
        payload["sections"].append({"kind": "news", "items": items})
    except Exception:
        logger.exception("email digest: news lookup failed")

    # 3) Skene tunnelma - last 24h of stream signals + ticker volume
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        news_24h = await db.news_ticker_items.count_documents(
            {"captured_at": {"$gte": cutoff.isoformat()}}
        )
        payload["sections"].append({
            "kind": "skene",
            "news_24h": news_24h,
        })
    except Exception:
        logger.exception("email digest: skene lookup failed")

    return payload


async def _build_sms_alerts_payload(db) -> Dict[str, Any]:
    """SMS alerts = today's signals with Sharpness >= 75.

    Pure data shaping - message text is built per-recipient later.
    """
    payload: Dict[str, Any] = {"picks": []}
    try:
        from odds_api import get_featured_picks
        cached = await get_featured_picks()
        picks = (cached or {}).get("picks") or []
        for p in picks[:5]:
            sharp = (p.get("sharpness") or {}).get("sharpness", 0)
            if sharp < 75:
                continue
            payload["picks"].append({
                "event_name": p.get("event_name") or p.get("label"),
                "pick": p.get("pick_team") or p.get("pick"),
                "odds_decimal": p.get("odds_decimal"),
                "bookmaker": p.get("bookmaker"),
                "sharpness": sharp,
            })
    except Exception:
        logger.exception("sms alerts: picks lookup failed")
    return payload


async def _build_telegram_alerts_payload(db) -> Dict[str, Any]:
    """Telegram channel broadcast - today's 5 Mittari signals + a link.

    iter52: deliberately wider than SMS. SMS is a paid "high-confidence
    only" channel (sharpness >= 75); Telegram is the public channel
    broadcast that mirrors what readers see on /mittari at 09:00. We
    surface ALL 5 picks (not just the 75+ band) because:
      • Telegram is opt-in via a public channel, not paid SMS.
      • The whole point is parity with the Mittari page.
      • Channel followers self-curate; we don't.
    """
    payload: Dict[str, Any] = {"picks": [], "telegram": True}
    try:
        from odds_api import get_featured_picks
        cached = await get_featured_picks()
        picks = (cached or {}).get("picks") or []
        for p in picks[:5]:
            home = p.get("home_team") or ""
            away = p.get("away_team") or ""
            event = (
                p.get("event_name")
                or p.get("label")
                or (f"{home} vs {away}" if home and away else "")
            )
            payload["picks"].append({
                "event_name": event,
                "pick": p.get("pick_team") or p.get("pick"),
                "odds_decimal": p.get("odds_decimal") or p.get("decimal_odds"),
                "bookmaker": p.get("bookmaker"),
                "sharpness": (
                    p.get("sharpness", {}).get("sharpness")
                    if isinstance(p.get("sharpness"), dict)
                    else p.get("sharpness") or 0
                ),
                "sport": p.get("sport") or p.get("sport_label") or p.get("league"),
                "sport_icon": p.get("sport_icon"),
                "kickoff_at": p.get("kickoff_at") or p.get("commence_time"),
            })
    except Exception:
        logger.exception("telegram broadcast: picks lookup failed")
    return payload


# ── Recipient lookup ─────────────────────────────────────────────────────

async def _recipients_for_tag(db, consent_tag: str) -> List[Dict[str, Any]]:
    """Pull opted-in identifiers for a given consent_tag.

    Each row is whatever `optin_consents` stored at consent time - keyed
    by `identifier` (email / phone / @handle) + `channel` + `surface` +
    `consent_tag`.
    """
    cur = db.optin_consents.find(
        {"consent_tag": consent_tag},
        {"_id": 0, "identifier": 1, "channel": 1, "surface": 1, "captured_at": 1},
    )
    return [doc async for doc in cur]


# ── Send / dry-run primitives ────────────────────────────────────────────

async def _attempt_email_send(recipient: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Real Resend call when creds present, dry-run otherwise."""
    is_live, provider = _channel_live_mode("email")
    if not is_live:
        return {"mode": "dry_run", "provider": provider}
    # Real Resend call - kept minimal, full impl lands when keys arrive.
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM,
                    "to": [recipient],
                    "subject": "PUTKI HQ - päivän skenekatsaus",
                    # Text-only stub until the HTML template lands.
                    "text": _render_email_text(payload),
                },
            )
        return {
            "mode": "live", "provider": provider,
            "provider_response": {"status": r.status_code, "body": r.text[:600]},
        }
    except Exception as exc:
        return {"mode": "live", "provider": provider, "error": str(exc)[:300]}


async def _attempt_sms_send(recipient: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    is_live, provider = _channel_live_mode("sms")
    if not is_live:
        return {"mode": "dry_run", "provider": provider}
    try:
        import httpx
        body = _render_sms_text(payload)
        async with httpx.AsyncClient(
            timeout=15.0,
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
        ) as http:
            r = await http.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
                data={"From": TWILIO_FROM, "To": recipient, "Body": body},
            )
        return {
            "mode": "live", "provider": provider,
            "provider_response": {"status": r.status_code, "body": r.text[:600]},
        }
    except Exception as exc:
        return {"mode": "live", "provider": provider, "error": str(exc)[:300]}


async def _attempt_telegram_send(recipient: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    is_live, provider = _channel_live_mode("telegram")
    if not is_live:
        return {"mode": "dry_run", "provider": provider}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": recipient, "text": _render_telegram_text(payload),
                      "parse_mode": "HTML", "disable_web_page_preview": True},
            )
        return {
            "mode": "live", "provider": provider,
            "provider_response": {"status": r.status_code, "body": r.text[:600]},
        }
    except Exception as exc:
        return {"mode": "live", "provider": provider, "error": str(exc)[:300]}


# ── Renderers (kept tiny so we can swap to richer templates later) ───────

def _render_email_text(payload: Dict[str, Any]) -> str:
    lines = ["PUTKI HQ - päivän skenekatsaus", "", ]
    for section in payload.get("sections", []):
        if section["kind"] == "mittari":
            lines.append(f"Mittari · {section.get('label')} ({section.get('value')})")
            if section.get("headline"):
                lines.append(f"  {section['headline']}")
            lines.append("")
        elif section["kind"] == "news":
            lines.append("Uutiset")
            for it in section.get("items", []):
                lines.append(f"  - {it.get('source', '?')} · {it.get('title', '')}")
                if it.get("url"):
                    lines.append(f"    {it['url']}")
            lines.append("")
        elif section["kind"] == "skene":
            lines.append(f"Skene · {section.get('news_24h', 0)} uutista viimeisen 24 h sisällä")
    lines.append("")
    lines.append("Lue: https://putkihq.fi")
    return "\n".join(lines)


def _render_sms_text(payload: Dict[str, Any]) -> str:
    picks = payload.get("picks", [])
    if not picks:
        return "PUTKI HQ: Ei tänään korkean varmuuden signaaleja."
    parts = [f"PUTKI HQ · {len(picks)} signaalia"]
    for p in picks:
        odds = f"@{p['odds_decimal']:.2f}" if p.get("odds_decimal") else ""
        parts.append(f"{p.get('pick', '?')} {odds} · S{p.get('sharpness', 0)}")
    return " | ".join(parts)[:480]


def _render_telegram_text(payload: Dict[str, Any]) -> str:
    """Channel-broadcast formatting. HTML parse-mode (bold + monospace odds).

    Mirrors the /mittari card stack: numbered list, sport eyebrow, pick +
    odds + sharpness gauge per row, footer with one CTA. Kept under
    Telegram's 4096-char hard cap by capping at 5 picks (the Mittari
    cap) and trimming long event names.
    """
    picks = payload.get("picks", []) or []
    from datetime import datetime

    def _fmt_kickoff(s: str) -> str:
        if not s:
            return ""
        try:
            dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
            return dt.strftime("%H:%M")
        except Exception:
            return ""

    if not picks:
        return (
            "<b>PUTKI HQ · Päivän signaalit</b>\n\n"
            "Ei tänään luotettavia signaaleja - palaamme huomenna klo 09:00.\n\n"
            "→ https://putkihq.fi/mittari"
        )

    lines = [f"<b>PUTKI HQ · Päivän signaalit · {len(picks)}/5</b>", ""]
    for i, p in enumerate(picks, 1):
        sport = (p.get("sport") or "")[:24]
        icon = p.get("sport_icon") or ""
        event = (p.get("event_name") or "")[:60]
        pick = (p.get("pick") or "?")[:40]
        odds = p.get("odds_decimal")
        odds_s = f"<code>@{odds:.2f}</code>" if isinstance(odds, (int, float)) and odds else "<code>@?.??</code>"
        sharp = int(p.get("sharpness") or 0)
        kickoff = _fmt_kickoff(p.get("kickoff_at"))
        meta_bits = [b for b in [f"{icon} {sport}".strip(), kickoff] if b]
        meta = " · ".join(meta_bits)

        lines.append(f"<b>{i:02d}</b> · {meta}" if meta else f"<b>{i:02d}</b>")
        if event:
            lines.append(f"   {event}")
        lines.append(f"   <b>{pick}</b> {odds_s} · Sharpness {sharp}")
        lines.append("")

    lines.append("→ https://putkihq.fi/mittari")
    out = "\n".join(lines).strip()
    # Telegram hard cap is 4096 chars; we're far under but trim defensively.
    return out[:4000]


# ── Per-channel dispatch ─────────────────────────────────────────────────

async def _dispatch_telegram_broadcast(
    db, *, consent_tag: str, payload: Dict[str, Any], cycle_id: str,
    force_dry_run: bool, override_mode: Optional[str],
    subscriber_count: int,
) -> Dict[str, Any]:
    """Single-shot broadcast post to TELEGRAM_CHANNEL_ID.

    Writes exactly one `dispatch_log` row with `recipient` set to the
    channel handle and `broadcast=True`. The `subscriber_count` is logged
    on the row + the result so the previewer can show "broadcast reach"
    instead of pretending the segment was fanned out.
    """
    mode = override_mode or await get_segment_override(db, "telegram", consent_tag)
    effective_live = mode in {"live_segment_only", "live_global"}
    if force_dry_run:
        effective_live = False

    sent_at = datetime.now(timezone.utc).isoformat()
    if effective_live:
        try:
            result = await _attempt_telegram_send(TELEGRAM_CHANNEL_ID, payload)
        except Exception as exc:
            result = {"mode": "live", "error": str(exc)[:300]}
    else:
        result = {"mode": "dry_run", "provider": _channel_live_mode("telegram")[1]}

    doc = {
        "id": uuid.uuid4().hex,
        "kind": "send",
        "cycle_id": cycle_id,
        "channel": "telegram",
        "segment": consent_tag,
        "recipient": TELEGRAM_CHANNEL_ID,
        "broadcast": True,
        "subscriber_count": subscriber_count,
        "payload": payload,
        "mode": result.get("mode", "dry_run"),
        "provider": result.get("provider"),
        "provider_response": result.get("provider_response"),
        "error": result.get("error"),
        "sent_at": sent_at,
        "test_send": False,
    }
    try:
        await db.dispatch_log.insert_one(doc)
    except Exception:
        logger.exception("dispatch_log broadcast insert failed for %s", consent_tag)

    err = bool(result.get("error"))
    return {
        "channel": "telegram", "segment": consent_tag,
        "delivered": 0 if err or not effective_live else 1,
        "dry_run": 0 if effective_live else 1,
        "errors": 1 if err else 0,
        "recipients_seen": 1,
        "mode": "live" if effective_live else "dry_run",
        "broadcast": True,
        "subscriber_count": subscriber_count,
    }


async def _dispatch_segment(
    db, *, channel: str, consent_tag: str, payload: Dict[str, Any],
    cycle_id: str, force_dry_run: bool = False,
    override_mode: Optional[str] = None,
    recipients_override: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Per-channel dispatch.

    Decision tree:
      1. If `force_dry_run` → ALL recipients get dry_run rows.
      2. If `recipients_override` is set → filter the segment's recipients
         to ONLY those listed (safety check: never sends to anyone not in
         the opt-in segment). Forces `live_segment_only` semantics.
      3. Else honor the persisted `override_mode` for this (channel, segment).
         `dry_run` (default) → audit-only. `live_segment_only` / `live_global`
         → real provider call when creds present, dry_run fallback when not.
    """
    all_recipients = await _recipients_for_tag(db, consent_tag)

    # ── Telegram broadcast short-circuit ────────────────────────────────
    # When TELEGRAM_CHANNEL_ID is set, the telegram channel switches from
    # per-subscriber DM fan-out to single-channel broadcast: one message
    # per cycle posted to the @handle / chat_id. We still log subscriber
    # count for audit so opt-in stats stay meaningful, but only ONE send
    # row is written (recipient = the channel handle, broadcast=True).
    # Skipped when `recipients_override` is set - targeted test-sends
    # always go to individual recipients, never the broadcast channel.
    if (
        channel == "telegram"
        and TELEGRAM_CHANNEL_ID
        and recipients_override is None
    ):
        return await _dispatch_telegram_broadcast(
            db, consent_tag=consent_tag, payload=payload, cycle_id=cycle_id,
            force_dry_run=force_dry_run, override_mode=override_mode,
            subscriber_count=len(all_recipients),
        )

    if recipients_override is not None:
        allow = {r.strip().lower() for r in recipients_override if r and r.strip()}
        if not allow:
            return {
                "channel": channel, "segment": consent_tag,
                "delivered": 0, "dry_run": 0, "errors": 0,
                "recipients_seen": 0, "mode": "no_recipients",
                "skipped_reason": "recipients_override_empty",
            }
        recipients = [
            r for r in all_recipients
            if (r.get("identifier") or "").strip().lower() in allow
        ]
        # Effective mode: real send if creds present, dry_run otherwise.
        effective_live = True
    else:
        recipients = all_recipients
        mode = override_mode or await get_segment_override(db, channel, consent_tag)
        effective_live = mode in {"live_segment_only", "live_global"}

    if force_dry_run:
        effective_live = False

    sender = {
        "email": _attempt_email_send,
        "sms": _attempt_sms_send,
        "telegram": _attempt_telegram_send,
    }[channel]
    sent_at = datetime.now(timezone.utc).isoformat()
    delivered = 0
    dry_run = 0
    errors = 0
    docs = []
    for r in recipients:
        ident = r.get("identifier")
        if not ident:
            continue
        if effective_live:
            try:
                result = await sender(ident, payload)
            except Exception as exc:
                result = {"mode": "live", "error": str(exc)[:300]}
        else:
            result = {"mode": "dry_run", "provider": _channel_live_mode(channel)[1]}
        if result.get("error"):
            errors += 1
        elif result.get("mode") == "dry_run":
            dry_run += 1
        else:
            delivered += 1
        docs.append({
            "id": uuid.uuid4().hex,
            "kind": "send",
            "cycle_id": cycle_id,
            "channel": channel,
            "segment": consent_tag,
            "recipient": ident,
            "payload": payload,
            "mode": result.get("mode", "dry_run"),
            "provider": result.get("provider"),
            "provider_response": result.get("provider_response"),
            "error": result.get("error"),
            "sent_at": sent_at,
            "test_send": recipients_override is not None,
        })
    if docs:
        try:
            await db.dispatch_log.insert_many(docs, ordered=False)
        except Exception:
            logger.exception("dispatch_log insert_many failed for %s", consent_tag)
    return {
        "channel": channel, "segment": consent_tag,
        "delivered": delivered, "dry_run": dry_run, "errors": errors,
        "recipients_seen": len(recipients),
        "mode": "live" if effective_live else "dry_run",
    }


# ── Public entrypoint ────────────────────────────────────────────────────

async def run_daily_dispatch(db, *, dry_run: bool = True,
                              cycle_id: Optional[str] = None,
                              recipients_override: Optional[List[str]] = None,
                              channels: Optional[List[str]] = None,
                              force_telegram: bool = False) -> Dict[str, Any]:
    """Assemble payloads, fan out to each segment, write the audit trail.

    Parameters
    ----------
    dry_run
        `True` (default) forces every send into dry-run regardless of
        creds or persisted segment-override mode. `False` lets each
        segment's persisted mode drive the decision (defaults to dry_run
        when no override row exists). Real provider calls only happen
        when (a) creds are present AND (b) the segment is unlocked.
    recipients_override
        When provided, the cycle becomes a "test send" - only readers in
        the opt-in segment whose identifier is in the list receive the
        message. Forces live attempt (creds permitting). Other segments
        on the channel are SKIPPED entirely (no log rows). Each cycle
        doc records the override list for audit.
    channels
        Optional whitelist (e.g. `["email"]`) to scope a test send to
        one channel. Defaults to all three.
    force_telegram
        When True, bypasses the "already sent today" lock for the
        Telegram broadcast. Used by the admin /api/admin/dispatch/telegram-force
        endpoint when the cron lock needs to be overridden for ad-hoc QA.
        Sharpness threshold still applies.
    """
    cycle_id = cycle_id or uuid.uuid4().hex
    started_at = datetime.now(timezone.utc).isoformat()
    cycle_date = _today_key()

    channels = channels or ["email", "sms", "telegram"]
    channels = [c for c in channels if c in {"email", "sms", "telegram"}]

    # Payload assembly (cheap - once per cycle)
    email_payload = await _build_email_digest_payload(db) if "email" in channels else None
    sms_payload = await _build_sms_alerts_payload(db) if "sms" in channels else None
    telegram_payload = await _build_telegram_alerts_payload(db) if "telegram" in channels else None

    # iter55 - Telegram broadcast throttling. Two gates:
    #   • Sharpness threshold (top pick must beat TELEGRAM_BROADCAST_SHARPNESS_MIN)
    #   • Once per UTC day (unique index on telegram_broadcasts.date_ymd)
    # Manual test sends with `recipients_override` bypass BOTH gates (it's
    # an admin-initiated direct DM, not the public-channel broadcast).
    # iter74 fix: the once-per-day gate ONLY applies to live broadcasts.
    # Dry-runs (and `force_telegram=True`) bypass it so admins can preview
    # the rendered message without poisoning the cron lock. The lock row
    # is recorded AFTER the broadcast actually fires successfully (see
    # post-results block below), not speculatively before.
    telegram_throttle: Dict[str, Any] = {"throttled": False, "reason": None,
                                         "top_sharpness": 0,
                                         "threshold": TELEGRAM_BROADCAST_SHARPNESS_MIN}
    if "telegram" in channels and not recipients_override:
        picks_list = (telegram_payload or {}).get("picks") or []
        meets, top = _meets_sharpness_threshold(picks_list)
        telegram_throttle["top_sharpness"] = top
        if not meets:
            telegram_throttle.update({
                "throttled": True,
                "reason": f"top_sharpness_{top}_below_min_{TELEGRAM_BROADCAST_SHARPNESS_MIN}",
            })
            channels = [c for c in channels if c != "telegram"]
        elif (
            not dry_run
            and not force_telegram
            and await _telegram_already_sent_today(db)
        ):
            telegram_throttle.update({"throttled": True, "reason": "already_sent_today"})
            channels = [c for c in channels if c != "telegram"]

    tasks = []
    if "email" in channels:
        tasks.append(_dispatch_segment(
            db, channel="email", consent_tag="email_sentiment",
            payload=email_payload, cycle_id=cycle_id,
            force_dry_run=dry_run,
            recipients_override=recipients_override,
        ))
    if "sms" in channels:
        tasks.append(_dispatch_segment(
            db, channel="sms", consent_tag="sms_alerts",
            payload=sms_payload, cycle_id=cycle_id,
            force_dry_run=dry_run,
            recipients_override=recipients_override,
        ))
    if "telegram" in channels:
        tasks.append(_dispatch_segment(
            db, channel="telegram", consent_tag="telegram_alerts",
            payload=telegram_payload, cycle_id=cycle_id,
            force_dry_run=dry_run,
            recipients_override=recipients_override,
        ))
    results = await asyncio.gather(*tasks, return_exceptions=False)

    # iter74: lock the daily Telegram slot ONLY after a successful live
    # broadcast actually completed (not on dry-run, not on errors). This
    # prevents previews from poisoning the cron lock and prevents a
    # failed sendMessage call from blocking the next retry.
    if (
        "telegram" in channels
        and not recipients_override
        and not dry_run
    ):
        tg_result = next(
            (r for r in results if r and r.get("channel") == "telegram"),
            None,
        )
        if (
            tg_result
            and tg_result.get("mode") == "live"
            and not tg_result.get("errors")
            and tg_result.get("delivered")
        ):
            await _record_telegram_broadcast(
                db,
                picks_count=len((telegram_payload or {}).get("picks") or []),
                top_sharpness=telegram_throttle.get("top_sharpness") or 0,
                mode="live",
            )

    finished_at = datetime.now(timezone.utc).isoformat()
    cycle_doc = {
        "id": cycle_id,
        "kind": "cycle",
        "cycle_date": cycle_date,
        "dry_run": dry_run,
        "results": results,
        "started_at": started_at,
        "finished_at": finished_at,
        "test_send": bool(recipients_override),
        "recipients_override_count": len(recipients_override) if recipients_override else 0,
        "channels": channels,
        "telegram_throttle": telegram_throttle,
    }
    try:
        await db.dispatch_log.insert_one(cycle_doc)
    except Exception:
        logger.exception("dispatch_log cycle insert failed")
    cycle_doc.pop("_id", None)
    return cycle_doc


# ── Worker loop ──────────────────────────────────────────────────────────

async def dispatch_worker_loop(db) -> None:
    if DISABLE_WORKER:
        logger.info("dispatch worker disabled via env")
        return
    logger.info("dispatch worker armed: target=%02d:00 Europe/Helsinki", DISPATCH_HOUR)
    while True:
        try:
            if _is_dispatch_window() and not await _cycle_already_ran_today(db):
                # Back-office kill switch - settings.auto_dispatch_enabled
                # determines whether the scheduled cycle fires LIVE or
                # stays in dry-run. Default false (safety): the worker
                # writes audit rows but won't hit any provider until
                # the admin explicitly flips the switch.
                enabled = False
                try:
                    s = await db.settings.find_one({"_id": "site"}, {"_id": 0, "auto_dispatch_enabled": 1}) or {}
                    enabled = bool(s.get("auto_dispatch_enabled", False))
                except Exception:
                    logger.exception("dispatch worker: settings lookup failed")
                logger.info(
                    "dispatch window open - running daily cycle (auto_dispatch_enabled=%s, dry_run=%s)",
                    enabled, not enabled,
                )
                await run_daily_dispatch(db, dry_run=not enabled)
                # iter76 Slice 3: also fan-out per-subscriber DMs. The
                # `fanout_daily_dms` helper has its OWN gate via
                # `bot_config.daily_dm_enabled` - if that's False it
                # no-ops cheaply, so we always call it.
                try:
                    from routes.bot_dispatch import fanout_daily_dms
                    await fanout_daily_dms(db, dry_run=not enabled)
                except Exception:
                    logger.exception("dispatch worker: mittari DM fanout failed")
        except Exception:
            logger.exception("dispatch worker tick failed")
        await asyncio.sleep(WORKER_INTERVAL_SECONDS)


# ── Log reader (for the back-office UI) ──────────────────────────────────

async def list_recent_log(db, *, limit: int = 100,
                          kind: Optional[str] = None) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if kind:
        q["kind"] = kind
    cur = db.dispatch_log.find(q, {"_id": 0}).sort([("sent_at", -1), ("finished_at", -1)]).limit(
        max(1, min(int(limit or 100), 500))
    )
    return [d async for d in cur]


async def cycle_summary(db, *, days: int = 7) -> Dict[str, Any]:
    """Aggregate counts per channel/mode across last N days. Used by the
    /back-office/optin-segments panel to show "what would have shipped"
    when the dispatch ran in dry-run."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
    cur = db.dispatch_log.aggregate([
        {"$match": {"kind": "send", "sent_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"channel": "$channel", "mode": "$mode", "segment": "$segment"},
            "count": {"$sum": 1},
        }},
    ])
    rows: List[Dict[str, Any]] = []
    async for r in cur:
        rows.append({
            "channel": r["_id"]["channel"],
            "mode": r["_id"]["mode"],
            "segment": r["_id"]["segment"],
            "count": r["count"],
        })
    last_cycle = await db.dispatch_log.find_one(
        {"kind": "cycle"}, {"_id": 0}, sort=[("finished_at", -1)],
    )
    return {
        "rows": rows,
        "last_cycle": last_cycle,
        "window_days": days,
    }
