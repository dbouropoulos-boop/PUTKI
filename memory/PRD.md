# PUTKI HQ — PRD

## Phase History (latest first)

- **Sprint follow-up — AI-assisted streamer meta drafter + carousel redesign + header fix** (2026-05-19)
  - **New backend module** `streamer_meta_drafter.py` — Claude Haiku via Emergent Universal Key. Status state machine: `no_meta` / `draft_needs_review` / `published` / `suppressed`. 30-day per-streamer draft cache. 10 generations/hour hard rate limit (Mongo TTL collection). Locked system prompt with forbidden-claim list (no sponsor names, no income claims, no promotional language, no tipster vocabulary). JSON output validator (`_parse_llm_json`). `STREAMER_META_AI_DRAFT_ENABLED` + `STREAMER_META_WEBSEARCH_ENABLED` kill switches.
  - **New admin endpoints**: `GET /api/admin/streamer-meta/v2` (status-aware listing + rate-limit status), `POST /api/admin/streamer-meta/generate-draft` (force flag, 429 on rate-limit, 503 on `llm_unavailable`), `POST /api/admin/streamer-meta/publish`, `POST /api/admin/streamer-meta/suppress`, `GET /api/admin/streamer-meta/history/{platform}/{user_login}` (GDPR audit log).
  - **`streamer_snapshots.attach_meta` now status-aware** — `draft_needs_review` and `no_meta` rows are NEVER surfaced on public `/api/streamers/live`. Legacy rows without status fall back to published. Writes both new (`meta_line_fi/en`) and legacy (`meta_fi/en`) fields for back-compat.
  - **New collections**: `streamer_meta_history` (publish audit log), `streamer_meta_drafts_log` (rate-limit + audit TTL).
  - **New admin UI** `/back-office/streamer-meta` (BackOfficeStreamerMeta.jsx) — status pills (NO META / DRAFT NEEDS REVIEW / PUBLISHED / SUPPRESSED), filter tabs, search, OPEN/CLOSE row expansion, AI-draft pipeline with confidence pill + notes_for_reviewer surface, Publish / Regenerate / Suppress / Discard buttons.
  - **New admin UI** `/back-office/slot-registry` (BackOfficeSlotRegistry.jsx) — full CRUD: add form (name + category + provider), filter tabs (all / enabled / disabled / slot / live_table), search, inline enable/disable toggle, delete, re-seed defaults button.
  - **New shared frontend hook** `useBackOfficeToken.js` + `AuthGate` — centralises the X-Admin-Token persistence pattern that each admin page was reimplementing inline.
  - **Carousel redesign — StreamersBand.jsx** — Restored: LIVE badge with pulsing red dot, viewer count overlay top-right with Eye icon, hover-zoom on thumbnail (480ms ease), uptime chip bottom-right (only when `started_at` real), game subtitle (only when API has it), platform tabs (TWITCH / KICK / YOUTUBE), "ASETA HÄLYTYS / SET ALERT" button per card opening StreamerAlertModal, horizontal scroll-snap carousel with arrow controls (only visible when content overflows). New social-proof signals: follower count chip (Users icon + `12.4k followers`), viewer trend chip (`▲ 230 this hr`), `#N TOP FI` rank badge for top-5 streamers per platform, `★ EDITORIAL` badge on cards with published editorial meta line. Card now `<article>` with restrained serif display name + improved type hierarchy.
  - **Header.jsx fix** — sticky bar now flush to viewport top (no longer offset 30px) + fully opaque background (no longer 88% transparent). Eliminates text bleed-through reported by user. Editorial copy can never appear behind the chrome.
  - **Tests**: 19/19 pytest in `test_sprint_streamer_meta_drafter.py` — covers v2 listing + publish lifecycle + suppress toggle + history audit + slot-registry CRUD + longest-match-wins extraction + LLM JSON parser + cache freshness helper. testing_agent_v3_fork iter27: **100% backend + 100% frontend, retest_needed=false, zero issues**.

