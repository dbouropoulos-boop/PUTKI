"""
PUTKI HQ - Per-subscriber Telegram DM fan-out (iter76, Slice 3).

Implements Doc 2 §A.3 - the daily-DM dispatch step of the Funnel.
Gated by `bot_config.daily_dm_enabled` (set via the back-office at
/back-office/bot-routing).

Flow:
    1. Read bot_config; if daily_dm_enabled is False → no-op summary.
    2. Build today's signal payload via the existing
       `dispatch_daily._build_telegram_alerts_payload`. Same picks the
       @putkihq channel broadcast uses - parity guaranteed.
    3. Walk `mittari_subscribers` rows where status="active" and a
       telegram_chat_id is bound.
    4. Filter by per-subscriber segment (football / hockey / all).
    5. DM each one a per-segment trimmed payload + a Mini App deep link
       (t.me/<bot>/<app>?startapp=<pending_id> when bot username +
        TELEGRAM_TMA_APP_NAME envs are set; falls back to /tma URL).
    6. Idempotent per UTC date - duplicate runs of the same day no-op
       via the `mittari_dm_dispatches` lock collection.

Admin endpoints (all `Depends(require_admin)`):
    POST /api/admin/bot/dispatch/preview
        body: { dry_run: bool = True }  → returns recipient_count + sample.
    POST /api/admin/bot/dispatch/run
        body: { dry_run: bool = True }  → runs the fan-out; records send rows.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes._helpers import get_db, require_admin
from routes.bot_routing import get_bot_config

logger = logging.getLogger(__name__)


_SEGMENT_SPORT_MAP = {
    "football": {"soccer", "football"},
    "hockey": {"icehockey", "ice hockey", "hockey"},
    # "all" is wildcard - no filter.
}


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_ymd() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _bot_username() -> str:
    raw = (os.environ.get("TELEGRAM_BOT_URL") or "https://t.me/Putkihq_bot").strip()
    return raw.rstrip("/").rsplit("/", 1)[-1] or "Putkihq_bot"


def _mini_app_deep_link(pending_id: str) -> str:
    """Compose a Telegram Mini App deep link if the app is configured;
    fall back to the public /tma URL otherwise.

    Format: https://t.me/<bot_username>/<app_short_name>?startapp=<param>
    """
    app = (os.environ.get("TELEGRAM_TMA_APP_NAME") or "").strip()
    if app:
        return f"https://t.me/{_bot_username()}/{app}?startapp={pending_id}"
    site = (os.environ.get("PUTKI_HQ_SITE_URL") or "https://putkihq.fi").rstrip("/")
    return f"{site}/tma?pid={pending_id}"


def _filter_picks_for_segment(picks: List[Dict[str, Any]], segment: str) -> List[Dict[str, Any]]:
    """Trim today's picks to the subscriber's chosen segment.

    `all` keeps everything. Unknown segments degrade to all so a bad
    upstream value never silences a subscriber."""
    keys = _SEGMENT_SPORT_MAP.get(segment)
    if not keys:
        return picks
    out = []
    for p in picks:
        sport = (p.get("sport") or "").lower()
        # Best-effort substring match - "Soccer · Premier League" includes
        # the keyword "soccer" but isn't equal to it.
        if any(k in sport for k in keys):
            out.append(p)
    return out


def _render_dm_text(picks: List[Dict[str, Any]], deep_link: str) -> str:
    """Per-subscriber DM render. Adds the Mini App CTA, keeps everything
    else identical to the channel broadcast format so users get the
    same narrative regardless of surface."""
    from dispatch_daily import _render_telegram_text  # local to avoid cycle
    base = _render_telegram_text({"picks": picks})
    # Append a single CTA line; channel broadcast doesn't carry the
    # Mini App link, so the value-add of DM is precisely this row.
    return (base.rstrip()
            + f"\n\n→ <a href=\"{deep_link}\">Avaa Mini App</a>"
            ).strip()[:4000]


async def _build_today_picks(db) -> List[Dict[str, Any]]:
    """Re-use the existing telegram broadcast picks builder so DMs +
    channel broadcasts are in lock-step."""
    from dispatch_daily import _build_telegram_alerts_payload
    payload = await _build_telegram_alerts_payload(db)
    return payload.get("picks", []) or []


async def fanout_daily_dms(
    db, *, dry_run: bool = True, force_picks: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Fan-out today's signals to bound mittari_subscribers.

    Returns a summary the back-office can render:
        {
          enabled, today, attempted, delivered, dry_run, errors,
          skipped_by_segment, skipped_no_chat_id, sample_recipients,
        }
    """
    cfg = await get_bot_config(db)
    if not cfg.get("daily_dm_enabled"):
        return {
            "enabled": False, "today": _today_ymd(),
            "attempted": 0, "delivered": 0, "dry_run": 0, "errors": 0,
            "reason": "daily_dm_enabled is False",
        }

    today = _today_ymd()

    # ── Idempotency lock (only matters for live runs). Dry-runs are
    # always safe to re-issue and shouldn't poison tomorrow's live cron.
    if not dry_run:
        existing = await db.mittari_dm_dispatches.find_one({"date_ymd": today})
        if existing:
            return {
                "enabled": True, "today": today, "attempted": 0, "delivered": 0,
                "dry_run": 0, "errors": 0,
                "reason": "already_dispatched_today",
                "first_run_at": existing.get("fired_at"),
            }

    picks = force_picks if force_picks is not None else await _build_today_picks(db)
    if not picks:
        return {
            "enabled": True, "today": today,
            "attempted": 0, "delivered": 0, "dry_run": 0, "errors": 0,
            "reason": "no_picks_today",
        }

    # ── Eligible roster: active subscribers with a bound chat_id.
    # iter97d: dedupe by chat_id — a single user can hold multiple
    # mittari_subscribers rows (one per bind/rebind), but we only want
    # to send ONE DM per Telegram identity per day.
    # iter97f: also fetch the linked email so we can suppress users
    # who hit the unsubscribe link from the email channel.
    cur = db.mittari_subscribers.aggregate([
        {"$match": {
            "status": "active",
            "telegram_chat_id": {"$nin": [None, ""]},
        }},
        {"$sort": {"telegram_bound_at": -1}},
        {"$group": {
            "_id": "$telegram_chat_id",
            "pending_id":        {"$first": "$pending_id"},
            "telegram_chat_id":  {"$first": "$telegram_chat_id"},
            "segment":           {"$first": "$segment"},
            "email":             {"$first": "$email"},
            "telegram_username": {"$first": "$telegram_username"},
        }},
    ])
    rows = [d async for d in cur]

    # iter97f — load the unsubscribed email set in one shot, then filter
    # rows whose `email` matches. Telegram-only binds (no email linked)
    # pass through unaffected.
    unsub_emails: set = set()
    try:
        async for r in db.optin_consents.find(
            {"channel": "email", "status": "unsubscribed"},
            {"_id": 0, "identifier": 1},
        ):
            ident = (r.get("identifier") or "").strip().lower()
            if ident:
                unsub_emails.add(ident)
    except Exception:
        logger.exception("dm fanout: unsubscribe-set load failed (non-fatal)")
    if unsub_emails:
        before = len(rows)
        rows = [r for r in rows if not (r.get("email") and (r["email"]).strip().lower() in unsub_emails)]
        logger.info("dm fanout: suppressed %d/%d for cross-channel unsub", before - len(rows), before)

    attempted = 0
    delivered = 0
    drytotal = 0
    errors = 0
    skipped_by_segment = 0
    sample = []

    # Lazy-import the send primitive so the unit tests don't pull httpx.
    from dispatch_daily import _attempt_telegram_send  # type: ignore

    cycle_id = uuid.uuid4().hex
    for row in rows:
        chat_id = row.get("telegram_chat_id")
        if not chat_id:
            continue
        seg = (row.get("segment") or "all").lower()
        filtered = _filter_picks_for_segment(picks, seg)
        if not filtered:
            skipped_by_segment += 1
            continue

        attempted += 1
        deep_link = _mini_app_deep_link(row.get("pending_id") or "")
        text = _render_dm_text(filtered, deep_link)

        if dry_run:
            result: Dict[str, Any] = {"mode": "dry_run", "provider": "telegram_bot"}
            drytotal += 1
        else:
            try:
                # _attempt_telegram_send re-renders the text from picks;
                # we pre-rendered here so we hand the text directly via
                # a one-off payload `text` key for fidelity.
                result = await _send_dm(chat_id, text)
            except Exception as exc:
                result = {"mode": "live", "error": str(exc)[:280]}
            if result.get("error"):
                errors += 1
            else:
                delivered += 1

        # Audit row - one per attempted recipient.
        try:
            await db.dispatch_log.insert_one({
                "id": uuid.uuid4().hex,
                "kind": "send",
                "cycle_id": cycle_id,
                "channel": "telegram",
                "segment": seg,
                "recipient": str(chat_id),
                "broadcast": False,
                "payload": {"picks_count": len(filtered)},
                "mode": result.get("mode", "dry_run"),
                "provider": result.get("provider"),
                "provider_response": result.get("provider_response"),
                "error": result.get("error"),
                "sent_at": _utc_iso(),
                "test_send": False,
                "source": "mittari_dm_fanout",
                "pending_id": row.get("pending_id"),
            })
        except Exception:
            logger.exception("dm fanout dispatch_log insert failed for %s", chat_id)

        if len(sample) < 5:
            sample.append({
                "pending_id": row.get("pending_id"),
                "segment": seg,
                "chat_id_tail": str(chat_id)[-4:],
                "picks_count": len(filtered),
                "mode": result.get("mode"),
            })

    # ── Lock the date AFTER a successful live cycle (mirrors the channel
    # broadcast pattern - never lock on dry-run, never lock speculatively).
    if not dry_run and attempted > 0:
        try:
            await db.mittari_dm_dispatches.update_one(
                {"date_ymd": today},
                {"$set": {
                    "date_ymd": today,
                    "fired_at": _utc_iso(),
                    "cycle_id": cycle_id,
                    "attempted": attempted,
                    "delivered": delivered,
                    "errors": errors,
                }},
                upsert=True,
            )
        except Exception:
            logger.exception("mittari_dm_dispatches lock write failed")

    return {
        "enabled": True, "today": today,
        "attempted": attempted, "delivered": delivered,
        "dry_run": drytotal, "errors": errors,
        "skipped_by_segment": skipped_by_segment,
        "eligible_total": len(rows),
        "cycle_id": cycle_id,
        "sample_recipients": sample,
    }


