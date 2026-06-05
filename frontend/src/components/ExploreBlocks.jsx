/**
 * PUTKI HQ - ExploreBlocks (Phase 1 Final · Chunk B · post-review rebuild).
 *
 * Four equal-weight preview blocks in a 2×2 grid:
 *   MITTARI       · instrument-dial designed background + real dial visual
 *   PELISIGNAALIT · stock-ticker line texture + top pick details (no truncation)
 *   VOITA         · large editorial typographic treatment (gated state)
 *   PELI          · restrained slot-reel macro
 *
 * Layout (per block, 220px min-height):
 *   - Full-bleed designed background image (absolute)
 *   - Content stack: anchor row → main content → CTA row at bottom
 *   - All blocks equal-weight, single column inside each block
 *   - Hard min-width:0 + ellipsis on every text node so long pick names
 *     and bookmaker labels never break the layout
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { dialReading } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};
const STATE_NAME_FI = {
  KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ',
  MYRSKY: 'MEININKI', KIIRASTULI: 'PERKE*LE',
};
const STATE_NAME_EN = {
  KYLMA: 'CALM', HAALEA: 'BUZZ', KUUMA: 'ACTIVE',
  MYRSKY: 'ROLLING', KIIRASTULI: 'PERKE*LE',
};

// shared block shell - vertical content stack, equal weight.
// iter54: theme-aware. Both modes render the same visual structure
// (designed background → veil → content), but light mode swaps the
// dark rgba veil for a cream-white veil + flips the headline/body
// colours to dark on light. Accent colours stay the same in both
// themes - they're brand identifiers, not chrome.
const Block = ({ to, dataTestId, accent, children }) => (
  <Link
    to={to}
    data-testid={dataTestId}
    className="explore-block"
    style={{
      position: 'relative', minHeight: 220,
      background: 'var(--surface)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      padding: '22px 24px 20px',
      textDecoration: 'none', color: 'inherit',
      isolation: 'isolate',
      transition: 'transform 240ms ease, box-shadow 240ms ease',
      '--block-accent': accent || '#9C9587',
    }}
  >{children}</Link>
);

// Build a theme-aware veil gradient.
// Dark theme: nearly-black wash so the decorative bg is just a glow.
// Light theme: cream-white wash so the decorative bg stays as a tint
// without nuking the underlying paper.
const veilGradient = (theme, opacity = [0.78, 0.84, 0.96]) => {
  if (theme === 'light') {
    return `linear-gradient(135deg,
      rgba(251,250,248,${opacity[0]}) 0%,
      rgba(251,250,248,${opacity[1]}) 60%,
      rgba(251,250,248,${opacity[2]}) 100%)`;
  }
  return `linear-gradient(135deg,
    rgba(11,10,9,${opacity[0]}) 0%,
    rgba(11,10,9,${opacity[1]}) 60%,
    rgba(11,10,9,${opacity[2]}) 100%)`;
};

// Horizontal flavour of the veil (Mestari + Voita use this).
const veilGradientHoriz = (theme, stops) => {
  const s = stops || [0.94, 0.74, 0.96];
  if (theme === 'light') {
    return `linear-gradient(90deg,
      rgba(251,250,248,${s[0]}) 0%,
      rgba(251,250,248,${s[1]}) 55%,
      rgba(251,250,248,${s[2]}) 100%)`;
  }
  return `linear-gradient(90deg,
    rgba(11,10,9,${s[0]}) 0%,
    rgba(11,10,9,${s[1]}) 55%,
    rgba(11,10,9,${s[2]}) 100%)`;
};

// Theme-aware "primary on dark / dark on light" colour for headlines.
const inkFor = (theme) => (theme === 'light' ? '#0A0A0A' : '#F5F3EE');
const bodyFor = (theme) => (theme === 'light' ? '#3A3833' : 'rgba(245,243,238,0.86)');

// Inject the explore-block keyframes + hover styles ONCE. Plain CSS in
// a single <style> tag so we don't add a CSS-in-JS library and so the
// rules are scoped via the `.explore-block` class.
const ExploreBlockStyles = () => (
  <style>{`
    @keyframes putki-anchor-pulse {
      0%, 100% { transform: scale(1); opacity: 0.95; }
      50%      { transform: scale(1.35); opacity: 0.55; }
    }
    .explore-block { will-change: transform; }
    .explore-block::after {
      content: ""; position: absolute; inset: 0;
      pointer-events: none; z-index: 5;
      border: 1px solid transparent;
      transition: border-color 240ms ease;
    }
    .explore-block::before {
      content: ""; position: absolute; top: 0; right: 0;
      width: 80px; height: 80px; pointer-events: none; z-index: 1;
      background: radial-gradient(circle at top right,
        var(--block-accent) 0%,
        transparent 70%);
      opacity: 0.18;
      transition: opacity 320ms ease;
    }
    .explore-block:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px -12px var(--block-accent);
    }
    .explore-block:hover::after { border-color: var(--block-accent); }
    .explore-block:hover::before { opacity: 0.35; }
    .explore-block:hover .explore-cta-arrow { transform: translateX(4px); }
    .explore-block-stat {
      position: absolute; top: 18px; right: 22px;
      z-index: 3; text-align: right; pointer-events: none;
      font-family: ui-monospace, monospace;
      letter-spacing: 0.12em; line-height: 1;
    }
    .explore-block-stat .num {
      color: var(--ink);
      font-size: 22px; font-weight: 700; letter-spacing: -0.01em;
      font-family: Georgia, serif;
    }
    .explore-block-stat .lab {
      color: var(--muted);
      font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
      text-transform: uppercase; margin-top: 2px;
    }
    /* Light-mode tweaks: softer shadow, lighter base accent overlay. */
    :root:not(.dark) .explore-block:hover {
      box-shadow: 0 10px 30px -16px var(--block-accent);
    }
    :root:not(.dark) .explore-block::before { opacity: 0.10; }
    :root:not(.dark) .explore-block:hover::before { opacity: 0.20; }
  `}</style>
);

const Anchor = ({ color, label, pulse = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 2 }}>
    <span style={{
      width: 6, height: 6, borderRadius: 999, background: color,
      animation: pulse ? 'putki-anchor-pulse 2.4s ease-in-out infinite' : undefined,
    }} />
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.22em', fontWeight: 700, color,
      textTransform: 'uppercase',
    }}>{label}</span>
  </div>
);

// Top-right live-stat callout - appears only when there's a real value.
// Number is large serif (matches the brand typography); label is tiny
// monospace eyebrow underneath.
const BlockStat = ({ value, label }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="explore-block-stat" aria-hidden>
      <div className="num">{value}</div>
      <div className="lab">{label}</div>
    </div>
  );
};

const Cta = ({ label, color, disabled }) => (
  <div style={{
    marginTop: 'auto', paddingTop: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'relative', zIndex: 2,
  }}>
    <span data-testid="explore-cta" style={{
      color: disabled ? 'var(--muted)' : 'var(--ink)',
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.20em', fontWeight: 700,
      display: 'inline-flex', alignItems: 'baseline', gap: 6,
    }}>
      {label}
      {!disabled && (
        <span
          className="explore-cta-arrow"
          aria-hidden
          style={{
            display: 'inline-block',
            transition: 'transform 240ms ease',
          }}
        >→</span>
      )}
    </span>
    <span style={{
      width: 24, height: 1, background: color, opacity: disabled ? 0.4 : 0.7,
    }} aria-hidden />
  </div>
);

// ── MITTARI - full mini-dial in left column, state name + reading right ──
const MittariBlock = ({ lang }) => {
  const { theme } = useTheme();
  const [dial, setDial] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [news, setNews] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial`).then((r) => r.json()).then((d) => {
      if (!cancelled) setDial(d);
    }).catch(() => {});
    fetch(`${BACKEND}/api/data/live-stats`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!cancelled && d) setLiveStats(d);
    }).catch(() => {});
    // newsroom stats carries the 24h delta + state-change
    fetch(`${BACKEND}/api/newsroom/live-stats`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!cancelled && d) setNews(d);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const stateKey = dial?.state?.key || 'KYLMA';
  const color = STATE_COLOR[stateKey];
  const name = (lang === 'en' ? STATE_NAME_EN : STATE_NAME_FI)[stateKey];
  const reading = dialReading(stateKey, lang, {
    streams: liveStats?.twitch_live,
    viewers: liveStats?.twitch_viewers,
  });
  const score = dial?.composite_score ?? dial?.state?.value ?? 0;
  const dashLen = Math.max(0, Math.min(264, Math.round(score * 2.64)));

  return (
    <Block to="/mittari" dataTestId="explore-block-mittari" accent={color}>
      {/* designed background - instrument dial */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: theme === 'light'
          ? `radial-gradient(circle at 22% 55%, ${color}26 0%, ${color}00 55%),
             conic-gradient(from 220deg, #EFEAE2 0deg, #E2D8C8 70deg, ${color}55 95deg, ${color}88 140deg, #E2D8C8 200deg, #EFEAE2 360deg)`
          : `radial-gradient(circle at 22% 55%, ${color}33 0%, ${color}00 50%),
             conic-gradient(from 220deg, #1f1b18 0deg, #3a2e23 70deg, ${color}66 95deg, ${color} 140deg, #3a2e23 200deg, #1f1b18 360deg)`,
        opacity: theme === 'light' ? 0.42 : 0.30, filter: 'contrast(1.05)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: veilGradient(theme),
      }} />

      <BlockStat
        value={Number.isFinite(score) ? Math.round(score) : null}
        label={lang === 'en' ? 'Score' : 'Lukema'}
      />

      <Anchor color={color} label={lang === 'en' ? 'MITTARI · NOW' : 'MITTARI · NYT'} />

      <div style={{
        display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)',
        gap: 18, alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {/* Full mini-dial - proper size, not a sliver */}
        <svg width="88" height="88" viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
          <circle cx="50" cy="50" r="40" fill="none"
            stroke={theme === 'light' ? '#E2D8C8' : '#2A2522'} strokeWidth="6" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${(dashLen / 264) * 251.3} 251.3`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)" />
          <text x="50" y="56" textAnchor="middle"
            fontFamily="ui-monospace, monospace" fontSize="14" fontWeight="700"
            fill={inkFor(theme)} letterSpacing="-0.02em">{Math.round(score)}</text>
        </svg>
        <div style={{ minWidth: 0 }}>
          <h3 data-testid="explore-mittari-state" style={{
            fontFamily: 'Georgia, serif', fontWeight: 700,
            fontSize: 28, lineHeight: 1.02, color: inkFor(theme),
            letterSpacing: '-0.02em', margin: '0 0 6px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name}</h3>
          {news?.mittari_delta != null && (
            <div data-testid="explore-mittari-delta" style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.06em', marginBottom: 6,
              color: news.mittari_delta > 0 ? '#6FA37D' : (news.mittari_delta < 0 ? '#C13B2C' : 'var(--muted, #9C9587)'),
            }}>
              {news.mittari_delta > 0 ? '▲' : (news.mittari_delta < 0 ? '▼' : '─')} {Math.abs(news.mittari_delta)} {lang === 'en' ? 'from yesterday' : 'eilisestä'}
            </div>
          )}
          {news?.state_change && (
            <div data-testid="explore-mittari-state-change" style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
              letterSpacing: '0.08em', color: 'var(--muted, #9C9587)',
              marginBottom: 6,
            }}>
              {lang === 'en' ? 'STATE CHANGE · ' : 'TILANVAIHTO · '}
              {news.state_change.from_state} → {news.state_change.to_state}
              <span style={{ opacity: 0.6, marginLeft: 6 }}>· {news.state_change.hours_ago}h {lang === 'en' ? 'ago' : 'sitten'}</span>
            </div>
          )}
          <p style={{
            color: bodyFor(theme), fontSize: 12.5,
            lineHeight: 1.5, opacity: 0.92, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{reading}</p>
        </div>
      </div>

      <Cta label={lang === 'en' ? 'OPEN' : 'AVAA'} color={color} />
    </Block>
  );
};

// ── MESTARI - diagnostic quiz with editorial framing ──
const MestariBlock = ({ lang }) => {
  const { theme } = useTheme();
  const blue = '#5B8DEE';
  return (
    <Block to="/mestari" dataTestId="explore-block-mestari" accent={blue}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: theme === 'light'
          ? `radial-gradient(circle at 28% 32%, rgba(91,141,238,0.15) 0%, rgba(91,141,238,0) 55%),
             linear-gradient(135deg, #EDF1F8 0%, #DDE3F0 100%)`
          : `radial-gradient(circle at 28% 32%, rgba(91,141,238,0.22) 0%, rgba(91,141,238,0) 55%),
             linear-gradient(135deg, #10141c 0%, #161b25 100%)`,
        opacity: 0.85,
      }} />
      <svg viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden style={{
        position: 'absolute', right: 0, top: '50%', width: '55%', height: 80,
        transform: 'translateY(-50%)', opacity: theme === 'light' ? 0.55 : 0.3, zIndex: 1,
      }}>
        <text x="0" y="22" fill={blue} fontFamily="ui-monospace, monospace" fontSize="9" letterSpacing="2">Q1</text>
        <text x="0" y="44" fill={blue} fontFamily="ui-monospace, monospace" fontSize="9" letterSpacing="2">Q2</text>
        <text x="0" y="66" fill={blue} fontFamily="ui-monospace, monospace" fontSize="9" letterSpacing="2">Q3</text>
        <line x1="22" y1="18" x2="220" y2="18" stroke={blue} strokeWidth="0.8" strokeDasharray="2 3" />
        <line x1="22" y1="40" x2="180" y2="40" stroke={blue} strokeWidth="0.8" strokeDasharray="2 3" />
        <line x1="22" y1="62" x2="200" y2="62" stroke={blue} strokeWidth="0.8" strokeDasharray="2 3" />
      </svg>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: veilGradientHoriz(theme),
      }} />

      <BlockStat value="3" label={lang === 'en' ? 'Diagnostics' : 'Testit'} />

      <Anchor color={blue} label={lang === 'en' ? 'MESTARI · DIAGNOSTICS' : 'MESTARI · DIAGNOSTIIKKAA'} />

      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <h3 data-testid="explore-mestari-headline" style={{
          color: inkFor(theme), fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 24, lineHeight: 1.1, margin: '0 0 10px',
          letterSpacing: '-0.018em',
        }}>{lang === 'en' ? 'What kind of player are you?' : 'Millainen pelaaja sinä olet?'}</h3>
        <p style={{
          color: bodyFor(theme), fontSize: 12.5, lineHeight: 1.5,
          opacity: 0.92, maxWidth: 360, margin: 0,
        }}>{lang === 'en'
          ? 'Three 90-second diagnostics - sports betting, poker, blackjack. Personal profile + 5-day playbook to your inbox. Free.'
          : 'Kolme 90 sekunnin diagnostiikkaa - urheiluvedonlyönti, pokeri, blackjack. Henkilökohtainen profiili + 5 päivän pelikirja sähköpostiisi. Maksuton.'}</p>
      </div>

      <Cta label={lang === 'en' ? 'START →' : 'ALOITA →'} color={blue} />
    </Block>
  );
};


