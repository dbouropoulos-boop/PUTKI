from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone


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

api_router.include_router(build_webhook_router(db))

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


@api_router.get("/dial/history")
async def public_dial_history(limit: int = 48):
    """Public — last N dial snapshots for the home mini-chart."""
    limit = max(1, min(200, limit))
    return {"history": await dial_history(db, limit=limit)}


@api_router.get("/admin/dial/history")
async def admin_dial_history(limit: int = 60, _: bool = Depends(require_admin)):
    return {"history": await dial_history(db, limit=limit)}


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
    # Kick off background signal pipeline + dial recalc loop.
    if os.environ.get("PUTKI_HQ_DISABLE_WORKERS", "0") != "1":
        import asyncio as _aio
        _aio.create_task(_signal_dial_worker())
        if os.environ.get("PUTKI_HQ_DISABLE_FEED_WORKER", "0") != "1":
            _aio.create_task(feed_worker_loop(db))
    # Kick off editorial seed scheduler + variant filler.
    if os.environ.get("PUTKI_HQ_DISABLE_SCHEDULER", "0") != "1":
        import asyncio as _aio
        _aio.create_task(scheduler_worker_loop(db))
        _aio.create_task(variant_filler_worker_loop(db))


async def _signal_dial_worker():
    """Background loop: poll all signal sources, recompute dial, sleep.
    Disabled by setting PUTKI_HQ_DISABLE_WORKERS=1 (used in unit tests)."""
    import asyncio as _aio
    # Wait a beat so the app finishes booting before the first poll.
    await _aio.sleep(5)
    while True:
        try:
            await poll_all_sources(db)
            await recalculate_dial(db)
        except Exception:
            logger.exception("Signal/dial worker tick failed")
        await _aio.sleep(POLL_INTERVAL_SECONDS)


app.include_router(api_router)

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
