# PUTKI HQ — PRD

## Phase History (latest first — see CHANGELOG for full list pre-Phase 5)

- **Phase 1 Final Restructure — Chunk A COMPLETE** (2026-05-19) — Homepage rebuilt as news portal.
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

## Original problem statement

PUTKI HQ pivots from a multi-purpose homepage into a focused, high-tech editorial news portal with a live streamer presence on the side. Mittari dial, daily picks, Guess-the-Winner raffle, and Smartico Voyager game move off the homepage to dedicated landing pages (`/mittari`, `/pelisignaalit`, `/voita`, `/peli`), leaving only compact "hint" preview blocks on the homepage. Daily 10am email pipeline for `/pelisignaalit` opt-in. Channel ↔ purpose split: email = sentiment digest (slow), SMS/Telegram = daily bets (fast, time-critical).

## Roadmap

### P0 — Chunk B (Landing pages) — NEXT
- `/mittari` — Permanent home for the dial, driver breakdown, methodology summary, alert subscriptions
- `/pelisignaalit` — Daily 5 signals, Sharpness score, 30-day sparkline, track record, 10am email opt-in
- `/voita` — Guess-the-winner raffle (GATED behind `VOITA_FEATURE_ENABLED` back-office toggle until Sako legal sign-off)
- `/peli` — Voyager game restyled hero
- `/tietoa-meista` — Move "What is PUTKI HQ" explainer cards here
- 301 redirects: `/vihjeet` → `/pelisignaalit`, `/viikon-kortti` → `/pelisignaalit` (preserve `?ref=share` + `?invite=` query params)
- ProgressiveOptIn component (3-step sequential: email gate → SMS upsell → Telegram CTA, per-step consent tags)

### P0 — Chunk C (Email pipeline)
- Resend integration (user-confirmed provider) for daily 10:00 AM email cron
- DMARC/DKIM/SPF setup guide for putkihq.fi
- `email_sentiment` / `sms_bets` / `telegram_bets` consent tag tracking
- Worker: daily digest assembler (Mittari state + 4 top news + skene tunnelma)

### P1 — Phase 2
- `/uutiset` full news archive with filters + search
- `/striimaajat` full directory with per-streamer alert subscriptions
- `/quiz` weekly quiz module (score-then-email gate)
- Explore section replacing PhaseOneDiscoveryRow
- PUTKI Score user engagement metric
- Full historical-snapshot pages for `/m/{state-slug}-{date}` (replace stubs)

### P2 — Backlog
- Tier 2 Haiku classifier fallback for ambiguous ticker items
- Kick + YouTube full integration (currently Kick API blocked by Cloudflare 403)
- Refactoring: array index keys in StreamerProfile/OperatorReview, content_generator.py cyclomatic complexity, localStorage-for-sensitive-data in Admin panels
- Content backfill (PAUSED — Universal Key budget exhausted; resume after top-up)

## Architecture invariants (do not break)

- **Strict source citation** — every LLM article must cite a named outlet in first 400 chars (validator in `content_generator.validate_content`)
- **og:image overlay caption** — every locally-cached news hero MUST carry `Photo: {source}` overlay (editorial guarantee, FT/Bloomberg/Apple News pattern)
- **og_image_blocklist honoured** — back-office removal-requests immediately stop fetcher from caching that outlet
- **Single dialReading() source-of-truth** — no hardcoded state names site-wide
- **No fabricated streamers** — `is_live: true` only when API confirms, otherwise honest empty state
- **Mittari OG kill switch** — `PUTKI_HQ_DISABLE_OG_IMAGES=1` in preview env, generation re-enables on user top-up
- **Channel ↔ Purpose discipline** — Email = sentiment digest only; SMS/Telegram = daily bets only. No bundling.

## Test status

- Backend pytest: `test_chunk_a_news_portal.py` 11/11, plus all prior iter23+iter24 suites still green
- Last testing_agent_v3_fork run: iteration_25 — 100% pass, zero issues, `retest_needed: false`

## Project Health Check

- Broken: None
- Mocked: None. Real og:image fetcher actively pulling + validating + caching real HS/Yle/IS/IL images.

## 3rd Party Integrations

- Emergent LLM Key (Claude Haiku/Opus + Nano Banana) — OUT OF BUDGET until user tops up
- Twitch API / EventSub — requires User API Key (configured)
- YouTube PubSubHubbub — requires User API Key (configured)
- The Odds API — requires User API Key (configured)
- **PENDING (Chunk C)**: Resend (user confirmed provider for daily 10am email + DMARC/DKIM/SPF setup)
