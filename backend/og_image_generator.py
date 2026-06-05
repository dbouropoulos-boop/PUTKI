"""
PUTKI HQ - OG image generator powered by Gemini Nano Banana.

Generates a 1200x630 social-card image for any auto-published Finnish
editorial article. Images are stored to disk under /app/backend/static/og/
and served via the FastAPI StaticFiles mount at /api/static/og/<slug>.png.

Strategy:
  • Cheap: only generate once per (slug, category). Subsequent calls return
    the cached URL.
  • Honest: if generation fails (LLM gateway flake, key missing) we return
    None so the content_generator falls through to the default category
    SVG - no broken/half-baked OG cards.

Triggered from content_generator at publish time so the image is ready by
the time social scrapers hit the canonical URL.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Match the location FastAPI mounts at /api/static/
STATIC_ROOT = Path(__file__).parent / "static"
OG_DIR = STATIC_ROOT / "og"
PUBLIC_PREFIX = os.environ.get("OG_IMAGE_PUBLIC_PREFIX", "/api/static/og")
NANO_BANANA_MODEL = os.environ.get("OG_IMAGE_MODEL", "gemini-3.1-flash-image-preview")

# Concurrency cap - Nano Banana calls take 15-25s each and the live preview
# pod runs uvicorn with --workers 1. Without this cap, a few concurrent
# publishes stall every other API request (404 lookups, drafts list, etc.).
_GENERATION_SEMAPHORE = asyncio.Semaphore(int(os.environ.get("OG_IMAGE_CONCURRENCY", "1")))

# Single-shot generation lock so a hot publish burst doesn't spawn 5
# parallel Nano Banana calls for the same slug.
_inflight: dict[str, asyncio.Task] = {}


CATEGORY_DIRECTIVES = {
    "urheilijat":  "Editorial sports-news cover. Bold typographic layout, deep blue + cream, no hockey logos, no real player faces, abstract rink-light glow, premium magazine feel.",
    "striimaajat": "Editorial streamer-news cover. Dark studio lighting, RGB key-light bleed, no real faces, abstract twitch-purple gradient, GQ x Complex magazine vibe.",
    "saannot":     "Editorial regulation-news cover. Deep red wash, minimalist Helvetica-style title block, single legal-document silhouette, Bloomberg seriousness.",
    "kasinot":     "Editorial casino-industry cover. Muted gold + black, no slot symbols, no real logos, abstract chip-stack silhouette, Monocle magazine restraint.",
    "raha":        "Editorial money-feature cover. Burnt orange accent on cream, single coin-stack motif, Bloomberg/Monocle typographic register.",
}

# Phase 1 Sprint 4 share-OG: Mittari state-card directives. The state name
# is the centrepiece, color must match the dial palette, no marketing chrome.
MITTARI_STATE_DIRECTIVES = {
    "KYLMA":      ("TYYNI",    "muted teal sauna-evening calm",        "#5C8A8A"),
    "HAALEA":     ("VIRE",     "soft green-teal early-morning stir",   "#6FA37D"),
    "KUUMA":      ("VIPINÄ",   "warm yellow late-afternoon buzz",      "#D4B445"),
    "MYRSKY":     ("MEININKI", "amber/dark-orange evening intensity",  "#C97A3A"),
    "KIIRASTULI": ("PERKE*LE",  "saturated red full-perkele top state", "#C13B2C"),
}


DEFAULT_DIRECTIVE = (
    "Editorial Finnish gambling-news cover image. Minimalist, premium magazine style. "
    "No real faces, no real logos, no slot symbols. 1200x630 social-card composition."
)


def _slugify(value: str) -> str:
    """Tighten input to a safe filename fragment."""
    v = re.sub(r"[^a-z0-9-]+", "-", (value or "").lower())
    v = re.sub(r"-+", "-", v).strip("-")
    return v[:80] or f"og-{uuid.uuid4().hex[:8]}"


def _output_path(slug: str) -> Path:
    return OG_DIR / f"{slug}.png"


def public_url(slug: str) -> str:
    return f"{PUBLIC_PREFIX}/{slug}.png"


def is_enabled() -> bool:
    """Disable hook for ops + tests."""
    return os.environ.get("PUTKI_HQ_DISABLE_OG_IMAGES", "0") != "1"


async def _generate_once(slug: str, headline: str, category: Optional[str]) -> Optional[str]:
    """Actual Nano Banana call. Returns public URL on success, None on failure.

    NEVER raises - content_generator's OG resolution must remain resilient.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.info("OG image generation skipped: EMERGENT_LLM_KEY unset")
        return None

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        logger.warning("emergentintegrations not installed; OG image generation disabled")
        return None

    OG_DIR.mkdir(parents=True, exist_ok=True)
    directive = CATEGORY_DIRECTIVES.get((category or "").lower(), DEFAULT_DIRECTIVE)
    prompt = (
        f"{directive}\n\n"
        f"Article headline (Finnish): {headline.strip()[:140]}\n"
        f"Render the headline as bold display typography but keep it secondary to the visual mood. "
        f"Aspect ratio strictly 1200x630 (social/og card). No watermarks, no website URLs in the image."
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"og-image-{slug}",
            system_message="You are an editorial art director generating OG card images.",
        )
        chat.with_model("gemini", NANO_BANANA_MODEL).with_params(modalities=["image", "text"])
        msg = UserMessage(text=prompt)
        async with _GENERATION_SEMAPHORE:
            _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.warning("Nano Banana call failed for %s: %s", slug, e)
        return None

    if not images:
        logger.info("Nano Banana returned no images for %s", slug)
        return None

    try:
        img_bytes = base64.b64decode(images[0]["data"])
        path = _output_path(slug)
        path.write_bytes(img_bytes)
        return public_url(slug)
    except Exception as e:
        logger.warning("Failed to persist OG image for %s: %s", slug, e)
        return None


