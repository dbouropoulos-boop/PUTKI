"""
PUTKI HQ - Dispatch composer backend (iter97i).

Endpoints feeding /back-office/dispatch:
  GET    /api/admin/dispatch/drafts?type=daily|weekly|welcome
  POST   /api/admin/dispatch/drafts                 (create)
  PUT    /api/admin/dispatch/drafts/{id}            (update / autosave)
  DELETE /api/admin/dispatch/drafts/{id}            (soft delete)
  POST   /api/admin/dispatch/preview                (render to HTML)
  POST   /api/admin/dispatch/test-send              (sends to admin)
  POST   /api/admin/dispatch/fire                   (full list send)
  POST   /api/admin/uploads/partner-image           (image upload)
  GET    /api/admin/uploads/partner-image/{id}      (serve original)
  GET    /api/admin/uploads/partner-image/{id}/treated (serve treated)
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel

from routes._helpers import get_db, require_admin
from services.email_render import render as render_email
from services.image_treated import process_treated, process_original

logger = logging.getLogger(__name__)
ADMIN_DM_CHAT_ID = "909303651"
ADMIN_TEST_EMAIL = os.environ.get("ADMIN_TEST_EMAIL", "d.bouropoulos@gmail.com")
ALLOWED_TYPES = {"daily", "weekly", "welcome"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip Mongo internals before returning to the client."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    return out


class DraftBody(BaseModel):
    type: str
    fields: Dict[str, Any] = {}
    name: Optional[str] = None
    scheduled_for: Optional[str] = None


class PreviewBody(BaseModel):
    type: str
    fields: Dict[str, Any]


class TestSendBody(BaseModel):
    type: str
    fields: Dict[str, Any]
    channels: List[str] = ["email"]  # "email" | "telegram"


class FireBody(BaseModel):
    type: str
    fields: Dict[str, Any]
    channels: List[str] = ["email"]
    confirm: bool = False
    dry_run: bool = False  # iter97j: smoke-test fires without hitting providers


def make_router() -> APIRouter:
    router = APIRouter(
        prefix="/admin/dispatch",
        dependencies=[Depends(require_admin)],
    )

    # ── Drafts CRUD ──────────────────────────────────────────────────
    @router.get("/drafts")
    async def list_drafts(type: Optional[str] = None, db=Depends(get_db)):
        q: Dict[str, Any] = {"deleted_at": None}
        if type and type in ALLOWED_TYPES:
            q["type"] = type
        cur = db.dispatch_drafts.find(q, {"_id": 0}).sort("updated_at", -1).limit(50)
        rows = [d async for d in cur]
        return {"drafts": rows, "count": len(rows)}

    @router.post("/drafts")
    async def create_draft(body: DraftBody, db=Depends(get_db)):
        if body.type not in ALLOWED_TYPES:
            raise HTTPException(400, "unknown draft type")
        draft_id = uuid.uuid4().hex
        doc = {
            "id": draft_id,
            "type": body.type,
            "name": (body.name or "Untitled draft")[:120],
            "fields": body.fields or {},
            "scheduled_for": body.scheduled_for,
            "status": "draft",
            "created_at": _now(),
            "updated_at": _now(),
            "deleted_at": None,
            "sent_at": None,
        }
        await db.dispatch_drafts.insert_one(doc)
        return _clean(doc)

    @router.put("/drafts/{draft_id}")
    async def update_draft(draft_id: str, body: DraftBody, db=Depends(get_db)):
        update: Dict[str, Any] = {
            "fields": body.fields or {},
            "updated_at": _now(),
        }
        if body.name is not None:
            update["name"] = body.name[:120]
        if body.scheduled_for is not None:
            update["scheduled_for"] = body.scheduled_for
        await db.dispatch_drafts.find_one_and_update(
            {"id": draft_id, "deleted_at": None},
            {"$set": update},
        )
        # Re-read with explicit projection so ObjectId never leaks.
        r = await db.dispatch_drafts.find_one(
            {"id": draft_id}, {"_id": 0},
        )
        if not r:
            raise HTTPException(404, "draft not found")
        return r

    @router.delete("/drafts/{draft_id}")
    async def delete_draft(draft_id: str, db=Depends(get_db)):
        await db.dispatch_drafts.update_one(
            {"id": draft_id},
            {"$set": {"deleted_at": _now()}},
        )
        return {"ok": True, "id": draft_id}

    # ── Preview render ───────────────────────────────────────────────
    @router.post("/preview", response_class=HTMLResponse)
    async def preview(body: PreviewBody):
        html = render_email(body.type, body.fields or {})
        return HTMLResponse(html)

    # ── Test send ────────────────────────────────────────────────────
    @router.post("/test-send")
    async def test_send(body: TestSendBody, db=Depends(get_db)):
        results: Dict[str, Any] = {}
        html = render_email(body.type, body.fields or {})
        subject_map = {
            "daily":   "PUTKI HQ — Päivän 5 signaalia (TEST)",
            "weekly":  "PUTKI HQ — Viikkokatsaus (TEST)",
            "welcome": "PUTKI HQ — Tervetuloa (TEST)",
        }
        subject = subject_map.get(body.type, "PUTKI HQ — TEST")

        if "email" in body.channels:
            try:
                import httpx
                resend_key = os.environ.get("RESEND_API_KEY")
                resend_from = os.environ.get("RESEND_FROM") or "PUTKI HQ <signals@putkihq.fi>"
                if not resend_key:
                    results["email"] = {"mode": "dry_run", "reason": "no_resend_key"}
                else:
                    async with httpx.AsyncClient(timeout=15.0) as http:
                        r = await http.post(
                            "https://api.resend.com/emails",
                            headers={"Authorization": f"Bearer {resend_key}",
                                     "Content-Type": "application/json"},
                            json={"from": resend_from, "to": [ADMIN_TEST_EMAIL],
                                  "subject": subject, "html": html},
                        )
                    results["email"] = {
                        "mode": "live", "status": r.status_code,
                        "ok": 200 <= r.status_code < 300,
                        "body": r.text[:400],
                    }
            except Exception as exc:
                results["email"] = {"mode": "live", "error": str(exc)[:280]}

        if "telegram" in body.channels:
            try:
                from telegram_bot import send_message
                # For Telegram, only the daily picks fanout makes sense as
                # a text DM. Render a compact text version of the picks.
                text = _telegram_text_from_draft(body.fields or {})
                r = await send_message(ADMIN_DM_CHAT_ID, text)
                results["telegram"] = {
                    "mode": "live", "ok": bool(r.get("ok")),
                    "message_id": (r.get("result") or {}).get("message_id"),
                }
            except Exception as exc:
                results["telegram"] = {"mode": "live", "error": str(exc)[:280]}

        # Audit
        await db.dispatch_log.insert_one({
            "id": uuid.uuid4().hex,
            "kind": "test",
            "channel": ",".join(body.channels),
            "recipient": ADMIN_TEST_EMAIL,
            "sent_at": _now(),
            "source": "dispatch_composer_test",
            "payload": {"type": body.type},
            "results": results,
            "test_send": True,
        })
        return {"ok": True, "results": results}

    # ── Fire to full list ────────────────────────────────────────────
    @router.post("/fire")
    async def fire(body: FireBody, db=Depends(get_db)):
        if not body.confirm:
            raise HTTPException(400, "confirm flag required to fire")
        # Delegate the heavy lifting to the existing fanout helpers so
        # we share the same gate + dedupe + rate-limit logic.
        outcome: Dict[str, Any] = {}
        if body.type == "daily":
            from routes.bot_dispatch import fanout_daily_emails, fanout_daily_dms
            if "email" in body.channels:
                outcome["email"] = await fanout_daily_emails(
                    db, dry_run=False, force_picks=body.fields.get("picks"),
                )
            if "telegram" in body.channels:
                outcome["telegram"] = await fanout_daily_dms(
                    db, dry_run=False, force_picks=body.fields.get("picks"),
                )
        elif body.type == "weekly":
            # Weekly is email-only by design — Telegram does NOT get the
            # weekly broadcast. The composer's `fields` payload becomes
            # the `draft_override` so we don't depend on a saved draft
            # row when an editor fires from the unsaved composer.
            from dispatch_daily import run_weekly_dispatch
            draft_override = {
                "id": f"composer-fire-{uuid.uuid4().hex[:8]}",
                "type": "weekly",
                "fields": body.fields or {},
            }
            outcome["weekly"] = await run_weekly_dispatch(
                db, dry_run=body.dry_run, draft_override=draft_override,
            )
            # Strip Mongo internals just in case the cycle doc was
            # re-read from the log before being returned.
            outcome["weekly"].pop("_id", None)
        else:
            raise HTTPException(400, f"fire not yet supported for type={body.type}")
        return {"ok": True, "outcome": outcome}

    # ── iter97k · one-click prod migration ────────────────────────────
    # Replaces the MongoDB Atlas mongosh paste workflow with a button
    # the operator clicks from /back-office/settings. Idempotent +
    # safe to re-run.
    #
    # What it does:
    #   1. Flips bot_config so the state-gate eligible-states key is
    #      explicit (informational — HOT_STATES is hardcoded in code,
    #      this row is for human ops inspection only).
    #   2. Writes the three dispatch kill-switches into the canonical
    #      settings doc (`_id="site"`) — this is the SAME shape the
    #      back-office page reads/writes, so flipping toggles in the UI
    #      affects the same document.
    #   3. Asserts all dispatch-related indexes (no-op on second run).
    #
    # The `daily_dispatch_enabled` default is False here — keeps the
    # 10:00 Helsinki cron PARKED until you've personally smoke-tested.
    # Flip back to True from /back-office/settings → Telegram dispatch
    # rules once verified.
    @router.post("/migrate-iter97j")
    async def migrate_iter97j(db=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        result: Dict[str, Any] = {"timestamp": now, "actions": []}

        # 1. bot_config — informational
        bc = await db.bot_config.update_many(
            {},
            {"$set": {
                "daily_dm_enabled": True,
                "sharpness_min": 0,
                "state_gate_eligible_states": ["KUUMA", "MYRSKY", "KIIRASTULI"],
                "updated_at": now,
            }},
            upsert=True,
        )
        result["actions"].append(
            f"bot_config: matched={bc.matched_count} modified={bc.modified_count} "
            f"upserted={bool(bc.upserted_id)}"
        )
        if bc.matched_count == 0 and not bc.upserted_id:
            await db.bot_config.insert_one({
                "id": "singleton",
                "daily_dm_enabled": True,
                "sharpness_min": 0,
                "state_gate_eligible_states": ["KUUMA", "MYRSKY", "KIIRASTULI"],
                "updated_at": now,
            })
            result["actions"].append("bot_config: created seed row")

        # 2. settings — kill-switches written into the CANONICAL doc
        # (_id="site") so they're read by both run_daily_dispatch and
        # the back-office GET /api/admin/settings page. The earlier
        # migration mistakenly wrote separate _id="daily_dispatch_enabled"
        # docs which were never read. Clean those up at the bottom.
        flags = {
            "daily_dispatch_enabled": False,       # ← intentional safety park
            "special_drops_enabled": False,
            "partner_promos_enabled": False,        # note: code reads `_promos_enabled` (plural)
        }
        await db.settings.update_one(
            {"_id": "site"},
            {"$set": {**flags, "updated_at": now}},
            upsert=True,
        )
        result["actions"].append(
            f"settings._id=site: set {flags}"
        )

        # 2b. Clean up orphaned _id rows from the earlier migration bug
        # (only deletes if they exist; safe no-op otherwise).
        for orphan_id in ("daily_dispatch_enabled", "special_drops_enabled",
                          "partner_promo_enabled", "partner_promos_enabled"):
            r = await db.settings.delete_one({"_id": orphan_id})
            if r.deleted_count:
                result["actions"].append(f"cleaned orphan _id={orphan_id}")

        # 3. indexes
        try:
            await db.dispatch_ops_alerts.create_index("alert_key", unique=True)
            await db.telegram_broadcasts.create_index("date_ymd", unique=True)
            await db.dispatch_log.create_index("sent_at")
            await db.dispatch_log.create_index([("kind", 1), ("sent_at", -1)])
            await db.dispatch_drafts.create_index([("type", 1), ("scheduled_for", -1)])
            result["actions"].append("indexes: asserted")
        except Exception as e:
            result["actions"].append(f"indexes: warning — {e}")

        # 4. verification snapshot — reads the canonical doc
        bot_config_rows = []
        async for r in db.bot_config.find({}):
            r.pop("_id", None)
            bot_config_rows.append(r)
        site_doc = await db.settings.find_one({"_id": "site"}) or {}
        eligible = await db.optin_consents.count_documents({
            "status": {"$ne": "unsubscribed"},
            "channel": "email",
        })

        result["verification"] = {
            "bot_config": bot_config_rows,
            "settings_site": {
                "daily_dispatch_enabled":  site_doc.get("daily_dispatch_enabled", True),
                "special_drops_enabled":   site_doc.get("special_drops_enabled", False),
                "partner_promos_enabled":  site_doc.get("partner_promos_enabled", False),
            },
            "eligible_email_subscribers": eligible,
        }
        return {"ok": True, **result}

    return router


def _telegram_text_from_draft(fields: Dict[str, Any]) -> str:
    """Plain-text rendering of the daily picks for Telegram DM."""
    picks = (fields.get("picks") or [])[:5]
    state = (fields.get("mittari_state") or "MYRSKY").upper()
    lines = [f"⚡ PUTKI HQ · {state}", ""]
    for i, p in enumerate(picks, start=1):
        sport = (p.get("sport") or "").upper()
        ev = p.get("event_name") or "—"
        pick = p.get("pick") or "—"
        odds = p.get("odds_decimal") or 0
        sharp = int(p.get("sharpness") or 0)
        lines.append(f"{i:02d}. {sport} · {ev}")
        lines.append(f"    {pick} @ {odds:.2f}  ·  S{sharp}")
        lines.append("")
    lines.append("https://putkihq.fi/mittari")
    return "\n".join(lines)


# ── Partner image upload router (separate, no /admin/dispatch prefix) ──
def make_uploads_router() -> APIRouter:
    router = APIRouter(
        prefix="/admin/uploads",
        dependencies=[Depends(require_admin)],
    )

    @router.post("/partner-image")
    async def upload_partner_image(
        partner_slug: str = Form(...),
        file: UploadFile = File(...),
        db=Depends(get_db),
    ):
        slug = re.sub(r"[^a-z0-9-]+", "-", partner_slug.lower().strip())[:48] or "partner"
        blob = await file.read()
        if len(blob) > 2 * 1024 * 1024:
            raise HTTPException(413, "image too large (max 2 MB)")

        upload_id = uuid.uuid4().hex
        try:
            orig_bytes, orig_size = process_original(blob)
            treated_bytes, treated_size = process_treated(blob)
        except Exception as exc:
            raise HTTPException(400, f"image processing failed: {exc!s}")

        await db.partner_image_uploads.insert_one({
            "id": upload_id,
            "partner_slug": slug,
            "original_bytes": orig_bytes,
            "treated_bytes": treated_bytes,
            "original_size": list(orig_size),
            "treated_size": list(treated_size),
            "filename": file.filename,
            "content_type": "image/jpeg",
            "uploaded_at": _now(),
            "used_in_dispatches": [],
        })

        base_url = os.environ.get("PUTKI_HQ_SITE_URL") or ""
        return {
            "id": upload_id,
            "partner_slug": slug,
            "original_url": f"{base_url}/api/admin/uploads/partner-image/{upload_id}",
            "treated_url":  f"{base_url}/api/admin/uploads/partner-image/{upload_id}/treated",
            "size": {"original": list(orig_size), "treated": list(treated_size)},
        }

    @router.get("/partner-image/{upload_id}")
    async def serve_original(upload_id: str, db=Depends(get_db)):
        row = await db.partner_image_uploads.find_one(
            {"id": upload_id}, {"_id": 0, "original_bytes": 1},
        )
        if not row:
            raise HTTPException(404, "not found")
        return Response(
            content=row["original_bytes"],
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    @router.get("/partner-image/{upload_id}/treated")
    async def serve_treated(upload_id: str, db=Depends(get_db)):
        row = await db.partner_image_uploads.find_one(
            {"id": upload_id}, {"_id": 0, "treated_bytes": 1},
        )
        if not row:
            raise HTTPException(404, "not found")
        return Response(
            content=row["treated_bytes"],
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    return router


async def ensure_indexes(db) -> None:
    await db.dispatch_drafts.create_index("id", unique=True, background=True)
    await db.dispatch_drafts.create_index([("type", 1), ("updated_at", -1)], background=True)
    await db.dispatch_drafts.create_index([("deleted_at", 1)], background=True)
    await db.partner_image_uploads.create_index("id", unique=True, background=True)
    await db.partner_image_uploads.create_index("partner_slug", background=True)
