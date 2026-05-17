# Mittari.fi — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site
- **Phase 1.5 / 1.6 / 1.7** (2026-02) — cockpit-instrument elevation, bilingual FI/EN, visual energy
- **Phase 2.0** (2026-05) — Liveness layer (activity feed, breathing dial, social-proof)
- **Phase 2.5** (2026-05) — Page-by-page completion (autoplay previews, Streamer profile, Weezy Rally)
- **Phase 2.6 Batch A** (2026-05) — Topi removal, intl streamer expansion, Smartico Visitor Mode shell
- **Phase 3 Foundation Slice + Batches 3A / 3B / 3C / 3D** (2026-05) — Signal pipeline, dial recalc engine, distribution fanout, Smartico Voyager loader, signal status widget
- **Phase 3 V2 — Batch 3A V2** (2026-05) — Master Brief V2: voice register Complex×GQ×Bloomberg, 19 content types, 21 new public route shells, editorial accountability footer, surface cleanup honesty pass
- **Phase 3 V2 — Source Map + Editorial Seed Scheduler** (2026-05-16) — §4.1 named source map (28 sources) + foundational_research store + cadence-driven scheduler + LLM-502-tolerant variant filler
- **Phase 3 V2 — UI Honesty Pass** (2026-05-16) — Killed all fake-live-data UI manufacturing per V2 brief
- **Phase 3 V2 — Final Architecture Step 1: Mock Purge** (2026-05-17) — Repo now mock-free. Operators + streamers as real backend collections with admin CRUD.
- **Phase 3 V2 — Final Architecture Step 2: Webhook signal handlers** (2026-05-17) — Twitch EventSub / Kick / YouTube PubSubHubbub webhook receivers shipped, dormant-503 when secrets unset, full HMAC verification + replay dedup, 16 pytest cases green.
- **Phase 3 V2 — Final Architecture Step 4: Live-feed aggregation** (2026-05-17) — `feed_items` collection + aggregation worker (60s rebuild) + public `GET /api/feed` (mocked filtered) + admin `/api/admin/feed{,/rebuild}` + 14 pytest cases green.
- **Phase 3 V2 — Final Architecture Step 5: Hub homepage rewrite** (2026-05-17) — Compact top strip (dial top-left, Voyager top-right), 5-card live mosaic (Streamerit live, Urheilu nyt, Tuoreet hetket, Foorumit kuumana, Mittari live) with 30s poll, Zone 3 publication-depth (8 pillars), Pulssi + Operaattoritapahtumat HIDDEN, accountability footer. `/back-office/webhooks` operational console (per-source state, PubSub lease indicator, force-resubscribe button) shipped.

## Phase 3 V2 — Architecture-only Track (this session)

### §4.1 Named Finnish source map — SHIPPED
- 28 named editorial sources seeded on boot into `tracked_sources` (idempotent)
- Categories: regulatory, betting_discourse, sports_media, streamer_data, esports, culture, operator_signal
- Public endpoint `GET /api/sources/public` returns grouped-by-category map (used by /lehdisto)
- Admin endpoint `GET /api/admin/sources?category=` for filtering
- /lehdisto now surfaces the full source map with tier indicators + notes

### Foundational research store — SHIPPED (empty by design)
- New collection: `foundational_research`
- Schema: `{topic_area, beat, sub_beat, editorial_angle, key_facts[{fact, source_attribution, verified_date, confidence, url}], named_sources_cited[], applicable_content_types[], freshness_window_days, active, last_updated}`
- 10 valid beats: regulatory, sponsorship, scene, money, culture, game_literacy, industry, international, lifestyle, streamer
- Content type → beat mapping in `CONTENT_TYPE_TO_BEATS`
- Optional file loader: drops at `/app/backend/data/foundational_research_v02.json` are auto-ingested on boot
- Back-office UI at `/back-office/foundational-research` — CRUD + bulk JSON import + filters
- Endpoints: `GET|POST` `/api/admin/foundational-research`, `GET|PUT|DELETE /api/admin/foundational-research/{id}`, `POST /api/admin/foundational-research/bulk`

### Editorial seed scheduler — SHIPPED (sits quiet until research populated)
- New module: `seed_scheduler.py`
- 11 default cadences seeded into `settings.editorial_cadences` (hot-editable via API)
  - regulatory_update Mon · sponsorship_update Wed · lifestyle_gambler_profile Fri (biweekly) · scene_news Mon/Wed/Fri · industry_business_analysis Thu · streamer_observation Tue/Fri · money_commentary Tue · game_literacy Sat (rotating sub-page) · cultural_feature Fri (biweekly) · bonus_mathematics Sat (monthly) · international_research_synthesis Thu (monthly)