// ── PELISIGNAALIT (legacy - kept for backward compat, no longer on homepage) ──
const PelisignaalitBlock = ({ lang }) => {
  const [topPick, setTopPick] = useState(null);
  const [trackRecord, setTrackRecord] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/odds/featured`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (cancelled || !d) return;
      const picks = (d.picks || []).filter((p) => (p?.sharpness?.sharpness || 0) >= 40);
      const top = picks.sort((a, b) => (b?.sharpness?.sharpness || 0) - (a?.sharpness?.sharpness || 0))[0] || null;
      setTopPick(top);
    }).catch(() => {});
    // 30d track-record: count of days where market consensus held
    fetch(`${BACKEND}/api/odds/market-watch`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (cancelled || !d?.sparkline) return;
      const points = d.sparkline;
      // Only render the line when ≥7 days of data exists
      if (points.length < 7) return;
      const window = points.slice(-30);
      const held = window.filter((p) => (p.score || 0) >= 50).length;
      setTrackRecord({ window_days: window.length, held });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const sharpness = topPick?.sharpness?.sharpness;
  const eventName = topPick ? (topPick.event_name || topPick.label || `${topPick.home_team || ''} - ${topPick.away_team || ''}`.trim()) : '';
  const yellow = '#D4B445';

  return (
    <Block to="/pelisignaalit" dataTestId="explore-block-pelisignaalit">
      {/* designed background - sparkline ladder */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `
          repeating-linear-gradient(180deg,
            rgba(212,180,69,0.08) 0px,
            rgba(212,180,69,0.08) 1px,
            transparent 1px, transparent 22px),
          linear-gradient(135deg, #181410 0%, #1a1612 100%)`,
        opacity: 0.6,
      }} />
      {/* hero sparkline as a real graphic, not just background */}
      <svg viewBox="0 0 220 60" preserveAspectRatio="none" aria-hidden style={{
        position: 'absolute', top: '50%', left: '40%', right: '6%',
        height: 60, opacity: 0.35, zIndex: 1,
        transform: 'translateY(-50%)',
      }}>
        <polyline
          points="0,48 18,42 36,50 54,32 72,38 90,22 110,28 130,16 150,20 170,12 190,18 210,8 220,12"
          fill="none" stroke={yellow} strokeWidth="1.4" />
      </svg>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(90deg, rgba(11,10,9,0.92) 0%, rgba(11,10,9,0.72) 60%, rgba(11,10,9,0.95) 100%)',
      }} />

      <Anchor color={yellow} label={lang === 'en' ? 'PELISIGNAALIT · TODAY' : 'PELISIGNAALIT · TÄNÄÄN'} />

      {topPick ? (
        <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
          <div data-testid="explore-pelisignaalit-match" style={{
            color: '#F5F3EE', fontSize: 17, fontWeight: 700,
            letterSpacing: '-0.01em', lineHeight: 1.25,
            marginBottom: 10,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{eventName || '-'}</div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 12px',
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.06em',
            marginBottom: 12,
          }}>
            {topPick.pick_team || topPick.pick ? (
              <span style={{ color: 'var(--ink, #ECE6D8)' }}>
                {topPick.pick_team || topPick.pick}
                {topPick.odds_decimal ? ` ${topPick.odds_decimal.toFixed(2)}` : ''}
              </span>
            ) : null}
            {topPick.bookmaker && (
              <span style={{
                maxWidth: 140, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{topPick.bookmaker}</span>
            )}
          </div>
          {sharpness != null && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span data-testid="explore-pelisignaalit-sharpness" style={{
                color: yellow,
                fontFamily: 'Georgia, serif', fontWeight: 700,
                fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em',
              }}>{Math.round(sharpness)}</span>
              <span style={{
                color: 'var(--muted, #9C9587)',
                fontFamily: 'ui-monospace, monospace', fontSize: 9,
                letterSpacing: '0.22em', fontWeight: 700,
              }}>SHARPNESS</span>
            </div>
          )}
          {trackRecord && (
            <div data-testid="explore-pelisignaalit-track-record" style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.08em', color: 'var(--muted, #9C9587)',
              marginTop: 8,
            }}>
              {lang === 'en'
                ? `LAST ${trackRecord.window_days}D · consensus held ${trackRecord.held}/${trackRecord.window_days} reads`
                : `VIIM. ${trackRecord.window_days}PV · konsensus piti ${trackRecord.held}/${trackRecord.window_days} luennassa`}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.10em', position: 'relative', zIndex: 2,
          lineHeight: 1.6,
        }}>{lang === 'en' ? 'NO SIGNALS YET TODAY.' : 'EI SIGNAALEJA VIELÄ TÄNÄÄN.'}</div>
      )}

      <Cta label={lang === 'en' ? 'SEE ALL 5' : 'KAIKKI 5'} color={yellow} />
    </Block>
  );
};

