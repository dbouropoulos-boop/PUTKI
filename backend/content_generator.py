"""
PUTKI HQ — Phase 4 Week 2 ContentGenerator
==========================================

Takes a Layer 2 signal payload, picks the right template, fetches editorial
context, calls Claude via the Emergent LLM key, then either auto-publishes
(TIER 1) or saves to `content_drafts` for human review (TIER 2).

De-duplication: every generated piece carries a `fingerprint` derived from
the subject + event + date. The generator refuses to produce a second piece
matching an existing fingerprint within `dedup_window_hours` (default 24h)
so the same NHL game / regulatory story / streamer alert never gets
rewritten because it surfaced across multiple sources.

Rate limit: at most 10 auto-generated pieces per rolling 60min window
(matches the spec). Hits that exceed the limit fall through to TIER 2
draft so editorial can decide.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


TIER_AUTO = 1   # full auto-publish
TIER_DRAFT = 2  # human review before publish
TIER_MANUAL = 3 # signal only, no generation

RATE_LIMIT_PER_HOUR = int(os.environ.get("CONTENT_GENERATOR_HOURLY_CAP", "10"))
DEDUP_WINDOW_HOURS = int(os.environ.get("CONTENT_GENERATOR_DEDUP_WINDOW_HOURS", "24"))
# ─────────────────── Editorial guidelines (per launch brief) ───────────────────
#
# Locked-in by Dioni 2026-05-17: PUTKI HQ voice is Complex × GQ × Bloomberg
# Crypto. Snarky-but-sophisticated, professional baseline, light Finnish
# swearing OK in moderation, ZERO problem-gambling / underage / addiction
# language. Every article MUST carry an explicit betting angle (≥20 chars).
# These rules ride on top of every LLM template's existing system prompt.

EDITORIAL_GUIDELINES_DIRECTIVE = (
    "PUTKI HQ -ÄÄNI JA TYYLI (PAKOLLISET SÄÄNNÖT):\n"
    "- Sävy: ammattilainen pohjavire, älykäs purevuus sallittu. Tyyli kuten "
    "Complex × GQ × Bloomberg Crypto — fakta+kommentti, ei tylsää uutispuuroa.\n"
    "- Saa olla terävä ja itsevarma, jopa hivenen ilkikurinen.\n"
    "- Kevyt suomalainen kiroilu (esim. \"perkele\") sallittua harkitusti.\n"
    "- EI markkinointikieltä, EI superlatiivihypeä.\n"
    "\nVEDONLYÖNTIKULMA (PAKOLLINEN, EI NEUVOTELTAVISSA):\n"
    "- Joka artikkelin on sisällettävä eksplisiittinen vedonlyöntinäkökulma "
    "(esim. kerroin, markkinaliike, lopputuloksen analyysi, mitä tämä tarkoittaa "
    "pitkän aikavälin trendille). Minimissään 20 merkkiä.\n"
    "- Jos vedonlyöntikulmaa ei ole, JÄTÄ ARTIKKELI KIRJOITTAMATTA — heikkoa "
    "sisältöä ei julkaista.\n"
    "\nKIELLETYT AIHEET (ÄLÄ KOSKAAN KIRJOITA):\n"
    "- Peliongelmista varoittelu artikkelitekstissä (laillinen disclaimer "
    "renderöityy automaattisesti UI-komponenttina).\n"
    "- Alaikäisten pelaaminen.\n"
    "- Peliriippuvuus tai riippuvuusterminologia.\n"
    "\nKIELLETYT FRAASIT:\n"
    "- \"lähteiden mukaan\" / \"asiantuntijat ennustavat\" / \"sources say\" — "
    "ole konkreettinen, älä kierrä.\n"
    "- Englanninkieliset sanat lukuun ottamatta erisnimiä (joukkueet, pelaajat, "
    "operaattorit).\n"
    "\nRAKENNE:\n"
    "- Otsikko: max 60 merkkiä, aktiivimuoto, sisältää keskeisen nimen + "
    "vedonlyöntikulman.\n"
    "- Alaotsikko: max 100 merkkiä, taustakonteksti tai vaikutus.\n"
    "- Body: 150–250 sanaa, 3 kappaletta (mitä tapahtui / miksi tällä on "
    "merkitystä / mitä seuraavaksi).\n"
)


FORBIDDEN_PHRASES = (
    "lähteiden mukaan",
    "asiantuntijat ennustavat",
    "sources say",
    "experts predict",
    "monet uskovat",
    "many believe",
    "huhujen mukaan",
)

OFF_LIMITS_TERMS = (
    "peliongelma",
    "peliriippuvu",
    "alaikäinen",
    "underage",
    "addiction",
    "recovery",
)

# Default OG images per category. Served by the frontend from /og-defaults/.
# Path is relative to the public origin — frontend resolves to absolute URL
# when injecting into meta tags. Files are inline SVG (no external deps).
DEFAULT_OG_IMAGE_BASE = "/og-defaults"
DEFAULT_OG_IMAGE_BY_CATEGORY = {
    "urheilijat": f"{DEFAULT_OG_IMAGE_BASE}/urheilijat.svg",
    "striimaajat": f"{DEFAULT_OG_IMAGE_BASE}/striimaajat.svg",
    "saannot": f"{DEFAULT_OG_IMAGE_BASE}/saannot.svg",
    "kasinot": f"{DEFAULT_OG_IMAGE_BASE}/kasinot.svg",
}


def _word_count(html_or_text: str) -> int:
    text = re.sub(r"<[^>]+>", " ", str(html_or_text or ""))
    return len([w for w in re.split(r"\s+", text.strip()) if w])


def validate_content(template_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
    """Run the launch-blocker editorial validation checklist. Returns a dict
    with `passed: bool` + `errors: [str]` + `warnings: [str]`.

    Caller decides what to do when `passed=False` — current policy is to
    downgrade auto-publish to draft (never hard-fail the generation)."""
    errors: List[str] = []
    warnings: List[str] = []

    # Skip_reason short-circuits everything.
    if content.get("skip_reason"):
        return {"passed": False, "skipped": True, "errors": [], "warnings": [],
                "skip_reason": content["skip_reason"]}

    # streamer_alert is structured + non-editorial — validation is lenient.
    if template_id == "streamer_alert":
        if not content.get("headline"):
            errors.append("missing_headline")
        return {"passed": not errors, "skipped": False, "errors": errors, "warnings": warnings}

    headline = (content.get("headline") or "").strip()
    subhead = (content.get("subhead") or "").strip()
    body = content.get("body") or _resolve_body(template_id, content) or ""
    betting_angle = (content.get("betting_angle") or "").strip()
    facts = content.get("facts_used") or []

    # Length checks
    if not (1 <= len(headline) <= 60):
        errors.append(f"headline_length({len(headline)})_outside_1_60")
    if subhead and len(subhead) > 100:
        errors.append(f"subhead_length({len(subhead)})_over_100")

    body_words = _word_count(body)
    # Regulatory uses summary+analysis+impact pieces; relax to 100..400 there.
    if template_id == "regulatory_analysis":
        if not (100 <= body_words <= 400):
            warnings.append(f"body_word_count_{body_words}_outside_100_400")
    else:
        if not (120 <= body_words <= 280):
            warnings.append(f"body_word_count_{body_words}_outside_120_280")

    # Betting angle is non-negotiable
    if len(betting_angle) < 20:
        errors.append(f"betting_angle_too_short({len(betting_angle)})")

    # Facts traceability (warning only — LLM sometimes omits even when present)
    if isinstance(facts, list) and len(facts) < 2:
        warnings.append("facts_used_count_lt_2")

    # Forbidden phrase scan over headline + subhead + body
    haystack = " ".join([headline, subhead, str(body), betting_angle]).lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in haystack:
            errors.append(f"forbidden_phrase:{phrase}")

    # Off-limits topic scan
    for term in OFF_LIMITS_TERMS:
        if term in haystack:
            errors.append(f"off_limits_term:{term}")

    return {"passed": not errors, "skipped": False, "errors": errors, "warnings": warnings}


CLAUDE_MODEL = os.environ.get("CONTENT_GENERATOR_MODEL", "claude-opus-4-20250514")

# Reusable directive injected into EVERY LLM template's system prompt. Per
# Dioni's launch-blocker spec: natural Finnish is non-negotiable. Translated-
# sounding output destroys credibility on day 1.
NATURAL_FINNISH_DIRECTIVE = (
    "TÄRKEÄÄ — KIRJOITA TÄYDELLISTÄ, LUONNOLLISTA SUOMEA — EI KÄÄNNÖKSEN MAKUISTA:\n"
    "- Käytä autenttista suomalaista urheiluslangia ja ilmaisuja\n"
    "- Kirjoita kuin natiivi suomalainen, ÄLÄ käännä englannin lauserakenteita\n"
    "- Suomen kielen lauserakenne ja sananjärjestys\n"
    "- Kulttuurikonteksti pitää olla suomalainen\n"
    "- Tyyli kuten Iltalehden urheilutoimitus, EI Google Translate\n"
    "ESIMERKKI:\n"
    "  HUONO (käännöksen makuista): \"Laine pelasi hyvin ja teki kaksi maalia tänään illalla.\"\n"
    "  HYVÄ (luonnollista): \"Laine jatkoi maaliputkeaan tehoilla 2+1.\"\n"
    "\nSOSIAALINEN MEDIA — joka artikkeliin pakolliset kentät JSON-ulostulossa:\n"
    "- og_title:           max 60 merkkiä (Facebook/Telegram preview)\n"
    "- og_description:     max 155 merkkiä (Facebook/Telegram preview)\n"
    "- twitter_description: max 200 merkkiä (X-jaon kuvaus)\n"
    "- og_image_url:       URL nostokuvaan tai null jos ei ole\n"
    "- article_tags:       lista (5–8 kpl) avainsanoista, suomeksi, pieniä kirjaimia\n"
)


# ─────────────────── Template registry ───────────────────

TEMPLATES: Dict[str, Dict[str, Any]] = {
    "nhl_recap": {
        "tier": TIER_AUTO,
        "category": "urheilijat",
        "uses_llm": True,
        "system_prompt": (
            "Olet PUTKI HQ:n urheilutoimittaja. Kirjoitat suomeksi NHL-otteluraportteja "
            "Complex × GQ × Bloomberg Crypto -tyylillä — faktoihin nojaten, "
            "vedonlyöntinäkökulma huomioiden, terävää kommentaaria mukaan.\n"
            "Vastauksesi on PELKKÄ JSON-objekti muotoa "
            "{\"headline\":\"\",\"subhead\":\"\",\"body\":\"<p>...</p>\","
            "\"betting_angle\":\"\","
            "\"facts_used\":[],"
            "\"skip_reason\":null,"
            "\"og_title\":\"\",\"og_description\":\"\",\"twitter_description\":\"\","
            "\"og_image_url\":null,\"article_tags\":[]}.\n"
            "Älä laita JSON:in ulkopuolelle mitään.\n\n"
            + EDITORIAL_GUIDELINES_DIRECTIVE
            + "\n\n" + NATURAL_FINNISH_DIRECTIVE
            + "\n\nNHL-SÄÄNNÖT:\n"
            "- Kirjoita VAIN jos suomalaispelaajalla oli merkityksellinen rooli "
            "(1+ piste, 20+ min jäällä, tai ratkaiseva tilanne).\n"
            "- Skipa: alle 10 min TOI ja 0 pistettä, blowout ilman suomalaisrelevanssia, "
            "esikausi tai merkityksetön peli. Palauta skip_reason.\n"
            "- Vedonlyöntikulma: playoff-paikka, seuraavan pelin vastustaja, "
            "pelaajan maaliputki, joukkueen voitto/tappio-putki."
        ),
        "user_prompt": (
            "OTTELU:\n"
            "- Joukkueet: {home} vs {away}\n"
            "- Lopputulos: {home_score}-{away_score}\n"
            "- Aikaleima: {start_time_utc}\n"
            "- Tila: {game_state}\n"
            "\nKONTEKSTI:\n{context}\n"
            "\nKirjoita 150–250 sanaa, 3 kappaletta (mitä tapahtui / miksi tällä on "
            "merkitystä vedonlyönnin kannalta / mitä seuraavaksi). Otsikko max 60 merkkiä, "
            "alaotsikko max 100 merkkiä."
        ),
    },

    "streamer_alert": {
        "tier": TIER_AUTO,
        "category": "striimaajat",
        "uses_llm": False,  # no LLM — structured card with social meta filled deterministically
        "system_prompt": "",
        "user_prompt": "",
    },

    "regulatory_analysis": {
        "tier": TIER_DRAFT,
        "category": "saannot",
        "uses_llm": True,
        "system_prompt": (
            "Olet PUTKI HQ:n regulatorisen toimituksen analyytikko. Käytät neutraalia, "
            "analyyttistä äänensävyä — terävä kommentaari sallittu, mutta EI mielipiteitä "
            "lain hyvyydestä/huonoudesta. Selität rahapelilaki/Veikkaus/EU-konteksti "
            "selkokielellä.\n"
            "Vastauksesi on PELKKÄ JSON {\"headline\":\"\",\"subhead\":\"\","
            "\"summary\":\"<p>...</p>\",\"analysis\":\"<p>...</p><p>...</p>\","
            "\"impact\":\"<p>...</p>\","
            "\"betting_angle\":\"\",\"facts_used\":[],\"skip_reason\":null,"
            "\"og_title\":\"\",\"og_description\":\"\",\"twitter_description\":\"\","
            "\"og_image_url\":null,\"article_tags\":[]}.\n\n"
            + EDITORIAL_GUIDELINES_DIRECTIVE
            + "\n\n" + NATURAL_FINNISH_DIRECTIVE
            + "\n\nREGULATORISET SÄÄNNÖT:\n"
            "- Kirjoita VAIN jos uutinen vaikuttaa Suomen pelimarkkinaan tai pelaajiin.\n"
            "- Skipa: kansainväliset uutiset ilman Suomi-kytkentää, huhut ilman virallista "
            "lähdettä, pienet operaattorimuutokset. Palauta skip_reason.\n"
            "- Vedonlyöntikulma: vaikutus pelaajien valintoihin, Veikkaus-monopoliin, "
            "ulkomaisten operaattoreiden toimintaan, aikajana muutoksille."
        ),
        "user_prompt": (
            "UUTINEN:\n"
            "- Otsikko: {title}\n"
            "- Lähde: {source}\n"
            "- URL: {url}\n"
            "- Avainsanat: {keywords_matched}\n"
            "- Julkaistu: {published}\n"
            "\nKONTEKSTI:\n{context}\n"
            "\nKirjoita yhteensä noin 300 sanaa. Summary-kappale (mitä tapahtui), kaksi "
            "analysis-kappaletta (mitä se tarkoittaa operaattoreille/pelaajille), "
            "impact-kappale (vedonlyöntimarkkinavaikutukset)."
        ),
    },

    "operator_news": {
        "tier": TIER_DRAFT,
        "category": "kasinot",
        "uses_llm": True,
        "system_prompt": (
            "Olet PUTKI HQ:n operaattori-toimittaja. Neutraali sävy, kuluttajakeskeinen, "
            "terävä kommentaari sallittu. EI promotionaalista kieltä — emme shilliä.\n"
            "Vastauksesi on PELKKÄ JSON "
            "{\"headline\":\"\",\"subhead\":\"\",\"body\":\"<p>...</p><p>...</p>\","
            "\"betting_angle\":\"\",\"facts_used\":[],\"skip_reason\":null,"
            "\"og_title\":\"\",\"og_description\":\"\",\"twitter_description\":\"\","
            "\"og_image_url\":null,\"article_tags\":[]}.\n\n"
            + EDITORIAL_GUIDELINES_DIRECTIVE
            + "\n\n" + NATURAL_FINNISH_DIRECTIVE
            + "\n\nOPERAATTORI-SÄÄNNÖT:\n"
            "- Kirjoita VAIN merkittävistä ilmoituksista (uusi peli, bonusmuutos, "
            "markkinasiirto). Skipa: pienet UI-muutokset, kampanjat, kv-uutiset ilman "
            "Suomi-relevanssia, promomateriaali. Palauta skip_reason.\n"
            "- Vedonlyöntikulma: vaikutus pelaajan valintoihin (uudet vetokohteet, "
            "bonusehdot, kerroinmuutokset, kilpailutilanne)."
        ),
        "user_prompt": (
            "OPERAATTORI: {operator}\n"
            "TAPAHTUMA: {event}\n"
            "YKSITYISKOHDAT: {details}\n"
            "\nKONTEKSTI:\n{context}\n"
            "\nKirjoita 200 sanaa. 1. kappale: mitä tapahtui. 2. kappale: mitä se "
            "tarkoittaa pelaajille."
        ),
    },

    "f1_recap": {
        "tier": TIER_AUTO,
        "category": "urheilijat",
        "uses_llm": True,
        "system_prompt": (
            "Olet PUTKI HQ:n moottoriurheilutoimittaja. Kirjoitat F1-kisaraportteja "
            "Complex × GQ × Bloomberg Crypto -tyylillä — faktoja, terävä sävy.\n"
            "Vastauksesi on PELKKÄ JSON "
            "{\"headline\":\"\",\"subhead\":\"\",\"body\":\"<p>...</p>\","
            "\"betting_angle\":\"\",\"facts_used\":[],\"skip_reason\":null,"
            "\"og_title\":\"\",\"og_description\":\"\",\"twitter_description\":\"\","
            "\"og_image_url\":null,\"article_tags\":[]}.\n\n"
            + EDITORIAL_GUIDELINES_DIRECTIVE
            + "\n\n" + NATURAL_FINNISH_DIRECTIVE
            + "\n\nF1-SÄÄNNÖT:\n"
            "- Kirjoita VAIN jos Bottas (tai muu suomalaiskuljettaja) maaliin tai dramaattinen DNF.\n"
            "- Skipa: Bottas 15. tai huonompi ilman draamaa, ei MM-vaikutusta. Palauta skip_reason.\n"
            "- Vedonlyöntikulma: MM-kerroinmuutokset, valmistajien välinen taistelu, "
            "seuraavan kisan kertoimet, suomalaiskuljettajan kausinäkymä."
        ),
        "user_prompt": (
            "KISA:\n"
            "- Kilpailu: {race_name} (kierros {round}, kausi {season})\n"
            "- Päivämäärä: {date}\n"
            "- Rata: {circuit}\n"
            "- Podium: {podium}\n"
            "- Suomalaiskuljettajat: {finnish_drivers}\n"
            "\nKONTEKSTI:\n{context}\n"
            "\nKirjoita 150–250 sanaa, 3 kappaletta. Otsikko max 60 merkkiä."
        ),
    },

    "football_recap": {
        "tier": TIER_AUTO,
        "category": "urheilijat",
        "uses_llm": True,
        "system_prompt": (
            "Olet PUTKI HQ:n jalkapallotoimittaja. Lyhyitä ottelu­raportteja "
            "Complex × GQ × Bloomberg Crypto -tyylillä.\n"
            "Vastauksesi on PELKKÄ JSON "
            "{\"headline\":\"\",\"subhead\":\"\",\"body\":\"<p>...</p><p>...</p>\","
            "\"betting_angle\":\"\",\"facts_used\":[],\"skip_reason\":null,"
            "\"og_title\":\"\",\"og_description\":\"\",\"twitter_description\":\"\","
            "\"og_image_url\":null,\"article_tags\":[]}.\n\n"
            + EDITORIAL_GUIDELINES_DIRECTIVE
            + "\n\n" + NATURAL_FINNISH_DIRECTIVE
            + "\n\nJALKAPALLO-SÄÄNNÖT:\n"
            "- Kirjoita VAIN jos suomalaispelaaja teki vaikutuksen (maali, syöttö, 60+ min, "
            "ratkaiseva tilanne). Skipa: penkillä koko ottelun, garbage-time -vaihto, "
            "merkityksetön mid-table -peli. Palauta skip_reason.\n"
            "- Vedonlyöntikulma: sarjataulukkomuutos, putoamis/nousutaistelu, "
            "pelaajan maalimarkkina, seuraava vastustaja."
        ),
        "user_prompt": (
            "OTTELU:\n"
            "- Sarja: {competition_name}\n"
            "- Joukkueet: {home} vs {away}\n"
            "- Lopputulos: {home_score}-{away_score}\n"
            "- Päivämäärä: {utc_date}\n"
            "- Maalintekijät: {scorers}\n"
            "- Suomalaiset maalintekijät: {finnish_scorers}\n"
            "\nKONTEKSTI:\n{context}\n"
            "\nKirjoita 150–200 sanaa, 2–3 kappaletta. Otsikko max 60 merkkiä."
        ),
    },
}


# ─────────────────── Helpers ───────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _slugify(text: str, max_len: int = 80) -> str:
    s = re.sub(r"[^\w\s-]", "", (text or "").lower(), flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return (s or f"item-{uuid.uuid4().hex[:6]}")[:max_len]


def _fingerprint(template_id: str, key_parts: List[str]) -> str:
    raw = "::".join([template_id, *[(p or "").strip().lower() for p in key_parts]])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _strip_code_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n", "", t)
        t = re.sub(r"\n```$", "", t)
    return t.strip()


def _parse_llm_json(text: str) -> Dict[str, Any]:
    cleaned = _strip_code_fence(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract first {...} block
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        return {}


# ─────────────────── ContentGenerator ───────────────────

class ContentGenerator:
    """Stateful generator bound to a Mongo db handle. Methods are async so
    the FastAPI server.py can call them inline from the Layer 2 on_tick hook
    without spawning new threads."""

    def __init__(self, db, *, llm_callable=None):
        """`llm_callable` is injectable for tests — when None we lazy-import
        the emergentintegrations Claude path used elsewhere in the codebase."""
        self.db = db
        self._llm = llm_callable

    # ----------- public API -----------

    async def generate_from_signal(
        self, template_id: str, signal_data: Dict[str, Any],
        *, source_signal_id: Optional[str] = None,
        force: bool = False,
    ) -> Dict[str, Any]:
        """Top-level entry point. Returns a status dict — never raises on
        normal control-flow paths (dedup skip, rate-limit, unknown template).
        """
        tmpl = TEMPLATES.get(template_id)
        if not tmpl:
            return {"status": "error", "reason": f"unknown_template:{template_id}"}

        # 1. de-duplication fingerprint — refuse repeats inside the window
        fp_keys = self._fingerprint_keys(template_id, signal_data)
        fp = _fingerprint(template_id, fp_keys)
        if not force:
            existing = await self._existing_for_fingerprint(fp)
            if existing:
                return {
                    "status": "skipped",
                    "reason": "duplicate_fingerprint",
                    "fingerprint": fp,
                    "existing_id": existing.get("id"),
                }

        # 2. rate-limit auto-publish — overflow falls through to draft
        downgrade_to_draft = False
        if tmpl["tier"] == TIER_AUTO and not force:
            recent = await self._count_recent_auto_published()
            if recent >= RATE_LIMIT_PER_HOUR:
                downgrade_to_draft = True

        # 3. fetch editorial context (subject lookup)
        context_obj = await self._fetch_context(template_id, signal_data)

        # 4. generate body
        if tmpl["uses_llm"]:
            try:
                content = await self._generate_via_llm(template_id, tmpl, signal_data, context_obj)
            except Exception as e:
                logger.exception("Claude generation failed")
                return {"status": "error", "reason": f"llm_failure:{e.__class__.__name__}"}
        else:
            content = self._generate_structured(template_id, signal_data)

        # 5. assemble draft document
        category = tmpl["category"]
        slug = _slugify(content.get("headline") or signal_data.get("title") or template_id)
        # collision-safe: append short uuid suffix if slug already taken
        if await self.db.published_content.find_one({"url_slug": slug}):
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"

        draft = {
            "id": str(uuid.uuid4()),
            "type": template_id,
            "tier": tmpl["tier"] if not downgrade_to_draft else TIER_DRAFT,
            "status": "draft",
            "headline": content.get("headline", "")[:240],
            "subhead": content.get("subhead", "")[:300],
            "body": _resolve_body(template_id, content),
            "url_slug": slug,
            "category": category,
            "tags": list(content.get("article_tags") or content.get("tags") or []),
            "external_link": content.get("external_link"),
            "fingerprint": fp,
            "source_signal_id": source_signal_id,
            "api_data": signal_data,
            "foundational_context": context_obj.get("matched_subject"),
            "generated_at": _now().isoformat(),
            "published_at": None,
            "reviewed_by": None,
            "rate_limited": downgrade_to_draft,
            "expires_at": content.get("expires_at"),
            # Social sharing — non-negotiable for launch. Deterministic
            # fallbacks fire when the LLM forgets a field so we NEVER ship
            # an article without Open Graph + Twitter Card metadata.
            "social": _build_social_meta(content, signal_data, template_id, slug),
        }

        await self.db.content_drafts.insert_one(dict(draft))

        # 6. if TIER 1 + not rate-limited → publish immediately
        result_publish: Optional[Dict[str, Any]] = None
        if draft["tier"] == TIER_AUTO and not downgrade_to_draft:
            result_publish = await self.publish_draft(draft["id"], reviewed_by="system")
            draft["status"] = "published"

        return {
            "status": "generated" if not downgrade_to_draft else "rate_limited_to_draft",
            "draft_id": draft["id"],
            "tier": draft["tier"],
            "fingerprint": fp,
            "published": result_publish,
        }

    async def publish_draft(self, draft_id: str, *, reviewed_by: str = "manual") -> Dict[str, Any]:
        draft = await self.db.content_drafts.find_one({"id": draft_id}, {"_id": 0})
        if not draft:
            return {"status": "error", "reason": "draft_not_found"}
        if draft.get("status") == "published":
            return {"status": "already_published", "id": draft["id"]}

        published_doc = {
            "id": str(uuid.uuid4()),
            "draft_id": draft["id"],
            "type": draft["type"],
            "headline": draft["headline"],
            "subhead": draft["subhead"],
            "body": draft["body"],
            "url_slug": draft["url_slug"],
            "category": draft["category"],
            "tags": list(draft.get("tags") or []),
            "external_link": draft.get("external_link"),
            "published_at": _now().isoformat(),
            "author": "system" if reviewed_by == "system" else reviewed_by,
            "expires_at": draft.get("expires_at"),
            "views": 0,
            "clicks": 0,
            # Social meta carries over verbatim — no re-derivation at publish
            # time so an editor's manual edit during draft review is preserved.
            "social": draft.get("social") or {},
            "canonical_url": f"https://putkihq.fi/uutiset/{draft['url_slug']}",
        }
        await self.db.published_content.insert_one(dict(published_doc))
        await self.db.content_drafts.update_one(
            {"id": draft["id"]},
            {"$set": {"status": "published", "published_at": published_doc["published_at"],
                      "reviewed_by": reviewed_by}},
        )
        return {"status": "published", "published_id": published_doc["id"],
                "url_slug": published_doc["url_slug"]}

    async def reject_draft(self, draft_id: str, *, reviewed_by: str = "manual", note: Optional[str] = None) -> Dict[str, Any]:
        result = await self.db.content_drafts.update_one(
            {"id": draft_id, "status": {"$ne": "published"}},
            {"$set": {"status": "rejected", "reviewed_by": reviewed_by, "rejection_note": note,
                      "reviewed_at": _now().isoformat()}},
        )
        if result.matched_count == 0:
            return {"status": "error", "reason": "draft_not_found_or_already_published"}
        return {"status": "rejected", "draft_id": draft_id}

    async def edit_draft(self, draft_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        allowed = {"headline", "subhead", "body", "tags", "category", "url_slug",
                   "external_link", "social"}
        update = {k: v for k, v in patch.items() if k in allowed}
        if not update:
            return {"status": "error", "reason": "no_allowed_fields"}
        update["edited_at"] = _now().isoformat()
        result = await self.db.content_drafts.update_one(
            {"id": draft_id, "status": "draft"},
            {"$set": update},
        )
        if result.matched_count == 0:
            return {"status": "error", "reason": "draft_not_found_or_not_editable"}
        return {"status": "edited", "draft_id": draft_id}

    # ----------- helpers -----------

    def _fingerprint_keys(self, template_id: str, sig: Dict[str, Any]) -> List[str]:
        if template_id == "nhl_recap":
            return ["nhl", str(sig.get("game_id") or sig.get("home")), str(sig.get("away") or "")]
        if template_id == "streamer_alert":
            day = _now().strftime("%Y-%m-%d")
            return ["streamer", str(sig.get("user_login") or sig.get("user_name") or ""), day]
        if template_id == "regulatory_analysis":
            # URL is the strongest dedup key — same article from different feeds
            # collapses regardless of title differences. Fall back to normalized
            # title ONLY when URL is missing (some RSS feeds drop it).
            url = (sig.get("url") or "").strip()
            if url:
                return ["regulatory", url]
            return ["regulatory", _slugify(sig.get("title") or "")]
        if template_id == "operator_news":
            return ["operator", str(sig.get("operator") or ""), _slugify(sig.get("event") or "")]
        if template_id == "f1_recap":
            # Race uniquely identified by season+round (or race_id if provided)
            return ["f1", str(sig.get("race_id") or f"{sig.get('season', '')}-{sig.get('round', '')}")]
        if template_id == "football_recap":
            return ["football", str(sig.get("match_id") or ""), str(sig.get("home") or ""), str(sig.get("away") or "")]
        return [template_id, _slugify(sig.get("title") or sig.get("name") or "")]

    async def _existing_for_fingerprint(self, fingerprint: str) -> Optional[Dict[str, Any]]:
        cutoff = (_now() - timedelta(hours=DEDUP_WINDOW_HOURS)).isoformat()
        return await self.db.content_drafts.find_one(
            {"fingerprint": fingerprint, "generated_at": {"$gte": cutoff}, "status": {"$ne": "rejected"}},
            {"_id": 0, "id": 1, "status": 1},
        )

    async def _count_recent_auto_published(self) -> int:
        cutoff = (_now() - timedelta(hours=1)).isoformat()
        return await self.db.content_drafts.count_documents({
            "tier": TIER_AUTO,
            "status": "published",
            "generated_at": {"$gte": cutoff},
        })

    async def _fetch_context(self, template_id: str, sig: Dict[str, Any]) -> Dict[str, Any]:
        """Look up matching editorial_subjects for richer LLM context. Returns
        an object with `context_text` (already formatted for the prompt) and
        `matched_subject` (the raw row stored for audit)."""
        from editorial_subjects import find_by_name

        candidates: List[str] = []
        subject_type_filter: Optional[str] = None

        if template_id == "nhl_recap":
            # Athletes — could match a Finnish player name in the game payload
            for key in ("finnish_players", "home_name", "away_name"):
                v = sig.get(key)
                if isinstance(v, list):
                    candidates.extend(str(x) for x in v)
                elif isinstance(v, str):
                    candidates.append(v)
            subject_type_filter = "athlete"

        elif template_id == "streamer_alert":
            for key in ("user_name", "user_login"):
                v = sig.get(key)
                if v:
                    candidates.append(str(v))
            subject_type_filter = "creator"

        elif template_id == "operator_news":
            v = sig.get("operator")
            if v:
                candidates.append(str(v))
            subject_type_filter = "operator"

        elif template_id == "regulatory_analysis":
            # Try to extract operator/regulator names from title keywords
            for kw in sig.get("keywords_matched") or []:
                candidates.append(str(kw))
            subject_type_filter = None  # broad search

        matched = None
        for cand in candidates:
            if not cand:
                continue
            row = await find_by_name(self.db, cand, subject_type=subject_type_filter)
            if row:
                matched = row
                break

        if matched:
            facts = matched.get("key_facts", {}) or {}
            context_text = f"{matched['name']} ({matched.get('category', '')}):\n"
            context_text += "\n".join(f"- {k}: {v}" for k, v in facts.items() if isinstance(v, (str, int, float)))[:1200]
        else:
            context_text = "(ei taustakontekstia — käytä pelkkiä API-faktoja)"

        return {"context_text": context_text, "matched_subject": matched}

    async def _generate_via_llm(self, template_id: str, tmpl: Dict[str, Any],
                                signal_data: Dict[str, Any], context_obj: Dict[str, Any]) -> Dict[str, Any]:
        fmt_kwargs = {**signal_data, "context": context_obj.get("context_text", "")}
        # Make sure missing keys don't blow up str.format — patch them in as empty.
        for placeholder in re.findall(r"\{(\w+)\}", tmpl["user_prompt"]):
            fmt_kwargs.setdefault(placeholder, "")
        user_prompt = tmpl["user_prompt"].format(**fmt_kwargs)

        if self._llm is None:
            # Lazy-bind to the existing emergentintegrations Claude path.
            text = await _call_claude_default(tmpl["system_prompt"], user_prompt,
                                              session_id=f"content-{template_id}-{uuid.uuid4().hex[:8]}")
        else:
            text = await self._llm(tmpl["system_prompt"], user_prompt)

        parsed = _parse_llm_json(text)
        return parsed or {"headline": signal_data.get("title", "")[:60],
                          "subhead": "", "body": text[:2000], "tags": []}

    def _generate_structured(self, template_id: str, sig: Dict[str, Any]) -> Dict[str, Any]:
        """Non-LLM template path — currently just streamer_alert."""
        if template_id == "streamer_alert":
            login = sig.get("user_login") or sig.get("user_name") or "streamer"
            name = sig.get("user_name") or login
            viewers = int(sig.get("viewer_count") or 0)
            game = sig.get("game_name") or ""
            title = sig.get("title") or ""
            external = sig.get("external_link") or f"https://twitch.tv/{login}"
            expires = (_now() + timedelta(hours=6)).isoformat()
            return {
                "headline": f"{name} live – {viewers:,} katsojaa".replace(",", " "),
                "subhead": (f"Pelaa: {game}" if game else title)[:300],
                "body": None,
                "external_link": external,
                "tags": [_slugify(login), "twitch", "live"],
                "expires_at": expires,
            }
        return {"headline": "", "subhead": "", "body": "", "tags": []}


def _build_social_meta(content: Dict[str, Any], signal_data: Dict[str, Any],
                        template_id: str, slug: str) -> Dict[str, Any]:
    """Construct og: / twitter: metadata for the article.

    Order of preference for each field:
      1. LLM-emitted value (clamped to spec character limits)
      2. Deterministic fallback from headline/subhead/category defaults

    Image URL: only set if the LLM returned one OR the signal provides a
    natural image (e.g. streamer_alert thumbnail). Otherwise null — the
    frontend renders a brand fallback rather than us inventing a URL.
    """
    headline = (content.get("headline") or signal_data.get("title") or signal_data.get("user_name") or "")
    subhead = (content.get("subhead") or "")
    body_text = re.sub(r"<[^>]+>", " ", str(content.get("body") or
                       content.get("summary") or signal_data.get("title") or ""))
    body_text = re.sub(r"\s+", " ", body_text).strip()

    og_title = _clip(content.get("og_title") or headline, 60)
    og_desc = _clip(content.get("og_description") or subhead or body_text, 155)
    tw_desc = _clip(content.get("twitter_description") or subhead or body_text, 200)
    og_image = content.get("og_image_url") or signal_data.get("thumbnail_url") or signal_data.get("og_image_url")
    tags = list(content.get("article_tags") or content.get("tags") or [])

    return {
        "og_title": og_title,
        "og_description": og_desc,
        "og_image_url": og_image,
        "twitter_card": "summary_large_image" if og_image else "summary",
        "twitter_description": tw_desc,
        "article_tags": tags,
    }


def _clip(text: str, limit: int) -> str:
    s = str(text or "").strip()
    return s[:limit]


def _resolve_body(template_id: str, content: Dict[str, Any]):
    """Pick the right body for the draft.

    - streamer_alert: structured card → keep body explicitly None
    - regulatory_analysis: LLM returns summary/analysis/impact separately → join
    - everything else: prefer content.body, fall back to assembled
    """
    if template_id == "streamer_alert":
        return None
    if content.get("body"):
        return content["body"]
    if template_id == "regulatory_analysis":
        pieces = [content.get("summary"), content.get("analysis"), content.get("impact")]
        joined = "".join(p for p in pieces if p)
        return joined or None
    return None


def _assemble_regulatory_body(content: Dict[str, Any]) -> str:
    """Regulatory LLM returns summary/analysis/impact separately; join into body."""
    if content.get("body"):
        return content["body"]
    pieces = [content.get("summary"), content.get("analysis"), content.get("impact")]
    return "".join(p for p in pieces if p)


# ─────────────────── Default LLM binding ───────────────────

async def _call_claude_default(system_prompt: str, user_prompt: str, session_id: str) -> str:
    """Calls Claude via emergentintegrations, mirroring `content_engine.call_claude`
    but private to this module so it can evolve independently."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", CLAUDE_MODEL)
    return await asyncio.wait_for(
        chat.send_message(UserMessage(text=user_prompt)),
        timeout=45.0,
    )


