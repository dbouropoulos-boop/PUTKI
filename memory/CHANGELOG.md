# PUTKI HQ — Deferred backlog (P2)

> Items intentionally **deferred** from active sprints. Each row notes who
> requested it, why it's deferred (not blocking core dispatch reliability),
> and the trigger to revisit. Most recent entries first.
>
> Active work and shipped phases live in `/app/memory/PRD.md`.

---

## 2026-06-06 — Post-iter97j deferrals

After completing the iter97i Dispatch Composer + iter97j Sunday weekly cron
& fire endpoint, these enhancements were explicitly deferred to keep the
production dispatch path stable. None block subscriber dispatch — they
polish editorial fidelity and deliverability hygiene.

### P2-1 — Per-profile welcome email variants (11 profiles)
- **Requested by**: User · iter97g context
- **What**: The welcome email currently uses a single template card per
  Mestari profile slug. The full plan is 11 distinct welcome templates
  (HILJAINEN TARKKA, ITSEVARMA LOJAALI, ALTAVASTAAJAN METSÄSTÄJÄ,
  VAISTOPELAAJA, TOTUUDENETSIJÄ, JÄRJESTELMÄLLINEN MAKSIMOIJA,
  PURISTI, SOSIAALINEN OSAAJA, KOKEILIJA, ANALYYTIKKO, UUDENOPPIJA) —
  each with a tailored voice + on-site tease.
- **Blocked on**: Finnish voice review from user. Generic placeholder
  copy at `services/email_render.py::render('welcome', ...)` works in
  the meantime; the bot DM still names the matched profile correctly.
- **Trigger to revisit**: User provides the 11 Finnish voice scripts
  OR signs off on AI-drafted variants for editing.

### P2-2 — Plain-text email variants (deliverability hygiene)
- **Requested by**: Email deliverability best practice (Resend +
  Gmail's MIME multipart preference).
- **What**: Every Resend send currently includes only the `html` body.
  Best practice is `text` + `html` multipart so spam filters score
  better and screen-reader / plain-text clients (Mutt, web preview)
  render cleanly.
- **What's needed**: Add a `render_text(type, fields)` mirror to
  `services/email_render.py` that strips HTML and produces a clean
  text fallback. Wire it into `fanout_daily_emails` + `run_weekly_dispatch`
  Resend payloads.
- **Trigger to revisit**: After 30+ days of live production dispatch,
  if Gmail Postmaster Tools shows >0.1% spam complaints.

### P2-3 — Per-template granular unsubscribe
- **Requested by**: User · post-iter97f context.
- **What**: Current `/api/u/{token}/one-click` flips ALL channels for
  the identifier to `unsubscribed`. The granular version would accept
  `?type=daily|weekly|sponsored` so users can opt out of weekly only
  while keeping daily signals.
- **What's needed**:
  - Add `consent_tag` column to `unsubscribe_log`.
  - Extend `routes/unsubscribe.py` to honour `?type=` query param
    and only flip the matching `optin_consents.consent_tag` rows.
  - Add per-template unsubscribe links to the rendered email footers.
- **Trigger to revisit**: If `/api/u/...` unsub rate climbs above
  3% in a single week (signal that users want weekly but not daily,
  or vice versa).

### P2-4 — PUTKI Presents standalone takeover template
- **Requested by**: User · partner-promo spec.
- **What**: A 4th composer template (alongside daily/weekly/welcome)
  for full-takeover partner content (e.g., a Veikkaus-replacement
  launch coverage email). Different visual treatment than the inline
  partner-module on daily/weekly.
- **What's needed**:
  - Add `'takeover'` to `ALLOWED_TYPES` in `routes/dispatch_composer.py`.
  - Add `render('takeover', fields)` to `services/email_render.py` with
    a full-bleed hero + standalone CTA layout.
  - Add a 4th tab to `pages/BackOfficeDispatch.jsx`.
  - Subject prefix policy: must always start with `Partner ·` per
    Finnish regulator transparency rule.
- **Trigger to revisit**: When the first paid takeover partnership
  is signed.

---

## Status overview

| Item | Status | Owner | ETA |
|---|---|---|---|
| P2-1 Welcome variants | Awaiting voice scripts | User → Editorial | TBD |
| P2-2 Plain-text emails | Deferred 30d soak | Agent | 2026-07-06 |
| P2-3 Granular unsub | Deferred (signal-based) | Agent | When unsub >3% |
| P2-4 PUTKI Presents | Blocked (no partner) | Sales | TBD |

---

## How to revive an item

1. Move the item from this file to a new `## In progress` section in
   `/app/memory/PRD.md` under a new iter tag (iter97k+).
2. Update `Status overview` row above with `MOVED → PRD.md iter97kX`.
3. Implement, test, ship. Refer to the spec in this file as the
   source of truth for the original scope.
