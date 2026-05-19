"""PUTKI HQ — Voita Telegram bot (Sprint B Slice 3).

Inbound webhook + outbound DM helper for `@Putkihq_bot`.

Reference: https://core.telegram.org/bots/api

Wiring summary
--------------
1. Frontend ContactGate generates a `pending_id` (UUID) per session and
   commits the raffle entry with `contact_channel='telegram', pending_id=…`
   before opening `t.me/Putkihq_bot?start={pending_id}` in a new tab.
2. The user lands in Telegram, taps START. Telegram POSTs the resulting
   `/start <pending_id>` message to our webhook (configured via
   `setWebhook`).
3. `handle_update` resolves the pending_id → `voita_entries` row, binds
   the chat_id + telegram_username + timestamp, and replies with a rich
   confirmation card (match · pick · score · confidence · position).
4. After raffle draw, a follow-up hook (NOT in this slice — see
   `send_post_match_result`) DMs every bound entry with the result.

Security
--------
- Webhook validates `X-Telegram-Bot-Api-Secret-Token` against env var
  `TELEGRAM_WEBHOOK_SECRET` when set. Telegram includes this header on
  every update when `set_webhook(secret_token=…)` was used.
- Bot token is read from `TELEGRAM_BOT_TOKEN` at call time (no module
  globals) so re-rotating doesn't need a reload.
- No PII leaks: pending_id is the only thing the user pastes; chat_id is
  stored opaque on the entry doc.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

_TG_API = "https://api.telegram.org"


def _bot_token() -> str:
    return (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()


def _webhook_secret() -> str:
    return (os.environ.get("TELEGRAM_WEBHOOK_SECRET") or "").strip()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Outbound helpers ─────────────────────────────────────────────────────

async def send_message(
    chat_id: int | str, text: str, *,
    parse_mode: str = "HTML",
    disable_web_page_preview: bool = True,
    reply_markup: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Single-shot sendMessage. Returns Telegram's response payload or
    `{ok: False, error: …}` on transport failure. Does NOT raise."""
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN not set", "mocked": True}
    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": disable_web_page_preview,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(f"{_TG_API}/bot{token}/sendMessage", json=payload)
        try:
            return r.json()
        except Exception:
            return {"ok": False, "error": f"non-json response status={r.status_code}", "body": r.text[:400]}
    except Exception as exc:
        logger.exception("telegram sendMessage failed")
        return {"ok": False, "error": str(exc)[:300]}


async def set_webhook(url: str, *, secret_token: Optional[str] = None,
                      drop_pending_updates: bool = True) -> Dict[str, Any]:
    """Register the webhook URL with Telegram. Idempotent — Telegram
    overwrites whatever was previously configured."""
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN not set"}
    payload: Dict[str, Any] = {
        "url": url,
        "drop_pending_updates": drop_pending_updates,
        "allowed_updates": ["message"],
    }
    if secret_token:
        payload["secret_token"] = secret_token
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(f"{_TG_API}/bot{token}/setWebhook", json=payload)
        try:
            return r.json()
        except Exception:
            return {"ok": False, "error": f"non-json response status={r.status_code}", "body": r.text[:400]}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:300]}


async def get_webhook_info() -> Dict[str, Any]:
    token = _bot_token()
    if not token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN not set"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.get(f"{_TG_API}/bot{token}/getWebhookInfo")
        return r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:300]}


# ── Update dispatcher ────────────────────────────────────────────────────

