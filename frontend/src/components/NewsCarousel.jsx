/**
 * NewsCarousel — Phase 1 Sprint 3.b (Section 3d).
 *
 * Auto-rotating carousel of AI-aggregated news items for the right side
 * of the Mittari section. Visually subordinate to the dial.
 *
 *   • Source: /api/news/ticker (classified items, relevance >= 45).
 *   • Auto-advance: discrete slide every 7s (NOT continuous scroll —
 *     each motion behaviour on the page must mean something different).
 *   • Pause on hover. Dot indicators below.
 *   • Per-slide content: category badge + headline + 1-line lede +
 *     source citation + relative time.
 *   • Max 4 information elements per card per simplification rule.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const SLIDE_MS = 7000;
const POLL_MS = 5 * 60_000;

const CATEGORY_LABEL = {
  news:        { fi: 'UUTISET',    en: 'NEWS',       color: '#6B7280' },
  sports:      { fi: 'URHEILU',    en: 'SPORTS',     color: '#4A8B5E' },
  gambling:    { fi: 'RAHAPELIT',  en: 'GAMBLING',   color: '#7C5BA8' },
  scene:       { fi: 'SKENE',      en: 'SCENE',      color: '#C0568D' },
  regulation:  { fi: 'SÄÄNTELY',   en: 'REGULATION', color: '#4A7BA8' },
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

const NewsCarousel = () => {
  const { lang } = useLang();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/news/ticker?limit=8`);
      if (!r.ok) return;
      const d = await r.json();
      setItems(Array.isArray(d?.items) ? d.items.slice(0, 6) : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (items.length === 0 || hover) return;
    const id = setInterval(() => setActive((i) => (i + 1) % items.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [items.length, hover]);

  const anchor = lang === 'en' ? 'NEWS · LAST 24H' : 'UUTISET · 24 H';

  if (items.length === 0) {
    return (
      <aside
        data-testid="news-carousel-empty"
        className="panel p-5"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }}
      >
        <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {anchor}
        </div>
        <p className="font-serif" style={{ fontSize: 13, color: 'var(--muted)' }}>
          {lang === 'en' ? 'No stories yet today. Editorial monitoring.' : 'Ei vielä tämän päivän juttuja. Toimitus seuraa.'}
        </p>
      </aside>
    );
  }

  const it = items[active];
  const cat = CATEGORY_LABEL[it.category] || CATEGORY_LABEL.news;

  return (
    <aside
      data-testid="news-carousel"
      className="panel p-5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="mono mb-3" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        {anchor}
      </div>

      <a
        href={it.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`news-carousel-slide-${active}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          flex: 1,
        }}
      >
        <span
          className="mono inline-block mb-2"
          data-testid="news-carousel-category"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.16em',
            color: '#fff',
            fontWeight: 700,
            background: cat.color,
            padding: '2px 8px',
            borderRadius: 2,
          }}
        >
          {lang === 'en' ? cat.en : cat.fi}
        </span>
        <h3
          className="display"
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.22,
            marginBottom: 8,
          }}
        >
          {it.title}
        </h3>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.10em',
            color: 'var(--muted)',
            fontWeight: 600,
          }}
        >
          {(lang === 'en' ? 'Source: ' : 'Lähde: ')}{(it.source || '').toUpperCase()} · {relativeTime(it.captured_at, lang)}
          {it.verified && <span style={{ color: 'var(--data-accent, #4FB3A5)', marginLeft: 6 }}>✓</span>}
        </div>
      </a>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5 mt-3" data-testid="news-carousel-dots">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            data-testid={`news-carousel-dot-${i}`}
            onClick={() => setActive(i)}
            style={{
              width: i === active ? 18 : 6,
              height: 4,
              border: 'none',
              padding: 0,
              borderRadius: 2,
              background: i === active ? 'var(--ink)' : 'var(--border-strong)',
              cursor: 'pointer',
              transition: 'width 300ms ease, background 300ms ease',
            }}
          />
        ))}
      </div>
    </aside>
  );
};

export default NewsCarousel;
