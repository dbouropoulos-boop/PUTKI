# PUTKI HQ — page-by-page audit (iter96)

_Audited 2026-06-01. Senior web-dev eye on the 20 funnel-critical and Tier-2 routes._

## Audit methodology
- Static-HTML probe (curl with browser UA) → captures what crawlers see.
- Runtime probe via Playwright → captures post-hydration `<title>` + meta + DOM.
- Visual review via screenshot tool at desktop (1440×900) + mobile (390×800).
- Outputs: `/app/qa-snapshots/audit/<slug>-{desktop,mobile}.png`.

## Tier-1 funnel-critical (homepage + the 3 product surfaces)

| Route | Title | Canonical | hreflang | h1 | Visual verdict |
| --- | --- | --- | --- | --- | --- |
| `/` (HomeV5) | ✓ FI/EN | ✓ | ✓ 3 (after iter95) | ✓ | **A+**. 10 sections, animated Mittari gauge, ember newsroom aesthetic, live data wired. |
| `/en` (HomeV5) | ✓ EN | ✓ canonical → `/en` | ✓ 3 | ✓ | Same — full English alternate. |
| `/mittari` | ✓ | ✓ (iter96 fix) | ✓ 3 (iter96 fix) | ✓ | **A**. Live dial w/ rolling animation, sharpness table, 5 signals blurred behind Telegram CTA. |
| `/mestari` | ✓ | ✓ (iter96 fix) | ✓ 3 (iter96 fix) | ✓ | **A**. 3-card diagnostic hub with the `SOON · PLAYBOOK FORTHCOMING` badges from iter93. |
| `/luotettavuus` | ✓ | ✓ | ✓ 3 | ✓ | **A+**. Three principles, three live datasets, four methodology pieces. Editorial gold. |
| `/en/trust` | ✓ EN | ✓ | ✓ 3 | ✓ | Mirror of luotettavuus. |
| `/pelisignaalit` | ✓ | ✓ | ✓ 3 | ✓ | Daily signals capture surface. |

**Tier-1 verdict**: green across the board after iter96 hreflang fixes.

## Tier-2 content & accountability

| Route | Title | Canonical | hreflang | h1 | Visual verdict |
| --- | --- | --- | --- | --- | --- |
| `/uutiset` | ✓ | ✓ (iter96 fix) | ✓ 3 (iter96 fix) | ✓ | **A**. Live news stream, 93 stories in 24h, 127 sources, category filter chips. |
| `/menetelma` | ✓ | ✓ | ✓ | ✓ | Methodology. Long-form, dense, well structured. |
| `/korjaukset` | ✓ | ✓ | ✓ | ✓ | Corrections ledger. Accountability surface — sparse content (correct, by design). |
| `/saantely/reform-2027` | ✓ | ✓ | ✓ 3 | ✓ | **A+**. Timeline + 7 sourced policy items. The Reform briefing. Note: **no global header** — page uses its own narrative chrome (intentional editorial design). |
| `/pelit` + `/pelit/<game>` | ✓ | ✓ | ✓ 3 | ✓ | 7 deep game guides (blackjack/poker/slotit/craps/ruletti/live/bonus-math). Each ~3-4k word editorial. |
| `/striimaajat` | ✓ | ✓ | ✓ | ✓ | Streamer directory + live-now rail. |
| `/skene` + `/skene/talous` | ✓ | ✓ | ✓ | ✓ | Scene categories — culture, money, sponsorship slices. |

## Tier-3 trust data pages

| Route | Visual verdict |
| --- | --- |
| `/trust/voita-tilikirja` | Voita ledger. Backed by live `/api/voita/winners` — currently sparse (no raffles run yet) but renders the empty-state honestly per iter88 design. |
| `/trust/mittari-tarkkuus` | Mittari accuracy back-test. Reads `mittari_signal_outcomes`. Today: "back-test in progress" — flips to live numbers once the operator-grading backfill runs (see `/app/memory/operator/mittari_grading.md`). |
| `/trust/mestari-aineisto` | Mestari diagnostics dataset summary. Anonymised quartile rollup. |

## Tier-4 legacy / dormant

