"""
iter91 · Public OG image resolver for high-value editorial pages.

A small, allow-listed surface that lazily mints OG images via the
existing `ensure_og_image()` Nano Banana pipeline and 302-redirects
to the cached public URL. Used by:

  GET /api/og/page/{slug}

Currently exposed slugs (each with a curated headline + category so
Nano Banana produces an editorial card consistent with the brand):

  - trust-hub-fi       /luotettavuus
  - trust-hub-en       /en/trust

Why a dedicated endpoint instead of `<link>`-attached static images:
  1. First load mints lazily, subsequent loads hit the cached PNG.
  2. The component side stays declarative — drop a stable URL into
     `<meta property="og:image">` and let the back-end handle the
     "is this generated yet" question.
  3. Crawlers (Telegram, FB, X) follow the redirect once, then they
     cache the resolved URL themselves — no churn on our side.

If `ensure_og_image` returns None (Nano Banana disabled / API key
missing / generation failed) we 404 so the consumer can omit the
`og:image` tag rather than ship a broken reference.
"""
from __future__ import annotations

import logging
from typing import Dict

from fastapi import APIRouter, HTTPException, Response

logger = logging.getLogger(__name__)

# Allow-list of page slugs → (display slug for cache file, headline, category).
# Anyone touching this dict should keep the cache slug stable — changing it
# silently invalidates every social-card preview already in the wild.
PAGE_OG_PROFILES: Dict[str, Dict[str, str]] = {
    "trust-hub-fi": {
        "cache_slug": "trust-hub-fi",
        "headline": "Luotettavuus — miten PUTKI HQ mittaa itseään",
        "category": "Luotettavuus",
    },
    "trust-hub-en": {
        "cache_slug": "trust-hub-en",
        "headline": "Trust — how PUTKI HQ measures itself",
        "category": "Trust",
    },
}


def build_page_og_router() -> APIRouter:
    router = APIRouter(prefix="/og", tags=["og-public"])

    @router.get("/page/{slug}")
    async def resolve_page_og(slug: str):
        profile = PAGE_OG_PROFILES.get(slug)
        if not profile:
            raise HTTPException(status_code=404, detail="unknown_og_slug")

        # Late import — keeps the router import chain off the heavy
        # emergentintegrations dependency at module load time.
        from og_image_generator import ensure_og_image

        try:
            url = await ensure_og_image(
                profile["cache_slug"],
                profile["headline"],
                profile.get("category"),
            )
        except Exception:  # noqa: BLE001
            logger.exception("page-og: ensure_og_image raised for %s", slug)
            url = None

        if not url:
            # No card available right now (Nano Banana off, or generation
            # failed). 404 lets the consumer omit og:image cleanly.
            raise HTTPException(status_code=404, detail="og_unavailable")

        # 302 to the static, cached PNG. Browsers + social crawlers
        # cache the redirect target themselves for next time.
        return Response(
            status_code=302,
            headers={
                "Location": url,
                "Cache-Control": "public, max-age=3600",
            },
        )

    return router
