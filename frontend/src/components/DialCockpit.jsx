import React from 'react';
import Dial from './Dial';
import { DIAL_STATES, STREAMERS } from '../data/mock';

// DialCockpit — hero composition with surrounding instrument panels (R8 cluster reference)

const PanelStat = ({ label, value, sub, align = 'left' }) => (
  <div style={{ textAlign: align }} className="px-3 sm:px-0">
    <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
      {label}
    </div>
    <div className="mono" style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
      {value}
    </div>
    {sub && (
      <div className="mono mt-2" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 500 }}>
        {sub}
      </div>
    )}
  </div>
);

export const DialCockpit = ({ state = 'KUUMA' }) => {
  const stateObj = DIAL_STATES[state];
  const live = STREAMERS.filter((s) => s.live);
  const totalViewers = live.reduce((a, s) => a + s.viewers, 0);

  // Top 3 contributing factors (mock for Phase 1.5)
  const contributors = ['ANDYPYRO €42K', 'PACT KICK 5.6K', 'F1 MONZA'];

  // Mode label
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', weekday: 'long', day: 'numeric' });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const hour = parseInt(
    new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', hour12: false }).format(now).split(':')[0],
    10
  );
  const timeOfDay = hour >= 18 ? 'ILTA' : hour >= 12 ? 'ILTAPÄIVÄ' : hour >= 6 ? 'AAMU' : 'YÖ';

  return (
    <div className="flex flex-col items-center w-full" data-testid="dial-cockpit">
      {/* MODE LABEL */}
      <div
        className="mono mb-8"
        style={{ fontSize: 11, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 600 }}
        data-testid="cockpit-mode-label"
      >
        {weekday.toUpperCase()} · {timeOfDay} · KUUKAUDEN {day}. PÄIVÄ
      </div>

      {/* DESKTOP COMPOSITION: panels flank the dial */}
      <div className="hidden md:grid w-full" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 32, alignItems: 'center' }}>
        <div className="flex justify-end">
          <PanelStat label="LIVE NYT" value={live.length} sub="STRIIMAAJAA" align="right" />
        </div>
        <div className="flex flex-col items-center">
          <Dial size="large" state={state} />
        </div>
        <div className="flex justify-start">
          <PanelStat label="KATSOJAA" value={totalViewers.toLocaleString('fi-FI').replace(/,/g, ' ')} sub="YHTEENSÄ" align="left" />
        </div>
      </div>

      {/* MOBILE COMPOSITION: panels stacked above dial */}
      <div className="md:hidden w-full flex flex-col items-center">
        <div className="flex justify-between w-full max-w-xs mb-6">
          <PanelStat label="LIVE" value={live.length} sub="STRIIMAAJAA" align="left" />
          <PanelStat label="KATSOJAA" value={totalViewers.toLocaleString('fi-FI').replace(/,/g, ' ')} sub="YHTEENSÄ" align="right" />
        </div>
        <Dial size="large" state={state} />
      </div>

      {/* CONTRIBUTING FACTORS readout */}
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
    </div>
  );
};

export default DialCockpit;