async def ensure_og_image(slug: str, headline: str, category: Optional[str] = None) -> Optional[str]:
    """Return the public URL of the OG image for `slug`, generating one
    via Nano Banana if it doesn't exist yet. Cached on disk indefinitely
    (overwrite by deleting the file)."""
    if not is_enabled() or not slug or not headline:
        return None

    safe = _slugify(slug)
    target = _output_path(safe)
    if target.exists() and target.stat().st_size > 0:
        return public_url(safe)

    # Coalesce concurrent generations for the same slug.
    if safe in _inflight:
        try:
            return await _inflight[safe]
        except Exception:
            return None

    task = asyncio.create_task(_generate_once(safe, headline, category))
    _inflight[safe] = task
    try:
        return await task
    finally:
        _inflight.pop(safe, None)


# ─────────────────────── Phase 1 Sprint 4 - Mittari state cards ───────────────────────

def mittari_og_slug(state_key: str, date_iso: str) -> str:
    """Stable filename slug for the state-card image."""
    return f"mittari-{state_key.lower()}-{date_iso}"


def mittari_og_url(state_key: str, date_iso: str) -> str:
    """Public URL for the cached Mittari state-card."""
    return public_url(mittari_og_slug(state_key, date_iso))


def mittari_og_exists(state_key: str, date_iso: str) -> bool:
    p = _output_path(mittari_og_slug(state_key, date_iso))
    return p.exists() and p.stat().st_size > 0


async def _generate_mittari_card(state_key: str,
                                 date_iso: str,
                                 reading_fi: str) -> Optional[str]:
    """Internal - single Nano Banana call for one Mittari state card.
    Idempotent: returns the cached URL if the file already exists."""
    if mittari_og_exists(state_key, date_iso):
        return mittari_og_url(state_key, date_iso)

    label, mood, hex_color = MITTARI_STATE_DIRECTIVES.get(state_key, MITTARI_STATE_DIRECTIVES["KYLMA"])
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.info("Mittari OG skipped: EMERGENT_LLM_KEY unset")
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception:
        logger.warning("emergentintegrations not installed; Mittari OG disabled")
        return None

    OG_DIR.mkdir(parents=True, exist_ok=True)
    prompt = (
        f"Editorial Mittari state-card for PUTKI HQ - Finnish independent media outlet. "
        f"1200x630 social-card composition.\n"
        f"State name: \"{label}\" - render as massive bold display typography, "
        f"top-left, dominating 60% of the canvas.\n"
        f"Color palette anchored on {hex_color} ({mood}). Warm near-black background (#0D0C0A) "
        f"or cream (#F7F2EA) if light mode would feel right - your call as art director. "
        f"Subtle grain texture. No gradients on dark; layered solids only.\n"
        f"Subtitle line, monospace, lower-third: \"{reading_fi[:120]}\".\n"
        f"URL stamp at very bottom-right in tiny monospace: \"putkihq.fi/m/{label.lower()}-{date_iso}\".\n"
        f"NO real faces, NO real logos, NO slot symbols, NO casino imagery, NO emojis, NO 18+ stamps. "
        f"Bloomberg/Monocle restraint. Treat this like a magazine cover, not a banner ad."
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"og-mittari-{state_key}-{date_iso}",
            system_message="You are an editorial art director generating Mittari state-card images for PUTKI HQ.",
        )
        chat.with_model("gemini", NANO_BANANA_MODEL).with_params(modalities=["image", "text"])
        msg = UserMessage(text=prompt)
        async with _GENERATION_SEMAPHORE:
            _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.warning("Mittari OG Nano Banana call failed for %s/%s: %s", state_key, date_iso, e)
        return None

    if not images:
        logger.info("Mittari OG Nano Banana returned no images for %s/%s", state_key, date_iso)
        return None

    try:
        img_bytes = base64.b64decode(images[0]["data"])
        path = _output_path(mittari_og_slug(state_key, date_iso))
        path.write_bytes(img_bytes)
        return public_url(mittari_og_slug(state_key, date_iso))
    except Exception as e:
        logger.warning("Failed to persist Mittari OG for %s/%s: %s", state_key, date_iso, e)
        return None


async def ensure_mittari_state_og(state_key: str,
                                  date_iso: str,
                                  reading_fi: str) -> Optional[str]:
    """Cache-or-generate the Mittari state-card image.

    Idempotent. Returns the public URL on success, None on failure (kill
    switch active, LLM unavailable, persistence failed). Concurrent calls
    for the same (state, date) coalesce into a single Nano Banana request.
    """
    if not is_enabled() or not state_key or not date_iso:
        return None
    if state_key not in MITTARI_STATE_DIRECTIVES:
        return None

    slug = mittari_og_slug(state_key, date_iso)
    if mittari_og_exists(state_key, date_iso):
        return public_url(slug)

    if slug in _inflight:
        try:
            return await _inflight[slug]
        except Exception:
            return None

    task = asyncio.create_task(_generate_mittari_card(state_key, date_iso, reading_fi))
    _inflight[slug] = task
    try:
        return await task
    finally:
        _inflight.pop(slug, None)