- Hourly background worker (configurable via `SEED_SCHEDULER_INTERVAL_SECONDS`)
- Honesty guard: **refuses to fire** when `foundational_research` pool is empty for the beat → returns `skipped` with reason `no_foundational_research`
- LLM-502 tolerance: on Claude failure, parks a `status=awaiting_variants` row with topic frozen. Variant filler retries every 15min (`SEED_VARIANT_FILLER_INTERVAL_SECONDS`)
- Disable via `MITTARI_DISABLE_SCHEDULER=1`
- Endpoints: `GET|PUT /api/admin/scheduler/cadences`, `GET /api/admin/scheduler/status`, `POST /api/admin/scheduler/tick`, `POST /api/admin/scheduler/fill-variants`
- Hard 45s timeout on Claude calls (prevents event-loop hang during gateway flake)

### Back-office Queue extensions — SHIPPED
- Schedule status widget: per-cadence due/overdue + research-pool size + force-fire button per content type
- Content-type filter in queue listing
- Existing Signal Pipeline Status widget retained
- Cross-links to /back-office/foundational-research and /back-office/queue from /back-office

### Mittari voice prompt — Finnish-language source directive added
- Voice prompt extended with explicit "Bloomberg-in-Finnish, not Bloomberg-translated" directive
- Prefers Finnish-language foundational_research sources
- Native Finnish editorial syntax + idiom, not translated English
- Seed function now refreshes the voice prompt text on boot **only** if `updated_by == 'seed'` (preserves admin edits)

## Final Architecture — Step 2 Webhook Signal Handlers (this session)

Per `mittari-fi-FINAL-ARCHITECTURE.md` §6.1 / §8 Step 2.

### Backend
- New module `webhooks.py` (~350 lines) — three webhook receivers normalising into the existing `signals` collection with `ingress="webhook"`, `mocked=false`
  - `POST /api/webhooks/twitch` — Twitch EventSub HMAC-SHA256 over (msg_id+ts+raw_body), ±600s timestamp skew enforcement, supports `webhook_callback_verification` (challenge handshake), `notification`, and `revocation` message types
  - `POST /api/webhooks/kick` — HMAC-SHA256 over raw_body (canonical pattern; KICK_SIGNATURE_HEADER + KICK_WEBHOOK_SECRET env-configurable so we can flip to public-key when Kick docs finalise)
  - `GET|POST /api/webhooks/youtube/pubsub` — PubSubHubbub: GET handles hub.mode subscribe/unsubscribe challenge; POST verifies HMAC-SHA1 over body and parses atom xml for video_id/channel_id
  - `GET /api/webhooks/status` — back-office surface: per-source configured flag + last webhook signal + callback URLs
- Replay protection: new `webhook_message_ids` collection with TTL index `ttl_first_seen` (expireAfterSeconds=600); duplicate message_ids silently acknowledged with 200
- Dormant 503 contract: when `TWITCH_EVENTSUB_SECRET` / `KICK_WEBHOOK_SECRET` / `YOUTUBE_PUBSUB_SECRET` env vars are unset, endpoints return 503 instead of throwing or fabricating accepts — honest editorial empty state
- Router mounted under `/api/webhooks` via `api_router.include_router(build_webhook_router(db))` in server.py
- TTL index creation hooked into existing `_seed_phase3` startup event

### Test coverage
- New `tests/test_phase3_v2_step2_webhooks.py` — 16 pytest cases using FastAPI TestClient with secrets injected via env: Twitch challenge handshake, valid notification → DB write, signature mismatch (403), missing headers (403), replay dedup; Kick valid/mismatch/missing-sig; YouTube GET challenge + invalid GET (400); YouTube notification write; YouTube bad signature → 202 silent (per WebSub spec); 503-when-secrets-unset for all three sources
- All 16 pass · Full backend regression: 98/98 green (LLM-gated test_phase3a_v2_content.py skipped per handoff)
- Lint clean (`ruff check`)
- Live supervised backend verified: dormant 503 on all webhook POSTs (no secrets in prod env), status endpoint serves correctly under `/api/webhooks/status`, 6 regression public endpoints all 200

## Final Architecture — Step 1 Mock Purge (prior session)

