# Mittari.fi — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site
- **Phase 1.5 / 1.6 / 1.7** (2026-02) — cockpit-instrument elevation, bilingual FI/EN, visual energy
- **Phase 2.0** (2026-05) — Liveness layer (activity feed, breathing dial, social-proof)
- **Phase 2.5** (2026-05) — Page-by-page completion (autoplay previews, Streamer profile, Weezy Rally)
- **Phase 2.6 Batch A** (2026-05) — Topi removal, intl streamer expansion, Smartico Visitor Mode shell
- **Phase 3 Foundation Slice + Batches 3A / 3B / 3C** (2026-05) — Real signal pipeline, dial recalc engine, distribution fanout, full surface cleanup

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + html2canvas
- Backend: FastAPI + Motor (async MongoDB) + httpx (signal adapters)
- DB: MongoDB collections — `signups`, `predictions`, `settings`, `game_scores`, `signals`, `dial_snapshots`, `generated_content`, `published_content`, `editorial_guidelines`, `distribution_log`
- Auth: Public site has none; /back-office + /back-office/queue gated by `BACK_OFFICE_TOKEN`; game personalisation via cookie_id
- i18n: LanguageContext FI default + EN
- Background worker: `_signal_dial_worker` polls all signal sources and recomputes dial every `SIGNAL_POLL_INTERVAL` (default 90s); disable with `MITTARI_DISABLE_WORKERS=1`

## Phase 3 — What's been built (2026-05)

### Foundation Slice (already shipped)
- Claude content engine (`content_engine.py`) using Emergent universal LLM key
- 6 content types: moment_commentary, sports_take, streamer_observation, operator_update, activity_feed_event, dial_state_change
- Editorial guidelines registry (back-office editable, seeded on startup)
- BackOfficeQueue UI (`/back-office/queue`) with token auth, generate via Claude, 3-variant select, edit-before-publish, kill, guidelines modal

### Batch 3A — Signal pipeline foundation
- `signal_engine.py` with 6 source adapters (twitch / kick / youtube / forum / sports / internal). Real polling activates when env keys present, otherwise emits MOCKED-tagged signals.
- Normalised `Signal` schema with TTL-based expiry (default 120m) auto-trimmed each poll
- Adapter env keys: `TWITCH_CLIENT_ID/SECRET`, `YOUTUBE_API_KEY`, `FORUM_SCRAPER_URL`, `SPORTS_API_KEY`. Kick public API hit live (no auth).
- New endpoints: `GET /api/admin/signals?source=&limit=`, `POST /api/admin/signals/poll`

### Batch 3B — Dial recalc engine
- `dial_engine.py` computes weighted composite from 5 categories (streamers 35 / sports 20 / youtube 15 / forum 15 / internal 10 + bonus 5)
- Maps composite to KYLMA / HAALEA / KUUMA / MYRSKY / KIIRASTULI per spec thresholds
- Snapshot persisted to `dial_snapshots` (last 500 retained)
- `/api/dial` + `/api/cockpit` now read latest snapshot (with static fallback for first boot)
- New endpoint: `GET /api/admin/dial/history?limit=`

### Batch 3C — Distribution pipeline
- `distribution.py` with `fanout(db, generated_content, text)` orchestrator
- Channels: site (always), archive, telegram (env: `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHANNEL_ID`), email (env: `RESEND_API_KEY`+`RESEND_FROM`), x_twitter (stub), web_push (stub), shareable_card (deferred)
- Every approve writes per-channel results to both `published_content.distribution_results` and `distribution_log`
- Mocked channels report `status='mocked', mocked=true` cleanly when env vars absent
- CONTENT_TYPES updated: `moment_commentary` fans out to site+archive+telegram; `sports_take` to site+telegram+email; `operator_update` to site+archive+telegram+email

