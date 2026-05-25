"""
bootstrap.seeds - every seed_* and ensure_indexes call PUTKI HQ runs at
startup, in one auditable list.

Each step is wrapped in try/except + structured logger so a single broken
module never blocks the others. Imports stay local to each step so a
missing dependency in one corner of the codebase doesn't kill the whole
bootstrap.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def _safe(label: str, coro: Any) -> Any:
    """Await `coro`, logging exceptions without propagating. Returns the
    coroutine's result (or None on failure)."""
    try:
        result = await coro
        if isinstance(result, dict):
            logger.info("bootstrap.seeds: %s ok: %s", label, result)
        return result
    except Exception:
        logger.exception("bootstrap.seeds: %s failed", label)
        return None


async def run_all_seeds_and_indexes(db) -> None:
    """Run every seed_* + ensure_indexes call PUTKI HQ relies on at boot.

    Order:
      1. Editorial / roster / cadence seeds (data the app reads).
      2. Index ensures (queries depend on these).
      3. Module-local index ensures (one per feature module).
    """
    # ── Seeds ────────────────────────────────────────────────────────
    from content_engine import seed_default_guidelines
    from source_map import seed_tracked_sources
    from rosters import seed_operators, seed_streamers
    from foundational_research import seed_from_file as seed_foundational_research
    from seed_scheduler import seed_default_cadences
    from editorial_subjects import seed_from_file as seed_editorial_subjects

    await _safe("seed_default_guidelines", seed_default_guidelines(db))
    await _safe("seed_tracked_sources", seed_tracked_sources(db))
    await _safe("seed_operators", seed_operators(db))
    await _safe("seed_streamers", seed_streamers(db))
    await _safe("seed_foundational_research", seed_foundational_research(db))
    await _safe("seed_default_cadences", seed_default_cadences(db))
    await _safe("seed_editorial_subjects", seed_editorial_subjects(db))

    # ── Index ensures (cross-feature) ────────────────────────────────
    from webhooks import _ensure_replay_index
    from feed import ensure_indexes as feed_ensure_indexes
    from layer2_workers import ensure_indexes as layer2_ensure_indexes
    from content_generator import ensure_indexes as content_ensure_indexes

    await _safe("webhooks._ensure_replay_index", _ensure_replay_index(db))
    await _safe("feed_ensure_indexes", feed_ensure_indexes(db))
    await _safe("layer2_ensure_indexes", layer2_ensure_indexes(db))
    await _safe("content_ensure_indexes", content_ensure_indexes(db))

    # ── Index ensures (per feature module - local imports) ───────────
    from streamer_alerts import ensure_indexes as alerts_ensure_indexes
    from og_image_fetcher import ensure_indexes as og_ensure_indexes
    from streamer_snapshots import ensure_indexes as snap_ensure
    from streamer_meta_drafter import ensure_indexes as drafter_ensure
    from dispatch_daily import ensure_indexes as dispatch_ensure
    from voita_engine import ensure_indexes as voita_ensure
    from slot_registry import ensure_indexes as reg_ensure, seed_default_registry

    await _safe("streamer_alerts.ensure_indexes", alerts_ensure_indexes(db))
    from alert_sessions import ensure_indexes as alert_sessions_ensure
    await _safe("alert_sessions.ensure_indexes", alert_sessions_ensure(db))
    await _safe("og_image_fetcher.ensure_indexes", og_ensure_indexes(db))
    await _safe("streamer_snapshots.ensure_indexes", snap_ensure(db))
    await _safe("streamer_meta_drafter.ensure_indexes", drafter_ensure(db))
    await _safe("dispatch_daily.ensure_indexes", dispatch_ensure(db))
    await _safe("voita_engine.ensure_indexes", voita_ensure(db))
    await _safe("slot_registry.ensure_indexes", reg_ensure(db))
    await _safe("slot_registry.seed_default_registry", seed_default_registry(db))

    # iter55 - mini-game suite (educational quiz + tournament backbone)
    from mini_games import ensure_indexes as mg_ensure, seed_quiz_questions, seed_phase2_games
    await _safe("mini_games.ensure_indexes", mg_ensure(db))
    await _safe("mini_games.seed_quiz_questions", seed_quiz_questions(db))
    await _safe("mini_games.seed_phase2_games", seed_phase2_games(db))

    # iter58 - tournament closing + analytics indexes
    from mini_game_tournament import ensure_indexes as mgt_ensure
    await _safe("mini_game_tournament.ensure_indexes", mgt_ensure(db))
