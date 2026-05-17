"""
PUTKI HQ — Twitch Helix client for EventSub subscription lifecycle.

Responsibilities:
  • Exchange client_credentials for an app-access-token (cached until ~5 min before expiry)
  • List existing EventSub subscriptions
  • Resolve Twitch login → broadcaster_user_id via /helix/users
  • Create EventSub subscriptions (stream.online primarily) pointing at our webhook callback
  • Delete subscriptions by id

Secrets are read from env only — they are never logged, never returned in responses.
The token cache is process-local; the worker pod restart re-fetches.

Env vars expected:
  TWITCH_CLIENT_ID
  TWITCH_CLIENT_SECRET
  TWITCH_EVENTSUB_SECRET           (HMAC secret shared with the webhook receiver)
  TWITCH_EVENTSUB_CALLBACK_URL     (public HTTPS, e.g. https://putkihq.fi/api/webhooks/twitch)
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Optional

import httpx


logger = logging.getLogger(__name__)

TWITCH_OAUTH_URL    = "https://id.twitch.tv/oauth2/token"
TWITCH_HELIX_BASE   = "https://api.twitch.tv/helix"

_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": 0}
_TOKEN_LOCK = asyncio.Lock()


def _client_id() -> str:
    return os.environ.get("TWITCH_CLIENT_ID", "")


def _client_secret() -> str:
    return os.environ.get("TWITCH_CLIENT_SECRET", "")


def _eventsub_secret() -> str:
    return os.environ.get("TWITCH_EVENTSUB_SECRET", "")


def _callback_url() -> str:
    return os.environ.get("TWITCH_EVENTSUB_CALLBACK_URL", "")


def is_configured() -> bool:
    return bool(_client_id() and _client_secret() and _eventsub_secret() and _callback_url())


async def get_app_access_token(force_refresh: bool = False) -> str:
    """Returns a cached app-access-token. Refreshes when it has <5 min left."""
    if not (_client_id() and _client_secret()):
        raise RuntimeError("twitch_oauth_credentials_missing")

    now = time.time()
    if (not force_refresh) and _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > (now + 300):
        return _TOKEN_CACHE["token"]

    async with _TOKEN_LOCK:
        # double-check in case another task refreshed while we waited
        if (not force_refresh) and _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > (now + 300):
            return _TOKEN_CACHE["token"]

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                TWITCH_OAUTH_URL,
                params={
                    "client_id": _client_id(),
                    "client_secret": _client_secret(),
                    "grant_type": "client_credentials",
                },
            )
        if resp.status_code != 200:
            # Never log the request body (client_secret would leak).
            raise RuntimeError(f"twitch_oauth_failed:status={resp.status_code}")
        data = resp.json()
        token = data.get("access_token")
        expires_in = int(data.get("expires_in") or 0)
        if not token:
            raise RuntimeError("twitch_oauth_no_token_in_response")
        _TOKEN_CACHE["token"] = token
        _TOKEN_CACHE["expires_at"] = time.time() + expires_in
        logger.info("Refreshed Twitch app-access-token (expires in %s s)", expires_in)
        return token


async def _helix_request(method: str, path: str, *, params: Optional[dict] = None,
                         json_body: Optional[dict] = None) -> tuple[int, dict | list | None]:
    token = await get_app_access_token()
    headers = {
        "Client-Id": _client_id(),
        "Authorization": f"Bearer {token}",
    }
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.request(
            method,
            f"{TWITCH_HELIX_BASE}{path}",
            headers=headers,
            params=params,
            json=json_body,
        )
    body: Any = None
    if resp.content:
        try:
            body = resp.json()
        except Exception:
            body = {"raw_text": resp.text[:400]}
    return resp.status_code, body


async def list_subscriptions(status: Optional[str] = None) -> dict:
    params = {"status": status} if status else None
    code, body = await _helix_request("GET", "/eventsub/subscriptions", params=params)
    if code != 200:
        return {"ok": False, "status_code": code, "body": body}
    data = body or {}
    return {
        "ok": True,
        "total": data.get("total"),
        "subscriptions": data.get("data", []),
        "total_cost": data.get("total_cost"),
        "max_total_cost": data.get("max_total_cost"),
    }


async def resolve_user_id(login: str) -> Optional[str]:
    """Resolve a Twitch login (case-insensitive) to its broadcaster_user_id."""
    if not login:
        return None
    code, body = await _helix_request("GET", "/users", params={"login": login.lower()})
    if code != 200 or not body:
        return None
    rows = (body or {}).get("data", [])
    if not rows:
        return None
    return rows[0].get("id")


async def create_stream_online_subscription(broadcaster_user_id: str) -> dict:
    """Create a stream.online EventSub subscription via webhook transport."""
    if not is_configured():
        return {"ok": False, "error": "twitch_not_configured"}
    payload = {
        "type": "stream.online",
        "version": "1",
        "condition": {"broadcaster_user_id": str(broadcaster_user_id)},
        "transport": {
            "method": "webhook",
            "callback": _callback_url(),
            "secret": _eventsub_secret(),
        },
    }
    code, body = await _helix_request("POST", "/eventsub/subscriptions", json_body=payload)
    if code in (200, 202):
        return {"ok": True, "status_code": code, "subscription": (body or {}).get("data", [{}])[0]}
    return {"ok": False, "status_code": code, "body": body}


async def delete_subscription(subscription_id: str) -> dict:
    code, body = await _helix_request("DELETE", "/eventsub/subscriptions",
                                       params={"id": subscription_id})
    return {"ok": code in (200, 204), "status_code": code, "body": body}
