/**
 * PUTKI HQ - VoyagerHomeStrip
 *
 * Single editorial banner on the homepage that links to /game (Voyager
 * weekly pick). Pulls real data from /api/voyager/active so the headline,
 * operator, prize, and verdict match the page the visitor lands on.
 *
 * Restraint:
 *  - One CTA, one verdict line, one tried-it-ourselves line, one rotation
 *    countdown. No outcome claims.
 *  - Hidden gracefully when the rotation endpoint returns nothing.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const VoyagerHomeStrip = () => {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [week, setWeek] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/voyager/active`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const w = d.active || d.week || null;
        if (w) setWeek(w);
      })
      .catch(() => { /* noop: hidden if endpoint unreachable */ });
    return () => { cancelled = true; };
  }, []);

  const daysLeft = useMemo(() => {
    if (!week?.next_rotation_iso) return null;
    try {
      const ms = new Date(week.next_rotation_iso).getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    } catch { return null; }
  }, [week]);

  const fmtDate = useMemo(() => {
    if (!week?.next_rotation_iso) return '';
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
        day: 'numeric', month: 'short',
      }).format(new Date(week.next_rotation_iso));
    } catch { return ''; }
  }, [lang, week]);

  if (!week) return null;

  const gameTitle = lang === 'en' ? week.game?.title_en : week.game?.title_fi;
  const operator = week.operator?.name;
  const verdict = lang === 'en' ? week.verdict_en : week.verdict_fi;
  const tried = lang === 'en' ? week.tried_en : week.tried_fi;
  const prizeMin = week.prize?.min;
  const prizeMax = week.prize?.max;
  const prizeLabel = lang === 'en' ? week.prize?.label_en : week.prize?.label_fi;
  const weekLabel = lang === 'en' ? week.week_label_en : week.week_label_fi;
  // Light mode swaps the brassy gold for a more editorial deep-amber that
  // reads correctly against cream. Dark mode keeps the original brand gold.
  const gold = isLight ? '#A0750F' : '#D4B445';
  const headlineColor = isLight ? 'var(--ink)' : '#F5F3EE';
  const ctaColor = isLight ? 'var(--ink)' : '#FFFFFF';
  const verdictColor = isLight ? 'var(--ink)' : 'var(--ink, #ECE6D8)';

  return (
    <section
      data-testid="voyager-home-strip"
      style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        marginTop: 28, padding: '24px 0 8px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', paddingBottom: 14,
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
          fontSize: 10, fontWeight: 700,
          fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
        }}>
          {lang === 'en' ? 'VOYAGER · GAME OF THE WEEK' : 'VOYAGER · VIIKON PELI'}
        </span>
        {daysLeft !== null && (
          <span data-testid="voyager-home-strip-rotation" style={{
            color: 'var(--muted, #9C9587)', letterSpacing: '0.18em',
            fontSize: 10, fontFamily: 'ui-monospace, monospace',
          }}>
            {lang === 'en'
              ? `NEXT PICK · ${fmtDate} · ${daysLeft}D`
              : `UUSI VALINTA · ${fmtDate} · ${daysLeft} PV`}
          </span>
        )}
      </div>

      <Link
        to="/game"
        data-testid="voyager-home-strip-link"
        style={{
          display: 'block', position: 'relative',
          padding: '28px 26px 24px',
          background: isLight ? 'var(--surface)' : 'var(--surface, #141210)',
          textDecoration: 'none', color: 'inherit',
          overflow: 'hidden', isolation: 'isolate',
          border: isLight ? '1px solid var(--border)' : 'none',
          borderRadius: isLight ? 6 : 0,
        }}
      >
        {/* Designed background. Light mode: cream-on-paper with a soft amber
            spotlight + a subtle topographic texture (no heavy gradient).
            Dark mode: the original brass-on-charcoal editorial gradient. */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: isLight ? `
            radial-gradient(circle at 85% 30%, rgba(160,117,15,0.14) 0%, rgba(160,117,15,0) 50%),
            linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)`
            : `
            radial-gradient(circle at 85% 30%, rgba(212,180,69,0.18) 0%, rgba(212,180,69,0) 55%),
            linear-gradient(135deg, #14110d 0%, #1a1612 100%)`,
          opacity: 0.92,
        }} />
        <span aria-hidden style={{
          position: 'absolute', right: '-1%', bottom: '-22%',
          fontFamily: 'Georgia, serif', fontWeight: 900,
          fontSize: 240, lineHeight: 1, letterSpacing: '-0.06em',
          color: isLight ? 'rgba(160,117,15,0.08)' : 'rgba(212,180,69,0.10)',
          pointerEvents: 'none', userSelect: 'none', zIndex: 1,
        }}>V</span>
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: isLight
            ? 'linear-gradient(90deg, rgba(244,242,238,0.0) 0%, rgba(244,242,238,0.0) 60%, rgba(244,242,238,0.0) 100%)'
            : 'linear-gradient(90deg, rgba(11,10,9,0.86) 0%, rgba(11,10,9,0.58) 60%, rgba(11,10,9,0.86) 100%)',
        }} />

        <div style={{
          position: 'relative', zIndex: 2,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 24, alignItems: 'center',
        }}
        className="voyager-strip-grid">
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.22em', fontWeight: 700, color: '#6FA37D',
              textTransform: 'uppercase',
            }}>
              <Sparkles strokeWidth={1.5} size={12} />
              {lang === 'en' ? `VIIKON VALINTA · ${weekLabel || 'WEEK 1'}` : `VIIKON VALINTA · ${weekLabel || 'VIIKKO 1'}`}
            </div>
            <h3 data-testid="voyager-home-strip-headline" style={{
              fontFamily: 'Georgia, serif', fontWeight: 700,
              fontSize: 'clamp(22px, 2.6vw, 32px)', lineHeight: 1.12,
              letterSpacing: '-0.02em', color: headlineColor,
              margin: '0 0 10px',
            }}>
              {gameTitle} × {operator}
              <span style={{ color: 'var(--muted, #9C9587)', fontWeight: 400 }}>
                {lang === 'en' ? ' - pick of the week.' : ' - viikon valinta.'}
              </span>
            </h3>
            {verdict && (
              <p data-testid="voyager-home-strip-verdict" style={{
                color: verdictColor, fontSize: 13.5,
                lineHeight: 1.55, margin: '0 0 8px', maxWidth: 640,
                fontFamily: 'Georgia, serif', fontWeight: 400,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>{verdict}</p>
            )}
            {tried && (
              <p data-testid="voyager-home-strip-tried" style={{
                color: 'var(--muted, #9C9587)',
                fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.08em', fontWeight: 600,
                margin: 0, lineHeight: 1.5,
              }}>{tried}</p>
            )}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-end', gap: 10, minWidth: 160,
          }}
          className="voyager-strip-right">
            {prizeMin && prizeMax && (
              <div data-testid="voyager-home-strip-prize" style={{ textAlign: 'right' }}>
                <div style={{
                  color: gold,
                  fontFamily: 'Georgia, serif', fontWeight: 700,
                  fontSize: 'clamp(22px, 2.4vw, 28px)', lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>{prizeMin}-{prizeMax}</div>
                <div style={{
                  color: 'var(--muted, #9C9587)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                  letterSpacing: '0.18em', fontWeight: 700,
                  marginTop: 4, textTransform: 'uppercase',
                }}>{prizeLabel}</div>
              </div>
            )}
            <span data-testid="voyager-home-strip-cta" style={{
              color: ctaColor,
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.20em', fontWeight: 700,
              borderBottom: `1px solid ${gold}`, paddingBottom: 4,
            }}>{lang === 'en' ? 'OPEN PICK →' : 'AVAA VALINTA →'}</span>
          </div>
        </div>
      </Link>

      <style>{`
        @media (max-width: 720px) {
          .voyager-strip-grid {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }
          .voyager-strip-right {
            align-items: flex-start !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
};

export default VoyagerHomeStrip;
