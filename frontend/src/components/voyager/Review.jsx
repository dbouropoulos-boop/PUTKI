/**
 * Voyager - Operator review card.
 *
 * Spec §4.4 - "Why we like them" with N specific checkable claims and
 * an opt-in editorial-partnership label.
 */
import React from 'react';
import { BadgeCheck } from 'lucide-react';

const Review = ({ lang, week }) => (
  <section data-testid="voyager-review" style={{
    padding: '40px 24px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
  }}>
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, color: 'var(--muted)',
        }}>{lang === 'en' ? 'WHY WE LIKE THEM' : 'MIKSI PIDÄMME HEISTÄ'}</span>
        {week.operator.partnership_label && (
          <span data-testid="voyager-partnership" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.18em', color: '#6FA37D', fontWeight: 700,
          }}>
            {lang === 'en'
              ? `EDITORIAL PARTNERSHIP · ${week.operator.name.toUpperCase()}`
              : `YHTEISTYÖSSÄ ${week.operator.name.toUpperCase()}IN KANSSA`}
          </span>
        )}
      </div>
      <h2 data-testid="voyager-review-headline" style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(24px, 3vw, 32px)', lineHeight: 1.15,
        letterSpacing: '-0.015em', color: 'var(--ink)',
        margin: '0 0 22px', maxWidth: 720,
      }}>
        {lang === 'en'
          ? `${week.operator.name}, in four sentences.`
          : `${week.operator.name} neljässä lauseessa.`}
      </h2>
      <div style={{
        display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}>
        {week.review_points.map((p, i) => (
          <div key={p.headline_fi || p.headline_en || `rp-${i}`}
            data-testid={`voyager-review-${i}`} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <BadgeCheck strokeWidth={1.5} size={18} style={{ color: '#6FA37D' }} />
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
              color: 'var(--ink)', letterSpacing: '-0.005em',
            }}>{lang === 'en' ? p.headline_en : p.headline_fi}</div>
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.55,
              color: 'var(--muted)', margin: 0,
            }}>{lang === 'en' ? p.body_en : p.body_fi}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Review;
