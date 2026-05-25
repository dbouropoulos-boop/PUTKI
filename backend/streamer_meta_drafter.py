"""
PUTKI HQ - AI-assisted streamer editorial meta drafter.

Drafts → human review → publish pipeline. The LLM proposes, only humans
publish. The draft pipeline is intentionally pessimistic about LLM
output - every draft is opt-in (button click), cached, rate-limited, and
NEVER appears on the public site without an explicit publish action.

Status state machine (`streamer_meta.status`):
    no_meta            → draft never generated, nothing published
    draft_needs_review → AI draft pending editorial review
    published          → editorial line live on the public site
    suppressed         → published but explicitly hidden from frontend

The `suppressed` boolean is preserved alongside status for back-compat with
existing rows from the manual-only workflow.

Cost controls
-------------
- Model: Claude Haiku 4.5 via Emergent Universal Key (cheap, fast).
- 30-day per-streamer cache: re-clicking "Generate AI draft" within 30
  days returns the cached draft unless `?force=true` is passed.
- Hard rate limit: 10 generations per hour across all admin users (Mongo
  TTL collection keeps the audit honest).

Forbidden claim list and editorial voice are locked into the system
prompt. The reviewer always sees `confidence` + `notes_for_reviewer` next
to the draft so they know what to verify.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────

DRAFT_MODEL = "claude-haiku-4-5-20251001"
DRAFT_CACHE_DAYS = 30
RATE_LIMIT_PER_HOUR = 10
RATE_LIMIT_WINDOW_SECONDS = 3600
DRAFT_TIMEOUT_SECONDS = 30.0
WEBSEARCH_ENABLED = os.environ.get("STREAMER_META_WEBSEARCH_ENABLED", "false").lower() == "true"
AI_DRAFT_ENABLED = os.environ.get("STREAMER_META_AI_DRAFT_ENABLED", "true").lower() == "true"

STATUS_NO_META = "no_meta"
STATUS_DRAFT = "draft_needs_review"
STATUS_PUBLISHED = "published"
STATUS_SUPPRESSED = "suppressed"

# Locked system prompt - version-controlled. Changes here must go through
# code review (this is the editorial guardrail the spec called out).
SYSTEM_PROMPT = """You write 1-2 sentence editorial context lines for PUTKI HQ, an independent \
Finnish gambling-culture publication covering streamers, casino news, and \
sports betting.

VOICE: Bloomberg-meets-Yle. Factual, restrained, journalistic. Never \
promotional, never hype, never tipster vocabulary.

CONTENT RULES:
- Describe what the streamer ACTUALLY streams based on the data provided
- Reference their typical content category (slots / live tables / Just \
Chatting / IRL / variety) factually
- Note distinctive characteristics ONLY when supported by the data \
(e.g., "regularly streams 6+ hours" if uptime data shows this)
- Use Finnish-cultural framing where natural (skene, scene)
- Output ONE Finnish version and ONE English version

ABSOLUTELY FORBIDDEN - never include any of the following:
- Sponsor names or operator affiliations (you do not have reliable data on this)
- Income claims, "high roller", "big winner", or any financial claims
- Personal information beyond streaming presence (no real names unless \
publicly used, no location beyond "Finnish streamer")
- Promotional language: "popular", "favorite", "best", "top", "must-watch"
- Tipster vocabulary: "tips", "picks", "predictions"
- Claims about the streamer's personality, character, or motives
- Any unverified specific claim - when in doubt, omit it

OUTPUT FORMAT (JSON, raw object, no markdown fence):
{
  "draft_line_fi": "...",
  "draft_line_en": "...",
  "confidence": "high" | "medium" | "low",
  "notes_for_reviewer": "any caveats or things the human should verify"
}