def _render_email_picks_text(picks: List[Dict[str, Any]]) -> str:
    """Per-subscriber daily-signals email body. Mirrors the Telegram DM
    render so a user who bound BOTH channels sees identical narrative.
    Kept as plain text + light HTML inline so Resend's text leg works
    even when the recipient blocks HTML."""
    from dispatch_daily import _render_telegram_text  # local to avoid cycle
    base = _render_telegram_text({"picks": picks})
    # Strip Telegram-specific HTML tags - emails get plain text.
    import re as _re
    base = _re.sub(r"</?(?:b|i|u|a|code|pre|s)[^>]*>", "", base)
    base = _re.sub(r"&lt;", "<", base)
    base = _re.sub(r"&gt;", ">", base)
    return base.strip()[:6000]


async def fanout_daily_emails(
    db, *, dry_run: bool = True, force_picks: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Mirror of `fanout_daily_dms` for the email channel (iter97d).

    Pulls active rows from `mittari_subscribers` that have an `email`
    field, then sends the day's 5 picks via Resend (or dry-run if no
    creds). Per-day idempotency lock at `mittari_email_dispatches.date_ymd`.

    A user who supplied BOTH email + Telegram gets BOTH messages — one
    via this fanout, one via `fanout_daily_dms` — same picks, two
    surfaces, exactly as the homepage copy promises.
    """
    cfg = await get_bot_config(db)
    # Email fanout shares the `daily_dm_enabled` toggle so operators
    # have one switch for "daily signals dispatch" across all surfaces.
    if not cfg.get("daily_dm_enabled"):
        return {
            "enabled": False, "today": _today_ymd(),
            "attempted": 0, "delivered": 0, "dry_run": 0, "errors": 0,
            "reason": "daily_dm_enabled is False",
        }

    today = _today_ymd()
    if not dry_run:
        existing = await db.mittari_email_dispatches.find_one({"date_ymd": today})
        if existing:
            return {
                "enabled": True, "today": today, "attempted": 0, "delivered": 0,
                "dry_run": 0, "errors": 0,
                "reason": "already_dispatched_today",
                "first_run_at": existing.get("fired_at"),
            }

    picks = force_picks if force_picks is not None else await _build_today_picks(db)
    if not picks:
        return {
            "enabled": True, "today": today,
            "attempted": 0, "delivered": 0, "dry_run": 0, "errors": 0,
            "reason": "no_picks_today",
        }

    # iter97d: email roster lives in `optin_consents`, NOT in
    # `mittari_subscribers` (those are Telegram-only). Pull every active
    # email opt-in tagged for signal-eligible surfaces, dedupe by
    # identifier, and send each one the daily picks.
    _SIGNAL_EMAIL_TAGS = {
        "email_sentiment",   # main pelisignaalit subscribers
        "mittari_lead",      # Mittari surface email captures
        "mestari_lead",      # Mestari diagnostic email captures
        "voita_lead",        # Voita raffle email captures
        "pelisignaalit",
    }
    cur = db.optin_consents.aggregate([
        {"$match": {
            "channel": "email",
            "consent_tag": {"$in": list(_SIGNAL_EMAIL_TAGS)},
            # iter97f: skip anyone who clicked the one-click unsubscribe.
            "status": {"$ne": "unsubscribed"},
            "$and": [
                {"identifier": {"$nin": [None, ""]}},
                # iter97g: drop reserved/test addresses that pollute the
                # Resend dashboard with hard bounces. @example.com is RFC
                # 2606 reserved; @putkihq.example is our seed-data convention.
                {"identifier": {"$not": {"$regex": r"@(example\.(com|org|net)|putkihq\.example|test\.local)$", "$options": "i"}}},
            ],
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$identifier",
            "email":             {"$first": "$identifier"},
            "consent_tag":       {"$first": "$consent_tag"},
            "surface":           {"$first": "$surface"},
        }},
    ])
    rows = [d async for d in cur]

    attempted = 0
    delivered = 0
    drytotal = 0
    errors = 0
    skipped_by_segment = 0
    sample: List[Dict[str, Any]] = []

    from dispatch_daily import _attempt_email_send  # type: ignore
    from routes.unsubscribe import mint_token  # iter97f
    site_url = (os.environ.get("PUTKI_HQ_SITE_URL") or "https://putkihq.fi").rstrip("/")

    cycle_id = uuid.uuid4().hex
    sent_at = _utc_iso()
    docs = []
    for row in rows:
        email = (row.get("email") or "").strip()
        if not email:
            continue
        # optin_consents rows don't carry a sport segment — every email
        # subscriber sees the full daily 5-pick board.
        seg = "all"
        filtered = picks
        if not filtered:
            skipped_by_segment += 1
            continue

        attempted += 1
        # iter97f: per-recipient unsubscribe token + List-Unsubscribe headers
        # (RFC 8058 one-click). Gmail/Outlook render their native button
        # next to the sender name when BOTH headers ship.
        unsub_token = mint_token(email)
        unsub_url = f"{site_url}/api/u/{unsub_token}"
        unsub_oneclick = f"{site_url}/api/u/{unsub_token}/one-click"
        payload = {
            "picks": filtered,
            "subject_hint": "daily_signals",
            "unsubscribe_url": unsub_url,
            "resend_headers": {
                "List-Unsubscribe": f"<{unsub_oneclick}>, <mailto:tuki@putkihq.fi?subject=unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        }

        if dry_run:
            result: Dict[str, Any] = {"mode": "dry_run", "provider": "resend"}
            drytotal += 1
        else:
            # iter97g: Resend free tier rate-limits at ~2 req/sec; paid at
            # ~10. Try once, and on a 429 sleep 1.2s and retry once. Cheaper
            # than a global token bucket and gives us a clean ~2.5 req/sec
            # steady state without dropping deliveries.
            attempts = 0
            while attempts < 2:
                attempts += 1
                try:
                    result = await _attempt_email_send(email, payload)
                except Exception as exc:
                    result = {"mode": "live", "error": str(exc)[:280]}
                pr = result.get("provider_response") or {}
                try:
                    status = int(pr.get("status") or 0)
                except (TypeError, ValueError):
                    status = 0
                if status == 429 and attempts < 2:
                    await asyncio.sleep(1.2)
                    continue
                break
            # iter97e: promote 4xx/5xx Resend responses to an error so the
            # audit counts them correctly instead of inflating delivered.
            if not result.get("error") and status >= 400:
                body = (pr.get("body") or "")[:280]
                result["error"] = f"provider_{status}: {body}"
            if result.get("error"):
                errors += 1
            elif result.get("mode") == "dry_run":
                drytotal += 1
            else:
                delivered += 1
            # Pacing: 250ms between live sends keeps us under Resend's
            # 10/sec ceiling even with a paid plan, gives us headroom for
            # the occasional retry above, and finishes 525 sends in ~135s.
            await asyncio.sleep(0.25)

        docs.append({
            "id": uuid.uuid4().hex,
            "kind": "send",
            "cycle_id": cycle_id,
            "channel": "email",
            "segment": seg,
            "recipient": email,
            "broadcast": False,
            "payload": {"picks_count": len(filtered)},
            "mode": result.get("mode", "dry_run"),
            "provider": result.get("provider"),
            "provider_response": result.get("provider_response"),
            "error": result.get("error"),
            "sent_at": sent_at,
            "test_send": False,
            "source": "mittari_email_fanout",
            "consent_tag": row.get("consent_tag"),
        })

        if len(sample) < 5:
            sample.append({
                "consent_tag": row.get("consent_tag"),
                "segment": seg,
                "email_tail": email.split("@")[0][:3] + "***@" + email.split("@")[-1],
                "picks_count": len(filtered),
                "mode": result.get("mode"),
            })

    if docs:
        try:
            await db.dispatch_log.insert_many(docs, ordered=False)
        except Exception:
            logger.exception("email fanout dispatch_log insert failed")

    if not dry_run and attempted > 0:
        try:
            await db.mittari_email_dispatches.update_one(
                {"date_ymd": today},
                {"$set": {
                    "date_ymd": today,
                    "fired_at": _utc_iso(),
                    "cycle_id": cycle_id,
                    "attempted": attempted,
                    "delivered": delivered,
                    "errors": errors,
                }},
                upsert=True,
            )
        except Exception:
            logger.exception("mittari_email_dispatches lock write failed")

    return {
        "enabled": True, "today": today,
        "attempted": attempted, "delivered": delivered,
        "dry_run": drytotal, "errors": errors,
        "skipped_by_segment": skipped_by_segment,
        "eligible_total": len(rows),
        "cycle_id": cycle_id,
        "sample_recipients": sample,
    }


async def _send_dm(chat_id: Any, text: str) -> Dict[str, Any]:
    """Direct Telegram sendMessage with pre-rendered HTML text. Falls
    back to dry_run when no token is configured."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or ""
    if not token:
        return {"mode": "dry_run", "provider": "telegram_bot"}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id, "text": text,
                    "parse_mode": "HTML", "disable_web_page_preview": True,
                },
            )
        return {
            "mode": "live", "provider": "telegram_bot",
            "provider_response": {"status": r.status_code, "body": r.text[:600]},
        }
    except Exception as exc:
        return {"mode": "live", "provider": "telegram_bot", "error": str(exc)[:280]}


# ─── admin router ────────────────────────────────────────────────────
class _DispatchRunPayload(BaseModel):
    dry_run: bool = True


def make_router() -> APIRouter:
    router = APIRouter()

    @router.post("/admin/bot/dispatch/preview")
    async def admin_dispatch_preview(
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """Always-dry-run preview - safe to call from the back-office on
        every panel open without poisoning the day's idempotency lock."""
        return await fanout_daily_dms(db, dry_run=True)

    @router.post("/admin/bot/dispatch/run")
    async def admin_dispatch_run(
        payload: _DispatchRunPayload,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        cfg = await get_bot_config(db)
        if not cfg.get("daily_dm_enabled") and not payload.dry_run:
            raise HTTPException(409, "daily_dm_enabled must be true for a live run")
        return await fanout_daily_dms(db, dry_run=payload.dry_run)

    return router


async def ensure_indexes(db) -> None:
    await db.mittari_dm_dispatches.create_index("date_ymd", unique=True, background=True)
    await db.mittari_email_dispatches.create_index("date_ymd", unique=True, background=True)
