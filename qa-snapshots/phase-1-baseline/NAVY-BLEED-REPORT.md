# Phase 1 baseline — navy-bleed report

After the Phase 1 visual lockdown swapped `--brand-blue` to resolve to ember
(`#D9461E`) and broke out the Mestari product blue into its own
`--mestari-accent` token, this is the comprehensive sweep of every place
that previously rendered in the old navy `#1B2D5B`.

**Bottom line**: 1 hardcoded literal needs a manual swap. The other 19
references are CSS-variable based and will pick up the ember accent
automatically — all of them sit in semantic-accent contexts (CTAs, links,
hover, banner dots) where ember is the correct destination.

---

## 🔴 Manual swap required (1 hit)

### `Signup.jsx:51` — step progress bar

```jsx
<div key={s} className="flex-1"
     style={{ backgroundColor: s <= step ? '#1B2D5B' : '#E8E5DF' }}></div>
```

This is the only hardcoded literal `#1B2D5B` left in the codebase. Filled
steps will currently render in the old navy, unfilled in the new
`--line` grey. Recommended swap:

```jsx
style={{ backgroundColor: s <= step ? 'var(--ember)' : 'var(--line)' }}
```

---

## 🟡 Defer to Phase 2 (back-office reskin)

These live in pages getting reworked in Phase 2.1 BackOfficeShell reskin
anyway — no separate action needed right now:

| File | Line | Use |
|---|---|---|
| `BackOffice.jsx` | 173 | Legacy tile-hub link (whole page being replaced by Today dashboard in Task 2.6) |
| `OperatorsAdmin.jsx` | 181 | Admin table cell (migrates under shell in Task 2.2) |

---

## 🟢 Ember is the correct destination (no action)

All of these are semantic-accent uses (CTAs, methodology links, hover
states, banner dots). Ember is semantically the right colour now that
`--brand-blue` aliases to it.

| File | Line | Use |
|---|---|---|
| `CasinoRanking.jsx` | 89, 93 | "Read methodology" info-link |
| `Skene.jsx` | 13 | `/skene/talous` subnav link |
| `StreamerProfile.jsx` | 494 | Mono "view" link on streamer card |
| `Accountability.jsx` | 160, 182 | Methodology link + section label |
| `Signup.jsx` | 104, 151 | Tailwind `text-brand-blue` on check icon + label |
| `ColdEmailLanding.jsx` | 99 | Eyebrow label |
| `Pelit.jsx` | 23 | Nav link |
| `OperatorCard.jsx` | 114 | "ARVIO →" link |
| `MomentCard.jsx` | 144 | "Read more" link |
| `UTMBanner.jsx` | 30 | LED dot in banner |
| `EditorialFooter.jsx` | 58 | "View changes" link |

Plus 3 in `index.css` itself (`.btn-primary:hover` background +
border, `.btn-ghost:hover` colour) — these are the global hover-affordance
rules and ember is exactly what we want there.

---

## 🟣 Worth a second look (1 hit) — Voita-product context

### `VoitaPalkinto.jsx:330` — left-rail panel border

```jsx
<div className="panel p-5 sm:p-6 …" style={{ borderLeft: '3px solid var(--brand-blue)' }}>
```

Ember will render here. If you want strict per-product colour discipline
(Mestari = blue, Voita = crimson, Pelisignaalit = ember), this should
move to `var(--voita-accent)` (`#C8423C`). Otherwise ember reads as the
generic accent and is fine.

---

## 🔵 Mestari product blue — confirmed clean

Grep of `Mestari.jsx`, `MestariDiagnostic.jsx`, `MestariHub.jsx`,
`MestariResult.jsx` for `--brand-blue` / `#1B2D5B` returns **zero hits**.
Mestari pages already use either the `--mestari-accent` token directly or
their own hex literals from the gradient palette — the product-blue
intent is preserved.

---

## Recommendation

1. Approve a one-line fix on `Signup.jsx:51` (`#1B2D5B` → `var(--ember)`).
2. Decide whether the Voita panel border on `VoitaPalkinto.jsx:330`
   should snap to `--voita-accent` or stay on the semantic `--brand-blue`
   alias. (My vote: `--voita-accent` for strict per-product theming.)
3. Everything else inherits ember automatically and reads correctly.
