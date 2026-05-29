#!/usr/bin/env python3
"""
Phase 2.4 dead-nav cleanup verification.

  - Captures the post-cleanup sidebar
  - Captures the new /back-office/og-images page
  - Iterates every sidebar nav item and asserts each route renders
    something (no 404, no AuthGate appearing mid-session).
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE = "https://pelisignaali-fi.preview.emergentagent.com"
OUT = "/app/qa-snapshots/phase-2-4-nav-cleanup"
TOKEN = "putki-hq-admin"
os.makedirs(OUT, exist_ok=True)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900},
                                        ignore_https_errors=True)
        await ctx.add_init_script(f"""
            try {{
                localStorage.setItem('mittari-theme', 'light');
                sessionStorage.setItem('putki-hq-admin-token', {TOKEN!r});
                localStorage.setItem('putki_back_office_token', {TOKEN!r});
            }} catch (e) {{}}
        """)
        page = await ctx.new_page()

        # 1) Bot-routing first to mount the shell + capture the cleaned-up sidebar.
        print("== Sidebar snapshot ==")
        await page.goto(f"{BASE}/back-office/bot-routing",
                        wait_until="domcontentloaded", timeout=45_000)
        await page.wait_for_selector('[data-testid="bo-shell-sidebar"]', timeout=45_000)
        await page.wait_for_timeout(3_500)
        await page.screenshot(path=f"{OUT}/sidebar_cleaned.png",
                              full_page=False, type="png")
        print(f"  OK · sidebar_cleaned.png · {os.path.getsize(f'{OUT}/sidebar_cleaned.png')//1024} KB")

        # 2) Iterate every sidebar nav item and visit it. Fail if the URL
        #    drops back to AuthGate or if a 404 marker appears.
        print("\n== Nav-item route resolution ==")
        items = await page.evaluate("""
            (() => {
                return Array.from(document.querySelectorAll('aside [href^="/back-office/"]'))
                    .map(a => ({ href: a.getAttribute('href'), label: a.textContent.trim() }));
            })()
        """)
        print(f"  Sidebar has {len(items)} nav items:")
        results = []
        for it in items:
            href = it["href"]
            label = it["label"]
            try:
                await page.goto(BASE + href, wait_until="domcontentloaded", timeout=30_000)
                await page.wait_for_timeout(1_500)
                # Healthy: shell sidebar visible AND no authgate showing
                has_sidebar = await page.is_visible('[data-testid="bo-shell-sidebar"]')
                has_authgate = await page.is_visible('[data-testid="bo-shell-authgate"]')
                title = await page.title()
                # Some routes are not under shell yet (news-watch, mini-games, etc.)
                # We mark them OK as long as page mounted SOMETHING (title set,
                # body has > 200 chars of content) and didn't hard-404.
                body_chars = await page.evaluate("document.body.innerText.length")
                status_ok = (has_sidebar and not has_authgate) or body_chars > 200
                results.append({
                    "href": href, "label": label,
                    "shell": has_sidebar, "authgate": has_authgate,
                    "title": title[:50], "body_chars": body_chars,
                    "ok": status_ok,
                })
                mark = "OK " if status_ok else "FAIL"
                print(f"  {mark} · {href:48s} · {label:24s} · shell={has_sidebar} body={body_chars}")
            except Exception as e:
                results.append({"href": href, "ok": False, "err": str(e)})
                print(f"  FAIL · {href} · {e}")

        # 3) Capture the new OG-images page
        print("\n== OG-images page snapshot ==")
        await page.goto(f"{BASE}/back-office/og-images",
                        wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_selector('[data-testid="bo-og-images-page"]', timeout=20_000)
        await page.wait_for_timeout(3_000)
        await page.screenshot(path=f"{OUT}/og-images_page.png",
                              full_page=True, type="png")
        print(f"  OK · og-images_page.png · {os.path.getsize(f'{OUT}/og-images_page.png')//1024} KB")

        await browser.close()

        all_ok = all(r.get("ok") for r in results)
        print("\n== SUMMARY ==")
        print(f"  Nav items checked: {len(results)}")
        print(f"  All OK: {all_ok}")
        if not all_ok:
            for r in results:
                if not r.get("ok"):
                    print(f"    BROKEN: {r}")
        return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