- **Phase 1 Final Restructure — Chunk B COMPLETE** (2026-05-19) — Landing pages + ProgressiveOptIn + redirects.
  - **New backend**: `voita_feature_enabled` flag in `/api/settings/public` + `/api/admin/settings` (default `false`, Sako legal gate). `POST /api/optin` channel↔purpose capture with auto-tagging (`email_sentiment`, `sms_bets`, `telegram_bets`) and idempotent upsert per (channel, surface, identifier). `GET /api/admin/optin/stats` for back-office segment counts. Telegram normalisation strips `@` + lowercases.
  - **New `ProgressiveOptIn.jsx` component** — 3-step sequential funnel (email → SMS upsell → Telegram CTA). Steps render ONE at a time, never simultaneously. Skip available at every step. Captures `t.me/{handle}` username on Telegram click before opening external link. Per-surface `valueProps` prop for per-page copy.
  - **New `/mittari` page** — Big DialCockpit + state name in giant serif + plain-language reading + MittariStreak. 3-column driver breakdown (streamers/sports/forum) with primary-driver accent. Methodology summary linking to `/menetelma`. ProgressiveOptIn with mittari-specific value props (Mittari state-change SMS alerts). TrustPills.
  - **New `/pelisignaalit` page** — "Five daily signals" hero, 30-day Sharpness sparkline + today avg score + band, top-5 picks (deterministic Sharpness scored), ProgressiveOptIn (SMS = fast daily bets), TrustPills.
  - **New `/voita` page** — Gated by `voita_feature_enabled`. Default state: "Pian saatavilla" + watermark `VOITA` background + "What to expect" 3-card explainer + TrustPills + `ODOTTAA HYVÄKSYNTÄÄ` disabled CTA. ZERO PII capture in either state until Sako sign-off lands. When flag flipped on, hero copy switches to "Predict the winner. Win the prize." with form-capture stub.
  - **Restyled `/peli` hero** — Voyager aesthetic (slot-reel macro background, `PELI · VOYAGER` eyebrow, large serif prize text, restrained CTA, entry count chip, disclaimer pill).
  - **Homepage extended** — `AboutStrip` ("Who we are" editorial paragraph + manifesto link) + `TrustPills` strip inserted between `ExploreBlocks` and `EditorialFooter`. `ExploreBlocks` Pelisignaalit and Voita blocks now link to real `/pelisignaalit` and `/voita` (not legacy fallbacks).
  - **Reusable `TrustPills` component** — Editorial · not advertising · 12 verified sources · Strict source citation. Used on homepage + every landing page.
  - **301-style redirects**: `/vihjeet` → `/pelisignaalit`, `/viikon-kortti` → `/pelisignaalit`. `?ref`, `?pick`, `?invite` query strings preserved. `Footer` links updated (legacy `/viikon-kortti` removed, `/mittari` + `/pelisignaalit` added).
  - **Tests**: 13/13 pytest in `test_chunk_b_landing_pages.py`. testing_agent_v3_fork iter26: 100% frontend, 92% backend (1 cross-iter test-data leak — fixed: idempotency test now uses random uuid email per run).

- **Phase 1 Final Restructure — Chunk A COMPLETE** (2026-05-19) — Homepage rebuilt as news portal.
  - `og_image_fetcher.py` module · `/api/news/featured` + `/api/news/chronological` + `/api/admin/og-blocklist` CRUD. NewsPortal · StreamersRail (platform-grouped Twitch/Kick/YouTube) · ExploreBlocks · Home.jsx rewrite · Layout cleanup (PersistentCapture + StateContextualFloat removed). Visual spec source-of-truth: `/mocks/phase1-final-v2-desktop.html`. iter25: 100% pass.

- **Phase 1 — Share OG mini-sprint COMPLETE** (2026-05-19) — Mittari OG image generator (Nano Banana) with per-state directives, 5-state cache, idempotent event-driven generation. `GET /api/og/mittari/{state}/{date}` lookup endpoint. Kill switch ON in preview; production-ready once Universal Key tops up.

## Original problem statement

