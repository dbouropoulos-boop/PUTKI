/**
 * Voyager - Standfirst (editorial header above the game).
 *
 * Eyebrow · headline · verdict paragraph · "we tried it ourselves"
 * line. Countdown reflects the REAL next-rotation timestamp.
 */
import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

const Standfirst = ({ lang, rotationISO, week }) => {
  const daysLeft = useMemo(() => {
    try {
      const ms = new Date(rotationISO).getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    } catch { return null; }
  }, [rotationISO]);
  const fmtDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
        day: 'numeric', month: 'short',
      }).format(new Date(rotationISO));
    } catch { return ''; }
  }, [lang, rotationISO]);

  return (
    <section data-testid="voyager-standfirst" style={{
      padding: '40px 24px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <span data-testid="voyager-eyebrow" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', fontWeight: 700, color: '#6FA37D',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Sparkles strokeWidth={1.5} size={12} />
            {lang === 'en'
              ? `VIIKON VALINTA · ${week.week_label_en || 'WEEK 1'}`
              : `VIIKON VALINTA · ${week.week_label_fi || 'VIIKKO 1'}`}
          </span>
          {daysLeft !== null && (
            <span data-testid="voyager-rotation" style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600,
            }}>
              {lang === 'en'
                ? `NEXT PICK · ${fmtDate} · ${daysLeft}D`
                : `UUSI VALINTA · ${fmtDate} · ${daysLeft} PV`}
            </span>
          )}
        </div>
        <h1 data-testid="voyager-headline" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1,
          letterSpacing: '-0.02em', color: 'var(--ink)',
          margin: '14px 0 12px',
        }}>
          {lang === 'en'
            ? `${week.game.title_en} × ${week.operator.name} × Putki HQ - pick of the week.`
            : `${week.game.title_fi} × ${week.operator.name} × Putki HQ - viikon valinta.`}
        </h1>
        <p data-testid="voyager-verdict" style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.55,
          color: 'var(--ink)', maxWidth: 720, margin: '0 0 12px',
          fontWeight: 400,
        }}>{lang === 'en' ? week.verdict.en : week.verdict.fi}</p>
        <p data-testid="voyager-tried" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600,
          maxWidth: 720, margin: 0, lineHeight: 1.6,
        }}>{lang === 'en' ? week.tried.en : week.tried.fi}</p>
      </div>
    </section>
  );
};

export default Standfirst;
