# P2-5 · Back-office email-based auth — frozen spec

> Frozen 2026-06-13 after user lock-in. Do not modify decisions without
> an explicit user confirmation. This file is the single source of truth
> for the build once the P0 ship is verified on prod.

## Hold gate (DO NOT START BUILD UNTIL ALL THREE PASS)

User explicit instruction 2026-06-13:
> "This whole thing is still behind the P0 token fix. Ship the auth-loop
> patch and let me park the cron first; start the magic-link build after
> that's confirmed on prod."

Three checkpoints required before kickoff:
- [ ] User has redeployed iter97k.2 (fork) to prod (`putkihq.fi`).
- [ ] User has signed in at `https://putkihq.fi/back-office`, refreshed,
      and confirmed no AuthGate bounce.
- [ ] User has clicked "RUN iter97j MIGRATION" and seen the green box
      with `daily_dispatch_enabled=False` + eligible ≈ 523.

Only when user posts "P0 confirmed on prod" (or equivalent) does P2-5
kickoff. **Until then, P2-5 is paused.**

## Locked decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Login mechanism | **Magic-link via email, 15-min expiry.** No passwords. |
| 2 | Accounts for v1 | **Seed exactly one**: `management@quest-x.co` (role: owner). No other accounts until user adds them. |
| 3 | Roles | **Single tier** for v1 — everyone full admin. No editor/owner split yet (defer until 2+ users). |
| 4 | Sender for auth emails | **`auth@putkihq.fi`** — dedicated sender on the already-verified `putkihq.fi` domain. Isolates auth-email deliverability from the marketing/dispatch soak. Login-link delivery must not co-fail with a marketing reputation hit. |
| 5 | Shared-secret retirement | **Manual revoke, never timer-based.** `BACK_OFFICE_TOKEN` keeps working alongside named accounts indefinitely until user explicitly says "revoke now". A timed auto-revoke could kill both paths if magic-link delivery hiccups in week one — that recreates the 2026-06-13 lockout. The safety net comes off by hand, not on a timer. |

## Carry-over from P0 ship (must remain working through P2-5)

- The `tokenStore` sessionStorage header fallback in `BackOfficeShell.jsx`.
- The "Force re-login (clear local state)" button in `AuthGate`.
- The dual-path `require_admin` (cookie + `X-Admin-Token` header) until
  user explicitly revokes `BACK_OFFICE_TOKEN`.

## Build plan (sequenced once hold gate releases)

1. **Pre-build**: call `integration_playbook_expert_v2` for the canonical
   FastAPI magic-link + httpOnly session pattern (per repo auth policy:
   "When implementing or modifying ANY authentication logic, you MUST
   call integration_playbook_expert_v2 BEFORE writing any auth code").
   Constraints to pass: FastAPI + Motor (Mongo), Resend for email
   delivery, 15-min link expiry, single-use tokens, rate-limit on
   request endpoint, dual-path (cookie session) compatible with the
   existing `require_admin`.

2. **Backend**:
   - New collection `admin_users` (seed `management@quest-x.co` /
     role:owner).
   - New collection `admin_magic_links` (single-use, 15-min expiry,
     indexed on `token_hash` + TTL on `expires_at`).
   - `POST /api/admin/auth/magic-link/request` — body `{email}` → send
     link via Resend from `auth@putkihq.fi`. Rate-limit 3/min/IP +
     5/hour/email. Always returns 200 (no email enumeration).
   - `GET /api/admin/auth/magic-link/consume?token=...` → validate +
     single-use + sets the existing `putki_admin_session` cookie with
     `{sub: user_id, actor: email, role}` so the rest of the back-office
     keeps working unchanged.
   - `require_admin` gains a third lookup path (cookie session populated
     by magic-link consume) — cookie + named-account path takes
     precedence over the legacy shared-secret header, but the header
     still works.

3. **Frontend**:
   - `AuthGate` gains a tab toggle: "Magic link" (new, default) +
     "Token" (legacy, hidden behind a small disclosure for fallback).
   - Magic-link tab: email input + "Send sign-in link →" button +
     post-submit confirmation state ("Check your inbox at
     m...@quest-x.co — link expires in 15 min").
   - `/back-office/auth/consume?token=...` route — exchanges the token
     server-side then redirects to `/back-office`.

4. **Email template**: minimal magic-link email matching PUTKI HQ
   editorial voice. Subject: `PUTKI HQ · Sign in (15 min)`. From:
   `PUTKI HQ Auth <auth@putkihq.fi>`. Body: ember-accented "SIGN IN →"
   button + plain-text fallback link + footer with "Didn't request
   this? Reply to this email" + List-Unsubscribe-omitted (transactional).

5. **DNS / Resend setup** (manual user step before first test):
   - Add `auth@putkihq.fi` as a sender identity in Resend (no new DNS
     needed — `putkihq.fi` is already verified).
   - Confirm Resend SPF + DKIM still pass for the new `From:` local-part.

6. **Tests**:
   - `tests/test_p2_5_magic_link.py` — request rate limit, single-use
     token, expiry, no-enumeration, cookie session populated correctly,
     legacy header still works post-migration.

7. **Audit log**: every magic-link request + consume + login writes to
   the existing audit log with `actor=email`. Failed attempts logged
   with reason.

## Out of scope for v1 (explicit deferrals)

- Adding/removing users via the BO UI (do it via mongosh until 2nd user
  needed).
- Active sessions panel (revoke remote sessions). Filed as a possible
  P3 follow-up after P2-5 ships.
- 2FA / TOTP. Magic-link to a domain you control is a single factor;
  consider TOTP only if a credential-stuffing risk emerges.
- Password fallback. Explicitly rejected.
