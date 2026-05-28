# Phase 1 baseline — visual snapshot gallery

Captured on **2026-05-28** from the **preview environment**
(`https://pelisignaali-fi.preview.emergentagent.com`) after the Phase 1
visual lockdown landed. Production deploy (`putkihq.fi`) needs a redeploy
to pick up these changes; these snapshots are the source-of-truth for
"what Phase 1 ships."

## Coverage

8 public pages × 2 themes × 2 viewports = **32 PNGs**.

| Page | Path |
|---|---|
| Home | `/` |
| Mittari | `/mittari` |
| Mestari | `/mestari` |
| Pelisignaalit | `/pelisignaalit` |
| Peli | `/peli` |
| Uutiset | `/uutiset` |
| Toimitus | `/toimitus` |
| Methodology | `/menetelma` |

Per page:
- `{slug}_light_desktop.png` — 1440 × full-page, light mode
- `{slug}_light_mobile.png`  —  375 × full-page, light mode
- `{slug}_dark_desktop.png`  — 1440 × hero viewport, dark mode
- `{slug}_dark_mobile.png`   —  375 × hero viewport, dark mode

## What to look for

✅ Pure white background in light mode (was cream `#FBFAF8`)
✅ Ember accent (`#D9461E`) on selection, hover, and CTA buttons
✅ Hairline borders (`#E8E5DF`)
✅ Body in **Inter**, hero headings in **Archivo Black**
✅ Dark-mode toggle still works (moon icon top-right)
✅ Per-product colours preserved: Mestari blue, dial states unchanged

## Known follow-ups

See `NAVY-BLEED-REPORT.md` for the comprehensive audit of every place
the old `--brand-blue` navy is still referenced (1 hardcoded literal to
swap, the rest inherit ember semantically).

## Capture script

`/app/qa-snapshots/sweep_phase1.py` — re-runnable any time. Takes
~120 seconds to capture all 32 snapshots into this folder.
