"""
PUTKI HQ — Voita Personal Predictor Profile system.

After a user completes the 5 lessons their answers map to one of the
named predictor profiles (THE CONFIDENT LOYALIST, THE UNDERDOG HUNTER,
THE QUIET SHARP, etc.). The mapping is rule-based + priority-ordered so
editorial can add new profiles without touching code.

Resolution rule (longest-match-wins, then priority desc):
  For each profile, count how many of its `match_rules` (q_key→tag)
  match the user's answers. Take the profile with the highest count.
  Ties broken by `priority` (higher wins). Fallback to `is_default`.

Stored at settings.voita_predictor_profiles via /api/admin/settings PUT.
Public funnel reads from /api/settings/public.
"""
from typing import Any, Dict, List, Optional


# 10 default profiles spanning the common tag combinations. Editorial
# can edit/extend via back-office. All copy passes the same compliance
# linter as the lesson copy.
DEFAULT_PROFILES: List[Dict[str, Any]] = [
    {
        "slug": "confident_loyalist", "priority": 80, "is_default": False,
        "name_fi": "ITSEVARMA LOJAALI",
        "name_en": "THE CONFIDENT LOYALIST",
        "diagnosis_fi": "Olet Suosikin Halaaja. Otat oletuksena pienemmän kertoimen valinnan. Olet 71 %:n vapaa-ajan veikkaajan joukossa. Ansa: suosikit voittavat 67 % ajasta mutta häviävät rahaa 62 % ajasta. Maksat turvasta lisähintaa, jonka kertoimet jo huomioivat.",
        "diagnosis_en": "You're a Favorite-Hugger. You take the odds-on pick by default. You're with 71% of casual predictors. The trap: favorites win 67% of the time but lose money 62% of the time. You're paying a premium for safety that the odds already account for.",
        "weakness_fi": "Lojaliteetti. Kerroit kaatuneesi vedoissa, joissa valitsit oman joukkueesi. Tämä on urheilun kallein bias — fanit yliennustavat oman joukkueensa voitot keskimäärin 8 %:lla.",
        "weakness_en": "Loyalty. You said you've crashed on bets where you picked your team. This is the most expensive bias in sports — fans of a team over-predict their team's wins by 8% on average.",
        "edge_fi": "Kun lähdet altavastaajan kannalle, sinulla on yleensä oikea syy. Osumaprosentti altavastaajiin on todennäköisesti keskimääräistä parempi — teet sitä vain, kun jokin aito vihje napsahtaa. Pidä siitä kiinni.",
        "edge_en": "When you back an underdog, you usually have a real reason. Your hit rate on underdogs is probably above average — you only do it when something genuine tips you off. Lean into that.",
        "hooks": [
            {"fi": "Lähetämme signaaleja vain kun Sharpness on yli 60 — jotta lopetat sokean veikkaamisen.",
             "en": "Send signals only when Sharpness is above 60 (so you stop betting blind)"},
            {"fi": "Merkitsemme arvonnat, joissa pelaa joukkueesi — voit tarkistaa lojaliteettibiaksen.",
             "en": "Flag raffles featuring teams you follow (so you can check the loyalty bias)"},
            {"fi": "Seuraamme osumaprosenttisi lajeittain — näet missä todellinen etusi on.",
             "en": "Track your hit rate by sport (so you can spot where your real edge is)"},
        ],
        "match_rules": [
            {"q_key": "bias_favorite", "tag": "bias_favorite"},
            {"q_key": "wrong_pattern", "tag": "wrong_pattern_loyalty"},
            {"q_key": "analysis_priority", "tag": "analysis_priority_h2h"},
        ],
    },
    {
        "slug": "underdog_hunter", "priority": 75, "is_default": False,
        "name_fi": "ALTAVASTAAJAN METSÄSTÄJÄ",
        "name_en": "THE UNDERDOG HUNTER",
        "diagnosis_fi": "Olet Altavastaajan Metsästäjä. Pelaat suosikkia vastaan kun jokin vihjaa siitä. Tämä on harvinaisempi ja arvokkaampi tyyli — jos vihjeesi ovat aitoja.",
        "diagnosis_en": "You're an Underdog Hunter. You back against the favorite when something tips you off. This is a rarer and more valuable style — if your tips are real.",
        "weakness_fi": "Riski: kaikki altavastaajat eivät ole arvokkaita. Joskus halpaa kerrointa peilataan tehokkaammin kuin uskot. Tarkista aina, että vihjeesi näkyy myös Sharpness-luvussa tai pelaajien saatavuudessa.",
        "weakness_en": "Risk: not every underdog is valuable. Sometimes the cheap line is priced more efficiently than you think. Check that your tip also shows up in Sharpness or availability.",
        "edge_fi": "Aitojen vihjeiden tunnistaminen — pieni informaatioetu, jota suuret vedonvälittäjät eivät vielä hinnoittele. Tämä on Quiet Sharp -lähestymistapaa.",
        "edge_en": "Identifying real tips — small information edge before bookmakers price it. This is a Quiet Sharp approach.",
        "hooks": [
            {"fi": "Lähetämme altavastaaja-signaalit, joissa Sharpness on tippumassa — mahdollinen markkinan virhe.",
             "en": "Send underdog signals where Sharpness is dropping — possible market mistake."},
            {"fi": "Näytämme pelaajien saatavuuden ennen kuin se vaikuttaa kertoimiin.",
             "en": "Surface availability before it moves the line."},
            {"fi": "Seuraamme altavastaaja-osumaprosenttiasi erikseen — todellista etua mittaava luku.",
             "en": "Track your underdog hit rate separately — the real edge metric."},
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
        "diagnosis_fi": "Olet Hiljainen Tarkka. Tunnistat markkinan sisältäpäin, et reagoi otsikoihin. Tunnistit Sharpness-idean ennen kuin käytimme sanaa.",
        "diagnosis_en": "You're a Quiet Sharp. You read the market from the inside, not the headlines. You recognised the Sharpness signal before we used the word.",
        "weakness_fi": "Riski: ylianalysointi. Pieni etu katoaa, kun lisäät kerroksia. Sharpness > 60 + saatavuus on yleensä koko tarina.",
        "weakness_en": "Risk: overanalysis. A small edge disappears when you add layers. Sharpness > 60 + availability is usually the whole story.",
        "edge_fi": "Markkinan tiukkuuden lukeminen. Tämä on yksittäinen taito, joka erottaa systemaattisesti rahaa tekevät satunnaisesti voittavista.",
        "edge_en": "Reading market tightness. This is the single skill that separates systematic winners from occasional ones.",
        "hooks": [
            {"fi": "Suora Sharpness-syöte ilman pehmustusta.",
             "en": "Direct Sharpness feed, no padding."},
            {"fi": "Hälytys, kun konsensus tiukkenee yli yön — usein hiljainen signaali.",
             "en": "Alert when consensus tightens overnight — often a quiet signal."},
            {"fi": "Seuraamme Sharpness-perustaista osumaprosenttiasi — todellinen kompetenssimittari.",
             "en": "Track your Sharpness-based hit rate — the real competence metric."},
        ],
        "match_rules": [
            {"q_key": "read_consensus", "tag": "read_consensus_y"},
            {"q_key": "analysis_priority", "tag": "analysis_priority_consensus"},
        ],
    },
    {
        "slug": "gut_player", "priority": 70, "is_default": False,
        "name_fi": "VAISTOPELAAJA",
        "name_en": "THE GUT PLAYER",
        "diagnosis_fi": "Olet Vaistopelaaja. Luotat sisäiseen luentaasi enemmän kuin numeroihin. Kärkiotteluissa ja derbeissä tämä toimii — rutiinipeleissä häviää.",
        "diagnosis_en": "You're a Gut Player. You trust your read more than the numbers. On big rivalries this works — on routine matches it loses.",
        "weakness_fi": "Vaisto ei skaalaudu. Korkeaprofiilisten otteluiden tunnistaminen on hyvä — mutta enemmistö arvonnoista on rutiinipelejä, joissa data voittaa intuition.",
        "weakness_en": "Gut doesn't scale. Spotting high-profile matches is good — but most raffles are routine fixtures where data beats intuition.",
        "edge_fi": "Kärkihetkien tunnistaminen. Säilytä vaisto isoille hetkille; käytä dataa kaikkeen muuhun.",
        "edge_en": "Spotting decisive moments. Keep gut for the big calls; use data for everything else.",
        "hooks": [
            {"fi": "Merkitsemme arvonnat, joissa vaisto historiallisesti pesee dataa — voit luottaa siihen.",
             "en": "Flag raffles where gut historically beats data — trust it there."},
            {"fi": "Merkitsemme rutiinipelit erikseen — sinun pitää erottaa luokat.",
             "en": "Flag routine fixtures separately — you need to separate the categories."},
            {"fi": "Seuraamme osumaprosenttiasi kärki- vs rutiinipeleissä — opit oman jakaumasi.",
             "en": "Track your hit rate on big vs routine matches — learn your distribution."},
        ],
        "match_rules": [
            {"q_key": "bias_favorite", "tag": "bias_balanced"},
            {"q_key": "wrong_pattern", "tag": "wrong_pattern_gut"},
            {"q_key": "apply_mode", "tag": "mode_gut"},
        ],
    },
    {
        "slug": "cautious_analyst", "priority": 78, "is_default": False,
        "name_fi": "VAROVAINEN ANALYYTIKKO",
        "name_en": "THE CAUTIOUS ANALYST",
        "diagnosis_fi": "Olet Varovainen Analyytikko. Haluat datan ennen valintaa. Vahvuutesi on kärsivällisyys; heikkoutesi on hetken päättämättömyys.",
        "diagnosis_en": "You're a Cautious Analyst. You want the data before you commit. Strength: patience. Weakness: hesitation at the moment of choice.",
        "weakness_fi": "Yliajattelu. Vaihdat valintaa viime hetkellä, ja muutos on lähes aina väärä. Ensimmäinen luentasi on yleensä oikein.",
        "weakness_en": "Overthinking. You switch picks at the last minute, and the switch is almost always wrong. Your first read is usually right.",
        "edge_fi": "Järjestelmällinen lähestyminen. Kun lukitset valinnan ja seuraat tulosta, paranet nopeasti.",
        "edge_en": "Systematic approach. Once you lock a pick and track the result, you improve quickly.",
        "hooks": [
            {"fi": "Lähetämme yhden pääsignaalin per arvonta — ei viestien tulvaa.",
             "en": "Send one primary signal per raffle — no flood."},
            {"fi": "Pakkolukitus 1 h ennen ottelua — lopetamme viime hetken vaihdot.",
             "en": "Hard-lock 1h before kickoff — stops your last-minute switches."},
            {"fi": "Seuraamme ensimmäistä vs vaihdettua valintaasi — näytät itse mikä toimii.",
             "en": "Track first vs switched picks — you'll see which works."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "wrong_pattern_overthink"},
            {"q_key": "apply_mode", "tag": "mode_data"},
        ],
    },
    {
        "slug": "crowd_follower", "priority": 65, "is_default": False,
        "name_fi": "JOUKON SEURAAJA",
        "name_en": "THE CROWD FOLLOWER",
        "diagnosis_fi": "Olet Joukon Seuraaja. Lähdet liikkeelle siitä, mitä ympärilläsi sanotaan. Äänekäs konsensus ei kuitenkaan ole sama asia kuin tietoinen konsensus.",
        "diagnosis_en": "You're a Crowd Follower. You start from what you hear around you. But loud consensus is not informed consensus.",
        "weakness_fi": "Some- ja keskustelupalstojen hälinä ei korreloi vedonvälittäjien kabinettitiedon kanssa. Hälinä on viihdettä; Sharpness on signaali.",
        "weakness_en": "Social-media and forum buzz doesn't correlate with bookmakers' inside-room knowledge. Buzz is entertainment; Sharpness is signal.",
        "edge_fi": "Olet hyvä lukemaan tunnelmaa. Käytä sitä yleisön valintojen tunnistamiseen — ja vetäydy niistä.",
        "edge_en": "You're good at reading mood. Use it to spot crowd picks — and step away from them.",
        "hooks": [
            {"fi": "Vertaamme Sharpnessia someäänekkyyteen — näet konsensuksen vs hälinän.",
             "en": "Compare Sharpness to social buzz — see consensus vs noise."},
            {"fi": "Hälytys ottelusta, jossa hälinä huutaa mutta Sharpness on alle 50 — todennäköinen ansa.",
             "en": "Alert when buzz is loud but Sharpness is below 50 — likely trap."},
            {"fi": "Seuraamme osumaprosenttiasi hiljaisissa otteluissa — yleensä parempi kuin meluisissa.",
             "en": "Track your hit rate on quiet matches — usually better than noisy ones."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "wrong_pattern_consensus"},
        ],
    },
    {
        "slug": "honest_beginner", "priority": 60, "is_default": False,
        "name_fi": "REHELLINEN ALOITTELIJA",
        "name_en": "THE HONEST BEGINNER",
        "diagnosis_fi": "Olet Rehellinen Aloittelija. Et teeskentele tietäväsi mitä et tiedä — ja se on jo etu monen kokeneemman päälle.",
        "diagnosis_en": "You're an Honest Beginner. You don't pretend to know what you don't — and that's already an edge over many more experienced players.",
        "weakness_fi": "Et tiedä omaa biaksiasi vielä, koska et ole tehnyt valintoja tarpeeksi monta kertaa. Tämä korjautuu vain seuraamalla tuloksia.",
        "weakness_en": "You don't yet know your own bias because you haven't made enough picks. Only fixed by tracking results.",
        "edge_fi": "Tabula rasa. Aloitat hyvistä tavoista — Sharpness ensin, lojaliteetti tarkistuksessa, seurantaa alusta asti.",
        "edge_en": "Clean slate. Start with the right habits — Sharpness first, loyalty checked, tracking from day one.",
        "hooks": [
            {"fi": "Selitämme jokaisen signaalin ensimmäisellä kerralla — opit nopeasti.",
             "en": "Explain every signal the first time — learn fast."},
            {"fi": "Pidämme alkuvaiheen briefit lyhyinä — yksi mittari kerrallaan.",
             "en": "Keep early-stage briefs short — one metric at a time."},
            {"fi": "Seuraamme oppimiskäyrääsi — näet konkreettisen edistyksen.",
             "en": "Track your learning curve — you see real progress."},
        ],
        "match_rules": [
            {"q_key": "wrong_pattern", "tag": "wrong_pattern_no_tracking"},
        ],
    },
    {
        "slug": "balanced_observer", "priority": 55, "is_default": False,
        "name_fi": "TASAPAINOINEN TARKKAILIJA",
        "name_en": "THE BALANCED OBSERVER",
        "diagnosis_fi": "Olet Tasapainoinen Tarkkailija. Sekoitat tyylejä ilman vahvaa kaavaa. Tämä on rehellistä — ja korjattavissa kun tunnistat tilanteet, joissa kallistut.",
        "diagnosis_en": "You're a Balanced Observer. You mix styles without a strong pattern. That's honest — and fixable once you spot the situations where you lean.",
        "weakness_fi": "Ilman selkeää kaavaa et voi seurata, kumpi puolesi toimii. Päätös tarvitaan: data-painotteinen vai vaistolähtöinen oletustila.",
        "weakness_en": "Without a clear pattern, you can't track which side works. Decision needed: data-led or gut-led default mode.",
        "edge_fi": "Joustavuus. Kun valitset oletustilan, voit silti hypätä toiselle puolelle silloin kun se on perusteltua.",
        "edge_en": "Flexibility. Once you pick a default, you can still cross over when justified.",
        "hooks": [
            {"fi": "Pyydämme valitsemaan oletustilan ja seuraamme poikkeamia.",
             "en": "Ask you to pick a default mode and track deviations."},
            {"fi": "Vertailusignaali jokaisesta arvonnasta — data vs editorial.",
             "en": "Comparison signal on every raffle — data vs editorial."},
            {"fi": "Seuraamme osumaprosenttiasi tiloittain — näet kumpi puoli on sinun.",
             "en": "Track hit rate per mode — see which side is yours."},
        ],
        "match_rules": [
            {"q_key": "bias_favorite", "tag": "bias_balanced"},
        ],
    },
    {
        "slug": "situational_chaser", "priority": 50, "is_default": False,
        "name_fi": "TILANNETOIMIJA",
        "name_en": "THE SITUATIONAL CHASER",
        "diagnosis_fi": "Olet Tilannetoimija. Tyylisi riippuu lajista, fiiliksestä ja päivästä. Tämä antaa vapautta — mutta tekee oppimisesta vaikeampaa, koska kaava puuttuu.",
        "diagnosis_en": "You're a Situational Chaser. Style depends on sport, mood, and day. That gives freedom — but makes learning harder because the pattern is missing.",
        "weakness_fi": "Ilman jatkuvuutta et voi rakentaa edusta. Yksi laji per kerta — opi sen rakennetta ennen kuin lisäät.",
        "weakness_en": "Without consistency you can't build an edge. One sport at a time — learn its structure before adding another.",
        "edge_fi": "Mukautumiskyky. Kun lukitset päälajisi, voit toistaa onnistumisesi.",
        "edge_en": "Adaptability. Once you lock your primary sport, you can replicate your wins.",
        "hooks": [
            {"fi": "Suosittelemme yhtä päälajia kerrallaan — keskitymme siihen.",
             "en": "Recommend one primary sport at a time — focus there."},
            {"fi": "Lähetämme signaaleja vain päälajistasi seuraavat 2 viikkoa.",
             "en": "Send signals only from your primary sport for the next 2 weeks."},
            {"fi": "Seuraamme lajikohtaista osumaprosenttiasi — näet jakaumasi.",
             "en": "Track per-sport hit rate — see your distribution."},
        ],
        "match_rules": [
            {"q_key": "bias_favorite", "tag": "bias_situational"},
        ],
    },
    {
        "slug": "curious_learner", "priority": 10, "is_default": True,
        "name_fi": "UUDENOPPIJA",
        "name_en": "THE CURIOUS LEARNER",
        "diagnosis_fi": "Olet Uudenoppija. Päädyit profiiliin ilman vahvaa kaavaa — mutta sait jo läpi yhden lukukerran. Se on enemmän kuin useimmat tekevät.",
        "diagnosis_en": "You're a Curious Learner. You arrived without a strong pattern — but you just finished one full lesson. That's more than most people do.",
        "weakness_fi": "Kaavan puuttuminen vielä tässä vaiheessa on normaalia. Seuraavat 5–10 ennustusta paljastavat oman taipumuksesi.",
        "weakness_en": "Lack of a pattern at this stage is normal. Your next 5–10 predictions will surface your tendency.",
        "edge_fi": "Avoimuus. Et ole vielä lukittu yhteen tyyliin — voit valita oikean ennen kuin tavat juurtuvat.",
        "edge_en": "Openness. You're not yet locked into one style — you can pick the right one before habits set in.",
        "hooks": [
            {"fi": "Pyydämme palautetta jokaisesta valinnasta — opit oman profiilisi nopeammin.",
             "en": "Ask for feedback on every pick — learn your profile faster."},
            {"fi": "Annamme molemmat näkökulmat (data + editorial) ensimmäiset 5 arvontaa.",
             "en": "Give both views (data + editorial) for the first 5 raffles."},
            {"fi": "Päivitämme profiilisi 5 arvonnan jälkeen — tarkkuus paranee.",
             "en": "Update your profile after 5 raffles — accuracy improves."},
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
        diag_fi = str(p.get("diagnosis_fi") or "")[:1200]
        diag_en = str(p.get("diagnosis_en") or "")[:1200]
        weak_fi = str(p.get("weakness_fi") or "")[:800]
        weak_en = str(p.get("weakness_en") or "")[:800]
        edge_fi = str(p.get("edge_fi") or "")[:800]
        edge_en = str(p.get("edge_en") or "")[:800]
        _is_clean_profile_text(name_fi, name_en, diag_fi, diag_en, weak_fi, weak_en, edge_fi, edge_en)
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