### Surface cleanup (full editorial honesty)
- `OperatorReview.jsx` — partner gating (`operator.slug === 'weezybet'`):
  - Live data strip → only weezybet; non-partners see "EI REAALIAIKAISTA SEURANTAA / Mittari ei seuraa tämän operaattorin reaaliaikaista dataa"
  - Tarjous bonus block, hero CTA, bottom CTA, sticky mobile CTA → all gated to weezybet only
  - Non-partners get "VAIN TOIMITUKSELLINEN ARVIO / EDITORIAL ASSESSMENT ONLY" notice instead
- `LiveTilesGrid.jsx` — fake balances removed (Phase 3 foundation)
- DialCockpit Home — Pääsyy / PRIMARY DRIVER + Viimeisin piikki / LATEST SPIKE chips backed by `/api/cockpit`

### Batch 3D — Smartico Voyager (loader auto-injection)
- Settings extended: `smartico_loader_url` + `smartico_brand_key` (in addition to existing `smartico_template_id`)
- `/back-office` UI shows three Smartico inputs (template_id, loader URL, brand key)
- `/voita-palkinto` auto-injects `<script src={loader_url} data-mittari-smartico="1" data-smartico-brand-key={brand}>` once both template_id + loader_url are set; the existing `#smartico-visitor-mode[data-template-id]` div is auto-discovered by the SDK
- Idempotent — guards against double-injection via `querySelector('script[data-mittari-smartico="1"]')`
- Cleanup on component unmount

### Signal Pipeline Status widget (operational observability)
- New `SignalPipelineStatus` panel on `/back-office/queue`
- 6 source tiles (twitch / kick / youtube / forum / sports / internal) showing recent count + REAL/MOCK/TOTAL split + LIVE/MOCKED tag
- 30s auto-refresh + manual `FORCE POLL →` button hitting `/api/admin/signals/poll`
- Border colour reflects state (green=live, grey=mocked-only, dim=empty)

### Test coverage (iteration 8)
- 51 backend pytest passing (46 from iter_7 + 5 new TestSmarticoVoyagerSettings)
- Frontend brief checks all PASS — Batch 3D loader injection verified via DOM query
- 0 page errors / 0 critical console errors

## Prioritized backlog

### P0 — Phase 3 next sessions
- **Real API key wiring** — once user supplies Twitch / YouTube / Telegram / Resend / VAPID creds, signal pipeline + distribution flip from mocked to live with zero code changes. Smartico SDK also activates once `smartico_loader_url` is set in /back-office.
- **Streamer auto-discovery worker** — flag candidate streamers by viewer count + content match
- **Push web notifications** — VAPID + per-subscriber DB

### P0 — Phase 2.6 Batch B (deferred)
- 4 surface placements: right-rail, homepage horizontal, operator featured-offer, sponsored ranking
- Mandatory `KAUPALLINEN YHTEISTYÖ` / `KAUPALLINEN SIJOITTELU` labels
- Back-office banner CRUD + click tracking + A/B variant + preview

### P1
- ErrorBoundary around CockpitContext + similar polling components (per iter_7 RCA)
- Mongo → Postgres migration for time-series signal data (per Phase 3 brief)
- Personalization layer (cookie-based returning-user state)
- Casino ranking page (#1 hero, micro-stats, expand to 25-30 ops)
- Weekly Card upgrades — deeper-take expanders, live match status, odds movement
- Methodology page upgrades — 70/30 visualization, score-waterfall, change log
- Signup flow compression to single-field magic-link

### P2
- Licensed Finnish operator partner onboarding
- CPA monetisation activation
- Pydantic HttpUrl validation on telegram_channel
- index.html title fix ("Emergent | Fullstack App" → Mittari-branded)
- data-testid='leaderboard-table' wrapper on /peli

## Test credentials
- See `/app/memory/test_credentials.md`

## Next tasks
1. Wire real API keys (Twitch, YouTube, Telegram, Resend, Smartico SDK URL) once user supplies them — pipeline flips from mocked to live with zero code changes
2. Phase 2.6 Batch B — Banner revenue infrastructure (4 surfaces + back-office CRUD + commercial labels)
3. ErrorBoundary around CockpitContext + similar polling components (P1 hardening per iter_7 RCA)
4. Streamer auto-discovery worker
