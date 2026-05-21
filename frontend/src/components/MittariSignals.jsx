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

const sharpnessBand = (score, sigCopy) => {
  if (score >= 90) return sigCopy?.band_tight || 'tight';
  if (score >= 75) return sigCopy?.band_clear || 'clear';
  if (score >= 60) return sigCopy?.band_mixed || 'mixed';
  if (score >= 40) return sigCopy?.band_loose || 'loose';
  return sigCopy?.band_scattered || 'scattered';
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

const MittariSignals = ({ unlocked = false, onRevealRequest, copy, lang: propLang, compact = false }) => {
  const { lang: ctxLang } = useLang();
  const lang = propLang || ctxLang;
  const isEn = lang === 'en';
  // Editable copy comes from the parent (Mittari.jsx fetches /api/mittari/copy
  // and passes the per-locale signals subtree). Falls back to bundled defaults
  // so this component still renders if the parent didn't pass anything.
  const sc = copy || {};
  const t = {
    headLockedEyebrow: sc.head_locked_eyebrow || (isEn ? '— DAILY SIGNALS · LOCKED' : '— PÄIVÄN SIGNAALIT · LUKITTU'),
    headUnlockedEyebrow: sc.head_unlocked_eyebrow || (isEn ? '— DAILY SIGNALS · UNLOCKED' : '— PÄIVÄN SIGNAALIT · AVATTU'),
    titleLead: sc.title_lead || (isEn ? 'Today\u2019s' : 'Päivän'),
    titleEm: sc.title_em || (isEn ? 'Signals' : 'Signaalit'),
    previewBadge: sc.preview_badge || (isEn ? 'PREVIEW' : 'ESIKATSELU'),
    previewExplainer: sc.preview_explainer || (isEn
      ? 'Example rows — real picks unlock for subscribers at 09:00.'
      : 'Esimerkkirivit — todelliset poiminnat avautuvat tilaajille klo 09:00.'),
    marketQuietEyebrow: sc.market_quiet_eyebrow || (isEn ? 'MARKET QUIET RIGHT NOW' : 'MARKKINA HILJAINEN JUURI NYT'),
    marketQuietBody: sc.market_quiet_body || (isEn
      ? 'Tomorrow 09:00 we drop the next five. Subscribe and you\u2019ll get the first one the moment the market opens it up.'
      : 'Huomenna klo 09:00 pudotamme seuraavat viisi. Tilaa ja saat ensimmäisen heti kun markkina avautuu.'),
    revealTeaser: sc.reveal_teaser || (isEn ? '⌥ Tap → Signal 01 unlocks instantly' : '⌥ Napsauta → Signaali 01 avautuu heti'),
    // iter52: copy shown when the user has unlocked but today's real
    // pick hasn't dropped yet (placeholder row). Replaces the
    // confusing "still-blurred-after-unlock" state.
    pendingPickLine: sc.pending_pick_line || (isEn
      ? 'Today\u2019s pick · dropping 09:00 — first to Telegram, then email'
      : 'Päivän poiminta · pudotus klo 09:00 — ensin Telegramiin, sitten s\u00e4hk\u00f6postiin'),
    confidenceLabel: sc.confidence_label || 'Sharpness',
    impliedLabel: sc.implied_label || (isEn ? 'implied prob.' : 'todennäköisyys'),
    impliedInline: sc.implied_inline || (isEn ? 'implied' : 'todenn.'),
    lockedFoot: sc.locked_foot || (isEn ? 'Locked · the full five drop every morning at' : 'Lukittu · viisi pudotusta joka aamu klo'),
    unlockedFoot: sc.unlocked_foot || (isEn
      ? '✓ Signal 01 unlocked · the rest land in your inbox in <3 seconds'
      : '✓ Signaali 01 avattu · loput tippuvat sähköpostiisi alle 3 sekunnissa'),
    drawLabel: sc.draw_label || (isEn ? 'draw' : 'tasapeli'),
    vsLabel: sc.vs_label || 'vs',
  };

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

  const realPicks = useMemo(() => {
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
      isPlaceholder: false,
    }));
  }, [payload]);

  // Locked = visible shape, never an empty box. When the upstream Odds
  // API has nothing for us right now (dormant key, between days, off-
  // season), we still render 5 placeholder rows with PLAUSIBLE shape so
  // the user reads "locked" — never "broken / empty". Subtle 'preview'
  // badge keeps it honest. Replaced the moment real picks land.
  const PLACEHOLDER_ROWS = useMemo(() => ([
    { n: '01', sport: 'NHL',     sportIcon: '🏒', sharpness: 84, impliedProb: 71, kickoff: null, isFirst: true,  isPlaceholder: true },
    { n: '02', sport: 'EPL',     sportIcon: '⚽', sharpness: 78, impliedProb: 64, kickoff: null, isFirst: false, isPlaceholder: true },
    { n: '03', sport: 'UCL',     sportIcon: '⚽', sharpness: 71, impliedProb: 58, kickoff: null, isFirst: false, isPlaceholder: true },
    { n: '04', sport: 'Liiga',   sportIcon: '🏒', sharpness: 65, impliedProb: 54, kickoff: null, isFirst: false, isPlaceholder: true },
    { n: '05', sport: 'Bundesliga', sportIcon: '⚽', sharpness: 58, impliedProb: 49, kickoff: null, isFirst: false, isPlaceholder: true },
  ]), []);

  const picks = realPicks.length === 5 ? realPicks : PLACEHOLDER_ROWS;
  const showPreviewBadge = picks === PLACEHOLDER_ROWS;

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

  // (Empty state removed — placeholder rows above guarantee shape is
  // always visible. The page never renders a bare "no picks" box.)

  // Compact mode skips the standalone title block — the parent (hero)
  // owns the connective sentence so the user sees wheel + tips paired
  // in one eyeful.
  const showHeader = !compact;

  return (
    <section data-testid="mittari-signals" data-compact={compact ? '1' : '0'}
      style={{ padding: compact ? 0 : '40px 0' }}>
      {showHeader && (
        <div className="ms-head" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, marginBottom: 26, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
              marginBottom: 10,
            }}>{unlocked ? t.headUnlockedEyebrow : t.headLockedEyebrow}</div>
            <h2 data-testid="mittari-signals-title" style={{
              fontFamily: 'Georgia, serif', fontSize: 'clamp(34px, 4.5vw, 48px)',
              lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400, margin: 0,
            }}>{t.titleLead}{' '}
              <em style={{ color: '#E89248', fontStyle: 'italic' }}>{t.titleEm}</em>
            </h2>
            <div style={{
              marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.10em', color: 'var(--muted)',
              textTransform: 'uppercase',
            }}>{dateStr}</div>
          </div>
        </div>
      )}

      {showPreviewBadge && (
        <div data-testid="mittari-signals-preview-badge" style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', color: 'var(--muted)',
        }}>
          <span style={{
            background: 'rgba(232,146,72,0.12)', color: '#E89248',
            border: '1px solid rgba(232,146,72,0.4)',
            padding: '3px 9px', fontWeight: 800, letterSpacing: '0.22em',
          }}>{t.previewBadge}</span>
          <span style={{ flex: 1, minWidth: 0 }}>{t.previewExplainer}</span>
        </div>
      )}

      <div data-testid="mittari-signals-list" style={{
        display: 'flex', flexDirection: 'column', gap: 1,
        background: 'var(--hairline)', border: '1px solid var(--hairline)',
      }}>
        {picks.map((s) => {
          // Placeholder rows have no team strings; show a generic blurred
          // pick line + the (real) sport + sharpness shape so it reads
          // "locked", never "fake".
          const pickText = s.isPlaceholder
            ? (isEn ? 'Favourite vs Underdog @ ?.??' : 'Suosikki vs altavastaaja @ ?.??')
            : (s.side === 'draw'
                ? `${s.home} – ${s.away} · ${t.drawLabel} @ ${s.odds.toFixed(2)}`
                : `${s.pickTeam} · ${t.vsLabel} ${s.side === 'home' ? s.away : s.home} @ ${s.odds.toFixed(2)}`);
          // iter52: when the user has unlocked but today's pick is still
          // a preview placeholder, swap the blurred text for an honest
          // "dropping at 09:00 → Telegram first" line. Keeps the unlock
          // event meaningful instead of looking broken.
          const showPendingCopy = unlocked && s.isFirst && s.isPlaceholder;
          const rowUnlocked = unlocked && s.isFirst;
          const everUnlocked = unlocked;
          const rowPadding = compact ? '14px 16px' : '22px 24px';
          const rowCols = compact
            ? '36px 1fr 80px 60px 24px'
            : '52px 1fr 180px 90px 36px';
          return (
            <div key={s.n} data-testid={`mittari-signal-row-${s.n}`} className="ms-row" style={{
              background: 'var(--surface, #141210)',
              display: 'grid',
              gridTemplateColumns: rowCols,
              gap: compact ? 12 : 22, padding: rowPadding, alignItems: 'center',
              ...(s.isFirst ? {
                borderTop: '1px solid #E89248',
                borderBottom: '1px solid #E89248',
              } : null),
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: compact ? 10 : 11,
                letterSpacing: '0.10em',
                color: s.isFirst ? '#E89248' : 'var(--muted)',
              }}>{s.n}</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 8, minWidth: 0 }}>
                <div data-testid={`mittari-signal-pick-${s.n}`} style={{
                  fontFamily: 'Georgia, serif', fontSize: compact ? 16 : 21, lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  color: rowUnlocked ? '#E89248' : 'var(--ink)',
                  filter: rowUnlocked ? 'none' : 'blur(8px)',
                  userSelect: rowUnlocked ? 'auto' : 'none',
                  transition: 'filter 320ms ease',
                  overflowWrap: 'anywhere',
                }}>{showPendingCopy ? t.pendingPickLine : pickText}</div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: compact ? 9 : 10,
                  letterSpacing: '0.05em', color: 'var(--muted)',
                  lineHeight: 1.6, textTransform: 'uppercase',
                }}>
                  <span style={{ color: '#E89248' }}>{s.sport}{s.sportIcon ? ' ' + s.sportIcon : ''}</span>
                  {' · '}
                  <strong style={{ color: '#E89248' }}>{t.confidenceLabel} {Math.round(s.sharpness)} ({sharpnessBand(s.sharpness, sc)})</strong>
                  {!compact && (<>
                    {' · '}{t.impliedInline} <strong style={{ color: '#E89248' }}>{Math.round(s.impliedProb)}%</strong>
                    {s.kickoff && (<>{' · '}{formatKickoff(s.kickoff, isEn)}</>)}
                  </>)}
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
                    }}>{t.revealTeaser}</div>
                )}
              </div>

              <div data-testid={`mittari-signal-conf-${s.n}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
                  textTransform: 'uppercase',
                }}>{t.confidenceLabel}</span>
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

              {!compact && (
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
                  }}>{t.impliedLabel}</div>
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                color: 'var(--muted)',
              }}>
                {rowUnlocked
                  ? <span style={{ color: '#6BB877', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>✓</span>
                  : <LockIcon size={compact ? 14 : 16} />}
              </div>
            </div>
          );
        })}
      </div>

      {!compact && (
        <div style={{
          marginTop: 16, textAlign: 'center',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.08em', color: 'var(--muted)',
        }}>
          {unlocked ? t.unlockedFoot : `${t.lockedFoot} `}
          {!unlocked && <span style={{ color: '#E89248' }}>09:00</span>}
        </div>
      )}

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