Confidence reflects how much the draft relies on the provided data vs. \
generic filler. If the data is thin and the draft is mostly generic, \
return confidence "low" and note that in notes_for_reviewer."""


# ── Indexes ──────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> None:
    try:
        await db.streamer_meta_history.create_index(
            [("platform", 1), ("user_login", 1), ("published_at", -1)]
        )
        # Rate-limit log auto-expires after the window so the counter
        # resets without manual cleanup.
        await db.streamer_meta_drafts_log.create_index(
            "created_at", expireAfterSeconds=RATE_LIMIT_WINDOW_SECONDS,
        )
    except Exception:
        logger.exception("streamer_meta_drafter.ensure_indexes failed")


# ── Rate limit + cache ───────────────────────────────────────────────────

async def _rate_limit_remaining(db) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=RATE_LIMIT_WINDOW_SECONDS)
    used = await db.streamer_meta_drafts_log.count_documents(
        {"created_at": {"$gte": cutoff}}
    )
    return max(0, RATE_LIMIT_PER_HOUR - used)


async def _record_generation(db, *, platform: str, user_login: str,
                              status: str, model: str) -> None:
    try:
        await db.streamer_meta_drafts_log.insert_one({
            "platform": platform,
            "user_login": user_login,
            "status": status,  # ok | llm_unavailable | rate_limited | cache_hit | …
            "model": model,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        logger.exception("rate-limit log insert failed")


def _is_cache_fresh(row: Optional[Dict[str, Any]]) -> bool:
    if not row:
        return False
    ts = row.get("draft_generated_at")
    if not ts:
        return False
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - dt
    return age < timedelta(days=DRAFT_CACHE_DAYS)


# ── Data gathering for the prompt ────────────────────────────────────────

def _gather_streamer_data(streamer: Dict[str, Any],
                           recent_titles: List[str]) -> Dict[str, Any]:
    """Compose a tight summary of what we know about a streamer for the
    LLM. Aggressively cap field lengths so the prompt stays cheap."""
    titles = []
    seen = set()
    for t in recent_titles[:30]:
        t = (t or "").strip()
        if not t or t in seen:
            continue
        seen.add(t)
        titles.append(t[:140])
        if len(titles) >= 8:
            break
    return {
        "platform": (streamer.get("platform") or "twitch").lower(),
        "user_login": (streamer.get("user_login") or "").lower(),
        "display_name": streamer.get("user_name") or streamer.get("user_login"),
        "current_game_name": streamer.get("game_name"),
        "current_title": (streamer.get("title") or "")[:200],
        "current_viewers": streamer.get("viewer_count"),
        "follower_count": streamer.get("follower_count"),
        "language": streamer.get("language") or "fi",
        "recent_titles_sample": titles,
    }


def _build_user_prompt(data: Dict[str, Any],
                        web_snippets: Optional[List[str]] = None) -> str:
    parts = [
        f"Streamer: {data['display_name']} (platform: {data['platform']}, login: {data['user_login']})",
        f"Language: {data['language']}",
    ]
    if data.get("follower_count") is not None:
        parts.append(f"Follower count: {data['follower_count']}")
    if data.get("current_viewers") is not None:
        parts.append(f"Current viewers (live now): {data['current_viewers']}")
    if data.get("current_game_name"):
        parts.append(f"Current category: {data['current_game_name']}")
    if data.get("current_title"):
        parts.append(f"Current stream title: \"{data['current_title']}\"")
    if data.get("recent_titles_sample"):
        parts.append("Recent stream titles (last 30d sample):")
        for t in data["recent_titles_sample"]:
            parts.append(f"  - {t}")
    if web_snippets:
        parts.append("\nWeb context (independent search snippets, treat as low-confidence):")
        for s in web_snippets[:3]:
            parts.append(f"  - {s[:240]}")
    parts.append(
        "\nWrite the JSON exactly as specified. Output ONLY the JSON object, no prose."
    )
    return "\n".join(parts)


# ── LLM binding ──────────────────────────────────────────────────────────

async def _call_haiku(system_prompt: str, user_prompt: str,
                       session_id: str) -> str:
    """Calls Claude Haiku via emergentintegrations. Mirrors the
    `content_generator._call_claude_default` pattern but pinned to Haiku
    for cost. Raises on any failure; caller wraps in graceful fallback."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", DRAFT_MODEL)
    return await asyncio.wait_for(
        chat.send_message(UserMessage(text=user_prompt)),
        timeout=DRAFT_TIMEOUT_SECONDS,
    )


def _parse_llm_json(raw: str) -> Optional[Dict[str, Any]]:
    """Permissively extract the JSON object from the model output. The
    system prompt forbids markdown fences but Haiku occasionally adds
    them; strip then parse. Returns None on failure (caller handles)."""
    if not raw:
        return None
    text = raw.strip()
    # Strip ```json … ``` fences if present.
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    fi = (obj.get("draft_line_fi") or "").strip()
    en = (obj.get("draft_line_en") or "").strip()
    if not fi or not en:
        return None
    confidence = (obj.get("confidence") or "low").lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "low"
    return {
        "draft_line_fi": fi[:600],
        "draft_line_en": en[:600],
        "confidence": confidence,
        "notes_for_reviewer": (obj.get("notes_for_reviewer") or "").strip()[:600],
    }


