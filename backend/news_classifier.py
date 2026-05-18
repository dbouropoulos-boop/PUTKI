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
