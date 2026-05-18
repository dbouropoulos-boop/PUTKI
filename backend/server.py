from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone, timedelta


async def require_admin(x_admin_token: Optional[str] = Header(None, alias='X-Admin-Token')):
    expected = os.environ.get('BACK_OFFICE_TOKEN', 'putki-hq-admin')
    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=401, detail='Invalid admin token')
    return True


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="PUTKI HQ API — Phase 1")
api_router = APIRouter(prefix="/api")


# ---------- MOCK CONTENT MODELS & DATA (Phase 1) ----------

DIAL_STATES = {
    "KYLMA":       {"key": "KYLMA",       "label": "KYLMÄ",       "color": "#2C5F8D", "value": 12, "headline": "Mittari on KYLMÄ. Skene nukkuu."},
    "HAALEA":      {"key": "HAALEA",      "label": "HAALEA",      "color": "#7A7E83", "value": 38, "headline": "Mittari on HAALEA. Tasaista taustakohinaa."},
    "KUUMA":       {"key": "KUUMA",       "label": "KUUMA",       "color": "#E8924A", "value": 64, "headline": "Mittari on KUUMA. Slot-skene lämpenee illaksi."},
    "MYRSKY":      {"key": "MYRSKY",      "label": "MYRSKY",      "color": "#C8423C", "value": 82, "headline": "Mittari on MYRSKY. Striimit täynnä, klippejä syntyy."},
    "KIIRASTULI":  {"key": "KIIRASTULI",  "label": "KIIRASTULI",  "color": "#8B1E1A", "value": 96, "headline": "Mittari on KIIRASTULI. Älä katso pois."},
}

CURRENT_STATE_KEY = "KYLMA"  # Honest default: no signal yet on first boot. Real state is computed by dial_engine.


# ---------- ENDPOINTS ----------

@api_router.get("/")
async def root():
    return {"service": "PUTKI HQ API", "phase": 1, "status": "ok"}


@api_router.get("/dial")
async def get_dial():
    """Current Mittari state — sourced from latest dial_snapshot if available,
    otherwise the static seed for first-boot. The recalc worker writes
    snapshots every POLL_INTERVAL_SECONDS once the app has booted."""
    snap = await latest_dial_snapshot(db)
    if snap:
        state = dict(snap["state"])
        state["value"] = int(round(snap["composite_score"]))  # back-compat: frontend + tests expect state.value as int
        return {
            "state": state,
            "composite_score": snap["composite_score"],
            "updated_at": snap["computed_at"],
            "any_real": snap.get("any_real", False),
            "context": {
                "primary_driver": snap.get("primary_driver"),
                "signal_count": snap.get("signal_count", 0),
                "sub_scores": snap.get("sub_scores", {}),
            },
        }
    state = DIAL_STATES[CURRENT_STATE_KEY]
    return {
        "state": state,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "any_real": False,
        "context": {
            "active_signals": [],
            "note": "Ei signaalia vielä — PUTKI HQ:n pollerit eivät ole vielä keränneet dataa.",
        },
    }


@api_router.get("/dial/states")
async def get_dial_states():
    return {"states": list(DIAL_STATES.values())}


# ---------- Newsletter signup (lightweight, no auth) ----------

class SignupRequest(BaseModel):
    email: EmailStr
    streamers: List[str] = Field(default_factory=list)
    channels: List[str] = Field(default_factory=list)


class SignupResponse(BaseModel):
    id: str
    email: EmailStr
    streamers: List[str]
    channels: List[str]
    created_at: str


@api_router.post("/signup", response_model=SignupResponse)
async def signup(data: SignupRequest):
    doc = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "streamers": data.streamers,
        "channels": data.channels,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.signups.insert_one(doc)
    doc.pop("_id", None)
    return SignupResponse(**doc)


# ---------- Predictions (Weekly Card) ----------

class PredictionRequest(BaseModel):
    fixture_id: str
    pick: str
    user_email: Optional[EmailStr] = None


class PredictionResponse(BaseModel):
    id: str
    fixture_id: str
    pick: str
    user_email: Optional[EmailStr] = None
    created_at: str


@api_router.get("/signup/count")
async def signup_count():
    """Public — honest live count of newsletter subscribers."""
    n = await db.signups.count_documents({})
    return {"count": n}


