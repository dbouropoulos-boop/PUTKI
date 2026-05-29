/**
 * Back-office · Bot & Routing (iter76, Slice 1).
 *
 * Implements Doc 2 §C.3. Three panels:
 *   1. Bot config toggles (signal_unlock_mode, daily_dm_enabled, etc.)
 *   2. Partners table CRUD (affiliate routing - dormant at launch)
 *   3. Subscriber summary (read-only health-check of the funnel)
 *
 * Auth: same X-Admin-Token pattern used by other back-office pages.
 * Keeps the existing back-office visual language (Georgia headlines,
 * monospace meta, dark canvas) so it doesn't read like a different app.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
// iter82 (Task 2.3): legacy `putki_back_office_token` localStorage key
// removed. Token now flows in exclusively via the shell's outlet context.

const Field = ({ label, hint, children, testid }) => (
  <div data-testid={testid} style={{
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: '10px 0', borderBottom: '1px dashed var(--border, #2a2722)',
  }}>
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.18em', fontWeight: 700, color: 'var(--muted, #9C8B6B)',
    }}>{label}</span>
    {children}
    {hint && (
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
        color: 'var(--muted, #9C8B6B)', lineHeight: 1.5,
      }}>{hint}</span>
    )}
  </div>
);

const Toggle = ({ on, onChange, testid, disabled }) => (
  <button type="button" disabled={disabled}
    onClick={() => !disabled && onChange(!on)}
    data-testid={testid}
    style={{
      width: 50, height: 26, padding: 0, border: 0, borderRadius: 999,
      background: on ? '#6FA37D' : '#3a3028',
      position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 180ms ease',
      opacity: disabled ? 0.5 : 1,
    }}>
    <span style={{
      position: 'absolute', top: 3, left: on ? 27 : 3,
      width: 20, height: 20, borderRadius: '50%',
      background: '#0B0A09', transition: 'left 180ms ease',
    }} />
  </button>
);

const Cell = ({ label, value, testid }) => (
  <div data-testid={testid} style={{
    padding: '12px 14px', flex: '1 1 0', minWidth: 0,
    borderRight: '1px solid var(--border, #2a2722)',
    display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.22em', fontWeight: 700, color: 'var(--muted, #9C8B6B)',
    }}>{label}</span>
    <span style={{
      fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
      color: 'var(--ink, #F2EBE0)', letterSpacing: '-0.01em',
    }}>{value}</span>
  </div>
);

const PartnerRow = ({ p, onUpdate, onDelete, busy }) => {
  const togglePause = () => onUpdate({ ...p, status: p.status === 'live' ? 'paused' : 'live' });
  const statusColor = p.status === 'live' ? '#6FA37D' : '#9C8B6B';
  return (
    <tr data-testid={`bot-partner-row-${p.partner_key}`} style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{p.partner_key}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'Georgia, serif', fontSize: 13 }}>{p.display_name}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
        {(p.target_geos || []).join(', ') || '—'}
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{p.priority_weight || 0}</td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{
          padding: '2px 8px', border: `1px solid ${statusColor}`, color: statusColor,
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5, fontWeight: 700,
          letterSpacing: '0.18em',
        }}>{(p.status || 'paused').toUpperCase()}</span>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
        <button onClick={togglePause} disabled={busy}
          data-testid={`bot-partner-toggle-${p.partner_key}`}
          style={{
            padding: '4px 10px', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.12em', cursor: 'pointer', marginRight: 6,
          }}>{p.status === 'live' ? 'PAUSE' : 'LIVE'}</button>
        <button onClick={() => window.confirm(`Delete partner ${p.partner_key}?`) && onDelete(p.partner_key)}
          disabled={busy} data-testid={`bot-partner-delete-${p.partner_key}`}
          style={{
            padding: '4px 10px', background: 'transparent',
            border: '1px solid #C8423C', color: '#C8423C',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.12em', cursor: 'pointer',
          }}>DEL</button>
      </td>
    </tr>
  );
};

const BackOfficeBotRouting = () => {
  // When rendered inside the shell, take token + density from the outlet
  // context. Outside the shell (legacy direct visit), fall back to local
  // storage so the page still works on its own.
  const ctx = useOutletContext() || {};
  const inShell = !!ctx.token;
  const [token, setToken] = useState(() => ctx.token || '');
  useEffect(() => { if (ctx.token && ctx.token !== token) setToken(ctx.token); }, [ctx.token, token]);
  const [authed, setAuthed] = useState(inShell);
  const [config, setConfig] = useState(null);
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [newPartner, setNewPartner] = useState({
    partner_key: '', display_name: '', affiliate_base_url: '',
    target_geos: 'FI', priority_weight: 10,
  });
  const [mint, setMint] = useState(null);   // { code, full_url, copied }
  const [funnel, setFunnel] = useState(null);
  const [funnelHours, setFunnelHours] = useState(24);
  const [drillStage, setDrillStage] = useState(null);  // 'signup' | 'bound' | ...
  const [drillData, setDrillData] = useState(null);
  const [subQuery, setSubQuery] = useState('');
  const [subResults, setSubResults] = useState(null);
  const [router, setRouter] = useState(null);          // { clicks, conversions }
  const [routerFilter, setRouterFilter] = useState('all');

  const hdr = useCallback(() => ({ 'X-Admin-Token': token, 'Content-Type': 'application/json' }), [token]);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [c, p, s, fn] = await Promise.all([
        fetch(`${BACKEND}/api/admin/bot/config`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/partners`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/bot/subscribers/summary`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/bot/funnel/snapshot?hours=${funnelHours}`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
      ]);
      if (!c) { setAuthed(false); setErr('auth failed'); return; }
      setConfig(c); setPartners((p && p.items) || []); setSummary(s); setFunnel(fn); setAuthed(true);
    } catch (e) { setErr(String(e?.message || e)); }
  }, [token, hdr, funnelHours]);

  useEffect(() => { if (token) refreshAll(); }, [token, refreshAll]);

  const patchConfig = async (patch) => {
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/bot/config`, {
        method: 'PUT', headers: hdr(), body: JSON.stringify(patch),
      });
      if (r.ok) setConfig(await r.json());
      else setErr(`PUT config failed: ${r.status}`);
    } finally { setBusy(false); }
  };

  const upsertPartner = async (p) => {
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/partners`, {
        method: 'POST', headers: hdr(), body: JSON.stringify(p),
      });
      if (r.ok) await refreshAll();
      else setErr(`upsert partner failed: ${r.status}`);
    } finally { setBusy(false); }
  };

  const deletePartner = async (key) => {
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/admin/partners/${encodeURIComponent(key)}`, { method: 'DELETE', headers: hdr() });
      await refreshAll();
    } finally { setBusy(false); }
  };

  // Open the inline drill-down for a snapshot stage. Toggling the same
  // stage twice closes it - mirrors how shadcn Sheets behave but stays
  // inline so the editor doesn't lose snapshot context.
  const drillIntoStage = async (stage) => {
    if (drillStage === stage) {
      setDrillStage(null); setDrillData(null);
      return;
    }
    setDrillStage(stage); setDrillData(null);
    try {
      const r = await fetch(
        `${BACKEND}/api/admin/bot/funnel/drilldown?stage=${stage}&hours=${funnelHours}&limit=20`,
        { headers: hdr() },
      );
      if (r.ok) setDrillData(await r.json());
      else setErr(`drilldown ${stage}: ${r.status}`);
    } catch (e) { setErr(String(e?.message || e)); }
  };

  // Subscriber quick-search.
  const lookupSubscribers = async (q) => {
    setSubQuery(q);
    const trimmed = (q || '').trim();
    if (!trimmed) { setSubResults(null); return; }
    try {
      const r = await fetch(
        `${BACKEND}/api/admin/subscribers/lookup?q=${encodeURIComponent(trimmed)}&limit=10`,
        { headers: hdr() },
      );
      if (r.ok) setSubResults(await r.json());
    } catch { /* leave previous results visible on transient errors */ }
  };

  // Pull router activity (clicks + conversions). Lazy-loaded so the
  // initial page paint stays fast.
  const refreshRouter = useCallback(async () => {
    if (!token) return;
    try {
      const [c, cv] = await Promise.all([
        fetch(`${BACKEND}/api/admin/router/clicks?limit=20&status=${routerFilter}`,
          { headers: hdr() }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/router/conversions?limit=20`,
          { headers: hdr() }).then((r) => r.ok ? r.json() : null),
      ]);
      setRouter({ clicks: c?.items || [], conversions: cv?.items || [],
                  conv_total: cv?.verified_amount_total ?? 0 });
    } catch { /* keep last-known-good */ }
  }, [token, hdr, routerFilter]);

  useEffect(() => { if (authed) refreshRouter(); }, [authed, refreshRouter]);

  const mintTestLink = async () => {
    setBusy(true); setMint(null); setErr(null);
    try {
      // Pull today's top pick signal_id for traceability; falls back to a
      // marker when /api/odds/featured is empty.
      let signalId = null;
      try {
        const f = await fetch(`${BACKEND}/api/odds/featured`).then((r) => r.json());
        const top = (f?.picks || [])[0];
        signalId = top?.signal_id || top?.event_id || top?.id || null;
      } catch { /* noop - signal_id stays null */ }

      const r = await fetch(`${BACKEND}/api/admin/links/mint`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({
          signal_id: signalId || 'back_office_test',
          campaign: 'back_office_smoke',
          segment: 'all',
        }),
      });
      if (!r.ok) { setErr(`mint failed: ${r.status}`); return; }
      const body = await r.json();
      const fullUrl = `${BACKEND.replace(/\/$/, '')}/api/r/${body.code}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(fullUrl);
        copied = true;
      } catch { /* clipboard may be blocked - we still show the URL */ }
      setMint({ code: body.code, full_url: fullUrl, copied, signal_id: signalId });
    } finally { setBusy(false); }
  };

  if (!authed) {
    // Legacy direct-visit path - shell handles auth when wrapped.
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)', padding: 48 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, margin: '0 0 24px' }}>Bot & Routing</h1>
        <input type="password" placeholder="Admin token" value={token}
          onChange={(e) => setToken(e.target.value)}
          data-testid="bot-routing-token-input"
          style={{ padding: 12, width: 340, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border, #2a2722)', fontFamily: 'ui-monospace, monospace' }} />
        <button onClick={() => { refreshAll(); }}
          data-testid="bot-routing-login" style={{
            marginLeft: 8, padding: '12px 22px', background: '#E8C26E', color: '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
          }}>UNLOCK</button>
        {err && <div style={{ marginTop: 12, color: '#C8423C', fontFamily: 'ui-monospace, monospace' }}>{err}</div>}
      </div>
    );
  }

  const m = config || {};
  const routingLive = m.signal_unlock_mode === 'routed';

  // When wrapped by the shell, render with no outer chrome (shell provides
  // it). When standalone, keep the old container so the page still works.
  const Container = ({ children }) => inShell ? <div data-testid="bot-routing-page">{children}</div> : (
    <div data-testid="bot-routing-page" style={{
      minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)',
      padding: '32px 28px 64px', maxWidth: 1120, margin: '0 auto',
    }}>{children}</div>
  );

  return (
    <Container>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: inShell ? 18 : 28 }}>
        <div>
          {!inShell && (
            <Link to="/back-office" data-testid="bot-routing-back"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted, #9C8B6B)', textDecoration: 'none' }}>← BACK-OFFICE</Link>
          )}
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, letterSpacing: '-0.018em', margin: '8px 0 6px' }}>Bot & Routing</h1>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted, #9C8B6B)', margin: 0, maxWidth: 560 }}>
            Master switches for the Telegram bot + affiliate router. Routing is dormant at launch — flip <em>signal_unlock_mode</em> to <strong>routed</strong> once a partner row is live.
          </p>
          {!inShell && (
            <p style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)' }}>
              <span style={{ marginRight: 6 }}>NEW TO THIS PAGE?</span>
              <Link to="/back-office/runbook"
                data-testid="bot-routing-ops-link"
                style={{ color: '#E8C26E', textDecoration: 'underline', fontWeight: 700 }}>
                READ THE OPERATOR'S RUNBOOK →
              </Link>
            </p>
          )}
        </div>
        <button onClick={refreshAll} disabled={busy} data-testid="bot-routing-refresh"
          style={{ padding: '10px 18px', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', cursor: 'pointer' }}>
          {busy ? '…' : 'REFRESH'}
        </button>
      </div>

      {err && <div style={{ padding: 12, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#FF8A7F', marginBottom: 20, fontFamily: 'ui-monospace, monospace' }}>{err}</div>}

      {/* Subscriber summary */}
      {summary && (
        <div data-testid="bot-routing-summary" style={{ marginBottom: 32, border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap' }}>
          <Cell testid="bot-summary-total" label="TOTAL SUBS" value={summary.total} />
          <Cell testid="bot-summary-active-bound" label="ACTIVE + BOUND" value={summary.active_bound} />
          <Cell testid="bot-summary-consent" label="MARKETING OK" value={summary.consent_marketing} />
          <Cell testid="bot-summary-segments" label="SEGMENTS" value={Object.keys(summary.by_segment || {}).length} />
        </div>
      )}

      {/* Funnel snapshot */}
      {funnel && (
        <section data-testid="bot-routing-funnel" style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: 0 }}>
              Funnel snapshot
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginLeft: 12 }}>
                LAST {funnel.hours}H · END-TO-END {funnel.end_to_end_rate}%
              </span>
            </h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[24, 168, 720].map((h) => (
                <button key={h} onClick={() => setFunnelHours(h)} disabled={busy}
                  data-testid={`bot-funnel-range-${h}`}
                  style={{
                    padding: '6px 10px',
                    background: funnelHours === h ? '#E8C26E' : 'transparent',
                    color: funnelHours === h ? '#0B0A09' : 'var(--ink)',
                    border: '1px solid var(--border)',
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.16em', fontWeight: 700, cursor: 'pointer',
                  }}>{h === 24 ? '24H' : h === 168 ? '7D' : '30D'}</button>
              ))}
              <Link to="/back-office/funnel" data-testid="bot-funnel-history-link"
                style={{
                  marginLeft: 10, padding: '6px 10px', fontFamily: 'ui-monospace, monospace',
                  fontSize: 10, letterSpacing: '0.16em', fontWeight: 700, color: 'var(--ink)',
                  border: '1px solid var(--border)', textDecoration: 'none',
                }}>30D HISTORY →</Link>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
            border: '1px solid var(--border)',
          }}>
            {funnel.stages.map((stage, i) => (
              <button key={stage.key} type="button"
                onClick={() => drillIntoStage(stage.key)}
                data-testid={`bot-funnel-stage-${stage.key}`}
                style={{
                  padding: '14px 12px', borderRight: i < 4 ? '1px solid var(--border)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  background: drillStage === stage.key ? '#1a1610' :
                              (i === funnel.stages.length - 1 ? '#1a1610' : 'transparent'),
                  border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer',
                  borderTop: drillStage === stage.key ? '2px solid #E8C26E' : '2px solid transparent',
                  borderBottom: drillStage === stage.key ? '2px solid #E8C26E' : 'none',
                  transition: 'background 120ms ease',
                }}>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 700 }}>
                  {String(i + 1).padStart(2, '0')} · {stage.label}
                </div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}
                  data-testid={`bot-funnel-stage-${stage.key}-count`}>
                  {stage.count}
                </div>
                {i > 0 && (
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700,
                    color: stage.rate_vs_prev >= 50 ? '#6FA37D' : stage.rate_vs_prev >= 20 ? '#E8C26E' : '#C8423C',
                  }}>
                    {stage.rate_vs_prev}% ←
                  </div>
                )}
                {stage.key === 'dm_sent' && stage.dry_run > 0 && (
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>
                    + {stage.dry_run} DRY-RUN
                  </div>
                )}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--muted)', marginTop: 8, letterSpacing: '0.08em', lineHeight: 1.6 }}>
            % ← shows the step-to-step conversion from the previous stage. Green ≥50%, amber 20-50%, red &lt;20%. <strong>Click any cell</strong> to expand the recent rows behind it.
          </p>

          {/* Drill-down panel */}
          {drillStage && (
            <div data-testid="bot-funnel-drilldown" style={{
              marginTop: 10, border: '1px solid #E8C26E', background: '#13110d',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 800 }}>
                  RECENT · {drillStage.toUpperCase()} · LAST {funnel.hours}H
                </span>
                <button onClick={() => { setDrillStage(null); setDrillData(null); }}
                  data-testid="bot-funnel-drilldown-close"
                  style={{ background: 'transparent', color: 'var(--muted)', border: 0, cursor: 'pointer', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em' }}>
                  CLOSE ✕
                </button>
              </div>
              {!drillData && (
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>Loading…</div>
              )}
              {drillData && drillData.items.length === 0 && (
                <div data-testid="bot-funnel-drilldown-empty" style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)' }}>
                  No rows in the selected window.
                </div>
              )}
              {drillData && drillData.items.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {drillData.items.map((it, idx) => (
                      <tr key={idx} data-testid={`bot-drilldown-row-${idx}`}
                        style={{ borderBottom: idx < drillData.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '6px 0', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {it.label}
                        </td>
                        <td style={{ padding: '6px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                          {it.sub_label}
                        </td>
                        <td style={{ padding: '6px 0', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
                          {(it.ts || '').replace('T', ' ').slice(0, 19)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {/* Subscriber quick-search */}
      <section data-testid="bot-routing-sub-search" style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Subscribers</h2>
        <input
          type="search"
          placeholder="Search by email, pending_id, chat_id, or @username…"
          value={subQuery}
          onChange={(e) => lookupSubscribers(e.target.value)}
          data-testid="bot-routing-sub-search-input"
          style={{
            width: '100%', maxWidth: 560, padding: '10px 12px', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.06em',
          }} />
        {subResults && subResults.count > 0 && (
          <table data-testid="bot-routing-sub-results" style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
            <thead>
              <tr style={{ background: '#13110d' }}>
                {['EMAIL', 'SEGMENT', 'STATUS', 'PENDING_ID', 'CHAT_ID', 'BOUND_AT'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subResults.items.map((s, idx) => (
                <tr key={s.pending_id || idx} data-testid={`bot-routing-sub-row-${idx}`}>
                  <td style={{ padding: '6px 10px', fontFamily: 'Georgia, serif', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{s.email || '—'}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{(s.segment || '?').toUpperCase()}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: s.status === 'active' ? '#6FA37D' : '#E8C26E', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{(s.status || '?').toUpperCase()}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{s.pending_id || '—'}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{s.telegram_chat_id ? `…${String(s.telegram_chat_id).slice(-5)}` : '—'}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{(s.telegram_bound_at || '').slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {subResults && subResults.count === 0 && (
          <div data-testid="bot-routing-sub-empty" style={{ marginTop: 10, fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)' }}>
            No subscribers match <code>{subQuery}</code>.
          </div>
        )}
      </section>

      {/* Router activity (clicks + conversions) */}
      {router && (
        <section data-testid="bot-routing-activity" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: 0 }}>
              Router activity
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 700, marginLeft: 12 }}>
                {router.clicks.length} CLICKS · {router.conversions.length} CONV · €{router.conv_total.toFixed(2)} VERIFIED
              </span>
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'ok', 'no_partner_for_geo', 'informative_mode'].map((f) => (
                <button key={f} onClick={() => setRouterFilter(f)} disabled={busy}
                  data-testid={`bot-router-filter-${f}`}
                  style={{
                    padding: '5px 9px',
                    background: routerFilter === f ? '#E8C26E' : 'transparent',
                    color: routerFilter === f ? '#0B0A09' : 'var(--ink)',
                    border: '1px solid var(--border)',
                    fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                    letterSpacing: '0.14em', fontWeight: 700, cursor: 'pointer',
                  }}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14 }}>
            {/* Clicks */}
            <table data-testid="bot-router-clicks" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
              <thead>
                <tr style={{ background: '#13110d' }}>
                  {['TS', 'GEO', 'CODE', 'STATUS', 'PARTNER'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {router.clicks.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '14px 10px', fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)' }}>No router clicks yet.</td></tr>
                )}
                {router.clicks.map((c, idx) => (
                  <tr key={`${c.code}-${c.ts}-${idx}`}>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{(c.ts || '').slice(11, 19)}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{c.geo || '??'}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>{c.code}</td>
                    <td style={{
                      padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.08em', fontWeight: 700,
                      color: c.status === 'ok' ? '#6FA37D' : c.status === 'no_partner_for_geo' ? '#E8C26E' : '#C8423C',
                      borderBottom: '1px solid var(--border)',
                    }}>{(c.status || '').replace(/_/g, ' ')}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{c.partner_key || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Conversions */}
            <table data-testid="bot-router-conversions" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
              <thead>
                <tr style={{ background: '#13110d' }}>
                  {['TS', 'PARTNER', '€', 'VERIFIED'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {router.conversions.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '14px 10px', fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)' }}>No conversions yet.</td></tr>
                )}
                {router.conversions.map((c, idx) => (
                  <tr key={`${c.partner_key}-${c.ts}-${idx}`}>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{(c.ts || '').slice(11, 19)}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>{c.partner_key}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: c.verified ? '#6FA37D' : 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{(c.amount ?? 0).toFixed(2)} {c.currency}</td>
                    <td style={{ padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: c.verified ? '#6FA37D' : '#C8423C', borderBottom: '1px solid var(--border)' }}>{c.verified ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bot config */}
      <section data-testid="bot-routing-config" style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Bot config</h2>
        <Field testid="bot-cfg-unlock-mode"
          label="SIGNAL UNLOCK MODE"
          hint="informative: tap a locked signal → reveals in-app. routed: tap → affiliate partner. Flipping to 'routed' requires at least one LIVE partner row below.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <button onClick={() => patchConfig({ signal_unlock_mode: 'informative' })}
              data-testid="bot-cfg-mode-informative"
              style={{ padding: '8px 14px', background: !routingLive ? '#E8C26E' : 'transparent', color: !routingLive ? '#0B0A09' : 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer' }}>
              INFORMATIVE
            </button>
            <button onClick={() => patchConfig({ signal_unlock_mode: 'routed' })}
              data-testid="bot-cfg-mode-routed"
              disabled={!partners.some((p) => p.status === 'live')}
              style={{ padding: '8px 14px', background: routingLive ? '#E8C26E' : 'transparent', color: routingLive ? '#0B0A09' : 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer', opacity: partners.some((p) => p.status === 'live') ? 1 : 0.4 }}>
              ROUTED
            </button>
          </div>
        </Field>

        <Field testid="bot-cfg-verified-signup"
          label="REQUIRE VERIFIED SIGNUP"
          hint="When true, /start with no website-issued pending_id is rejected (user is told to sign up at putkihq.fi/signup first). Recommended: true.">
          <Toggle testid="bot-cfg-verified-toggle" on={!!m.require_verified_signup} onChange={(v) => patchConfig({ require_verified_signup: v })} disabled={busy} />
        </Field>

        <Field testid="bot-cfg-daily-dm"
          label="DAILY DM DISPATCH"
          hint="Per-subscriber DM of today's signals (Slice 2 fan-out). Off until Slice 2 ships.">
          <Toggle testid="bot-cfg-daily-dm-toggle" on={!!m.daily_dm_enabled} onChange={(v) => patchConfig({ daily_dm_enabled: v })} disabled={busy} />
        </Field>

        <Field testid="bot-cfg-stars"
          label="TELEGRAM STARS PREMIUM (STUB)"
          hint="Data-model stub only - no purchase flow wired. Toggle has no user-facing effect until Stars integration ships.">
          <Toggle testid="bot-cfg-stars-toggle" on={!!m.stars_premium_enabled} onChange={(v) => patchConfig({ stars_premium_enabled: v })} disabled={busy} />
        </Field>

        <Field testid="bot-cfg-sharpness"
          label="SHARPNESS BROADCAST FLOOR"
          hint="Top pick must beat this score (0-100) before the @putkihq channel broadcast fires. Default 70.">
          <input type="number" min="0" max="100" defaultValue={m.sharpness_min || 70}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n >= 0 && n <= 100 && n !== m.sharpness_min) {
                patchConfig({ sharpness_min: n });
              }
            }}
            data-testid="bot-cfg-sharpness-input"
            style={{ width: 100, padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
        </Field>
      </section>

      {/* Partners table */}
      <section data-testid="bot-routing-partners" style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Affiliate partners</h2>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', maxWidth: 640 }}>
          Empty at launch. Add a row + flip <strong>signal unlock mode</strong> to <strong>routed</strong> to switch monetisation on without a deploy. Routing is geo-gated: a partner only receives traffic from users in <em>target_geos</em>.
        </p>

        {/* Mint test link */}
        <div data-testid="bot-routing-mint" style={{
          border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 14,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              MINT TEST LINK
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginTop: 4 }}>
              Spins up a fresh <code>/api/r/&lt;code&gt;</code> against today&apos;s top pick + copies the URL to your clipboard. Use it to smoke-test the router without leaving the page.
            </div>
          </div>
          <button onClick={mintTestLink} disabled={busy}
            data-testid="bot-routing-mint-btn"
            style={{
              padding: '10px 16px', background: '#E8C26E', color: '#0B0A09', border: 0,
              fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em',
              fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
            }}>{busy ? '…' : '+ MINT LINK'}</button>
        </div>

        {mint && (
          <div data-testid="bot-routing-mint-result" style={{
            border: '1px dashed #E8C26E', padding: 12, marginBottom: 14,
            background: '#1a1610',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700 }}>
                CODE {mint.code} {mint.copied ? '· COPIED ✓' : '· COPY MANUALLY'}
              </span>
              <a href={mint.full_url} target="_blank" rel="noreferrer"
                data-testid="bot-routing-mint-open"
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: '#E8C26E', textDecoration: 'underline' }}>
                OPEN IN NEW TAB →
              </a>
            </div>
            <code data-testid="bot-routing-mint-url" style={{
              display: 'block', padding: 8, background: '#0B0A09', color: '#F2EBE0',
              fontFamily: 'ui-monospace, monospace', fontSize: 11, wordBreak: 'break-all',
              border: '1px solid var(--border)',
            }}>{mint.full_url}</code>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--muted)', marginTop: 6, letterSpacing: '0.08em' }}>
              SIGNAL: {mint.signal_id || 'back_office_test'} · In <strong>informative</strong> mode this 302s to /mittari · in <strong>routed</strong> mode it picks a LIVE geo-eligible partner.
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', marginBottom: 14 }}>
          <thead style={{ background: 'var(--surface, #141210)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>KEY</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>NAME</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>GEOS</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>PRIORITY</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>STATUS</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>NO PARTNERS · ROUTING IS DORMANT</td></tr>
            ) : partners.map((p) => (
              <PartnerRow key={p.partner_key} p={p} busy={busy} onUpdate={upsertPartner} onDelete={deletePartner} />
            ))}
          </tbody>
        </table>

        {/* Add row */}
        <div data-testid="bot-routing-partner-add" style={{ border: '1px dashed var(--border)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, alignItems: 'end' }}>
          <input type="text" placeholder="partner_key (e.g. veikkaus)" value={newPartner.partner_key}
            onChange={(e) => setNewPartner({ ...newPartner, partner_key: e.target.value })}
            data-testid="bot-partner-key-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <input type="text" placeholder="Display name" value={newPartner.display_name}
            onChange={(e) => setNewPartner({ ...newPartner, display_name: e.target.value })}
            data-testid="bot-partner-name-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'Georgia, serif', fontSize: 13 }} />
          <input type="text" placeholder="affiliate_base_url" value={newPartner.affiliate_base_url}
            onChange={(e) => setNewPartner({ ...newPartner, affiliate_base_url: e.target.value })}
            data-testid="bot-partner-url-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
          <input type="text" placeholder="target_geos (CSV: FI,SE)" value={newPartner.target_geos}
            onChange={(e) => setNewPartner({ ...newPartner, target_geos: e.target.value })}
            data-testid="bot-partner-geos-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <input type="number" placeholder="priority" value={newPartner.priority_weight}
            onChange={(e) => setNewPartner({ ...newPartner, priority_weight: parseInt(e.target.value, 10) || 0 })}
            data-testid="bot-partner-prio-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 12, width: '100%' }} />
          <button disabled={busy || !newPartner.partner_key.trim() || !newPartner.display_name.trim() || !newPartner.affiliate_base_url.trim()}
            data-testid="bot-partner-add-btn"
            onClick={() => {
              upsertPartner({
                partner_key: newPartner.partner_key,
                display_name: newPartner.display_name,
                affiliate_base_url: newPartner.affiliate_base_url,
                target_geos: newPartner.target_geos.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
                priority_weight: newPartner.priority_weight,
                status: 'paused',
              });
              setNewPartner({ partner_key: '', display_name: '', affiliate_base_url: '', target_geos: 'FI', priority_weight: 10 });
            }}
            style={{
              padding: '10px 16px', background: '#E8C26E', color: '#0B0A09', border: 0,
              fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 800, cursor: 'pointer',
              opacity: busy ? 0.5 : 1,
            }}>+ ADD PARTNER</button>
        </div>
      </section>

      <p data-testid="bot-routing-footnote" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', lineHeight: 1.7 }}>
        SLICE 1 of 5 · Foundation. Daily DM dispatch (Slice 2), website signup form (Slice 3), Mini App (Slice 4), and the active affiliate router (Slice 5) ship in subsequent iterations.
      </p>
    </Container>
  );
};

export default BackOfficeBotRouting;
