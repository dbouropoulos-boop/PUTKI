"""
Regression lock for the iter48 startup-block extraction.

Before iter48 the entire startup body (seeds + Layer 2 worker spawn + dispatch
worker spawn + scheduler) was orphan-indented inside the
`admin_voita_import_odds` endpoint, AFTER its `return` statement. That made
every background worker unreachable — the news ticker, RSS poller, content
generator, dispatch loop and scheduler all silently died until the next code
edit happened to land inside an actual startup hook.

These tests fail fast if anyone re-orphans the startup block.
"""
from __future__ import annotations

import ast
from pathlib import Path

SERVER_PY = Path(__file__).resolve().parents[1] / "server.py"


def _tree() -> ast.AST:
    return ast.parse(SERVER_PY.read_text())


def test_startup_event_is_top_level_with_app_on_event_decorator():
    tree = _tree()
    matches = [
        n for n in tree.body
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "startup_event"
    ]
    assert len(matches) == 1, "startup_event must be a module-level async function"
    decos = [ast.unparse(d) for d in matches[0].decorator_list]
    assert any("on_event('startup')" in d or 'on_event("startup")' in d for d in decos), (
        f"startup_event must carry @app.on_event('startup'). got decorators: {decos}"
    )


def test_startup_seed_calls_are_in_startup_event_not_in_admin_endpoint():
    """The lines `await seed_default_guidelines(db)` / `await seed_streamers(db)` /
    `await start_layer2_workers(db,...)` must live inside startup_event, NOT
    inside admin_voita_import_odds (the regression we just fixed)."""
    tree = _tree()
    by_name = {
        n.name: n for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    startup = by_name.get("startup_event")
    bad = by_name.get("admin_voita_import_odds")
    assert startup is not None and bad is not None

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

    must_be_in_startup = {
        "seed_default_guidelines",
        "seed_streamers",
        "seed_operators",
        "start_layer2_workers",
        "_signal_dial_worker",
        "dispatch_worker_loop",
        "scheduler_worker_loop",
    }
    startup_calls = _calls_within(startup)
    bad_calls = _calls_within(bad)

    missing = must_be_in_startup - startup_calls
    assert not missing, f"startup_event missing critical bootstrap calls: {missing}"

    leaked = must_be_in_startup & bad_calls
    assert not leaked, (
        f"admin_voita_import_odds must not contain bootstrap calls "
        f"(orphan-startup regression): {leaked}"
    )
