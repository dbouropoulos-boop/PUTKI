"""
PUTKI HQ — Voita quiz config.

Default schema-driven definition for the 5 quiz questions on the
landing funnel. Editable via /api/admin/settings → voita_quiz_config.
FE reads from /api/settings/public when present; falls back to this
default when admins haven't customized.

Schema per question:
  {
    "key": str,         # stable analytics key; admins should NEVER rename
                        # this — only the user-visible labels.
    "auto": bool,       # auto-advance on single-select
    "multi": bool,      # multi-select (with explicit Continue button)
    "callback": bool,   # surfaces in the Beat 4 review screen
    "title_fi": str,
    "title_en": str,
    "sub_fi":   str,
    "sub_en":   str,
    "options": [
      {"v": str, "label_fi": str, "label_en": str, "emoji": str}
    ]
  }
"""

DEFAULT_VOITA_QUIZ = [
    {
        "key": "style", "auto": True, "multi": False, "callback": False,
        "title_fi": "Mikä veikkaajatyyppi sinä olet?",
        "title_en": "What kind of predictor are you?",
        "sub_fi": "Yksi vastaus — autamme räätälöimään fiiliksen.",
        "sub_en": "One answer — helps us tune the experience.",
        "options": [
            {"v": "stats", "label_fi": "Tilastoja seuraan", "label_en": "Numbers guy", "emoji": "🧊"},
            {"v": "gut", "label_fi": "Tunteella menen", "label_en": "Gut player", "emoji": "🔥"},
            {"v": "loyal", "label_fi": "Lempijoukkue aina", "label_en": "Loyal to my team", "emoji": "🎯"},
            {"v": "chaos", "label_fi": "Tuuripeli, baby", "label_en": "Pure luck", "emoji": "🎲"},
        ],
    },
    {
        "key": "sports", "auto": False, "multi": True, "callback": False,
        "title_fi": "Minkä lajin parissa olet kotonasi?",
        "title_en": "What's your home turf?",
        "sub_fi": "Valitse vähintään yksi.",
        "sub_en": "Pick at least one.",
        "options": [
            {"v": "football", "label_fi": "Jalkapallo", "label_en": "Football", "emoji": "⚽"},
            {"v": "icehockey", "label_fi": "Jääkiekko", "label_en": "Ice hockey", "emoji": "🏒"},
            {"v": "tennis", "label_fi": "Tennis", "label_en": "Tennis", "emoji": "🎾"},
            {"v": "basketball", "label_fi": "Koripallo", "label_en": "Basketball", "emoji": "🏀"},
            {"v": "f1", "label_fi": "F1", "label_en": "F1", "emoji": "🏎️"},
            {"v": "mma", "label_fi": "MMA / Nyrkkeily", "label_en": "MMA / Boxing", "emoji": "🥊"},
        ],
    },
    {
        "key": "frequency", "auto": True, "multi": False, "callback": False,
        "title_fi": "Kuinka usein olet veikkaamassa?",
        "title_en": "How often do you predict?",
        "sub_fi": "",
        "sub_en": "",
        "options": [
            {"v": "weekly", "label_fi": "Viikoittain — joka peli mukaan", "label_en": "Weekly — every match", "emoji": "🔥"},
            {"v": "monthly", "label_fi": "Kuukausittain — vain isot ottelut", "label_en": "Monthly — only big games", "emoji": "📅"},
            {"v": "rare", "label_fi": "Vain finaalihetkinä", "label_en": "Only championship moments", "emoji": "🎯"},
            {"v": "first", "label_fi": "Tämä on ensimmäiseni", "label_en": "This is my first time", "emoji": "🆕"},
        ],
    },
    {
        "key": "skill", "auto": True, "multi": False, "callback": True,
        "title_fi": "Kuinka usein veikkauksesi osuvat?",
        "title_en": "How often do your predictions hit?",
        "sub_fi": "",
        "sub_en": "",
        "options": [
            {"v": "often", "label_fi": "Useammin kuin kerran kuussa", "label_en": "More often than not", "emoji": "😤"},
            {"v": "fifty", "label_fi": "Joskus osuu, joskus ei", "label_en": "50/50 — fair coin", "emoji": "🤷"},
            {"v": "unknown", "label_fi": "En oikeasti tiedä", "label_en": "I genuinely don't know", "emoji": "😅"},
            {"v": "first", "label_fi": "En ole vielä veikannut", "label_en": "I haven't predicted before", "emoji": "🎯"},
        ],
    },
    {
        "key": "mode", "auto": True, "multi": False, "callback": False,
        "title_fi": "Kuinka haluat veikata?",
        "title_en": "How do you want to predict?",
        "sub_fi": "Tämä määrittää loppupelin tyylin.",
        "sub_en": "This shapes the rest of the experience.",
        "options": [
            {"v": "with_data", "label_fi": "Näytä mulle data — sitten valitsen", "label_en": "Show me the data — I'll decide", "emoji": "🎯"},
            {"v": "quick", "label_fi": "Tuurilla menen — heti lukkoon", "label_en": "Trust my gut — lock it now", "emoji": "⚡"},
            {"v": "with_editorial", "label_fi": "Toimitus kertoo mitä se ajattelee", "label_en": "Editorial gives me their read", "emoji": "🤝"},
        ],
    },
]


def sanitize_quiz_config(cfg) -> list:
    """Clamp + sanitize admin-edited quiz config. Falls back to default
    on any structural error so a bad save never blanks the funnel."""
    if not isinstance(cfg, list) or not cfg:
        return DEFAULT_VOITA_QUIZ
    out = []
    seen_keys = set()
    for q in cfg[:8]:  # max 8 questions
        if not isinstance(q, dict):
            continue
        key = str(q.get("key") or "").strip().lower()[:32]
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        options = []
        for o in (q.get("options") or [])[:10]:  # max 10 options per Q
            if not isinstance(o, dict):
                continue
            v = str(o.get("v") or "").strip().lower()[:32]
            if not v:
                continue
            options.append({
                "v": v,
                "label_fi": str(o.get("label_fi") or "")[:120],
                "label_en": str(o.get("label_en") or "")[:120],
                "emoji": str(o.get("emoji") or "")[:8],
            })
        if not options:
            continue
        out.append({
            "key": key,
            "auto": bool(q.get("auto", True)),
            "multi": bool(q.get("multi", False)),
            "callback": bool(q.get("callback", False)),
            "title_fi": str(q.get("title_fi") or "")[:160],
            "title_en": str(q.get("title_en") or "")[:160],
            "sub_fi": str(q.get("sub_fi") or "")[:240],
            "sub_en": str(q.get("sub_en") or "")[:240],
            "options": options,
        })
    return out or DEFAULT_VOITA_QUIZ
