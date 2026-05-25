"""
PUTKI HQ — Mittari page copy editor.

Everything visible on /mittari is editable through this module. A single
Mongo doc (`settings._id='mittari_copy'`) overlays admin edits onto the
DEFAULT_MITTARI_COPY tree. The frontend hook fetches the merged result
from /api/mittari/copy and falls back to defaults when missing.

Schema is intentionally flat-ish per locale (fi/en). Repeating items
(testimonials, receipts, press) are arrays of objects with stable shape.
Length caps in sanitize_mittari_copy keep the doc from growing unbounded.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ── Defaults (mirror exactly the current hardcoded copy in Mittari.jsx) ──
DEFAULT_MITTARI_COPY: Dict[str, Any] = {
    "back_home": {"fi": "← PUTKI HQ", "en": "← PUTKI HQ"},
    "hero": {
        "fi": {
            "section_label": "PÄIVÄN SIGNAALIT · LIVE",
            "page_title_lead": "5 vahvinta vetovinkkiä.",
            "page_title_em": "Joka aamu klo 09:00.",
            "page_title_tail": "Ilmaiseksi.",
            "page_subtitle": "Viisi vetoa EU-urheilukirjojen markkinoilta Sharpness-pisteytettynä (0–100 — kuinka tiiviisti urheilukirjat hinnoittelevat). Mittari seuraa Suomen vedonlyöntiskeneä reaaliajassa: kun striimit + kertoimet + uutiset kuumenevat, saat hälytyksen. Telegram tai sähköposti. Yksi tilaus. GDPR. Lopeta milloin vain. Toimituksellista sisältöä — ei vetovinkkejä.",
            "headline_lead": "Viisi vahvinta poimintaa",
            "headline_em": "joka aamu klo 09:00",
            "headline_tail": "suoraan Telegramiin tai sähköpostiin.",
            "subline": "Sharpness-pisteytetty 0–100 EU-urheilukirjojen hinnoittelun hajonnasta ja momentumista. Sama data, sama luku — ei mielipiteitä, ei toimituksellisia muokkauksia. Bonuksena Mittarin reaaliaikaiset skenehälytykset.",
            "killer_eyebrow": "KESKI-SHARPNESS TÄNÄÄN",
            "killer_sub_lead": "Päivän viisi poimintaa keskiarvolla",
            "killer_sub_tail": "— korkein implisiittinen todennäköisyys",
            "killer_foot": "Live · 15 min päivitys · lähde Odds API + EU-urheilukirjat",
            "killer_quiet": "Markkina hiljainen juuri nyt — pudotus klo 09:00.",
            "countdown_label": "Seuraava pudotus",
            "meter_state_label": "MITTARI NYT",
            "composite_label": "YHDISTELMÄ",
        },
        "en": {
            "section_label": "DAILY SIGNALS · LIVE",
            "page_title_lead": "5 sharpest betting picks.",
            "page_title_em": "Every morning at 09:00.",
            "page_title_tail": "Free.",
            "page_subtitle": "Five EU-sportsbook market picks, scored 0–100 (Sharpness — how tightly the sportsbooks price the market). The dial tracks Finland\u2019s betting scene live: when streamers + odds + news heat up, you get an alert. Telegram or email. One signup. GDPR. Stop anytime. Editorial only — not betting advice.",
            "headline_lead": "Five strongest picks",
            "headline_em": "every morning at 09:00",
            "headline_tail": "straight to Telegram or email.",
            "subline": "Sharpness-scored 0–100 from EU sportsbook price dispersion + momentum. Same data, same number — no opinions, no editorial overrides. Bonus: real-time Mittari scene alerts.",
            "killer_eyebrow": "AVG SHARPNESS TODAY",
            "killer_sub_lead": "Today\u2019s five picks average sharpness",
            "killer_sub_tail": "— top implied probability",
            "killer_foot": "Live · 15-min refresh · source Odds API + EU sportsbooks",
            "killer_quiet": "Market quiet right now — next drop at 09:00.",
            "countdown_label": "Next drop",
            "meter_state_label": "METER NOW",
            "composite_label": "COMPOSITE",
        },
    },
    "gate": {
        "fi": {
            "title_top": "→ Kytke putki",
            "lead": "Avaa Telegramissa — yksi napsautus",
            "one_tap_inline": "YKSI NAPSAUTUS",
            "badge": "ALLE 3S TOIMITUS",
            "bullets": [
                "Sidotaan yhdellä napsautuksella · ei sähköpostia, ei salasanaa",
                "Live-tilanvaihdokset mukana",
                "Lopeta milloin tahansa · ei spämmiä · GDPR",
            ],
            "tg_cta": "AVAA TELEGRAMISSA",
            "tg_sub": "Sitoo chat-ID:n automaattisesti · ei sähköpostia ei salasanaa",
            "or_email": "tai sähköpostiin",
            "email_placeholder": "sähköpostisi@osoite.fi",
            "email_cta": "AVAA SIGNAALIT →",
            "fine_print": "Maksuton · lopeta milloin tahansa · GDPR",
            "revealed_hi": "Signaali 01 avattiin yllä ↑ · loput tulevat Telegramiin/sähköpostiin alle 3 sekunnissa.",
            "form_err": "Tarkista sähköposti",
            "form_success": "✓ Kiitos — vahvistuslinkki sähköpostissasi",
        },
        "en": {
            "title_top": "→ Connect the pipe",
            "lead": "Open in Telegram — one tap",
            "one_tap_inline": "ONE TAP",
            "badge": "<3S DELIVERY",
            "bullets": [
                "Bound in 1 tap · no email, no password",
                "Live state-change alerts included",
                "Stop anytime · no spam · GDPR",
            ],
            "tg_cta": "OPEN IN TELEGRAM",
            "tg_sub": "Binds your chat ID automatically · no email no password",
            "or_email": "or use email",
            "email_placeholder": "you@email.com",
            "email_cta": "UNLOCK SIGNALS →",
            "fine_print": "Free · stop anytime · GDPR",
            "revealed_hi": "Signal 01 unlocked above ↑ · the rest land in Telegram/email in under 3 seconds.",
            "form_err": "Check your email",
            "form_success": "✓ Thanks — confirmation link in your inbox",
        },
    },
    "explain": {
        "fi": {
            "title": "NÄIN SE TOIMII",
            "steps": [
                {"title": "1 · MARKKINA", "body": "EU-urheilukirjat liikuttavat markkinaa. Lasketaan implisiittinen todennäköisyys + Sharpness joka kirjasta. Päivän viisi vahvinta nousee listalle joka aamu klo 09:00."},
                {"title": "2 · SKENE",    "body": "Mittari yhdistää 11 julkista lähdettä yhdeksi luvuksi 0–100 ja viiteen tilaan: Tyyni · Vire · Vipinä · Meininki · Perkele."},
                {"title": "3 · TOIMITUS",  "body": "Telegramiin alle 3 sekunnissa. Sähköposti varalla. Sido kerran, ei toista listaa, ei spämmiä."},
            ],
        },
        "en": {
            "title": "HOW IT WORKS",
            "steps": [
                {"title": "1 · MARKET", "body": "EU sportsbooks move the market. We compute implied probability + Sharpness per book. Today\u2019s five strongest plays surface every morning at 09:00."},
                {"title": "2 · SCENE",  "body": "Mittari composites 11 public sources into one number 0–100 and five states: Calm · Buzz · Active · Rolling · Perkele."},
                {"title": "3 · DELIVERY",  "body": "Telegram in under 3 seconds. Email fallback. Bind once, no second list, no spam."},
            ],
        },
    },
    "receipts": {
        "title_fi": "VIIME SIGNAALIT · 7 VIIMEISINTÄ · AIKALEIMATTU",
        "title_en": "RECENT SIGNALS · LAST 7 · TIMESTAMPED",
        "foot7d_fi": "7 päivän osumatarkkuus",
        "foot7d_en": "7-day hit rate",
        "foot30d_fi": "30 päivän",
        "foot30d_en": "30-day",
        "foot7d_value": "6/7 (86%)",
        "foot30d_value": "58%",
        "status_hit_fi": "OSUI",  "status_hit_en": "HIT",
        "status_miss_fi": "OHI",  "status_miss_en": "MISS",
        "status_early_fi": "AIKAISIN", "status_early_en": "EARLY",
        "items": [
            {"date_fi": "Eilen ma 18.5.", "date_en": "Yest Mon 18.5.", "time": "09:00",
             "signal_fi": "Signaali #01 · Sharpness 84 · NHL", "signal_en": "Signal #01 · Sharpness 84 · NHL",
             "outcome_fi": "Osui kertoimella 1.42", "outcome_en": "Hit @ 1.42", "status": "hit"},
            {"date_fi": "Eilen ma 18.5.", "date_en": "Yest Mon 18.5.", "time": "14:23",
             "signal_fi": "Mittari → MEININKI · striimaaja-tila", "signal_en": "Mittari → ROLLING · streamer state",
             "outcome_fi": "Tilanvaihdos vahvistui klo 14:55", "outcome_en": "State change confirmed at 14:55", "status": "hit"},
            {"date_fi": "Su 17.5.", "date_en": "Sun 17.5.", "time": "09:00",
             "signal_fi": "Signaali #03 · Sharpness 71 · Valioliiga", "signal_en": "Signal #03 · Sharpness 71 · EPL",
             "outcome_fi": "Osui kertoimella 1.78", "outcome_en": "Hit @ 1.78", "status": "hit"},
            {"date_fi": "La 16.5.", "date_en": "Sat 16.5.", "time": "09:00",
             "signal_fi": "Signaali #02 · Sharpness 68 · Liiga", "signal_en": "Signal #02 · Sharpness 68 · Liiga",
             "outcome_fi": "Päättyi tasapeliin · 8 min ennen ratkaisua", "outcome_en": "Ended in draw · 8 min early call", "status": "early"},
            {"date_fi": "La 16.5.", "date_en": "Sat 16.5.", "time": "09:00",
             "signal_fi": "Signaali #05 · Sharpness 52 · MLS", "signal_en": "Signal #05 · Sharpness 52 · MLS",
             "outcome_fi": "Ei osunut · alhainen sharpness", "outcome_en": "Missed · low sharpness", "status": "miss"},
            {"date_fi": "Pe 15.5.", "date_en": "Fri 15.5.", "time": "20:47",
             "signal_fi": "Mittari → KIIRASTULI · 3 lähdettä", "signal_en": "Mittari → PERKELE · 3-source cluster",
             "outcome_fi": "Tilanvaihdos toteutui klo 21:02", "outcome_en": "State change confirmed at 21:02", "status": "hit"},
            {"date_fi": "Pe 15.5.", "date_en": "Fri 15.5.", "time": "09:00",
             "signal_fi": "Signaali #01 · Sharpness 89 · Mestarien liiga", "signal_en": "Signal #01 · Sharpness 89 · UCL",
             "outcome_fi": "Osui kertoimella 1.31", "outcome_en": "Hit @ 1.31", "status": "hit"},
        ],
        "method_link_fi": "Lue koko menetelmä →",
        "method_link_en": "Read the full method →",
    },
    "testimonials": {
        "title_fi": "TILAAJIA · KUUKAUSINA MUKANA",
        "title_en": "SUBSCRIBERS · MONTHS ON BOARD",
        "items": [
            {"id": "t1", "initials": "JK", "name": "Jukka K.",
             "detail_fi": "Espoo · 8 kk · Telegram", "detail_en": "Espoo · 8 mo · Telegram",
             "quote_fi": "Päivän signaali #02 osui — Sharpness 81 oli täysin oikeassa. Tämä on parempi kuin foorumeilta haahuilu.",
             "quote_en": "Daily signal #02 hit — Sharpness 81 was spot-on. Better than chasing forum tips.",
             "receipt_fi": "Tilaaja 15.9.2025 · 12/14 signaalia osui viime kuussa",
             "receipt_en": "Subscriber since 15.9.2025 · 12/14 signals hit last month"},
            {"id": "t2", "initials": "SR", "name": "Sami R.",
             "detail_fi": "Tampere · 14 kk · Telegram + sähköposti", "detail_en": "Tampere · 14 mo · Telegram + email",
             "quote_fi": "Sain Mittarista hälytyksen 23 minuuttia ennen kuin Mikä Mikko ehti livenä. Ehdin hyvin ensimmäisten joukkoon.",
             "quote_en": "Got the Mittari alert 23 min before Mikä Mikko went live. Plenty of time to be among the first viewers.",
             "receipt_fi": "Tilaaja 21.3.2025 · 94% hälytysten avausaste 30 pv",
             "receipt_en": "Subscriber since 21.3.2025 · 94% alert open-rate over 30d"},
            {"id": "t3", "initials": "AL", "name": "Antti L.",
             "detail_fi": "Helsinki · 6 kk · Telegram", "detail_en": "Helsinki · 6 mo · Telegram",
             "quote_fi": "Yksi tilaus — signaalit aamulla, mittarihälytykset päivän mittaan. Ei kahta listaa, ei spämmiä.",
             "quote_en": "One subscription — signals in the morning, meter alerts through the day. No second list, no spam.",
             "receipt_fi": "Tilaaja 12.11.2025 · suositellut 4 ystävälle",
             "receipt_en": "Subscriber since 12.11.2025 · referred 4 friends"},
        ],
    },
    "founder": {
        "title_fi": "KUKA TÄMÄN TAKANA ON",
        "title_en": "WHO BUILT THIS",
        "eyebrow_fi": "PERUSTAJA · 9 VUOTTA SUOMEN SKENEN ÄÄRELLÄ",
        "eyebrow_en": "FOUNDER · 9 YEARS IN THE FINNISH SCENE",
        "quote_fi": "Rakensin nämä koska olen kyllästynyt missaamaan parhaat hetket — sekä markkinassa että striimausskenessä. Nyt saan viisi vahvinta poimintaa aamulla ja hälytyksen sekunnissa kun skene vaihtaa tilaa.",
        "quote_en": "I built these because I was tired of missing the best moments — both in the market and in the streaming scene. Now I get five strongest plays in the morning and a ping within seconds when the scene changes state.",
        "name": "Eino K.",
        "role_fi": "Perustaja · Putki HQ",
        "role_en": "Founder · Putki HQ",
        "creds_fi": "9 vuotta skenen äärellä · Helsinki · 11 julkista lähdettä, 0 toimituksellista muokkausta",
        "creds_en": "9 years in the Finnish scene · Helsinki · 11 public sources, 0 editorial overrides",
        "avatar_initial": "E",
        "method_link_fi": "Lue koko menetelmä →",
        "method_link_en": "Read the full method →",
    },
    "press": {
        "title_fi": "MAINITTU",
        "title_en": "AS MENTIONED IN",
        "items": ["Mikä Mikko Show", "Sebsu.fi", "Klubitsoni Podcast", "Roni TV", "Helsingin Striimi"],
    },
    "final_gate": {
        "eyebrow_fi": "→ VIELÄ YKSI ASKEL",
        "eyebrow_en": "→ ONE MORE STEP",
        "headline_lead_fi": "Kytke",
        "headline_lead_en": "Connect",
        "headline_em_fi": "kerran.",
        "headline_em_en": "once.",
    },
    "feed": {
        "title_fi": "TUOREIMMAT TILAUKSET",
        "title_en": "RECENT SIGNUPS",
        "subscribed_fi": "tilasi",
        "subscribed_en": "subscribed via",
        "live_fi": "Live",
        "live_en": "Live",
        "minute_fi": "min sitten",
        "minute_en": "min ago",
        "just_now_fi": "juuri nyt",
        "just_now_en": "just now",
        "channel_email_fi": "sähköposti",
        "channel_email_en": "Email",
    },
        "sticky": {
            "text_fi": "Seuraavat signaalit",
            "text_en": "Next signals",
            "cta_fi": "AVAA",
            "cta_en": "UNLOCK",
            "connected_fi": "kytkettynä",
            "connected_en": "connected",
        },
    "signals": {
        "fi": {
            "head_locked_eyebrow": "— PÄIVÄN SIGNAALIT · LUKITTU",
            "head_unlocked_eyebrow": "— PÄIVÄN SIGNAALIT · AVATTU",
            "title_lead": "Päivän",
            "title_em": "Signaalit",
            "pairing_lead": "Kaksi syötettä.",
            "pairing_em": "Yksi tilaus.",
            "pairing_tail": "Telegram tai sähköposti — sinun valintasi.",
            "preview_badge": "ESIKATSELU",
            "preview_explainer": "Esimerkkirivit — todelliset poiminnat avautuvat tilaajille klo 09:00.",
            "market_quiet_eyebrow": "MARKKINA HILJAINEN JUURI NYT",
            "market_quiet_body": "Huomenna klo 09:00 pudotamme seuraavat viisi. Tilaa ja saat ensimmäisen heti kun markkina avautuu.",
            "reveal_teaser": "⌥ Napsauta → Signaali 01 avautuu heti",
            "confidence_label": "Sharpness",
            "implied_label": "todennäköisyys",
            "implied_inline": "todenn.",
            "locked_foot": "Lukittu · viisi pudotusta joka aamu klo",
            "unlocked_foot": "✓ Signaali 01 avattu · loput tippuvat sähköpostiisi alle 3 sekunnissa",
            "draw_label": "tasapeli",
            "vs_label": "vs",
            "band_tight": "tiukka",
            "band_clear": "selkeä",
            "band_mixed": "sekava",
            "band_loose": "löysä",
            "band_scattered": "hajanainen",
        },
        "en": {
            "head_locked_eyebrow": "— DAILY SIGNALS · LOCKED",
            "head_unlocked_eyebrow": "— DAILY SIGNALS · UNLOCKED",
            "title_lead": "Today\u2019s",
            "title_em": "Signals",
            "pairing_lead": "Two feeds.",
            "pairing_em": "One signup.",
            "pairing_tail": "Telegram or email — your choice.",
            "preview_badge": "PREVIEW",
            "preview_explainer": "Example rows — real picks unlock for subscribers at 09:00.",
            "market_quiet_eyebrow": "MARKET QUIET RIGHT NOW",
            "market_quiet_body": "Tomorrow 09:00 we drop the next five. Subscribe and you\u2019ll get the first one the moment the market opens it up.",
            "reveal_teaser": "⌥ Tap → Signal 01 unlocks instantly",
            "confidence_label": "Sharpness",
            "implied_label": "implied prob.",
            "implied_inline": "implied",
            "locked_foot": "Locked · the full five drop every morning at",
            "unlocked_foot": "✓ Signal 01 unlocked · the rest land in your inbox in <3 seconds",
            "draw_label": "draw",
            "vs_label": "vs",
            "band_tight": "tight",
            "band_clear": "clear",
            "band_mixed": "mixed",
            "band_loose": "loose",
            "band_scattered": "scattered",
        },
    },
}


# Field-length caps (sanitised by sanitize_mittari_copy). Anything beyond
# these limits is silently truncated. Prevents users pasting an entire
# article into a field by accident.
_SHORT = 80   # eyebrows, labels, single-word labels
_MED = 240    # headlines, names, button labels
_LONG = 800   # body paragraphs, quotes
_PARA = 2000  # full reasoning / multi-sentence


def _trunc(value: Any, cap: int) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    v = value.strip()
    if not v:
        return None
    return v[:cap]


def _merge_strings(default: Dict[str, Any], override: Dict[str, Any], caps: Dict[str, int]) -> Dict[str, Any]:
    """Merge a flat dict of strings with per-key caps."""
    out: Dict[str, Any] = dict(default)
    for key, cap in caps.items():
        if key in override:
            cleaned = _trunc(override.get(key), cap)
            if cleaned is not None:
                out[key] = cleaned
    return out


# Per-section field caps. Anything not listed here is ignored at sanitise time.
_HERO_CAPS = {
    "section_label": _SHORT,
    "page_title_lead": _MED, "page_title_em": _MED, "page_title_tail": _MED,
    "page_subtitle": _PARA,
    "headline_lead": _MED, "headline_em": _MED,
    "headline_tail": _MED, "subline": _PARA, "killer_eyebrow": _SHORT,
    "killer_sub_lead": _MED, "killer_sub_tail": _MED, "killer_foot": _MED,
    "killer_quiet": _LONG, "countdown_label": _SHORT, "meter_state_label": _SHORT,
    "composite_label": _SHORT,
}
_GATE_CAPS = {
    "title_top": _MED, "lead": _MED, "one_tap_inline": _SHORT, "badge": _SHORT,
    "tg_cta": _MED, "tg_sub": _LONG, "or_email": _SHORT,
    "email_placeholder": _MED, "email_cta": _MED, "fine_print": _LONG,
    "revealed_hi": _LONG, "form_err": _MED, "form_success": _MED,
}
_EXPLAIN_TITLE_CAPS = {"title": _SHORT}
_EXPLAIN_STEP_CAPS = {"title": _MED, "body": _PARA}
_RECEIPT_ITEM_CAPS = {
    "date_fi": _SHORT, "date_en": _SHORT, "time": _SHORT,
    "signal_fi": _MED, "signal_en": _MED, "outcome_fi": _MED, "outcome_en": _MED,
    "status": _SHORT,
}
_RECEIPT_CAPS = {
    "title_fi": _MED, "title_en": _MED, "foot7d_fi": _MED, "foot7d_en": _MED,
    "foot30d_fi": _MED, "foot30d_en": _MED, "foot7d_value": _SHORT, "foot30d_value": _SHORT,
    "status_hit_fi": _SHORT, "status_hit_en": _SHORT,
    "status_miss_fi": _SHORT, "status_miss_en": _SHORT,
    "status_early_fi": _SHORT, "status_early_en": _SHORT,
    "method_link_fi": _MED, "method_link_en": _MED,
}
_TESTI_ITEM_CAPS = {
    "id": _SHORT, "initials": _SHORT, "name": _MED,
    "detail_fi": _MED, "detail_en": _MED,
    "quote_fi": _PARA, "quote_en": _PARA,
    "receipt_fi": _MED, "receipt_en": _MED,
}
_TESTI_CAPS = {"title_fi": _MED, "title_en": _MED}
_FOUNDER_CAPS = {
    "title_fi": _SHORT, "title_en": _SHORT,
    "eyebrow_fi": _MED, "eyebrow_en": _MED,
    "quote_fi": _PARA, "quote_en": _PARA,
    "name": _MED, "role_fi": _MED, "role_en": _MED,
    "creds_fi": _PARA, "creds_en": _PARA,
    "avatar_initial": _SHORT,
    "method_link_fi": _MED, "method_link_en": _MED,
}
_PRESS_CAPS = {"title_fi": _SHORT, "title_en": _SHORT}
_FINAL_CAPS = {
    "eyebrow_fi": _MED, "eyebrow_en": _MED,
    "headline_lead_fi": _MED, "headline_lead_en": _MED,
    "headline_em_fi": _MED, "headline_em_en": _MED,
}
_FEED_CAPS = {
    "title_fi": _SHORT, "title_en": _SHORT,
    "subscribed_fi": _SHORT, "subscribed_en": _SHORT,
    "live_fi": _SHORT, "live_en": _SHORT,
    "minute_fi": _SHORT, "minute_en": _SHORT,
    "just_now_fi": _SHORT, "just_now_en": _SHORT,
    "channel_email_fi": _SHORT, "channel_email_en": _SHORT,
}
_STICKY_CAPS = {
    "text_fi": _MED, "text_en": _MED,
    "cta_fi": _SHORT, "cta_en": _SHORT,
    "connected_fi": _SHORT, "connected_en": _SHORT,
}
_SIGNALS_CAPS = {
    "head_locked_eyebrow": _MED, "head_unlocked_eyebrow": _MED,
    "title_lead": _MED, "title_em": _MED,
    "pairing_lead": _MED, "pairing_em": _MED, "pairing_tail": _MED,
    "preview_badge": _SHORT, "preview_explainer": _LONG,
    "market_quiet_eyebrow": _MED, "market_quiet_body": _PARA,
    "reveal_teaser": _MED, "confidence_label": _SHORT, "implied_label": _SHORT,
    "implied_inline": _SHORT, "locked_foot": _MED, "unlocked_foot": _MED,
    "draw_label": _SHORT, "vs_label": _SHORT,
    "band_tight": _SHORT, "band_clear": _SHORT, "band_mixed": _SHORT,
    "band_loose": _SHORT, "band_scattered": _SHORT,
}

_MAX_TESTIS = 6
_MAX_RECEIPTS = 12
_MAX_PRESS = 12
_VALID_STATUSES = {"hit", "miss", "early"}


def _merge_steps(defaults: List[Dict[str, Any]], overrides: Any) -> List[Dict[str, Any]]:
    """Always 3 steps. Pad with defaults if override is shorter."""
    out: List[Dict[str, Any]] = []
    overrides = overrides if isinstance(overrides, list) else []
    for i in range(3):
        base = dict(defaults[i]) if i < len(defaults) else {"title": "", "body": ""}
        over = overrides[i] if i < len(overrides) and isinstance(overrides[i], dict) else {}
        out.append(_merge_strings(base, over, _EXPLAIN_STEP_CAPS))
    return out


def _merge_receipt_items(defaults: List[Dict[str, Any]], overrides: Any) -> List[Dict[str, Any]]:
    overrides = overrides if isinstance(overrides, list) else []
    n = max(len(defaults), min(len(overrides), _MAX_RECEIPTS))
    out: List[Dict[str, Any]] = []
    for i in range(n):
        base = dict(defaults[i]) if i < len(defaults) else {
            "date_fi": "", "date_en": "", "time": "", "signal_fi": "",
            "signal_en": "", "outcome_fi": "", "outcome_en": "", "status": "hit",
        }
        over = overrides[i] if i < len(overrides) and isinstance(overrides[i], dict) else {}
        merged = _merge_strings(base, over, _RECEIPT_ITEM_CAPS)
        if merged.get("status") not in _VALID_STATUSES:
            merged["status"] = base.get("status", "hit")
        # Drop a row entirely if the override blanks out signal + outcome
        if not merged.get("signal_fi") and not merged.get("signal_en"):
            continue
        out.append(merged)
    return out


def _merge_testimonial_items(defaults: List[Dict[str, Any]], overrides: Any) -> List[Dict[str, Any]]:
    overrides = overrides if isinstance(overrides, list) else []
    n = max(len(defaults), min(len(overrides), _MAX_TESTIS))
    out: List[Dict[str, Any]] = []
    for i in range(n):
        base = dict(defaults[i]) if i < len(defaults) else {
            "id": f"t{i + 1}", "initials": "", "name": "",
            "detail_fi": "", "detail_en": "",
            "quote_fi": "", "quote_en": "",
            "receipt_fi": "", "receipt_en": "",
        }
        over = overrides[i] if i < len(overrides) and isinstance(overrides[i], dict) else {}
        merged = _merge_strings(base, over, _TESTI_ITEM_CAPS)
        if not merged.get("quote_fi") and not merged.get("quote_en"):
            continue
        out.append(merged)
    return out


def _merge_press_items(defaults: List[str], overrides: Any) -> List[str]:
    overrides = overrides if isinstance(overrides, list) else []
    n = max(len(defaults), min(len(overrides), _MAX_PRESS))
    out: List[str] = []
    for i in range(n):
        base = defaults[i] if i < len(defaults) else ""
        if i < len(overrides):
            v = _trunc(overrides[i], _MED)
            if v is not None:
                out.append(v)
                continue
        if base:
            out.append(base)
    return out


def _merge_back_home(defaults: Dict[str, str], override: Any) -> Dict[str, str]:
    if not isinstance(override, dict):
        return dict(defaults)
    out = dict(defaults)
    for lang in ("fi", "en"):
        v = _trunc(override.get(lang), _MED)
        if v is not None:
            out[lang] = v
    return out


def sanitize_and_merge(override: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deep-merge an admin override doc onto DEFAULT_MITTARI_COPY with caps.

    Returns the full merged copy tree — every field is guaranteed present,
    so the frontend can index without optional-chaining and never see
    `undefined`. Override doc is allowed to be partial.
    """
    o = override if isinstance(override, dict) else {}

    out: Dict[str, Any] = {}
    out["back_home"] = _merge_back_home(DEFAULT_MITTARI_COPY["back_home"], o.get("back_home"))

    # Per-locale string sections
    for section, caps in (
        ("hero", _HERO_CAPS),
        ("gate", _GATE_CAPS),
        ("signals", _SIGNALS_CAPS),
    ):
        out[section] = {}
        for lang in ("fi", "en"):
            base = DEFAULT_MITTARI_COPY[section][lang]
            over = (o.get(section) or {}).get(lang) if isinstance(o.get(section), dict) else {}
            out[section][lang] = _merge_strings(base, over or {}, caps)

    # Explain (per-locale w/ steps array)
    out["explain"] = {}
    for lang in ("fi", "en"):
        base = DEFAULT_MITTARI_COPY["explain"][lang]
        over = (o.get("explain") or {}).get(lang) if isinstance(o.get("explain"), dict) else {}
        over = over or {}
        merged_title = _merge_strings(base, over, _EXPLAIN_TITLE_CAPS)
        merged_steps = _merge_steps(base["steps"], over.get("steps"))
        out["explain"][lang] = {**merged_title, "steps": merged_steps}

    # Flat-shape sections w/ arrays
    receipts_base = DEFAULT_MITTARI_COPY["receipts"]
    receipts_over = o.get("receipts") if isinstance(o.get("receipts"), dict) else {}
    out["receipts"] = {
        **_merge_strings(receipts_base, receipts_over, _RECEIPT_CAPS),
        "items": _merge_receipt_items(receipts_base["items"], receipts_over.get("items")),
    }

    testi_base = DEFAULT_MITTARI_COPY["testimonials"]
    testi_over = o.get("testimonials") if isinstance(o.get("testimonials"), dict) else {}
    out["testimonials"] = {
        **_merge_strings(testi_base, testi_over, _TESTI_CAPS),
        "items": _merge_testimonial_items(testi_base["items"], testi_over.get("items")),
    }

    founder_base = DEFAULT_MITTARI_COPY["founder"]
    founder_over = o.get("founder") if isinstance(o.get("founder"), dict) else {}
    out["founder"] = _merge_strings(founder_base, founder_over, _FOUNDER_CAPS)

    press_base = DEFAULT_MITTARI_COPY["press"]
    press_over = o.get("press") if isinstance(o.get("press"), dict) else {}
    out["press"] = {
        **_merge_strings(press_base, press_over, _PRESS_CAPS),
        "items": _merge_press_items(press_base["items"], press_over.get("items")),
    }

    final_base = DEFAULT_MITTARI_COPY["final_gate"]
    final_over = o.get("final_gate") if isinstance(o.get("final_gate"), dict) else {}
    out["final_gate"] = _merge_strings(final_base, final_over, _FINAL_CAPS)

    feed_base = DEFAULT_MITTARI_COPY["feed"]
    feed_over = o.get("feed") if isinstance(o.get("feed"), dict) else {}
    out["feed"] = _merge_strings(feed_base, feed_over, _FEED_CAPS)

    sticky_base = DEFAULT_MITTARI_COPY["sticky"]
    sticky_over = o.get("sticky") if isinstance(o.get("sticky"), dict) else {}
    out["sticky"] = _merge_strings(sticky_base, sticky_over, _STICKY_CAPS)

    return out


