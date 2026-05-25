"""
PUTKI HQ - YouTube PubSubHubbub lease auto-renewal worker.

Scans `youtube_pubsub_leases` every 6 h. For any lease where
`expires_at_ts < now + 48 h`, re-POSTs hub.mode=subscribe and refreshes the
stored expiry. Idempotent - re-subscribing an existing topic is the
WebSub-spec way to extend a lease.

Disable via PUTKI_HQ_DISABLE_YT_LEASE_WORKER=1 (also off when
PUTKI_HQ_DISABLE_WORKERS=1).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone


logger = logging.getLogger(__name__)

RENEWAL_INTERVAL_SECONDS = int(os.environ.get("YT_LEASE_RENEWAL_INTERVAL_SECONDS", str(6 * 3600)))
RENEWAL_GRACE_SECONDS    = int(os.environ.get("YT_LEASE_RENEWAL_GRACE_SECONDS", str(48 * 3600)))


async def renew_due_leases(db) -> dict:
    """One pass: renew every lease that expires within RENEWAL_GRACE_SECONDS."""
    from youtube_pubsub import is_configured, subscribe, DEFAULT_LEASE_SECS

    if not is_configured():
        return {"ok": False, "reason": "youtube_pubsub_not_configured", "renewed": 0}

    now_ts = datetime.now(timezone.utc).timestamp()
    cutoff = now_ts + RENEWAL_GRACE_SECONDS

    cursor = db.youtube_pubsub_leases.find(
        {"market_id": "FI", "expires_at_ts": {"$lt": cutoff}},
        {"_id": 0},
    )
    due = await cursor.to_list(length=500)

    renewed: list[dict] = []
    errors: list[dict]  = []
    for lease in due:
        channel_id = lease.get("channel_id")
        if not channel_id:
            continue
        try:
            res = await subscribe(channel_id, lease_seconds=DEFAULT_LEASE_SECS)
            if res.get("ok"):
                expires_ts = datetime.now(timezone.utc).timestamp() + DEFAULT_LEASE_SECS
                await db.youtube_pubsub_leases.update_one(
                    {"channel_id": channel_id, "market_id": "FI"},
                    {"$set": {
                        "renewed_at": datetime.now(timezone.utc).isoformat(),
                        "expires_at": datetime.fromtimestamp(expires_ts, tz=timezone.utc).isoformat(),
                        "expires_at_ts": expires_ts,
                        "lease_seconds": DEFAULT_LEASE_SECS,
                    }},
                )
                await db.settings.update_one(
                    {"key": "webhook_youtube_pubsub_lease"},
                    {"$set": {
                        "key": "webhook_youtube_pubsub_lease",
                        "expires_at": datetime.fromtimestamp(expires_ts, tz=timezone.utc).isoformat(),
                    }},
                    upsert=True,
                )
                renewed.append({"channel_id": channel_id, "slug": lease.get("slug")})
            else:
                errors.append({"channel_id": channel_id, "slug": lease.get("slug"),
                               "status_code": res.get("status_code"), "body": res.get("body")})
        except Exception as exc:
            errors.append({"channel_id": channel_id, "slug": lease.get("slug"), "error": str(exc)})

    await db.webhook_audit.insert_one({
        "source": "youtube",
        "action": "lease_auto_renewal",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "due_count": len(due),
        "renewed_count": len(renewed),
        "error_count": len(errors),
        "results": {"renewed": renewed, "errors": errors},
    })
    return {"ok": True, "due_count": len(due), "renewed_count": len(renewed), "errors": errors}


async def lease_worker_loop(db) -> None:
    if os.environ.get("PUTKI_HQ_DISABLE_YT_LEASE_WORKER") == "1":
        logger.info("YouTube lease worker disabled via env")
        return
    await asyncio.sleep(20)  # let other workers spin up first
    while True:
        try:
            res = await renew_due_leases(db)
            if res.get("renewed_count"):
                logger.info("YT lease worker: renewed %s leases", res["renewed_count"])
        except Exception:
            logger.exception("YT lease worker tick failed")
        await asyncio.sleep(RENEWAL_INTERVAL_SECONDS)
