import React from 'react';
import { useLang } from '../context/LanguageContext';
import { STREAMERS, MOMENTS, CURRENT_DIAL } from '../data/mock';

// Sticky narrow bar above header — rotating instrument readings.
// Continuous CSS marquee, mono micro-type, dial-state-color accent.

export const LiveTicker = () => {
  const { t, lang } = useLang();
  const live = STREAMERS.filter((s) => s.live);
  const totalViewers = live.reduce((a, s) => a + s.viewers, 0);
  const topMoment = MOMENTS[0];

  const items = [
    { color: '#C8423C', label: `${t('common.live_label')} ${live.length}` },
    { color: 'var(--ink)', label: `${t('common.viewers_label')} ${totalViewers.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ')}` },
    { color: CURRENT_DIAL.color, label: `MITTARI ${CURRENT_DIAL.label}` },
    { color: '#E8924A', label: `${topMoment.streamer.toUpperCase()} ${topMoment.win}` },
    { color: 'var(--brand-blue)', label: 'F1 MONZA · SUNDAY 16:00' },
    { color: 'var(--ink)', label: lang === 'en' ? 'NEXT PAYDAY · FRI 30' : 'PALKKAPÄIVÄ · PE 30' },
    { color: 'var(--muted)', label: 'PACT KICK 5.6K' },
    { color: 'var(--muted)', label: 'JARTTU84 SWEET BONANZA' },
  ];

  // Render twice for seamless loop
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
      <div
        className={`ticker-track ticker-rhythm-${CURRENT_DIAL.key.toLowerCase()}`}
      >
        {renderRow('a')}
        {renderRow('b')}
      </div>
    </div>
  );
};

export default LiveTicker;
