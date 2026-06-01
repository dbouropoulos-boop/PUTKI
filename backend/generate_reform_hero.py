"""
Generate the Reform 2027 hero image for /app/frontend/public/hero/reform-2027-fi.jpg
using Nano Banana via the Emergent Universal Key.

Run:
    cd /app/backend && python generate_reform_hero.py
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

PROMPT = (
    "Photograph. No text. No letters. No words. No watermarks. No logos. "
    "An editorial wire-service photograph for a Bloomberg-style Finnish "
    "news portal. The Eduskuntatalo (Parliament House of Finland) in "
    "Helsinki, shot at blue-hour dusk from across Mannerheimintie street. "
    "The neoclassical granite columns are uplit with warm tungsten "
    "spotlights against a deep cobalt sky. Slight haze and a few "
    "stationary cars in the foreground street create motion-streak "
    "long-exposure trails. Cinematic colour grade — desaturated cobalt "
    "blues and warm amber highlights. Looks like a Reuters or Getty "
    "Images news wire photograph. Aspect ratio 16:9 (1920x1080). "
    "The image must contain ZERO typography, ZERO writing, ZERO "
    "banners, ZERO street signs with readable text. Pure documentary "
    "architectural photography only."
)


async def main() -> int:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("EMERGENT_LLM_KEY missing")
        return 1
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as exc:
        print(f"emergentintegrations import failed: {exc}")
        return 1

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id="hero-reform-2027-fi",
            system_message="You are an editorial art director for a high-end news portal.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"],
        )
        msg = UserMessage(text=PROMPT)
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as exc:
        print(f"Nano Banana call failed: {exc!r}")
        return 1

    if not images:
        print("no images returned")
        return 1

    try:
        data = base64.b64decode(images[0]["data"])
    except Exception as exc:
        print(f"base64 decode failed: {exc}")
        return 1

    out_path = OUT_DIR / "reform-2027-fi.jpg"
    out_path.write_bytes(data)
    print(f"saved {len(data)} bytes -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
