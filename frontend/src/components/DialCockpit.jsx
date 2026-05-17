import React, { useEffect, useState } from 'react';
import Dial from './Dial';
import CountUp from './CountUp';
import { useLang } from '../context/LanguageContext';

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
  streamers: { fi: 'STRIIMAAJAT', en: 'STREAMERS' },
  sports:    { fi: 'URHEILU',     en: 'SPORTS' },
  youtube:   { fi: 'YOUTUBE',     en: 'YOUTUBE' },
  forum:     { fi: 'FOORUMI',     en: 'FORUM' },
  internal:  { fi: 'TOIMITUS',    en: 'EDITORIAL' },
};

export const DialCockpit = ({ state = 'KYLMA', compact = false }) => {
  const { lang, t } = useLang();
  const [cockpit, setCockpit] = useState(null);

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
            setCockpit({
              primary_driver: snap.primary_driver,
              primary_driver_label: snap.primary_driver_label,
              composite_score: snap.composite_score,
              state: snap.state,
              sub_scores: snap.sub_scores || {},
              signal_count: snap.signal_count || 0,
              any_real: !!snap.any_real,
              computed_at: snap.computed_at,
            });
          } catch (_) { /* ignore */ }
        });
        es.onerror = () => {
          // SSE flaked — fall back to polling so we don't go silent
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

  return (
    <div className="flex flex-col items-center w-full" data-testid="dial-cockpit">
      <div className="mono mb-8 inline-flex items-center gap-2"
        style={{ fontSize: 11, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 600, marginBottom: compact ? 16 : 32 }}
        data-testid="cockpit-mode-label"
      >
        <span className="inline-block" style={{ width: 6, height: 6, borderRadius: 999, background: '#E8924A' }} />
        {weekday.toUpperCase()} · {t(todKey)} · {t('time.month_day', { day })}
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
          <Dial size={compact ? 'medium' : 'large'} state={state} />
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
        <Dial size={compact ? 'medium' : 'large'} state={state} />
      </div>

      {contributors.length > 0 ? (
        <div
          className="mono mt-6 flex items-center gap-2 flex-wrap justify-center px-4"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}
          data-testid="cockpit-contributors"
        >
          {contributors.map((c, i) => (
            <React.Fragment key={c}>
              <span>{c}</span>
              {i < contributors.length - 1 && <span style={{ color: 'var(--border-strong)' }}>·</span>}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          className="mono mt-6"
          style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}
          data-testid="cockpit-contributors-empty"
        >
          {lang === 'en' ? 'NO ACTIVE CONTRIBUTORS · POLLERS HAVE NOT RETURNED REAL DATA YET' : 'EI AKTIIVISIA SYÖTTEITÄ · POLLERIT EIVÄT VIELÄ TUOTA OIKEAA DATAA'}
        </div>
      )}
    </div>
  );
};

export default DialCockpit;
