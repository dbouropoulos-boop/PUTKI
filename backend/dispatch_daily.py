"""
PUTKI HQ — Daily dispatch worker (Email digest + SMS alerts + Telegram alerts).

Default mode: DRY RUN. Until Resend / Twilio / Telegram bot tokens land in
`/app/backend/.env`, the worker assembles every payload it WOULD send and
writes the full audit row to `dispatch_log`. No external call is made.
The moment the credentials show up, the dispatcher hot-switches to real
sends without code changes — purely env-driven.

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
except ImportError:  # pragma: no cover — fallback for older runtimes
    ZoneInfo = None  # type: ignore

logger = logging.getLogger(__name__)

HELSINKI = ZoneInfo("Europe/Helsinki") if ZoneInfo else timezone(timedelta(hours=2))
DISPATCH_HOUR = int(os.environ.get("DISPATCH_HOUR_LOCAL", "10"))
DISPATCH_GRACE_MINUTES = int(os.environ.get("DISPATCH_GRACE_MINUTES", "5"))
WORKER_INTERVAL_SECONDS = int(os.environ.get("DISPATCH_WORKER_INTERVAL", "60"))

# Provider tokens — when absent the channel falls through to dry-run.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY") or ""
RESEND_FROM = os.environ.get("RESEND_FROM") or ""
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID") or ""
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN") or ""
TWILIO_FROM = os.environ.get("TWILIO_FROM") or ""
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or ""

# Worker kill switch — set to "1" in test/preview to keep the loop quiet.
DISABLE_WORKER = os.environ.get("PUTKI_HQ_DISABLE_DISPATCH_WORKER", "0") == "1"


# ── Indexes ──────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> None:
    try:
        await db.dispatch_log.create_index("sent_at")
        await db.dispatch_log.create_index([("kind", 1), ("sent_at", -1)])
    except Exception:
        logger.exception("dispatch_daily.ensure_indexes failed")


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

    `email_sentiment` is the slow channel — we DON'T put pelisignaalit picks
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

    # 3) Skene tunnelma — last 24h of stream signals + ticker volume
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

    Pure data shaping — message text is built per-recipient later.
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
    """Telegram alerts = same picks as SMS plus a channel link.

    Mirrors SMS deliberately. The split is consent-based, not content-based:
    some readers want SMS, some want Telegram, some want both.
    """
    sms = await _build_sms_alerts_payload(db)
    sms["telegram"] = True
    return sms


# ── Recipient lookup ─────────────────────────────────────────────────────

async def _recipients_for_tag(db, consent_tag: str) -> List[Dict[str, Any]]:
    """Pull opted-in identifiers for a given consent_tag.

    Each row is whatever `optin_consents` stored at consent time — keyed
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
    # Real Resend call — kept minimal, full impl lands when keys arrive.
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
                    "subject": "PUTKI HQ — päivän skenekatsaus",
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
                json={"chat_id": recipient, "text": _render_sms_text(payload),
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
    lines = ["PUTKI HQ — päivän skenekatsaus", "", ]
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


# ── Per-channel dispatch ─────────────────────────────────────────────────

async def _dispatch_segment(
    db, *, channel: str, consent_tag: str, payload: Dict[str, Any],
    cycle_id: str,
) -> Dict[str, Any]:
    recipients = await _recipients_for_tag(db, consent_tag)
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
        try:
            result = await sender(ident, payload)
        except Exception as exc:
            result = {"mode": "live", "error": str(exc)[:300]}
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
    }


# ── Public entrypoint ────────────────────────────────────────────────────

