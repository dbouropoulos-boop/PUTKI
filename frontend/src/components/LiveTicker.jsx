import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { dialLabel } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass - LiveTicker reads /api/cockpit only.
// No fabricated viewer counts, no hardcoded streamer names, no fake spike copy.
// When the polling pipeline has no real data, the strip displays a single
// neutral status: "MITTARI · EI SIGNAALIA - TOIMITUS PÄIVITTÄÄ".

export const LiveTicker = () => {
  const { lang } = useLang();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/cockpit`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setData(d);
      } catch {}
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const state = data?.state;
  const stateLabel = state?.key
    ? dialLabel(state.key, lang)
    : (lang === 'en' ? 'NO SIGNAL' : 'EI SIGNAALIA');
  // Phase 1 (Section 3b): top ticker uses muted slate dots, not state colors.
  // The full Phase 2 news ticker will replace this strip entirely.
  const stateColor = 'var(--muted)';
  const composite = typeof data?.composite_score === 'number' ? Math.round(data.composite_score) : null;
  const drivers = data?.primary_driver_label
    ? [data.primary_driver_label[lang] || data.primary_driver_label.fi]
    : [];
  const lastSpike = data?.last_spike;
  const anyReal = !!data?.any_real;
  const meterWord = lang === 'en' ? 'METER' : 'MITTARI';

  // Honest item list. Each chip carries a real value or is omitted.
  const items = [];
  items.push({
    color: stateColor,
    label: `${meterWord} · ${stateLabel}${composite != null ? ` ${composite}` : ''}`,
  });
  if (drivers.length) {
    items.push({ color: 'var(--muted)', label: `${lang === 'en' ? 'DRIVER' : 'PÄÄSYY'} · ${drivers[0]}` });
  }
  if (lastSpike?.text) {
    const snippet = String(lastSpike.text).slice(0, 80).replace(/\s+\S*$/, '');
    items.push({ color: 'var(--muted)', label: `${lang === 'en' ? 'LATEST' : 'VIIMEISIN'} · ${snippet}…` });
  }
  if (!anyReal) {
    items.push({
      color: 'var(--muted)',
      label: lang === 'en' ? 'NO LIVE SIGNAL YET · EDITORIAL UPDATING' : 'EI LIVESIGNAALIA · TOIMITUS PÄIVITTÄÄ',
    });
  }

  const renderRow = (key) => (
    <div key={key} className="flex items-center shrink-0">
      {items.map((it, i) => (
        <React.Fragment key={`${key}-${i}`}>
          <span className="mono inline-flex items-center gap-2 shrink-0 px-5" style={{ fontSize: 10.5, letterSpacing: '0.16em', fontWeight: 600, color: 'var(--ink)' }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: it.color }} />
            {it.label}
          </span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
        </React.Fragment>
      ))}
    </div>
  );

  const stateKey = (state?.key || 'KYLMA').toLowerCase();

  return (
    <div
      className="sticky top-0 z-50 overflow-hidden border-b"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        height: 30,
      }}
      data-testid="live-ticker"
    >
      <div className={`ticker-track ticker-rhythm-${stateKey}`}>
        {renderRow('a')}
        {renderRow('b')}
      </div>
    </div>
  );
};

export default LiveTicker;
