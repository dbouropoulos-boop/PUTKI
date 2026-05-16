# Mittari.fi — PRD

## Original problem statement
Build a Finnish editorial website for the online slot-streaming and casino scene. Phase 1 = UI build with mock data. Phase 1.5 = visual identity elevation (cockpit-editorial, dark mode primary, dial V2, 8 fixes, streamer-submission form, Emergent badge removed). Phase 1.6 = bilingual FI/EN.

## Architecture
- **Frontend**: React 19 + React Router v7 + Tailwind + shadcn/ui
- **Backend**: FastAPI (Phase 1 mock endpoints)
- **DB**: MongoDB (motor)
- **Theming**: CSS-variable-driven (light/dark), `ThemeContext`, Helsinki-time default
- **i18n**: `LanguageContext` with translations dict (FI default + EN), browser-language fallback
- **Fonts**: Inter (display), Source Serif 4 (reading), JetBrains Mono (all numerical readouts)

## What's been implemented

### Phase 1 (2026-02)
- 9 pages with mock data: Home, Casino Ranking, Operator Review, Streamer Index, Streamer Profile, Methodology, Cold-Email Landing, Signup, Mini-Game, Topi's Weekly Card
- P*rkele-mittari signature dial (Phase 1 version)
- Editorial system: warm off-white, brand-blue, dial state palette
- Backend: `/api/`, `/api/dial`, `/api/dial/states`, `/api/signup`, `/api/predictions`

### Phase 1.5 (2026-02) — visual identity elevation
- Dark mode is the brand's primary identity (default 18:00–07:00 Helsinki); theme toggle in header; localStorage persists
- JetBrains Mono for all numerical readouts (scores, viewer counts, leaderboard positions, times)
- **Dial V2**: bezel rings, hierarchical ticks (major + minor + minor), state name labels around arc, tapered needle with counterweight, drop shadow, active arc segment fully lit, inactive arcs dimmed, spring physics needle settle, KUUMA+ active-arc glow
- **DialCockpit** hero composition: LIVE NYT + KATSOJAA panels flanking dial, mode label above, contributing factors below (R8 cluster reference)
- Fix 1: state-aware hero CTA hierarchy
- Fix 2: notification capture upgraded (bigger bell, mono input, real button, mono micro reassurance)
- Fix 3: moment cards rebuilt as DATA PANELS with state-tinted backgrounds (no stock photos)
- Fix 4: casino ranking scores tier-colored (90+ KIIRASTULI, 80-89 MYRSKY, 70-79 KUUMA, 60-69 HAALEA) with mono `ScoreReadout`
- Fix 5: Weezy Rally card upgraded (illustrated dark background, prize callout, leaderboard teaser, real button)
- Fix 6: Topi's Weekly Card editorial preview (display headline + fixture tag strip)
- Fix 7: footer brand moment (dial mark + tagline)
- Fix 8: "Made with Emergent" badge removed from `public/index.html`
- Streamer-submission modal on `/striimaajat` with name/URL/why fields (mock save)
- LED status indicator with `box-shadow` pulse (replaces opacity badge)
- index.html title + description updated to Mittari.fi branding

### Phase 1.6 (2026-02) — bilingual FI/EN
- `LanguageContext` with `t()` function and `translations.js` dictionary (FI default, EN secondary)
- Language toggle button next to theme toggle in header (desktop + mobile)
- Browser-language detection on first visit (en-* → English); choice persisted in localStorage
- Translated surfaces: header nav, footer (all columns + tagline + warnings), Home page (hero, all sections, headline state-aware), Casino Ranking (eyebrows, filters, sort labels, articles), Cold-Email Landing, Streamer Index (incl. submission form), DialCockpit (mode label, panel labels), Operator Review (score factors, pros, cons, FAQ — all bilingual data arrays)
- Brand terms (P*rkele-mittari, KYLMÄ/HAALEA/KUUMA/MYRSKY/KIIRASTULI state names) preserved across languages — they are Mittari proper nouns
- Mock data (streamer names, operator names, editorial body copy on some inner pages) remains Finnish — this is Phase 2 work (CMS layer)

### Test results
- Phase 1 baseline: 10/10 backend, 95% frontend
- Phase 1.5: 10/10 backend (no regression), 100% on all 8 fixes + cockpit + theme + streamer form + dial V2
- Phase 1.6 i18n: lint clean, language toggle verified visually

## Prioritized backlog

### P0 (Phase 2 — backend integrations)
- Twitch + Kick live-status polling for tracked streamers
- Suomi24 + Ylilauta activity-volume signal (no content republishing)
- Dial calculation engine fusing live signals
- RSS aggregation (Yle, HS, Iltalehti, Iltasanomat, MTV, Liiga.fi, Helsinki Times)
- Sports data feed (API-Football or TheSportsDB)
- Notification delivery (Resend + Telegram + web push)
- Streamer-suggestion form → MongoDB write + admin queue

### P1 (Phase 2 — content + monetisation prep)
- CMS for editorial Mittari commentary (per-language)
- Real operator data + Trustpilot/AskGamblers/Casino.Guru trust signals
- MGA license register verification
- Affiliate link infrastructure
- Translate remaining mock editorial body copy on Methodology / Operator Review prose paragraphs / StreamerProfile commentary

### P2 (post-July 2027)
- Licensed Finnish operator partner onboarding
- CPA monetisation activation
- Veikkaus license register integration

## Test credentials
N/A — no authentication in Phase 1/1.5/1.6.

## Next tasks
1. Phase 2 kickoff — Twitch/Kick live-status integration
2. Dial calculation engine (Python service fusing live signals → state)
3. Notification delivery (Resend + Telegram bot + web push)
4. Persist streamer suggestions in MongoDB + admin moderation queue
5. CMS for editorial commentary in both FI + EN
