"""
PUTKI HQ — Back-office activity log (Task 2.7).

A single append-only collection `back_office_activity` that captures
every back-office mutation. Each row holds enough context for either
the cockpit's "Recent activity" feed or a soft-undo flip.

Schema
──────
  id          str             uuid4
  ts          str (ISO 8601)  inserted-at
  actor_hash  str (8 chars)   sha256(X-Admin-Token)[:8]
  action_type str             dot.separated namespace, e.g. "queue.approve",
                              "news_watch.kill", "voita.draw"
  route       str | null      where in the back-office the action lives
                              (used by the cockpit feed for navigation)
  entity      str | null      human label of the affected entity
                              (e.g. "queue/abc12345" or "raffle/sprint-test")
  entity_id   str | null      the actual document id (for undo joins)
  collection  str | null      the Mongo collection the entity belongs to
  prev_state  dict | null     snapshot BEFORE the mutation (undo source)
  next_state  dict | null     snapshot AFTER the mutation (audit)
  reversible  bool            whether soft-undo is offered
  undone_at   str | null      set when undo succeeded
  undone_by   str | null      actor_hash of the operator that triggered undo
  meta        dict            free-form (e.g. request method, IP-less)

Endpoints
─────────
  GET  /api/admin/back_office_activity?limit=10&action_type=&actor=&since=
  POST /api/admin/back_office_activity/{row_id}/undo
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

logger = logging.getLogger(__name__)

COLLECTION = "back_office_activity"

# ─── Reversible action registry ─────────────────────────────────────
#
# Each reversible action_type knows how to flip a row back. The undo
# handler looks up `REVERSIBLE_ACTIONS[action_type]` and runs the
# associated coroutine.  Each function receives:
#
#     async def undo(db, row) -> dict   # the new state after undo
#
# and either returns a dict (success → activity row gets a new
# {action_type}.undone twin entry) or raises HTTPException(400) if the
# row is no longer safely reversible (e.g. the entity has been
# subsequently mutated by another action).
#
# We only register a handler for the action types we actively support.

async def _undo_queue_approve(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Re-queue an approved generated_content row."""
    entity_id = row.get("entity_id")
    if not entity_id:
        raise HTTPException(400, "undo: missing entity_id")
    cur = await db.generated_content.find_one({"id": entity_id}, {"_id": 0})
    if not cur:
        raise HTTPException(400, "undo: target generated_content row no longer exists")
    if cur.get("status") != "approved":
        raise HTTPException(400, f"undo: target is now status={cur.get('status')!r}, not 'approved'")
    await db.generated_content.update_one(
        {"id": entity_id},
        {"$set": {"status": "queued", "approved_at": None, "approved_by": None}},
    )
    return {"id": entity_id, "status": "queued"}


