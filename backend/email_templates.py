"""
PUTKI HQ — Email + Telegram template system.

Single source of truth for every templated message the platform sends.
Templates are stored in `db.settings` under `_id="email_templates"`
(singleton dict keyed by template slug) so the back-office editor can
override the defaults without a deploy. Rendering uses simple `{var}`
substitution — deliberately not Jinja, so a typo in the editor cannot
trigger arbitrary Python evaluation.

Slug map:
  voita_playbook            — current sports raffle playbook (existing live)
  mestari_sports_day{1..5}  — sports diagnostic 5-day playbook
  mestari_poker_day{1..5}   — poker diagnostic 5-day playbook   ← gated
  mestari_blackjack_day{1..5} — blackjack diagnostic playbook   ← gated
  streamer_alert_welcome    — streamer alerts band signup confirmation
  voita_winner              — raffle win notification (admin-triggered)
  telegram_welcome          — Telegram /start welcome message
  telegram_bound            — confirmation after a user binds via deep-link

Each template carries:
  - subject_fi / subject_en (FI is primary)
  - body_text_fi / body_text_en (multipart plain-text)
  - body_html_fi / body_html_en (multipart HTML)
  - meta: channel ("email"|"telegram"), gated (true/false), description
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Killswitch: when False, any template with `gated=True` cannot dispatch
# (lead capture still works — the row is just held in the outbox in
# status='draft_pending'). Mirrors PLAYBOOK_EMAIL_DISPATCH_READY in
# `mestari_diagnostics.py` so a single env var controls all placeholder
# content.
DISPATCH_READY = os.environ.get(
    "PLAYBOOK_EMAIL_DISPATCH_READY", "0"
).strip() not in {"0", "false", "False", ""}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Default template seed ────────────────────────────────────────────
# Body bodies are deliberately concise; the editor can polish later.
# Variables consumed by render(): {name}, {profile_name}, {diagnostic},
# {raffle_title}, {entry_position}, {prize_label}, {redeem_url},
# {unsubscribe_url}, {magic_link}, {site_url}.
_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "voita_playbook": {
        "channel": "email",
        "gated": False,
        "description": "Sports raffle entry confirmation + 5-day playbook PDF attached.",
        "subject_fi": "Pelikirjasi: {raffle_title} — Putki HQ",
        "subject_en": "Your playbook: {raffle_title} — Putki HQ",
        "body_text_fi": "Hei {name},\n\nKiitos, että osallistuit arvontaan ({raffle_title}). Sijasi on #{entry_position}.\n\nLiitteenä 5 päivän pelikirja siitä, miten vedonlyöntimarkkinat oikeasti käyttäytyvät.\n\n— Putki HQ\n\nPeruuta tilaus: {unsubscribe_url}",
        "body_text_en": "Hi {name},\n\nThanks for entering the raffle ({raffle_title}). Your position is #{entry_position}.\n\nAttached: the 5-day playbook on how betting markets actually behave.\n\n— Putki HQ\n\nUnsubscribe: {unsubscribe_url}",
        "body_html_fi": "<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><p>Hei {name},</p><p>Kiitos, että osallistuit arvontaan (<strong>{raffle_title}</strong>). Sijasi on <strong>#{entry_position}</strong>.</p><p>Liitteenä 5 päivän pelikirja siitä, miten vedonlyöntimarkkinat oikeasti käyttäytyvät.</p><p style='color:#888;font-size:13px;margin-top:32px'>— Putki HQ<br/><a href='{unsubscribe_url}' style='color:#888'>Peruuta tilaus</a></p></div>",
        "body_html_en": "<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><p>Hi {name},</p><p>Thanks for entering the raffle (<strong>{raffle_title}</strong>). Your position is <strong>#{entry_position}</strong>.</p><p>Attached: the 5-day playbook on how betting markets actually behave.</p><p style='color:#888;font-size:13px;margin-top:32px'>— Putki HQ<br/><a href='{unsubscribe_url}' style='color:#888'>Unsubscribe</a></p></div>",
    },
    "streamer_alert_welcome": {
        "channel": "email",
        "gated": False,
        "description": "Sent the moment someone signs up for streamer-live alerts on the homepage band.",
        "subject_fi": "Tervetuloa — saat ilmoituksen kun striimaajat menevät liveen",
        "subject_en": "Welcome — you'll get a ping when streamers go live",
        "body_text_fi": "Hei {name},\n\nKiitos rekisteröitymisestä. Lähetämme sinulle ilmoituksen heti kun valitsemasi striimaaja aloittaa lähetyksen.\n\nJos haluat saman myös Telegramiin, sido tilisi täällä: {magic_link}\n\n— Putki HQ",
        "body_text_en": "Hi {name},\n\nThanks for signing up. We'll ping you the moment your chosen streamer goes live.\n\nWant the same on Telegram? Bind here: {magic_link}\n\n— Putki HQ",
        "body_html_fi": "<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><p>Hei {name},</p><p>Kiitos rekisteröitymisestä. Lähetämme sinulle ilmoituksen heti kun valitsemasi striimaaja aloittaa lähetyksen.</p><p>Haluatko saman myös Telegramiin? <a href='{magic_link}'>Sido tilisi täällä →</a></p><p style='color:#888;font-size:13px'>— Putki HQ</p></div>",
        "body_html_en": "<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><p>Hi {name},</p><p>Thanks for signing up. We'll ping you the moment your chosen streamer goes live.</p><p>Want the same on Telegram? <a href='{magic_link}'>Bind here →</a></p><p style='color:#888;font-size:13px'>— Putki HQ</p></div>",
    },
    "voita_winner": {
        "channel": "email",
        "gated": False,
        "description": "Manual winner-notification template — admin clicks 'Notify winner' from /back-office/voita.",
        "subject_fi": "Sinä voitit! — {raffle_title}",
        "subject_en": "You won — {raffle_title}",
        "body_text_fi": "Hei {name},\n\nOnnea — sinut on valittu voittajaksi arvonnassa {raffle_title}.\n\nPalkinto: {prize_label}\n\nLunasta täällä: {redeem_url}\n\nAika rajoitettu — vastauksesi 72 tunnin sisällä.\n\n— Putki HQ",
        "body_text_en": "Hi {name},\n\nCongrats — you've been drawn as the winner of {raffle_title}.\n\nPrize: {prize_label}\n\nClaim here: {redeem_url}\n\nTime-bound — please reply within 72 hours.\n\n— Putki HQ",
        "body_html_fi": "<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><p>Hei {name},</p><p>Onnea — sinut on valittu voittajaksi arvonnassa <strong>{raffle_title}</strong>.</p><p><strong>Palkinto:</strong> {prize_label}</p><p><a href='{redeem_url}' style='display:inline-block;padding:14px 22px;background:#5B8DEE;color:#0B0A09;text-decoration:none;font-family:ui-monospace,monospace;letter-spacing:.2em;font-weight:800'>LUNASTA →</a></p><p style='color:#888;font-size:13px'>Aika rajoitettu — vastauksesi 72 tunnin sisällä.<br/>— Putki HQ</p></div>",
        "body_html_en": "<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><p>Hi {name},</p><p>Congrats — you've been drawn as the winner of <strong>{raffle_title}</strong>.</p><p><strong>Prize:</strong> {prize_label}</p><p><a href='{redeem_url}' style='display:inline-block;padding:14px 22px;background:#5B8DEE;color:#0B0A09;text-decoration:none;font-family:ui-monospace,monospace;letter-spacing:.2em;font-weight:800'>CLAIM →</a></p><p style='color:#888;font-size:13px'>Time-bound — please reply within 72 hours.<br/>— Putki HQ</p></div>",
    },
    "telegram_welcome": {
        "channel": "telegram",
        "gated": False,
        "description": "Sent automatically when a user starts a Telegram chat with the bot (/start without a deep-link).",
        "subject_fi": "",
        "subject_en": "",
        "body_text_fi": "Hei! Putki HQ:n bot.\n\nSido tilisi sähköpostiisi täällä: {magic_link}\n\nKun olet sidonnut, saat ilmoitukset valitsemiltasi striimaajilta heti kun he menevät liveen, sekä Mestari-pelikirjasi suoraan tänne.",
        "body_text_en": "Hi! Putki HQ bot.\n\nBind your account to your email: {magic_link}\n\nOnce bound, you'll get streamer-live pings and your Mestari playbook delivered straight here.",
        "body_html_fi": "",
        "body_html_en": "",
    },
    "telegram_bound": {
        "channel": "telegram",
        "gated": False,
        "description": "Confirmation sent after the deep-link bind completes successfully.",
        "subject_fi": "",
        "subject_en": "",
        "body_text_fi": "✓ Tilisi on nyt sidottu ({name}). Saat ilmoitukset suoraan tänne.",
        "body_text_en": "✓ Your account is now bound ({name}). You'll get pings straight here.",
        "body_html_fi": "",
        "body_html_en": "",
    },
}

# Generate the 15 placeholder diagnostic playbook templates programmatically
# — they're gated until per-day copy is signed off.
_PLAYBOOK_DAYS_COPY = {
    "sports": [
        ("Day 1 — How markets price a match", "Markkinat eivät ennusta — ne hinnoittelevat. Tänään: miten alkuhinta syntyy."),
        ("Day 2 — Where soft lines live", "Pehmeä linja kertoo, missä markkina ei vielä tiedä. Esimerkki Veikkausliigasta."),
        ("Day 3 — Public bias & line movement", "Suosikkien yliarvostus. Miksi 95 % yleisöstä on yhdessä rivissä — ja miksi se on signaali."),
        ("Day 4 — Closing line value (CLV)", "Yksi luku, joka erottaa amatöörin ammattilaisesta pitkällä aikavälillä."),
        ("Day 5 — Bankroll & variance", "Kuinka iso on iso. Vain matematiikka, ei mielipiteitä."),
    ],
    "poker": [
        ("Day 1 — Hand selection", "Mitkä lähtökädet, ja miksi valikointi on perusta."),
        ("Day 2 — Position", "Miksi viimeisenä toimiminen on aitoa rahaa."),
        ("Day 3 — Pot odds & EV", "Maksamisen matematiikka — milloin maksu on perusteltu."),
        ("Day 4 — Betting with purpose", "Arvopanostukset vs. bluffi; aggression jossa on merkitys."),
        ("Day 5 — Bankroll & tilt", "Varianssi, lyhyen aikavälin raakuus, miksi kuri voittaa mielialan."),
    ],
    "blackjack": [
        ("Day 1 — How blackjack is built", "Mistä talon etu tulee, ja mikä se oikeasti on."),
        ("Day 2 — Basic strategy: the chart", "Kovat kädet — julkaistu oikea pelitapa."),
        ("Day 3 — The parts people skip", "Pehmeät kädet ja parien jako."),
        ("Day 4 — The myths", "Vakuutus, matki jakajaa, 'erääntyvät' kortit."),
        ("Day 5 — The honest ceiling", "Bankroll, varianssi, totuus korttilaskennasta."),
    ],
}

for _dx, _days in _PLAYBOOK_DAYS_COPY.items():
    for _i, (_title, _hint) in enumerate(_days, 1):
        _slug = f"mestari_{_dx}_day{_i}"
        # Sports is NOT gated — copy is ready to ship the moment Resend lands.
        _is_gated = _dx in ("poker", "blackjack")
        _DEFAULTS[_slug] = {
            "channel": "email",
            "gated": _is_gated,
            "description": f"Mestari {_dx} 5-day playbook — day {_i}.",
            "subject_fi": f"{_dx.capitalize()} · Päivä {_i}/5 — {_title.split('—',1)[1].strip() if '—' in _title else _title}",
            "subject_en": f"{_dx.capitalize()} · {_title}",
            "body_text_fi": f"Hei {{name}},\n\nPäivä {_i}/5 — {_title.split('—',1)[1].strip() if '—' in _title else _title}\n\n{_hint}\n\n[PLACEHOLDER — täysi sisältö lisätään ennen lähetystä]\n\nProfiilisi: {{profile_name}}\n\n— Putki HQ\n\nPeruuta: {{unsubscribe_url}}",
            "body_text_en": f"Hi {{name}},\n\nDay {_i} of 5 — {_title}\n\n{_hint}\n\n[PLACEHOLDER — full content will be added before send]\n\nYour profile: {{profile_name}}\n\n— Putki HQ\n\nUnsubscribe: {{unsubscribe_url}}",
            "body_html_fi": f"<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><div style='font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.22em;color:#5B8DEE;font-weight:700'>PÄIVÄ {_i}/5 · {_dx.upper()}</div><h2 style='font-size:24px;margin:8px 0 16px;letter-spacing:-.015em'>{_title}</h2><p style='font-style:italic;color:#666'>{_hint}</p><p style='background:#FFF3B0;padding:14px;border-left:3px solid #FFBF6B;font-size:13px;color:#5C4B17'>[PLACEHOLDER — täysi sisältö lisätään ennen lähetystä]</p><p style='font-size:13px;color:#888'>Profiilisi: <strong>{{profile_name}}</strong></p><p style='color:#888;font-size:13px;margin-top:32px'>— Putki HQ<br/><a href='{{unsubscribe_url}}' style='color:#888'>Peruuta tilaus</a></p></div>",
            "body_html_en": f"<div style='font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#0B0A09;max-width:560px;margin:0 auto;padding:24px'><div style='font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.22em;color:#5B8DEE;font-weight:700'>DAY {_i}/5 · {_dx.upper()}</div><h2 style='font-size:24px;margin:8px 0 16px;letter-spacing:-.015em'>{_title}</h2><p style='font-style:italic;color:#666'>{_hint}</p><p style='background:#FFF3B0;padding:14px;border-left:3px solid #FFBF6B;font-size:13px;color:#5C4B17'>[PLACEHOLDER — full content will be added before send]</p><p style='font-size:13px;color:#888'>Your profile: <strong>{{profile_name}}</strong></p><p style='color:#888;font-size:13px;margin-top:32px'>— Putki HQ<br/><a href='{{unsubscribe_url}}' style='color:#888'>Unsubscribe</a></p></div>",
        }


def default_templates() -> Dict[str, Dict[str, Any]]:
    return _DEFAULTS


# ── Storage ──────────────────────────────────────────────────────────

async def get_all_templates(db) -> Dict[str, Dict[str, Any]]:
    """Merge persisted overrides on top of defaults so the editor always
    sees every template, even ones never touched."""
    doc = await db.settings.find_one({"_id": "email_templates"}, {"_id": 0, "value": 1})
    overrides = (doc or {}).get("value") or {}
    out: Dict[str, Dict[str, Any]] = {}
    for slug, tmpl in _DEFAULTS.items():
        merged = {**tmpl, **(overrides.get(slug) or {})}
        out[slug] = merged
    return out


async def get_template(db, slug: str) -> Optional[Dict[str, Any]]:
    all_t = await get_all_templates(db)
    return all_t.get(slug)


async def save_templates(db, payload: Dict[str, Dict[str, Any]]) -> None:
    """Validate then persist. Only known slugs are accepted; unknown
    keys are dropped silently to avoid the editor injecting new slugs by
    accident."""
    allowed = set(_DEFAULTS.keys())
    safe: Dict[str, Dict[str, Any]] = {}
    for slug, tmpl in (payload or {}).items():
        if slug not in allowed or not isinstance(tmpl, dict):
            continue
        # Whitelist fields a user can edit. `gated`, `channel`,
        # `description` are immutable from the editor.
        safe[slug] = {
            k: (tmpl.get(k) or "")[:8000]
            for k in (
                "subject_fi", "subject_en",
                "body_text_fi", "body_text_en",
                "body_html_fi", "body_html_en",
            )
        }
    await db.settings.update_one(
        {"_id": "email_templates"},
        {"$set": {"value": safe, "updated_at": _now()}},
        upsert=True,
    )


# ── Render ───────────────────────────────────────────────────────────

_PLACEHOLDER_RX = re.compile(r"\{([a-zA-Z0-9_]+)\}")


def render(template_body: str, vars_: Dict[str, Any]) -> str:
    """Safe `{var}` substitution. Missing vars render as empty string —
    deliberate, so a missing optional field doesn't blow up an email."""
    if not template_body:
        return ""
    return _PLACEHOLDER_RX.sub(
        lambda m: str(vars_.get(m.group(1), "")), template_body,
    )


