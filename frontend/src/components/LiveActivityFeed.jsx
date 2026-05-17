/**
 * LiveActivityFeed — Phase 4 chronological homepage feed.
 *
 * Pulls /api/content/published?limit=50 every 60 s. Renders each entry as a
 * row with relative timestamp, category pill, headline link, and view count.
 * Implements infinite-scroll style "Lataa lisää" pagination by bumping the
 * limit parameter when the user hits the load-more button.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;
const PAGE_SIZE = 25;

const CATEGORY_META = {
  urheilijat:  { label: 'URHEILU',   color: '#2C5F8D' },
  striimaajat: { label: 'STREAM',    color: '#7A4ABF' },
  saannot:     { label: 'SÄÄNNÖT',   color: '#C8423C' },
  kasinot:     { label: 'KASINOT',   color: '#E8924A' },
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

const FeedRow = ({ item }) => {
  const meta = CATEGORY_META[item.category] || { label: (item.category || '').toUpperCase(), color: '#7A8A9C' };
  return (
    <li data-testid={`feed-row-${item.id}`} className="py-5" style={{ borderTop: '1px solid #e8e4dc' }}>
      <Link
        to={`/uutiset/${item.url_slug}`}
        className="flex items-baseline gap-5 group"
        style={{ textDecoration: 'none', color: 'var(--ink)' }}
      >
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, minWidth: 96, flexShrink: 0 }}
          data-testid={`feed-time-${item.id}`}
        >
          {fmtAgo(item.published_at)}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            color: '#fff',
            background: meta.color,
            padding: '2px 8px',
            fontWeight: 700,
            flexShrink: 0,
            minWidth: 86,
            textAlign: 'center',
          }}
          data-testid={`feed-category-${item.id}`}
        >
          {meta.label}
        </span>
        <span
          className="font-serif"
          style={{ fontSize: 17, lineHeight: 1.4, color: 'var(--ink)', flex: 1, transition: 'color 200ms ease' }}
          data-testid={`feed-headline-${item.id}`}
        >
          {item.headline}
        </span>
        <span
          className="mono"
          style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', opacity: 0.7, flexShrink: 0 }}
          data-testid={`feed-views-${item.id}`}
        >
          {item.views || 0} LUKUKERTAA
        </span>
      </Link>
    </li>
  );
};

const LiveActivityFeed = () => {
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (size) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/content/published?limit=${size}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(limit);
    const id = setInterval(() => load(limit), POLL_MS);
    return () => clearInterval(id);
  }, [load, limit]);

  return (
    <section className="container-wide py-12 lg:py-16" data-testid="live-activity-feed">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
        <h2 className="display" style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 700 }}>
          Live Activity Feed
        </h2>
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#2c7a4b', boxShadow: '0 0 6px #2c7a4b' }} />
          PUTKI HQ · LIVE
        </div>
      </div>
      <p className="font-serif mb-8" style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 640 }}>
        Layer 2 -signaaleista syntyneitä artikkeleita. Jokainen rivi on automaattisesti tuotettu, mutta toimitus valvoo TIER 2 -sisällöt erikseen.
      </p>

      {error ? (
        <div className="mono mb-4" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
             data-testid="feed-error">
          VIRHE · {error}
        </div>
      ) : null}

      <ul className="max-w-4xl" data-testid="feed-list" style={{ borderBottom: '1px solid #e8e4dc' }}>
        {items.map((it) => <FeedRow key={it.id} item={it} />)}
        {!items.length && !loading ? (
          <li className="py-12 text-center mono"
              style={{ borderTop: '1px solid #e8e4dc', fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}
              data-testid="feed-empty">
            EI VIELÄ ARTIKKELEITA — POLLERIT KÄRSIVÄLLISTYTTÄVÄT
          </li>
        ) : null}
      </ul>

      <div className="mt-6 max-w-4xl flex items-center justify-between gap-3 flex-wrap">
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          NÄYTETÄÄN · {items.length} ARTIKKELIA
        </div>
        <button
          type="button"
          data-testid="feed-load-more-btn"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
          disabled={loading || items.length < limit}
          className="mono"
          style={{
            padding: '10px 18px',
            background: items.length < limit ? '#f4f1ea' : '#1a1a1a',
            color: items.length < limit ? 'var(--muted)' : '#fff',
            fontSize: 11,
            letterSpacing: '0.22em',
            border: 'none',
            cursor: loading || items.length < limit ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 1,
          }}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : null}
          {items.length < limit ? 'KAIKKI NÄHTY' : 'LATAA LISÄÄ →'}
        </button>
      </div>
    </section>
  );
};

export default LiveActivityFeed;
