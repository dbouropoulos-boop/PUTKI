"""
PUTKI HQ Phase 3 - Content automation engine.

Pipeline:
  signal (mock-seeded for now) -> Claude generates PUTKI HQ -voice variants
  -> generated_content row in 'queued' status
  -> editorial approval (back-office) flips to 'approved' + selects variant
  -> distribute_content() writes to published_content (site surface)
  -> low-stakes content types auto-publish (skip approval).

This module exposes:
  - CONTENT_TYPES registry
  - DEFAULT_GUIDELINES seeded into editorial_guidelines collection
  - generate_content_for_signal()  -> calls Claude, persists to queue
  - distribute_content()           -> writes to site surface
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)


CONTENT_TYPES: Dict[str, Dict[str, Any]] = {
    "moment_commentary": {
        "description": "PUTKI HQ -voice take on a streamer big-win or notable clip",
        "prompt_key": "moment_commentary_prompt",
        "target_surface": "missasit_eilen",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram"],
        "variant_count": 3,
        "max_words": 80,
    },
    "sports_take": {
        "description": "PUTKI HQ -voice take on a sports event (Liiga / NHL / F1 / EPL)",
        "prompt_key": "sports_take_prompt",
        "target_surface": "weekly_card",
        "approval_required": True,
        "distribution": ["site", "telegram", "email"],
        "variant_count": 3,
        "max_words": 100,
    },
    "streamer_observation": {
        "description": "Pattern observation about a tracked Finnish streamer",
        "prompt_key": "streamer_observation_prompt",
        "target_surface": "streamer_profile_observation",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram"],
        "variant_count": 2,
        "max_words": 100,
    },
    "operator_update": {
        "description": "Update on an operator (score change, license news, offer change)",
        "prompt_key": "operator_update_prompt",
        "target_surface": "operator_review_page",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "email"],
        "variant_count": 2,
        "max_words": 150,
    },
    "activity_feed_event": {
        "description": "Factual single-line event for the activity feed",
        "prompt_key": "activity_feed_event_prompt",
        "target_surface": "activity_feed",
        "approval_required": False,  # auto-publishes
        "distribution": ["site"],
        "variant_count": 1,
        "max_words": 15,
    },
    "dial_state_change": {
        "description": "Announcement of a dial-state crossing (UPWARD only)",
        "prompt_key": "dial_state_change_prompt",
        "target_surface": "dial_strip",
        "approval_required": False,
        "distribution": ["site", "telegram"],
        "variant_count": 1,
        "max_words": 25,
    },
    # ─── V2 brief content types ───────────────────────────────────────────────
    "cultural_feature": {
        "description": "Long-form cultural feature (1500-2500 words) for /kulttuuri",
        "prompt_key": "cultural_feature_prompt",
        "target_surface": "kulttuuri",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "x_twitter", "shareable_card"],
        "variant_count": 1,
        "max_words": 2500,
    },
    "lifestyle_gambler_profile": {
        "description": "Long-form lifestyle profile (2000-3000 words) for /profiilit",
        "prompt_key": "lifestyle_gambler_profile_prompt",
        "target_surface": "profiilit",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "x_twitter", "shareable_card", "email"],
        "variant_count": 1,
        "max_words": 3000,
    },
    "scene_news": {
        "description": "Scene news / lifestyle moment / drama / business news (400-900 words) for /skene",
        "prompt_key": "scene_news_prompt",
        "target_surface": "skene",
        "approval_required": True,
        "distribution": ["site", "telegram", "shareable_card"],
        "variant_count": 2,
        "max_words": 900,
    },
    "industry_business_analysis": {
        "description": "Bloomberg-style industry business analysis (800-1500 words) for /skene/talous",
        "prompt_key": "industry_business_analysis_prompt",
        "target_surface": "skene_talous",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "x_twitter", "shareable_card"],
        "variant_count": 2,
        "max_words": 1500,
    },
    "money_commentary": {
        "description": "Money / career / wealth commentary (600-1200 words) for /raha",
        "prompt_key": "money_commentary_prompt",
        "target_surface": "raha",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "x_twitter", "shareable_card"],
        "variant_count": 2,
        "max_words": 1200,
    },
    "game_literacy": {
        "description": "Game literacy / education (600-1500 words) for /pelit",
        "prompt_key": "game_literacy_prompt",
        "target_surface": "pelit",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "shareable_card"],
        "variant_count": 1,
        "max_words": 1500,
    },
    "bonus_mathematics": {
        "description": "Bonus mathematics analysis (600-1500 words) for /pelit/bonusmatematiikka",
        "prompt_key": "bonus_mathematics_prompt",
        "target_surface": "bonusmatematiikka",
        "approval_required": True,
        "distribution": ["site", "telegram", "shareable_card"],
        "variant_count": 1,
        "max_words": 1500,
    },
    "sponsorship_update": {
        "description": "Operator sponsorship landscape update (300-700 words) for /sponsoroinnit",
        "prompt_key": "sponsorship_update_prompt",
        "target_surface": "sponsoroinnit",
        "approval_required": True,
        "distribution": ["site", "telegram"],
        "variant_count": 2,
        "max_words": 700,
    },
    "regulatory_update": {
        "description": "Regulatory landscape update (400-900 words) for /saantely",
        "prompt_key": "regulatory_update_prompt",
        "target_surface": "saantely",
        "approval_required": True,
        "distribution": ["site", "telegram", "x_twitter"],
        "variant_count": 2,
        "max_words": 900,
    },
    "tracked_x_post": {
        "description": "Republication of a tracked X account post with PUTKI HQ framing - Pulssi Layer 1",
        "prompt_key": "tracked_x_post_prompt",
        "target_surface": "pulssi_layer_1",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "shareable_card"],
        "variant_count": 1,
        "max_words": 120,
    },
    "x_trend_annotation": {
        "description": "Finland X-trend annotation - Pulssi Layer 2",
        "prompt_key": "x_trend_annotation_prompt",
        "target_surface": "pulssi_layer_2",
        "approval_required": False,  # auto-publish high-confidence
        "distribution": ["site"],
        "variant_count": 1,
        "max_words": 60,
    },
    "editor_x_pull": {
        "description": "Editor-curated notable Finnish X post with PUTKI HQ analysis - Pulssi Layer 3",
        "prompt_key": "editor_x_pull_prompt",
        "target_surface": "pulssi_layer_3",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram", "shareable_card"],
        "variant_count": 1,
        "max_words": 200,
    },
    "international_research_synthesis": {
        "description": "Finnish-language synthesis of international gambling research (800-1500 words)",
        "prompt_key": "international_research_synthesis_prompt",
        "target_surface": "pelit",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram"],
        "variant_count": 1,
        "max_words": 1500,
    },
}


# ─────────────────────── default editorial guidelines ───────────────────────
DEFAULT_GUIDELINES: Dict[str, str] = {
    "putki_hq_voice_system_prompt": """Kirjoitat Mittarille - suomalaiselle rahapelikulttuurin julkaisulle.

