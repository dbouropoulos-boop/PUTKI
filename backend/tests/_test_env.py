"""
Test helpers - env-driven config for the backend test suite.

Centralises:
  • BACK_OFFICE admin token resolution (from env, falls back to backend/.env via dotenv)
  • BASE_URL resolution (REACT_APP_BACKEND_URL)
  • In-process random webhook fixtures (secrets.token_hex)
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path


def _load_dotenv_once() -> None:
    """Best-effort load of backend/.env so tests pick up BACK_OFFICE_TOKEN
    without requiring the caller to export it manually."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except OSError:
        pass


_load_dotenv_once()


def admin_token() -> str:
    """Read BACK_OFFICE_TOKEN from env; fail loudly if absent."""
    tok = os.environ.get("BACK_OFFICE_TOKEN")
    if not tok:
        raise RuntimeError(
            "BACK_OFFICE_TOKEN not set in environment. "
            "Tests must read the token from env, not hard-code it."
        )
    return tok


def admin_headers() -> dict:
    return {"X-Admin-Token": admin_token(), "Content-Type": "application/json"}


def backend_url() -> str:
    """Resolve REACT_APP_BACKEND_URL from env or frontend/.env."""
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    fe_env = Path("/app/frontend/.env")
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


def random_secret(prefix: str = "test") -> str:
    """Generate a per-test-run secret. Not committed; not predictable."""
    return f"{prefix}_{secrets.token_hex(16)}"
