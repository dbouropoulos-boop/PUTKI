"""
PUTKI HQ — Mini-Game Suite Phase 2 content (iter56)

Seeds + scoring for the 2 educational games added in Phase 2:

  • Scenario (branching decisions) — `scenario_decisions`
      The player walks through 5 real-world gambling situations and picks
      one of 3 actions per turn. Every option carries a small "judgement
      score" (0–3) representing how well it reflects responsible play +
      sound bankroll thinking. After 5 turns we sum the scores and
      assign a player TYPE ("Kärsivällinen taktikko" etc).

  • Insight Reveal (scratch-card facts) — `insight_reveal`
      A 6-tile board where each click reveals one short fact / micro-
      lesson about gambling literacy. The player chooses to reveal up
      to N tiles (default 4). Score = number of tiles revealed; the
      payoff is the LEARNED facts, the leaderboard is for completion.

Pattern matches Phase 1's quiz: anon play → preview result → email gate
unlocks the full personalised analysis + tournament ranking.

All content is editable later via the admin panel (Phase 3). On first
boot, this seed is inserted idempotently into the same `mini_game_questions`
collection (with `slug` distinguishing per-game content).
"""
from __future__ import annotations

from typing import Any, Dict, List


SCENARIO_GAME_SLUG = "scenario_decisions"
INSIGHT_GAME_SLUG = "insight_reveal"


# ─────────────────────── Scenario content ────────────────────────────
# Each "question" is a scenario. Options carry a `score` (0..3) used to
# compute the player's judgement total. `correct` is set to the
# highest-scoring option for backwards compatibility with the quiz
# pipeline (so a generic "correct/wrong" view still works), but the
# REAL scoring uses the per-option score field.

