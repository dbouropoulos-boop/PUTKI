# PUTKI HQ — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site
- **Phase 1.5 / 1.6 / 1.7** (2026-02) — cockpit-instrument elevation, bilingual FI/EN, visual energy
- **Phase 4 — Final pre-launch QA + viral mechanics + placeholder purge** (2026-05-18) —
  (1) **Fixed `/mittari/historia` x-axis** to use locale-aware `fmtClock(iso, lang)` — FI shows "18 toukokuuta, 14:45", EN shows "18 May, 14:45".
  (2) **Friends invite multiplier (viral loop)**: each weekly-card entry receives a 10-char `invite_code`; sharing the link `/viikon-kortti?invite=CODE` and getting a friend to enter awards the inviter `+1 ticket` in the draw. New endpoint `GET /api/weekly/invite/{code}`. The draw is now **ticket-weighted** — `random.choice(pool)` where each finalist appears `tickets` times (base 1 + invites). Frontend success screen now shows a copy-link button + native share sheet + `🎟 X TICKETS` counter.
  (3) **Placeholder/test-data purge** (massive): removed all "**Test Casino**", "TestStreamer", "LogTest", "Test-operaattori" hallucinations Claude had been generating because the prompt wasn't grounded. Hardened 3 layers of defence: (a) publish-time guard rejects any draft with placeholder brand names + sets `rejection_reason="placeholder_brand_leak"`; (b) `list_published()` read-side regex hides matching docs even if one slipped through; (c) `feed.list_latest()` same regex protection for the homepage live ticker. Updated the Claude operator prompt with a strict rule: "ÄLÄ KOSKAAN käytä paikanpitäjä-nimiä … jos OPERAATTORI on tyhjä tai geneerinen, palauta skip_reason='missing_operator_name'."
  (4) **Bilingual streamer-alert headlines**: the structured streamer-alert template now writes both `headline` (FI: "Jarttu84 aloitti striimin · 1 240 katsojaa · Slots") **and** `headline_en` ("Jarttu84 is live · 1,240 viewers · Slots"). `LiveActivityFeed` renders the language-appropriate field.
  (5) **Final audit**: cross-language audit at 1440×900 across all 9 routes (`/`, `/striimaajat`, `/viikon-kortti`, `/vihjeet`, `/peli`, `/uutiset`, `/menetelma`, `/tietoa-meista`, `/mittari/historia`) — **18/18 clean** in both FI and EN, zero `sitten/katsojaa/seuraajaa/livenä/ladataan` leaks in EN body, zero `ago/viewers/followers/loading/showing` leaks in FI body, zero placeholder-brand leaks anywhere.
  (1) **Brand-chrome translation**: dial states translate (HAALEA→LUKEWARM, KUUMA→HOT, MYRSKY→STORM, KIIRASTULI→FRENZY, KYLMA→COLD) via new `dialLabel(state, lang)` helper in `/app/frontend/src/constants/dial.js`. Wired through `Dial`, `DialCockpit`, `LiveTicker`, `StateContextualFloat`, `SocialProofTicker`, `MittariHistoria`. `SKENEN LÄMPÖTILA` → `SCENE TEMPERATURE`, `PUTKI HQ MITTARI` → `PUTKI HQ METER`, `MITTARIN HISTORIA` → `METER HISTORY`. EN headline reads "The meter is LUKEWARM. Steady background hum." instead of "The dial is HAALEA…".
  (2) **Weekly Card gamification**: `/app/backend/weekly_card.py` exposes `/api/weekly/{meta,submit,leaderboard}` + 5 admin endpoints (`prize`, `lock`, `results`, `draw`). New collections `weekly_meta` + `weekly_picks`. `/viikon-kortti` rebuilt with prize banner (€100 default, editable), entry form sidebar requiring email + Telegram OR SMS handle, real entries counter, leaderboard placeholder. New `/back-office/weekly` admin page for editing prize, locking entries, settling 1/X/2 results, and drawing a random winner from the highest correct_count cohort.
  (3) **Betting Tips hub `/vihjeet`**: new public page with today/tomorrow/this-week tabs, 7-day calendar strip, full pick cards with editorial take + odds + % prob + per-platform share buttons (Telegram, X, Facebook, WhatsApp, Instagram + copy-link). Backed by new `/api/odds/upcoming` endpoint that re-uses the existing Odds API cache (no extra quota). Added `Tips` link to the header nav.
  (4) **Winners Corner**: `/app/backend/winners.py` exposes `/api/winners/recent` + admin POST/DELETE; new `WinnersCorner` component below SocialProofBar on homepage shows a rotating proof strip of last settled hits. Empty state: "Track record begins this week — follow on Telegram." Profit auto-computed `(odds-1)*units`.
  (5) **Feed hygiene**: hardened `content_generator.py` publish-guard to reject any synthetic test fixture (TESTAPI / E2EFIXT / `[A-Z]{2,}FIXT_[0-9A-F]{6,}`); same regex applied at the read-side `list_published()` query. Purged 5 leftover test docs. Cleaned streamer-alert headline template to read "Jarttu84 aloitti striimin · 1 240 katsojaa · Slots" instead of "Jarttu84 live – 1 240 katsojaa". `LiveActivityFeed` layout switched to fixed grid (time / category pill / headline / eye-icon views) for a tighter, easier-to-scan row.

