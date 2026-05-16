# Mittari.fi — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site with mock data
- **Phase 1.5** (2026-02) — Cockpit-instrument visual elevation, dial V2, 8 fixes
- **Phase 1.6** (2026-02) — Bilingual FI / EN
- **Phase 1.7** (2026-02) — Visual energy layers (live ticker, atmospheric glow, grain, count-ups)
- **Phase 1.5 (Revised)** (2026-02) — Architectural restructure for conversion
- **Phase 2.0** (2026-05) — Liveness layer (real-time activity feed, breathing dial, social-proof signals, signup toasts, push toasts, Telegram + back-office, shareable cards, 24h sparkline)
- **Phase 2.5** (2026-05) — Page-by-page completion: real Twitch/Kick autoplay previews, full StreamerProfile rebuild, Weezy Rally canvas game with persisted leaderboard

## Architecture
- Frontend: React 19 + React Router v7 + Tailwind + shadcn/ui + html2canvas
- Backend: FastAPI + Motor (async MongoDB)
- DB: MongoDB collections — `signups`, `predictions`, `settings` (singleton _id="site"), `game_scores`
- Theming: CSS-variable-driven (light/dark), Helsinki-time default at 16:00+
- i18n: LanguageContext (FI default + EN)
- Fonts: Inter, Source Serif 4, JetBrains Mono
- Auth: Public site has none. /back-office gated by `BACK_OFFICE_TOKEN`. Game personalisation gated by client-generated cookie_id (uuid in localStorage `mittari_cookie_id`).

## Phase 2.5 — What's been built (2026-05)

### Real Twitch/Kick autoplay video previews
- **`StreamerVideoPreview`** — single shared component used by:
  - `LiveTilesGrid` (homepage live tiles)
  - `StreamerCard` (streamer index)
  - `StreamerProfile` profile-live-embed
- Twitch parent whitelist includes localhost, current hostname, and the production preview hostname.
- Trigger: `auto` resolves to `hover` on devices with hover, `viewport` (IntersectionObserver, threshold 0.45) on touch.
- Falls back to streamer.photo on iframe error or when offline.
- All 18 STREAMERS now carry a `channel` field for embed URLs.

### StreamerProfile full rebuild
Sections (in order, with data-testids):
- Cockpit hero — `streamer-profile-{slug}`, `profile-name`, `live-status` / OFFLINE row, `profile-stats` (4 stat cards: HOURS·7D, AVG WIN, AVG VIEW, STREAK·D), `profile-cockpit` (mini-dial + BIG WIN FREQ + TOP GAME)
- Status-aware CTA: `profile-watch-cta` + `profile-follow-when-offline` (LIVE) OR `profile-follow-form` → `follow-success` (OFFLINE)
- `profile-live-embed` full-width iframe (LIVE only)
- Mittari commentary (Topi voice, name-localized FI/EN)
- Biggest moments (4 cards)
- `schedule-grid` — cockpit calendar heatmap (7 days × 8 blocks)
- 4 `profile-op-{slug}` operator cards with hours played + last seen
- `profile-activity-feed` — 12-card mock event stream
- `rhythm-heatmap` — viewer concentration 7d × 24h
- Social posts (3 cards, mocked Phyllo placeholder)
- `profile-share` — html2canvas dial-state share
- 5 `profile-related-{slug}` carousel
- All per-streamer mock data is deterministic from slug seed (same streamer → same numbers across reloads)

### Weezy Rally — canvas + RAF game
- `/app/frontend/src/components/WeezyRally.jsx` — lightweight (no Phaser dep) canvas game
- 75-second stage, 3 crashes max, perspective road with lane stripes, cone + rock obstacles, blue nitro pickups
- Controls: ← → / A D steer, Space brake, ↑/W accelerate, mobile drag-to-steer
- HUD overlay: SCORE, TIME, CRASHES (red flash on time<10s and crashes≥2)
- Calls `onFinish({score, crashes, time_left, finished})`
- Wrapping `MiniGame.jsx` page submits to backend `/api/game-scores`, shows result panel with `rally-share` + `rally-challenge` CTAs, live `leaderboard-table` (with rank-tier coloring) + `leaderboard-personal` banner

### Backend additions
- `POST /api/game-scores` — body `{cookie_id (8-64), name?, score, crashes?, time_left?, week?, stage?}`. Returns `{id, rank, total, is_personal_best, week, stage, ...}`. Pydantic-validated.
- `GET /api/game-scores/leaderboard?stage=imatra&week=&limit=10` — sorted DESC by score, no cookie_id/_id leak. limit clamped 1..50.
- `GET /api/game-scores/me?cookie_id=&stage=imatra&week=` — personal best + rank + total.
- Week format: ISO calendar `2026W20`.

### Test results
- **Iteration 5** (Phase 2.5): backend pytest 29/29 (12 new game-score + 17 regression); frontend 100% on retest after `leaderboard-table` testid added. All Phase 2.0 surfaces still green (regression).

## Prioritized backlog

### P0 — next session
- **Personalization layer** (Priority 4): cookie-based returning-user treatment on Home + MISSASIT EILEN OMASI/KAIKKI toggle + ranking page contextual sort + Weezy Rally personal stats card on Home + Weekly Card personal status
- **Operator review pages** (Priority 5): live data strip, score component breakdown, tracked-streamer activity, alternative operators, recent moments at this operator, deeper analysis link
- **Casino ranking page** (Priority 6): #1 hero treatment, micro-stats per card, offer-vs-score visual hierarchy invert, expand to 25-30 operators, "Your streamers play at" filter, editorial pieces upgrades

### P1
- **Weekly Card** (Priority 7): Topi as a character + bio + weekly commentary, "Topi's strongest pick" elevation, deeper-take expanders, live match status, odds movement, personal rank banner
- **Methodology page** (Priority 8): 70/30 split visualization, score factor bar chart, score-waterfall example, score change log, About Mittari, affiliate disclosure table, conflicts-of-interest section, methodology version history
- **Signup flow** (Priority 9): single-field magic-link compression, Step 2 in later session, granular notification preferences

### P0 — Phase 3 (real signal layer, post-2.5)
- Twitch helix + Kick API live-status polling for actual streamer list
- Suomi24 + Ylilauta activity-volume signal scraping
- Notification delivery (Resend + Telegram bot + web push)
- Dial calculation engine fusing real signals
- `/api/notify-signup` endpoint + wire all email captures
- Real operator data + Trustpilot/AskGamblers signals
- Sports data feed (API-Football)

### P2
- Licensed Finnish operator partner onboarding
- CPA monetisation activation
- Pydantic HttpUrl validation on telegram_channel
- Phyllo integration for social posts on streamer profiles

## Test credentials
- Public site: no auth required
- Back-office: token `mittari-admin` at `/back-office`
- Game scores: client cookie_id (uuid in localStorage `mittari_cookie_id`)

## Next tasks
1. Personalization layer — cookie-based returning-user treatment across Home, MISSASIT EILEN, ranking
2. Operator review pages — live data strip, score breakdown, tracked-streamer activity, alternatives
3. Casino ranking page — #1 hero, micro-stats, expanded list, your-streamers-play-at section
4. Weekly Card upgrades — Topi character, deeper takes, live match status
5. Methodology page — visualizations, score-waterfall, change log, about
6. Signup flow — single-field magic-link compression