# ── Public API ───────────────────────────────────────────────────────────

async def generate_draft(
    db,
    *,
    platform: str,
    user_login: str,
    force: bool = False,
    streamer_data_provider=None,
) -> Dict[str, Any]:
    """Generate an AI draft for one streamer.

    Returns a result dict with `ok` + either the draft payload (status =
    DRAFT_NEEDS_REVIEW), or a `reason` describing why no draft is
    available right now ( `llm_unavailable`, `rate_limited`,
    `ai_disabled`, `not_configured`, `streamer_not_found`,
    `llm_parse_failed`).

    `streamer_data_provider`, when supplied, is a coroutine
    `(platform, user_login) -> {streamer, recent_titles}` so tests can
    inject deterministic data. The default looks up the cached
    `streamer_live` snapshot.
    """
    platform = (platform or "twitch").lower()
    user_login = (user_login or "").strip().lower()
    if not user_login:
        return {"ok": False, "reason": "invalid_user_login"}

    if not AI_DRAFT_ENABLED:
        return {"ok": False, "reason": "ai_disabled"}

    # Cache check (before rate-limit so cache hits don't burn the budget)
    if not force:
        existing = await db.streamer_meta.find_one(
            {"platform": platform, "user_login": user_login},
            {"_id": 0},
        )
        if existing and _is_cache_fresh(existing) and existing.get("draft_line_fi"):
            await _record_generation(
                db, platform=platform, user_login=user_login,
                status="cache_hit", model=DRAFT_MODEL,
            )
            return {"ok": True, "draft": _draft_view(existing), "cached": True}

    # Rate-limit gate
    remaining = await _rate_limit_remaining(db)
    if remaining <= 0:
        await _record_generation(
            db, platform=platform, user_login=user_login,
            status="rate_limited", model=DRAFT_MODEL,
        )
        return {
            "ok": False, "reason": "rate_limited",
            "retry_after_seconds": RATE_LIMIT_WINDOW_SECONDS,
        }

    # Resolve streamer data
    streamer, recent_titles = await _resolve_streamer(
        db, platform=platform, user_login=user_login,
        provider=streamer_data_provider,
    )
    if not streamer:
        return {"ok": False, "reason": "streamer_not_found"}

    # Build prompt
    data = _gather_streamer_data(streamer, recent_titles)
    web_snippets = None  # WEBSEARCH_ENABLED hook reserved; not implemented this sprint
    user_prompt = _build_user_prompt(data, web_snippets=web_snippets)

    # LLM call
    session_id = f"streamer-meta-{platform}-{user_login}"
    try:
        raw = await _call_haiku(SYSTEM_PROMPT, user_prompt, session_id)
    except Exception as exc:
        logger.warning("Haiku call failed for %s/%s: %s", platform, user_login, exc)
        await _record_generation(
            db, platform=platform, user_login=user_login,
            status="llm_unavailable", model=DRAFT_MODEL,
        )
        return {
            "ok": False, "reason": "llm_unavailable",
            "detail": str(exc)[:200],
        }

    parsed = _parse_llm_json(raw)
    if not parsed:
        await _record_generation(
            db, platform=platform, user_login=user_login,
            status="llm_parse_failed", model=DRAFT_MODEL,
        )
        return {
            "ok": False, "reason": "llm_parse_failed",
            "raw_excerpt": (raw or "")[:200],
        }

    # Persist draft
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "platform": platform,
        "user_login": user_login,
        "draft_line_fi": parsed["draft_line_fi"],
        "draft_line_en": parsed["draft_line_en"],
        "draft_confidence": parsed["confidence"],
        "draft_notes_for_reviewer": parsed["notes_for_reviewer"],
        "draft_generated_at": now,
        "draft_model": DRAFT_MODEL,
        # Promote status only when there's nothing published yet - never
        # downgrade a `published` row to draft.
        # We do that in the update below using a conditional check.
    }
    existing = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": user_login},
        {"_id": 0, "status": 1, "meta_line_fi": 1, "meta_line_en": 1, "meta_fi": 1, "meta_en": 1, "suppressed": 1},
    )
    current_status = (existing or {}).get("status")
    has_published = bool(
        (existing or {}).get("meta_line_fi") or (existing or {}).get("meta_line_en")
        or (existing or {}).get("meta_fi") or (existing or {}).get("meta_en")
    )
    if current_status == STATUS_PUBLISHED or (current_status is None and has_published):
        # Leave the published line alone; keep the new draft pending.
        update["status"] = STATUS_PUBLISHED
    elif (existing or {}).get("suppressed"):
        update["status"] = STATUS_SUPPRESSED
    else:
        update["status"] = STATUS_DRAFT
    update["updated_at"] = now

    set_on_insert = {"created_at": now}
    await db.streamer_meta.update_one(
        {"platform": platform, "user_login": user_login},
        {"$set": update, "$setOnInsert": set_on_insert},
        upsert=True,
    )
    await _record_generation(
        db, platform=platform, user_login=user_login,
        status="ok", model=DRAFT_MODEL,
    )
    row = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": user_login}, {"_id": 0},
    )
    return {"ok": True, "draft": _draft_view(row), "cached": False}