async def handle_update(db, update: Dict[str, Any]) -> Dict[str, Any]:
    """Entry-point for Telegram webhook POSTs. Returns a small dict for
    audit/logging — Telegram itself only cares that we 200 quickly."""
    msg = update.get("message") or update.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()
    from_user = msg.get("from") or {}
    username = (from_user.get("username") or "").strip()

    if not chat_id or not text:
        return {"handled": False, "reason": "no_chat_or_text"}

    # We only care about /start <pending_id> for this slice. Everything
    # else gets a polite "unknown command" reply.
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token_arg = parts[1].strip()[:96] if len(parts) > 1 else ""
        # Mittari subscription flow uses `mittari_<pending_id>` so we can
        # distinguish raffle entries from signal subscriptions on the
        # same bot. Both reuse the per-session UUID pattern.
        if token_arg.startswith("mittari_"):
            return await _handle_mittari_start(
                db, chat_id=chat_id, username=username,
                pending_id=token_arg[len("mittari_"):],
            )
        return await _handle_start(db, chat_id=chat_id, username=username,
                                   pending_id=token_arg)

    if text.startswith("/stop") or text.startswith("/unsubscribe"):
        # Soft unsubscribe — flip active=False for any subscriber bound
        # to this chat_id. Keep the row for audit.
        res = await db.mittari_subscribers.update_many(
            {"telegram_chat_id": str(chat_id)},
            {"$set": {"active": False, "unsubscribed_at": _now_iso()}},
        )
        if res.modified_count > 0:
            await send_message(chat_id,
                "🛑 <b>Tilaus lopetettu</b>\n\n"
                "Et saa enää Mittari-ilmoituksia. Voit tilata uudelleen sivulla:\n"
                "https://putkihq.fi/mittari")
        else:
            await send_message(chat_id,
                "ℹ️ Aktiivista tilausta ei löytynyt tästä chatista.")
        return {"handled": True, "kind": "stop", "deactivated": res.modified_count}

    if text.startswith("/help"):
        await send_message(chat_id,
            "ℹ️ <b>PUTKI HQ Voita bot</b>\n\n"
            "Tämä botti vahvistaa arvonta­osallistumisesi ja ilmoittaa tuloksen ottelun jälkeen.\n\n"
            "Avaa <code>/start &lt;koodi&gt;</code> nettisivulta — koodi on osallistumis­kuittauksen Telegram-painikkeessa.\n\n"
            "Lue lisää: https://putkihq.fi/voita")
        return {"handled": True, "kind": "help"}

    # Unknown / chitchat — minimal reply, no LLM here.
    await send_message(chat_id,
        "Hei! Tämä on PUTKI HQ:n Voita-arvonnan vahvistus­botti.\n"
        "Käytä nettisivun Telegram-painiketta osallistuaksesi: https://putkihq.fi/voita")
    return {"handled": True, "kind": "fallback"}


async def _handle_start(db, *, chat_id: int | str, username: str,
                        pending_id: str) -> Dict[str, Any]:
    if not pending_id:
        await send_message(chat_id,
            "👋 Tervetuloa! Käytä nettisivun Telegram-painiketta — saat henkilökohtaisen koodin, "
            "joka linkittää osallistumisesi.\n\nhttps://putkihq.fi/voita")
        return {"handled": True, "kind": "start_no_pending"}

    # Resolve entry by pending_id. We expect exactly one match per
    # session; the FE generates a UUID each time.
    entry = await db.voita_entries.find_one(
        {"pending_id": pending_id},
        {"_id": 0},
    )
    if not entry:
        await send_message(chat_id,
            "❌ Koodia ei löydy. Kokeile osallistua uudelleen sivulla:\n"
            "https://putkihq.fi/voita")
        return {"handled": True, "kind": "start_unknown_pending"}

    # Already bound? Resend the confirmation card so the user can re-open it.
    already_bound = bool(entry.get("telegram_chat_id"))

    # Pull the raffle for rich copy (home/away/kickoff/league).
    raffle = await db.voita_raffles.find_one(
        {"id": entry.get("raffle_id")},
        {"_id": 0, "home_team": 1, "away_team": 1, "league": 1, "sport": 1, "kickoff_at": 1, "slug": 1},
    ) or {}

    # Bind chat_id + username + timestamp. Idempotent — re-binding the
    # same chat is fine; cross-chat re-binding (different chat_id, same
    # pending_id) overwrites with the most recent.
    await db.voita_entries.update_one(
        {"id": entry["id"]},
        {"$set": {
            "telegram_chat_id": str(chat_id),
            "telegram_username": username or None,
            "telegram_bound_at": _now_iso(),
            "contact_channel": "telegram",
        }},
    )

    # Compute entry position (1-indexed) — cheap re-count for the card.
    position = await db.voita_entries.count_documents({
        "raffle_id": entry.get("raffle_id"),
        "created_at": {"$lte": entry.get("created_at", _now_iso())},
    })

    card = _render_confirmation_card(entry=entry, raffle=raffle, position=position,
                                     already_bound=already_bound)
    await send_message(chat_id, card)
    return {
        "handled": True, "kind": "start_bound",
        "entry_id": entry.get("id"),
        "raffle_slug": entry.get("raffle_slug"),
        "already_bound": already_bound,
    }


