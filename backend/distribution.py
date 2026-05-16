"""
Mittari Phase 3 — Distribution pipeline (Batch 3C).

When a piece of generated_content is approved (or auto-published), we fan it
out to multiple channels. Each channel is a small async function that takes
(text, payload) and returns a `DistributionResult` dict — never raises.

Channels:
  - site         (always — already handled by content_engine.distribute_content)
  - telegram     (env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID)
  - email        (env: RESEND_API_KEY + RESEND_FROM + reads recipients from db.signups)
  - x_twitter    (stub — full OAuth2 flow deferred until user wires app credentials)
  - web_push     (stub — needs VAPID + per-subscriber endpoints)
  - shareable_card (deferred — Puppeteer/CDN integration)

Every result is logged to `distribution_log` collection so the back-office
can show per-item delivery status.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


def _result(channel: str, status: str, info: str = "", mocked: bool = False) -> Dict[str, Any]:
    return {
        "channel": channel,
        "status": status,            # delivered | mocked | skipped | error
        "info": info,
        "mocked": mocked,
        "at": datetime.now(timezone.utc).isoformat(),
    }


# ── telegram ────────────────────────────────────────────────────────────────
async def deliver_telegram(text: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    channel_id = os.environ.get("TELEGRAM_CHANNEL_ID")
    if not bot_token or not channel_id:
        return _result("telegram", "mocked", "TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID not configured", mocked=True)
    try:
        body = f"{text}"
        url = payload.get("source_url") or payload.get("video_url")
        if url:
            body += f"\n\n{url}"
        async with httpx.AsyncClient(timeout=8) as cx:
            r = await cx.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": channel_id, "text": body, "disable_web_page_preview": False},
            )
            r.raise_for_status()
            return _result("telegram", "delivered", f"message_id={r.json().get('result',{}).get('message_id')}")
    except Exception as e:
        logger.warning("telegram delivery failed: %s", e)
        return _result("telegram", "error", str(e))


# ── email (Resend) ──────────────────────────────────────────────────────────
async def deliver_email(db, text: str, payload: Dict[str, Any], content_type: str) -> Dict[str, Any]:
    api_key = os.environ.get("RESEND_API_KEY")
    from_addr = os.environ.get("RESEND_FROM", "Mittari <hello@mittari.fi>")
    if not api_key:
        return _result("email", "mocked", "RESEND_API_KEY not configured", mocked=True)

    # Only send email for high-value content types (not every moment commentary).
    if content_type not in ("operator_update", "weekly_card", "sports_take"):
        return _result("email", "skipped", f"content_type={content_type} not in email allowlist")

    cur = db.signups.find({}, {"_id": 0, "email": 1}).limit(500)
    rows = await cur.to_list(length=500)
    recipients = [r["email"] for r in rows if r.get("email")]
    if not recipients:
        return _result("email", "skipped", "no signups")

    try:
        async with httpx.AsyncClient(timeout=15) as cx:
            r = await cx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": from_addr,
                    "to": recipients[:50],  # rate-limit-safe batch
                    "bcc": recipients[50:],
                    "subject": f"Mittari · {content_type.replace('_', ' ').title()}",
                    "text": text,
                },
            )
            r.raise_for_status()
            return _result("email", "delivered", f"resend_id={r.json().get('id')} recipients={len(recipients)}")
    except Exception as e:
        logger.warning("resend email delivery failed: %s", e)
        return _result("email", "error", str(e))


# ── x / twitter (stub) ──────────────────────────────────────────────────────
async def deliver_x(text: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not os.environ.get("X_BEARER_TOKEN"):
        return _result("x_twitter", "mocked", "X_BEARER_TOKEN not configured (and tweet posting requires OAuth2 user context)", mocked=True)
    # Real implementation would need OAuth2 user-context tokens, not just bearer.
    return _result("x_twitter", "skipped", "OAuth2 user-context not yet wired")


# ── web push (stub) ─────────────────────────────────────────────────────────
async def deliver_push(db, text: str) -> Dict[str, Any]:
    if not os.environ.get("VAPID_PUBLIC_KEY"):
        return _result("web_push", "mocked", "VAPID keys not configured", mocked=True)
    cur = db.push_subscribers.find({}, {"_id": 0}).limit(500)
    subs = await cur.to_list(length=500)
    if not subs:
        return _result("web_push", "skipped", "no subscribers")
    return _result("web_push", "skipped", f"{len(subs)} subs found — push library not wired yet")


# ── orchestrator ────────────────────────────────────────────────────────────
async def fanout(db, generated_content: Dict[str, Any], text: str) -> List[Dict[str, Any]]:
    """Deliver the approved text to every channel listed in distribution_targets.
    'site' is handled separately — caller writes to published_content directly.
    """
    targets = generated_content.get("distribution_targets") or []
    payload = generated_content.get("signal_payload") or {}
    content_type = generated_content.get("content_type", "")
    results: List[Dict[str, Any]] = []
    for ch in targets:
        if ch in ("site", "archive"):
            results.append(_result(ch, "delivered", "written to published_content"))
            continue
        if ch == "telegram":
            results.append(await deliver_telegram(text, payload))
        elif ch == "email":
            results.append(await deliver_email(db, text, payload, content_type))
        elif ch in ("x", "twitter", "x_twitter"):
            results.append(await deliver_x(text, payload))
        elif ch in ("push", "web_push"):
            results.append(await deliver_push(db, text))
        elif ch == "shareable_card":
            results.append(_result("shareable_card", "skipped", "card generator not yet wired"))
        else:
            results.append(_result(ch, "skipped", "unknown channel"))

    # Persist log row
    await db.distribution_log.insert_one({
        "id": str(uuid.uuid4()),
        "generated_content_id": generated_content.get("id"),
        "content_type": content_type,
        "results": results,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    return results
