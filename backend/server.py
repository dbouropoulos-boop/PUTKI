from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone, timedelta


async def require_admin(request: Request,
                         x_admin_token: Optional[str] = Header(None, alias='X-Admin-Token')):
    """iter62: per-user admin tokens + audit logging.

    Resolves the X-Admin-Token via the `admin_users` collection. Legacy
    env-based BACK_OFFICE_TOKEN still works (back-compat) - both paths
    return an actor record that handlers can pass to `_audit_log`.

    `_audit_log` is a thin wrapper around `admin_auth.write_audit` that
    pulls actor metadata from `request.state` (populated here)."""
    from admin_auth import resolve_admin_token
    if not x_admin_token:
        raise HTTPException(status_code=401, detail='Missing admin token')
    actor = await resolve_admin_token(db, x_admin_token)
    if not actor:
        raise HTTPException(status_code=401, detail='Invalid admin token')
    # Stash on the request so endpoints can use it without re-resolving.
    request.state.admin_actor = actor
    return True


async def _audit_log(db_arg, *, action: str, resource: str,
                      actor: str = "unknown", role: str = "editor",
                      meta: Optional[Dict[str, Any]] = None,
                      ip: Optional[str] = None) -> None:
    """Thin convenience wrapper for legacy callers that don't have the
    Request handy. Most handlers should pull `request.state.admin_actor`
    and log explicitly via `admin_auth.write_audit`."""
    from admin_auth import write_audit
    await write_audit(db_arg, actor=actor, role=role, action=action,
                       resource=resource, meta=meta, ip=ip)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="PUTKI HQ API - Phase 1")
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
    """Current Mittari state - sourced from latest dial_snapshot if available,
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
            "note": "Ei signaalia vielä - PUTKI HQ:n pollerit eivät ole vielä keränneet dataa.",
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
    """Public - honest live count of newsletter subscribers."""
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
    voita_feature_enabled: Optional[bool] = None
    auto_dispatch_enabled: Optional[bool] = None
    site_tagline_fi: Optional[str] = None
    site_tagline_en: Optional[str] = None
    voita_quiz_config: Optional[List[Dict[str, Any]]] = None
    voita_hero: Optional[Dict[str, Any]] = None
    voita_predictor_profiles: Optional[List[Dict[str, Any]]] = None


SETTINGS_KEY = "site"


# Default editorial copy for /voita hero. Editorial can override any field
# via PUT /api/admin/settings. Image path is served from /hero/voita.jpg
# (frontend public/).
DEFAULT_VOITA_HERO = {
    "eyebrow_fi": "VOITA · 75-SEKUNNIN DIAGNOSTIIKKA",
    "eyebrow_en": "VOITA · 75-SECOND DIAGNOSTIC",
    "title_fi": "Veikkaa fiksummin. 5 kysymystä, ennustus, ja koko playbook sähköpostiisi.",
    "title_en": "Bet smarter. 5 questions, one prediction, and the full playbook in your inbox.",
    "subtitle_fi": "Diagnostiikka kertoo ennustajatyyppisi. Ennustus arvonnasta on osa testiä. Sähköpostiisi tulee henkilökohtainen raportti + 5 päivän playbook.",
    "subtitle_en": "The diagnostic names your predictor type. Your raffle prediction is part of the test. Your inbox gets a personal report + 5-day playbook.",
    "image_url": "/hero/voita.jpg",
    "photo_credit": "Photo: Mitch Rosen / Unsplash",
}


def _sanitize_voita_hero(payload: Any) -> Dict[str, Any]:
    """Clamp + sanitize admin-edited hero copy. Falls back to defaults
    field-by-field so a partial save doesn't blank the banner."""
    if not isinstance(payload, dict):
        return DEFAULT_VOITA_HERO
    out = dict(DEFAULT_VOITA_HERO)
    for key, maxlen in (
        ("eyebrow_fi", 80), ("eyebrow_en", 80),
        ("title_fi", 200), ("title_en", 200),
        ("subtitle_fi", 320), ("subtitle_en", 320),
        ("image_url", 400), ("photo_credit", 120),
    ):
        v = payload.get(key)
        if v is not None:
            out[key] = str(v).strip()[:maxlen]
    return out


async def _get_settings_doc():
    doc = await db.settings.find_one({"_id": SETTINGS_KEY}) or {}
    return {
        "telegram_channel": doc.get("telegram_channel"),
        "smartico_template_id": doc.get("smartico_template_id"),
        "smartico_loader_url": doc.get("smartico_loader_url"),
        "smartico_brand_key": doc.get("smartico_brand_key"),
        "voita_feature_enabled": bool(doc.get("voita_feature_enabled", False)),
        "auto_dispatch_enabled": bool(doc.get("auto_dispatch_enabled", False)),
        # Editable tagline - renders under the header logo and as the
        # lead line of the homepage manifesto. Editorial can A/B test
        # without dev cycles. Defaults match the brief.
        "site_tagline_fi": doc.get("site_tagline_fi") or "Missä Suomen rahapeliskene näkyy",
        "site_tagline_en": doc.get("site_tagline_en") or "Where Finland's gambling scene shows up",
        "voita_quiz_config": doc.get("voita_quiz_config"),
        "voita_hero": _sanitize_voita_hero(doc.get("voita_hero") or DEFAULT_VOITA_HERO),
        "voita_predictor_profiles": doc.get("voita_predictor_profiles"),
        "updated_at": doc.get("updated_at"),
    }


@api_router.get("/settings/public")
async def get_public_settings():
    """Public - only safe-to-expose settings."""
    from voita_quiz_config import DEFAULT_VOITA_QUIZ, sanitize_quiz_config
    from voita_profiles import DEFAULT_PROFILES, sanitize_profiles
    s = await _get_settings_doc()
    return {
        "telegram_channel": s.get("telegram_channel"),
        "smartico_template_id": s.get("smartico_template_id"),
        "smartico_loader_url": s.get("smartico_loader_url"),
        "smartico_brand_key": s.get("smartico_brand_key"),
        "voita_feature_enabled": s.get("voita_feature_enabled", False),
        "site_tagline_fi": s.get("site_tagline_fi"),
        "site_tagline_en": s.get("site_tagline_en"),
        "voita_quiz_config": sanitize_quiz_config(s.get("voita_quiz_config") or DEFAULT_VOITA_QUIZ),
        "voita_hero": s.get("voita_hero") or DEFAULT_VOITA_HERO,
        "voita_predictor_profiles": sanitize_profiles(s.get("voita_predictor_profiles") or DEFAULT_PROFILES),
    }


@api_router.get("/admin/settings")
async def admin_get_settings(_: bool = Depends(require_admin)):
    return await _get_settings_doc()


@api_router.put("/admin/settings")
async def admin_update_settings(data: SettingsPayload, _: bool = Depends(require_admin)):
    update: Dict[str, Any] = {
        "telegram_channel": data.telegram_channel,
        "smartico_template_id": data.smartico_template_id,
        "smartico_loader_url": data.smartico_loader_url,
        "smartico_brand_key": data.smartico_brand_key,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # voita_feature_enabled is opt-in: only set when explicitly passed.
    if data.voita_feature_enabled is not None:
        update["voita_feature_enabled"] = bool(data.voita_feature_enabled)
    # auto_dispatch_enabled is the back-office kill switch for the 10:00
    # Helsinki cycle. Default false. When true, worker fires LIVE (real
    # creds where available, falls back to dry_run per channel).
    if data.auto_dispatch_enabled is not None:
        update["auto_dispatch_enabled"] = bool(data.auto_dispatch_enabled)
    # Tagline - editorial copy, free-text, length-capped to avoid abuse.
    if data.site_tagline_fi is not None:
        update["site_tagline_fi"] = (data.site_tagline_fi or "").strip()[:120]
    if data.site_tagline_en is not None:
        update["site_tagline_en"] = (data.site_tagline_en or "").strip()[:120]
    if data.voita_quiz_config is not None:
        from voita_quiz_config import sanitize_quiz_config
        try:
            update["voita_quiz_config"] = sanitize_quiz_config(data.voita_quiz_config)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    if data.voita_hero is not None:
        update["voita_hero"] = _sanitize_voita_hero(data.voita_hero)
    if data.voita_predictor_profiles is not None:
        from voita_profiles import sanitize_profiles
        try:
            update["voita_predictor_profiles"] = sanitize_profiles(data.voita_predictor_profiles)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    await db.settings.update_one(
        {"_id": SETTINGS_KEY},
        {"$set": update},
        upsert=True,
    )
    return await _get_settings_doc()


# ── Phase 1 Final · Chunk B - ProgressiveOptIn capture endpoint ──

OPTIN_CHANNELS = {"email", "sms", "telegram"}
OPTIN_SURFACES = {"mittari", "pelisignaalit", "voita", "peli", "homepage", "voita_landing"}


class OptinPayload(BaseModel):
    """ProgressiveOptIn 3-step funnel capture.

    Channel ↔ purpose split (per user spec):
      - email    = sentiment digest (slow channel - Mittari + skene tunnelma)
      - sms      = daily bets       (fast channel - Sharpness 75+ signals)
      - telegram = daily bets       (fast channel - same content, different inbox)

    Each captured row records a distinct consent tag like `email_sentiment`,
    `sms_alerts`, `telegram_alerts`. Idempotent per (channel, surface, identifier):
    re-submitting the same row updates `last_seen_at` instead of duplicating.
    """
    channel: str = Field(..., description="email | sms | telegram")
    surface: str = Field(..., description="mittari | pelisignaalit | voita | peli | homepage")
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=32)
    telegram_username: Optional[str] = Field(default=None, max_length=64)
    consent_tag: Optional[str] = Field(default=None, max_length=64)


# ── Voita lead capture (quiz answers + email before raffle play) ────────
# Captures qualifying data BEFORE the raffle form. Even if the visitor
# bounces at the raffle step we keep the email + quiz answers. Single
# consent tag (`voita_lead`) - distinct from the raffle entry itself
# (which uses `game_raffle`) and distinct from marketing consent.

# PUTKI-wide lead sources. Each surface tags its capture so the drip
# worker can fan out the correct sequence (Mestari 5-day playbook,
# Voita post-entry recap, Mittari onboarding, etc.).
_PUTKI_LEAD_SOURCES = {"mestari", "voita", "mittari", "peli_voyager"}


class _VoitaLeadPayload(BaseModel):
    email: EmailStr
    raffle_slug: Optional[str] = Field(default=None, max_length=120)
    age_18_plus: bool
    favorite_sport: Optional[str] = Field(default=None, max_length=32)
    bet_frequency: Optional[str] = Field(default=None, max_length=32)
    sportsbooks: Optional[List[str]] = None
    confidence: Optional[str] = Field(default=None, max_length=32)
    quiz_tags: Optional[Dict[str, str]] = None
    display_name: Optional[str] = Field(default=None, max_length=80)
    lang: Optional[str] = Field(default=None, max_length=4)
    source: Optional[str] = Field(default=None, max_length=32)


