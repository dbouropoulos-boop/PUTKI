/**
 * PUTKI HQ - /back-office/profiler-funnel · iter64 pivot
 *
 * Lightweight funnel dashboard for the behavioral profiler at /peliareena.
 * Reads from GET /api/admin/profiler/funnel and renders the seven-step
 * funnel + drop-off rates.
 */
import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const ADMIN_TOKEN_KEY = 'putki_hq_admin_token';

const STEPS = [
  { key: 'session_start',        label: 'Session start',           rate: null },
  { key: 'session_complete',     label: 'Session complete',        rate: 'completion_rate' },
  { key: 'reveal_view',          label: 'Identity reveal viewed',  rate: 'reveal_view_rate' },
  { key: 'gate_view',            label: 'Email gate viewed',       rate: 'gate_view_rate' },
  { key: 'gate_submit_attempt',  label: 'Gate submit attempt',     rate: 'gate_submit_rate' },
  { key: 'gate_unlocked',        label: 'Gate unlocked (email)',   rate: 'gate_unlock_rate' },
];

const BackOfficeProfilerFunnel = () => {
  // iter82 · Task 2.2 — capture shell token so the page works without
  // its old per-tab token prompt.
  const _shellCtx = useOutletContext() || {};
  const _shellCtxToken = _shellCtx.token || '';
  const [data, setData] = useState(null);
  const [since, setSince] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (days = since) => {
    setLoading(true); setError(null);
    try {
      // iter82 · Task 2.2 — prefer shell-injected token (sessionStorage)
      // and fall back to legacy localStorage key for direct visits.
      const token = _shellCtxToken
        || (typeof window !== 'undefined' ? sessionStorage.getItem('putki-hq-admin-token') : '')
        || localStorage.getItem(ADMIN_TOKEN_KEY)
        || 'putki-hq-admin';
      const r = await fetch(`${BACKEND}/api/admin/profiler/funnel?since_days=${days}`, {
        credentials: 'include',
        headers: { 'X-Admin-Token': token },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(7); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const counts = data?.counts || {};
  const rates  = data?.rates || {};

  return (
    <div data-testid="back-office-profiler-funnel" style={{
      padding: '40px 24px 80px', maxWidth: 900, margin: '0 auto',
    }}>
      <Link to="/back-office" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> Back-office
      </Link>

      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#b07d18', fontWeight: 700, marginBottom: 12 }}>
        PUTKI HQ · PROFILER FUNNEL
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(28px, 4vw, 38px)', lineHeight: 1.1,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px',
      }}>
        /peliareena conversion funnel
      </h1>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
        {[1, 7, 30].map(d => (
          <button key={d} onClick={() => { setSince(d); load(d); }}
            data-testid={`funnel-range-${d}d`}
            style={{
              padding: '8px 14px',
              background: since === d ? 'var(--ink)' : 'transparent',
              color: since === d ? 'var(--bg)' : 'var(--ink)',
              border: '1px solid var(--ink)', borderRadius: 4,
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
            {d}d
          </button>
        ))}
        <button onClick={() => load()} data-testid="funnel-refresh" style={{
          padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--muted)', borderRadius: 4, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={12} strokeWidth={1.8} /> Refresh
        </button>
      </div>

      {error && <p style={{ color: '#C8423C', fontFamily: 'Georgia, serif' }}>Error: {error}</p>}
      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {data && (
        <>
          <div data-testid="funnel-steps" style={{
            border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
          }}>
            {STEPS.map((step, i) => {
              const n = counts[step.key] || 0;
              const rate = step.rate ? rates[step.rate] : null;
              const isLast = i === STEPS.length - 1;
              return (
                <div key={step.key} data-testid={`funnel-step-${step.key}`} style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 110px 110px',
                  gap: 14, padding: '14px 18px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                  alignItems: 'center',
                }}>
                  <div className="mono" style={{ fontSize: 10, color: '#b07d18', fontWeight: 700 }}>
                    {`0${i + 1}`}
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: 'var(--ink)' }}>
                    {step.label}
                  </div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', textAlign: 'right' }}>
                    {n.toLocaleString()}
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                    {rate != null ? `${rate}% conv.` : '- '}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Card label="End-to-end conv." value={`${rates.end_to_end_rate ?? 0}%`}
                  note="session_start → gate_unlocked" />
            <Card label="Share clicks" value={(counts.share_click || 0).toLocaleString()}
                  note={`${rates.share_rate ?? 0}% of unlocks`} />
            <Card label="Telegram clicks" value={(counts.tg_click || 0).toLocaleString()}
                  note={`${rates.tg_rate ?? 0}% of unlocks`} />
          </div>

          <p style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)',
            marginTop: 22,
          }}>
            Window: last {data.since_days}d · Events stored for 30d (TTL)
          </p>
        </>
      )}
    </div>
  );
};

const Card = ({ label, value, note }) => (
  <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)' }}>
    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#b07d18', fontWeight: 700, marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--ink)' }}>{value}</div>
    <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{note}</div>
  </div>
);

export default BackOfficeProfilerFunnel;
