# Mittari.fi — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site with mock data
- **Phase 1.5** (2026-02) — Cockpit-instrument visual elevation, dial V2, 8 fixes, streamer-submission form
- **Phase 1.6** (2026-02) — Bilingual FI / EN
- **Phase 1.7** (2026-02) — Visual energy layers (live ticker, atmospheric glow, grain, count-ups)
- **Phase 1.5 (Revised)** (2026-02) — Architectural restructure for conversion
- **Phase 2.0** (2026-05) — Liveness layer: real-time activity feed, breathing dial, social-proof signals, signup toasts, push toasts, Telegram + back-office, shareable cards, 24h dial sparkline

## Architecture
- Frontend: React 19 + React Router v7 + Tailwind + shadcn/ui + html2canvas
- Backend: FastAPI + Motor (async MongoDB)
- DB: MongoDB collections — `signups`, `predictions`, `settings` (singleton _id="site")
- Theming: CSS-variable-driven (light/dark), Helsinki-time default at 16:00+
- i18n: LanguageContext (FI default + EN)
- Fonts: Inter, Source Serif 4, JetBrains Mono
- Auth: Public site has none; /back-office gated by `BACK_OFFICE_TOKEN` env (header `X-Admin-Token`)

## Phase 2.0 — What's been built (2026-05)

### Liveness micro-motion
- **Dial breathing** — needle drifts ±2-3° via superimposed sin waves (amplitude scales with hot states)
- **Counter flash** — `CountUp` flashes amber on every value change
- **LED variants** — `.led`, `.led-blue`, `.led-amber` keyframes with state-coloured halos
- **Marquee rhythm** — `LiveTicker` slows/speeds via `ticker-rhythm-{state}` class (38 s on MYRSKY → 92 s on KIIRASTULI)
- **Session progress bars** — auto-incrementing amber bar at the bottom of every live tile (data-testid `session-progress-{slug}`)
- **State pulse** + **arc glow** — already present

### Real-time surfaces (mocked client-side)
- **`/data/mockStreams.js`** — `useActivityFeed`, `useLiveCounters`, `useSignupToast`, `usePushNotification`, `generateDialHistory`, `timeAgo`
- **ActivityFeedInline** (homepage) — Mittari-flavoured events: `streamer-live`, `big-win`, `jackpot-hit`, `operator-score-change`, `forum-heat-spike`, `dial-state-change`. Auto-updates every 8-17 s with stripe-sweep animation on new events.
- **SocialProofTicker** (homepage) — 4 cells (subscribers, dial-watchers, forum-heat, weekly-growth) ticking every 2.2 s; border flashes state-colour on tick.
- **SignupToast** — bottom-left dismissible toast (Finnish names + cities only) firing ~12 s after mount; auto-hides after 7 s; dismiss pauses for the session.
- **PushNotificationToast** — top-right mocked push, fires ~22 s after mount on a probabilistic gate.
- **DialHistoryMiniChart** — 24h sparkline below cockpit dial with state-band thresholds and pulsing tip.

### Shareable cards (html2canvas)
- **ShareButton** with variants: `moment`, `dial`, `operator`. Generates 1080×1080 PNG via offscreen template, opens preview modal with download + native Web Share fallback.
- Wired into hero (dial state) and every MomentCard.

### Telegram + back-office
- **TelegramSubscribeButton** — fetches `/api/settings/public` on mount; disabled "coming soon" until URL set, enabled "Subscribe via Telegram" otherwise. Mounted in `HeroCapture` and `PersistentCapture`.
- **`/back-office`** route — token-gated (localStorage 'mittari-admin-token'); single editable setting `telegram_channel`. Token: `mittari-admin` (env `BACK_OFFICE_TOKEN`).
- **Backend endpoints**:
  - `GET  /api/settings/public` — `{ telegram_channel }` only, no auth
  - `GET  /api/admin/settings` — full settings doc, requires `X-Admin-Token`
  - `PUT  /api/admin/settings` — body `{ telegram_channel: string|null }`, requires `X-Admin-Token`

### Test results
- **Iteration 4** (Phase 2.0): backend pytest 17/17 (10 regression + 7 new settings); frontend 100% on every Phase 2.0 surface (hero capture, telegram dynamic state, dial-history chart, social-proof ticker, activity feed auto-update, signup toast, share modals, back-office auth + persistence, persistent capture telegram, session progress bars, regression on all routes, EN/FI toggle).

## Prioritized backlog

### P0 (Phase 2 — real signal layer)
- Twitch/Kick muted-autoplay iframes for live tiles (replace photo placeholder)
- Backend `/api/notify-signup` to persist hero + follow + persistent emails (replace console.log mocks)
- Real activity-feed signal sourcing (Twitch helix poll, Kick API, RSS for forum heat)
- Twitch/Kick live-status polling for actual streamer list
- Suomi24 + Ylilauta activity-volume signal scraping
- Notification delivery (Resend + Telegram bot + web push)
- Dial calculation engine fusing real signals → state changes propagate to dial, contextual float, ranking sort default

### P1
- Operator click escalation 24h cookie + secondary CTA on persistent capture
- State-driven default ranking sort (best-for-action vs best-for-research)
- Real operator data + Trustpilot/AskGamblers signals
- CMS for editorial commentary (FI + EN)
- Affiliate link infrastructure
- Sports data feed (API-Football)
- Telegram-channel polling (sync UI when admin updates URL in another tab)
- Streak / prediction-game scaffolding

### P2 (post-July 2027)
- Licensed Finnish operator partner onboarding
- CPA monetisation activation
- Pydantic HttpUrl validation on telegram_channel
- Operator-score share variant on `/kasinot/:slug`

## Test credentials
- Public site: no auth required
- Back-office: token `mittari-admin` at `/back-office`

## Next tasks
1. Replace mock activity feed with real Twitch/Kick + forum scraping signal pipeline
2. `/api/notify-signup` endpoint + wire hero, follow, persistent capture (remove client-side console.log)
3. Telegram-bot delivery + web-push infrastructure
4. Dial calculation engine fusing real signals
5. Twitch/Kick autoplay embed integration (swap LiveTile placeholder for real iframes)
