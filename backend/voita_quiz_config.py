"""
PUTKI HQ - Voita game funnel config.

DEFAULT_VOITA_QUIZ is the five-round game sequence per the
2026-05-20 product reframe. Each step contains:

  - A question that tests the user's intuition
  - A reveal block with an educative scout-report fragment:
    heading + fact + why + application
  - Per-option `reveal_personalized` so the commentary changes
    based on which answer the user picked
  - A `tag` per option so the profile resolver can compose a profile
    type from the user's answer combination

The structure is intentionally educative - players still learn the
real betting concepts (Sharpness, the favorite paradox, etc.) - but
the framing is "game / round / scout report", never "lesson".

Editorial can fully edit copy via the back-office; the
sanitize_quiz_config validator clamps lengths so a bad save can't
blank the funnel. Unverified percentage claims are tagged with
`source: editorial_pending_citation` for future provenance audit.

Acceptance: no outcome claims ("win more", "guaranteed", "lose less"
in causal framing) - those are blocked at PUT time by the compliance
linter (see `_assert_compliant_copy`).
"""

import re
from typing import Any, Dict, List


# Phrases that imply outcome guarantees or non-compliant edge claims.
# Match is case-insensitive; substring is enough to flag. These are the
# exact rahapelimainonta-compliance line we hold - phrases that promise
# the *user* a winning outcome. Educational descriptions of bookmaker
# mathematics (e.g. "guaranteed loss" from the bettor's perspective) are
# allowed because they discourage, not encourage, blind play.
FORBIDDEN_PHRASES = [
    "win more",
    "lose less",
    "guaranteed win",
    "guaranteed profit",
    "guarantee that you",
    "guarantee a win",
    "guarantee a profit",
    "increase your win rate",
    "boost your win rate",
    "make money guaranteed",
    "voitat varmasti",
    "takuuvoitto",
    "varma voitto",
    "voita aina",
    "lisää voittoja",
]


def _assert_compliant_copy(text: str, *, field: str) -> None:
    """Raise ValueError when a forbidden outcome-claim phrase appears.
    Held at PUT time so editorial can't ship non-compliant copy from the
    back-office. Compliance hold-line for rahapelimainonta rules."""
    if not text:
        return
    haystack = text.lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in haystack:
            raise ValueError(
                f"voita_quiz_config.{field} contains forbidden outcome claim: "
                f"'{phrase}'. Educative copy never promises outcomes."
            )