async def _undo_queue_kill(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Restore a killed generated_content row back to queued."""
    entity_id = row.get("entity_id")
    if not entity_id:
        raise HTTPException(400, "undo: missing entity_id")
    cur = await db.generated_content.find_one({"id": entity_id}, {"_id": 0})
    if not cur:
        raise HTTPException(400, "undo: target generated_content row no longer exists")
    if cur.get("status") != "killed":
        raise HTTPException(400, f"undo: target is now status={cur.get('status')!r}, not 'killed'")
    await db.generated_content.update_one(
        {"id": entity_id},
        {"$set": {"status": "queued", "killed_at": None, "killed_reason": None}},
    )
    return {"id": entity_id, "status": "queued"}


async def _undo_news_watch_kill(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Remove a URL from the news_rejected_urls collection (== unkill)."""
    url = (row.get("prev_state") or {}).get("url") or row.get("entity_id")
    if not url:
        raise HTTPException(400, "undo: missing url")
    res = await db.news_rejected_urls.delete_one({"url": url})
    if res.deleted_count == 0:
        raise HTTPException(400, "undo: url is no longer in the rejected list")
    return {"url": url, "status": "unkilled"}


async def _undo_news_watch_promote(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Demote a previously-promoted news item back to the archive."""
    url = (row.get("prev_state") or {}).get("url") or row.get("entity_id")
    if not url:
        raise HTTPException(400, "undo: missing url")
    from news_watch import demote  # local import keeps import graph cheap
    item = await demote(db, url)
    if not item:
        raise HTTPException(400, "undo: target news item is no longer in the ticker")
    return {"url": url, "status": "demoted"}


async def _undo_news_watch_demote(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Re-promote a previously-demoted news item back to the ticker."""
    url = (row.get("prev_state") or {}).get("url") or row.get("entity_id")
    if not url:
        raise HTTPException(400, "undo: missing url")
    from news_watch import promote
    item = await promote(db, url)
    if not item:
        raise HTTPException(400, "undo: target news item is no longer in the archive")
    return {"url": url, "status": "re-promoted"}


async def _undo_bot_config_toggle(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Flip the bot_config single document back to its prev_state."""
    prev = row.get("prev_state") or {}
    if not prev:
        raise HTTPException(400, "undo: missing prev_state for bot_config flip")
    # Only restore fields we explicitly captured — never wholesale-replace
    # the doc (other ops may have rolled in unrelated changes).
    update = {k: v for k, v in prev.items() if k in {
        "signal_unlock_mode", "daily_dm_enabled", "default_route_template",
        "default_route_partner_id",
    }}
    if not update:
        raise HTTPException(400, "undo: prev_state has no recognized bot_config fields")
    # The bot_config singleton is keyed by `_id="bot_config"` (see
    # routes/bot_routing.py). Using `{"id": ...}` here would create a
    # phantom doc and leave the real one untouched.
    await db.bot_config.update_one({"_id": "bot_config"}, {"$set": update}, upsert=True)
    return {"restored": update}


async def _undo_voita_delete(db, row: Dict[str, Any]) -> Dict[str, Any]:
    """Re-insert a soft-deleted voita raffle from its prev_state snapshot."""
    snap = row.get("prev_state") or {}
    raffle_id = snap.get("id") or row.get("entity_id")
    if not (raffle_id and snap):
        raise HTTPException(400, "undo: missing raffle snapshot")
    exists = await db.voita_raffles.find_one({"id": raffle_id}, {"_id": 0, "id": 1})
    if exists:
        raise HTTPException(400, "undo: raffle was re-created in the meantime")
    # Wipe Mongo's `_id` if it leaked into the snapshot.
    snap = {k: v for k, v in snap.items() if k != "_id"}
    await db.voita_raffles.insert_one(snap)
    return {"id": raffle_id, "status": "restored"}


REVERSIBLE_ACTIONS: Dict[str, Callable] = {
    "queue.approve":        _undo_queue_approve,
    "queue.kill":           _undo_queue_kill,
    "news_watch.kill":      _undo_news_watch_kill,
    "news_watch.promote":   _undo_news_watch_promote,
    "news_watch.demote":    _undo_news_watch_demote,
    "bot_config.toggle":    _undo_bot_config_toggle,
    "voita.delete":         _undo_voita_delete,
}


# ─── Logger helper (called from instrumented endpoints) ─────────────

def _hash_token(token: Optional[str]) -> str:
    if not token:
        return "anonymous"
    h = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return h[:8]


def _strip_mongo_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return doc
    return {k: v for k, v in doc.items() if k != "_id"}


async def log_activity(
    db,
    *,
    action_type: str,
    actor_token: Optional[str] = None,
    route: Optional[str] = None,
    entity: Optional[str] = None,
    entity_id: Optional[str] = None,
    collection: Optional[str] = None,
    prev_state: Optional[Dict[str, Any]] = None,
    next_state: Optional[Dict[str, Any]] = None,
    reversible: Optional[bool] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> str:
    """Append one row to back_office_activity. Returns the row id.

    Never raises — activity logging is best-effort instrumentation;
    surfacing its failures would risk killing the parent operation."""
    try:
        if reversible is None:
            reversible = action_type in REVERSIBLE_ACTIONS
        row = {
            "id": uuid.uuid4().hex,
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor_hash": _hash_token(actor_token),
            "action_type": action_type,
            "route": route,
            "entity": entity,
            "entity_id": entity_id,
            "collection": collection,
            "prev_state": _strip_mongo_id(prev_state),
            "next_state": _strip_mongo_id(next_state),
            "reversible": bool(reversible),
            "undone_at": None,
            "undone_by": None,
            "meta": meta or {},
        }
        await db[COLLECTION].insert_one(row)
        return row["id"]
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("log_activity failed for %s: %s", action_type, exc)
        return ""


async def ensure_indexes(db) -> None:
    """Idempotent indexes. Safe to call on every boot."""
    try:
        await db[COLLECTION].create_index([("ts", -1)])
        await db[COLLECTION].create_index("action_type")
        await db[COLLECTION].create_index("actor_hash")
        await db[COLLECTION].create_index("entity_id")
    except Exception as exc:  # pragma: no cover
        logger.warning("ensure_indexes failed: %s", exc)


# ─── Router factory ─────────────────────────────────────────────────

def build_activity_router(require_admin: Callable, db) -> APIRouter:
    router = APIRouter(prefix="/admin/back_office_activity",
                       tags=["admin.activity"])

    def _row_view(row: Dict[str, Any]) -> Dict[str, Any]:
        # Strip Mongo's _id and surface a stable response shape.
        return {k: v for k, v in row.items() if k != "_id"}

    @router.get("")
    async def list_activity(
        limit: int = Query(10, ge=1, le=200),
        action_type: Optional[str] = Query(None),
        actor: Optional[str] = Query(None, description="actor_hash filter"),
        since: Optional[str] = Query(None, description="ISO-8601 lower bound"),
        until: Optional[str] = Query(None, description="ISO-8601 upper bound"),
        reversible_only: bool = Query(False),
        _: bool = Depends(require_admin),
    ) -> Dict[str, Any]:
        q: Dict[str, Any] = {}
        if action_type:
            q["action_type"] = action_type
        if actor:
            q["actor_hash"] = actor
        if reversible_only:
            q["reversible"] = True
            q["undone_at"] = None
        ts_q: Dict[str, Any] = {}
        if since:
            ts_q["$gte"] = since
        if until:
            ts_q["$lte"] = until
        if ts_q:
            q["ts"] = ts_q
        cur = db[COLLECTION].find(q, {"_id": 0}).sort("ts", -1).limit(limit)
        items: List[Dict[str, Any]] = await cur.to_list(length=limit)
        total = await db[COLLECTION].count_documents(q)
        return {"items": items, "count": len(items), "total": total}

    @router.get("/distinct/action_types")
    async def distinct_action_types(_: bool = Depends(require_admin)) -> Dict[str, Any]:
        """Power the filter dropdown on the dedicated /back-office/activity page."""
        try:
            values: Iterable[str] = await db[COLLECTION].distinct("action_type")
        except Exception:
            values = []
        return {"action_types": sorted(values)}

    @router.post("/{row_id}/undo")
    async def undo_row(
        row_id: str,
        x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
        _: bool = Depends(require_admin),
    ) -> Dict[str, Any]:
        row = await db[COLLECTION].find_one({"id": row_id}, {"_id": 0})
        if not row:
            raise HTTPException(404, "activity row not found")
        if not row.get("reversible"):
            raise HTTPException(400, "this action is not reversible")
        if row.get("undone_at"):
            raise HTTPException(400, "already undone")
        handler = REVERSIBLE_ACTIONS.get(row.get("action_type") or "")
        if not handler:
            raise HTTPException(400, "no undo handler registered for this action_type")

        # 24h cutoff — a row older than 24h is considered cold and is
        # locked from undo to avoid surprise rollbacks.
        try:
            ts = datetime.fromisoformat(row["ts"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - ts > timedelta(hours=24):
                raise HTTPException(400, "undo window expired (24h)")
        except HTTPException:
            raise
        except Exception:
            pass

        result = await handler(db, row)
        actor_hash = _hash_token(x_admin_token)
        await db[COLLECTION].update_one(
            {"id": row_id},
            {"$set": {
                "undone_at": datetime.now(timezone.utc).isoformat(),
                "undone_by": actor_hash,
            }},
        )
        # Record an "undo" twin so the activity feed shows both directions.
        await log_activity(
            db,
            action_type=f"{row['action_type']}.undone",
            actor_token=x_admin_token,
            route=row.get("route"),
            entity=row.get("entity"),
            entity_id=row.get("entity_id"),
            collection=row.get("collection"),
            prev_state=row.get("next_state"),
            next_state=row.get("prev_state"),
            reversible=False,
            meta={"undid_row_id": row_id},
        )
        return {"ok": True, "result": result, "row_id": row_id}

    return router
