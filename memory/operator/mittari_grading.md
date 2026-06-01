# Mittari grading — operator runbook

**Audience**: Putki HQ editor on duty (Eino K. or stand-in).
**Cadence**: Daily snapshot at 09:05 Helsinki; **manual grading** twice a week
(Tue + Fri) and on demand when a signal resolves.
**UI**: `${REACT_APP_BACKEND_URL}/back-office/mittari-grading`
(component: `frontend/src/pages/BackOfficeMittariGrading.jsx`).
**Auth**: cookie session (iter94) — sign in at `/back-office` first; the
grading page reuses the same session.

---

## Why this exists

The Mittari public surface (`/mittari` + the `home-v5-trust` tile) claims a
public hit-rate ("7 PV: 6/7 JULKINEN") drawn from `mittari_signal_outcomes`.
That collection is **operator-graded**: there is no auto-resolver. If you
don't grade, the public ledger silently degrades to "scaffold" — visitors
see a fixed claim with no live data backing it.

## Daily snapshot (automatic)

A backend cron runs `POST /api/admin/mittari/grading/snapshot` once a day at
09:05 Europe/Helsinki. It freezes every currently-published signal into
`mittari_signal_history` with the day's odds/state so the operator can grade
it later without losing the original frame. **You don't have to touch this.**
If you ever see a gap in the history (e.g., back from holiday), run a
manual catch-up:

```
curl -X POST $BACKEND/api/admin/mittari/grading/quick-backfill \
  -b /tmp/admin_cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"days_back": 14}'
```

(Replace `/tmp/admin_cookies.txt` with your session — see the
`/app/memory/test_credentials.md` curl example to log in first.)

## Grading workflow (manual)

1. **Open** `/back-office/mittari-grading`.
2. The table loads signals from `GET /api/admin/mittari/grading/pending`.
   Columns: `signal_id` · `commenced_at` · `state at capture` · current
   status (`pending` / `hit` / `miss` / `void`). Sorted oldest pending first.
3. For each row that has **resolved** in the real world:
   - Pick `HIT` if the predicted direction played out cleanly within the
     7-day decision window stamped on the row.
   - Pick `MISS` if the market went the other way or the move was less
     than half the predicted magnitude.
   - Pick `VOID` if the underlying event was cancelled, postponed past the
     window, or a regulator pulled the listing (very rare).
   - Add a one-sentence `note` in the operator's voice — this surfaces on
     the public permalink so the "honest both-sides" claim holds. Avoid
     marketing language. Examples:
     - "NHL final opened at 1.42; aligned with Sharpness 84."
     - "Liiga line flipped 14 min before puck-drop; Mittari was wrong-sided."
4. **Apply ALL** — bulk-confirm the verdicts at the bottom of the table.
   The button issues `POST /api/admin/mittari/grading/apply-bulk` which
   writes a `mittari_signal_outcomes` row per signal (idempotent on
   `signal_id`).
5. The **public ledger** at `/mittari` rebuilds from the next dial snapshot
   (typically within 60s). The home page's `home-v5-trust` count + the
   `BackOfficeToday` "ungraded" chip will both refresh on next page load.

## Things to keep in mind

- **Never grade a signal you didn't see resolve live.** The whole product
  promise is integrity — if there's any ambiguity, leave it pending and
  ask Eino. The 7-day decision window expires on its own; the row will
  drop off the pending list automatically.
- **Voiding is not a soft-miss.** Use `VOID` only when the event itself
  did not take place. A signal that resolved but didn't fire is a `MISS`.
- **Backfill discipline**: if you joined Putki HQ this week and the
  pending queue has >30 days of history, **do not bulk-grade from memory**.
  Walk forward from the oldest signal, look up the actual event outcome
  (results.fi / Yle / official feed), and grade with the note pinned to
  the source. Past graders' integrity is what the public claim rests on.
- **Conflict of interest**: if you have a personal stake in the underlying
  event (you bet on it, you have a sponsorship tie, etc.) recuse — let
  another operator grade. Record the recusal in the note field of the
  next signal you grade ("recused from #N — partner stake").

## Quick reference — endpoints used

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/admin/mittari/grading/snapshot` | Daily freeze (cron-driven). |
| GET  | `/api/admin/mittari/grading/pending` | Pending signals for the table. |
| POST | `/api/admin/mittari/grading/apply` | Single-signal verdict. |
| POST | `/api/admin/mittari/grading/apply-bulk` | "Apply ALL" button payload. |
| POST | `/api/admin/mittari/grading/quick-backfill` | Catch-up snapshot. |

All `/api/admin/*` calls require either the httpOnly cookie session or
the legacy `X-Admin-Token` header. See `/app/memory/test_credentials.md`
for the canonical login pattern.

## Public surface this affects

- `/mittari` — accuracy strip ("7 PV: 6/7 JULKINEN"), 7-day rolling.
- `/luotettavuus` — Trust hub last-graded-at chip.
- `/` — `home-v5-trust` independence section ("12 nimettyä lähdettä. Nolla
  muista."), `home-v5-stats` "Mittari nyt" tile.
- `/back-office/today` — "ungraded items" cockpit chip.

If the public claim ever feels off, check `mittari_signal_outcomes` count
in Mongo first — that's the ground truth.

---

_Last reviewed_: 2026-06-01 (iter96).
_Owner_: Eino K. · toimitus@putkihq.fi.
