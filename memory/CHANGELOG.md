# PUTKI HQ — Deferred backlog (P2)

> Items intentionally **deferred** from active sprints. Each row notes who
> requested it, why it's deferred (not blocking core dispatch reliability),
> and the trigger to revisit. Most recent entries first.
>
> Active work and shipped phases live in `/app/memory/PRD.md`.

---

## 2026-06-13 — Post-iter97k.2 (fork) deferrals

### P2-5 — Real email-based back-office auth (replace shared admin token)
- **Requested by**: User · iter97k.2 (fork), 2026-06-13 — filed immediately
  after the P0 401-loop ship as the proper follow-up.
- **Why now P2, not tonight**: tonight's 401 loop is the SYMPTOM of why
  this is needed. One shared secret + brittle cookie/header fallback has
  no per-user identity, no clean recovery, and no audit trail. But it's
  not a tonight fix — designing it right (sessions, expiry, rate-limits,
  email-delivery edge cases) needs daylight. P0 token fix ships first and
  parks the cron; this is the clean follow-up once prod is stable.
- **Scope**:
  - **Named admin accounts** (not one shared secret). Seed with the
    accounts that actually need access — likely 2–3 max for v1.
  - **Email-based login**: decide magic-link (one-time sign-in link emailed
    via Resend) vs password + reset flow. **Lean magic-link** unless
    there's a strong reason not to — simpler to get right, no password
    storage, fits the existing email pipeline.
  - **Per-user server-side sessions** with sensible expiry + refresh, so
    a redeploy doesn't silently invalidate everyone the way it did on
    2026-06-13.
  - **Real sign-out** that ends the session server-side (not just clears
    local state). Server-side revocation list, not just cookie clear.
  - **Keep the "Force re-login / nuke local state"** escape hatch from
    the P0 ship as a permanent safety valve in the AuthGate.
- **Design questions to resolve before building**:
  1. Magic-link vs password+reset? (Recommend magic-link.)
  2. How many accounts, and do we need roles now (admin vs editor) or is
     everyone full-admin for v1?
  3. Off-the-shelf auth library/provider vs hand-rolled? **Strong
     preference for not hand-rolling session/token security.** Candidates:
     Emergent-managed Google OAuth, Auth.js (FastAPI flavour), or a
     vetted FastAPI auth library.
  4. Reuse the existing Resend pipeline for login emails, or keep auth
     email on a separate sub-domain to isolate deliverability?
  5. Lockout / rate-limiting on the login endpoint (brute-force
     protection — 5 requests/minute/IP feels right).
- **Dependencies/risk notes**:
  - Touches every `/back-office` route + the admin user model + the email
    pipeline (already mid 30-day deliverability soak → factor that in;
    auth email volume is tiny but warming separate sender domain takes
    days).
  - Migration path: keep the cookie-session + X-Admin-Token paths working
    during cutover. Issue named accounts to existing users, then revoke
    the shared `BACK_OFFICE_TOKEN` once everyone has migrated. Backend's
    `require_admin` keeps dual-path during the soak.
  - Security shortcuts here are the thing we're trying to get away from
    — worth doing deliberately. Plan to call `integration_playbook_expert_v2`
    BEFORE writing any auth code per repo policy.
- **Explicitly out of scope of P0 ship (2026-06-13)**: this does not
  block or replace the P0 token fix — that ships first and parks the
  cron. This is the next clean task once prod is stable.
- **Trigger to revisit**: P0 ship is verified on prod by user, cron is
  parked, and 7+ days of stable dispatch confirmed. Then schedule a
  half-day design pass.

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
| P2-5 Email-based BO auth | Backlog (post-prod-stable) | Agent + User design pass | After 7d prod stable |
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