PUTKI HQ pivots from a multi-purpose homepage into a focused, high-tech editorial news portal with a live streamer presence on the side. Mittari dial, daily picks, Guess-the-Winner raffle, and Smartico Voyager game move off the homepage to dedicated landing pages (`/mittari`, `/pelisignaalit`, `/voita`, `/peli`), leaving only compact "hint" preview blocks on the homepage. Daily 10am email pipeline for `/pelisignaalit` opt-in. Channel ↔ purpose split: email = sentiment digest (slow), SMS/Telegram = daily bets (fast, time-critical).

## Roadmap

### P0 — Chunk C (Email pipeline) — NEXT
- Resend integration for daily 10:00 AM email cron (user-confirmed provider)
- DMARC/DKIM/SPF setup guide for putkihq.fi
- Daily worker: digest assembler (Mittari state + 4 top news + skene tunnelma for `email_sentiment` segment)
- Daily worker: signals dispatch (Sharpness ≥ 75 picks for `sms_bets` + `telegram_bets` segments via Twilio + Telegram Bot API)
- `/back-office/optin-segments` admin panel showing `/api/admin/optin/stats` table

### P1 — Phase 2
- `/uutiset` full news archive with filters + search
- `/striimaajat` full directory with per-streamer alert subscriptions
- `/quiz` weekly quiz module (score-then-email gate)
- PUTKI Score user engagement metric
- Full historical-snapshot pages for `/m/{state-slug}-{date}` (replace stubs)
- `/back-office/voita` admin page to toggle `voita_feature_enabled` and configure active raffle (deferred until Sako legal sign-off)

### P2 — Backlog
- Tier 2 Haiku classifier fallback for ambiguous ticker items
- Kick + YouTube full integration (Kick API still 403 Cloudflare)
- Refactoring: array index keys in StreamerProfile/OperatorReview, content_generator.py complexity, localStorage in admin
- Content backfill (PAUSED — Universal Key budget; resume after top-up)

## Architecture invariants (do not break)

- **Strict source citation** — every LLM article cites a named outlet in first 400 chars (`content_generator.validate_content`)
- **og:image overlay caption** — every locally-cached news hero MUST carry `Photo: {source}` overlay
- **og_image_blocklist honoured** — back-office removal-requests immediately stop fetcher
- **Single `dialReading()` source-of-truth** — no hardcoded state names site-wide
- **No fabricated streamers** — `is_live: true` only when API confirms; honest empty states for dormant platforms
- **Mittari OG kill switch** — `PUTKI_HQ_DISABLE_OG_IMAGES=1` in preview env; auto-resumes on user top-up
- **Channel ↔ Purpose discipline** — Email = sentiment digest only; SMS/Telegram = daily bets only. No bundling.
- **`/voita` Sako gate** — Page renders gated state by default. Capture ZERO PII until legal sign-off. Flip via `PUT /api/admin/settings {voita_feature_enabled: true}`.
- **ProgressiveOptIn = sequential only** — Never render all 3 steps simultaneously. One at a time.

## Test status

- Backend pytest: `test_chunk_a_news_portal.py` 11/11 + `test_chunk_b_landing_pages.py` 13/13 = **24/24 green**
- Last testing_agent_v3_fork iteration: **iter26 — 100% frontend, 92% backend** (1 minor cross-iter test-data leak, fixed post-test)

## Project Health Check

- Broken: None
- Mocked: None

## 3rd Party Integrations

