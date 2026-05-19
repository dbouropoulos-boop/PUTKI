/**
 * PUTKI HQ — RecentWinnersStrip.
 *
 * Social-proof block at the bottom of /voita. Renders the last N drawn
 * raffles with masked winner emails sourced from
 * /api/voita/recent-winners.
 *
 * Renders nothing when there are no drawn raffles yet — silent absence
 * is better than an empty-state pill for a social-proof surface.
 */
import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fmtDate = (iso, lang) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fi-FI', {
      day: '2-digit', month: 'short', year: '2-digit',
    });
  } catch { return ''; }
};

const RecentWinnersStrip = () => {
  const { lang } = useLang();
  const [items, setItems] = useState(null); // null = loading, [] = none yet

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/voita/raffles?status=paid&limit=3`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => { if (!stop) setItems(d.items || []); })
      .catch(() => { if (!stop) setItems([]); });
    return () => { stop = true; };
  }, []);

  // Silent absence when no drawn raffles yet — no "Coming soon" placeholder.
  if (items === null || items.length === 0) return null;

  return (
    <section data-testid="voita-recent-winners" style={{
      borderTop: '1px solid var(--hairline, #221E1B)',
      padding: '32px 0 48px',
    }}>
      <span style={{
        color: 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.24em', fontWeight: 700,
        display: 'block', marginBottom: 14,
      }}>{lang === 'en' ? 'RECENT WINNERS · LAST 3 PAID DRAWS' : 'VIIMEISIMMÄT VOITTAJAT · 3 MAKSETTUA ARVONTAA'}</span>

      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((r) => (
          <div key={r.raffle_slug} data-testid={`voita-recent-winners-card-${r.raffle_slug}`} style={{
            padding: '16px 20px',
            background: 'var(--surface, #141210)',
            border: '1px solid var(--hairline, #221E1B)',
            borderLeft: '2px solid #6FA37D',
          }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
              gap: 12, marginBottom: 10,
            }}>
              <span style={{
                color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
                fontSize: 10, letterSpacing: '0.18em', fontWeight: 700,
              }}>{(r.sport || '').toUpperCase()}{r.league ? ` · ${r.league.toUpperCase()}` : ''}</span>
              <span style={{
                color: 'var(--ink)', fontFamily: 'Georgia, serif',
                fontSize: 15, fontWeight: 600,
              }}>
                {r.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {r.away_team}
                <span style={{ color: '#9ad4a9', marginLeft: 8 }}>· {r.result_score}</span>
              </span>
              <span style={{
                marginLeft: 'auto',
                color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
                fontSize: 10, letterSpacing: '0.14em',
              }}>
                {lang === 'en' ? 'DRAWN' : 'ARVOTTU'} {fmtDate(r.drawn_at, lang)}
                {r.paid_at && (
                  <> · <span data-testid="voita-recent-winners-paid" style={{ color: '#9ad4a9' }}>
                    {lang === 'en' ? 'PAID' : 'MAKSETTU'} {fmtDate(r.paid_at, lang)}
                  </span></>
                )}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {(r.winners || []).filter((w) => w.display_label).map((w) => (
                <div key={`${r.raffle_slug}-${w.position}`}
                  data-testid={`voita-winner-${r.raffle_slug}-${w.position}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr auto',
                    gap: 12, alignItems: 'center',
                    padding: '8px 10px',
                    background: 'var(--bg, #0B0A09)',
                  }}>
                  <span style={{
                    color: '#FFD66E', fontFamily: 'Georgia, serif',
                    fontWeight: 700, fontSize: 18, textAlign: 'center',
                  }}>#{w.position}</span>
                  <span style={{
                    color: 'var(--ink)',
                    fontFamily: w.display_name ? 'Georgia, serif' : 'ui-monospace, monospace',
                    fontSize: w.display_name ? 14 : 12,
                    fontWeight: w.display_name ? 600 : 400,
                    letterSpacing: w.display_name ? '0' : '0.04em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{w.display_label}</span>
                  <span style={{
                    color: '#FFFFFF', fontFamily: 'Georgia, serif',
                    fontSize: 16, fontWeight: 700,
                  }}>€{w.prize_amount_eur} <span style={{
                    color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
                    fontSize: 10, letterSpacing: '0.16em', marginLeft: 6,
                  }}>{(w.prize_type || 'cash').toUpperCase()}</span></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p data-testid="voita-recent-winners-disclaimer" style={{
        marginTop: 14, color: 'var(--muted)', fontSize: 11,
        fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em',
        lineHeight: 1.7,
      }}>
        {lang === 'en'
          ? 'Names shown only when winners chose to be visible. Otherwise emails are masked.'
          : 'Nimet näytetään vain, jos voittajat ovat valinneet näkyvyyden. Muutoin sähköpostit on peitetty.'}
      </p>
    </section>
  );
};

export default RecentWinnersStrip;
