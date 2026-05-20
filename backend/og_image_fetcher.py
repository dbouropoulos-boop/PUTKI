"""
PUTKI HQ — News hero image fetcher (Phase 1 Final Restructure · Chunk A).

Responsibilities
================
1. Fetch the `<meta property="og:image">` (or `twitter:image`) from a cited
   news URL.
2. Validate the discovered image: HTTP 200, image content-type, dimensions
   ≥ 1200×630. Anything failing falls back to "designed treatment" (returns
   None → frontend renders the fallback hero).
3. Consult a Mongo blocklist (`og_image_blocklist`) before downloading. Any
   matched outlet domain is skipped immediately and falls back.
4. Cache validated images to `/app/backend/static/news_hero/{sha1}.jpg`.
   Public URL: `/api/static/news_hero/{sha1}.jpg`. 7-day TTL cached in
   Mongo collection `news_hero_cache`; expired entries re-fetch on demand.
5. Always returns a `photo_credit` string ("Photo: {source_name}") so the
   frontend can render the mandatory overlay caption.

Editorial guarantee
-------------------
This is standard editorial practice (FT, Bloomberg, Apple News, Google News).
Combined with the strict source-citation validator already in
`content_generator.validate_content`, this is journalism — not scraping.
Outlets requesting removal must be added to the back-office blocklist; the
fetcher honours it on every subsequent fetch.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import os
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from PIL import Image

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static" / "news_hero"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

MIN_WIDTH = 1200
MIN_HEIGHT = 630
CACHE_TTL_DAYS = 7
FETCH_TIMEOUT_SECONDS = 6.0
MAX_BYTES = 8 * 1024 * 1024  # 8 MB hard cap
USER_AGENT = (
    "Mozilla/5.0 (compatible; PutkiHQBot/1.0; +https://putkihq.fi/lehdisto) "
    "editorial og:image preview fetcher"
)

# Disable via env (used in CI / preview env when offline)
def _disabled() -> bool:
    return os.environ.get("PUTKI_HQ_DISABLE_OG_FETCHER", "0") == "1"


# ── Blocklist helpers ─────────────────────────────────────────────────────
def _domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


async def is_blocked(db, url: str) -> bool:
    """Returns True when the outlet's domain is on the back-office blocklist.
    Removal-requests are honored idempotently by adding the outlet here."""
    host = _domain(url)
    if not host:
        return True  # malformed → fall back
    doc = await db.og_image_blocklist.find_one({"domain": host})
    return bool(doc)


async def list_blocklist(db) -> list:
    cur = db.og_image_blocklist.find({}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=500)


async def add_to_blocklist(db, domain: str, reason: str) -> Dict[str, Any]:
    host = domain.lower().strip()
    if host.startswith("www."):
        host = host[4:]
    if not host or "." not in host:
        raise ValueError("Invalid domain")
    doc = {
        "domain": host,
        "reason": (reason or "").strip()[:280],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.og_image_blocklist.update_one(
        {"domain": host}, {"$set": doc}, upsert=True,
    )
    return doc


async def remove_from_blocklist(db, domain: str) -> bool:
    host = domain.lower().strip()
    if host.startswith("www."):
        host = host[4:]
    res = await db.og_image_blocklist.delete_one({"domain": host})
    return res.deleted_count > 0


# ── Cache helpers ─────────────────────────────────────────────────────────
def _cache_key(url: str) -> str:
    # SHA1 used solely as a content-addressed cache key (URL → filename).
    # Not security-sensitive — `usedforsecurity=False` silences bandit B324.
    return hashlib.sha1(url.encode("utf-8"), usedforsecurity=False).hexdigest()[:16]


def _public_url(cache_key: str) -> str:
    return f"/api/static/news_hero/{cache_key}.jpg"


def _cache_path(cache_key: str) -> Path:
    return STATIC_DIR / f"{cache_key}.jpg"


async def _cached_lookup(db, url: str) -> Optional[Dict[str, Any]]:
    """Returns cached entry only if both Mongo record is fresh AND file exists."""
    key = _cache_key(url)
    doc = await db.news_hero_cache.find_one({"key": key}, {"_id": 0})
    if not doc:
        return None
    # honour a "fetch_failed" negative cache for 24h to avoid hammering bad URLs
    if doc.get("status") == "failed":
        last = doc.get("fetched_at")
        try:
            last_dt = datetime.fromisoformat(last)
            if (datetime.now(timezone.utc) - last_dt) < timedelta(hours=24):
                return doc
        except Exception:
            pass
        return None
    if doc.get("status") != "ok":
        return None
    # check ttl + file presence
    try:
        fetched_dt = datetime.fromisoformat(doc["fetched_at"])
        if (datetime.now(timezone.utc) - fetched_dt) > timedelta(days=CACHE_TTL_DAYS):
            return None
    except Exception:
        return None
    if not _cache_path(key).exists():
        return None
    return doc


async def _save_cache(
    db, *, url: str, status: str,
    hero_image_url: Optional[str], photo_credit: Optional[str],
    source_url: Optional[str], width: Optional[int], height: Optional[int],
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    key = _cache_key(url)
    doc = {
        "key": key,
        "url": url,
        "status": status,
        "hero_image_url": hero_image_url,
        "photo_credit": photo_credit,
        "source_url": source_url,
        "width": width,
        "height": height,
        "reason": reason,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.news_hero_cache.update_one({"key": key}, {"$set": doc}, upsert=True)
    return doc


# ── Fetcher core ──────────────────────────────────────────────────────────
META_TAGS = (
    ("meta", {"property": "og:image"}),
    ("meta", {"property": "og:image:secure_url"}),
    ("meta", {"name": "twitter:image"}),
    ("meta", {"name": "twitter:image:src"}),
)


def _extract_og_url(html: str, page_url: str) -> Optional[str]:
    """Returns the first usable og:image / twitter:image URL, normalised to
    absolute form using the page URL as base."""
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")
    for tag_name, attrs in META_TAGS:
        el = soup.find(tag_name, attrs=attrs)
        if not el:
            continue
        content = el.get("content") or el.get("value")
        if not content:
            continue
        content = content.strip()
        if not content:
            continue
        if content.startswith("//"):
            scheme = urlparse(page_url).scheme or "https"
            return f"{scheme}:{content}"
        if content.startswith("/"):
            p = urlparse(page_url)
            return f"{p.scheme}://{p.netloc}{content}"
        if content.startswith("http"):
            return content
    return None


async def _http_get(client: httpx.AsyncClient, url: str) -> Optional[httpx.Response]:
    try:
        r = await client.get(url, follow_redirects=True, timeout=FETCH_TIMEOUT_SECONDS)
        if r.status_code != 200:
            return None
        return r
    except (httpx.TimeoutException, httpx.RequestError, httpx.HTTPStatusError):
        return None


async def fetch_and_cache(
    db, *, article_url: str, source_name: str,
) -> Optional[Dict[str, Any]]:
    """Returns dict `{hero_image_url, photo_credit, source_url, width, height}`
    on success, or None when the image is unavailable / invalid / blocked.
    Result is cached for 7 days.

    Never raises — failures degrade silently to None so the frontend can
    render the designed fallback hero.
    """
    if _disabled() or not article_url:
        return None

    # blocklist guard
    if await is_blocked(db, article_url):
        await _save_cache(
            db, url=article_url, status="failed",
            hero_image_url=None, photo_credit=None, source_url=None,
            width=None, height=None, reason="blocklisted",
        )
        return None

    # cache hit?
    cached = await _cached_lookup(db, article_url)
    if cached:
        if cached.get("status") == "ok":
            return {
                "hero_image_url": cached["hero_image_url"],
                "photo_credit": cached["photo_credit"],
                "source_url": cached.get("source_url"),
                "width": cached.get("width"),
                "height": cached.get("height"),
            }
        return None  # negative cache hit

    # full fetch
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "fi,en;q=0.8"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        page = await _http_get(client, article_url)
        if not page:
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=None,
                width=None, height=None, reason="page_fetch_failed",
            )
            return None

        og_url = _extract_og_url(page.text, article_url)
        if not og_url:
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=None,
                width=None, height=None, reason="no_og_image_tag",
            )
            return None

        img_res = await _http_get(client, og_url)
        if not img_res:
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=og_url,
                width=None, height=None, reason="image_fetch_failed",
            )
            return None

        ctype = (img_res.headers.get("content-type") or "").lower().split(";")[0].strip()
        if not ctype.startswith("image/"):
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=og_url,
                width=None, height=None,
                reason=f"non_image_content_type:{ctype or 'unknown'}",
            )
            return None

        raw = img_res.content[:MAX_BYTES]
        try:
            img = Image.open(io.BytesIO(raw))
            img.verify()
            img = Image.open(io.BytesIO(raw))
            w, h = img.size
        except Exception as e:
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=og_url,
                width=None, height=None,
                reason=f"image_decode_failed:{e.__class__.__name__}",
            )
            return None

        if w < MIN_WIDTH or h < MIN_HEIGHT:
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=og_url,
                width=w, height=h,
                reason=f"image_too_small:{w}x{h}",
            )
            return None

        # convert + save as jpeg
        key = _cache_key(article_url)
        out_path = _cache_path(key)
        try:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(out_path, format="JPEG", quality=82, optimize=True)
        except Exception as e:
            await _save_cache(
                db, url=article_url, status="failed",
                hero_image_url=None, photo_credit=None, source_url=og_url,
                width=w, height=h, reason=f"save_failed:{e.__class__.__name__}",
            )
            return None

        cached_doc = await _save_cache(
            db, url=article_url, status="ok",
            hero_image_url=_public_url(key),
            photo_credit=f"Photo: {source_name}",
            source_url=og_url, width=w, height=h,
        )
        return {
            "hero_image_url": cached_doc["hero_image_url"],
            "photo_credit": cached_doc["photo_credit"],
            "source_url": og_url,
            "width": w,
            "height": h,
        }


# ── Indexes ───────────────────────────────────────────────────────────────
async def ensure_indexes(db) -> None:
    try:
        await db.news_hero_cache.create_index("key", unique=True)
        await db.news_hero_cache.create_index("fetched_at")
        await db.og_image_blocklist.create_index("domain", unique=True)
    except Exception:
        logger.exception("og_image_fetcher.ensure_indexes failed")