def _render_confirmation_card(*, entry: Dict[str, Any], raffle: Dict[str, Any],
                              position: int, already_bound: bool) -> str:
    home = raffle.get("home_team") or "Koti"
    away = raffle.get("away_team") or "Vieras"
    league = (raffle.get("league") or raffle.get("sport") or "").upper()
    pick = entry.get("prediction_one_x_two", "?")
    ph = entry.get("predicted_home_goals", "?")
    pa = entry.get("predicted_away_goals", "?")
    conf = entry.get("confidence")
    kickoff = _format_kickoff(raffle.get("kickoff_at"))

    pick_label = {
        "1": f"{home} voittaa",
        "X": "Tasapeli",
        "2": f"{away} voittaa",
    }.get(pick, pick)

    header = "🔁 <b>Osallistuminen jo vahvistettu</b>\n" if already_bound else "✅ <b>OSALLISTUMINEN LUKITTU</b>\n"
    lines = [
        header,
        f"<b>{home} vs {away}</b>",
        f"<i>{league}</i>" if league else "",
        "",
        f"🎯 <b>Veikkauksesi</b>: {pick_label} · {ph}–{pa}",
        f"📊 <b>Varmuus</b>: {conf}/5" if conf else "",
        f"🪪 <b>Osallistuja</b> #{position}",
        "",
        f"⏰ Ilmoitamme tuloksen <b>{kickoff}</b> jälkeen.",
        "",
        "Ei spämmiä. Yksi viesti per arvonta.",
    ]
    return "\n".join([ln for ln in lines if ln != ""])


def _format_kickoff(iso: Optional[str]) -> str:
    if not iso:
        return "ottelun"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return "ottelun"
    # Helsinki local time without dragging zoneinfo: UTC+2/+3 is close
    # enough for editorial copy. If precision matters later, swap to
    # zoneinfo("Europe/Helsinki").
    months_fi = ["", "tammi", "helmi", "maalis", "huhti", "touko", "kesä",
                 "heinä", "elo", "syys", "loka", "marras", "joulu"]
    return f"{dt.day}. {months_fi[dt.month]} klo {dt.strftime('%H:%M')}"


# ── Mittari subscription handler ─────────────────────────────────────────

