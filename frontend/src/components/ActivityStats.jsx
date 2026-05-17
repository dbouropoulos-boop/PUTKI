/**
 * ActivityStats — Phase 4 homepage credibility panel.
 *
 * Pulls /api/content/stats every 30 s. Renders article counts (today / this
 * week) + the time-since-last-publish so the homepage telegraphs "this is a
 * live publication, not a static page". Premium trading-dashboard surface
 * tuned to sit next to the dial in the hero grid.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 30_000;

const fmtAgo = (iso) => {
  if (!iso) return '—';
  try {
    const t = new Date(iso);
    const secs = Math.max(0, Math.floor((Date.now() - t.getTime()) / 1000));
    if (secs < 60) return `${secs}s sitten`;
    if (secs < 3600) return `${Math.floor(secs / 60)}min sitten`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h sitten`;
    return `${Math.floor(secs / 86400)}d sitten`;
  } catch { return '—'; }
};

const ActivityStats = () => {
  const [data, setData] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/content/stats`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancelled && d) setData(d); })
        .catch(() => {});
    };
    load();
    const pollId = setInterval(load, POLL_MS);
    const tickId = setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelled = true; clearInterval(pollId); clearInterval(tickId); };
  }, []);

  // useNow simply re-renders the "X sec ago" line every second
  void now;

  return (
    <div
      data-testid="activity-stats"
      className="w-full"
      style={{
        background: 'rgba(44, 95, 141, 0.05)',
        border: '1px solid rgba(44, 95, 141, 0.22)',
        padding: '22px 24px',
        borderRadius: 2,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--ink)', fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#2c7a4b', boxShadow: '0 0 6px #2c7a4b' }} />
          PUTKI HQ · LIVE
        </div>
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', opacity: 0.7 }}>
          JULKAISTU SISÄLTÖ
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div data-testid="activity-stat-today">
          <div className="mono mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            TÄNÄÄN
          </div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
            {data?.articles_today ?? '—'}
          </div>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>
            ARTIKKELIA
          </div>
        </div>
        <div data-testid="activity-stat-week">
          <div className="mono mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            VIIKKO
          </div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
            {data?.articles_this_week ?? '—'}
          </div>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--muted)', opacity: 0.7, marginTop: 4 }}>
            VIIM. 7 PV
          </div>
        </div>
      </div>

      <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.5 }}
           data-testid="activity-last-update">
        VIIMEISIN PÄIVITYS · {data?.last_published_at ? fmtAgo(data.last_published_at) : 'EI VIELÄ JULKAISUJA'}
      </div>
      {data?.last_url_slug ? (
        <Link
          to={`/uutiset/${data.last_url_slug}`}
          data-testid="activity-last-headline"
          className="block mt-2 font-serif"
          style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--ink)', textDecoration: 'none' }}
        >
          {data.last_headline}{' '}
          <ArrowUpRight size={12} strokeWidth={1.7} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </Link>
      ) : null}
    </div>
  );
};

export default ActivityStats;
