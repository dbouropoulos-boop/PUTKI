import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { EditorialFooter } from './EditorialFooter';

// Generic archive page shell for the V2 editorial surfaces. Each route configures
// its eyebrow + headline + intro paragraph + Mittari-voice lede, then this shell
// pulls latest approved items from /api/published?surface=<surface>&limit=N.
//
// While empty (Phase 3A V2 - content types exist but no items approved yet),
// the shell renders a "PUTKI HQ VALMISTELEE - KOLME ENSIMMÄISTÄ JUTTUA
// JULKAISTAAN VKOLLA X" panel. Once items exist, they replace that block.

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const EditorialArchivePage = ({
  testId,
  eyebrow,
  headline,
  intro,
  surfaceKey,
  comingSoonHeadline,
  comingSoonBody,
  emptyCtaLabel = 'Tilaa Telegram-kanava →',
  emptyCtaHref = '/',
  showFooter = true,
}) => {
  const { lang } = useLang();
  const [items, setItems] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/published?surface=${encodeURIComponent(surfaceKey)}&limit=24`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [surfaceKey]);

  return (
    <div data-testid={testId} className="min-h-screen">
      <section className="container-wide pt-10 sm:pt-16 pb-8 sm:pb-12">
        <div className="eyebrow mb-4" data-testid={`${testId}-eyebrow`}>{eyebrow}</div>
        <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid={`${testId}-headline`}>
          {headline}
        </h1>
        {intro && (
          <p className="prose-mittari mt-6 max-w-2xl" data-testid={`${testId}-intro`}>
            {intro}
          </p>
        )}
      </section>

      <section className="container-wide pb-12 sm:pb-16">
        {items === null && (
          <div className="mono" data-testid={`${testId}-loading`} style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en' ? 'LOADING ARCHIVE…' : 'LADATAAN ARKISTOA…'}
          </div>
        )}

        {items !== null && items.length === 0 && (
          <div className="panel p-6 sm:p-8 max-w-3xl" data-testid={`${testId}-coming-soon`} style={{ borderLeft: '3px solid #E8924A' }}>
            <div className="eyebrow mb-3" style={{ color: '#E8924A' }}>
              {lang === 'en' ? 'EDITORIAL IN PREPARATION' : 'PUTKI HQ VALMISTELEE'}
            </div>
            <h2 className="display text-2xl sm:text-3xl mb-3" data-testid={`${testId}-coming-soon-headline`}>
              {comingSoonHeadline}
            </h2>
            <p className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink)' }}>
              {comingSoonBody}
            </p>
            <Link to={emptyCtaHref} className="btn-ghost mt-5 inline-block" data-testid={`${testId}-coming-soon-cta`}>
              {emptyCtaLabel}
            </Link>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6" data-testid={`${testId}-grid`}>
            {items.map((it) => (
              <article key={it.id} className="panel p-5 sm:p-6" data-testid={`${testId}-item-${it.id}`}>
                <div className="eyebrow mb-3" style={{ color: '#E8924A' }}>
                  {(it.content_type || '').toUpperCase().replace(/_/g, ' ')}
                </div>
                <p className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink)' }}>
                  {it.text}
                </p>
                <div className="mono mt-4" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                  {new Date(it.published_at).toLocaleString(lang === 'en' ? 'en-GB' : 'fi-FI')}
                </div>
              </article>
            ))}
          </div>
        )}

        {showFooter && <EditorialFooter />}
      </section>
    </div>
  );
};

export default EditorialArchivePage;
