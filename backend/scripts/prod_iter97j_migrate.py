"""
Production iter97j migration — idempotent, safe to re-run.

Run on the production pod:
    cd /app/backend && python3 scripts/prod_iter97j_migrate.py

What it does:
  1. Flips bot_config.daily_dm_enabled=True, sharpness_min=0, and
     state_gate_eligible_states=["KUUMA","MYRSKY","KIIRASTULI"] for ALL
     bot_config rows (handles the legacy two-document schema we saw on
     preview where one row has no _id and the other is id='singleton').
  2. Upserts the three settings kill-switches:
       daily_dispatch_enabled = True
       special_drops_enabled = False
       partner_promo_enabled = False
  3. Asserts the new collection indexes (auto-created on backend boot
     too, but explicit is better than implicit here).

Safety:
  - All writes are upserts with $set on specific keys — won't clobber
    other fields editors may have added to bot_config or settings.
  - No destructive deletes.
  - Re-running this is a no-op after the first successful run.
  - dispatch_ops_alerts collection starts empty in prod — no risk of
    stale dedup rows suppressing real alerts.
"""
from __future__ import annotations

import os
import asyncio
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


load_dotenv("/app/backend/.env")


async def main() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    db = AsyncIOMotorClient(mongo_url)[db_name]
    now = datetime.now(timezone.utc).isoformat()

    print(f"connected to: {db_name}")
    print(f"timestamp:    {now}")
    print()

    # ── bot_config: state-gate + dispatch flags ───────────────────────
    bc_before = await db.bot_config.count_documents({})
    bc_res = await db.bot_config.update_many(
        {},
        {"$set": {
            "daily_dm_enabled": True,
            "sharpness_min": 0,
            "state_gate_eligible_states": ["KUUMA", "MYRSKY", "KIIRASTULI"],
            "updated_at": now,
        }},
        upsert=True,
    )
    print(f"bot_config: docs_before={bc_before} matched={bc_res.matched_count} "
          f"modified={bc_res.modified_count} upserted_id={bc_res.upserted_id}")

    # ── settings: dispatch toggles + kill-switches ────────────────────
    settings_keys = [
        ("daily_dispatch_enabled", True),
        ("special_drops_enabled", False),
        ("partner_promo_enabled", False),
    ]
    for key, val in settings_keys:
        res = await db.settings.update_one(
            {"_id": key},
            {"$set": {"_id": key, "value": val, "updated_at": now}},
            upsert=True,
        )
        action = "inserted" if res.upserted_id else ("updated" if res.modified_count else "unchanged")
        print(f"settings.{key} = {val}  [{action}]")

    # ── indexes (defensive — ensure_indexes() on backend boot already does this) ──
    try:
        await db.dispatch_ops_alerts.create_index("alert_key", unique=True)
        await db.telegram_broadcasts.create_index("date_ymd", unique=True)
        await db.dispatch_log.create_index("sent_at")
        await db.dispatch_log.create_index([("kind", 1), ("sent_at", -1)])
        await db.dispatch_drafts.create_index([("type", 1), ("scheduled_for", -1)])
        print("indexes: asserted OK")
    except Exception as e:
        print(f"indexes: warning — {e}")

    # ── verification ──────────────────────────────────────────────────
    print()
    print("=== verification ===")
    async for r in db.bot_config.find({}):
        r.pop("_id", None)
        print(f"bot_config row: {r}")
    for key, _ in settings_keys:
        row = await db.settings.find_one({"_id": key})
        print(f"settings.{key}: {row.get('value') if row else 'MISSING'}")
    eligible = await db.optin_consents.count_documents({
        "status": {"$ne": "unsubscribed"},
        "channel": "email",
    })
    print(f"eligible email subscribers (status != 'unsubscribed'): {eligible}")
    print()
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
