/**
 * MittariSignals — Päivän Signaalit (locked numbered list).
 *
 * SOURCE OF TRUTH: GET /api/odds/featured (odds-derived betting picks).
 *
 * This component is now CAPTURE-FREE — the parent page owns the gate(s)
 * and passes `unlocked` down. We render the locked list, the reveal
 * teaser on row #01, and the (optional) callbacks to scroll the user
 * back to the parent's gate.
 *
 * Visual contract:
 *   - Numbered rows 01–05 (rendered only when the API has picks)
 *   - Pick text blurred until unlocked
 *   - Confidence bar = Sharpness 0–100
 *   - Right column = implied probability %
 *   - Lock icon on every row; row #01 has a reveal-teaser link
 *   - Honest empty-state when no qualifying picks
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const ODDS_REFRESH_MS = 60_000;

const sharpnessBand = (score, isEn) => {
  if (score >= 90) return isEn ? 'tight' : 'tiukka';
  if (score >= 75) return isEn ? 'clear' : 'selkeä';
  if (score >= 60) return isEn ? 'mixed' : 'sekava';
  if (score >= 40) return isEn ? 'loose' : 'löysä';
  return isEn ? 'scattered' : 'hajanainen';
};

const formatKickoff = (iso, isEn) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isEn) {
      return d.toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
      });
    }
    const days = ['su','ma','ti','ke','to','pe','la'];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. ${hh}:${mm}`;
  } catch { return '—'; }
};

const LockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
    <rect x="5" y="11" width="14" height="10" rx="1" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

const MittariSignals = ({ unlocked = false, onRevealRequest }) => {
  const { lang } = useLang();
  const isEn = lang === 'en';

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetch(`${BACKEND}/api/odds/featured`)
        .then((r) => r.ok ? r.json() : null)
        .then((p) => { if (!stop) { setPayload(p); setLoading(false); } })
        .catch(() => { if (!stop) setLoading(false); });
    };
    load();
    const id = setInterval(load, ODDS_REFRESH_MS);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const picks = useMemo(() => {
    const raw = (payload?.picks || []).slice(0, 5);
    return raw.map((p, i) => ({
      n: String(i + 1).padStart(2, '0'),
      pickTeam: p.pick_team,
      home: p.home_team,
      away: p.away_team,
      side: p.pick_side,
      sport: p.sport_label || p.sport_key,
      sportIcon: p.sport_icon || '',
      odds: p.decimal_odds,
      impliedProb: p.implied_probability,
      sharpness: (p.sharpness && p.sharpness.sharpness) || 0,
      kickoff: p.commence_time,
      isFirst: i === 0,
    }));
  }, [payload]);

  const dateStr = useMemo(() => {
    const d = new Date();
    if (isEn) {
      return d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      }) + ' · 09:00';
    }
    const wd = ['sunnuntai','maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai'][d.getDay()];
    const months = ['tammikuuta','helmikuuta','maaliskuuta','huhtikuuta','toukokuuta','kesäkuuta','heinäkuuta','elokuuta','syyskuuta','lokakuuta','marraskuuta','joulukuuta'];
    return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d.getDate()}. ${months[d.getMonth()]} · 09:00`;
  }, [isEn]);

  // Show a quiet-market sentence rather than '—' placeholders when the
  // upstream Odds API has nothing to show. Honesty principle.
  if (!loading && picks.length === 0) {
    return (
      <section data-testid="mittari-signals" style={{ padding: '40px 0' }}>
        <div data-testid="mittari-signals-empty" style={{
          background: 'var(--surface, #141210)',
          border: '1px dashed var(--hairline)',
          padding: '40px 28px', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
            marginBottom: 12,
          }}>{isEn ? 'MARKET QUIET RIGHT NOW' : 'MARKKINA HILJAINEN JUURI NYT'}</div>
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.4,
            color: 'var(--ink)', margin: 0, maxWidth: 520, marginInline: 'auto',
          }}>{isEn
              ? 'Tomorrow 09:00 we drop the next five. Subscribe and you\u2019ll get the first one the moment the market opens it up.'
              : 'Huomenna klo 09:00 pudotamme seuraavat viisi. Tilaa ja saat ensimmäisen heti kun markkina avautuu.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="mittari-signals" style={{ padding: '40px 0' }}>
      <div className="ms-head" style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, marginBottom: 26, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
            marginBottom: 10,
          }}>{unlocked
              ? (isEn ? '— DAILY SIGNALS · UNLOCKED' : '— PÄIVÄN SIGNAALIT · AVATTU')
              : (isEn ? '— DAILY SIGNALS · LOCKED' : '— PÄIVÄN SIGNAALIT · LUKITTU')}</div>
          <h2 data-testid="mittari-signals-title" style={{
            fontFamily: 'Georgia, serif', fontSize: 'clamp(34px, 4.5vw, 48px)',
            lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400, margin: 0,
          }}>{isEn ? 'Today\u2019s ' : 'Päivän '}
            <em style={{ color: '#E89248', fontStyle: 'italic' }}>{isEn ? 'Signals' : 'Signaalit'}</em>
          </h2>
          <div style={{
            marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.10em', color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>{dateStr}</div>
        </div>
      </div>

      <div data-testid="mittari-signals-list" style={{
        display: 'flex', flexDirection: 'column', gap: 1,
        background: 'var(--hairline)', border: '1px solid var(--hairline)',
      }}>
        {picks.map((s) => {
          const opponent = s.side === 'home' ? s.away : s.side === 'away' ? s.home : `${s.home} – ${s.away}`;
          const pickText = s.side === 'draw'
            ? `${s.home} – ${s.away} · ${isEn ? 'draw' : 'tasapeli'} @ ${s.odds.toFixed(2)}`
            : `${s.pickTeam} · ${isEn ? 'vs' : 'vs'} ${opponent} @ ${s.odds.toFixed(2)}`;
          // First row unlocks instantly on parent reveal; rows 2-5 require
          // bot confirmation (subsequent server-side flow).
          const rowUnlocked = unlocked && s.isFirst;
          const everUnlocked = unlocked;
          return (
            <div key={s.n} data-testid={`mittari-signal-row-${s.n}`} className="ms-row" style={{
              background: 'var(--surface, #141210)',
              display: 'grid',
              gridTemplateColumns: '52px 1fr 180px 90px 36px',
              gap: 22, padding: '22px 24px', alignItems: 'center',
              ...(s.isFirst ? {
                borderTop: '1px solid #E89248',
                borderBottom: '1px solid #E89248',
              } : null),
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.10em',
                color: s.isFirst ? '#E89248' : 'var(--muted)',
              }}>{s.n}</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div data-testid={`mittari-signal-pick-${s.n}`} style={{
                  fontFamily: 'Georgia, serif', fontSize: 21, lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  color: rowUnlocked ? '#E89248' : 'var(--ink)',
                  filter: rowUnlocked ? 'none' : 'blur(8px)',
                  userSelect: rowUnlocked ? 'auto' : 'none',
                  transition: 'filter 320ms ease',
                  overflowWrap: 'anywhere',
                }}>{pickText}</div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.05em', color: 'var(--muted)',
                  lineHeight: 1.6, textTransform: 'uppercase',
                }}>
                  <span style={{ color: '#E89248' }}>{s.sport}{s.sportIcon ? ' ' + s.sportIcon : ''}</span>
                  {' · '}
                  <strong style={{ color: '#E89248' }}>{isEn ? 'Sharpness' : 'Sharpness'} {Math.round(s.sharpness)} ({sharpnessBand(s.sharpness, isEn)})</strong>
                  {' · '}{isEn ? 'implied' : 'todenn.'} <strong style={{ color: '#E89248' }}>{Math.round(s.impliedProb)}%</strong>
                  {' · '}{formatKickoff(s.kickoff, isEn)}
                </div>
                {s.isFirst && !everUnlocked && (
                  <div data-testid="mittari-signal-reveal-teaser"
                    onClick={() => onRevealRequest?.()} style={{
                      width: 'fit-content', cursor: 'pointer',
                      padding: '6px 12px', marginTop: 4,
                      background: 'var(--bg)', border: '1px dashed #E89248',
                      fontFamily: 'ui-monospace, monospace', fontSize: 10,
                      letterSpacing: '0.10em', color: '#E89248',
                      textTransform: 'uppercase',
                    }}>⌥ {isEn ? 'Tap → Signal 01 unlocks instantly' : 'Napsauta → Signaali 01 avautuu heti'}</div>
                )}
              </div>

              <div data-testid={`mittari-signal-conf-${s.n}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
                  textTransform: 'uppercase',
                }}>{isEn ? 'Sharpness' : 'Sharpness'}</span>
                <div style={{
                  height: 3, background: 'var(--bg)', position: 'relative',
                }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, s.sharpness))}%`, height: '100%',
                    background: '#E89248',
                  }} />
                </div>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: 'var(--ink)',
                }}>{Math.round(s.sharpness)}</span>
              </div>

              <div data-testid={`mittari-signal-hr-${s.n}`}
                style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: 21, lineHeight: 1,
                  color: 'var(--ink)',
                }}>{Math.round(s.impliedProb)}%</div>
                <div style={{
                  marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  letterSpacing: '0.10em', color: 'var(--muted)',
                  textTransform: 'uppercase',
                }}>{isEn ? 'implied prob.' : 'todennäköisyys'}</div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                color: 'var(--muted)',
              }}>
                {rowUnlocked
                  ? <span style={{ color: '#6BB877', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>✓</span>
                  : <LockIcon />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 16, textAlign: 'center',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.08em', color: 'var(--muted)',
      }}>
        {unlocked
          ? (isEn ? '✓ Signal 01 unlocked · the rest land in your inbox in <3 seconds'
                  : '✓ Signaali 01 avattu · loput tippuvat sähköpostiisi alle 3 sekunnissa')
          : (isEn ? 'Locked · the full five drop every morning at '
                  : 'Lukittu · viisi pudotusta joka aamu klo ')}
        {!unlocked && <span style={{ color: '#E89248' }}>09:00</span>}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .ms-row {
            grid-template-columns: 36px 1fr !important;
            gap: 12px !important;
            padding: 16px !important;
          }
          .ms-row > *:nth-child(3),
          .ms-row > *:nth-child(4),
          .ms-row > *:nth-child(5) { display: none !important; }
        }
      `}</style>
    </section>
  );
};

export default MittariSignals;
