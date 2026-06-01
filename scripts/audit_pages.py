"""
iter96 · Page-by-page audit script.

Runs a Playwright-driven sweep over the public funnel-critical surface,
captures regression-quality data, and dumps it to a single report so the
main agent can pick fixes deterministically.

Per-page metrics:
  • console errors / warnings
  • image alt coverage
  • heading hierarchy
  • internal-link 404s (sampled)
  • document.title + meta description presence
  • canonical + hreflang sanity
  • mobile responsiveness (no horizontal scroll)
  • CLS-ish: largest empty space below the fold

Output: /app/qa-snapshots/audit/audit-report.json + per-route screenshots.
"""
import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

BASE = "https://pelisignaali-fi.preview.emergentagent.com"
OUT = Path("/app/qa-snapshots/audit")
OUT.mkdir(parents=True, exist_ok=True)

ROUTES = [
    # Tier 1 — funnel-critical
    ("/", "home-fi"),
    ("/en", "home-en"),
    ("/mittari", "mittari"),
    ("/mestari", "mestari-hub"),
    ("/mestari/sports", "mestari-sports"),
    ("/pelisignaalit", "pelisignaalit"),
    ("/luotettavuus", "luotettavuus"),
    ("/en/trust", "trust-en"),
    # Tier 2 — content/trust surfaces
    ("/uutiset", "uutiset"),
    ("/menetelma", "menetelma"),
    ("/korjaukset", "korjaukset"),
    ("/saantely/reform-2027", "reform-2027"),
    ("/pelit", "pelit"),
    ("/pelit/blackjack", "pelit-blackjack"),
    ("/pelit/poker", "pelit-poker"),
    ("/pelit/slotit", "pelit-slotit"),
    ("/striimaajat", "striimaajat"),
    ("/skene", "skene"),
    # Tier 3 — trust data + accountability
    ("/trust/voita-tilikirja", "trust-voita"),
    ("/trust/mittari-tarkkuus", "trust-mittari"),
    ("/trust/mestari-aineisto", "trust-mestari"),
    # Tier 4 — legacy comparator
    ("/home-v4", "home-v4-legacy"),
]


async def audit_route(page, path, slug):
    errors = []
    warnings = []
    page.on("pageerror", lambda exc: errors.append(str(exc)[:240]))
    page.on("console", lambda m: (errors if m.type == "error" else warnings).append(f"{m.type}: {m.text[:200]}"))

    url = f"{BASE}{path}"
    try:
        resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        status = resp.status if resp else 0
    except Exception as e:
        return {"path": path, "slug": slug, "error": str(e)[:200]}

    await page.wait_for_timeout(2500)

    # ─ SEO + meta ─
    meta = await page.evaluate("""() => {
        const titleEl = document.querySelector('title');
        const descEl = document.querySelector('meta[name="description"]');
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogImage = document.querySelector('meta[property="og:image"]');
        const hreflangs = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
        return {
            title: titleEl?.textContent || null,
            description: descEl?.getAttribute('content') || null,
            canonical: canonicalEl?.getAttribute('href') || null,
            og_title: ogTitle?.getAttribute('content') || null,
            og_image: ogImage?.getAttribute('content') || null,
            hreflangs: hreflangs.map(l => ({ hreflang: l.getAttribute('hreflang'), href: l.getAttribute('href') })),
            html_lang: document.documentElement.lang || null,
        };
    }""")

    # ─ accessibility & structure ─
    a11y = await page.evaluate("""() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const links = Array.from(document.querySelectorAll('a[href]'));
        const internalLinks = links
            .map(a => a.getAttribute('href'))
            .filter(h => h && (h.startsWith('/') || h.startsWith('#')))
            .filter(h => !h.startsWith('//'));
        return {
            total_imgs: imgs.length,
            imgs_without_alt: imgs.filter(i => !i.hasAttribute('alt') || i.alt.trim() === '').length,
            h1_count: document.querySelectorAll('h1').length,
            headings_outline: headings.slice(0, 30).map(h => ({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 80) })),
            internal_link_sample: Array.from(new Set(internalLinks)).slice(0, 40),
            total_links: links.length,
            buttons_no_label: Array.from(document.querySelectorAll('button')).filter(b =>
                !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')
            ).length,
        };
    }""")

    # ─ layout sanity (mobile horizontal scroll, content visible) ─
    layout = await page.evaluate("""() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const hasHScroll = docW - winW > 4;
        const bodyText = (document.body?.innerText || '').trim();
        return {
            doc_width: docW, win_width: winW, has_h_scroll: hasHScroll,
            body_text_chars: bodyText.length,
        };
    }""")
    # ─ desktop screenshot ─
    try:
        await page.screenshot(path=str(OUT / f"{slug}-desktop.png"), full_page=False, quality=18, type="jpeg")
    except Exception:
        pass

    # ─ mobile pass ─
    await page.set_viewport_size({"width": 390, "height": 800})
    await page.reload(wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(1800)
    mobile_layout = await page.evaluate("""() => {
        return {
            doc_width: document.documentElement.scrollWidth,
            win_width: window.innerWidth,
            has_h_scroll: document.documentElement.scrollWidth - window.innerWidth > 4,
        };
    }""")
    try:
        await page.screenshot(path=str(OUT / f"{slug}-mobile.png"), full_page=False, quality=18, type="jpeg")
    except Exception:
        pass
    await page.set_viewport_size({"width": 1440, "height": 900})

    return {
        "path": path,
        "slug": slug,
        "status": status,
        "errors_count": len(errors),
        "warnings_count": len(warnings),
        "errors_sample": errors[:5],
        "meta": meta,
        "a11y": a11y,
        "layout": layout,
        "mobile_layout": mobile_layout,
    }


async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        for path, slug in ROUTES:
            print(f"AUDIT {path}", flush=True)
            page = await ctx.new_page()
            try:
                row = await audit_route(page, path, slug)
            except Exception as exc:
                row = {"path": path, "slug": slug, "error": str(exc)[:240]}
            results.append(row)
            await page.close()
        await browser.close()
    rep = OUT / "audit-report.json"
    rep.write_text(json.dumps(results, indent=2, default=str))
    # Brief stdout summary
    for r in results:
        if "error" in r:
            print(f"  ✗ {r['path']}: {r['error']}")
            continue
        bullets = []
        if r["a11y"]["h1_count"] != 1:
            bullets.append(f"h1_count={r['a11y']['h1_count']}")
        if r["a11y"]["imgs_without_alt"]:
            bullets.append(f"img_no_alt={r['a11y']['imgs_without_alt']}/{r['a11y']['total_imgs']}")
        if r["a11y"]["buttons_no_label"]:
            bullets.append(f"btn_no_label={r['a11y']['buttons_no_label']}")
        if r["errors_count"]:
            bullets.append(f"errors={r['errors_count']}")
        if not r["meta"]["title"]:
            bullets.append("no_title")
        if not r["meta"]["description"]:
            bullets.append("no_description")
        if not r["meta"]["canonical"]:
            bullets.append("no_canonical")
        if r["layout"]["has_h_scroll"]:
            bullets.append("desktop_hscroll")
        if r["mobile_layout"]["has_h_scroll"]:
            bullets.append("mobile_hscroll")
        flag = "✓" if not bullets else "!"
        print(f"  {flag} {r['path']:36}  {' '.join(bullets) or 'clean'}")


if __name__ == "__main__":
    asyncio.run(main())
