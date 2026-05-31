import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useBackOfficeToken } from '../hooks/useBackOfficeToken';

/**
 * /back-office/mittari-grading — operator grading workflow for the
 * Mittari signal back-test (Phase 4 wave 4 close-out).
 *
 * Three sections:
 *   1. STATUS strip — chip counts (snapshotted, graded, ungraded, 90d N, last graded).
 *   2. ACTIONS — manual "Snapshot today's picks" button (the cron does this daily; this is for ad-hoc backfill).
 *   3. PENDING table — every snapshotted signal that has commenced
 *      but is not yet graded, with HIT / MISS / PUSH radio + Save All.
 *
 * Auth: shell-injected token via useOutletContext; falls back to
 * standalone useBackOfficeToken if accessed directly.
 */

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const StatusChip = ({ tone = 'neutral', label, value }) => {
  const palette = tone === 'warn'
    ? { bg: '#FBEDEC', fg: 'var(--dial-myrsky)' }
    : tone === 'ok'
      ? { bg: 'var(--ember-soft)', fg: 'var(--ember-strong)' }
      : { bg: 'var(--surface)', fg: 'var(--ink)' };
  return (
    <div style={{ background: palette.bg, padding: '8px 14px', border: '1px solid var(--line)' }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)', fontWeight: 700 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, letterSpacing: '0.05em', color: palette.fg, fontWeight: 700 }}>{value}</div>
    </div>
  );
};

