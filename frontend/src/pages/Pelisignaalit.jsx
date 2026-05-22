/**
 * Pelisignaalit — Daily game signals (/pelisignaalit).
 *
 * Layout:
 *   1. Hero — "Päivän vedot klo 10.00" + 30-day Sharpness sparkline
 *   2. Today's 5 signals — cards with match, pick, odds, bookmaker, Sharpness
 *   3. Track record — daily average + 30d band
 *   4. ProgressiveOptIn — fast channels for bets (sms_bets / telegram_bets)
 *   5. TrustPills
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProgressiveOptIn from '../components/ProgressiveOptIn';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Sparkline = ({ points = [], color = '#D4B445' }) => {
  if (!points.length) {
    return (
      <div data-testid="sparkline-empty" style={{
        color: 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.14em',
      }}>30D · NO DATA YET</div>
    );
  }
  const w = 320, h = 60;
  const xs = points.map((_, i) => (i / Math.max(1, points.length - 1)) * w);
  const max = Math.max(...points.map((p) => p.score || 0), 1);
  const ys = points.map((p) => h - ((p.score || 0) / max) * (h - 8) - 4);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg data-testid="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" opacity="0.9" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
    </svg>
  );
};

const trackBand = (score) => {
  if (score >= 90) return { label: 'TIGHT', color: '#6FA37D' };
  if (score >= 75) return { label: 'CLEAR', color: '#6FA37D' };
  if (score >= 60) return { label: 'MIXED', color: '#D4B445' };
  if (score >= 40) return { label: 'LOOSE', color: '#C97A3A' };
  return { label: 'SCATTERED', color: '#C13B2C' };
};

/**
 * Track record strip — pure FE summary computed from the sharpness_daily
 * sparkline payload. No new endpoint required; the values are derived
 * from the same `points` array that drives the sparkline.
 *
 * Stats:
 *   - 30D AVG       (rolling average of available days)
 *   - PEAK / NADIR  (max & min daily averages with date)
 *   - DAYS ≥ 75     (how many of the last 30 cleared the "clear" threshold)
 *   - TREND         (last-7d avg vs prior-7d avg, with arrow)
 *
 * Honest empty state when no data has accumulated yet.
 */
