/**
 * VoyagerNewsFeed — mini live feed on /voita-palkinto.
 *
 * Five most recent published articles with relative timestamps. Trust signal
 * for the conversion page: "this is a real publication, not a scam landing
 * page".
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;

const CATEGORY_BADGE = {
  urheilijat:  { label: 'URHEILU',  glyph: '🏒' },
  striimaajat: { label: 'STREAM',   glyph: '📺' },
  saannot:     { label: 'SÄÄNNÖT',  glyph: '⚖️' },
  kasinot:     { label: 'KASINOT',  glyph: '🎰' },
};

const fmtAgo = (iso) => {
  if (!iso) return '—';
  try {
    const t = new Date(iso);
    const secs = Math.max(0, Math.floor((Date.now() - t.getTime()) / 1000));
    if (secs < 60) return `${secs}s sitten`;
    if (secs < 3600) return `${Math.floor(secs / 60)}min sitten`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h sitten`;
    return `${Math.floor(secs / 86400)}d sitten`;
  } catch { return '—'; }
};

const VoyagerNewsFeed = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/content/published?limit=5`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancelled && d) setItems(d.items || []); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!items.length) return null;

  return (
    <section
      data-testid="voyager-news-feed"
      className="mt-12 max-w-3xl mx-auto"
      style={{
        padding: '24px 28px',
        background: 'rgba(44, 95, 141, 0.05)',
        border: '1px solid rgba(44, 95, 141, 0.22)',
        borderRadius: 2,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--ink)', fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#2c7a4b', boxShadow: '0 0 6px #2c7a4b' }} />
          REAL-TIME PUTKI HQ
        </div>
        <Link to="/" className="mono"
              data-testid="voyager-feed-see-all"
              style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', textDecoration: 'none' }}>
          NÄE KAIKKI →
        </Link>
      </div>

      <ul className="flex flex-col" style={{ gap: 12 }}>
        {items.map((it) => {
          const cat = CATEGORY_BADGE[it.category] || { label: (it.category || '').toUpperCase(), glyph: '·' };
          return (
            <li key={it.id} data-testid={`voyager-feed-item-${it.id}`}>
              <Link
                to={`/uutiset/${it.url_slug}`}
                className="flex items-baseline gap-3"
                style={{ textDecoration: 'none', color: 'var(--ink)' }}
              >
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', minWidth: 80 }}>
                  {fmtAgo(it.published_at)}
                </span>
                <span className="font-serif" style={{ fontSize: 14, lineHeight: 1.4, flex: 1 }}>
                  {it.headline}
                </span>
                <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', opacity: 0.7, flexShrink: 0 }}>
                  {cat.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default VoyagerNewsFeed;