@api_router.post("/predictions", response_model=PredictionResponse)
async def submit_prediction(data: PredictionRequest):
    doc = {
        "id": str(uuid.uuid4()),
        "fixture_id": data.fixture_id,
        "pick": data.pick,
        "user_email": data.user_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.predictions.insert_one(doc)
    doc.pop("_id", None)
    return PredictionResponse(**doc)


# ---------- Site settings (back-office) ----------

class SettingsPayload(BaseModel):
    telegram_channel: Optional[str] = None
    smartico_template_id: Optional[str] = None
    smartico_loader_url: Optional[str] = None
    smartico_brand_key: Optional[str] = None


SETTINGS_KEY = "site"


async def _get_settings_doc():
    doc = await db.settings.find_one({"_id": SETTINGS_KEY}) or {}
    return {
        "telegram_channel": doc.get("telegram_channel"),
        "smartico_template_id": doc.get("smartico_template_id"),
        "smartico_loader_url": doc.get("smartico_loader_url"),
        "smartico_brand_key": doc.get("smartico_brand_key"),
        "updated_at": doc.get("updated_at"),
    }


@api_router.get("/settings/public")
async def get_public_settings():
    """Public — only safe-to-expose settings."""
    s = await _get_settings_doc()
    return {
        "telegram_channel": s.get("telegram_channel"),
        "smartico_template_id": s.get("smartico_template_id"),
        "smartico_loader_url": s.get("smartico_loader_url"),
        "smartico_brand_key": s.get("smartico_brand_key"),
    }


@api_router.get("/admin/settings")
async def admin_get_settings(_: bool = Depends(require_admin)):
    return await _get_settings_doc()


@api_router.put("/admin/settings")
async def admin_update_settings(data: SettingsPayload, _: bool = Depends(require_admin)):
    update = {
        "telegram_channel": data.telegram_channel,
        "smartico_template_id": data.smartico_template_id,
        "smartico_loader_url": data.smartico_loader_url,
        "smartico_brand_key": data.smartico_brand_key,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.settings.update_one(
        {"_id": SETTINGS_KEY},
        {"$set": update},
        upsert=True,
    )
    return await _get_settings_doc()


# ---------- Game scores (Phase 2.5 — Weezy Rally) ----------

class GameScoreRequest(BaseModel):
    cookie_id: str = Field(..., min_length=8, max_length=64)
    name: Optional[str] = Field(default=None, max_length=32)
    score: int = Field(..., ge=0, le=10_000_000)
    crashes: int = Field(default=0, ge=0, le=10)
    time_left: int = Field(default=0, ge=0, le=300)
    week: Optional[str] = Field(default=None, max_length=8)
    stage: Optional[str] = Field(default='imatra', max_length=24)


class GameScoreResponse(BaseModel):
    id: str
    cookie_id: str
    name: Optional[str]
    score: int
    rank: int
    total: int
    is_personal_best: bool
    week: str
    stage: str
    created_at: str


def _current_week():
    iso = datetime.now(timezone.utc).isocalendar()
    return f"{iso[0]}W{iso[1]:02d}"


@api_router.post("/game-scores", response_model=GameScoreResponse)
async def submit_game_score(data: GameScoreRequest):
    week = data.week or _current_week()
    # Personal best check
    prev = await db.game_scores.find_one({
        "cookie_id": data.cookie_id, "week": week, "stage": data.stage
    }, sort=[("score", -1)])
    is_pb = prev is None or data.score > (prev.get("score") or 0)

    doc = {
        "id": str(uuid.uuid4()),
        "cookie_id": data.cookie_id,
        "name": (data.name or "").strip()[:32] or None,
        "score": data.score,
        "crashes": data.crashes,
        "time_left": data.time_left,
        "week": week,
        "stage": data.stage,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.game_scores.insert_one(doc)
    doc.pop("_id", None)

    total = await db.game_scores.count_documents({"week": week, "stage": data.stage})
    higher = await db.game_scores.count_documents({
        "week": week, "stage": data.stage, "score": {"$gt": data.score}
    })
    rank = higher + 1
    return GameScoreResponse(rank=rank, total=total, is_personal_best=is_pb, **doc)


@api_router.get("/game-scores/leaderboard")
async def game_leaderboard(
    week: Optional[str] = None,
    stage: str = 'imatra',
    limit: int = 10,
):
    week = week or _current_week()
    limit = max(1, min(50, limit))
    cur = db.game_scores.find(
        {"week": week, "stage": stage},
        {"_id": 0, "cookie_id": 0, "crashes": 0, "time_left": 0},
    ).sort("score", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    return {"week": week, "stage": stage, "leaderboard": rows}


@api_router.get("/game-scores/me")
async def game_personal(cookie_id: str, week: Optional[str] = None, stage: str = 'imatra'):
    week = week or _current_week()
    best = await db.game_scores.find_one(
        {"cookie_id": cookie_id, "week": week, "stage": stage},
        {"_id": 0, "cookie_id": 0},
        sort=[("score", -1)],
    )
    if not best:
        return {"week": week, "stage": stage, "best": None, "rank": None, "total": 0}
    higher = await db.game_scores.count_documents({
        "week": week, "stage": stage, "score": {"$gt": best["score"]}
    })
    total = await db.game_scores.count_documents({"week": week, "stage": stage})
    return {"week": week, "stage": stage, "best": best, "rank": higher + 1, "total": total}


# ───────────────── Phase 3 — Content automation engine ─────────────────
from content_engine import (  # noqa: E402
    CONTENT_TYPES,
    DEFAULT_GUIDELINES,
    distribute_content,
    generate_content_for_signal,
    list_guidelines,
    seed_default_guidelines,
    upsert_guideline,
)
from signal_engine import (  # noqa: E402
    poll_all_sources,
    list_recent_signals,
    POLL_INTERVAL_SECONDS,
)
from dial_engine import (  # noqa: E402
    recalculate_dial,
    latest_snapshot as latest_dial_snapshot,
    dial_history,
)
from layer2_workers import (  # noqa: E402
    start_layer2_workers,
    ensure_indexes as layer2_ensure_indexes,
    twitch_tick,
    reddit_tick,
    nhl_tick,
    rss_tick,
    f1_tick,
    football_tick,
)
import dial_sse  # noqa: E402
from editorial_subjects import (  # noqa: E402
    seed_from_file as seed_editorial_subjects,
    list_subjects as list_editorial_subjects,
    get_subject as get_editorial_subject,
    stats as editorial_subjects_stats,
)
from content_generator import (  # noqa: E402
    ContentGenerator,
    fan_out_from_layer2 as content_fan_out,
    list_drafts as cg_list_drafts,
    get_draft as cg_get_draft,
    list_published as cg_list_published,
    get_published_by_slug as cg_get_published_by_slug,
    ensure_indexes as content_ensure_indexes,
    TEMPLATES as CONTENT_TEMPLATES,
)
from source_map import seed_tracked_sources, list_sources  # noqa: E402
from foundational_research import (  # noqa: E402
    seed_from_file as seed_foundational_research,
    list_entries as list_foundational_entries,
    get_entry as get_foundational_entry,
    upsert_entry as upsert_foundational_entry,
    delete_entry as delete_foundational_entry,
    stats as foundational_research_stats,
    CONTENT_TYPE_TO_BEATS,
    VALID_BEATS,
)
from seed_scheduler import (  # noqa: E402
    seed_default_cadences,
    get_cadences as get_scheduler_cadences,
    set_cadences as set_scheduler_cadences,
    run_scheduler_tick,
    run_variant_filler,
    schedule_status as scheduler_schedule_status,
    scheduler_worker_loop,
    variant_filler_worker_loop,
)
from rosters import (  # noqa: E402
    seed_operators,
    seed_streamers,
    list_operators,
    get_operator,
    upsert_operator,
    delete_operator,
    list_streamers,
    get_streamer,
    upsert_streamer,
    delete_streamer,
    INTL_SCENES_META,
)
from rotation import (  # noqa: E402
    upsert_week as rotation_upsert,
    list_weeks as rotation_list,
    get_week as rotation_get,
    get_current_week as rotation_get_current,
    delete_week as rotation_delete,
    stats as rotation_stats,
    current_iso_week,
    next_iso_weeks,
)

from webhooks import build_webhook_router  # noqa: E402
from weekly_card import build_weekly_router  # noqa: E402
from winners import build_winners_router  # noqa: E402
from peli_raffle import build_peli_router, build_peli_admin_router  # noqa: E402
from article_views import build_views_router  # noqa: E402
from newsroom_router import build_newsroom_router  # noqa: E402

api_router.include_router(build_webhook_router(db))
api_router.include_router(build_weekly_router(db, require_admin))
api_router.include_router(build_winners_router(db, require_admin))
api_router.include_router(build_peli_router(db))
api_router.include_router(build_peli_admin_router(db))
api_router.include_router(build_views_router(db))
api_router.include_router(build_newsroom_router(db))

from feed import (  # noqa: E402
    rebuild_feed,
    list_feed,
    feed_stats,
    ensure_indexes as feed_ensure_indexes,
    feed_worker_loop,
    FEED_DEFAULT_MARKET,
)


class GenerateRequest(BaseModel):
    content_type: str
    signal_payload: dict
    proposed_streamer_id: Optional[str] = None
    proposed_operator_id: Optional[str] = None
    source_signal_type: Optional[str] = None
    source_signal_id: Optional[str] = None


class ApprovalRequest(BaseModel):
    selected_variant_index: Optional[int] = 0
    edited_text: Optional[str] = None
    reviewed_by: Optional[str] = "admin"


class GuidelineUpdate(BaseModel):
    text: str


# ── content type registry (admin) ──
@api_router.get("/admin/content-types")
async def admin_content_types(_: bool = Depends(require_admin)):
    return {
        "content_types": [
            {"key": k, **{kk: vv for kk, vv in v.items()}}
            for k, v in CONTENT_TYPES.items()
        ]
    }


# ── editorial guidelines CRUD ──
@api_router.get("/admin/guidelines")
async def admin_guidelines(_: bool = Depends(require_admin)):
    rows = await list_guidelines(db)
    return {"guidelines": rows}


@api_router.put("/admin/guidelines/{key}")
async def admin_update_guideline(key: str, data: GuidelineUpdate, _: bool = Depends(require_admin)):
    if key not in DEFAULT_GUIDELINES:
        raise HTTPException(404, f"Unknown guideline key: {key}")
    return await upsert_guideline(db, key, data.text, updated_by="admin")


# ── generate content (admin only — calls Claude) ──
@api_router.post("/admin/queue/generate")
async def admin_generate(data: GenerateRequest, _: bool = Depends(require_admin)):
    if data.content_type not in CONTENT_TYPES:
        raise HTTPException(400, f"Unknown content_type: {data.content_type}")
    try:
        doc = await generate_content_for_signal(
            db,
            content_type=data.content_type,
            signal_payload=data.signal_payload,
            proposed_streamer_id=data.proposed_streamer_id,
            proposed_operator_id=data.proposed_operator_id,
            source_signal_type=data.source_signal_type,
            source_signal_id=data.source_signal_id,
        )
        return doc
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        logger.exception("Content generation failed")
        raise HTTPException(502, f"Generation failed: {e}")


# ── approval queue list ──
@api_router.get("/admin/queue")
async def admin_queue(
    status: str = "queued",
    content_type: Optional[str] = None,
    limit: int = 50,
    _: bool = Depends(require_admin),
):
    q: dict = {}
    if status and status != "all":
        q["status"] = status
    if content_type:
        q["content_type"] = content_type
    limit = max(1, min(200, limit))
    cur = db.generated_content.find(q, {"_id": 0}).sort("generated_at", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    counts = {
        "queued": await db.generated_content.count_documents({"status": "queued"}),
        "approved": await db.generated_content.count_documents({"status": "approved"}),
        "killed": await db.generated_content.count_documents({"status": "killed"}),
    }
    return {"items": rows, "counts": counts}


@api_router.get("/admin/queue/{item_id}")
async def admin_queue_item(item_id: str, _: bool = Depends(require_admin)):
    doc = await db.generated_content.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api_router.post("/admin/queue/{item_id}/approve")
async def admin_approve(item_id: str, data: ApprovalRequest, _: bool = Depends(require_admin)):
    doc = await db.generated_content.find_one({"id": item_id})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("status") not in ("queued", "approved"):
        raise HTTPException(400, f"Cannot approve item in status {doc.get('status')}")

    update: dict = {
        "status": "approved",
        "approval_action": "approve",
        "selected_variant_index": data.selected_variant_index or 0,
        "reviewed_by": data.reviewed_by or "admin",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.edited_text:
        update["edited_text"] = data.edited_text
        update["approval_action"] = "edit"
    await db.generated_content.update_one({"id": item_id}, {"$set": update})

    fresh = await db.generated_content.find_one({"id": item_id}, {"_id": 0})
    pub = await distribute_content(db, fresh)
    return {"approved": fresh, "published": pub}


@api_router.post("/admin/queue/{item_id}/kill")
async def admin_kill(item_id: str, _: bool = Depends(require_admin)):
    doc = await db.generated_content.find_one({"id": item_id})
    if not doc:
        raise HTTPException(404, "Not found")
    await db.generated_content.update_one(
        {"id": item_id},
        {"$set": {
            "status": "killed",
            "approval_action": "kill",
            "reviewed_by": "admin",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"killed": item_id}


# ── public site surface — published content ──
@api_router.get("/published")
async def get_published(surface: Optional[str] = None, limit: int = 30):
    """Return the most-recent published items for site surfaces."""
    q: dict = {}
    if surface:
        q["surface"] = surface
    limit = max(1, min(100, limit))
    cur = db.published_content.find(q, {"_id": 0}).sort("published_at", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    return {"items": rows}


# ── live cockpit data — Pääsyy + Viimeisin piikki ──
DIAL_DRIVER_LABELS = {
    "sports":           {"fi": "URHEILUTAPAHTUMA AKTIIVINEN", "en": "SPORTS EVENT ACTIVE"},
    "youtube":          {"fi": "YOUTUBE-VOITTO TUNNISTETTU", "en": "YOUTUBE WIN DETECTED"},
    "streamers":        {"fi": "STRIIMAAJAT LIVENÄ",         "en": "STREAMERS LIVE"},
    "forum":            {"fi": "FOORUMI HERÄSI",             "en": "FORUM ACTIVITY"},
    "approved_content": {"fi": "TOIMITUS JULKAISI",          "en": "EDITORIAL PUBLISHED"},
    "activity_events":  {"fi": "AKTIIVISUUS NOUSI",          "en": "ACTIVITY RISING"},
}


@api_router.get("/cockpit")
async def cockpit_state():
    """Real-time cockpit data backed by dial_snapshots + last published item.
    Falls back to synthetic driver if no snapshot exists yet."""
    snap = await latest_dial_snapshot(db)
    latest_pub = await db.published_content.find_one(
        {}, {"_id": 0}, sort=[("published_at", -1)],
    )
    if snap:
        return {
            "primary_driver": snap.get("primary_driver"),
            "primary_driver_label": snap.get("primary_driver_label"),
            "composite_score": snap.get("composite_score"),
            "state": snap.get("state"),
            "sub_scores": snap.get("sub_scores", {}),
            "signal_count": snap.get("signal_count", 0),
            "any_real": snap.get("any_real", False),
            "last_spike": latest_pub,
            "computed_at": snap.get("computed_at"),
        }
    primary = "approved_content" if latest_pub else "streamers"
    return {
        "primary_driver": primary,
        "primary_driver_label": DIAL_DRIVER_LABELS.get(primary, {"fi": "", "en": ""}),
        "last_spike": latest_pub,
        "any_real": False,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Phase 3: signal pipeline observability + manual recalc ──
@api_router.get("/admin/signals")
async def admin_signals(source: Optional[str] = None, limit: int = 100, _: bool = Depends(require_admin)):
    rows = await list_recent_signals(db, source=source, limit=limit)
    counts = {
        "twitch": await db.signals.count_documents({"source": "twitch"}),
        "kick": await db.signals.count_documents({"source": "kick"}),
        "youtube": await db.signals.count_documents({"source": "youtube"}),
        "forum": await db.signals.count_documents({"source": "forum"}),
        "sports": await db.signals.count_documents({"source": "sports"}),
        "internal": await db.signals.count_documents({"source": "internal"}),
    }
    return {"signals": rows, "counts": counts}


@api_router.post("/admin/signals/poll")
async def admin_signals_poll(_: bool = Depends(require_admin)):
    """Force an immediate poll of all signal sources + dial recalc.
    Useful for testing without waiting for the background worker tick."""
    poll_summary = await poll_all_sources(db)
    snapshot = await recalculate_dial(db)
    return {"poll": poll_summary, "snapshot": snapshot}


@api_router.get("/signals/live")
async def public_live_signals(limit: int = 12):
    """Public — honest live signals only. Returns non-mocked streamer/youtube signals
    surfaced for the public live-tiles grid. If nothing real exists, returns empty
    list (no fabrication)."""
    limit = max(1, min(30, limit))
    cur = db.signals.find(
        {"mocked": {"$ne": True}, "source": {"$in": ["twitch", "kick", "youtube"]}},
        {"_id": 0},
    ).sort("observed_at", -1).limit(limit)
    rows = await cur.to_list(length=limit)
    return {"signals": rows, "count": len(rows), "any_real": len(rows) > 0}


@api_router.get("/streamers/live")
async def public_streamers_live(platform: Optional[str] = None):
    """Pre-launch polish — REAL live streamers across Twitch + Kick + YouTube.

    `platform` query param: omit for Twitch (default Helix `language=fi`),
    or pass `kick` / `youtube` to hit the multi-platform aggregator.
    60s in-process cache per platform. Returns `dormant:true` if creds for
    the requested platform are missing so the frontend can render an
    honest empty state instead of fake data."""
    p = (platform or "twitch").lower()
    if p == "twitch":
        from streamer_live import get_live_streamers
        d = await get_live_streamers()
        d["platform"] = "twitch"
        return d
    if p == "kick":
        from multi_platform_live import fetch_kick_live
        return await fetch_kick_live(db)
    if p == "youtube":
        from multi_platform_live import fetch_youtube_live
        return await fetch_youtube_live(db)
    raise HTTPException(status_code=400, detail="unknown platform")


@api_router.get("/streamers/roster_summary")
async def public_streamers_roster_summary():
    """Lightweight summary of the streamer roster for the SocialProofBar.

    Returns the TOTAL number of streamers we track (across all platforms) +
    how many are currently live + per-platform breakdown. This is what
    visitors should see — "tracked" is the meaningful number, not just
    "live right now."""
    # tracked = whole registry, not roster_size of currently-live snapshot
    tracked_total = await db.streamers.count_documents({})
    by_platform: Dict[str, int] = {}
    cursor = db.streamers.find({}, {"_id": 0, "platform": 1})
    async for s in cursor:
        p = (s.get("platform") or "twitch").lower()
        by_platform[p] = by_platform.get(p, 0) + 1
    # live count — best-effort from public_stats cache (Twitch FI scene)
    try:
        from public_stats import get_live_stats
        stats = await get_live_stats(db)
        live = int(stats.get("twitch_live", 0) or 0)
    except Exception:
        live = 0
    return {
        "tracked_total": tracked_total,
        "by_platform": by_platform,
        "live": live,
    }


# ── Phase 4 Pre-Launch Polish · Streamer Alert subscriptions ──

class StreamerAlertIn(BaseModel):
    email: EmailStr
    streamer_login: str
    streamer_name: Optional[str] = None
    platform: str = "twitch"
    phone: Optional[str] = None
    telegram_username: Optional[str] = None
    channels: Optional[List[str]] = None


@api_router.post("/alerts/streamer")
async def public_streamer_alert(payload: StreamerAlertIn):
    """Capture an opt-in for live-going notifications for a specific streamer
    on a specific platform. Idempotent: same (email, streamer, platform)
    re-submission updates the existing row instead of duplicating."""
    from streamer_alerts import create_alert
    result = await create_alert(
        db,
        email=payload.email,
        streamer_login=payload.streamer_login,
        streamer_name=payload.streamer_name,
        platform=payload.platform,
        phone=payload.phone,
        telegram_username=payload.telegram_username,
        channels=payload.channels,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("reason"))
    return result


@api_router.get("/data/live-stats")
async def public_data_live_stats():
    """Homepage ticker — REAL aggregated counters across Layer 2 collections.
    10s cache. Never fabricated; counters that haven't fired yet return 0."""
    from public_stats import get_live_stats
    return await get_live_stats(db)


@api_router.get("/odds/featured")
async def public_odds_featured():
    """Pre-launch polish — REAL betting odds for "Päivän Vitoset" homepage strip.
    Top 5 favourites by implied probability across NHL + select football.
    15 min cache. Dormant=true when ODDS_API_KEY is unset."""
    from odds_api import get_featured_picks
    return await get_featured_picks()


@api_router.get("/odds/market-watch")
async def public_odds_market_watch():
    """Phase 1 (Section 7c) — Daily Market Watch Card payload.
    Computes today's average Sharpness across published picks and returns
    a 30-day sparkline of daily averages. Persists today's score to
    `sharpness_daily` so the sparkline accumulates over time."""
    from odds_api import get_featured_picks
    from sharpness import daily_market_watch
    cached = await get_featured_picks()
    picks = cached.get("picks") or []
    # Strip out internal-only keys from picks for the market watch.
    sharpness_picks = [
        {"sharpness": (p.get("sharpness") or {}).get("sharpness", 0)}
        for p in picks
    ]
    return await daily_market_watch(db, sharpness_picks)


@api_router.get("/news/ticker")
async def public_news_ticker(limit: int = 40):
    """Phase 1 (Section 2) — rolling news ticker feed.

    Returns the latest classified items above the relevance threshold,
    sorted by capture time descending. Used by the full-width ticker
    under the top bar.
    """
    limit = max(1, min(100, int(limit or 40)))
    cur = db.news_ticker_items.find(
        {},
        {"_id": 0, "source": 1, "title": 1, "url": 1, "category": 1,
         "severity": 1, "relevance": 1, "verified": 1, "captured_at": 1,
         "published": 1, "entity_tags": 1},
    ).sort([("captured_at", -1)]).limit(limit)
    items: List[Dict[str, Any]] = []
    async for doc in cur:
        items.append(doc)
    return {
        "items": items,
        "count": len(items),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/odds/upcoming")
async def public_odds_upcoming(days: int = 7, top_per_day: int = 5):
    """Betting Tips hub — picks grouped by calendar day for the next N days."""
    from odds_api import get_upcoming_picks
    days = max(1, min(14, days))
    top_per_day = max(1, min(10, top_per_day))
    return await get_upcoming_picks(days=days, top_per_day=top_per_day)


@api_router.get("/dial/history")
async def public_dial_history(limit: int = 48):
    """Public — last N dial snapshots for the home mini-chart."""
    limit = max(1, min(200, limit))
    return {"history": await dial_history(db, limit=limit)}


# ── Phase 1 Sprint 4 — Mittari streak counter + state permalink ──

@api_router.get("/dial/streak")
async def public_dial_streak():
    """Mittari streak counter.
    Returns the days-since-last-PERKELE (or first-time-in-N-days if
    we're currently at PERKELE). Shown as a small low-contrast line
    under the dial section."""
    from dial_engine import state_streak
    snap = await latest_dial_snapshot(db)
    current = (snap or {}).get("state", {}).get("key") or "KYLMA"
    return await state_streak(db, current)


@api_router.get("/dial/permalink/{state_key}/{date_iso}")
async def public_dial_permalink(state_key: str, date_iso: str):
    """Permalink lookup for /m/{state-slug}-{date} share pages.
    Returns the recorded state event for the given state+date, or
    `{found:false}` if nothing recorded on that day."""
    from dial_engine import state_event_for_permalink
    key = state_key.upper()
    event = await state_event_for_permalink(db, key, date_iso)
    if not event:
        return {"found": False, "state_key": key, "date": date_iso}
    # Normalise datetime fields to iso strings.
    for k in ("captured_at", "expires_at"):
        v = event.get(k)
        if hasattr(v, "isoformat"):
            event[k] = v.isoformat()
    return {"found": True, **event}


@api_router.get("/admin/dial/history")
async def admin_dial_history(limit: int = 60, _: bool = Depends(require_admin)):
    return {"history": await dial_history(db, limit=limit)}


# ── Phase 4 Week 1: Layer 2 SSE dial stream + admin ──

@api_router.get("/dial/stream")
async def dial_stream():
    """Server-Sent Events stream of dial snapshots.

    Client opens an `EventSource('/api/dial/stream')` and receives:
      - one bootstrap `event: dial` immediately (last known snapshot)
      - one `event: dial` whenever a Layer 2 worker tick recomputes the dial
      - a `: heartbeat` comment every ~15s to keep the connection alive
    """
    from starlette.responses import StreamingResponse

    # Pre-seed with the most recent persisted snapshot so a brand-new client
    # doesn't have to wait for the next worker tick.
    initial = await latest_dial_snapshot(db)
    return StreamingResponse(
        dial_sse.event_stream(initial_snapshot=initial),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@api_router.get("/admin/layer2/status")
async def admin_layer2_status(_: bool = Depends(require_admin)):
    """Operational view of the four Layer 2 workers — last-tick timestamps,
    document counts, and the most recent dial snapshot summary."""
    out: Dict[str, Any] = {}
    for coll_name in ("stream_signals", "social_signals", "sports_signals",
                      "news_signals", "f1_signals", "football_signals"):
        latest = await db[coll_name].find_one({}, {"_id": 0}, sort=[("captured_at", -1)])
        count = await db[coll_name].count_documents({})
        out[coll_name] = {
            "doc_count": count,
            "latest_captured_at": str(latest.get("captured_at")) if latest else None,
            "latest_summary": _summarize_layer2_doc(coll_name, latest),
        }
    snap = await latest_dial_snapshot(db)
    return {
        "collections": out,
        "latest_dial": {
            "composite_score": snap.get("composite_score") if snap else None,
            "state_key": snap.get("state_key") if snap else None,
            "primary_driver": snap.get("primary_driver") if snap else None,
            "computed_at": snap.get("computed_at") if snap else None,
            "sub_scores": snap.get("sub_scores") if snap else None,
        } if snap else None,
        "sse_subscribers": dial_sse.subscriber_count(),
    }


def _summarize_layer2_doc(coll_name: str, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    if coll_name == "stream_signals":
        return {"active_streams": doc.get("active_streams", 0), "total_viewers": doc.get("total_viewers", 0), "dormant": doc.get("dormant", False)}
    if coll_name == "social_signals":
        return {"mention_count": doc.get("mention_count", 0), "subreddits": doc.get("subreddits", [])}
    if coll_name == "sports_signals":
        return {"games_active": doc.get("games_active", 0), "games": [{"home": g.get("home"), "away": g.get("away"), "start_time_utc": g.get("start_time_utc"), "game_state": g.get("game_state")} for g in doc.get("games", [])]}
    if coll_name == "news_signals":
        return {"matched_count": doc.get("matched_count", 0), "feeds": doc.get("feeds", [])}
    if coll_name == "f1_signals":
        return {"race_active": doc.get("race_active", False), "race_name": doc.get("race_name"),
                "finnish_drivers": doc.get("finnish_drivers", []), "dormant": doc.get("dormant", False)}
    if coll_name == "football_signals":
        return {"matches_active": doc.get("matches_active", 0),
                "finnish_scoring_matches": sum(1 for m in doc.get("matches", []) if m.get("finnish_scorers")),
                "dormant": doc.get("dormant", False)}
    return None


@api_router.post("/admin/layer2/tick")
async def admin_layer2_tick(worker: Optional[str] = None, _: bool = Depends(require_admin)):
    """Manually trigger one Layer 2 worker tick (or all if `worker` omitted)
    then recompute the dial. Returns the resulting dial snapshot."""
    out: Dict[str, Any] = {}
    workers = {"twitch": twitch_tick, "reddit": reddit_tick, "nhl": nhl_tick,
               "rss": rss_tick, "f1": f1_tick, "football": football_tick}
    targets = [worker] if worker else list(workers.keys())
    for w in targets:
        if w not in workers:
            raise HTTPException(status_code=400, detail=f"unknown worker '{w}'")
        try:
            out[w] = await workers[w](db)
        except Exception as e:
            out[w] = {"error": str(e)}
    snap = await recalculate_dial(db)
    await dial_sse.publish(snap)
    return {"workers": out, "dial": snap}


# ── Phase 4 Week 2: Editorial subjects + Content generator ──

@api_router.get("/admin/editorial-subjects")
async def admin_editorial_subjects(
    subject_type: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 200,
    _: bool = Depends(require_admin),
):
    rows = await list_editorial_subjects(db, subject_type=subject_type, category=category, limit=limit)
    return {"subjects": rows, "count": len(rows)}


@api_router.get("/admin/editorial-subjects/stats")
async def admin_editorial_subjects_stats(_: bool = Depends(require_admin)):
    return await editorial_subjects_stats(db)


@api_router.get("/admin/editorial-subjects/{subject_id}")
async def admin_editorial_subject_get(subject_id: str, _: bool = Depends(require_admin)):
    row = await get_editorial_subject(db, subject_id)
    if not row:
        raise HTTPException(status_code=404, detail="subject not found")
    return row


@api_router.get("/admin/content/templates")
async def admin_content_templates(_: bool = Depends(require_admin)):
    """Surface the registered ContentGenerator templates for the back-office UI."""
    return {
        "templates": [
            {"id": tid, "tier": t["tier"], "category": t["category"], "uses_llm": t["uses_llm"]}
            for tid, t in CONTENT_TEMPLATES.items()
        ],
    }


@api_router.get("/content/drafts")
async def admin_list_drafts(
    status: Optional[str] = None, tier: Optional[int] = None, limit: int = 50,
    _: bool = Depends(require_admin),
):
    rows = await cg_list_drafts(db, status=status, tier=tier, limit=limit)
    return {"drafts": rows, "count": len(rows)}


@api_router.get("/content/drafts/{draft_id}")
async def admin_get_draft(draft_id: str, _: bool = Depends(require_admin)):
    row = await cg_get_draft(db, draft_id)
    if not row:
        raise HTTPException(status_code=404, detail="draft not found")
    return row


class _DraftEditBody(BaseModel):
    headline: Optional[str] = None
    subhead: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    url_slug: Optional[str] = None
    external_link: Optional[str] = None
    social: Optional[Dict[str, Any]] = None


@api_router.put("/content/drafts/{draft_id}")
async def admin_edit_draft(draft_id: str, payload: _DraftEditBody, _: bool = Depends(require_admin)):
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")
    res = await _content_generator.edit_draft(draft_id, payload.dict(exclude_none=True))
    if res.get("status") != "edited":
        raise HTTPException(status_code=400, detail=res)
    return res


@api_router.post("/content/drafts/{draft_id}/publish")
async def admin_publish_draft(draft_id: str, _: bool = Depends(require_admin)):
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")
    res = await _content_generator.publish_draft(draft_id, reviewed_by="admin")
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res)
    return res


class _RejectBody(BaseModel):
    note: Optional[str] = None


@api_router.post("/content/drafts/{draft_id}/reject")
async def admin_reject_draft(draft_id: str, payload: _RejectBody, _: bool = Depends(require_admin)):
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")
    res = await _content_generator.reject_draft(draft_id, reviewed_by="admin", note=payload.note)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res)
    return res


class _ManualGenerateBody(BaseModel):
    template_id: str
    signal_data: Dict[str, Any]
    force: bool = False


@api_router.post("/admin/content/generate")
async def admin_manual_generate(payload: _ManualGenerateBody, _: bool = Depends(require_admin)):
    """Manually trigger content generation for a template (operator_news, etc.)."""
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")
    return await _content_generator.generate_from_signal(
        payload.template_id, payload.signal_data, force=payload.force,
    )


class _BackfillBody(BaseModel):
    count: int = 20
    days: int = 60
    templates: Optional[List[str]] = None


@api_router.post("/admin/content/backfill")
async def admin_content_backfill(payload: _BackfillBody, _: bool = Depends(require_admin)):
    """Generate N historical articles across the 6 templates and back-date
    their published_at across the last `days`. Call multiple times to reach
    100–200 total. Hard-capped at 50 per call."""
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")
    from content_backfill import run_backfill
    return await run_backfill(
        db, _content_generator,
        count=payload.count, days=payload.days, templates=payload.templates,
    )


@api_router.post("/admin/streamers/discover")
async def admin_twitch_discover(_: bool = Depends(require_admin)):
    """Manually trigger one Twitch auto-discovery pass. Adds new FI casino
    streamers with ≥1000 followers to the registry."""
    from twitch_discovery import discover_once
    return await discover_once(db)


class _PreviewBody(BaseModel):
    template_id: str
    signal_data: Dict[str, Any]


@api_router.post("/admin/content/preview")
async def admin_content_preview(payload: _PreviewBody, _: bool = Depends(require_admin)):
    """Generate content WITHOUT persisting it. Useful for spot-checking Finnish
    quality + social meta against synthetic inputs without burning a draft slot
    or hitting the rate-limit. Returns the raw template output + assembled
    draft-shaped preview document."""
    from content_generator import TEMPLATES, _build_social_meta, _resolve_body, _slugify
    tmpl = TEMPLATES.get(payload.template_id)
    if not tmpl:
        raise HTTPException(status_code=400, detail=f"unknown template_id '{payload.template_id}'")
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")

    context_obj = await _content_generator._fetch_context(payload.template_id, payload.signal_data)
    try:
        if tmpl["uses_llm"]:
            content = await _content_generator._generate_via_llm(
                payload.template_id, tmpl, payload.signal_data, context_obj,
            )
        else:
            content = _content_generator._generate_structured(payload.template_id, payload.signal_data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"generation_failed: {e.__class__.__name__}: {e}")

    slug = _slugify(content.get("headline") or payload.signal_data.get("title") or payload.template_id)
    preview = {
        "template_id": payload.template_id,
        "tier": tmpl["tier"],
        "category": tmpl["category"],
        "uses_llm": tmpl["uses_llm"],
        "raw_llm_content": content,
        "preview_draft": {
            "headline": (content.get("headline") or "")[:240],
            "subhead": (content.get("subhead") or "")[:300],
            "body": _resolve_body(payload.template_id, content),
            "url_slug": slug,
            "category": tmpl["category"],
            "tags": list(content.get("article_tags") or content.get("tags") or []),
            "external_link": content.get("external_link"),
            "expires_at": content.get("expires_at"),
            "social": _build_social_meta(content, payload.signal_data, payload.template_id, slug),
        },
        "context_used": context_obj.get("matched_subject"),
    }
    return preview


# ── Public content endpoints (Week 2 published content surface) ──

@api_router.get("/content/published")
async def public_list_published(category: Optional[str] = None, limit: int = 50):
    rows = await cg_list_published(db, category=category, limit=limit)
    return {"items": rows, "count": len(rows)}


@api_router.get("/content/stats")
async def public_content_stats():
    """Activity stats for the homepage credibility panel.

    Returns:
      - articles_today: published since UTC midnight
      - articles_this_week: published in the last 7 rolling days
      - articles_total: cumulative published count
      - last_published_at: ISO timestamp of the most recent publish
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()

    q_base = {"draft_id": {"$exists": True}}
    today_count = await db.published_content.count_documents(
        {**q_base, "published_at": {"$gte": today_start}}
    )
    week_count = await db.published_content.count_documents(
        {**q_base, "published_at": {"$gte": week_start}}
    )
    total = await db.published_content.count_documents(q_base)
    latest = await db.published_content.find_one(
        q_base, {"_id": 0, "published_at": 1, "headline": 1, "url_slug": 1, "category": 1},
        sort=[("published_at", -1)],
    )
    return {
        "articles_today": today_count,
        "articles_this_week": week_count,
        "articles_total": total,
        "last_published_at": (latest or {}).get("published_at"),
        "last_headline": (latest or {}).get("headline"),
        "last_url_slug": (latest or {}).get("url_slug"),
        "last_category": (latest or {}).get("category"),
        "computed_at": now.isoformat(),
    }


@api_router.get("/content/published/{slug}")
async def public_get_published_by_slug(slug: str):
    row = await cg_get_published_by_slug(db, slug)
    if not row:
        raise HTTPException(status_code=404, detail="content not found")
    # Best-effort view increment (fire and forget)
    try:
        await db.published_content.update_one({"url_slug": slug}, {"$inc": {"views": 1}})
    except Exception:
        pass
    return row


# ── Phase 3 V2: source map (§4.1) ──
@api_router.get("/admin/sources")
async def admin_sources(category: Optional[str] = None, _: bool = Depends(require_admin)):
    return {"sources": await list_sources(db, category=category)}


@api_router.get("/sources/public")
async def public_sources():
    """Public — surfaces on /lehdisto. Returns active named editorial sources."""
    rows = await list_sources(db, category=None)
    # group by category for ergonomic frontend rendering
    grouped: dict = {}
    for r in rows:
        grouped.setdefault(r["category"], []).append({
            "key": r["key"], "name": r["name"], "url": r["url"],
            "tier": r.get("tier"), "note": r.get("note"),
        })
    return {"by_category": grouped, "total": len(rows)}


# ── Phase 3 V2: foundational research store ──
class FoundationalResearchPayload(BaseModel):
    id: Optional[str] = None
    topic_area: str
    beat: str
    sub_beat: Optional[str] = None
    editorial_angle: Optional[str] = ""
    key_facts: List[dict] = Field(default_factory=list)
    named_sources_cited: List[str] = Field(default_factory=list)
    applicable_content_types: List[str] = Field(default_factory=list)
    freshness_window_days: int = 90
    active: bool = True


@api_router.get("/admin/foundational-research")
async def admin_list_foundational(
    beat: Optional[str] = None,
    content_type: Optional[str] = None,
    limit: int = 200,
    _: bool = Depends(require_admin),
):
    rows = await list_foundational_entries(db, beat=beat, content_type=content_type, active_only=False, limit=limit)
    return {
        "entries": rows,
        "stats": await foundational_research_stats(db),
        "valid_beats": sorted(VALID_BEATS),
        "content_type_to_beats": CONTENT_TYPE_TO_BEATS,
    }


@api_router.get("/admin/foundational-research/{entry_id}")
async def admin_get_foundational(entry_id: str, _: bool = Depends(require_admin)):
    doc = await get_foundational_entry(db, entry_id)
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api_router.put("/admin/foundational-research/{entry_id}")
async def admin_upsert_foundational(
    entry_id: str, data: FoundationalResearchPayload, _: bool = Depends(require_admin),
):
    entry = data.dict()
    entry["id"] = entry_id
    return await upsert_foundational_entry(db, entry, updated_by="admin")


@api_router.post("/admin/foundational-research")
async def admin_create_foundational(data: FoundationalResearchPayload, _: bool = Depends(require_admin)):
    entry = data.dict()
    return await upsert_foundational_entry(db, entry, updated_by="admin")


@api_router.delete("/admin/foundational-research/{entry_id}")
async def admin_delete_foundational(entry_id: str, _: bool = Depends(require_admin)):
    ok = await delete_foundational_entry(db, entry_id)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"deleted": entry_id}


class BulkResearchPayload(BaseModel):
    entries: List[FoundationalResearchPayload]


@api_router.post("/admin/foundational-research/bulk")
async def admin_bulk_foundational(data: BulkResearchPayload, _: bool = Depends(require_admin)):
    """Bulk import — used by CSV/JSON drops from /back-office/foundational-research."""
    out = []
    for e in data.entries:
        out.append(await upsert_foundational_entry(db, e.dict(), updated_by="admin_bulk"))
    return {"imported": len(out), "entries": out}


# ── Phase 3 V2: editorial seed scheduler ──
class CadencesPayload(BaseModel):
    cadences: List[dict]


@api_router.get("/admin/scheduler/cadences")
async def admin_get_cadences(_: bool = Depends(require_admin)):
    return {"cadences": await get_scheduler_cadences(db)}


@api_router.put("/admin/scheduler/cadences")
async def admin_set_cadences(data: CadencesPayload, _: bool = Depends(require_admin)):
    return {"cadences": await set_scheduler_cadences(db, data.cadences)}


@api_router.get("/admin/scheduler/status")
async def admin_scheduler_status(_: bool = Depends(require_admin)):
    return await scheduler_schedule_status(db)


@api_router.post("/admin/scheduler/tick")
async def admin_scheduler_tick(
    force_content_type: Optional[str] = None,
    _: bool = Depends(require_admin),
):
    """Force-fire the scheduler now. With `force_content_type` set, bypass the
    weekday/min-gap check for that single content type."""
    return await run_scheduler_tick(db, force_content_type=force_content_type)


@api_router.post("/admin/scheduler/fill-variants")
async def admin_fill_variants(max_per_tick: int = 5, _: bool = Depends(require_admin)):
    return await run_variant_filler(db, max_per_tick=max_per_tick)


# ── Phase 3 V2 Step 1: Operators + Streamers registries ──
class OperatorPayload(BaseModel):
    name: str
    logo: Optional[str] = ""
    score: Optional[int] = 0
    oneLiner: Optional[str] = ""
    offer: Optional[str] = ""
    payout: Optional[str] = ""
    license: Optional[str] = ""
    trustpilot: Optional[float] = None
    year: Optional[int] = None
    partner: bool = False
    active: bool = True
    market_id: str = "FI"


class StreamerPayload(BaseModel):
    name: str
    platform: str
    channel: str
    tier: int = 2
    scene: str = "finnish"  # finnish | intl_global | intl_swedish | intl_dutch | intl_norwegian
    origin: Optional[str] = None
    photo: Optional[str] = ""
    followers: Optional[str] = ""
    sub: Optional[str] = None
    active: bool = True
    market_id: str = "FI"


@api_router.get("/operators")
async def public_list_operators(partner_only: bool = False, market_id: Optional[str] = None):
    return {"operators": await list_operators(db, partner_only=partner_only, market_id=market_id)}


@api_router.get("/operators/{slug}")
async def public_get_operator(slug: str):
    op = await get_operator(db, slug)
    if not op:
        raise HTTPException(404, "Not found")
    return op


@api_router.get("/streamers")
async def public_list_streamers(scene: Optional[str] = None, market: Optional[str] = None, market_id: Optional[str] = None):
    """Public — list streamers. `market` filter: 'fi' or 'intl' (convenience)."""
    return {
        "streamers": await list_streamers(db, scene=scene, market=market, market_id=market_id),
        "intl_scenes": INTL_SCENES_META,
    }


@api_router.get("/streamers/{slug}")
async def public_get_streamer(slug: str):
    s = await get_streamer(db, slug)
    if not s:
        raise HTTPException(404, "Not found")
    return s


@api_router.get("/admin/operators")
async def admin_list_operators(_: bool = Depends(require_admin)):
    return {"operators": await list_operators(db, active_only=False)}


@api_router.put("/admin/operators/{slug}")
async def admin_upsert_operator(slug: str, data: OperatorPayload, _: bool = Depends(require_admin)):
    return await upsert_operator(db, slug, data.dict(), updated_by="admin")


@api_router.delete("/admin/operators/{slug}")
async def admin_delete_operator(slug: str, _: bool = Depends(require_admin)):
    ok = await delete_operator(db, slug)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"deleted": slug}


@api_router.get("/admin/streamers")
async def admin_list_streamers(_: bool = Depends(require_admin)):
    return {"streamers": await list_streamers(db, active_only=False)}


@api_router.put("/admin/streamers/{slug}")
async def admin_upsert_streamer(slug: str, data: StreamerPayload, _: bool = Depends(require_admin)):
    return await upsert_streamer(db, slug, data.dict(), updated_by="admin")


@api_router.delete("/admin/streamers/{slug}")
async def admin_delete_streamer(slug: str, _: bool = Depends(require_admin)):
    ok = await delete_streamer(db, slug)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"deleted": slug}


# ── Phase 3 V2 Step 1+3 fold: Voyager rotation calendar ──
class VoyagerWeekPayload(BaseModel):
    iso_week: str                                  # "YYYY-Www"
    market_id: str = "FI"
    partner_operator_slug: Optional[str] = None
    theme: Optional[str] = ""
    prize_summary: Optional[str] = ""
    smartico_template_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "planned"


@api_router.get("/voyager/current-week")
async def public_current_voyager_week(market_id: str = "FI"):
    """Public — what's this week's Voyager? Powers hub `Tämän viikon peli` card."""
    week = await rotation_get_current(db, market_id=market_id)
    if not week:
        return {"week": None, "iso_week": current_iso_week(), "market_id": market_id}
    return {"week": week, "iso_week": week["iso_week"], "market_id": market_id}


@api_router.get("/voyager/weeks")
async def public_voyager_weeks(market_id: str = "FI", upcoming_only: bool = True, limit: int = 12):
    """Public — for the /voita-palkinto/arkisto/* surface and editor planning views."""
    return {"weeks": await rotation_list(db, market_id=market_id, upcoming_only=upcoming_only, limit=limit)}


@api_router.get("/admin/voyager/weeks")
async def admin_list_voyager_weeks(market_id: str = "FI", _: bool = Depends(require_admin)):
    weeks = await rotation_list(db, market_id=market_id, limit=500)
    return {
        "weeks": weeks,
        "stats": await rotation_stats(db, market_id=market_id),
        "current_iso_week": current_iso_week(),
        "next_iso_weeks": next_iso_weeks(12),
    }


@api_router.put("/admin/voyager/weeks/{iso_week}")
async def admin_upsert_voyager_week(iso_week: str, data: VoyagerWeekPayload, _: bool = Depends(require_admin)):
    payload = data.dict()
    payload["iso_week"] = iso_week
    try:
        return await rotation_upsert(db, payload, updated_by="admin")
    except ValueError as e:
        raise HTTPException(400, str(e))


@api_router.delete("/admin/voyager/weeks/{iso_week}")
async def admin_delete_voyager_week(iso_week: str, market_id: str = "FI", _: bool = Depends(require_admin)):
    ok = await rotation_delete(db, iso_week, market_id=market_id)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"deleted": iso_week, "market_id": market_id}


# ── Step 4: Live-feed aggregation ─────────────────────────────────────────
@api_router.get("/feed")
async def public_feed(
    source: Optional[str] = None,
    kind: Optional[str] = None,
    market_id: str = FEED_DEFAULT_MARKET,
    limit: int = 12,
):
    """Public hub feed. Mocked signals are excluded — endpoint will return
    [] until real Twitch/Kick/YouTube API keys are supplied. Editorial drops
    are always real (sourced from published_content)."""
    items = await list_feed(db, source=source, kind=kind, market_id=market_id, limit=limit, include_mocked=False)
    return {"items": items, "count": len(items), "market_id": market_id}


@api_router.get("/admin/feed")
async def admin_feed(
    source: Optional[str] = None,
    kind: Optional[str] = None,
    market_id: str = FEED_DEFAULT_MARKET,
    limit: int = 50,
    include_mocked: bool = True,
    _: bool = Depends(require_admin),
):
    items = await list_feed(db, source=source, kind=kind, market_id=market_id, limit=limit, include_mocked=include_mocked)
    return {"items": items, "count": len(items), "market_id": market_id, "include_mocked": include_mocked}


@api_router.get("/feed/stats")
async def public_feed_stats(market_id: str = FEED_DEFAULT_MARKET):
    return await feed_stats(db, market_id=market_id)


@api_router.post("/admin/feed/rebuild")
async def admin_feed_rebuild(market_id: str = FEED_DEFAULT_MARKET, _: bool = Depends(require_admin)):
    return await rebuild_feed(db, market_id=market_id)


@app.on_event("startup")
async def _seed_phase3():
    try:
        await seed_default_guidelines(db)
    except Exception:
        logger.exception("Failed to seed editorial guidelines")
    try:
        await seed_tracked_sources(db)
    except Exception:
        logger.exception("Failed to seed tracked sources")
    try:
        await seed_operators(db)
        await seed_streamers(db)
    except Exception:
        logger.exception("Failed to seed editorial rosters")
    try:
        result = await seed_foundational_research(db)
        logger.info("Foundational research seed: %s", result)
    except Exception:
        logger.exception("Failed to seed foundational research")
    try:
        await seed_default_cadences(db)
    except Exception:
        logger.exception("Failed to seed editorial cadences")
    try:
        from webhooks import _ensure_replay_index
        await _ensure_replay_index(db)
    except Exception:
        logger.exception("Failed to create webhook replay TTL index")
    try:
        await feed_ensure_indexes(db)
    except Exception:
        logger.exception("Failed to create feed_items indexes")
    try:
        await layer2_ensure_indexes(db)
    except Exception:
        logger.exception("Failed to create Layer 2 indexes")
    try:
        result = await seed_editorial_subjects(db)
        logger.info("Editorial subjects seed: %s", result)
    except Exception:
        logger.exception("Failed to seed editorial subjects")
    try:
        await content_ensure_indexes(db)
    except Exception:
        logger.exception("Failed to create content_drafts indexes")
    try:
        from streamer_alerts import ensure_indexes as alerts_ensure_indexes
        await alerts_ensure_indexes(db)
    except Exception:
        logger.exception("Failed to create streamer_alerts indexes")
    # Bind a process-wide ContentGenerator for the Layer 2 hook to use.
    global _content_generator
    _content_generator = ContentGenerator(db)
    # Kick off background signal pipeline + dial recalc loop.
    if os.environ.get("PUTKI_HQ_DISABLE_WORKERS", "0") != "1":
        import asyncio as _aio
        _aio.create_task(_signal_dial_worker())
        if os.environ.get("PUTKI_HQ_DISABLE_FEED_WORKER", "0") != "1":
            _aio.create_task(feed_worker_loop(db))
        if os.environ.get("PUTKI_HQ_DISABLE_YT_LEASE_WORKER", "0") != "1":
            from youtube_lease_worker import lease_worker_loop as _yt_lease_loop
            _aio.create_task(_yt_lease_loop(db))
        # Phase 4 Week 1: Layer 2 signal pollers (Twitch/Reddit/NHL/RSS) +
        # dial recalc + SSE fan-out. Each worker tick triggers a dial
        # recompute through the `on_tick` callback so connected SSE clients
        # see updates instantly instead of on the legacy 90s cycle.
        await start_layer2_workers(db, on_tick=_layer2_on_tick)
        if os.environ.get("PUTKI_HQ_DISABLE_AUTO_DISCOVERY", "0") != "1":
            from twitch_discovery import discovery_worker_loop as _disc_loop
            _aio.create_task(_disc_loop(db))
    # Kick off editorial seed scheduler + variant filler.
    if os.environ.get("PUTKI_HQ_DISABLE_SCHEDULER", "0") != "1":
        import asyncio as _aio
        _aio.create_task(scheduler_worker_loop(db))
        _aio.create_task(variant_filler_worker_loop(db))


_content_generator: Optional[ContentGenerator] = None


async def _layer2_on_tick(worker_name: str, result: Any) -> None:
    """Layer 2 worker hook — recompute dial + broadcast to SSE subscribers,
    then fan out signal items to the ContentGenerator for the Week 2
    automated editorial system."""
    try:
        snap = await recalculate_dial(db)
        await dial_sse.publish(snap)
    except Exception:
        logger.exception("Dial recompute after layer2.%s tick failed", worker_name)

    if _content_generator and os.environ.get("PUTKI_HQ_DISABLE_CONTENT_GENERATOR", "0") != "1":
        try:
            fan_out_result = await content_fan_out(db, worker_name, _content_generator)
            if fan_out_result.get("generated", 0) > 0 or fan_out_result.get("errors", 0) > 0:
                logger.info("ContentGenerator fan-out after layer2.%s: %s", worker_name, fan_out_result)
        except Exception:
            logger.exception("ContentGenerator fan-out after layer2.%s failed", worker_name)


async def _signal_dial_worker():
    """Legacy 6-signal poller — retained for back-compat with `signals`
    collection (admin /api/admin/signals/poll, regression tests). The new
    Layer 2 workers drive the dial; this loop now only refreshes the legacy
    signals collection without overwriting dial snapshots.
    Disabled by setting PUTKI_HQ_DISABLE_WORKERS=1 (used in unit tests)."""
    import asyncio as _aio
    await _aio.sleep(5)
    while True:
        try:
            await poll_all_sources(db)
        except Exception:
            logger.exception("Legacy signal worker tick failed")
        await _aio.sleep(POLL_INTERVAL_SECONDS)


app.include_router(api_router)

# Phase 4 Pre-Launch Polish — serve Nano Banana-generated OG images.
# StaticFiles is mounted under /api/static so the existing K8s ingress
# rule that routes /api/* to the backend pod handles social-card lookups
# without extra config.
from fastapi.staticfiles import StaticFiles
from pathlib import Path as _StaticPath
_static_dir = _StaticPath(__file__).parent / "static"
_static_dir.mkdir(parents=True, exist_ok=True)
(_static_dir / "og").mkdir(parents=True, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=str(_static_dir)), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
