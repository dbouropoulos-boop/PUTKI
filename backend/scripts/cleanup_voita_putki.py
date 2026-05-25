"""
PUTKI HQ - Voita / Putki cleanup script.

One-shot maintenance job that:
  1. Deletes all ``pytest-*`` and ``test-*`` voita_raffles + their entries
     (test residue that leaked into prod via the test suite).
  2. Strips em-dashes (—) and en-dashes (–) from every voita_raffles
     title / summary / note field, replacing them with standard hyphens.
  3. Refreshes the two seeded active raffles
     (``tappara-karpat-liiga-final-2026`` + ``kups-hjk-veikkausliiga-final-2026``)
     with fresh kickoff/close timestamps so the public listing has real
     live demo data again.

Run:
    cd /app/backend && python scripts/cleanup_voita_putki.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))


DASH_CHARS = ("\u2014", "\u2013")  # em-dash, en-dash
DASH_FIELDS = (
    "title_fi", "title_en", "summary_fi", "summary_en",
    "home_team", "away_team", "league",
)


def _scrub_dashes(value):
    if isinstance(value, str):
        for ch in DASH_CHARS:
            value = value.replace(ch, "-")
        return value
    if isinstance(value, list):
        return [_scrub_dashes(v) for v in value]
    if isinstance(value, dict):
        return {k: _scrub_dashes(v) for k, v in value.items()}
    return value


async def drop_test_raffles(db):
    test_q = {"slug": {"$regex": "^(pytest-|test-)"}}
    raffles = [d async for d in db.voita_raffles.find(test_q, {"_id": 0, "id": 1, "slug": 1})]
    if not raffles:
        print("[cleanup] no pytest/test raffles found")
        return 0
    ids = [r["id"] for r in raffles]
    slugs = [r["slug"] for r in raffles]
    rd = await db.voita_raffles.delete_many(test_q)
    ed = await db.voita_entries.delete_many({"raffle_id": {"$in": ids}})
    print(f"[cleanup] removed {rd.deleted_count} test raffles, {ed.deleted_count} entries")
    for s in slugs:
        print(f"           - {s}")
    return rd.deleted_count


async def scrub_dashes(db):
    cur = db.voita_raffles.find({}, {"_id": 0})
    fixed = 0
    async for doc in cur:
        updates = {}
        for f in DASH_FIELDS:
            if f in doc and isinstance(doc[f], str):
                new = _scrub_dashes(doc[f])
                if new != doc[f]:
                    updates[f] = new
        # also scrub nested prize_distribution.payouts[].note
        pd = doc.get("prize_distribution") or {}
        payouts = pd.get("payouts") or []
        new_payouts = [_scrub_dashes(p) for p in payouts]
        if new_payouts != payouts:
            updates["prize_distribution.payouts"] = new_payouts
        # editorial_pick notes
        ep = doc.get("editorial_pick") or {}
        if ep:
            new_ep = _scrub_dashes(ep)
            if new_ep != ep:
                updates["editorial_pick"] = new_ep
        if updates:
            await db.voita_raffles.update_one({"id": doc["id"]}, {"$set": updates})
            fixed += 1
            print(f"[scrub] {doc.get('slug')} - {list(updates.keys())}")
    print(f"[scrub] scrubbed em/en-dashes on {fixed} raffles")
    return fixed


async def refresh_active_seeds(db):
    """Re-seed the two demo active raffles with fresh future kickoffs.
    If they already exist, delete + recreate (no entries are expected
    on seeded demo raffles in prod; this is editorial demo data).
    """
    # Import the canonical seed definitions to stay DRY.
    from seed_active_raffles import RAFFLES, _iso  # noqa: E402
    import uuid as _uuid

    refreshed = 0
    for r in RAFFLES:
        existing = await db.voita_raffles.find_one({"slug": r["slug"]}, {"_id": 0, "id": 1, "entries_count": 1})
        if existing:
            # Only nuke seeded demo raffles that have zero entries to be safe.
            entries = await db.voita_entries.count_documents({"raffle_id": existing["id"]})
            if entries > 0:
                # update timestamps in-place; leave entries intact
                await db.voita_raffles.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "kickoff_at": _iso(r["kickoff_hours"]),
                        "entries_close_at": _iso(r["close_hours"]),
                        "status": "open",
                        "updated_at": _iso(0),
                    }},
                )
                refreshed += 1
                print(f"[reseed] {r['slug']} refreshed in-place ({entries} entries kept)")
                continue
            await db.voita_raffles.delete_one({"id": existing["id"]})

        raffle_id = _uuid.uuid4().hex
        await db.voita_raffles.insert_one({
            "id": raffle_id,
            "slug": r["slug"],
            "title_fi": r["title_fi"],
            "title_en": r["title_en"],
            "summary_fi": r["summary_fi"],
            "summary_en": r["summary_en"],
            "sport": r["sport"],
            "league": r["league"],
            "home_team": r["home_team"],
            "away_team": r["away_team"],
            "kickoff_at": _iso(r["kickoff_hours"]),
            "entries_close_at": _iso(r["close_hours"]),
            "prize_cap_eur": r["prize_cap_eur"],
            "prize_distribution": r["prize_distribution"],
            "scoring": {
                "one_x_two_points": 3,
                "exact_score_points": 5,
                "goal_diff_points": 3,
                "total_goals_points": 1,
            },
            "gating": {
                "rules_url_set": True,
                "prize_distribution_locked": True,
                "match_populated": True,
            },
            "editorial_pick": r["editorial_pick"],
            "status": "open",
            "entries_count": 0,
            "result": None,
            "created_at": _iso(-2),
            "updated_at": _iso(0),
            "seeded": True,
        })
        refreshed += 1
        print(f"[reseed] {r['slug']} - kickoff in {r['kickoff_hours']}h")
    print(f"[reseed] refreshed {refreshed} active demo raffles")
    return refreshed


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    print(f"[cleanup] start @ {datetime.now(timezone.utc).isoformat()}")
    dropped = await drop_test_raffles(db)
    scrubbed = await scrub_dashes(db)
    refreshed = await refresh_active_seeds(db)
    print(f"\n[cleanup] DONE - dropped={dropped} scrubbed={scrubbed} refreshed={refreshed}")


if __name__ == "__main__":
    asyncio.run(main())
