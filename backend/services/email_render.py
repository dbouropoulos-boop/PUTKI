"""
PUTKI HQ - Email v3 render service (iter97i).

Single source of truth for rendering production daily-tips + weekly +
welcome HTML emails. Pulled out of dispatch_daily.py so the back-office
preview endpoint AND the live 10:00 Helsinki fanout share the exact
same Python — preview matches reality, zero drift.

The HTML is intentionally inline-only (no <style> blocks beyond the
@media query) so it survives Gmail/Outlook clipping + Apple Mail
dark-mode inversion.
"""
from __future__ import annotations

from html import escape as _esc
from typing import Any, Dict, List, Optional

# Brand tokens — keep in lockstep with frontend Phase 1 system.
INK     = "#0A0A0A"
INK_2   = "#3A3833"
MUTED   = "#7A7669"
LINE    = "#E8E5DF"
LINE_2  = "#D4D1CB"
BG      = "#FAFAF7"
EMBER   = "#D9461E"
EMBER_2 = "#B53618"
PAGE_BG = "#1A1815"

_F_DISP = "'Archivo Black',sans-serif"
_F_BODY = "'Inter',Helvetica,Arial,sans-serif"
_F_SERIF= "'Source Serif 4',Georgia,serif"
_F_MONO = "'JetBrains Mono',monospace"


def _ember_markup(text: str) -> str:
    """Replace `{ember}...{/ember}` markers with inline ember spans."""
    if not text:
        return ""
    out = _esc(text)
    out = out.replace("{ember}", f'<span style="color:{EMBER};">')
    out = out.replace("{/ember}", "</span>")
    # The literal PERKE*LE always renders with ember asterisk for free.
    out = out.replace(
        "PERKE*LE",
        f'PERKE<span style="color:{EMBER};">*</span>LE',
    )
    out = out.replace(
        "KIIRA*STULI",
        f'KIIRA<span style="color:{EMBER};">*</span>STULI',
    )
    return out


def _mono(text: str, color: str = INK, size: int = 10, weight: int = 600,
          tracking: str = "0.18em") -> str:
    return (
        f'<div style="font-family:{_F_MONO};font-size:{size}px;'
        f'font-weight:{weight};color:{color};letter-spacing:{tracking};'
        f'text-transform:uppercase;">{_esc(text)}</div>'
    )


def _disp(text: str, size: int = 36, color: str = INK,
          tracking: str = "-0.03em", line_height: float = 1.0) -> str:
    return (
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:{size}px;'
        f'line-height:{line_height};color:{color};letter-spacing:{tracking};">'
        f'{_ember_markup(text)}</div>'
    )


