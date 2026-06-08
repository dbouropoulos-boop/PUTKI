# Production deploy runbook · iter97j

> **Status (verified 2026-06-06 15:30 UTC)**: Production `putkihq.fi` is on **pre-iter97f code**.
> Confirmed via 4 endpoint probes — `/api/admin/dispatch/{drafts,preview,fire}` + `/api/u/{token}` all return 404.
> Preview head SHA (this codebase): `6edaee8`.
>
> **Goal**: bring production to feature-parity with preview, with zero impact on subscribers until you manually fire from the back-office composer.

---

## Pre-flight check (DO NOT skip)

Before you click "Save to GitHub" verify these claims hold:

| Check | Command | Expected |
|---|---|---|
| Preview lint clean | `cd /app/backend && python -m pytest tests/test_iter97j_weekly_cron.py -v` | 6/6 passed |
| Full regression | `python -m pytest tests/test_iter89* tests/test_iter94* tests/test_iter88* tests/test_iter97j*` | 30/30 passed |
| Preview composer reachable | open `/back-office/dispatch` in preview, all 3 tabs render | ✅ visual |
| Preview fire dry-run | `curl … /api/admin/dispatch/fire {type:weekly, confirm:true, dry_run:true}` | 200 + `kind=weekly_cycle` |
| Preview unsub endpoint | `curl …/api/u/test_token` | renders FI confirmation page (or 400 invalid-token, NOT 404) |

All five are green right now.

---

## Step A — Push preview → GitHub → production

1. **You click**: the **"Save to GitHub"** button in the chat input (this is the only way — agent has no GitHub write access).
2. **You click**: in the Emergent deploy panel → "Deploy to production" / push to `putkihq.fi`.
3. Wait for the deploy to settle (~2–5 min). Watch the deploy logs for "started successfully" on the backend supervisor.

---

## Step B — Production `.env` updates

