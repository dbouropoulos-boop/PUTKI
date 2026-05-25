"""
PUTKI HQ - Shared FastAPI deps + Pydantic payloads for the routes/ tree.

iter66 phase 4 infra investment. Removes the need for every route
factory to accept N positional dependencies. Subsequent extractions
just `from routes._helpers import …` what they need.

Wiring convention (in server.py once, at import time):

    from routes._helpers import bind_dependencies
    bind_dependencies(db=db, require_admin=require_admin)

Then any route module does:

    from routes._helpers import get_db, require_admin
    @router.get("/x")
    async def handler(db = Depends(get_db), _: bool = Depends(require_admin)):
        ...

Why bind once vs. carrying around a factory arg per module:
1. The Mongo handle + admin dependency are SINGLETONS in this app.
2. FastAPI's `Depends()` is the standard pattern - keeps the route
   modules importable without forcing server.py to instantiate them
   eagerly.
3. Tests can override via `app.dependency_overrides[get_db] = …` if
   they ever need to inject a `_MemDB`.
"""
from __future__ import annotations

from typing import Any, Callable, List, Optional

from fastapi import HTTPException, Header, Request
from pydantic import BaseModel


# ─── Module-level singletons, populated by `bind_dependencies()` ────
_db = None              # AsyncIOMotorDatabase
_require_admin = None   # async callable used as a FastAPI dependency


def bind_dependencies(*, db: Any, require_admin: Callable) -> None:
    """Server.py calls this once during boot. Tests may also call it
    again with a `_MemDB` if they want to side-step app.dependency_overrides."""
    global _db, _require_admin
    _db = db
    _require_admin = require_admin


def get_db():
    """FastAPI dependency - returns the bound Mongo handle.
    Fails loud if `bind_dependencies()` was never called."""
    if _db is None:
        raise HTTPException(
            500, "routes/_helpers: get_db() called before bind_dependencies()"
        )
    return _db


async def require_admin(
    request: Request,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Thin async pass-through to the server-bound admin gate.

    Mirrors server.py's `require_admin` signature *exactly* so FastAPI's
    OpenAPI introspection treats this as a (Request, X-Admin-Token header)
    dependency - NOT as an opaque `(*args, **kwargs)` function which
    would surface bogus query params on every protected endpoint."""
    if _require_admin is None:
        raise HTTPException(
            500, "routes/_helpers: require_admin called before bind_dependencies()"
        )
    return await _require_admin(request, x_admin_token)


# ─── Shared mini-game Pydantic payloads ─────────────────────────────
# These shapes are stable across quiz/scenario/insight/arcade - keeping
# them here lets route modules import the model and matches the FastAPI
# request body that the frontend already posts. Renaming any field is
# a frontend break, so the shapes are intentionally locked.

class MiniGameAnswerPayload(BaseModel):
    q_id: str
    picked: str


class MiniGameFinishPayload(BaseModel):
    play_id: str
    anon_id: str
    answers: List[MiniGameAnswerPayload]


class MiniGameUnlockPayload(BaseModel):
    play_id: str
    anon_id: str
    email: str
    name: Optional[str] = None
    consent: bool = False


class MiniGameInsightRevealPayload(BaseModel):
    play_id: str
    anon_id: str
    q_id: str


class MiniGameInsightFinishPayload(BaseModel):
    play_id: str
    anon_id: str


class MiniGameArcadeScorePayload(BaseModel):
    play_id: str
    anon_id: str
    score: int


class MiniGameShareTrackPayload(BaseModel):
    game_slug: str
    play_id: Optional[str] = None


class MiniGameQuestionPayload(BaseModel):
    slug: str
    order: int
    prompt_fi: str
    options: List[dict] = []
    correct: str = ""
    explanation_fi: str = ""
    topic_tag: str = ""
    active: bool = True