# ── Daily tips ───────────────────────────────────────────────────────
def render_daily_tips(d: Dict[str, Any]) -> str:
    """Render the daily-tips email v3 from a draft dict.

    Expected fields (all optional with sensible fallbacks):
      edition_no, date_label, mittari_state, yesterday_hit, yesterday_total,
      hook_line, picks (list of 5 dicts),
      partner: {enabled, partner_name, headline, body, mittari_score,
                cta_label, cta_url, disclosure, image_url},
      signoff
    """
    picks = (d.get("picks") or [])[:5]
    while len(picks) < 5:
        picks.append({})
    p1 = picks[0]
    p2_5 = picks[1:5]

    state = (d.get("mittari_state") or "KIIRASTULI").upper()
    state_display = state.replace("KIIRASTULI", "KIIRA*STULI")
    yest_hit = d.get("yesterday_hit", 4)
    yest_total = d.get("yesterday_total", 5)
    hook_line = d.get("hook_line") or (
        f"Eilen {yest_hit} / {yest_total} osui — markkina kovenee tänään."
    )
    edition_no = d.get("edition_no", 142)
    date_label = d.get("date_label", "TI 28.5. · 09:00")

    parts: List[str] = []

    # Outer envelope
    parts.append(f'<!DOCTYPE html><html lang="fi"><body style="margin:0;padding:0;'
                 f'background:{PAGE_BG};font-family:{_F_BODY};color:{INK};">')

    # Preheader
    parts.append(
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;'
        f'font-size:1px;color:{PAGE_BG};">'
        f'{_esc((d.get("preheader") or hook_line)[:200])}</div>'
    )

    parts.append(
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%" style="background:{PAGE_BG};">'
        f'<tbody><tr><td align="center" style="padding:24px 12px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="600" style="background:{BG};max-width:600px;"><tbody>'
    )

    # Ember bar
    parts.append(f'<tr><td style="background:{EMBER};height:6px;line-height:6px;'
                 f'font-size:6px;">&nbsp;</td></tr>')

    # Masthead
    parts.append(
        f'<tr><td style="padding:24px 40px 0 40px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%"><tbody><tr>'
        f'<td><div style="font-family:{_F_DISP};font-weight:900;font-size:18px;'
        f'letter-spacing:-0.02em;color:{INK};line-height:1;">PUTKI HQ</div></td>'
        f'<td align="right">'
        f'<div style="font-family:{_F_MONO};font-size:9px;font-weight:500;'
        f'color:{MUTED};letter-spacing:0.16em;text-transform:uppercase;line-height:1;">'
        f'N°&nbsp;{edition_no} · {_esc(date_label)}</div></td>'
        f'</tr></tbody></table></td></tr>'
    )

    # Hook
    parts.append(
        f'<tr><td style="padding:32px 40px 0 40px;">'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{EMBER};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px;">'
        f'● Mittari · 5 / 5</div>'
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:64px;'
        f'line-height:0.88;color:{INK};letter-spacing:-0.04em;">'
        f'{_ember_markup(state_display)}.</div>'
        f'<div style="font-family:{_F_SERIF};font-size:16px;line-height:1.4;'
        f'color:{INK_2};font-style:italic;margin-top:18px;">'
        f'{_ember_markup(hook_line)}</div></td></tr>'
    )

    # Featured pick (01)
    f_sport = (p1.get("sport") or "LIIGA").upper()
    f_time  = p1.get("time") or "18:30"
    f_event = p1.get("event_name") or "Tappara → Ilves"
    f_pick  = p1.get("pick") or "Tappara"
    f_odds  = p1.get("odds_decimal") or 1.85
    f_book  = (p1.get("bookmaker") or "PINNACLE").upper()
    f_sharp = int(p1.get("sharpness") or 84)
    f_color = p1.get("editorial") or "Kolme kirjaa 0.03 sisällä. Iso line move yön yli."

    parts.append(
        f'<tr><td style="padding:40px 40px 0 40px;">'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{INK};letter-spacing:0.18em;text-transform:uppercase;'
        f'border-bottom:1px solid {INK};padding-bottom:12px;">Päivän viilto · N°&nbsp;01</div>'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:500;'
        f'color:{MUTED};letter-spacing:0.14em;text-transform:uppercase;margin-top:18px;">'
        f'{_esc(f_sport)} · {_esc(str(f_time))}</div>'
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:36px;'
        f'line-height:1.0;color:{INK};letter-spacing:-0.03em;margin-top:6px;">'
        f'{_esc(f_event.replace(" vs ", " "))}</div>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%" style="margin-top:16px;border-top:1px solid {LINE_2};'
        f'border-bottom:1px solid {LINE_2};"><tbody><tr>'
        f'<td style="padding:16px 16px 16px 0;border-right:1px solid {LINE};'
        f'vertical-align:top;width:50%;">'
        f'<div style="font-family:{_F_MONO};font-size:9px;font-weight:600;'
        f'color:{MUTED};letter-spacing:0.16em;text-transform:uppercase;">Pick · Odds</div>'
        f'<div style="margin-top:6px;"><span style="font-family:{_F_DISP};font-weight:900;'
        f'font-size:22px;color:{INK};letter-spacing:-0.025em;">'
        f'{_esc(f_pick)} · {f_odds:.2f}</span></div>'
        f'<div style="font-family:{_F_MONO};font-size:10px;color:{MUTED};'
        f'letter-spacing:0.08em;margin-top:2px;">{_esc(f_book)}</div></td>'
        f'<td style="padding:16px 0 16px 16px;vertical-align:top;width:50%;">'
        f'<div style="font-family:{_F_MONO};font-size:9px;font-weight:600;'
        f'color:{MUTED};letter-spacing:0.16em;text-transform:uppercase;">Sharpness</div>'
        f'<div style="margin-top:6px;"><span style="font-family:{_F_DISP};'
        f'font-weight:900;font-size:22px;color:{EMBER};letter-spacing:-0.025em;">'
        f'{f_sharp}</span></div></td></tr></tbody></table>'
        f'<div style="font-family:{_F_SERIF};font-size:14px;line-height:1.5;'
        f'color:{INK_2};margin-top:14px;font-style:italic;">{_esc(f_color)}</div>'
        f'</td></tr>'
    )

    # Picks 2-5
    parts.append(
        f'<tr><td style="padding:32px 40px 0 40px;">'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{INK};letter-spacing:0.18em;text-transform:uppercase;'
        f'border-bottom:1px solid {INK};padding-bottom:12px;">Vielä 4</div>'
        f'</td></tr>'
    )
    for i, p in enumerate(p2_5, start=2):
        sport = (p.get("sport") or "—").upper()
        time_ = p.get("time") or "—"
        ev    = p.get("event_name") or "—"
        odds  = p.get("odds_decimal") or 0
        sharp = int(p.get("sharpness") or 0)
        ev_short = ev.replace(" vs ", " → ")
        pick_line = f"{ev_short} · {odds:.2f}" if odds else ev_short
        parts.append(
            f'<tr><td style="padding:18px 40px 0 40px;">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'width="100%"><tbody><tr>'
            f'<td style="vertical-align:middle;">'
            f'<div style="font-family:{_F_MONO};font-size:9px;font-weight:500;'
            f'color:{MUTED};letter-spacing:0.14em;text-transform:uppercase;">'
            f'{i:02d} · {_esc(sport)} · {_esc(str(time_))}</div>'
            f'<div style="font-family:{_F_DISP};font-weight:900;font-size:18px;'
            f'line-height:1.1;color:{INK};letter-spacing:-0.02em;margin-top:4px;">'
            f'{_esc(pick_line)}</div></td>'
            f'<td align="right" style="vertical-align:middle;width:60px;">'
            f'<span style="font-family:{_F_DISP};font-weight:900;font-size:24px;'
            f'color:{EMBER};letter-spacing:-0.03em;">{sharp}</span></td>'
            f'</tr></tbody></table></td></tr>'
        )
        if i < 5:
            parts.append(
                f'<tr><td style="padding:14px 40px 0 40px;">'
                f'<div style="height:1px;background:{LINE};line-height:1px;font-size:1px;">'
                f'&nbsp;</div></td></tr>'
            )

    # Primary CTA
    cta_url = d.get("cta_url") or "https://putkihq.fi/mittari"
    parts.append(
        f'<tr><td style="padding:36px 40px 0 40px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%"><tbody><tr>'
        f'<td align="center" style="background:{INK};border-radius:4px;">'
        f'<a href="{_esc(cta_url)}" style="display:block;padding:20px 24px;'
        f'text-decoration:none;color:{BG};font-family:{_F_BODY};font-size:15px;'
        f'font-weight:600;letter-spacing:0.01em;">Avaa koko näkymä Mittarissa '
        f'<span style="color:{EMBER};font-family:{_F_MONO};letter-spacing:0.14em;'
        f'font-size:11px;margin-left:6px;">→</span></a></td>'
        f'</tr></tbody></table></td></tr>'
    )

    # Partner module
    partner = d.get("partner") or {}
    if partner.get("enabled"):
        p_name = (partner.get("partner_name") or "PARTNER").upper()
        p_head = partner.get("headline") or ""
        p_body = partner.get("body") or ""
        p_score = partner.get("mittari_score")
        p_cta_label = partner.get("cta_label") or "Lue lisää"
        p_cta_url = partner.get("cta_url") or "https://putkihq.fi/"
        p_disc = (partner.get("disclosure") or "+5/100 painotus").upper()
        p_img = partner.get("image_url") or ""

        img_block = ""
        if p_img:
            img_block = (
                f'<tr><td style="padding-bottom:18px;">'
                f'<img src="{_esc(p_img)}" alt="" width="520" '
                f'style="display:block;width:100%;max-width:520px;height:auto;'
                f'border:0;outline:none;text-decoration:none;" /></td></tr>'
            )

        score_line = ""
        if isinstance(p_score, (int, float)):
            score_line = f" Mittari {int(p_score)} / 100."

        parts.append(
            f'<tr><td style="padding:48px 40px 0 40px;">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'width="100%" style="border-top:2px solid {INK};">'
            f'<tbody>{img_block}<tr><td style="padding-top:18px;">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'width="100%"><tbody><tr>'
            f'<td><div style="font-family:{_F_MONO};font-size:9px;font-weight:600;'
            f'color:{INK};letter-spacing:0.18em;text-transform:uppercase;">'
            f'PUTKI × {_esc(p_name)}</div></td>'
            f'<td align="right"><div style="font-family:{_F_MONO};font-size:9px;'
            f'font-weight:500;color:{MUTED};letter-spacing:0.14em;'
            f'text-transform:uppercase;">{_esc(p_disc)}</div></td>'
            f'</tr></tbody></table>'
            f'<div style="font-family:{_F_DISP};font-weight:900;font-size:28px;'
            f'line-height:1.0;color:{INK};letter-spacing:-0.03em;margin-top:14px;">'
            f'{_ember_markup(p_head)}</div>'
            f'<div style="font-family:{_F_BODY};font-size:13px;line-height:1.5;'
            f'color:{INK_2};margin-top:10px;">{_esc(p_body)}{score_line}</div>'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'style="margin-top:16px;"><tbody><tr>'
            f'<td style="background:{EMBER};border-radius:4px;">'
            f'<a href="{_esc(p_cta_url)}" style="display:block;padding:14px 22px;'
            f'text-decoration:none;color:{BG};font-family:{_F_BODY};font-size:14px;'
            f'font-weight:600;letter-spacing:0.01em;">{_esc(p_cta_label)} '
            f'<span style="font-family:{_F_MONO};letter-spacing:0.14em;'
            f'font-size:11px;margin-left:4px;">→</span></a></td>'
            f'</tr></tbody></table>'
            f'</td></tr></tbody></table></td></tr>'
        )

    # Sign-off
    signoff = d.get("signoff") or "Perke*le, alkaa olla jotain."
    parts.append(
        f'<tr><td style="padding:44px 40px 0 40px;">'
        f'<div style="font-family:{_F_SERIF};font-size:16px;line-height:1.55;'
        f'color:{INK_2};font-style:italic;">{_ember_markup(signoff)}</div>'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{INK};letter-spacing:0.16em;text-transform:uppercase;margin-top:14px;">'
        f'— PUTKI HQ -toimitus</div></td></tr>'
    )

    # Footer
    unsub_url = d.get("unsubscribe_url") or "https://putkihq.fi/api/u/%7Btoken%7D"
    parts.append(
        f'<tr><td style="padding:40px 40px 36px 40px;">'
        f'<div style="border-top:1px solid {LINE};padding-top:16px;">'
        f'<div style="font-family:{_F_BODY};font-size:11px;line-height:1.6;color:{MUTED};">'
        f'<a href="https://putkihq.fi/menetelma" style="color:{MUTED};text-decoration:underline;">Menetelmä</a> · '
        f'<a href="https://putkihq.fi/affiliaatti" style="color:{MUTED};text-decoration:underline;">Affiliaatti</a> · '
        f'<a href="{_esc(unsub_url)}" style="color:{MUTED};text-decoration:underline;">Peruuta tilaus</a>'
        f'</div>'
        f'<div style="font-family:{_F_BODY};font-size:10px;color:#A8A39A;margin-top:8px;">'
        f'Unlshd Ltd · HE 479997 · Cyprus · 28 nimettyä lähdettä.</div>'
        f'</div></td></tr>'
    )

    parts.append('</tbody></table></td></tr></tbody></table></body></html>')
    return "".join(parts)


