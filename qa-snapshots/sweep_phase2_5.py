#!/usr/bin/env python3
"""Phase 2.5 Integrations page snapshot sweep + Voita regression check."""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE = "https://pelisignaali-fi.preview.emergentagent.com"
OUT = "/app/qa-snapshots/phase-2-5-integrations"
TOKEN = "putki-hq-admin"
os.makedirs(OUT, exist_ok=True)


async def snap_authed(browser, slug, path, vp_name, vp, full_page=False):
    ctx = await browser.new_context(viewport=vp, ignore_https_errors=True)
    await ctx.add_init_script(f"""
        try {{
            localStorage.setItem('mittari-theme', 'light');
            sessionStorage.setItem('putki-hq-admin-token', {TOKEN!r});
            localStorage.setItem('putki_back_office_token', {TOKEN!r});
        }} catch (e) {{}}
    """)
    page = await ctx.new_page()
    file_path = f"{OUT}/{slug}_{vp_name}.png"
    try:
        await page.goto(BASE + path, wait_until="domcontentloaded", timeout=45_000)
        if slug.startswith("integrations"):
            await page.wait_for_selector('[data-testid="bo-integrations-smartico"]', timeout=30_000)
        await page.wait_for_timeout(2_500)
        await page.screenshot(path=file_path, full_page=full_page, type="png")
        kb = os.path.getsize(file_path) // 1024
        print(f"  OK · {slug:30s} · {vp_name:7s} · {kb} KB")
    except Exception as e:
        print(f"  FAIL · {slug} · {vp_name} · {e}")
    finally:
        await ctx.close()


async def snap_public(browser, slug, path, vp_name, vp):
    """For /voita-palkinto - no auth, light mode."""
    ctx = await browser.new_context(viewport=vp, ignore_https_errors=True)
    await ctx.add_init_script("""
        try { localStorage.setItem('mittari-theme', 'light'); } catch (e) {}
    """)
    page = await ctx.new_page()
    file_path = f"{OUT}/{slug}_{vp_name}.png"
    try:
        await page.goto(BASE + path, wait_until="domcontentloaded", timeout=45_000)
        # Voita page hydrates settings on a delay - give it 5s
        await page.wait_for_timeout(5_000)
        # Sanity: smartico embed div is in the DOM (rendered regardless
        # of whether the SDK script loaded)
        present = await page.evaluate("!!document.querySelector('#smartico-visitor-mode, [data-testid=\"smartico-embed\"]')")
        await page.screenshot(path=file_path, full_page=False, type="png")
        print(f"  OK · {slug:30s} · {vp_name:7s} · {os.path.getsize(file_path)//1024} KB · smartico-embed-in-dom={present}")
    except Exception as e:
        print(f"  FAIL · {slug} · {vp_name} · {e}")
    finally:
        await ctx.close()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"])
        VP_DT = {"width": 1440, "height": 900}
        VP_MB = {"width": 375, "height": 800}

        # 1) New integrations page (desktop + mobile, full page)
        print("== Integrations page ==")
        await snap_authed(browser, "integrations", "/back-office/integrations",
                          "desktop", VP_DT, full_page=True)
        await snap_authed(browser, "integrations", "/back-office/integrations",
                          "mobile", VP_MB, full_page=True)

        # 2) Settings page (should NOT show Smartico - never did, but
        #    capture as proof the page is unchanged)
        print("== Settings page (verification - no Smartico) ==")
        await snap_authed(browser, "settings_no_smartico", "/back-office/settings",
                          "desktop", VP_DT, full_page=True)

        # 3) /voita-palkinto live regression check
        print("== /voita-palkinto regression ==")
        await snap_public(browser, "voita_palkinto", "/voita-palkinto",
                          "desktop", VP_DT)
        await browser.close()
    print("\n== DONE ==")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()) or 0)
