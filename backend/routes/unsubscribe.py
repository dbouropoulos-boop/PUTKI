"""
PUTKI HQ — One-click unsubscribe (iter97f).

Powers the `List-Unsubscribe` + `List-Unsubscribe-Post` headers that
ship on every daily-tips email. Required for Gmail/Outlook to render
their native in-client "Unsubscribe" button next to the sender name,
which is what keeps the daily fanout out of the spam folder.

Token format:
    "<base64url(identifier)>.<hmac_sha256_sig_16hex>"

    identifier  — the email address that opted in (`optin_consents.identifier`)
    sig         — first 16 hex chars of HMAC-SHA256(secret, identifier)

Long enough to be unguessable, short enough to fit in a URL, and idempotent:
re-issuing the token for the same address produces the same value, so links
embedded in older emails stay valid forever.

Endpoints:
    GET  /api/u/{token}   — render confirmation page (FI default, ?lang=en supported)
    POST /api/u/{token}   — flip status → "unsubscribed", record audit row
    POST /api/u/{token}/one-click  — RFC 8058 one-click endpoint (no UI)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

from routes._helpers import get_db

logger = logging.getLogger(__name__)

# Secret derives from JWT_SECRET so we don't add yet another env var.
# A separate kdf-style prefix prevents accidental cross-purpose reuse.
_UNSUB_SECRET = (
    "putki-hq-unsubscribe-v1:" + (os.environ.get("JWT_SECRET") or "")
).encode("utf-8")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(token: str) -> bytes:
    pad = "=" * (-len(token) % 4)
    return base64.urlsafe_b64decode(token + pad)


def _sign(identifier: str) -> str:
    mac = hmac.new(_UNSUB_SECRET, identifier.encode("utf-8"), hashlib.sha256)
    return mac.hexdigest()[:16]


def mint_token(identifier: str) -> str:
    """Public — used by the email fanout to embed an unsubscribe link.
    Same identifier always produces the same token (idempotent)."""
    if not identifier:
        return ""
    enc = _b64url(identifier.strip().lower().encode("utf-8"))
    return f"{enc}.{_sign(identifier.strip().lower())}"


def parse_token(token: str) -> Optional[str]:
    """Verify and decode. Returns the identifier (email) or None if invalid."""
    if not token or "." not in token:
        return None
    enc, sig = token.split(".", 1)
    try:
        identifier = _b64url_decode(enc).decode("utf-8")
    except Exception:
        return None
    expected = _sign(identifier)
    if not hmac.compare_digest(expected, sig):
        return None
    return identifier


# ── HTML templates ───────────────────────────────────────────────────
_BASE_CSS = """
<style>
  :root { --bg:#FFF; --ink:#0A0A0A; --muted:#6B6862; --line:#EFECE3; --ember:#D9461E; }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--ink);
              font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:560px; margin:0 auto; padding:80px 24px 40px; }
  .brand { font-family:'Source Serif 4',Georgia,serif; font-weight:500;
           font-size:34px; letter-spacing:-0.02em; margin-bottom:48px; }
  .brand .dot { color:var(--ember); }
  .label { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:11px;
           letter-spacing:0.18em; text-transform:uppercase; color:var(--muted);
           margin-bottom:14px; }
  h1 { font-family:'Source Serif 4',Georgia,serif; font-weight:500; font-size:32px;
       line-height:1.2; margin:0 0 16px; }
  p { font-size:15px; line-height:1.55; color:var(--muted); margin:0 0 20px; }
  .email { color:var(--ink); font-weight:600; }
  form { margin-top:32px; display:flex; gap:12px; flex-wrap:wrap; }
  button { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:11px;
           font-weight:700; letter-spacing:0.14em; text-transform:uppercase;
           padding:14px 20px; border:none; border-radius:0; cursor:pointer; }
  .primary { background:var(--ink); color:#FFF; }
  .primary:hover { background:var(--ember); }
  .ghost { background:transparent; border:1px solid var(--line); color:var(--ink); }
  .ok { padding:14px 16px; background:#F4FBF6; border-left:3px solid #1F7A3A;
        font-size:14px; color:#1F7A3A; margin:24px 0; }
  .err { padding:14px 16px; background:#FBF1EE; border-left:3px solid var(--ember);
         font-size:14px; color:var(--ember); margin:24px 0; }
  .foot { margin-top:64px; padding-top:24px; border-top:1px solid var(--line);
          font-family:'JetBrains Mono',ui-monospace,monospace; font-size:11px;
          color:var(--muted); letter-spacing:0.06em; }
  .foot a { color:var(--muted); text-decoration:none; }
  .foot a:hover { color:var(--ink); }
</style>
"""


def _html_confirm(identifier: str, token: str, lang: str = "fi") -> str:
    if lang == "en":
        eyebrow = "Unsubscribe"
        h1 = "Stop daily signals?"
        body = (
            f"<p>You're about to unsubscribe <span class=\"email\">{identifier}</span> "
            "from the PUTKI HQ daily signals email.</p>"
            "<p>You can resubscribe anytime via putkihq.fi/mittari.</p>"
        )
        confirm = "Confirm unsubscribe"
        cancel = "Cancel"
    else:
        eyebrow = "Peruuta tilaus"
        h1 = "Lopetetaanko päivän signaalit?"
        body = (
            f"<p>Olet peruuttamassa osoitteen <span class=\"email\">{identifier}</span> "
            "tilausta PUTKI HQ:n päivän signaalit -sähköposteihin.</p>"
            "<p>Voit tilata uudelleen milloin tahansa osoitteessa putkihq.fi/mittari.</p>"
        )
        confirm = "Vahvista peruutus"
        cancel = "Peruuta"

    return f"""<!DOCTYPE html>
<html lang="{lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PUTKI HQ — {eyebrow}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Source+Serif+4:wght@400;500;600&display=swap" rel="stylesheet">
{_BASE_CSS}
</head>
<body>
  <div class="wrap">
    <div class="brand">Putki<span class="dot">.</span></div>
    <div class="label">{eyebrow}</div>
    <h1>{h1}</h1>
    {body}
    <form method="POST" action="/api/u/{token}">
      <button type="submit" class="primary" data-testid="unsub-confirm">{confirm}</button>
      <a href="https://putkihq.fi/" data-testid="unsub-cancel">
        <button type="button" class="ghost">{cancel}</button>
      </a>
    </form>
    <div class="foot">PUTKI HQ · putkihq.fi · Helsinki</div>
  </div>
</body></html>"""


def _html_done(identifier: str, lang: str = "fi") -> str:
    if lang == "en":
        eyebrow = "Unsubscribed"
        h1 = "You're off the list."
        body = (
            f"<div class=\"ok\">No more daily-signals emails to <span class=\"email\">{identifier}</span>. "
            "You'll still be able to use putkihq.fi as a guest.</div>"
            "<p>If this was a mistake, drop us a line at <a href=\"mailto:tuki@putkihq.fi\">tuki@putkihq.fi</a> "
            "or resubscribe from <a href=\"https://putkihq.fi/mittari\">/mittari</a>.</p>"
        )
    else:
        eyebrow = "Tilaus peruttu"
        h1 = "Olet pois listalta."
        body = (
            f"<div class=\"ok\">Ei enää päivän signaali -sähköposteja osoitteeseen "
            f"<span class=\"email\">{identifier}</span>. Voit yhä käyttää sivustoa putkihq.fi.</div>"
            "<p>Jos tämä oli vahinko, ota yhteyttä <a href=\"mailto:tuki@putkihq.fi\">tuki@putkihq.fi</a> "
            "tai tilaa uudelleen osoitteessa <a href=\"https://putkihq.fi/mittari\">/mittari</a>.</p>"
        )

    return f"""<!DOCTYPE html>
<html lang="{lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PUTKI HQ — {eyebrow}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Source+Serif+4:wght@400;500;600&display=swap" rel="stylesheet">
{_BASE_CSS}
</head>
<body>
  <div class="wrap">
    <div class="brand">Putki<span class="dot">.</span></div>
    <div class="label">{eyebrow}</div>
    <h1>{h1}</h1>
    {body}
    <div class="foot">PUTKI HQ · putkihq.fi · Helsinki</div>
  </div>
</body></html>"""


def _html_invalid(lang: str = "fi") -> str:
    if lang == "en":
        h1, msg = "Invalid unsubscribe link", "This link is expired or malformed. Contact tuki@putkihq.fi for help."
    else:
        h1, msg = "Virheellinen linkki", "Linkki on vanhentunut tai virheellinen. Ota yhteyttä tuki@putkihq.fi."
    return f"""<!DOCTYPE html><html lang="{lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Source+Serif+4:wght@400;500;600&display=swap" rel="stylesheet">
{_BASE_CSS}</head><body><div class="wrap">
<div class="brand">Putki<span class="dot">.</span></div>
<div class="label">{h1.upper()}</div><h1>{h1}</h1>
<div class="err">{msg}</div>
</div></body></html>"""


# ── Persistence ──────────────────────────────────────────────────────
async def _mark_unsubscribed(db, identifier: str, request: Request) -> int:
    """Flip every email opt-in row for this identifier to status=unsubscribed
    and write one audit row. Returns the number of opt-in rows touched."""
    now = datetime.now(timezone.utc).isoformat()
    ua = (request.headers.get("user-agent") or "")[:300]
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "")
    )[:64]

    res = await db.optin_consents.update_many(
        {"channel": "email", "identifier": identifier.strip().lower()},
        {"$set": {
            "status": "unsubscribed",
            "unsubscribed_at": now,
            "unsubscribed_ip": ip,
            "unsubscribed_ua": ua,
        }},
    )
    try:
        await db.unsubscribe_log.insert_one({
            "identifier": identifier.strip().lower(),
            "channel": "email",
            "unsubscribed_at": now,
            "ip": ip,
            "user_agent": ua,
            "matched_count": res.modified_count,
        })
    except Exception:
        logger.exception("unsubscribe_log insert failed for %s", identifier)
    return int(res.modified_count or 0)


# ── Router ───────────────────────────────────────────────────────────
def make_router() -> APIRouter:
    router = APIRouter()

    @router.get("/u/{token}", response_class=HTMLResponse)
    async def unsub_get(token: str, request: Request, lang: str = "fi", db = Depends(get_db)):
        identifier = parse_token(token)
        if not identifier:
            return HTMLResponse(_html_invalid(lang), status_code=400)
        # Mirror current status into the page (already-unsubscribed users
        # get the "done" page instead of a confirm form).
        row = await db.optin_consents.find_one(
            {"channel": "email", "identifier": identifier.strip().lower()},
            {"_id": 0, "status": 1},
        )
        if row and (row.get("status") == "unsubscribed"):
            return HTMLResponse(_html_done(identifier, lang))
        return HTMLResponse(_html_confirm(identifier, token, lang))

    @router.post("/u/{token}", response_class=HTMLResponse)
    async def unsub_post(token: str, request: Request, lang: str = "fi", db = Depends(get_db)):
        identifier = parse_token(token)
        if not identifier:
            return HTMLResponse(_html_invalid(lang), status_code=400)
        await _mark_unsubscribed(db, identifier, request)
        return HTMLResponse(_html_done(identifier, lang))

    # ── RFC 8058 one-click endpoint ─────────────────────────────────
    # Gmail's "Unsubscribe" button issues a POST with `List-Unsubscribe=
    # One-Click` to this URL, expecting a 200/204 without a UI page.
    @router.post("/u/{token}/one-click")
    async def unsub_one_click(token: str, request: Request, db = Depends(get_db)):
        identifier = parse_token(token)
        if not identifier:
            return PlainTextResponse("invalid", status_code=400)
        await _mark_unsubscribed(db, identifier, request)
        return PlainTextResponse("ok", status_code=200)

    return router


async def ensure_indexes(db) -> None:
    await db.unsubscribe_log.create_index("identifier", background=True)
    await db.unsubscribe_log.create_index("unsubscribed_at", background=True)