const BackOfficeMittariGrading = () => {
  const _shellCtx = useOutletContext() || {};
  const _localToken = useBackOfficeToken();
  const token = _shellCtx.token || _localToken.token;
  const authed = !!_shellCtx.token || _localToken.authed;
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState([]);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token || '' }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [s, p] = await Promise.all([
        fetch(`${BACKEND}/api/admin/mittari/grading/status`, { headers: headers() }).then((r) => r.json()),
        fetch(`${BACKEND}/api/admin/mittari/grading/pending?limit=200`, { headers: headers() }).then((r) => r.json()),
      ]);
      setStatus(s);
      setPending(p.rows || []);
      setError(null);
    } catch (e) {
      setError(e.message || 'refresh_failed');
    }
  }, [token, headers]);

  useEffect(() => { refresh(); }, [refresh]);

  const runSnapshot = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/mittari/grading/snapshot`, { method: 'POST', headers: headers() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || `http_${r.status}`);
      setMsg(`Snapshot wrote ${j.written} new rows · skipped ${j.skipped} duplicates · ${j.total_picks_in_payload} picks in feed.`);
      await refresh();
    } catch (e) { setError(e.message || 'snapshot_failed'); }
    setBusy(false);
  };

  const saveGrades = async () => {
    if (!token || busy) return;
    const grades = Object.entries(draft)
      .filter(([, v]) => v && ['hit', 'miss', 'push'].includes(v))
      .map(([signal_id, outcome]) => ({ signal_id, outcome }));
    if (grades.length === 0) {
      setError('Nothing selected to grade.');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/mittari/grading/grade`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ grades }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || `http_${r.status}`);
      setMsg(`Graded ${j.written} signals · skipped ${(j.skipped || []).length}.`);
      setDraft({});
      await refresh();
    } catch (e) { setError(e.message || 'grade_failed'); }
    setBusy(false);
  };

  if (!authed) return null;

  return (
    <div data-testid="bo-mittari-grading" style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <header className="mb-6">
        <div className="eyebrow" style={{ color: 'var(--ember-strong)' }}>MITTARI · GRADING</div>
        <h1 className="display text-3xl sm:text-4xl mt-2">Mittari signal grading</h1>
        <p className="font-serif mt-3" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 720 }}>
          Snapshot live picks daily (cron does this at the dispatch window), then grade past signals HIT / MISS / PUSH.
          Graded rows feed the public 90-day back-test at <code>/trust/mittari-tarkkuus</code>.
        </p>
      </header>

      {/* Status strip */}
      <section data-testid="bo-mittari-grading-status" className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {status && (
          <>
            <StatusChip label="SNAPSHOTTED" value={status.snapshotted_total} />
            <StatusChip label="GRADED" value={status.graded_total} tone="ok" />
            <StatusChip label="UNGRADED" value={status.ungraded_count} tone={status.ungraded_count > 0 ? 'warn' : 'neutral'} />
            <StatusChip label="90D WINDOW N" value={status.window_n_90d} />
            <StatusChip label="LAST GRADED" value={status.last_graded_at ? String(status.last_graded_at).slice(0, 10) : '—'} />
          </>
        )}
      </section>

      {/* Actions */}
      <section className="mb-6 flex flex-wrap gap-3 items-center">
        <button
          data-testid="bo-mittari-grading-snapshot-btn"
          onClick={runSnapshot}
          disabled={busy || !token}
          className="mono"
          style={{ padding: '8px 16px', background: 'var(--ember)', color: '#fff', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, border: 'none' }}
        >SNAPSHOT TODAY</button>
        <button
          data-testid="bo-mittari-grading-refresh-btn"
          onClick={refresh}
          disabled={busy || !token}
          className="mono"
          style={{ padding: '8px 16px', background: 'var(--surface)', color: 'var(--ink)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, border: '1px solid var(--line)' }}
        >REFRESH</button>
        {msg && <span data-testid="bo-mittari-grading-msg" className="mono" style={{ fontSize: 11, color: 'var(--ember-strong)' }}>{msg}</span>}
        {error && <span data-testid="bo-mittari-grading-err" className="mono" style={{ fontSize: 11, color: 'var(--dial-myrsky)' }}>{error}</span>}
      </section>

      {/* Pending table */}
      <section data-testid="bo-mittari-grading-pending">
        <h2 className="display text-xl mb-3">Pending grading · {pending.length}</h2>
        {pending.length === 0 && (
          <div data-testid="bo-mittari-grading-empty" className="p-4 font-serif" style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
            Nothing pending. Either no commenced snapshots exist yet, or every commenced signal has been graded.
          </div>
        )}
        {pending.length > 0 && (
          <div style={{ border: '1px solid var(--line)', overflowX: 'auto' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                  {['Commence', 'Class', 'Pick', '@', 'Match', 'Outcome'].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.signal_id} data-testid={`bo-mittari-grading-row-${p.signal_id}`} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: 'var(--ink-2)' }}>{p.commence_time ? String(p.commence_time).slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--ember-strong)', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{p.signal_class}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--ink)' }}>{p.pick_name || '—'}</td>
                    <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ink)' }}>{p.pick_price || '—'}</td>
                    <td className="px-3 py-2 font-serif" style={{ color: 'var(--ink-2)' }}>{[p.home_team, p.away_team].filter(Boolean).join(' vs ') || '—'}</td>
                    <td className="px-3 py-2">
                      {['hit', 'miss', 'push'].map((o) => (
                        <label key={o} className="mono" style={{ marginRight: 10, fontSize: 11, letterSpacing: '0.12em', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`grade-${p.signal_id}`}
                            data-testid={`bo-mittari-grading-radio-${p.signal_id}-${o}`}
                            value={o}
                            checked={draft[p.signal_id] === o}
                            onChange={() => setDraft((d) => ({ ...d, [p.signal_id]: o }))}
                            style={{ marginRight: 4 }}
                          />{o.toUpperCase()}
                        </label>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pending.length > 0 && (
          <div className="mt-4">
            <button
              data-testid="bo-mittari-grading-save-btn"
              onClick={saveGrades}
              disabled={busy || !token || Object.keys(draft).length === 0}
              className="mono"
              style={{ padding: '10px 20px', background: 'var(--ember-strong)', color: '#fff', fontSize: 11.5, letterSpacing: '0.14em', fontWeight: 700, border: 'none' }}
            >SAVE {Object.values(draft).filter(Boolean).length} GRADES</button>
          </div>
        )}
      </section>
    </div>
  );
};

export default BackOfficeMittariGrading;