async def run_daily_dispatch(db, *, dry_run: bool = True,
                              cycle_id: Optional[str] = None) -> Dict[str, Any]:
    """Assemble payloads, fan out to each segment, write the audit trail.

    `dry_run=True` short-circuits all provider creds — every send becomes
    a dry-run row regardless of whether keys are present. `dry_run=False`
    means "use real creds where available, fall back to dry-run for the
    channels still missing keys."
    """
    cycle_id = cycle_id or uuid.uuid4().hex
    started_at = datetime.now(timezone.utc).isoformat()
    cycle_date = _today_key()

    # Payload assembly (cheap — once per cycle)
    email_payload = await _build_email_digest_payload(db)
    sms_payload = await _build_sms_alerts_payload(db)
    telegram_payload = await _build_telegram_alerts_payload(db)

    # Force dry-run by stripping credentials at runtime when caller asked.
    if dry_run:
        # Easiest way to honor the contract: monkeypatch the provider
        # check for this call. We can't actually do that cleanly across
        # tasks — instead, we drop into a guarded mode that wraps each
        # sender. Keep it explicit and obvious.
        results = await asyncio.gather(
            _dispatch_segment_dryrun(db, channel="email",
                                      consent_tag="email_sentiment",
                                      payload=email_payload, cycle_id=cycle_id),
            _dispatch_segment_dryrun(db, channel="sms",
                                      consent_tag="sms_alerts",
                                      payload=sms_payload, cycle_id=cycle_id),
            _dispatch_segment_dryrun(db, channel="telegram",
                                      consent_tag="telegram_alerts",
                                      payload=telegram_payload, cycle_id=cycle_id),
            return_exceptions=False,
        )
    else:
        results = await asyncio.gather(
            _dispatch_segment(db, channel="email",
                              consent_tag="email_sentiment",
                              payload=email_payload, cycle_id=cycle_id),
            _dispatch_segment(db, channel="sms",
                              consent_tag="sms_alerts",
                              payload=sms_payload, cycle_id=cycle_id),
            _dispatch_segment(db, channel="telegram",
                              consent_tag="telegram_alerts",
                              payload=telegram_payload, cycle_id=cycle_id),
            return_exceptions=False,
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
    }
    try:
        await db.dispatch_log.insert_one(cycle_doc)
    except Exception:
        logger.exception("dispatch_log cycle insert failed")
    cycle_doc.pop("_id", None)
    return cycle_doc


async def _dispatch_segment_dryrun(db, *, channel: str, consent_tag: str,
                                    payload: Dict[str, Any],
                                    cycle_id: str) -> Dict[str, Any]:
    """Mirror of _dispatch_segment that NEVER hits a provider — purely
    writes audit rows. Used when the caller forces dry-run."""
    recipients = await _recipients_for_tag(db, consent_tag)
    sent_at = datetime.now(timezone.utc).isoformat()
    docs = []
    for r in recipients:
        ident = r.get("identifier")
        if not ident:
            continue
        docs.append({
            "id": uuid.uuid4().hex,
            "kind": "send",
            "cycle_id": cycle_id,
            "channel": channel,
            "segment": consent_tag,
            "recipient": ident,
            "payload": payload,
            "mode": "dry_run",
            "provider": _channel_live_mode(channel)[1],
            "provider_response": None,
            "error": None,
            "sent_at": sent_at,
        })
    if docs:
        try:
            await db.dispatch_log.insert_many(docs, ordered=False)
        except Exception:
            logger.exception("dispatch_log dry-run insert_many failed for %s", consent_tag)
    return {
        "channel": channel, "segment": consent_tag,
        "delivered": 0, "dry_run": len(docs), "errors": 0,
        "recipients_seen": len(recipients),
    }


# ── Worker loop ──────────────────────────────────────────────────────────

async def dispatch_worker_loop(db) -> None:
    if DISABLE_WORKER:
        logger.info("dispatch worker disabled via env")
        return
    logger.info("dispatch worker armed: target=%02d:00 Europe/Helsinki", DISPATCH_HOUR)
    while True:
        try:
            if _is_dispatch_window() and not await _cycle_already_ran_today(db):
                logger.info("dispatch window open — running daily cycle (dry_run=True default)")
                await run_daily_dispatch(db, dry_run=True)
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
