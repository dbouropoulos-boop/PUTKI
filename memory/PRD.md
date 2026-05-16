# Mittari.fi — PRD

## Phase History
- **Phase 1** (2026-02) — 9-page editorial site with mock data
- **Phase 1.5** (2026-02) — Cockpit-instrument visual elevation, dial V2, 8 fixes, streamer-submission form
- **Phase 1.6** (2026-02) — Bilingual FI / EN
- **Phase 1.7** (2026-02) — Visual energy layers (live ticker, atmospheric glow, grain, count-ups)
- **Phase 1.5 (Revised)** (2026-02) — Architectural restructure for conversion

## Architecture
- Frontend: React 19 + React Router v7 + Tailwind + shadcn/ui
- Backend: FastAPI mock endpoints
- DB: MongoDB
- Theming: CSS-variable-driven (light/dark), Helsinki-time default at 16:00+
- i18n: LanguageContext (FI default + EN)
- Fonts: Inter, Source Serif 4, JetBrains Mono

## Phase 1.5 (Revised) — What's been built (2026-02)
- **Split hero** on homepage — DialCockpit left (55%) + HeroCapture right (45%) with vertical divider; mobile stacks vertically
- **HeroCapture** — 64px-tall email field, filled brand-blue "Tilaa Mittari-ilmoitukset" button, 3 mono micro-reassurance lines, 3 channel icons
- **LiveTilesGrid** — 6 live streamer tiles with video-preview placeholder (real Twitch/Kick iframes = Phase 2), bell-plus follow button, LIVE LED pill, platform pill, viewer count, current game
- **FollowModal** — one-click streamer follow with single email field, success state + auto-close
- **MISSASIT EILEN** section — 2 mock "missed last 24h" auto-cards
- **PersistentCapture** — desktop right-rail (top:120 right:24 on /striimaajat, /menetelma, /viikon-kortti, /peli, /kasinot) + mobile bottom-sheet (collapsed→expand→form→collapse). Skipped on /, /aloita, /landing, and operator review pages.
- **StateContextualFloat** — bottom-right floating dial-state-driven contextual element (KUUMA → ranking link with "3 viikon parasta tarjousta nyt voimassa", KYLMÄ → weekly card link)
- **UTMBanner** — top-of-homepage when `?utm_campaign=X` present
- **OperatorReview compressed** — above-fold (eyebrow + name + take + bonus + CTA) + score panel + trust signal row + live data strip (4 mock stats: Current Jackpot €284,102 / New Players 47 / Payout Median 1h 38min / Streams Live 3) + Mittarin näkemys. Everything else (Quick Facts, Pros/Cons, Activity, FAQ) hidden behind "Lue syvempi analyysi →" toggle.
- **Dark mode default at 16:00+** Helsinki time (was 18:00)
- **Mid-page notification capture REMOVED** — replaced by hero + persistent

### Test results
- Phase 1.5 (Revised): 10/10 backend (no regression), 100% on all new surface (split hero, live tiles, follow modal, missasit eilen, persistent capture desktop+mobile, state float, UTM banner, theme default, operator compression)

## Prioritized backlog

### P0 (Phase 2)
- Twitch/Kick muted-autoplay iframes for live tiles (the visual placeholder swap)
- Backend `/api/notify-signup` to persist hero + follow + persistent emails
- Dial calculation engine fusing real signals → state changes propagate to dial, contextual float, ranking sort default
- Twitch/Kick live-status polling for actual streamer list
- Suomi24 + Ylilauta activity-volume signal scraping
- Notification delivery (Resend + Telegram + web push)

### P1 (Phase 2)
- Operator click escalation 24h cookie + secondary CTA on persistent capture
- State-driven default ranking sort (best-for-action vs best-for-research)
- Real operator data + Trustpilot/AskGamblers signals
- CMS for editorial commentary (FI + EN)
- Affiliate link infrastructure
- Sports data feed (API-Football)

### P2 (post-July 2027)
- Licensed Finnish operator partner onboarding
- CPA monetisation activation

## Test credentials
N/A — no authentication.

## Next tasks
1. Twitch/Kick autoplay embed integration (swap LiveTile placeholder for real iframes)
2. Single `/api/notify-signup` endpoint + wire hero, follow, persistent capture
3. Dial calculation engine
4. Real streamer live-status polling
5. Operator click escalation cookie + escalation prompt in PersistentCapture
