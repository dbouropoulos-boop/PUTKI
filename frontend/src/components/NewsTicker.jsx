/**
 * NewsTicker — Phase 1 (Section 2 of the brief).
 *
 * Full-width continuous horizontal scroll directly under the top bar.
 * The ONLY continuously-scrolling element on the page.
 *
 *   • Source mix: AI-classified items from /api/news/ticker.
 *   • Each headline clickable to source article (target=_blank).
 *   • Relative timestamps (12m / 2h / 1d).
 *   • Pause on hover.
 *   • Empty/stale → "Päivitetään syötettä…" / "Feed updating…".
 *
 * Behaviour:
 *   - Polls every 90s (server already poll-merges from 12 sources every
 *     RSS tick — usually 15min cadence).
 *   - CSS marquee via translate transform; pauses on :hover.
 *   - Severity high → small red dot in front of the headline.
 *
 * Loading state: no stale fallback. We show the "feed updating" line until
 * the first response arrives or if the response is empty.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 90_000;

const SEVERITY_COLOR = {
  high:   '#C13B2C',
  medium: '#C97A3A',
  low:    'transparent',
};

const relativeTime = (capturedIso, lang) => {
  if (!capturedIso) return '';
  const t = new Date(capturedIso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return lang === 'en' ? 'now' : 'nyt';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const NewsTicker = () => {
  const { lang } = useLang();
  const [items, setItems] = useState(null); // null = loading; [] = stale
  const [stale, setStale] = useState(false);
  const ticking = useRef(false);

  const load = useCallback(async () => {
    if (ticking.current) return;
    ticking.current = true;
    try {
      const r = await fetch(`${BACKEND}/api/news/ticker?limit=40`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const list = Array.isArray(d?.items) ? d.items : [];
      setItems(list);
      // Mark stale if newest item > 30 min old.
      if (list.length === 0) {
        setStale(true);
      } else {
        const newest = new Date(list[0].captured_at).getTime();
        setStale(Date.now() - newest > 30 * 60_000);
      }
    } catch {
      setItems([]);
      setStale(true);
    } finally {
      ticking.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Loading / empty / stale → quiet status line.
  if (items === null || items.length === 0 || stale) {
    const msg = items === null
      ? (lang === 'en' ? 'Feed updating…' : 'Päivitetään syötettä…')
      : (lang === 'en' ? 'No fresh items. Editorial monitoring.' : 'Ei tuoreita uutisia. Toimitus seuraa.');
    return (
      <div
        data-testid="news-ticker-empty"
        className="border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="container-wide flex items-center gap-3 py-2.5">
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}
          >
            {lang === 'en' ? 'NEWS · LAST 24H' : 'UUTISET · 24 H'}
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>
            {msg}
          </span>
        </div>
      </div>
    );
  }

  // Double the items so the marquee never reveals the seam.
  const reel = [...items, ...items];

  return (
    <div
      data-testid="news-ticker"
      className="border-b"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div className="container-wide flex items-center" style={{ gap: 14, padding: '6px 0' }}>
        <span
          className="mono shrink-0"
          style={{
            fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)',
            fontWeight: 700, paddingRight: 12, borderRight: '1px solid var(--border)',
          }}
        >
          {lang === 'en' ? 'NEWS · LAST 24H' : 'UUTISET · 24 H'}
        </span>
        <div className="news-ticker-marquee" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="news-ticker-track">
            {reel.map((it, i) => (
              <a
                key={`${it.url}-${i}`}
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`news-ticker-item-${i % items.length}`}
                className="news-ticker-pill"
                style={{
                  color: 'var(--ink)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 18px 4px 0',
                  fontSize: 12.5,
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                }}
              >
                {it.severity && it.severity !== 'low' && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6, height: 6, borderRadius: 999, flex: '0 0 6px',
                      background: SEVERITY_COLOR[it.severity] || 'transparent',
                    }}
                  />
                )}
                <span style={{ fontWeight: 600 }}>{it.title}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.10em', fontWeight: 600 }}>
                  {(it.source || '').toUpperCase()} · {relativeTime(it.captured_at, lang)}
                </span>
                {it.verified && (
                  <span
                    className="mono"
                    title={lang === 'en' ? 'Verified across multiple sources' : 'Vahvistettu useammasta lähteestä'}
                    style={{
                      fontSize: 9, letterSpacing: '0.12em', color: 'var(--data-accent, #4FB3A5)',
                      fontWeight: 700, border: '1px solid currentColor', padding: '1px 5px', borderRadius: 2,
                    }}
                  >
                    ✓
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        .news-ticker-track {
          display: inline-flex;
          align-items: center;
          animation: news-ticker-scroll 90s linear infinite;
        }
        .news-ticker-marquee:hover .news-ticker-track {
          animation-play-state: paused;
        }
        @keyframes news-ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default NewsTicker;
