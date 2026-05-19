/**
 * PUTKI HQ — ExploreBlocks (Phase 1 Final · Chunk B · post-review rebuild).
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
import { dialReading } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};
const STATE_NAME_FI = {
  KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ',
  MYRSKY: 'MEININKI', KIIRASTULI: 'PERKELE',
};
const STATE_NAME_EN = {
  KYLMA: 'CALM', HAALEA: 'BUZZ', KUUMA: 'ACTIVE',
  MYRSKY: 'ROLLING', KIIRASTULI: 'PERKELE',
};

// shared block shell — vertical content stack, equal weight
const Block = ({ to, dataTestId, children }) => (
  <Link
    to={to}
    data-testid={dataTestId}
    style={{
      position: 'relative', minHeight: 220,
      background: 'var(--surface, #141210)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      padding: '22px 24px 20px',
      textDecoration: 'none', color: 'inherit',
      isolation: 'isolate',
    }}
  >{children}</Link>
);

const Anchor = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, position: 'relative', zIndex: 2 }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.22em', fontWeight: 700, color,
      textTransform: 'uppercase',
    }}>{label}</span>
  </div>
);

const Cta = ({ label, color, disabled }) => (
  <div style={{
    marginTop: 'auto', paddingTop: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'relative', zIndex: 2,
  }}>
    <span data-testid="explore-cta" style={{
      color: disabled ? 'var(--muted, #9C9587)' : '#FFFFFF',
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.20em', fontWeight: 700,
    }}>{label}{!disabled && '  →'}</span>
    <span style={{
      width: 24, height: 1, background: color, opacity: disabled ? 0.4 : 0.7,
    }} aria-hidden />
  </div>
);

// ── MITTARI — full mini-dial in left column, state name + reading right ──
const MittariBlock = ({ lang }) => {
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
    <Block to="/mittari" dataTestId="explore-block-mittari">
      {/* designed background — instrument dial */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background:
          `radial-gradient(circle at 22% 55%, ${color}33 0%, ${color}00 50%),
           conic-gradient(from 220deg, #1f1b18 0deg, #3a2e23 70deg, ${color}66 95deg, ${color} 140deg, #3a2e23 200deg, #1f1b18 360deg)`,
        opacity: 0.30, filter: 'contrast(1.05)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(135deg, rgba(11,10,9,0.78) 0%, rgba(11,10,9,0.84) 60%, rgba(11,10,9,0.96) 100%)',
      }} />

      <Anchor color={color} label={lang === 'en' ? 'MITTARI · NOW' : 'MITTARI · NYT'} />

      <div style={{
        display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)',
        gap: 18, alignItems: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {/* Full mini-dial — proper size, not a sliver */}
        <svg width="88" height="88" viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#2A2522" strokeWidth="6" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${(dashLen / 264) * 251.3} 251.3`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)" />
          <text x="50" y="56" textAnchor="middle"
            fontFamily="ui-monospace, monospace" fontSize="14" fontWeight="700"
            fill="#FFFFFF" letterSpacing="-0.02em">{Math.round(score)}</text>
        </svg>
        <div style={{ minWidth: 0 }}>
          <h3 data-testid="explore-mittari-state" style={{
            fontFamily: 'Georgia, serif', fontWeight: 700,
            fontSize: 28, lineHeight: 1.02, color: '#FFFFFF',
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
            color: 'var(--ink, #ECE6D8)', fontSize: 12.5,
            lineHeight: 1.5, opacity: 0.88, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{reading}</p>
        </div>
      </div>

      <Cta label={lang === 'en' ? 'OPEN' : 'AVAA'} color={color} />
    </Block>
  );
};

// ── PELISIGNAALIT — sparkline texture + top pick (no truncation) ──
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
  const eventName = topPick ? (topPick.event_name || topPick.label || `${topPick.home_team || ''} – ${topPick.away_team || ''}`.trim()) : '';
  const yellow = '#D4B445';

  return (
    <Block to="/pelisignaalit" dataTestId="explore-block-pelisignaalit">
      {/* designed background — sparkline ladder */}
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
            color: '#FFFFFF', fontSize: 17, fontWeight: 700,
            letterSpacing: '-0.01em', lineHeight: 1.25,
            marginBottom: 10,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{eventName || '—'}</div>
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

// ── VOITA — large editorial typographic treatment, gated state ──
const VoitaBlock = ({ lang }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => { if (!cancelled) setEnabled(!!d.voita_feature_enabled); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const red = '#C13B2C';

  return (
    <Block to="/voita" dataTestId="explore-block-voita">
      {/* designed background — editorial gradient with crimson glow */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `
          radial-gradient(circle at 80% 40%, rgba(193,59,44,0.18) 0%, rgba(193,59,44,0) 55%),
          linear-gradient(135deg, #1a1310 0%, #14100e 100%)`,
        opacity: 0.85,
      }} />
      {/* Decorative serif "V" as a fixed background element, positioned cleanly */}
      <span aria-hidden style={{
        position: 'absolute', right: '-2%', bottom: '-10%',
        fontFamily: 'Georgia, serif', fontWeight: 900,
        fontSize: 240, lineHeight: 1,
        letterSpacing: '-0.06em',
        color: 'rgba(193,59,44,0.10)',
        pointerEvents: 'none', userSelect: 'none', zIndex: 1,
      }}>V</span>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(90deg, rgba(11,10,9,0.85) 0%, rgba(11,10,9,0.55) 60%, rgba(11,10,9,0.85) 100%)',
      }} />

      <Anchor color={red} label={enabled
        ? (lang === 'en' ? 'VOITA · LIVE' : 'VOITA · KÄYNNISSÄ')
        : (lang === 'en' ? 'VOITA · COMING SOON' : 'VOITA · TULOSSA')} />

      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <h3 data-testid="explore-voita-placeholder" style={{
          color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 26, lineHeight: 1.1, margin: '0 0 10px',
          letterSpacing: '-0.015em',
        }}>{enabled
          ? (lang === 'en' ? 'Predict the winner.' : 'Arvaa voittaja.')
          : (lang === 'en' ? 'Coming soon' : 'Pian saatavilla')}</h3>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 12.5, lineHeight: 1.5,
          opacity: 0.82, maxWidth: 360, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{enabled
          ? (lang === 'en' ? 'This week\u2019s editorial raffle is live. Free to enter, no deposit, no betting.' : 'Tämän viikon toimituksellinen arvonta on käynnissä. Ilmainen, ei talletusta, ei vedonlyöntiä.')
          : (lang === 'en' ? 'Editorial winner-prediction raffle. Opens after legal review.' : 'Toimituksellinen voitto­ennustus­arvonta. Avautuu lain­opillisen tarkistuksen jälkeen.')}</p>
      </div>

      <Cta
        label={enabled
          ? (lang === 'en' ? 'ENTER' : 'OSALLISTU')
          : (lang === 'en' ? 'WAITING' : 'ODOTTAA')}
        color={red}
        disabled={!enabled}
      />
    </Block>
  );
};

