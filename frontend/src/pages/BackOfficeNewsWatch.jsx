/**
 * BackOfficeNewsWatch - iter51 editorial veto board.
 *
 * Pulls items from /api/admin/news-watch/feed?coll={archive|ticker}
 * and lets the editor promote, demote, or permanently kill each one.
 * Killed URLs are stored in news_rejected_urls and skipped on every
 * subsequent RSS tick (so the classifier won't auto-resurface them).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const COLL_OPTIONS = [
  { key: 'archive', label: 'Archive (promotable)',  accent: '#D4A23B' },
  { key: 'ticker',  label: 'Live ticker',           accent: '#C13B2C' },
  { key: 'rejected',label: 'Killed (never surface)',accent: '#5A5A5A' },
];

const SOURCE_OPTIONS = [
  '', 'Yle Uutiset', 'Helsingin Sanomat', 'Iltalehti', 'Ilta-Sanomat',
  'MTV Uutiset', 'Kauppalehti', 'IS Urheilu', 'Yle Urheilu',
];

const CATEGORY_OPTIONS = [
  '', 'regulation', 'gambling', 'sports', 'scene', 'news',
];

const BackOfficeNewsWatch = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [coll, setColl] = useState('archive');
  const [items, setItems] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('');
  const [minRelevance, setMinRelevance] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyUrl, setBusyUrl] = useState(null);
  const [toast, setToast] = useState('');

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token }),
    [token]
  );

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/news-watch/stats`, { headers });
      if (r.ok) setStatsData(await r.json());
    } catch { /* noop */ }
  }, [headers]);

  const fetchFeed = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url;
      if (coll === 'rejected') {
        url = `${BACKEND}/api/admin/news-watch/rejected?limit=100`;
      } else {
        const qs = new URLSearchParams({ coll, limit: '50' });
        if (source) qs.set('source', source);
        if (category) qs.set('category', category);
        if (minRelevance) qs.set('min_relevance', String(minRelevance));
        url = `${BACKEND}/api/admin/news-watch/feed?${qs.toString()}`;
      }
      const r = await fetch(url, { headers });
      if (!r.ok) { setItems([]); return; }
      const j = await r.json();
      setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }, [token, headers, coll, source, category, minRelevance]);

  useEffect(() => { if (authed) { fetchStats(); fetchFeed(); } }, [authed, fetchStats, fetchFeed]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const act = async (url, action, body = {}) => {
    setBusyUrl(`${action}-${url}`);
    try {
      const r = await fetch(`${BACKEND}/api/admin/news-watch/${action}`, {
        method: 'POST', headers,
        body: JSON.stringify({ url, ...body }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        showToast(`✗ ${action}: ${j.detail || r.status}`);
        return;
      }
      showToast(`✓ ${action} ok`);
      // Optimistic remove from current list
      setItems((cur) => cur.filter((it) => (it.url || '') !== url));
      // Refresh stats async
      fetchStats();
    } finally {
      setBusyUrl(null);
    }
  };

  if (!authed) {
    return <AuthGate token={token} setToken={setToken} authError={authError} onSubmit={checkAuth} title="News-watch" />;
  }

  return (
    <div data-testid="back-office-news-watch" style={{
      maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px',
      color: 'var(--ink)', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Link to="/back-office" data-testid="news-watch-back" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', color: 'var(--muted)',
            textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700,
          }}>← BACK-OFFICE</Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, margin: '12px 0 4px' }}>
            News-watch
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0, maxWidth: 640 }}>
            Editorial veto over the deterministic classifier. Promote items that should surface, demote items that shouldn't,
            or permanently kill a URL so the RSS poller won't re-ingest it on the next tick.
          </p>
        </div>
        {statsData && <NewsWatchStats data={statsData} />}
      </div>

      {/* Tab strip */}
      <div style={{ marginTop: 28, display: 'flex', gap: 8, flexWrap: 'wrap' }} data-testid="news-watch-tabs">
        {COLL_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setColl(opt.key)}
            data-testid={`news-watch-tab-${opt.key}`}
            style={{
              padding: '10px 16px',
              border: '1px solid var(--border)',
              borderBottom: coll === opt.key ? `3px solid ${opt.accent}` : '1px solid var(--border)',
              background: coll === opt.key ? 'var(--surface)' : 'transparent',
              color: coll === opt.key ? 'var(--ink)' : 'var(--muted)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11, letterSpacing: '0.18em', fontWeight: 700,
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filters - only meaningful for ticker/archive */}
      {coll !== 'rejected' && (
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }} data-testid="news-watch-filters">
          <select value={source} onChange={(e) => setSource(e.target.value)}
            data-testid="news-watch-filter-source" style={selectStyle}>
            {SOURCE_OPTIONS.map((s) => <option key={s || 'all'} value={s}>{s || 'All sources'}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            data-testid="news-watch-filter-category" style={selectStyle}>
            {CATEGORY_OPTIONS.map((c) => <option key={c || 'all'} value={c}>{c || 'All categories'}</option>)}
          </select>
          <input type="number" placeholder="Min relevance (0-100)"
            value={minRelevance} onChange={(e) => setMinRelevance(e.target.value)}
            data-testid="news-watch-filter-min-relevance" style={{ ...selectStyle, width: 180 }} />
          <button type="button" onClick={fetchFeed} data-testid="news-watch-refresh"
            style={{ ...selectStyle, cursor: 'pointer', fontWeight: 700, color: 'var(--ink)' }}>
            REFRESH →
          </button>
        </div>
      )}

      {/* List */}
      <div style={{ marginTop: 20 }} data-testid="news-watch-list">
        {loading && (
          <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            Loading…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 12, textAlign: 'center' }} data-testid="news-watch-empty">
            No items in this view.
          </div>
        )}
        {!loading && items.map((it) => (
          coll === 'rejected'
            ? <RejectedRow key={it.url} item={it} busyUrl={busyUrl} onUnkill={(u) => act(u, 'unkill')} />
            : <NewsRow
                key={it.url}
                item={it}
                coll={coll}
                busyUrl={busyUrl}
                onPromote={(u) => act(u, 'promote')}
                onDemote={(u) => act(u, 'demote')}
                onKill={(u) => act(u, 'kill')}
              />
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div data-testid="news-watch-toast" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0B0A09', color: '#F5F2EA', padding: '12px 20px',
          border: '1px solid var(--border-strong)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.18em', fontWeight: 700,
        }}>{toast}</div>
      )}
    </div>
  );
};

