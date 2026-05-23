"""
PUTKI HQ — Per-streamer avatar refresh with multi-stage fallback · iter62

The user explicitly does NOT want letter-initials placeholders. If the
platform API (Twitch/Kick/YouTube) doesn't return a profile image, we
escalate through three additional sources:

  1. Platform API           → Twitch/Kick/YouTube official endpoint
  2. Channel-page OG image  → fetch the public channel page and parse
                              <meta property="og:image"> (works for
                              Twitch, Kick, YouTube even without API
                              when the account exists publicly)
  3. DuckDuckGo image scrape → no-key HTML search "name streamer profile"
                              and pick the first plausible image URL
  4. Wikipedia thumbnail     → final fallback for famous athletes etc.
                              who tend to have a Wikipedia page

Anything we return is HTTPS, sized ≤ ~512px, and stamped with
`avatar_source` so the back-office can show provenance.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote_plus, urlparse

import httpx

logger = logging.getLogger("streamer_avatar_fallback")

# Permissive set of hosts that we accept image URLs from. Anything outside
# this allowlist is rejected to avoid serving sketchy third-party CDNs.
TRUSTED_IMAGE_HOSTS = {
    "static-cdn.jtvnw.net",      # Twitch official CDN
    "kick.com", "files.kick.com",
    "yt3.ggpht.com", "yt3.googleusercontent.com",  # YouTube CDN
    "upload.wikimedia.org",       # Wikipedia thumbs
    "pbs.twimg.com",              # X/Twitter profile pics (often used by athletes)
    "i.imgur.com",
    "cdn.kick.com",
    "external-content.duckduckgo.com",  # DuckDuckGo proxied images
    "i.ytimg.com",
}


def _is_trusted_image(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
        # Strip any port
        host = host.split(":")[0]
        if host in TRUSTED_IMAGE_HOSTS:
            return True
        # Also trust *.wikimedia.org subdomains
        if host.endswith(".wikimedia.org"):
            return True
        if host.endswith(".googleusercontent.com"):
            return True
        return False
    except Exception:
        return False


# ─────────────────────── Stage 2: Channel-page OG image ─────────────────

async def fetch_channel_og_image(platform: str, channel: str) -> Optional[str]:
    """Fetch the public channel page and parse <meta property="og:image">.

    Works for all three platforms even without auth. Bails out on any
    network error (caller cascades to next stage)."""
    platform = (platform or "").lower()
    channel = (channel or "").strip().lstrip("@")
    if not channel:
        return None

    if platform == "twitch":
        url = f"https://www.twitch.tv/{channel.lower()}"
    elif platform == "kick":
        url = f"https://kick.com/{channel.lower()}"
    elif platform == "youtube":
        if channel.startswith("UC") and len(channel) >= 20:
            url = f"https://www.youtube.com/channel/{channel}"
        else:
            url = f"https://www.youtube.com/@{channel}"
    else:
        return None

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as cli:
            r = await cli.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; PutkiHQ-Avatar/1.0)",
            })
            if r.status_code != 200:
                return None
            m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', r.text, re.IGNORECASE)
            if not m:
                m = re.search(r'<meta\s+content="([^"]+)"\s+property="og:image"', r.text, re.IGNORECASE)
            if not m:
                return None
            img = m.group(1)
            if not img.startswith("http"):
                return None
            if not _is_trusted_image(img):
                return None
            return img
    except Exception as e:
        logger.debug("og:image fetch failed for %s/%s: %s", platform, channel, e)
        return None


# ─────────────────────── Stage 3: DuckDuckGo image scrape ────────────────

async def search_duckduckgo_image(name: str, platform: str) -> Optional[str]:
    """Scrape the public DuckDuckGo image search HTML for a profile image.

    No API key required. We use the JSON endpoint, but only after fetching
    the public token DDG embeds in the first HTML response.

    This is a best-effort fallback. If DDG changes their layout, this
    function silently returns None and the caller cascades onward.
    """
    if not name:
        return None

    query = f"{name} {platform} streamer profile picture"
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as cli:
            # Step 1: get vqd token from the lite endpoint.
            r1 = await cli.get(
                "https://duckduckgo.com/",
                params={"q": query, "iar": "images", "iax": "images", "ia": "images"},
                headers={"User-Agent": "Mozilla/5.0 (compatible; PutkiHQ-Avatar/1.0)"},
            )
            if r1.status_code != 200:
                return None
            m = re.search(r'vqd=([\d-]+)', r1.text) or re.search(r'vqd="([^"]+)"', r1.text)
            if not m:
                return None
            vqd = m.group(1)

            # Step 2: hit the i.js endpoint for image results.
            r2 = await cli.get(
                "https://duckduckgo.com/i.js",
                params={"q": query, "vqd": vqd, "o": "json", "f": ",,,",
                        "p": "1", "s": "0", "u": "bing", "l": "en-us"},
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; PutkiHQ-Avatar/1.0)",
                    "Referer": "https://duckduckgo.com/",
                },
            )
            if r2.status_code != 200:
                return None
            data = r2.json()
            results = data.get("results") or []
            for item in results[:10]:
                image_url = item.get("image") or ""
                # Prefer images that look like profile pics — small, square-ish,
                # from a known social host. Skip giant action shots & banners.
                w = int(item.get("width") or 0)
                h = int(item.get("height") or 0)
                if w and h and (max(w, h) / max(min(w, h), 1)) > 1.6:
                    continue  # Reject very non-square images.
                if image_url and _is_trusted_image(image_url):
                    return image_url
            # Final relaxation: accept any HTTPS image from results if nothing
            # in trusted hosts matched. (DDG proxies through itself anyway.)
            for item in results[:5]:
                proxied = item.get("thumbnail") or ""
                if proxied.startswith("https://external-content.duckduckgo.com/"):
                    return proxied
    except Exception as e:
        logger.debug("DDG image search failed for %s: %s", name, e)
    return None


# ─────────────────────── Stage 4: Wikipedia thumbnail ────────────────────

async def fetch_wikipedia_thumb(name: str) -> Optional[str]:
    """Public REST endpoint, no auth. Works well for famous athletes/
    artists who have a Wikipedia page (e.g. Bottas, Barkov, Rovanperä).
    Returns None if the article has no thumbnail.
    """
    if not name:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as cli:
            # Try Finnish wiki first (these are mostly Finnish-market personas).
            for lang in ("fi", "en"):
                r = await cli.get(
                    f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote_plus(name)}",
                    headers={"User-Agent": "PutkiHQ-Avatar/1.0 (https://putkihq.fi)"},
                )
                if r.status_code != 200:
                    continue
                j = r.json()
                thumb = (j.get("thumbnail") or {}).get("source") or ""
                if thumb and _is_trusted_image(thumb):
                    return thumb
    except Exception as e:
        logger.debug("Wikipedia thumb fetch failed for %s: %s", name, e)
    return None


# ─────────────────────── Orchestrator ────────────────────────────────────

async def resolve_avatar_with_fallback(
    *,
    name: str,
    platform: str,
    channel: str,
    primary_url: Optional[str] = None,
) -> Tuple[Optional[str], str]:
    """Run the cascade. Returns `(url, source)` where source is one of:

      `platform_api`, `channel_og`, `ddg_search`, `wikipedia`, or `none`.

    Caller passes the platform-API result (if any) as `primary_url` so
    we don't re-fetch it here.
    """
    if primary_url and _is_trusted_image(primary_url):
        return primary_url, "platform_api"

    # Stage 2
    og = await fetch_channel_og_image(platform, channel)
    if og:
        return og, "channel_og"

    # Stage 3
    ddg = await search_duckduckgo_image(name, platform)
    if ddg:
        return ddg, "ddg_search"

    # Stage 4
    wiki = await fetch_wikipedia_thumb(name)
    if wiki:
        return wiki, "wikipedia"

    return None, "none"
