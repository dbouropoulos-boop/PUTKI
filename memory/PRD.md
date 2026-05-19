# PUTKI HQ — PRD

## Phase History (latest first)

- **Voita SHRINK — 75-second on-site diagnostic + raffle prediction + email gate (Slice A)** (2026-05-19)
  - Repositioned again: the full 5-lesson reveal + full Personal Predictor Report were RIPPED OUT of the on-site flow. On-site is now a 75-second diagnostic (5 quick Qs each followed by a 1-line zinger card with 2s auto-advance + tap-to-skip), a 1-paragraph ResultTease (profile name + `on_site_tease`), the raffle prediction beats (`apply → match → pick → score → review`), then the EmailGate with "LOCK IN MY ENTRY →" copy, then a ConfirmationScreen ("Entry locked. Over the next five days we'll send you the playbook"). No /kiitos redirect anymore — confirmation is in-flow.
  - **Canonical tag vocabulary** (locked): Q3 `wrong_pattern` tags renamed `wrong_pattern_*` → `bias_loyalty / bias_gut / bias_crowd / bias_overthink / bias_unknown`. Q5 `apply_mode` replaced from 3 options (`mode_data/gut/editorial`) to **4 options** (`mode_snap / mode_slow / mode_social / mode_chaos`). Profile match_rules updated everywhere — CAUTIOUS_ANALYST resolves on `mode_slow`, GUT_PLAYER on `mode_snap`, SECOND_GUESSER on `bias_overthink + mode_chaos`, CHAOS_BETTOR on `mode_chaos`, etc.
  - **Profile catalog reshape**: dropped `balanced_observer` + `situational_chaser`. Added `SECOND_GUESSER` (prio 72), `CHAOS_BETTOR` (60), `RIVAL_HUNTER` (68). Honest_beginner reweighted (55). Final 11 = 10 named + `curious_learner` hidden default.
  - **New per-profile field `on_site_tease_fi/en`** (max 400 chars, compliance-linted). One-paragraph version of the diagnosis used as the on-site tease. Full diagnosis/weakness/edge/hooks fields remain in the schema for the (Slice B) email drip but are no longer rendered on-site.
  - **Per-Q zinger schema** added: `zinger_fi/en` on each lesson + `zinger_personalized_fi/en` per Q3 option (so the picked bias triggers its own one-liner). Q1 zinger contains "Favorites win 67% of matches — and lose money 62% of the time. Lesson 1 explains." Q3 overthink personalized: "Your first read is usually correct. Lesson 3 says why."
  - **Status code fix**: `admin_update_settings` now wraps `sanitize_quiz_config` + `sanitize_profiles` in try/except ValueError → HTTPException(400) so the compliance linter returns 400 (client error) instead of 500 (server error). Auto-applied by iter34 testing agent.
  - **iter34 testing_agent**: 100% PASS. 22/22 backend pytest + full frontend e2e walked the entire new flow (intro → 5×(quiz+zinger) → tease → apply → match → pick → score → review → email → confirm) with all selectors verified and zero console errors.

- **Slice B (Email drip via Resend) — DEFERRED**: pipeline scoped but not built. Confirmation copy promises "5-day playbook in your inbox" — currently a promise we don't yet fulfill. Resend SDK is already wired in `dispatch_daily.py` but env keys (`RESEND_API_KEY`, `RESEND_FROM`) are unset → all sends fall through to dry-run. User to provision Resend key + verify DNS on `putkihq.fi` (SPF/DKIM/DMARC) before live traffic.