async def render_template(db, slug: str, *, lang: str = "fi",
                          vars_: Optional[Dict[str, Any]] = None,
                          ) -> Optional[Dict[str, str]]:
    """Returns {subject, body_text, body_html, channel, gated} ready to
    hand to the dispatcher. Returns None for unknown slug."""
    tmpl = await get_template(db, slug)
    if not tmpl:
        return None
    lang = lang if lang in ("fi", "en") else "fi"
    v = vars_ or {}
    return {
        "channel": tmpl.get("channel", "email"),
        "gated": bool(tmpl.get("gated", False)),
        "subject": render(tmpl.get(f"subject_{lang}", ""), v),
        "body_text": render(tmpl.get(f"body_text_{lang}", ""), v),
        "body_html": render(tmpl.get(f"body_html_{lang}", ""), v),
    }


# ── Catalogue (for the editor sidebar) ───────────────────────────────

def template_catalogue() -> List[Dict[str, Any]]:
    """Stable-ordered list of every known template — drives the editor
    sidebar so we don't have to teach the UI about every new slug."""
    order = [
        "voita_playbook", "voita_winner", "streamer_alert_welcome",
        "telegram_welcome", "telegram_bound",
        *[f"mestari_sports_day{i}" for i in range(1, 6)],
        *[f"mestari_poker_day{i}" for i in range(1, 6)],
        *[f"mestari_blackjack_day{i}" for i in range(1, 6)],
    ]
    seen = set()
    out = []
    for slug in order:
        if slug in _DEFAULTS and slug not in seen:
            t = _DEFAULTS[slug]
            out.append({
                "slug": slug,
                "channel": t["channel"],
                "gated": t["gated"],
                "description": t["description"],
            })
            seen.add(slug)
    return out
