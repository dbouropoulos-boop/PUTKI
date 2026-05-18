"""
PUTKI HQ — Newsroom helpers.

Severity classification, entity extraction, and stats aggregation for the
PizzINT-style news system. Severity is computed at read time (no schema
migration) from article type + age + view count + viewer signals.

Severity tiers:
  • SCORCHING — high-velocity right now (top reads/hour, very fresh)
  • HOT       — fresh + meaningful
  • WARM      — published today/yesterday, moderate engagement
  • COOL      — older background articles
"""
from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional


_ENTITY_PATTERNS = [
    re.compile(r"\bRoshtein\b", re.I),
    re.compile(r"\bKnossi\b", re.I),
    re.compile(r"\bClassyBeef\b", re.I),
    re.compile(r"\bJarttu84\b", re.I),
    re.compile(r"\bWeezyBet\b", re.I),
    re.compile(r"\bLeoVegas\b", re.I),
    re.compile(r"\bVeikkaus\b", re.I),
    re.compile(r"\bxQc\b", re.I),
    re.compile(r"\bTrainwreckstv\b", re.I),
    re.compile(r"\bNHL\b"),
    re.compile(r"\bLiiga\b"),
    re.compile(r"\bF1\b"),
]


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def classify_severity(article: Dict[str, Any], *, now: Optional[datetime] = None) -> str:
    """Derive a severity tier (SCORCHING / HOT / WARM / COOL) for an article.

    Pure function — no DB calls, can run on any cached article dict.
    """
    now = now or datetime.now(timezone.utc)
    pub = _parse_iso(article.get("published_at")) or now
    age_h = max(0.0, (now - pub).total_seconds() / 3600.0)
    views = int(article.get("views") or 0)
    a_type = (article.get("type") or "").lower()

    # SCORCHING: super-fresh viral or breaking event
    if age_h < 2 and views >= 600:
        return "SCORCHING"
    if a_type == "streamer_alert" and age_h < 1 and views >= 400:
        return "SCORCHING"

    # HOT: fresh and meaningful, or sports recap within 6h
    if age_h < 6 and views >= 200:
        return "HOT"
    if a_type in ("nhl_recap", "football_recap", "f1_recap") and age_h < 12:
        return "HOT"

    # WARM: published today, decent engagement
    if age_h < 30 or views >= 80:
        return "WARM"

    return "COOL"


def extract_entity_tags(article: Dict[str, Any]) -> List[str]:
    """Best-effort entity extraction from headline + body. Returns lowercase
    slugs ready to power filter chips + topic hub deep links."""
    text = " ".join([
        article.get("headline") or "",
        article.get("subhead") or "",
        (article.get("body") or "")[:600],
    ])
    found: List[str] = []
    seen: set = set()
    for pat in _ENTITY_PATTERNS:
        m = pat.search(text)
        if m:
            slug = m.group(0).lower().replace(" ", "")
            if slug not in seen:
                seen.add(slug)
                found.append(slug)
    return found


async def list_recent_articles(db, hours: int = 24) -> List[Dict[str, Any]]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    cur = db.published_content.find(
        {"published_at": {"$gte": cutoff}},
        {"_id": 0},
    )
    arts = [doc async for doc in cur]
    # Hydrate view counts for severity classification
    ids = [a["id"] for a in arts if a.get("id")]
    if ids:
        vcur = db.article_views.find({"article_id": {"$in": ids}},
                                      {"_id": 0, "article_id": 1, "views": 1})
        vmap: Dict[str, int] = {}
        async for v in vcur:
            vmap[v["article_id"]] = int(v.get("views") or 0)
        for a in arts:
            a["views"] = vmap.get(a.get("id"), a.get("views") or 0)
    return arts


async def content_stats(db) -> Dict[str, Any]:
    """24h newsroom stats — severity breakdown + total + source count."""
    arts = await list_recent_articles(db, hours=24)
    by_sev = {"SCORCHING": 0, "HOT": 0, "WARM": 0, "COOL": 0}
    sources: set = set()
    for a in arts:
        sev = classify_severity(a)
        by_sev[sev] = by_sev.get(sev, 0) + 1
        for src in (a.get("sources") or []):
            name = src.get("name") if isinstance(src, dict) else str(src)
            if name:
                sources.add(name)
    # Best-effort: streamer roster also counts as "sources we monitor"
    try:
        streamer_count = await db.streamers.count_documents({})
        sources_total = max(len(sources), streamer_count)
    except Exception:
        sources_total = len(sources)
    return {
        "total_24h": len(arts),
        "by_severity": {
            "scorching": by_sev["SCORCHING"],
            "hot":       by_sev["HOT"],
            "warm":      by_sev["WARM"],
            "cool":      by_sev["COOL"],
        },
        "total_sources": sources_total,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


async def top_entities(db, days: int = 7, limit: int = 12) -> Dict[str, Any]:
    """Top entities mentioned across articles in the past `days` days. Powers
    the FilterChips entity row."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    counts: Dict[str, int] = {}
    name_map: Dict[str, str] = {}
    cur = db.published_content.find(
        {"published_at": {"$gte": cutoff}},
        {"_id": 0, "headline": 1, "subhead": 1, "body": 1, "tags": 1, "type": 1},
    )
    async for art in cur:
        for slug in extract_entity_tags(art):
            counts[slug] = counts.get(slug, 0) + 1
            # Preserve display capitalisation from first hit
            if slug not in name_map:
                # Find original casing in headline if possible
                hl = art.get("headline") or ""
                match = re.search(rf"\b{re.escape(slug)}\b", hl, re.I)
                name_map[slug] = match.group(0) if match else slug.title()
    ranked = sorted(counts.items(), key=lambda kv: -kv[1])[:limit]
    entities = [
        {"id": slug, "name": name_map.get(slug, slug.title()),
         "type": _infer_entity_type(slug), "count": cnt}
        for slug, cnt in ranked
    ]
    return {"entities": entities, "counts": {e["id"]: e["count"] for e in entities}}


def _infer_entity_type(slug: str) -> str:
    streamers = {"roshtein", "knossi", "classybeef", "jarttu84", "xqc", "trainwreckstv"}
    operators = {"weezybet", "leovegas", "veikkaus"}
    leagues = {"nhl", "liiga", "f1"}
    if slug in streamers:
        return "streamer"
    if slug in operators:
        return "operator"
    if slug in leagues:
        return "league"
    return "topic"


def annotate(article: Dict[str, Any]) -> Dict[str, Any]:
    """Mutating helper — add `severity` + `entity_tags` + `source_count`
    fields for outbound API payloads (read-only enrichment)."""
    article["severity"] = classify_severity(article)
    article["entity_tags"] = extract_entity_tags(article)
    srcs = article.get("sources") or []
    article["source_count"] = len(srcs) if isinstance(srcs, list) else 0
    article["read_count"] = int(article.get("views") or 0)
    return article
