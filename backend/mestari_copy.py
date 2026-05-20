"""
PUTKI HQ — Mestari page copy editor.

Everything visible on the /mestari intro surface is editable through this
module. A single Mongo doc (`settings._id='mestari_copy'`) overlays admin
edits onto the DEFAULT_MESTARI_COPY tree. The frontend hook fetches the
merged result from /api/mestari/copy and falls back to defaults when
missing or when the admin doc is absent.

Schema mirrors the COPY constant inside Mestari.jsx. Repeating items
(cred cells, method cards, stack items, step rows, faq items, clarity
bullets, final meta tokens, footer links) are arrays of objects/strings
with stable shape. Length caps in sanitize_and_merge prevent the doc
from growing unbounded.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ── Defaults (mirror the COPY const at the top of Mestari.jsx) ─────────
DEFAULT_MESTARI_COPY: Dict[str, Any] = {
    "header": {
        "back_fi": "PUTKIHQ", "back_en": "PUTKIHQ",
    },
    "hero": {
        "fi": {
            "eyebrow": "Mestari · Toimituksellinen diagnostiikka · Tutkimustyökalu",
            "headline": "Millainen urheiluvedonlyöjä sinä olet?",
            "sub": "90 sekunnin diagnostiikka, joka perustuu vedonlyöntimarkkinoiden tutkimukseen. Vastaa viiteen kysymykseen siitä, miten luet ottelua — saat henkilökohtaisen analyyttisen profiilin ja 5 päivän pelikirjan siihen, miten markkinat oikeasti käyttäytyvät.",
            "positioning_strong": "Tämä on tutkimus- ja analytiikkatyökalu.",
            "positioning_rest": " Mestari tutkii, miten vedonlyöntimarkkinat liikkuvat ja miten ihmiset tulkitsevat niitä. Se ei ole vedonlyöntineuvontaa, se ei mainosta rahapelaamista, eikä se koskaan kerro mitä lyödä vetoa. Vain opetuskäyttöön.",
            "cta": "Aloita diagnostiikka →",
            "meta_1": "90 sekuntia",
            "meta_2": "Maksuton",
            "meta_3": "Ei talletusta",
            "meta_4": "Ei vedonlyöntiä",
        },
        "en": {
            "eyebrow": "Mestari · Editorial diagnostic · Research tool",
            "headline": "What kind of sports bettor are you?",
            "sub": "A 90-second diagnostic grounded in betting-market research. Answer five questions about how you read a match — receive a personal analytical profile and a 5-day playbook on how the markets actually behave.",
            "positioning_strong": "This is a research and analytics tool.",
            "positioning_rest": " Mestari studies how betting markets move and how people interpret them. It is not betting advice, it does not promote gambling, and it will never tell you what to bet. For educational use only.",
            "cta": "Start the diagnostic →",
            "meta_1": "90 seconds",
            "meta_2": "Free",
            "meta_3": "No deposit",
            "meta_4": "No betting",
        },
    },
    "cred": [
        {"num": "11", "unit_fi": " lähdettä", "unit_en": " sources",
         "desc_fi": "Julkista markkina- ja skenedatalähdettä analysoidaan",
         "desc_en": "Public market and scene data feeds analysed"},
        {"num": "0", "unit_fi": " muokkausta", "unit_en": " overrides",
         "desc_fi": "Ei toimituksen sormea mallissa. Sama data, sama tulos.",
         "desc_en": "No editorial finger on the model. Same data, same output."},
        {"num": "5", "unit_fi": " päivää", "unit_en": " days",
         "desc_fi": "Strukturoitu pelikirja markkinakäyttäytymisen lukemiseen",
         "desc_en": "Structured playbook on reading market behaviour"},
        {"num": "90", "unit_fi": " sek", "unit_en": " sec",
         "desc_fi": "Suoritusaika · 5 tutkimuspohjaista kysymystä",
         "desc_en": "Run time · 5 research-grounded questions"},
    ],
    "method": {
        "label_fi": "Menetelmä · Miten Mestari analysoi",
        "label_en": "Method · How Mestari analyses",
        "intro_pre_fi": "Mestari soveltaa ",
        "intro_em_fi": "strukturoitua analyyttistä viitekehystä",
        "intro_post_fi": " kysymykseen, johon useimmat vastaavat vaistolla: miten oikeasti luet vedonlyöntimarkkinaa? Diagnostiikka pohjautuu dokumentoituun tutkimukseen päätöksenteosta, markkinatehokkuudesta ja vinoumista.",
        "intro_pre_en": "Mestari applies a ",
        "intro_em_en": "structured analytical framework",
        "intro_post_en": " to a question most people answer on instinct: how do you actually read a betting market? The diagnostic draws on documented research in decision-making, market efficiency and cognitive bias.",
        "cards": [
            {
                "num_fi": "01 · Viitekehys", "num_en": "01 · Framework",
                "title_fi": "Tutkimuspohjaiset kysymykset", "title_en": "Research-grounded questions",
                "body_pre_fi": "Jokainen viidestä kysymyksestä vastaa tunnistettua ennustavan päätöksenteon ulottuvuutta — ankkurointia, tuoreuden painotusta, markkinaluottamusta, vastavirran vaistoa ja tiedon käsittelyä. Diagnostiikka rakentuu ",
                "body_em_fi": "tunnetulle käyttäytymistutkimukselle",
                "body_post_fi": ", ei mielipiteille.",
                "body_pre_en": "Each of the five questions targets a recognised dimension of predictive decision-making — anchoring, recency weighting, market trust, contrarian instinct and information processing. The diagnostic is built on ",
                "body_em_en": "established behavioural research",
                "body_post_en": ", not opinion.",
                "tag_fi": "Käyttäytymistiede · Päätöksenteon teoria",
                "tag_en": "Behavioural science · Decision theory",
            },
            {
                "num_fi": "02 · Data", "num_en": "02 · Data",
                "title_fi": "Todelliset markkinasignaalit", "title_en": "Real market signals",
                "body_pre_fi": "Profiilisi tulkitaan suhteessa kuvioihin, joita havaitaan ",
                "body_em_fi": "11 julkisessa datalähteessä",
                "body_post_fi": " — kertoimien hajonta, markkinaliike ja skeneaktiivisuus. Analysoimme miten markkinat käyttäytyvät; emme ennusta lopputuloksia.",
                "body_pre_en": "Your profile is read against patterns observed across ",
                "body_em_en": "11 public data sources",
                "body_post_en": " — odds dispersion, market movement and scene activity. We analyse how markets behave; we do not predict outcomes.",
                "tag_fi": "Julkinen data · Kerroin-API:t · EU-markkinat",
                "tag_en": "Public data · Odds APIs · EU markets",
            },
            {
                "num_fi": "03 · Mallit", "num_en": "03 · Models",
                "title_fi": "Tekoälyavusteinen analyysi", "title_en": "AI-assisted analysis",
                "body_pre_fi": "Käytämme koneoppivaa luokittelua tulkitaksemme vastauskuviot johdonmukaisesti ja nostaaksemme esiin profiiliisi sopivimman pelikirjan. ",
                "body_em_fi": "Mallit avustavat analyysiä",
                "body_post_fi": " — ne tarkistetaan kiinteää menetelmää vasten, ei jätetä toimimaan valvomatta.",
                "body_pre_en": "We use machine-learning classification to interpret answer patterns consistently and to surface the playbook that best fits your profile. ",
                "body_em_en": "Models assist analysis",
                "body_post_en": " — they are checked against a fixed method, not left to run unsupervised.",
                "tag_fi": "ML-luokittelu · Ihmisen tarkistama",
                "tag_en": "ML classification · Human-reviewed",
            },
            {
                "num_fi": "04 · Läpinäkyvyys", "num_en": "04 · Transparency",
                "title_fi": "Dokumentoitu menetelmä", "title_en": "Documented method",
                "body_pre_fi": "Jokainen profiili, pistemäärä ja oppitunti jäljittyy ",
                "body_em_fi": "dokumentoituun menetelmään",
                "body_post_fi": ". Toimituksellista muokkausta ei ole — samat vastaukset tuottavat aina saman profiilin. Voit pyytää koko menetelmäkuvauksen.",
                "body_pre_en": "Every profile, score and lesson traces back to a ",
                "body_em_en": "documented method",
                "body_post_en": ". There is no editorial override — the same answers always yield the same profile. The full methodology is available on request.",
                "tag_fi": "Avoin menetelmä · Toistettava",
                "tag_en": "Open method · Reproducible",
            },
        ],
    },
    "stack": {
        "label_fi": "Mitä diagnostiikan takana on",
        "label_en": "What sits behind the diagnostic",
        "items": [
            {"label_fi": "Datakerros", "label_en": "Data layer",
             "title_fi": "Live-markkinasyötteet", "title_en": "Live market feeds",
             "body_fi": "Jatkuva julkisten kertoimien ja markkinaliikedatan keruu eurooppalaisista kirjoista — samat raakasyötteet kuin ammattimaisilla markkina-analyytikoilla.",
             "body_en": "Continuous ingestion of public odds and market-movement data from European books — the same raw feeds professional market analysts work with."},
            {"label_fi": "Analyysikerros", "label_en": "Analysis layer",
             "title_fi": "Todennäköisyysmallinnus", "title_en": "Probability modelling",
             "body_fi": "Implisiittisen todennäköisyyden laskenta ja hajontapisteytys kvantifioivat, kuinka varma — ja kuinka jakautunut — markkina on. Tilastoa, ei ennusteita.",
             "body_en": "Implied-probability calculations and dispersion scoring quantify how confident — and how split — a market is. Statistics, not predictions."},
            {"label_fi": "Älykkyyskerros", "label_en": "Intelligence layer",
             "title_fi": "Tekoälyluokittelu, tarkistettuna", "title_en": "AI classification, reviewed",
             "body_fi": "Koneoppivat mallit luokittelevat vastauskuviot ja yhdistävät ne tutkimusviitekehykseen. Jokainen tulos tarkistetaan kiinteää menetelmää vasten.",
             "body_en": "Machine-learning models classify answer patterns and map them onto the research framework. Every output is checked against a fixed method."},
        ],
    },
    "steps": {
        "label_fi": "Mitä tapahtuu kun aloitat",
        "label_en": "What happens when you start",
        "rows": [
            {"num": "1",
             "title_fi": "Viisi kysymystä · noin 90 sekuntia", "title_en": "Five questions · about 90 seconds",
             "desc_fi": "Jokainen kysymys tutkii yhtä ulottuvuutta siinä, miten luet ottelua. Oikeita vastauksia ei ole — diagnostiikka mittaa analyyttistä tyyliäsi, ei tietämystäsi.",
             "desc_en": "Each question explores one dimension of how you read a match. There are no correct answers — the diagnostic measures analytical style, not knowledge."},
            {"num": "2",
             "title_fi": "Analyyttinen profiilisi", "title_en": "Your analytical profile",
             "desc_fi": "Malli luokittelee vastauksesi yhdeksi tutkimuksessa määritellyistä ennustajaprofiileista, selkokielisellä selityksellä siitä, missä tyyli on vahva ja missä se taipuu harhaan.",
             "desc_en": "The model classifies your answers into one of the predictor profiles defined in the research, with a plain-language read on where your style is strong and where it tends to bend."},
            {"num": "3",
             "title_fi": "Koko raportti + 5 päivän pelikirja", "title_en": "Full report + 5-day playbook",
             "desc_fi": "Anna sähköpostisi ja lähetämme täyden raportin sekä viiden päivän opetussarjan siitä, miten vedonlyöntimarkkinat käyttäytyvät. Vain sähköposti — muuta tietoa ei kerätä.",
             "desc_en": "Hand over your email and we send the full report plus a five-day teaching series on how betting markets behave. Email only — no other data is collected."},
        ],
    },
    "clarity": {
        "label_fi": "Tärkeää · Mitä Mestari on ja mitä se ei ole",
        "label_en": "Important · What Mestari is and is not",
        "is_head_fi": "Mitä Mestari on", "is_head_en": "What Mestari is",
        "is_items_fi": [
            "Tutkimus- ja analytiikkatyökalu, joka tutkii markkinoiden liikettä",
            "Opetuksellinen diagnostiikka päätöksenteosta ja vinoumista",
            "Strukturoitu, dokumentoitu ja toistettava menetelmä",
            "Maksuton — ei talletusta, ei tiliä",
        ],
        "is_items_en": [
            "A research and analytics tool studying market movement",
            "An educational diagnostic on decision-making and bias",
            "A structured, documented, reproducible method",
            "Free — no deposit, no account",
        ],
        "isnt_head_fi": "Mitä Mestari ei ole", "isnt_head_en": "What Mestari is not",
        "isnt_items_fi": [
            "Ei vedonlyöntineuvontaa eikä vihjepalvelua",
            "Ei rahapelaamisen eikä minkään peliyhtiön mainontaa",
            "Ei minkään ottelun lopputuloksen ennustetta",
            "Ei tulostakuu — mikään menetelmä ei poista riskiä",
        ],
        "isnt_items_en": [
            "Not betting advice and not a tipster service",
            "Not gambling promotion or promotion of any operator",
            "Not a prediction of any match outcome",
            "No outcome guarantee — no method removes risk",
        ],
    },
    "team": {
        "label_fi": "Kuka tämän rakensi",
        "label_en": "Who built this",
        "initial": "D",
        "eyebrow_fi": "Perustaja · 9 vuotta Suomen vedonlyöntiskenen parissa",
        "eyebrow_en": "Founder · 9 years inside the Finnish betting scene",
        "quote_pre_fi": "Rakensimme Mestarin koska useimmat lukevat vedonlyöntimarkkinaa ",
        "quote_em_fi": "vaistolla eivätkä koskaan tarkista vaistoa",
        "quote_post_fi": ". Diagnostiikka antaa selkeän, tutkimukseen pohjaavan kuvan siitä, miten oikeasti ajattelet.",
        "quote_pre_en": "We built Mestari because most people read a betting market ",
        "quote_em_en": "on instinct and never check the instinct",
        "quote_post_en": ". The diagnostic gives a clear, research-grounded picture of how you actually think.",
        "sign_name": "Dioni V.",
        "sign_rest_fi": " · Perustaja · Putki HQ",
        "sign_rest_en": " · Founder · Putki HQ",
        "cred_pre_fi": "Helsinki · Menetelmä rakennettu julkiselle datalle ja dokumentoidulle tutkimukselle · ",
        "cred_pre_en": "Helsinki · Method built on public data and documented research · ",
        "cred_link_fi": "Menetelmäkuvaus pyynnöstä →",
        "cred_link_en": "Methodology on request →",
    },
    "faq": {
        "label_fi": "Kysymyksiä ennen aloitusta",
        "label_en": "Questions before you start",
        "items": [
            {"q_fi": "Onko tämä vedonlyöntineuvontaa?", "q_en": "Is this betting advice?",
             "a_fi": "Ei. Mestari on tutkimus- ja analytiikkatyökalu. Se tutkii miten vedonlyöntimarkkinat käyttäytyvät ja miten ihmiset tulkitsevat niitä. Se ei koskaan kerro mitä lyödä vetoa, eikä se mainosta rahapelaamista. Tarkoitettu opetuskäyttöön.",
             "a_en": "No. Mestari is a research and analytics tool. It studies how betting markets behave and how people interpret them. It will never tell you what to bet, and it does not promote gambling. For educational use."},
            {"q_fi": "Pitääkö minun lyödä vetoa jotain?", "q_en": "Do I have to bet anything?",
             "a_fi": "Ei. Missään vaiheessa ei ole talletusta, panosta tai rahapelitiliä. Diagnostiikka on kyselylomake analyyttisestä tyylistä.",
             "a_en": "No. There is no deposit, no stake and no gambling account at any point. The diagnostic is a questionnaire on analytical style."},
            {"q_fi": "Mitä teette sähköpostiosoitteellani?", "q_en": "What do you do with my email?",
             "a_fi": "Käytämme sitä kerran raporttisi lähettämiseen ja sen jälkeen viiden päivän opetussarjaan. Muuta henkilötietoa ei kerätä. Voit perua tilauksen milloin tahansa. GDPR-yhteensopiva.",
             "a_en": "We use it once to send your report and then for the 5-day teaching series. No other personal data is collected. You can unsubscribe at any time. GDPR compliant."},
            {"q_fi": "Miten profiili lasketaan?", "q_en": "How is the profile calculated?",
             "a_fi": "Viisi vastaustasi luokitellaan kiinteää tutkimusviitekehystä vasten tekoälyavusteisella analyysillä, joka tarkistetaan dokumentoitua menetelmää vasten. Samat vastaukset tuottavat aina saman profiilin — toimituksellista muokkausta ei ole.",
             "a_en": "Your five answers are classified against a fixed research framework with AI-assisted analysis that is checked against a documented method. The same answers always yield the same profile — there is no editorial override."},
        ],
    },
    "final": {
        "eyebrow_fi": "→ Diagnostiikka · 90 sekuntia · Maksuton",
        "eyebrow_en": "→ Diagnostic · 90 seconds · Free",
        "headline_pre_fi": "Selvitä, miten ",
        "headline_em_fi": "oikeasti",
        "headline_post_fi": " luet markkinaa.",
        "headline_pre_en": "Find out how you ",
        "headline_em_en": "actually",
        "headline_post_en": " read the market.",
        "cta_fi": "Aloita diagnostiikka →",
        "cta_en": "Start the diagnostic →",
        "meta_fi_1": "Tutkimustyökalu", "meta_fi_2": "Ei vedonlyöntiä",
        "meta_fi_3": "Ei talletusta", "meta_fi_4": "Vain sähköposti", "meta_fi_5": "GDPR",
        "meta_en_1": "Research tool", "meta_en_2": "No betting",
        "meta_en_3": "No deposit", "meta_en_4": "Email only", "meta_en_5": "GDPR",
    },
    "trust": {
        "fi": {
            "pill_1": "GDPR",
            "pill_2": "Ei spämmiä",
            "pill_3": "Emme myy tietoja",
            "pill_4": "Vain sähköposti",
            "note": "Tietosi tallennetaan tämän raportin lähettämistä varten. Käytämme niitä vain raporttiin ja 5 päivän oppaaseen. Emme jaa, myy tai luovuta tietojasi kolmansille osapuolille. Peruuttamislinkki jokaisessa viestissä.",
            "accept_pre": "Hyväksyn ",
            "accept_link": "tietosuojaehdot",
            "accept_post": " ja haluan vastaanottaa raportin + 5 päivän pelikirjan.",
        },
        "en": {
            "pill_1": "GDPR",
            "pill_2": "No spam",
            "pill_3": "We never sell data",
            "pill_4": "Email only",
            "note": "Your email is stored to send this report. We use it only for the report and the 5-day playbook. We never share, sell or pass on your data to third parties. An unsubscribe link sits in every message.",
            "accept_pre": "I accept the ",
            "accept_link": "privacy policy",
            "accept_post": " and want to receive the report + 5-day playbook.",
        },
        "links": [
            {"href": "/ehdot", "label_fi": "Tietosuoja & GDPR", "label_en": "Privacy & GDPR"},
            {"href": "/menetelma", "label_fi": "Miten viestimme", "label_en": "How we communicate"},
            {"href": "/tietoa-meista", "label_fi": "Ota yhteyttä", "label_en": "Contact"},
        ],
    },
    "footer": {
        "home_fi": "← Takaisin Putki HQ:hun",
        "home_en": "← Back to Putki HQ",
        "links": [
            {"href": "#", "label_fi": "Menetelmä", "label_en": "Method"},
            {"href": "/tietosuoja", "label_fi": "Tietosuoja", "label_en": "Privacy"},
            {"href": "/ehdot", "label_fi": "Ehdot", "label_en": "Terms"},
            {"href": "/yhteys", "label_fi": "Yhteys", "label_en": "Contact"},
        ],
        "disclaimer_fi": "Mestari on Putki HQ:n toimituksellinen tutkimus- ja analytiikkatuote. Se analysoi julkisesti saatavilla olevaa vedonlyöntimarkkinadataa opetustarkoituksessa. Mestari ei tarjoa vedonlyöntineuvontaa, ei ennusta otteluiden lopputuloksia eikä mainosta rahapelaamista tai mitään peliyhtiötä. Mikään tällä sivulla ei ole kehotus pelata rahapelejä. Jos rahapelaaminen huolettaa, apua on saatavilla — Suomessa katso ",
        "disclaimer_en": "Mestari is an editorial research and analytics product by Putki HQ. It analyses publicly available betting-market data for educational purposes. Mestari does not provide betting advice, does not predict match outcomes and does not promote gambling or any operator. Nothing on this page is an invitation to gamble. If gambling is a concern, help is available — in Finland see ",
        "disclaimer_link_href": "https://peluuri.fi",
        "disclaimer_link_label": "peluuri.fi",
        "disclaimer_tail_fi": ". 18+.",
        "disclaimer_tail_en": ". 18+.",
    },
}


# Field-length caps. Anything beyond is silently truncated.
_SHORT = 80
_MED = 240
_LONG = 800
_PARA = 2000


def _trunc(value: Any, cap: int) -> Optional[str]:
    if value is None or not isinstance(value, str):
        return None
    v = value.strip()
    if not v:
        return None
    return v[:cap]


def _merge_strings(default: Dict[str, Any], override: Dict[str, Any], caps: Dict[str, int]) -> Dict[str, Any]:
    """Merge a flat dict of strings with per-key caps."""
    out: Dict[str, Any] = dict(default)
    for key, cap in caps.items():
        if key in (override or {}):
            cleaned = _trunc(override.get(key), cap)
            if cleaned is not None:
                out[key] = cleaned
    return out


# Per-section caps.
_HERO_CAPS = {
    "eyebrow": _MED, "headline": _MED, "sub": _PARA,
    "positioning_strong": _MED, "positioning_rest": _PARA,
    "cta": _MED, "meta_1": _SHORT, "meta_2": _SHORT, "meta_3": _SHORT, "meta_4": _SHORT,
}
_HEADER_CAPS = {"back_fi": _SHORT, "back_en": _SHORT}
_CRED_ITEM_CAPS = {
    "num": _SHORT, "unit_fi": _SHORT, "unit_en": _SHORT,
    "desc_fi": _LONG, "desc_en": _LONG,
}
_METHOD_TOP_CAPS = {
    "label_fi": _MED, "label_en": _MED,
    "intro_pre_fi": _PARA, "intro_em_fi": _MED, "intro_post_fi": _PARA,
    "intro_pre_en": _PARA, "intro_em_en": _MED, "intro_post_en": _PARA,
}
_METHOD_CARD_CAPS = {
    "num_fi": _MED, "num_en": _MED, "title_fi": _MED, "title_en": _MED,
    "body_pre_fi": _PARA, "body_em_fi": _MED, "body_post_fi": _PARA,
    "body_pre_en": _PARA, "body_em_en": _MED, "body_post_en": _PARA,
    "tag_fi": _MED, "tag_en": _MED,
}
_STACK_TOP_CAPS = {"label_fi": _MED, "label_en": _MED}
_STACK_ITEM_CAPS = {
    "label_fi": _MED, "label_en": _MED, "title_fi": _MED, "title_en": _MED,
    "body_fi": _PARA, "body_en": _PARA,
}
_STEPS_TOP_CAPS = {"label_fi": _MED, "label_en": _MED}
_STEP_ROW_CAPS = {
    "num": _SHORT, "title_fi": _MED, "title_en": _MED,
    "desc_fi": _PARA, "desc_en": _PARA,
}
_CLARITY_TOP_CAPS = {
    "label_fi": _MED, "label_en": _MED,
    "is_head_fi": _MED, "is_head_en": _MED,
    "isnt_head_fi": _MED, "isnt_head_en": _MED,
}
_TEAM_CAPS = {
    "label_fi": _MED, "label_en": _MED, "initial": _SHORT,
    "eyebrow_fi": _MED, "eyebrow_en": _MED,
    "quote_pre_fi": _PARA, "quote_em_fi": _MED, "quote_post_fi": _PARA,
    "quote_pre_en": _PARA, "quote_em_en": _MED, "quote_post_en": _PARA,
    "sign_name": _MED, "sign_rest_fi": _MED, "sign_rest_en": _MED,
    "cred_pre_fi": _PARA, "cred_pre_en": _PARA,
    "cred_link_fi": _MED, "cred_link_en": _MED,
}
_FAQ_TOP_CAPS = {"label_fi": _MED, "label_en": _MED}
_FAQ_ITEM_CAPS = {"q_fi": _MED, "q_en": _MED, "a_fi": _PARA, "a_en": _PARA}
_FINAL_CAPS = {
    "eyebrow_fi": _MED, "eyebrow_en": _MED,
    "headline_pre_fi": _MED, "headline_em_fi": _MED, "headline_post_fi": _MED,
    "headline_pre_en": _MED, "headline_em_en": _MED, "headline_post_en": _MED,
    "cta_fi": _MED, "cta_en": _MED,
    "meta_fi_1": _SHORT, "meta_fi_2": _SHORT, "meta_fi_3": _SHORT, "meta_fi_4": _SHORT, "meta_fi_5": _SHORT,
    "meta_en_1": _SHORT, "meta_en_2": _SHORT, "meta_en_3": _SHORT, "meta_en_4": _SHORT, "meta_en_5": _SHORT,
}
_FOOTER_TOP_CAPS = {
    "home_fi": _MED, "home_en": _MED,
    "disclaimer_fi": _PARA, "disclaimer_en": _PARA,
    "disclaimer_link_href": _MED, "disclaimer_link_label": _MED,
    "disclaimer_tail_fi": _MED, "disclaimer_tail_en": _MED,
}
_FOOTER_LINK_CAPS = {"href": _MED, "label_fi": _MED, "label_en": _MED}
_TRUST_LANG_CAPS = {
    "pill_1": _SHORT, "pill_2": _SHORT, "pill_3": _SHORT, "pill_4": _SHORT,
    "note": _PARA,
    "accept_pre": _MED, "accept_link": _MED, "accept_post": _MED,
}
_TRUST_LINK_CAPS = {"href": _MED, "label_fi": _MED, "label_en": _MED}
_TRUST_LINKS_N = 3

# Locked array lengths — admin can edit each item but cannot add/remove
# (preserves the layout grid which depends on N=4 cred, N=4 method, etc.).
_CRED_N = 4
_METHOD_CARDS_N = 4
_STACK_ITEMS_N = 3
_STEPS_ROWS_N = 3
_FAQ_ITEMS_N = 4
_CLARITY_BULLETS_N = 4
_FOOTER_LINKS_N = 4


def _merge_fixed_objects(defaults: List[Dict[str, Any]], overrides: Any, n: int, caps: Dict[str, int]) -> List[Dict[str, Any]]:
    overrides = overrides if isinstance(overrides, list) else []
    out: List[Dict[str, Any]] = []
    for i in range(n):
        base = dict(defaults[i]) if i < len(defaults) else {}
        over = overrides[i] if i < len(overrides) and isinstance(overrides[i], dict) else {}
        out.append(_merge_strings(base, over, caps))
    return out


def _merge_bullet_list(defaults: List[str], overrides: Any, n: int) -> List[str]:
    overrides = overrides if isinstance(overrides, list) else []
    out: List[str] = []
    for i in range(n):
        base = defaults[i] if i < len(defaults) else ""
        cleaned: Optional[str] = None
        if i < len(overrides):
            cleaned = _trunc(overrides[i], _PARA)
        out.append(cleaned if cleaned is not None else base)
    return out


def sanitize_and_merge(override: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deep-merge an admin override doc onto DEFAULT_MESTARI_COPY with caps."""
    o = override if isinstance(override, dict) else {}
    out: Dict[str, Any] = {}

    # Header
    out["header"] = _merge_strings(
        DEFAULT_MESTARI_COPY["header"], o.get("header") or {}, _HEADER_CAPS,
    )

    # Hero (per-locale)
    out["hero"] = {}
    for lang in ("fi", "en"):
        base = DEFAULT_MESTARI_COPY["hero"][lang]
        over = (o.get("hero") or {}).get(lang) if isinstance(o.get("hero"), dict) else {}
        out["hero"][lang] = _merge_strings(base, over or {}, _HERO_CAPS)

    # Cred (fixed N=4)
    out["cred"] = _merge_fixed_objects(
        DEFAULT_MESTARI_COPY["cred"], o.get("cred"), _CRED_N, _CRED_ITEM_CAPS,
    )

    # Method (flat strings + 4-card array)
    method_base = DEFAULT_MESTARI_COPY["method"]
    method_over = o.get("method") if isinstance(o.get("method"), dict) else {}
    out["method"] = {
        **_merge_strings(method_base, method_over, _METHOD_TOP_CAPS),
        "cards": _merge_fixed_objects(
            method_base["cards"], method_over.get("cards"), _METHOD_CARDS_N, _METHOD_CARD_CAPS,
        ),
    }

    # Stack (label + 3 items)
    stack_base = DEFAULT_MESTARI_COPY["stack"]
    stack_over = o.get("stack") if isinstance(o.get("stack"), dict) else {}
    out["stack"] = {
        **_merge_strings(stack_base, stack_over, _STACK_TOP_CAPS),
        "items": _merge_fixed_objects(
            stack_base["items"], stack_over.get("items"), _STACK_ITEMS_N, _STACK_ITEM_CAPS,
        ),
    }

    # Steps (label + 3 rows)
    steps_base = DEFAULT_MESTARI_COPY["steps"]
    steps_over = o.get("steps") if isinstance(o.get("steps"), dict) else {}
    out["steps"] = {
        **_merge_strings(steps_base, steps_over, _STEPS_TOP_CAPS),
        "rows": _merge_fixed_objects(
            steps_base["rows"], steps_over.get("rows"), _STEPS_ROWS_N, _STEP_ROW_CAPS,
        ),
    }

    # Clarity (top labels + 4-bullet lists per side per locale)
    clarity_base = DEFAULT_MESTARI_COPY["clarity"]
    clarity_over = o.get("clarity") if isinstance(o.get("clarity"), dict) else {}
    out["clarity"] = {
        **_merge_strings(clarity_base, clarity_over, _CLARITY_TOP_CAPS),
        "is_items_fi": _merge_bullet_list(clarity_base["is_items_fi"], clarity_over.get("is_items_fi"), _CLARITY_BULLETS_N),
        "is_items_en": _merge_bullet_list(clarity_base["is_items_en"], clarity_over.get("is_items_en"), _CLARITY_BULLETS_N),
        "isnt_items_fi": _merge_bullet_list(clarity_base["isnt_items_fi"], clarity_over.get("isnt_items_fi"), _CLARITY_BULLETS_N),
        "isnt_items_en": _merge_bullet_list(clarity_base["isnt_items_en"], clarity_over.get("isnt_items_en"), _CLARITY_BULLETS_N),
    }

    # Team
    team_base = DEFAULT_MESTARI_COPY["team"]
    team_over = o.get("team") if isinstance(o.get("team"), dict) else {}
    out["team"] = _merge_strings(team_base, team_over, _TEAM_CAPS)

    # FAQ (label + 4 items)
    faq_base = DEFAULT_MESTARI_COPY["faq"]
    faq_over = o.get("faq") if isinstance(o.get("faq"), dict) else {}
    out["faq"] = {
        **_merge_strings(faq_base, faq_over, _FAQ_TOP_CAPS),
        "items": _merge_fixed_objects(
            faq_base["items"], faq_over.get("items"), _FAQ_ITEMS_N, _FAQ_ITEM_CAPS,
        ),
    }

    # Final CTA
    out["final"] = _merge_strings(
        DEFAULT_MESTARI_COPY["final"], o.get("final") or {}, _FINAL_CAPS,
    )

    # Trust strip (per-locale + 3 link rows)
    trust_base = DEFAULT_MESTARI_COPY["trust"]
    trust_over = o.get("trust") if isinstance(o.get("trust"), dict) else {}
    out["trust"] = {}
    for lang in ("fi", "en"):
        out["trust"][lang] = _merge_strings(
            trust_base[lang],
            (trust_over.get(lang) if isinstance(trust_over.get(lang), dict) else {}) or {},
            _TRUST_LANG_CAPS,
        )
    out["trust"]["links"] = _merge_fixed_objects(
        trust_base["links"], trust_over.get("links"), _TRUST_LINKS_N, _TRUST_LINK_CAPS,
    )

    # Footer (top + 4 links)
    footer_base = DEFAULT_MESTARI_COPY["footer"]
    footer_over = o.get("footer") if isinstance(o.get("footer"), dict) else {}
    out["footer"] = {
        **_merge_strings(footer_base, footer_over, _FOOTER_TOP_CAPS),
        "links": _merge_fixed_objects(
            footer_base["links"], footer_over.get("links"), _FOOTER_LINKS_N, _FOOTER_LINK_CAPS,
        ),
    }

    return out


async def get_mestari_copy(db) -> Dict[str, Any]:
    """Public — returns the fully merged copy tree."""
    doc = await db.settings.find_one({"_id": "mestari_copy"}, {"_id": 0, "value": 1})
    override = (doc or {}).get("value") if doc else None
    return sanitize_and_merge(override)


async def get_mestari_copy_raw(db) -> Dict[str, Any]:
    """Admin — returns raw override + merged + defaults + updated_at."""
    doc = await db.settings.find_one({"_id": "mestari_copy"}, {"_id": 0, "value": 1, "updated_at": 1})
    raw = (doc or {}).get("value") if doc else {}
    return {
        "raw": raw or {},
        "merged": sanitize_and_merge(raw),
        "defaults": DEFAULT_MESTARI_COPY,
        "updated_at": (doc or {}).get("updated_at"),
    }


async def save_mestari_copy(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Admin — persist the user override and return the new admin view."""
    if not isinstance(payload, dict):
        raise ValueError("payload_must_be_object")
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"_id": "mestari_copy"},
        {"$set": {"value": payload, "updated_at": now}},
        upsert=True,
    )
    return await get_mestari_copy_raw(db)
