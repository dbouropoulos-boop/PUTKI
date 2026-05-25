"""
PUTKI HQ - pytest session-level fixtures.

Goals:
  1. Make sure the backend ``.env`` (MONGO_URL, DB_NAME, BACK_OFFICE_TOKEN, etc.)
     is loaded BEFORE any test module imports backend modules. Tests like
     ``test_iter45_mestari_public`` do ``os.environ["MONGO_URL"]`` at import
     time, so we must load env vars at conftest import time.
  2. After the full pytest session completes, sweep any leftover raffles
     whose slug is prefixed with ``pytest-`` / ``test-`` so the public
     ``/voita`` (PUTKI HQ) listing stays clean. Tests are not always
     careful with their own teardown - this is a defensive net.
"""
import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Load /app/backend/.env *before* test modules import backend code.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_ROOT / ".env")

# Tests that hit the public URL (e.g. test_iter45_mestari_public) read
# REACT_APP_BACKEND_URL at import time. That value lives in the frontend
# .env file; surface it here so those tests collect cleanly.
FRONTEND_ENV = BACKEND_ROOT.parent / "frontend" / ".env"
if FRONTEND_ENV.exists():
    load_dotenv(FRONTEND_ENV)


@pytest.fixture(scope="session", autouse=True)
def _cleanup_voita_test_residue():
    """Yield first, then drop any pytest-* / test-* raffles + entries."""
    yield
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        return
    try:
        from pymongo import MongoClient
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
        db = client[db_name]
        test_q = {"slug": {"$regex": "^(pytest-|test-|qa-)"}}
        raffles = list(db.voita_raffles.find(test_q, {"_id": 0, "id": 1}))
        if not raffles:
            client.close()
            return
        ids = [r["id"] for r in raffles]
        db.voita_raffles.delete_many(test_q)
        db.voita_entries.delete_many({"raffle_id": {"$in": ids}})
        client.close()
    except Exception:
        # Best-effort cleanup; never break the test run on teardown.
        pass