The preview `.env` has these dispatch-critical keys. Production must mirror — **except for the values that are environment-specific (MONGO_URL, DB_NAME, JWT_SECRET, BACK_OFFICE_TOKEN — keep prod's existing values).**

Diff to apply on **production** (in the Emergent env panel or `backend/.env` on the prod pod):

```bash
# Required (must be present in prod):
RESEND_FROM=PUTKI HQ <signals@putkihq.fi>
RESEND_API_KEY=<existing prod key>
TELEGRAM_BOT_TOKEN=<existing prod token>

# NEW for iter97j — add if missing:
OPS_ADMIN_CHAT_ID=909303651

# DELETE if present (state-gate replaces it):
# TELEGRAM_THROTTLE_DISABLED=...    ← remove this line entirely

# DO NOT TOUCH (prod-specific):
MONGO_URL=<prod cluster>
DB_NAME=<prod db name>
JWT_SECRET=<prod secret>
BACK_OFFICE_TOKEN=<prod token>
```

After applying: `sudo supervisorctl restart backend` on the prod pod (or trigger via deploy panel). Verify with:

```bash
# from any machine
curl -sk https://putkihq.fi/api/admin/dispatch/drafts -w "\nHTTP:%{http_code}\n"
# Expected: HTTP:401 (auth required) — NOT 404. 401 = iter97i+ is live.
```

---

## Step C — Production database `bot_config` flips

The composer + state-gate read these flags. Production DB likely has the legacy schema with **two** `bot_config` documents (a singleton-id'd one and an older un-id'd one) — same as preview. Run this idempotent migration on **production MongoDB**.

Use the Emergent backend pod's `python3` shell, or any machine with prod `MONGO_URL`:

```python
# /app/backend/scripts/prod_iter97j_migrate.py
import os, asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()

    # bot_config: set the keys the new dispatch path reads
    await db.bot_config.update_many(
        {},
        {"$set": {
            "daily_dm_enabled": True,
            "sharpness_min": 0,
            "state_gate_eligible_states": ["KUUMA", "MYRSKY", "KIIRASTULI"],
            "updated_at": now,
        }},
        upsert=True,
    )
    print("bot_config updated.")

    # settings (kill-switches read by run_daily_dispatch):
    for key, val in [
        ("daily_dispatch_enabled", True),
        ("special_drops_enabled", False),
        ("partner_promo_enabled", False),
    ]:
        await db.settings.update_one(
            {"_id": key}, {"$set": {"_id": key, "value": val, "updated_at": now}}, upsert=True,
        )
    print("settings updated.")

    # Index sanity (these are auto-created by ensure_indexes on backend boot, but safe to assert)
    await db.dispatch_ops_alerts.create_index("alert_key", unique=True)
    await db.telegram_broadcasts.create_index("date_ymd", unique=True)
    print("indexes asserted.")

asyncio.run(main())
```

Run it: `cd /app/backend && python3 scripts/prod_iter97j_migrate.py`.

Verify:

```bash
# from prod pod
cd /app/backend && python3 -c "
import os, asyncio
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
async def m():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    async for r in db.bot_config.find({}): print('bot_config:', {k:v for k,v in r.items() if k!='_id'})
    async for r in db.settings.find({'_id':{'\$in':['daily_dispatch_enabled']}}): print('settings:', r)
asyncio.run(m())
"
```

---

## Step D — Production smoke (no list fire, no real subscribers touched)

> ⚠️ Do every check below in **dry-run** mode. Only flip to live after all green.

```bash
# 1. Log in to prod back-office
curl -sk -c /tmp/prod_c.txt -X POST https://putkihq.fi/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$PROD_BACK_OFFICE_TOKEN\"}"

# 2. Verify cookie session works
curl -sk -b /tmp/prod_c.txt https://putkihq.fi/api/admin/auth/whoami
# Expected: {"authed":true, ...}

# 3. Verify composer endpoints respond
curl -sk -b /tmp/prod_c.txt "https://putkihq.fi/api/admin/dispatch/drafts?type=weekly" \
  -w "\nHTTP:%{http_code}\n"
# Expected: HTTP:200, {"drafts":[],"count":0}

# 4. WEEKLY dry-run fire (zero emails sent)
curl -sk -b /tmp/prod_c.txt -X POST https://putkihq.fi/api/admin/dispatch/fire \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly","fields":{"week_no":"PROD-SMOKE","headline_pre":"Prod","headline_ember":"smoke","summary":"deploy verification","articles":[],"sign_off":"-A"},"channels":["email"],"confirm":true,"dry_run":true}' \
  -w "\nHTTP:%{http_code}\n"
# Expected: HTTP:200, outcome.weekly.kind=='weekly_cycle', dry_run==true,
#           eligible_total = real prod subscriber count
```

If the eligible_total looks sane (~500ish), proceed.

---

## Step E — In-product smoke fires (Step D went green)

Open `https://putkihq.fi/back-office/dispatch` in your browser.

1. **Daily tab**:
   - Compose a daily draft using whatever today's Mittari state is.
   - Click **"Send test to me"** (⌘↵).
   - Verify in your Gmail: subject lands, hero image renders, body text correct, **"Unsubscribe" button visible next to sender name**.
   - Click the Gmail Unsubscribe button. Then immediately re-subscribe via `/aloita` or the back-office to undo (so your own future test fires still reach you).
   - Verify your Telegram (chat_id 909303651) receives the DM.

2. **Weekly tab**:
   - Compose a weekly draft (eyebrow + headline + summary + 0 articles is fine for the smoke).
   - Set **scheduled_for = next Sunday's date** (YYYY-MM-DD) and save the draft.
   - Click **"Send test to me"**.
   - Verify Gmail receives the weekly-formatted email (different visual treatment than daily). **No Telegram for weekly — that's by design.**

3. **DO NOT click "Send to list" yet.** Tell me once Steps D+E pass.

---

## Step F — Watchdog verification (optional but high-confidence)

To verify the ops watchdog DMs fire correctly **without waiting for an actual silent-skip**:

```bash
# Force a "no weekly draft" scenario via run_weekly_dispatch direct call.
# This writes a real skip row + fires a real DM.

cd /app/backend && python3 -c "
import os, asyncio
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
from dispatch_daily import run_weekly_dispatch, _today_ymd

async def m():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    today = _today_ymd()
    # Clear any prior alert for today so this fires fresh
    await db.dispatch_ops_alerts.delete_many({'alert_key': f'{today}::weekly_no_draft'})
    # Make sure NO weekly draft is scheduled for today
    await db.dispatch_drafts.delete_many({'type': 'weekly', 'scheduled_for': {'\$regex': f'^{today}'}})
    res = await run_weekly_dispatch(db, dry_run=True, draft_override=None)
    print('result:', res)

asyncio.run(m())
"
# Expected: Telegram DM to chat_id 909303651 saying
#   'Sunday weekly: no draft scheduled, skipped silently at...'
```

If the DM lands, watchdog is live. Same can be done for `daily_state_gate_closed` by setting Mittari to KYLMA and triggering the daily worker — but that's not needed for deploy verification (the code path is the same `_ops_alert()` helper, just a different reason key).

---

## Step G — Cron verification (final check)

Check backend logs on prod after restart for the worker-armed log line:

```
dispatch worker armed: daily=10:00 weekly=Sun-08:00 Europe/Helsinki
```

```bash
# from prod pod
tail -n 100 /var/log/supervisor/backend.err.log | grep "dispatch worker armed"
```

If you see that line: both crons are live in prod. The daily will silent-skip until Mittari is hot (with a DM to you). The weekly will silent-skip every Sunday until you compose a draft (with a DM to you).

---

## Bounce / reputation question (from your previous report)

I dug the **preview** `dispatch_log` since 2026-05-19:

| Date | email OK | email ERR | telegram OK | sms OK |
|---|---:|---:|---:|---:|
| 2026-06-05 | 231 | 0 | 1 | 2 |
| 2026-06-04 | 1480 | **97** | 27 | 0 |
| 2026-06-01 | 228 | 3 | 0 | 2 |
| 2026-05-27 | 2015 | 0 | 57 | 18 |
| 2026-05-26 | 14445 | 0 | 81 | 162 |
| 2026-05-22 | 1043 | 0 | 1 | 18 |
| 2026-05-19 | 5611 | 0 | 114 | 228 |

**Every single ERR row is `provider_429: rate_limit_exceeded`** — Resend's rate limiter. **Zero bounces, zero reputation hits, zero `bounced` / `complained` / `dropped` strings in the entire log.**

429 means Resend refused the request → email never left the building → no bounce, no complaint, no reputation impact. The 250ms pacing + 1.2s backoff added in iter97g is the fix; it's already in the codebase you're about to deploy.

**However** — bounces are tracked async via Resend's webhooks, which we don't ingest yet. So I can't see post-delivery bounces from the dispatch log alone. **To get full reputation visibility:**

1. Log into the Resend dashboard at https://resend.com/emails
2. Filter by `From: signals@putkihq.fi`, last 30 days
3. Check the **Bounce** and **Complaint** columns. If both are <0.5%, you're clear.
4. If either is >2%, do a slow warm-up: send to 50 most-engaged subscribers first, then 200, then full list across 3 days. Otherwise, full-list fire is safe.

The 523 you mentioned: I see 1480 successful + 97 rate-limited on 2026-06-04. That's the pre-domain-verification fanout. Since they were 200s, recipients DID receive them — but from the un-verified domain those emails may have routed to Gmail's "Promotions" tab or been silently filtered (no Gmail reputation hit, just lower open rates). Now that `putkihq.fi` is verified, future sends inherit the verified-domain trust → strictly better.

---

## If anything goes wrong

- **Production composer 404 after deploy** → `.env` change didn't take effect or supervisor didn't restart. Run `sudo supervisorctl restart backend` on prod pod, then re-curl `/api/admin/dispatch/drafts`.
- **Cookie auth fails (401 on whoami)** → prod `JWT_SECRET` mismatch with cookie's signing secret. Verify the prod `JWT_SECRET` env value didn't get re-rolled during deploy. If it did, the dev needs to re-login.
- **`eligible_total` is 0 on dry-run weekly fire** → prod DB has no `optin_consents` (different schema than preview) OR all have `status: 'unsubscribed'`. Check via direct mongo query.
- **No worker-armed log line** → `DISABLE_WORKER=1` is set in prod env. Remove it.
- **Daily silent-skips every day without DM** → ops watchdog dedupe key is sticky. Clear via:
  ```python
  await db.dispatch_ops_alerts.delete_many({})  # nukes alert history, watchdog will re-fire
  ```

---

## Roll-back

If anything bricks after deploy: in the Emergent deploy panel, click "Rollback to previous deployment." The whole pre-iter97j codebase comes back instantly. No DB changes are destructive — `dispatch_ops_alerts` is a new collection (empty on prod until first alert), `bot_config` updates are upserts (idempotent), the 3 toggles in `settings` are new keys (don't affect anything that doesn't read them).

---

**Owned by**: Dioni (you click the buttons) + the agent (prep'd the artifacts).

**When you're done with Steps A–E, ping me.** I'll then walk you through your first real editorial dispatches.
