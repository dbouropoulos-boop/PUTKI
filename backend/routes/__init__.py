"""PUTKI HQ — Modular route packages (iter66 modularisation phase 1).

Routes are progressively extracted from the server.py monolith into
focused submodules. Each module exposes a `build_*_router(...)`
factory that takes any required dependencies (db handle, auth deps)
and returns a configured `APIRouter`.

Wire-up convention (in server.py):

    from routes.profiler import build_profiler_router, register_share_landing
    api_router.include_router(build_profiler_router(db, require_admin))
    register_share_landing(app)
"""
