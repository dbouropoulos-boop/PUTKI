"""
PUTKI HQ - Admin auth v2 · per-user tokens + audit log (iter62, P3).

We previously had a single shared `BACK_OFFICE_TOKEN` env value that
everyone working in the back-office used. Now:

  • Each editor gets their own token (sha256-hashed at rest).
  • Every admin mutation writes one row to `admin_audit_log`.
  • The legacy single token still works (back-compat) - it resolves to
    actor `"legacy_env_token"` so existing tooling/curls keep functioning.

Migration: on first boot we seed a `root` admin user from the existing
`BACK_OFFICE_TOKEN` env var. Operators can then rotate via the
`POST /api/admin/users` endpoint and decommission the env token.

Token format:
  • A plain random URL-safe 32-byte string we hand to the user once on
    creation. We persist only `sha256(token)`. Forgotten tokens require
    a re-issue - they cannot be recovered (this is intentional).

Tokens are passed in via the `X-Admin-Token` header just like before.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# ─────────────────────── Schemas ─────────────────────────────────────────
# admin_users:
#   { id, username, token_hash, role, created_at, created_by, last_used_at,
#     active }
#
# admin_audit_log:
#   { id, ts, actor, role, action, resource, meta, ip }


async def ensure_indexes(db) -> None:
    await db.admin_users.create_index("token_hash", unique=True)
    await db.admin_users.create_index("username", unique=True)
    await db.admin_audit_log.create_index([("ts", -1)])
    await db.admin_audit_log.create_index([("actor", 1), ("ts", -1)])


async def seed_root_user_from_env(db) -> Optional[Dict[str, Any]]:
    """First-boot bootstrap: if `BACK_OFFICE_TOKEN` is set AND no admin
    user with that token exists yet, create a `root` user from it. This
    lets us migrate without operator action."""
    token = os.environ.get("BACK_OFFICE_TOKEN", "").strip()
    if not token:
        return None
    h = _sha256(token)
    existing = await db.admin_users.find_one({"token_hash": h}, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": secrets.token_hex(8),
        "username": "root",
        "token_hash": h,
        "role": "owner",
        "created_at": _now_iso(),
        "created_by": "boot_migration",
        "last_used_at": None,
        "active": True,
    }
    try:
        await db.admin_users.insert_one(doc)
    except Exception:
        # Username collision (race): swallow and read it back.
        existing = await db.admin_users.find_one({"username": "root"}, {"_id": 0})
        return existing
    return doc


async def resolve_admin_token(db, raw_token: str) -> Optional[Dict[str, Any]]:
    """Validates the X-Admin-Token header. Returns the actor metadata
    or None for rejection. Accepts:

      1. A per-user token whose sha256 matches an `active` admin_users row.
      2. The legacy `BACK_OFFICE_TOKEN` env value - bound to the
         pseudo-actor `legacy_env_token`, role `owner`.

    Updates `last_used_at` on a successful per-user resolution.
    """
    if not raw_token:
        return None
    h = _sha256(raw_token)
    row = await db.admin_users.find_one(
        {"token_hash": h, "active": True},
        {"_id": 0, "id": 1, "username": 1, "role": 1},
    )
    if row:
        await db.admin_users.update_one(
            {"id": row["id"]},
            {"$set": {"last_used_at": _now_iso()}},
        )
        return {
            "actor_id": row["id"],
            "actor": row["username"],
            "role": row.get("role") or "editor",
            "source": "per_user_token",
        }
    legacy = os.environ.get("BACK_OFFICE_TOKEN", "")
    if legacy and secrets.compare_digest(raw_token, legacy):
        return {
            "actor_id": "legacy",
            "actor": "legacy_env_token",
            "role": "owner",
            "source": "env_token",
        }
    return None


# ─────────────────────── Audit log helpers ───────────────────────────────

async def write_audit(db, *, actor: str, role: str,
                       action: str, resource: str,
                       meta: Optional[Dict[str, Any]] = None,
                       ip: Optional[str] = None) -> None:
    """Append-only. Never read by hot-path code - only by the back-office
    audit view. Safe to call from anywhere (errors are swallowed)."""
    try:
        await db.admin_audit_log.insert_one({
            "id": secrets.token_hex(12),
            "ts": _now_iso(),
            "actor": actor,
            "role": role,
            "action": action,
            "resource": resource,
            "meta": meta or {},
            "ip": ip,
        })
    except Exception:
        pass  # Never break the request if audit fails.


# ─────────────────────── Admin user CRUD ─────────────────────────────────

async def list_admin_users(db) -> List[Dict[str, Any]]:
    cur = db.admin_users.find(
        {},
        {"_id": 0, "id": 1, "username": 1, "role": 1, "active": 1,
         "created_at": 1, "created_by": 1, "last_used_at": 1},
    ).sort("created_at", 1)
    return await cur.to_list(length=200)


async def create_admin_user(db, *, username: str, role: str,
                             created_by: str) -> Dict[str, Any]:
    username = (username or "").strip().lower()
    if not username or not re.match(r"^[a-z0-9_-]{2,32}$", username):
        raise ValueError("invalid_username")
    if role not in {"owner", "editor", "reviewer"}:
        raise ValueError("invalid_role")
    existing = await db.admin_users.find_one({"username": username})
    if existing:
        raise ValueError("username_taken")
    raw_token = secrets.token_urlsafe(32)
    doc = {
        "id": secrets.token_hex(8),
        "username": username,
        "token_hash": _sha256(raw_token),
        "role": role,
        "created_at": _now_iso(),
        "created_by": created_by,
        "last_used_at": None,
        "active": True,
    }
    await db.admin_users.insert_one(doc)
    # MongoDB mutated `doc` to include `_id` (ObjectId) - drop it before returning.
    doc.pop("_id", None)
    return {**{k: v for k, v in doc.items() if k != "token_hash"},
            "token_plain": raw_token}  # shown ONCE.


async def deactivate_admin_user(db, *, user_id: str) -> bool:
    r = await db.admin_users.update_one(
        {"id": user_id},
        {"$set": {"active": False}},
    )
    return r.modified_count > 0


# ─────────────────────── Audit feed read ─────────────────────────────────

async def read_audit_log(db, *, limit: int = 100,
                          actor: Optional[str] = None) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if actor:
        q["actor"] = actor
    cur = db.admin_audit_log.find(
        q,
        {"_id": 0, "id": 1, "ts": 1, "actor": 1, "role": 1, "action": 1,
         "resource": 1, "meta": 1, "ip": 1},
    ).sort("ts", -1).limit(min(limit, 500))
    return await cur.to_list(length=min(limit, 500))


import re  # noqa: E402  (used above)
