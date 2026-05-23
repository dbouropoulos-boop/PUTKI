"""
PUTKI HQ — Mini-Game Identity Card Builder (iter63).

Generates the `card` payload that powers the new Identity Result Card +
Micro-Yes gate UI. The card is psychological, not stats-first:

    • profile_index   — "02 / 05" rank of this persona inside the set
    • stat_value      — 0..100 number for the amber fill bar
    • stat_*_footnote — "Higher than X% of players this week."
    • hook_text       — data-driven blind-spot tease (with <em>...</em>
                        accent on the weak topic). This is the unresolved
                        loop that the email gate later closes.
    • read_line       — sentence above the micro-yes CTA
    • verdict         — sentence under the persona title

All copy returned in BOTH `fi` and `en` so the frontend can render the
active language via `useLang()`.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


# Persona ordering for "02 / 05"-style indices. Keeps the frontend
# stable when we add personas later — the index only changes if we
# reorder the registry.
PERSONA_ORDER = {
    # Quiz
    "needs_basics":         (1, 4),
    "balanced":             (2, 4),
    "responsibility_strong":(3, 4),
    "math_strong":          (4, 4),
    # Scenario
    "fresh_player":         (1, 3),
    "growing_judge":        (2, 3),
    "patient_tactician":    (3, 3),
    # Insight
    "explorer":             (1, 1),
    # Arcade
    "arcade_player":        (1, 1),
}


# Topic-tag → hook-text mapping. The amber-emphasised phrase is the
# blind spot — the "unfinished loop" that the email gate later resolves.
# Each entry has FI and EN with `<em>...</em>` wrapping the key phrase.
TOPIC_HOOKS = {
    "math": {
        "fi": ("Numerot ovat selvät — mutta yksi puoli vetää alas. "
               "<em>Talon edge pitkällä volyymilla</em> on se piste, johon "
               "useimmat aloittelijat törmäävät vasta menettäessään."),
        "en": ("You read the numbers — but one edge bleeds you slowly. "
               "<em>The house margin compounds over volume</em> faster "
               "than most beginners realise."),
    },
    "bankroll": {
        "fi": ("Tunnistat oikeat valinnat — mutta kuri pelisession aikana "
               "horjuu. <em>Häviöputken keskellä tehty panospäätös</em> "
               "ratkaisee, kuinka pitkälle bankrolli kantaa."),
        "en": ("You spot the right call — but discipline mid-session "
               "wavers. <em>The bet sizing during a losing streak</em> "
               "decides how far your bankroll really stretches."),
    },
    "bonus": {
        "fi": ("Ymmärrät pelin perusteet — mutta bonusehdot piilottavat "
               "rivin. <em>Kierrätysvaatimuksen todellinen volyymi</em> "
               "on yleisin piste, jossa odotusarvo katoaa."),
        "en": ("You grasp the basics — but bonus terms hide a line. "
               "<em>The real wagering volume behind a bonus</em> is where "
               "expected value quietly disappears."),
    },
    "psychology": {
        "fi": ("Looginen puolesi on vahva — mutta lämpö pelitilanteessa "
               "siirtää päätöksiä. <em>Tilt-tilan ensimmäinen merkki</em> "
               "on huomaamattoman paljon aikaisempi kuin useimmat olettavat."),
        "en": ("Your logical side is strong — but heat in the moment "
               "shifts decisions. <em>The first marker of tilt</em> "
               "shows up far earlier than most players assume."),
    },
    "responsibility": {
        "fi": ("Pelisilmäsi on terävä — mutta käytännön kahleet puuttuvat. "
               "<em>Talletusrajan asettaminen ENNEN sessiota</em> on se "
               "ero, jonka useimmat oppivat vasta jälkeenpäin."),
        "en": ("Your read is sharp — but the practical guardrails are "
               "missing. <em>Setting the deposit cap before the session</em> "
               "is the difference most players learn the hard way."),
    },
    "regulation": {
        "fi": ("Tunnet kentän — mutta laillinen toimintaympäristö muuttuu "
               "nopeasti. <em>Lisensoitujen operaattoreiden todellinen "
               "lista</em> on tieto, joka säästää pisteissä ja rahassa."),
        "en": ("You know the field — but the legal landscape shifts fast. "
               "<em>The real shortlist of licensed operators</em> is the "
               "data that saves both points and money."),
    },
    # Insight-game fallbacks (tile categories overlap with above tags)
    "default": {
        "fi": ("Tulos näyttää sinusta tasaista — mutta yksi sokea piste "
               "vetää alas. <em>Se on aina sama tekijä</em> joka erottaa "
               "kokeneen pelaajan aloittelijasta."),
        "en": ("Your result reads steady — but one blind spot drags you "
               "down. <em>It's always the same factor</em> that separates "
               "the seasoned player from the beginner."),
    },
}


def _persona_index_str(persona_key: str) -> str:
    idx, total = PERSONA_ORDER.get(persona_key, (1, 5))
    return f"{idx:02d} / {total:02d}"


def _percentile(player_score: int, weekly_scores: List[int]) -> int:
    """Return integer 0..99 percentile vs the rest of the week. Uses
    "lower-or-equal" so the player always lands ≥0 even on first play.

    When the week has < 3 finished plays the percentile copy is
    statistically meaningless, so we fall back to an honest 50 (median)
    instead of an optimistic-but-fake number."""
    if len(weekly_scores) < 3:
        return 50
    below = sum(1 for s in weekly_scores if s < player_score)
    pct = round((below / max(1, len(weekly_scores))) * 100)
    return max(0, min(99, pct))


def _weak_topic(tag_scores: Dict[str, int], possible_tags: List[str]) -> str:
    """Return the topic_tag with the LOWEST score (or zero coverage).
    Picks an untouched tag first, then the lowest scoring one."""
    if not possible_tags:
        return "default"
    untouched = [t for t in possible_tags if t not in tag_scores]
    if untouched:
        return untouched[0]
    return min(tag_scores, key=lambda k: tag_scores.get(k, 0))


def _build_card_text(
    *,
    persona_key: str,
    stat_pct: float,
    tag_scores: Dict[str, int],
    possible_tags: List[str],
    weekly_scores: List[int],
    player_score: int,
    persona_tagline_fi: str,
    persona_tagline_en: str,
    stat_label_fi: str = "Kurin indeksi",
    stat_label_en: str = "Discipline index",
) -> Dict[str, Any]:
    weak = _weak_topic(tag_scores, possible_tags)
    hook = TOPIC_HOOKS.get(weak) or TOPIC_HOOKS["default"]
    percentile = _percentile(player_score, weekly_scores)
    return {
        "profile_index": _persona_index_str(persona_key),
        "stat_value": int(round(max(0.0, min(100.0, stat_pct)))),
        "stat_label_fi": stat_label_fi,
        "stat_label_en": stat_label_en,
        "stat_footnote_fi": f"Korkeampi kuin {percentile}% pelaajista tällä viikolla.",
        "stat_footnote_en": f"Higher than {percentile}% of players this week.",
        "verdict_fi": persona_tagline_fi,
        "verdict_en": persona_tagline_en,
        "hook_text_fi": hook["fi"],
        "hook_text_en": hook["en"],
        "read_line_fi": (
            "Olet jo nähnyt yhden puolen itsestäsi. Toinen — pieni mutta "
            "ratkaiseva — odottaa vielä avaamista."
        ),
        "read_line_en": (
            "You've seen one side of yourself. The other — small but "
            "decisive — is still waiting to be opened."
        ),
        "weak_topic_tag": weak,
    }


# ───────────────────────── per-game builders ─────────────────────────

QUIZ_TAGS = ["math", "bankroll", "bonus", "psychology", "responsibility", "regulation"]
SCENARIO_TAGS = ["bankroll", "psychology", "responsibility"]


async def build_quiz_card(
    db, *, persona: Dict[str, Any], score: int, total: int, pct: float,
    tag_scores: Dict[str, int], week_iso: str,
) -> Dict[str, Any]:
    weekly_scores = await _fetch_weekly_scores(db, "quiz_gambling_literacy", week_iso)
    return _build_card_text(
        persona_key=persona["key"],
        stat_pct=pct,
        tag_scores=tag_scores or {},
        possible_tags=QUIZ_TAGS,
        weekly_scores=weekly_scores,
        player_score=score,
        persona_tagline_fi=persona.get("tagline") or "",
        persona_tagline_en=persona.get("tagline_en") or "",
        stat_label_fi="Tieto-indeksi",
        stat_label_en="Awareness index",
    )


async def build_scenario_card(
    db, *, persona: Dict[str, Any], score: int, max_score: int, pct: float,
    tag_scores: Dict[str, int], week_iso: str,
) -> Dict[str, Any]:
    weekly_scores = await _fetch_weekly_scores(db, "scenario_decision_path", week_iso)
    return _build_card_text(
        persona_key=persona["key"],
        stat_pct=pct,
        tag_scores=tag_scores or {},
        possible_tags=SCENARIO_TAGS,
        weekly_scores=weekly_scores,
        player_score=score,
        persona_tagline_fi=persona.get("tagline") or "",
        persona_tagline_en=persona.get("tagline_en") or "",
        stat_label_fi="Päätös-indeksi",
        stat_label_en="Judgement index",
    )


async def build_insight_card(
    db, *, persona_title: str, persona_title_en: str,
    persona_tagline: str, persona_tagline_en: str,
    revealed_count: int, total_tiles: int, week_iso: str,
    revealed_topic_tags: List[str],
) -> Dict[str, Any]:
    weekly_scores = await _fetch_weekly_scores(db, "insight_reveal", week_iso)
    pct = (revealed_count / total_tiles * 100.0) if total_tiles else 0.0
    # For insight, "tag_scores" is implicit — every revealed tile counts.
    # We treat unrevealed tags as the weak point.
    tag_scores = {t: 1 for t in revealed_topic_tags}
    persona_key = "explorer"
    return _build_card_text(
        persona_key=persona_key,
        stat_pct=pct,
        tag_scores=tag_scores,
        possible_tags=QUIZ_TAGS,  # insight tiles span the same domain
        weekly_scores=weekly_scores,
        player_score=revealed_count,
        persona_tagline_fi=persona_tagline,
        persona_tagline_en=persona_tagline_en,
        stat_label_fi="Avaus-indeksi",
        stat_label_en="Reveal index",
    )


async def build_arcade_card(
    db, *, game_slug: str, score: int, max_score: int, week_iso: str,
    persona_title: str, persona_title_en: str = "",
) -> Dict[str, Any]:
    weekly_scores = await _fetch_weekly_scores(db, game_slug, week_iso)
    # Arcade pct: relative to best score of the week (or score itself if first).
    best = max(weekly_scores) if weekly_scores else max(score, 1)
    pct = (score / max(1, best)) * 100.0
    if score >= max(1, best):
        verdict_fi = ("Olet tällä hetkellä viikon kärjessä — refleksit "
                      "kannattelevat sinua pisteessä, jossa useimmat horjuvat.")
        verdict_en = ("You're at the front of the week — reflex carries "
                      "you through the point where most players stumble.")
        hook_key = "psychology"  # focus on tilt-stability when you're top
    elif pct >= 60:
        verdict_fi = ("Reflektiivinen tarkkuus on kunnossa — viikon kärjelle "
                      "on yhden tarkkaavaisuusvirheen verran matkaa.")
        verdict_en = ("Reflex precision is solid — the gap to the weekly "
                      "leader is one micro-focus correction away.")
        hook_key = "psychology"
    else:
        verdict_fi = ("Ohjaus on tutustumisvaiheessa — pieni rytmin muutos "
                      "tuottaa yleensä isoimman pistemäärän hyppäyksen.")
        verdict_en = ("Your control is still finding its rhythm — a small "
                      "tempo correction usually produces the biggest jump.")
        hook_key = "bankroll"  # discipline / pacing
    hook = TOPIC_HOOKS.get(hook_key) or TOPIC_HOOKS["default"]
    percentile = _percentile(score, weekly_scores)
    return {
        "profile_index": "01 / 01",
        "stat_value": int(round(max(0.0, min(100.0, pct)))),
        "stat_label_fi": "Refleksi-indeksi",
        "stat_label_en": "Reflex index",
        "stat_footnote_fi": f"Korkeampi kuin {percentile}% pelaajista tällä viikolla.",
        "stat_footnote_en": f"Higher than {percentile}% of players this week.",
        "verdict_fi": verdict_fi,
        "verdict_en": verdict_en,
        "hook_text_fi": hook["fi"],
        "hook_text_en": hook["en"],
        "read_line_fi": (
            "Olet jo nähnyt yhden puolen pelistäsi. Toinen — pieni mutta "
            "ratkaiseva — odottaa vielä avaamista."
        ),
        "read_line_en": (
            "You've seen one side of your play. The other — small but "
            "decisive — is still waiting to be opened."
        ),
        "weak_topic_tag": hook_key,
    }


async def _fetch_weekly_scores(db, game_slug: str, week_iso: str) -> List[int]:
    """Return the list of finished play scores for the given game + week.
    Used for the "Higher than X%" copy and (arcade) percentile compute."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        cur = db.mini_game_plays.find(
            {"game_slug": game_slug, "week_iso": week_iso, "status": "finished"},
            {"_id": 0, "score": 1},
        ).limit(1000)
        rows = await cur.to_list(length=1000)
        return [int(r.get("score") or 0) for r in rows]
    except Exception:
        logger.warning("mini_game_card._fetch_weekly_scores failed for %s/%s — falling back to []", game_slug, week_iso, exc_info=True)
        return []
