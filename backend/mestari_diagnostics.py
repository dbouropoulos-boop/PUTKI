"""
PUTKI HQ — Mestari multi-diagnostic engine (poker + blackjack).

Mirrors the sports-betting diagnostic in spirit: 5 questions, 4 profiles,
deterministic resolver, 5-day playbook outline. Distinct from the sports
diagnostic backend (voita_predictor_profiles + voita_quiz_config) so we
can iterate copy + question wording without risking the live sports flow.

Endpoints exposed via server.py:
  POST /api/mestari/poker/resolve     · {answers:[{q,opt}]} → profile
  POST /api/mestari/blackjack/resolve · {answers:[{q,opt}]} → profile
  POST /api/mestari/diagnostic/lead   · {email, name?, diagnostic, profile_key, scores, lang}

Compliance: poker/blackjack reports are research/educational outputs
ONLY. They never tell the reader what to wager. The page disclaimer +
value block carry the legal posture; this module enforces by ONLY ever
returning profile descriptions + day-by-day playbook OUTLINES — no live
playbook body text is emailed until the user signs off on the copy
(`PLAYBOOK_EMAIL_DISPATCH_READY=0` keeps poker/blackjack out of the send
worker even when RESEND_API_KEY is set).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Killswitch — explicit user sign-off needed before any poker/blackjack
# placeholder content reaches a real inbox. Sports playbook is unaffected
# (gated separately via the existing RESEND_API_KEY check).
PLAYBOOK_EMAIL_DISPATCH_READY = os.environ.get(
    "PLAYBOOK_EMAIL_DISPATCH_READY", "0"
).strip() not in {"0", "false", "False", ""}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Question + profile model ──────────────────────────────────────────

POKER_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "p1_starting_hands",
        "axis": ["selectivity"],
        "fi": "Kuinka montaa lähtökättä pelaat?",
        "en": "How many starting hands do you play?",
        "options": [
            {"id": "anything", "fi": "Lähes mitä tahansa hauskannäköistä",
             "en": "Almost anything that looks fun",
             "axis_score": {"selectivity": -2}},
            {"id": "wide", "fi": "Laajaa kirjoa",
             "en": "A wide range",
             "axis_score": {"selectivity": -1}},
            {"id": "selective", "fi": "Valikoivasti",
             "en": "A selective range",
             "axis_score": {"selectivity": 1}},
            {"id": "tight", "fi": "Vain vahvoja käsiä",
             "en": "Very few, only strong hands",
             "axis_score": {"selectivity": 2}},
        ],
    },
    {
        "id": "p2_marginal_facing_bet",
        "axis": ["aggression", "selectivity"],
        "fi": "Sinulla on marginaalinen käsi ja joku panostaa sinulle. Yleensä...",
        "en": "You hold a marginal hand and someone bets into you. You usually…",
        "options": [
            {"id": "fold", "fi": "Luovutan",
             "en": "Fold",
             "axis_score": {"aggression": -1, "selectivity": 1}},
            {"id": "call", "fi": "Maksan nähdäkseni",
             "en": "Call to see what happens",
             "axis_score": {"aggression": 0, "selectivity": -1}},
            {"id": "raise", "fi": "Korotan ottaakseni hallinnan",
             "en": "Raise to take control",
             "axis_score": {"aggression": 2, "selectivity": 0}},
        ],
    },
    {
        "id": "p3_pot_action",
        "axis": ["aggression"],
        "fi": "Pottissa ollessasi mieluummin…",
        "en": "When you're in a pot, you'd rather…",
        "options": [
            {"id": "check", "fi": "Tarkistan ja katson mitä tapahtuu",
             "en": "Check and see what develops",
             "axis_score": {"aggression": -2}},
            {"id": "value_bet", "fi": "Panostan kun käteni on vahva",
             "en": "Bet when you have a strong hand",
             "axis_score": {"aggression": 1}},
            {"id": "pressure", "fi": "Panostan painostaakseni muita",
             "en": "Bet to put others under pressure",
             "axis_score": {"aggression": 2}},
        ],
    },
    {
        "id": "p4_position",
        "axis": ["selectivity"],
        "fi": "Muuttuuko käsivalintasi pöydällä asemasi mukaan?",
        "en": "Does your hand range change between early and late position?",
        "options": [
            {"id": "drives", "fi": "Merkittävästi — asema ohjaa päätöksiäni",
             "en": "Significantly — position drives my decisions",
             "axis_score": {"selectivity": 2}},
            {"id": "little", "fi": "Vähän",
             "en": "A little",
             "axis_score": {"selectivity": 0}},
            {"id": "never", "fi": "En oikeastaan mukaudu",
             "en": "I don't really adjust for position",
             "axis_score": {"selectivity": -2}},
        ],
    },
    {
        "id": "p5_bluffing",
        "axis": ["aggression"],
        "fi": "Bluffisi ovat…",
        "en": "Your bluffs are…",
        "options": [
            {"id": "rare", "fi": "Harvinaisia, pelaan suoraan",
             "en": "Rare, I play it straight",
             "axis_score": {"aggression": -1}},
            {"id": "spot", "fi": "Tilannekohtaisia, kun tarina toimii",
             "en": "Spot-picked, when the story makes sense",
             "axis_score": {"aggression": 1}},
            {"id": "frequent", "fi": "Toistuvia — paine voittaa pottia",
             "en": "Frequent — pressure wins pots",
             "axis_score": {"aggression": 2}},
        ],
    },
]


POKER_PROFILES: Dict[str, Dict[str, Any]] = {
    "rock": {
        "key": "rock",
        "name_fi": "Kallio (The Rock)",
        "name_en": "The Rock",
        "axes": {"selectivity": ">=2", "aggression": "<=0"},
        "tagline_fi": "Tiukka ja varovainen.",
        "tagline_en": "Tight and passive.",
        "desc_fi": "Luovutat selvästi useammin kuin pelaat ja painat harvoin. Sinua on vaikea pudottaa, mutta jätät paljon rahaa pöytään, kun et koskaan käytä etuasi.",
        "desc_en": "Folds far more than they play and rarely applies pressure. Predictable and hard to lose big with, but leaves money on the table by never pushing an edge.",
        "playbook_focus": [2, 4],
    },
    "calling_station": {
        "key": "calling_station",
        "name_fi": "Maksaja",
        "name_en": "The Calling Station",
        "axes": {"selectivity": "<=0", "aggression": "<=0"},
        "tagline_fi": "Liikaa käsiä, liian harvoin korotuksia.",
        "tagline_en": "Loose and passive.",
        "desc_fi": "Pelaat liian montaa kättä ja maksat liian usein, mutta korotat harvoin. Näet paljon floppeja — maksat usein muiden vahvat kädet.",
        "desc_en": "Plays too many hands and calls too often, but rarely raises. Sees a lot of flops; pays off other players' strong hands.",
        "playbook_focus": [1, 3],
    },
    "maniac": {
        "key": "maniac",
        "name_fi": "Maaniac",
        "name_en": "The Maniac",
        "axes": {"selectivity": "<=0", "aggression": ">=2"},
        "tagline_fi": "Kaikki kädet, koko ajan kovaa.",
        "tagline_en": "Loose and aggressive — chaos.",
        "desc_fi": "Pelaat melkein mitä tahansa ja panostat lujaa. Luot kaaosta ja painetta, mutta valikoinnin puute tarkoittaa isoja heilahduksia.",
        "desc_en": "Plays almost anything and bets it hard. Creates chaos and pressure, but the lack of selection makes for huge swings.",
        "playbook_focus": [1, 5],
    },
    "strategist": {
        "key": "strategist",
        "name_fi": "Strategi (TAG)",
        "name_en": "The Strategist",
        "axes": {"selectivity": ">=2", "aggression": ">=2"},
        "tagline_fi": "Valikoiva käsissä, päättäväinen panostuksissa.",
        "tagline_en": "Tight and aggressive — the TAG.",
        "desc_fi": "Valikoiva käsissä, päättäväinen panostuksissa. Profiili, jota vakiintunut pokeriteoria pitää parhaana — työ täällä on hiomista, ei korjaamista.",
        "desc_en": "Selective with hands, decisive with bets. The profile established poker theory rates highest; the work here is refinement, not repair.",
        "playbook_focus": [2, 4],
    },
}


POKER_PLAYBOOK_DAYS: List[Dict[str, str]] = [
    {"day": "1",
     "title_fi": "Käsivalinta",
     "title_en": "Hand selection",
     "summary_fi": "Mitä lähtökäsiä ja miksi valikointi on perusta.",
     "summary_en": "Which starting hands, and why selection is the foundation."},
    {"day": "2",
     "title_fi": "Asema",
     "title_en": "Position",
     "summary_fi": "Miksi viimeisenä toimiminen on aitoa rahaa ja miten käsivalikoimat siirtyvät paikan mukaan.",
     "summary_en": "Why acting last is worth real money and how ranges shift by seat."},
    {"day": "3",
     "title_fi": "Pottiodds ja odotusarvo",
     "title_en": "Pot odds & expected value",
     "summary_fi": "Maksamisen matematiikka — milloin maksu on perusteltu.",
     "summary_en": "The maths behind a call — how to know if one is justified."},
    {"day": "4",
     "title_fi": "Tarkoituksellinen panostus",
     "title_en": "Betting with purpose",
     "summary_fi": "Arvopanostukset vs. bluffi; merkityksellinen aggressio.",
     "summary_en": "Value bets vs bluffs; aggression that means something."},
    {"day": "5",
     "title_fi": "Bankroll ja tilttaus",
     "title_en": "Bankroll & tilt",
     "summary_fi": "Varianssi, miksi se on raaka lyhyellä aikavälillä, ja miksi kuri voittaa mielialan.",
     "summary_en": "Variance, why it's brutal short-term, and why discipline beats mood."},
]


BLACKJACK_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "b1_16_vs_10",
        "axis": ["knowledge"],
        "fi": "Sinulle jaetaan 16, ja jakajan kortti on 10. Sinä…",
        "en": "You're dealt 16 and the dealer shows a 10. You…",
        "options": [
            {"id": "stand", "fi": "Jään",
             "en": "Stand",
             "axis_score": {"knowledge": -1}},
            {"id": "hit", "fi": "Otan kortin",
             "en": "Hit",
             "axis_score": {"knowledge": 2}},
            {"id": "surrender", "fi": "Luovutan tai päätän laskennan mukaan",
             "en": "Surrender, or decide by the count",
             "axis_score": {"knowledge": 1}},
            {"id": "gut", "fi": "Menen fiiliksellä",
             "en": "Go with my gut",
             "axis_score": {"knowledge": -2}},
        ],
    },
    {
        "id": "b2_insurance",
        "axis": ["knowledge"],
        "fi": "Jakajan tarjotessa vakuutuksen sinä…",
        "en": "When the dealer offers insurance, you…",
        "options": [
            {"id": "usually", "fi": "Yleensä otan sen",
             "en": "Usually take it",
             "axis_score": {"knowledge": -2}},
            {"id": "sometimes", "fi": "Joskus",
             "en": "Sometimes take it",
             "axis_score": {"knowledge": -1}},
            {"id": "never", "fi": "En koskaan",
             "en": "Never take it",
             "axis_score": {"knowledge": 2}},
        ],
    },
    {
        "id": "b3_bet_size",
        "axis": ["discipline"],
        "fi": "Miten päätät panoksen koon?",
        "en": "How do you decide your bet size?",
        "options": [
            {"id": "flat", "fi": "Sama jokaisella kierroksella",
             "en": "The same each hand",
             "axis_score": {"discipline": 2}},
            {"id": "feel", "fi": "Pelisession fiiliksen mukaan",
             "en": "By the feel of the session",
             "axis_score": {"discipline": -1}},
            {"id": "chase_loss", "fi": "Suurempi tappion jälkeen",
             "en": "Bigger after a loss, to recover",
             "axis_score": {"discipline": -2}},
            {"id": "ride_win", "fi": "Suurempi voiton jälkeen",
             "en": "Bigger after a win, to ride it",
             "axis_score": {"discipline": -1}},
        ],
    },
    {
        "id": "b4_basic_strategy",
        "axis": ["knowledge"],
        "fi": "“Perusstrategia” on…",
        "en": "\"Basic strategy\" is…",
        "options": [
            {"id": "chart", "fi": "Taulukko jonka tunnen ja jota noudatan",
             "en": "A chart I know and follow",
             "axis_score": {"knowledge": 2}},
            {"id": "roughly", "fi": "Jotain jonka tunnen suurin piirtein",
             "en": "Something I know roughly",
             "axis_score": {"knowledge": 1}},
            {"id": "heard", "fi": "Termi jonka olen kuullut",
             "en": "A term I've heard",
             "axis_score": {"knowledge": -1}},
            {"id": "new", "fi": "Uusi minulle",
             "en": "New to me",
             "axis_score": {"knowledge": -2}},
        ],
    },
    {
        "id": "b5_losing_streak",
        "axis": ["discipline"],
        "fi": "Häviöputken keskellä sinä…",
        "en": "You're on a losing streak. You…",
        "options": [
            {"id": "plan", "fi": "Pysyn suunnitelmassa",
             "en": "Stick to the plan",
             "axis_score": {"discipline": 2}},
            {"id": "careful", "fi": "Pelaan varovaisemmin",
             "en": "Play more carefully",
             "axis_score": {"discipline": 1}},
            {"id": "chase", "fi": "Nostan panosta tasoittaakseni",
             "en": "Bet up to win it back",
             "axis_score": {"discipline": -2}},
            {"id": "break", "fi": "Pidän tauon",
             "en": "Take a break",
             "axis_score": {"discipline": 1}},
        ],
    },
]


BLACKJACK_PROFILES: Dict[str, Dict[str, Any]] = {
    "hunch": {
        "key": "hunch",
        "name_fi": "Fiilispelaaja",
        "name_en": "The Hunch Player",
        "axes": {"knowledge": "<=0", "discipline": "<=0"},
        "tagline_fi": "Pelaa tunnetta, ilman järjestelmää.",
        "tagline_en": "Plays by feel — no fixed system.",
        "desc_fi": "Pelaat tuntemuksen ja taikauskon mukaan ilman kiinteää järjestelmää. Suurin kuilu on myös helpoiten korjattavissa: tieto, jota ei vielä ole opittu.",
        "desc_en": "Plays by feel and superstition, with no fixed system. The biggest gap is the most fixable: it's information not yet learned.",
        "playbook_focus": [1, 2],
    },
    "folk_rule": {
        "key": "folk_rule",
        "name_fi": "Kansansääntöpelaaja",
        "name_en": "The Folk-Rule Player",
        "axes": {"knowledge": "<=0", "discipline": ">=1"},
        "tagline_fi": "Tiukka systeemi — mutta osa säännöistä on myyttejä.",
        "tagline_en": "Disciplined, but the rules are folk myths.",
        "desc_fi": "Sinulla on omia sääntöjä — kuten “matki jakajaa” tai “älä koskaan bustaa” — ja noudatat niitä. Kuri on hyvä, mutta useat säännöt ovat myyttejä jotka maksavat.",
        "desc_en": "Has firm informal rules — mimic the dealer, \"never bust\" — and sticks to them. Disciplined, but several of the rules are myths that cost money.",
        "playbook_focus": [2, 4],
    },
    "book": {
        "key": "book",
        "name_fi": "Kirjapelaaja",
        "name_en": "The Book Player",
        "axes": {"knowledge": ">=2", "discipline": "<=1"},
        "tagline_fi": "Tuntee perusstrategian — toteutus jää välillä.",
        "tagline_en": "Knows the chart — applies it most of the time.",
        "desc_fi": "Tunnet perusstrategian ja noudatat sitä pääosin. Työ on johdonmukaisuudessa — soveltaa oikeaa taulukkoa jokaisella kädellä, mukaan lukien pehmeät kädet ja jaot, jotka helposti unohtuvat.",
        "desc_en": "Knows basic strategy and mostly follows it. The work is consistency — applying the correct chart every hand, including the soft hands and splits people skip.",
        "playbook_focus": [3, 2],
    },
    "disciplined": {
        "key": "disciplined",
        "name_fi": "Kuripelaaja",
        "name_en": "The Disciplined Player",
        "axes": {"knowledge": ">=2", "discipline": ">=2"},
        "tagline_fi": "Oikea perusstrategia + bankroll-kontrolli.",
        "tagline_en": "Correct strategy + bankroll control.",
        "desc_fi": "Pelaat oikeaa perusstrategiaa todellisella bankroll-hallinnalla ja ymmärrät missä pelin etu oikeasti sijaitsee. Vain hiomista.",
        "desc_en": "Plays correct basic strategy with real bankroll control, and understands where the game's edge actually sits. Refinement only.",
        "playbook_focus": [5, 3],
    },
}


BLACKJACK_PLAYBOOK_DAYS: List[Dict[str, str]] = [
    {"day": "1",
     "title_fi": "Miten blackjack on oikeasti rakennettu",
     "title_en": "How blackjack is actually built",
     "summary_fi": "Mistä talon etu tulee, ja mitä se oikeasti on.",
     "summary_en": "Where the house edge comes from, and what it really is."},
    {"day": "2",
     "title_fi": "Perusstrategia: ratkaistu taulukko",
     "title_en": "Basic strategy: the solved chart",
     "summary_fi": "Kovat kädet — julkaistu oikea pelitapa.",
     "summary_en": "Hard hands — the published correct play."},
    {"day": "3",
     "title_fi": "Osat jotka usein ohitetaan",
     "title_en": "The parts people skip",
     "summary_fi": "Pehmeät kädet ja parien jako.",
     "summary_en": "Soft hands and pair splitting."},
    {"day": "4",
     "title_fi": "Myytit",
     "title_en": "The myths",
     "summary_fi": "Vakuutus, “matki jakajaa”, “erääntyvät” kortit — mikä on epätotta ja miksi.",
     "summary_en": "Insurance, mimic-the-dealer, \"due\" cards — what's false and why."},
    {"day": "5",
     "title_fi": "Rehellinen katto",
     "title_en": "The honest ceiling",
     "summary_fi": "Bankroll, varianssi ja totuus korttilaskennasta — että se on aito etu ja aitoa työtä.",
     "summary_en": "Bankroll, variance, and the truth about card counting — that it's a real edge, and real work."},
]


# Section 7.3 value-block copy — locked verbatim per user sign-off.
VALUE_BLOCK_COPY: Dict[str, Dict[str, str]] = {
    "sports": {
        "kicker_fi": "MITÄ TÄMÄ RAPORTTI ANTAA",
        "kicker_en": "WHAT THIS REPORT GIVES YOU",
        "body_fi": "Lukeman siitä, miten oikeasti lähestyt ottelua — vastauksistasi, ei siitä miten kuvailisit itseäsi. Se on deterministinen: samat vastaukset tuottavat aina saman profiilin, ilman toimituksen peukaloa vaa'assa. Saat rehellisen kuvauksen siitä, missä lähestymistapasi on terävä ja missä se maksaa, sekä 5 päivän pelikirjan siitä, miten vedonlyöntimarkkinat aidosti käyttäytyvät. Ei vinkkejä, ei valintoja — selkeämpi näkymä omaan ajatteluusi, jota useimmat lukijat eivät koskaan saa.",
        "body_en": "A read on how you actually approach a match — drawn from your answers, not from how you'd describe yourself. It's deterministic: the same answers always produce the same profile, with no editorial thumb on the scale. You get an honest account of where your approach is sharp and where it costs you, and a 5-day playbook on how betting markets genuinely behave. No tips, no picks — a clearer view of your own thinking, which is the thing most readers never get.",
    },
    "poker": {
        "kicker_fi": "MITÄ TÄMÄ RAPORTTI ANTAA",
        "kicker_en": "WHAT THIS REPORT GIVES YOU",
        "body_fi": "Rehellisen sijoituksen pokeritietyylin vakiintuneeseen malliin — sen mukaan miten pelaat, ei miten haluaisit pelata. Se on deterministinen: samat vastaukset, sama profiili, ei höyhensaarta. Saat suoran kuvauksen siitä, mitä tyylisi voittaa ja mitä se jättää pöytään, sekä 5 päivän pelikirjan siitä, miten taitava pokeri on rakennettu. Arvo ei ole oikotie — se on oman pelisi näkeminen niin selkeästi että sitä voi kehittää.",
        "body_en": "An honest placement on the established model of poker style — based on how you play, not how you'd like to. It's deterministic: same answers, same profile, no spin. You get a straight account of what your style wins you and what it leaves on the table, and a 5-day playbook on how skilled poker is structured. The value isn't a shortcut — it's seeing your own game clearly enough to work on it.",
    },
    "blackjack": {
        "kicker_fi": "MITÄ TÄMÄ RAPORTTI ANTAA",
        "kicker_en": "WHAT THIS REPORT GIVES YOU",
        "body_fi": "Selkeän lukeman siitä, miten pelisi vertautuu blackjackin tunnettuun matematiikkaan — mitä teet oikein ja mikä maksaa hiljaa. Se on deterministinen: samat vastaukset, sama profiili, ei toimituksen vaikutusta. Saat rehellisen osuuden, jonka useimpi blackjack-sisältö ohittaa — missä talon etu oikeasti sijaitsee ja mitä se tarkoittaa — sekä 5 päivän pelikirjan siitä, miten peli oikeasti toimii. Arvo on totuus pelistä, jota useimmat pelaajat ymmärtävät väärin.",
        "body_en": "A clear read of how your play measures against the known mathematics of blackjack — what you have right, and what quietly costs you. It's deterministic: same answers, same profile, no editorial spin. You get the honest part most blackjack content skips — where the house edge actually sits and what it means — and a 5-day playbook on how the game really works. The value is the truth about a game most players misunderstand.",
    },
}


def _eval(value: int, expr: str) -> bool:
    """Eval the comparators used by the profile axes ('>=2', '<=0', '==0').
    Restricted to <= / >= / == on integers so it cannot run arbitrary code."""
    expr = (expr or "").strip()
    for op in (">=", "<=", "==", ">", "<"):
        if expr.startswith(op):
            try:
                threshold = int(expr[len(op):].strip())
            except ValueError:
                return False
            return {
                ">=": value >= threshold, "<=": value <= threshold,
                "==": value == threshold, ">": value > threshold,
                "<": value < threshold,
            }[op]
    return False


def _score_axes(diagnostic: str, answers: List[Dict[str, str]]) -> Dict[str, int]:
    questions = POKER_QUESTIONS if diagnostic == "poker" else BLACKJACK_QUESTIONS
    by_id = {q["id"]: q for q in questions}
    totals: Dict[str, int] = {}
    for a in answers or []:
        q = by_id.get((a or {}).get("q"))
        if not q:
            continue
        opt = next((o for o in q["options"] if o["id"] == a.get("opt")), None)
        if not opt:
            continue
        for axis, delta in (opt.get("axis_score") or {}).items():
            totals[axis] = totals.get(axis, 0) + int(delta)
    return totals


def _resolve_profile(diagnostic: str, scores: Dict[str, int]) -> Dict[str, Any]:
    profiles = POKER_PROFILES if diagnostic == "poker" else BLACKJACK_PROFILES
    # Score each profile by how many of its axis constraints are satisfied;
    # in a tie we prefer the most specific (highest min-abs threshold) so
    # the "strategist" / "disciplined" archetypes win clean cases over the
    # softer middle types.
    best: Optional[Dict[str, Any]] = None
    best_score = -1
    best_spec = -1
    for prof in profiles.values():
        axes_ok = sum(1 for axis, expr in prof["axes"].items()
                      if _eval(scores.get(axis, 0), expr))
        spec = sum(abs(int(expr[2:])) if expr[:2] in (">=", "<=") else 0
                   for expr in prof["axes"].values())
        if axes_ok > best_score or (axes_ok == best_score and spec > best_spec):
            best = prof
            best_score = axes_ok
            best_spec = spec
    # Fall back to a sensible default profile by diagnostic when nothing
    # matches (e.g. all answers landed at axis zero).
    if not best:
        return profiles["calling_station" if diagnostic == "poker" else "folk_rule"]
    return best


def resolve_poker(answers: List[Dict[str, str]]) -> Dict[str, Any]:
    scores = _score_axes("poker", answers)
    profile = _resolve_profile("poker", scores)
    return {
        "diagnostic": "poker",
        "scores": scores,
        "profile": profile,
        "playbook": POKER_PLAYBOOK_DAYS,
        "value_block": VALUE_BLOCK_COPY["poker"],
    }


def resolve_blackjack(answers: List[Dict[str, str]]) -> Dict[str, Any]:
    scores = _score_axes("blackjack", answers)
    profile = _resolve_profile("blackjack", scores)
    return {
        "diagnostic": "blackjack",
        "scores": scores,
        "profile": profile,
        "playbook": BLACKJACK_PLAYBOOK_DAYS,
        "value_block": VALUE_BLOCK_COPY["blackjack"],
    }


def get_diagnostic_meta(diagnostic: str) -> Optional[Dict[str, Any]]:
    """Public meta for the questions + profiles (so the frontend can
    render the quiz without duplicating the constants). Returns None for
    unknown diagnostics so the API can 404 cleanly."""
    if diagnostic == "poker":
        return {
            "diagnostic": "poker",
            "questions": POKER_QUESTIONS,
            "profiles": list(POKER_PROFILES.values()),
            "playbook": POKER_PLAYBOOK_DAYS,
            "value_block": VALUE_BLOCK_COPY["poker"],
        }
    if diagnostic == "blackjack":
        return {
            "diagnostic": "blackjack",
            "questions": BLACKJACK_QUESTIONS,
            "profiles": list(BLACKJACK_PROFILES.values()),
            "playbook": BLACKJACK_PLAYBOOK_DAYS,
            "value_block": VALUE_BLOCK_COPY["blackjack"],
        }
    if diagnostic == "sports":
        # Sports diagnostic content lives in voita_quiz_config + voita_profiles;
        # surface the value block only so the report renderer is uniform.
        return {
            "diagnostic": "sports",
            "value_block": VALUE_BLOCK_COPY["sports"],
        }
    return None


# ── Editable landing-copy overrides ──────────────────────────────────
# Hub + poker/blackjack landing pages were originally hardcoded in the
# JSX. The back-office "Mestari diagnostics copy" editor now feeds this
# singleton, which the public meta endpoints surface to the frontend.
_DEFAULT_LANDING_COPY: Dict[str, Dict[str, Any]] = {
    "hub": {
        "eyebrow_fi": "MESTARI · TOIMITUKSELLISIA DIAGNOSTIIKKOJA · TUTKIMUSTYÖKALUJA",
        "eyebrow_en": "MESTARI · EDITORIAL DIAGNOSTICS · RESEARCH TOOLS",
        "headline_fi": "Mikä diagnostiikka?",
        "headline_en": "Which diagnostic?",
        "subtitle_fi": "Mestari rakentaa tutkimukseen perustuvia työkaluja siihen, miten pelaajat ajattelevat. Valitse diagnostiikka — jokainen kestää noin 90 sekuntia ja päättyy henkilökohtaiseen profiiliin ja 5 päivän pelikirjaan.",
        "subtitle_en": "Mestari builds research-grounded tools for understanding how players think. Pick a diagnostic — each takes about 90 seconds and ends with a personal profile and a 5-day playbook.",
        "trust_line_fi": "Tutkimus- ja opetustyökaluja. Ei rahapelineuvontaa. Vain opetuskäyttöön.",
        "trust_line_en": "Research and educational tools. Not gambling advice. For educational use only.",
        "method_label_fi": "MENETELMÄ · MITEN MESTARI ANALYSOI",
        "method_label_en": "METHOD · HOW MESTARI ANALYSES",
        "method_body_fi": "Jokainen diagnostiikka soveltaa oman alansa vakiintunutta mallia — julkaistua tutkimusta vedonlyöntimarkkinoista, pokerityylin kaksiakselista mallia, blackjackin matematiikkaa — vastauksiisi. Deterministinen pisteytys: samat vastaukset, sama profiili, ei toimituksen vaikutusta.",
        "method_body_en": "Each diagnostic applies an established framework from its domain — published research on betting markets, the two-axis model of poker style, the mathematics of blackjack — to your answers. Deterministic scoring: same answers, same profile, no editorial spin.",
        "card_sports_kicker_fi": "URHEILUVEDONLYÖNTI", "card_sports_kicker_en": "SPORTS BETTING",
        "card_sports_title_fi": "Millainen urheiluvedonlyöjä sinä olet?",
        "card_sports_title_en": "What kind of sports bettor are you?",
        "card_sports_oneliner_fi": "Miten luet ottelua ja markkinaa.",
        "card_sports_oneliner_en": "How you read a match and the market.",
        "card_poker_kicker_fi": "POKERI", "card_poker_kicker_en": "POKER",
        "card_poker_title_fi": "Millainen pokeripelaaja sinä olet?",
        "card_poker_title_en": "What kind of poker player are you?",
        "card_poker_oneliner_fi": "Miten luet pöytää ja pelaajia.",
        "card_poker_oneliner_en": "How you read a table and the players.",
        "card_blackjack_kicker_fi": "BLACKJACK", "card_blackjack_kicker_en": "BLACKJACK",
        "card_blackjack_title_fi": "Millainen blackjack-pelaaja sinä olet?",
        "card_blackjack_title_en": "What kind of blackjack player are you?",
        "card_blackjack_oneliner_fi": "Miten luet peliä ja sen todennäköisyyksiä.",
        "card_blackjack_oneliner_en": "How you read the game and its odds.",
    },
    "poker": {
        "hero_kicker_fi": "Mestari · Toimituksellinen diagnostiikka · Tutkimustyökalu",
        "hero_kicker_en": "Mestari · Editorial diagnostic · Research tool",
        "headline_fi": "Millainen pokeripelaaja sinä olet?",
        "headline_en": "What kind of poker player are you?",
        "sub_fi": "90 sekunnin diagnostiikka, joka perustuu vakiintuneeseen pokeriteoriaan. Vastaa viiteen kysymykseen siitä, miten pelaat pöydässä — saat henkilökohtaisen pelaajaprofiilin ja 5 päivän pelikirjan siitä, miten taitava pokeri on rakennettu.",
        "sub_en": "A 90-second diagnostic grounded in established poker theory. Answer five questions about how you play a table — receive a personal player profile and a 5-day playbook on how skilled poker is structured.",
        "disclaimer_strong_fi": "Tämä on tutkimus- ja opetustyökalu.",
        "disclaimer_strong_en": "This is a research and educational tool.",
        "disclaimer_rest_fi": " Mestari tutkii, miten pelaajat lähestyvät pokeria ja miten taitava pelaaminen on rakennettu. Se ei ole rahapelineuvontaa, se ei mainosta rahapelaamista, eikä se koskaan kerro mitä lyödä vetoa. Vain opetuskäyttöön.",
        "disclaimer_rest_en": " Mestari studies how players approach poker and how skilled play is structured. It is not gambling advice, it does not promote gambling, and it will never tell you what to wager. For educational use only.",
        "hero_stat_num": "2",
        "hero_stat_unit_fi": " akselia", "hero_stat_unit_en": " axes",
        "hero_stat_desc_fi": "TYYLI KARTOITETTU VALIKOIVUUDEN JA AGGRESSION MUKAAN — VAKIINTUNUT POKERIN MALLI.",
        "hero_stat_desc_en": "STYLE MAPPED ON SELECTIVITY AND AGGRESSION — THE ESTABLISHED MODEL OF POKER PLAY.",
        "method_label_fi": "MENETELMÄ · MITEN MESTARI ANALYSOI",
        "method_label_en": "METHOD · HOW MESTARI ANALYSES",
        "method_body_fi": "Mestari soveltaa vakiintunutta kaksiakselista pokerityylin mallia — kuinka valikoivasti pelaaja käyttää käsiä ja kuinka aggressiivisesti hän panostaa — sijoittaakseen jokaisen pelaajan tunnistettuun profiiliin.",
        "method_body_en": "Mestari applies the established two-axis model of poker style — how selective a player is with hands, and how aggressive they are with bets — to place each player on a recognised profile.",
    },
    "blackjack": {
        "hero_kicker_fi": "Mestari · Toimituksellinen diagnostiikka · Tutkimustyökalu",
        "hero_kicker_en": "Mestari · Editorial diagnostic · Research tool",
        "headline_fi": "Millainen blackjack-pelaaja sinä olet?",
        "headline_en": "What kind of blackjack player are you?",
        "sub_fi": "90 sekunnin diagnostiikka, joka perustuu pelin matematiikkaan. Vastaa viiteen kysymykseen siitä, miten pelaat käden — saat henkilökohtaisen pelaajaprofiilin ja 5 päivän pelikirjan siitä, miten blackjack todella toimii.",
        "sub_en": "A 90-second diagnostic grounded in the mathematics of the game. Answer five questions about how you play a hand — receive a personal player profile and a 5-day playbook on how blackjack actually works.",
        "disclaimer_strong_fi": "Tämä on tutkimus- ja opetustyökalu.",
        "disclaimer_strong_en": "This is a research and educational tool.",
        "disclaimer_rest_fi": " Mestari tutkii, miten pelaajat lähestyvät blackjackia ja miten pelin matematiikka oikeasti toimii. Se ei ole rahapelineuvontaa, se ei mainosta rahapelaamista, eikä se koskaan kerro mitä lyödä vetoa. Vain opetuskäyttöön.",
        "disclaimer_rest_en": " Mestari studies how players approach blackjack and how the game's mathematics actually work. It is not gambling advice, it does not promote gambling, and it will never tell you what to wager. For educational use only.",
        "hero_stat_num": "",
        "hero_stat_unit_fi": "Ratkaistu", "hero_stat_unit_en": "Solved",
        "hero_stat_desc_fi": "BLACKJACKIN PERUSSTRATEGIA ON JULKAISTU, MATEMAATTISESTI RATKAISTU TULOS — EI MIELIPIDE.",
        "hero_stat_desc_en": "BLACKJACK BASIC STRATEGY IS A PUBLISHED, MATHEMATICALLY SOLVED RESULT — NOT OPINION.",
        "method_label_fi": "MENETELMÄ · MITEN MESTARI ANALYSOI",
        "method_label_en": "METHOD · HOW MESTARI ANALYSES",
        "method_body_fi": "Mestari mittaa pelaajaa blackjackin tunnetun matematiikan — jokaisen käden julkaistun oikean pelitavan — mukaan, sijoittaakseen hänet tunnistettuun pelitiedon ja kurin profiiliin.",
        "method_body_en": "Mestari measures a player against the known mathematics of blackjack — the published correct play for every hand — to place them on a recognised profile of game knowledge and discipline.",
    },
}


async def get_landing_copy(db) -> Dict[str, Dict[str, Any]]:
    """Merge persisted overrides on top of defaults — every field
    guaranteed present."""
    doc = await db.settings.find_one({"_id": "mestari_diagnostic_copy"}, {"_id": 0, "value": 1})
    overrides = (doc or {}).get("value") or {}
    out: Dict[str, Dict[str, Any]] = {}
    for k, defaults in _DEFAULT_LANDING_COPY.items():
        out[k] = {**defaults, **(overrides.get(k) or {})}
    return out


async def save_landing_copy(db, payload: Dict[str, Any]) -> None:
    """Validate then persist. Only known sections + keys accepted."""
    allowed: Dict[str, set] = {k: set(v.keys()) for k, v in _DEFAULT_LANDING_COPY.items()}
    safe: Dict[str, Dict[str, Any]] = {}
    for section, body in (payload or {}).items():
        if section not in allowed or not isinstance(body, dict):
            continue
        safe[section] = {
            k: (body.get(k) or "")[:2000]
            for k in allowed[section]
            if isinstance(body.get(k), str)
        }
    await db.settings.update_one(
        {"_id": "mestari_diagnostic_copy"},
        {"$set": {"value": safe, "updated_at": _now_iso()}},
        upsert=True,
    )



# ── Lead capture ─────────────────────────────────────────────────────

async def capture_diagnostic_lead(
    db, *, email: str, name: Optional[str], diagnostic: str,
    profile_key: Optional[str], scores: Optional[Dict[str, int]],
    lang: str = "fi",
) -> Dict[str, Any]:
    """Persist the lead with the diagnostic source attached. Idempotent
    on (email, diagnostic) so a second submit from the same client just
    refreshes the timestamp."""
    if not email or "@" not in email:
        return {"ok": False, "error": "invalid_email"}
    if diagnostic not in {"sports", "poker", "blackjack"}:
        return {"ok": False, "error": "invalid_diagnostic"}

    consent_tag = f"mestari_{diagnostic}_lead"
    surface = f"mestari_{diagnostic}_landing"
    now = _now_iso()
    doc = {
        "email": email.lower().strip()[:120],
        "name": (name or "").strip()[:80] or None,
        "diagnostic": diagnostic,
        "profile_key": profile_key,
        "scores": scores or {},
        "lang": lang if lang in ("fi", "en") else "fi",
        "surface": surface,
        "consent_tag": consent_tag,
        "captured_at": now,
        "playbook_dispatch_ready": PLAYBOOK_EMAIL_DISPATCH_READY or diagnostic == "sports",
    }
    # Upsert idempotently — same email re-taking the same diagnostic
    # refreshes the profile but doesn't blow up history.
    await db.optin_consents.update_one(
        {"email": doc["email"], "consent_tag": consent_tag},
        {"$set": doc, "$setOnInsert": {"first_seen_at": now}},
        upsert=True,
    )
    # Mirror to the standalone collection used by the back-office
    # diagnostic dashboard (separate from the existing voita leads).
    await db.mestari_diagnostic_leads.update_one(
        {"email": doc["email"], "diagnostic": diagnostic},
        {"$set": doc, "$setOnInsert": {"first_seen_at": now}},
        upsert=True,
    )
    return {
        "ok": True,
        "email": doc["email"],
        "diagnostic": diagnostic,
        "playbook_dispatch_ready": doc["playbook_dispatch_ready"],
    }
