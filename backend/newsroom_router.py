"""
PUTKI HQ — Newsroom HTTP router.

Routes:
  • GET  /api/content/stats           — 24h severity breakdown + sources
  • GET  /api/content/top-entities    — top mentioned entities
  • GET  /api/content/feed            — filterable severity-annotated feed
  • GET  /api/entities/:type/:id      — entity hub data (entity + articles)
  • POST /api/subscribe/dial-alerts   — capture dial-state alert intent

`/api/content/stats` is a distinct path from `/api/content/stats/bulk`
(the article_views bulk-stats endpoint) — FastAPI routes them separately
based on the exact path so the two coexist cleanly.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field, validator

from newsroom import (
    annotate, classify_severity, content_stats,
    extract_entity_tags, top_entities,
)


class DialAlertSubscription(BaseModel):
    channel: str = Field(..., pattern=r"^(telegram|sms|email)$")
    contact: str = Field(..., min_length=2, max_length=120)
    # Accepts new state names (VIPINÄ/MEININKI/PERKELE) and legacy
    # labels (WARM/RUSH/JACKPOT/TULOSSA/VOITTOPUTKI/RYÖSTÖPUTKI) for
    # backward compat with existing subscriptions.
    min_state: str = Field(
        "MEININKI",
        pattern=r"^(WARM|RUSH|JACKPOT|TULOSSA|VOITTOPUTKI|RYÖSTÖPUTKI|VIPINÄ|MEININKI|PERKELE|ACTIVE|ROLLING)$",
    )

    @validator("contact")
    def _strip(cls, v):
        return v.strip()


def build_newsroom_router(db) -> APIRouter:
    router = APIRouter(tags=["newsroom"])

    @router.get("/content/stats")
    async def get_content_stats() -> Dict[str, Any]:
        return await content_stats(db)

    @router.get("/content/top-entities")
    async def get_top_entities(days: int = 7, limit: int = 12) -> Dict[str, Any]:
        days = max(1, min(int(days) if days else 7, 90))
        limit = max(1, min(int(limit) if limit else 12, 30))
        return await top_entities(db, days=days, limit=limit)

    @router.get("/content/feed")
    async def get_feed(
        category: Optional[str] = None,
        entity: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = Query(40, ge=1, le=100),
        skip: int = Query(0, ge=0, le=2000),
    ) -> Dict[str, Any]:
        q: Dict[str, Any] = {}
        if category and category.lower() != "all":
            q["category"] = category.lower()
        cur = db.published_content.find(q, {"_id": 0}).sort(
            [("published_at", -1)]
        ).skip(skip).limit(limit * 4 if (entity or severity) else limit)
        prelim: List[Dict[str, Any]] = [doc async for doc in cur]
        # Hydrate view counts in one bulk lookup
        ids = [a["id"] for a in prelim if a.get("id")]
        views_map: Dict[str, int] = {}
        if ids:
            vcur = db.article_views.find({"article_id": {"$in": ids}},
                                          {"_id": 0, "article_id": 1, "views": 1})
            async for v in vcur:
                views_map[v["article_id"]] = int(v.get("views") or 0)

        out: List[Dict[str, Any]] = []
        for doc in prelim:
            doc["views"] = views_map.get(doc.get("id"), doc.get("views") or 0)
            ann = annotate(dict(doc))
            if entity and entity.lower() not in ann.get("entity_tags", []):
                continue
            if severity and ann.get("severity") != severity.upper():
                continue
            out.append(ann)
            if len(out) >= limit:
                break
        return {"items": out, "count": len(out), "skip": skip, "limit": limit,
                "filter": {"category": category, "entity": entity, "severity": severity}}

    @router.get("/entities/{entity_type}/{entity_id}")
    async def get_entity(entity_type: str, entity_id: str) -> Dict[str, Any]:
        entity_type = entity_type.lower()
        entity_id = entity_id.lower()
        if entity_type not in ("streamers", "operators", "leagues", "topics"):
            raise HTTPException(status_code=400, detail="unknown_entity_type")

        entity_doc: Dict[str, Any] = {
            "id": entity_id, "type": entity_type.rstrip("s"),
            "name": entity_id.title(),
        }
        # Hydrate from streamers collection when applicable
        if entity_type == "streamers":
            s = await db.streamers.find_one(
                {"slug": entity_id}, {"_id": 0},
            )
            if s:
                entity_doc.update({
                    "name": s.get("name") or entity_id.title(),
                    "platform": s.get("platform"),
                    "channel": s.get("channel"),
                    "tier": s.get("tier"),
                    "follower_count": s.get("followers") or s.get("follower_count"),
                    "scene": s.get("scene"),
                })

        # Pull related articles by matching entity_id against
        # extract_entity_tags() over the past 30 days.
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        cur = db.published_content.find(
            {"published_at": {"$gte": cutoff}},
            {"_id": 0},
        ).sort([("published_at", -1)]).limit(200)
        articles: List[Dict[str, Any]] = []
        async for doc in cur:
            if entity_id in extract_entity_tags(doc):
                articles.append(annotate(dict(doc)))
        return {"entity": entity_doc, "articles": articles[:50], "total": len(articles)}

    @router.post("/subscribe/dial-alerts")
    async def subscribe_dial_alerts(body: DialAlertSubscription) -> Dict[str, Any]:
        # Lightweight validation: must look like a channel-appropriate handle
        contact = body.contact
        if body.channel == "email":
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", contact):
                raise HTTPException(status_code=400, detail="invalid_email")
        elif body.channel in ("sms",):
            if not re.fullmatch(r"\+?\d[\d\s\-]{4,20}", contact):
                raise HTTPException(status_code=400, detail="invalid_phone")
        else:
            # telegram handle — strip leading @
            contact = contact.lstrip("@")
            if not re.fullmatch(r"[A-Za-z0-9_]{3,40}", contact):
                raise HTTPException(status_code=400, detail="invalid_telegram_handle")

        # Idempotency: one subscription per (channel, contact)
        existing = await db.dial_subscriptions.find_one(
            {"channel": body.channel, "contact": contact.lower()},
        )
        if existing:
            await db.dial_subscriptions.update_one(
                {"channel": body.channel, "contact": contact.lower()},
                {"$set": {"min_state": body.min_state,
                          "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            return {"ok": True, "id": existing.get("id"), "status": "updated"}

        doc = {
            "id": uuid.uuid4().hex,
            "channel": body.channel,
            "contact": contact.lower(),
            "min_state": body.min_state,
            "trigger": "dial_alerts",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "active": True,
        }
        await db.dial_subscriptions.insert_one(dict(doc))
        return {"ok": True, "id": doc["id"], "status": "created"}

    return router
