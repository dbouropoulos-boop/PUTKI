"""
PUTKI HQ - Mini-Game Suite Phase 2 content (iter56)

Seeds + scoring for the 2 educational games added in Phase 2:

  • Scenario (branching decisions) - `scenario_decisions`
      The player walks through 5 real-world gambling situations and picks
      one of 3 actions per turn. Every option carries a small "judgement
      score" (0-3) representing how well it reflects responsible play +
      sound bankroll thinking. After 5 turns we sum the scores and
      assign a player TYPE ("Kärsivällinen taktikko" etc).

  • Insight Reveal (scratch-card facts) - `insight_reveal`
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
            {"key": "a", "label_fi": "Jatkan - flow on hyvä", "score": 0,
             "explanation_fi": "Klassinen \"hot hand\" -ansa. Voitto on tunneista - ei taidosta. Lopettaminen on tilastollisesti paras hetki."},
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
            {"key": "b", "label_fi": "Pidän tauon - odotan ensi kuuta", "score": 3,
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
             "explanation_fi": "Survivor bias. Näet vain voittajat - et tuhansia samanlaisia katsojia jotka hävisivät. Striimaajan voitto ei kerro mitään ODOTUSARVOSTA."},
            {"key": "b", "label_fi": "Striimaaja saa provision tappioistani - etu on hänellä", "score": 3,
             "explanation_fi": "Tarkalleen. Affiliate-malli palkitsee striimaajan tappioistasi. Etu on heillä - sinä olet tuote."},
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
             "explanation_fi": "Riski-palkkio-suhde on pielessä - yhden spinin odotusarvo on negatiivinen. 6 kk:n työ voi mennä yhdessä minuutissa."},
            {"key": "b", "label_fi": "Nostan 250 € pois, jatkan loput entiseen tahtiin", "score": 3,
             "explanation_fi": "Loistava. Realisoit osan voitosta - psykologisesti tämä \"lukitsee\" sen. Loput voivat jatkaa rakenteellisesti."},
            {"key": "c", "label_fi": "Pysähdyn, en tee mitään tunnin sisällä", "score": 2,
             "explanation_fi": "Erittäin järkevää. Tunteenpurkaus laantuu - rationaalinen päätös on yleensä parempi 30 min jälkeen."},
        ],
        "correct": "b",
        "topic_tag": "bankroll",
    },
    {
        "order": 5,
        "prompt_fi": (
            "Ystäväsi sanoo: \"Pelaan vain milloin tuntuu siltä - "
            "kokonaisbudjettia minulla ei ole.\" Mitä neuvot?"
        ),
        "options": [
            {"key": "a", "label_fi": "Toimii hyvin niin kauan kuin huvittaa", "score": 0,
             "explanation_fi": "Tämä on harhaluulo. Ilman ennalta asetettua budjettia päätökset tehdään aina kuumassa tilanteessa - tappiossa raja katoaa."},
            {"key": "b", "label_fi": "Aseta kuukausibudjetti ETUKÄTEEN ja talletusraja operaattorille", "score": 3,
             "explanation_fi": "Oikea vastaus. Budjetti ennalta + operaattorin pakollinen talletusraja = käytännön puskuri silloin kun tahdonvoima pettää."},
            {"key": "c", "label_fi": "Käytä vain käteistä, älä pankkikorttia", "score": 1,
             "explanation_fi": "Vanha hyvä neuvo fyysisille kasinoille, mutta nykyajan online-pelissä se ei suoraan auta. Talletusraja on tehokkaampi."},
        ],
        "correct": "b",
        "topic_tag": "responsibility",
    },
    {
        "order": 6,
        "prompt_fi": (
            "Kello on 01:47. Olet pelannut 3 tuntia putkeen ja "
            "alkuperäinen stop-loss 50 € on saavutettu - mutta tunne sanoo "
            "että \"yksi spin enää\" ja olet kunnossa. Mitä teet?"
        ),
        "options": [
            {"key": "a", "label_fi": "Yksi spin lisää - pieni panos, alkuperäinen suunnitelma rikki vain hetkeksi", "score": 0,
             "explanation_fi": "Stop-loss on stop-loss. Jokainen \"vielä yksi\" -spin yöllä on todistettu johtava pisteeseen, jossa rationaalinen päätöksenteko on jo poissa. 70% ongelmapelaajista kuvailee tätä hetkeä."},
            {"key": "b", "label_fi": "Suljen sovelluksen ja menen nukkumaan", "score": 3,
             "explanation_fi": "Vahvin mahdollinen päätös. Stop-lossin kunnioittaminen unen kustannuksella on yksi tunnistetuimmista kurin merkeistä."},
            {"key": "c", "label_fi": "Talletan 20 € - vain pieni, pakko vielä yrittää", "score": 0,
             "explanation_fi": "Tämä on chasing. Pieni \"vain\" -summa yöllä on tilastollisesti sama kuin iso summa - koska keskimäärin et lopeta sen jälkeen."},
        ],
        "correct": "b",
        "topic_tag": "responsibility",
    },
]


# iter64 pivot - 5-profile spectrum based on total judgement score (max 18 = 6×3)
# Profiles range from most disciplined (Cold Calculator) to highest harm risk
# (Tilt Risk). Each profile carries a `blind_spot` one-liner (free, shown on
# the identity card) and `three_traps` (gated behind email - the "value
# exchange" promised in the gate copy).
SCENARIO_PERSONAS = {
    "cold_calculator": {
        "min": 16,
        "title": "Kylmä laskija",
        "title_en": "The Cold Calculator",
        "tagline": "Pelaat numeroina, et tunteena. Päätöksesi pitävät myös paineessa.",
        "tagline_en": "You play in numbers, not emotion. Your decisions hold under pressure.",
        "blind_spot_fi": "Vahvuus on myös sokea piste - yliluottamus omaan kuriin yhdistettynä korkeaan volyymiin tuottaa pisimmät putket.",
        "blind_spot_en": "Your strength is also your blind spot - overconfidence in your own discipline combined with high volume produces the longest streaks.",
        "three_traps_fi": [
            "Volyymin kasvattaminen \"koska olen kunnossa\" - talon edge realisoituu juuri suurilla volyymeillä.",
            "Bonusten kierrätysmatematiikka - tunne, että hallitset ehdot, peittää sen, että EV on negatiivinen.",
            "Pitkien voittoputkien jälkeinen mikrohuolimattomuus - yksi tilttihetki riittää ottaa palan koko kuukauden tuotosta.",
        ],
        "three_traps_en": [
            "Increasing volume \"because I'm in control\" - the house edge realises precisely at high volumes.",
            "Bonus wagering math - the feeling that you've mastered the terms masks the fact that EV is negative.",
            "Micro-carelessness after long winning streaks - one tilt moment is enough to eat a chunk of the whole month's gain.",
        ],
    },
    "patient_tactician": {
        "min": 12,
        "title": "Kärsivällinen taktikko",
        "title_en": "The Patient Tactician",
        "tagline": "Tunnistat tunnesäätelyn ja pidät pään kylmänä paineessa.",
        "tagline_en": "You recognise emotional regulation and keep a cool head under pressure.",
        "blind_spot_fi": "Kuri on vahva - mutta yksi väsynyt myöhäisilta voi ohittaa kuukausien kurinalaista työtä.",
        "blind_spot_en": "Your discipline is strong - but one tired late night can undo months of disciplined work.",
        "three_traps_fi": [
            "Väsymystila päätöksenteossa - klo 23 jälkeen tehdyt päätökset ovat tilastollisesti huonompia, vaikka kokeneella pelaajalla.",
            "Pieni \"vain vielä yksi spin\" -hetki stop-lossin jälkeen - kuri on absoluuttinen, ei suhteellinen.",
            "Streamerin signaalin kuunteleminen \"vain viihteenä\" - affiliate-linkki imee sinut keskimäärin 25-45% tappiolla.",
        ],
        "three_traps_en": [
            "Decision fatigue - choices made after 11pm are statistically worse, even for experienced players.",
            "A small \"just one more spin\" moment after the stop-loss - discipline is absolute, not relative.",
            "Treating a streamer's signal as \"just entertainment\" - the affiliate link pulls you in at a 25-45% average loss rate.",
        ],
    },
    "streak_chaser": {
        "min": 8,
        "title": "Putken jahti",
        "title_en": "The Streak Chaser",
        "tagline": "Tunnistat järkevät päätökset - mutta voittoputki sokaisee silmiäsi.",
        "tagline_en": "You recognise the smart move - but a winning streak blinds you.",
        "blind_spot_fi": "Hot hand -harha - voittoputken keskellä uskot, että edge kuuluu sinulle. Tilastollisesti edge palaa keskiarvoon.",
        "blind_spot_en": "The hot-hand fallacy - mid-streak you believe the edge belongs to you. Statistically, edge regresses to the mean.",
        "three_traps_fi": [
            "Voiton kanssa lopettamatta jättäminen - vahvin yksittäinen indikaattori siitä, että voitto palautuu tai muuttuu tappioksi.",
            "Panosten asteittainen nostaminen voittojen edetessä - varianssi syö isompia panoksia paljon nopeammin.",
            "\"Tuplauskertoimen\" houkutus - bonusten ja kampanjoiden alaiset päätökset perustuvat tunteeseen, ei matematiikkaan.",
        ],
        "three_traps_en": [
            "Failing to stop while ahead - the single strongest indicator that winnings will regress or flip into losses.",
            "Gradually raising stakes as wins accumulate - variance eats bigger bets far faster.",
            "The \"double-up\" temptation - decisions during bonuses and campaigns are emotional, not mathematical.",
        ],
    },
    "comeback_believer": {
        "min": 4,
        "title": "Comeback-uskoja",
        "title_en": "The Comeback Believer",
        "tagline": "Etsit kääntöpistettä jokaisesta tappiosta. Tämä on tuttua - ja vaarallista.",
        "tagline_en": "You look for the turning point in every loss. It's familiar - and dangerous.",
        "blind_spot_fi": "Sunken cost -ansa - mitä enemmän olet hävinnyt, sitä enemmän tunnet pakkoa \"saada takaisin\". Matemaattisesti odotus on sama joka spinissä.",
        "blind_spot_en": "The sunk-cost trap - the more you've lost, the more you feel forced to \"win it back\". Mathematically, expectation is identical on every spin.",
        "three_traps_fi": [
            "Tappioiden jälkeinen talletuksen \"vain pienen summan\" -lisäys - jokainen tällainen talletus pidentää tappion polkua.",
            "Bonustarjousten houkutus juuri tappion jälkeen - operaattorit kohdistavat tarjouksia tunnetilan mukaan.",
            "\"Tämä peli on velkaa minulle\" -ajattelu - gambler's fallacy on yksi yleisimmistä syistä ongelmapelaamiseen.",
        ],
        "three_traps_en": [
            "Adding \"just a small\" deposit after losses - every such top-up extends the loss path.",
            "Bonus offers targeted right after a loss - operators time offers to your emotional state.",
            "\"This game owes me\" thinking - the gambler's fallacy is one of the most common gateways to problem gambling.",
        ],
    },
    "tilt_risk": {
        "min": 0,
        "title": "Tilt-riski",
        "title_en": "The Tilt Risk",
        "tagline": "Sinulla on rohkeutta vastata rehellisesti - se on jo iso askel.",
        "tagline_en": "You had the courage to answer honestly - that's already a big step.",
        "blind_spot_fi": "Itse-suostuttelun ja todellisen kurin ero - sokea piste on usein \"minulla on tämä hallinnassa\" -ajatus juuri sillä hetkellä kun kuri pettää.",
        "blind_spot_en": "The gap between self-persuasion and actual discipline - the blind spot is often \"I have this under control\" precisely when control breaks.",
        "three_traps_fi": [
            "Talletusrajan asettamatta jättäminen - \"asetan myöhemmin\" -ajattelu on yksi tunnistetuimmista varhaisvaroitusmerkeistä.",
            "Pelisession pidentäminen ohi suunnitellun ajan - 90 min jälkeen päätöksenteko heikkenee mitattavasti.",
            "Lainatulla rahalla pelaaminen tai läheisille valehtelu - nämä ovat selvät pisteet, jossa peluuri.fi:n yhteydenotto on suositeltavaa.",
        ],
        "three_traps_en": [
            "Failing to set a deposit limit - \"I'll set it later\" thinking is one of the strongest early warning signs.",
            "Extending sessions past the planned time - decision-making degrades measurably after 90 minutes.",
            "Playing with borrowed money or lying to loved ones - these are clear points where contacting peluuri.fi is recommended.",
        ],
    },
}


def persona_for_scenario(total_score: int) -> Dict[str, Any]:
    # Order matters - descending min threshold
    for key in ["cold_calculator", "patient_tactician", "streak_chaser",
                "comeback_believer", "tilt_risk"]:
        p = SCENARIO_PERSONAS[key]
        if total_score >= p["min"]:
            return {
                "key": key,
                "title": p["title"], "title_en": p["title_en"],
                "tagline": p["tagline"], "tagline_en": p["tagline_en"],
                "blind_spot_fi": p["blind_spot_fi"],
                "blind_spot_en": p["blind_spot_en"],
                "three_traps_fi": p["three_traps_fi"],
                "three_traps_en": p["three_traps_en"],
            }
    p = SCENARIO_PERSONAS["tilt_risk"]
    return {
        "key": "tilt_risk",
        "title": p["title"], "title_en": p["title_en"],
        "tagline": p["tagline"], "tagline_en": p["tagline_en"],
        "blind_spot_fi": p["blind_spot_fi"],
        "blind_spot_en": p["blind_spot_en"],
        "three_traps_fi": p["three_traps_fi"],
        "three_traps_en": p["three_traps_en"],
    }


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
            "Striimaajat saavat tyypillisesti 25-45% katsojan NETO-tappioista "
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
            "Yli 90 min jatkuva pelaaminen heikentää päätöksentekoa mitattavasti - "
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
            "todennäköistä nollausta - variassi ehtii tasaantua."
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