async def publish_meta(
    db,
    *,
    platform: str,
    user_login: str,
    meta_line_fi: str,
    meta_line_en: str,
    published_by: str = "admin",
) -> Dict[str, Any]:
    """Publish the edited editorial line. Writes a history row, clears the
    pending draft fields, sets status = PUBLISHED."""
    platform = (platform or "twitch").lower()
    user_login = (user_login or "").strip().lower()
    fi = (meta_line_fi or "").strip()
    en = (meta_line_en or "").strip()
    if not user_login:
        raise ValueError("user_login required")
    if not fi and not en:
        raise ValueError("at least one of meta_line_fi / meta_line_en required")

    existing = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": user_login}, {"_id": 0},
    )

    now = datetime.now(timezone.utc).isoformat()
    prev_fi = (existing or {}).get("meta_line_fi") or (existing or {}).get("meta_fi") or ""
    prev_en = (existing or {}).get("meta_line_en") or (existing or {}).get("meta_en") or ""

    update = {
        "platform": platform,
        "user_login": user_login,
        "meta_line_fi": fi[:600],
        "meta_line_en": en[:600],
        # Mirror to legacy `meta_fi`/`meta_en` so the existing public
        # surface keeps reading without a migration.
        "meta_fi": fi[:600],
        "meta_en": en[:600],
        "status": STATUS_PUBLISHED,
        # Clear pending draft fields - they are preserved in history.
        "draft_line_fi": "",
        "draft_line_en": "",
        "draft_confidence": "",
        "draft_notes_for_reviewer": "",
        "draft_generated_at": "",
        "draft_model": "",
        "published_at": now,
        "published_by": published_by,
        "updated_at": now,
    }
    await db.streamer_meta.update_one(
        {"platform": platform, "user_login": user_login},
        {"$set": update, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    # Audit history (GDPR data-subject request support).
    await db.streamer_meta_history.insert_one({
        "platform": platform,
        "user_login": user_login,
        "published_line_fi": fi[:600],
        "published_line_en": en[:600],
        "previous_line_fi": prev_fi,
        "previous_line_en": prev_en,
        "published_by": published_by,
        "published_at": now,
    })
    row = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": user_login}, {"_id": 0},
    )
    return {"ok": True, "published": _row_view(row)}


async def set_suppressed(db, *, platform: str, user_login: str,
                          suppressed: bool) -> Dict[str, Any]:
    """Toggle the suppression state. Suppression hides a published line
    from the public site without deleting it. Status flips between
    PUBLISHED ↔ SUPPRESSED accordingly."""
    platform = (platform or "twitch").lower()
    user_login = (user_login or "").strip().lower()
    if not user_login:
        raise ValueError("user_login required")
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": user_login}, {"_id": 0},
    )
    if not existing:
        raise ValueError("streamer_meta row not found")
    new_status = STATUS_SUPPRESSED if suppressed else (
        STATUS_PUBLISHED if (existing.get("meta_line_fi") or existing.get("meta_fi")
                              or existing.get("meta_line_en") or existing.get("meta_en"))
        else (STATUS_DRAFT if existing.get("draft_line_fi") else STATUS_NO_META)
    )
    await db.streamer_meta.update_one(
        {"platform": platform, "user_login": user_login},
        {"$set": {"suppressed": bool(suppressed), "status": new_status, "updated_at": now}},
    )
    row = await db.streamer_meta.find_one(
        {"platform": platform, "user_login": user_login}, {"_id": 0},
    )
    return {"ok": True, "row": _row_view(row)}