// ── PELI — restrained slot-reel macro ──
const PeliBlock = ({ lang }) => {
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

  return (
    <Block to="/peli" dataTestId="explore-block-peli">
      {/* designed background — restrained slot reel macro */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `
          radial-gradient(circle at 80% 50%, rgba(212,180,69,0.16) 0%, rgba(212,180,69,0) 50%),
          repeating-linear-gradient(90deg,
            #1a1612 0%, #1a1612 28%,
            #221d18 28%, #221d18 33%,
            #1a1612 33%, #1a1612 66%,
            #221d18 66%, #221d18 71%,
            #1a1612 71%, #1a1612 100%)`,
        opacity: 0.55, filter: 'blur(0.4px)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(135deg, rgba(11,10,9,0.88) 0%, rgba(11,10,9,0.78) 60%, rgba(11,10,9,0.94) 100%)',
      }} />

      <Anchor color={green} label="PELI · VOYAGER" />

      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <h3 data-testid="explore-peli-campaign" style={{
          color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 22, lineHeight: 1.15, margin: '0 0 10px',
          letterSpacing: '-0.015em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{campaign}</h3>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 12.5, lineHeight: 1.5,
          opacity: 0.86, maxWidth: 360, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{reward}</p>
      </div>

      <Cta label={lang === 'en' ? 'PLAY' : 'PELAA'} color={green} />
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
        }}>4 PRODUCTS</span>
      </div>
      <div className="explore-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridAutoRows: '1fr',
        gap: 1,
        background: 'var(--hairline, #221E1B)',
      }}>
        <MittariBlock lang={lang} />
        <PelisignaalitBlock lang={lang} />
        <VoitaBlock lang={lang} />
        <PeliBlock lang={lang} />
      </div>
      <style>{`
        @media (max-width: 720px) {
          .explore-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

export default ExploreBlocks;
