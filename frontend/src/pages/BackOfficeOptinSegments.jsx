/**
 * PUTKI HQ — BackOfficeOptinSegments.
 *
 * Surfaces /api/admin/optin/stats so the editorial team can see how many
 * readers have opted into each (channel × surface × consent_tag) segment.
 * Also shows the daily-dispatch dry-run summary and a manual "Run cycle"
 * trigger.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const CHANNEL_PILL = {
  email: { label: 'EMAIL', bg: '#0e1a2b', color: '#9ac4d4', border: '#2b4a5a' },
  sms: { label: 'SMS', bg: '#2b1a0e', color: '#d4a89a', border: '#5a3a2b' },
  telegram: { label: 'TELEGRAM', bg: '#1a0e2b', color: '#a89ad4', border: '#3a2b5a' },
};

const Pill = ({ channel }) => {
  const cfg = CHANNEL_PILL[channel] || { label: (channel || '?').toUpperCase(), bg: 'transparent', color: 'var(--muted)', border: 'var(--border-strong)' };
  return (
    <span data-testid={`channel-pill-${channel}`} style={{
      display: 'inline-block', padding: '3px 8px',
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.18em', fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
};

const BackOfficeOptinSegments = () => {
  const { token, setToken, authed, authError, checkAuth } = useBackOfficeToken();
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState('');

  const load = useCallback(async () => {
    if (!token || !authed) return;
    try {
      const [s, su, lg] = await Promise.all([
        fetch(`${BACKEND}/api/admin/optin/stats`, { headers: { 'X-Admin-Token': token } }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/dispatch/summary?days=7`, { headers: { 'X-Admin-Token': token } }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/dispatch/log?limit=20`, { headers: { 'X-Admin-Token': token } }).then((r) => r.ok ? r.json() : { items: [] }),
      ]);
      setStats(s); setSummary(su); setLog(lg.items || []);
    } catch (e) {
      // network — leave whatever is on screen
    }
  }, [token, authed]);

  useEffect(() => { load(); }, [load]);

  const runCycle = async (dryRun) => {
    setBusy(true); setRunError(''); setRunResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/dispatch/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ dry_run: !!dryRun }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setRunError(j.detail || `HTTP ${r.status}`);
      } else {
        setRunResult(await r.json());
        await load();
      }
    } catch (e) {
      setRunError(e.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const segmentRows = useMemo(() => stats?.by_segment || [], [stats]);
  const summaryRows = useMemo(() => summary?.rows || [], [summary]);

  if (!authed) {
    return <AuthGate token={token} setToken={setToken} onSubmit={checkAuth} error={authError} title="Opt-in segments" />;
  }

  return (
    <div data-testid="back-office-optin-segments" style={{
      maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/back-office" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← BACK-OFFICE</Link>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36,
        letterSpacing: '-0.02em', color: '#FFFFFF', margin: '16px 0 8px',
      }}>Opt-in segments &amp; dispatch</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, maxWidth: 760, lineHeight: 1.55 }}>
        Three independent consent tags: <code style={{ color: 'var(--ink)' }}>email_sentiment</code> (slow editorial digest),
        <code style={{ color: 'var(--ink)', margin: '0 4px' }}>sms_alerts</code> (fast daily bets),
        <code style={{ color: 'var(--ink)' }}>telegram_alerts</code> (mirror of SMS).
        Daily cycle fires at 10:00 Europe/Helsinki — dry-run until Resend / Twilio / Telegram credentials land in <code style={{ color: 'var(--ink)' }}>backend/.env</code>.
      </p>

      {/* Totals */}
      <div data-testid="optin-totals" style={{
        display: 'flex', gap: 24, marginBottom: 28,
        padding: '20px 22px', background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 4 }}>TOTAL CONSENT ROWS</div>
          <div data-testid="optin-total" style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 32, color: '#FFFFFF', lineHeight: 1 }}>{stats?.total ?? '—'}</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--hairline)', paddingLeft: 24 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 4 }}>SEGMENTS LIVE</div>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 32, color: '#FFFFFF', lineHeight: 1 }}>{segmentRows.length}</div>
        </div>
      </div>

      {/* Segment table */}
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#FFFFFF', margin: '0 0 12px' }}>Segments (channel × surface × consent_tag)</h2>
      {segmentRows.length === 0 ? (
        <div data-testid="segments-empty" style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', padding: 24, border: '1px dashed var(--border)' }}>
          NO CONSENT ROWS CAPTURED YET.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }} data-testid="segments-table">
          <thead>
            <tr style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ padding: 12 }}>CHANNEL</th>
              <th style={{ padding: 12 }}>SURFACE</th>
              <th style={{ padding: 12 }}>CONSENT TAG</th>
              <th style={{ padding: 12, textAlign: 'right' }}>COUNT</th>
            </tr>
          </thead>
          <tbody>
            {segmentRows.map((r, i) => (
              <tr key={`${r.channel}:${r.surface}:${r.consent_tag}:${i}`}
                data-testid={`segment-row-${r.consent_tag}`}
                style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: 12 }}><Pill channel={r.channel} /></td>
                <td style={{ padding: 12, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ink)' }}>{r.surface}</td>
                <td style={{ padding: 12, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>{r.consent_tag}</td>
                <td style={{ padding: 12, fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, textAlign: 'right', color: '#FFFFFF' }}>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Dispatch */}
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#FFFFFF', margin: '24px 0 12px' }}>Daily dispatch (dry-run)</h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" onClick={() => runCycle(true)} disabled={busy}
          data-testid="dispatch-run-dryrun"
          style={{
            padding: '10px 18px', background: '#FFFFFF', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
            fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? 'RUNNING…' : '▶ RUN CYCLE (DRY-RUN)'}</button>
        <button type="button" onClick={() => runCycle(false)} disabled={busy}
          data-testid="dispatch-run-live"
          style={{
            padding: '10px 18px', background: 'transparent', color: '#C8423C',
            border: '1px solid #5a2b2b',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
            fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? '…' : '⚠ RUN CYCLE (LIVE — uses real keys where present)'}</button>
        {summary?.last_cycle && (
          <span data-testid="last-cycle-info" style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)' }}>
            LAST CYCLE · {String(summary.last_cycle.cycle_date)} · {summary.last_cycle.dry_run ? 'DRY-RUN' : 'LIVE'}
          </span>
        )}
      </div>
      {runError && <div data-testid="dispatch-error" style={{ marginBottom: 12, padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{runError}</div>}
      {runResult && <div data-testid="dispatch-result" style={{ marginBottom: 16, padding: 10, background: '#0e2b1a', border: '1px solid #2b5a3e', color: '#9ad4a9', fontSize: 12, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.10em' }}>
        CYCLE OK · {runResult.dry_run ? 'DRY-RUN' : 'LIVE'} · {(runResult.results || []).map((r) => `${r.channel}=${r.dry_run + r.delivered}`).join(' · ')}
      </div>}

      {/* 7-day summary */}
      {summaryRows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }} data-testid="dispatch-summary-table">
          <thead>
            <tr style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ padding: 12 }}>CHANNEL</th>
              <th style={{ padding: 12 }}>SEGMENT</th>
              <th style={{ padding: 12 }}>MODE</th>
              <th style={{ padding: 12, textAlign: 'right' }}>LAST 7D</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: 12 }}><Pill channel={r.channel} /></td>
                <td style={{ padding: 12, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>{r.segment}</td>
                <td style={{ padding: 12, fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em',
                  color: r.mode === 'live' ? '#6FA37D' : '#E8C26E' }}>{r.mode.toUpperCase()}</td>
                <td style={{ padding: 12, fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, textAlign: 'right', color: '#FFFFFF' }}>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Recent log */}
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#FFFFFF', margin: '24px 0 12px' }}>Recent dispatch log (latest 20)</h2>
      {log.length === 0 ? (
        <div data-testid="log-empty" style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', padding: 24, border: '1px dashed var(--border)' }}>
          NO DISPATCH ROWS YET.
        </div>
      ) : (
        <div data-testid="log-rows" style={{ display: 'grid', gap: 6 }}>
          {log.map((r) => (
            <div key={r.id || `${r.kind}-${r.sent_at}`} style={{
              display: 'flex', gap: 12, alignItems: 'center',
              padding: '8px 12px', background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ink)',
            }}>
              <span style={{ color: 'var(--muted)', flex: '0 0 130px' }}>{r.sent_at || r.finished_at || ''}</span>
              <span style={{ color: '#FFFFFF', flex: '0 0 64px', letterSpacing: '0.18em', fontWeight: 700 }}>{(r.kind || '').toUpperCase()}</span>
              {r.channel && <Pill channel={r.channel} />}
              <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.recipient ? r.recipient : (r.segment || r.cycle_date || '')}
              </span>
              {r.mode && <span style={{
                color: r.mode === 'live' ? '#6FA37D' : '#E8C26E',
                fontWeight: 700, letterSpacing: '0.18em',
              }}>{r.mode.toUpperCase()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackOfficeOptinSegments;