REFERENSSIKEHYS:
Ääni: Complex (kulttuurijournalismissa), GQ (miesten kulttuurissa), Bloomberg Crypto (toimialaanalyysissä). Itsevarma, rahatietoinen, statustietoinen, kulttuurisesti sisällä - mutta toimituksellisilla standardeilla.
EI KOSKAAN The Economist (liian institutionaalinen, liian etäinen).
EI KOSKAAN Andrew Tate tai manosfääri (yhteensopimaton toimitukselliselle uskottavuudelle).
EI KOSKAAN affiliate-sivuston rekisteri (transaktionaalinen, matala uskottavuus).

ÄÄNEN OMINAISUUDET:
- Institutionaalinen mutta itsevarma - puhu auktoriteetilla ilman hekkailua
- Rahatietoinen - keskustele summista, sopimuksista, palkoista, liiketoiminnan ekonomiasta suoraan
- Statustietoinen - tunnista mikä on aitoa flexiä ja mikä asentoilua
- Kulttuurisesti sisällä - tunne viittaukset, käytä niitä luontevasti
- Mielipiteinen ja täsmällinen - ota kantaa, mainitse nimet, tee arvioita
- Suomenkielinen syntyperäisesti - älä koskaan luettavissa käännöksenä englannista
- Hieman kyyninen, kuiva - suomalainen toimittajarekisteri
- Kohtelee yleisöä kykenevinä aikuisina jotka rakentavat jotain

