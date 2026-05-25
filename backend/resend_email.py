"""
PUTKI HQ - Resend welcome-email dispatcher (iter65).

Feature-flagged: if `RESEND_API_KEY` is unset or empty the module
operates in MOCKED mode - it logs the email it would have sent
and stamps `mini_game_leads.welcome_email_sent_at` with a synthetic
"mocked:<uuid>" id, so the rest of the funnel (idempotency, success
reporting, /back-office analytics) behaves identically. Drop the
real key into /app/backend/.env and the module auto-flips to live
send on the next request - no code change required.

Resend SDK is synchronous, so we use `asyncio.to_thread` to keep
the FastAPI event loop free.

Idempotency: per `(email_hash, source_game)` we check
`welcome_email_sent_at` before dispatch.

Bilingual: FI/EN templates with persona-specific blind_spot + three
traps copy embedded. The OG identity card is attached inline (CID)
so the email itself shows the same card the user would share - no
hot-link, no broken image if our domain is blocked.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Lazy import - the SDK is heavy and only needed when actually sending
_resend = None  # type: ignore


def _load_resend():
    global _resend
    if _resend is None:
        import resend as _r
        _resend = _r
    return _resend


def is_live() -> bool:
    return bool((os.environ.get("RESEND_API_KEY") or "").strip())


def _sender() -> str:
    return (os.environ.get("RESEND_SENDER_EMAIL") or "onboarding@resend.dev").strip()


def _telegram_url() -> str:
    return (os.environ.get("TELEGRAM_BOT_URL") or "https://t.me/Putkihq_bot").strip()


# ─────────────────────────── Templates ───────────────────────────

_BRAND = {
    "bg":     "#FBFAF8",
    "paper":  "#F3F0E9",
    "ink":    "#1C1A18",
    "muted":  "#6B665F",
    "amber":  "#B07D18",
    "border": "#E0DACF",
}


def _trap_li(items: List[str]) -> str:
    return "".join(
        f'<li style="margin:0 0 12px 0;line-height:1.55;color:{_BRAND["ink"]};">{i}</li>'
        for i in items
    )


def _subject(lang: str, profile_title: str) -> str:
    if lang == "en":
        return f"Your profile: {profile_title} - and 3 traps to watch"
    return f"Profiilisi: {profile_title} - ja 3 ansaa, joista varoa"


def _html(*, lang: str, profile_title: str, profile_index: str,
          blind_spot: str, traps: List[str], tg_url: str) -> str:
    is_en = lang == "en"
    h_blindspot   = "Your blind spot"           if is_en else "Sokea pisteesi"
    h_traps       = "Your three traps"          if is_en else "Kolme ansaa"
    h_traps_sub   = ("Each one is the longest single risk factor in your player type." if is_en
                     else "Jokainen on pisin yksittäinen riskitekijä pelaajatyypissäsi.")
    cta_tg        = "Join the Telegram circle" if is_en else "Liity Telegram-piiriin"
    footer_a      = ("Free profiler, no payments, no purchase. You can unsubscribe any time." if is_en
                     else "Ilmainen profilointi, ei maksuja, ei ostoja. Voit perua tilauksen milloin tahansa.")
    footer_b      = ("This email was triggered because you completed the PUTKI HQ behavioral profiler at putkihq.fi/peliareena." if is_en
                     else "Tämä viesti lähetettiin, koska teit PUTKI HQ:n pelaajaprofiilin osoitteessa putkihq.fi/peliareena.")
    eyebrow       = "PUTKI HQ · BEHAVIORAL PROFILER" if is_en else "PUTKI HQ · PELAAJAPROFIILI"

    return f"""<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:{_BRAND['bg']};font-family:Georgia,'Newsreader',serif;color:{_BRAND['ink']};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:{_BRAND['bg']};">
    <tr><td align="center" style="padding:32px 16px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600"
             style="max-width:600px;background:{_BRAND['bg']};">
        <tr><td style="padding:0 0 18px 0;">
          <div style="font-family:'JetBrains Mono','Menlo',monospace;font-size:11px;letter-spacing:0.18em;color:{_BRAND['amber']};font-weight:700;">
            {eyebrow}
          </div>
        </td></tr>

        <tr><td style="padding:0 0 18px 0;">
          <!-- Inline OG identity card (CID attachment) -->
          <img src="cid:putki-profile" alt="{profile_title}"
               style="display:block;width:100%;max-width:600px;height:auto;border:1px solid {_BRAND['border']};border-radius:4px;">
        </td></tr>

        <tr><td style="padding:6px 0 18px 0;">
          <div style="font-family:'JetBrains Mono','Menlo',monospace;font-size:11px;color:{_BRAND['muted']};letter-spacing:0.14em;">
            {profile_index}
          </div>
          <h1 style="font-family:Georgia,'Fraunces',serif;font-weight:700;font-size:30px;line-height:1.1;color:{_BRAND['ink']};margin:8px 0 6px 0;letter-spacing:-0.01em;">
            {profile_title}
          </h1>
        </td></tr>

        <tr><td style="padding:8px 0 0 0;border-top:3px solid {_BRAND['amber']};">
          <div style="font-family:'JetBrains Mono','Menlo',monospace;font-size:10px;color:{_BRAND['amber']};font-weight:700;letter-spacing:0.18em;margin:14px 0 8px 0;">
            {h_blindspot.upper()}
          </div>
          <p style="font-family:Georgia,'Newsreader',serif;font-size:17px;line-height:1.55;color:{_BRAND['ink']};margin:0 0 24px 0;">
            {blind_spot}
          </p>
        </td></tr>

        <tr><td style="padding:0 0 22px 0;">
          <div style="font-family:'JetBrains Mono','Menlo',monospace;font-size:10px;color:{_BRAND['amber']};font-weight:700;letter-spacing:0.18em;margin:0 0 6px 0;">
            {h_traps.upper()}
          </div>
          <p style="font-family:Georgia,'Newsreader',serif;font-size:13.5px;line-height:1.55;color:{_BRAND['muted']};margin:0 0 14px 0;">
            {h_traps_sub}
          </p>
          <ol style="margin:0;padding-left:1.2em;font-family:Georgia,'Newsreader',serif;font-size:15.5px;line-height:1.55;color:{_BRAND['ink']};">
            {_trap_li(traps)}
          </ol>
        </td></tr>

        <tr><td align="center" style="padding:8px 0 22px 0;">
          <a href="{tg_url}" style="display:inline-block;background:{_BRAND['ink']};color:{_BRAND['bg']};padding:14px 24px;font-family:'JetBrains Mono','Menlo',monospace;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:4px;">
            {cta_tg} →
          </a>
        </td></tr>

        <tr><td style="padding:18px 0 6px 0;border-top:1px solid {_BRAND['border']};">
          <p style="font-family:'JetBrains Mono','Menlo',monospace;font-size:10px;line-height:1.6;color:{_BRAND['muted']};margin:0 0 6px 0;">
            {footer_a}
          </p>
          <p style="font-family:'JetBrains Mono','Menlo',monospace;font-size:10px;line-height:1.6;color:{_BRAND['muted']};margin:0;">
            {footer_b}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


