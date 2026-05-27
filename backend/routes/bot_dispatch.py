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
    cur = db.mittari_subscribers.find(
        {
            "status": "active",
            "telegram_chat_id": {"$nin": [None, ""]},
        },
        {
            "_id": 0, "pending_id": 1, "telegram_chat_id": 1, "segment": 1,
            "email": 1, "telegram_username": 1,
        },
    )
    rows = [d async for d in cur]

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
