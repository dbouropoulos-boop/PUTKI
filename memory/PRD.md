# Mittari.fi — PRD

## Original problem statement
Build a Finnish editorial website for the online slot-streaming and casino scene. Phase 1 = UI build with mock data following the supplied Phase 1 UI Brief (HS.fi-meets-Hodinkee editorial design, P*rkele-mittari signature dial, restrained color discipline, Inter + Source Serif 4 typography, tabular figures everywhere). Phase 2+ adds real streamer-tracking APIs, RSS news aggregation, sports data, regulatory tracking, and post-2027 licensed-operator affiliate monetisation.

## Architecture
- **Frontend**: React 19 + React Router v7 + Tailwind + shadcn/ui
- **Backend**: FastAPI (minimal Phase 1 mock endpoints)
- **DB**: MongoDB (motor) — used for signups + predictions
- **Design tokens**: Paper #FBFAF8, Ink #0A0A0A, Brand blue #1B2D5B, Dial palette (KYLMÄ/HAALEA/KUUMA/MYRSKY/KIIRASTULI)
- **Fonts**: Inter (display) + Source Serif 4 (reading) via Google Fonts

## User personas
- **Slot-streamer follower** — wants live notifications, follows streamer scene chatter
- **Casino-curious player** — wants honest operator comparisons
- **Sports bettor** — wants weekly card / fixture takes
- **Editorial reader** — values methodology transparency and Finnish-tone editorial commentary

## Core requirements (static)
1. P*rkele-mittari animated dial as brand centerpiece (5 states, 3 sizes)
2. Editorial-grade design discipline (HS.fi / Hodinkee feel — no affiliate clichés)
3. Finnish-language UI throughout
4. Tabular figures on all numerical UI
5. Mobile-first; restrained motion (live pulse, dial transition, fade-up)
6. 18+ + Peluuri/Peli poikki disclosure on every page

## What's been implemented (2026-02 — Phase 1)
- 9 pages built with mock data: Home, Casino Ranking (`/kasinot`), Operator Review (`/kasinot/:slug`), Streamer Index (`/striimaajat`), Streamer Profile (`/striimaajat/:slug`), Methodology (`/menetelma`), Cold-Email Landing (`/landing`), Multi-step Signup (`/aloita`), Mini-Game (`/peli`), Topi's Weekly Card (`/viikon-kortti`)
- P*rkele-mittari SVG dial — 5 color segments, animated needle (cubic-ease 900ms), 3 sizes
- 18 launch streamers in mock data (Tier 1: Jarttu84, JugiPelaa, AndyPyro, OgumTV, pact, Jamppa, Ella, Teukka; Tier 2: 10 more incl Julia, Huispaaja, Korpisoturi, Slotsband, Lyijyleka, Vihis, Konna, Lärvinen, monnirs, iippadaa)
- 12 mock operators with P*rkele Score breakdown + dial-color visualisation
- Backend endpoints: `GET /api/`, `GET /api/dial`, `GET /api/dial/states`, `POST /api/signup`, `POST /api/predictions`
- Multi-step signup flow (email → choose streamers → channels → confirmation)
- Weekly Card with 5 fixtures, 1/X/2 predictions, leaderboard, past weeks
- Tests pass: 10/10 backend, 95% frontend (all routes load, all critical flows work)

## Prioritized backlog

### P0 (Phase 2 — backend integrations)
- Real Twitch + Kick live status tracking for tracked streamer list
- Twitch clip velocity + chat keyword detection
- Suomi24 + Ylilauta /uhkapelit/ activity signal scraping (activity volume only, no content republishing)
- Dial calculation engine (multi-signal fusion)
- RSS news aggregation (Yle, HS, Iltalehti, Iltasanomat, MTV, Liiga.fi, Helsinki Times, Veikkausgroup.com, valtioneuvosto.fi)
- Email/Telegram/web-push notification delivery
- Real sports data (API-Football or TheSportsDB) for Weekly Card fixtures

### P1 (Phase 2 — content + monetisation prep)
- Real operator data + Trustpilot/AskGamblers/Casino.Guru trust signals
- MGA license register verification
- Affiliate link infrastructure (tracking, disclosure, click-through)
- Streamer profile pages with real Twitch/Kick embeds
- CMS for editorial Mittari commentary

### P2 (post-July 2027)
- Licensed Finnish operator partner onboarding
- CPA-driven monetisation activation
- Veikkaus license register integration
- Audience-data analytics + subscriber acquisition

## Test credentials
N/A — Phase 1 has no authenticated users yet.

## Next tasks
1. Phase 2 kickoff — integrate real Twitch API for live-status of 18 launch streamers
2. Dial calculation engine (Python service that fuses live signal counts → state)
3. Notification delivery (Resend for email, Telegram bot, web push)
4. CMS for editorial commentary entries
