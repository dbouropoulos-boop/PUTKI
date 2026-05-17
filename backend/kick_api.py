"""
PUTKI HQ — Kick API client for events:subscribe lifecycle.

Kick differs from Twitch in two important ways:
  1. Webhook signature uses **RSA PKCS1v15 SHA256** over `{message_id}.{timestamp}.{body}`,
     base64-decoded `Kick-Event-Signature` header — NOT HMAC.
  2. The callback URL is configured at the **app level** on Kick's developer portal,
     not per-subscription in the API payload. So `KICK_WEBHOOK_CALLBACK_URL` here is
     informational only — make sure it matches what's registered on the Kick side.

Refs:
  - https://docs.kick.com/events/subscribe-to-events
  - https://docs.kick.com/events/webhook-security
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Optional

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.exceptions import InvalidSignature


logger = logging.getLogger(__name__)

KICK_OAUTH_TOKEN_URL  = "https://id.kick.com/oauth/token"
KICK_API_BASE         = "https://api.kick.com/public/v1"

# Fallback static public key from Kick docs (used if the live fetch fails).
KICK_PUBLIC_KEY_FALLBACK = b"""-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----
"""

_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": 0}
_TOKEN_LOCK = asyncio.Lock()
_PUBKEY_CACHE: dict[str, Any] = {"pem": None, "fetched_at": 0}
_PUBKEY_TTL_SECONDS = 24 * 3600  # rotate cache once per day


def _client_id() -> str:     return os.environ.get("KICK_CLIENT_ID", "")
def _client_secret() -> str: return os.environ.get("KICK_CLIENT_SECRET", "")
def _callback_url() -> str:  return os.environ.get("KICK_WEBHOOK_CALLBACK_URL", "")


def is_configured() -> bool:
    return bool(_client_id() and _client_secret())


async def get_app_access_token(force_refresh: bool = False) -> str:
    if not is_configured():
        raise RuntimeError("kick_oauth_credentials_missing")

    now = time.time()
    if (not force_refresh) and _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > (now + 300):
        return _TOKEN_CACHE["token"]

    async with _TOKEN_LOCK:
        if (not force_refresh) and _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > (now + 300):
            return _TOKEN_CACHE["token"]
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                KICK_OAUTH_TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": _client_id(),
                    "client_secret": _client_secret(),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code != 200:
            raise RuntimeError(f"kick_oauth_failed:status={resp.status_code}")
        data = resp.json()
        token = data.get("access_token")
        expires_in = int(data.get("expires_in") or 0)
        if not token:
            raise RuntimeError("kick_oauth_no_token_in_response")
        _TOKEN_CACHE["token"] = token
        _TOKEN_CACHE["expires_at"] = time.time() + expires_in
        logger.info("Refreshed Kick app-access-token (expires in %s s)", expires_in)
        return token


async def _kick_request(method: str, path: str, *, params: Optional[dict] = None,
                        json_body: Optional[dict] = None) -> tuple[int, Any]:
    token = await get_app_access_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.request(method, f"{KICK_API_BASE}{path}",
                                     headers=headers, params=params, json=json_body)
    body: Any = None
    if resp.content:
        try:
            body = resp.json()
        except Exception:
            body = {"raw_text": resp.text[:400]}
    return resp.status_code, body


async def fetch_public_key(force_refresh: bool = False) -> bytes:
    """Returns Kick's webhook-signing public key (PEM bytes). Cached 24 h.
    Falls back to the static key documented at docs.kick.com if the live
    endpoint is unreachable."""
    now = time.time()
    if (not force_refresh) and _PUBKEY_CACHE["pem"] and (now - _PUBKEY_CACHE["fetched_at"]) < _PUBKEY_TTL_SECONDS:
        return _PUBKEY_CACHE["pem"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{KICK_API_BASE}/public-key")
        if resp.status_code == 200 and resp.content:
            data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            pem = None
            if isinstance(data, dict):
                # docs example shape: {"data": {"public_key": "-----BEGIN..."}}
                inner = data.get("data") if isinstance(data.get("data"), dict) else data
                pem = inner.get("public_key") or inner.get("publicKey")
            if pem:
                _PUBKEY_CACHE["pem"] = pem.encode("utf-8") if isinstance(pem, str) else pem
                _PUBKEY_CACHE["fetched_at"] = now
                return _PUBKEY_CACHE["pem"]
    except Exception:
        logger.exception("Failed to fetch live Kick public key; falling back to static")
    _PUBKEY_CACHE["pem"] = KICK_PUBLIC_KEY_FALLBACK
    _PUBKEY_CACHE["fetched_at"] = now
    return KICK_PUBLIC_KEY_FALLBACK


def verify_signature(public_key_pem: bytes, message_id: str, timestamp: str,
                     raw_body: bytes, signature_b64: str) -> bool:
    """RSA PKCS1v15 SHA-256 verify over `{message_id}.{timestamp}.{raw_body}`."""
    if not (public_key_pem and message_id and timestamp and signature_b64):
        return False
    try:
        import base64
        sig = base64.b64decode(signature_b64)
        pubkey = serialization.load_pem_public_key(public_key_pem)
        signed = f"{message_id}.{timestamp}.".encode("utf-8") + raw_body
        pubkey.verify(sig, signed, padding.PKCS1v15(), hashes.SHA256())
        return True
    except (InvalidSignature, Exception):
        return False


async def resolve_broadcaster_user_id(slug: str) -> Optional[int]:
    """Resolve a Kick channel slug → broadcaster_user_id."""
    if not slug:
        return None
    code, body = await _kick_request("GET", "/channels", params={"slug": slug.lower()})
    if code != 200 or not body:
        return None
    rows = (body or {}).get("data") or []
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    return row.get("broadcaster_user_id") or row.get("user_id") or row.get("id")


async def list_subscriptions(broadcaster_user_id: Optional[int] = None) -> dict:
    params = {"broadcaster_user_id": broadcaster_user_id} if broadcaster_user_id else None
    code, body = await _kick_request("GET", "/events/subscriptions", params=params)
    if code != 200:
        return {"ok": False, "status_code": code, "body": body}
    return {"ok": True, "subscriptions": (body or {}).get("data") or []}


async def create_subscription(broadcaster_user_id: int, events: list[dict]) -> dict:
    """events example: [{"name": "channel.subscription.gifts", "version": 1}, ...]"""
    if not is_configured():
        return {"ok": False, "error": "kick_not_configured"}
    payload = {
        "broadcaster_user_id": int(broadcaster_user_id),
        "events": events,
        "method": "webhook",
    }
    code, body = await _kick_request("POST", "/events/subscriptions", json_body=payload)
    if code in (200, 202):
        return {"ok": True, "status_code": code, "data": (body or {}).get("data") or []}
    return {"ok": False, "status_code": code, "body": body}


async def delete_subscription(subscription_id: str) -> dict:
    code, body = await _kick_request("DELETE", "/events/subscriptions",
                                      params={"id": subscription_id})
    return {"ok": code in (200, 204), "status_code": code, "body": body}
