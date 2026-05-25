/**
 * PUTKI HQ - TrustPills (Phase 1 Final · Chunk B).
 *
 * Reusable trust strip. Three quiet pills:
 *   - Editorial - not advertising
 *   - 12 verified sources (Yle · HS · IL · IS · MTV · Kauppalehti · Google News FI ×5)
 *   - Strict source citation enforced
 *
 * Renders on /pelisignaalit, /voita, and the homepage below ExploreBlocks
 * as a quiet conversion-trust signal.
 */
import React from 'react';
import { useLang } from '../context/LanguageContext';

const Pill = ({ label, sub }) => (
  <div
    data-testid="trust-pill"
    style={{
      flex: '1 1 200px', minWidth: 200,
      padding: '14px 18px',
      border: '1px solid var(--hairline, #221E1B)',
      background: 'var(--surface, #141210)',
    }}
  >
    <div style={{
      color: 'var(--ink, #ECE6D8)',
      fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
      letterSpacing: '0.18em', fontWeight: 700,
      textTransform: 'uppercase', marginBottom: 4,
    }}>{label}</div>
    <div style={{
      color: 'var(--muted, #9C9587)',
      fontSize: 12, lineHeight: 1.4,
    }}>{sub}</div>
  </div>
);

const TrustPills = ({ dataTestId = 'trust-pills' }) => {
  const { lang } = useLang();
  return (
    <div
      data-testid={dataTestId}
      style={{
        display: 'flex', gap: 1, flexWrap: 'wrap',
        background: 'var(--hairline, #221E1B)',
      }}
    >
      <Pill
        label={lang === 'en' ? 'Editorial · not advertising' : 'Toimitus · ei mainontaa'}
        sub={lang === 'en'
          ? 'Independent newsroom. Affiliate links labeled separately.'
          : 'Itsenäinen toimitus. Affiliaattilinkit merkitty erikseen.'}
      />
      <Pill
        label={lang === 'en' ? '12 verified sources' : '12 vahvistettua lähdettä'}
        sub="Yle · HS · IL · IS · MTV · Kauppalehti · Google News FI ×5"
      />
      <Pill
        label={lang === 'en' ? 'Strict source citation' : 'Tiukka lähdeviittaus'}
        sub={lang === 'en'
          ? 'Every article cites a named outlet in the first 400 characters.'
          : 'Jokainen artikkeli viittaa nimeltä mainittuun lähteeseen ensimmäisten 400 merkin sisällä.'}
      />
    </div>
  );
};

export default TrustPills;
