# PUTKI HQ — Operator's Runbook

One-page playbook for running the funnel from `/back-office/bot-routing`.
Read this once. Refer to the **Cookbook** when something looks off.

---

## 0 · Where to log in

- **Dashboard**: `https://putkihq.fi/back-office/bot-routing` (or the active preview URL)
- **30-day history**: `https://putkihq.fi/back-office/funnel`
- **Admin token**: see `/app/memory/test_credentials.md`. The page remembers it in `localStorage` after the first unlock.

---

## 1 · The daily ritual (5 minutes)

Each morning around **09:30 EET** (30 min after the daily cron):

| Check                       | Where                                                 | What "healthy" looks like                                  |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Subscriber growth           | Top strip — TOTAL SUBS vs. yesterday's screenshot     | Trending up week-over-week                                 |
| Today's dispatch fired      | Funnel snapshot → **DM SENT** cell                    | `> 0` (or `+N DRY-RUN` if `daily_dm_enabled` is still off) |
| Mini App engagement         | Funnel snapshot → **MINI APP OPEN** ≥ ~30% of DM SENT | Click the cell → distinct `tg:` rows                       |
| Router producing real picks | Router activity → CLICKS table                        | Status mostly `ok` in routed mode, `informative_mode` else |
| 30-day trend                | "30D HISTORY →" link                                  | Trailing 7d end-to-end rate flat or climbing               |

If anything looks off → jump to the **Cookbook (§4)**.

---

## 2 · The 4 master switches

All live in the **Bot config** section. One PUT per click, no deploy needed.

### 2.1 Flip informative → routed (monetisation ON)

Prereqs:

1. At least **one partner row** in the Affiliate partners table with `status=LIVE`.
2. That partner's `target_geos` must cover the geos you expect (use `FI` for a Finland-only beta).
3. Smoke-test first: hit **MINT LINK** on the dashboard, click "OPEN IN NEW TAB" — you should land on the partner URL (not `/mittari`).

Then flip:

- `signal_unlock_mode` → **ROUTED**
- (Optional) `require_verified_signup` → **STRICT** (default; keeps `/start` gated to the website signup flow)

The Mini App immediately starts showing "Open partner →" on locked cards. The router stops 302-ing to `/mittari` and starts handing traffic to the partner.

### 2.2 Rollback (kill switch)

One click: `signal_unlock_mode` → **INFORMATIVE**.

Effects (all instant, no deploy):
- All `/api/r/{code}` requests 302 to `/mittari` regardless of code or geo.
- Mini App unlock CTAs flip back to "Reveal in-app".
- Click history is preserved in `redirect_click_log` for the post-mortem.

### 2.3 Turn on daily DM dispatch

- `daily_dm_enabled` → **ON**

The next dispatch-window tick at **09:00 EET** will fire `fanout_daily_dms` live for every `mittari_subscriber` with `status=active` + bound chat_id. Each DM is segment-filtered and idempotent per UTC date.

To smoke-test before flipping live:

- `POST /api/admin/bot/dispatch/preview` (always dry-run, no lock side effects)

### 2.4 Adjust the broadcast floor

`sharpness_min` (default 70) gates which picks ride the channel broadcast + the per-subscriber DMs. Raise it to send fewer/sharper, lower for higher volume.

---

## 3 · Partner management

### 3.1 Add a partner

In the Affiliate partners section, fill the inline row:

| Field                | Example                                  | Notes                                              |
| -------------------- | ---------------------------------------- | -------------------------------------------------- |
| `partner_key`        | `winz-fi`                                | Lowercase slug, no spaces. Becomes a stable URL ID |
| `display_name`       | `Winz Finland`                           | Internal label                                     |
| `affiliate_base_url` | `https://aff.winz.fi/?c={code}&s={subid}` | `{code}` and `{subid}` get substituted at click   |
| `target_geos`        | `FI,EE`                                  | CSV of ISO-2 codes. Empty = global                 |
| `priority_weight`    | `50`                                     | Higher wins ties for the same geo                  |

Save → row appears in the table with `status=LIVE` immediately.

### 3.2 Pause a partner without losing history

Click **PAUSE** on the row. The router skips them but every prior click + conversion stays queryable.

### 3.3 Delete

Click **DEL**. Idempotent — safe to retry. Does not delete historical `redirect_click_log` rows.

---

## 4 · Cookbook (if you see X, check Y)

### "No signups landing in the last 24h"

1. Bot config → confirm `require_verified_signup` matches the source (STRICT means `/signup` is the only legitimate entry).
2. Open `/signup` directly → confirm the form submits + returns a `pending_id`.
3. Drill into **SIGNUP** cell → look at `accept_language` distribution; if EVERY row is `?` or blank, traffic might be coming from a bot.

### "Signups happen but BOUND stays at 0"

The Telegram deep link isn't binding. Likely culprits:

1. `TELEGRAM_BOT_TOKEN` is empty in `/app/backend/.env` → the bot stops processing `/start`.
2. Telegram webhook URL is stale → check `/back-office/telegram` → "Webhook · bound chats · audit log".
3. `require_verified_signup=STRICT` AND someone is testing with a synthetic pending_id → expected; use `/signup` to mint a real one first.

### "DM SENT shows 0 + N DRY-RUN every day"

`daily_dm_enabled` is OFF. The cron is firing in dry-run mode (safe, no lock written). Flip §2.3 when ready.

