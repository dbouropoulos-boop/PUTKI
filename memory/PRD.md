# PUTKI HQ — PRD

## Phase History (latest first — see CHANGELOG for full list pre-Phase 5)

- **Phase 1 Homepage Restructure — FULLY CLOSED** (2026-05-19) — Source-citation validator + Verify-the-math worksheet + Sprint 4 partial + Sprint 3.b + Sprint 5 finalize.
  - **Source-citation validator** (Section 10): `content_generator.validate_content` rejects with `source_citation_missing:no_citation_phrase` or `:no_named_source` when an article body lacks BOTH a citation phrase (mukaan/raportoi/according to/reports that) AND a named outlet (Yle/HS/IL/IS/MTV/KL/Google News) within the first 400 chars. Sports recaps may cite `data: Ergast/NHL Stats/football-data/Opta/Transfermarkt` in lieu of named outlet. `streamer_alert` template exempt via explicit `SOURCE_CITATION_EXEMPT_TEMPLATES` set. 8/8 unit tests.
  - **Verify-the-math worksheet** — MATEMATIIKKA/MATH pill on each pick card opens an editorial-layout worksheet. Plain-language labels (Markkinakerroin/Konsensuksen tiukkuus/Suunta 24 h FI · Market odds/Consensus tightness/24h direction EN), 4-col table (label/Score/Weight/Weighted), TOTAL row, closing line "Sharpness on deterministinen. Sama data tuottaa aina saman pistemäärän." / "Sharpness is deterministic. The same data always produces the same score."
  - **Sprint 4 partial — Mittari state events**: `dial_state_events` collection (TTL 365d), `state_streak()` + `state_event_for_permalink()` helpers, `GET /api/dial/streak`, `GET /api/dial/permalink/{state}/{date}`, frontend `MittariStreak.jsx` (silent until first event) + `MittariPermalink.jsx` at `/m/:slug` (parses `{state-slug}-{YYYY-MM-DD}`, renders state name in matching state color at clamp(56px,12vw,140px)). **NOT YET SHIPPED**: cached share OG image at state-change event (Nano Banana wire-up — focused mini-sprint).
  - **Sprint 3.b — News carousel beside dial**: `NewsCarousel.jsx` discrete 7s auto-rotate with category badges (semantic colors), dot indicators clickable, hover pauses. Max 4 info elements per slide.
  - **Sprint 5 finalize**: Winners Corner +u unit notation removed (Section 12d). StickyTelegramCTA removed from home (Section 12g — DialSubscriptionCTA is the single primary subscription).
  - **Testing**: testing_agent_v3_fork iter24 — 54/54 backend pytest (source-citation 8/8 + phase1 17/17 + sharpness 17/17 + classifier 12/12) + every frontend assertion verified. `retest_needed: False`.


