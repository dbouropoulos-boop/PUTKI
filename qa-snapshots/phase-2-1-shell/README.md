# Phase 2.1 · BackOfficeShell light reskin — snapshot gallery

Captured on **2026-05-28** from the **preview** environment
(`https://pelisignaali-fi.preview.emergentagent.com`) after the
`BackOfficeShell.jsx` light reskin landed.

## Coverage (16 PNGs)

| Capture | Desktop 1440px | Mobile 375px |
|---|---|---|
| **AuthGate sign-in** (logged out) | `authgate_desktop.png` | `authgate_mobile.png` |
| `/back-office` legacy hub¹ | `back-office-root_desktop.png` | `back-office-root_mobile.png` |
| `/back-office/bot-routing` | `bot-routing_desktop.png` | `bot-routing_mobile.png` |
| `/back-office/funnel` | `funnel_desktop.png` | `funnel_mobile.png` |
| `/back-office/runbook` | `runbook_desktop.png` | `runbook_mobile.png` |
| `/back-office/settings` | `settings_desktop.png` | `settings_mobile.png` |
| `/back-office/leads` | `leads_desktop.png` | `leads_mobile.png` |
| **Cmd+K palette open** | `cmdk_palette_desktop.png` | `cmdk_palette_mobile.png` |

¹ `/back-office` root still renders the **legacy** `BackOffice.jsx` tile-hub, which is intentionally **not wrapped in the new shell yet** — Task 2.6 (Today dashboard) replaces it. The screenshot shows the legacy hub's own auth gate, which is correct behaviour for this PR.

## What changed in `BackOfficeShell.jsx`

Every hex literal swapped to Phase 1 CSS variables. The legacy dark palette (`#0B0A09` bg, `#E8C26E` gold, `#9C8B6B` muted, `#1a1815` borders) is **zero hits** after this PR.

| Surface | Before | After |
|---|---|---|
| Outer shell + sidebar bg | `#0B0A09` (near-black) | `var(--bg)` (pure white) |
| Status strip bg | `#0e0d0b` | `var(--surface)` |
| Hairline borders | `#1a1815` | `var(--line)` |
| Strong borders | `#2a2722` | `var(--line-strong)` |
| Primary text | `#F2EBE0` (cream) | `var(--ink)` |
| Secondary text | `#D8CDB9` | `var(--ink-2)` |
| Muted labels | `#9C8B6B` | `var(--ink-3)` |
| Active nav bg | `#1a1610` (gold-tint) | `var(--ember-soft)` |
| Active nav left rail | `2px solid #E8C26E` | `3px solid var(--ember)` |
| Active nav text | `#E8C26E` | `var(--ember-strong)` |
| Unlock button | gold bg + dark text | `var(--ember)` bg + white text |
| Input focus ring | none | `var(--ember)` border + `var(--ember-soft)` glow |
| Status chip "ok" tone | `#0e1d12` bg + `#6FA37D` dot | `var(--ember-soft)` bg + `var(--ember-strong)` dot |
| Status chip "warn" | `#1a1610` bg + `#E8C26E` dot | `#FBEDEC` bg + `var(--dial-myrsky)` dot |
| Status chip "bad" | `#211010` bg + `#C8423C` dot | `#FBEDEC` bg + `var(--dial-myrsky)` dot |
| Breadcrumb current | `#E8C26E` | `var(--ember-strong)` |
| Cmd+K selected item | (default shadcn dark) | `var(--ember-soft)` bg + `var(--ember-strong)` text via scoped `[cmdk-item][data-selected]` override |
| Cmd+K group headings | (default shadcn) | JetBrains Mono 10.5px, `0.14em` tracking, `var(--ink-3)` |
| Nav item typeface | Georgia 14 | **Inter** 14, weight 500/600 |
| Sidebar header "Back-office" | Georgia 20 | `.display` Archivo Black 20 |
| All mono labels | `'ui-monospace, monospace'` | `'JetBrains Mono', ui-monospace, monospace` |

## What was preserved (per spec)

- **Token persistence** — both `sessionStorage` and the legacy `localStorage` mirror are intact (auth consolidation is Task 2.3)
- **Cmd+K behaviour + live feature flips** — exact same handlers, same testids
- **Top status strip live data + 60-second refresh interval**
- **Nav group structure** — dead-link reconciliation is Task 2.4
- **Density toggle** (`COMPACT` / `COMFORT`) + `localStorage` persistence

## Verification commands

```bash
# Zero legacy dark hex literals
grep -nE "0B0A09|1a1815|2a2722|9C8B6B|E8C26E|D8CDB9|F2EBE0|5a4c2e|1a1610|13110d|0e0d0b" \
  /app/frontend/src/components/back-office/BackOfficeShell.jsx
# → no output ✅

# 45 Phase 1 token references in the file
grep -cE "var\(--bg\)|var\(--surface\)|var\(--ink|var\(--line|var\(--ember" \
  /app/frontend/src/components/back-office/BackOfficeShell.jsx
# → 45 ✅
```

## Re-running this sweep

```bash
python3 /app/qa-snapshots/sweep_phase2_1.py
# ~3 min total, writes into /app/qa-snapshots/phase-2-1-shell/
```