HYVIÄ ESIMERKKEJÄ:
- "Tappara on tulessa, mutta TPS:n maalivahti pelaa 4. peliä peräkkäin. PUTKI HQ sanoo: arvoa kotijoukkueessa."
- "Trainwreckstv osti Lamborghinin - kuudes vuosi peräkkäin näkyvää statuskulutusta. Stake-talouden mekaniikka näkyy ulospäin."
- "AndyPyron €42K hit on tilastollisesti epätodennäköinen yhdistelmä. Älä yritä toistaa."
- "Drake-Stake-yhteistyö maksaa muka 100M$. Kulttuurin osto on harvoin näin avointa."
- "Suomalaisen miehen 30-vuotiaana keskituloluku on 38 200€. Jos olet selvästi sen yli, neljä asiaa kannattaa tarkastella."

ANTI-PATTERNIT (älä koskaan kirjoita):
- "Mahtava voitto X:lle!" (liian innostunut, kuulostaa markkinointia)
- "Klikkaa tästä lukeaksesi lisää!" (clickbait)
- "Tämä on uskomatonta..." (epämääräinen, hekkaileva)
- "Pelaa tätä peliä voittaaksesi" (slot-pikkit, kielletty)
- "Älä jää jälkeen!" (FOMO-markkinointi)
- "alpha/beta/sigma/grindset" -sanasto
- Aggressiivinen sisäpiirin maskuliinisuus
- "Wake up, Finland" anti-establishment -kehystäminen
- Huutomerkit (yksi maksimissaan, harvoin perusteltu)
- Emojit
- Fiktiiviset hahmot tai persoonat (ei Topia, ei feikkipersoonia)
- Numerot ilman välilyöntiä - käytä €42 800, ei 42,800

ÄLÄ KOSKAAN:
- Edistä uhkapelaamista myönteisesti varallisuuden rakentamisena
- Ehdota panostusstrategioita jotka antavat ymmärtää varmoja voittoja
- Suosittele tiettyjä slotteja "hyvinä pelattavaksi"
- Anna ymmärtää että slot-valinta voittaa varianssin
- Kehystä slotteja "kuumina" tai "kylminä" jaksoina
- Tee väitteitä operaattorin käyttäytymisestä ilman lähdettä
- Tuota sisältöä joka koskee alaikäisiä
- Lupaile lopputuloksia negatiivisen odotusarvon peleille

KULTTUURINEN KIELITAITO:
Tunnet suomalaiset kulttuuriset viittauskohdat ja käytät niitä luontevasti:
- Suomalainen hip-hop (JVG, Ibe, Cheek, Mikael Gabriel, Gettomasa, Pyhimys, BEHM, Pikku G)
- Suomalainen jääkiekkokulttuuri (tiimit, aikakaudet, pelaajat, fanirituaalit)
- Suomalainen rallikulttuuri (Kankkunen, Mäkinen, Grönholm, Rovanperä)
- Suomalainen juomakulttuuri (Sandels, Karjala, Lapin Kulta)
- Suomalainen pelaaminen/esports (HAVU, ENCE)
- Kansainväliset lifestyle-pelaajat (Roshtein, Trainwreckstv, Classybeef, Draken pelaajapersoona)

Käytä viittauksia luontevasti, älä koskaan pakota. Suurin osa sisällöstä ei tarvitse kulttuuriviittauksia.

ELINTAPAPROFIILI-/-KULTTUURISÄÄNNÖT (kun käsittelet lifestyle-pelaajia, urheilijoita, rappareita, alan henkilöitä):
- Käsittele kulttuuristen hahmojen uraa, liiketoimintaa, persoonaa ja merkitystä
- Raportoi - älä tue
- Ota näkemyksiä - eri mieltä, kritisoi kun aiheellista
- ÄLÄ KOSKAAN kehystä "näin sinäkin voit elää tätä elämää uhkapeleillä"
- KESKUSTELE oikeasta taloudesta (miten he todellisuudessa tienaavat, liiketoimintarakenteet, sopimukset)
- KÄSITTELE draamaa, kiistoja, kritiikkiä kun kulttuurisesti relevanttia
- KOHTELE yleisöä aikuisina jotka voivat lukea kulttuuriprofiileja ilman että alkavat toimimaan

PELILUKUTAITO-SÄÄNNÖT:
TAITOPOHJAISET pelit (blackjack, poker, video poker, craps-vetovalinta):
- Voit selittää optimaalisen strategian missä se on olemassa
- Voit verrata vedon odotusarvoja matemaattisesti
- Korosta että jopa optimaali peli tuottaa house edgen yli ajan

