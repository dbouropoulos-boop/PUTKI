/**
 * Back-office · Leads lifecycle dashboard.
 *
 * Single read-only page that answers "who came in, where from, what
 * happened next" - joining signups, optin_consents, voita_entries,
 * mestari_diagnostic_leads, email_outbox and telegram_bindings into one
 * timeline view.
 *
 * Read-only by design - every other back-office page is the mutation
 * surface for its underlying collection.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fmt = (iso) => {
  if (!iso) return '-';
  try { return new Date(iso).toISOString().replace('T', ' ').slice(0, 16); }
  catch { return iso.slice(0, 16); }
};

const Pill = ({ label, value, color = '#5B8DEE', testid }) => (
  <div data-testid={testid} style={{
    flex: '1 1 140px', padding: '14px 16px', background: 'var(--surface)',
    border: '1px solid var(--border)',
  }}>
    <div style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
    }}>{label}</div>
    <div style={{
      fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700,
      color, marginTop: 4, letterSpacing: '-0.02em',
    }}>{value}</div>
  </div>
);

// ── 24h funnel sparkline ─────────────────────────────────────────────
// Each stage renders as a column: count + horizontal sparkline of the
// per-hour buckets. Stages laid out left→right in funnel order so the
// drop-off between consecutive bars is visually immediate.
const STAGE_PALETTE = {
  blue: '#5B8DEE',
  amber: '#E89248',
  green: '#6FA37D',
  violet: '#9C5DEE',
};

const Spark = ({ data, color }) => {
  const max = Math.max(1, ...(data || []));
  const w = 120;
  const h = 28;
  const bw = w / Math.max(1, data.length);
  return (
    <svg width={w} height={h} role="img" aria-hidden style={{ display: 'block' }}>
      {(data || []).map((v, i) => {
        const bh = Math.max(1, Math.round((v / max) * (h - 2)));
        return (
          <rect key={`bar-${i}-${v}`} x={i * bw + 0.5} y={h - bh}
            width={Math.max(1, bw - 1)} height={bh}
            fill={v > 0 ? color : 'currentColor'} opacity={v > 0 ? 0.95 : 0.18} />
        );
      })}
    </svg>
  );
};

const FunnelStrip = ({ funnel }) => {
  if (!funnel) return null;
  const order = funnel.order || [];
  const stages = funnel.stages || {};
  return (
    <section data-testid="bo-leads-funnel" style={{
      marginBottom: 22, padding: '16px 18px',
      background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12,
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
      }}>
        <strong style={{ color: 'var(--ink)' }}>LAST 24H FUNNEL</strong>
        <span>· {funnel.buckets}-HOUR BUCKETS</span>
        <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
          {funnel.since?.slice(11, 16)} → {funnel.until?.slice(11, 16)} UTC
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))`,
        gap: 14, alignItems: 'end',
      }}>
        {order.map((stage, i) => {
          const s = stages[stage] || { count: 0, spark: [], color: 'blue' };
          const color = STAGE_PALETTE[s.color] || '#5B8DEE';
          return (
            <div key={stage} data-testid={`bo-leads-funnel-${stage}`} style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              color: 'var(--muted)',
            }}>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                letterSpacing: '0.18em', fontWeight: 700, color: 'var(--muted)',
              }}>{`${i + 1}. ${stage.toUpperCase()}`}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700,
                color, lineHeight: 1, letterSpacing: '-0.02em',
              }}>{s.count}</div>
              <Spark data={s.spark} color={color} />
            </div>
          );
        })}
      </div>
      <p style={{
        margin: '12px 0 0', color: 'var(--muted)',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.04em', lineHeight: 1.55,
      }}>
        SIGNUPS = distinct emails captured · QUEUED/SENT = email outbox events · OPENED/CLICKED = tracking pixel ·
        RETURNED = email recipient who created a new voita/mestari lead AFTER receiving an email.
      </p>
    </section>
  );
};

const Chip = ({ children, color = 'var(--muted)' }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px',
    border: `1px solid ${color}`, color, marginRight: 4,
    fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
    letterSpacing: '0.10em', fontWeight: 700,
    textTransform: 'uppercase',
  }}>{children}</span>
);

const BackOfficeLeads = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const headers = useMemo(() => ({ 'X-Admin-Token': token }), [token]);
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [filter, setFilter] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState('all');

  useEffect(() => {
    if (!authed) return;
    fetch(`${BACKEND}/api/admin/leads/timeline?limit=500`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch((e) => console.warn('[leads]', e));
    fetch(`${BACKEND}/api/admin/leads/funnel?hours=24`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then(setFunnel)
      .catch((e) => console.warn('[funnel]', e));
  }, [authed, headers]);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    const q = filter.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (q && !(r.email || '').toLowerCase().includes(q)
          && !(r.name || '').toLowerCase().includes(q)
          && !(r.identity_key || '').toLowerCase().includes(q)) return false;
      if (surfaceFilter !== 'all' && !r.surfaces.includes(surfaceFilter)) return false;
      return true;
    });
  }, [data, filter, surfaceFilter]);

  const surfaces = useMemo(() => {
    const s = new Set();
    (data?.rows || []).forEach((r) => r.surfaces.forEach((x) => s.add(x)));
    return ['all', ...Array.from(s).sort()];
  }, [data]);

  if (!authed) {
    return <AuthGate authError={authError} setToken={setToken} onSubmit={checkAuth} />;
  }

  const sum = data?.summary;

  return (
    <div data-testid="bo-leads-page" style={{
      background: 'var(--bg)', minHeight: '100vh', color: 'var(--ink)',
      padding: '24px 24px 56px',
    }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 22, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Link to="/back-office" data-testid="bo-leads-back" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.18em', color: 'var(--muted)', textDecoration: 'none',
          }}>← BACK-OFFICE</Link>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700,
            margin: '6px 0 4px', letterSpacing: '-0.02em',
          }}>Leads - who came in, what happened next</h1>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
            Joined view across signups · opt-ins · voita · mestari · email outbox · telegram. Read-only.
          </p>
        </div>
      </header>

      {!data ? (
        <div style={{ color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <>
          {/* 24h funnel */}
          <FunnelStrip funnel={funnel} />

          {/* Summary band */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
            <Pill testid="bo-leads-total" label="UNIQUE LEADS" value={sum.rows_total} />
            <Pill testid="bo-leads-email" label="EMAIL" value={sum.by_channel.email} />
            <Pill testid="bo-leads-telegram" label="TELEGRAM" value={sum.by_channel.telegram} color="#9C5DEE" />
            <Pill testid="bo-leads-both" label="BOTH CHANNELS" value={sum.by_channel.both} color="#6FA37D" />
            <Pill testid="bo-leads-queued" label="EMAILS QUEUED" value={sum.email_outbox.queued} color="#E89248" />
            <Pill testid="bo-leads-sent" label="EMAILS SENT" value={sum.email_outbox.sent} color="#6FA37D" />
            <Pill testid="bo-leads-opens" label="OPENS" value={sum.email_outbox.opens_total} color="#6FA37D" />
            <Pill testid="bo-leads-clicks" label="CLICKS" value={sum.email_outbox.clicks_total} color="#6FA37D" />
          </div>

          {/* Surface mix */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            padding: '12px 14px', background: 'var(--surface)',
            border: '1px solid var(--border)', marginBottom: 22,
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
          }}>
            <span style={{ color: 'var(--muted)', letterSpacing: '0.18em' }}>SURFACES:</span>
            {Object.entries(sum.by_surface)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <span key={s} data-testid={`bo-leads-surface-${s}`} style={{
                  color: 'var(--ink)',
                }}>
                  <strong>{s}</strong> <span style={{ color: 'var(--muted)' }}>{n}</span>
                </span>
              ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input type="text" placeholder="Filter by email / name…"
              data-testid="bo-leads-filter-input"
              value={filter} onChange={(e) => setFilter(e.target.value)}
              style={{
                flex: '1 1 220px', padding: '10px 12px',
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--ink)', fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
              }} />
            <select value={surfaceFilter} onChange={(e) => setSurfaceFilter(e.target.value)}
              data-testid="bo-leads-filter-surface"
              style={{
                padding: '10px 12px', background: 'var(--bg)',
                border: '1px solid var(--border)', color: 'var(--ink)',
                fontFamily: 'ui-monospace, monospace', fontSize: 12,
              }}>
              {surfaces.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All surfaces' : s}</option>
              ))}
            </select>
          </div>

          {/* Rows */}
          <div data-testid="bo-leads-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{
              display: 'grid', gap: 8,
              gridTemplateColumns: '220px 1.1fr 1.4fr 0.7fr 0.7fr 110px',
              padding: '10px 14px', borderBottom: '1px solid var(--border)',
              fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
              letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
            }}>
              <span>IDENTITY</span><span>NAME · CHANNELS</span>
              <span>SURFACES</span><span>EMAILS</span><span>OPEN/CLICK</span><span>LAST SEEN</span>
            </div>
            {rows.length === 0 && (
              <div style={{ padding: 18, color: 'var(--muted)' }}>No rows match.</div>
            )}
            {rows.map((r) => (
              <div key={r.identity_key} data-testid={`bo-leads-row-${r.identity_key}`} style={{
                display: 'grid', gap: 8,
                gridTemplateColumns: '220px 1.1fr 1.4fr 0.7fr 0.7fr 110px',
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                color: 'var(--ink)',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.identity_key}</span>
                <span>
                  {r.name && <span style={{ color: 'var(--muted)' }}>{r.name} </span>}
                  {r.channels.map((c) => (
                    <Chip key={c} color={c === 'telegram' ? '#9C5DEE' : '#5B8DEE'}>{c}</Chip>
                  ))}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.surfaces.map((s) => (
                    <Chip key={s} color="var(--muted)">{s}</Chip>
                  ))}
                </span>
                <span>
                  <span style={{ color: '#E89248' }}>{r.email_metrics.queued}q</span>{' '}
                  <span style={{ color: '#6FA37D' }}>{r.email_metrics.sent}s</span>{' '}
                  <span style={{ color: '#C13B2C' }}>{r.email_metrics.failed}f</span>
                </span>
                <span>
                  <span style={{ color: r.email_metrics.opened_total > 0 ? '#6FA37D' : 'var(--muted)' }}>
                    {r.email_metrics.opened_total}o
                  </span>{' '}
                  <span style={{ color: r.email_metrics.clicked_total > 0 ? '#6FA37D' : 'var(--muted)' }}>
                    {r.email_metrics.clicked_total}c
                  </span>
                </span>
                <span style={{ color: 'var(--muted)' }}>{fmt(r.last_seen)}</span>
              </div>
            ))}
          </div>

          <p style={{
            color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
            fontSize: 10.5, letterSpacing: '0.08em', margin: '14px 0 0',
          }}>
            Showing {rows.length} of {sum.rows_total}. Email counters: q=queued · s=sent · f=failed · o=opens · c=clicks.
            Emails dispatch the moment `RESEND_API_KEY` lands; placeholder content remains gated via `PLAYBOOK_EMAIL_DISPATCH_READY`.
          </p>
        </>
      )}
    </div>
  );
};

export default BackOfficeLeads;
