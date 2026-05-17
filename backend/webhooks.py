"""
PUTKI HQ Phase 3 V2 — Step 2 webhook signal handlers.

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

from fastapi import APIRouter, Header, HTTPException, Request
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
# Per https://docs.kick.com/events/webhook-security — RSA PKCS1v15 SHA-256
# verification over `{message_id}.{timestamp}.{raw_body}`. The shared
# `KICK_WEBHOOK_SECRET` (set in our dev portal) is stored but unused for
# signature validation; Kick's published scheme is asymmetric-only as of
# 2026-Q1. We keep it in env in case Kick adds an HMAC second layer later.
def _kick_configured() -> bool:
    return bool(os.environ.get("KICK_CLIENT_ID") and os.environ.get("KICK_CLIENT_SECRET"))


async def _verify_kick(request: Request, body: bytes) -> Tuple[bool, Optional[str]]:
    from kick_api import fetch_public_key, verify_signature
    msg_id    = request.headers.get("Kick-Event-Message-Id")
    timestamp = request.headers.get("Kick-Event-Message-Timestamp")
    sig_b64   = request.headers.get("Kick-Event-Signature")
    if not (msg_id and timestamp and sig_b64):
        return False, "missing_headers"
    pem = await fetch_public_key()
    if not pem:
        return False, "public_key_unavailable"
    if not verify_signature(pem, msg_id, timestamp, body, sig_b64):
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
        if not _kick_configured():
            return JSONResponse(status_code=503, content={"detail": "Kick integration not configured"})

        body = await request.body()
        ok, why = await _verify_kick(request, body)
        if not ok:
            return JSONResponse(status_code=403, content={"detail": f"kick_verify_failed:{why}"})

        # Kick-Event-Message-Id is the idempotency key per official docs.
        msg_id = request.headers.get("Kick-Event-Message-Id") or ""
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
        now = datetime.now(timezone.utc)
        last = {}
        for src in ("twitch", "kick", "youtube"):
            doc = await db.signals.find_one(
                {"source": src, "ingress": "webhook"},
                {"_id": 0, "event_type": 1, "observed_at": 1},
                sort=[("observed_at", -1)],
            )
            age_seconds = None
            if doc and doc.get("observed_at"):
                try:
                    obs = datetime.fromisoformat(doc["observed_at"].replace("Z", "+00:00"))
                    age_seconds = int((now - obs).total_seconds())
                except Exception:
                    age_seconds = None
            last[src] = {
                "last_event": doc,
                "last_event_age_seconds": age_seconds,
            }

        # YouTube PubSub lease tracking. Hub leases are typically 5-10 days.
        # Stored as ISO-8601 string in settings.webhook_youtube_pubsub_lease_expires_at;
        # null when no subscription has been performed yet.
        lease_doc = await db.settings.find_one(
            {"key": "webhook_youtube_pubsub_lease"}, {"_id": 0}
        )
        lease_expires = lease_doc.get("expires_at") if lease_doc else None
        lease_seconds_remaining = None
        if lease_expires:
            try:
                exp_dt = datetime.fromisoformat(lease_expires.replace("Z", "+00:00"))
                lease_seconds_remaining = int((exp_dt - now).total_seconds())
            except Exception:
                lease_seconds_remaining = None

        return {
            "now": now.isoformat(),
            "twitch_configured": bool(_twitch_secret()),
            "kick_configured": _kick_configured(),
            "youtube_configured": bool(_youtube_secret()),
            "last_webhook_signal_by_source": last,
            "callback_urls": {
                "twitch":  os.environ.get("TWITCH_EVENTSUB_CALLBACK_URL", ""),
                "kick":    os.environ.get("KICK_WEBHOOK_URL", ""),
                "youtube": os.environ.get("YOUTUBE_PUBSUB_CALLBACK_URL", ""),
            },
            "youtube_pubsub_lease": {
                "expires_at": lease_expires,
                "seconds_remaining": lease_seconds_remaining,
            },
            "expected_cadence_seconds": {
                # Used by /back-office/webhooks to colour-code freshness.
                # Stream pings are roughly one per minute when channels are
                # live; static "stale" threshold of 1 h is generous.
                "twitch": 3600,
                "kick": 3600,
                "youtube": 86400,  # YT videos are sparse; daily is healthy.
            },
        }

    # ── Operational recovery — force resubscribe (admin only) ──
    @r.post("/resubscribe/{source}")
    async def force_resubscribe(source: str,
                                 x_admin_token: Optional[str] = Header(default=None),
                                 dry_run: bool = False):
        """Manage live webhook subscriptions for a source.
          dry_run=true → return what WOULD be done (count + plan), no API calls.
          dry_run=false → execute. Twitch creates stream.online + stream.offline;
                          Kick creates channel.subscription.gifts as a smoke event
                          (we'll expand once Kick documents stream.* event names).
        """
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        source = source.lower()
        if source not in ("twitch", "kick", "youtube"):
            return JSONResponse(status_code=400, content={"detail": "unknown_source"})

        # ── Twitch: real EventSub bootstrap (stream.online + stream.offline) ──
        if source == "twitch":
            from twitch_eventsub import (
                is_configured as twitch_is_configured,
                get_app_access_token,
                list_subscriptions,
                resolve_user_id,
                create_subscription as twitch_create_subscription,
            )
            if not twitch_is_configured():
                return JSONResponse(status_code=503, content={
                    "detail": "twitch_oauth_credentials_missing",
                    "source": source,
                    "blockers": ["set TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET + TWITCH_EVENTSUB_SECRET + TWITCH_EVENTSUB_CALLBACK_URL in backend/.env"],
                })
            try:
                await get_app_access_token()
            except Exception as exc:
                return JSONResponse(status_code=502, content={
                    "detail": "twitch_oauth_failed", "source": source, "error": str(exc),
                })

            wanted_types = ["stream.online", "stream.offline"]
            current = await list_subscriptions()
            existing: dict[str, set] = {t: set() for t in wanted_types}
            if current.get("ok"):
                for sub in current.get("subscriptions") or []:
                    t = sub.get("type")
                    if t in existing:
                        cond = sub.get("condition") or {}
                        if cond.get("broadcaster_user_id"):
                            existing[t].add(str(cond["broadcaster_user_id"]))

            streamer_cur = db.streamers.find(
                {"platform": {"$in": ["twitch", "Twitch"]}, "market_id": "FI"},
                {"_id": 0, "slug": 1, "name": 1},
            ).limit(500)
            streamers = await streamer_cur.to_list(length=500)

            results: dict[str, list] = {"subscribed": [], "skipped": [], "errors": []}
            plan: list[dict] = []

            for s in streamers:
                login = (s.get("slug") or "").strip().lower()
                if not login:
                    continue
                try:
                    user_id = await resolve_user_id(login)
                    if not user_id:
                        results["errors"].append({"slug": login, "error": "unresolved_login"})
                        continue
                    for ev_type in wanted_types:
                        if user_id in existing[ev_type]:
                            results["skipped"].append({"slug": login, "user_id": user_id,
                                                       "event": ev_type, "reason": "already_subscribed"})
                            continue
                        plan.append({"slug": login, "user_id": user_id, "event": ev_type})
                        if dry_run:
                            continue
                        sub_res = await twitch_create_subscription(ev_type, user_id)
                        if sub_res.get("ok"):
                            results["subscribed"].append({"slug": login, "user_id": user_id, "event": ev_type})
                        else:
                            results["errors"].append({"slug": login, "user_id": user_id,
                                                      "event": ev_type,
                                                      "status_code": sub_res.get("status_code"),
                                                      "body": sub_res.get("body")})
                except Exception as exc:
                    results["errors"].append({"slug": login, "error": str(exc)})

            if dry_run:
                return {
                    "source": "twitch",
                    "status": "dry_run",
                    "streamer_count": len(streamers),
                    "plan_count": len(plan),
                    "would_create": plan[:50],  # cap preview
                    "would_skip": results["skipped"],
                    "would_error": results["errors"],
                }

            await db.webhook_audit.insert_one({
                "source": "twitch",
                "action": "resubscribe_executed",
                "requested_at": datetime.now(timezone.utc).isoformat(),
                "results": results,
                "streamer_count": len(streamers),
            })
            return {
                "source": "twitch",
                "status": "executed",
                "streamer_count": len(streamers),
                "subscribed_count": len(results["subscribed"]),
                "skipped_count": len(results["skipped"]),
                "error_count": len(results["errors"]),
                "results": results,
            }

        # ── Kick: real subscription bootstrap ─────────────────────────────
        if source == "kick":
            from kick_api import (
                is_configured as kick_is_configured,
                get_app_access_token as kick_token,
                list_subscriptions as kick_list_subs,
                resolve_broadcaster_user_id,
                create_subscription as kick_create_subs,
            )
            if not kick_is_configured():
                return JSONResponse(status_code=503, content={
                    "detail": "kick_oauth_credentials_missing",
                    "source": source,
                    "blockers": ["set KICK_CLIENT_ID + KICK_CLIENT_SECRET in backend/.env"],
                })
            try:
                await kick_token()
            except Exception as exc:
                return JSONResponse(status_code=502, content={
                    "detail": "kick_oauth_failed", "source": source, "error": str(exc),
                })

            # Kick event names per docs/event-types — most channels currently
            # supported: subscription gifts + subscription renewal. Stream
            # live/offline events are not yet first-class on Kick's public
            # API; once they are, add them here.
            wanted_events = [
                {"name": "channel.subscription.gifts", "version": 1},
                {"name": "channel.subscription.renewal", "version": 1},
            ]

            # Pull tracked Kick streamers from registry.
            streamer_cur = db.streamers.find(
                {"platform": {"$in": ["kick", "Kick"]}, "market_id": "FI"},
                {"_id": 0, "slug": 1, "name": 1},
            ).limit(500)
            streamers = await streamer_cur.to_list(length=500)

            # Existing subs per broadcaster (one call per channel — small N).
            existing_per_user: dict[int, set] = {}

            results = {"subscribed": [], "skipped": [], "errors": []}
            plan: list[dict] = []

            for s in streamers:
                slug = (s.get("slug") or "").strip().lower()
                if not slug:
                    continue
                try:
                    bid = await resolve_broadcaster_user_id(slug)
                    if not bid:
                        results["errors"].append({"slug": slug, "error": "unresolved_slug"})
                        continue
                    bid = int(bid)
                    if bid not in existing_per_user:
                        existing_res = await kick_list_subs(broadcaster_user_id=bid)
                        existing_per_user[bid] = {
                            sub.get("event")
                            for sub in (existing_res.get("subscriptions") or [])
                        }
                    new_events = [e for e in wanted_events if e["name"] not in existing_per_user[bid]]
                    if not new_events:
                        results["skipped"].append({"slug": slug, "user_id": bid, "reason": "already_subscribed"})
                        continue
                    for e in new_events:
                        plan.append({"slug": slug, "user_id": bid, "event": e["name"]})
                    if dry_run:
                        continue
                    sub_res = await kick_create_subs(bid, new_events)
                    if sub_res.get("ok"):
                        for row in sub_res.get("data") or []:
                            if row.get("subscription_id"):
                                results["subscribed"].append({
                                    "slug": slug, "user_id": bid,
                                    "event": row.get("name"),
                                    "subscription_id": row.get("subscription_id"),
                                })
                            else:
                                results["errors"].append({"slug": slug, "user_id": bid,
                                                          "event": row.get("name"),
                                                          "error": row.get("error") or "unknown"})
                    else:
                        results["errors"].append({"slug": slug, "user_id": bid,
                                                  "status_code": sub_res.get("status_code"),
                                                  "body": sub_res.get("body")})
                except Exception as exc:
                    results["errors"].append({"slug": slug, "error": str(exc)})

            if dry_run:
                return {
                    "source": "kick",
                    "status": "dry_run",
                    "streamer_count": len(streamers),
                    "plan_count": len(plan),
                    "would_create": plan[:50],
                    "would_skip": results["skipped"],
                    "would_error": results["errors"],
                }

            await db.webhook_audit.insert_one({
                "source": "kick",
                "action": "resubscribe_executed",
                "requested_at": datetime.now(timezone.utc).isoformat(),
                "results": results,
                "streamer_count": len(streamers),
            })
            return {
                "source": "kick",
                "status": "executed",
                "streamer_count": len(streamers),
                "subscribed_count": len(results["subscribed"]),
                "skipped_count": len(results["skipped"]),
                "error_count": len(results["errors"]),
                "results": results,
            }

        # ── YouTube PubSubHubbub: real subscription bootstrap ──────────────
        if source == "youtube":
            from youtube_pubsub import (
                is_configured as yt_is_configured,
                can_resolve_channels,
                resolve_channel_id,
                subscribe as yt_subscribe,
                DEFAULT_LEASE_SECS,
            )
            if not yt_is_configured():
                return JSONResponse(status_code=503, content={
                    "detail": "youtube_pubsub_not_configured",
                    "source": source,
                    "blockers": ["set YOUTUBE_PUBSUB_SECRET + YOUTUBE_PUBSUB_CALLBACK_URL in backend/.env"],
                })

            # Pull YouTube streamers from registry.
            streamer_cur = db.streamers.find(
                {"platform": {"$in": ["youtube", "YouTube"]}, "market_id": "FI"},
                {"_id": 0, "slug": 1, "name": 1},
            ).limit(500)
            streamers = await streamer_cur.to_list(length=500)

            # Existing leases for dedup (and skip if still > 24h to go).
            leases = await db.youtube_pubsub_leases.find({"market_id": "FI"}, {"_id": 0}).to_list(length=500)
            now_ts = datetime.now(timezone.utc).timestamp()
            healthy_channels: set[str] = set()
            for lease in leases:
                exp = lease.get("expires_at_ts") or 0
                if exp - now_ts > 86400:  # >24h left
                    healthy_channels.add(lease.get("channel_id"))

            results = {"subscribed": [], "skipped": [], "errors": []}
            plan: list[dict] = []

            for s in streamers:
                slug = (s.get("slug") or "").strip()
                if not slug:
                    continue
                try:
                    if not can_resolve_channels() and not slug.startswith("UC"):
                        results["errors"].append({"slug": slug, "error": "no_youtube_api_key_for_handle_resolution"})
                        continue
                    resolved = await resolve_channel_id(slug)
                    if not resolved or not resolved.get("channel_id"):
                        results["errors"].append({"slug": slug, "error": "unresolved_handle"})
                        continue
                    channel_id = resolved["channel_id"]
                    if channel_id in healthy_channels:
                        results["skipped"].append({"slug": slug, "channel_id": channel_id, "reason": "lease_still_healthy"})
                        continue
                    plan.append({"slug": slug, "channel_id": channel_id, "event": "video.published"})
                    if dry_run:
                        continue
                    sub_res = await yt_subscribe(channel_id, lease_seconds=DEFAULT_LEASE_SECS)
                    if sub_res.get("ok"):
                        # Store the lease record (hub will confirm via challenge → handler ACKs).
                        expires_ts = datetime.now(timezone.utc).timestamp() + DEFAULT_LEASE_SECS
                        await db.youtube_pubsub_leases.update_one(
                            {"channel_id": channel_id, "market_id": "FI"},
                            {"$set": {
                                "channel_id": channel_id,
                                "slug": slug,
                                "title": resolved.get("title"),
                                "market_id": "FI",
                                "topic": sub_res.get("topic"),
                                "subscribed_at": datetime.now(timezone.utc).isoformat(),
                                "expires_at": datetime.fromtimestamp(expires_ts, tz=timezone.utc).isoformat(),
                                "expires_at_ts": expires_ts,
                                "lease_seconds": DEFAULT_LEASE_SECS,
                            }},
                            upsert=True,
                        )
                        # Also update the cross-source surface used by /webhooks/status.
                        await db.settings.update_one(
                            {"key": "webhook_youtube_pubsub_lease"},
                            {"$set": {
                                "key": "webhook_youtube_pubsub_lease",
                                "expires_at": datetime.fromtimestamp(expires_ts, tz=timezone.utc).isoformat(),
                            }},
                            upsert=True,
                        )
                        results["subscribed"].append({"slug": slug, "channel_id": channel_id})
                    else:
                        results["errors"].append({"slug": slug, "channel_id": channel_id,
                                                   "status_code": sub_res.get("status_code"),
                                                   "body": sub_res.get("body")})
                except Exception as exc:
                    results["errors"].append({"slug": slug, "error": str(exc)})

            if dry_run:
                return {
                    "source": "youtube",
                    "status": "dry_run",
                    "streamer_count": len(streamers),
                    "plan_count": len(plan),
                    "would_create": plan[:50],
                    "would_skip": results["skipped"],
                    "would_error": results["errors"],
                }

            await db.webhook_audit.insert_one({
                "source": "youtube",
                "action": "resubscribe_executed",
                "requested_at": datetime.now(timezone.utc).isoformat(),
                "results": results,
                "streamer_count": len(streamers),
            })
            return {
                "source": "youtube",
                "status": "executed",
                "streamer_count": len(streamers),
                "subscribed_count": len(results["subscribed"]),
                "skipped_count": len(results["skipped"]),
                "error_count": len(results["errors"]),
                "results": results,
            }

        # Truly unknown / future source — stubbed audit record.
        await db.webhook_audit.insert_one({
            "source": source,
            "action": "resubscribe_requested",
            "requested_at": datetime.now(timezone.utc).isoformat(),
        })
        return {
            "source": source,
            "status": "queued",
            "detail": "Credentials pending — YouTube PubSubHubbub subscribe call wiring is next.",
        }

    # ── Twitch operational verify + list endpoints ────────────────────────
    @r.get("/twitch/verify")
    async def twitch_verify(x_admin_token: Optional[str] = Header(default=None)):
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        from twitch_eventsub import is_configured as twitch_is_configured, get_app_access_token, list_subscriptions
        if not twitch_is_configured():
            return JSONResponse(status_code=503, content={"detail": "twitch_not_configured"})
        try:
            token = await get_app_access_token()
        except Exception as exc:
            return JSONResponse(status_code=502, content={"detail": "twitch_oauth_failed", "error": str(exc)})
        subs = await list_subscriptions()
        return {
            "ok": True,
            "oauth_token_length": len(token),  # length only — never the value
            "subscriptions": {
                "total": subs.get("total"),
                "total_cost": subs.get("total_cost"),
                "max_total_cost": subs.get("max_total_cost"),
                "by_status": _count_by(subs.get("subscriptions") or [], "status"),
                "by_type": _count_by(subs.get("subscriptions") or [], "type"),
            },
            "callback_url": os.environ.get("TWITCH_EVENTSUB_CALLBACK_URL", ""),
        }

    @r.get("/twitch/subscriptions")
    async def twitch_list_subs(x_admin_token: Optional[str] = Header(default=None),
                                status: Optional[str] = None):
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        from twitch_eventsub import is_configured as twitch_is_configured, list_subscriptions
        if not twitch_is_configured():
            return JSONResponse(status_code=503, content={"detail": "twitch_not_configured"})
        out = await list_subscriptions(status=status)
        # Strip secrets from transport before returning. (Helix never echoes them,
        # but we're defensive.)
        for sub in out.get("subscriptions") or []:
            t = sub.get("transport") or {}
            if "secret" in t:
                t["secret"] = "***"
        return out

    # ── Kick operational verify + list endpoints ──────────────────────────
    @r.get("/kick/verify")
    async def kick_verify(x_admin_token: Optional[str] = Header(default=None)):
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        from kick_api import (
            is_configured as kick_is_configured,
            get_app_access_token as kick_token,
            list_subscriptions as kick_list_subs,
            fetch_public_key,
        )
        if not kick_is_configured():
            return JSONResponse(status_code=503, content={"detail": "kick_not_configured"})
        try:
            token = await kick_token()
        except Exception as exc:
            return JSONResponse(status_code=502, content={"detail": "kick_oauth_failed", "error": str(exc)})
        try:
            pem = await fetch_public_key()
            pubkey_ok = pem is not None and b"BEGIN PUBLIC KEY" in pem
        except Exception:
            pubkey_ok = False
        subs = await kick_list_subs()
        return {
            "ok": True,
            "oauth_token_length": len(token),  # length only — never the value
            "public_key_reachable": pubkey_ok,
            "subscriptions": {
                "total": len(subs.get("subscriptions") or []),
                "by_event": _count_by(subs.get("subscriptions") or [], "event"),
            },
            "callback_url": os.environ.get("KICK_WEBHOOK_CALLBACK_URL", ""),
        }

    @r.get("/kick/subscriptions")
    async def kick_list_subscriptions(x_admin_token: Optional[str] = Header(default=None),
                                       broadcaster_user_id: Optional[int] = None):
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        from kick_api import (
            is_configured as kick_is_configured,
            list_subscriptions as kick_list_subs,
        )
        if not kick_is_configured():
            return JSONResponse(status_code=503, content={"detail": "kick_not_configured"})
        return await kick_list_subs(broadcaster_user_id=broadcaster_user_id)

    # ── YouTube PubSub verify + lease list ────────────────────────────────
    @r.get("/youtube/verify")
    async def youtube_verify(x_admin_token: Optional[str] = Header(default=None)):
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        from youtube_pubsub import (
            is_configured as yt_is_configured,
            can_resolve_channels,
            resolve_channel_id,
        )
        if not yt_is_configured():
            return JSONResponse(status_code=503, content={"detail": "youtube_pubsub_not_configured"})

        # Probe Data API key with a known canonical channel handle (YouTube's own).
        data_api_ok = False
        sample_resolved = None
        if can_resolve_channels():
            try:
                sample_resolved = await resolve_channel_id("YouTube")
                data_api_ok = bool(sample_resolved and sample_resolved.get("channel_id"))
            except Exception:
                data_api_ok = False

        leases = await db.youtube_pubsub_leases.find({"market_id": "FI"}, {"_id": 0}).to_list(length=200)
        now_ts = datetime.now(timezone.utc).timestamp()
        active = [lease for lease in leases if (lease.get("expires_at_ts") or 0) > now_ts]
        expiring_soon = [lease for lease in active if (lease.get("expires_at_ts") or 0) - now_ts < 48 * 3600]

        return {
            "ok": True,
            "data_api_configured": can_resolve_channels(),
            "data_api_reachable": data_api_ok,
            "data_api_sample_resolve": sample_resolved,
            "pubsub_callback_url": os.environ.get("YOUTUBE_PUBSUB_CALLBACK_URL", ""),
            "lease_summary": {
                "total": len(leases),
                "active": len(active),
                "expiring_within_48h": len(expiring_soon),
            },
        }

    @r.get("/youtube/leases")
    async def youtube_list_leases(x_admin_token: Optional[str] = Header(default=None)):
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        leases = await db.youtube_pubsub_leases.find({"market_id": "FI"}, {"_id": 0}).to_list(length=200)
        return {"ok": True, "leases": leases, "count": len(leases)}

    @r.post("/youtube/renew-leases")
    async def youtube_renew_leases(x_admin_token: Optional[str] = Header(default=None)):
        """Force-run the YouTube lease auto-renewal pass. Useful when on-call
        wants to refresh leases ahead of the next 6 h worker tick (e.g. before
        a planned redeploy)."""
        expected = os.environ.get("BACK_OFFICE_TOKEN")
        if not expected or x_admin_token != expected:
            raise HTTPException(status_code=401, detail="admin_token_required")
        from youtube_lease_worker import renew_due_leases
        return await renew_due_leases(db)

    return r


def _count_by(rows: list[dict], key: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        k = r.get(key) or "unknown"
        out[k] = out.get(k, 0) + 1
    return out
