"""
PUTKI HQ — News classifier (deterministic, Tier 1).

Phase 1 brief Section 2: every ingested RSS item runs through a classifier
that tags category, severity, relevance, and entity tags.

Tier 1 (this module) — deterministic keyword + source-rank rules. Covers
~80% of incoming volume at $0 cost.

Tier 2 (future — Phase 2 enhancement) — Haiku 4.5 fallback for items the
deterministic tier returns relevance 20-60 (the "ambiguous" band).
Gated by env flag NEWS_CLASSIFIER_AI_FALLBACK_ENABLED=1.

Thresholds (per user-approved sign-off):
  • Relevance ≥ 45 → surfaces in the ticker (news_ticker_items collection)
  • Relevance 20-44 → archive only (news_ticker_archive; editorial can promote)
  • Relevance < 20  → dropped silently

Severity keyword sets:
  HIGH    — kielto, huijaus, tuomio, uudistus, ennätys, lakko, kriisi, skandaali
  MEDIUM  — kasvu, uusi laki, tutkimus, päätös, sopimus, varoitus
  LOW     — everything else
"""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional


# ─────────────────────── Thresholds (env-overridable) ───────────────────────

def relevance_threshold() -> int:
    """Items with relevance >= this surface to the ticker. Default 45/100."""
    try:
        return int(os.environ.get("NEWS_TICKER_RELEVANCE_THRESHOLD", "45"))
    except Exception:
        return 45


def archive_min() -> int:
    """Items in [archive_min, threshold) go to the archive (editor-promotable)."""
    try:
        return int(os.environ.get("NEWS_TICKER_ARCHIVE_MIN", "20"))
    except Exception:
        return 20


# ─────────────────────── Category routing ───────────────────────

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "regulation": [
        "rahapelilaki", "rahapelilainsäädäntö", "pelilisenssi", "rahapelivirasto",
        "monopoli", "rahapelimonopoli", "pelisääntely", "lisenssijärjestelmä",
        "uudistus",
    ],
    "gambling": [
        "veikkaus", "rahapeli", "uhkapeli", "kasino", "nettikasino",
        "pelaaminen", "vedonlyönti", "ongelmapelaaminen", "operaattori",
    ],
    "sports": [
        "liiga", "veikkausliiga", "huuhkajat", "leijonat", "nhl", "f1",
        "jääkiekko", "jalkapallo", "kiekko", "mestaruus", "maajoukkue",
        "olympia", "mm-kisat", "ottelu",
    ],
    "scene": [
        "streamaaja", "striimaaja", "twitch", "kick", "discord",
        "youtube-tähti", "youtubettaja",
    ],
}

# Severity escalators — title contains any of these → HIGH/MEDIUM.
SEVERITY_HIGH = [
    "kielto", "huijaus", "tuomio", "uudistus", "ennätys", "lakko",
    "kriisi", "skandaali", "ban", "fraud", "verdict",
]
SEVERITY_MEDIUM = [
    "kasvu", "uusi laki", "tutkimus", "päätös", "sopimus", "varoitus",
    "growth", "decision", "agreement", "warning",
]

# Source-tier weighting (relevance boost). Tier 1 = Yle, HS. Tier 2 = IL, IS,
# MTV, KL. Tier 3 = Google News aggregated.
TIER_BOOST = {1: 20, 2: 10, 3: 0}

# Known Finnish entities (for entity_tags). Trimmed list — full list in
# source_map.py for the editorial side.
ENTITY_TAGS: Dict[str, str] = {
    r"\bveikkaus\b": "veikkaus",
    r"\byle\b": "yle",
    r"\bnhl\b": "nhl",
    r"\bliiga\b": "liiga",
    r"\bveikkausliiga\b": "veikkausliiga",
    r"\bhuuhkajat\b": "huuhkajat",
    r"\bleijonat\b": "leijonat",
    r"\barsenal\b": "arsenal",
    r"\bf1\b": "f1",
    r"\bb[oö]rk[uö]j[ae]rvi\b|\bbottas\b|\bb[oö]ttas\b": "bottas",
}


# ─────────────────────── Classifier ───────────────────────

def classify_item(title: str,
                  source: str,
                  source_tier: int = 3,
                  feed_category: Optional[str] = None) -> Dict[str, Any]:
    """Return {category, severity, relevance, entity_tags} for one item.

    Pure function — no I/O, no state. Safe to call from any worker.
    """
    t_lc = (title or "").lower()
    if not t_lc:
        return {"category": "news", "severity": "low", "relevance": 0, "entity_tags": []}

    # 1) Category — strongest keyword match wins; falls back to feed hint.
    cat_scores: Dict[str, int] = {}
    for cat, kws in CATEGORY_KEYWORDS.items():
        cat_scores[cat] = sum(1 for kw in kws if kw in t_lc)
    best_cat = max(cat_scores, key=cat_scores.get) if any(cat_scores.values()) else None
    category = best_cat or feed_category or "news"

    # 2) Severity — keyword set match.
    if any(kw in t_lc for kw in SEVERITY_HIGH):
        severity = "high"
        sev_boost = 25
    elif any(kw in t_lc for kw in SEVERITY_MEDIUM):
        severity = "medium"
        sev_boost = 12
    else:
        severity = "low"
        sev_boost = 0

    # 3) Relevance — 0-100. Built from:
    #    base 25 (passed parse)
    #    + tier boost (0-20)
    #    + category match (0-25 if any kw hit)
    #    + severity escalator (0-25)
    #    + entity tag presence (0-10 per tag, capped 20)
    relevance = 25
    relevance += TIER_BOOST.get(source_tier, 0)
    relevance += min(cat_scores.get(category, 0) * 10, 25)
    relevance += sev_boost
    entity_tags = _extract_entities(t_lc)
    relevance += min(len(entity_tags) * 10, 20)
    relevance = max(0, min(100, relevance))

    return {
        "category":    category,
        "severity":    severity,
        "relevance":   relevance,
        "entity_tags": entity_tags,
    }