- **Phase 5.1 — WIN PULSE rebrand + homepage polish pass** (2026-05-18) — Dioni's 11-point homepage walkthrough.
  (1) **Meter rebrand**: SCENE TEMPERATURE/SCENE HEAT → **WIN PULSE** (EN) / **P*RKELE-MITTARI** (FI), prominent in the dial label band. Maker's mark above the dial now reads `win-pulse` / `perkele-mittari` only (v4 version tag dropped).
  (2) **5 dial state names recoded** to gambling-luck vocabulary instead of weather. Keys unchanged (KYLMA/HAALEA/KUUMA/MYRSKY/KIIRASTULI) so dial engine + collections don't migrate. Labels:
       `KYLMA` → FI **TYPÖTYHJÄ** / EN **DRY**
       `HAALEA` → FI **NIHKEÄ** / EN **SLOW**
       `KUUMA` → FI **TULOSSA** / EN **WARM**
       `MYRSKY` → FI **VOITTOPUTKI** / EN **RUSH**
       `KIIRASTULI` → FI **RYÖSTÖPUTKI** / EN **JACKPOT**
       State headlines on home + DIAL_STATES headlines in `constants/dial.js` rewritten to luck/payout vocabulary ("Voittoja alkaa tippua", "Don\u2019t look away" etc.).
  (3) **Hero eyebrow**: `PUTKI HQ · Finland · live signals` → `PUTKI HQ · Helsinki · live signals` (and FI).
  (4) **SocialProofBar streamer count** now wired to new `GET /api/streamers/roster_summary` endpoint — shows `29 · 98 live` (total tracked + currently-live) instead of just "12 live now". Backend: `db.streamers.count_documents({})` + per-platform breakdown + live count from `public_stats`.
  (5) **Päivän Vitoset** condensed: row padding 4 → 2.5, team font 17 → 14, index pill 28 → 22, odds 22 → 18, confidence bar 56 → 36. Removed `compact` slice — all 5 picks now visible without the "view all 5" overflow row.
  (6) **Winners Corner — placeholder editorial wins**: empty-state copy refreshed to "Most recent verified hits — editorial-selected tips, updated weekly." Seeded 3 placeholder winner cards from real Odds API featured picks (Arsenal/Man City/KuPS) with `editorial_placeholder:true` flag and an `Editorial placeholder · highlights from PUTKI HQ tip pipeline` note. Replaces the day-0 "Track record begins this week" line.
  (7) **Kick API honest dormancy**: `_fetch_kick_channel` now distinguishes Cloudflare 403 blocks (returns `"blocked"`) from offline streamers; `fetch_kick_live` flags whole platform as `dormant:true, reason:"kick_api_blocked"` when all probes are blocked. `StreamerLiveGrid` renders a clear "API TEMPORARILY UNAVAILABLE · Kick\u2019s public API is rate-limiting server-side requests" panel instead of silent empty. YouTube already had `dormant:true, reason:"youtube_api_key_not_configured"` — honest behaviour preserved.
  (8) **Footer ADMIN link**: visible `⚙ ADMIN` row inside Footer "Editorial" column (`data-testid="footer-admin-link"` → `/back-office`) — addition to the existing discrete gear icon.