Per `mittari-fi-FINAL-ARCHITECTURE.md` §8 Step 1.

### Backend
- New module `rosters.py` — operators + streamers registries with idempotent seed (lifted from `data/mock.js` as editorial fact per user direction)
- 12 operators seeded · 27 streamers seeded (FI tier 1+2, intl global/swedish/dutch)
- `INTL_SCENES_META` for ISO badges + tinted labels
- All collections seeded with `market_id="FI"` default (Batch 3C multi-market prep)
- Endpoints: `GET /api/operators?partner_only=&market_id=`, `GET /api/operators/{slug}`, `GET /api/streamers?scene=&market=&market_id=`, `GET /api/streamers/{slug}`, admin CRUD on both, public `GET /api/dial/history?limit=`
- Hard 45s timeout on Claude calls (prevents event-loop hang during gateway flake)
- `seed_default_guidelines` now refreshes seeded prompts on boot only if `updated_by == 'seed'` (admin edits preserved)

### Frontend
- New `useRegistry.js` hook: `useOperators`, `useOperator`, `useStreamers`, `useStreamer`
- New `constants/dial.js` for the DIAL_STATES palette (extracted from mock.js as editorial constant)
- DialHistoryMiniChart rewritten — reads `/api/dial/history`; empty-state when no snapshots yet
- 8 page files migrated off `data/mock.js`: CasinoRanking, OperatorReview, StreamerIndex, StreamerProfile, StreamerIntl, WeeklyCard, Signup, ColdEmailLanding, Home
- WeeklyCard fixture marquee + leaderboard now empty-state when no real data
- 2 new back-office surfaces: `/back-office/operators`, `/back-office/streamers` (CRUD + scene filter)
- Deleted: `data/mock.js`, `data/mockStreams.js`, `SignupToast.jsx`, `PushNotificationToast.jsx`
- Repo is now **mock-free**

### Test coverage
- 12 new tests in `tests/test_phase3_v2_step1_registries.py` — public list/get/filter, admin CRUD, market_id propagation, intl scene metadata, dial history endpoint
- All 12 pass. Full backend regression: 73/77 green (4 phase3a_v2_content tests skip/timeout on transient LLM gateway 502 — unrelated to Step 1)
- Lint clean across all touched files

## Phase 3 V2 — UI Honesty Pass (this session)

Per V2 brief: empty surfaces ok, lying surfaces not. Killed every component that manufactured fake live data.

### Layout — fabricated toasts removed
- `SignupToast` ("John from Helsinki just subscribed") — **removed from Layout** (mock-driven, no real backing)
- `PushNotificationToast` (fake push notifications) — **removed from Layout** (mock-driven)
- `LiveTicker` — rewritten to read `/api/cockpit` + `/api/published` only. No more hardcoded "ANDYPYRO €42 800 / F1 MONZA SUNDAY 16:00 / PACT KICK 5.6K / JARTTU84 SWEET BONANZA". When no real data, shows honest "EI LIVESIGNAALIA · TOIMITUS PÄIVITTÄÄ".
- `StateContextualFloat` — reads `/api/dial`; hidden entirely on first-boot KYLMA fallback (no fake "3 of the week's best offers active now" pointing at unaudited operators)

### Home page — major mock purge
- Removed mock imports of `MOMENTS, INTL_MOMENTS, CURRENT_DIAL, DIAL_STATES, STREAMERS, MISSED_FI, MISSED_EN`
- Dial state pulled live from `/api/dial`
- Hardcoded "4 283 FINNS SUBSCRIBE" → live count from `/api/signup/count`
- Marquee fixture strip (TAPPARA—TPS / NHL CAROLINA—FLORIDA / etc) → honest "URHEILUFIKSTUURIT · API-FOOTBALL / LIIGA RSS ODOTTAA AVAIMIA"
- Missasit Eilen section → reads `/api/published?surface=missasit_eilen` with honest empty state
- Moments section → reads `/api/published?surface=moments` with honest empty state
- Weekly card teaser fixtures (Tappara — TPS etc) → editorial description only
- `OPERATORS` retained as editorial roster (not a live-data lie)