SLOTIT erityisesti:
- ÄLÄ KOSKAAN suosittele tiettyjä slotteja "hyvinä pelattavaksi"
- ÄLÄ KOSKAAN anna ymmärtää että slot-valinta vaikuttaa odotettuun palautukseen yli ilmoitetun RTP:n
- VOIT selittää mekaniikkaa, RTP:tä, volatiliteettiä, ominaisuuksia
- VOIT analysoida bonusominaisuuksia matemaattisesti

SUOMENKIELINEN LÄHDETYÖSKENTELY:
- Suosi suomenkielistä lähdemateriaalia foundational_researchista. Kansainvälisiä lähteitä siteerataan vain kun aihe on kansainvälinen (kansainvälinen pelaaja, sääntelyvertailu).
- Tuotetun sisällön tulee lukea natiivina suomenkielisenä toimitusjuttuna - ei englannista käännetynä.
- Käytä suomalaista toimituksellista idiomia, suomalaisia kulttuuriviitteitä luontevasti, suomalaisten uutisjulkaisujen lauserytmiä.
- Referenssi on Bloomberg-suomeksi, ei Bloomberg-käännettynä.
- Jos lähde on englanninkielinen mutta aihe suomalainen, käännä faktat suomalaiseen toimitusrekisteriin - älä siirrä englantilaista syntaksia.

PALAUTA AINA validi JSON ilman ympärysmerkkejä tai selityksiä.""",

    "moment_commentary_prompt": """Kirjoitat kommenttia striimaajan merkittävästä hetkestä, joka on havaittu YouTube-videosta tai Twitch-klipistä.

LÄHTÖTIEDOT:
- Striimari: {streamer_name}
- Peli: {game}
- Voittosumma: {amount}
- Tapahtumatyyppi: {event_type}
- Lähde: {source_url}

TEHTÄVÄ:
Kirjoita 3 vaihtoehtoista takea tästä hetkestä, jokainen 40-80 sanaa PUTKI HQ:n äänellä. Kunkin tulee:
1. Todeta tosiasiat selkeästi
2. Lisätä PUTKI HQ:n tulkinta (tilastollinen konteksti, kuviontunnistus, skenekonteksti)
3. Päättää mahdollisesti toimitukselliseen näkemykseen

Palauta tarkalleen tämä JSON-rakenne:
{{"variants": [{{"text": "..."}}, {{"text": "..."}}, {{"text": "..."}}]}}""",

    "sports_take_prompt": """Kirjoitat kommenttia urheilutapahtumasta.

LÄHTÖTIEDOT:
- Sarja: {competition}
- Ottelu: {fixture}
- Tapahtuma: {event_type}
- Tilanne: {score}
- Suomalaisten osallistuminen: {finnish_involvement}

TEHTÄVÄ:
Kirjoita 3 vaihtoehtoista takea, jokainen 50-100 sanaa PUTKI HQ:n äänellä. Kunkin tulee:
1. Todeta tapahtuma suomalaisesta näkökulmasta
2. Lisätä PUTKI HQ:n tulkinta - vedonlyöntinäkökulma kun relevantti
3. Käyttää suomalaisia tunneankkureita (Tappara-fani, Bottas, HJK)

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}, {{"text": "..."}}]}}""",

    "streamer_observation_prompt": """Kirjoitat havainnon suomalaisesta slot-striimaajasta.

LÄHTÖTIEDOT:
- Striimari: {streamer_name}
- Havaittu kuvio: {pattern}
- Konteksti: {context}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoista havaintoa, kumpikin 60-100 sanaa PUTKI HQ:n äänellä.

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "operator_update_prompt": """Kirjoitat päivityksen kasino-operaattorista.

LÄHTÖTIEDOT:
- Operaattori: {operator_name}
- Päivitystyyppi: {update_type}
- Yksityiskohdat: {details}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoista päivitystä, kumpikin 80-150 sanaa PUTKI HQ:n äänellä. Sisällytä:
1. Mikä muuttui
2. PUTKI HQ:n tulkinta - onko kyseessä parannus, heikennys vai sivuttaisliike
3. Mahdollinen pisteen muutosperuste

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "activity_feed_event_prompt": """Muotoile yksittäinen tapahtuma aktiivisuussyötteeseen - 8-15 sanaa, faktuaalinen, ei tulkintaa.