@api_router.post("/voita/lead")
async def voita_capture_lead(payload: _VoitaLeadPayload):
    if not payload.age_18_plus:
        raise HTTPException(status_code=400, detail="must_be_18_plus")
    email = str(payload.email).lower().strip()
    now = datetime.now(timezone.utc).isoformat()
    source = (payload.source or "voita").strip().lower()[:32]
    if source not in _PUTKI_LEAD_SOURCES:
        source = "voita"
    # Per-surface mapping → which consent tag + surface label to store.
    # Mestari is the standalone diagnostic; voita_landing is the raffle entry.
    if source == "mestari":
        surface, consent_tag = "mestari_landing", "mestari_lead"
    elif source == "mittari":
        surface, consent_tag = "mittari_landing", "mittari_lead"
    else:
        surface, consent_tag = "voita_landing", "voita_lead"
    quiz = {
        "favorite_sport": (payload.favorite_sport or "").strip().lower()[:32] or None,
        "bet_frequency": (payload.bet_frequency or "").strip().lower()[:32] or None,
        "sportsbooks": [
            s.strip().lower()[:32] for s in (payload.sportsbooks or [])
            if s and isinstance(s, str)
        ][:8] or None,
        "confidence": (payload.confidence or "").strip().lower()[:32] or None,
        "captured_at": now,
        "raffle_slug": payload.raffle_slug,
        "tags": payload.quiz_tags or None,
    }
    await db.optin_consents.update_one(
        {"channel": "email", "surface": surface, "identifier": email},
        {
            "$set": {
                "channel": "email",
                "surface": surface,
                "identifier": email,
                "consent_tag": consent_tag,
                "source": source,
                "email": email,
                "last_seen_at": now,
                "voita_quiz": quiz,
                "lang": (payload.lang or "").strip().lower()[:4] or None,
                "display_name": (payload.display_name or "").strip()[:80] or None,
            },
            "$setOnInsert": {"created_at": now, "first_source": source},
        },
        upsert=True,
    )
    return {"ok": True, "consent_tag": consent_tag, "source": source}


