/**
 * NewsCard - severity-tiered article card.
 *
 * 4 tiers (SCORCHING / HOT / WARM / COOL) with progressive visual prominence
 * and disclosure. Lives in our editorial Nordic aesthetic - no neon, no
 * gradients. Severity is signaled with a left border + label + headline scale.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Zap, Lightbulb, Snowflake, Eye, Layers, Bell } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTimeAgo } from '../hooks/useTimeAgo';

const SEVERITY = {
  SCORCHING: { color: '#C8423C', icon: Flame,     headlineSize: 22, padding: 22, minH: 220, key: 'scorching' },
  HOT:       { color: '#E8924A', icon: Zap,       headlineSize: 19, padding: 20, minH: 180, key: 'hot' },
  WARM:      { color: '#B58A37', icon: Lightbulb, headlineSize: 16, padding: 18, minH: 140, key: 'warm' },
  COOL:      { color: '#7A7E83', icon: Snowflake, headlineSize: 14, padding: 14, minH: 96,  key: 'cool' },
};

const NewsCard = ({ article }) => {
  const { lang, t } = useLang();
  const sev = SEVERITY[article.severity] || SEVERITY.COOL;
  const Icon = sev.icon;
  const ago = useTimeAgo(article.published_at, lang, t);
  const slug = article.url_slug;
  const reads = article.read_count ?? article.views ?? 0;
  const sources = article.source_count ?? 0;
  const tags = (article.entity_tags || []).slice(0, 4);

  const showBody = article.severity === 'SCORCHING' || article.severity === 'HOT';
  const detail = article.subhead || (article.body || '').slice(0, 180);

  return (
    <article
      data-testid={`news-card-${slug}`}
      className="panel hover:shadow-md transition-shadow"
      style={{
        background: 'var(--bg)',
        borderLeft: `3px solid ${sev.color}`,
        padding: sev.padding,
        minHeight: sev.minH,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top row: severity · category · time */}
      <div className="flex items-center gap-3 flex-wrap mono"
           style={{ fontSize: 10, letterSpacing: '0.22em', fontWeight: 700 }}>
        <span className="inline-flex items-center gap-1.5" style={{ color: sev.color }} data-testid={`news-card-sev-${slug}`}>
          <Icon strokeWidth={2} size={11} />
          {t(`severity.${sev.key}`).toUpperCase()}
        </span>
        {article.category && (
          <>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span style={{ color: 'var(--muted)' }}>{article.category.toUpperCase()}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontWeight: 500 }}>{ago.toUpperCase()}</span>
      </div>

      {/* Headline + (for SCORCHING/HOT) body preview */}
      <Link to={`/uutiset/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }} data-testid={`news-card-link-${slug}`}>
        <h3 className="display" style={{
          fontSize: sev.headlineSize, fontWeight: 700,
          color: 'var(--ink)', lineHeight: 1.22, margin: 0,
        }}>
          {article.headline}
        </h3>
        {showBody && detail && (
          <p className="font-serif mt-2" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, margin: '8px 0 0' }}>
            {detail.length > 200 ? `${detail.slice(0, 200)}…` : detail}
          </p>
        )}
      </Link>

      {/* Metadata strip */}
      <div className="mono inline-flex items-center gap-2 flex-wrap"
           style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, marginTop: 'auto' }}>
        <span className="inline-flex items-center gap-1"><Eye strokeWidth={1.8} size={11} /> {reads.toLocaleString()} {(reads === 1 ? t('most_read.read_one') : t('most_read.reads')).toUpperCase()}</span>
        {sources > 0 && (
          <>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span className="inline-flex items-center gap-1"><Layers strokeWidth={1.8} size={11} /> {sources} {t('newsroom.sources').toUpperCase()}</span>
          </>
        )}
      </div>

      {/* Entity tags */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap" data-testid={`news-card-tags-${slug}`}>
          {tags.map((tag) => (
            <Link
              key={tag}
              to={`/topic/${tag}`}
              className="mono"
              style={{
                fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
                padding: '3px 8px',
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                borderRadius: 2, textDecoration: 'none',
                transition: 'background 200ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* CTA - only on SCORCHING and HOT */}
      {(article.severity === 'SCORCHING' || article.severity === 'HOT') && (
        <Link
          to="/#dial-cta"
          data-testid={`news-card-cta-${slug}`}
          className="mono inline-flex items-center justify-center gap-2"
          style={{
            padding: '10px 12px', fontSize: 10.5, letterSpacing: '0.22em', fontWeight: 700,
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1px solid var(--border-strong)', borderRadius: 2,
            textDecoration: 'none', marginTop: 4,
          }}
        >
          <Bell strokeWidth={1.8} size={11} />
          {t('newsroom.alert_cta').toUpperCase()}
        </Link>
      )}
    </article>
  );
};

export default NewsCard;
