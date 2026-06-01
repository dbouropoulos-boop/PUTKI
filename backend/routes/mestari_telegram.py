"""
Phase 3 · Mestari Telegram-first conversion (iter93)

Three small endpoints that let the diagnostic Gate offer Telegram as the
primary capture path while keeping email as a working backup.

  POST /api/mestari/lead/telegram
       FE writes a "pending telegram" row to optin_consents before
       redirecting the user into the bot. The magic_token (UUID minted
       on the FE) is the join key the bot uses to find the row.
       Body: { magic_token, quiz_tags, lang? }
       Returns: { ok, profile_slug, profile_name_fi, profile_name_en }

  GET /api/mestari/profile-content/{magic_token}
       Bot fetches the matched profile + tease/diagnosis lines so it
       can DM the welcome card with personalised content. Falls back
       to a placeholder when the magic_token is unknown.

  POST /api/telegram/bind/{magic_token}
       Bot calls this after `/start mestari_<token>` to bind the user's
       chat_id + telegram_username onto the pending optin_consents row.
       Idempotent — re-binding the same chat_id updates last_seen_at.

Storage model: a single `optin_consents` row per pending lead.
  channel="telegram", surface="mestari_landing", identifier=magic_token,
  consent_tag="mestari_lead". After bind, telegram_chat_id is set.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_tags(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    return {str(k)[:32]: str(v)[:48] for k, v in raw.items() if k and v}


async def _resolve_profile_for_tags(db, tags: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Mirror server.public_voita_profile_resolve so the FE/bot share
    one resolver. Late import keeps the module standalone."""
    from voita_profiles import DEFAULT_PROFILES, resolve_profile, sanitize_profiles
    settings_doc = await db.settings.find_one({"_id": "settings"}) or {}
    profiles = sanitize_profiles(
        settings_doc.get("voita_predictor_profiles") or DEFAULT_PROFILES
    )
    return resolve_profile(profiles, tags)


class _LeadTelegramPayload(BaseModel):
    magic_token: str = Field(..., min_length=8, max_length=64)
    quiz_tags: Optional[Dict[str, str]] = None
    lang: Optional[str] = Field(default=None, max_length=4)


class _BindPayload(BaseModel):
    telegram_chat_id: str = Field(..., min_length=1, max_length=64)
    telegram_username: Optional[str] = Field(default=None, max_length=64)


def build_mestari_telegram_router(db) -> APIRouter:
    router = APIRouter()

    @router.post("/mestari/lead/telegram")
    async def mestari_lead_telegram(payload: _LeadTelegramPayload):
        magic_token = payload.magic_token.strip()
        if not magic_token:
            raise HTTPException(status_code=400, detail="magic_token required")
        tags = _clean_tags(payload.quiz_tags)
        profile = await _resolve_profile_for_tags(db, tags) if tags else None
        profile_slug = (profile or {}).get("slug")
        lang = (payload.lang or "").strip().lower()[:4] or None
        now = _now_iso()
        await db.optin_consents.update_one(
            {
                "channel": "telegram",
                "surface": "mestari_landing",
                "identifier": magic_token,
            },
            {
                "$set": {
                    "channel": "telegram",
                    "surface": "mestari_landing",
                    "identifier": magic_token,
                    "consent_tag": "mestari_lead",
                    "source": "mestari",
                    "magic_token": magic_token,
                    "lang": lang,
                    "last_seen_at": now,
                    "voita_quiz": {
                        "tags": tags or None,
                        "captured_at": now,
                    },
                    "mestari_profile_slug": profile_slug,
                },
                "$setOnInsert": {
                    "created_at": now,
                    "first_source": "mestari",
                },
            },
            upsert=True,
        )
        return {
            "ok": True,
            "magic_token": magic_token,
            "profile_slug": profile_slug,
            "profile_name_fi": (profile or {}).get("name_fi"),
            "profile_name_en": (profile or {}).get("name_en"),
        }

    @router.get("/mestari/profile-content/{magic_token}")
    async def mestari_profile_content(magic_token: str):
        token = (magic_token or "").strip()[:64]
        if not token:
            raise HTTPException(status_code=400, detail="magic_token required")
        row = await db.optin_consents.find_one(
            {"channel": "telegram", "surface": "mestari_landing", "identifier": token},
            {"_id": 0},
        )
        if not row:
            raise HTTPException(status_code=404, detail="pending_not_found")
        profile_slug = row.get("mestari_profile_slug")
        profile: Dict[str, Any] = {}
        if profile_slug:
            from voita_profiles import DEFAULT_PROFILES, sanitize_profiles
            settings_doc = await db.settings.find_one({"_id": "settings"}) or {}
            profiles = sanitize_profiles(
                settings_doc.get("voita_predictor_profiles") or DEFAULT_PROFILES
            )
            for p in profiles:
                if p.get("slug") == profile_slug:
                    profile = p
                    break
        return {
            "magic_token": token,
            "profile_slug": profile_slug,
            "lang": row.get("lang"),
            "bound": bool(row.get("telegram_chat_id")),
            "profile": {
                "slug": profile.get("slug"),
                "name_fi": profile.get("name_fi"),
                "name_en": profile.get("name_en"),
                "tease_fi": profile.get("on_site_tease_fi"),
                "tease_en": profile.get("on_site_tease_en"),
                "diagnosis_fi": profile.get("diagnosis_fi"),
                "diagnosis_en": profile.get("diagnosis_en"),
            } if profile else None,
        }

    @router.post("/telegram/bind/{magic_token}")
    async def telegram_bind(magic_token: str, payload: _BindPayload):
        token = (magic_token or "").strip()[:64]
        if not token:
            raise HTTPException(status_code=400, detail="magic_token required")
        chat_id = payload.telegram_chat_id.strip()
        username = (payload.telegram_username or "").strip().lstrip("@") or None
        row = await db.optin_consents.find_one(
            {"channel": "telegram", "surface": "mestari_landing", "identifier": token},
            {"_id": 0},
        )
        if not row:
            raise HTTPException(status_code=404, detail="pending_not_found")
        now = _now_iso()
        await db.optin_consents.update_one(
            {"channel": "telegram", "surface": "mestari_landing", "identifier": token},
            {
                "$set": {
                    "telegram_chat_id": chat_id,
                    "telegram_username": username,
                    "telegram_bound_at": now,
                    "last_seen_at": now,
                },
            },
        )
        return {"ok": True, "magic_token": token, "bound": True}

    return router