# ─────────────────── Index helper ───────────────────

async def ensure_indexes(db) -> None:
    coll = db.content_drafts
    try:
        await coll.create_index("id", unique=True)
        await coll.create_index("fingerprint")
        await coll.create_index("status")
        await coll.create_index("type")
        await coll.create_index("generated_at")
        await db.published_content.create_index("url_slug")
    except Exception:
        logger.exception("Failed to ensure content_drafts indexes")


# ─────────────────── Layer-2-tick fan-out helpers ───────────────────

async def fan_out_from_layer2(db, worker_name: str, generator: "ContentGenerator") -> Dict[str, Any]:
    """Called by the Layer 2 on_tick hook. Picks the latest signal doc for the
    worker and creates content drafts as appropriate. Returns counts.

    Each helper takes the latest Layer 2 collection doc and walks its items
    array, generating one piece per item that hasn't been fingerprinted yet.
    """
    out = {"worker": worker_name, "generated": 0, "skipped_dup": 0, "errors": 0}

    if worker_name == "rss":
        doc = await db.news_signals.find_one({}, {"_id": 0}, sort=[("captured_at", -1)])
        for article in (doc or {}).get("matched_articles", []) or []:
            r = await generator.generate_from_signal(
                "regulatory_analysis", article, source_signal_id=str(doc.get("_id") or ""),
            )
            _bucket(out, r)

    elif worker_name == "nhl":
        doc = await db.sports_signals.find_one({}, {"_id": 0}, sort=[("captured_at", -1)])
        for game in (doc or {}).get("games", []) or []:
            # Only generate recap for completed games (gameState in OFF/FINAL).
            if (game.get("game_state") or "").upper() not in ("OFF", "FINAL", "F"):
                continue
            r = await generator.generate_from_signal(
                "nhl_recap", game, source_signal_id=str(doc.get("_id") or ""),
            )
            _bucket(out, r)

    elif worker_name == "twitch":
        doc = await db.stream_signals.find_one({}, {"_id": 0}, sort=[("captured_at", -1)])
        for stream in (doc or {}).get("streams", []) or []:
            r = await generator.generate_from_signal(
                "streamer_alert", stream, source_signal_id=str(doc.get("_id") or ""),
            )
            _bucket(out, r)

    elif worker_name == "f1":
        doc = await db.f1_signals.find_one({}, {"_id": 0}, sort=[("captured_at", -1)])
        if doc and doc.get("race_active") and not doc.get("dormant"):
            r = await generator.generate_from_signal(
                "f1_recap", doc, source_signal_id=str(doc.get("_id") or ""),
            )
            _bucket(out, r)

    elif worker_name == "football":
        doc = await db.football_signals.find_one({}, {"_id": 0}, sort=[("captured_at", -1)])
        for match in (doc or {}).get("matches", []) or []:
            # Only auto-recap matches where Finnish player scored — keeps the
            # auto-publish volume contained and editorial-relevant.
            if not match.get("finnish_scorers"):
                continue
            r = await generator.generate_from_signal(
                "football_recap", match, source_signal_id=str(doc.get("_id") or ""),
            )
            _bucket(out, r)

    return out


