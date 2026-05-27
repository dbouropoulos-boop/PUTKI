"""
PUTKI HQ - Bot & Routing admin endpoints (iter76, Slice 1).

Implements Doc 2 §B (data model) + §C.3 (back-office page) for the
bot_config singleton and the partners table. Routing logic itself lives
in Slice 5; this slice ships the CRUD foundation only.

Endpoints (all admin-gated):
    GET   /api/admin/bot/config                - read singleton
    PUT   /api/admin/bot/config                - partial update
    GET   /api/admin/partners                  - list
    POST  /api/admin/partners                  - upsert
    DELETE /api/admin/partners/{partner_key}   - hard delete
    GET   /api/admin/bot/subscribers/summary   - aggregate counts

Data model:
    bot_config (singleton, _id="bot_config"):
        signal_unlock_mode: "informative" | "routed"  (default informative)
        require_verified_signup: bool                 (default True)
        daily_signal_count: int                       (default 5)
        daily_dm_enabled: bool                        (default False)
        sharpness_min: int                            (default 70)
        sport_whitelist: list[str]                    (default ["soccer","icehockey"])
        stars_premium_enabled: bool                   (default False)
        updated_by: str
        updated_at: ISO str

    partners (collection, indexed by partner_key):
        (schema in routes/_payloads.py._PartnerPayload)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from routes._helpers import get_db, require_admin
from routes._payloads import _BotConfigPayload, _PartnerPayload


_BOT_CONFIG_DEFAULTS: Dict[str, Any] = {
    "signal_unlock_mode": "informative",
    "require_verified_signup": True,
    "daily_signal_count": 5,
    "daily_dm_enabled": False,
    "sharpness_min": 70,
    "sport_whitelist": ["soccer", "icehockey"],
    "stars_premium_enabled": False,
}


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_bot_config(db) -> Dict[str, Any]:
    """Read the singleton, materialise defaults for any missing field
    so callers never see a half-filled doc. Pure function - no writes."""
    doc = await db.bot_config.find_one({"_id": "bot_config"}, {"_id": 0}) or {}
    return {**_BOT_CONFIG_DEFAULTS, **doc}


def make_router() -> APIRouter:
    router = APIRouter()

    # ─── bot_config singleton ──────────────────────────────────────
    @router.get("/admin/bot/config")
    async def admin_get_bot_config(_: bool = Depends(require_admin), db = Depends(get_db)):
        return await get_bot_config(db)

    @router.put("/admin/bot/config")
    async def admin_put_bot_config(
        payload: _BotConfigPayload,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        # Only persist fields the caller explicitly sent (Optional -> None
        # ignored). Prevents the back-office from clobbering keys it
        # didn't render.
        patch = {k: v for k, v in payload.model_dump().items() if v is not None}
        if "signal_unlock_mode" in patch and patch["signal_unlock_mode"] not in {"informative", "routed"}:
            raise HTTPException(400, "signal_unlock_mode must be 'informative' or 'routed'")
        if not patch:
            raise HTTPException(400, "no fields to update")
        patch["updated_at"] = _utc_iso()
        await db.bot_config.update_one(
            {"_id": "bot_config"}, {"$set": patch}, upsert=True,
        )
        return await get_bot_config(db)

    # ─── partners CRUD ─────────────────────────────────────────────
    @router.get("/admin/partners")
    async def admin_list_partners(_: bool = Depends(require_admin), db = Depends(get_db)):
        rows = []
        async for p in db.partners.find({}, {"_id": 0}).sort([("priority_weight", -1), ("partner_key", 1)]):
            rows.append(p)
        return {"items": rows, "total": len(rows)}

    @router.post("/admin/partners")
    async def admin_upsert_partner(
        payload: _PartnerPayload,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        if not payload.partner_key or not payload.partner_key.strip():
            raise HTTPException(400, "partner_key is required")
        if payload.status and payload.status not in {"live", "paused"}:
            raise HTTPException(400, "status must be 'live' or 'paused'")
        doc = {k: v for k, v in payload.model_dump().items() if v is not None}
        doc["partner_key"] = doc["partner_key"].strip().lower()
        doc["updated_at"] = _utc_iso()
        await db.partners.update_one(
            {"partner_key": doc["partner_key"]},
            {"$set": doc, "$setOnInsert": {"created_at": doc["updated_at"]}},
            upsert=True,
        )
        return await db.partners.find_one({"partner_key": doc["partner_key"]}, {"_id": 0})

    @router.delete("/admin/partners/{partner_key}")
    async def admin_delete_partner(
        partner_key: str,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        res = await db.partners.delete_one({"partner_key": partner_key.strip().lower()})
        return {"deleted": res.deleted_count}

    # ─── subscriber roster summary (for the "Bot & Routing" panel) ─
    @router.get("/admin/bot/subscribers/summary")
    async def admin_subscriber_summary(_: bool = Depends(require_admin), db = Depends(get_db)):
        """Snapshot of mittari_subscribers - lets the back-office see the
        funnel without opening Mongo. Doc 2 §C.3 visibility ask."""
        # Aggregate in ONE round-trip so the panel stays cheap.
        pipeline = [
            {"$facet": {
                "by_status": [
                    {"$group": {"_id": "$status", "n": {"$sum": 1}}},
                ],
                "by_segment": [
                    {"$group": {"_id": "$segment", "n": {"$sum": 1}}},
                ],
                "active_bound": [
                    {"$match": {"status": "active", "telegram_chat_id": {"$nin": [None, ""]}}},
                    {"$count": "n"},
                ],
                "consent_marketing": [
                    {"$match": {"consent_marketing": True}},
                    {"$count": "n"},
                ],
                "total": [{"$count": "n"}],
            }},
        ]
        cur = db.mittari_subscribers.aggregate(pipeline)
        agg = await cur.to_list(length=1)
        f = (agg or [{}])[0]

        def _flat(rows):
            return {(r.get("_id") or "unknown"): r.get("n", 0) for r in (rows or [])}

        def _scalar(rows):
            return (rows or [{}])[0].get("n", 0) if rows else 0

        return {
            "total": _scalar(f.get("total")),
            "active_bound": _scalar(f.get("active_bound")),
            "consent_marketing": _scalar(f.get("consent_marketing")),
            "by_status": _flat(f.get("by_status")),
            "by_segment": _flat(f.get("by_segment")),
        }

    # ─── Funnel snapshot (iter76d) - 5-stage conversion ladder ────
    @router.get("/admin/bot/funnel/snapshot")
    async def admin_funnel_snapshot(
        hours: int = 24,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """Conversion ladder over the last `hours` (default 24).
        Each stage counts distinct subscribers / events; rates are the
        step-to-step conversion %. Cheap - 5 indexed Mongo aggregates,
        runs in <50ms on typical loads."""
        hours = max(1, min(int(hours or 24), 24 * 30))
        cutoff = (datetime.now(timezone.utc)
                  - timedelta(hours=hours)).isoformat()

        # Stage 1: signups (web capture row created)
        signups = await db.mittari_subscribers.count_documents({
            "created_at": {"$gte": cutoff},
            "source": "web_signup",
        })

        # Stage 2: bound (TG chat_id linked - could be same window or older)
        bound = await db.mittari_subscribers.count_documents({
            "telegram_bound_at": {"$gte": cutoff},
        })

        # Stage 3: DM sent (one row per subscriber per cycle)
        dm_sent = await db.dispatch_log.count_documents({
            "source": "mittari_dm_fanout",
            "sent_at": {"$gte": cutoff},
            "mode": "live",
            "error": None,
        })
        dm_dry_run = await db.dispatch_log.count_documents({
            "source": "mittari_dm_fanout",
            "sent_at": {"$gte": cutoff},
            "mode": "dry_run",
        })

        # Stage 4: Mini App opens (distinct tg_user_id)
        tma_pipeline = [
            {"$match": {"event": "tma_open", "ts": {"$gte": cutoff}}},
            {"$group": {"_id": "$tg_user_id"}},
            {"$count": "n"},
        ]
        tma_open_rows = [r async for r in db.tma_events.aggregate(tma_pipeline)]
        tma_open = tma_open_rows[0]["n"] if tma_open_rows else 0

        # Stage 5: Unlock click - status="ok" only (no informative
        # fallbacks, no unknown codes).
        unlock_clicks = await db.redirect_click_log.count_documents({
            "ts": {"$gte": cutoff},
            "status": "ok",
        })

        def _rate(top: int, bot: int) -> float:
            return round((top / bot) * 100, 1) if bot else 0.0

        return {
            "hours": hours,
            "cutoff": cutoff,
            "stages": [
                {"key": "signup",         "label": "SIGNUP",      "count": signups},
                {"key": "bound",          "label": "BOUND",       "count": bound,
                 "rate_vs_prev": _rate(bound, signups)},
                {"key": "dm_sent",        "label": "DM SENT",     "count": dm_sent,
                 "rate_vs_prev": _rate(dm_sent, bound),
                 "dry_run": dm_dry_run},
                {"key": "tma_open",       "label": "MINI APP OPEN", "count": tma_open,
                 "rate_vs_prev": _rate(tma_open, dm_sent)},
                {"key": "unlock_click",   "label": "UNLOCK CLICK", "count": unlock_clicks,
                 "rate_vs_prev": _rate(unlock_clicks, tma_open)},
            ],
            "end_to_end_rate": _rate(unlock_clicks, signups),
        }

    # ─── Funnel HISTORY (iter76e) - per-day buckets ────────────────
    @router.get("/admin/bot/funnel/history")
    async def admin_funnel_history(
        days: int = 30,
        _: bool = Depends(require_admin), db = Depends(get_db),
    ):
        """Day-over-day breakdown of the same 5 stages. Returns a row
        per day in [oldest..today], each carrying integer counts so the
        FE can plot it directly without re-shaping."""
        days = max(1, min(int(days or 30), 90))
        today_utc = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
        # Build a deterministic day index so missing days plot as zeros.
        day_keys = []
        for i in range(days, -1, -1):
            d = today_utc - timedelta(days=i)
            day_keys.append(d.strftime("%Y-%m-%d"))
        oldest_iso = (today_utc - timedelta(days=days)).isoformat()

        def _bucket(rows):
            return {(r.get("_id") or ""): int(r.get("n") or 0) for r in (rows or [])}

        # _id projection cuts the first 10 chars of the ISO timestamp.
        # Works because all our timestamps are ISO 8601 UTC strings.
        async def _date_count(coll, match):
            pipeline = [
                {"$match": match},
                {"$group": {
                    "_id": {"$substr": ["$" + match["__ts_field"], 0, 10]} if False else {"$substr": [f"${match['__ts_field']}", 0, 10]},
                    "n": {"$sum": 1},
                }},
            ]
            # Strip the marker before sending.
            field = match.pop("__ts_field")
            pipeline = [
                {"$match": match},
                {"$group": {"_id": {"$substr": [f"${field}", 0, 10]}, "n": {"$sum": 1}}},
            ]
            return _bucket([r async for r in coll.aggregate(pipeline)])

        signups = await _date_count(db.mittari_subscribers, {
            "created_at": {"$gte": oldest_iso}, "source": "web_signup",
            "__ts_field": "created_at",
        })
        bound = await _date_count(db.mittari_subscribers, {
            "telegram_bound_at": {"$gte": oldest_iso},
            "__ts_field": "telegram_bound_at",
        })
        dm_sent = await _date_count(db.dispatch_log, {
            "sent_at": {"$gte": oldest_iso},
            "source": "mittari_dm_fanout",
            "mode": "live", "error": None,
            "__ts_field": "sent_at",
        })
        # tma_open is COUNTED (not distinct) at the day level so the
        # trend reads as "how active was the Mini App that day". The
        # 24h snapshot counter still distincts users; different unit,
        # different question, both useful.
        tma_open = await _date_count(db.tma_events, {
            "ts": {"$gte": oldest_iso}, "event": "tma_open",
            "__ts_field": "ts",
        })
        unlock = await _date_count(db.redirect_click_log, {
            "ts": {"$gte": oldest_iso}, "status": "ok",
            "__ts_field": "ts",
        })

        rows = [{
            "day": d,
            "signup": signups.get(d, 0),
            "bound": bound.get(d, 0),
            "dm_sent": dm_sent.get(d, 0),
            "tma_open": tma_open.get(d, 0),
            "unlock_click": unlock.get(d, 0),
        } for d in day_keys]

        totals = {k: sum(r[k] for r in rows) for k in
                  ("signup", "bound", "dm_sent", "tma_open", "unlock_click")}
        return {"days": days, "rows": rows, "totals": totals}

    return router


async def ensure_bot_routing_indexes(db) -> None:
    """Create indexes for the new collections introduced in Slice 1.
    Called once from server startup. Idempotent.

    iter76 - link_codes, redirect_click_log, conversions are created
    here as schema-only stubs. The router (Slice 5) writes/reads them.
    """
    await db.partners.create_index("partner_key", unique=True, background=True)
    await db.partners.create_index([("status", 1), ("priority_weight", -1)], background=True)
    # link_codes - short opaque code → {signal_id, campaign, segment, ...}
    await db.link_codes.create_index("code", unique=True, background=True)
    await db.link_codes.create_index("created_at", background=True)
    # redirect_click_log - per-click audit
    await db.redirect_click_log.create_index("code", background=True)
    await db.redirect_click_log.create_index("ts", background=True)
    await db.redirect_click_log.create_index("subscriber_id", background=True, sparse=True)
    # conversions - postback landing zone
    await db.conversions.create_index([("partner_key", 1), ("ts", -1)], background=True)
    await db.conversions.create_index("code", background=True, sparse=True)
    # mittari_subscribers - new fields introduced in iter76 (additive).
    # Existing rows degrade fine via defaults; new rows insert with
    # the full schema via the signup endpoint (Slice 3).
    await db.mittari_subscribers.create_index("referral_code", sparse=True, background=True)
    await db.mittari_subscribers.create_index("referred_by", sparse=True, background=True)
    await db.mittari_subscribers.create_index([("status", 1), ("telegram_chat_id", 1)],
                                              sparse=True, background=True)
    # Slice 2: signup capture upserts by email - make it the natural key.
    await db.mittari_subscribers.create_index("email", sparse=True, background=True)
    await db.mittari_subscribers.create_index("pending_id", sparse=True, background=True)