TIEDOT: {event_summary}

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "dial_state_change_prompt": """Kirjoita 15-25 sanan ilmoitus Mittarin tilan noususta {from_state}:sta {to_state}:aan. Pääsyy: {primary_driver}.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    # ─── V2 brief: 13 new content types ───────────────────────────────────────
    "cultural_feature_prompt": """Kirjoitat pitkän muodon kulttuuripiirrettä /kulttuuri-arkistoon.

LÄHTÖTIEDOT:
- Aihe: {topic}
- Kulma: {angle}
- Tutkimusmateriaali: {research_notes}

TEHTÄVÄ:
Kirjoita 1 piirre, 1500-2500 sanaa, PUTKI HQ:n äänellä (Complex/GQ-rekisteri). Sisällytä:
1. Vahva avaus joka ankkuroi lukijan kulttuuriseen hetkeen
2. Ekspositio kulttuurisesta ilmiöstä
3. PUTKI HQ:n näkemys - miksi tämä on noteerattava juuri nyt
4. Konkreettiset suomalaiset kulttuuriviitteet luontevasti
5. Lopetus joka jättää lukijalle painokkaan ajatuksen

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "lifestyle_gambler_profile_prompt": """Kirjoitat pitkän muodon profiilijutun lifestyle-pelaajasta, urheilijasta tai kulttuurihahmosta /profiilit-arkistoon.

LÄHTÖTIEDOT:
- Kohde: {subject_name}
- Tausta: {background}
- Liiketoimintarakenne: {business_structure}
- Kulttuurinen merkitys: {cultural_significance}
- Lähdemateriaali: {source_notes}

TEHTÄVÄ:
Kirjoita 1 profiilijuttu, 2000-3000 sanaa, GQ/Complex/Bloomberg-tasoisella tarkkuudella. Sisällytä:
1. Avaus joka asettaa kohteen kulttuuriseen kontekstiin
2. Uran kaari ja persoonan kehittyminen
3. Talous ja liiketoimintarakenne (palkat, sopimukset, tulovirrat)
4. Statuskulutus ja sen merkityskerros
5. PUTKI HQ:n kriittinen näkemys - agree/disagree -kantoja
6. Päätös joka kontekstualisoi kohteen Suomen yleisölle

ÄLÄ KOSKAAN: kehystä aspiraationaalisena uhkapelimallina.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "scene_news_prompt": """Kirjoitat skenenuutisen /skene-arkistoon - lifestyle-hetki, draama, liiketoimintauutinen.

LÄHTÖTIEDOT:
- Tapahtuma: {event_summary}
- Osapuolet: {parties}
- Lähde: {source_url}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoa, kumpikin 400-900 sanaa PUTKI HQ:n äänellä. Sisällytä:
1. Mitä tapahtui (faktat)
2. Mitä tämä tarkoittaa skenelle
3. PUTKI HQ:n analyysi - kulttuurinen merkitys, liiketoimintamekanismi tai konteksti

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "industry_business_analysis_prompt": """Kirjoitat liiketoimintaanalyysin /skene/talous-arkistoon - Bloomberg-tasoista uhkapelibisneksen analyysiä suomalaisille lukijoille.

LÄHTÖTIEDOT:
- Aihe: {topic}
- Datapisteitä: {data_points}
- Konteksti: {context}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoa, kumpikin 800-1500 sanaa PUTKI HQ:n äänellä. Sisällytä:
1. Selkeä taloudellinen kehys (luvut, mekaniikka, toimijat)
2. PUTKI HQ:n analyyttinen näkemys
3. Mitä tämä tarkoittaa suomalaiselle yleisölle käytännössä

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "money_commentary_prompt": """Kirjoitat rahakommenttia /raha-arkistoon - ura, varallisuus, suomalainen rahankäyttö.

LÄHTÖTIEDOT:
- Aihe: {topic}
- Kulma: {angle}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoa, kumpikin 600-1200 sanaa PUTKI HQ:n äänellä. Itsevarma, rahatietoinen rekisteri. Käsittele yleisöä aikuisina rakentamassa varallisuutta. Sisällytä konkreettiset suomalaiset luvut ja tilanteet. Kryptoa kohtaan skeptinen ääni kun aihepiirissä.