# ── Weekly editorial ─────────────────────────────────────────────────
def render_weekly(d: Dict[str, Any]) -> str:
    """Render the Sunday 08:00 weekly editorial email."""
    week_no = d.get("week_no", 22)
    eyebrow = d.get("eyebrow", "Viikko viidessä jutussa")
    headline = d.get("headline") or "Viikon viisi {ember}juttua.{/ember}"
    summary = d.get("summary") or ""
    articles = (d.get("articles") or [])[:4]
    scene_quote = d.get("scene_quote") or ""
    scene_attr = d.get("scene_attr") or ""
    signoff_head = d.get("signoff") or "Nähdään maanantaina {ember}09:00.{/ember}"
    partner = d.get("partner") or {}
    unsub_url = d.get("unsubscribe_url") or "https://putkihq.fi/api/u/%7Btoken%7D"

    parts = [
        f'<!DOCTYPE html><html lang="fi"><body style="margin:0;padding:0;'
        f'background:{PAGE_BG};font-family:{_F_BODY};color:{INK};">',
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;'
        f'font-size:1px;color:{PAGE_BG};">{_esc(summary[:200])}</div>',
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%" style="background:{PAGE_BG};"><tbody><tr>'
        f'<td align="center" style="padding:24px 12px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="600" style="background:{BG};max-width:600px;"><tbody>',
        f'<tr><td style="background:{EMBER};height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>',
        # Masthead
        f'<tr><td style="padding:24px 40px 0 40px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%"><tbody><tr>'
        f'<td><div style="font-family:{_F_DISP};font-weight:900;font-size:18px;'
        f'letter-spacing:-0.02em;color:{INK};line-height:1;">PUTKI HQ</div></td>'
        f'<td align="right"><div style="font-family:{_F_MONO};font-size:9px;'
        f'font-weight:500;color:{MUTED};letter-spacing:0.16em;text-transform:uppercase;'
        f'line-height:1;">VIIKKO {week_no} · SU 08:00</div></td>'
        f'</tr></tbody></table></td></tr>',
        # Hook
        f'<tr><td style="padding:36px 40px 0 40px;">'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{EMBER};letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px;">'
        f'● {_esc(eyebrow)}</div>'
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:48px;'
        f'line-height:0.94;color:{INK};letter-spacing:-0.035em;">'
        f'{_ember_markup(headline)}</div>'
        f'<div style="font-family:{_F_SERIF};font-size:16px;line-height:1.5;'
        f'color:{INK_2};font-style:italic;margin-top:18px;">{_ember_markup(summary)}</div>'
        f'</td></tr>',
    ]

    # Articles
    for i, a in enumerate(articles, start=1):
        cat = (a.get("category") or "").upper()
        read = a.get("read_time", "")
        title = a.get("headline") or ""
        excerpt = a.get("excerpt") or ""
        url = a.get("url") or "https://putkihq.fi/uutiset"
        font_size = 30 if i == 1 else 22
        parts.append(
            f'<tr><td style="padding:32px 40px 0 40px;">'
            f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
            f'color:{INK};letter-spacing:0.18em;text-transform:uppercase;'
            f'border-bottom:1px solid {INK};padding-bottom:12px;">'
            f'{i:02d} · {_esc(cat)} {"· " + str(read) + " MIN" if read else ""}</div>'
            f'<a href="{_esc(url)}" style="text-decoration:none;color:{INK};">'
            f'<div style="font-family:{_F_DISP};font-weight:900;font-size:{font_size}px;'
            f'line-height:1.05;color:{INK};letter-spacing:-0.03em;margin-top:14px;">'
            f'{_ember_markup(title)}</div></a>'
            f'<div style="font-family:{_F_SERIF};font-size:14px;line-height:1.55;'
            f'color:{INK_2};margin-top:12px;">{_esc(excerpt)}</div>'
            f'<div style="margin-top:12px;">'
            f'<a href="{_esc(url)}" style="font-family:{_F_MONO};font-size:10px;'
            f'font-weight:600;color:{EMBER};letter-spacing:0.16em;'
            f'text-transform:uppercase;text-decoration:none;">Lue koko juttu →</a>'
            f'</div></td></tr>'
        )

    # Scene moment
    if scene_quote:
        parts.append(
            f'<tr><td style="padding:36px 40px 0 40px;">'
            f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
            f'color:{INK};letter-spacing:0.18em;text-transform:uppercase;'
            f'border-bottom:1px solid {INK};padding-bottom:12px;">Skenehetki</div>'
            f'<div style="font-family:{_F_SERIF};font-size:20px;line-height:1.4;'
            f'color:{INK_2};font-style:italic;margin-top:18px;">"{_esc(scene_quote)}"</div>'
            f'<div style="font-family:{_F_MONO};font-size:10px;color:{MUTED};'
            f'letter-spacing:0.14em;text-transform:uppercase;margin-top:10px;">'
            f'— {_esc(scene_attr)}</div></td></tr>'
        )

    # Partner (reuses daily render's partner block via inline rebuild)
    if partner.get("enabled"):
        # Recurse the daily renderer's partner part by inlining: short version
        p_name = (partner.get("partner_name") or "PARTNER").upper()
        p_head = partner.get("headline") or ""
        p_body = partner.get("body") or ""
        p_cta_label = partner.get("cta_label") or "Lue lisää"
        p_cta_url = partner.get("cta_url") or "https://putkihq.fi/"
        p_disc = (partner.get("disclosure") or "Sponsoroitu").upper()
        p_img = partner.get("image_url") or ""
        img_block = (
            f'<tr><td style="padding-bottom:18px;">'
            f'<img src="{_esc(p_img)}" alt="" width="520" '
            f'style="display:block;width:100%;max-width:520px;height:auto;border:0;" />'
            f'</td></tr>' if p_img else ""
        )
        parts.append(
            f'<tr><td style="padding:48px 40px 0 40px;">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'width="100%" style="border-top:2px solid {INK};"><tbody>'
            f'{img_block}<tr><td style="padding-top:18px;">'
            f'<div style="font-family:{_F_MONO};font-size:9px;font-weight:600;'
            f'color:{INK};letter-spacing:0.18em;text-transform:uppercase;">'
            f'PUTKI × {_esc(p_name)} · {_esc(p_disc)}</div>'
            f'<div style="font-family:{_F_DISP};font-weight:900;font-size:28px;'
            f'line-height:1.0;color:{INK};letter-spacing:-0.03em;margin-top:14px;">'
            f'{_ember_markup(p_head)}</div>'
            f'<div style="font-family:{_F_BODY};font-size:13px;line-height:1.5;'
            f'color:{INK_2};margin-top:10px;">{_esc(p_body)}</div>'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'style="margin-top:16px;"><tbody><tr>'
            f'<td style="background:{EMBER};border-radius:4px;">'
            f'<a href="{_esc(p_cta_url)}" style="display:block;padding:14px 22px;'
            f'text-decoration:none;color:{BG};font-family:{_F_BODY};font-size:14px;'
            f'font-weight:600;">{_esc(p_cta_label)}</a></td>'
            f'</tr></tbody></table></td></tr></tbody></table></td></tr>'
        )

    # Sign-off + footer
    parts.append(
        f'<tr><td style="padding:48px 40px 0 40px;">'
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:24px;'
        f'line-height:1.1;color:{INK};letter-spacing:-0.025em;">'
        f'{_ember_markup(signoff_head)}</div>'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{INK};letter-spacing:0.16em;text-transform:uppercase;margin-top:14px;">'
        f'— PUTKI HQ -toimitus</div></td></tr>'
        f'<tr><td style="padding:40px 40px 36px 40px;">'
        f'<div style="border-top:1px solid {LINE};padding-top:16px;">'
        f'<div style="font-family:{_F_BODY};font-size:11px;line-height:1.6;color:{MUTED};">'
        f'<a href="https://putkihq.fi/menetelma" style="color:{MUTED};text-decoration:underline;">Menetelmä</a> · '
        f'<a href="https://putkihq.fi/affiliaatti" style="color:{MUTED};text-decoration:underline;">Affiliaatti</a> · '
        f'<a href="{_esc(unsub_url)}" style="color:{MUTED};text-decoration:underline;">Peruuta tilaus</a>'
        f'</div></div></td></tr>'
        f'</tbody></table></td></tr></tbody></table></body></html>'
    )
    return "".join(parts)