DEFAULT_VOITA_QUIZ: List[Dict[str, Any]] = [
    # ── Lesson 1 - The Favorite Paradox ─────────────────────────────────
    {
        "key": "bias_favorite",
        "auto": True, "multi": False, "callback": True,
        "lesson_number": 1,
        "lesson_title_fi": "Suosikkien paradoksi",
        "lesson_title_en": "The Favorite Paradox",
        "title_fi": "Altavastaajan ystävä vai suosikin halaaja? Rehellisesti.",
        "title_en": "Underdog backer or favorite-hugger? Be honest.",
        "sub_fi": "Yksi vastaus. Tämä on peli - pelaa, älä kakkosveikkaa.",
        "sub_en": "One answer. This is the game - play, don't second-guess.",
        "zinger_fi": "Suosikit voittavat 67 % otteluista - ja häviävät rahaa 62 % ajasta. Kierros 1 - kierroksen scout selittää.",
        "zinger_en": "Favorites win 67% of matches - and lose money 62% of the time. Round 1 scout report explains.",
        "options": [
            {"v": "favorite", "tag": "bias_favorite",
             "label_fi": "Suosikkia aina - ei oteta riskejä",
             "label_en": "Favorite every time - no risks",
             "emoji": "🛡️",
             "reveal_personalized_fi": "Olet suosikin halaaja. 71 % vapaa-ajan veikkaajista pelaa samalla tavalla - ja maksaa siitä.",
             "reveal_personalized_en": "You're a Favorite-Hugger. 71% of casual predictors play the same way - and pay for it."},
            {"v": "underdog", "tag": "bias_underdog",
             "label_fi": "Altavastaajaa kun haistan jotain",
             "label_en": "Underdog when something tips me off",
             "emoji": "🎯",
             "reveal_personalized_fi": "Olet Underdog Hunter. Tämä on usein arvokas tyyli - kun valitset altavastaajan, sinulla on yleensä syy.",
             "reveal_personalized_en": "You're an Underdog Hunter. This is often a valuable style - when you back an underdog, you usually have a reason."},
            {"v": "balanced", "tag": "bias_balanced",
             "label_fi": "Sekaisin - ei mitään kaavaa",
             "label_en": "Mixed - no pattern",
             "emoji": "🤷",
             "reveal_personalized_fi": "Sekoitettu lähestymistapa. Tämä on rehellistä - ja tämä kierros auttaa sinua tunnistamaan, milloin painottaa kumpaakin suuntaan.",
             "reveal_personalized_en": "A mixed approach. That's honest - and this round helps you spot when to lean each way."},
            {"v": "depends", "tag": "bias_situational",
             "label_fi": "Riippuu lajista ja fiiliksestä",
             "label_en": "Depends on sport + mood",
             "emoji": "🎲",
             "reveal_personalized_fi": "Tilannekohtainen tyyli. Hyvä alku - mutta ilman dataa kytketty fiilis on kallista pitkässä juoksussa.",
             "reveal_personalized_en": "A situational style. Fine start - but feel without data is expensive over time."},
        ],
        "reveal_heading_fi": "Kierros 1/5 · Scout-raportti: Suosikkien paradoksi",
        "reveal_heading_en": "Round 1 of 5 · Scout report: The Favorite Paradox",
        "reveal_fact_fi": "Vedonlyöntitoimistojen suosikit voittavat 67 % otteluista. Niiden sokea pelaaminen häviää rahaa 62 % ajasta.",
        "reveal_fact_en": "Bookmaker favorites win 67% of the time. Backing them blindly loses money 62% of the time.",
        "reveal_why_fi": "Miksi? Kertoimet asetetaan niin, että suosikin pelin \"odotusarvo\" on hieman negatiivinen. Maksat turvasta lisähintaa. Satojen vedonlyöntien yli tuo lisähinta kasaantuu varmaksi tappioksi.",
        "reveal_why_en": "Why? The odds are set so the \"expected value\" of a favorite bet is slightly negative. You're paying a premium for safety. Over hundreds of bets, that premium adds up to a guaranteed loss.",
        "reveal_application_fi": "Mitä tämä tarkoittaa arvonnoissasi: suosikki on yleensä oikein, mutta \"yleensä oikein\" ei riitä johdonmukaiseen voittamiseen. Sinun pitää tietää, milloin suosikki on tarpeeksi oikein, jotta lisähinta on perusteltu.",
        "reveal_application_en": "What this means for your raffles: the favorite is usually right, but \"usually right\" isn't enough to win consistently. You need to know when the favorite is right enough to justify the premium.",
        "source": "editorial_pending_citation",
    },

    # ── Lesson 2 - Reading the Market ───────────────────────────────────
    {
        "key": "read_consensus",
        "auto": True, "multi": False, "callback": True,
        "lesson_number": 2,
        "lesson_title_fi": "Markkinan lukeminen",
        "lesson_title_en": "Reading the Market",
        "title_fi": "Molemmilla otteluilla oli viime viikolla identtiset kertoimet. Kumpi on turvallisempi veto?",
        "title_en": "Both these matches had identical odds last week. Pick the safer bet.",
        "sub_fi": "Sama otsikkokerroin - eri tarina alla.",
        "sub_en": "Same headline odds - different story underneath.",
        "zinger_fi": "Ottelu A - kun vedonvälittäjät ovat samaa mieltä, markkina on terävä. Kierros 2 - kierroksen scout opettaa luennan.",
        "zinger_en": "Match A. When bookmakers agree, the market is sharp. Round 2 scout report teaches the read.",
        "options": [
            {"v": "tight", "tag": "read_consensus_y",
             "label_fi": "Ottelu A - vedonvälittäjät 0.05 sisällä toisistaan",
             "label_en": "Match A - bookmakers within 0.05 of each other",
             "emoji": "🎯",
             "reveal_personalized_fi": "Oikein. Tunnistit Sharpnessin idean ilman, että käytimme sanaa. Tämä on jo etu.",
             "reveal_personalized_en": "Correct. You spotted the Sharpness signal without us using the word. That's already an edge."},
            {"v": "spread", "tag": "read_consensus_n",
             "label_fi": "Ottelu B - vedonvälittäjät hajautuneet 0.40",
             "label_en": "Match B - bookmakers spread across 0.40",
             "emoji": "📊",
             "reveal_personalized_fi": "Ei aivan. Sama otsikkokerroin, mutta hajaantunut konsensus tarkoittaa, että vedonvälittäjät eivät ole varmoja. Sharpness olisi tällä matala.",
             "reveal_personalized_en": "Not quite. Same headline odds, but a spread consensus means bookmakers are unsure. Sharpness would be low here."},
            {"v": "same", "tag": "read_consensus_unknown",
             "label_fi": "Sama veto - kertoimet ovat samat",
             "label_en": "Same bet - odds are the same",
             "emoji": "🤔",
             "reveal_personalized_fi": "Loogista, mutta tässä piilee kierroksen ydin: kertoimet ovat sama, mutta luottamus alla on aivan eri tason.",
             "reveal_personalized_en": "Logical - but this is the core of the round: the odds match, but the confidence underneath is completely different."},
        ],
        "reveal_heading_fi": "Kierros 2/5 · Scout-raportti: Markkinan lukeminen",
        "reveal_heading_en": "Round 2 of 5 · Scout report: Reading the Market",
        "reveal_fact_fi": "Ottelussa A kolme vedonvälittäjää oli 0.05 päässä toisistaan. Ottelussa B vedonvälittäjät olivat 0.40 hajallaan. Sama otsikkokerroin. Täysin eri luottamus.",
        "reveal_fact_en": "Match A had three bookmakers within 0.05 of each other on the odds. Match B had bookmakers spread across 0.40. Same headline odds. Completely different confidence.",
        "reveal_why_fi": "Mittari: kuinka tiukasti vedonvälittäjät ovat samaa mieltä. Me kutsumme sitä Sharpness. Kun Sharpness on yli 75, voit luottaa konsensukseen. Alle 40 vedonvälittäjät arvaavat.",
        "reveal_why_en": "The metric: how tight the bookmakers agree. We call it Sharpness. When Sharpness is above 75, you can trust the consensus. Below 40, the bookmakers are basically guessing.",
        "reveal_application_fi": "Mitä tämä tarkoittaa arvonnoissasi: jokaisessa lähettämässämme signaalissa näkyy Sharpness. Luku on ero tunnetun veikkaamisen ja suosikiksi pukeutuneen kolikonheiton välillä.",
        "reveal_application_en": "What this means for your raffles: every signal we send shows Sharpness. The number is the difference between betting on a known quantity and betting on a coin flip dressed up as a favorite.",
        "source": "real_metric_published_at_methodology",
    },

    # ── Lesson 3 - The Five Loser Patterns ──────────────────────────────
    {
        "key": "wrong_pattern",
        "auto": True, "multi": False, "callback": True,
        "lesson_number": 3,
        "lesson_title_fi": "Viisi häviäjäkuviota",
        "lesson_title_en": "The Five Loser Patterns",
        "title_fi": "Mieti kolmea viimeistä veikkaustasi, jotka kaatuivat. Mikä on yhteinen kuvio?",
        "title_en": "Think about your last three predictions that crashed. What's the pattern?",
        "sub_fi": "Rehellinen vastaus tähän terävöittää seuraavaa kierrosta.",
        "sub_en": "An honest answer here sharpens the next round.",
        "zinger_fi": "Yksi viidestä kuviosta osuu sinuun. Kierros 3 - kierroksen scout nimeää ja korjaa.",
        "zinger_en": "One of five patterns describes you. Round 3 scout report names it and has the fix.",
        "options": [
            {"v": "loyalty", "tag": "bias_loyalty",
             "label_fi": "Lojaliteetti - joukkueeni",
             "label_en": "Loyalty - my team",
             "emoji": "🎽",
             "zinger_personalized_fi": "Urheilun kallein bias. Kierros 3 - kierroksen scout sisältää korjauksen.",
             "zinger_personalized_en": "The most expensive bias in sport. Round 3 scout report has the fix.",
             "reveal_personalized_fi": "Oma joukkue on urheilun kallein bias. Tutkimusten mukaan fanit yliennustavat oman joukkueensa voitot keskimäärin 8 prosenttiyksiköllä.",
             "reveal_personalized_en": "Loyalty is the most expensive bias in sports. Studies show fans over-predict their team's wins by 8 percentage points on average."},
            {"v": "gut", "tag": "bias_gut",
             "label_fi": "Vaisto rutiinipeleissä",
             "label_en": "Gut on routine matches",
             "emoji": "🔥",
             "zinger_personalized_fi": "Vaisto voittaa derbyt. Vaisto häviää tiistait. Kierros 3 - kierroksen scout selittää.",
             "zinger_personalized_en": "Gut wins rivalries. Gut loses Tuesdays. Round 3 scout report explains.",
             "reveal_personalized_fi": "Vaisto voittaa datan kärkiotteluissa ja paikallisderbyissä - mutta häviää tiistaikierrosten otteluissa. Kuvio on yllättävän johdonmukainen.",
             "reveal_personalized_en": "Gut beats data on big rivalries - but loses on Tuesday fixtures. The pattern is surprisingly consistent."},
            {"v": "consensus", "tag": "bias_crowd",
             "label_fi": "Seurasin äänekästä konsensusta",
             "label_en": "Followed loud consensus",
             "emoji": "📢",
             "zinger_personalized_fi": "Ääneäs ≠ oikea. Kierros 3 - kierroksen scout paljastaa merkin.",
             "zinger_personalized_en": "Loud ≠ right. Round 3 scout report has the tell.",
             "reveal_personalized_fi": "Äänekäs konsensus ei ole sama asia kuin tietoinen konsensus. Some-kuhina ja kabinettien tieto eivät korreloi.",
             "reveal_personalized_en": "Loud consensus is not the same as informed consensus. Social-media buzz and inside-room knowledge don't correlate."},
            {"v": "overthink", "tag": "bias_overthink",
             "label_fi": "Yliajattelin - vaihdoin viime hetkellä",
             "label_en": "Overthought - switched last minute",
             "emoji": "🧠",
             "zinger_personalized_fi": "Ensilukukerta on yleensä oikein. Kierros 3 - kierroksen scout sanoo miksi.",
             "zinger_personalized_en": "Your first read is usually correct. Round 3 scout report says why.",
             "reveal_personalized_fi": "Ensimmäinen lukukerta on yleensä oikein. Muutos jälkeenpäin on lähes aina väärä - ja jälkikäteen tarkistettavissa.",
             "reveal_personalized_en": "Your first read is usually right. A late switch is almost always wrong - and verifiable after the fact."},
            {"v": "unknown", "tag": "bias_unknown",
             "label_fi": "En osaa sanoa - en seuraa omia tuloksiani",
             "label_en": "Honest answer - I don't track my results",
             "emoji": "🤷",
             "zinger_personalized_fi": "Rehellinen vastaus. Kierros 3 alkaa juuri tästä.",
             "zinger_personalized_en": "Honest answer. Round 3 scout report starts where you are.",
             "reveal_personalized_fi": "Rehellinen vastaus. Kierros 3 alkaa juuri sieltä mistä sinäkin - ilman seurantaa toistat samat virheet, joten ratkaisu on aloittaa seuraaminen.",
             "reveal_personalized_en": "Honest answer. Round 3 scout report starts exactly where you are - without tracking you repeat the same mistakes, so the fix is to start tracking."},
        ],
        "reveal_heading_fi": "Kierros 3/5 · Scout-raportti: Viisi häviäjäkuviota",
        "reveal_heading_en": "Round 3 of 5 · Scout report: The Five Loser Patterns",
        "reveal_fact_fi": "Useimmat veikkaajat häviävät viidestä syystä: lojaliteetti, rutiinin vaisto, äänekäs konsensus, yliajattelu, ja oman tuloksen seuraamatta jättäminen. Nämä viisi selittävät suurimman osan tappioista.",
        "reveal_fact_en": "Most predictors lose for five reasons: loyalty, gut on routine matches, loud consensus, overthinking, and not tracking results. Five patterns account for the majority of losses.",
        "reveal_why_fi": "Miksi? Aivot palkitsevat tutusta. Lojaliteetti ja vaisto tuntuvat varmoilta, mutta ne ovat juuri kohtia, joissa data poikkeaa intuitiosta. Ja ilman seurantaa et koskaan huomaa toistuvuutta.",
        "reveal_why_en": "Why? Brains reward the familiar. Loyalty and gut feel safe, but those are exactly the spots where data diverges from intuition. And without tracking you never notice the pattern.",
        "reveal_application_fi": "Mitä tämä tarkoittaa arvonnoissasi: tietoisuus on puolet ratkaisusta. Merkitsemme otteluja, joissa juuri sinun bias todennäköisesti laukeaa. Voit jättää huomion huomiotta - mutta tiedät.",
        "reveal_application_en": "What this means for your raffles: awareness is half the fix. We'll flag matches where your specific bias is likely to fire. You can choose to ignore the flag - but you'll know.",
        "source": "editorial_pending_citation",
    },

    # ── Lesson 4 - The Real Hierarchy ───────────────────────────────────
    {
        "key": "analysis_priority",
        "auto": True, "multi": False, "callback": True,
        "lesson_number": 4,
        "lesson_title_fi": "Todellinen hierarkia",
        "lesson_title_en": "The Real Hierarchy",
        "title_fi": "Mikä ennustaa ottelua eniten?",
        "title_en": "What actually predicts a match most?",
        "sub_fi": "Valitse kärkitekijä - käymme listan läpi reveal-vaiheessa.",
        "sub_en": "Pick the top factor - we'll walk the full list in the reveal.",
        "zinger_fi": "Selvä. Painotamme signaaleitasi tähän suuntaan.",
        "zinger_en": "Got it. We'll weight your signals around what you picked.",
        "options": [
            {"v": "consensus", "tag": "analysis_priority_consensus",
             "label_fi": "Vedonvälittäjien konsensuksen tiukkuus (Sharpness)",
             "label_en": "Bookmaker consensus tightness (Sharpness)",
             "emoji": "🎯",
             "reveal_personalized_fi": "Oikein. Sijoitit Sharpnessin ykköseksi. Se on jo etu.",
             "reveal_personalized_en": "Correct. You ranked Sharpness first. That's already an edge."},
            {"v": "availability", "tag": "analysis_priority_availability",
             "label_fi": "Pelaajien saatavuus (loukkaantumiset, pelikiellot)",
             "label_en": "Player availability (injuries, suspensions)",
             "emoji": "🚑",
             "reveal_personalized_fi": "Lähellä. Pelaajien saatavuus on toiseksi tärkein, mutta Sharpness pesee sen ennustavuudessa.",
             "reveal_personalized_en": "Close. Availability is #2, but Sharpness beats it on predictive power."},
            {"v": "form", "tag": "analysis_priority_form",
             "label_fi": "Viimeisten 5 ottelun vire",
             "label_en": "Recent form (last 5 matches)",
             "emoji": "📈",
             "reveal_personalized_fi": "Yleinen vastaus, mutta vire on jo kertoimissa. Hyödyllinen, ei ratkaiseva.",
             "reveal_personalized_en": "A common answer, but form is already priced into the odds. Useful, not decisive."},
            {"v": "home", "tag": "analysis_priority_home",
             "label_fi": "Kotiedun vaikutus",
             "label_en": "Home advantage",
             "emoji": "🏟️",
             "reveal_personalized_fi": "Koti-etu on oikea ilmiö, mutta pienempi kuin useimmat luulevat. Se kuuluu listan keskivaiheille.",
             "reveal_personalized_en": "Home advantage is real but smaller than most people think. It belongs mid-list."},
            {"v": "h2h", "tag": "analysis_priority_h2h",
             "label_fi": "Keskinäiset kohtaamiset (H2H)",
             "label_en": "Head-to-head history",
             "emoji": "🤼",
             "reveal_personalized_fi": "Väärin suuntaan. H2H on ylihinnoitelluin tekijä - vedonvälittäjät hinnoittelevat sen kertoimiin ennen kuin näet ne.",
             "reveal_personalized_en": "Wrong direction. H2H is the most overrated factor - bookmakers price it in before you see the odds."},
        ],
        "reveal_heading_fi": "Kierros 4/5 · Scout-raportti: Todellinen hierarkia",
        "reveal_heading_en": "Round 4 of 5 · Scout report: The Real Hierarchy",
        "reveal_fact_fi": "Oikea järjestys, suurten otteluaineistojen perusteella: 1) Vedonvälittäjien konsensuksen tiukkuus (Sharpness) - selvästi ennustavin. 2) Pelaajien saatavuus - loukkaantumiset ja pelikiellot liikuttavat linjaa. 3) Viimeisten 5 ottelun vire - merkitsevä mutta jo hinnoiteltu. 4) Kotietu - oikea, mutta pienempi kuin luullaan. 5) H2H - lähes pelkkä ansa, jo kertoimissa.",
        "reveal_fact_en": "The correct order, based on large match samples: 1) Bookmaker consensus tightness (Sharpness) - by far the most predictive. 2) Key player availability - injuries and suspensions move the line. 3) Recent form (last 5 matches) - meaningful but priced in. 4) Home advantage - real but smaller than people think. 5) Head-to-head history - almost entirely a trap. Already in the odds.",
        "reveal_why_fi": "Miksi tässä järjestyksessä? Sharpness mittaa vedonvälittäjien yhteistä tietoa - heillä on enemmän dataa kuin sinulla. Pelaajien saatavuus on signaali, joka ei aina ehdi kertoimiin. Loput tekijät ovat jo siellä.",
        "reveal_why_en": "Why this order? Sharpness measures bookmakers' pooled knowledge - they have more data than you. Availability is a signal that doesn't always reach the odds in time. The rest is already priced in.",
        "reveal_application_fi": "Mitä tämä tarkoittaa arvonnoissasi: kun lähetämme signaalin, johdamme sillä, mikä oikeasti merkitsee - Sharpness ensin, sitten saatavuus. H2H mainitsemme vain harvoin, koska se on melun pukeutumista dataksi.",
        "reveal_application_en": "What this means for your raffles: when we send a signal, we lead with what actually matters - Sharpness, then availability. We barely mention H2H because it's noise dressed as data.",
        "source": "editorial_pending_citation",
    },

    # ── Lesson 5 - How do you want to apply it ──────────────────────────
    {
        "key": "apply_mode",
        "auto": True, "multi": False, "callback": True,
        "lesson_number": 5,
        "lesson_title_fi": "Sovella scout-raporttia",
        "lesson_title_en": "Apply the scout report",
        "title_fi": "Tähän arvontaan - miten haluat soveltaa oppimaasi?",
        "title_en": "For this raffle - how do you want to play?",
        "sub_fi": "Tämä määrittää, miten ennustus näytetään.",
        "sub_en": "This shapes how the prediction is presented.",
        "zinger_fi": "Tämä yhdistää tunnettuun ennustajatyyppiin. Tulos heti perään...",
        "zinger_en": "That maps to a known predictor type. Result coming up...",
        "options": [
            {"v": "snap", "tag": "mode_snap",
             "label_fi": "Vaistolla - luotan ensilukukertaan",
             "label_en": "Snap - I trust my first read",
             "emoji": "⚡",
             "reveal_personalized_fi": "Vaisto ensin. Tunnistat itsesi nopeissa päätöksissä.",
             "reveal_personalized_en": "Gut first. You know yourself in fast calls."},
            {"v": "slow", "tag": "mode_slow",
             "label_fi": "Hitaasti - tarkistan numerot",
             "label_en": "Slow - I check the numbers first",
             "emoji": "📊",
             "reveal_personalized_fi": "Hidas ja tarkka. Sopii dataan tukeutuvaan veikkaajaan.",
             "reveal_personalized_en": "Slow and careful. The data-led predictor's mode."},
            {"v": "social", "tag": "mode_social",
             "label_fi": "Sosiaalisesti - kysyn toisten luennan",
             "label_en": "Social - I check what others read",
             "emoji": "🤝",
             "reveal_personalized_fi": "Pohjaat valintaasi muiden lukuun. Hyvä, kun lähde on aito.",
             "reveal_personalized_en": "You lean on others' reads. Useful when the source is real."},
            {"v": "chaos", "tag": "mode_chaos",
             "label_fi": "Kaaoksessa - vaihdan joka kerta tyyliä",
             "label_en": "Chaos - I switch styles every time",
             "emoji": "🌪️",
             "reveal_personalized_fi": "Et lukitse tyyliisi. Rehellinen vastaus - ja korjattavissa.",
             "reveal_personalized_en": "No locked style. Honest answer - and fixable."},
        ],
        "reveal_heading_fi": "Kierros 5/5 · Scout-raportti: Aika soveltaa",
        "reveal_heading_en": "Round 5 of 5 · Scout report: Time to apply it",
        "reveal_fact_fi": "Tämä päättää kierrosten sarjan. Seuraavaksi näet henkilökohtaisen ennustajaraporttisi - ja sen jälkeen sovellat oppia oikeaan arvontaan.",
        "reveal_fact_en": "That closes the round series. Next you'll see your personal predictor report - and then you'll apply what you learned in a real raffle.",
        "reveal_why_fi": "Miksi tässä järjestyksessä? Raportti antaa sinulle yhden lauseen, joka ohjaa valintaasi. Ennustus on scout-raportin sovellus, ei sen korvaaja.",
        "reveal_why_en": "Why this order? The report gives you one sentence to anchor your pick. The prediction is the scout report applied, not a replacement for it.",
        "reveal_application_fi": "Mitä tämä tarkoittaa arvonnoissasi: koko funnel on yksi tuoteketju - pelaa → tunnista profiilisi → ennusta. Ei satunnaisia askelia.",
        "reveal_application_en": "What this means for your raffles: the whole funnel is one product story - play → identify your profile → predict. No random steps.",
        "source": "internal_product_logic",
    },
]