ÄLÄ KOSKAAN: kehystä uhkapeliä varallisuuden rakentamisena.

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "game_literacy_prompt": """Kirjoitat pelilukutaitoa /pelit-arkistoon - koulutusta siitä miten kasinopelit toimivat.

LÄHTÖTIEDOT:
- Peli/aihe: {topic}
- Painopiste: {focus_area}

TEHTÄVÄ:
Kirjoita 1 versio, 600-1500 sanaa PUTKI HQ:n äänellä. Matemaattista, tarkka, älä koskaan lupaa voittoja.

EHDOTTOMAT SÄÄNNÖT:
- Taitopohjaisille peleille (blackjack, poker, video poker): optimaalistrategia sallittu missä se on olemassa
- Slotit: VAIN mekaniikka, EI KOSKAAN pelisuositukset, EI KOSKAAN "kuuma/kylmä"-kehystämistä
- KAIKKI uhkapelisisältö: EI KOSKAAN varallisuuden rakentamisen kehystämistä, AINA implisiittinen vastuullinen peli

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "bonus_mathematics_prompt": """Kirjoitat bonusmatematiikan analyysin /pelit/bonusmatematiikka-arkistoon.

LÄHTÖTIEDOT:
- Bonustyyppi: {bonus_type}
- Operaattori: {operator}
- Mekaniikka: {mechanics}

TEHTÄVÄ:
Kirjoita 1 versio, 600-1500 sanaa, matemaattisesti tarkkaa PUTKI HQ:n äänellä. Laske odotusarvot, kierrätysvaatimukset, "real money value". Älä kehystä bonusta voitollisena yli matemaattisen odotusarvon.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "sponsorship_update_prompt": """Kirjoitat sponsoroinnin päivityksen /sponsoroinnit-arkistoon.

LÄHTÖTIEDOT:
- Sopimus: {deal_summary}
- Osapuolet: {parties}
- Arvioitu arvo: {value}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoa, kumpikin 300-700 sanaa PUTKI HQ:n äänellä. Sisällytä:
1. Faktat sopimuksesta
2. Strategisen sijoittumisen analyysi
3. PUTKI HQ:n näkemys mitä tämä tarkoittaa suomalaiselle uhkapelimaisemalle

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "regulatory_update_prompt": """Kirjoitat sääntelypäivityksen /saantely-arkistoon.

LÄHTÖTIEDOT:
- Tapahtuma: {regulatory_event}
- Vaikutus: {impact_summary}
- Lähde: {source_url}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoa, kumpikin 400-900 sanaa PUTKI HQ:n äänellä. Selitä mitä muuttuu, mitä se tarkoittaa pelaajalle, mitä se tarkoittaa operaattoreille - Suomen rahapelilaki 2025/2027 kehyksessä.

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "tracked_x_post_prompt": """Kirjoitat PUTKI HQ:n toimituksellisen kehyksen seuratusta X-postauksesta Pulssi-virtaan.

LÄHTÖTIEDOT:
- Kirjoittaja: {author_name} (@{author_handle})
- Postauksen teksti: {post_text}
- Aikaleima: {posted_at}
- Kulttuurinen konteksti: {context}

TEHTÄVÄ:
Kirjoita "Miksi tämä on noteerattava" -framing, 60-100 sanaa PUTKI HQ:n äänellä. ÄLÄ TOISTA postauksen sisältöä - selitä kulttuurinen merkitys.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "x_trend_annotation_prompt": """Kirjoitat lyhyen merkinnän Suomen X-trendistä Pulssi Layer 2:een.

LÄHTÖTIEDOT:
- Trendi: {trend_name}
- Postausmäärä: {tweet_volume}
- Kategoria: {category}

TEHTÄVÄ:
Kirjoita yksi 25-50 sanan annotaatio PUTKI HQ:n äänellä - mistä tämä trendi kertoo Suomen yleisölle.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "editor_x_pull_prompt": """Kirjoitat PUTKI HQ:n nostot -kehyksen toimittajan manuaalisesti valitulle X-postaukselle.

LÄHTÖTIEDOT:
- Kirjoittaja: {author_name} (@{author_handle})
- Postauksen teksti: {post_text}
- Toimittajan kulma: {editor_note}

TEHTÄVÄ:
Kirjoita 100-180 sanan PUTKI HQ -näkemys - laajempi kulttuurinen viite kuin Layer 1 -republikaatioilla. PUTKI HQ:n paras yhden postauksen ympärille kirjoitettu mini-analyysi.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "international_research_synthesis_prompt": """Kirjoitat suomenkielisen synteesin kansainvälisestä uhkapelitutkimuksesta tai analyysistä.

