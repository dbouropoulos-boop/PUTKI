"""
PUTKI HQ — YouTube PubSubHubbub (WebSub) + Data API client.

PubSubHubbub is YouTube's mechanism for getting push notifications when a
channel uploads a new video. Each subscription is per-channel and has a
~5–10 day lease that must be renewed.

Flow:
  1. Resolve channel handle / username → channel_id via Data API v3
  2. POST hub.mode=subscribe to https://pubsubhubbub.appspot.com/subscribe
     with hub.callback=<our public endpoint>, hub.topic=<channel feed URL>,
     hub.secret=YOUTUBE_PUBSUB_SECRET, hub.verify=async, hub.lease_seconds=<max>
  3. Hub calls back our endpoint with hub.challenge → handler echoes it (already wired)
  4. Hub posts atom feed updates signed with HMAC-SHA1(secret, body) (already wired)
  5. Re-subscribe before lease expires

Refs: https://www.w3.org/TR/websub/   (formerly pubsubhubbub spec)
      https://developers.google.com/youtube/v3/docs/channels/list
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx


logger = logging.getLogger(__name__)

PUBSUB_HUB_URL       = "https://pubsubhubbub.appspot.com/subscribe"
YOUTUBE_FEED_URL     = "https://www.youtube.com/xml/feeds/videos.xml?channel_id={channel_id}"
YOUTUBE_API_BASE     = "https://www.googleapis.com/youtube/v3"
DEFAULT_LEASE_SECS   = 60 * 60 * 24 * 5  # 5 days


def _api_key() -> str:        return os.environ.get("YOUTUBE_API_KEY", "")
def _pubsub_secret() -> str:  return os.environ.get("YOUTUBE_PUBSUB_SECRET", "")
def _callback_url() -> str:   return os.environ.get("YOUTUBE_PUBSUB_CALLBACK_URL", "")


def is_configured() -> bool:
    return bool(_pubsub_secret() and _callback_url())


def can_resolve_channels() -> bool:
    return bool(_api_key())


async def resolve_channel_id(handle_or_username: str) -> Optional[dict]:
    """Resolve a YouTube channel by handle (@xxx), legacy username, or pass
    through if it's already a UC… channel id. Returns
    {channel_id, title, custom_url} on success, or None on miss.
    """
    if not handle_or_username:
        return None
    val = handle_or_username.strip().lstrip("@")
    if not _api_key():
        # Allow direct channel_id passthrough so admins can still feed UCxxx
        # values into the registry even without a Data API key.
        return {"channel_id": val, "title": val, "custom_url": None} if val.startswith("UC") else None

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1) Try as channel handle (recommended modern shape)
        if not val.startswith("UC"):
            r = await client.get(f"{YOUTUBE_API_BASE}/channels", params={
                "part": "id,snippet",
                "forHandle": f"@{val}",
                "key": _api_key(),
            })
            if r.status_code == 200:
                items = (r.json() or {}).get("items") or []
                if items:
                    it = items[0]
                    return {
                        "channel_id": it.get("id"),
                        "title": (it.get("snippet") or {}).get("title"),
                        "custom_url": (it.get("snippet") or {}).get("customUrl"),
                    }
            # 2) Fall back to legacy username
            r = await client.get(f"{YOUTUBE_API_BASE}/channels", params={
                "part": "id,snippet",
                "forUsername": val,
                "key": _api_key(),
            })
            if r.status_code == 200:
                items = (r.json() or {}).get("items") or []
                if items:
                    it = items[0]
                    return {
                        "channel_id": it.get("id"),
                        "title": (it.get("snippet") or {}).get("title"),
                        "custom_url": (it.get("snippet") or {}).get("customUrl"),
                    }
            return None

        # 3) Direct UC… channel id
        r = await client.get(f"{YOUTUBE_API_BASE}/channels", params={
            "part": "id,snippet",
            "id": val,
            "key": _api_key(),
        })
        if r.status_code == 200:
            items = (r.json() or {}).get("items") or []
            if items:
                it = items[0]
                return {
                    "channel_id": it.get("id"),
                    "title": (it.get("snippet") or {}).get("title"),
                    "custom_url": (it.get("snippet") or {}).get("customUrl"),
                }
    return None


async def subscribe(channel_id: str, *, lease_seconds: int = DEFAULT_LEASE_SECS) -> dict:
    """POST hub.mode=subscribe to the WebSub hub. Returns the hub's response
    code + body. 202 Accepted is the success case; the hub will call us back
    with hub.challenge to confirm."""
    if not is_configured():
        return {"ok": False, "error": "youtube_pubsub_not_configured"}
    topic = YOUTUBE_FEED_URL.format(channel_id=channel_id)
    data = {
        "hub.mode": "subscribe",
        "hub.topic": topic,
        "hub.callback": _callback_url(),
        "hub.verify": "async",
        "hub.secret": _pubsub_secret(),
        "hub.lease_seconds": str(int(lease_seconds)),
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(PUBSUB_HUB_URL, data=data,
                                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    body: Any = None
    if resp.content:
        try:
            body = resp.text[:400]
        except Exception:
            body = None
    return {
        "ok": resp.status_code in (202, 204),
        "status_code": resp.status_code,
        "topic": topic,
        "lease_seconds": lease_seconds,
        "body": body,
    }


async def unsubscribe(channel_id: str) -> dict:
    if not is_configured():
        return {"ok": False, "error": "youtube_pubsub_not_configured"}
    topic = YOUTUBE_FEED_URL.format(channel_id=channel_id)
    data = {
        "hub.mode": "unsubscribe",
        "hub.topic": topic,
        "hub.callback": _callback_url(),
        "hub.verify": "async",
        "hub.secret": _pubsub_secret(),
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(PUBSUB_HUB_URL, data=data,
                                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    return {"ok": resp.status_code in (202, 204), "status_code": resp.status_code}