### Real-data components shipped
- `SocialProofTicker` rewritten as "Mittari Operational Status" — pulls real subscriber count, named source count, published item count, dial state. No fabrication.
- `ActivityFeedInline` rewritten — reads `/api/published?limit=12` only. Honest empty state when nothing shipped.
- `LiveTilesGrid` rewritten — reads `/api/signals/live` (non-mocked Twitch/Kick/YouTube signals only). Empty state until Twitch/Kick/YouTube API keys are set.
- `DialCockpit` — contributors derived from real `sub_scores` (top 3 non-zero categories) instead of hardcoded `['ANDYPYRO €42K', 'PACT KICK 5.6K', 'F1 MONZA']`. Composite + signal count displayed honestly.

### Backend honesty
- `CURRENT_STATE_KEY` first-boot fallback changed from `KUUMA` to `KYLMA` (no signal yet on first boot is the honest state, not "the slot scene is warming up")
- Fake `context` values ("live_streamers: 7, total_viewers: 19 590, active_signals: [...]") removed from /api/dial fallback
- New `GET /api/signup/count` public endpoint
- New `GET /api/signals/live` public endpoint (only non-mocked signals)
- `dial_engine` `any_real` flag now propagated to all consumers

## Test coverage
- 65/65 backend pytest passing (52 from prior + 10 new V2 source/scheduler/foundational + 3 existing carried)
- New test file: `tests/test_phase3_v2_source_scheduler.py` covers source map endpoints, foundational research CRUD, cadence config, scheduler tick honesty (refuses fabrication when research pool empty), variant filler
- Fixed brittle `test_get_dial_current` to accept any of the 5 valid dial states (was hardcoded to KUUMA)
- 4 E2E generation tests skip on transient upstream LLM 502 (validated end-to-end with hard 45s timeout)

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + html2canvas
- Backend: FastAPI + Motor (async MongoDB) + httpx (signal adapters) + emergentintegrations (Claude)
- DB: MongoDB collections — `signups`, `predictions`, `settings`, `game_scores`, `signals`, `dial_snapshots`, `generated_content`, `published_content`, `editorial_guidelines`, `distribution_log`, `tracked_sources`, `foundational_research`
- Auth: Public site has none; /back-office + /back-office/queue + /back-office/foundational-research gated by `BACK_OFFICE_TOKEN`
- Workers: signal_dial_worker (90s), scheduler_worker_loop (3600s), variant_filler_worker_loop (900s). Disable via `MITTARI_DISABLE_WORKERS=1` / `MITTARI_DISABLE_SCHEDULER=1`

## Prioritized backlog

### P0 — Blocked on user
- **Foundational research dataset delivery** — user to populate `/back-office/foundational-research` (or drop `/app/backend/data/foundational_research_v02.json`) before scheduler fires anything. Target threshold: 100+ entries across the 10 beats.
- **API keys delivery** — user to provide:
  - `TWITCH_CLIENT_ID/SECRET` (Twitch Helix)
  - `YOUTUBE_API_KEY` (YouTube Data v3)
  - `SPORTS_API_KEY` (API-Football)
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` (@MittariBot)
  - `RESEND_API_KEY` + `RESEND_FROM` (digest email)
  - X API v2 Basic tier credentials (for Pulssi layers)
  - Smartico Voyager loader URL + brand key (admin UI)

### P1 — When user delivers above
- Wire real Twitch/Kick/YouTube/Liiga/API-Football pollers (mock fallbacks already in place)
- Wire real Telegram / X / Resend / Web Push distribution channels
- Pulssi 3-layer infrastructure (tracked X accounts table + Finland trends + editor pulls)

### P2 — Phase 2.6 Batch B (deferred)
- Banner revenue surfaces (4 placements: right-rail, homepage horizontal, operator featured-offer, sponsored ranking)
- Mandatory `KAUPALLINEN YHTEISTYÖ` / `KAUPALLINEN SIJOITTELU` labels
- Back-office banner CRUD + click tracking + A/B variant + preview

### P3 — Hardening
- ErrorBoundary around CockpitContext + similar polling components
- Mongo → Postgres migration for time-series signal data
- Personalization layer (cookie-based returning-user state)
- Streamer auto-discovery worker
- Push notifications (VAPID)
- index.html title fix ("Emergent | Fullstack App" → Mittari-branded)
- Final purge of `data/mock.js` `OPERATORS` once a real operators registry is built

## Test credentials
- See `/app/memory/test_credentials.md`

## Next session
The architecture is built and quiet. The pipeline:
1. fires when `foundational_research` has entries
2. flips from mock to live when env keys are supplied
3. has zero fabricated UI content anywhere on the public site

When you return with foundational research data + API keys, the site lights up without code changes.