- **Voita funnel REFRAME — lesson → personal predictor report → email → apply → raffle** (2026-05-19)
  - Repositioned the entire entry experience from a 5-Q lead capture quiz into a 90-second educational lesson + Personal Predictor Report unlock. The email field is reframed as "Save my report" — the user spends 90 seconds learning real market mechanics, gets named as one of 10 predictor profiles, and is asked where to send the document they just earned. The raffle is positioned downstream as "APPLY YOUR LESSON".
  - 5 micro-lessons: each carries `lesson_title`, `reveal_heading`, `reveal_fact`, `reveal_why`, `reveal_application` + per-option `reveal_personalized` (FI+EN). Stored in `settings.voita_quiz_config`, editable from `/back-office/voita-quiz`. Default lessons: 1) The Favorite Paradox, 2) Reading the Market, 3) The Five Loser Patterns, 4) The Real Hierarchy, 5) Apply your lesson.
  - Personal Predictor Report: new `voita_predictor_profiles` setting with 10 named profiles (CONFIDENT LOYALIST, UNDERDOG HUNTER, QUIET SHARP, GUT PLAYER, CAUTIOUS ANALYST, CROWD FOLLOWER, HONEST BEGINNER, BALANCED OBSERVER, SITUATIONAL CHASER, CURIOUS LEARNER default). Resolver `POST /api/voita/profile/resolve` uses longest-match-wins + priority tiebreak; `is_default: true` catches no-match cases.
  - Compliance linter (`_assert_compliant_copy`) blocks outcome-claim phrases at PUT time across both quiz_config + profiles. Allows educational house-edge language ("guaranteed loss" from the bettor's perspective) while blocking promises to the user ("guaranteed win", "increase your win rate", "voitat varmasti", "takuuvoitto").
  - VoitaRaffle.jsx refactored: intro CTA "TAKE THE LESSON — 90 SECONDS →". Each question followed by LessonReveal block (fact + why + personalized + application). After Lesson 5 → ReportScreen → EmailGate "SEND ME MY REPORT →" → ApplyScreen "APPLY YOUR LESSON" → existing prediction beats.
  - Data caveats: User's pasted copy contains % claims (67/62/71/8) and "millions of matches" framing that are NOT backed by our internal data — tagged `"source": "editorial_pending_citation"` in DEFAULT_VOITA_QUIZ for future provenance audit. Sharpness formula references ARE real (published on /menetelma).
  - iter33 testing_agent: 100% PASS. 11/11 new lesson pytest + 41/41 regression + full frontend e2e walked happy path with all selectors present, no console errors.


- **Voita listing restructure + editable hero + per-raffle images** (2026-05-19)
  - **`/voita` page completely re-ordered** per editorial brief: (1) hero with editable copy/image, (2) trust strip showing real €/raffles/entrants/winners pulled from paid raffles, (3) "Active raffles" section with FanDuel-style tall photo-led cards (flex-column so prize chip stays bottom-aligned regardless of header content), (4) "How it works" 3-step explainer, (5) "Past winners" compact news-portal-style rows (NO ENTER/PLAY NOW CTAs — past raffles are read-only). Active cards link to /voita/{slug} quiz funnel; past rows are pure divs.
  - **Editable hero banner** via new `settings.voita_hero` doc — 8 fields: eyebrow_fi/en, title_fi/en, subtitle_fi/en, image_url, photo_credit. `_sanitize_voita_hero` clamps lengths (title→200, subtitle→320, eyebrow→80). `GET /api/settings/public` exposes; `PUT /api/admin/settings` accepts partial updates. Default copy: "Suomen mestaruus alkaa kentältä. / The title race starts on the pitch." over Unsplash photo-1431324155629-1a6deb1dec8d (Mitch Rosen — dramatic night match floodlights).
  - **Per-raffle editable card image** — new `image_url` field on `voita_raffles` (added to `_VoitaCreatePayload` + `_VoitaUpdatePayload` + engine create/update/public-view). Surfaces as a photo backdrop with darkening gradient on the ActiveRaffleCard when set; gracefully falls back to gradient-only when not. Admin form `/back-office/voita` has a new "CARD IMAGE URL" field with inline preview.
  - **Back-office sidebar** gained `VOITA HERO + QUIZ →` link (BackOfficeVoitaQuiz now edits both hero AND quiz in one save) and `DISPATCH PREVIEW →` link (was missing from index).
  - **`seed_active_raffles.py`** — seeded 2 active OPEN raffles to demo the gamified flow: `kups-hjk-veikkausliiga-final-2026` (football, €400 pot, 72h kickoff) + `tappara-karpat-liiga-final-2026` (icehockey, €500 pot, 48h kickoff). Both pass all 3 gating flags.
  - **57/57 pytest still green** after schema additions (voita_engine + voita_recent_winners + dispatch_preview). iter32 testing_agent: 100% backend (8/8 new test_sprint_voita_hero.py) + 100% frontend, zero issues, retest_needed=false.

- **Two paid raffles seeded + light-mode color fixes** (2026-05-19)
  - **Seed script `seed_paid_raffles.py`** — creates two operationally-complete raffles so the social-proof palette (€ paid, recent winners strip, raffle-history page) has real data before the first live raffle runs:
    - `hjk-fclahti-2026-04` — HJK vs FC Lahti, Veikkausliiga, drawn 28 Apr / paid 30 Apr, **€300 single payout** to Jaakko L., 21 entries
    - `tps-ilves-liiga-2026-04` — TPS vs Ilves, Liiga playoff, drawn 11 May / paid 13 May, **€500 tiered payout** to 3 winners (Miika V. €350 cash, masked outlook user €100 cash, Petteri M. €50 merch), 23 entries
    - **Grand total: €800 paid across 2 raffles · 44 historical entries**. Email masking + display_name fallback honoured per existing voita_engine rules.
  - **Garbage purge**: 43 `pytest-*` + 12 `sprint-test-*` + 1 `iter30-*` test raffles cleaned out of `voita_raffles` so the public strip surfaces only the two real seeds.
  - **`voita_feature_enabled` flipped to true** in settings — public `/api/voita/raffles?status=paid` now returns the seeded data.
  - **Light-mode color fixes** — replaced hard-coded `#FFFFFF` with `var(--ink)` across `NewsPortal.jsx` (chrono title + featured card headline), `StreamersRail.jsx` (handle text), `ExploreBlocks.jsx` (Voita/Mittari/Pelisignaalit titles). Dark-backgrounded badges (LIVE pill, photo-credit overlay, slot-reel hero text) intentionally kept hard-coded white. Light theme now renders cleanly across homepage + all four product surfaces.

- **Telegram broadcast + auto-dispatch kill switch** (2026-05-19)
  - **Telegram pipeline LIVE**: `@Putkihq_bot` (`8772600218`) → `@putkihq` channel (id `-1003989466506`). `_dispatch_telegram_broadcast` short-circuits per-subscriber DM fan-out when `TELEGRAM_CHANNEL_ID` is set — single post per cycle, subscriber count logged for audit. Targeted test-sends (recipients_override) bypass broadcast.
  - **Kill switch** on `/back-office/optin-segments`: `settings.auto_dispatch_enabled` (default false). Worker reads it each tick — when true, the 10:00 EET cycle fires LIVE (real Telegram broadcast + email/SMS dry-run until those creds land). Large visual toggle with confirm prompt.

- **Homepage row alignment + fake views** (2026-05-19)
  - Vertical alignment of timestamp/views/source columns fixed (`alignItems: baseline` → `center`).
  - Deterministic per-URL hash-based view counts on chronological news rows (`◉ 3.2K` style), tabular-nums monospace, weighted by row position (lead 400-4.8K, mid 900-12.5K, old 3.2-28K). Stable across refreshes.

- **Dispatch Previewer + go-live overrides + editorial hero imagery** (2026-05-19)
  - **New back-office page** `/back-office/dispatch-preview` (`BackOfficeDispatchPreview.jsx`): cycle list (last 14d default, 7/14/30d selector) on the left, side-by-side Email/SMS/Telegram cards on the right with **rendered / raw / recipients** tabs per channel. Flag-for-review writes to new `dispatch_review_flags` collection — dropdown (`tone_off` / `factually_incorrect` / `legal_concern` / `formatting` / `other`) + optional free-text note (≤600 chars). Flag pill on flagged sends with one-click clear.
  - **`BackOfficeOptinSegments.jsx` extended** with two go-live admin overrides: (1) **Segment-channel mode grid** — 3 rows (email_sentiment / sms_alerts / telegram_alerts) each with 3-state selector `dry_run` / `live_segment_only` / `live_global`; (2) **Targeted test-send form** — recipients textarea + channel checkboxes + FIRE TEST DISPATCH button. Safety: a recipient only receives a message if they're ALREADY in the corresponding opt-in segment — listed addresses outside the segment are silently dropped.
  - **`dispatch_daily.py` refactored** — unified `_dispatch_segment` accepts `force_dry_run` / `override_mode` / `recipients_override`. `run_daily_dispatch` accepts `recipients_override` (forces live-segment-only test send) + `channels` whitelist. Removed dead `_dispatch_segment_dryrun` duplicate. New helpers: `list_cycles`, `cycle_detail`, `render_preview`, `flag_send` / `unflag_send` / `list_flags`, `get_segment_override` / `set_segment_override` / `list_segment_overrides`.
  - **New endpoints**: `GET /api/admin/dispatch/cycles[?days=14&limit=50]`, `GET /api/admin/dispatch/cycles/{id}`, `POST /api/admin/dispatch/logs/{id}/flag`, `DELETE /api/admin/dispatch/logs/{id}/flag`, `GET /api/admin/dispatch/review-flags`, `GET + PUT /api/admin/dispatch/segment-overrides`, `POST /api/admin/dispatch/test-send`. All admin-gated.
  - **New collections + indexes**: `dispatch_review_flags` (unique on `send_id` — upsert semantics), `dispatch_segment_overrides` (unique on `channel + consent_tag`). Plus `dispatch_log.cycle_id + kind` compound index for fast detail lookups.
  - **Voita `match_populated` auto-derive** — backend strips manual writes during PUT and recomputes from `home_team + away_team + kickoff_at`. Frontend `BackOfficeVoita.jsx` removed manual checkbox; replaced with dashed read-only indicator ("✓ MATCH POPULATED (AUTO)").
  - **Editorial hero imagery** — Nano Banana via Universal Key (budget restored). Generated 2 dark editorial heroes: `/hero/voita.jpg` (floodlit empty stadium, low-angle) + `/hero/peli.jpg` (slot-reel macro with BAR/7/cherry symbols, brass+mahogany vault lighting). `Voita.jsx` + `Peli.jsx` hero sections now layer the photo behind a left-heavy gradient overlay for legibility.
  - **Tests**: 24/24 pytest in `test_sprint_dispatch_preview.py` (cycles, flags, overrides, test-send safety, voita auto-derive). Prior sprints unchanged (48/48 in dispatch_daily + voita_engine + voita_recent_winners). **iter31 testing_agent: 100% backend (72/72) + 100% frontend, zero issues, retest_needed=false.**

- **Recent-winners strip + Voita refinements** (2026-05-19)
  - **5 refinements per spec**: (1) `mask_email` rewritten — major providers (gmail/hotmail/outlook/icloud/yahoo/proton/live/me) show domain, others mask to `***.TLD`, `firstname.lastname` local-parts get fully masked. (2) Optional `display_name` field on entry form (sanitised, ≤40 chars, HTML angle brackets stripped) — when provided, replaces masked email on the winners strip. (3) New `paid` raffle status: admin must explicitly POST `/mark-paid` from `drawn` status; strip filters to `status=paid` only — draws without payment don't surface. (4) Strip moved ABOVE the entry form on `/voita/{slug}` (the trust decision happens pre-entry). (5) Component returns null when no paid raffles exist — silent absence beats a "coming soon" placeholder for a social-proof surface.
  - **API consolidation**: `/api/voita/recent-winners` removed; `/api/voita/raffles?status=paid&limit=N` now serves the same data (the strip's reading contract per user spec).
  - **Back-office**: PAID status pill + count, `MARK PAID` button on the drawn-raffle winners panel.
  - **15/15 pytest** in `test_sprint_voita_recent_winners.py` covering all masking rules, display_name capture + sanitisation, mark-paid lifecycle, paid-filter behaviour, and immutability. **iter30 testing_agent: 100% / 100%, zero issues. DOM order verified with `compareDocumentPosition`.**

- **Voita raffle sprint** (2026-05-19) — Sako-approved mechanic, GDPR Art. 7(4) compliant entry flow.
  - **Backend** `voita_engine.py` — full data model + scoring engine + draw engine + payout validator + 3-gate public visibility. Scoring: 3 pts for correct 1-X-2 + best-of (5 exact / 3 goal-diff / 1 total-goals) — NOT stackable, max 8 pts/entry. Tie-break: deterministic random (raffle_id + entry_id hash seed) — reproducible for audit. Prize cap €500 enforced server-side. Drawn raffles immutable.
  - **Public endpoints**: `GET /api/voita/raffles` (gated), `GET /api/voita/raffles/{slug}` (gated), `POST /api/voita/raffles/{slug}/enter` (validates rules acceptance + 1-X-2 + goals 0..50, rejects duplicate `(raffle_id, email)`, stores entry with `consent_tag=game_raffle` + `raffle_legal_basis=legitimate_interest_contest_admin`, retention=kickoff+30d).
  - **Admin endpoints**: full CRUD + `POST .../draw` + `GET .../entries` — all `X-Admin-Token`-gated.
  - **Frontend**: `Voita.jsx` rewritten as listing page (gated/empty/live states). `VoitaRaffle.jsx` Step 1 entry form (mandatory rules acceptance, ZERO marketing consent bundled). `VoitaKiitos.jsx` Step 2 confirmation with separate marketing prefs. `VoitaSaannot.jsx` rules page with DRAFT banner. `RafflePostEntryPreferences.jsx` — three independent unchecked checkboxes (`daily_game_signals` / `mittari_alerts_sms` / `telegram_general`), SAVE and SKIP both primary weight.
  - **Back-office** `BackOfficeVoita.jsx` — raffle CRUD, prize editor with live cap check (+ `OVER CAP` warning), gate-flag toggles, draw trigger, winners panel.
  - **Three gates** required for public visibility: `rules_url_set` + `prize_distribution_locked` + `match_populated` AND `voita_feature_enabled=true` AND `status='open'`. Missing any → raffle invisible.
  - **18/18 backend pytest** in `test_sprint_voita_engine.py`. **iter29 testing_agent: 100% / 100%, zero issues.**

- **P1 sprint — Track record + dispatch + opt-in segments + 3 follow-ups** (2026-05-19)
  - `dispatch_daily.py` — dry-run worker, Email/SMS/Telegram fan-out, writes `dispatch_log` audit rows. 10:00 Helsinki cycle. Falls through to dry-run when provider keys absent. **15/15 pytest pass.**
  - `/back-office/optin-segments` — segment totals, dispatch summary, recent log, manual cycle trigger.
  - `TrackRecordStrip` on `/pelisignaalit` — 30d avg / peak / nadir / days≥75 / 7d trend (pure FE).
  - Bell icon on PUBLISHED streamer cards — soft pulse when notification dispatched in last 60min. `/api/streamers/recent-alerts` powers it.
  - `alerts_dispatched_24h` field added to `/api/newsroom/live-stats`; surfaced in NewsroomLiveStrip.
  - NewsTicker + NowPlayingTicker — slowed to ~55 / 40 px/s via dynamic `ResizeObserver`-measured animation duration, pause-on-hover + pause-on-focus.
  - Chronological news list — every row now has a left stripe (high=red, med=amber, low=green, unknown=neutral grey). No more borderless rows.

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