async def get_mittari_copy(db) -> Dict[str, Any]:
    """Public — returns the fully merged copy tree."""
    doc = await db.settings.find_one({"_id": "mittari_copy"}, {"_id": 0, "value": 1})
    override = (doc or {}).get("value") if doc else None
    merged = sanitize_and_merge(override)
    return merged


async def get_mittari_copy_raw(db) -> Dict[str, Any]:
    """Admin — returns the raw override-doc (what's persisted in Mongo) +
    the merged result, so the editor can show 'edited' vs 'default' state.
    """
    doc = await db.settings.find_one({"_id": "mittari_copy"}, {"_id": 0, "value": 1, "updated_at": 1})
    raw = (doc or {}).get("value") if doc else {}
    return {
        "raw": raw or {},
        "merged": sanitize_and_merge(raw),
        "defaults": DEFAULT_MITTARI_COPY,
        "updated_at": (doc or {}).get("updated_at"),
    }


async def save_mittari_copy(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Admin — persist the user override and return the new merged copy."""
    if not isinstance(payload, dict):
        raise ValueError("payload_must_be_object")
    # We persist the user's raw override; sanitisation re-runs on every
    # read so the editor can recover from bad state without re-saving.
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"_id": "mittari_copy"},
        {"$set": {"value": payload, "updated_at": now}},
        upsert=True,
    )
    return await get_mittari_copy_raw(db)
