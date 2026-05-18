/**
 * PUTKI HQ — ExploreBlocks (Phase 1 Final Restructure · Chunk A).
 *
 * Homepage 2×2 compact preview grid (replaces the old "hint strips").
 *
 * Four blocks, each 168px tall, with a designed background image in
 * PUTKI HQ's visual style + the relevant live content overlaid:
 *
 *   - MITTARI       → current state + reading + mini dial visual
 *   - PELISIGNAALIT → today's #1 game signal (sharpness ≥ 75)
 *   - VOITA         → raffle (gated until Sako sign-off; renders inactive state)
 *   - PELI          → current Voyager campaign
 *
 * Routes:
 *   Mittari        → /mittari        (target for Chunk B)
 *   Pelisignaalit  → /pelisignaalit  (Chunk B) — falls back to /vihjeet until Chunk B ships
 *   Voita          → /voita          (Chunk B, gated) — falls back to /voita-palkinto
 *   Peli           → /peli
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

const BlockShell = ({ to, children, dataTestId, accentColor, mode = 'link' }) => {
  const inner = (
    <div
      data-testid={dataTestId}
      style={{
        position: 'relative', minHeight: 168,
        background: 'var(--surface, #141210)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto',
        columnGap: 20, alignItems: 'center',
        padding: '18px 22px',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  );
  if (mode === 'static') return inner;
  return (
    <Link
      to={to}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderTop: '1px solid transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderTop = `1px solid ${accentColor}55`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderTop = '1px solid transparent'; }}
    >{inner}</Link>
  );
};

const AnchorRow = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.22em', fontWeight: 700, color,
      textTransform: 'uppercase',
    }}>{label}</span>
  </div>
);

const CtaArrow = ({ label, disabled }) => (
  <span
    data-testid="explore-cta"
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      color: disabled ? 'var(--muted, #9C9587)' : '#FFFFFF',
      fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
      letterSpacing: '0.18em', fontWeight: 700, whiteSpace: 'nowrap',
    }}
  >
    {label}{!disabled && ' →'}
  </span>
);

// ── MITTARI ────────────────────────────────────────────────────────────────
const MittariBlock = ({ lang }) => {
  const [dial, setDial] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial`).then((r) => r.json()).then((d) => {
      if (!cancelled) setDial(d);
    }).catch(() => {});
    fetch(`${BACKEND}/api/data/live-stats`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (!cancelled && d) setLiveStats(d);
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
    <BlockShell
      to="/mittari"
      dataTestId="explore-block-mittari"
      accentColor={color}
    >
      {/* background */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(circle at 30% 50%, ${color}3D 0%, ${color}00 55%), conic-gradient(from 220deg, #1f1b18 0deg, #3a2e23 70deg, ${color}80 90deg, ${color} 140deg, #3a2e23 200deg, #1f1b18 360deg)`,
        opacity: 0.45, filter: 'contrast(1.05)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(90deg, rgba(11,10,9,0.86) 0%, rgba(11,10,9,0.74) 55%, rgba(11,10,9,0.92) 100%)',
      }} />
      {/* visual */}
      <div style={{ position: 'relative', zIndex: 2, width: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="72" height="72" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="#2A2522" strokeWidth="6" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dashLen} 264`} strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <AnchorRow color={color} label={lang === 'en' ? 'MITTARI · NOW' : 'MITTARI · NYT'} />
        <h3 data-testid="explore-mittari-state" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 30, lineHeight: 1, color: '#FFFFFF',
          letterSpacing: '-0.02em', margin: '0 0 6px',
        }}>{name}</h3>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 12.5,
          maxWidth: 420, lineHeight: 1.45, opacity: 0.84, margin: 0,
        }}>{reading}</p>
      </div>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <CtaArrow label={lang === 'en' ? 'OPEN' : 'AVAA'} />
      </div>
    </BlockShell>
  );
};

// ── PELISIGNAALIT ─────────────────────────────────────────────────────────
const PelisignaalitBlock = ({ lang }) => {
  const [topPick, setTopPick] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/odds/featured`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (cancelled || !d) return;
      const picks = (d.picks || []).filter((p) => (p?.sharpness?.sharpness || 0) >= 50);
      const top = picks.sort((a, b) => (b?.sharpness?.sharpness || 0) - (a?.sharpness?.sharpness || 0))[0] || null;
      setTopPick(top);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const sharpness = topPick?.sharpness?.sharpness;
  // Sentry: /pelisignaalit doesn't exist yet (Chunk B). Until then route to /vihjeet.
  return (
    <BlockShell
      to="/vihjeet"
      dataTestId="explore-block-pelisignaalit"
      accentColor="#D4B445"
    >
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'repeating-linear-gradient(180deg, rgba(212,180,69,0.06) 0px, rgba(212,180,69,0.06) 1px, transparent 1px, transparent 24px), linear-gradient(135deg, #161310 0%, #1a1612 100%)',
        opacity: 0.45,
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(90deg, rgba(11,10,9,0.86) 0%, rgba(11,10,9,0.74) 55%, rgba(11,10,9,0.92) 100%)',
      }} />
      <div style={{ position: 'relative', zIndex: 2, width: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="96" height="40" viewBox="0 0 120 40" aria-hidden>
          <polyline points="0,28 15,24 30,30 45,18 60,22 75,12 90,16 105,8 120,10"
            fill="none" stroke="#D4B445" strokeWidth="1.5" opacity="0.85" />
          <circle cx="120" cy="10" r="2.5" fill="#D4B445" />
        </svg>
      </div>
      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <AnchorRow color="#D4B445" label={lang === 'en' ? 'PELISIGNAALIT · TODAY' : 'PELISIGNAALIT · TÄNÄÄN'} />
        {topPick ? (
          <>
            <div data-testid="explore-pelisignaalit-match" style={{
              color: '#FFFFFF', fontSize: 14, fontWeight: 600,
              marginBottom: 4, lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{topPick.event_name || topPick.label || `${topPick.home_team} – ${topPick.away_team}`}</div>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'baseline',
              color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
              fontSize: 10, letterSpacing: '0.06em',
            }}>
              <span>{topPick.pick_team || topPick.pick || ''} {topPick.odds_decimal ? topPick.odds_decimal.toFixed(2) : ''}</span>
              {topPick.bookmaker && <span style={{ opacity: 0.6 }}>{topPick.bookmaker}</span>}
              {sharpness != null && (
                <span style={{ color: '#D4B445', fontWeight: 700 }}>
                  SHARPNESS {Math.round(sharpness)}
                </span>
              )}
            </div>
          </>
        ) : (
          <div style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.14em',
          }}>{lang === 'en' ? 'NO SIGNALS YET TODAY' : 'EI SIGNAALEJA VIELÄ TÄNÄÄN'}</div>
        )}
      </div>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <CtaArrow label={lang === 'en' ? 'SEE ALL' : 'KATSO'} />
      </div>
    </BlockShell>
  );
};