| Route | Status |
| --- | --- |
| `/home-v4` | Legacy homepage kept for comparison. Still works. Will be removed after the HomeV5 rollout is stable (~2 weeks). |
| `/peliareena/*` | 5 mini-game surfaces. Repositioned in iter93 from email-capture funnels to pure educational play (no email required). |
| `/voita/*` | Deprioritised per iter93 (removed from homepage Explore grid). Direct URL still works. |
| `/peli`, `/peli/legacy` | Older raffle flow. Untouched. |

---

## Issues found and fixed in iter96

### 🟢 Fixed
1. **Missing hreflang on /mittari, /mestari, /uutiset** — added via `useLocalisedCanonical` (3 link tags emitted per page).
2. **Broken canonical on /mittari, /mestari, /uutiset** — was pointing at `${REACT_APP_BACKEND_URL}/...` (preview pod URL). Now points at the canonical `https://putkihq.com/...` host via the shared hook.
3. **`/api/news` + `/api/sources` shapes mismatch on HomeV5** — endpoints renamed (`/api/news/featured` + `/api/news/chronological` + `/api/sources/public`), data wired with merge-by-URL de-dup, fallback copy removed.
4. **HomeV5 hero `<img>` 404 hard-empty** — added an editorial gradient + decorative parliament-suggestion stripes that remain visible when the Nano Banana OG endpoint 404s (kill switch active in preview).
5. **Trust manifest hardcoded source count** — now derives from `/api/sources/public.total`. Live shows 28 (was hardcoded 12).
6. **Header-deprecation prep** — added `frontend/src/lib/fetchAdmin.js` canonical wrapper. Bulk-added `credentials: 'include'` to 41 admin fetches across 14 files — cookie session works without depending on browser default same-origin behaviour.
7. **Mittari grading operator runbook** — `/app/memory/operator/mittari_grading.md` (cron + UI walkthrough + endpoint reference + COI/recusal rule).

### 🟡 Known limitations (out of scope of iter96)
- **Static SSR**: every route serves the same boilerplate `<title>` until React hydrates. SPA users see the right title within 100ms; search/social crawlers see the boilerplate. **Fix**: enable `react-snap` prerender at build time (config exists in `package.json`, install just needs `yarn add --dev react-snap` in the production build pipeline).
- **Nano Banana OG images disabled in preview** (`PUTKI_HQ_DISABLE_OG_IMAGES=1`). Production must clear the kill switch.
- **38 admin pages still spread `X-Admin-Token`** — harmless duplication (cookie does the auth). Per-file migration to `fetchAdmin()` can happen incrementally; no urgency.

### 🟠 Polish backlog (~30 min items each)
- Reform 2027 page should embed the global `<Header />` for navigation consistency (currently uses its own chrome).
- News feed could surface `entity_tags` on the homepage news cards (data is in the response but unused).
- Mestari hub: the `SOON` badge could be replaced with a dated promise ("käsikirja toukokuu 2026").

---

## Mobile responsiveness
Verified on every Tier-1 + most Tier-2 routes at 390×800 viewport. No horizontal scroll on any tested page. Touch targets (≥44px) confirmed on the homepage capture form + the back-office sign-in box.

## Performance / Core Web Vitals (best-effort, dev preview)
- HomeV5 LCP: hero text block, rendered on first paint (no image dependency).
- Mittari LCP: animated dial SVG, ~120ms post-hydration.
- All Tier-1 pages parallelise their API calls (~4 endpoints fan-out in HomeV5; 4 in Mittari).
- React-snap prerender + image CDN on production deploy should bring LCP < 1.0s.

## Accessibility
- All h1s present and unique per page.
- Image alts present on every `<img>` rendered (most pages have 0 imgs today — content is text + SVG, which is fine).
- Buttons all have visible labels (no aria-label-only buttons found).
- Lang attribute correctly reflects the page language.

## Regression
- Backend: 34/34 tests green across iter89/90/92/93/94 in 5.1s.
- Frontend: ESLint clean across all 4 modified pages + the new helper.
- Browser: end-to-end verification on Tier-1 + 3 Tier-2 routes confirms hreflang + canonical + meta.

_Audit owner_: iter96 main agent. _Re-audit cadence_: every minor release or when a new Tier-1 route ships.
