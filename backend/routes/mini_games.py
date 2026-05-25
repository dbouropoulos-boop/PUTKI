"""
PUTKI HQ — Mini-games routes (iter66 modularisation phase 2).

Extracts all `/api/mini-games/*` + `/api/admin/mini-games/*` endpoints
from server.py. ~25 endpoints, ~390 LOC moved out of the monolith.

Uses the shared `routes/_helpers.py` deps so the factory takes no
positional args — `build_mini_games_router()` just composes the
APIRouter and the caller mounts it.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

import mini_games as _mg
import mini_game_tournament as _mgt
from routes._helpers import (
    get_db,
    require_admin,
    MiniGameFinishPayload,
    MiniGameUnlockPayload,
    MiniGameInsightRevealPayload,
    MiniGameInsightFinishPayload,
    MiniGameArcadeScorePayload,
    MiniGameShareTrackPayload,
    MiniGameQuestionPayload,
)


def build_mini_games_router() -> APIRouter:
    """Returns the composed APIRouter — mount with `api_router.include_router(...)`."""
    router = APIRouter()

    # ── Quiz ─────────────────────────────────────────────────────────

    @router.get("/mini-games/hub")
    async def mini_games_hub(db = Depends(get_db)):
        """Public hub payload — 5 game tiles + this week's tournament state."""
        return await _mg.get_hub_payload(db)

    @router.post("/mini-games/quiz/start")
    async def mini_games_quiz_start(db = Depends(get_db)):
        """Anonymous play start — no email needed. Returns play_id + questions."""
        return await _mg.start_quiz(db)

    @router.post("/mini-games/quiz/finish")
    async def mini_games_quiz_finish(payload: MiniGameFinishPayload, db = Depends(get_db)):
        """Score the player's answers. Returns preview score + per-question
        explanations. Full personalized result is gated behind email."""
        result = await _mg.finish_quiz(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
            answers=[a.dict() for a in payload.answers],
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    @router.post("/mini-games/quiz/unlock")
    async def mini_games_quiz_unlock(
        payload: MiniGameUnlockPayload, request: Request, db = Depends(get_db),
    ):
        """Email capture → unlock full personalized result + tournament rank."""
        ip = (request.client.host if request.client else None)
        result = await _mg.unlock_quiz_result(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
            email=payload.email, name=payload.name, consent=payload.consent, ip=ip,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    # ── Leaderboards ────────────────────────────────────────────────

    @router.get("/mini-games/leaderboard")
    async def mini_games_leaderboard(
        week: Optional[str] = None, limit: int = 10, db = Depends(get_db),
    ):
        return {"leaderboard": await _mg.get_leaderboard(
            db, week_iso=week, limit=min(limit, 50),
        )}

    @router.get("/mini-games/leaderboard/{game_slug}")
    async def mini_games_leaderboard_per_game(
        game_slug: str, week: Optional[str] = None, limit: int = 10,
        db = Depends(get_db),
    ):
        """Per-game weekly leaderboard surfaced on each game's intro screen.
        404 on unknown slugs so the frontend doesn't render bogus boards."""
        if game_slug not in _mgt.ACTIVE_GAME_SLUGS:
            raise HTTPException(404, "unknown_game")
        return await _mg.get_game_leaderboard(
            db, game_slug=game_slug, week_iso=week, limit=limit,
        )

    # ── Admin · Leads + CSV export ──────────────────────────────────

    @router.get("/admin/mini-games/leads")
    async def admin_mini_games_leads(
        week: Optional[str] = None,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        """Lead export — full email + score for the given week (default: current)."""
        q: Dict[str, Any] = {"source_game": _mg.QUIZ_GAME_SLUG}
        if week:
            q["tournament_week_iso"] = week
        cur = db.mini_game_leads.find(q, {"_id": 0}).sort("consent_at", -1)
        return {"leads": await cur.to_list(length=5000)}

    @router.get("/admin/mini-games/leads.csv")
    async def admin_mini_games_leads_csv(
        week: Optional[str] = None,
        game: Optional[str] = None,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        """CSV lead export. Filterable by source_game + tournament_week_iso.
        Returns RFC-4180 CSV with explicit consent + score columns for CRM sync."""
        q: Dict[str, Any] = {}
        if game:
            q["source_game"] = game
        if week:
            q["tournament_week_iso"] = week
        cur = db.mini_game_leads.find(q, {"_id": 0}).sort("consent_at", -1)
        rows = await cur.to_list(length=10000)

        buf = io.StringIO()
        writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            "email", "name", "source_game", "tournament_week_iso",
            "score", "pct", "consent_at", "consent_text_sha", "privacy_url",
        ])
        for r in rows:
            writer.writerow([
                r.get("email", ""), r.get("name", ""), r.get("source_game", ""),
                r.get("tournament_week_iso", ""), r.get("score", 0),
                f'{float(r.get("pct") or 0):.1f}',
                r.get("consent_at", ""), r.get("consent_text_sha", ""),
                r.get("privacy_url", ""),
            ])
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=mini-game-leads-{week or 'all'}.csv"},
        )

    # ── Scenario ────────────────────────────────────────────────────

    @router.post("/mini-games/scenario/start")
    async def mini_games_scenario_start(db = Depends(get_db)):
        return await _mg.start_scenario(db)

    @router.post("/mini-games/scenario/finish")
    async def mini_games_scenario_finish(
        payload: MiniGameFinishPayload, db = Depends(get_db),
    ):
        result = await _mg.finish_scenario(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
            answers=[a.dict() for a in payload.answers],
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    @router.post("/mini-games/scenario/unlock")
    async def mini_games_scenario_unlock(
        payload: MiniGameUnlockPayload, request: Request, db = Depends(get_db),
    ):
        ip = (request.client.host if request.client else None)
        result = await _mg.unlock_scenario_result(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
            email=payload.email, name=payload.name, consent=payload.consent, ip=ip,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])

        # iter65 — fire-and-forget welcome email (live if RESEND_API_KEY set,
        # MOCKED otherwise). Never block the unlock response on email.
        import asyncio
        import logging
        logger = logging.getLogger(__name__)
        try:
            from resend_email import send_welcome_email
            from mini_games import _email_hash
            persona = result.get("persona") or {}
            lang_pref = (request.headers.get("x-lang") or "fi").lower()
            if lang_pref not in ("fi", "en"):
                lang_pref = "fi"
            asyncio.create_task(send_welcome_email(
                db=db,
                email=payload.email,
                email_hash=_email_hash(payload.email),
                source_game="scenario_decisions",
                persona_key=persona.get("key", "patient_tactician"),
                persona_title_fi=persona.get("title", ""),
                persona_title_en=persona.get("title_en", ""),
                blind_spot_fi=persona.get("blind_spot_fi", ""),
                blind_spot_en=persona.get("blind_spot_en", ""),
                three_traps_fi=persona.get("three_traps_fi") or [],
                three_traps_en=persona.get("three_traps_en") or [],
                lang=lang_pref,
            ))
        except Exception:
            logger.exception("scenario_unlock: welcome email scheduling failed (non-fatal)")

        return result

    # ── Insight Reveal ──────────────────────────────────────────────

    @router.post("/mini-games/insight/start")
    async def mini_games_insight_start(db = Depends(get_db)):
        return await _mg.start_insight(db)

    @router.post("/mini-games/insight/reveal")
    async def mini_games_insight_reveal(
        payload: MiniGameInsightRevealPayload, db = Depends(get_db),
    ):
        result = await _mg.reveal_insight_tile(
            db, play_id=payload.play_id, anon_id=payload.anon_id, q_id=payload.q_id,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    @router.post("/mini-games/insight/finish")
    async def mini_games_insight_finish(
        payload: MiniGameInsightFinishPayload, db = Depends(get_db),
    ):
        result = await _mg.finish_insight(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    @router.post("/mini-games/insight/unlock")
    async def mini_games_insight_unlock(
        payload: MiniGameUnlockPayload, request: Request, db = Depends(get_db),
    ):
        ip = (request.client.host if request.client else None)
        result = await _mg.unlock_insight_result(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
            email=payload.email, name=payload.name, consent=payload.consent, ip=ip,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    # ── Arcade (Snake + Tap) ────────────────────────────────────────

    @router.post("/mini-games/arcade/{game}/start")
    async def mini_games_arcade_start(game: str, db = Depends(get_db)):
        slug = f"arcade_{game}" if not game.startswith("arcade_") else game
        if slug not in ("arcade_snake", "arcade_tap"):
            raise HTTPException(400, "unknown_game")
        result = await _mg.start_arcade(db, game_slug=slug)
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    @router.post("/mini-games/arcade/{game}/submit")
    async def mini_games_arcade_submit(
        game: str, payload: MiniGameArcadeScorePayload, db = Depends(get_db),
    ):
        result = await _mg.submit_arcade_score(
            db, play_id=payload.play_id, anon_id=payload.anon_id, score=payload.score,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    @router.post("/mini-games/arcade/{game}/unlock")
    async def mini_games_arcade_unlock(
        game: str, payload: MiniGameUnlockPayload, request: Request,
        db = Depends(get_db),
    ):
        ip = (request.client.host if request.client else None)
        result = await _mg.unlock_arcade_result(
            db, play_id=payload.play_id, anon_id=payload.anon_id,
            email=payload.email, name=payload.name, consent=payload.consent, ip=ip,
        )
        if result.get("error"):
            raise HTTPException(400, result["error"])
        return result

    # ── Champions / Share / Stats ───────────────────────────────────

    @router.get("/mini-games/champions")
    async def mini_games_champions(week: Optional[str] = None, db = Depends(get_db)):
        """Public homepage social-proof endpoint — one rank-1 per active game."""
        return await _mg.get_weekly_champions(db, week_iso=week)

    @router.post("/mini-games/share/track")
    async def mini_games_share_track(
        payload: MiniGameShareTrackPayload, db = Depends(get_db),
    ):
        """Fire-and-forget telemetry — increments share count per game."""
        await _mgt.track_share(db, game_slug=payload.game_slug, play_id=payload.play_id)
        return {"tracked": True}

    @router.get("/mini-games/stats/{game_slug}")
    async def mini_games_stats(
        game_slug: str, week: Optional[str] = None, db = Depends(get_db),
    ):
        """Per-game public social-proof stats — used on each game's subpage.
        Returns a SAFE subset of the analytics payload (no individual emails)."""
        if game_slug not in _mgt.ACTIVE_GAME_SLUGS:
            raise HTTPException(404, "unknown_game")
        metrics = await _mgt.aggregate_metrics(db, week_iso=week)
        row = next((r for r in metrics["rows"] if r["game_slug"] == game_slug), None)
        if not row:
            raise HTTPException(404, "no_stats")
        return {
            "game_slug": row["game_slug"],
            "game_title_fi": row["game_title_fi"],
            "week_iso": metrics["week_iso"] or _mgt._week_iso(_mgt._now()),
            "plays_started": row["plays_started"],
            "plays_finished": row["plays_finished"],
            "ranked_players": row["leads_captured"],
            "shares": row["shares"],
            "top_player": row["top_player"],
            "top_score": row["top_score"],
        }

    # ── Admin · Analytics + tournament controls ─────────────────────

    @router.get("/admin/mini-games/analytics")
    async def admin_mini_games_analytics(
        week: Optional[str] = None,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        """Full back-office analytics: per-game + totals + return rate.
        `week` filters to a specific ISO week; omit for all-time."""
        return await _mgt.aggregate_metrics(db, week_iso=week)

    @router.post("/admin/mini-games/announce-closing")
    async def admin_announce_closing(
        week: Optional[str] = None,
        force: bool = False,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        """Manual override for the weekly tournament closing announcement.
        `week` defaults to the just-closed ISO week; `force=true` overrides
        the idempotency guard."""
        return await _mgt.announce_tournament_closing(db, week_iso=week, force=force)

    # ── Admin · Question editor ─────────────────────────────────────

    @router.get("/admin/mini-games/questions")
    async def admin_mg_questions_list(
        slug: Optional[str] = None,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        q: Dict[str, Any] = {}
        if slug:
            q["slug"] = slug
        cur = db.mini_game_questions.find(q, {"_id": 0}).sort([("slug", 1), ("order", 1)])
        return {"questions": await cur.to_list(length=500)}

    @router.post("/admin/mini-games/questions")
    async def admin_mg_questions_upsert(
        payload: MiniGameQuestionPayload,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        """Create or update a question. Idempotent by (slug, order)."""
        now = datetime.now(timezone.utc).isoformat()
        existing = await db.mini_game_questions.find_one(
            {"slug": payload.slug, "order": payload.order}, {"_id": 0, "id": 1},
        )
        if existing:
            await db.mini_game_questions.update_one(
                {"slug": payload.slug, "order": payload.order},
                {"$set": {
                    "prompt_fi": payload.prompt_fi,
                    "options": payload.options,
                    "correct": payload.correct,
                    "explanation_fi": payload.explanation_fi,
                    "topic_tag": payload.topic_tag,
                    "active": payload.active,
                    "updated_at": now,
                    "updated_by": "admin",
                }},
            )
            return {"updated": True, "id": existing["id"]}
        new_id = str(uuid.uuid4())
        await db.mini_game_questions.insert_one({
            "id": new_id, "slug": payload.slug, "order": payload.order,
            "prompt_fi": payload.prompt_fi, "options": payload.options,
            "correct": payload.correct, "explanation_fi": payload.explanation_fi,
            "topic_tag": payload.topic_tag, "active": payload.active,
            "created_at": now, "updated_by": "admin",
        })
        return {"created": True, "id": new_id}

    @router.delete("/admin/mini-games/questions/{question_id}")
    async def admin_mg_questions_delete(
        question_id: str,
        _: bool = Depends(require_admin),
        db = Depends(get_db),
    ):
        r = await db.mini_game_questions.delete_one({"id": question_id})
        if r.deleted_count == 0:
            raise HTTPException(404, "not_found")
        return {"deleted": question_id}

    return router
