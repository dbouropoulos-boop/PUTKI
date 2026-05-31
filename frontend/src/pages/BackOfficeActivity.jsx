/**
 * BackOfficeActivity — dedicated activity-log page at /back-office/activity.
 *
 * Reads from /api/admin/back_office_activity with filters:
 *   - action_type (dropdown populated from /distinct/action_types)
 *   - actor (free-text on the 8-char hash)
 *   - since / until (ISO date pickers)
 *   - reversible_only (checkbox)
 *
 * Each row shows: timestamp · actor · action_type · entity · route.
 * Reversible rows that aren't already undone get an "Undo" button that
 * POSTs /api/admin/back_office_activity/{id}/undo. The page refreshes
 * the list after a successful undo.
 *
 * Pagination is offset-style — Mongo supports `skip` cheaply for the
 * small back-office volume we'll see (<50k rows over the lifetime of
 * the project).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, RotateCcw, RefreshCw } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const PAGE_SIZE = 25;

const relTime = (iso) => {
  if (!iso) return '-';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatIso = (iso) => {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
};


const BackOfficeActivity = () => {
  const { token } = useOutletContext() || {};
  const navigate = useNavigate();
  const headers = useMemo(() => ({ 'X-Admin-Token': token || '', 'Content-Type': 'application/json' }), [token]);

  // Filter state
  const [actionType, setActionType]   = useState('');
  const [actor, setActor]             = useState('');
  const [since, setSince]             = useState('');
  const [until, setUntil]             = useState('');
  const [reversibleOnly, setReversibleOnly] = useState(false);

  // Data state
  const [actionTypes, setActionTypes] = useState([]);
  const [rows, setRows]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [undoBusyId, setUndoBusyId]   = useState(null);

  // Fetch distinct action_types for the dropdown — once on mount.
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/admin/back_office_activity/distinct/action_types`, { headers })
      .then((r) => r.json())
      .then((j) => setActionTypes(j?.action_types || []))
      .catch(() => {});
  }, [token, headers]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    const qs = new URLSearchParams();
    qs.set('limit', PAGE_SIZE);
    if (actionType) qs.set('action_type', actionType);
    if (actor) qs.set('actor', actor);
    if (since) qs.set('since', new Date(since).toISOString());
    if (until) qs.set('until', new Date(until).toISOString());
    if (reversibleOnly) qs.set('reversible_only', 'true');
    try {
      const r = await fetch(`${BACKEND}/api/admin/back_office_activity?${qs}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      // Server returns the most recent N — pagination on the client by
      // slicing. For full pagination we'd add `skip=` to the query, but
      // the server endpoint hasn't been wired for skip yet. Compromise:
      // when total > PAGE_SIZE we fetch up to 200 and slice locally.
      let items = j?.items || [];
      if ((j?.total || 0) > PAGE_SIZE) {
        const big = new URLSearchParams(qs);
        big.set('limit', 200);
        const r2 = await fetch(`${BACKEND}/api/admin/back_office_activity?${big}`, { headers });
        if (r2.ok) {
          const j2 = await r2.json();
          items = j2?.items || items;
        }
      }
      setRows(items);
      setTotal(j?.total || items.length);
    } catch (e) {
      setError(e.message || 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [token, headers, actionType, actor, since, until, reversibleOnly]);

  useEffect(() => { refresh(); }, [refresh]);

  // Reset page when filters change.
  useEffect(() => { setPage(0); }, [actionType, actor, since, until, reversibleOnly]);

  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const handleUndo = async (row) => {
    setUndoBusyId(row.id);
    try {
      const r = await fetch(`${BACKEND}/api/admin/back_office_activity/${row.id}/undo`, {
        method: 'POST', headers,
      });
      const j = await r.json();
      if (!r.ok) {
        alert(`Undo failed: ${j?.detail || r.status}`);
      } else {
        await refresh();
      }
    } catch (e) {
      alert(`Undo failed: ${e.message || 'network'}`);
    } finally {
      setUndoBusyId(null);
    }
  };

  const resetFilters = () => {
    setActionType(''); setActor(''); setSince(''); setUntil('');
    setReversibleOnly(false);
  };

  return (
    <div data-testid="bo-activity-page" style={{
      fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--ink)',
    }}>
      <header style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/back-office')} type="button"
          data-testid="bo-activity-back"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
            color: 'var(--ink-3)', marginBottom: 10, textTransform: 'uppercase',
          }}>
          <ArrowLeft size={12} strokeWidth={2} /> COCKPIT
        </button>
        <h1 className="display" style={{
          fontSize: 32, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)',
        }}>
          Activity log
        </h1>
        <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ink-2)', maxWidth: 640 }}>
          Append-only audit trail of every back-office mutation. Reversible
          actions can be soft-undone within 24h of capture.
        </p>
      </header>

      {/* Filters */}
      <section data-testid="bo-activity-filters" style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24,
        padding: '14px 16px', border: '1px solid var(--line)',
        borderRadius: 6, background: 'var(--surface)',
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em',
          color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 8,
        }}>
          <Filter size={11} strokeWidth={2} /> FILTERS
        </div>
        <select data-testid="bo-activity-filter-action"
          value={actionType} onChange={(e) => setActionType(e.target.value)}
          style={fieldStyle}>
          <option value="">All actions</option>
          {actionTypes.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input data-testid="bo-activity-filter-actor"
          type="text" placeholder="actor hash (8 chars)"
          value={actor} onChange={(e) => setActor(e.target.value)}
          style={{ ...fieldStyle, width: 180 }} />
        <input data-testid="bo-activity-filter-since"
          type="datetime-local" value={since}
          onChange={(e) => setSince(e.target.value)} style={fieldStyle} />
        <input data-testid="bo-activity-filter-until"
          type="datetime-local" value={until}
          onChange={(e) => setUntil(e.target.value)} style={fieldStyle} />
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: 'var(--ink-2)',
        }}>
          <input data-testid="bo-activity-filter-reversible"
            type="checkbox" checked={reversibleOnly}
            onChange={(e) => setReversibleOnly(e.target.checked)} />
          REVERSIBLE ONLY
        </label>
        <button onClick={resetFilters} type="button"
          data-testid="bo-activity-filter-reset" style={ghostBtn}>
          Reset
        </button>
        <button onClick={refresh} type="button" disabled={loading}
          data-testid="bo-activity-refresh" style={{ ...ghostBtn, marginLeft: 'auto' }}>
          <RefreshCw size={11} strokeWidth={2} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </section>

      {error && (
        <div style={{
          padding: '10px 14px', border: '1px solid var(--dial-myrsky)',
          background: '#FBEDEC', color: 'var(--dial-myrsky)', borderRadius: 4,
          fontFamily: MONO, fontSize: 12, marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {/* Pagination header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span data-testid="bo-activity-total" style={{
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
          color: 'var(--ink-3)', textTransform: 'uppercase',
        }}>
          {total} {total === 1 ? 'ROW' : 'ROWS'} · SHOWING {pageRows.length}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0} type="button"
            data-testid="bo-activity-prev" style={pagerBtn}>
            <ChevronLeft size={12} strokeWidth={2} />
          </button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-2)' }}>
            {page + 1} / {pageCount}
          </span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1} type="button"
            data-testid="bo-activity-next" style={pagerBtn}>
            <ChevronRight size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Rows table */}
      <div data-testid="bo-activity-table" style={{
        border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg)',
        overflow: 'hidden',
      }}>
        {pageRows.length === 0 && !loading && (
          <div style={{
            padding: '32px 18px', textAlign: 'center',
            fontFamily: MONO, fontSize: 12, color: 'var(--ink-3)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }} data-testid="bo-activity-empty">
            NO MATCHING ROWS
          </div>
        )}
        {pageRows.map((row, i) => (
          <div key={row.id} data-testid={`bo-activity-row-${row.id}`} style={{
            display: 'grid',
            gridTemplateColumns: '120px 110px 1.4fr 1.4fr 120px',
            gap: 14, alignItems: 'center',
            padding: '12px 16px',
            borderTop: i === 0 ? 0 : '1px solid var(--line)',
            background: row.undone_at ? 'var(--surface)' : 'var(--bg)',
            opacity: row.undone_at ? 0.65 : 1,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-2)' }}>
              <div>{relTime(row.ts)}</div>
              <div style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{formatIso(row.ts)}</div>
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 11, color: 'var(--ink-2)',
              letterSpacing: '0.04em',
            }}>{row.actor_hash}</div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                {row.action_type}
              </div>
              {row.entity && (
                <div style={{
                  fontFamily: MONO, fontSize: 10.5, color: 'var(--ink-3)',
                  letterSpacing: '0.04em', marginTop: 2,
                }}>{row.entity}</div>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ember-strong)' }}>
              {row.route ? (
                <button type="button" onClick={() => navigate(row.route)}
                  data-testid={`bo-activity-row-route-${row.id}`}
                  style={{
                    background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                    color: 'var(--ember-strong)', fontFamily: MONO, fontSize: 11,
                    textDecoration: 'underline', textDecorationStyle: 'dotted',
                  }}>
                  {row.route}
                </button>
              ) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
            </div>
            <div style={{ justifySelf: 'end' }}>
              {row.undone_at ? (
                <span style={{
                  fontFamily: MONO, fontSize: 10, color: 'var(--ink-3)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }} data-testid={`bo-activity-row-undone-${row.id}`}>UNDONE</span>
              ) : row.reversible ? (
                <button type="button" onClick={() => handleUndo(row)}
                  disabled={undoBusyId === row.id}
                  data-testid={`bo-activity-row-undo-${row.id}`}
                  style={undoBtn}>
                  <RotateCcw size={11} strokeWidth={2} />
                  {undoBusyId === row.id ? '…' : 'Undo'}
                </button>
              ) : (
                <span style={{
                  fontFamily: MONO, fontSize: 9.5, color: 'var(--ink-3)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// ─── Local styles ───────────────────────────────────────────────────
const fieldStyle = {
  padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 4,
  background: 'var(--bg)', color: 'var(--ink)',
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12.5,
  minWidth: 140,
};

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 4,
  background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12.5,
};

const pagerBtn = {
  ...ghostBtn,
  padding: '4px 8px',
};

const undoBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', border: '1px solid var(--ember)',
  borderRadius: 4, background: 'var(--ember-soft)',
  color: 'var(--ember-strong)', cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11.5, fontWeight: 600,
};


export default BackOfficeActivity;