SCENARIO_SEED_FI: List[Dict[str, Any]] = [
    {
        "order": 1,
        "prompt_fi": (
            "Olet pelannut yhden illan ja tehnyt 120 € voiton. "
            "Kaverit ehdottavat, että jatkat ja \"tuplaat\" sen vielä. "
            "Mitä teet?"
        ),
        "options": [
            {"key": "a", "label_fi": "Jatkan — flow on hyvä", "score": 0,
             "explanation_fi": "Klassinen \"hot hand\" -ansa. Voitto on tunneista — ei taidosta. Lopettaminen on tilastollisesti paras hetki."},
            {"key": "b", "label_fi": "Nostan voitot, pelaan loput alkuperäisestä budjetista", "score": 3,
             "explanation_fi": "Hyvä päätös. Erottelemalla \"oman rahan\" ja \"voiton\" suojaat itsesi tilanteelta, jossa palaat alkuasetelmaan tai miinukselle."},
            {"key": "c", "label_fi": "Lopetan kokonaan, suljen sovelluksen", "score": 3,
             "explanation_fi": "Erinomainen. Voiton kanssa lopettaminen on yksi vaikeimmista mutta tärkeimmistä taidoista."},
        ],
        "correct": "c",
        "topic_tag": "psychology",
    },
    {
        "order": 2,
        "prompt_fi": (
            "Olet hävinnyt kuukauden budjetistasi 80%. Saat ilmoituksen "
            "uudesta 50% talletusbonuksesta. Mitä teet?"
        ),
        "options": [
            {"key": "a", "label_fi": "Talletan ja yritän voittaa takaisin", "score": 0,
             "explanation_fi": "Häviöiden jahtaaminen (chasing) on YLEISIN syy pieniin alkutappioihin muuttua suuriksi. Bonus tekee siitä houkuttelevampaa, mutta riski on sama."},
            {"key": "b", "label_fi": "Pidän tauon — odotan ensi kuuta", "score": 3,
             "explanation_fi": "Vahva päätös. Bonus on aina paikalla. Tauko irrottaa tunnesidoksesta ja antaa rationaalisen näkökulman."},
            {"key": "c", "label_fi": "Talletan vain pienen summan testatakseni", "score": 1,
             "explanation_fi": "Parempi kuin a, mutta silti epäilyttävä. Kun budjetti on rikki, jokainen talletus syventää ongelmaa."},
        ],
        "correct": "b",
        "topic_tag": "responsibility",
    },
    {
        "order": 3,
        "prompt_fi": (
            "Striimaaja saa 50 000 € voiton. Hän kannustaa katsojia "
            "kokeilemaan samaa peliä \"klikkaa tästä\"-affiliate-linkillä. "
            "Mitä ajattelet?"
        ),
        "options": [
            {"key": "a", "label_fi": "Jos hänellä onnistui, minäkin voin onnistua", "score": 0,
             "explanation_fi": "Survivor bias. Näet vain voittajat — et tuhansia samanlaisia katsojia jotka hävisivät. Striimaajan voitto ei kerro mitään ODOTUSARVOSTA."},
            {"key": "b", "label_fi": "Striimaaja saa provision tappioistani — etu on hänellä", "score": 3,
             "explanation_fi": "Tarkalleen. Affiliate-malli palkitsee striimaajan tappioistasi. Etu on heillä — sinä olet tuote."},
            {"key": "c", "label_fi": "Tarkistan, onko striimaaja vastuullinen / pelaa omilla rahoillaan", "score": 2,
             "explanation_fi": "Hyvä kysymys, mutta vaikea varmistaa. Vaikka striimaaja olisi rehellinen, affiliate-järjestelmä silti vääristää viestiä."},
        ],
        "correct": "b",
        "topic_tag": "psychology",
    },
    {
        "order": 4,
        "prompt_fi": (
            "Olet pelannut tasaisesti 6 kk. Tilillä on 500 € voittoja. "
            "Tunne sanoo: \"Yksi iso panos ja jään 1000 € voitolle.\" "
            "Mitä teet?"
        ),
        "options": [
            {"key": "a", "label_fi": "Laitan 100 € korkean varianssin slottiin", "score": 0,
             "explanation_fi": "Riski-palkkio-suhde on pielessä — yhden spinin odotusarvo on negatiivinen. 6 kk:n työ voi mennä yhdessä minuutissa."},
            {"key": "b", "label_fi": "Nostan 250 € pois, jatkan loput entiseen tahtiin", "score": 3,
             "explanation_fi": "Loistava. Realisoit osan voitosta — psykologisesti tämä \"lukitsee\" sen. Loput voivat jatkaa rakenteellisesti."},
            {"key": "c", "label_fi": "Pysähdyn, en tee mitään tunnin sisällä", "score": 2,
             "explanation_fi": "Erittäin järkevää. Tunteenpurkaus laantuu — rationaalinen päätös on yleensä parempi 30 min jälkeen."},
        ],
        "correct": "b",
        "topic_tag": "bankroll",
    },
    {
        "order": 5,
        "prompt_fi": (
            "Ystäväsi sanoo: \"Pelaan vain milloin tuntuu siltä — "
            "kokonaisbudjettia minulla ei ole.\" Mitä neuvot?"
        ),
        "options": [
            {"key": "a", "label_fi": "Toimii hyvin niin kauan kuin huvittaa", "score": 0,
             "explanation_fi": "Tämä on harhaluulo. Ilman ennalta asetettua budjettia päätökset tehdään aina kuumassa tilanteessa — tappiossa raja katoaa."},
            {"key": "b", "label_fi": "Aseta kuukausibudjetti ETUKÄTEEN ja talletusraja operaattorille", "score": 3,
             "explanation_fi": "Oikea vastaus. Budjetti ennalta + operaattorin pakollinen talletusraja = käytännön puskuri silloin kun tahdonvoima pettää."},
            {"key": "c", "label_fi": "Käytä vain käteistä, älä pankkikorttia", "score": 1,
             "explanation_fi": "Vanha hyvä neuvo fyysisille kasinoille, mutta nykyajan online-pelissä se ei suoraan auta. Talletusraja on tehokkaampi."},
        ],
        "correct": "b",
        "topic_tag": "responsibility",
    },
]