// ── VOITA - large editorial typographic treatment, gated state ──
const VoitaBlock = ({ lang }) => {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [activeRaffleCount, setActiveRaffleCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => { if (!cancelled) setEnabled(!!d.voita_feature_enabled); })
      .catch(() => {});
    fetch(`${BACKEND}/api/voita/raffles?status=open`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d) return;
        const open = (d.items || []).filter((it) => it.status === 'open');
        setActiveRaffleCount(open.length);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const red = '#C13B2C';

  return (
    <Block to="/voita" dataTestId="explore-block-voita" accent={red}>
      {/* designed background - editorial gradient with crimson glow */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: theme === 'light'
          ? `radial-gradient(circle at 80% 40%, rgba(193,59,44,0.12) 0%, rgba(193,59,44,0) 55%),
             linear-gradient(135deg, #FBF3F0 0%, #F5E7E2 100%)`
          : `radial-gradient(circle at 80% 40%, rgba(193,59,44,0.18) 0%, rgba(193,59,44,0) 55%),
             linear-gradient(135deg, #1a1310 0%, #14100e 100%)`,
        opacity: 0.85,
      }} />
      {/* Decorative serif "V" as a fixed background element, positioned cleanly */}
      <span aria-hidden style={{
        position: 'absolute', right: '-2%', bottom: '-10%',
        fontFamily: 'Georgia, serif', fontWeight: 900,
        fontSize: 240, lineHeight: 1,
        letterSpacing: '-0.06em',
        color: theme === 'light' ? 'rgba(193,59,44,0.07)' : 'rgba(193,59,44,0.10)',
        pointerEvents: 'none', userSelect: 'none', zIndex: 1,
      }}>V</span>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: veilGradientHoriz(theme, [0.85, 0.55, 0.85]),
      }} />

      {enabled && activeRaffleCount > 0 && (
        <BlockStat
          value={activeRaffleCount}
          label={lang === 'en'
            ? (activeRaffleCount === 1 ? 'Raffle live' : 'Raffles live')
            : (activeRaffleCount === 1 ? 'Arvonta auki' : 'Arvontaa auki')}
        />
      )}

      <Anchor color={red} label={enabled
        ? (lang === 'en' ? 'VOITA · LIVE' : 'VOITA · KÄYNNISSÄ')
        : (lang === 'en' ? 'VOITA · COMING SOON' : 'VOITA · TULOSSA')}
        pulse={enabled} />

      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <h3 data-testid="explore-voita-placeholder" style={{
          color: inkFor(theme), fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 26, lineHeight: 1.1, margin: '0 0 10px',
          letterSpacing: '-0.015em',
        }}>{enabled
          ? (lang === 'en' ? 'Predict the winner.' : 'Arvaa voittaja.')
          : (lang === 'en' ? 'Coming soon' : 'Pian saatavilla')}</h3>
        <p style={{
          color: bodyFor(theme), fontSize: 12.5, lineHeight: 1.5,
          opacity: 0.92, maxWidth: 360, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{enabled
          ? (lang === 'en' ? 'This week\u2019s editorial raffle is live. Free to enter, no deposit, no betting.' : 'Tämän viikon toimituksellinen arvonta on käynnissä. Ilmainen, ei talletusta, ei vedonlyöntiä.')
          : (lang === 'en' ? 'Editorial winner-prediction raffle. Opens after legal review.' : 'Toimituksellinen voitto­ennustus­arvonta. Avautuu lain­opillisen tarkistuksen jälkeen.')}</p>
      </div>

      <Cta
        label={enabled
          ? (lang === 'en' ? 'PLAY →' : 'PELAA →')
          : (lang === 'en' ? 'WAITING' : 'ODOTTAA')}
        color={red}
        disabled={!enabled}
      />
    </Block>
  );
};