def _extract_entities(title_lc: str) -> List[str]:
    out: List[str] = []
    for pat, tag in ENTITY_TAGS.items():
        if re.search(pat, title_lc):
            if tag not in out:
                out.append(tag)
    return out


# ─────────────────────── Tier 2 — Haiku 4.5 fallback ────────────────────

TIER2_MODEL = "claude-haiku-4-5-20251001"
TIER2_TIMEOUT = 12.0  # seconds

# Items in this relevance band are sent to Tier 2 for re-classification.
# Below the band we just drop, above the band Tier 1 is confident enough.
TIER2_LOWER = 20
TIER2_UPPER = 44


def _tier2_enabled() -> bool:
    return os.environ.get("NEWS_CLASSIFIER_AI_FALLBACK_ENABLED", "0") == "1"


_TIER2_SYSTEM_PROMPT = (
    "You are a strict editorial classifier for a Finnish gambling/streamer "
    "news ticker. Given a single news headline, output a JSON object only — "
    "no markdown, no commentary — with exactly these keys:\n"
    "  category: one of [news, regulation, sports, gambling, streamers, business]\n"
    "  severity: one of [high, medium, low]\n"
    "  relevance: integer 0..100 — how relevant THIS headline is for a Finnish\n"
    "    audience interested in gambling regulation, sports betting markets,\n"
    "    streamers and esports. A headline about a tiny non-Finnish local\n"
    "    politician = ≤ 20. A Veikkaus or Finnish gambling regulation update\n"
    "    = ≥ 70. A major Finnish athlete win/scandal = ≥ 60.\n"
    "  entity_tags: array of short lowercase strings (e.g. veikkaus, nhl, kicked, twitch).\n"
    "Do not include any keys other than these. Return ONLY the JSON."
)


async def classify_item_tier2(title: str, source: str) -> Optional[Dict[str, Any]]:
    """Call Haiku 4.5 to re-classify an ambiguous headline. Returns the
    parsed dict or None on any failure (timeout, JSON parse error, bad
    keys, LLM unavailable). Caller cascades back to Tier 1 result.

    Cost-bound: only invoked for items already in the 20-44 band, which
    is empirically ~10-15% of incoming volume.
    """
    if not _tier2_enabled() or not title:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import asyncio
        import json
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return None
        chat = LlmChat(
            api_key=api_key,
            session_id=f"classifier-tier2-{hash(title) & 0xffff}",
            system_message=_TIER2_SYSTEM_PROMPT,
        ).with_model("anthropic", TIER2_MODEL)
        raw = await asyncio.wait_for(
            chat.send_message(UserMessage(
                text=f"Headline: {title}\nSource: {source}\n\nOutput JSON now."
            )),
            timeout=TIER2_TIMEOUT,
        )
        m = re.search(r"\{.*\}", raw or "", flags=re.DOTALL)
        if not m:
            return None
        obj = json.loads(m.group(0))
        cat = (obj.get("category") or "").lower()
        sev = (obj.get("severity") or "").lower()
        rel = int(obj.get("relevance") or 0)
        tags = obj.get("entity_tags") or []
        if cat not in {"news", "regulation", "sports", "gambling", "streamers", "business"}:
            return None
        if sev not in {"high", "medium", "low"}:
            return None
        if not isinstance(tags, list):
            tags = []
        return {
            "category": cat,
            "severity": sev,
            "relevance": max(0, min(100, rel)),
            "entity_tags": [str(x)[:24].lower() for x in tags[:6]],
            "_tier2": True,
        }
    except Exception:
        return None


async def classify_item_with_fallback(title: str, source: str,
                                       source_tier: int = 3,
                                       feed_category: Optional[str] = None) -> Dict[str, Any]:
    """Wrapper: runs Tier 1, then escalates to Tier 2 if relevance lands
    in the ambiguous band AND the env flag is enabled."""
    t1 = classify_item(title, source, source_tier=source_tier,
                        feed_category=feed_category)
    if TIER2_LOWER <= int(t1.get("relevance") or 0) <= TIER2_UPPER and _tier2_enabled():
        t2 = await classify_item_tier2(title, source)
        if t2:
            # Prefer T2 result but keep T1 tags merged for safety.
            merged_tags = list(set((t2.get("entity_tags") or []) +
                                    (t1.get("entity_tags") or [])))[:8]
            return {**t2, "entity_tags": merged_tags}
    return t1