# Persona thresholds based on TOTAL judgement score (max 15 = 5 × 3)
SCENARIO_PERSONAS = {
    "patient_tactician": {
        "min": 12,
        "title": "Kärsivällinen taktikko",
        "tagline": "Tunnistat tunnesäätelyn ja pidät pään kylmänä paineessa.",
    },
    "growing_judge": {
        "min": 7,
        "title": "Kasvava arvioija",
        "tagline": "Sinulla on hyvät perusteet — vahvista bankroll-ajattelua.",
    },
    "fresh_player": {
        "min": 0,
        "title": "Tuore pelaaja",
        "tagline": "Suosittelemme käymään läpi vastuullisuuden perusteet ennen rahapelipäätöksiä.",
    },
}


def persona_for_scenario(total_score: int) -> Dict[str, Any]:
    for key in ["patient_tactician", "growing_judge", "fresh_player"]:
        p = SCENARIO_PERSONAS[key]
        if total_score >= p["min"]:
            return {"key": key, "title": p["title"], "tagline": p["tagline"]}
    return {"key": "fresh_player", **SCENARIO_PERSONAS["fresh_player"]}


# ─────────────────────── Insight Reveal content ──────────────────────
# Each "question" here is a single revealable insight tile. The player
# clicks tiles to reveal facts (no wrong answers). Score = number of
# tiles revealed before the player chooses to finish (max 6).
# The educational payoff is the LEARNED facts themselves.

INSIGHT_SEED_FI: List[Dict[str, Any]] = [
    {
        "order": 1,
        "prompt_fi": "RTP ≠ TAKUU",
        "options": [],
        "correct": "a",
        "explanation_fi": (
            "96% RTP ei tarkoita, että saat 96 € jokaisesta 100 €:sta. Se on "
            "TILASTOLLINEN keskiarvo MILJOONIEN pyöräytysten yli. Yksittäisessä "
            "sessiossa lopputulema voi olla mitä tahansa."
        ),
        "topic_tag": "math",
    },
    {
        "order": 2,
        "prompt_fi": "PROVISION KIERRE",
        "options": [],
        "correct": "a",
        "explanation_fi": (
            "Striimaajat saavat tyypillisesti 25–45% katsojan NETO-tappioista "
            "affiliate-mallissa. Mitä enemmän häviät, sitä enemmän he tienaavat. "
            "Tämä on rakenteellinen eturistiriita."
        ),
        "topic_tag": "psychology",
    },
    {
        "order": 3,
        "prompt_fi": "BONUSEHDOT",
        "options": [],
        "correct": "a",
        "explanation_fi": (
            "Tyypillinen \"100% bonus 100 €\" + 35x kierrätys = 7000 € pelivolyymi "
            "ennen kuin SENT voi nostaa. Jos volatiliteetti on korkea, todennäköisyys "
            "olla plussalla kierrätyksen lopussa on yleensä alle 30%."
        ),
        "topic_tag": "bonus",
    },
    {
        "order": 4,
        "prompt_fi": "AIKAVÄRÄHTELY",
        "options": [],
        "correct": "a",
        "explanation_fi": (
            "Aivosi käsittelee 5 min sessioita ja 5 h sessioita TÄYSIN eri tavalla. "
            "Yli 90 min jatkuva pelaaminen heikentää päätöksentekoa mitattavasti — "
            "aseta operaattorin aikaraja 60 min:iin."
        ),
        "topic_tag": "responsibility",
    },
    {
        "order": 5,
        "prompt_fi": "BANKROLL-MATEMATIIKKA",
        "options": [],
        "correct": "a",
        "explanation_fi": (
            "Pienin bankroll-ystävällinen panostus = 1% bankrollista per spin. 200 € "
            "bankrollilla = 2 €/spin. Tämä antaa tilastollisesti 200+ spiniä ennen "
            "todennäköistä nollausta — variassi ehtii tasaantua."
        ),
        "topic_tag": "bankroll",
    },
    {
        "order": 6,
        "prompt_fi": "VEIKKAUS 2026",
        "options": [],
        "correct": "a",
        "explanation_fi": (
            "Suomen rahapelilainsäädäntö muuttui 2026: Veikkauksen monopoli päättyi, "
            "useat operaattorit saivat lisenssin. Tarkista AINA, että operaattorilla "
            "on Suomi-lisenssi (ei pelkkä EU-lisenssi) ennen talletusta."
        ),
        "topic_tag": "regulation",
    },
]