async def _handle_mittari_start(db, *, chat_id: int | str, username: str,
                                 pending_id: str) -> Dict[str, Any]:
    """Bind a Mittari subscriber. Unlike Voita raffles (one-shot per
    match), Mittari subscribers persist until /stop — they receive
    state-change pings + daily signals."""
    pending_id = (pending_id or "").strip()[:64]
    if not pending_id:
        await send_message(chat_id,
            "👋 Tervetuloa! Käytä Mittarin <b>SAA SIGNAALIT</b>-painiketta sivulla:\n"
            "https://putkihq.fi/mittari")
        return {"handled": True, "kind": "mittari_no_pending"}

    sub = await db.mittari_subscribers.find_one({"pending_id": pending_id}, {"_id": 0})
    already = bool(sub and sub.get("telegram_chat_id"))

    now = _now_iso()
    await db.mittari_subscribers.update_one(
        {"pending_id": pending_id},
        {"$set": {
            "pending_id": pending_id,
            "telegram_chat_id": str(chat_id),
            "telegram_username": username or None,
            "telegram_bound_at": now,
            "consent_tag": "mittari_alerts",
            "source": "mittari_signals",
            "active": True,
            "last_seen_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    # Pull current Mittari state for the welcome card.
    try:
        from dial_engine import latest_snapshot
        dial = await latest_snapshot(db) or {}
    except Exception:
        dial = {}
    state_key = ((dial.get("state") or {}).get("key") or "KYLMA").upper()
    score = dial.get("composite_score") or (dial.get("state") or {}).get("value") or 0
    state_label = _STATE_LABEL_FI.get(state_key, state_key)

    header = ("🔁 <b>Tilaus jo vahvistettu</b>\n" if already
              else "✅ <b>MITTARI · SIGNAALIT AVATTU</b>\n")
    text = (
        f"{header}\n"
        f"📡 <b>Mittari nyt</b>: {state_label} ({int(score)}/100)\n\n"
        "Saat:\n"
        "• 📊 Päivän 5 signaalia (klo 10:00 EET)\n"
        "• ⚡ Heti-ilmoitus kun Mittari vaihtaa tilaa\n"
        "• 🛑 Lopeta milloin vain: lähetä /stop\n\n"
        "https://putkihq.fi/mittari"
    )
    await send_message(chat_id, text)
    return {"handled": True, "kind": "mittari_bound", "already_bound": already}


_STATE_LABEL_FI = {
    "KYLMA": "TYYNI", "HAALEA": "VIRE", "KUUMA": "VIPINÄ",
    "MYRSKY": "MEININKI", "KIIRASTULI": "PERKELE",
}


async def broadcast_mittari_state_change(db, *, from_state: str, to_state: str,
                                         score: float) -> Dict[str, Any]:
    """Fan-out a state-change ping to every active Mittari subscriber.
    Called by `dial_engine.compute_and_store` whenever the quantised
    state flips."""
    from_label = _STATE_LABEL_FI.get((from_state or "").upper(), from_state or "—")
    to_label = _STATE_LABEL_FI.get((to_state or "").upper(), to_state or "—")
    text = (
        f"⚡ <b>MITTARI · TILANVAIHTO</b>\n\n"
        f"<b>{from_label} → {to_label}</b>\n"
        f"Yhdistelmäpiste: <b>{int(score)}/100</b>\n\n"
        "https://putkihq.fi/mittari"
    )
    sent = 0
    failed = 0
    cur = db.mittari_subscribers.find(
        {"active": True, "telegram_chat_id": {"$ne": None}},
        {"_id": 0, "telegram_chat_id": 1},
    )
    async for sub in cur:
        chat = sub.get("telegram_chat_id")
        if not chat:
            continue
        res = await send_message(chat, text)
        if res.get("ok"):
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "from_state": from_state, "to_state": to_state}


# ── Post-match result ping (used by draw flow) ───────────────────────────

async def send_post_match_result(db, *, entry: Dict[str, Any],
                                  is_winner: bool, score: Optional[int],
                                  actual_score: Optional[str]) -> Dict[str, Any]:
    """Called from `voita_engine.draw_raffle` (or admin) per entry that
    has a bound chat_id. Pure side effect; failure is logged + ignored."""
    chat_id = entry.get("telegram_chat_id")
    if not chat_id:
        return {"sent": False, "reason": "no_chat_id"}
    home = entry.get("home_team") or ""
    away = entry.get("away_team") or ""
    pick = entry.get("prediction_one_x_two", "?")
    ph = entry.get("predicted_home_goals", "?")
    pa = entry.get("predicted_away_goals", "?")
    if is_winner:
        text = (
            "🏆 <b>VOITTO!</b>\n\n"
            f"{home} vs {away} → <b>{actual_score or '—'}</b>\n"
            f"Veikkauksesi: {pick} · {ph}–{pa}\n"
            f"Pisteet: <b>{score if score is not None else '—'}</b>\n\n"
            "Toimituksemme on yhteydessä palkinnon toimittamisesta."
        )
    else:
        text = (
            "📋 <b>Arvonta päätöksessä</b>\n\n"
            f"{home} vs {away} → <b>{actual_score or '—'}</b>\n"
            f"Veikkauksesi: {pick} · {ph}–{pa}\n"
            f"Pisteet: <b>{score if score is not None else '—'}</b>\n\n"
            "Ei voittoa tällä kertaa. Kiitos osallistumisesta — jatkamme uudella arvonnalla pian."
        )
    res = await send_message(chat_id, text)
    return {"sent": bool(res.get("ok")), "raw": res}