# ───────────────────────── Dispatch core ─────────────────────────

PROFILE_INDEX_5 = {
    "cold_calculator":   "01 / 05",
    "patient_tactician": "02 / 05",
    "streak_chaser":     "03 / 05",
    "comeback_believer": "04 / 05",
    "tilt_risk":         "05 / 05",
}


async def send_welcome_email(
    *,
    db,
    email: str,
    email_hash: str,
    source_game: str,
    persona_key: str,
    persona_title_fi: str,
    persona_title_en: str,
    blind_spot_fi: str,
    blind_spot_en: str,
    three_traps_fi: List[str],
    three_traps_en: List[str],
    lang: str = "fi",
) -> Dict[str, Any]:
    """Idempotent welcome email dispatch. Returns a dict describing the
    outcome ({sent: bool, mode: live|mocked|skipped, id: str|None})."""

    # ── Idempotency guard
    existing = await db.mini_game_leads.find_one(
        {"email_hash": email_hash, "source_game": source_game,
         "welcome_email_sent_at": {"$exists": True}},
        {"_id": 0, "welcome_email_id": 1, "welcome_email_sent_at": 1},
    )
    if existing:
        return {"sent": False, "mode": "skipped",
                "reason": "already_sent",
                "id": existing.get("welcome_email_id")}

    profile_title = persona_title_en if lang == "en" else persona_title_fi
    blind_spot    = blind_spot_en    if lang == "en" else blind_spot_fi
    traps         = three_traps_en   if lang == "en" else three_traps_fi
    profile_index = PROFILE_INDEX_5.get(persona_key, "01 / 05")

    # ── Render the inline OG card PNG (Pillow)
    try:
        from profiler_og import render_from_persona_key
        og_png_bytes = render_from_persona_key(persona_key, lang=lang)
    except Exception:
        logger.exception("welcome_email: OG render failed - sending without inline image")
        og_png_bytes = None

    subject = _subject(lang, profile_title)
    html = _html(
        lang=lang, profile_title=profile_title, profile_index=profile_index,
        blind_spot=blind_spot, traps=traps, tg_url=_telegram_url(),
    )

    mode = "live" if is_live() else "mocked"
    email_id: Optional[str] = None
    error: Optional[str] = None

    if mode == "live":
        try:
            r = _load_resend()
            r.api_key = os.environ["RESEND_API_KEY"]
            params: Dict[str, Any] = {
                "from": _sender(),
                "to": [email],
                "subject": subject,
                "html": html,
            }
            if og_png_bytes:
                params["attachments"] = [{
                    "filename": "putki-profile.png",
                    # Resend Python SDK expects raw bytes OR base64 str. We
                    # send base64 explicitly for portability.
                    "content": base64.b64encode(og_png_bytes).decode("ascii"),
                    "content_id": "putki-profile",
                    "content_type": "image/png",
                    "disposition": "inline",
                }]
            resp = await asyncio.to_thread(r.Emails.send, params)
            email_id = (resp or {}).get("id")
            if not email_id:
                error = "no_email_id_in_response"
        except Exception as e:
            logger.exception("Resend live send failed for %s", email)
            error = f"send_failed:{type(e).__name__}:{e}"
            mode = "live_failed"
    else:
        email_id = f"mocked:{uuid.uuid4()}"
        logger.info("welcome_email MOCKED - would have sent to %s (subject=%r persona=%s lang=%s)",
                    email, subject, persona_key, lang)

    # ── Stamp the lead row so we don't double-send
    if email_id:
        await db.mini_game_leads.update_many(
            {"email_hash": email_hash, "source_game": source_game},
            {"$set": {
                "welcome_email_sent_at": datetime.now(timezone.utc).isoformat(),
                "welcome_email_id": email_id,
                "welcome_email_mode": mode,
                "welcome_email_lang": lang,
            }},
        )

    return {
        "sent": bool(email_id) and mode in ("live", "mocked"),
        "mode": mode,
        "id": email_id,
        "error": error,
    }
