"""Backend tests for PUTKI HQ Phase 2.5 — Game Scores (Weezy Rally)."""
import os
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _cookie():
    return f"TESTCK-{uuid.uuid4().hex[:16]}"


# ---------- POST /api/game-scores ----------
class TestGameScorePost:
    def test_submit_valid_score(self, session):
        ck = _cookie()
        payload = {"cookie_id": ck, "name": "TEST_player", "score": 12345,
                   "crashes": 1, "time_left": 25, "stage": "imatra"}
        r = session.post(f"{API}/game-scores", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "rank", "total", "is_personal_best", "week", "stage", "score"):
            assert k in data, f"missing {k}"
        assert data["score"] == 12345
        assert data["stage"] == "imatra"
        # week format YYYYWww
        assert "W" in data["week"] and len(data["week"]) == 7
        assert data["is_personal_best"] is True  # first submission for this cookie
        assert data["rank"] >= 1
        assert data["total"] >= 1

    def test_missing_cookie_id_rejected(self, session):
        r = session.post(f"{API}/game-scores",
                         json={"score": 100, "stage": "imatra"})
        assert r.status_code == 422

    def test_negative_score_rejected(self, session):
        r = session.post(f"{API}/game-scores",
                         json={"cookie_id": _cookie(), "score": -1})
        assert r.status_code == 422

    def test_cookie_too_short_rejected(self, session):
        r = session.post(f"{API}/game-scores",
                         json={"cookie_id": "abc", "score": 100})
        assert r.status_code == 422

    def test_personal_best_flag_lower_score(self, session):
        ck = _cookie()
        # First high score
        r1 = session.post(f"{API}/game-scores",
                          json={"cookie_id": ck, "score": 80000})
        assert r1.status_code == 200
        assert r1.json()["is_personal_best"] is True
        # Lower score next
        r2 = session.post(f"{API}/game-scores",
                          json={"cookie_id": ck, "score": 5000})
        assert r2.status_code == 200
        assert r2.json()["is_personal_best"] is False


# ---------- GET /api/game-scores/leaderboard ----------
class TestLeaderboard:
    def test_leaderboard_shape(self, session):
        r = session.get(f"{API}/game-scores/leaderboard?stage=imatra")
        assert r.status_code == 200
        data = r.json()
        assert "week" in data
        assert data["stage"] == "imatra"
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)

    def test_leaderboard_sorted_desc_and_no_private_fields(self, session):
        # Pre-seed
        for sc in [4000, 9000, 1000]:
            session.post(f"{API}/game-scores",
                         json={"cookie_id": _cookie(), "score": sc})
        r = session.get(f"{API}/game-scores/leaderboard?stage=imatra&limit=20")
        rows = r.json()["leaderboard"]
        assert len(rows) >= 3
        scores = [row["score"] for row in rows]
        assert scores == sorted(scores, reverse=True), "leaderboard not sorted DESC"
        for row in rows:
            assert "_id" not in row
            assert "cookie_id" not in row
            for k in ("id", "score", "week", "stage", "created_at"):
                assert k in row, f"missing {k} in row"

    def test_leaderboard_limit_cap_50(self, session):
        r = session.get(f"{API}/game-scores/leaderboard?limit=999")
        assert r.status_code == 200
        assert len(r.json()["leaderboard"]) <= 50

    def test_leaderboard_limit_zero_clamped_to_one(self, session):
        # Make sure there's at least one row
        session.post(f"{API}/game-scores",
                     json={"cookie_id": _cookie(), "score": 123})
        r = session.get(f"{API}/game-scores/leaderboard?limit=0")
        assert r.status_code == 200
        rows = r.json()["leaderboard"]
        assert len(rows) >= 1  # clamped to 1


# ---------- GET /api/game-scores/me ----------
class TestPersonalScore:
    def test_me_empty_for_new_cookie(self, session):
        ck = f"TESTCK-NEW-{uuid.uuid4().hex[:12]}"
        r = session.get(f"{API}/game-scores/me?cookie_id={ck}")
        assert r.status_code == 200
        data = r.json()
        assert data["best"] is None
        assert data["rank"] is None
        assert data["total"] >= 0

    def test_me_after_submit(self, session):
        ck = _cookie()
        session.post(f"{API}/game-scores", json={"cookie_id": ck, "score": 7777})
        r = session.get(f"{API}/game-scores/me?cookie_id={ck}")
        assert r.status_code == 200
        data = r.json()
        assert data["best"] is not None
        assert data["best"]["score"] == 7777
        assert isinstance(data["rank"], int)
        assert data["rank"] >= 1
        assert data["total"] >= 1
        # cookie_id should not leak in best
        assert "cookie_id" not in data["best"]


# ---------- Rank computation across cookies ----------
class TestRankComputation:
    def test_three_cookies_ranking(self, session):
        c1, c2, c3 = _cookie(), _cookie(), _cookie()
        # Use a unique stage to isolate
        stage = f"teststage-{uuid.uuid4().hex[:6]}"
        session.post(f"{API}/game-scores",
                     json={"cookie_id": c1, "score": 90000, "stage": stage})
        session.post(f"{API}/game-scores",
                     json={"cookie_id": c2, "score": 50000, "stage": stage})
        session.post(f"{API}/game-scores",
                     json={"cookie_id": c3, "score": 70000, "stage": stage})

        r = session.get(f"{API}/game-scores/leaderboard?stage={stage}&limit=10")
        rows = r.json()["leaderboard"]
        scores = [row["score"] for row in rows]
        assert scores[:3] == [90000, 70000, 50000]

        # /me for c2 (50000) should be rank=3
        rme = session.get(f"{API}/game-scores/me?cookie_id={c2}&stage={stage}")
        assert rme.status_code == 200
        assert rme.json()["rank"] == 3
        assert rme.json()["total"] == 3
