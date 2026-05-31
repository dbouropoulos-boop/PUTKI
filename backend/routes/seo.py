"""
PUTKI HQ — sitemap.xml + robots.txt (Phase 4).

Surfaces a deterministic list of public routes for search engines.
The home page already pulls in JSON-LD via the React tree; this
endpoint just provides the discovery layer.

We split the sitemap into two sections:
  1. STATIC_ROUTES — known SPA routes that don't change.
  2. DYNAMIC_VOITA — every active Voita raffle (from MongoDB), so
     fresh raffles appear in the sitemap minutes after they're
     created.

The endpoint is mounted as `/api/seo/sitemap.xml`. We also serve
`/api/seo/robots.txt` that points at it. The frontend nginx already
rewrites everything-non-/api to React, so production setups can
either reverse-proxy /sitemap.xml -> /api/seo/sitemap.xml at the
edge, or accept the /api/seo/ prefix.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Tuple
from xml.sax.saxutils import escape

from fastapi import APIRouter, Response

# Public-facing canonical origin. Kept here (not env) so the sitemap
# is deterministic and reproducible.
CANONICAL_ORIGIN = "https://putkihq.com"

# (path, changefreq, priority)
STATIC_ROUTES: List[Tuple[str, str, str]] = [
    ("/",               "hourly",  "1.0"),
    ("/mittari",        "daily",   "0.95"),
    ("/mittari/lahteet", "monthly", "0.8"),
    ("/mestari",        "weekly",  "0.9"),
    ("/mestari/sports", "weekly",  "0.85"),
    ("/mestari/poker",  "weekly",  "0.85"),
    ("/mestari/blackjack", "weekly", "0.85"),
    ("/mestari/menetelma", "monthly", "0.8"),
    ("/voita",          "daily",   "0.85"),
    ("/voita/usein-kysytyt", "monthly", "0.75"),
    ("/profiilit",      "weekly",  "0.6"),
    ("/profiilit/dioni-q-and-a", "monthly", "0.75"),
    # iter88 · Phase 4 wave 2 localisation — EN canonicals
    ("/en/mestari/methodology",    "monthly", "0.7"),
    ("/en/mittari/sources",        "monthly", "0.7"),
    ("/en/voita/faq",              "monthly", "0.7"),
    ("/en/profiilit/dioni-q-and-a", "monthly", "0.7"),
    # iter88 · Phase 4 wave 4 — trust-signal data pages (FI + EN)
    ("/trust/mestari-aineisto",    "weekly",  "0.75"),
    ("/trust/voita-tilikirja",     "weekly",  "0.75"),
    ("/trust/mittari-tarkkuus",    "weekly",  "0.75"),
    ("/en/trust/mestari-dataset",  "weekly",  "0.7"),
    ("/en/trust/voita-ledger",     "weekly",  "0.7"),
    ("/en/trust/mittari-accuracy", "weekly",  "0.7"),
    # iter89 · Phase 4 localisation — wave-1 deep pages (EN canonicals)
    ("/en/regulation/reform-2027", "monthly", "0.8"),
    ("/en/games/blackjack",        "monthly", "0.65"),
    ("/en/games/poker",            "monthly", "0.5"),
    ("/en/games/slots",            "monthly", "0.65"),
    ("/en/games/craps",            "monthly", "0.45"),
    ("/en/games/roulette",         "monthly", "0.45"),
    ("/en/games/live",             "monthly", "0.45"),
    ("/en/games/bonus-math",       "monthly", "0.65"),
    ("/saantely",       "monthly", "0.55"),
    ("/saantely/reform-2027", "monthly", "0.85"),
    ("/sponsoroinnit",  "monthly", "0.4"),
    ("/raha",           "monthly", "0.4"),
    ("/kulttuuri",      "monthly", "0.4"),
    ("/pelit",                "weekly",  "0.6"),
    ("/pelit/blackjack",      "monthly", "0.7"),
    ("/pelit/slotit",         "monthly", "0.7"),
    ("/pelit/bonusmatematiikka", "monthly", "0.7"),
    ("/pelit/poker",          "monthly", "0.55"),
    ("/pelit/craps",          "monthly", "0.5"),
    ("/pelit/ruletti",        "monthly", "0.5"),
    ("/pelit/live",           "monthly", "0.5"),
    ("/peli",           "weekly",  "0.7"),
    ("/pelisignaalit",  "daily",   "0.8"),
    ("/tietoa-meista",  "monthly", "0.4"),
    ("/luotettavuus",   "monthly", "0.4"),
    ("/yhteystiedot",   "monthly", "0.3"),
    ("/lehdistolle",    "monthly", "0.3"),
    ("/tilauspalvelu",  "monthly", "0.3"),
    ("/peliongelma",    "monthly", "0.4"),
    ("/affiliaatti",    "monthly", "0.4"),
    ("/toimitus",       "monthly", "0.4"),
    ("/ehdot",          "yearly",  "0.2"),
    ("/yksityisyys",    "yearly",  "0.2"),
]


# FI ↔ EN locale pairs. Each entry produces TWO sitemap rows (FI + EN),
# both carrying mutual <xhtml:link rel="alternate" hreflang> blocks so
# Google can discover the localised pair without crawling each URL.
LOCALE_PAIRS: List[Tuple[str, str, str, str]] = [
    # (fi_path, en_path, changefreq, priority)
    ("/luotettavuus",            "/en/trust",                       "weekly",  "0.85"),
    ("/mestari/menetelma",       "/en/mestari/methodology",         "monthly", "0.8"),
    ("/mittari/lahteet",         "/en/mittari/sources",             "monthly", "0.8"),
    ("/voita/usein-kysytyt",     "/en/voita/faq",                   "monthly", "0.75"),
    ("/profiilit/dioni-q-and-a", "/en/profiilit/dioni-q-and-a",     "monthly", "0.75"),
    ("/trust/mestari-aineisto",  "/en/trust/mestari-dataset",       "weekly",  "0.75"),
    ("/trust/voita-tilikirja",   "/en/trust/voita-ledger",          "weekly",  "0.75"),
    ("/trust/mittari-tarkkuus",  "/en/trust/mittari-accuracy",      "weekly",  "0.75"),
    ("/saantely/reform-2027",    "/en/regulation/reform-2027",      "monthly", "0.85"),
    ("/pelit/blackjack",         "/en/games/blackjack",             "monthly", "0.7"),
    ("/pelit/poker",             "/en/games/poker",                 "monthly", "0.55"),
    ("/pelit/slotit",            "/en/games/slots",                 "monthly", "0.7"),
    ("/pelit/craps",             "/en/games/craps",                 "monthly", "0.5"),
    ("/pelit/ruletti",           "/en/games/roulette",              "monthly", "0.5"),
    ("/pelit/live",              "/en/games/live",                  "monthly", "0.5"),
    ("/pelit/bonusmatematiikka", "/en/games/bonus-math",            "monthly", "0.7"),
]

# Paths that belong to a locale pair — pulled out of STATIC_ROUTES so
# we never emit them twice in the sitemap.
_LOCALE_PAIRED_PATHS = {fi for fi, _, _, _ in LOCALE_PAIRS} | {en for _, en, _, _ in LOCALE_PAIRS}


def build_sitemap_router(db) -> APIRouter:
    router = APIRouter(prefix="/seo", tags=["seo"])

    @router.get("/sitemap.xml")
    async def sitemap_xml():
        now_iso = datetime.now(timezone.utc).date().isoformat()

        # ── Static routes (locale-paired entries skipped — they're
        #    emitted with xhtml:link blocks below) ────────────────
        entries: List[str] = []
        for path, freq, prio in STATIC_ROUTES:
            if path in _LOCALE_PAIRED_PATHS:
                continue
            entries.append(
                "  <url>\n"
                f"    <loc>{escape(CANONICAL_ORIGIN + path)}</loc>\n"
                f"    <lastmod>{now_iso}</lastmod>\n"
                f"    <changefreq>{freq}</changefreq>\n"
                f"    <priority>{prio}</priority>\n"
                "  </url>"
            )

        # ── Locale-paired routes — emit BOTH halves of each pair
        #    with mutual <xhtml:link rel="alternate" hreflang> blocks. ─
        for fi_path, en_path, freq, prio in LOCALE_PAIRS:
            fi_url = escape(CANONICAL_ORIGIN + fi_path)
            en_url = escape(CANONICAL_ORIGIN + en_path)
            alts = (
                f'    <xhtml:link rel="alternate" hreflang="fi-FI" href="{fi_url}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="en-FI" href="{en_url}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{fi_url}"/>\n'
            )
            for url in (fi_url, en_url):
                entries.append(
                    "  <url>\n"
                    f"    <loc>{url}</loc>\n"
                    f"    <lastmod>{now_iso}</lastmod>\n"
                    f"    <changefreq>{freq}</changefreq>\n"
                    f"    <priority>{prio}</priority>\n"
                    + alts +
                    "  </url>"
                )

        # ── Dynamic Voita raffles ───────────────────────────────
        try:
            cursor = db.voita_raffles.find(
                {"status": {"$in": ["open", "locked", "drawn", "paid"]}},
                {"_id": 0, "slug": 1, "updated_at": 1},
            )
            async for raffle in cursor:
                slug = raffle.get("slug")
                if not slug:
                    continue
                lastmod_raw = raffle.get("updated_at") or now_iso
                lastmod = (
                    lastmod_raw[:10]
                    if isinstance(lastmod_raw, str)
                    else now_iso
                )
                entries.append(
                    "  <url>\n"
                    f"    <loc>{escape(f'{CANONICAL_ORIGIN}/voita/{slug}')}</loc>\n"
                    f"    <lastmod>{lastmod}</lastmod>\n"
                    "    <changefreq>daily</changefreq>\n"
                    "    <priority>0.7</priority>\n"
                    "  </url>"
                )
        except Exception:
            # A db hiccup must not break the sitemap — static routes
            # are still served.
            pass

        body = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
            '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + "\n".join(entries)
            + "\n</urlset>\n"
        )
        return Response(content=body, media_type="application/xml")

    @router.get("/robots.txt")
    async def robots_txt():
        body = (
            "User-agent: *\n"
            "Allow: /\n"
            "Disallow: /back-office\n"
            "Disallow: /api/admin\n"
            f"Sitemap: {CANONICAL_ORIGIN}/api/seo/sitemap.xml\n"
        )
        return Response(content=body, media_type="text/plain")

    return router
