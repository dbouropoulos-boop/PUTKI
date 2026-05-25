/**
 * LiveDataTicker - horizontal strip at the very top of the homepage that
 * proves PUTKI HQ is monitoring real-time data. Pulls /api/data/live-stats
 * every 10s. Honest counters: zeros render zeros, never fabricated.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 10_000;

const fmtAgo = (iso, t) => {
  if (!iso) return '-';
  try {
    const dt = new Date(iso);
    const secs = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
    if (secs < 60) return t('uutiset.ago_s').replace('{n}', secs);
    if (secs < 3600) return t('uutiset.ago_m').replace('{n}', Math.floor(secs / 60));
    return t('uutiset.ago_h').replace('{n}', Math.floor(secs / 3600));
  } catch { return '-'; }
};

const Cell = ({ label, value }) => (
  <div className="mono inline-flex items-center gap-2" style={{ flexShrink: 0 }}>
    <span style={{ opacity: 0.55 }}>→</span>
    <span style={{ color: 'var(--muted)', opacity: 0.85 }}>{label}:</span>
    <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{value}</span>
  </div>
);

const LiveDataTicker = () => {
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  const [tickerNow, setTickerNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/data/live-stats`);
      if (!r.ok) return;
      const d = await r.json();
      setStats(d);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const t = setInterval(() => setTickerNow(Date.now()), 1000);
    return () => { clearInterval(id); clearInterval(t); };
  }, [load]);

  void tickerNow;
  const s = stats || {};

  return (
    <div
      data-testid="live-data-ticker"
      className="border-b"
      style={{
        background: '#0A0A0A',
        borderColor: 'rgba(255,255,255,0.08)',
        color: '#F5F3EE',
        padding: '8px 0',
        fontSize: 10.5,
        letterSpacing: '0.18em',
        fontWeight: 600,
      }}
    >
      <div className="container-wide flex items-center gap-5 overflow-x-auto"
           style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <div className="mono inline-flex items-center gap-2"
             style={{ flexShrink: 0, opacity: 0.85 }}>
          <span
            style={{
              width: 6, height: 6, borderRadius: 999, background: '#2c7a4b',
              boxShadow: '0 0 8px #2c7a4b',
              animation: 'pulse 1.8s ease-in-out infinite',
            }}
          />
          {t('ticker.live_data_stream').toUpperCase()}
        </div>
        <Cell label={t('ticker.twitch').toUpperCase()} value={`${s.twitch_live ?? 0} ${t('ticker.live').toUpperCase()}`} />
        <Cell label={t('ticker.urheilu').toUpperCase()} value={s.f1_race_active ? `${s.football_matches ?? 0} + F1` : `${s.football_matches ?? 0}`} />
        <Cell label={t('ticker.news_today').toUpperCase()} value={s.news_articles_today ?? 0} />
        <Cell label={t('ticker.articles').toUpperCase()} value={s.articles_published_today ?? 0} />
        <Cell label={t('ticker.updated').toUpperCase()} value={fmtAgo(s.latest_update_at, t)} />
      </div>
    </div>
  );
};

export default LiveDataTicker;
