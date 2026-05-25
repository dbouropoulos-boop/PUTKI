/**
 * MittariHistoria - dedicated dial history page at /mittari/historia.
 *
 * Reads /api/dial/history (limit=200) and surfaces:
 *  - 7-day composite-score line chart (full-width)
 *  - State distribution bars (% time spent in each state)
 *  - Recent snapshot table (last 30 polls with timestamp + state + score)
 *
 * Replaces the timeline mini-chart that used to live under the hero dial.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DIAL_STATES, dialLabel } from '../constants/dial';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_ORDER = ['KYLMA', 'HAALEA', 'KUUMA', 'MYRSKY', 'KIIRASTULI'];

const STATE_BAND = (val) => {
  if (val >= 90) return 'KIIRASTULI';
  if (val >= 72) return 'MYRSKY';
  if (val >= 48) return 'KUUMA';
  if (val >= 24) return 'HAALEA';
  return 'KYLMA';
};

const fmtClock = (iso, lang = 'fi') => {
  try {
    const t = new Date(iso);
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Helsinki',
    }).format(t);
  } catch { return '-'; }
};

const Chart = ({ data, width = 980, height = 320, lang = 'fi' }) => {
  if (data.length < 2) {
    return (
      <div className="panel p-8 text-center mono"
           style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
           data-testid="mittari-historia-chart-empty">
        {lang === 'en'
          ? 'NOT ENOUGH DATA YET · BUFFER FILLS WITH EACH POLL'
          : 'EI VIELÄ TARPEEKSI DATAA · KESKIVÄYLÄ KERTYY POLLAUSTEN MYÖTÄ'}
      </div>
    );
  }
  const stepX = width / (data.length - 1);
  const points = data.map((d, i) => ({
    x: i * stepX,
    y: height - (Math.max(0, Math.min(100, d.value)) / 100) * height,
    v: d.value,
    iso: d.iso,
    state: d.state,
  }));
  const path = points.reduce(
    (acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
    '',
  );
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  const lastColor = DIAL_STATES[last.state]?.color || '#7A7E83';

  const bandLines = [24, 48, 72, 90];

  return (
    <div className="panel" style={{ padding: 20, background: 'var(--surface)', borderRadius: 4 }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        data-testid="mittari-historia-chart"
      >
        <defs>
          <linearGradient id="mittari-historia-area" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lastColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lastColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {bandLines.map((b) => (
          <line
            key={b}
            x1="0" y1={height - (b / 100) * height}
            x2={width} y2={height - (b / 100) * height}
            stroke="var(--border)" strokeWidth="0.6" strokeDasharray="3,5"
          />
        ))}
        <path d={areaPath} fill="url(#mittari-historia-area)" />
        <path d={path} fill="none" stroke={lastColor} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={last.x - 1} cy={last.y} r="4" fill={lastColor}>
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="mono mt-3 flex justify-between"
           style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
        <span>{fmtClock(data[0].iso, lang)}</span>
        <span>{fmtClock(data[Math.floor(data.length / 2)].iso, lang)}</span>
        <span>{fmtClock(last.iso, lang)}</span>
      </div>
    </div>
  );
};

const Distribution = ({ history, lang }) => {
  const dist = useMemo(() => {
    const out = STATE_ORDER.map((k) => ({ key: k, count: 0 }));
    history.forEach((h) => {
      const s = h.state_key || h.state?.key || STATE_BAND(h.composite_score || 0);
      const row = out.find((r) => r.key === s);
      if (row) row.count += 1;
    });
    const total = out.reduce((a, b) => a + b.count, 0) || 1;
    return out.map((r) => ({ ...r, pct: (r.count / total) * 100 }));
  }, [history]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
      {dist.map((d) => {
        const meta = DIAL_STATES[d.key];
        return (
          <div
            key={d.key}
            className="panel p-4"
            style={{ background: 'var(--bg)' }}
            data-testid={`mittari-historia-dist-${d.key}`}
          >
            <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              {dialLabel(d.key, lang)}
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
              {Math.round(d.pct)}%
            </div>
            <div className="mt-2" style={{ height: 4, background: 'rgba(122,126,131,0.16)', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ width: `${d.pct}%`, height: '100%', background: meta?.color, transition: 'width 600ms ease' }} />
            </div>
            <div className="mono mt-2" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)' }}>
              {d.count} {lang === 'en' ? 'POLLS' : 'POLL'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MittariHistoria = () => {
  const { lang } = useLang();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useDocumentMeta({
    title: lang === 'en' ? 'Meter · History - PUTKI HQ' : 'Mittari · Historia - PUTKI HQ',
    description: lang === 'en'
      ? 'Recent PUTKI HQ meter readings and state distribution.'
      : 'PUTKI HQ:n perkele-mittarin lukemat ja tilajakauma viime polleilta.',
    canonical: `${BACKEND}/mittari/historia`,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial/history?limit=200`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setHistory(d.history || []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo(() => {
    const sorted = [...history].sort((a, b) =>
      new Date(a.recorded_at || a.computed_at || 0) - new Date(b.recorded_at || b.computed_at || 0),
    );
    return sorted.map((s) => {
      const v = Math.max(0, Math.min(100, Math.round(s.composite_score || 0)));
      return {
        iso: s.recorded_at || s.computed_at,
        value: v,
        state: s.state_key || s.state?.key || STATE_BAND(v),
      };
    });
  }, [history]);

  return (
    <div data-testid="mittari-historia-page">
      <section className="container-wide pt-12 pb-6">
        <Link to="/" className="mono inline-flex items-center gap-2 mb-6"
              style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
          <ArrowLeft strokeWidth={1.7} size={12} />
          {lang === 'en' ? 'BACK TO HOME' : 'PALAA ETUSIVULLE'}
        </Link>
        <div className="eyebrow mb-3">{lang === 'en' ? 'PUTKI HQ · ARCHIVE' : 'PUTKI HQ · ARKISTO'}</div>
        <h1 className="display text-4xl sm:text-5xl" style={{ lineHeight: 1.05 }}>
          {lang === 'en' ? 'Meter history' : 'Mittarin historia'}
        </h1>
        <p className="font-serif mt-4 max-w-2xl" style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.55 }}>
          {lang === 'en'
            ? 'Composite score timeline of the PUTKI HQ meter. Each dot is a single polling round - Layer 2 workers ship 3-5 snapshots per hour on average.'
            : 'Perkele-mittarin kokonaislukeman aikajana. Jokainen piste on yksi pollauskierros - Layer 2 -työntekijät kirjoittavat keskimäärin 3-5 snapshotia tunnissa.'}
        </p>
      </section>

      <section className="container-wide py-8">
        <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {lang === 'en'
            ? `COMPOSITE · LAST ${chartData.length} POLLS`
            : `KOMPOSIITTI · VIIMEISET ${chartData.length} POLL`}
        </div>
        {loading ? (
          <div className="panel p-8 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="mittari-historia-loading">
            {lang === 'en' ? 'LOADING HISTORY…' : 'LADATAAN HISTORIAA…'}
          </div>
        ) : (
          <Chart data={chartData} lang={lang} />
        )}
      </section>

      <section className="container-wide py-8" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="mono mb-4" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {lang === 'en' ? 'STATE DISTRIBUTION · % OF TIME' : 'TILAJAKAUMA · % AJASTA'}
        </div>
        <Distribution history={history} lang={lang} />
      </section>

      <section className="container-wide py-8 pb-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="mono mb-4" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {lang === 'en' ? 'RECENT POLLS' : 'VIIMEISIMMÄT POLLAUKSET'}
        </div>
        <div className="panel" style={{ background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
          <ul data-testid="mittari-historia-table">
            {chartData.slice(-30).reverse().map((row, i) => {
              const meta = DIAL_STATES[row.state];
              return (
                <li
                  key={`${row.iso}-${i}`}
                  className="grid items-center px-4 sm:px-5 py-3"
                  style={{
                    gridTemplateColumns: '180px 1fr auto',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <span className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                    {fmtClock(row.iso, lang)}
                  </span>
                  <span className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: meta?.color || 'var(--ink)', fontWeight: 700 }}>
                    {dialLabel(row.state, lang)}
                  </span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {row.value}
                  </span>
                </li>
              );
            })}
            {chartData.length === 0 && (
              <li className="px-5 py-8 text-center mono"
                  style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}>
                {lang === 'en' ? 'NO HISTORY DATA' : 'EI HISTORIATIETOJA'}
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default MittariHistoria;
