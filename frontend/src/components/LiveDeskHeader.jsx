/**
 * LiveDeskHeader - wire-service style header for /uutiset.
 *
 * Surfaces the editorial heartbeat (24h total, severity breakdown, sources,
 * last-updated). Sits at the top of the news index above the cards.
 */
import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTimeAgo } from '../hooks/useTimeAgo';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SeverityChip = ({ count, tone, color, label }) => {
  if (!count) return null;
  return (
    <span className="mono inline-flex items-baseline gap-1.5" data-testid={`live-desk-sev-${tone}`}
          style={{ fontSize: 11.5, letterSpacing: '0.18em', fontWeight: 700, color }}>
      <strong style={{ fontSize: 13, fontWeight: 800 }}>{count}</strong>
      {label.toUpperCase()}
    </span>
  );
};

const LiveDeskHeader = () => {
  const { lang, t } = useLang();
  const [stats, setStats] = useState(null);
  const lastUpdate = useTimeAgo(stats?.last_updated, lang, t);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/content/stats`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancelled && d) setStats(d); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!stats) return null;
  const sev = stats.by_severity || {};

  return (
    <div className="panel mb-8" style={{ background: 'var(--bg)' }} data-testid="live-desk-header">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block" style={{ width: 8, height: 8, borderRadius: 999, background: '#C8423C', boxShadow: '0 0 8px #C8423C', animation: 'pulse 2s infinite' }} />
          <h2 className="mono inline-flex items-center gap-2"
              style={{ fontSize: 12, letterSpacing: '0.28em', fontWeight: 800, color: 'var(--ink)' }}>
            <Radio strokeWidth={1.9} size={13} />
            {t('live_desk.title').toUpperCase()}
            <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {t('live_desk.updated_continuously').toUpperCase()}</span>
          </h2>
        </div>
        <div className="display mb-3" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}
             data-testid="live-desk-total">
          {stats.total_24h} <span className="font-serif" style={{ fontSize: 18, fontWeight: 500, color: 'var(--muted)' }}>{t('live_desk.stories_24h')}</span>
        </div>
        <div className="flex items-baseline gap-5 flex-wrap pb-3 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <SeverityChip count={sev.scorching} tone="scorching" color="#C8423C" label={t('severity.scorching')} />
          <SeverityChip count={sev.hot}       tone="hot"       color="#E8924A" label={t('severity.hot')} />
          <SeverityChip count={sev.warm}      tone="warm"      color="#B58A37" label={t('severity.warm')} />
          <SeverityChip count={sev.cool}      tone="cool"      color="#7A7E83" label={t('severity.cool')} />
        </div>
        <div className="mono inline-flex items-center gap-2 flex-wrap"
             style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          <span><strong style={{ color: 'var(--ink)' }}>{stats.total_sources}</strong> {t('live_desk.total_sources').toUpperCase()}</span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span>{t('live_desk.last_update').toUpperCase()} {lastUpdate.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};

export default LiveDeskHeader;
