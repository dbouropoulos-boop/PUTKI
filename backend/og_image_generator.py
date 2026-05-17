"""
PUTKI HQ — OG image generator powered by Gemini Nano Banana.

Generates a 1200x630 social-card image for any auto-published Finnish
editorial article. Images are stored to disk under /app/backend/static/og/
and served via the FastAPI StaticFiles mount at /api/static/og/<slug>.png.

Strategy:
  • Cheap: only generate once per (slug, category). Subsequent calls return
    the cached URL.
  • Honest: if generation fails (LLM gateway flake, key missing) we return
    None so the content_generator falls through to the default category
    SVG — no broken/half-baked OG cards.

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

    NEVER raises — content_generator's OG resolution must remain resilient.
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
