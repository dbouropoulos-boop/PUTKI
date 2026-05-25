/**
 * Uutiset - public news blog. ALL auto-generated articles, sorted newest
 * first, filterable by category, infinite scroll.
 *
 * Reads /api/content/published?category=&limit=. Backend already supports
 * the category filter via the existing public endpoint.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';
import NewsCard from '../components/NewsCard';
import LiveDeskHeader from '../components/LiveDeskHeader';
import FilterChips from '../components/FilterChips';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const PAGE_SIZE = 30;

const Uutiset = () => {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useDocumentMeta({
    title: `${t('uutiset.title')} - PUTKI HQ`,
    description: t('uutiset.subtitle'),
    canonical: `${BACKEND}/uutiset`,
  });

  const load = useCallback(async (size, filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(size) });
      if (filters.category) params.set('category', filters.category);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.entity)   params.set('entity', filters.entity);
      const r = await fetch(`${BACKEND}/api/content/feed?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []); // BACKEND is a module-level const, intentionally excluded

  const [searchParams] = useSearchParams();
  const filters = useMemo(() => ({
    category: searchParams.get('category'),
    severity: searchParams.get('severity'),
    entity:   searchParams.get('entity'),
  }), [searchParams]);

  useEffect(() => {
    load(limit, filters);
  }, [load, limit, filters]);

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

      <section className="container-wide pb-6">
        <LiveDeskHeader />
        <FilterChips onFilterChange={() => setLimit(PAGE_SIZE)} />
      </section>

      <section className="container-wide pb-16">
        {error && (
          <div className="mono mb-4"
               style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
               data-testid="uutiset-error">
            {t('uutiset.error').toUpperCase()} · {error}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2" data-testid="uutiset-list">
          {items.map((it) => <NewsCard key={it.id} article={it} />)}
        </div>
        {items.length === 0 && !loading && (
          <div className="py-12 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}
               data-testid="uutiset-empty">
            {t('uutiset.empty').toUpperCase()}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
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
