"""PUTKI HQ — Mittari shared constants.

Extracted from `telegram_bot.py` so both `dial_engine.py` and
`telegram_bot.py` can reference these label maps without importing each
other at module-load time. Eliminates the circular-import risk flagged
in the Sprint C code review (even though current imports are
late/in-function, this clarifies ownership).
"""
from __future__ import annotations

# Quantised dial-state → Finnish editorial label. Used by both the
# Telegram broadcast cards and by any future copy that needs the
# operator-facing wording (admin tables, OG image overlays, etc.).
STATE_LABELS_FI: dict[str, str] = {
    "KYLMA": "TYYNI",
    "HAALEA": "VIRE",
    "KUUMA": "VIPINÄ",
    "MYRSKY": "MEININKI",
    "KIIRASTULI": "PERKELE",
}


def state_label_fi(state_key: str | None) -> str:
    """Safe lookup with passthrough fallback so unknown states don't
    crash editorial templates."""
    if not state_key:
        return "—"
    key = state_key.upper()
    return STATE_LABELS_FI.get(key, key)