- **Phase 1 Homepage Restructure — Sprints 1+2+3+5 partial** (2026-05-19) — Massive bilingual redesign per user spec.
  - **Sprint 1 — Foundation**:
    - WIN PULSE → MITTARI rename across codebase (i18n, components, Cockpit maker's mark).
    - Mittari state rename: TYPÖTYHJÄ/NIHKEÄ/TULOSSA/VOITTOPUTKI/RYÖSTÖPUTKI → TYYNI/VIRE/VIPINÄ/MEININKI/PERKELE (FI) / CALM/BUZZ/ACTIVE/ROLLING/PERKELE (EN). Internal state KEYS preserved (KYLMA/HAALEA/KUUMA/MYRSKY/KIIRASTULI).
    - New state palette: TYYNI #5C8A8A · VIRE #6FA37D · VIPINÄ #D4B445 · MEININKI #C97A3A · PERKELE #C13B2C. Applied to dial.js + Dial.jsx ARC_COLORS + DialSubscriptionCTA STATE_CONFIG.
    - `dialReading(state, lang, {streams, viewers})` helper — Bloomberg-rhythm plain-language reading with live counts per Section 13c.
    - Top bar simplified: no nav menu. Only logo + EN/FI toggle + theme toggle.
    - PhaseOneDiscoveryRow.jsx — temporary "Lue lisää: Uutiset · Vinkit · Tietoa meistä · Menetelmä" row above footer (removable when Phase 2 Explore ships).
    - Footer disclosures: source disclosure + editorial disclosure per Sections 13m/13n.
    - LiveTicker dimmed (slate dots, no state colors); will fully retire when Phase 2 news ticker takes over.
  - **Sprint 2 — Picks section "Päivän tärpit · Today's market watch"**:
    - New `backend/sharpness.py` — deterministic 0-100 score (50% implied_prob + 30% consensus_tightness + 20% recency_momentum). Formula published verbatim on /menetelma.
    - `_best_pick_from_event` enriches every pick with nested `sharpness` object: components, weights, band, modifier, book_count, has_momentum_history.
    - `_avg_implied_now` internal field stripped before response.
    - `GET /api/odds/market-watch` endpoint — daily avg + 30-day sparkline from `sharpness_daily` collection.
    - PaivaVitoset.jsx rebuilt: Daily Market Watch Card at top (with SVG sparkline + pulsing today dot), 5 pick cards with Sharpness bar + click-to-expand investigative analysis + bookmaker citation + disclosure, track record line at bottom.
    - 20/20 sanity tests for sharpness (test_iter23_sharpness.py).
  - **Sprint 3 — News & Ticker**:
    - RSS_FEEDS expanded to 12 sources: 7 direct Finnish (Yle Uutiset, Yle Urheilu, HS, IL, IS, MTV, KL) + 5 Google News category queries (News/Sports/Gambling/Scene/Regulation) per brief Section 2 lockdown.
    - Per-source circuit breaker: 5 consecutive 429s/timeouts → 30 min pause. State in-process; logged on trip.
    - `backend/news_classifier.py` — deterministic Tier 1 classifier tagging category/severity/relevance/entities. Tier 2 Haiku fallback gated by env flag (default off).
    - Cross-source corroboration: items sharing 6-token signature across ≥2 sources flagged `verified=True`.
    - `rss_tick` now upserts classified items into `news_ticker_items` (TTL 7d) above threshold 45, archive 20-44 → `news_ticker_archive` (TTL 30d).
    - `GET /api/news/ticker?limit=N` endpoint serves the ticker feed.
    - NewsTicker.jsx — full-width continuous-scroll component under top bar, replaces LiveTicker in Layout.jsx. Severity dots, source attribution, relative timestamps, pause-on-hover, verified checkmark.
    - 9/9 sanity tests for classifier (test_iter23_news_classifier.py).
  - **Sprint 5 partial — Cleanups + T&C + Methodology**:
    - Removed LiveDataTicker (Section 12c), ActivityStats/PUBLISHED CONTENT card (Section 3b), CockpitContext PRIMARY DRIVER strip (moves to Phase 2), long marketing headline (→ "Finland's scene temperature" / "Suomen skenen lämpötila").
    - Methodology page extended with 2 new sections: "Käytetty teknologia / Technology used" (AI workflow disclosure per Section 9) + "Sharpness — kaava / formula" (verbatim formula + bands).
    - New `/ehdot` Terms & conditions page — editorial position + KÄYTETTY TEKNOLOGIA clause linking to /menetelma.
    - Newsroom `min_state` regex accepts new (VIPINÄ/MEININKI/PERKELE/ACTIVE/ROLLING) and legacy (WARM/RUSH/JACKPOT/TULOSSA/VOITTOPUTKI/RYÖSTÖPUTKI) values for backward compat.
  - **Testing**: testing_agent_v3_fork iter23 — 17/17 backend pytest + 15/15 frontend test IDs verified. `retest_needed: False`.
  - **Deferred to follow-up sprints**:
    - **Sprint 3.b** — News carousel beside dial (right column replacing removed PUBLISHED CONTENT card).
    - **Sprint 4** — Mittari polish (cached share OG image at state-change, streak counter, /m/{state-slug}-{date} permalink page).
    - **Sprint 5 remaining** — Winners Corner +u unit notation removal, sticky Telegram duplicate consolidation.

- **Phase 5.4.1 — Code-review critical fixes** (2026-05-18) — Hardcoded test secrets via _test_env.py; webhook fixtures randomised; late-binding closures; useDocumentMeta deps collapsed; test_iter21_most_read fail-fast.

- **Phase 5.4 — Back-office /peli cleanup** (2026-05-18) — Editor's direct request from walkthrough.docx.
  - Removed `prize_amount` input + `prize_currency` input from `/back-office/peli` admin form.
  - Removed `youtube_id` input per video (kept title + caption).
  - Backend: `peli_raffle.py` — `VideoConfig` no longer accepts `youtube_id`; `PeliConfigUpdate` no longer accepts `prize_amount`. Default seed cleaned.
  - Tests updated: `tests/test_iter19_peli_raffle.py` — **18/18 pytest pass.**

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
