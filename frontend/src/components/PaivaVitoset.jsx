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
import { TrendingUp, Clock, AlertCircle, Send, X, CheckCircle2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 5 * 60_000;  // 5 min refresh on the client

const TIPS_TELEGRAM_HANDLE = 'putkihq_vinkit';
const TIPS_TELEGRAM_URL = `https://t.me/${TIPS_TELEGRAM_HANDLE}`;

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

const PaivaVitoset = ({ compact = false }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(null);

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
    fetch(`${BACKEND}/api/signup/count`)
      .then((r) => r.ok ? r.json() : { count: null })
      .then((d) => setSubscriberCount(d.count))
      .catch(() => {});
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const picks = data?.picks || [];
  const visible = compact ? picks.slice(0, 3) : picks;
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
            {visible.map((p, i) => <PickRow key={p.event_id || i} p={p} idx={i} />)}
            {compact && picks.length > visible.length && (
              <li className="px-4 sm:px-5 py-3 mono"
                  style={{ borderTop: '1px solid var(--border)', fontSize: 10.5,
                           letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                <a href="/viikon-kortti" data-testid="paivan-vitoset-view-all"
                   style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                  KATSO KAIKKI 5 VINKKIÄ · VIIKON KORTTI →
                </a>
              </li>
            )}
          </ul>
        )}

        {/* CONVERSION FUNNEL — daily tips Telegram CTA */}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          data-testid="paivan-vitoset-cta"
          className="w-full mono"
          style={{
            display: 'block',
            background: '#E8924A',
            color: '#0A0A0A',
            border: 'none',
            cursor: 'pointer',
            padding: '18px 20px',
            textAlign: 'left',
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div style={{ fontSize: 10.5, letterSpacing: '0.28em', fontWeight: 700, opacity: 0.75 }}>
                🔥 SAA NÄMÄ VINKIT PÄIVITTÄIN
              </div>
              <div className="display mt-1" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
                Tilaa Telegram-kanavaan →
              </div>
            </div>
            <div className="text-right" style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 600, opacity: 0.7 }}>
              ILMAINEN · EI SPÄMMIÄ
              {subscriberCount != null && (
                <div style={{ marginTop: 2 }}>{subscriberCount} TILAAJAA</div>
              )}
            </div>
          </div>
        </button>

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

      {showModal && (
        <div
          data-testid="paivan-vitoset-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              maxWidth: 460, width: '100%', maxHeight: '92vh', overflowY: 'auto',
            }}
          >
            <div className="flex items-center justify-between px-5 py-4"
                 style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="mono inline-flex items-center gap-2"
                   style={{ fontSize: 10, letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)' }}>
                <Send strokeWidth={1.9} size={12} />
                TILAA TELEGRAM-VINKIT
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', opacity: 0.7 }}
                data-testid="paivan-vitoset-modal-close"
              >
                <X strokeWidth={1.6} size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <h3 className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
                Päivittäiset vedonlyöntivinkit
              </h3>
              <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
                Saat 5 valintaa päivässä suoraan Telegramiin. Alaviivassa kerroin,
                luottamus % ja paras kirjanpitäjä.
              </p>
              <ul className="space-y-2" style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                {['NHL · Valioliiga · Veikkausliiga · Mestarien liiga',
                  'Kertoimet ja avaintoiminnan analyysi',
                  'Luottamusprosentit eri kirjanpitäjien välillä',
                  'Ilmainen · ei spämmiä · perukaa milloin vain'].map((b) => (
                  <li key={b} className="flex items-start gap-2 font-serif">
                    <CheckCircle2 strokeWidth={1.7} size={14} style={{ color: '#2c7a4b', marginTop: 3, flexShrink: 0 }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href={TIPS_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="paivan-vitoset-telegram-link"
                className="mono w-full inline-flex items-center justify-center gap-2"
                style={{
                  padding: '14px 18px',
                  fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
                  background: 'var(--ink)', color: 'var(--bg)',
                  textDecoration: 'none', borderRadius: 2,
                }}
              >
                <Send strokeWidth={1.9} size={13} />
                LIITY @{TIPS_TELEGRAM_HANDLE} →
              </a>
              <div className="mono text-center" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', opacity: 0.7 }}>
                TULOSSA PIAN · SMS- JA WHATSAPP-VINKIT
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaivaVitoset;
