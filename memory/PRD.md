# Mittari.fi — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site
- **Phase 1.5** (2026-02) — Cockpit-instrument visual elevation
- **Phase 1.6** (2026-02) — Bilingual FI / EN
- **Phase 1.7** (2026-02) — Visual energy layers
- **Phase 1.5 (Revised)** (2026-02) — Architectural restructure for conversion
- **Phase 2.0** (2026-05) — Liveness layer (activity feed, breathing dial, social-proof, toasts, Telegram, sharable cards, sparkline)
- **Phase 2.5** (2026-05) — Page-by-page completion (autoplay previews, StreamerProfile rebuild, Weezy Rally + leaderboard)
- **Phase 2.6 Batch A** (2026-05) — Architectural corrections + International expansion + Smartico Visitor Mode shell

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + html2canvas
- Backend: FastAPI + Motor (async MongoDB)
- DB: MongoDB collections — `signups`, `predictions`, `settings` (singleton _id="site"), `game_scores`
- Auth: Public site has none; /back-office gated by `BACK_OFFICE_TOKEN`; game personalisation by client cookie_id
- i18n: LanguageContext FI default + EN

## Phase 2.6 Batch A — What's been built (2026-05)

### Correction 1: Topi character removal
- All Topi references reattributed to **Mittarin toimitus** (institutional editorial team) — copy + bylines + leaderboard names + activity-feed Finnish-name pool
- New page **/toimitus** — placeholder editorial team page with three standards cards (INDEPENDENCE / CORRECTIONS / CONTACT) + "to be announced" contributors block + link to methodology
- WeeklyCard rebrand: "Mittarin viikon kortti", lede + bylines updated FI + EN

### Correction 2: International streamer expansion (Finnish core preserved)
- New route **/striimaajat/kansainvaliset** with 4 country tabs (`global` / `swedish` / `dutch` / `norwegian`)
- 8 mocked streamers across scenes (Roshtein, Trainwreckstv, Classybeef, CasinoDaddy, SweetFlips, MattiSlots, NederGaming, Halper-nl + Norwegian "to be announced" placeholder)
- Country-coded card tints + ISO badges (INTL/SWE/NLD/NOR)
- Per-scene editorial blurb panels (Mittari voice, FI/EN)
- Scene-specific moments (`INTL_MOMENTS`) — 6 mocked international highlights
- Hard disclaimer footer: **"KANSAINVÄLINEN AKTIVITEETTI EI SYÖTÄ P*RKELE-MITTARIA"** — dial stays exclusively Finnish
- Cross-link from `/striimaajat`: "Selaa kansainvälistä skeneä →"

### Correction 3: ActivityFeed + MISSASIT EILEN scene tabs
- ActivityFeed on home now has **SUOMI / KANSAINVÄLINEN** tab toggle (default SUOMI)
- New `useIntlActivityFeed` hook generates global-flavoured events (Roshtein/Trainwreckstv/Stake/Roobet/Reddit etc.)
- MISSASIT EILEN now has **SUOMI / KANSAINVÄLINEN / KAIKKI** three-state filter (default SUOMI)
- "all" combines FI + INTL moments

### Smartico Visitor Mode shell
- New page **/voita-palkinto** — separate from Weezy Rally retention game (per brief)
- Mittari-styled spin-the-wheel placeholder with 6 prize tiers — every spin wins
- Win flow: `mittari_weezy_visitor_uuid` cookie + localStorage (90-day) + win modal + claim CTA
- Returning-visitor state: replaces game with `visitor-claim-prompt` showing prize + UUID + Weezybet register link with UTM + UUID query params
- Back-office field `smartico_template_id` — when set, placeholder is replaced with `smartico-embed` wrapper containing `id='smartico-visitor-mode'` div carrying `data-template-id` (for future Smartico script injection)
- Cross-link to Weezy Rally for the alternate experience

### Cross-promotion (dial-state aware)
- New `GamesSection` on home replaces the old RALLY+WEEKLY block
- Dial-state banner: `MITTARI · {state} — ACTION MODE, RALLY UP TOP` (KUUMA+) vs `… QUIET HOUR, FREE SPIN UP TOP` (KYLMÄ/HAALEA)
- DOM order swap: hot states put `minigame-teaser` first, cold states put `visitor-teaser` first
- Weekly card teaser sits below in full-width

### Backend additions
- `SettingsPayload` extended: `smartico_template_id: Optional[str]` alongside `telegram_channel`
- `GET /api/settings/public` now returns `{telegram_channel, smartico_template_id}`
- Back-office UI gains the Smartico template ID input

### Header navigation
- Added "Voita palkinto" / "Win a prize" nav link

### Test results
- **Iteration 6** (Phase 2.6 Batch A): backend pytest **32/32** (3 new TestSmarticoTemplateId + 17 prior + 12 game-score regression). Frontend **100%** on all 16 brief checks. Zero console errors.

## Prioritized backlog

### P0 — next session (Phase 2.6 Batch B — Banner revenue infrastructure)
- 4 surface placements: right-rail (operator/methodology/streamer profile pages), homepage horizontal, operator featured-offer slot, sponsored ranking slot
- Mandatory `KAUPALLINEN YHTEISTYÖ` / `KAUPALLINEN SIJOITTELU` labels (cannot be disabled)
- Back-office banner CRUD: creative URL, surface assignment, start/end dates, operator attribution, click tracking, A/B variant, preview mode
- Forbidden surfaces enforcement: activity feed, MISSASIT EILEN, methodology interior, above-fold home, transparency pages, editorial columns

### P0 — Emergent Priority 4-9 roadmap (after Batch B)
- **Priority 4** Personalization layer (cookie-based returning-user treatment; intersects with intl filter on MISSASIT EILEN)
- **Priority 5** Operator review pages (live data strip, score breakdown, tracked-streamer activity)
- **Priority 6** Casino ranking page (#1 hero, micro-stats, expand to 25-30 ops)
- **Priority 7** Weekly Card upgrades — rebranded to "Mittarin viikon kortti" already; needs deeper-take expanders, live match status, odds movement, "Toimituksen vahvin veikkaus" elevation
- **Priority 8** Methodology page upgrades — 70/30 visualization, score-waterfall, change log, About Mittari (links to /toimitus), affiliate disclosure table
- **Priority 9** Signup flow compression to single-field magic-link

### P0 — Phase 3 (real signal layer)
- Twitch helix + Kick API live status polling
- Suomi24 + Ylilauta forum signal scraping
- Notification delivery (Resend + Telegram bot + web push)
- Dial calculation engine fusing real signals (Finnish-only)
- `/api/notify-signup` endpoint + wire all email captures
- Phyllo for streamer social posts
- Real Smartico script injection once user provides template_id

### P2
- Licensed Finnish operator partner onboarding
- CPA monetisation activation
- Pydantic HttpUrl validation on telegram_channel

## Test credentials
- Back-office: token `mittari-admin` at `/back-office`
- Game scores: client cookie_id (uuid in localStorage `mittari_cookie_id`)
- Visitor mode: `mittari_weezy_visitor_uuid` (90d cookie + localStorage; reset to test)

## Next tasks
1. **Banner infrastructure** (Phase 2.6 Batch B): 4 surface placements, back-office CRUD, mandatory labels, click tracking
2. Priority 4 — Personalization layer (cookie-based returning-user state)
3. Priority 5 — Operator review pages depth
4. Priority 6 — Casino ranking page hierarchy + expansion
5. Priority 7 — Weekly Card upgrades
6. Priority 8 — Methodology visualizations
7. Priority 9 — Signup flow compression