// ── PELI - restrained slot-reel macro ──
const PeliBlock = ({ lang }) => {
  const { theme } = useTheme();
  const [week, setWeek] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/voyager/current-week`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!cancelled && d) setWeek(d.week);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const campaign = week?.theme || (lang === 'en' ? 'February Voyager round' : 'Helmikuun Voyager-kierros');
  const reward = week?.prize_summary
    || (lang === 'en' ? 'Play 30 seconds, win 25 free spins.' : 'Pelaa 30 sekuntia, voita 25 ilmais­kierrosta.');
  const green = '#6FA37D';
  const yellow = '#D4B445';

  return (
    <Block to="/peli" dataTestId="explore-block-peli" accent={green}>
      {/* designed background - restrained slot reel macro */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: theme === 'light'
          ? `radial-gradient(circle at 80% 50%, rgba(212,180,69,0.14) 0%, rgba(212,180,69,0) 50%),
             repeating-linear-gradient(90deg,
              #F4EFE5 0%, #F4EFE5 28%,
              #EAE2D2 28%, #EAE2D2 33%,
              #F4EFE5 33%, #F4EFE5 66%,
              #EAE2D2 66%, #EAE2D2 71%,
              #F4EFE5 71%, #F4EFE5 100%)`
          : `radial-gradient(circle at 80% 50%, rgba(212,180,69,0.16) 0%, rgba(212,180,69,0) 50%),
             repeating-linear-gradient(90deg,
              #1a1612 0%, #1a1612 28%,
              #221d18 28%, #221d18 33%,
              #1a1612 33%, #1a1612 66%,
              #221d18 66%, #221d18 71%,
              #1a1612 71%, #1a1612 100%)`,
        opacity: theme === 'light' ? 0.7 : 0.55, filter: 'blur(0.4px)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: veilGradient(theme, [0.88, 0.78, 0.94]),
      }} />

      <BlockStat value="25" label={lang === 'en' ? 'Free spins' : 'Ilmaiskierrosta'} />

      <Anchor color={green} label="PELI · VOYAGER" />

      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <h3 data-testid="explore-peli-campaign" style={{
          color: inkFor(theme), fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 22, lineHeight: 1.15, margin: '0 0 10px',
          letterSpacing: '-0.015em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{campaign}</h3>
        <p style={{
          color: bodyFor(theme), fontSize: 12.5, lineHeight: 1.5,
          opacity: 0.92, maxWidth: 360, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{reward}</p>
      </div>

      <Cta label={lang === 'en' ? 'PLAY' : 'PELAA'} color={green} />
    </Block>
  );
};

// ── PeliAreena block (iter58) - mini-game suite product tile ──
const PeliAreenaBlock = ({ lang }) => {
  const { theme } = useTheme();
  const [hub, setHub] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND}/api/mini-games/hub`).then(r => r.json())
      .then(d => { if (alive) setHub(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const amber = '#A0750F';
  const teal = '#3A6E7E';
  const activeCount = (hub?.games || []).filter(g => g.status === 'active').length;
  const rankedThisWeek = hub?.tournament?.ranked_players_this_week || 0;

  return (
    <Block to="/peliareena" dataTestId="explore-block-peliareena" accent={amber}>
      {/* designed background - geometric tile pattern hint */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: theme === 'light'
          ? `radial-gradient(circle at 25% 70%, rgba(160,117,15,0.10) 0%, rgba(160,117,15,0) 55%),
             repeating-linear-gradient(45deg, #F4EFE5 0 28px, #EFE9DC 28px 30px)`
          : `radial-gradient(circle at 25% 70%, rgba(212,180,69,0.13) 0%, rgba(212,180,69,0) 55%),
             repeating-linear-gradient(45deg, #14110d 0 28px, #1A1612 28px 30px)`,
        opacity: theme === 'light' ? 0.85 : 0.65,
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: veilGradient(theme, [0.88, 0.78, 0.92]),
      }} />

      <BlockStat
        value={activeCount > 0 ? `${activeCount}/5` : '-'}
        label={lang === 'en' ? 'Games live' : 'Peliä auki'}
      />

      <Anchor color={teal} label="PELIAREENA · TURNAUS" />

      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <h3 data-testid="explore-peliareena-headline" style={{
          color: inkFor(theme), fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 22, lineHeight: 1.15, margin: '0 0 10px',
          letterSpacing: '-0.015em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {lang === 'en'
            ? 'Five mini-games. One weekly tournament.'
            : 'Viisi pientä peliä. Yksi viikkoturnaus.'}
        </h3>
        <p style={{
          color: bodyFor(theme), fontSize: 12.5, lineHeight: 1.5,
          opacity: 0.92, maxWidth: 360, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {lang === 'en'
            ? `Play instantly, no email needed. Email unlocks your full result + tournament rank. ${rankedThisWeek > 0 ? `${rankedThisWeek} ranked this week.` : 'Be the first ranked.'}`
            : `Pelaa heti, ilman sähköpostia. Sähköpostilla saat täydet tulokset + turnauspaikan. ${rankedThisWeek > 0 ? `${rankedThisWeek} ranattua tällä viikolla.` : 'Ole viikon ensimmäinen.'}`}
        </p>
      </div>

      <Cta label={lang === 'en' ? 'OPEN' : 'AVAA'} color={teal} />
    </Block>
  );
};

const ExploreBlocks = () => {
  const { lang } = useLang();
  return (
    <section
      data-testid="explore-blocks"
      style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        marginTop: 28, padding: '22px 0 12px',
      }}
    >
      <ExploreBlockStyles />
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', paddingBottom: 14,
      }}>
        <span
          data-testid="explore-anchor"
          style={{
            color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
            fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
          }}
        >{lang === 'en' ? 'MORE FROM PUTKI · EXPLORE' : 'LISÄÄ PUTKILTA · EXPLORE'}</span>
        <span style={{
          color: 'var(--muted, #9C9587)', letterSpacing: '0.18em',
          fontSize: 10, fontFamily: 'ui-monospace, monospace', opacity: 0.7,
        }}>3 PRODUCTS</span>
      </div>
      <div className="explore-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridAutoRows: '1fr',
        gap: 1,
        background: 'var(--hairline, #221E1B)',
      }}>
        <MittariBlock lang={lang} />
        <MestariBlock lang={lang} />
        <PeliBlock lang={lang} />
        {/* Phase 3 · iter93 — VoitaBlock removed from the homepage Explore
            grid per secondary-funnel deprioritisation. /voita remains
            accessible by direct URL; the Trust hub points to the live
            ledger. Re-enable here only when the funnel is reactivated. */}
        {/* <VoitaBlock lang={lang} /> */}
        {/* iter66 (2026-05-25) - PeliAreena tile HIDDEN per user request. */}
        {/* <PeliAreenaBlock lang={lang} /> */}
      </div>
      <style>{`
        @media (max-width: 1080px) {
          .explore-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 720px) {
          .explore-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

export default ExploreBlocks;