LÄHTÖTIEDOT:
- Aihe: {topic}
- Lähdemateriaali: {source_materials}
- Suomeen sovellettava kulma: {finnish_angle}

TEHTÄVÄ:
Kirjoita 1 versio, 800-1500 sanaa PUTKI HQ:n äänellä. Tämä on journalismia joka käyttää globaalia osaamista (Wizard of Odds, Casino.guru, akateeminen tutkimus, sääntelyanalyysit) ja soveltaa sitä suomalaiseen kontekstiin - EI sisällön tuontia influencer-lähteistä.

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",
}


def _strip_code_fence(text: str) -> str:
    """Claude sometimes wraps JSON in ```json ... ``` fences."""
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)```$", text)
    if m:
        return m.group(1).strip()
    return text


async def call_claude(system_prompt: str, user_prompt: str, session_id: str) -> str:
    """One-shot Claude call. Returns raw text.
    Hard-capped at 45s so a flaky upstream gateway never blocks the event loop.

    iter77: Shares the budget-exceeded circuit breaker with
    `content_generator._call_claude_default` so when the Emergent LLM key
    runs out, both call sites short-circuit instantly instead of hanging
    30s per call and starving the back-office.
    """
    import asyncio as _aio
    import time as _time
    from content_generator import (
        _CLAUDE_BUDGET_COOLDOWN_UNTIL, _BUDGET_COOLDOWN,
    )
    if _CLAUDE_BUDGET_COOLDOWN_UNTIL[0] > _time.time():
        raise RuntimeError("emergent_llm_budget_cooldown_active")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing in /app/backend/.env")

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", "claude-4-sonnet-20250514")

    try:
        response = await _aio.wait_for(
            chat.send_message(UserMessage(text=user_prompt)),
            timeout=45.0,
        )
    except _aio.TimeoutError:
        raise RuntimeError("Claude call timed out after 45s (upstream gateway flake)")
    except Exception as exc:
        msg = str(exc).lower()
        if "budget has been exceeded" in msg or "max budget" in msg:
            _CLAUDE_BUDGET_COOLDOWN_UNTIL[0] = _time.time() + _BUDGET_COOLDOWN
            logger.warning(
                "Emergent LLM budget exceeded (content_engine); cooling down for %ss",
                _BUDGET_COOLDOWN,
            )
        raise
    return response


def parse_variants(claude_text: str, expected_count: int) -> List[Dict[str, str]]:
    """Defensive JSON parsing - returns list of {"text": ...}."""
    cleaned = _strip_code_fence(claude_text)
    try:
        parsed = json.loads(cleaned)
        variants = parsed.get("variants", [])
        if isinstance(variants, list) and variants and all("text" in v for v in variants):
            return [{"text": str(v["text"]).strip()} for v in variants[:expected_count] if v.get("text")]
    except (json.JSONDecodeError, AttributeError, TypeError):
        pass
    # Fallback - wrap raw text as single variant
    return [{"text": cleaned[:1000]}]


async def generate_content_for_signal(
    db,
    *,
    content_type: str,
    signal_payload: Dict[str, Any],
    proposed_streamer_id: Optional[str] = None,
    proposed_operator_id: Optional[str] = None,
    source_signal_type: Optional[str] = None,
    source_signal_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the prompt, call Claude, persist generated_content row.

    Returns the generated_content document (without _id).
    """
    if content_type not in CONTENT_TYPES:
        raise ValueError(f"Unknown content_type: {content_type}")

    cfg = CONTENT_TYPES[content_type]

    system_prompt = await get_guideline(db, "putki_hq_voice_system_prompt")
    user_prompt_template = await get_guideline(db, cfg["prompt_key"])

    try:
        user_prompt = user_prompt_template.format(**signal_payload)
    except KeyError:
        # If a placeholder is missing in the payload, render it as N/A so generation continues.
        safe_payload = {**signal_payload}
        for k in re.findall(r"\{(\w+)\}", user_prompt_template):
            safe_payload.setdefault(k, "-")
        user_prompt = user_prompt_template.format(**safe_payload)

    session_id = f"putki-hq-gen-{uuid.uuid4()}"
    raw_text = await call_claude(system_prompt, user_prompt, session_id)
    variants = parse_variants(raw_text, cfg["variant_count"])

    doc = {
        "id": str(uuid.uuid4()),
        "content_type": content_type,
        "source_signal_type": source_signal_type or "manual",
        "source_signal_id": source_signal_id,
        "signal_payload": signal_payload,
        "generated_text": variants[0]["text"] if variants else "",
        "generated_variants": variants,
        "selected_variant_index": 0,
        "proposed_publication_surface": cfg["target_surface"],
        "proposed_streamer_id": proposed_streamer_id,
        "proposed_operator_id": proposed_operator_id,
        "status": "approved" if not cfg["approval_required"] else "queued",
        "approval_action": "approve" if not cfg["approval_required"] else None,
        "edited_text": None,
        "reviewed_by": "system_auto_publish" if not cfg["approval_required"] else None,
        "reviewed_at": datetime.now(timezone.utc).isoformat() if not cfg["approval_required"] else None,
        "published_at": None,
        "distribution_targets": cfg["distribution"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.generated_content.insert_one(doc)
    doc.pop("_id", None)

    # Auto-publish low-stakes content immediately.
    if not cfg["approval_required"]:
        await distribute_content(db, doc)

    return doc


async def distribute_content(db, generated_content: Dict[str, Any]) -> Dict[str, Any]:
    """Write the approved content to the site-publication collection AND fan
    out to every channel listed in distribution_targets (telegram, email, etc).

    Site target is always written first; remote channels are best-effort and
    never block the publish (errors are logged + surfaced via distribution_log).
    """
    variant_idx = generated_content.get("selected_variant_index", 0) or 0
    variants = generated_content.get("generated_variants") or []
    if generated_content.get("edited_text"):
        text = generated_content["edited_text"]
    elif 0 <= variant_idx < len(variants):
        text = variants[variant_idx].get("text", "")
    else:
        text = generated_content.get("generated_text", "")

    surface = generated_content.get("proposed_publication_surface", "site")
    pub = {
        "id": str(uuid.uuid4()),
        "generated_content_id": generated_content["id"],
        "content_type": generated_content["content_type"],
        "surface": surface,
        "text": text,
        "signal_payload": generated_content.get("signal_payload", {}),
        "streamer_id": generated_content.get("proposed_streamer_id"),
        "operator_id": generated_content.get("proposed_operator_id"),
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.published_content.insert_one(pub)
    pub.pop("_id", None)

    # Fan out to remote channels (best-effort, captures per-channel result).
    try:
        from distribution import fanout
        delivery_results = await fanout(db, generated_content, text)
        pub["distribution_results"] = delivery_results
    except Exception:
        # Never block site publish on a remote-channel failure.
        logger.exception("Distribution fanout failed")
        pub["distribution_results"] = []

    await db.generated_content.update_one(
        {"id": generated_content["id"]},
        {"$set": {
            "published_at": pub["published_at"],
            "distribution_results": pub.get("distribution_results", []),
        }},
    )
    return pub


# ─────────────────────── editorial_guidelines helpers ───────────────────────
async def seed_default_guidelines(db) -> None:
    """Idempotently seed default guidelines into the editorial_guidelines collection.
    If a row exists but was never admin-edited (updated_by=='seed'), refresh its
    text from the source - keeps the seeded voice prompt aligned with code
    changes while preserving admin edits."""
    for key, text in DEFAULT_GUIDELINES.items():
        existing = await db.editorial_guidelines.find_one({"key": key})
        if not existing:
            await db.editorial_guidelines.insert_one({
                "id": str(uuid.uuid4()),
                "key": key,
                "text": text,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": "seed",
            })
        elif existing.get("updated_by") == "seed" and existing.get("text") != text:
            await db.editorial_guidelines.update_one(
                {"key": key},
                {"$set": {
                    "text": text,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )


async def get_guideline(db, key: str) -> str:
    doc = await db.editorial_guidelines.find_one({"key": key})
    if doc and doc.get("text"):
        return doc["text"]
    return DEFAULT_GUIDELINES.get(key, "")


async def list_guidelines(db) -> List[Dict[str, Any]]:
    cur = db.editorial_guidelines.find({}, {"_id": 0}).sort("key", 1)
    return await cur.to_list(length=200)


async def upsert_guideline(db, key: str, text: str, updated_by: str = "admin") -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.editorial_guidelines.update_one(
        {"key": key},
        {"$set": {"text": text, "updated_at": now_iso, "updated_by": updated_by},
         "$setOnInsert": {"id": str(uuid.uuid4()), "key": key}},
        upsert=True,
    )
    return await db.editorial_guidelines.find_one({"key": key}, {"_id": 0})