def _bucket(out: Dict[str, Any], r: Dict[str, Any]) -> None:
    status = r.get("status", "")
    if status == "generated":
        out["generated"] += 1
    elif status == "rate_limited_to_draft":
        out["generated"] += 1
    elif status == "skipped":
        out["skipped_dup"] += 1
    elif status == "error":
        out["errors"] += 1


# ─────────────────── Draft listing helpers (for admin API) ───────────────────

async def list_drafts(db, *, status: Optional[str] = None, tier: Optional[int] = None,
                      limit: int = 50) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    if tier is not None:
        q["tier"] = tier
    cur = db.content_drafts.find(q, {"_id": 0}).sort("generated_at", -1).limit(max(1, min(200, limit)))
    return await cur.to_list(length=limit)


async def get_draft(db, draft_id: str) -> Optional[Dict[str, Any]]:
    return await db.content_drafts.find_one({"id": draft_id}, {"_id": 0})


async def list_published(db, *, category: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if category:
        q["category"] = category
    # Only docs created by the new generator (have draft_id back-link)
    q["draft_id"] = {"$exists": True}
    cur = db.published_content.find(q, {"_id": 0}).sort("published_at", -1).limit(max(1, min(200, limit)))
    return await cur.to_list(length=limit)


async def get_published_by_slug(db, slug: str) -> Optional[Dict[str, Any]]:
    return await db.published_content.find_one({"url_slug": slug, "draft_id": {"$exists": True}}, {"_id": 0})
