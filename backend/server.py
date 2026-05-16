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
    expected = os.environ.get('BACK_OFFICE_TOKEN', 'mittari-admin')
    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=401, detail='Invalid admin token')
    return True


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Mittari.fi API — Phase 1")
api_router = APIRouter(prefix="/api")


# ---------- MOCK CONTENT MODELS & DATA (Phase 1) ----------

DIAL_STATES = {
    "KYLMA":       {"key": "KYLMA",       "label": "KYLMÄ",       "color": "#2C5F8D", "value": 12, "headline": "Mittari on KYLMÄ. Skene nukkuu."},
    "HAALEA":      {"key": "HAALEA",      "label": "HAALEA",      "color": "#7A7E83", "value": 38, "headline": "Mittari on HAALEA. Tasaista taustakohinaa."},
    "KUUMA":       {"key": "KUUMA",       "label": "KUUMA",       "color": "#E8924A", "value": 64, "headline": "Mittari on KUUMA. Slot-skene lämpenee illaksi."},
    "MYRSKY":      {"key": "MYRSKY",      "label": "MYRSKY",      "color": "#C8423C", "value": 82, "headline": "Mittari on MYRSKY. Striimit täynnä, klippejä syntyy."},
    "KIIRASTULI":  {"key": "KIIRASTULI",  "label": "KIIRASTULI",  "color": "#8B1E1A", "value": 96, "headline": "Mittari on KIIRASTULI. Älä katso pois."},
}

CURRENT_STATE_KEY = "KUUMA"


# ---------- ENDPOINTS ----------

@api_router.get("/")
async def root():
    return {"service": "Mittari.fi API", "phase": 1, "status": "ok"}


@api_router.get("/dial")
async def get_dial():
    """Current Mittari state."""
    state = DIAL_STATES[CURRENT_STATE_KEY]
    return {
        "state": state,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "context": {
            "live_streamers": 7,
            "total_viewers": 19_590,
            "active_signals": ["finnish-prime-time", "ylilauta-volume-high", "liiga-friday"],
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


SETTINGS_KEY = "site"


async def _get_settings_doc():
    doc = await db.settings.find_one({"_id": SETTINGS_KEY}) or {}
    return {
        "telegram_channel": doc.get("telegram_channel"),
        "smartico_template_id": doc.get("smartico_template_id"),
        "updated_at": doc.get("updated_at"),
    }


@api_router.get("/settings/public")
async def get_public_settings():
    """Public — only safe-to-expose settings."""
    s = await _get_settings_doc()
    return {
        "telegram_channel": s.get("telegram_channel"),
        "smartico_template_id": s.get("smartico_template_id"),
    }


@api_router.get("/admin/settings")
async def admin_get_settings(_: bool = Depends(require_admin)):
    return await _get_settings_doc()


@api_router.put("/admin/settings")
async def admin_update_settings(data: SettingsPayload, _: bool = Depends(require_admin)):
    update = {
        "telegram_channel": data.telegram_channel,
        "smartico_template_id": data.smartico_template_id,
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
