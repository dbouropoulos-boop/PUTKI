"""
Mittari Phase 3 V2 — Step 2 webhook signal handlers.

Three webhook receivers per FINAL ARCHITECTURE §6.1:
  • POST /api/webhooks/twitch         — Twitch EventSub (HMAC-SHA256)
  • POST /api/webhooks/kick           — Kick livestream events
  • GET|POST /api/webhooks/youtube/pubsub — YouTube PubSubHubbub (HMAC-SHA1)

All three normalise into the same `signals` collection used by the polling
adapters in signal_engine.py — webhook ingestion is simply a faster ingress
path for the same downstream dial / aggregation pipeline.

Honesty contract: when env vars are unset, handlers return 503 instead of
throwing or fabricating accepts. The endpoints can sit dormant until the
user supplies API credentials post-platform-registration.

Signature schemes (verified against current 2026 platform docs):
  - Twitch: HMAC-SHA256 over (message_id + timestamp + raw_body), hex,
    header `Twitch-Eventsub-Message-Signature: sha256=<hex>`
  - Kick:   HMAC-SHA256 over raw_body (canonical fallback until Kick's
    asymmetric scheme is finalised; KICK_SIGNATURE_HEADER + KICK_WEBHOOK_SECRET
    env-configurable so we can flip to public-key verification when their
    docs settle without code changes)
  - YouTube PubSub: HMAC-SHA1 over raw_body, header `X-Hub-Signature: sha1=<hex>`

Replay protection: webhook_message_ids collection with TTL index (600s).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from pymongo.errors import DuplicateKeyError


logger = logging.getLogger(__name__)


# ── Twitch ──────────────────────────────────────────────────────────────────
TWITCH_SIG_HEADER = "Twitch-Eventsub-Message-Signature"
TWITCH_MSG_ID_HEADER = "Twitch-Eventsub-Message-Id"
TWITCH_TS_HEADER = "Twitch-Eventsub-Message-Timestamp"
TWITCH_TYPE_HEADER = "Twitch-Eventsub-Message-Type"
TWITCH_MAX_SKEW_SECONDS = 600


def _twitch_secret() -> Optional[str]:
    return os.environ.get("TWITCH_EVENTSUB_SECRET") or None


def _verify_twitch(secret: str, request: Request, body: bytes) -> Tuple[bool, Optional[str]]:
    msg_id = request.headers.get(TWITCH_MSG_ID_HEADER)
    ts = request.headers.get(TWITCH_TS_HEADER)
    sig = request.headers.get(TWITCH_SIG_HEADER)
    if not (msg_id and ts and sig):
        return False, "missing_headers"
    try:
        ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return False, "invalid_timestamp"
    if abs((datetime.now(timezone.utc) - ts_dt).total_seconds()) > TWITCH_MAX_SKEW_SECONDS:
        return False, "timestamp_skew"
    base = (msg_id + ts).encode("utf-8") + body
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), base, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return False, "signature_mismatch"
    return True, None


# ── Kick ────────────────────────────────────────────────────────────────────
# Header + algorithm are env-configurable so we can adjust without redeploy
# when Kick's docs finalise (community libraries currently lean on
# HMAC-SHA256-over-raw-body as the canonical pattern).
def _kick_secret() -> Optional[str]:
    return os.environ.get("KICK_WEBHOOK_SECRET") or None


def _verify_kick(secret: str, request: Request, body: bytes) -> Tuple[bool, Optional[str]]:
    header_name = os.environ.get("KICK_SIGNATURE_HEADER", "Kick-Event-Signature")
    sig = request.headers.get(header_name) or request.headers.get("X-Kick-Signature")
    if not sig:
        return False, "missing_signature"
    sig_clean = sig[len("sha256="):] if sig.startswith("sha256=") else sig
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig_clean):
        return False, "signature_mismatch"
    return True, None


# ── YouTube PubSubHubbub ────────────────────────────────────────────────────
def _youtube_secret() -> Optional[str]:
    return os.environ.get("YOUTUBE_PUBSUB_SECRET") or None


def _verify_youtube_pubsub(secret: str, request: Request, body: bytes) -> Tuple[bool, Optional[str]]:
    sig = request.headers.get("X-Hub-Signature")
    if not sig or not sig.startswith("sha1="):
        return False, "missing_signature"
    received = sig.split("=", 1)[1]
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha1).hexdigest()
    if not hmac.compare_digest(expected, received):
        return False, "signature_mismatch"
    return True, None


def _extract_yt_video_ids(atom_xml: bytes) -> list:
    ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    try:
        root = ET.fromstring(atom_xml)
    except ET.ParseError:
        return []
    out = []
    for entry in root.findall("atom:entry", ns):
        vid = entry.find("yt:videoId", ns)
        ch = entry.find("yt:channelId", ns)
        if vid is not None and vid.text:
            out.append({"video_id": vid.text, "channel_id": ch.text if ch is not None else None})
    return out


# ── Replay protection ───────────────────────────────────────────────────────
async def _ensure_replay_index(db) -> None:
    """Idempotent — create the TTL index for replay protection if missing."""
    try:
        await db.webhook_message_ids.create_index(
            "first_seen", expireAfterSeconds=600, name="ttl_first_seen"
        )
    except Exception:
        logger.exception("Failed to create webhook_message_ids TTL index")


async def _record_message_id(db, source: str, message_id: str) -> bool:
    """Returns True if newly inserted (process this event), False if duplicate (replay)."""
    if not message_id:
        return True
    try:
        await db.webhook_message_ids.insert_one({
            "_id": f"{source}:{message_id}",
            "source": source,
            "first_seen": datetime.now(timezone.utc),
        })
        return True
    except DuplicateKeyError:
        return False


# ── Signal write ───────────────────────────────────────────────────────────
async def _write_signal(db, *, source: str, event_type: str, payload: Dict[str, Any], raw: Any = None) -> None:
    """Normalised insert into the existing signals collection (same shape as
    polling adapters in signal_engine.py)."""
    doc = {
        "source": source,
        "event_type": event_type,
        "payload": payload,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "mocked": False,
        "ingress": "webhook",
    }
    if raw is not None:
        doc["raw"] = raw
    await db.signals.insert_one(doc)


# ── Router factory ──────────────────────────────────────────────────────────
def build_webhook_router(db) -> APIRouter:
    """Build a router bound to the shared Motor db handle.
    Mounted at /api/webhooks by server.py."""
    r = APIRouter(prefix="/webhooks", tags=["webhooks"])

    @r.post("/twitch")
    async def twitch_webhook(request: Request):
        secret = _twitch_secret()
        if not secret:
            return JSONResponse(status_code=503, content={"detail": "Twitch integration not configured"})

        body = await request.body()
        ok, why = _verify_twitch(secret, request, body)
        if not ok:
            return JSONResponse(status_code=403, content={"detail": f"twitch_verify_failed:{why}"})

        msg_id = request.headers.get(TWITCH_MSG_ID_HEADER, "")
        if not await _record_message_id(db, "twitch", msg_id):
            return Response(status_code=200)  # replay — acknowledge silently

        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            return JSONResponse(status_code=400, content={"detail": "invalid_json"})

        msg_type = (request.headers.get(TWITCH_TYPE_HEADER) or "").lower()
        if msg_type == "webhook_callback_verification":
            challenge = payload.get("challenge", "")
            return PlainTextResponse(content=challenge, status_code=200)

        if msg_type == "notification":
            sub = payload.get("subscription") or {}
            event = payload.get("event") or {}
            await _write_signal(
                db,
                source="twitch",
                event_type=sub.get("type") or "twitch.unknown",
                payload={
                    "broadcaster_user_id": event.get("broadcaster_user_id"),
                    "broadcaster_user_login": event.get("broadcaster_user_login"),
                    "broadcaster_user_name": event.get("broadcaster_user_name"),
                    "type": event.get("type"),
                    "category_name": event.get("category_name"),
                    "title": event.get("title"),
                    "started_at": event.get("started_at"),
                },
                raw=payload,
            )
            return Response(status_code=204)

        if msg_type == "revocation":
            await _write_signal(db, source="twitch", event_type="revocation", payload=payload)
            return Response(status_code=204)

        return Response(status_code=204)

    @r.post("/kick")
    async def kick_webhook(request: Request):
        secret = _kick_secret()
        if not secret:
            return JSONResponse(status_code=503, content={"detail": "Kick integration not configured"})

        body = await request.body()
        ok, why = _verify_kick(secret, request, body)
        if not ok:
            return JSONResponse(status_code=403, content={"detail": f"kick_verify_failed:{why}"})

        # Kick uses an event-id header (community libraries surface it as
        # `Kick-Event-Message-Id`). Treat any of these as the dedup key.
        msg_id = (
            request.headers.get("Kick-Event-Message-Id")
            or request.headers.get("X-Kick-Event-Id")
            or ""
        )
        if msg_id and not await _record_message_id(db, "kick", msg_id):
            return Response(status_code=200)

        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            return JSONResponse(status_code=400, content={"detail": "invalid_json"})

        event_type = (
            request.headers.get("Kick-Event-Type")
            or payload.get("type")
            or payload.get("event")
            or "kick.unknown"
        )
        # Kick livestream payload shape varies — normalise the fields the
        # hub cards need (channel slug + viewer count + category if present).
        data = payload.get("data") if isinstance(payload, dict) else None
        body_payload = data or payload
        await _write_signal(
            db,
            source="kick",
            event_type=event_type,
            payload={
                "slug":          body_payload.get("slug") if isinstance(body_payload, dict) else None,
                "channel":       body_payload.get("channel") if isinstance(body_payload, dict) else None,
                "broadcaster":   body_payload.get("broadcaster") if isinstance(body_payload, dict) else None,
                "is_live":       body_payload.get("is_live") if isinstance(body_payload, dict) else None,
                "viewer_count":  body_payload.get("viewer_count") if isinstance(body_payload, dict) else None,
                "category":      body_payload.get("category") if isinstance(body_payload, dict) else None,
                "session_title": body_payload.get("session_title") if isinstance(body_payload, dict) else None,
            },
            raw=payload,
        )
        return Response(status_code=200)

    @r.get("/youtube/pubsub")
    async def youtube_pubsub_verify(request: Request):
        """Hub challenge handshake. Returns 503 when unconfigured so dormant
        endpoints don't accidentally subscribe themselves to feeds."""
        if not _youtube_secret():
            return JSONResponse(status_code=503, content={"detail": "YouTube PubSub integration not configured"})
        params = request.query_params
        mode = params.get("hub.mode")
        challenge = params.get("hub.challenge")
        if mode in ("subscribe", "unsubscribe") and challenge:
            return PlainTextResponse(content=challenge, status_code=200)
        return JSONResponse(status_code=400, content={"detail": "invalid_pubsub_verify"})

    @r.post("/youtube/pubsub")
    async def youtube_pubsub_notify(request: Request):
        secret = _youtube_secret()
        if not secret:
            return JSONResponse(status_code=503, content={"detail": "YouTube PubSub integration not configured"})

        body = await request.body()
        ok, why = _verify_youtube_pubsub(secret, request, body)
        if not ok:
            # Per WebSub spec — still acknowledge but ignore body.
            return Response(status_code=202)

        # Atom hashes are body-content so dedup on body sha as message id.
        msg_id = hashlib.sha256(body).hexdigest()[:32]
        if not await _record_message_id(db, "youtube", msg_id):
            return Response(status_code=204)

        entries = _extract_yt_video_ids(body)
        for e in entries:
            await _write_signal(
                db,
                source="youtube",
                event_type="video.published",
                payload={
                    "video_id":   e.get("video_id"),
                    "channel_id": e.get("channel_id"),
                },
                raw={"atom_excerpt": body[:1000].decode("utf-8", errors="ignore")},
            )
        return Response(status_code=204)

    # ── Status surface for /back-office (handler health + last events) ──
    @r.get("/status")
    async def webhook_status():
        last = {}
        for src in ("twitch", "kick", "youtube"):
            doc = await db.signals.find_one(
                {"source": src, "ingress": "webhook"},
                {"_id": 0, "event_type": 1, "observed_at": 1},
                sort=[("observed_at", -1)],
            )
            last[src] = doc
        return {
            "twitch_configured": bool(_twitch_secret()),
            "kick_configured": bool(_kick_secret()),
            "youtube_configured": bool(_youtube_secret()),
            "last_webhook_signal_by_source": last,
            "callback_urls": {
                "twitch":  os.environ.get("TWITCH_EVENTSUB_CALLBACK_URL", ""),
                "kick":    os.environ.get("KICK_WEBHOOK_URL", ""),
                "youtube": os.environ.get("YOUTUBE_PUBSUB_CALLBACK_URL", ""),
            },
        }

    return r
