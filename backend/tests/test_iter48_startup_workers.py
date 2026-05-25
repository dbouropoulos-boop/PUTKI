"""
Regression lock for the iter48 orphan-startup bug + iter50 bootstrap
extraction.

Before iter48 the entire startup body was orphan-indented inside
`admin_voita_import_odds` AFTER its `return` - making every Layer 2
poller, RSS scheduler, content generator, dispatch loop and scheduler
silently dead until the next edit happened to land inside a real
startup hook.

In iter50 that block was extracted to a `bootstrap/` package:
  - `bootstrap.seeds.run_all_seeds_and_indexes(db)` owns every seed_* +
    ensure_indexes call.
  - `bootstrap.workers.spawn_background_workers(db, ...)` owns every
    asyncio.create_task for long-running coroutines.
  - `server.py:startup_event` is now a thin wrapper that calls
    `bootstrap.run_startup`.

These tests fail loudly if anyone:
  • removes the @app.on_event("startup") decorator,
  • re-orphans `run_startup` / `run_all_seeds_and_indexes` /
    `spawn_background_workers` into the wrong function,
  • drops a critical seed call from the bootstrap package,
  • re-leaks a bootstrap call into `admin_voita_import_odds` (the
    original failure mode).
"""
from __future__ import annotations

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
SERVER_PY = BACKEND / "server.py"
BOOTSTRAP_INIT = BACKEND / "bootstrap" / "__init__.py"
BOOTSTRAP_SEEDS = BACKEND / "bootstrap" / "seeds.py"
BOOTSTRAP_WORKERS = BACKEND / "bootstrap" / "workers.py"


def _tree(path: Path) -> ast.AST:
    return ast.parse(path.read_text())


def _calls_within(node: ast.AST) -> set[str]:
    out: set[str] = set()
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call):
            func = sub.func
            if isinstance(func, ast.Name):
                out.add(func.id)
            elif isinstance(func, ast.Attribute):
                out.add(func.attr)
    return out


def _functions_by_name(tree: ast.AST) -> dict:
    return {
        n.name: n for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


# ───────────────────────── server.py guards ─────────────────────────

def test_startup_event_is_top_level_with_app_on_event_decorator():
    tree = _tree(SERVER_PY)
    matches = [
        n for n in tree.body
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "startup_event"
    ]
    assert len(matches) == 1, "startup_event must be a module-level async function"
    decos = [ast.unparse(d) for d in matches[0].decorator_list]
    assert any("on_event('startup')" in d or 'on_event("startup")' in d for d in decos), (
        f"startup_event must carry @app.on_event('startup'). got decorators: {decos}"
    )


def test_startup_event_delegates_to_bootstrap_run_startup():
    """startup_event must call `run_startup` (the bootstrap entrypoint).
    Anything more inline is a regression toward the iter48 monolith."""
    fns = _functions_by_name(_tree(SERVER_PY))
    startup = fns["startup_event"]
    assert "run_startup" in _calls_within(startup), (
        "startup_event must call run_startup (from bootstrap package)"
    )


def test_no_bootstrap_calls_leak_into_admin_voita_import_odds():
    """Regression lock for the original orphan-startup bug - bootstrap
    function names must NEVER appear inside `admin_voita_import_odds`."""
    fns = _functions_by_name(_tree(SERVER_PY))
    bad = fns["admin_voita_import_odds"]
    bad_calls = _calls_within(bad)
    forbidden = {
        "run_startup",
        "run_all_seeds_and_indexes",
        "spawn_background_workers",
        "start_layer2_workers",
        "seed_default_guidelines",
        "seed_streamers",
        "seed_operators",
        "seed_default_cadences",
        "dispatch_worker_loop",
        "scheduler_worker_loop",
    }
    leaked = forbidden & bad_calls
    assert not leaked, (
        f"admin_voita_import_odds must not contain bootstrap calls "
        f"(orphan-startup regression): {leaked}"
    )


# ────────────────────── bootstrap package guards ──────────────────────

def test_bootstrap_run_startup_exists_and_calls_seeds_then_workers():
    fns = _functions_by_name(_tree(BOOTSTRAP_INIT))
    run_startup = fns.get("run_startup")
    assert run_startup is not None, "bootstrap/__init__.py must define run_startup"
    calls = _calls_within(run_startup)
    assert "run_all_seeds_and_indexes" in calls, (
        "run_startup must call run_all_seeds_and_indexes"
    )
    assert "spawn_background_workers" in calls, (
        "run_startup must call spawn_background_workers"
    )


def test_bootstrap_seeds_owns_every_critical_seed_and_index_call():
    """run_all_seeds_and_indexes must own every seed + ensure_indexes
    call PUTKI HQ relies on. Drop one and this test fires."""
    fns = _functions_by_name(_tree(BOOTSTRAP_SEEDS))
    seeds = fns.get("run_all_seeds_and_indexes")
    assert seeds is not None, "bootstrap/seeds.py must define run_all_seeds_and_indexes"
    calls = _calls_within(seeds)
    required = {
        # Seeds
        "seed_default_guidelines",
        "seed_tracked_sources",
        "seed_operators",
        "seed_streamers",
        "seed_foundational_research",
        "seed_default_cadences",
        "seed_editorial_subjects",
        "seed_default_registry",
        # Ensure indexes - every module that owns persistent state.
        "_ensure_replay_index",
        "feed_ensure_indexes",
        "layer2_ensure_indexes",
        "content_ensure_indexes",
        "alerts_ensure_indexes",
        "og_ensure_indexes",
        "snap_ensure",
        "drafter_ensure",
        "dispatch_ensure",
        "voita_ensure",
        "reg_ensure",
    }
    missing = required - calls
    assert not missing, f"run_all_seeds_and_indexes missing required steps: {missing}"


def test_bootstrap_workers_owns_every_critical_worker_spawn():
    """spawn_background_workers must own every long-lived background
    task. Drop one and this test fires (preventing a worker from being
    silently disabled by a misplaced edit)."""
    fns = _functions_by_name(_tree(BOOTSTRAP_WORKERS))
    workers = fns.get("spawn_background_workers")
    assert workers is not None, "bootstrap/workers.py must define spawn_background_workers"
    calls = _calls_within(workers)
    required = {
        "signal_dial_worker",            # passed in as a kwarg, called via signal_dial_worker()
        "feed_worker_loop",
        "_yt_lease_loop",
        "start_layer2_workers",
        "_disc_loop",
        "scheduler_worker_loop",
        "variant_filler_worker_loop",
        "dispatch_worker_loop",
    }
    missing = required - calls
    assert not missing, f"spawn_background_workers missing required spawns: {missing}"