# ── Welcome (read-only preview only — actual welcome content lives in
# email_templates.py and is edited via /back-office/email-templates) ──
def render_welcome(d: Dict[str, Any]) -> str:
    """Render the Mestari-diagnostic welcome card."""
    profile_label = d.get("profile_label") or "HILJAINEN TARKKA"
    subject = d.get("subject") or "Tervetuloa PUTKI HQ:hon."
    preheader = d.get("preheader") or ""
    body_blocks = d.get("body_blocks") or [
        "Sait Mestari-diagnoosista profiilin: " + profile_label + ".",
        "Päivän 5 signaalia rajoitettuna luxus-syötteenä Telegramiin klo 09:00.",
    ]
    cta_url = d.get("cta_url") or "https://t.me/Putkihq_bot?start=signals"

    parts = [
        f'<!DOCTYPE html><html lang="fi"><body style="margin:0;padding:0;'
        f'background:{PAGE_BG};font-family:{_F_BODY};color:{INK};">',
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;'
        f'font-size:1px;">{_esc(preheader[:200])}</div>',
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="100%" style="background:{PAGE_BG};"><tbody><tr>'
        f'<td align="center" style="padding:24px 12px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        f'width="600" style="background:{BG};max-width:600px;"><tbody>'
        f'<tr><td style="background:{EMBER};height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>',
        f'<tr><td style="padding:32px 40px 0 40px;">'
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:18px;'
        f'letter-spacing:-0.02em;color:{INK};">PUTKI HQ</div>'
        f'<div style="font-family:{_F_MONO};font-size:10px;font-weight:600;'
        f'color:{EMBER};letter-spacing:0.18em;text-transform:uppercase;margin-top:24px;">'
        f'● PROFIILI · {_esc(profile_label)}</div>'
        f'<div style="font-family:{_F_DISP};font-weight:900;font-size:38px;'
        f'line-height:1.0;color:{INK};letter-spacing:-0.035em;margin-top:14px;">'
        f'{_esc(subject)}</div>'
        f'</td></tr>',
    ]
    for block in body_blocks:
        parts.append(
            f'<tr><td style="padding:18px 40px 0 40px;">'
            f'<div style="font-family:{_F_SERIF};font-size:15px;line-height:1.55;'
            f'color:{INK_2};">{_ember_markup(block)}</div></td></tr>'
        )

    parts.append(
        f'<tr><td style="padding:32px 40px 0 40px;">'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
        f'<tbody><tr><td style="background:{INK};border-radius:4px;">'
        f'<a href="{_esc(cta_url)}" style="display:block;padding:16px 24px;'
        f'text-decoration:none;color:{BG};font-family:{_F_BODY};font-size:14px;'
        f'font-weight:600;">Avaa Telegram → @Putkihq_bot</a></td>'
        f'</tr></tbody></table></td></tr>'
        f'<tr><td style="padding:40px 40px 36px 40px;">'
        f'<div style="border-top:1px solid {LINE};padding-top:16px;">'
        f'<div style="font-family:{_F_BODY};font-size:11px;line-height:1.6;color:{MUTED};">'
        f'PUTKI HQ · Helsinki · Yksi tilaus per käyttäjä.'
        f'</div></div></td></tr>'
        f'</tbody></table></td></tr></tbody></table></body></html>'
    )
    return "".join(parts)


def render(template_type: str, draft: Dict[str, Any]) -> str:
    """Dispatch the right renderer by template type."""
    t = (template_type or "daily").lower()
    if t == "daily":
        return render_daily_tips(draft)
    if t == "weekly":
        return render_weekly(draft)
    if t == "welcome":
        return render_welcome(draft)
    return render_daily_tips(draft)
