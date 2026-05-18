/**
 * Uutiset — public news blog. ALL auto-generated articles, sorted newest
 * first, filterable by category, infinite scroll.
 *
 * Reads /api/content/published?category=&limit=. Backend already supports
 * the category filter via the existing public endpoint.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const PAGE_SIZE = 30;

const CATEGORY_META = {
  urheilijat:  { color: '#2C5F8D', short: 'urheilu' },
  striimaajat: { color: '#7A4ABF', short: 'stream' },
  saannot:     { color: '#C8423C', short: 'saannot' },
  kasinot:     { color: '#E8924A', short: 'kasinot' },
};

const fmtAgo = (iso, t) => {
  if (!iso) return '—';
  try {
    const dt = new Date(iso);
    const secs = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
    if (secs < 60)    return t('uutiset.ago_s').replace('{n}', secs);
    if (secs < 3600)  return t('uutiset.ago_m').replace('{n}', Math.floor(secs / 60));
    if (secs < 86400) return t('uutiset.ago_h').replace('{n}', Math.floor(secs / 3600));
    return t('uutiset.ago_d').replace('{n}', Math.floor(secs / 86400));
  } catch { return '—'; }
};

const Row = ({ item, t }) => {
  const cm = CATEGORY_META[item.category] || { color: '#7A8A9C', short: (item.category || '') };
  return (
    <li data-testid={`uutiset-row-${item.id}`} className="py-5"
        style={{ borderTop: '1px solid var(--border)' }}>
      <Link
        to={`/uutiset/${item.url_slug}`}
        className="grid items-baseline gap-4 group"
        style={{ gridTemplateColumns: '100px 96px minmax(0, 1fr) auto', textDecoration: 'none', color: 'var(--ink)' }}
      >
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {fmtAgo(item.published_at, t)}
        </span>
        <span className="mono inline-flex items-center justify-center"
              style={{ fontSize: 10, letterSpacing: '0.16em', color: '#fff', background: cm.color,
                       padding: '3px 8px', fontWeight: 700 }}>
          {t(`uutiset.cat_${cm.short === 'urheilu' ? 'sports' :
                              cm.short === 'stream' ? 'stream' :
                              cm.short === 'saannot' ? 'rules' :
                              cm.short === 'kasinot' ? 'casinos' : 'all'}`).toUpperCase()}
        </span>
        <span className="font-serif" style={{ fontSize: 17, lineHeight: 1.4 }}>
          {item.headline}
        </span>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', opacity: 0.7 }}>
          {item.views || 0} {t('uutiset.reads').toUpperCase()}
        </span>
      </Link>
    </li>
  );
};

const Uutiset = () => {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const CATEGORIES = useMemo(() => ([
    { key: 'all',         label: t('uutiset.cat_all') },
    { key: 'urheilijat',  label: t('uutiset.cat_sports') },
    { key: 'striimaajat', label: t('uutiset.cat_stream') },
    { key: 'saannot',     label: t('uutiset.cat_rules') },
    { key: 'kasinot',     label: t('uutiset.cat_casinos') },
  ]), [t]);

  useDocumentMeta({
    title: `${t('uutiset.title')} — PUTKI HQ`,
    description: t('uutiset.subtitle'),
    canonical: `${BACKEND}/uutiset`,
  });

  const load = useCallback(async (size, cat) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(size) });
      if (cat && cat !== 'all') params.set('category', cat);
      const r = await fetch(`${BACKEND}/api/content/published?${params.toString()}`);
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
    load(limit, category);
  }, [load, limit, category]);

  const allCaughtUp = useMemo(
    () => items.length < limit && !loading,
    [items.length, limit, loading],
  );

  return (
    <div data-testid="uutiset-page">
      <section className="container-wide pt-10 pb-4">
        <Link to="/" className="mono inline-flex items-center gap-2 mb-5"
              style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
          <ArrowLeft strokeWidth={1.7} size={12} />
          {t('uutiset.back').toUpperCase()}
        </Link>
        <div className="eyebrow mb-3">{t('uutiset.eyebrow').toUpperCase()}</div>
        <h1 className="display text-4xl sm:text-5xl" style={{ lineHeight: 1.05 }}>
          {t('uutiset.title')}
        </h1>
        <p className="font-serif mt-3 max-w-2xl" style={{ fontSize: 15.5, color: 'var(--muted)', lineHeight: 1.55 }}>
          {t('uutiset.subtitle')}
        </p>
      </section>

      <section className="container-wide py-4">
        <div className="flex items-center gap-2 flex-wrap mb-1" data-testid="uutiset-category-filter">
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => { setCategory(c.key); setLimit(PAGE_SIZE); }}
                data-testid={`uutiset-cat-${c.key}`}
                className="mono"
                style={{
                  padding: '7px 14px',
                  fontSize: 10.5,
                  letterSpacing: '0.22em',
                  fontWeight: 700,
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--muted)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border-strong)'}`,
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                {c.label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </section>

      <section className="container-wide pb-16">
        {error && (
          <div className="mono mb-4"
               style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
               data-testid="uutiset-error">
            {t('uutiset.error').toUpperCase()} · {error}
          </div>
        )}
        <ul className="max-w-4xl" data-testid="uutiset-list"
            style={{ borderBottom: '1px solid var(--border)' }}>
          {items.map((it) => <Row key={it.id} item={it} t={t} />)}
          {items.length === 0 && !loading && (
            <li className="py-12 text-center mono"
                style={{ borderTop: '1px solid var(--border)', fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}
                data-testid="uutiset-empty">
              {t('uutiset.empty').toUpperCase()}
            </li>
          )}
        </ul>

        <div className="mt-6 max-w-4xl flex items-center justify-between gap-3 flex-wrap">
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            {t('uutiset.showing').toUpperCase()} · {items.length} {t('uutiset.articles').toUpperCase()}
          </div>
          <button
            type="button"
            data-testid="uutiset-load-more"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            disabled={loading || allCaughtUp}
            className="mono inline-flex items-center gap-2"
            style={{
              padding: '11px 18px',
              background: allCaughtUp ? 'var(--surface)' : 'var(--ink)',
              color: allCaughtUp ? 'var(--muted)' : 'var(--bg)',
              fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
              border: 'none',
              cursor: loading || allCaughtUp ? 'default' : 'pointer',
              borderRadius: 2,
            }}
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            {allCaughtUp ? t('uutiset.all_seen').toUpperCase() : t('uutiset.load_more').toUpperCase()}
          </button>
        </div>
      </section>
    </div>
  );
};

export default Uutiset;
