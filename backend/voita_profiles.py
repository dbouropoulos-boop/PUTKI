"""
PUTKI HQ — Voita Personal Predictor Profile system.

After the on-site diagnostic the user's answers map to one of the
named predictor profiles. The full report is delivered by email — the
on-site flow only shows `on_site_tease` (one paragraph) per profile.

Resolution: longest-match-wins among match_rules, ties broken by
priority desc, fallback to is_default. Match rules use the canonical
tag vocabulary (2026-05-19 alignment):

  Q1 bias_favorite  : bias_favorite | bias_underdog | bias_balanced | bias_situational
  Q2 read_consensus : read_consensus_y | read_consensus_n | read_consensus_unknown
  Q3 wrong_pattern  : bias_loyalty | bias_gut | bias_crowd | bias_overthink | bias_unknown
  Q4 analysis_priority: analysis_priority_consensus|availability|form|home|h2h
  Q5 apply_mode     : mode_snap | mode_slow | mode_social | mode_chaos
"""
from typing import Any, Dict, List, Optional


# Final catalog (2026-05-19 reframe): 10 named profiles surface
# on-site, plus CURIOUS_LEARNER as hidden is_default fallback.
DEFAULT_PROFILES: List[Dict[str, Any]] = [
    {
        "slug": "confident_loyalist", "priority": 80, "is_default": False,
        "name_fi": "ITSEVARMA LOJAALI",
        "name_en": "THE CONFIDENT LOYALIST",
        "on_site_tease_fi": "Pelaat suosikkia ja seuraat joukkuettasi. Tämä on tutuin pelityyli — ja kalliin biaksen sokeain piste. Raporttisi sähköpostissa kertoo missä se laukeaa ja miten korjaat sen.",
        "on_site_tease_en": "You back the favorite and follow your team. The most familiar style — and the blind spot for the most expensive bias in sport. The report in your inbox names where it fires and how to handle it.",
        "diagnosis_fi": "Olet Suosikin Halaaja. Otat oletuksena pienemmän kertoimen valinnan. Olet 71 %:n vapaa-ajan veikkaajan joukossa. Ansa: suosikit voittavat 67 % ajasta mutta häviävät rahaa 62 % ajasta. Maksat turvasta lisähintaa, jonka kertoimet jo huomioivat.",
        "diagnosis_en": "You're a Favorite-Hugger. You take the odds-on pick by default. You're with 71% of casual predictors. The trap: favorites win 67% of the time but lose money 62% of the time. You're paying a premium for safety that the odds already account for.",
        "weakness_fi": "Lojaliteetti. Kerroit kaatuneesi vedoissa, joissa valitsit oman joukkueesi. Tämä on urheilun kallein bias — fanit yliennustavat oman joukkueensa voitot keskimäärin 8 %:lla.",
        "weakness_en": "Loyalty. You said you've crashed on bets where you picked your team. This is the most expensive bias in sports — fans of a team over-predict their team's wins by 8% on average.",
        "edge_fi": "Kun lähdet altavastaajan kannalle, sinulla on yleensä oikea syy. Pidä siitä kiinni.",
        "edge_en": "When you back an underdog, you usually have a real reason. Lean into that.",
        "hooks": [
            {"fi": "Lähetämme signaaleja vain kun Sharpness on yli 60.", "en": "Send signals only when Sharpness is above 60."},
            {"fi": "Merkitsemme arvonnat, joissa pelaa joukkueesi.", "en": "Flag raffles featuring teams you follow."},
            {"fi": "Seuraamme osumaprosenttisi lajeittain.", "en": "Track your hit rate by sport."},
        ],
        "match_rules": [
            {"q_key": "bias_favorite", "tag": "bias_favorite"},
            {"q_key": "wrong_pattern", "tag": "bias_loyalty"},
        ],
    },
    {
        "slug": "gut_player", "priority": 75, "is_default": False,
        "name_fi": "VAISTOPELAAJA",
        "name_en": "THE GUT PLAYER",
        "on_site_tease_fi": "Luotat ensilukukertaan. Kärkiotteluissa se toimii — rutiinipeleissä häviää. Raporttisi sähköpostissa erottaa luokat puolestasi.",
        "on_site_tease_en": "You trust your first read. On big calls it works — on routine fixtures it loses. The report in your inbox separates the categories for you.",
        "diagnosis_fi": "Olet Vaistopelaaja. Luotat sisäiseen luentaasi enemmän kuin numeroihin. Kärkiotteluissa ja derbeissä tämä toimii.",
        "diagnosis_en": "You're a Gut Player. You trust your read more than the numbers. On big rivalries this works — on routine matches it loses.",
        "weakness_fi": "Vaisto ei skaalaudu. Useimmat arvonnat ovat rutiinipelejä, joissa data voittaa intuition.",
        "weakness_en": "Gut doesn't scale. Most raffles are routine fixtures where data beats intuition.",
        "edge_fi": "Kärkihetkien tunnistaminen. Säilytä vaisto isoille hetkille; käytä dataa kaikkeen muuhun.",
        "edge_en": "Spotting decisive moments. Keep gut for the big calls; use data for everything else.",
        "hooks": [
            {"fi": "Merkitsemme isot ottelut erikseen — vaisto kelpaa siellä.", "en": "Flag big matches — gut is fine there."},
            {"fi": "Lähetämme datan rutiineissa.", "en": "Send data on routine fixtures."},
            {"fi": "Seuraamme osumaprosenttiasi kärki- vs rutiinipeleissä.", "en": "Track hit rate on big vs routine matches."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "bias_gut"},
            {"q_key": "apply_mode", "tag": "mode_snap"},
        ],
    },
    {
        "slug": "underdog_hunter", "priority": 75, "is_default": False,
        "name_fi": "ALTAVASTAAJAN METSÄSTÄJÄ",
        "name_en": "THE UNDERDOG HUNTER",
        "on_site_tease_fi": "Pelaat suosikkia vastaan kun jokin vihjaa siitä. Harvinaisempi ja arvokas tyyli — jos vihjeesi ovat aitoja. Raporttisi sähköpostissa kertoo miten erotat ne meluista.",
        "on_site_tease_en": "You back against the favorite when something tips you off. A rarer and more valuable style — if your tips are real. The report in your inbox separates the signal from the noise.",
        "diagnosis_fi": "Olet Altavastaajan Metsästäjä. Pelaat suosikkia vastaan kun jokin vihjaa siitä. Harvinaisempi ja arvokkaampi tyyli — jos vihjeesi ovat aitoja.",
        "diagnosis_en": "You're an Underdog Hunter. You back against the favorite when something tips you off. A rarer and more valuable style — if your tips are real.",
        "weakness_fi": "Kaikki altavastaajat eivät ole arvokkaita. Tarkista että vihjeesi näkyy Sharpness-luvussa tai pelaajien saatavuudessa.",
        "weakness_en": "Not every underdog is valuable. Check your tip also shows up in Sharpness or availability.",
        "edge_fi": "Aitojen vihjeiden tunnistaminen — pieni informaatioetu ennen kuin se hinnoitellaan.",
        "edge_en": "Identifying real tips — small information edge before bookmakers price it.",
        "hooks": [
            {"fi": "Lähetämme altavastaaja-signaalit, joissa Sharpness on tippumassa.", "en": "Send underdog signals where Sharpness is dropping."},
            {"fi": "Näytämme saatavuuden ennen kuin se vaikuttaa kertoimiin.", "en": "Surface availability before it moves the line."},
            {"fi": "Seuraamme altavastaaja-osumaprosenttiasi erikseen.", "en": "Track your underdog hit rate separately."},
        ],
        "match_rules": [
            {"q_key": "bias_favorite", "tag": "bias_underdog"},
            {"q_key": "read_consensus", "tag": "read_consensus_y"},
        ],
    },
    {
        "slug": "quiet_sharp", "priority": 90, "is_default": False,
        "name_fi": "HILJAINEN TARKKA",
        "name_en": "THE QUIET SHARP",
        "on_site_tease_fi": "Luet markkinaa sisältäpäin, et otsikoista. Tunnistit Sharpness-idean ennen kuin käytimme sanaa. Raporttisi sähköpostissa terävöittää työkalupakkiasi.",
        "on_site_tease_en": "You read the market from inside, not the headlines. You spotted the Sharpness signal before we used the word. The report in your inbox sharpens your toolkit.",
        "diagnosis_fi": "Olet Hiljainen Tarkka. Tunnistat markkinan sisältäpäin, et reagoi otsikoihin.",
        "diagnosis_en": "You're a Quiet Sharp. You read the market from the inside, not the headlines.",
        "weakness_fi": "Ylianalysointi. Pieni etu katoaa, kun lisäät kerroksia. Sharpness > 60 + saatavuus on yleensä koko tarina.",
        "weakness_en": "Overanalysis. A small edge disappears when you add layers. Sharpness > 60 + availability is usually the whole story.",
        "edge_fi": "Markkinan tiukkuuden lukeminen. Erottaa systemaattisesti rahaa tekevät satunnaisesti voittavista.",
        "edge_en": "Reading market tightness. Separates systematic winners from occasional ones.",
        "hooks": [
            {"fi": "Suora Sharpness-syöte ilman pehmustusta.", "en": "Direct Sharpness feed, no padding."},
            {"fi": "Hälytys, kun konsensus tiukkenee yli yön.", "en": "Alert when consensus tightens overnight."},
            {"fi": "Sharpness-perustainen osumaprosenttisi.", "en": "Your Sharpness-based hit rate."},
        ],
        "match_rules": [
            {"q_key": "read_consensus", "tag": "read_consensus_y"},
            {"q_key": "analysis_priority", "tag": "analysis_priority_consensus"},
        ],
    },
    {
        "slug": "cautious_analyst", "priority": 78, "is_default": False,
        "name_fi": "VAROVAINEN ANALYYTIKKO",
        "name_en": "THE CAUTIOUS ANALYST",
        "on_site_tease_fi": "Haluat datan ennen valintaa. Vahvuutesi kärsivällisyys. Heikkoutesi viime hetken epäröinti. Raporttisi sähköpostissa kertoo miksi ensilukukerta yleensä riittää.",
        "on_site_tease_en": "You want the data before you commit. Strength: patience. Weakness: last-minute hesitation. The report in your inbox explains why your first read usually wins.",
        "diagnosis_fi": "Olet Varovainen Analyytikko. Haluat datan ennen valintaa. Vahvuutesi on kärsivällisyys; heikkoutesi on hetken päättämättömyys.",
        "diagnosis_en": "You're a Cautious Analyst. You want the data before you commit. Strength: patience. Weakness: hesitation at the moment of choice.",
        "weakness_fi": "Yliajattelu. Vaihdat valintaa viime hetkellä, ja muutos on lähes aina väärä.",
        "weakness_en": "Overthinking. You switch picks at the last minute, and the switch is almost always wrong.",
        "edge_fi": "Järjestelmällinen lähestyminen. Kun lukitset valinnan, paranet nopeasti.",
        "edge_en": "Systematic approach. Once you lock a pick, you improve quickly.",
        "hooks": [
            {"fi": "Yksi pääsignaali per arvonta — ei viestien tulvaa.", "en": "One primary signal per raffle — no flood."},
            {"fi": "Pakkolukitus 1 h ennen ottelua.", "en": "Hard-lock 1h before kickoff."},
            {"fi": "Seuraamme ensimmäistä vs vaihdettua valintaasi.", "en": "Track first vs switched picks."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "bias_overthink"},
            {"q_key": "apply_mode", "tag": "mode_slow"},
        ],
    },
    {
        "slug": "crowd_follower", "priority": 65, "is_default": False,
        "name_fi": "JOUKON SEURAAJA",
        "name_en": "THE CROWD FOLLOWER",
        "on_site_tease_fi": "Lähdet siitä, mitä ympärilläsi sanotaan. Äänekäs konsensus ei kuitenkaan ole sama kuin tietoinen konsensus. Raporttisi sähköpostissa opettaa erottamaan ne.",
        "on_site_tease_en": "You start from what you hear around you. But loud consensus is not informed consensus. The report in your inbox shows you how to tell them apart.",
        "diagnosis_fi": "Olet Joukon Seuraaja. Lähdet liikkeelle siitä, mitä ympärilläsi sanotaan.",
        "diagnosis_en": "You're a Crowd Follower. You start from what you hear around you.",
        "weakness_fi": "Some- ja keskustelupalstojen hälinä ei korreloi vedonvälittäjien kabinettitiedon kanssa.",
        "weakness_en": "Social-media and forum buzz doesn't correlate with bookmakers' inside-room knowledge.",
        "edge_fi": "Olet hyvä lukemaan tunnelmaa. Käytä sitä yleisön valintojen tunnistamiseen — ja vetäydy niistä.",
        "edge_en": "You're good at reading mood. Use it to spot crowd picks — and step away from them.",
        "hooks": [
            {"fi": "Vertaamme Sharpnessia someäänekkyyteen.", "en": "Compare Sharpness to social buzz."},
            {"fi": "Hälytys: hälinää, mutta Sharpness < 50.", "en": "Alert: loud buzz but Sharpness < 50."},
            {"fi": "Osumaprosenttisi hiljaisissa otteluissa.", "en": "Your hit rate on quiet matches."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "bias_crowd"},
            {"q_key": "apply_mode", "tag": "mode_social"},
        ],
    },
    {
        "slug": "second_guesser", "priority": 72, "is_default": False,
        "name_fi": "TOISEN ARVAUKSEN PELAAJA",
        "name_en": "THE SECOND-GUESSER",
        "on_site_tease_fi": "Olet kahden mielen valinnoistasi. Vaihdat vasta-aikaan. Lukukerta 3 nimeää tämän — raporttisi sähköpostissa kertoo miksi ensilukukerta yleensä voittaa.",
        "on_site_tease_en": "You're of two minds about your picks. You switch at the buzzer. Lesson 3 names this — the report in your inbox explains why your first read usually wins.",
        "diagnosis_fi": "Olet Toisen Arvauksen Pelaaja. Punnitset valintaasi liian pitkään ja vaihdat juuri ennen aikalukkoa.",
        "diagnosis_en": "You're a Second-Guesser. You weigh your pick too long and switch right before lockout.",
        "weakness_fi": "Viime hetken vaihto on tutkitusti huonompi kuin ensilukukerta — silloinkin kun se tuntuu varmemmalta.",
        "weakness_en": "The last-second switch is empirically worse than your first read — even when it feels safer.",
        "edge_fi": "Kun lukitset ensilukukerran, tuloksesi nousevat välittömästi. Tämä on yksi nopeimmin korjattavista kuvioista.",
        "edge_en": "Once you lock your first read, results lift immediately. One of the fastest patterns to fix.",
        "hooks": [
            {"fi": "Lukitsemme valintasi heti — ei vaihtomahdollisuutta.", "en": "Lock your pick on submit — no switch window."},
            {"fi": "Lähetämme yhden suosituksen, ei kahta.", "en": "Send one recommendation, not two."},
            {"fi": "Seuraamme ensilukukerta-osumaprosenttiasi.", "en": "Track your first-read hit rate."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "bias_overthink"},
            {"q_key": "apply_mode", "tag": "mode_chaos"},
        ],
    },
    {
        "slug": "chaos_bettor", "priority": 60, "is_default": False,
        "name_fi": "KAAOSPELAAJA",
        "name_en": "THE CHAOS BETTOR",
        "on_site_tease_fi": "Tyylisi vaihtelee. Tämä antaa vapautta — mutta tekee oppimisesta vaikeaa, koska kaava puuttuu. Raporttisi sähköpostissa ehdottaa oletustilan.",
        "on_site_tease_en": "Your style shifts. That gives freedom — but makes learning hard because the pattern is missing. The report in your inbox proposes a default mode.",
        "diagnosis_fi": "Olet Kaaospelaaja. Vaihdat tyyliä joka kerta. Ilman jatkuvuutta et voi rakentaa etua.",
        "diagnosis_en": "You're a Chaos Bettor. You switch styles every time. Without consistency you can't build an edge.",
        "weakness_fi": "Et tunne omaa peliäsi, koska et toista sitä riittävän monta kertaa. Korjattavissa yhdellä päätöksellä: valitse oletustila.",
        "weakness_en": "You don't know your own game because you don't repeat it enough. Fixable with one decision: pick a default mode.",
        "edge_fi": "Mukautumiskyky. Kun lukitset päämodisi, voit silti hypätä toiselle puolelle kun se on perusteltua.",
        "edge_en": "Adaptability. Once you lock a primary mode, you can still cross over when justified.",
        "hooks": [
            {"fi": "Suosittelemme oletustilan ja seuraamme poikkeamia.", "en": "Recommend a default mode and track deviations."},
            {"fi": "Vertailusignaali — data vs editorial.", "en": "Comparison signal — data vs editorial."},
            {"fi": "Osumaprosenttisi tiloittain.", "en": "Hit rate per mode."},
        ],
        "match_rules": [
            {"q_key": "apply_mode", "tag": "mode_chaos"},
            {"q_key": "bias_favorite", "tag": "bias_situational"},
        ],
    },
    {
        "slug": "honest_beginner", "priority": 55, "is_default": False,
        "name_fi": "REHELLINEN ALOITTELIJA",
        "name_en": "THE HONEST BEGINNER",
        "on_site_tease_fi": "Et teeskentele tietäväsi mitä et tiedä. Etu monen kokeneemman päälle. Raporttisi sähköpostissa rakentaa hyvät tavat alusta.",
        "on_site_tease_en": "You don't pretend to know what you don't. An edge over many more experienced players. The report in your inbox builds good habits from day one.",
        "diagnosis_fi": "Olet Rehellinen Aloittelija. Et teeskentele tietäväsi mitä et tiedä — ja se on jo etu.",
        "diagnosis_en": "You're an Honest Beginner. You don't pretend to know what you don't — and that's already an edge.",
        "weakness_fi": "Et tiedä omaa biaksiasi vielä, koska et ole tehnyt valintoja tarpeeksi monta kertaa.",
        "weakness_en": "You don't yet know your own bias because you haven't made enough picks.",
        "edge_fi": "Tabula rasa. Aloitat hyvistä tavoista.",
        "edge_en": "Clean slate. Start with the right habits.",
        "hooks": [
            {"fi": "Selitämme jokaisen signaalin ensimmäisellä kerralla.", "en": "Explain every signal the first time."},
            {"fi": "Lyhyet briefit alkuvaiheessa.", "en": "Short briefs early on."},
            {"fi": "Seuraamme oppimiskäyrääsi.", "en": "Track your learning curve."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "bias_unknown"},
        ],
    },
    {
        "slug": "rival_hunter", "priority": 68, "is_default": False,
        "name_fi": "DERBYJEN METSÄSTÄJÄ",
        "name_en": "THE RIVAL HUNTER",
        "on_site_tease_fi": "Pelaat parhaiten suurissa otteluissa ja derbeissä — siellä vaisto kelpaa. Raporttisi sähköpostissa erottaa kärki- ja rutiinipelit toisistaan.",
        "on_site_tease_en": "You play best on big matches and rivalries — where gut belongs. The report in your inbox separates marquee fixtures from routine ones for you.",
        "diagnosis_fi": "Olet Derbyjen Metsästäjä. Kärkihetket tunnistat — rutiinipelit kaatavat sinut. Klassinen vahvuus + heikkous -yhdistelmä.",
        "diagnosis_en": "You're a Rival Hunter. You recognise the marquee moments — routine fixtures sink you. A classic strength + weakness combo.",
        "weakness_fi": "Vaisto ei korvaa dataa tiistain kierroksilla. Kärkiotteluiden hyvä lukukerta peittää rutiiniotteluiden tappiot, kunnes se ei enää peitä.",
        "weakness_en": "Gut doesn't replace data on Tuesday fixtures. The marquee wins cover the routine losses — until they don't.",
        "edge_fi": "Tunnistat kun ottelu merkitsee. Käytä vaistoa siellä, jätä rutiinit datalle.",
        "edge_en": "You know when a match matters. Use gut there, leave the routines to the data.",
        "hooks": [
            {"fi": "Merkitsemme derbyt ja kärkiottelut — vaisto-suositus.", "en": "Flag rivalries and marquee fixtures — gut-allowed."},
            {"fi": "Rutiinipeleissä lähetämme datan, emme tunnelmaa.", "en": "On routine matches we send data, not vibes."},
            {"fi": "Seuraamme kärki- vs rutiini-osumaprosenttiasi erikseen.", "en": "Track your marquee vs routine hit rate separately."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "bias_gut"},
            {"q_key": "bias_favorite", "tag": "bias_situational"},
        ],
    },
    {
        "slug": "curious_learner", "priority": 10, "is_default": True,
        "name_fi": "UUDENOPPIJA",
        "name_en": "THE CURIOUS LEARNER",
        "on_site_tease_fi": "Sait läpi yhden diagnostiikan — enemmän kuin useimmat tekevät. Profiilisi paljastuu seuraavissa valinnoissa. Raporttisi sähköpostissa kertoo mitä seurata.",
        "on_site_tease_en": "You finished one diagnostic — more than most people do. Your profile reveals itself in the next picks. The report in your inbox tells you what to watch.",
        "diagnosis_fi": "Olet Uudenoppija. Et ole vielä lukittunut yhteen tyyliin — voit valita oikean ennen kuin tavat juurtuvat.",
        "diagnosis_en": "You're a Curious Learner. You're not yet locked into one style — you can pick the right one before habits set in.",
        "weakness_fi": "Kaavan puuttuminen tässä vaiheessa on normaalia. Seuraavat 5–10 ennustusta paljastavat taipumuksesi.",
        "weakness_en": "Lack of a pattern at this stage is normal. Your next 5–10 predictions will surface your tendency.",
        "edge_fi": "Avoimuus. Voit valita oikean tyylin ennen kuin tavat juurtuvat.",
        "edge_en": "Openness. Pick the right style before habits set in.",
        "hooks": [
            {"fi": "Pyydämme palautetta jokaisesta valinnasta.", "en": "Ask for feedback on every pick."},
            {"fi": "Molemmat näkökulmat (data + editorial) ensimmäisissä arvonnoissa.", "en": "Both views (data + editorial) for the first raffles."},
            {"fi": "Päivitämme profiilisi 5 arvonnan jälkeen.", "en": "Update your profile after 5 raffles."},
        ],
        "match_rules": [],
    },
]


