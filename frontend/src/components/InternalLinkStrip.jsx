import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

/**
 * InternalLinkStrip — surface-aware related-links rail.
 *
 * Drops a "READ NEXT" panel at the bottom of an editorial page with
 * 2-4 curated internal links. Pure SEO + reader-stickiness play: every
 * deep page should fork into another deep page on the site instead
 * of dead-ending into a Telegram CTA. The Telegram CTA still lives
 * above this in the page layout.
 *
 * Usage:
 *   <InternalLinkStrip
 *     testId="reform-2027-related"
 *     links={[
 *       { to: '/sponsoroinnit', labelFi: 'Sponsoroinnit', labelEn: 'Sponsorships',
 *         hintFi: 'Kuka maksaa kenelle 2027 jälkeen', hintEn: 'Who pays whom after 2027' },
 *     ]}
 *   />
 */
const InternalLinkStrip = ({ testId = 'internal-link-strip', titleFi = 'LUE SEURAAVAKSI', titleEn = 'READ NEXT', links = [] }) => {
  const { lang } = useLang();
  if (!Array.isArray(links) || links.length === 0) return null;
  return (
    <section
      data-testid={testId}
      className="container-wide pt-10 pb-12"
      style={{ borderTop: '1px solid var(--line)' }}
    >
      <div
        className="eyebrow mb-5"
        data-testid={`${testId}-eyebrow`}
        style={{ color: 'var(--ember-strong)' }}
      >
        {lang === 'en' ? titleEn : titleFi}
      </div>
      <div
        className="grid gap-4 sm:gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            data-testid={`${testId}-item-${l.to.replace(/\//g, '-').replace(/^-/, '')}`}
            className="block p-5 transition-colors"
            style={{
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ember-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <div
              className="mono"
              style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--ember-strong)', fontWeight: 700, marginBottom: 8 }}
            >
              {lang === 'en' ? (l.labelEn || l.labelFi) : (l.labelFi || l.labelEn)} →
            </div>
            <div
              className="font-serif"
              style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}
            >
              {lang === 'en' ? (l.hintEn || l.hintFi) : (l.hintFi || l.hintEn)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default InternalLinkStrip;
export { InternalLinkStrip };
