"""
iter94 · Admin auth → httpOnly cookie session (Phase 3.5 / Phase 5 pre-req).

Migrates the back-office from an `X-Admin-Token` header (sessionStorage
on the SPA) to a signed httpOnly Secure SameSite=Strict cookie session.

Three endpoints, all under /api/admin/auth/*:

  POST /api/admin/auth/login    {token} → validate via resolve_admin_token,
                                 sign a JWT, set cookie, return actor+role.
  POST /api/admin/auth/logout   clears the cookie.
  GET  /api/admin/auth/whoami   reads cookie (or legacy header fallback)
                                 and returns authed actor/role.

The `require_admin` dependency in server.py is updated separately to
read the cookie first, then fall back to the legacy header. Both paths
continue to work during the migration window — once every admin fetch
on the SPA is using `credentials: 'include'` the header path can be
removed safely.

Cookie shape:
  - Name:     putki_admin_session
  - Value:    PyJWT HS256 token, payload {sub: actor_id, actor, role,
              iat, exp}
  - HttpOnly: true (no JS access; XSS-safe)
  - Secure:   true in production / regex-* CORS; false only when the
              ingress is plain HTTP (set via PUTKI_ADMIN_COOKIE_SECURE=0)
  - SameSite: Strict (back-office is same-origin behind the ingress)
  - Max-Age:  8 hours by default (PUTKI_ADMIN_SESSION_TTL_SECONDS)

Signing key:
  - JWT_SECRET env if present (matches the standard playbook), else
    BACK_OFFICE_TOKEN as a fallback seed. We never echo either back to
    the client; the cookie payload only carries actor identity.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

COOKIE_NAME = "putki_admin_session"
JWT_ALGORITHM = "HS256"
DEFAULT_TTL_SECONDS = 8 * 60 * 60  # 8h


def _ttl_seconds() -> int:
    try:
        return int(os.environ.get("PUTKI_ADMIN_SESSION_TTL_SECONDS") or DEFAULT_TTL_SECONDS)
    except (TypeError, ValueError):
        return DEFAULT_TTL_SECONDS


def _signing_secret() -> str:
    """Resolution order: JWT_SECRET (canonical) → BACK_OFFICE_TOKEN
    (fallback so existing single-admin deployments work with zero new
    env). Raises if both are unset — auth would otherwise be insecure."""
    secret = (
        os.environ.get("JWT_SECRET")
        or os.environ.get("BACK_OFFICE_TOKEN")
        or ""
    ).strip()
    if not secret:
        raise RuntimeError(
            "JWT_SECRET (or fallback BACK_OFFICE_TOKEN) must be set "
            "before issuing admin cookie sessions"
        )
    return secret


def _cookie_secure() -> bool:
    raw = (os.environ.get("PUTKI_ADMIN_COOKIE_SECURE") or "1").strip()
    return raw not in {"0", "false", "False"}


def encode_session(actor: Dict[str, Any], *, ttl_seconds: Optional[int] = None) -> Dict[str, Any]:
    """Sign a JWT for the given actor record. Returns {token, expires_at}
    suitable for set-cookie + response body."""
    ttl = ttl_seconds or _ttl_seconds()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=ttl)
    payload = {
        "sub": str(actor.get("actor_id") or actor.get("id") or "legacy"),
        "actor": str(actor.get("actor") or actor.get("username") or "unknown"),
        "role": str(actor.get("role") or "editor"),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, _signing_secret(), algorithm=JWT_ALGORITHM)
    return {"token": token, "expires_at": exp.isoformat(), "ttl_seconds": ttl}


def decode_session(cookie_value: str) -> Optional[Dict[str, Any]]:
    """Decode + verify a session cookie. Returns the actor dict (in the
    shape `resolve_admin_token` produces) or None on any failure."""
    if not cookie_value:
        return None
    try:
        payload = jwt.decode(
            cookie_value, _signing_secret(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "actor"]},
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    return {
        "actor_id": payload.get("sub"),
        "actor": payload.get("actor"),
        "role": payload.get("role") or "editor",
        "source": "cookie_session",
        "exp": payload.get("exp"),
    }


def set_session_cookie(response: Response, actor: Dict[str, Any]) -> Dict[str, Any]:
    """Sign a fresh token for `actor` and attach it as an httpOnly cookie
    on `response`. Returns the {token, expires_at, ttl_seconds} envelope
    so callers can include `expires_at` in the JSON response body."""
    bundle = encode_session(actor)
    response.set_cookie(
        key=COOKIE_NAME,
        value=bundle["token"],
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=bundle["ttl_seconds"],
        path="/",
    )
    return bundle


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


class _LoginPayload(BaseModel):
    token: str = Field(..., min_length=1, max_length=512)


def build_admin_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])

    @router.post("/login")
    async def login(payload: _LoginPayload, response: Response):
        from admin_auth import resolve_admin_token
        actor = await resolve_admin_token(db, payload.token.strip())
        if not actor:
            raise HTTPException(status_code=401, detail="Invalid admin token")
        bundle = set_session_cookie(response, actor)
        return {
            "authed": True,
            "actor": actor.get("actor") or actor.get("username"),
            "role": actor.get("role") or "editor",
            "expires_at": bundle["expires_at"],
            "ttl_seconds": bundle["ttl_seconds"],
        }

    @router.post("/logout")
    async def logout(response: Response):
        clear_session_cookie(response)
        return {"ok": True, "authed": False}

    @router.get("/whoami")
    async def whoami(request: Request):
        # Cookie first
        cookie_actor = decode_session(request.cookies.get(COOKIE_NAME) or "")
        if cookie_actor:
            return {
                "authed": True,
                "actor": cookie_actor["actor"],
                "role": cookie_actor["role"],
                "source": cookie_actor["source"],
                "exp": cookie_actor.get("exp"),
            }
        # Legacy header fallback so existing SPA sessions keep working
        header = request.headers.get("X-Admin-Token") or ""
        if header:
            from admin_auth import resolve_admin_token
            legacy_actor = await resolve_admin_token(db, header.strip())
            if legacy_actor:
                return {
                    "authed": True,
                    "actor": legacy_actor.get("actor"),
                    "role": legacy_actor.get("role") or "editor",
                    "source": "legacy_header",
                }
        raise HTTPException(status_code=401, detail="Not authenticated")

    return router
