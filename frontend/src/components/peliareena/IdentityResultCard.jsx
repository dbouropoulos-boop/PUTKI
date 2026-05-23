/**
 * PUTKI HQ — IdentityResultCard (iter63)
 *
 * Replaces the old "X/Y score" lead with an identity-first reveal,
 * per the user's mockup. Key principles:
 *
 *   • NO number in the headline — the persona label is the lead.
 *   • Discipline-index stat with animated amber fill bar.
 *   • One-line "hook" with arrow + amber accent — the unanswered loop
 *     that the email gate later resolves.
 *
 * Bilingual via the `i18n/peliareena.js` dictionary.
 */
import React, { useEffect, useRef, useState } from 'react';

const IdentityResultCard = ({
  weekISO,
  profileIndex,     // e.g. "02 / 05"
  profileTitle,     // e.g. "The Tactician"
  verdict,          // sentence under the title
  statLabel,        // e.g. "Discipline index"
  statValue,        // 0..100
  statFootnote,     // e.g. "Higher than 81% of players this week."
  hookText,         // sentence with optional <em>…</em> markup
  weekLabel,        // "WEEK" or "VIIKKO"
}) => {
  const [fillPct, setFillPct] = useState(0);
  const fillRef = useRef(null);

  useEffect(() => {
    // Smooth fill-in animation so the bar feels computed, not pre-baked.
    const t = setTimeout(() => setFillPct(Math.max(0, Math.min(100, statValue))), 250);
    return () => clearTimeout(t);
  }, [statValue]);

  return (
    <div
      data-testid="identity-result-card"
      style={{
        background: '#1a1917',
        color: '#f4f1ea',
        borderRadius: 6,
        padding: '34px 32px 30px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 24px 50px -22px rgba(0,0,0,.55)',
        margin: '0 0 26px',
      }}
    >
      {/* Subtle grain overlay */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: 0.18, mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/></svg>")`,
      }} />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontFamily: 'ui-monospace, JetBrains Mono, monospace',
        fontSize: 9.5, letterSpacing: '0.15em',
        textTransform: 'uppercase', color: '#7d7a72', marginBottom: 22,
      }}>
        <span>Profile {profileIndex} · {profileTitle}</span>
        <span style={{ color: '#d59a2a' }}>{weekLabel} {weekISO}</span>
      </div>

      <div style={{
        fontFamily: 'Georgia, Fraunces, serif',
        fontWeight: 600, fontSize: 'clamp(36px, 6vw, 46px)',
        lineHeight: 0.98, letterSpacing: '-0.02em',
        marginBottom: 14, color: '#fff',
      }}>
        {profileTitle}
      </div>

      <p style={{
        fontFamily: 'Georgia, Newsreader, serif',
        fontSize: 18, lineHeight: 1.4,
        color: '#cfccc3', maxWidth: 380, marginBottom: 24,
      }}>{verdict}</p>

      <div style={{
        fontFamily: 'ui-monospace, JetBrains Mono, monospace',
        fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase',
        color: '#9a978e', display: 'flex', justifyContent: 'space-between',
        marginBottom: 7,
      }}>
        <span>{statLabel}</span>
        <strong style={{ color: '#f4f1ea', fontWeight: 700 }}>{statValue} / 100</strong>
      </div>
      <div style={{
        height: 5, background: '#3a3834', borderRadius: 3, overflow: 'hidden',
      }}>
        <div
          ref={fillRef}
          data-testid="identity-stat-fill"
          style={{
            height: '100%',
            width: `${fillPct}%`,
            background: 'linear-gradient(90deg, #b07d18, #d59a2a)',
            borderRadius: 3,
            transition: 'width 1.1s cubic-bezier(.2,.7,.2,1) .35s',
          }}
        />
      </div>
      <p style={{
        fontFamily: 'ui-monospace, JetBrains Mono, monospace',
        fontSize: 10, color: '#7d7a72', marginTop: 8,
      }}>{statFootnote}</p>

      <div style={{
        marginTop: 24, paddingTop: 20, borderTop: '1px solid #36342f',
        display: 'flex', gap: 11, alignItems: 'flex-start',
      }}>
        <span style={{
          fontFamily: 'Georgia, Fraunces, serif', fontWeight: 900,
          color: '#d59a2a', fontSize: 22, lineHeight: 1, flex: 'none',
        }}>→</span>
        <span
          data-testid="identity-hook-text"
          style={{
            fontSize: 16.5, lineHeight: 1.45, color: '#f4f1ea',
            fontFamily: 'Georgia, Newsreader, serif',
          }}
          // Hook text is editorial copy controlled by us — safe to render
          // the small set of <em>…</em> tags we inject for the amber accent.
          dangerouslySetInnerHTML={{ __html: hookText }}
        />
      </div>
    </div>
  );
};

export default IdentityResultCard;
