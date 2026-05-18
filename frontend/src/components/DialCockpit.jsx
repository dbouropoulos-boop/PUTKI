import React, { useEffect, useState } from 'react';
import Dial from './Dial';
import CountUp from './CountUp';
import { useLang } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass — DialCockpit reads /api/cockpit + /api/admin/signals
// summary surface (/api/signals/summary public would be ideal, but the
// composite_score + sub_scores + signal_count already on /api/cockpit
// gives us everything we need without admin auth).
//
// No hardcoded "ANDYPYRO €42K · PACT KICK 5.6K · F1 MONZA" — contributors
// come from real sub_scores (which categories actually drove the dial).
// If no real signal yet, show "EI SIGNAALIA" instead of fabricated viewers.

const PanelStat = ({ label, value, sub, align = 'left', lang = 'fi' }) => {
  const isNumeric = typeof value === 'number';
  const formatLocale = lang === 'en' ? 'en-US' : 'fi-FI';
  const formatNum = (n) => {
    const r = Math.round(n);
    const s = r.toLocaleString(formatLocale);
    return lang === 'en' ? s : s.replace(/,/g, ' ');
  };
  return (
    <div style={{ textAlign: align }} className="px-3 sm:px-0">
      <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
        {isNumeric ? (
          <CountUp to={value} duration={1400} format={formatNum} />
        ) : (
          value
        )}
      </div>
      {sub && (
        <div className="mono mt-2" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
};

const SUBSCORE_LABEL = {
  // Phase 4 — new 3-signal layer
  stream:    { fi: 'STRIIMIT',  en: 'STREAMS',  weightPct: 57 },
  sports:    { fi: 'URHEILU',   en: 'SPORTS',   weightPct: 29 },
  news:      { fi: 'UUTISVIRTA',en: 'NEWSFLOW', weightPct: 14 },
  // Legacy (kept so older snapshots still render labels)
  streamers: { fi: 'STRIIMAAJAT', en: 'STREAMERS', weightPct: null },
  social:    { fi: 'REDDIT',      en: 'REDDIT',    weightPct: 0 },
  youtube:   { fi: 'YOUTUBE',     en: 'YOUTUBE',   weightPct: null },
  forum:     { fi: 'FOORUMI',     en: 'FORUM',    weightPct: null },
  internal:  { fi: 'TOIMITUS',    en: 'EDITORIAL' },
};

// Tooltip help icon next to the cockpit brand label — first-visit nudge so
// brand-new visitors understand what the dial actually measures.
const DialHelp = () => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Mittari help"
        data-testid="dial-help-trigger"
        style={{
          width: 16, height: 16, borderRadius: 999,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          color: 'var(--muted)',
          fontSize: 10, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1,
        }}
      >?</button>
      {open && (
        <div
          data-testid="dial-help-popover"
          style={{
            position: 'absolute', top: 22, left: 0, zIndex: 10,
            width: 280, padding: 14,
            background: 'var(--bg)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.18)',
          }}
        >
          <p className="font-serif" style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>
            {t('dial.tooltip')}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            data-testid="dial-help-dismiss"
            className="mono"
            style={{
              marginTop: 10, padding: '6px 12px',
              background: 'var(--ink)', color: 'var(--bg)',
              border: 'none', borderRadius: 2, cursor: 'pointer',
              fontSize: 10, letterSpacing: '0.22em', fontWeight: 700,
            }}
          >
            {t('dial.tooltip_dismiss').toUpperCase()}
          </button>
        </div>
      )}
    </span>
  );
};

export const DialCockpit = ({ state = 'KYLMA', compact = false }) => {
  const { lang, t } = useLang();
  const [cockpit, setCockpit] = useState(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Phase 4 Week 3: prefer Server-Sent Events stream when supported; falls
    // back to /api/cockpit polling if the connection fails or EventSource is
    // unavailable. Keeps the dial in sync with Layer 2 worker ticks instantly.
    const load = () => {
      fetch(`${BACKEND}/api/cockpit`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setCockpit(d); })
        .catch(() => {});
    };

    let pollId = null;
    let es = null;
    try {
      if (typeof EventSource !== 'undefined') {
        es = new EventSource(`${BACKEND}/api/dial/stream`);
        es.addEventListener('dial', (ev) => {
          try {
            const snap = JSON.parse(ev.data);
            if (cancelled) return;
            setSseConnected(true);
            setPulseTick((n) => n + 1);
            setCockpit({
              primary_driver: snap.primary_driver,
              primary_driver_label: snap.primary_driver_label,
              composite_score: snap.composite_score,
              state: snap.state,
              sub_scores: snap.sub_scores || {},
              intensities: snap.intensities || {},
              signal_count: snap.signal_count || 0,
              any_real: !!snap.any_real,
              computed_at: snap.computed_at,
            });
          } catch (_) { /* ignore */ }
        });
        es.onerror = () => {
          // SSE flaked — fall back to polling so we don't go silent
          setSseConnected(false);
          if (es) { es.close(); es = null; }
          if (!pollId) {
            load();
            pollId = setInterval(load, 30000);
          }
        };
      } else {
        load();
        pollId = setInterval(load, 30000);
      }
    } catch (_) {
      load();
      pollId = setInterval(load, 30000);
    }

    return () => {
      cancelled = true;
      if (es) es.close();
      if (pollId) clearInterval(pollId);
    };
  }, []);

  const composite = typeof cockpit?.composite_score === 'number' ? Math.round(cockpit.composite_score) : null;
  const signalCount = cockpit?.signal_count ?? 0;
  const anyReal = !!cockpit?.any_real;
  const subScores = cockpit?.sub_scores || {};
  const intensities = cockpit?.intensities || {};

  // Phase 4 — Layer 2 three-signal bars (Twitch / NHL / News). Show every
  // tracked signal so editorial can see what's driving the dial.
  const layer2Signals = [
    { key: 'stream', weight: 57, value: intensities.stream ?? (subScores.stream || 0) / 57 },
    { key: 'sports', weight: 29, value: intensities.sports ?? (subScores.sports || 0) / 29 },
    { key: 'news',   weight: 14, value: intensities.news   ?? (subScores.news   || 0) / 14 },
  ];

  // Contributors: top 3 sub_scores (non-zero) by value, mapped to labels.
  const contributors = Object.entries(subScores)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => {
      const label = (SUBSCORE_LABEL[k] || { fi: k.toUpperCase(), en: k.toUpperCase() })[lang];
      return `${label} ${Math.round(v)}`;
    });

  const now = new Date();
  const localeTag = lang === 'en' ? 'en-GB' : 'fi-FI';
  const fmt = new Intl.DateTimeFormat(localeTag, { timeZone: 'Europe/Helsinki', weekday: 'long', day: 'numeric' });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', hour12: false }).format(now);
  const hour = parseInt((hourStr.match(/\d{2}/) || ['00'])[0], 10);
  const todKey = hour >= 18 ? 'time.evening' : hour >= 12 ? 'time.afternoon' : hour >= 6 ? 'time.morning' : 'time.night';

  // useNow drives the live "last update Xs ago" ticker in the cockpit
  // header — re-renders every second when computedAt is set.
  const [tickerNow, setTickerNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTickerNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const lastUpdateLabel = (() => {
    void tickerNow;
    if (!cockpit?.computed_at) return null;
    try {
      const iso = String(cockpit.computed_at).replace(' ', 'T');
      return formatTimeAgo(iso, lang);
    } catch { return null; }
  })();

  return (
    <div className="flex flex-col items-center w-full" data-testid="dial-cockpit">
      {/* LAST UPDATE ticker — small, monospace, sits above the maker's mark
          to reinforce the "live trading instrument" feel. */}
      <div
        className="mono mb-1 inline-flex items-center gap-2"
        style={{ fontSize: 9.5, letterSpacing: '0.32em', color: 'var(--muted)', fontWeight: 500, opacity: 0.55 }}
        data-testid="cockpit-last-update"
      >
        {lang === 'en' ? 'LAST UPDATE' : 'VIIMEISIN PÄIVITYS'} · {lastUpdateLabel || (lang === 'en' ? '— AGO' : '— SITTEN')}
      </div>
      {/* Premium trading-dashboard eyebrow — date/time on the left, live SSE
          indicator on the right. The brand stays as a faint maker's mark above
          the primary mode label so it doesn't compete with the active state. */}
      <div className="mono mb-3 inline-flex items-center gap-3"
        style={{ fontSize: 9.5, letterSpacing: '0.32em', color: 'var(--muted)', fontWeight: 500, opacity: 0.55, marginBottom: 6 }}
        data-testid="cockpit-makers-mark"
      >
        <span style={{ fontStyle: 'italic' }}>{lang === 'en' ? 'win-pulse' : 'perkele-mittari'}</span>
      </div>
      <div className="mono mb-8 inline-flex items-center gap-3 flex-wrap justify-center"
        style={{ fontSize: compact ? 13 : 15, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 800, marginBottom: compact ? 14 : 26 }}
        data-testid="cockpit-mode-label"
      >
        <span
          className="inline-block"
          data-testid="cockpit-live-dot"
          style={{
            width: 7, height: 7, borderRadius: 999,
            background: sseConnected ? '#2c7a4b' : '#7A7E83',
            boxShadow: sseConnected ? '0 0 8px #2c7a4b' : 'none',
            transition: 'background 400ms ease, box-shadow 400ms ease',
          }}
        />
        {lang === 'en' ? 'WIN PULSE' : 'P*RKELE-MITTARI'}
        <DialHelp />
        <span style={{ color: 'var(--border-strong)' }}>·</span>
        <span style={{ color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.28em', fontSize: 11 }}>{weekday.toUpperCase()} {t('time.month_day', { day })} · {t(todKey)}</span>
      </div>

      <div className="hidden md:grid w-full" style={{ gridTemplateColumns: '1fr auto 1fr', gap: compact ? 20 : 32, alignItems: 'center' }}>
        <div className="flex justify-end">
          <PanelStat
            label={lang === 'en' ? 'COMPOSITE' : 'KOKONAISLUKU'}
            value={composite ?? (lang === 'en' ? 'NO SIGNAL' : 'EI SIGNAALIA')}
            sub={anyReal ? (lang === 'en' ? 'REAL SIGNALS' : 'OIKEAT SIGNAALIT') : (lang === 'en' ? 'MOCKED INPUTS' : 'MOCK-SYÖTTEET')}
            align="right"
            lang={lang}
          />
        </div>
        <div className="flex flex-col items-center">
          <Dial size={compact ? 'medium' : 'large'} state={state} pulseTick={pulseTick} />
        </div>
        <div className="flex justify-start">
          <PanelStat
            label={lang === 'en' ? 'SIGNALS' : 'SIGNAALEJA'}
            value={signalCount}
            sub={lang === 'en' ? 'LAST POLL WINDOW' : 'EDELLINEN POLLAUS'}
            align="left"
            lang={lang}
          />
        </div>
      </div>

      <div className="md:hidden w-full flex flex-col items-center">
        <div className="flex justify-between w-full max-w-xs mb-6">
          <PanelStat
            label={lang === 'en' ? 'COMPOSITE' : 'KOKONAISLUKU'}
            value={composite ?? '—'}
            sub={anyReal ? (lang === 'en' ? 'REAL' : 'OIKEA') : (lang === 'en' ? 'MOCK' : 'MOCK')}
            align="left"
            lang={lang}
          />
          <PanelStat
            label={lang === 'en' ? 'SIGNALS' : 'SIGNAALEJA'}
            value={signalCount}
            sub={lang === 'en' ? 'LAST POLL' : 'EDELLINEN'}
            align="right"
            lang={lang}
          />
        </div>
        <Dial size={compact ? 'medium' : 'large'} state={state} pulseTick={pulseTick} />
      </div>

      {/* Phase 4 — Layer 2 three-signal sub-bars. Premium trading-dashboard
          row: ticker label · weighted value · intensity bar · raw % share.
          Always rendered so even an idle scene shows the structure. */}
      <div
        className="mt-8 w-full grid grid-cols-1 sm:grid-cols-3"
        style={{ gap: 1, background: 'var(--border-strong)', border: '1px solid var(--border-strong)', maxWidth: 760 }}
        data-testid="cockpit-layer2-bars"
      >
        {layer2Signals.map((sig) => {
          const meta = SUBSCORE_LABEL[sig.key];
          const pct = Math.max(0, Math.min(1, Number(sig.value) || 0));
          const subScore = Math.round((subScores[sig.key] || 0) * 10) / 10;
          return (
            <div
              key={sig.key}
              className="p-4 flex flex-col gap-2"
              style={{ background: 'var(--bg)' }}
              data-testid={`cockpit-layer2-bar-${sig.key}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                  {meta[lang]}
                </div>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', opacity: 0.7 }}>
                  W {sig.weight}%
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="mono" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
                  {subScore}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 500 }}>
                  / {sig.weight}
                </div>
              </div>
              <div
                style={{
                  height: 4,
                  background: 'rgba(44, 95, 141, 0.10)',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 1,
                }}
              >
                <div
                  data-testid={`cockpit-layer2-fill-${sig.key}`}
                  style={{
                    height: '100%',
                    width: `${Math.round(pct * 100)}%`,
                    background: pct > 0 ? '#2C5F8D' : 'transparent',
                    transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {contributors.length > 0 ? (
        <div
          className="mono mt-5 flex items-center gap-2 flex-wrap justify-center px-4"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}
          data-testid="cockpit-contributors"
        >
          <span style={{ color: 'var(--muted)', opacity: 0.7 }}>PRIMARY DRIVERS</span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          {contributors.map((c, i) => (
            <React.Fragment key={c}>
              <span>{c}</span>
              {i < contributors.length - 1 && <span style={{ color: 'var(--border-strong)' }}>·</span>}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          className="mono mt-5"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}
          data-testid="cockpit-contributors-empty"
        >
          {lang === 'en' ? 'NO ACTIVE CONTRIBUTORS · POLLERS HAVE NOT RETURNED REAL DATA YET' : 'EI AKTIIVISIA SYÖTTEITÄ · POLLERIT EIVÄT VIELÄ TUOTA OIKEAA DATAA'}
        </div>
      )}
      <a
        href="/mittari/historia"
        className="mono mt-3 inline-flex items-center gap-1.5 transition-opacity hover:opacity-100"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.22em',
          color: 'var(--muted)',
          fontWeight: 600,
          textDecoration: 'none',
          opacity: 0.7,
        }}
        data-testid="cockpit-history-link"
      >
        {lang === 'en' ? 'METER HISTORY →' : 'MITTARIN HISTORIA →'}
      </a>
    </div>
  );
};

export default DialCockpit;
