# PUTKI HQ — PRD

## Phase History (latest first — see CHANGELOG for full list pre-Phase 5)

- **Phase 5.4 — Back-office /peli cleanup** (2026-05-18) — Editor's direct request from walkthrough.docx.
  - Removed `prize_amount` input + `prize_currency` input from `/back-office/peli` admin form.
  - Removed `youtube_id` input per video from `/back-office/peli` admin form (kept title + caption).
  - Backend: `peli_raffle.py` — `VideoConfig` model no longer accepts `youtube_id`; `PeliConfigUpdate` no longer accepts `prize_amount`. `_DEFAULT_CONFIG` seed cleaned (`youtube_id` dropped from videos array).
  - Public `_public_view` retains `prize_amount` key (returns None) for backward compat; `Peli.jsx` falls back to `prize_label` when `prize_amount` is falsy.
  - Tests updated: `tests/test_iter19_peli_raffle.py` no longer asserts `prize_amount` in PUT response nor `youtube_id` in video shape. **18/18 pytest pass.**
  - Frontend smoke: admin form correctly shows only `prize-label`, partner fields, video title/caption, enabled toggle, save.

- **Phase 5.3.5 — PizzINT-Style News Presentation System** (2026-05-18) — Editorial conversion redesign.
  - **DialSubscriptionCTA** (`components/DialSubscriptionCTA.jsx`) — contextual alert signup pill attached *below* the WIN PULSE dial (Dial design preserved verbatim per user order).
  - **LiveDeskHeader** (`components/LiveDeskHeader.jsx`) — wire-service-style header on `/uutiset` with 24h stats (articles published, severity counts) from `GET /api/content/stats`.
  - **NewsCard** (`components/NewsCard.jsx`) — 4-tier severity cards (Scorching · Hot · Warm · Cool) computed server-side by `newsroom.compute_severity()` (read_count, source_count, decay window).
  - **FilterChips** (`components/FilterChips.jsx`) — Category + Entity filter pills wired to `GET /api/content/top-entities`.
  - **TopicHubPage** (`pages/TopicHubPage.jsx`) — entity-specific feeds at `/striimaajat/:slug`, `/urheilijat/:slug`, etc. via `GET /api/entities/{type}/{id}`.
  - **POST /api/subscribe/dial-alerts** — conversion endpoint capturing email + trigger preference for dial-state alerts.
  - testing_agent_v3_fork iter22: 100% pass.

- **Phase 5.2 — Walkthrough.docx remediation** (2026-05-18) — Weekly Card 4-step "How it works", Tips Telegram conversion modal, per-article view counts, streamer roster expanded 29→81, Winners Corner reseeded with real historical hits, footer cleanup.

- **Phase 5.1 — WIN PULSE rebrand** (2026-05-18) — Perkele-Mittari → WIN PULSE (EN); 5 dial states mapped to luck-vocabulary (DRY/SLOW/WARM/RUSH/JACKPOT). Hero eyebrow → "Helsinki". SocialProofBar streamer count live-wired. Most-Read Rail under the dial.

- **Phase 5 — Launch pivot: media-company positioning** (2026-05-18) — 28-point walkthrough.docx ship:
  - Legal messaging pivot: all 18+ / responsible-play copy replaced with "FOR ENTERTAINMENT PURPOSES ONLY · NO BETTING ACTIVITY TAKES PLACE".
  - /peli rebuilt as Weezybet raffle (no Smartico SDK).
  - Dial 0-streams bug fixed (`language=fi` instead of global top 100).
  - Homepage "What is PUTKI HQ?" 3-pillar section.
  - Content backfill engine + Twitch auto-discovery.

(See `/app/memory/CHANGELOG_pre_phase5.md` if needed — Phase 1 → Phase 4 history archived in earlier PRD versions in git.)

## Prioritized backlog

### P1 — Blocked on user
- **Content backfill (100–150 articles)** — paused; Universal Key budget hit $18.40. User to top up balance, then run `POST /api/admin/content/backfill {count:50, days:60}` 2-3 times.

### P1 — Editorial-pending
- **Winners Corner refresh** — replace placeholder entries via `/back-office/winners` when first real settled tip lands.
- **Kick API Cloudflare block** — backend marks dormant; restore when API/proxy access works.

### P2 — Post-launch enhancements
- SSE for real-time news updates (PizzINT polling currently @ 60s).
- Saved filter preferences + article bookmarking.
- Full Kick + YouTube streamer integration when API keys clear.
- Refactoring sprint: split `content_generator.py` (high cyclomatic complexity), break `BackOfficeWebhooks.jsx` (600+ lines).

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + Motion + i18n (FI/EN via `LanguageContext`)
- Backend: FastAPI + Motor (async MongoDB) + httpx + emergentintegrations (Claude Opus 4)
- Workers: layer2_workers (Twitch 60s · F1 · Football · NHL · Reddit · RSS), seed_scheduler (3600s), twitch_discovery (6h), youtube_lease_worker (6h)
- Collections: `published_content`, `subscriptions`, `article_views`, `peli_entries`, `peli_meta`, `weekly_meta`, `weekly_picks`, `winners`, `streamers`, `operators`, `signals`, `dial_snapshots`, `foundational_research`

## Test credentials
- See `/app/memory/test_credentials.md`
