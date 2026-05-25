"""
PUTKI HQ - Phase 4 Server-Sent Events broadcaster for the dial.

Lightweight in-process pub-sub:
  - Each connected SSE client gets a bounded asyncio.Queue
  - Layer 2 workers (or any caller) push fresh dial snapshots via `publish`
  - `event_stream` yields formatted SSE chunks until the client disconnects

This deliberately stays in-process - we're running a single Uvicorn worker,
and an SSE broker like Redis Streams is overkill for a Finnish editorial
site. If we scale to multi-worker, swap this for `redis.asyncio` pubsub
without touching the FastAPI route.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional, Set, AsyncIterator

logger = logging.getLogger(__name__)

# Bound the per-client queue so a slow consumer can't balloon memory.
_QUEUE_MAX = 10

_subscribers: Set[asyncio.Queue] = set()
_last_snapshot: Optional[Dict[str, Any]] = None


def cache_snapshot(snapshot: Dict[str, Any]) -> None:
    """Remember the most recent snapshot so new SSE clients get an immediate
    initial event instead of waiting for the next tick."""
    global _last_snapshot
    _last_snapshot = snapshot


async def publish(snapshot: Dict[str, Any]) -> int:
    """Fan-out a snapshot to every connected SSE client. Drops on full queues
    rather than blocking. Returns the number of delivered fan-outs."""
    cache_snapshot(snapshot)
    delivered = 0
    dead: list[asyncio.Queue] = []
    for q in list(_subscribers):
        try:
            q.put_nowait(snapshot)
            delivered += 1
        except asyncio.QueueFull:
            # Mark stale subscribers for removal.
            dead.append(q)
    for q in dead:
        _subscribers.discard(q)
    return delivered


async def event_stream(initial_snapshot: Optional[Dict[str, Any]] = None,
                       heartbeat_seconds: float = 15.0) -> AsyncIterator[str]:
    """Generator producing SSE-formatted text chunks. Hooked to FastAPI via
    StreamingResponse(event_stream(), media_type='text/event-stream')."""
    q: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAX)
    _subscribers.add(q)
    logger.info("SSE client connected - total=%d", len(_subscribers))
    try:
        # Initial bootstrap: send the most recent known snapshot immediately
        # so the UI can render without waiting for the next worker tick.
        bootstrap = initial_snapshot or _last_snapshot
        if bootstrap:
            yield _format_event("dial", bootstrap)

        # SSE retry hint: tell browsers to retry after 5s on disconnect
        yield "retry: 5000\n\n"

        while True:
            try:
                snap = await asyncio.wait_for(q.get(), timeout=heartbeat_seconds)
                yield _format_event("dial", snap)
            except asyncio.TimeoutError:
                # Comment-line heartbeat keeps Cloudflare/Kubernetes ingress
                # from closing the connection on idle.
                yield ": heartbeat\n\n"
    finally:
        _subscribers.discard(q)
        logger.info("SSE client disconnected - total=%d", len(_subscribers))


def _format_event(event: str, payload: Dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, default=str)}\n\n"


def subscriber_count() -> int:
    return len(_subscribers)