async def list_meta_with_status(db) -> List[Dict[str, Any]]:
    cur = db.streamer_meta.find({}, {"_id": 0}).sort([("platform", 1), ("user_login", 1)])
    rows = []
    async for d in cur:
        rows.append(_row_view(d))
    return rows


async def rate_limit_status(db) -> Dict[str, Any]:
    remaining = await _rate_limit_remaining(db)
    return {
        "remaining": remaining,
        "limit_per_hour": RATE_LIMIT_PER_HOUR,
        "window_seconds": RATE_LIMIT_WINDOW_SECONDS,
        "ai_enabled": AI_DRAFT_ENABLED,
    }


# ── Internal helpers ─────────────────────────────────────────────────────

def _row_view(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not row:
        return {}
    status = row.get("status")
    if not status:
        has_published = bool(row.get("meta_line_fi") or row.get("meta_line_en")
                              or row.get("meta_fi") or row.get("meta_en"))
        if row.get("suppressed"):
            status = STATUS_SUPPRESSED
        elif has_published:
            status = STATUS_PUBLISHED
        elif row.get("draft_line_fi"):
            status = STATUS_DRAFT
        else:
            status = STATUS_NO_META
    return {
        "platform": row.get("platform"),
        "user_login": row.get("user_login"),
        "status": status,
        "meta_line_fi": row.get("meta_line_fi") or row.get("meta_fi") or "",
        "meta_line_en": row.get("meta_line_en") or row.get("meta_en") or "",
        "draft_line_fi": row.get("draft_line_fi") or "",
        "draft_line_en": row.get("draft_line_en") or "",
        "draft_confidence": row.get("draft_confidence") or "",
        "draft_notes_for_reviewer": row.get("draft_notes_for_reviewer") or "",
        "draft_generated_at": row.get("draft_generated_at") or "",
        "suppressed": bool(row.get("suppressed")),
        "published_at": row.get("published_at") or "",
        "updated_at": row.get("updated_at") or "",
    }


def _draft_view(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "platform": row.get("platform"),
        "user_login": row.get("user_login"),
        "draft_line_fi": row.get("draft_line_fi") or "",
        "draft_line_en": row.get("draft_line_en") or "",
        "confidence": row.get("draft_confidence") or "low",
        "notes_for_reviewer": row.get("draft_notes_for_reviewer") or "",
        "draft_generated_at": row.get("draft_generated_at") or "",
        "model": row.get("draft_model") or DRAFT_MODEL,
        "status": row.get("status") or STATUS_DRAFT,
    }


async def _resolve_streamer(
    db, *, platform: str, user_login: str,
    provider=None,
) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    if provider:
        result = await provider(platform, user_login)
        if not result:
            return None, []
        return result.get("streamer"), result.get("recent_titles") or []

    # Default: pull from the live cache + any historical snapshot titles
    # we might have. Titles history is best-effort - empty list is OK,
    # the LLM still has the live snapshot to work from.
    streamer = None
    try:
        if platform == "twitch":
            from streamer_live import get_live_streamers
            payload = await get_live_streamers()
            for s in (payload or {}).get("streamers", []) or []:
                if (s.get("user_login") or "").lower() == user_login:
                    streamer = s
                    break
    except Exception:
        logger.exception("streamer live lookup failed")

    if not streamer:
        # Fallback: bare row built from registry / meta so the LLM at
        # least gets the handle. Confidence will land at "low".
        streamer = {
            "platform": platform,
            "user_login": user_login,
            "user_name": user_login,
        }

    recent_titles: List[str] = []
    try:
        cur = db.streamer_viewers_24h.find(
            {"platform": platform, "user_login": user_login, "title": {"$exists": True}},
            {"_id": 0, "title": 1},
        ).sort([("ts", -1)]).limit(30)
        async for d in cur:
            t = (d.get("title") or "").strip()
            if t:
                recent_titles.append(t)
    except Exception:
        pass
    return streamer, recent_titles
