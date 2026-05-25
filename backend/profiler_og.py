"""
PUTKI HQ — Profiler Share OG Image generator (iter64 Phase 4).

Renders a 1200×630 PNG card for social-share unfurling. The card shows:

    PUTKI HQ · BEHAVIORAL PROFILER             (mono, amber)
    I'm
    The Cold Calculator                          (display serif, ink)
    01 / 05  ·  PROFILE                          (mono, muted)
    What kind of gambler are you?                (serif, muted)
    putkihq.fi/peliareena                        (mono, ink)

Plus a subtle amber accent bar and a paper-toned background. Renders
with stdlib Pillow + DejaVu (always present on the image).
"""
from __future__ import annotations

import io
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

# Brand palette — kept in lock-step with frontend/src/index.css
BG_PAPER   = (251, 250, 248)   # --bg
INK        = (28,  26,  24)    # --ink
MUTED      = (107, 102, 95)    # --muted
BORDER     = (224, 218, 207)   # --border
AMBER      = (176, 125, 24)    # accent
SURFACE_2  = (243, 240, 233)   # alt-bg for noise band

W, H = 1200, 630

# Font paths — DejaVu ships on every base python image; falls back to
# default bitmap font on the (vanishingly rare) host without DejaVu.
_FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/dejavu",
]


def _font(size: int, *, bold: bool = False, italic: bool = False) -> ImageFont.ImageFont:
    name = "DejaVuSerif"
    if bold:
        name += "-Bold"
    if italic:
        name += "-Italic" if not bold else "-BoldItalic"
    for d in _FONT_DIRS:
        try:
            return ImageFont.truetype(f"{d}/{name}.ttf", size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _mono(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
    name = "DejaVuSansMono-Bold" if bold else "DejaVuSansMono"
    for d in _FONT_DIRS:
        try:
            return ImageFont.truetype(f"{d}/{name}.ttf", size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _text_w(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def render_profile_card(
    *,
    profile_title: str,
    profile_index: str = "01 / 05",
    lang: str = "fi",
) -> bytes:
    """Render the 1200×630 OG card and return PNG bytes."""
    img = Image.new("RGB", (W, H), BG_PAPER)
    d = ImageDraw.Draw(img)

    # Subtle off-white panel on the right third for visual asymmetry
    d.rectangle([(W - 18, 0), (W, H)], fill=AMBER)
    d.rectangle([(W - 380, 0), (W - 18, H)], fill=SURFACE_2)

    # Top-left brand mono kicker
    kicker_font = _mono(20, bold=True)
    kicker = "PUTKI HQ · BEHAVIORAL PROFILER" if lang == "en" else "PUTKI HQ · PELAAJAPROFIILI"
    d.text((72, 60), kicker, font=kicker_font, fill=AMBER)

    # "I'm" / "Olen" lead
    lead_font = _font(34, italic=True)
    lead = "I'm" if lang == "en" else "Olen"
    d.text((72, 150), lead, font=lead_font, fill=MUTED)

    # Profile title — auto-shrink so it always fits on one line
    title_size = 92
    title_font = _font(title_size, bold=True)
    while _text_w(d, profile_title, title_font) > (W - 460) and title_size > 48:
        title_size -= 6
        title_font = _font(title_size, bold=True)
    d.text((72, 200), profile_title, font=title_font, fill=INK)

    # Profile index pill
    pill_font = _mono(18, bold=True)
    pill_text = f"{profile_index}  ·  " + ("PROFILE" if lang == "en" else "PROFIILI")
    d.text((76, 360), pill_text, font=pill_font, fill=MUTED)

    # Provocation line
    q_font = _font(30, italic=True)
    question = ("What kind of gambler are you?"
                if lang == "en" else "Millainen pelaaja sinä olet?")
    d.text((72, 420), question, font=q_font, fill=INK)

    # CTA URL — bottom-left
    url_font = _mono(18, bold=True)
    d.text((72, H - 70), "putkihq.fi/peliareena", font=url_font, fill=INK)

    # Right rail tiny mono mark
    mark_font = _mono(14, bold=True)
    d.text((W - 360, H - 70), "putki_hq", font=mark_font, fill=MUTED)

    # Amber stripe under the title
    d.rectangle([(72, 320), (140, 326)], fill=AMBER)

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


# Profile spectrum lookup — mirrors backend SCENARIO_PERSONAS but only
# carries the display name in both langs. Kept here so the OG renderer
# is self-contained and importable from anywhere.
PROFILE_DISPLAY = {
    "cold_calculator":    ("Kylmä laskija",         "The Cold Calculator",    "01 / 05"),
    "patient_tactician":  ("Kärsivällinen taktikko", "The Patient Tactician",  "02 / 05"),
    "streak_chaser":      ("Putken jahti",          "The Streak Chaser",      "03 / 05"),
    "comeback_believer":  ("Comeback-uskoja",       "The Comeback Believer",  "04 / 05"),
    "tilt_risk":          ("Tilt-riski",            "The Tilt Risk",          "05 / 05"),
}


def render_from_persona_key(persona_key: str, lang: str = "fi") -> bytes:
    fi, en, idx = PROFILE_DISPLAY.get(persona_key, ("Pelaajaprofiili", "Your Player Profile", "01 / 05"))
    title = en if lang == "en" else fi
    return render_profile_card(profile_title=title, profile_index=idx, lang=lang)