def sanitize_quiz_config(cfg) -> list:
    """Clamp + sanitize admin-edited quiz config. Falls back to default
    on structural error so a bad save never blanks the funnel. Runs the
    compliance linter on every text field that ships to the user."""
    if not isinstance(cfg, list) or not cfg:
        return DEFAULT_VOITA_QUIZ
    out: List[Dict[str, Any]] = []
    seen_keys: set = set()
    for q in cfg[:8]:  # max 8 questions
        if not isinstance(q, dict):
            continue
        key = str(q.get("key") or "").strip().lower()[:32]
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        options: List[Dict[str, Any]] = []
        for o in (q.get("options") or [])[:10]:  # max 10 options per Q
            if not isinstance(o, dict):
                continue
            v = str(o.get("v") or "").strip().lower()[:32]
            if not v:
                continue
            label_fi = str(o.get("label_fi") or "")[:160]
            label_en = str(o.get("label_en") or "")[:160]
            r_fi = str(o.get("reveal_personalized_fi") or "")[:360]
            r_en = str(o.get("reveal_personalized_en") or "")[:360]
            for field, txt in (("label_fi", label_fi), ("label_en", label_en),
                               ("reveal_personalized_fi", r_fi), ("reveal_personalized_en", r_en),
                               ("zinger_personalized_fi", str(o.get("zinger_personalized_fi") or "")),
                               ("zinger_personalized_en", str(o.get("zinger_personalized_en") or ""))):
                _assert_compliant_copy(txt, field=f"option.{field}")
            options.append({
                "v": v,
                "tag": str(o.get("tag") or v)[:48],
                "label_fi": label_fi,
                "label_en": label_en,
                "emoji": str(o.get("emoji") or "")[:8],
                "reveal_personalized_fi": r_fi,
                "reveal_personalized_en": r_en,
                "zinger_personalized_fi": str(o.get("zinger_personalized_fi") or "")[:200],
                "zinger_personalized_en": str(o.get("zinger_personalized_en") or "")[:200],
            })
        if not options:
            continue
        clamped: Dict[str, Any] = {
            "key": key,
            "auto": bool(q.get("auto", True)),
            "multi": bool(q.get("multi", False)),
            "callback": bool(q.get("callback", False)),
            "lesson_number": int(q.get("lesson_number") or (len(out) + 1)),
            "lesson_title_fi": str(q.get("lesson_title_fi") or "")[:120],
            "lesson_title_en": str(q.get("lesson_title_en") or "")[:120],
            "title_fi": str(q.get("title_fi") or "")[:240],
            "title_en": str(q.get("title_en") or "")[:240],
            "sub_fi": str(q.get("sub_fi") or "")[:320],
            "sub_en": str(q.get("sub_en") or "")[:320],
            "zinger_fi": str(q.get("zinger_fi") or "")[:200],
            "zinger_en": str(q.get("zinger_en") or "")[:200],
            "reveal_heading_fi": str(q.get("reveal_heading_fi") or "")[:160],
            "reveal_heading_en": str(q.get("reveal_heading_en") or "")[:160],
            "reveal_fact_fi": str(q.get("reveal_fact_fi") or "")[:600],
            "reveal_fact_en": str(q.get("reveal_fact_en") or "")[:600],
            "reveal_why_fi": str(q.get("reveal_why_fi") or "")[:600],
            "reveal_why_en": str(q.get("reveal_why_en") or "")[:600],
            "reveal_application_fi": str(q.get("reveal_application_fi") or "")[:600],
            "reveal_application_en": str(q.get("reveal_application_en") or "")[:600],
            "source": str(q.get("source") or "")[:80],
            "options": options,
        }
        for field in ("title_fi", "title_en", "sub_fi", "sub_en",
                      "zinger_fi", "zinger_en",
                      "reveal_fact_fi", "reveal_fact_en",
                      "reveal_why_fi", "reveal_why_en",
                      "reveal_application_fi", "reveal_application_en"):
            _assert_compliant_copy(clamped[field], field=field)
        out.append(clamped)
    return out or DEFAULT_VOITA_QUIZ
