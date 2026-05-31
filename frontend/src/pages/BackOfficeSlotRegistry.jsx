/**
 * PUTKI HQ - BackOfficeSlotRegistry.
 *
 * Editorial maintenance of the slot / live-table registry that powers
 * the homepage "Now Playing" ticker. Longest-match-wins extraction
 * means the registry is sensitive to overlapping variants - toggling
 * `Sugar Rush 1000` off but keeping `Sugar Rush` on changes which
 * stream titles match.
 *
 * Auth: existing X-Admin-Token (BackOfficeContext).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const CATEGORIES = ['slot', 'live_table'];

const CategoryPill = ({ category }) => {
  const cfg = category === 'live_table'
    ? { label: 'LIVE TABLE', bg: '#1a0e2b', color: '#a89ad4', border: '#3a2b5a' }
    : { label: 'SLOT', bg: '#0e1a2b', color: '#9ac4d4', border: '#2b4a5a' };
  return (
    <span data-testid={`category-pill-${category}`} style={{
      display: 'inline-block', padding: '3px 8px',
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.16em', fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
};

const Row = ({ entry, token, onChanged }) => {
  const [busy, setBusy] = useState(null);

  const toggleEnabled = useCallback(async () => {
    setBusy('toggle');
    try {
      await fetch(`${BACKEND}/api/admin/slot-registry/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ enabled: !entry.enabled }),
      });
      await onChanged();
    } finally { setBusy(null); }
  }, [entry.id, entry.enabled, token, onChanged]);

  const remove = useCallback(async () => {
    if (!window.confirm(`Delete "${entry.name}" from the registry?`)) return;
    setBusy('delete');
    try {
      await fetch(`${BACKEND}/api/admin/slot-registry/${entry.id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': token },
      });
      await onChanged();
    } finally { setBusy(null); }
  }, [entry.id, entry.name, token, onChanged]);

  return (
    <tr data-testid={`slot-row-${entry.id}`}
      style={{ borderTop: '1px solid var(--border)', opacity: entry.enabled ? 1 : 0.5 }}>
      <td style={{ padding: '12px', fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)' }}>
        {entry.name}
      </td>
      <td style={{ padding: '12px' }}><CategoryPill category={entry.category} /></td>
      <td style={{ padding: '12px', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
        {entry.provider || '-'}
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={entry.enabled} onChange={toggleEnabled}
            disabled={busy === 'toggle'} data-testid={`slot-enabled-toggle-${entry.id}`} />
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)' }}>
            {entry.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </label>
      </td>
      <td style={{ padding: '12px', textAlign: 'right' }}>
        <button onClick={remove} disabled={busy === 'delete'}
          data-testid={`slot-delete-btn-${entry.id}`}
          style={{
            background: 'transparent', border: '1px solid #5a2b2b',
            color: '#C8423C', padding: '6px 12px',
            fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em',
            cursor: busy === 'delete' ? 'wait' : 'pointer',
          }}>{busy === 'delete' ? '…' : 'DELETE'}</button>
      </td>
    </tr>
  );
};

const BackOfficeSlotRegistry = () => {
  const { token, setToken, authed, authError, checkAuth } = useBackOfficeToken();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('slot');
  const [addProvider, setAddProvider] = useState('');
  const [addError, setAddError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const load = useCallback(async () => {
    if (!token || !authed) return;
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/slot-registry`, {
        headers: { 'X-Admin-Token': token },
      });
      if (r.ok) {
        const d = await r.json();
        setItems(d.items || []);
      }
    } finally { setLoading(false); }
  }, [token, authed]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((r) => filter === 'all' ? true : (filter === 'enabled' ? r.enabled : filter === 'disabled' ? !r.enabled : r.category === filter))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.provider || '').toLowerCase().includes(q));
  }, [items, filter, search]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      enabled: items.filter((r) => r.enabled).length,
      disabled: items.filter((r) => !r.enabled).length,
      slot: items.filter((r) => r.category === 'slot').length,
      live_table: items.filter((r) => r.category === 'live_table').length,
    };
  }, [items]);

  if (!authed) {
    return null; // iter84: legacy AuthGate dead-stripped (shell handles auth)
  }

  const addEntry = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!addName.trim()) { setAddError('Name required'); return; }
    const r = await fetch(`${BACKEND}/api/admin/slot-registry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      body: JSON.stringify({ name: addName.trim(), category: addCategory, provider: addProvider.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setAddError(j.detail || `HTTP ${r.status}`);
      return;
    }
    setAddName(''); setAddProvider('');
    await load();
  };

  const reseed = async () => {
    setSeeding(true); setSeedResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/slot-registry/seed`, {
        method: 'POST', headers: { 'X-Admin-Token': token },
      });
      if (r.ok) {
        const d = await r.json();
        setSeedResult(d);
      }
      await load();
    } finally { setSeeding(false); }
  };

  const FILTERS = [
    { key: 'all', label: 'ALL' },
    { key: 'enabled', label: 'ENABLED' },
    { key: 'disabled', label: 'DISABLED' },
    { key: 'slot', label: 'SLOTS' },
    { key: 'live_table', label: 'LIVE TABLES' },
  ];

  return (
    <div data-testid="back-office-slot-registry" style={{
      maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/back-office" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← BACK-OFFICE</Link>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36,
        letterSpacing: '-0.02em', color: '#FFFFFF', margin: '16px 0 8px',
      }}>Slot registry</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, maxWidth: 760, lineHeight: 1.55 }}>
        Slots and live tables tracked by the homepage Now-Playing ticker. Longest match wins -
        e.g. <code style={{ color: 'var(--ink)' }}>Sugar Rush 1000</code> matches before <code style={{ color: 'var(--ink)' }}>Sugar Rush</code>.
        Disabled entries stay in the registry as editorial record but are skipped by the matcher.
      </p>

      {/* Add row */}
      <form onSubmit={addEntry} data-testid="slot-add-form" style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap',
        padding: 14, background: 'var(--surface)', border: '1px solid var(--hairline)',
      }}>
        <input value={addName} onChange={(e) => setAddName(e.target.value)}
          placeholder="Slot or live table name" data-testid="slot-add-name"
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '1 1 280px', fontFamily: 'inherit', fontSize: 13 }} />
        <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)}
          data-testid="slot-add-category"
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 10px', fontFamily: 'inherit', fontSize: 12 }}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={addProvider} onChange={(e) => setAddProvider(e.target.value)}
          placeholder="Provider (optional)" data-testid="slot-add-provider"
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 180px', fontFamily: 'inherit', fontSize: 12 }} />
        <button type="submit" data-testid="slot-add-btn"
          style={{ padding: '8px 18px', background: '#FFFFFF', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
            fontWeight: 700, cursor: 'pointer' }}>+ ADD</button>
        <button type="button" onClick={reseed} disabled={seeding}
          data-testid="slot-reseed-btn"
          style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink)',
            border: '1px solid var(--border-strong)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
            cursor: seeding ? 'wait' : 'pointer' }}>
          {seeding ? 'SEEDING…' : '↻ RE-SEED DEFAULTS'}
        </button>
      </form>
      {addError && <div data-testid="slot-add-error" style={{ marginBottom: 12, padding: 8, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{addError}</div>}
      {seedResult && <div data-testid="slot-seed-result" style={{ marginBottom: 12, padding: 8, background: '#0e2b1a', border: '1px solid #2b5a3e', color: '#9ad4a9', fontSize: 12, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.10em' }}>SEEDED · INSERTED {seedResult.inserted} · TOTAL {seedResult.total}</div>}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} data-testid={`slot-filter-${f.key}`}
            style={{
              padding: '8px 14px', background: filter === f.key ? '#FFFFFF' : 'transparent',
              color: filter === f.key ? '#0B0A09' : 'var(--ink)',
              border: `1px solid ${filter === f.key ? '#FFFFFF' : 'var(--border-strong)'}`,
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
              fontWeight: filter === f.key ? 700 : 400, cursor: 'pointer',
            }}>
            {f.label} <span style={{ opacity: 0.6, marginLeft: 6 }}>{counts[f.key] ?? 0}</span>
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search name or provider…"
          data-testid="slot-search-input"
          style={{ marginLeft: 'auto', background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 240px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
      </div>

      {loading ? <div data-testid="slot-loading">LOADING…</div> : filtered.length === 0 ? (
        <div data-testid="slot-empty" style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', padding: 32, textAlign: 'center', border: '1px dashed var(--border)' }}>
          NO ENTRIES MATCH THIS FILTER.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="slot-table">
          <thead>
            <tr style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ padding: 12 }}>NAME</th>
              <th style={{ padding: 12 }}>CATEGORY</th>
              <th style={{ padding: 12 }}>PROVIDER</th>
              <th style={{ padding: 12, textAlign: 'center' }}>STATE</th>
              <th style={{ padding: 12, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <Row key={e.id} entry={e} token={token} onChanged={load} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BackOfficeSlotRegistry;
