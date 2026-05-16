"""
Mittari Phase 3 — Content automation engine.

Pipeline:
  signal (mock-seeded for now) -> Claude generates Mittari-voice variants
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
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage


CONTENT_TYPES: Dict[str, Dict[str, Any]] = {
    "moment_commentary": {
        "description": "Mittari-voice take on a streamer big-win or notable clip",
        "prompt_key": "moment_commentary_prompt",
        "target_surface": "missasit_eilen",
        "approval_required": True,
        "distribution": ["site", "archive", "telegram"],
        "variant_count": 3,
        "max_words": 80,
    },
    "sports_take": {
        "description": "Mittari-voice take on a sports event (Liiga / NHL / F1 / EPL)",
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
}


# ─────────────────────── default editorial guidelines ───────────────────────
DEFAULT_GUIDELINES: Dict[str, str] = {
    "mittari_voice_system_prompt": """Kirjoitat Mittarille — suomalaiselle slot-striimausta, urheilua ja online-kasinoita käsittelevälle riippumattomalle julkaisulle.

ÄÄNEN OMINAISUUDET:
- Institutionaalinen, ei henkilökohtainen — kirjoita "Mittarin toimitus" tai "Mittari", älä koskaan fiktiivisellä hahmolla
- Mielipiteinen ja täsmällinen — älä hekkaile tai yleistä
- Hieman kyyninen, kuiva — suomalainen toimittajarekisteri
- Kunnioita lukijan älyä
- Käytä suomen kielen omia ilmauksia, älä käännöksiä englannista
- Numerot mono-numeerisesti välilyönnillä (€42 800, ei 42,800)

HYVIÄ ESIMERKKEJÄ:
- "Tappara on tulessa, mutta TPS:n maalivahti pelaa 4. peliä peräkkäin. Mittari sanoo: arvoa kotijoukkueessa."
- "AndyPyron €42K hit on tilastollisesti epätodennäköinen yhdistelmä. Älä yritä toistaa."
- "Korpisoturi pelasi yön yli — 8h sessio, +€24 800. Sinä nukuit, hän voitti."

ÄLÄ KOSKAAN:
- Mainosta uhkapeliä myönteisesti
- Ehdota panostusstrategioita jotka antavat ymmärtää varmoja voittoja
- Käytä huutomerkkejä (yksi maksimissaan)
- Käytä emojeita
- Viittaa fiktiivisiin hahmoihin (ei Topia, ei feikkipersoonia)

PALAUTA AINA validi JSON ilman ympärysmerkkejä tai selityksiä.""",

    "moment_commentary_prompt": """Kirjoitat kommenttia striimaajan merkittävästä hetkestä, joka on havaittu YouTube-videosta tai Twitch-klipistä.

LÄHTÖTIEDOT:
- Striimari: {streamer_name}
- Peli: {game}
- Voittosumma: {amount}
- Tapahtumatyyppi: {event_type}
- Lähde: {source_url}

TEHTÄVÄ:
Kirjoita 3 vaihtoehtoista takea tästä hetkestä, jokainen 40-80 sanaa Mittarin äänellä. Kunkin tulee:
1. Todeta tosiasiat selkeästi
2. Lisätä Mittarin tulkinta (tilastollinen konteksti, kuviontunnistus, skenekonteksti)
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
Kirjoita 3 vaihtoehtoista takea, jokainen 50-100 sanaa Mittarin äänellä. Kunkin tulee:
1. Todeta tapahtuma suomalaisesta näkökulmasta
2. Lisätä Mittarin tulkinta — vedonlyöntinäkökulma kun relevantti
3. Käyttää suomalaisia tunneankkureita (Tappara-fani, Bottas, HJK)

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}, {{"text": "..."}}]}}""",

    "streamer_observation_prompt": """Kirjoitat havainnon suomalaisesta slot-striimaajasta.

LÄHTÖTIEDOT:
- Striimari: {streamer_name}
- Havaittu kuvio: {pattern}
- Konteksti: {context}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoista havaintoa, kumpikin 60-100 sanaa Mittarin äänellä.

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "operator_update_prompt": """Kirjoitat päivityksen kasino-operaattorista.

LÄHTÖTIEDOT:
- Operaattori: {operator_name}
- Päivitystyyppi: {update_type}
- Yksityiskohdat: {details}

TEHTÄVÄ:
Kirjoita 2 vaihtoehtoista päivitystä, kumpikin 80-150 sanaa Mittarin äänellä. Sisällytä:
1. Mikä muuttui
2. Mittarin tulkinta — onko kyseessä parannus, heikennys vai sivuttaisliike
3. Mahdollinen pisteen muutosperuste

Palauta JSON: {{"variants": [{{"text": "..."}}, {{"text": "..."}}]}}""",

    "activity_feed_event_prompt": """Muotoile yksittäinen tapahtuma aktiivisuussyötteeseen — 8-15 sanaa, faktuaalinen, ei tulkintaa.

TIEDOT: {event_summary}

Palauta JSON: {{"variants": [{{"text": "..."}}]}}""",

    "dial_state_change_prompt": """Muotoile mittarin tila-siirtymä lyhyeksi ilmoitukseksi — max 25 sanaa, dramaattinen mutta tyylikäs.

VANHA TILA: {old_state}
UUSI TILA: {new_state}
PÄÄSYY: {primary_driver}

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
    """One-shot Claude call. Returns raw text."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing in /app/backend/.env")

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", "claude-4-sonnet-20250514")

    response = await chat.send_message(UserMessage(text=user_prompt))
    return response


def parse_variants(claude_text: str, expected_count: int) -> List[Dict[str, str]]:
    """Defensive JSON parsing — returns list of {"text": ...}."""
    cleaned = _strip_code_fence(claude_text)
    try:
        parsed = json.loads(cleaned)
        variants = parsed.get("variants", [])
        if isinstance(variants, list) and variants and all("text" in v for v in variants):
            return [{"text": str(v["text"]).strip()} for v in variants[:expected_count] if v.get("text")]
    except (json.JSONDecodeError, AttributeError, TypeError):
        pass
    # Fallback — wrap raw text as single variant
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

    system_prompt = await get_guideline(db, "mittari_voice_system_prompt")
    user_prompt_template = await get_guideline(db, cfg["prompt_key"])

    try:
        user_prompt = user_prompt_template.format(**signal_payload)
    except KeyError:
        # If a placeholder is missing in the payload, render it as N/A so generation continues.
        safe_payload = {**signal_payload}
        for k in re.findall(r"\{(\w+)\}", user_prompt_template):
            safe_payload.setdefault(k, "—")
        user_prompt = user_prompt_template.format(**safe_payload)

    session_id = f"mittari-gen-{uuid.uuid4()}"
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
        import logging
        logging.getLogger(__name__).exception("Distribution fanout failed")
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
    """Idempotently seed default guidelines into the editorial_guidelines collection."""
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
