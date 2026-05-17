/**
 * PaivaVitoset — "Päivän Vitoset" homepage strip.
 *
 * Premium betting slip card showing the 5 strongest favourites of the day
 * from /api/odds/featured (real Odds API data, 15min backend cache).
 *
 * Each pick line: sport icon · team · vs opponent · kickoff · decimal odds
 * · implied probability bar · best bookmaker. Confidence band colour-coded
 * (≥80 % deep green, 65-80 % amber, <65 % red-orange).
 *
 * Honest empty state when out-of-season / no events / dormant API.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Clock, AlertCircle } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 5 * 60_000;  // 5 min refresh on the client

const confidenceColor = (pct) => {
  if (pct >= 80) return '#2c7a4b';
  if (pct >= 65) return '#E8924A';
  return '#C8423C';
};

const fmtKickoff = (iso) => {
  if (!iso) return '';
  try {
    const t = new Date(iso);
    const now = new Date();
    const diffH = (t.getTime() - now.getTime()) / 3600_000;
    const dateFmt = new Intl.DateTimeFormat('fi-FI', {
      weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Helsinki',
    });
    const timeFmt = new Intl.DateTimeFormat('fi-FI', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki',
    });
    if (diffH < 0) return 'KÄYNNISSÄ';
    if (diffH < 24) return `Tänään · ${timeFmt.format(t)}`;
    return `${dateFmt.format(t)} · ${timeFmt.format(t)}`;
  } catch { return ''; }
};

const PickRow = ({ p, idx }) => {
  const color = confidenceColor(p.implied_probability);
  const opp = p.pick_side === 'home' ? p.away_team : p.home_team;
  const pctRounded = Math.round(p.implied_probability);
  return (
    <li
      data-testid={`paivan-vitonen-${idx}`}
      className="grid items-center gap-3 py-4 px-4 sm:px-5"
      style={{
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
        transition: 'background 200ms ease',
      }}
    >
      {/* Index pill — like a real betting slip line number */}
      <div
        className="mono flex items-center justify-center"
        style={{
          width: 28, height: 28, borderRadius: 999,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          fontSize: 11, fontWeight: 700,
          letterSpacing: 0, color: 'var(--ink)',
        }}
      >
        {idx + 1}
      </div>

      {/* Team + meta */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
            {(p.sport_label || '').toUpperCase()}
          </span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span className="mono inline-flex items-center gap-1"
                style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500 }}>
            <Clock strokeWidth={1.7} size={10} />
            {fmtKickoff(p.commence_time)}
          </span>
        </div>
        <div
          className="display mt-1"
          style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}
          data-testid={`paivan-vitonen-team-${idx}`}
        >
          {p.pick_team} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>vs</span> {opp}
        </div>
        <div className="mono mt-1" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)' }}>
          PARAS HINTA · {p.bookmaker}
        </div>
      </div>

      {/* Odds + confidence */}
      <div className="flex flex-col items-end gap-1.5" style={{ minWidth: 90 }}>
        <div className="mono inline-flex items-baseline gap-1"
             style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}
             data-testid={`paivan-vitonen-odds-${idx}`}>
          {p.decimal_odds.toFixed(2)}
        </div>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 56, height: 4, background: 'rgba(122,126,131,0.18)',
              borderRadius: 1, overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, p.implied_probability)}%`,
                height: '100%', background: color, transition: 'width 600ms ease',
              }}
            />
          </div>
          <div className="mono" style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0 }}
               data-testid={`paivan-vitonen-conf-${idx}`}>
            {pctRounded}%
          </div>
        </div>
      </div>
    </li>
  );
};

const PaivaVitoset = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/odds/featured`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const picks = data?.picks || [];
  const dormant = data?.dormant;
  const fetchedLabel = data?.fetched_at
    ? new Date(data.fetched_at * 1000).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <section className="container-wide" data-testid="paivan-vitoset">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="mono mb-1.5" style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 700 }}>
            PÄIVÄN VITOSET · BOOKMAKER CONSENSUS
          </div>
          <h2 className="display" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            Päivän viisi vahvinta valintaa
          </h2>
        </div>
        {fetchedLabel && (
          <div className="mono inline-flex items-center gap-2"
               style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
            <TrendingUp strokeWidth={1.7} size={12} />
            PÄIVITETTY {fetchedLabel}
          </div>
        )}
      </div>

      <div
        className="panel"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          overflow: 'hidden',
          maxWidth: 960,
        }}
      >
        {/* Slip header bar — premium ticker feel */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 mono"
          style={{
            background: '#0A0A0A',
            color: '#F5F3EE',
            fontSize: 10,
            letterSpacing: '0.22em',
            fontWeight: 700,
          }}
        >
          <span>PUTKI HQ · BETTING TICKET</span>
          <span style={{ opacity: 0.55 }}>{picks.length}/5 · TODAY'S TOP</span>
        </div>

        {error ? (
          <div className="px-5 py-6 mono inline-flex items-center gap-2"
               style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
               data-testid="paivan-vitoset-error">
            <AlertCircle strokeWidth={1.8} size={13} />
            VIRHE · {error}
          </div>
        ) : dormant ? (
          <div className="px-5 py-8 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="paivan-vitoset-dormant">
            ODDS-INTEGRAATIO ODOTTAA KONFIGURAATIOTA · {data?.reason?.toUpperCase()}
          </div>
        ) : picks.length === 0 ? (
          <div className="px-5 py-8 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="paivan-vitoset-empty">
            EI VAHVOJA SUOSIKKEJA TÄNÄÄN · TARKISTA UUDESTAAN HUOMENNA
          </div>
        ) : (
          <ul data-testid="paivan-vitoset-list">
            {picks.map((p, i) => <PickRow key={p.event_id || i} p={p} idx={i} />)}
          </ul>
        )}

        {/* Disclaimer footer */}
        <div
          className="px-4 sm:px-5 py-3 mono"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            fontSize: 9.5,
            letterSpacing: '0.18em',
            color: 'var(--muted)',
            fontWeight: 500,
          }}
        >
          KAUPALLINEN AGGREGAATTI · 18+ · PELAA VASTUULLISESTI · DATA: THE ODDS API
        </div>
      </div>
    </section>
  );
};

export default PaivaVitoset;