- Emergent LLM Key (Claude Haiku/Opus + Nano Banana) — OUT OF BUDGET until user tops up
- Twitch API / EventSub — configured
- YouTube PubSubHubbub — configured
- The Odds API — configured
- **PENDING (Chunk C)**: Resend (daily emails) + Twilio (SMS) + Telegram Bot API (channel posting) — user-confirmed providers
  - **New backend module** `og_image_fetcher.py` — fetches `og:image` / `twitter:image` from cited URLs, validates ≥1200×630, decodes via Pillow, saves JPEG to `/app/backend/static/news_hero/{sha1}.jpg`. Cache: 7d positive, 24h negative. Blocklist guard: `og_image_blocklist` Mongo collection checked before every fetch — outlets requesting removal added there honor the request immediately. Kill switch via `PUTKI_HQ_DISABLE_OG_FETCHER=1` env. `User-Agent` identifies as `PutkiHQBot/1.0 (+https://putkihq.fi/lehdisto)` — standard editorial preview-fetcher practice.
  - **New endpoints**:
    - `GET /api/news/featured?limit=2` — Top-N AI-ranked stories (deterministic score = relevance + severity weight + verification bonus + tier bonus). Enriched per item with `hero_image_url` (locally cached, never hot-linked) + `photo_credit` (`Photo: {source}`, mandatory overlay).
    - `GET /api/news/chronological?limit=12` — Most recent `news_ticker_items` desc by capture time.
    - `GET/POST/DELETE /api/admin/og-blocklist` — Back-office CRUD for removal-request handling. Normalises `www.` + lowercases on add.
  - **New frontend components**:
    - `NewsPortal.jsx` — left column. 2 featured cards (og:image hero + photo-credit overlay OR designed category-treatment fallback) + 12 chrono rows with lead/mid/old typography hierarchy.
    - `StreamersRail.jsx` — right column. 3 platform groups (TWITCH purple chip, KICK green chip, YOUTUBE red chip). 32px avatars, green ring for LIVE, one-time `arrivePulse` animation only on offline→live session transition. Platform dot on every avatar corner. Honest empty states (`API DORMANT` for Kick, `NO STREAMERS` for empty YouTube).
    - `ExploreBlocks.jsx` — compact 2×2 preview grid (168px min-height). Mittari (mini dial + state name in current state color), Pelisignaalit (top pick + Sharpness inline), Voita (gated as `Pian saatavilla` until Sako sign-off), Peli (current Voyager campaign).
  - **`Home.jsx` complete rewrite** — composes the three new components + UTMBanner + EditorialFooter. Removed from homepage: DialCockpit hero, NewsCarousel, HubMosaic, ZonePublicationDepth, GamesSection, CaptureSection, LiveActivityFeed, WinnersCorner, SocialProofBar, MostReadRail, PaivaVitoset, StreamerLiveGrid, 'What is PUTKI HQ' pillars, PhaseOneDiscoveryRow.
  - **`Layout.jsx` cleanup** — `PersistentCapture` and `StateContextualFloat` removed site-wide per brief's "complete removal of duplicate subscription surfaces" requirement. Single subscription mechanism = ProgressiveOptIn on landing pages (Chunk B).
  - **Static mock v2.2** — `/mocks/phase1-final-v2-desktop.html` — visual source of truth approved by user.
  - **Tests**: 11/11 pytest in `tests/test_chunk_a_news_portal.py`. testing_agent_v3_fork iter25: 100% backend + 100% frontend, zero issues, `retest_needed: false`.

- **Phase 1 — Share OG mini-sprint COMPLETE** (2026-05-19) — Phase 1 now 100% closed.
  - `og_image_generator.ensure_mittari_state_og(state_key, date_iso, reading_fi)` — Mittari-specific Nano Banana generator with `MITTARI_STATE_DIRECTIVES` for all 5 states (label, mood, hex color). Idempotent: returns cached URL if `mittari-{state}-{date}.png` already exists; coalesces concurrent calls via `_inflight` map; semaphore (concurrency=1) preserved; kill switch `PUTKI_HQ_DISABLE_OG_IMAGES=1` respected.
  - **State-change hook**: `dial_engine.compute_and_store` fires-and-forgets `ensure_mittari_state_og()` whenever it writes a `dial_state_events` doc (prev state != new state). The dial loop NEVER blocks on Nano Banana — `asyncio.create_task` + try/except.
  - **`GET /api/og/mittari/{state}/{date}`** endpoint — read-only lookup. Returns `{found:true, url}` when cached, otherwise `{found:false, reason}` where reason is `unknown_state | og_images_disabled | not_yet_generated`.
  - **Frontend** `MittariPermalink.jsx` fetches the OG URL in parallel with the event lookup; emits `og:image` meta tag via `useDocumentMeta({ogImage})` when found. Graceful fallback to no `og:image` when not yet generated.
  - **Production status**: Kill switch ON in this preview environment (per the LLM budget guard). When the user tops up the Universal Key and flips `PUTKI_HQ_DISABLE_OG_IMAGES=0`, state changes auto-generate images with NO further code action required.

