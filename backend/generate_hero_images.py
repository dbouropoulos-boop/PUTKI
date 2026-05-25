"""
One-off: generate the two editorial hero images for /peli and /voita
using Nano Banana via the Emergent Universal Key. Saves to
/app/frontend/public/hero/{peli,voita}.jpg

Run:
    cd /app/backend && python generate_hero_images.py
"""
import asyncio
import base64
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

OUT_DIR = Path("/app/frontend/public/hero")
OUT_DIR.mkdir(parents=True, exist_ok=True)


PROMPTS = {
    "voita": (
        "Photograph. No text. No letters. No words. No watermarks. No logos. "
        "An editorial photo for a Bloomberg-style sports news portal. "
        "Wide low-angle shot of an empty floodlit football (soccer) stadium "
        "at night - looking up the pitch from the corner flag area. Stadium "
        "lights create dramatic shafts of light across the rich green grass. "
        "Sky is deep navy. Stands are empty, slightly out of focus. "
        "Cinematic colour grade, looks like a Reuters or Getty Images wire "
        "photograph. Aspect ratio 16:9 (1920x1080). The image must contain "
        "ZERO typography, ZERO writing, ZERO scoreboards, ZERO sponsor boards. "
        "Pure documentary photography only."
    ),
    "peli": (
        "Photograph. No text. No letters. No words. No watermarks. No logos. "
        "Extreme macro close-up of three vintage casino slot-machine reels "
        "mid-spin, shot at a 45-degree angle. Motion blur on the reel "
        "symbols (cherries, sevens, bars). Lighting is dramatic amber and "
        "gold with deep mahogany shadows - feels like the interior of an "
        "old-money vault, NOT a Vegas casino floor. Brass trim and walnut "
        "wood visible at the edges. Cinematic colour grade. Aspect ratio "
        "16:9 (1920x1080). The image must contain ZERO typography, ZERO "
        "writing, ZERO jackpot displays, ZERO sponsor markings. Pure "
        "documentary product photography only."
    ),
}


async def generate(slug: str, prompt: str) -> bool:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print(f"[{slug}] EMERGENT_LLM_KEY missing - skipping")
        return False
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as exc:
        print(f"[{slug}] emergentintegrations import failed: {exc}")
        return False

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"hero-{slug}",
            system_message="You are an editorial art director for a high-end news portal.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"],
        )
        msg = UserMessage(text=prompt)
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as exc:
        print(f"[{slug}] Nano Banana call failed: {exc!r}")
        return False

    if not images:
        print(f"[{slug}] no images returned")
        return False

    try:
        data = base64.b64decode(images[0]["data"])
    except Exception as exc:
        print(f"[{slug}] base64 decode failed: {exc}")
        return False

    out_path = OUT_DIR / f"{slug}.jpg"
    out_path.write_bytes(data)
    print(f"[{slug}] saved {len(data)} bytes → {out_path}")
    return True


async def main():
    results = {}
    for slug, prompt in PROMPTS.items():
        results[slug] = await generate(slug, prompt)
    print("\nSummary:", results)
    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