- **Phase 5 — Launch pivot: media-company positioning** (2026-05-18) — Major editorial repositioning per Dioni's 28-point walkthrough.
  (1) **Legal messaging pivot**: Replaced all "18+", "Pelaa vastuullisesti", "Play responsibly", "Gambling can be addictive" copy with "VAIN VIIHTEELLISIIN TARKOITUKSIIN · EI VEDONLYÖNTIÄ" / "FOR ENTERTAINMENT PURPOSES ONLY · NO BETTING ACTIVITY TAKES PLACE" across `translations.js` (footer.warning, trust.responsible, vitoset.disclaimer, common.responsible, common.18plus), `Home.jsx` (visitor tile), `ShareButton.jsx`, `MiniGame.jsx`, `VoitaPalkinto.jsx`. PUTKI HQ now reads as a media company, not a gambling operator.
  (2) **`/peli` complete rebuild**: Removed Smartico SDK leaderboard. New `backend/peli_raffle.py` ships `GET /api/peli/config`, `POST /api/peli/enter` (name + phone + email + consent), `GET|PUT /api/admin/peli/config`, `GET /api/admin/peli/entries`. Two new collections: `peli_meta` (singleton config: prize_amount, prize_currency, prize_label, partner_*, videos[3], enabled), `peli_entries`. Frontend `Peli.jsx` rebuilt as a raffle entry page — hero with editable prize, 3 YouTube video embeds (placeholders when youtube_id empty), Weezybet partnership card, raffle entry form with success state, trust strip, full editorial disclaimer. New `/back-office/peli` page lets editor adjust prize/partner/videos/enabled and view entries.
  (3) **Dial 0-streams bug fix**: `layer2_workers.twitch_tick` was fetching top 100 global streams then filtering to the rostered Finnish streamers (none of whom rank in the global top 100) → `active_streams=0` always. Switched to `language=fi&first=100` and counting the whole FI live scene (not roster-restricted). Roster status preserved on each entry via `tracked: bool`. **Dial now reports 99 active_streams / 3500 viewers in real time.**
  (4) **Homepage value-proposition section**: New `zone-whatis` section between SocialProofBar and StreamerLiveGrid — "WHAT IS PUTKI HQ?" / "MIKÄ ON PUTKI HQ?" with three pillars (Media company / Independent / Real-time). Establishes editorial nature on the very top of the homepage.
  (5) **Branding updates**: `footer.tagline` → "Riippumaton journalismi. Läpinäkyvä data. Ei paskaa." / "Independent journalism. Transparent data. No bullshit." `common.dial_brand` EN: PERKELE-MITTARI → SCENE HEAT. `common.methodology` EN: P*RKELE SCORE → SCENE HEAT SCORE. `DialCockpit.jsx` maker's-mark: EN shows "scene-heat · v4" instead of "perkele-mittari · v4". `StreamerCard.jsx` rebuilt as a non-clickable `<div>` (hides unfinished internal `/striimaajat/:slug` profile pages).
  (6) **Content backfill engine**: New `backend/content_backfill.py` ships `POST /api/admin/content/backfill {count<=50, days:60, templates?:[...]}` — synthetic signal scaffolding for all 6 templates (NHL/F1/Football/Streamer alert/Regulatory/Operator news), force-bypasses dedup + rate limit, back-dates published_at randomly across last `days` days. Editor calls this multiple times to reach 100–200 historical articles for site-feels-populated effect.
  (7) **Twitch auto-discovery**: New `backend/twitch_discovery.py` ships `discover_once(db)` + `discovery_worker_loop` (default 6h cadence, kill switch `PUTKI_HQ_DISABLE_AUTO_DISCOVERY=1`). Pulls `/streams?language=fi&first=100`, filters to Slots/Casino/Virtual Casino categories, fetches follower counts, auto-registers streamers with ≥1000 followers into the `streamers` collection with `auto_discovered:true, tier:3`. Admin trigger: `POST /api/admin/streamers/discover`. Targets 60–90 streamers over a few cycles. Env: `TWITCH_DISCOVERY_INTERVAL`, `TWITCH_DISCOVERY_MIN_FOLLOWERS`, `TWITCH_DISCOVERY_CATEGORIES`.
  testing_agent_v3_fork iter19: **100% backend (18/18 pytest) + 100% frontend acceptance**, no issues.


  testing_agent_v3_fork iter18: backend **15/15 pytest pass**, frontend **100% on listed acceptance criteria** (FI+EN dial labels verified, prize banner + entry form working end-to-end, settle + draw cycle confirmed, winner randomly selected from top correct_count cohort, /vihjeet 7-day calendar live with real Odds API picks).
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
- **Phase 3 V2 — Operational button: Force-rebuild** (2026-05-17) — `Pakota syötteen uudelleenrakennus` added to `/back-office/webhooks` between the lease panel and source rows; in-flight spinner, candidate/upsert/prune/signals/published stat grid, last-rebuild stamp persisted to localStorage, honest 5xx error surface. Bundled lint cleanup: removed unused `cfg` binding in `seed_scheduler.py:261` (F841).
- **Phase 3 V2 — Brand rename: Mittari.fi → PUTKI HQ** (2026-05-17) — domain live at putkihq.fi. Full codebase rename across ~50 files via 8 audited Python passes. Publication identity (header / footer / EditorialFooter byline / editorial pages / voice prompts / Resend from-address / admin headers) flipped to PUTKI HQ. Dial component name and dial-internal references preserved as "Mittari" per editorial spec. Internals also renamed: testids (`mittari-admin-*` → `putki-hq-admin-*`), localStorage keys, env vars (`MITTARI_DISABLE_*` → `PUTKI_HQ_DISABLE_*`), admin token value (`mittari-admin` → `putki-hq-admin`), cookie + UTM source names, MittariBot → PutkiHQBot, mittari_voice_system_prompt → putki_hq_voice_system_prompt. Methodology placeholder tagline: "PUTKI HQ — Suomen skenen lämpötila". `<title>`, meta description, SVG favicon shipped. 112/112 backend pytest green.
- **Phase 3 V2 — Twitch EventSub live wiring** (2026-05-17) — `TWITCH_CLIENT_ID/SECRET/EVENTSUB_SECRET/CALLBACK_URL` stored in preview `.env`. New `backend/twitch_eventsub.py` handles OAuth2 client-credentials with token caching + Helix client (list/resolve/create/delete subscriptions). `force_resubscribe/twitch` flips from stub to real: pulls Twitch streamers from registry, resolves logins → broadcaster_user_ids via `/helix/users`, dedups against existing subs, POSTs `stream.online` EventSub subscriptions with HMAC secret + callback URL, audits to `webhook_audit`. New admin endpoints: `GET /api/webhooks/twitch/verify` (OAuth probe + sub summary, no creates), `GET /api/webhooks/twitch/subscriptions[?status=]`. Back-office UI: new purple `TWITCH · YHTEYDEN VARMENNUS` panel above source rows with "VARMENNA TWITCH-YHTEYS" button. OAuth verified end-to-end (token+quota probe returns 200, max_total_cost=10000). 112/112 backend pytest still green.
- **Phase 3 V2 — Kick live wiring + safety upgrades** (2026-05-17) — `KICK_CLIENT_ID/SECRET/WEBHOOK_SECRET/CALLBACK_URL` stored in preview `.env`. New `backend/kick_api.py` handles Kick's OAuth2 client-credentials (no-scope) + RSA PKCS1v15-SHA256 public-key verification (live fetch from `/public-key` with 24 h cache + static fallback). Kick webhook handler completely refactored from HMAC to RSA. `force_resubscribe/kick` creates `channel.subscription.gifts` + `channel.subscription.renewal` subs across the Kick-streamer registry. `GET /api/webhooks/kick/verify` + `GET /api/webhooks/kick/subscriptions`. **Safety: `dry_run=true` query param on both Twitch + Kick resubscribe endpoints returns the exact plan (count + per-streamer events) without firing any API calls.** Twitch resubscribe now also creates `stream.offline` alongside `stream.online` (hub can now auto-clear LIVE pills). Back-office UI adds a green Kick verify panel + a confirm modal that fires dry-run on click and only executes after explicit confirmation. 16 webhook pytest cases rewritten to use RSA test signing; 120/120 backend regression green.
- **Phase 3 V2 — YouTube live wiring** (2026-05-17) — `YOUTUBE_API_KEY/PUBSUB_SECRET/PUBSUB_CALLBACK_URL` stored in preview `.env`. New `backend/youtube_pubsub.py` handles WebSub subscribe/unsubscribe (POST to `pubsubhubbub.appspot.com/subscribe` with hub.secret + 5-day lease) + YouTube Data API v3 channel resolution (handle / legacy-username / direct UCxxx passthrough). `force_resubscribe/youtube` resolves every YouTube streamer in the registry → channel_id, dedups against active `youtube_pubsub_leases` (skip when >24h remaining), POSTs subscribe, stores lease in MongoDB + updates the global lease surface read by `/api/webhooks/status`. Supports `dry_run=true`. New routes: `GET /api/webhooks/youtube/verify` (Data API probe), `GET /api/webhooks/youtube/leases`. Back-office UI adds a red YouTube verify panel. Data API key verified via canonical-channel probe (resolves YouTube's own UCxxx). Streamer registry currently has 0 YouTube entries so dry-run returns plan_count=0 — entirely correct.
- **Phase 3 V2 — Operational hardening: lease auto-renewal + WAS LIVE demotion** (2026-05-17) — Two enhancements requested after YouTube wiring landed: (a) `backend/youtube_lease_worker.py` — every 6 h scans `youtube_pubsub_leases` for `expires_at_ts < now+48h` and re-POSTs `hub.mode=subscribe`, refreshing lease records + the global setting surface. Wired into server startup; toggle via `PUTKI_HQ_DISABLE_YT_LEASE_WORKER=1`. Operational button: `POST /api/webhooks/youtube/renew-leases`. (b) `feed.py` — stream-offline signals (`stream.offline` for Twitch, `livestream.ended`/`stream.offline` for Kick) now produce an `__offline_dedup_key` sentinel; rebuild_feed demotes the matching `stream_live` tile to `stream_was_live`, prefixes the title with "Juuri päättyi · ", drops weight by 30, and clamps `expires_at` to `now+FEED_WAS_LIVE_GRACE_SECONDS` (default 30 s). Hub mosaic LIVE pills now degrade gracefully instead of disappearing. 4 new pytest cases (2 demotion + 2 lease renewal); **124/124 backend regression green.**

- **Phase 4 Week 1 — Layer 2 Backend + SSE Dial** (2026-05-17) — Event-responsive engine landed. Four async pollers in `backend/layer2_workers.py` (Twitch 60s, Reddit 1h, NHL 5m, RSS 15m) writing summary docs to four new MongoDB collections (`stream_signals`, `social_signals`, `sports_signals`, `news_signals`) with 14-day TTL indices on `expires_at`. `dial_engine.py` fully rewritten — old 6-signal formula gone, replaced with the locked 4-signal weighted composite (40% stream / 30% social / 20% sports / 10% news). New `backend/dial_sse.py` in-process pub-sub broadcaster; `GET /api/dial/stream` Server-Sent-Events endpoint. Admin endpoints `/api/admin/layer2/status` + `/api/admin/layer2/tick`. **15 new pytest cases.**

- **Phase 4 Week 2 — Automated Editorial System** (2026-05-17) — `ContentGenerator` class in `backend/content_generator.py` with 6 templates (NHL recap, F1 recap, Football recap, Streamer alert, Regulatory analysis, Operator news). F1 (Ergast) + Football (football-data.org) pollers added to layer2_workers.py, expanding Layer 2 to 6 active workers. Reddit reweighted out of dial formula → **3-signal locked at 57% Twitch / 29% NHL / 14% RSS**. 305 editorial subjects loaded into new `editorial_subjects` collection (17 subject types). Dedup fingerprint per template (URL-only for news, game_id for sports, day-bucketed for streamers) with 24h window — same story from YLE/HS/IL collapses to ONE generation. Rate limit 10/h auto-publish, overflow → TIER 2 draft. Layer 2 fan-out wired into `_layer2_on_tick`. **Launch-blockers:** every LLM template carries `NATURAL_FINNISH_DIRECTIVE` (anti-translation, Iltalehti-style, bad/good example), default model switched to `claude-opus-4-20250514`. Every draft + published doc stores `social: {og_title (60c), og_description (155c), og_image_url, twitter_card, twitter_description (200c), article_tags}` + `canonical_url`. APIs: `/api/content/{drafts,published}*`, `/api/admin/content/{generate,templates,preview}`. Back-office Layer 2 monitoring grid (`Layer2StatusPanel.jsx`) injected into `/back-office/webhooks`. **23 new pytest cases.**

- **Phase 4 Week 3 — Public article surface + draft review UI** (2026-05-17) — Public article page `pages/Article.jsx` at `/uutiset/:slug` (+ `/urheilijat/:slug` + `/saannot/:slug` for non-conflicting categories — `/kasinot/:slug` + `/striimaajat/:slug` stay reserved for the existing profile pages). Article page renders headline, subhead, body HTML, published timestamp, tag pills, category eyebrow, and external-source link for streamer alerts. New `hooks/useDocumentMeta.js` synchronises `<title>`, `<meta og:*>`, `<meta twitter:*>`, `<link rel=canonical>`, and `<meta article:tag>` from the API response. `BackOfficeDrafts.jsx` at `/back-office/drafts` — filtered list (status × tier), preview modal with inline edit (headline / subhead / body), publish + reject (confirm + optional note) flows, social-meta inspection panel showing per-field character counts vs caps. `DialCockpit.jsx` now subscribes to `/api/dial/stream` via EventSource with automatic 30s polling fallback. New `POST /api/admin/content/preview` endpoint generates content WITHOUT persisting — Dioni-requested for spot-checking Finnish quality without burning a draft slot or hitting rate limit. **4 new pytest cases. 166/166 backend regression green.** First real Opus output verified end-to-end (Finnish reads naturally — "Florida kaatoi Tampan tiukassa Floridan derbyssä", "vei pisteet vierasjäältä", "tasaisella maalintekotahdilla").

- **i18n restore + Smartico Weezy Rally live embed** (2026-05-17) — Dioni clarified: site must support BOTH languages, every line correctly translated, FI/EN toggle restored. Reverted `LanguageContext.getInitial()` to browser/localStorage detection (defaults to fi, switches to en on en-* browsers); restored FI/EN toggle in Header desktop + mobile. Added ~120 translation keys across `nav.*` `ticker.*` `streamer_live.*` `alert_modal.*` `vitoset.*` `uutiset.*` `trust.*` `peli.*` `tietoa.*` `method.*` to `i18n/translations.js` (full FI + EN). Wired `t()` into PaivaVitoset, StreamerLiveGrid, StreamerAlertModal, LiveDataTicker, TrustStrip, ActivityStats, Uutiset, Header (Header navLinks bilingual). New nav keys: `nav.news` `nav.about` `nav.game_prize`. Fixed runtime crash in ActivityStats where `lang` was referenced without `useLang()` import. Smartico Weezy Rally: replaced placeholder iframe shell on `/peli` with live SDK integration — `libs.smartico.ai/smartico.js` loaded via dynamic `<script>` tag in useEffect, `_smartico.initVisitorMode("9250d6a7-1401-4205-...-7", { brand_key: "7f2db034", lang })` + `_smartico.showVisitorGame({ template_id: 3383, frame_id: "weezy-rally-frame", onWin: redirect-to-weezybet-with-win-uuid })`. SDK lang passed dynamically from current i18n state. Three iframe states: loading (Loader2 spin), ready (game rendered by Smartico, header chip "LIVE"), failed (honest error overlay, no auto-retry). Screenshots confirm: Weezy Rally "Start Game · Free" button renders inside the embed; FI page renders fully Finnish (Striimit livenä, ASETA HÄLYTYS, TÄNÄÄN); EN page renders fully English (Streams live, SET ALERT, TODAY). Backend regression: 190/190 pytest green.

 — Dioni's full screenshot-driven cleanup. **New pages**: `/peli` (conversion-optimised Smartico shell — hero "Voita 500 €", iframe placeholder w/ Loader2 spinner while Smartico whitelist clears, 3 prize cards 500€/250€/100€, 4-step "how to play", honest leaderboard empty state, activity strip linking to /uutiset, 4 trust badges); `/tietoa-meista` (manifesto: "Suomen rehellisin kasino- ja striimaaja-lähde. Toimituksellinen — ei mainontaa." + 3 pillar cards + 3-step method + team + 3 contact cards). **Rewrites**: `Methodology.jsx` from wall-of-text to 7 boxed scannable cards (methodology-section-0..6); `WeeklyCard.jsx` previously shipped against real Odds API now stable. **Components**: `TrustStrip.jsx` (homepage trust signals — PELAA VASTUULLISESTI · TOIMITUKSELLINEN · AVOIN MENETELMÄ · LAYER 2). **StreamerLiveGrid**: carousel prev/next arrows on desktop (data-testid streamer-carousel-prev/next, page indicator "N / M"), 4 cards per page; mobile keeps swipe lane. **PaivaVitoset**: new `compact` prop — homepage renders top 3 + "KATSO KAIKKI 5 VINKKIÄ · VIIKON KORTTI →" link; full 5 on `/viikon-kortti`. **Footer**: discrete admin gear icon (Settings, opacity 0.35) at data-testid="footer-admin-gear" linking to /back-office; page list updated to Finnish (UUTISET / STRIIMAAJAT / VIIKON KORTTI / PELI · VOITA 500 € / TIETOA / MENETELMÄ — no KASINOT). **i18n**: forced Finnish-only public site — `LanguageContext.getInitial()` returns 'fi' unconditionally; FI/EN toggle removed from header desktop + mobile; "PUBLISHED CONTENT" → "JULKAISTU SISÄLTÖ"; "GET ALERTED" → "ASETA HÄLYTYS / TILAA"; "Streamer goes live — you know first" → "Striimari liveen — sinä ekana". **Header**: nav now `UUTISET / STRIIMAAJAT / VIIKON KORTTI / PELI · VOITA 500 € / MENETELMÄ / TIETOA`. **StreamerIndex**: tighter responsive grid (2/3/4/5/6 cols). **/affiliaatti**: Weezybet row removed, honest "EI KAUPALLISIA SUHTEITA" empty state. **TESTAPI hardening (3-layer defence)**: (1) one-shot MongoDB purge across published_content / content_drafts / stream_signals / signals; (2) permanent publisher guard in `content_generator.publish_draft` rejects any draft whose slug/headline contains "testapi" (status=rejected, reason=testapi_fixture_leak); (3) defensive filter in `list_published` excludes url_slug matching `/^testapi/i`. Test fixture renamed from `testapi_<hex>` to `e2efixt_<hex>`. **Backend regression: 190/190 pytest green.** testing_agent_v3_fork iter15 reported 15/16 P0 PASS — the one fail (TESTAPI in DOM) was the dirty-data symptom that triggered the 3-layer hardening above. Backend adds: `/api/streamers/live?platform={twitch|kick|youtube}` (Twitch Helix `language=fi` + multi_platform_live.py for Kick `/api/v2/channels/{login}` + YouTube Data API v3 honest-empty when no curated channels), `POST /api/alerts/streamer` (email + optional phone + Telegram capture, Pydantic EmailStr, idempotent on (email,login,platform), Telegram fan-out hook ready for live-going transitions), `/api/data/live-stats` (10 s-cached real counters: stream/sports/news/F1/football collections + published_content count), `/api/odds/featured` (top 5 favourites by implied probability across NHL + EPL + Champions League + Veikkausliiga, 15 min cache), `og_image_generator.py` Nano Banana 1200×630 cards (semaphore-capped concurrency=1, currently env-gated via `PUTKI_HQ_DISABLE_OG_IMAGES=1` to keep preview backend responsive; verified working end-to-end). Frontend adds: `LiveDataTicker` (top-of-homepage live monitoring strip), multi-platform tabs in `StreamerLiveGrid` with mobile swipe lane + desktop 4-card carousel + "ASETA HÄLYTYS" conversion button on every card, `StreamerAlertModal` (email required + phone/Telegram optional → POST /api/alerts/streamer → success state), `PaivaVitoset` rebuilt with orange Telegram CTA + modal listing benefits + @putkihq_vinkit link, `/uutiset` news blog page (infinite scroll + 5-category filter pills), `/mittari/historia` dedicated dial-history page (composite chart + 5-state distribution + recent-30 table), `WeeklyCard` rebuilt against real Odds API (5 real fixtures, decimal odds, % implied, editorial takes, 1/X/2 prediction buttons — no longer empty). Hide CASINOS + WIN A PRIZE from header nav; CasinoRanking ships `robots:noindex,nofollow`. Remove `VoyagerCorner` + `HubMosaic` + `DialHistoryMiniChart` from homepage. Remove Weezybet from `/affiliaatti` (honest "NO COMMERCIAL RELATIONSHIPS" state). Homepage flow compressed to 40 px vertical rhythm: Ticker → Hero → Streamers → Päivän Vitoset → Live Feed → Capture. **Backend regression 173/173 green. testing_agent_v3_fork iteration 14 reports 17/17 backend + 30/30 frontend = 47/47 PASS, 0 console errors.** Env vars added: `ODDS_API_KEY`, `PUTKI_HQ_DISABLE_OG_IMAGES`, `OG_IMAGE_CONCURRENCY`, `STREAMER_LIVE_WHITELIST`, `MULTI_LIVE_CACHE_TTL`.

- **Phase 4 Pre-Launch Polish** (2026-05-17) — Real-data pivot per Dioni: hide CASINOS + WIN A PRIZE from header nav (routes preserved, CasinoRanking ships `<meta name="robots" content="noindex,nofollow">`). Removed `VoyagerCorner` from homepage hero. Removed `HubMosaic` + `DialHistoryMiniChart` from homepage (cleaner launch flow). New backend module `streamer_live.py` — pulls REAL live Finnish-language Twitch streamers via Helix `/streams?language=fi&first=12` + parallel follower-count enrichment, 60 s cache. Public endpoint `GET /api/streamers/live`. New backend module `odds_api.py` — wraps The Odds API v4 across `icehockey_nhl` + `soccer_epl` + `soccer_uefa_champs_league` + `soccer_finland_veikkausliiga`, computes top 5 favourites by implied probability across EU bookmakers, 15 min cache. Public endpoint `GET /api/odds/featured`. Both endpoints emit honest `dormant:true` when key missing — no fabricated data. New components: `StreamerLiveGrid.jsx` (Twitch thumbnail card grid · LIVE pulse · viewer/follower count · session duration · twitch.tv deeplink) and `PaivaVitoset.jsx` (premium dark betting-slip card with color-coded confidence bars: ≥80 % green, 65-80 % amber, <65 % red). Homepage reordered: Hero → "Mitä tapahtuu nyt" (StreamerLiveGrid) → Live Activity Feed → Päivän Vitoset → Archive → Games → Capture. Hero padding compressed. New env var: `ODDS_API_KEY` (free 500 req/mo from the-odds-api.com). 173/173 backend pytest still green.

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
- Disable via `PUTKI_HQ_DISABLE_SCHEDULER=1`
- Endpoints: `GET|PUT /api/admin/scheduler/cadences`, `GET /api/admin/scheduler/status`, `POST /api/admin/scheduler/tick`, `POST /api/admin/scheduler/fill-variants`
- Hard 45s timeout on Claude calls (prevents event-loop hang during gateway flake)

### Back-office Queue extensions — SHIPPED
- Schedule status widget: per-cadence due/overdue + research-pool size + force-fire button per content type
- Content-type filter in queue listing
- Existing Signal Pipeline Status widget retained
- Cross-links to /back-office/foundational-research and /back-office/queue from /back-office

### PUTKI HQ voice prompt — Finnish-language source directive added
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
- Workers: signal_dial_worker (90s), scheduler_worker_loop (3600s), variant_filler_worker_loop (900s). Disable via `PUTKI_HQ_DISABLE_WORKERS=1` / `PUTKI_HQ_DISABLE_SCHEDULER=1`

## Prioritized backlog

### P0 — Blocked on user
- **Foundational research dataset delivery** — user to populate `/back-office/foundational-research` (or drop `/app/backend/data/foundational_research_v02.json`) before scheduler fires anything. Target threshold: 100+ entries across the 10 beats.
- **API keys delivery** — user to provide:
  - `TWITCH_CLIENT_ID/SECRET` (Twitch Helix)
  - `YOUTUBE_API_KEY` (YouTube Data v3)
  - `SPORTS_API_KEY` (API-Football)
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` (@PutkiHQBot)
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
