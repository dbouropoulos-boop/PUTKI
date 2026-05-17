import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Plus, Save, Trash2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 Step 1 — Operators registry admin surface.
// Replaces mock.js OPERATORS. CRUD through /api/admin/operators.

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('mittari-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('mittari-admin-token', v); } catch {} }];
};

const emptyOp = () => ({
  slug: '', name: '', logo: '', score: 70, oneLiner: '', offer: '', payout: '', license: 'MGA',
  trustpilot: 4.0, year: new Date().getFullYear(), partner: false, active: true, market_id: 'FI',
});

const OperatorsAdmin = () => {
  const [token, setToken] = useToken();
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [operators, setOperators] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyOp());
  const [saving, setSaving] = useState(false);

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token }),
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/operators`, { headers: headers() });
      if (!r.ok) { setError('Wrong token'); setAuthed(false); return; }
      const d = await r.json();
      setOperators(d.operators || []);
      setAuthed(true);
      setError('');
    } catch (e) { setError(String(e)); }
  }, [token, headers]);

  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);

  const startEdit = (op) => { setSelected(op.slug); setDraft({ ...op }); };
  const startNew = () => { setSelected(null); setDraft(emptyOp()); };

  const save = async () => {
    if (!draft.slug.trim() || !draft.name.trim()) { alert('slug + name required'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/operators/${draft.slug}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error(await r.text());
      await refresh();
      startNew();
    } catch (e) { alert(`Save failed: ${e.message}`); }
    finally { setSaving(false); }
  };

  const remove = async (slug) => {
    if (!window.confirm(`Delete ${slug}?`)) return;
    await fetch(`${BACKEND}/api/admin/operators/${slug}`, { method: 'DELETE', headers: headers() });
    if (selected === slug) startNew();
    refresh();
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <form onSubmit={(e) => { e.preventDefault(); refresh(); }} className="panel w-full max-w-md p-7">
          <div className="flex items-center gap-3 mb-6">
            <Lock strokeWidth={1.5} size={20} style={{ color: 'var(--muted)' }} />
            <div>
              <div className="eyebrow">MITTARI · OPERATORS REGISTRY</div>
              <h1 className="display text-2xl mt-1">Admin authentication</h1>
            </div>
          </div>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} data-testid="op-auth-token" placeholder="Admin token" className="mono w-full" style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13 }} required />
          {error && <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C' }}>{error}</div>}
          <button type="submit" className="btn-primary w-full mt-5" data-testid="op-auth-submit">CONTINUE →</button>
          <Link to="/" className="btn-ghost mt-4 w-full justify-center">← Back to Mittari</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }} data-testid="operators-admin-page">
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="eyebrow">MITTARI · OPERATORS REGISTRY · {operators.length}</div>
            <h1 className="display text-3xl mt-1">Operators</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={refresh} className="btn-ghost" data-testid="op-refresh"><RefreshCw strokeWidth={1.5} size={13} className="mr-2" /> REFRESH</button>
            <button onClick={startNew} className="btn-primary" data-testid="op-new"><Plus strokeWidth={1.6} size={13} className="mr-2" /> NEW</button>
            <Link to="/back-office/streamers" className="btn-ghost">STREAMERS →</Link>
            <Link to="/back-office/queue" className="btn-ghost">QUEUE</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3" data-testid="op-list">
            {operators.map((op) => (
              <div key={op.slug} className="panel p-4" data-testid={`op-row-${op.slug}`} style={{ borderColor: selected === op.slug ? 'var(--ink)' : 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: op.partner ? '#E8924A' : 'var(--muted)', fontWeight: 700 }}>
                      {op.partner ? 'PARTNER · ' : ''}{op.license} · {op.year}
                    </div>
                    <h3 className="font-display mt-1" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{op.name} · {op.score}</h3>
                    <p className="font-serif mt-1" style={{ fontSize: 13, color: 'var(--muted)' }}>{op.oneLiner}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => startEdit(op)} className="btn-ghost" data-testid={`op-edit-${op.slug}`}>EDIT</button>
                    <button onClick={() => remove(op.slug)} className="btn-ghost" data-testid={`op-delete-${op.slug}`} style={{ color: '#C8423C' }}><Trash2 strokeWidth={1.5} size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="panel p-5" data-testid="op-editor">
            <div className="eyebrow mb-3">{selected ? 'EDIT OPERATOR' : 'NEW OPERATOR'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['slug', 'SLUG (lowercase, unique)'],
                ['name', 'NAME'],
                ['logo', 'LOGO LETTER'],
                ['score', 'SCORE 0–100', 'number'],
                ['oneLiner', 'ONE-LINER'],
                ['offer', 'OFFER'],
                ['payout', 'PAYOUT'],
                ['license', 'LICENSE'],
                ['trustpilot', 'TRUSTPILOT', 'number'],
                ['year', 'YEAR', 'number'],
              ].map(([key, label, type]) => (
                <label key={key} className="block">
                  <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>{label}</span>
                  <input
                    type={type || 'text'}
                    step={type === 'number' && key === 'trustpilot' ? '0.1' : '1'}
                    value={draft[key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                    data-testid={`op-input-${key}`}
                    className="mono w-full"
                    style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>PARTNER</span>
                <select value={draft.partner ? '1' : '0'} onChange={(e) => setDraft({ ...draft, partner: e.target.value === '1' })} data-testid="op-input-partner" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}>
                  <option value="0">no</option>
                  <option value="1">yes</option>
                </select>
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>ACTIVE</span>
                <select value={draft.active ? '1' : '0'} onChange={(e) => setDraft({ ...draft, active: e.target.value === '1' })} data-testid="op-input-active" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}>
                  <option value="1">yes</option>
                  <option value="0">no</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} disabled={saving} className="btn-primary" data-testid="op-save">
                <Save strokeWidth={1.6} size={13} className="mr-2" /> {saving ? 'SAVING…' : 'SAVE'}
              </button>
              {selected && <button onClick={startNew} className="btn-ghost" data-testid="op-cancel">CANCEL</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorsAdmin;