### "Mini App opens are flat"

Drill into the **MINI APP OPEN** cell. If you see DMs going out but no opens:

1. Are recipients on iOS Telegram < v8.x? Mini Apps require modern clients.
2. The DM CTA URL may be wrong — env `TELEGRAM_TMA_APP_NAME` must match the @BotFather "newapp" short name. If unset, falls back to the `/tma?pid=` web URL (still works, just less native).

### "Router clicks show `no_partner_for_geo` for every row"

Open the partners table. Either:

- No LIVE partner has `target_geos` covering the click geo (CF-IPCountry header reports), OR
- All LIVE partners are paused.

Add a partner with `target_geos=FI` (or empty for global) → recheck.

### "Conversions show `verified: ✗`"

The partner is sending postbacks but the secret doesn't match. Open `/api/admin/partners` row for that partner → set `postback_secret` to the value the partner is sending (`X-Postback-Secret` header / `secret` field / `?secret=` query — first match wins). Existing unverified rows are kept for reconciliation.

### "30D end-to-end rate trending DOWN"

Open the daily-volume bars on `/back-office/funnel`. The shortest bar in the stack is your bottleneck:

- Short **signup**: marketing / SEO problem, not platform.
- Short **bound**: deep link UX issue or bot is rate-limited (Telegram caps bots at ~30 msgs/sec).
- Short **dm_sent**: probably `daily_dm_enabled` off, or zero-pick days.
- Short **tma_open**: clients on stale Telegram versions, or DM copy needs work.
- Short **unlock_click**: card design / locked-CTA copy issue.

---

## 5 · External dependencies (still pending)

| Service            | Status              | What you need to do                                                        |
| ------------------ | ------------------- | -------------------------------------------------------------------------- |
| YouTube Data API   | quota exceeded      | Bump GCP quota in console or rotate `YOUTUBE_API_KEY` in `/app/backend/.env` |
| Resend (email)     | MOCKED              | Verify a domain at resend.com → drop `RESEND_API_KEY` + `RESEND_FROM` in `.env` |
| BotFather Mini App | not registered      | `/newapp` on @BotFather → point at the deployed `/tma` URL → set `TELEGRAM_TMA_APP_NAME` |

None of these block the funnel from operating — they each unlock one specific surface (YouTube tile, email channel, native-feel Mini App).

---

## 6 · Quick reference

### Key URLs

| URL                                | What                                       |
| ---------------------------------- | ------------------------------------------ |
| `/signup`                          | Public capture form                        |
| `/tma`                             | Mini App (also embedded in Telegram)       |
| `/back-office/bot-routing`         | This dashboard                             |
| `/back-office/funnel`              | 30-day history                             |
| `/back-office/streamers`           | Streamer audit + bulk resolver             |
| `/back-office/telegram`            | Webhook config + audit log                 |

### Key endpoints (all admin-gated)

| Method | Path                                          | Purpose                              |
| ------ | --------------------------------------------- | ------------------------------------ |
| GET    | `/api/admin/bot/config`                       | Read master switches                 |
| PUT    | `/api/admin/bot/config`                       | Flip them                            |
| GET    | `/api/admin/bot/funnel/snapshot?hours=N`      | Live ladder                          |
| GET    | `/api/admin/bot/funnel/history?days=N`        | Per-day buckets                      |
| GET    | `/api/admin/bot/funnel/drilldown?stage=`      | Rows behind a stage                  |
| GET    | `/api/admin/router/clicks`                    | redirect_click_log tail              |
| GET    | `/api/admin/router/conversions`               | conversions tail                     |
| POST   | `/api/admin/links/mint`                       | New router code                      |
| POST   | `/api/admin/bot/dispatch/preview`             | Dry-run DM fan-out                   |
| POST   | `/api/admin/bot/dispatch/run`                 | Live DM fan-out                      |
| GET    | `/api/admin/subscribers/lookup?q=`            | Quick-find by email / chat_id / pid  |

### Key env vars (`/app/backend/.env`)

| Var                       | Required for                                  |
| ------------------------- | --------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | Bot `/start` binding · DM sending · Mini App HMAC |
| `TELEGRAM_BOT_URL`        | Deep-link base (default `https://t.me/Putkihq_bot`) |
| `TELEGRAM_TMA_APP_NAME`   | Native Mini App URL format (else fallback `/tma?pid=`) |
| `YOUTUBE_API_KEY`         | YouTube streamers band                        |
| `RESEND_API_KEY` + `RESEND_FROM` | Welcome / tournament emails              |
| `PUTKI_HQ_ADMIN_TOKEN`    | Back-office auth                              |
| `PUTKI_HQ_SITE_URL`       | Router fallbacks                              |
| `MONGO_URL` + `DB_NAME`   | Database                                      |

### Status verbs (router)

| Status                | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `ok`                  | Routed to a LIVE geo-eligible partner. The only "real click"  |
| `informative_mode`    | Router is in informative mode — 302'd to `/mittari`           |
| `no_partner_for_geo`  | Code exists, but no LIVE partner covers the request's geo     |
| `unknown_code`        | Code not in `link_codes` (stale or never minted)              |
| `blocked`             | Reserved for future abuse-filter status                       |

---

*Last updated: iter76h · 2026-05-27. Maintained alongside `/app/memory/PRD.md`. If you change a workflow, update this file in the same commit.*
