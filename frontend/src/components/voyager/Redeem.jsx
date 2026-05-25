/**
 * Voyager - Redeem CTA.
 *
 * Spec §5: full redirect URL including ?source=putki-voyager and the
 * Smartico visitor_win_uuid the operator resolves on registration.
 */
import React from 'react';
import { ArrowRight } from 'lucide-react';

const Redeem = ({ lang, prize, week }) => {
  const uuid = (prize && prize.visitor_win_uuid) || '';
  const url = uuid
    ? `${week.operator.redirect_url}&_smartico_visitor_win_uuid=${encodeURIComponent(uuid)}`
    : week.operator.redirect_url;
  const amount = (prize && (prize.amount || prize.spins || prize.value))
    || `${week.prize.min}-${week.prize.max}`;
  const label = lang === 'en' ? week.prize.label_en : week.prize.label_fi;
  return (
    <section data-testid="voyager-redeem" style={{
      padding: '48px 24px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(28px, 3.6vw, 38px)', lineHeight: 1.1,
          letterSpacing: '-0.02em', color: 'var(--ink)',
          margin: '0 0 14px',
        }}>
          {lang === 'en'
            ? `Redeem your ${amount} ${label}.`
            : `Lunasta ${amount} ${label}.`}
        </h2>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 15.5, lineHeight: 1.55,
          color: 'var(--muted)', margin: '0 0 24px',
        }}>
          {lang === 'en'
            ? `Open a ${week.operator.name} session - your pass travels with you.`
            : `Avaa ${week.operator.name}-istunto - passisi kulkee mukana.`}
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          data-testid="voyager-redeem-cta"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '16px 28px',
            background: '#FFBF6B', color: '#0B0A09',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.22em', fontWeight: 800,
            border: 'none', cursor: 'pointer', textDecoration: 'none',
            borderRadius: 2,
          }}>
          {lang === 'en'
            ? `REDEEM AT ${week.operator.name.toUpperCase()}`
            : `LUNASTA ${week.operator.name.toUpperCase()}ILLÄ`}
          <ArrowRight strokeWidth={2} size={14} />
        </a>
        <p style={{
          margin: '18px 0 0',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600,
        }}>{lang === 'en' ? '18+ · PLAY RESPONSIBLY' : '18+ · PELAA VASTUULLISESTI'}</p>
      </div>
    </section>
  );
};

export default Redeem;
