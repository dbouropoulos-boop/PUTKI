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
    # ── Homepage cover (iter96c) ────────────────────────────────────
    "home-fi": {
        "cache_slug": "home-fi",
        "headline": "PUTKI HQ — Suomen riippumaton pelikulttuurin julkaisu",
        "category": "Kansi",
    },
    "home-en": {
        "cache_slug": "home-en",
        "headline": "PUTKI HQ — Finland's independent gambling culture publication",
        "category": "Cover",
    },
    # ── Trust hub capstone ─────────────────────────────────────────
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
    # ── Wave-1 deep pages (Reform 2027 + 7 /pelit/* guides) ────────
    "reform-2027-fi":   {"cache_slug": "reform-2027-fi",   "headline": "Suomen rahapelilaki 2025/2027 — selkokielellä", "category": "Sääntely"},
    "reform-2027-en":   {"cache_slug": "reform-2027-en",   "headline": "Finnish Gambling Act 2025/2027 — plain language", "category": "Regulation"},
    "pelit-blackjack-fi": {"cache_slug": "pelit-blackjack-fi", "headline": "Blackjack — perusstrategia ja sivupanokset", "category": "Pelit"},
    "pelit-blackjack-en": {"cache_slug": "pelit-blackjack-en", "headline": "Blackjack — basic strategy and side bets",     "category": "Games"},
    "pelit-poker-fi":   {"cache_slug": "pelit-poker-fi",   "headline": "Poker — pot odds ja video poker -matematiikka",   "category": "Pelit"},
    "pelit-poker-en":   {"cache_slug": "pelit-poker-en",   "headline": "Poker — pot odds + video poker math",             "category": "Games"},
    "pelit-slotit-fi":  {"cache_slug": "pelit-slotit-fi",  "headline": "Slotit — RTP, volatiliteetti, bonus buy",         "category": "Pelit"},
    "pelit-slotit-en":  {"cache_slug": "pelit-slotit-en",  "headline": "Slots — RTP, volatility, bonus buy",              "category": "Games"},
    "pelit-craps-fi":   {"cache_slug": "pelit-craps-fi",   "headline": "Craps — vetojen matemaattinen järjestys",         "category": "Pelit"},
    "pelit-craps-en":   {"cache_slug": "pelit-craps-en",   "headline": "Craps — bets ranked by math",                     "category": "Games"},
    "pelit-ruletti-fi": {"cache_slug": "pelit-ruletti-fi", "headline": "Ruletti — valitse ratas, ei vetoa",               "category": "Pelit"},
    "pelit-ruletti-en": {"cache_slug": "pelit-ruletti-en", "headline": "Roulette — pick the wheel, not the bet",          "category": "Games"},
    "pelit-live-fi":    {"cache_slug": "pelit-live-fi",    "headline": "Live-kasino — studio, RNG, latenssi",             "category": "Pelit"},
    "pelit-live-en":    {"cache_slug": "pelit-live-en",    "headline": "Live casino — studio, RNG, latency",              "category": "Games"},
    "pelit-bonusmath-fi": {"cache_slug": "pelit-bonusmath-fi", "headline": "Bonusmatematiikka — miksi 35× tappaa",        "category": "Pelit"},
    "pelit-bonusmath-en": {"cache_slug": "pelit-bonusmath-en", "headline": "Bonus math — why 35× kills the EV",           "category": "Games"},
    # ── Wave-2 long-form articles ──────────────────────────────────
    "mestari-method-fi":   {"cache_slug": "mestari-method-fi",   "headline": "Mestari-diagnostiikat — menetelmä selkokielellä", "category": "Menetelmä"},
    "mestari-method-en":   {"cache_slug": "mestari-method-en",   "headline": "Mestari diagnostics — methodology in plain language", "category": "Methodology"},
    "mittari-sources-fi":  {"cache_slug": "mittari-sources-fi",  "headline": "Mittari — 28 nimettyä lähdettä",                  "category": "Lähteet"},
    "mittari-sources-en":  {"cache_slug": "mittari-sources-en",  "headline": "Mittari — 28 named sources",                      "category": "Sources"},
    "voita-faq-fi":        {"cache_slug": "voita-faq-fi",        "headline": "Voita-arvonnat — 10 vastausta",                   "category": "Voita"},
    "voita-faq-en":        {"cache_slug": "voita-faq-en",        "headline": "Voita raffles — 10 answers",                      "category": "Voita"},
    "founder-qa-fi":       {"cache_slug": "founder-qa-fi",       "headline": "Dioni Bouropoulos — PUTKI HQ -perustajan Q&A",    "category": "Profiilit"},
    "founder-qa-en":       {"cache_slug": "founder-qa-en",       "headline": "Dioni Bouropoulos — PUTKI HQ founder Q&A",        "category": "Profiilit"},
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
