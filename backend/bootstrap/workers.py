"""
bootstrap.workers — every background task PUTKI HQ spawns at startup,
in one auditable list.

Pulled out of server.py so adding a new worker doesn't require touching
a 3600-line monolith. Env-driven killswitches preserved verbatim.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

# Type alias: an async function (worker_name, result) -> None
Layer2TickHook = Callable[[str, Any], Awaitable[None]]


async def spawn_background_workers(
    db,
    *,
    layer2_on_tick: Layer2TickHook,
    signal_dial_worker: Callable[[], Awaitable[None]],
) -> None:
    """Spawn every long-lived background coroutine PUTKI HQ runs.

    Env killswitches (preserved from the previous server.py inline block):
      • PUTKI_HQ_DISABLE_WORKERS — master kill, skips ALL workers.
      • PUTKI_HQ_DISABLE_FEED_WORKER
      • PUTKI_HQ_DISABLE_YT_LEASE_WORKER
      • PUTKI_HQ_DISABLE_AUTO_DISCOVERY
      • PUTKI_HQ_DISABLE_SCHEDULER          (scheduler + variant filler)
      • PUTKI_HQ_DISABLE_DISPATCH_WORKER
      • PUTKI_HQ_DISABLE_LAYER2             (consumed inside start_layer2_workers)

    `layer2_on_tick` + `signal_dial_worker` are passed in (rather than
    imported here) because they're tightly coupled to server-local
    state (`_content_generator`, the `db` module-global). Keeping that
    coupling in server.py prevents this module from importing server.
    """
    if os.environ.get("PUTKI_HQ_DISABLE_WORKERS", "0") == "1":
        logger.info("bootstrap.workers: all workers disabled (PUTKI_HQ_DISABLE_WORKERS=1)")
        return

    # ── Legacy signal/dial poller ────────────────────────────────────
    asyncio.create_task(signal_dial_worker())

    # ── Feed worker (per-market editorial feed) ──────────────────────
    if os.environ.get("PUTKI_HQ_DISABLE_FEED_WORKER", "0") != "1":
        from feed import feed_worker_loop
        asyncio.create_task(feed_worker_loop(db))

    # ── YouTube subscription lease renewal ───────────────────────────
    if os.environ.get("PUTKI_HQ_DISABLE_YT_LEASE_WORKER", "0") != "1":
        from youtube_lease_worker import lease_worker_loop as _yt_lease_loop
        asyncio.create_task(_yt_lease_loop(db))

    # ── Phase 4 Layer 2 pollers (Twitch / Reddit / NHL / RSS / F1 / Football) ─
    # Each tick fires `layer2_on_tick(name, result)` which recomputes the
    # dial + fans out to ContentGenerator.
    from layer2_workers import start_layer2_workers
    await start_layer2_workers(db, on_tick=layer2_on_tick)

    # ── Twitch auto-discovery (FI slot/casino streamers ≥1000 followers) ──
    if os.environ.get("PUTKI_HQ_DISABLE_AUTO_DISCOVERY", "0") != "1":
        from twitch_discovery import discovery_worker_loop as _disc_loop
        asyncio.create_task(_disc_loop(db))

    # ── Editorial scheduler + variant filler ─────────────────────────
    if os.environ.get("PUTKI_HQ_DISABLE_SCHEDULER", "0") != "1":
        from seed_scheduler import scheduler_worker_loop, variant_filler_worker_loop
        asyncio.create_task(scheduler_worker_loop(db))
        asyncio.create_task(variant_filler_worker_loop(db))

    # ── Daily dispatch worker (Email / SMS / Telegram digest) ────────
    if os.environ.get("PUTKI_HQ_DISABLE_DISPATCH_WORKER", "0") != "1":
        from dispatch_daily import dispatch_worker_loop
        asyncio.create_task(dispatch_worker_loop(db))