@api_router.post("/optin")
async def public_optin(payload: OptinPayload):
    ch = (payload.channel or "").strip().lower()
    sf = (payload.surface or "").strip().lower()
    if ch not in OPTIN_CHANNELS:
        raise HTTPException(status_code=400, detail=f"unknown channel '{ch}'")
    if sf not in OPTIN_SURFACES:
        raise HTTPException(status_code=400, detail=f"unknown surface '{sf}'")

    # identifier per channel
    if ch == "email":
        if not payload.email:
            raise HTTPException(status_code=400, detail="email required for email channel")
        identifier = str(payload.email).lower()
    elif ch == "sms":
        if not payload.phone:
            raise HTTPException(status_code=400, detail="phone required for sms channel")
        identifier = (payload.phone or "").strip()
    else:  # telegram
        if not payload.telegram_username:
            raise HTTPException(status_code=400, detail="telegram_username required for telegram channel")
        identifier = (payload.telegram_username or "").strip().lstrip("@").lower()

    if not identifier:
        raise HTTPException(status_code=400, detail="identifier missing")

    # Consent tag default: {channel}_{purpose} where purpose is `alerts` for
    # sms+telegram (fast time-critical channels), `sentiment` for email (slow
    # context channel). Caller may override (e.g. surface-specific tags).
    default_tag = "email_sentiment" if ch == "email" else f"{ch}_alerts"
    tag = (payload.consent_tag or default_tag).strip().lower()[:64]

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "channel": ch,
        "surface": sf,
        "identifier": identifier,
        "consent_tag": tag,
        "email": str(payload.email).lower() if payload.email else None,
        "phone": payload.phone,
        "telegram_username": payload.telegram_username,
        "last_seen_at": now,
    }
    res = await db.optin_consents.update_one(
        {"channel": ch, "surface": sf, "identifier": identifier},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {
        "ok": True,
        "channel": ch,
        "surface": sf,
        "consent_tag": tag,
        "new_record": bool(res.upserted_id),
    }


@api_router.get("/admin/optin/stats")
async def admin_optin_stats(_: bool = Depends(require_admin)):
    """Per channel × surface counts. Useful for the back-office overview."""
    pipeline = [
        {"$group": {
            "_id": {"channel": "$channel", "surface": "$surface", "tag": "$consent_tag"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
    ]
    rows = []
    async for r in db.optin_consents.aggregate(pipeline):
        # Legacy / partial documents may be missing channel / surface;
        # surface them as empty strings rather than 500-ing the whole
        # endpoint.
        key = r.get("_id") or {}
        rows.append({
            "channel": key.get("channel") or "",
            "surface": key.get("surface") or "",
            "consent_tag": key.get("tag") or "",
            "count": r.get("count") or 0,
        })
    total = await db.optin_consents.count_documents({})
    return {"by_segment": rows, "total": total}


# ── Public subscriber-count surface (3,000-gating) ───────────────────────
# Returns a public dict {consent_tag: count} so the FE can decide whether
# to surface "N subscribers" social proof or fall back to operational
# facts. Counts are exact - no rounding, no fabrication. Only consent
# tags that exist in `optin_consents` show up.
@api_router.get("/public/subscriber-counts")
async def public_subscriber_counts():
    pipeline = [
        {"$group": {"_id": "$consent_tag", "count": {"$sum": 1}}},
    ]
    out: Dict[str, int] = {}
    async for r in db.optin_consents.aggregate(pipeline):
        if r.get("_id"):
            out[str(r["_id"])] = int(r.get("count") or 0)
    return {"counts": out}


# ── Operational social-proof palette (defensible, always-on facts) ──────
# Six slot-types: news-aggregated-today, streamers-tracked, mittari-days-live,
# voita-paid-eur, voyager-rounds, pelisignaalit-track-record. All numbers
# pulled live from existing collections. Returned in a single payload so the
# FE can fan them out across product pages without N round-trips.
@api_router.get("/public/ops-facts")
async def public_ops_facts():
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    facts: Dict[str, Any] = {}

    # Stories aggregated today (news_ticker_items, last 24h)
    try:
        facts["stories_today"] = await db.news_ticker_items.count_documents(
            {"captured_at": {"$gte": day_ago.isoformat()}},
        )
    except Exception:
        facts["stories_today"] = 0

    # Streamers tracked (distinct streamer_id in streamer_state)
    try:
        cur = db.streamer_state.distinct("streamer_id")
        ids = await cur
        facts["streamers_tracked"] = len([x for x in ids if x])
    except Exception:
        facts["streamers_tracked"] = 0

    # Mittari: days live + state changes tracked total
    try:
        oldest = await db.dial_snapshots.find_one({}, {"_id": 0, "ts": 1}, sort=[("ts", 1)])
        if oldest and oldest.get("ts"):
            try:
                first = datetime.fromisoformat(str(oldest["ts"]).replace("Z", "+00:00"))
                facts["mittari_days_live"] = max(1, (now - first).days)
            except Exception:
                facts["mittari_days_live"] = 0
        else:
            facts["mittari_days_live"] = 0
        facts["mittari_state_changes_total"] = await db.dial_snapshots.count_documents(
            {"is_transition": True},
        )
    except Exception:
        facts["mittari_days_live"] = 0
        facts["mittari_state_changes_total"] = 0

    # Voita: total EUR paid across paid raffles
    try:
        paid_eur = 0
        async for r in db.voita_raffles.find({"status": "paid"}, {"_id": 0, "prize_distribution": 1}):
            for p in (r.get("prize_distribution") or {}).get("payouts") or []:
                try:
                    paid_eur += int(p.get("amount_eur") or 0)
                except Exception:
                    pass
        facts["voita_eur_paid_total"] = paid_eur
        facts["voita_raffles_paid_count"] = await db.voita_raffles.count_documents({"status": "paid"})
    except Exception:
        facts["voita_eur_paid_total"] = 0
        facts["voita_raffles_paid_count"] = 0

    # Voyager: rounds completed
    try:
        facts["voyager_rounds_total"] = await db.peli_entries.count_documents({})
    except Exception:
        facts["voyager_rounds_total"] = 0

    # Pelisignaalit: top-line track record from sharpness_daily.
    # When <7 docs, suppress (brief: "Suppress when reads <7").
    try:
        n_docs = await db.sharpness_daily.count_documents({})
        if n_docs >= 7:
            # "Held" defined as avg_score>=70 (proxy until signal_outcomes lands).
            held = await db.sharpness_daily.count_documents(
                {"avg_score": {"$gte": 70}},
            )
            facts["pelisignaalit_held_30d"] = {"held": held, "total": min(n_docs, 30)}
        else:
            facts["pelisignaalit_held_30d"] = None
    except Exception:
        facts["pelisignaalit_held_30d"] = None

    return {"facts": facts, "generated_at": now.isoformat()}


# ---------- Game scores (Phase 2.5 - Weezy Rally) ----------

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


# ───────────────── Phase 3 - Content automation engine ─────────────────
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


# ── generate content (admin only - calls Claude) ──
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


# ── public site surface - published content ──
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


# ── live cockpit data - Pääsyy + Viimeisin piikki ──
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
    """Public - honest live signals only. Returns non-mocked streamer/youtube signals
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
    """Pre-launch polish - REAL live streamers across Twitch + Kick + YouTube.

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
    elif p == "kick":
        from multi_platform_live import fetch_kick_live
        d = await fetch_kick_live(db)
    elif p == "youtube":
        from multi_platform_live import fetch_youtube_live
        d = await fetch_youtube_live(db)
    else:
        raise HTTPException(status_code=400, detail="unknown platform")

    # Record viewer-count snapshots for change indicators (24h TTL)
    try:
        from streamer_snapshots import record_snapshot_batch, attach_meta
        items = d.get("streamers") or d.get("items") or []
        if items:
            await record_snapshot_batch(db, platform=p, items=items)
            await attach_meta(db, items, platform=p)
    except Exception:
        logger.exception("snapshot/meta enrichment failed for %s", p)
    return d


# ── Phase 1 sprint follow-up - newsroom-live strip ────────────────────────

@api_router.get("/newsroom/live-stats")
async def public_newsroom_live_stats():
    """Powers the homepage NEWSROOM strip: stories today + named outlets +
    last-publish age + Mittari composite + 24h delta. Refreshes every 30s
    on the frontend."""
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=24)).isoformat()

    stories_today = await db.news_ticker_items.count_documents(
        {"captured_at": {"$gte": since}},
    )
    outlets_cursor = db.news_ticker_items.aggregate([
        {"$match": {"captured_at": {"$gte": since}}},
        {"$group": {"_id": "$source"}},
    ])
    named_outlets = 0
    async for _ in outlets_cursor:
        named_outlets += 1

    latest_doc = await db.news_ticker_items.find_one(
        {}, {"_id": 0, "captured_at": 1}, sort=[("captured_at", -1)],
    )
    last_publish_iso = (latest_doc or {}).get("captured_at")
    last_publish_minutes_ago: Optional[int] = None
    if last_publish_iso:
        try:
            last_dt = datetime.fromisoformat(last_publish_iso.replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            last_publish_minutes_ago = max(0, int((now - last_dt).total_seconds() // 60))
        except Exception:
            pass

    # Mittari composite + delta vs yesterday
    mittari_score: Optional[int] = None
    mittari_delta: Optional[int] = None
    mittari_state: Optional[str] = None
    state_change: Optional[Dict[str, Any]] = None
    try:
        from dial_engine import latest_snapshot
        snap = await latest_snapshot(db)
        if snap:
            mittari_score = int(round(snap.get("composite_score") or 0))
            mittari_state = (snap.get("state") or {}).get("key") or snap.get("state_key")
        # yesterday's snapshot (~24h ago, ±2h window)
        y_lo = (now - timedelta(hours=26))
        y_hi = (now - timedelta(hours=22))
        prev = await db.dial_snapshots.find_one(
            {"computed_at": {"$gte": y_lo.isoformat(), "$lte": y_hi.isoformat()}},
            sort=[("computed_at", -1)], projection={"_id": 0},
        )
        if prev and prev.get("composite_score") is not None:
            mittari_delta = mittari_score - int(round(prev["composite_score"]))
        # state change in last 24h
        evt = await db.dial_state_events.find_one(
            {"changed_at": {"$gte": since}},
            sort=[("changed_at", -1)],
            projection={"_id": 0},
        )
        if evt:
            try:
                changed_dt = datetime.fromisoformat(evt["changed_at"].replace("Z", "+00:00"))
                if changed_dt.tzinfo is None:
                    changed_dt = changed_dt.replace(tzinfo=timezone.utc)
                hours_ago = (now - changed_dt).total_seconds() / 3600
                state_change = {
                    "from_state": evt.get("from_state"),
                    "to_state": evt.get("to_state"),
                    "hours_ago": round(hours_ago, 1),
                }
            except Exception:
                pass
    except Exception:
        logger.exception("Mittari fetch in newsroom stats failed")

    # Alerts dispatched in the last 24h (system-wide signal).
    # Counts both the daily-dispatch sends AND the per-streamer
    # notify_subscribers_of_live writes (via streamer_alerts.last_notified_at).
    alerts_24h = 0
    try:
        alerts_24h += await db.dispatch_log.count_documents(
            {"kind": "send", "sent_at": {"$gte": since}},
        )
        alerts_24h += await db.streamer_alerts.count_documents(
            {"last_notified_at": {"$gte": since}},
        )
    except Exception:
        logger.exception("alerts dispatched count failed")

    return {
        "stories_today": stories_today,
        "named_outlets": named_outlets,
        "last_publish_minutes_ago": last_publish_minutes_ago,
        "mittari_score": mittari_score,
        "mittari_delta": mittari_delta,
        "mittari_state": mittari_state,
        "state_change": state_change,
        "alerts_dispatched_24h": alerts_24h,
        "as_of": now.isoformat(),
    }


@api_router.get("/streamers/recent-alerts")
async def public_streamers_recent_alerts(within_minutes: int = 60):
    """Returns a map of streamer_login -> dispatched count for streamers
    whose subscribers were notified within the last N minutes. Used by
    the homepage band to pulse the bell icon on cards where a real
    notification just fired.

    Honest: only counts published live-notifications via
    `streamer_alerts.last_notified_at`. Daily-pick SMS/Telegram dispatch
    isn't per-streamer so it's excluded here (that's surfaced in the
    newsroom strip's `alerts_dispatched_24h` instead).
    """
    within = max(1, min(int(within_minutes), 1440))
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=within)).isoformat()
    cur = db.streamer_alerts.aggregate([
        {"$match": {"last_notified_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"login": "$streamer_login", "platform": "$platform"},
            "count": {"$sum": 1},
            "latest": {"$max": "$last_notified_at"},
        }},
    ])
    by_streamer: Dict[str, Dict[str, Any]] = {}
    async for r in cur:
        login = (r["_id"]["login"] or "").lower()
        if not login:
            continue
        by_streamer[login] = {
            "platform": r["_id"]["platform"],
            "count": int(r["count"]),
            "latest": r["latest"],
        }
    return {
        "within_minutes": within,
        "by_streamer": by_streamer,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }






# ── Editorial back-office: streamer_meta + slot_registry ──

# NOTE: All /admin/streamer-meta/* endpoints + their payload models
# moved to routes/admin.py (iter68 phase 2).


# NOTE: Slot-registry admin endpoints (5) + their payload models moved
# to routes/admin.py (iter68 phase 3a).




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


# ── Bell-icon alert manager: 6-digit code auth ───────────────────────
#
# Flow:
#   1. POST /api/alerts/streamer/request-code  {email}
#       → generates a 6-digit code, queues email via Resend (or
#         email_outbox when no key). Returns {status, expires_at}.
#   2. POST /api/alerts/streamer/verify-code   {email, code}
#       → returns {token, expires_at} on success. Session lasts 30 days.
#   3. GET    /api/alerts/streamer/subscriptions   (Bearer token)
#       → list every streamer_alerts row for this email.
#   4. DELETE /api/alerts/streamer/subscriptions/{sub_id}  (Bearer token)
#       → remove one subscription.
#   5. POST   /api/alerts/streamer/logout         (Bearer token)
#       → revoke the session token.
# (admin) GET /api/admin/alerts/preview-codes
#       → see codes queued for delivery (preview hatch until Resend lands).

class _CodeRequestIn(BaseModel):
    email: str


class _CodeVerifyIn(BaseModel):
    email: str
    code: str


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip() or None
    return None


@api_router.post("/alerts/streamer/request-code")
async def alerts_request_code(payload: _CodeRequestIn):
    from alert_sessions import request_code
    result = await request_code(db, payload.email)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("reason"))
    return result


@api_router.post("/alerts/streamer/verify-code")
async def alerts_verify_code(payload: _CodeVerifyIn):
    from alert_sessions import verify_code
    result = await verify_code(db, payload.email, payload.code)
    if result.get("status") == "error":
        # 410 for expired so the UI can prompt "request a new code"
        if result.get("reason") == "code_expired_or_unknown":
            raise HTTPException(status_code=410, detail=result.get("reason"))
        raise HTTPException(status_code=400, detail=result.get("reason"))
    return result


@api_router.get("/alerts/streamer/subscriptions")
async def alerts_list_subscriptions(authorization: Optional[str] = Header(None)):
    from alert_sessions import resolve_session, list_subscriptions
    token = _bearer_token(authorization)
    email = await resolve_session(db, token)
    if not email:
        raise HTTPException(status_code=401, detail="unauthorized")
    subs = await list_subscriptions(db, email)
    return {"email": email, "items": subs, "count": len(subs)}


@api_router.delete("/alerts/streamer/subscriptions/{sub_id}")
async def alerts_delete_subscription(sub_id: str, authorization: Optional[str] = Header(None)):
    from alert_sessions import resolve_session, delete_subscription
    token = _bearer_token(authorization)
    email = await resolve_session(db, token)
    if not email:
        raise HTTPException(status_code=401, detail="unauthorized")
    removed = await delete_subscription(db, email, sub_id)
    if not removed:
        raise HTTPException(status_code=404, detail="not_found")
    return {"ok": True, "id": sub_id}


@api_router.post("/alerts/streamer/logout")
async def alerts_logout(authorization: Optional[str] = Header(None)):
    from alert_sessions import revoke_session
    token = _bearer_token(authorization)
    if token:
        await revoke_session(db, token)
    return {"ok": True}


@api_router.get("/admin/alerts/preview-codes")
async def admin_alert_preview_codes(_: bool = Depends(require_admin)):
    """Preview hatch - see queued login codes until Resend is wired.
    Returns the latest 20 alert_login_code emails from `email_outbox`
    with the 6-digit code extracted for easy testing."""
    from alert_sessions import list_pending_codes
    items = await list_pending_codes(db)
    return {"items": items, "count": len(items)}


@api_router.get("/data/live-stats")
async def public_data_live_stats():
    """Homepage ticker - REAL aggregated counters across Layer 2 collections.
    10s cache. Never fabricated; counters that haven't fired yet return 0."""
    from public_stats import get_live_stats
    return await get_live_stats(db)


@api_router.get("/odds/featured")
async def public_odds_featured():
    """Pre-launch polish - REAL betting odds for "Päivän Vitoset" homepage strip.
    Top 5 favourites by implied probability across NHL + select football.
    15 min cache. Dormant=true when ODDS_API_KEY is unset."""
    from odds_api import get_featured_picks
    return await get_featured_picks()


@api_router.get("/mittari/stats")
async def public_mittari_stats():
    """Real subscriber stats for the /mittari social-proof modules.

    Returns: subscribers_count (total leads with mittari_lead tag),
    fresh_24h (leads in the last 24h), and the 4 most recent signups
    anonymised to first-name + channel + iso timestamp. Returns zeroes /
    empty list when no real data exists - front-end is expected to hide
    the social-proof modules in that case rather than show a fake number.
    """
    now = datetime.now(timezone.utc)
    cutoff_24h = (now - timedelta(hours=24)).isoformat()
    base = {"consent_tag": "mittari_lead"}
    total = await db.optin_consents.count_documents(base)
    fresh_24h = await db.optin_consents.count_documents(
        {**base, "created_at": {"$gte": cutoff_24h}}
    )
    cursor = db.optin_consents.find(
        base,
        {"_id": 0, "created_at": 1, "channel": 1, "email": 1,
         "telegram_username": 1, "display_name": 1},
    ).sort([("created_at", -1)]).limit(4)
    rows: List[Dict[str, Any]] = []
    async for d in cursor:
        # Derive a friendly first-name without leaking PII.
        name = (d.get("display_name") or "").strip().split(" ")[0][:24]
        if not name:
            email = (d.get("email") or "").strip()
            if email and "@" in email:
                local = email.split("@", 1)[0]
                chunk = local.split(".")[0].split("_")[0].split("+")[0]
                if chunk and chunk.isascii():
                    name = chunk.capitalize()[:24]
        if not name:
            name = "Tilaaja"
        rows.append({
            "name": name,
            "channel": d.get("channel") or "email",
            "created_at": d.get("created_at"),
        })
    return {
        "subscribers_count": total,
        "fresh_24h": fresh_24h,
        "latest_signups": rows,
    }


@api_router.get("/mittari/copy")
async def public_mittari_copy():
    """Returns the fully-merged Mittari page copy tree. Every field is
    present (admin override layered on top of DEFAULT_MITTARI_COPY)."""
    from mittari_copy import get_mittari_copy
    return await get_mittari_copy(db)


# ── Playbook upload + send queue ───────────────────────────────────────

@api_router.get("/admin/playbook")
async def admin_get_playbook(_: bool = Depends(require_admin)):
    """Returns current playbook metadata + outbox queue summary."""
    from playbook import get_current_playbook, outbox_summary
    return {
        "current": await get_current_playbook(db),
        "outbox": await outbox_summary(db),
    }


@api_router.post("/admin/playbook/upload")
async def admin_upload_playbook(
    file: UploadFile = File(...),
    _: bool = Depends(require_admin),
):
    """Upload a new PDF playbook. PDF only, 5 MB cap. New entries
    automatically get this attachment from the moment upload succeeds."""
    from playbook import save_playbook, ALLOWED_MIME
    data = await file.read()
    ct = file.content_type or ALLOWED_MIME
    try:
        meta = await save_playbook(
            db, data=data, filename=file.filename or "playbook.pdf",
            content_type=ct, uploaded_by="back_office",
        )
        return {"ok": True, "current": meta}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/admin/playbook/download")
async def admin_download_playbook(_: bool = Depends(require_admin)):
    """Stream the current PDF back to the admin for preview."""
    from fastapi.responses import Response
    from playbook import load_playbook_bytes
    bundle = await load_playbook_bytes(db)
    if not bundle:
        raise HTTPException(status_code=404, detail="no_playbook_uploaded")
    return Response(
        content=bundle["data"], media_type=bundle["content_type"],
        headers={
            "Content-Disposition": f'inline; filename="{bundle["filename"]}"',
        },
    )


@api_router.post("/admin/playbook/outbox/{outbox_id}/resend")
async def admin_resend_playbook_email(
    outbox_id: str, _: bool = Depends(require_admin),
):
    from playbook import manual_resend
    ok = await manual_resend(db, outbox_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not_found")
    return {"ok": True}


# ── Email tracking (open pixel + click redirect) ─────────────────────

@api_router.get("/track/o/{token}.gif")
async def track_open_pixel(token: str, request: Request):
    """1×1 transparent GIF that records an email-open event for the
    outbox row matching `token`. Returns the pixel regardless so the
    email client never shows a broken image."""
    from fastapi.responses import Response
    from email_tracking import (
        TRANSPARENT_GIF_1x1, record_open, tracking_enabled,
    )
    if tracking_enabled():
        try:
            ua = request.headers.get("user-agent", "")
            await record_open(db, token, user_agent=ua)
        except Exception:
            logger.exception("track_open_pixel record failed (non-fatal)")
    return Response(
        content=TRANSPARENT_GIF_1x1,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@api_router.get("/track/c/{token}")
async def track_click_redirect(token: str, u: str, request: Request):
    """302-redirects to the decoded target URL after recording the click.
    Refuses anything that doesn't decode to an allowlisted host (so the
    endpoint cannot be weaponised as an open redirect)."""
    from fastapi.responses import RedirectResponse
    from email_tracking import decode_target, record_click, tracking_enabled
    target = decode_target(u)
    if not target:
        raise HTTPException(status_code=400, detail="invalid_target")
    if tracking_enabled():
        try:
            ua = request.headers.get("user-agent", "")
            await record_click(db, token, target, user_agent=ua)
        except Exception:
            logger.exception("track_click_redirect record failed (non-fatal)")
    return RedirectResponse(url=target, status_code=302)



# NOTE: GET / PUT /admin/mittari/copy moved to routes/admin.py (iter68 phase 1).


# ── Mestari multi-diagnostic (poker + blackjack) ─────────────────────
@api_router.get("/mestari/diagnostic/{diagnostic}/meta")
async def public_diagnostic_meta(diagnostic: str):
    """Public - return the question + profile metadata for the named
    diagnostic so the frontend renders the quiz without duplicating
    constants. Sports diagnostic surfaces only its value block (questions
    live in voita_quiz_config)."""
    from mestari_diagnostics import get_diagnostic_meta, get_landing_copy
    meta = get_diagnostic_meta(diagnostic)
    if not meta:
        raise HTTPException(status_code=404, detail="unknown_diagnostic")
    landing = await get_landing_copy(db)
    meta["landing"] = landing.get(diagnostic, {})
    return meta


@api_router.get("/mestari/diagnostic/landing")
async def public_landing_copy():
    """Public - return the editable landing-copy tree (hub + poker +
    blackjack landing text) so the hub renders editable strings."""
    from mestari_diagnostics import get_landing_copy
    return await get_landing_copy(db)


@api_router.get("/mestari/diagnostic/stats")
async def public_diagnostic_stats():
    """Public - lightweight stats strip on the /mestari hub.
    Real numbers from `mestari_diagnostic_leads` (or 0 baseline if
    collection is empty). Profile count is the static union of
    poker + blackjack + sports archetypes so the hub never reads
    'profiles_diagnosed=0' even at cold start."""
    try:
        tests_taken = await db.mestari_diagnostic_leads.count_documents({})
    except Exception:
        tests_taken = 0
    return {
        "tests_taken": tests_taken,
        "profiles_diagnosed": 9,  # 4 poker + 4 blackjack + sports (1 grouped surface)
        "avg_seconds": 84,
    }



@api_router.get("/admin/mestari/diagnostic-copy")
async def admin_get_diagnostic_copy(_: bool = Depends(require_admin)):
    from mestari_diagnostics import _DEFAULT_LANDING_COPY, get_landing_copy
    return {
        "merged": await get_landing_copy(db),
        "defaults": _DEFAULT_LANDING_COPY,
    }


@api_router.put("/admin/mestari/diagnostic-copy")
async def admin_save_diagnostic_copy(
    payload: Dict[str, Any], _: bool = Depends(require_admin),
):
    from mestari_diagnostics import save_landing_copy
    await save_landing_copy(db, payload.get("copy") or {})
    return {"ok": True}


@api_router.post("/mestari/diagnostic/{diagnostic}/resolve")
async def public_diagnostic_resolve(diagnostic: str, payload: Dict[str, Any]):
    """Public - resolve answers → profile for poker/blackjack. Sports
    diagnostic continues to use POST /api/voita/profile/resolve."""
    from mestari_diagnostics import resolve_blackjack, resolve_poker
    answers = (payload or {}).get("answers") or []
    if diagnostic == "poker":
        return resolve_poker(answers)
    if diagnostic == "blackjack":
        return resolve_blackjack(answers)
    raise HTTPException(status_code=404, detail="unknown_diagnostic")


@api_router.post("/mestari/diagnostic/lead")
async def public_diagnostic_lead(payload: Dict[str, Any]):
    """Capture a poker / blackjack lead. Sports leads continue to flow
    through POST /api/voita/lead (source='mestari') so the existing
    Mestari sports diagnostic is unaffected."""
    from mestari_diagnostics import capture_diagnostic_lead
    res = await capture_diagnostic_lead(
        db,
        email=(payload or {}).get("email", ""),
        name=(payload or {}).get("name"),
        diagnostic=(payload or {}).get("diagnostic", ""),
        profile_key=(payload or {}).get("profile_key"),
        scores=(payload or {}).get("scores"),
        lang=(payload or {}).get("lang", "fi"),
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error", "bad_request"))
    return res


# ── Email templates (back-office) ─────────────────────────────────────

@api_router.get("/admin/email-templates")
async def admin_get_email_templates(_: bool = Depends(require_admin)):
    """Single payload: catalogue (sidebar) + full template map (editor)."""
    import email_templates as _et
    return {
        "catalogue": _et.template_catalogue(),
        "templates": await _et.get_all_templates(db),
        "dispatch_ready_flag": bool(_et.DISPATCH_READY),
        "resend_configured": bool(os.environ.get("RESEND_API_KEY")
                                  and os.environ.get("RESEND_FROM")),
    }


@api_router.put("/admin/email-templates")
async def admin_save_email_templates(
    payload: Dict[str, Any], _: bool = Depends(require_admin),
):
    from email_templates import save_templates
    await save_templates(db, payload.get("templates") or {})
    return {"ok": True}


@api_router.post("/admin/email-templates/preview")
async def admin_preview_email_template(
    payload: Dict[str, Any], _: bool = Depends(require_admin),
):
    """Render a template against sample vars so the editor can preview
    without dispatching anything."""
    from email_templates import render_template
    slug = (payload or {}).get("slug", "")
    lang = (payload or {}).get("lang", "fi")
    sample_vars = (payload or {}).get("vars") or {
        "name": "Antti", "profile_name": "The Strategist",
        "diagnostic": "poker", "raffle_title": "HJK vs Lahti",
        "entry_position": "7", "prize_label": "€100 Weezybet credit",
        "redeem_url": "https://putkihq.fi/redeem/EXAMPLE",
        "magic_link": "https://putkihq.fi/bind/abc123",
        "unsubscribe_url": "https://putkihq.fi/unsub/EXAMPLE",
        "site_url": "https://putkihq.fi",
    }
    rendered = await render_template(db, slug, lang=lang, vars_=sample_vars)
    if not rendered:
        raise HTTPException(status_code=404, detail="unknown_template")
    return rendered


# ── Leads lifecycle (back-office) ─────────────────────────────────────

@api_router.get("/admin/leads/timeline")
async def admin_leads_timeline(
    limit: int = 200, _: bool = Depends(require_admin),
):
    from leads_lifecycle import build_timeline
    return await build_timeline(db, limit=max(10, min(500, limit)))


# ── Mestari copy editor ───────────────────────────────────────────────
@api_router.get("/mestari/copy")
async def public_mestari_copy():
    """Returns the fully-merged Mestari page copy tree (admin override
    layered on top of DEFAULT_MESTARI_COPY). Every field is present so
    the frontend never sees `undefined`."""
    from mestari_copy import get_mestari_copy
    return await get_mestari_copy(db)


# NOTE: GET / PUT /admin/mestari/copy moved to routes/admin.py (iter68 phase 1).


# ── Voyager rotation calendar ─────────────────────────────────────────

@api_router.get("/voyager/active")
async def public_voyager_active():
    """Public - current week's voyager pick (game · operator · prize ·
    review). Falls back to DEFAULT_VOYAGER when no override is saved."""
    from voyager_rotation import get_active_voyager
    return await get_active_voyager(db)


# NOTE: Both /admin/voyager/rotation endpoints moved to routes/admin.py (iter68 phase 3b).




@api_router.get("/odds/market-watch")
async def public_odds_market_watch():
    """Phase 1 (Section 7c) - Daily Market Watch Card payload.
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
    """Phase 1 (Section 2) - rolling news ticker feed.

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


# ── Phase 1 FINAL · Chunk A - News Portal (homepage rebuild) ──

def _news_doc_projection() -> Dict[str, int]:
    return {
        "_id": 0, "source": 1, "source_tier": 1, "title": 1, "url": 1,
        "category": 1, "severity": 1, "relevance": 1, "verified": 1,
        "captured_at": 1, "published": 1, "entity_tags": 1,
    }


SEVERITY_WEIGHT = {"high": 30, "med": 18, "medium": 18, "low": 6}


def _featured_score(doc: Dict[str, Any]) -> int:
    """Deterministic AI-rank score for the top-2 featured stories.
    Combines relevance (0-100), severity weight, verification bonus,
    and source-tier bonus. Recency tiebreaker via captured_at."""
    rel = int(doc.get("relevance") or 0)
    sev = SEVERITY_WEIGHT.get((doc.get("severity") or "").lower(), 0)
    verified_bonus = 12 if doc.get("verified") else 0
    tier_bonus = 6 if int(doc.get("source_tier") or 0) == 1 else 0
    return rel + sev + verified_bonus + tier_bonus


@api_router.get("/news/featured")
async def public_news_featured(limit: int = 2):
    """Top-N AI-ranked stories for the homepage featured row.

    Pulls the latest `news_ticker_items` (default 60 candidates from the
    past 12h), scores them deterministically by relevance + severity +
    verification + tier, returns the top-N enriched with hero_image_url
    and photo_credit (sourced from og:image of the cited URL, validated
    ≥1200×630, cached for 7 days).

    When og:image is unavailable / invalid / blocklisted, the response
    sets `hero_image_url: null` and the frontend renders the designed
    category-treatment fallback. The mandatory `Photo: {source}` credit
    is set whenever a hero image is returned.
    """
    limit = max(1, min(4, int(limit or 2)))
    candidate_window = 60
    cur = db.news_ticker_items.find(
        {}, _news_doc_projection(),
    ).sort([("captured_at", -1)]).limit(candidate_window)
    candidates = [doc async for doc in cur]
    if not candidates:
        return {"items": [], "as_of": datetime.now(timezone.utc).isoformat()}

    ranked = sorted(
        candidates,
        key=lambda d: (_featured_score(d), d.get("captured_at") or ""),
        reverse=True,
    )[:limit]

    # Best-effort og:image enrichment. Each fetch is short-timeout; total
    # additional latency is bounded by limit × FETCH_TIMEOUT_SECONDS.
    from og_image_fetcher import fetch_and_cache as _og_fetch
    enriched: List[Dict[str, Any]] = []
    for doc in ranked:
        url = doc.get("url") or ""
        source_name = doc.get("source") or ""
        hero = None
        if url and source_name:
            try:
                hero = await _og_fetch(db, article_url=url, source_name=source_name)
            except Exception:
                logger.exception("og fetch failed for %s", url)
                hero = None
        enriched.append({
            **doc,
            "hero_image_url": (hero or {}).get("hero_image_url"),
            "photo_credit": (hero or {}).get("photo_credit"),
        })
    return {
        "items": enriched,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/news/chronological")
async def public_news_chronological(limit: int = 12):
    """Chronological news list for the homepage left column.

    Returns the most recent `news_ticker_items` sorted by capture time.
    No og:image enrichment - that runs only on the featured row to keep
    this endpoint fast (the chronological list shows source + headline +
    timestamp, no hero images).
    """
    limit = max(1, min(40, int(limit or 12)))
    cur = db.news_ticker_items.find(
        {}, _news_doc_projection(),
    ).sort([("captured_at", -1)]).limit(limit)
    items = [doc async for doc in cur]
    return {
        "items": items,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


# ── og:image blocklist admin (back-office removal-request handling) ──

class _OgBlocklistAdd(BaseModel):
    domain: str
    reason: Optional[str] = ""


@api_router.get("/admin/og-blocklist")
async def admin_og_blocklist_list(_: bool = Depends(require_admin)):
    from og_image_fetcher import list_blocklist
    return {"items": await list_blocklist(db)}


@api_router.post("/admin/og-blocklist")
async def admin_og_blocklist_add(payload: _OgBlocklistAdd, _: bool = Depends(require_admin)):
    from og_image_fetcher import add_to_blocklist
    try:
        doc = await add_to_blocklist(db, payload.domain, payload.reason or "")
        return {"added": doc}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/admin/og-blocklist/{domain}")
async def admin_og_blocklist_remove(domain: str, _: bool = Depends(require_admin)):
    from og_image_fetcher import remove_from_blocklist
    ok = await remove_from_blocklist(db, domain)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"removed": domain}


@api_router.get("/odds/upcoming")
async def public_odds_upcoming(days: int = 7, top_per_day: int = 5):
    """Betting Tips hub - picks grouped by calendar day for the next N days."""
    from odds_api import get_upcoming_picks
    days = max(1, min(14, days))
    top_per_day = max(1, min(10, top_per_day))
    return await get_upcoming_picks(days=days, top_per_day=top_per_day)


@api_router.get("/dial/history")
async def public_dial_history(limit: int = 48):
    """Public - last N dial snapshots for the home mini-chart."""
    limit = max(1, min(200, limit))
    return {"history": await dial_history(db, limit=limit)}


# ── Phase 1 Sprint 4 - Mittari streak counter + state permalink ──

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


@api_router.get("/og/mittari/{state_key}/{date_iso}")
async def public_mittari_og(state_key: str, date_iso: str):
    """Phase 1 Sprint 4 - Mittari OG image lookup.

    Returns `{found:true,url}` when the Nano Banana cache has produced
    an image for this state+date, otherwise `{found:false,reason}`.
    Generation is fire-and-forget from `dial_engine.compute_and_store`
    on state-change; this endpoint is read-only.
    """
    from og_image_generator import (
        is_enabled as og_is_enabled, mittari_og_exists, mittari_og_url,
        MITTARI_STATE_DIRECTIVES,
    )
    key = state_key.upper()
    if key not in MITTARI_STATE_DIRECTIVES:
        return {"found": False, "reason": "unknown_state"}
    if not og_is_enabled():
        return {"found": False, "reason": "og_images_disabled"}
    if not mittari_og_exists(key, date_iso):
        return {"found": False, "reason": "not_yet_generated"}
    return {"found": True, "url": mittari_og_url(key, date_iso)}


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
    """Operational view of the four Layer 2 workers - last-tick timestamps,
    document counts, and the most recent dial snapshot summary.

    iter75d performance fix: previously this did 12 sequential awaits
    (6 collections * 2 queries each) which timed out at 15s during the
    broad pytest sweep. Now does all 12 in parallel via asyncio.gather
    and uses estimated_document_count (O(1) metadata read) instead of
    count_documents (full scan)."""
    coll_names = ("stream_signals", "social_signals", "sports_signals",
                  "news_signals", "f1_signals", "football_signals")

    async def _per_coll(name: str) -> tuple[str, Dict[str, Any]]:
        latest, count = await asyncio.gather(
            db[name].find_one({}, {"_id": 0}, sort=[("captured_at", -1)]),
            db[name].estimated_document_count(),
        )
        return name, {
            "doc_count": count,
            "latest_captured_at": str(latest.get("captured_at")) if latest else None,
            "latest_summary": _summarize_layer2_doc(name, latest),
        }

    results, snap = await asyncio.gather(
        asyncio.gather(*[_per_coll(n) for n in coll_names]),
        latest_dial_snapshot(db),
    )
    out = dict(results)
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
    100-200 total. Hard-capped at 50 per call."""
    if _content_generator is None:
        raise HTTPException(status_code=503, detail="ContentGenerator not initialised")
    from content_backfill import run_backfill
    return await run_backfill(
        db, _content_generator,
        count=payload.count, days=payload.days, templates=payload.templates,
    )






# ─── Admin users + audit log (iter62, P3) ────────────────────────────

class _AdminUserCreate(BaseModel):
    username: str
    role: str = "editor"


@api_router.get("/admin/users")
async def admin_list_users(_: bool = Depends(require_admin)):
    from admin_auth import list_admin_users
    return {"users": await list_admin_users(db)}


@api_router.post("/admin/users")
async def admin_create_user(payload: _AdminUserCreate, request: Request,
                              _: bool = Depends(require_admin)):
    from admin_auth import create_admin_user, write_audit
    actor = request.state.admin_actor
    if actor.get("role") != "owner":
        raise HTTPException(403, "owner_role_required")
    try:
        u = await create_admin_user(
            db, username=payload.username, role=payload.role,
            created_by=actor["actor"],
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    await write_audit(db, actor=actor["actor"], role=actor["role"],
                       action="admin_user.create",
                       resource=f"admin_user:{u['id']}",
                       meta={"username": u["username"], "role": u["role"]})
    return u  # token_plain shown once.


@api_router.delete("/admin/users/{user_id}")
async def admin_deactivate_user(user_id: str, request: Request,
                                  _: bool = Depends(require_admin)):
    from admin_auth import deactivate_admin_user, write_audit
    actor = request.state.admin_actor
    if actor.get("role") != "owner":
        raise HTTPException(403, "owner_role_required")
    ok = await deactivate_admin_user(db, user_id=user_id)
    await write_audit(db, actor=actor["actor"], role=actor["role"],
                       action="admin_user.deactivate",
                       resource=f"admin_user:{user_id}")
    return {"deactivated": ok}


@api_router.get("/admin/audit-log")
async def admin_get_audit_log(limit: int = 100, actor: Optional[str] = None,
                                _: bool = Depends(require_admin)):
    from admin_auth import read_audit_log
    return {"rows": await read_audit_log(db, limit=limit, actor=actor)}


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
    """Public - surfaces on /lehdisto. Returns active named editorial sources."""
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
    """Bulk import - used by CSV/JSON drops from /back-office/foundational-research."""
    out = []
    for e in data.entries:
        out.append(await upsert_foundational_entry(db, e.dict(), updated_by="admin_bulk"))
    return {"imported": len(out), "entries": out}


# ── Phase 3 V2: editorial seed scheduler ──
# NOTE: CadencesPayload + all /admin/scheduler/* endpoints moved
# to routes/admin.py (iter69 phase 4a).


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


# NOTE: StreamerPayload now lives in rosters.py (data-layer) so both
# server.py and routes/streamers.py can import it without circular deps.


@api_router.get("/operators")
async def public_list_operators(partner_only: bool = False, market_id: Optional[str] = None):
    return {"operators": await list_operators(db, partner_only=partner_only, market_id=market_id)}


@api_router.get("/operators/{slug}")
async def public_get_operator(slug: str):
    op = await get_operator(db, slug)
    if not op:
        raise HTTPException(404, "Not found")
    return op



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



# ── Mini-game suite (iter55) - educational gambling-literacy games ───
import mini_games as _mg

class MiniGameAnswerPayload(BaseModel):
    q_id: str
    picked: str

class MiniGameFinishPayload(BaseModel):
    play_id: str
    anon_id: str
    answers: List[MiniGameAnswerPayload]

class MiniGameUnlockPayload(BaseModel):
    play_id: str
    anon_id: str
    email: str
    name: Optional[str] = None
    consent: bool = False

# ── iter66 phase 2 · Mini-games routes modularised ──────────────────
# All 25 /api/mini-games/* + /api/admin/mini-games/* endpoints now live
# in /app/backend/routes/mini_games.py. server.py shrunk by ~400 LOC.
# Route paths are unchanged - no frontend impact.
import mini_game_tournament as _mgt  # noqa: E402 - used by other server.py blocks too
from routes._helpers import bind_dependencies  # noqa: E402
from routes.mini_games import build_mini_games_router  # noqa: E402
bind_dependencies(db=db, require_admin=require_admin)
api_router.include_router(build_mini_games_router())

# iter68 phase 1 - admin copy endpoints (mittari + mestari copy)
from routes.admin import make_router as _make_admin_router  # noqa: E402
api_router.include_router(_make_admin_router())

# iter76 (Slice 1) - Bot & Routing admin endpoints (bot_config + partners
# CRUD + subscribers summary). Sits alongside the existing admin router.
from routes.bot_routing import (  # noqa: E402
    make_router as _make_bot_routing_router,
    ensure_bot_routing_indexes as _ensure_bot_routing_indexes,
)
api_router.include_router(_make_bot_routing_router())

from routes.signup import make_router as _make_signup_router  # noqa: E402
api_router.include_router(_make_signup_router())

# iter66 phase 3a - streamer endpoints (7 public + 7 admin)
from routes.streamers import build_streamers_router  # noqa: E402
api_router.include_router(build_streamers_router())


# ── iter64 · Profiler Funnel + Share OG (modularised iter66 phase 1) ─
# All 4 profiler endpoints now live in /app/backend/routes/profiler.py.
# Mounted here so route paths are unchanged.
from routes.profiler import build_profiler_router, register_share_landing  # noqa: E402
api_router.include_router(build_profiler_router(db, require_admin))
register_share_landing(app)


# NOTE: VoyagerWeekPayload + all /admin/voyager/weeks/* endpoints moved
# to routes/admin.py (iter68 phase 3b). server.py still imports the
# `rotation` helpers for its public read-only endpoints below.


@api_router.get("/voyager/current-week")
async def public_current_voyager_week(market_id: str = "FI"):
    """Public - what's this week's Voyager? Powers hub `Tämän viikon peli` card."""
    week = await rotation_get_current(db, market_id=market_id)
    if not week:
        return {"week": None, "iso_week": current_iso_week(), "market_id": market_id}
    return {"week": week, "iso_week": week["iso_week"], "market_id": market_id}


@api_router.get("/voyager/weeks")
async def public_voyager_weeks(market_id: str = "FI", upcoming_only: bool = True, limit: int = 12):
    """Public - for the /voita-palkinto/arkisto/* surface and editor planning views."""
    return {"weeks": await rotation_list(db, market_id=market_id, upcoming_only=upcoming_only, limit=limit)}


# NOTE: /admin/voyager/weeks endpoints moved to routes/admin.py (iter68 phase 3b).


# ── Step 4: Live-feed aggregation ─────────────────────────────────────────
@api_router.get("/feed")
async def public_feed(
    source: Optional[str] = None,
    kind: Optional[str] = None,
    market_id: str = FEED_DEFAULT_MARKET,
    limit: int = 12,
):
    """Public hub feed. Mocked signals are excluded - endpoint will return
    [] until real Twitch/Kick/YouTube API keys are supplied. Editorial drops
    are always real (sourced from published_content)."""
    items = await list_feed(db, source=source, kind=kind, market_id=market_id, limit=limit, include_mocked=False)
    return {"items": items, "count": len(items), "market_id": market_id}


# NOTE: /admin/feed + /admin/feed/rebuild moved to routes/admin.py (iter69 phase 4b).


@api_router.get("/feed/stats")
async def public_feed_stats(market_id: str = FEED_DEFAULT_MARKET):
    return await feed_stats(db, market_id=market_id)


# NOTE: All /admin/dispatch/* endpoints + payload models moved to
# routes/admin.py (iter69 phase 4c).


# ── Voita raffle (gated until Sako sign-off + 3 gating flags clear) ──

async def _voita_feature_enabled() -> bool:
    """Public surface gate. Reads the same settings doc the UI checks."""
    doc = await db.settings.find_one({}, {"_id": 0})
    if not doc:
        return False
    return bool(doc.get("voita_feature_enabled", False))


@api_router.get("/voita/raffles")
async def public_voita_raffles_list(status: Optional[str] = None, limit: int = 50):
    """Public list. Without filter, returns currently-visible raffles
    (the homepage CTA surface). With `?status=paid&limit=N`, returns the
    last N paid raffles with winner detail + masked emails - used by
    the recent-winners trust strip."""
    if not await _voita_feature_enabled():
        return {"items": [], "feature_enabled": False}
    if (status or "").lower() == "paid":
        from voita_engine import recent_winners_public
        items = await recent_winners_public(db, limit=max(1, min(int(limit or 3), 10)))
        return {"items": items, "feature_enabled": True, "view": "paid"}
    from voita_engine import list_raffles_public
    items = await list_raffles_public(db)
    return {"items": items, "feature_enabled": True}


@api_router.get("/voita/raffles/{slug}")
async def public_voita_raffle_detail(slug: str):
    if not await _voita_feature_enabled():
        raise HTTPException(status_code=404, detail="raffle not found")
    from voita_engine import get_raffle_public
    d = await get_raffle_public(db, slug.lower().strip())
    if not d:
        raise HTTPException(status_code=404, detail="raffle not found")
    return d


@api_router.get("/voita/raffles/{slug}/match-context")
async def public_voita_match_context(slug: str):
    """Real per-match context for the prediction game beats: bookmaker
    consensus, team form (when league is covered), editorial pick, and
    current pick distribution among entrants. Every field can be null -
    UI must degrade gracefully."""
    if not await _voita_feature_enabled():
        raise HTTPException(status_code=404, detail="raffle not found")
    raffle_doc = await db.voita_raffles.find_one(
        {"slug": slug.lower().strip()}, {"_id": 0},
    )
    if not raffle_doc:
        raise HTTPException(status_code=404, detail="raffle not found")
    from voita_match_context import build_match_context
    return await build_match_context(db, raffle_doc)


@api_router.post("/voita/profile/resolve")
async def public_voita_profile_resolve(payload: Dict[str, Any]):
    """Resolve a user's quiz answers to a named predictor profile.
    Public - accepts {answers: {q_key: tag}} from the lesson funnel and
    returns the matched profile (name + diagnosis + weakness + edge +
    hooks). Stateless; nothing about the user is persisted here.
    """
    from voita_profiles import DEFAULT_PROFILES, sanitize_profiles, resolve_profile
    settings_doc = await db.settings.find_one({"_id": SETTINGS_KEY}) or {}
    profiles = sanitize_profiles(settings_doc.get("voita_predictor_profiles") or DEFAULT_PROFILES)
    answers = payload.get("answers") if isinstance(payload, dict) else {}
    if not isinstance(answers, dict):
        answers = {}
    cleaned = {str(k)[:32]: str(v)[:48] for k, v in answers.items() if k and v}
    matched = resolve_profile(profiles, cleaned)
    if not matched:
        raise HTTPException(status_code=500, detail="no profile available")
    return {"profile": matched, "matched_answers": cleaned}


@api_router.get("/voita/your-record")
async def public_voita_your_record(email: EmailStr):
    """User-facing 'your record' lookup. Returns aggregate counts ONLY
    for the requesting email - never enumerates other entrants. Used by
    the listing-page strip; FE must pass the email captured in the
    visitor's last entry session.
    """
    em = str(email).lower().strip()
    raffles_played = await db.voita_entries.count_documents({"email_lower": em})
    if raffles_played == 0:
        return {"raffles_played": 0, "wins": 0, "eur_won": 0}
    # Look at all paid raffles, find ledger entries that paid this email.
    wins = 0
    eur_won = 0
    em_short = em.split("@")[0][:3]
    async for r in db.voita_raffles.find(
        {"status": "paid"}, {"_id": 0, "result": 1},
    ):
        for w in ((r.get("result") or {}).get("winners") or []):
            # voita_engine masks emails before storing on the public surface
            # so we match against the masked prefix.
            masked = (w.get("email_masked") or "").lower()
            if masked.startswith(em_short):
                wins += 1
                try:
                    eur_won += int(w.get("amount_eur") or 0)
                except Exception:
                    pass
    return {"raffles_played": raffles_played, "wins": wins, "eur_won": eur_won}


class _VoitaEntryPayload(BaseModel):
    email: EmailStr
    prediction_one_x_two: str = Field(..., description="'1' | 'X' | '2'")
    predicted_home_goals: int = Field(..., ge=0, le=50)
    predicted_away_goals: int = Field(..., ge=0, le=50)
    rules_accepted: bool
    display_name: Optional[str] = ""
    confidence: Optional[int] = Field(default=None, ge=1, le=5)
    contact_channel: Optional[str] = Field(default=None, max_length=16)
    pending_id: Optional[str] = Field(default=None, max_length=64)


@api_router.post("/voita/raffles/{slug}/enter")
async def public_voita_enter(slug: str, payload: _VoitaEntryPayload, request: Request):
    if not await _voita_feature_enabled():
        raise HTTPException(status_code=404, detail="raffle not found")
    from voita_engine import submit_entry
    try:
        ip = request.client.host if request.client else ""
        ua = request.headers.get("user-agent", "")[:240]
        ch = (payload.contact_channel or "").strip().lower() or None
        if ch not in (None, "telegram", "email"):
            ch = None
        return await submit_entry(
            db, slug=slug.lower().strip(),
            email=str(payload.email),
            prediction_one_x_two=payload.prediction_one_x_two,
            predicted_home_goals=payload.predicted_home_goals,
            predicted_away_goals=payload.predicted_away_goals,
            rules_accepted=bool(payload.rules_accepted),
            display_name=payload.display_name or "",
            confidence=payload.confidence,
            contact_channel=ch,
            pending_id=(payload.pending_id or "").strip()[:64] or None,
            ip=ip, ua=ua,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Admin (full CRUD + draw) ──

class _VoitaCreatePayload(BaseModel):
    slug: str
    title_fi: Optional[str] = ""
    title_en: Optional[str] = ""
    summary_fi: Optional[str] = ""
    summary_en: Optional[str] = ""
    sport: Optional[str] = ""
    league: Optional[str] = ""
    home_team: Optional[str] = ""
    away_team: Optional[str] = ""
    kickoff_at: Optional[str] = None
    entries_close_at: Optional[str] = None
    image_url: Optional[str] = None
    prize_cap_eur: Optional[int] = 500
    prize_distribution: Optional[Dict[str, Any]] = None
    scoring: Optional[Dict[str, int]] = None
    rules_url_set: Optional[bool] = False


@api_router.get("/admin/voita/raffles")
async def admin_voita_list(_: bool = Depends(require_admin)):
    from voita_engine import list_raffles_admin
    items = await list_raffles_admin(db)
    return {"items": items}


# ── Telegram bot - Voita raffle confirmation (Sprint B Slice 3) ──────────

@api_router.post("/webhooks/telegram")
async def webhook_telegram(request: Request):
    """Inbound webhook from Telegram. Validates the secret token header
    (when configured) and dispatches updates to the bot module."""
    import telegram_bot as _tg
    expected_secret = _tg._webhook_secret()
    if expected_secret:
        provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if provided != expected_secret:
            raise HTTPException(status_code=401, detail="invalid_telegram_secret")
    try:
        update = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid_json: {exc}")
    result = await _tg.handle_update(db, update)
    # Audit log - small TTL collection so we can debug binding issues.
    try:
        await db.telegram_webhook_log.insert_one({
            "received_at": datetime.now(timezone.utc).isoformat(),
            "update_id": update.get("update_id"),
            "result": result,
            "chat_id": ((update.get("message") or {}).get("chat") or {}).get("id"),
        })
    except Exception:
        logger.exception("telegram webhook audit log failed")
    return {"ok": True, **result}


class _TelegramSetWebhookPayload(BaseModel):
    url: str
    secret_token: Optional[str] = None
    drop_pending_updates: bool = True


@api_router.post("/admin/telegram/set-webhook")
async def admin_telegram_set_webhook(payload: _TelegramSetWebhookPayload,
                                     _: bool = Depends(require_admin)):
    import telegram_bot as _tg
    return await _tg.set_webhook(
        payload.url.strip(),
        secret_token=payload.secret_token,
        drop_pending_updates=payload.drop_pending_updates,
    )


@api_router.get("/admin/telegram/webhook-info")
async def admin_telegram_webhook_info(_: bool = Depends(require_admin)):
    import telegram_bot as _tg
    return await _tg.get_webhook_info()


@api_router.get("/admin/telegram/bound-entries")
async def admin_telegram_bound_entries(limit: int = 50, _: bool = Depends(require_admin)):
    """Lists recent voita entries that have a bound Telegram chat_id.
    Used to sanity-check the binding pipeline end-to-end."""
    cur = db.voita_entries.find(
        {"telegram_chat_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "raffle_slug": 1, "telegram_chat_id": 1,
         "telegram_username": 1, "telegram_bound_at": 1, "pending_id": 1,
         "confidence": 1, "prediction_one_x_two": 1,
         "predicted_home_goals": 1, "predicted_away_goals": 1,
         "email_hash": 1, "display_name": 1, "created_at": 1},
    ).sort([("telegram_bound_at", -1)]).limit(max(1, min(200, int(limit))))
    items = [d async for d in cur]
    return {"items": items, "count": len(items)}


# ── Mittari signal subscriptions (Sprint B Slice 4) ──────────────────────

class _MittariSubscribePayload(BaseModel):
    pending_id: str = Field(..., max_length=64)


@api_router.post("/mittari/subscribe")
async def mittari_subscribe(payload: _MittariSubscribePayload):
    """Pre-register the pending_id so the bot can resolve it when the
    user lands via t.me/Putkihq_bot?start=mittari_<id>. Optimistic - the
    FE unlocks the signals client-side immediately; the bot side
    finalises the binding (chat_id + telegram_username) async."""
    pid = (payload.pending_id or "").strip()[:64]
    if not pid:
        raise HTTPException(status_code=400, detail="pending_id required")
    now = datetime.now(timezone.utc).isoformat()
    await db.mittari_subscribers.update_one(
        {"pending_id": pid},
        {
            "$set": {
                "pending_id": pid,
                "consent_tag": "mittari_alerts",
                "source": "mittari_signals",
                "last_seen_at": now,
            },
            "$setOnInsert": {"created_at": now, "active": True},
        },
        upsert=True,
    )
    return {"ok": True, "pending_id": pid}


@api_router.get("/mittari/binding-status")
async def mittari_binding_status(pending_id: str):
    """Public lookup so the page can poll for bot confirmation after the
    user lands in Telegram. Returns minimal info - no chat_id leaks."""
    pid = (pending_id or "").strip()[:64]
    if not pid:
        raise HTTPException(status_code=400, detail="pending_id required")
    sub = await db.mittari_subscribers.find_one(
        {"pending_id": pid},
        {"_id": 0, "telegram_bound_at": 1, "active": 1},
    )
    if not sub:
        return {"bound": False, "active": False}
    return {
        "bound": bool(sub.get("telegram_bound_at")),
        "active": bool(sub.get("active")),
        "bound_at": sub.get("telegram_bound_at"),
    }


@api_router.get("/admin/mittari/subscribers")
async def admin_mittari_subscribers(limit: int = 50, _: bool = Depends(require_admin)):
    cur = db.mittari_subscribers.find(
        {}, {"_id": 0},
    ).sort([("created_at", -1)]).limit(max(1, min(500, int(limit))))
    items = [d async for d in cur]
    total = await db.mittari_subscribers.count_documents({})
    active = await db.mittari_subscribers.count_documents({"active": True, "telegram_chat_id": {"$ne": None}})
    return {"items": items, "count": len(items), "total": total, "active_bound": active}


# ── PUTKI lead - unified view across all surfaces ────────────────────────

_PUTKI_LEAD_TAGS = {
    "mestari_lead": "mestari",
    "voita_lead": "voita",
    "mittari_lead": "mittari",
}


@api_router.get("/admin/leads")
async def admin_putki_leads(
    source: Optional[str] = None,
    limit: int = 200,
    _: bool = Depends(require_admin),
):
    """Unified leads view across all PUTKI surfaces. `source` filter:
    mestari | voita | mittari | (omitted = all).

    Aggregates `optin_consents` rows tagged `mestari_lead`/`voita_lead`/
    `mittari_lead` plus voita_entries rows that opted-in by email (the
    raffle entries themselves are leads too). Sorted newest-first."""
    src = (source or "").strip().lower()
    consent_tags = list(_PUTKI_LEAD_TAGS.keys())
    if src in _PUTKI_LEAD_TAGS.values():
        consent_tags = [t for t, s in _PUTKI_LEAD_TAGS.items() if s == src]

    q = {"consent_tag": {"$in": consent_tags}}
    lim = max(1, min(2000, int(limit)))

    cur = db.optin_consents.find(
        q,
        {"_id": 0, "identifier": 1, "consent_tag": 1, "source": 1,
         "surface": 1, "email": 1, "lang": 1, "display_name": 1,
         "created_at": 1, "last_seen_at": 1, "first_source": 1,
         "voita_quiz": 1},
    ).sort([("last_seen_at", -1)]).limit(lim)
    items = [d async for d in cur]

    # Source counts (always emit all four buckets even if zero so the
    # admin UI can render a stable summary row).
    counts: Dict[str, int] = {}
    for tag, label in _PUTKI_LEAD_TAGS.items():
        counts[label] = await db.optin_consents.count_documents({"consent_tag": tag})
    counts["total"] = sum(counts.values())

    # 24h fresh stats
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    fresh = {}
    for tag, label in _PUTKI_LEAD_TAGS.items():
        fresh[label] = await db.optin_consents.count_documents({
            "consent_tag": tag, "created_at": {"$gte": cutoff},
        })

    return {
        "items": items,
        "count": len(items),
        "counts": counts,
        "fresh_24h": fresh,
        "filter": src or "all",
    }


@api_router.get("/admin/leads/summary")
async def admin_putki_leads_summary(_: bool = Depends(require_admin)):
    """Lightweight summary endpoint for at-a-glance dashboards. Same
    counts as /admin/leads but without paging items."""
    counts: Dict[str, int] = {}
    for tag, label in _PUTKI_LEAD_TAGS.items():
        counts[label] = await db.optin_consents.count_documents({"consent_tag": tag})
    counts["total"] = sum(counts.values())
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    fresh: Dict[str, int] = {}
    for tag, label in _PUTKI_LEAD_TAGS.items():
        fresh[label] = await db.optin_consents.count_documents({
            "consent_tag": tag, "created_at": {"$gte": cutoff},
        })
    # Telegram subscribers counts piggyback here so the admin dashboard
    # has a single fetch for the full PUTKI HQ acquisition snapshot.
    tg_voita = await db.voita_entries.count_documents({"telegram_chat_id": {"$ne": None}})
    tg_mittari = await db.mittari_subscribers.count_documents({
        "active": True, "telegram_chat_id": {"$ne": None},
    })
    return {
        "counts": counts,
        "fresh_24h": fresh,
        "telegram": {"voita_bound": tg_voita, "mittari_bound_active": tg_mittari},
    }


# ── Telegram delivery audit (Sprint C overnight build) ───────────────────

@api_router.get("/admin/telegram/log")
async def admin_telegram_log(limit: int = 50, _: bool = Depends(require_admin)):
    cur = db.telegram_webhook_log.find({}, {"_id": 0}).sort([("received_at", -1)]).limit(
        max(1, min(500, int(limit)))
    )
    items = [d async for d in cur]
    total = await db.telegram_webhook_log.count_documents({})
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    fresh_24h = await db.telegram_webhook_log.count_documents({"received_at": {"$gte": cutoff}})
    return {"items": items, "count": len(items), "total": total, "fresh_24h": fresh_24h}


@api_router.post("/admin/voita/raffles")
async def admin_voita_create(payload: _VoitaCreatePayload, _: bool = Depends(require_admin)):
    from voita_engine import create_raffle
    try:
        return {"created": await create_raffle(db, payload.dict())}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class _VoitaUpdatePayload(BaseModel):
    title_fi: Optional[str] = None
    title_en: Optional[str] = None
    summary_fi: Optional[str] = None
    summary_en: Optional[str] = None
    sport: Optional[str] = None
    league: Optional[str] = None
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    kickoff_at: Optional[str] = None
    entries_close_at: Optional[str] = None
    image_url: Optional[str] = None
    prize_cap_eur: Optional[int] = None
    prize_distribution: Optional[Dict[str, Any]] = None
    scoring: Optional[Dict[str, int]] = None
    gating: Optional[Dict[str, bool]] = None
    status: Optional[str] = None


@api_router.put("/admin/voita/raffles/{raffle_id}")
async def admin_voita_update(raffle_id: str, payload: _VoitaUpdatePayload, _: bool = Depends(require_admin)):
    from voita_engine import update_raffle
    try:
        # Only forward fields that were actually set
        patch = {k: v for k, v in payload.dict().items() if v is not None}
        return {"updated": await update_raffle(db, raffle_id, patch)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@api_router.delete("/admin/voita/raffles/{raffle_id}")
async def admin_voita_delete(raffle_id: str, _: bool = Depends(require_admin)):
    from voita_engine import delete_raffle
    try:
        return await delete_raffle(db, raffle_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@api_router.get("/admin/voita/raffles/{raffle_id}/entries")
async def admin_voita_entries(raffle_id: str, _: bool = Depends(require_admin)):
    from voita_engine import list_entries_admin
    items = await list_entries_admin(db, raffle_id)
    return {"items": items, "count": len(items)}


class _VoitaDrawPayload(BaseModel):
    home_goals: int = Field(..., ge=0, le=50)
    away_goals: int = Field(..., ge=0, le=50)


@api_router.post("/admin/voita/raffles/{raffle_id}/draw")
async def admin_voita_draw(raffle_id: str, payload: _VoitaDrawPayload, _: bool = Depends(require_admin)):
    from voita_engine import draw_raffle
    try:
        return await draw_raffle(
            db, raffle_id,
            home_goals=payload.home_goals,
            away_goals=payload.away_goals,
            drawn_by="admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@api_router.post("/admin/voita/raffles/{raffle_id}/mark-paid")
async def admin_voita_mark_paid(raffle_id: str, _: bool = Depends(require_admin)):
    """Flip a drawn raffle to `paid`. Required step before the recent-
    winners strip will surface it on /voita/{slug}. A draw without
    payment is a weaker trust claim than a draw + paid timestamp."""
    from voita_engine import mark_paid
    try:
        doc = await mark_paid(db, raffle_id, paid_by="admin")
        return {"ok": True, "raffle": doc}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@api_router.post("/admin/voita/raffles/{raffle_id}/notify-winner")
async def admin_voita_notify_winner(
    raffle_id: str, _: bool = Depends(require_admin),
):
    """Queue the `voita_winner` template against the raffle's drawn
    winner. Pulls the winner's email + display_name + raffle title from
    Mongo, renders the template once, writes to `email_outbox`. Returns
    400 if the raffle isn't drawn yet, 409 if the winner has already
    been notified (idempotent via `winner_notified_at`)."""
    from email_templates import render_template
    raffle = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    if not raffle:
        raise HTTPException(status_code=404, detail="raffle_not_found")
    result = raffle.get("result") or {}
    winners = result.get("winners") or []
    if not winners:
        raise HTTPException(status_code=400, detail="raffle_not_drawn")
    if raffle.get("winner_notified_at"):
        return {"ok": True, "already_notified": True,
                "notified_at": raffle["winner_notified_at"]}
    winner = winners[0]
    entry_id = winner.get("entry_id")
    entry = await db.voita_entries.find_one(
        {"id": entry_id}, {"_id": 0, "email_lower": 1, "display_name": 1, "lang": 1},
    ) if entry_id else None
    email = (entry or {}).get("email_lower")
    if not email:
        raise HTTPException(status_code=400, detail="winner_email_missing")
    name = (entry or {}).get("display_name") or ""
    lang = (entry or {}).get("lang", "fi")
    raffle_title = raffle.get("title_fi") or raffle.get("title_en") or raffle.get("slug", "")
    prize_label = (raffle.get("prize") or {}).get(
        f"label_{lang}", raffle.get("prize_label", "€100 Weezybet credit"),
    )
    redeem_url = f"https://putkihq.fi/voita/{raffle.get('slug', '')}?winner={entry_id}"
    rendered = await render_template(
        db, "voita_winner", lang=lang,
        vars_={
            "name": name or ("Voittaja" if lang == "fi" else "Winner"),
            "raffle_title": raffle_title,
            "prize_label": prize_label,
            "redeem_url": redeem_url,
            "site_url": "https://putkihq.fi",
            "unsubscribe_url": f"https://putkihq.fi/unsub?e={email}",
        },
    )
    if not rendered:
        raise HTTPException(status_code=500, detail="template_missing")
    # Drop into the outbox so the existing send-worker picks it up.
    now = datetime.now(timezone.utc).isoformat()
    # Pixel injection happens at the email_templates level - track the
    # winner email via the standard tracking pipeline too.
    from email_tracking import inject_tracking_into_html, new_token, tracking_enabled
    body_html = rendered["body_html"]
    track_token = None
    if tracking_enabled():
        track_token = new_token()
        body_html = inject_tracking_into_html(body_html, track_token)
    outbox_doc = {
        "to": email,
        "to_name": name or None,
        "subject": rendered["subject"],
        "body_text": rendered["body_text"],
        "body_html": body_html,
        "attachments": [],
        "status": "pending",
        "attempts": 0,
        "scheduled_at": now,
        "sent_at": None,
        "last_error": None,
        "voita_entry_id": entry_id,
        "raffle_id": raffle_id,
        "source": "voita_winner_notify",
        "lang": lang,
        "created_at": now,
        "open_count": 0,
        "click_count": 0,
    }
    if track_token:
        outbox_doc["track_token"] = track_token
    await db.email_outbox.insert_one(outbox_doc)
    await db.voita_raffles.update_one(
        {"id": raffle_id},
        {"$set": {"winner_notified_at": now, "winner_notified_to": email}},
    )
    return {"ok": True, "queued": True, "to": email,
            "subject": rendered["subject"], "notified_at": now}


# ── Leads 24h funnel (back-office) ────────────────────────────────────

@api_router.get("/admin/leads/funnel")
async def admin_leads_funnel(
    hours: int = 24, _: bool = Depends(require_admin),
):
    """6-stage funnel over the last N hours:
       1. signups       - distinct emails added to optin_consents
       2. queued        - email_outbox rows created
       3. sent          - email_outbox rows that flipped to status=sent
       4. opened        - outbox rows with first_opened_at in window
       5. clicked       - outbox rows with first_clicked_at in window
       6. returned      - emails that received an email AND opened a new
                          voita_entry OR mestari lead AFTER their last
                          sent_at (engagement-loop estimate).
    """
    from leads_lifecycle import build_funnel
    return await build_funnel(db, hours=max(1, min(168, hours)))


@api_router.post("/admin/voita/raffles/{raffle_id}/import-odds")
async def admin_voita_import_odds(raffle_id: str, _: bool = Depends(require_admin)):
    """Snapshot the current bookmaker consensus + team form on the
    raffle doc as `match_meta`. Useful at raffle-creation time so that
    even after the Odds API event expires, the previewer still shows
    what the markets read at day-0 - backs editorial post-mortems."""
    from voita_match_context import odds_for_match, team_form_for_match
    doc = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="raffle not found")
    home, away = doc.get("home_team"), doc.get("away_team")
    if not (home and away):
        raise HTTPException(status_code=400, detail="raffle missing home/away team")
    odds = await odds_for_match(
        home_team=home, away_team=away, sport=doc.get("sport") or "football",
    )
    form = await team_form_for_match(
        league=doc.get("league"), home_team=home, away_team=away,
    )
    meta = {
        "odds_snapshot": odds,
        "team_form_snapshot": form,
        "snapshotted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.voita_raffles.update_one(
        {"id": raffle_id},
        {"$set": {"match_meta": meta, "updated_at": meta["snapshotted_at"]}},
    )
    return {"ok": True, "match_meta": meta}


# ── News-watch editorial board (iter51) ───────────────────────────────
#
# Editor's one-click veto over the deterministic news classifier. The
# classifier auto-splits each ingested RSS item between the public
# ticker (relevance ≥ 45), the editor-promotable archive (20-44), and
# the silent-drop bin (< 20). These endpoints let an editor promote,
# demote, or permanently kill any item. Killed URLs are stored in
# `news_rejected_urls` and skipped on every subsequent RSS tick.

@api_router.get("/admin/news-watch/feed")
async def admin_news_watch_feed(
    coll: str = "archive",
    limit: int = 50,
    before: Optional[str] = None,
    source: Optional[str] = None,
    category: Optional[str] = None,
    min_relevance: Optional[int] = None,
    _: bool = Depends(require_admin),
):
    """List items from either the public ticker (`coll=ticker`) or the
    archive (`coll=archive`, default), newest first. Supports `before`
    cursor + per-source + per-category + min_relevance filters."""
    from news_watch import list_items, TICKER_COLL, ARCHIVE_COLL
    target = TICKER_COLL if coll == "ticker" else ARCHIVE_COLL
    items = await list_items(
        db, target,
        limit=limit, before=before, source=source,
        category=category, min_relevance=min_relevance,
    )
    return {"coll": coll, "items": items, "count": len(items)}


@api_router.get("/admin/news-watch/stats")
async def admin_news_watch_stats(_: bool = Depends(require_admin)):
    from news_watch import stats
    return await stats(db)


@api_router.get("/admin/news-watch/rejected")
async def admin_news_watch_rejected(limit: int = 100, _: bool = Depends(require_admin)):
    from news_watch import list_rejected
    items = await list_rejected(db, limit=limit)
    return {"items": items, "count": len(items)}


@api_router.post("/admin/news-watch/promote")
async def admin_news_watch_promote(payload: Dict[str, Any], _: bool = Depends(require_admin)):
    """Move an item from news_ticker_archive → news_ticker_items."""
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    from news_watch import promote
    item = await promote(db, url)
    if not item:
        raise HTTPException(status_code=404, detail="not in archive")
    return {"ok": True, "promoted": item}


@api_router.post("/admin/news-watch/demote")
async def admin_news_watch_demote(payload: Dict[str, Any], _: bool = Depends(require_admin)):
    """Move an item from news_ticker_items → news_ticker_archive."""
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    from news_watch import demote
    item = await demote(db, url)
    if not item:
        raise HTTPException(status_code=404, detail="not in ticker")
    return {"ok": True, "demoted": item}


@api_router.post("/admin/news-watch/kill")
async def admin_news_watch_kill(payload: Dict[str, Any], _: bool = Depends(require_admin)):
    """Permanently reject a URL. Idempotent - safe to retry. The next
    RSS tick will skip this URL even if the deterministic classifier
    would otherwise re-surface it."""
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    reason = (payload.get("reason") or "").strip()[:200] or None
    from news_watch import kill
    return {"ok": True, **(await kill(db, url, reason=reason))}


@api_router.post("/admin/news-watch/unkill")
async def admin_news_watch_unkill(payload: Dict[str, Any], _: bool = Depends(require_admin)):
    """Remove a URL from the rejection list (the next RSS tick may
    re-ingest it via the deterministic classifier)."""
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url required")
    from news_watch import unkill
    removed = await unkill(db, url)
    return {"ok": True, "removed": removed}


@app.on_event("startup")
async def startup_event():
    """Startup hook - delegates to the `bootstrap` package.

    Iter50: the previous inline body (seeds + Layer 2 worker spawn +
    dispatch + scheduler, ~120 LOC) was extracted to `bootstrap/seeds.py`
    + `bootstrap/workers.py`. server.py only retains the wiring + the
    server-local callables that `bootstrap.workers` injects back in
    (`_layer2_on_tick` + `_signal_dial_worker`) because they close over
    server-module state.

    The iter48 ast-guard `tests/test_iter48_startup_workers.py` continues
    to enforce that the bootstrap call lives in `startup_event` and
    nowhere else (no more orphan-startup regressions possible).
    """
    from bootstrap import run_startup
    # iter62: ensure admin_users + audit_log indexes exist and bootstrap
    # a `root` user from BACK_OFFICE_TOKEN if no users exist yet.
    from admin_auth import ensure_indexes as _ensure_admin_indexes, seed_root_user_from_env
    try:
        await _ensure_admin_indexes(db)
        await seed_root_user_from_env(db)
    except Exception:
        logger.exception("admin_auth: bootstrap failed (non-fatal)")
    # iter64: ensure profiler_events indexes (funnel analytics TTL)
    try:
        from profiler_funnel import ensure_funnel_indexes as _ensure_funnel_indexes
        await _ensure_funnel_indexes(db)
    except Exception:
        logger.exception("profiler_funnel: bootstrap failed (non-fatal)")
    # iter76 (Slice 1): ensure indexes for the new bot/routing collections
    # (partners, link_codes, redirect_click_log, conversions) + the additive
    # mittari_subscribers fields. Idempotent.
    try:
        await _ensure_bot_routing_indexes(db)
    except Exception:
        logger.exception("bot_routing: index bootstrap failed (non-fatal)")
    # Bind a process-wide ContentGenerator for the Layer 2 hook to use.
    global _content_generator
    _content_generator = ContentGenerator(db)
    await run_startup(
        db,
        layer2_on_tick=_layer2_on_tick,
        signal_dial_worker=_signal_dial_worker,
    )


_content_generator: Optional[ContentGenerator] = None


async def _layer2_on_tick(worker_name: str, result: Any) -> None:
    """Layer 2 worker hook - recompute dial + broadcast to SSE subscribers,
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
    """Legacy 6-signal poller - retained for back-compat with `signals`
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

# Phase 4 Pre-Launch Polish - serve Nano Banana-generated OG images.
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
