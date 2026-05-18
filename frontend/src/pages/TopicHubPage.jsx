/**
 * TopicHubPage — entity hub at /topic/:id, /striimaajat/:slug, /operaattorit/:slug.
 *
 * Sidebar: entity identity (name, platform/scene, follower count, alert CTA).
 * Main: severity-annotated NewsCard grid filtered to this entity.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bell, Loader2, ArrowLeft } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import NewsCard from '../components/NewsCard';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TopicHubPage = ({ kind }) => {
  const params = useParams();
  const entityType = (kind || params.type || 'topics').toLowerCase();
  const entityId   = (params.id || '').toLowerCase();
  const { t } = useLang();
  const [entity, setEntity] = useState(null);
  const [articles, setArticles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useDocumentMeta({
    title: `${entityId.toUpperCase()} — PUTKI HQ`,
    description: t('hub.meta_desc'),
    canonical: `${BACKEND}/topic/${entityId}`,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BACKEND}/api/entities/${entityType}/${entityId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d) return;
        setEntity(d.entity);
        setArticles(d.articles || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="container-wide py-16 text-center" data-testid="topic-hub-loading">
        <Loader2 className="animate-spin mx-auto" size={28} style={{ opacity: 0.45 }} />
      </div>
    );
  }
  if (!entity) {
    return (
      <div className="container-wide py-16 text-center mono"
           style={{ fontSize: 12, letterSpacing: '0.22em', color: 'var(--muted)' }}
           data-testid="topic-hub-not-found">
        {t('common.not_found').toUpperCase()}
      </div>
    );
  }

  return (
    <div data-testid="topic-hub-page">
      <section className="container-wide pt-10 pb-6">
        <Link to="/uutiset" className="mono inline-flex items-center gap-2 mb-5"
              style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
          <ArrowLeft strokeWidth={1.7} size={12} />
          {t('uutiset.back').toUpperCase()}
        </Link>
        <div className="eyebrow mb-3">{t(`hub.type_${entity.type}`).toUpperCase()}</div>
        <h1 className="display text-4xl sm:text-5xl" style={{ lineHeight: 1.05 }}
            data-testid="topic-hub-name">
          {entity.name}
        </h1>
      </section>

      <section className="container-wide pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="panel p-5" style={{ background: 'var(--bg)', alignSelf: 'start' }} data-testid="topic-hub-sidebar">
            {entity.platform && (
              <div className="mb-3">
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                  {t('hub.platform').toUpperCase()}
                </div>
                <div className="display mt-1" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
                  {entity.platform}
                </div>
              </div>
            )}
            {entity.scene && (
              <div className="mb-3">
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                  {t('hub.scene').toUpperCase()}
                </div>
                <div className="font-serif mt-1" style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {entity.scene}
                </div>
              </div>
            )}
            {entity.follower_count != null && entity.follower_count !== '—' && (
              <div className="mb-4">
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                  {t('hub.followers').toUpperCase()}
                </div>
                <div className="display mt-1" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
                  {entity.follower_count}
                </div>
              </div>
            )}

            <Link
              to="/#dial-cta"
              data-testid="topic-hub-alert-cta"
              className="mono inline-flex items-center justify-center gap-2 w-full"
              style={{
                padding: '13px 16px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
                background: 'var(--ink)', color: 'var(--bg)',
                border: 'none', borderRadius: 2, textDecoration: 'none', marginTop: 8,
              }}
            >
              <Bell strokeWidth={1.8} size={12} />
              {t('hub.alert_cta', { name: entity.name }).toUpperCase()}
            </Link>
          </aside>

          {/* Main feed */}
          <div>
            <div className="mono mb-3" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              {t('hub.all_stories', { count: total }).toUpperCase()}
            </div>
            {articles.length === 0 ? (
              <div className="panel p-8 text-center mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}
                   data-testid="topic-hub-empty">
                {t('hub.no_stories').toUpperCase()}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="topic-hub-articles">
                {articles.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default TopicHubPage;