// ── VOITA — gated by VOITA_FEATURE_ENABLED (Sako legal sign-off pending) ──
const VoitaBlock = ({ lang }) => {
  // For Chunk A the feature is hard-gated as "Pian saatavilla" / coming soon.
  // Chunk B will read this flag from /api/settings/public and switch state.
  const enabled = false;
  return (
    <BlockShell
      to="/voita-palkinto"
      dataTestId="explore-block-voita"
      accentColor="#C13B2C"
    >
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'radial-gradient(circle at 70% 50%, rgba(193,59,44,0.16) 0%, rgba(193,59,44,0) 60%), linear-gradient(135deg, #1a1310 0%, #14100e 100%)',
        opacity: 0.45,
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(90deg, rgba(11,10,9,0.86) 0%, rgba(11,10,9,0.74) 55%, rgba(11,10,9,0.92) 100%)',
      }} />
      <span style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 30,
        fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 120,
        letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.025)',
        pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
      }} aria-hidden>VOITA</span>
      <div style={{ position: 'relative', zIndex: 2, width: 96 }} />
      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <AnchorRow color="#C13B2C" label={lang === 'en' ? 'VOITA · COMING SOON' : 'VOITA · TULOSSA'} />
        {enabled ? (
          <div style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 22 }}>
            {/* Chunk B will render the active raffle */}
          </div>
        ) : (
          <>
            <h3 data-testid="explore-voita-placeholder" style={{
              color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 700,
              fontSize: 22, lineHeight: 1.1, margin: '0 0 6px',
            }}>{lang === 'en' ? 'Coming soon' : 'Pian saatavilla'}</h3>
            <p style={{
              color: 'var(--ink, #ECE6D8)', fontSize: 12, lineHeight: 1.45,
              opacity: 0.8, maxWidth: 420, margin: 0,
            }}>{lang === 'en'
              ? 'Liiga finals winner-prediction raffle. Opens after legal review.'
              : 'Liiga-finaalien voitto­ennustus­arvonta. Avautuu lain­opillisen tarkistuksen jälkeen.'}</p>
          </>
        )}
      </div>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <CtaArrow label={lang === 'en' ? 'WAITING' : 'ODOTTAA'} disabled />
      </div>
    </BlockShell>
  );
};

// ── PELI ──────────────────────────────────────────────────────────────────
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
    || (lang === 'en'
        ? 'Play 30 seconds, win 25 free spins.'
        : 'Pelaa 30 sekuntia, voita 25 ilmais­kierrosta.');

  return (
    <BlockShell
      to="/peli"
      dataTestId="explore-block-peli"
      accentColor="#6FA37D"
    >
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'radial-gradient(circle at 30% 50%, rgba(212,180,69,0.18) 0%, rgba(212,180,69,0) 50%), conic-gradient(from 0deg at 30% 50%, #1a1612 0deg, #2a221a 30deg, #1a1612 60deg, #2a221a 90deg, #1a1612 360deg)',
        opacity: 0.45, filter: 'blur(0.4px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(90deg, rgba(11,10,9,0.86) 0%, rgba(11,10,9,0.74) 55%, rgba(11,10,9,0.92) 100%)',
      }} />
      <div style={{ position: 'relative', zIndex: 2, width: 96 }} />
      <div style={{ position: 'relative', zIndex: 2, minWidth: 0 }}>
        <AnchorRow color="#6FA37D" label="PELI · VOYAGER" />
        <h3 data-testid="explore-peli-campaign" style={{
          color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 20, lineHeight: 1.1, margin: '0 0 4px',
        }}>{campaign}</h3>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 12, lineHeight: 1.45,
          opacity: 0.84, maxWidth: 420, margin: 0,
        }}>{reward}</p>
      </div>
      <div style={{ position: 'relative', zIndex: 2 }}>
        <CtaArrow label={lang === 'en' ? 'PLAY' : 'PELAA'} />
      </div>
    </BlockShell>
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
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
        background: 'var(--hairline, #221E1B)',
      }}>
        <MittariBlock lang={lang} />
        <PelisignaalitBlock lang={lang} />
        <VoitaBlock lang={lang} />
        <PeliBlock lang={lang} />
      </div>
    </section>
  );
};

export default ExploreBlocks;
