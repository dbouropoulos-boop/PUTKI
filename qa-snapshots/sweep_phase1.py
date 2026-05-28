#!/usr/bin/env python3
"""
Phase 1 baseline screenshot sweep.

Captures 8 public pages × 2 modes (light, dark) × 2 viewports
(desktop 1440, mobile 375) into /app/qa-snapshots/phase-1-baseline/.

  - Light mode  → full-page PNG
  - Dark mode   → hero-only viewport PNG

File naming: {slug}_{mode}_{viewport}.png
  e.g. home_light_desktop.png · mittari_dark_mobile.png
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE = "https://pelisignaali-fi.preview.emergentagent.com"
OUT = "/app/qa-snapshots/phase-1-baseline"
os.makedirs(OUT, exist_ok=True)

PAGES = [
    ("home",          "/"),
    ("mittari",       "/mittari"),
    ("mestari",       "/mestari"),
    ("pelisignaalit", "/pelisignaalit"),
    ("peli",          "/peli"),
    ("uutiset",       "/uutiset"),
    ("toimitus",      "/toimitus"),
    ("menetelma",     "/menetelma"),
]

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "mobile":  {"width": 375,  "height": 800},
}

MODES = ["light", "dark"]


async def capture(browser, slug, path, mode, viewport_name):
    vp = VIEWPORTS[viewport_name]
    ctx = await browser.new_context(
        viewport=vp,
        device_scale_factor=1,
        ignore_https_errors=True,
    )
    # Pre-seed theme so the page boots in the requested mode without a flicker
    await ctx.add_init_script(
        f"try {{ localStorage.setItem('mittari-theme', {mode!r}); }} catch (e) {{}}"
    )
    page = await ctx.new_page()
    full = (mode == "light")
    file_path = f"{OUT}/{slug}_{mode}_{viewport_name}.png"
    try:
        await page.goto(BASE + path, wait_until="domcontentloaded", timeout=45_000)
        # Let above-the-fold paint settle and any client-side hydration finish.
        try:
            await page.wait_for_load_state("networkidle", timeout=8_000)
        except Exception:
            pass
        await page.wait_for_timeout(1_500)
        await page.screenshot(path=file_path, full_page=full, type="png")
        size = os.path.getsize(file_path)
        print(f"  OK · {slug:14s} · {mode:5s} · {viewport_name:7s} · {size//1024} KB")
    except Exception as e:
        print(f"  FAIL · {slug} · {mode} · {viewport_name} · {e}")
    finally:
        await ctx.close()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"])
        for slug, path in PAGES:
            for mode in MODES:
                for vp_name in VIEWPORTS:
                    await capture(browser, slug, path, mode, vp_name)
        await browser.close()
    print("\n== DONE ==")
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".png"):
            kb = os.path.getsize(f"{OUT}/{f}") // 1024
            print(f"  {f:48s} {kb:>5d} KB")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()) or 0)