def _is_clean_profile_text(*texts: str) -> bool:
    """Compliance hold — same as quiz config, no outcome claims."""
    from voita_quiz_config import _assert_compliant_copy
    for i, t in enumerate(texts):
        _assert_compliant_copy(t, field=f"profile.text[{i}]")
    return True


def sanitize_profiles(cfg) -> List[Dict[str, Any]]:
    """Clamp + sanitize admin-edited profile list. Always returns the
    default catalog when the input is structurally broken."""
    if not isinstance(cfg, list) or not cfg:
        return DEFAULT_PROFILES
    out: List[Dict[str, Any]] = []
    seen: set = set()
    for p in cfg[:24]:
        if not isinstance(p, dict):
            continue
        slug = str(p.get("slug") or "").strip().lower()[:48]
        if not slug or slug in seen:
            continue
        seen.add(slug)
        name_fi = str(p.get("name_fi") or "")[:80]
        name_en = str(p.get("name_en") or "")[:80]
        tease_fi = str(p.get("on_site_tease_fi") or "")[:400]
        tease_en = str(p.get("on_site_tease_en") or "")[:400]
        diag_fi = str(p.get("diagnosis_fi") or "")[:1200]
        diag_en = str(p.get("diagnosis_en") or "")[:1200]
        weak_fi = str(p.get("weakness_fi") or "")[:800]
        weak_en = str(p.get("weakness_en") or "")[:800]
        edge_fi = str(p.get("edge_fi") or "")[:800]
        edge_en = str(p.get("edge_en") or "")[:800]
        _is_clean_profile_text(name_fi, name_en, tease_fi, tease_en,
                               diag_fi, diag_en, weak_fi, weak_en,
                               edge_fi, edge_en)
        hooks_raw = p.get("hooks") or []
        hooks: List[Dict[str, str]] = []
        for h in hooks_raw[:6]:
            if not isinstance(h, dict):
                continue
            hf = str(h.get("fi") or "")[:240]
            he = str(h.get("en") or "")[:240]
            _is_clean_profile_text(hf, he)
            if hf or he:
                hooks.append({"fi": hf, "en": he})
        rules: List[Dict[str, str]] = []
        for r in (p.get("match_rules") or [])[:8]:
            if not isinstance(r, dict):
                continue
            qk = str(r.get("q_key") or "").strip()[:32]
            tg = str(r.get("tag") or "").strip()[:48]
            if qk and tg:
                rules.append({"q_key": qk, "tag": tg})
        out.append({
            "slug": slug,
            "priority": int(p.get("priority") or 0),
            "is_default": bool(p.get("is_default", False)),
            "name_fi": name_fi, "name_en": name_en,
            "on_site_tease_fi": tease_fi, "on_site_tease_en": tease_en,
            "diagnosis_fi": diag_fi, "diagnosis_en": diag_en,
            "weakness_fi": weak_fi, "weakness_en": weak_en,
            "edge_fi": edge_fi, "edge_en": edge_en,
            "hooks": hooks, "match_rules": rules,
        })
    return out or DEFAULT_PROFILES


def resolve_profile(profiles: List[Dict[str, Any]], answers: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Resolve user answers (q_key → tag) to a single profile.

    Strategy: for each profile, count how many `match_rules` match.
    Highest match-count wins; ties broken by `priority` desc; fallback
    to `is_default=True` profile if no rules match anywhere.
    """
    if not answers:
        return next((p for p in profiles if p.get("is_default")), profiles[0] if profiles else None)
    scored: List[tuple] = []
    for p in profiles:
        rules = p.get("match_rules") or []
        if not rules:
            continue
        matches = sum(
            1 for r in rules
            if answers.get(r.get("q_key")) == r.get("tag")
        )
        if matches > 0:
            scored.append((matches, int(p.get("priority") or 0), p))
    if scored:
        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return scored[0][2]
    return next((p for p in profiles if p.get("is_default")), profiles[0] if profiles else None)