const selectStyle = {
  padding: '8px 12px',
  background: 'var(--bg)',
  color: 'var(--ink)',
  border: '1px solid var(--border-strong)',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11,
  letterSpacing: '0.12em',
  fontWeight: 600,
  textTransform: 'uppercase',
};

const NewsWatchStats = ({ data }) => (
  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }} data-testid="news-watch-stats">
    {[
      { label: 'TICKER LIVE',  value: data.ticker_total,  sub: `+${data.ticker_24h} · 24h` },
      { label: 'ARCHIVE',      value: data.archive_total, sub: `+${data.archive_24h} · 24h` },
      { label: 'KILLED',       value: data.rejected_total, sub: 'permanent' },
    ].map((s) => (
      <div key={s.label} style={{
        border: '1px solid var(--border)',
        padding: '8px 14px',
        minWidth: 120,
      }} data-testid={`news-watch-stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {s.label}
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, marginTop: 2 }}>
          {s.value}
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)' }}>
          {s.sub}
        </div>
      </div>
    ))}
  </div>
);

const NewsRow = ({ item, coll, busyUrl, onPromote, onDemote, onKill }) => {
  const rel = item.relevance ?? 0;
  const sev = item.severity || 'low';
  const sevColor = sev === 'high' ? '#C13B2C' : sev === 'medium' ? '#D4A23B' : '#5A5A5A';

  const isBusy = (action) => busyUrl === `${action}-${item.url}`;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 14,
      padding: '14px 16px',
      borderBottom: '1px solid var(--border)',
    }} data-testid={`news-watch-row-${encodeURIComponent(item.url)}`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 10.5, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
          <span>{item.source}</span>
          <span style={{ color: sevColor }}>● {sev}</span>
          <span>rel <span style={{ color: rel >= 45 ? '#5B8DEE' : 'var(--ink)' }}>{rel}</span></span>
          <span>{item.category || 'news'}</span>
          {(item.entity_tags || []).slice(0, 3).map((t) => (
            <span key={t} style={{
              padding: '2px 6px', background: 'var(--surface)',
              border: '1px solid var(--border)', fontSize: 9.5,
            }}>{t}</span>
          ))}
          {item.verified && <span style={{ color: '#6FA37D' }}>✓ verified</span>}
          {item.captured_at && <span style={{ color: 'var(--muted)' }}>{new Date(item.captured_at).toLocaleString()}</span>}
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
          display: 'block', marginTop: 6,
          fontFamily: 'Georgia, serif', fontSize: 15.5, lineHeight: 1.35,
          color: 'var(--ink)', textDecoration: 'none',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }} data-testid={`news-watch-row-title-link`}>
          {item.title || '(untitled)'}
        </a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', minWidth: 130 }}>
        {coll === 'archive' && (
          <button type="button" disabled={isBusy('promote')}
            onClick={() => onPromote(item.url)}
            data-testid={`news-watch-promote-btn`}
            style={btnPrimary}>
            {isBusy('promote') ? '…' : '↑ PROMOTE'}
          </button>
        )}
        {coll === 'ticker' && (
          <button type="button" disabled={isBusy('demote')}
            onClick={() => onDemote(item.url)}
            data-testid={`news-watch-demote-btn`}
            style={btnSecondary}>
            {isBusy('demote') ? '…' : '↓ DEMOTE'}
          </button>
        )}
        <button type="button" disabled={isBusy('kill')}
          onClick={() => {
            if (window.confirm('Permanently kill this URL? RSS tick will skip it forever.')) {
              onKill(item.url);
            }
          }}
          data-testid={`news-watch-kill-btn`}
          style={btnDanger}>
          {isBusy('kill') ? '…' : '✗ KILL'}
        </button>
      </div>
    </div>
  );
};

const RejectedRow = ({ item, busyUrl, onUnkill }) => {
  const isBusy = busyUrl === `unkill-${item.url}`;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 14,
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
    }} data-testid={`news-watch-rejected-row`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 700 }}>
          REJECTED · {item.rejected_at ? new Date(item.rejected_at).toLocaleString() : '-'}
          {item.reason ? ` · ${item.reason}` : ''}
        </div>
        <div style={{ marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--muted)', wordBreak: 'break-all' }}>
          {item.url}
        </div>
      </div>
      <button type="button" disabled={isBusy} onClick={() => onUnkill(item.url)}
        data-testid="news-watch-unkill-btn" style={btnSecondary}>
        {isBusy ? '…' : '↺ UNKILL'}
      </button>
    </div>
  );
};

const btnBase = {
  padding: '8px 12px',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 10.5, letterSpacing: '0.18em',
  fontWeight: 800, textTransform: 'uppercase',
  cursor: 'pointer', border: 0,
};
const btnPrimary   = { ...btnBase, background: '#5B8DEE', color: '#0B0A09' };
const btnSecondary = { ...btnBase, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border-strong)' };
const btnDanger    = { ...btnBase, background: 'transparent', color: '#C13B2C', border: '1px solid #C13B2C' };

export default BackOfficeNewsWatch;
