"""
PUTKI HQ — bootstrap package.

Extracted out of server.py in iter50 to prevent monolith-rot.
The previous orphan-indent bug (entire startup body unreachable inside
`admin_voita_import_odds` after its `return`) is the exact failure mode
that surfaces in 3600+ LOC server.py files.

Public API:
  - `run_startup(db, *, layer2_on_tick, signal_dial_worker)` — single
     entrypoint called by FastAPI's `@app.on_event("startup")` hook.

Internally splits into:
  - `bootstrap.seeds.run_all_seeds_and_indexes(db)` — all seed_* and
    ensure_indexes calls, each wrapped in try/except + structured log.
  - `bootstrap.workers.spawn_background_workers(db, ...)` — every
    `asyncio.create_task` for Layer-2 / scheduler / dispatch / feed /
    discovery / yt-lease workers, plus env-driven killswitches.
"""
from .seeds import run_all_seeds_and_indexes
from .workers import spawn_background_workers


async def run_startup(db, *, layer2_on_tick, signal_dial_worker) -> None:
    """Single entrypoint for FastAPI startup. Pulled out of server.py so
    new bootstrap steps land in their canonical module instead of
    accumulating inside an HTTP route handler.

    Order is meaningful: seeds + indexes first (so workers can rely on
    them), then background workers.
    """
    await run_all_seeds_and_indexes(db)
    await spawn_background_workers(
        db,
        layer2_on_tick=layer2_on_tick,
        signal_dial_worker=signal_dial_worker,
    )


__all__ = [
    "run_startup",
    "run_all_seeds_and_indexes",
    "spawn_background_workers",
]
