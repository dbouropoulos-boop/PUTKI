/**
 * LiveActivityFeed - Phase 4 chronological homepage feed.
 *
 * Pulls /api/content/published?limit=N every 60 s. Fully bilingual.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Eye } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;
const PAGE_SIZE = 25;

const FeedRow = ({ item, lang, t, categoryMeta, isNew }) => {
  const meta = categoryMeta[item.category] || {
    label: (item.category || '').toUpperCase(),
    color: '#7A8A9C',
  };
  const isStreamer = item.category === 'striimaajat';
  return (
    <li
      data-testid={`feed-row-${item.id}`}
      className="py-5"
      style={{
        borderTop: '1px solid #e8e4dc',
        animation: isNew ? 'putki-feed-pulse 1600ms ease-out' : 'none',
      }}
    >
      <Link
        to={`/uutiset/${item.url_slug}`}
        className="grid items-center group"
        style={{
          textDecoration: 'none',
          color: 'var(--ink)',
          gridTemplateColumns: '96px 88px 1fr auto',
          columnGap: 20,
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}
          data-testid={`feed-time-${item.id}`}
        >
          {formatTimeAgo(item.published_at, lang)}
        </span>
        <span
          className="mono inline-flex items-center justify-center gap-1"
          style={{
            fontSize: 10, letterSpacing: '0.16em', color: '#fff',
            background: meta.color, padding: '3px 8px',
            fontWeight: 700, flexShrink: 0, textAlign: 'center', borderRadius: 2,
          }}
          data-testid={`feed-category-${item.id}`}
        >
          {isStreamer ? '● ' : ''}{meta.label.toUpperCase()}
        </span>
        <span
          className="font-serif"
          style={{ fontSize: 17, lineHeight: 1.4, color: 'var(--ink)', minWidth: 0, transition: 'color 200ms ease' }}
          data-testid={`feed-headline-${item.id}`}
        >
          {(lang === 'en' && item.headline_en) ? item.headline_en : item.headline}
        </span>
        <span
          className="mono inline-flex items-center gap-1"
          style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', opacity: 0.75, flexShrink: 0, whiteSpace: 'nowrap' }}
          data-testid={`feed-views-${item.id}`}
        >
          <Eye strokeWidth={1.6} size={10} />
          {item.views || 0}
        </span>
      </Link>
    </li>
  );
};

const LiveActivityFeed = () => {
  const { lang, t } = useLang();
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const seenRef = React.useRef(null);

  const categoryMeta = {
    urheilijat:  { label: t('feed.cat_sports'),  color: '#2C5F8D' },
    striimaajat: { label: t('feed.cat_stream'),  color: '#7A4ABF' },
    saannot:     { label: t('feed.cat_rules'),   color: '#C8423C' },
    kasinot:     { label: t('feed.cat_casinos'), color: '#E8924A' },
  };

  const load = useCallback(async (size) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/content/published?limit=${size}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const next = d.items || [];
      // Diff against last-seen IDs so only freshly-arrived rows pulse.
      if (seenRef.current) {
        const seen = seenRef.current;
        const fresh = new Set(next.filter((it) => !seen.has(it.id)).map((it) => it.id));
        if (fresh.size > 0) {
          setNewIds(fresh);
          // Clear the highlight after the animation finishes.
          setTimeout(() => setNewIds(new Set()), 1700);
        }
      }
      seenRef.current = new Set(next.map((it) => it.id));
      setItems(next);
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
          {t('feed.title')}
        </h2>
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#2c7a4b', boxShadow: '0 0 6px #2c7a4b' }} />
          PUTKI HQ · {t('common.live')}
        </div>
      </div>
      <p className="font-serif mb-8" style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 640 }}>
        {t('feed.lede')}
      </p>

      {error ? (
        <div className="mono mb-4" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
             data-testid="feed-error">
          {t('uutiset.error').toUpperCase()} · {error}
        </div>
      ) : null}

      <ul className="max-w-4xl" data-testid="feed-list" style={{ borderBottom: '1px solid #e8e4dc' }}>
        {items.map((it) => (
          <FeedRow key={it.id} item={it} lang={lang} t={t} categoryMeta={categoryMeta} isNew={newIds.has(it.id)} />
        ))}
        {!items.length && !loading ? (
          <li className="py-12 text-center"
              style={{ borderTop: '1px solid #e8e4dc' }}
              data-testid="feed-empty">
            <div className="display mb-2" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
              {t('empty.no_articles_title')}
            </div>
            <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 420, margin: '0 auto' }}>
              {t('empty.no_articles_body')}
            </p>
          </li>
        ) : null}
      </ul>

      <style>{`
        @keyframes putki-feed-pulse {
          0%   { background: rgba(232,146,74,0.18); }
          50%  { background: rgba(232,146,74,0.10); }
          100% { background: transparent; }
        }
      `}</style>

      <div className="mt-6 max-w-4xl flex items-center justify-between gap-3 flex-wrap">
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {t('uutiset.showing').toUpperCase()} · {items.length} {t('uutiset.articles').toUpperCase()}
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
            fontSize: 11, letterSpacing: '0.22em', border: 'none',
            cursor: loading || items.length < limit ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 1,
          }}
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : null}
          {(items.length < limit ? t('uutiset.all_seen') : t('uutiset.load_more')).toUpperCase()}
        </button>
      </div>
    </section>
  );
};

export default LiveActivityFeed;