const TrackRecordStrip = ({ points = [], lang = 'fi' }) => {
  if (!points.length) {
    return (
      <div data-testid="track-record-empty" style={{
        marginTop: 14, padding: '14px 18px',
        border: '1px dashed var(--hairline, #221E1B)',
        color: 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.14em',
      }}>{lang === 'en'
        ? 'TRACK RECORD · NO DATA YET. CHECK BACK AFTER A FEW DAILY CYCLES.'
        : 'TRACK RECORD · EI DATAA VIELÄ. SEURAA MUUTAMAN VUOROKAUDEN KULUTTUA.'}</div>
    );
  }
  const scores = points.map((p) => p.score || 0);
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = sum / scores.length;
  const peakIdx = scores.indexOf(Math.max(...scores));
  const nadirIdx = scores.indexOf(Math.min(...scores));
  const above75 = scores.filter((s) => s >= 75).length;

  const last7 = scores.slice(-7);
  const prev7 = scores.slice(-14, -7);
  const last7Avg = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null;
  const prev7Avg = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : null;
  const trendDelta = last7Avg != null && prev7Avg != null
    ? last7Avg - prev7Avg
    : null;
  const trendArrow = trendDelta == null ? null
    : trendDelta > 0.5 ? '▲'
    : trendDelta < -0.5 ? '▼'
    : '→';
  const trendColor = trendArrow === '▲' ? '#6FA37D'
    : trendArrow === '▼' ? '#C13B2C'
    : 'var(--muted, #9C9587)';

  const cells = [
    {
      label: lang === 'en' ? '30D AVG' : '30 PV KESKIARVO',
      value: Math.round(avg),
      sub: trackBand(avg).label,
      subColor: trackBand(avg).color,
    },
    {
      label: lang === 'en' ? 'PEAK' : 'KORKEIN',
      value: Math.round(scores[peakIdx]),
      sub: points[peakIdx]?.date || '',
      subColor: '#6FA37D',
    },
    {
      label: lang === 'en' ? 'NADIR' : 'MATALIN',
      value: Math.round(scores[nadirIdx]),
      sub: points[nadirIdx]?.date || '',
      subColor: '#C97A3A',
    },
    {
      label: lang === 'en' ? 'DAYS ≥ 75' : 'PV ≥ 75',
      value: above75,
      sub: `${Math.round((above75 / scores.length) * 100)}%`,
      subColor: '#D4B445',
    },
    {
      label: lang === 'en' ? '7D TREND' : '7 PV TRENDI',
      value: trendArrow || '—',
      sub: trendDelta != null
        ? `${trendDelta > 0 ? '+' : ''}${trendDelta.toFixed(1)}`
        : (lang === 'en' ? 'NOT ENOUGH DATA' : 'EI VIELÄ DATAA'),
      subColor: trendColor,
      isArrow: true,
    },
  ];

  return (
    <div data-testid="pelisignaalit-track-record" style={{
      marginTop: 14, padding: '16px 22px',
      border: '1px solid var(--hairline, #221E1B)',
      background: 'var(--surface, #141210)',
      borderLeft: '2px solid #6FA37D',
      display: 'flex', flexWrap: 'wrap', gap: 36,
    }}>
      <div style={{
        flex: '0 0 100%',
        color: 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', fontWeight: 700,
        marginBottom: 4,
      }}>{lang === 'en' ? 'TRACK RECORD · LAST 30D' : 'TRACK RECORD · 30 VRK'}</div>
      {cells.map((c, i) => (
        <div key={i} data-testid={`track-record-cell-${i}`} style={{ minWidth: 90 }}>
          <div style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4,
          }}>{c.label}</div>
          <div style={{
            color: c.isArrow ? c.subColor : 'var(--ink)',
            fontFamily: 'Georgia, serif',
            fontWeight: 700, fontSize: 26, lineHeight: 1,
          }}>{c.value}</div>
          {c.sub && <div style={{
            color: c.subColor,
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.14em', marginTop: 4,
          }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
};

const Pelisignaalit = () => {
  const { lang } = useLang();
  const [picks, setPicks] = useState([]);
  const [watch, setWatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useDocumentMeta({
    title: lang === 'en' ? 'Pelisignaalit — Daily bets · PUTKI HQ' : 'Pelisignaalit — Päivän vedot · PUTKI HQ',
    description: lang === 'en'
      ? "PUTKI HQ's daily game signals. Five picks. Sharpness score. Named bookmaker. 10:00."
      : 'PUTKI HQ:n päivän pelisignaalit. Viisi vedonyöntiä. Sharpness-pisteet. Nimetty veikkauskirja. Klo 10.00.',
    canonical: `${BACKEND}/pelisignaalit`,
  });

  useEffect(() => {
    let stop = false;
    const load = () => {
      Promise.all([
        fetch(`${BACKEND}/api/odds/featured`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/odds/market-watch`).then((r) => r.ok ? r.json() : null),
      ]).then(([f, w]) => {
        if (stop) return;
        setPicks((f?.picks || []).slice(0, 5));
        setWatch(w);
        setLoading(false);
      }).catch(() => { if (!stop) setLoading(false); });
    };
    load();
    const id = setInterval(load, 90_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const todayScore = watch?.today_score;
  const band = watch?.band;
  const sparkline = watch?.sparkline || [];

  return (
    <div data-testid="pelisignaalit-page" style={{
      maxWidth: 1180, margin: '0 auto', padding: '0 32px',
    }}>
      {/* HERO */}
      <section data-testid="pelisignaalit-hero" style={{ padding: '48px 0 24px' }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700,
        }}>PELISIGNAALIT · TÄNÄÄN</span>
        <h1 data-testid="pelisignaalit-title" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
          letterSpacing: '-0.02em', color: 'var(--ink)',
          margin: '12px 0 18px', maxWidth: 720,
        }}>{lang === 'en'
          ? 'Five daily signals. Sharpness scored. 10:00 sharp.'
          : 'Viisi päivän signaalia. Sharpness-pisteytetty. Klo 10.00.'}</h1>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 16, lineHeight: 1.55,
          maxWidth: 680, margin: 0,
        }}>{lang === 'en'
          ? "Deterministic odds sharpness — implied probability, consensus tightness, 24h momentum. Same data, same score. Subscribe to SMS for instant delivery, or read on the site each morning."
          : "Deterministinen kerroin­jäykkyys — johdettu todennäköisyys, konsensus­tiukkuus, 24 h momentum. Sama data, sama pistemäärä. Tilaa SMS heti­toimitukseen tai lue sivuilta aamulla."}</p>

        {/* 30-day sparkline + today score */}
        <div data-testid="pelisignaalit-market-watch" style={{
          marginTop: 24,
          display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
          padding: '20px 22px',
          border: '1px solid var(--hairline, #221E1B)',
          background: 'var(--surface, #141210)',
        }}>
          <div>
            <div style={{
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.18em', fontWeight: 700,
              marginBottom: 4,
            }}>{lang === 'en' ? "TODAY'S AVG SHARPNESS" : 'TÄNÄÄN KESKI­SHARPNESS'}</div>
            <div data-testid="pelisignaalit-today-score" style={{
              color: '#D4B445', fontFamily: 'Georgia, serif',
              fontWeight: 700, fontSize: 36, lineHeight: 1,
            }}>{todayScore == null ? '—' : Math.round(todayScore)}</div>
            {band && <div style={{
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.14em', marginTop: 4,
            }}>BAND: {String(band).toUpperCase()}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6,
            }}>30D SPARKLINE</div>
            <Sparkline points={sparkline} />
          </div>
        </div>

        {/* TRACK RECORD STRIP — derived stats from the 30-day sparkline */}
        <TrackRecordStrip points={sparkline} lang={lang} />
      </section>

      {/* PICKS */}
      <section data-testid="pelisignaalit-picks" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '32px 0',
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, display: 'block',
          marginBottom: 18,
        }}>{lang === 'en' ? "TODAY'S 5 SIGNALS" : 'PÄIVÄN 5 SIGNAALIA'}</span>
        {loading ? (
          <div data-testid="pelisignaalit-loading" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.14em', padding: 24,
          }}>{lang === 'en' ? 'LOADING SIGNALS…' : 'LADATAAN SIGNAALEJA…'}</div>
        ) : !picks.length ? (
          <div data-testid="pelisignaalit-empty" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.14em', padding: 24,
          }}>{lang === 'en' ? 'NO SIGNALS PUBLISHED YET TODAY' : 'EI SIGNAALEJA JULKAISTU VIELÄ TÄNÄÄN'}</div>
        ) : (
          <div style={{
            display: 'grid', gap: 1, background: 'var(--hairline, #221E1B)',
          }}>
            {picks.map((p, i) => {
              const sharp = p?.sharpness?.sharpness;
              const eventName = p.event_name || p.label || `${p.home_team || ''} – ${p.away_team || ''}`.trim();
              return (
                <div key={`${p.event_id || i}-${i}`} data-testid="pelisignaalit-pick"
                  style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 160px 100px',
                    gap: 18, alignItems: 'baseline',
                    padding: '18px 22px',
                    background: 'var(--surface, #141210)',
                  }}>
                  <span style={{
                    color: 'var(--muted, #9C9587)',
                    fontFamily: 'ui-monospace, monospace', fontSize: 11,
                    letterSpacing: '0.10em',
                  }}>#{i + 1}</span>
                  <div>
                    <div style={{
                      color: 'var(--ink)', fontSize: 16, fontWeight: 600,
                      letterSpacing: '-0.005em', marginBottom: 4,
                    }}>{eventName}</div>
                    <div style={{
                      color: 'var(--muted, #9C9587)',
                      fontFamily: 'ui-monospace, monospace', fontSize: 11,
                      letterSpacing: '0.06em',
                    }}>{p.competition || p.sport_key || ''}
                      {p.bookmaker && <span style={{ opacity: 0.6, marginLeft: 10 }}>· {p.bookmaker}</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      color: 'var(--ink, #ECE6D8)', fontSize: 14, fontWeight: 600,
                    }}>{p.pick_team || p.pick || ''} {p.odds_decimal ? p.odds_decimal.toFixed(2) : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      color: '#D4B445', fontFamily: 'Georgia, serif',
                      fontWeight: 700, fontSize: 22, lineHeight: 1,
                    }}>{sharp == null ? '—' : Math.round(sharp)}</div>
                    <div style={{
                      color: 'var(--muted, #9C9587)',
                      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                      letterSpacing: '0.18em', marginTop: 2,
                    }}>SHARPNESS</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <Link to="/menetelma" data-testid="pelisignaalit-method-link" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.18em',
            textDecoration: 'underline', textUnderlineOffset: 4,
          }}>{lang === 'en' ? 'HOW SHARPNESS IS COMPUTED →' : 'NÄIN SHARPNESS LASKETAAN →'}</Link>
        </div>
      </section>

      {/* PROGRESSIVE OPT-IN */}
      <section data-testid="pelisignaalit-optin" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '32px 0',
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, display: 'block',
          marginBottom: 14,
        }}>{lang === 'en' ? 'GET TOMORROW\u2019S SIGNALS' : 'SAA HUOMISEN SIGNAALIT'}</span>
        <div style={{ maxWidth: 560 }}>
          <ProgressiveOptIn
            surface="pelisignaalit"
            dataTestId="pelisignaalit-optin-component"
            valueProps={{
              email: lang === 'en'
                ? "Daily scene context at 09:00. Mood and Mittari, not the signals — those come faster via SMS."
                : 'Päivän skene-konteksti klo 09.00. Tunnelma ja Mittari, ei signaaleja — ne tulevat nopeammin SMS:llä.',
              sms: lang === 'en'
                ? "5 signals at 10:00, Sharpness 75+. Phone gets them the second odds move."
                : 'Viisi signaalia klo 10.00, Sharpness 75+. Puhelin saa ne sekunnissa kun kerroin liikkuu.',
              telegram: lang === 'en'
                ? "Same 5 signals on Telegram, plus chat with other readers."
                : 'Samat 5 signaalia Telegramissa, plus chatti muiden lukijoiden kanssa.',
            }}
          />
        </div>
      </section>
    </div>
  );
};

export default Pelisignaalit;
