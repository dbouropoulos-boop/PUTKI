#!/usr/bin/env python3
"""
Phase 2.1 BackOfficeShell light reskin · snapshot sweep.

Captures:
  - AuthGate sign-in screen (logged out)
  - /back-office root + 5 shell-wrapped routes (logged in)
  - Cmd+K palette open
  - Sidebar at 375px mobile width

Files land in /app/qa-snapshots/phase-2-1-shell/{slug}_{viewport}.png
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE = "https://pelisignaali-fi.preview.emergentagent.com"
OUT = "/app/qa-snapshots/phase-2-1-shell"
TOKEN = "putki-hq-admin"
os.makedirs(OUT, exist_ok=True)

SHELL_ROUTES = [
    ("back-office-root", "/back-office"),           # legacy hub - 404 inside shell? render anyway
    ("bot-routing",      "/back-office/bot-routing"),
    ("funnel",           "/back-office/funnel"),
    ("runbook",          "/back-office/runbook"),
    ("settings",         "/back-office/settings"),
    ("leads",            "/back-office/leads"),
]

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "mobile":  {"width": 375,  "height": 800},
}


async def capture_authed(browser, slug, path, viewport_name):
    """Boot pre-authed (token seeded into storage)."""
    vp = VIEWPORTS[viewport_name]
    ctx = await browser.new_context(viewport=vp, ignore_https_errors=True)
    await ctx.add_init_script(f"""
        try {{
            localStorage.setItem('mittari-theme', 'light');
            sessionStorage.setItem('putki-hq-admin-token', {TOKEN!r});
            localStorage.setItem('putki_back_office_token', {TOKEN!r});
        }} catch (e) {{}}
    """)
    page = await ctx.new_page()
    file_path = f"{OUT}/{slug}_{viewport_name}.png"
    try:
        await page.goto(BASE + path, wait_until="domcontentloaded", timeout=45_000)
        # Wait for the shell to mount
        try:
            await page.wait_for_selector('[data-testid="bo-shell-sidebar"]', timeout=45_000)
        except Exception:
            pass
        # Let status strip resolve
        await page.wait_for_timeout(3_500)
        await page.screenshot(path=file_path, full_page=False, type="png")
        size = os.path.getsize(file_path)
        print(f"  OK · {slug:20s} · {viewport_name:7s} · {size//1024} KB")
    except Exception as e:
        print(f"  FAIL · {slug} · {viewport_name} · {e}")
    finally:
        await ctx.close()


async def capture_authgate(browser, viewport_name):
    """Capture the sign-in screen — cleared storage."""
    vp = VIEWPORTS[viewport_name]
    ctx = await browser.new_context(viewport=vp, ignore_https_errors=True)
    await ctx.add_init_script("""
        try {
            localStorage.setItem('mittari-theme', 'light');
            localStorage.removeItem('putki_back_office_token');
            sessionStorage.removeItem('putki-hq-admin-token');
        } catch (e) {}
    """)
    page = await ctx.new_page()
    file_path = f"{OUT}/authgate_{viewport_name}.png"
    try:
        await page.goto(BASE + "/back-office/bot-routing", wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_selector('[data-testid="bo-shell-authgate"]', timeout=15_000)
        await page.wait_for_timeout(1_500)
        await page.screenshot(path=file_path, full_page=False, type="png")
        print(f"  OK · authgate{'':14s} · {viewport_name:7s} · {os.path.getsize(file_path)//1024} KB")
    except Exception as e:
        print(f"  FAIL · authgate · {viewport_name} · {e}")
    finally:
        await ctx.close()


async def capture_cmdk(browser, viewport_name):
    """Capture Cmd+K palette open."""
    vp = VIEWPORTS[viewport_name]
    ctx = await browser.new_context(viewport=vp, ignore_https_errors=True)
    await ctx.add_init_script(f"""
        try {{
            localStorage.setItem('mittari-theme', 'light');
            sessionStorage.setItem('putki-hq-admin-token', {TOKEN!r});
            localStorage.setItem('putki_back_office_token', {TOKEN!r});
        }} catch (e) {{}}
    """)
    page = await ctx.new_page()
    file_path = f"{OUT}/cmdk_palette_{viewport_name}.png"
    try:
        await page.goto(BASE + "/back-office/bot-routing", wait_until="domcontentloaded", timeout=45_000)
        await page.wait_for_selector('[data-testid="bo-shell-sidebar"]', timeout=45_000)
        await page.wait_for_timeout(2_500)
        # Open the palette via the dedicated trigger
        await page.click('[data-testid="bo-shell-cmdk-trigger"]')
        await page.wait_for_selector('[data-testid="bo-shell-cmdk-input"]', timeout=10_000)
        await page.wait_for_timeout(800)
        await page.screenshot(path=file_path, full_page=False, type="png")
        print(f"  OK · cmdk_palette{'':10s} · {viewport_name:7s} · {os.path.getsize(file_path)//1024} KB")
    except Exception as e:
        print(f"  FAIL · cmdk_palette · {viewport_name} · {e}")
    finally:
        await ctx.close()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"])
        # 1) AuthGate (logged-out) - both viewports
        for vp in VIEWPORTS:
            await capture_authgate(browser, vp)
        # 2) All 6 shell routes - both viewports
        for slug, path in SHELL_ROUTES:
            for vp in VIEWPORTS:
                await capture_authed(browser, slug, path, vp)
        # 3) Cmd+K palette open - both viewports
        for vp in VIEWPORTS:
            await capture_cmdk(browser, vp)
        await browser.close()
    print("\n== DONE ==")
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".png"):
            kb = os.path.getsize(f"{OUT}/{f}") // 1024
            print(f"  {f:42s} {kb:>5d} KB")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()) or 0)
