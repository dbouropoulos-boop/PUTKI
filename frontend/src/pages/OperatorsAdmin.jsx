import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Plus, Save, Trash2, Calendar } from 'lucide-react';

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

const RotationCalendar = ({ token, partnerOperators }) => {
  const [data, setData] = useState({ weeks: [], stats: {}, current_iso_week: '', next_iso_weeks: [] });
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState({}); // iso_week -> draft

  const headers = () => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/voyager/weeks`, { headers: { 'X-Admin-Token': token } });
      if (!r.ok) return;
      const d = await r.json();
      setData(d);
    } catch {}
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const draftFor = (iso) => editing[iso] || data.weeks.find((w) => w.iso_week === iso) || {
    iso_week: iso, market_id: 'FI', partner_operator_slug: '', theme: '',
    prize_summary: '', smartico_template_id: '', notes: '', status: 'planned',
  };

  const setDraft = (iso, patch) => setEditing((e) => ({ ...e, [iso]: { ...draftFor(iso), ...patch } }));

  const save = async (iso) => {
    const draft = draftFor(iso);
    setBusy(iso);
    try {
      const r = await fetch(`${BACKEND}/api/admin/voyager/weeks/${iso}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(draft),
      });
      if (!r.ok) {
        const msg = await r.text();
        alert(`Save failed: ${msg.slice(0, 300)}`);
        return;
      }
      setEditing((e) => { const c = { ...e }; delete c[iso]; return c; });
      await refresh();
    } finally { setBusy(null); }
  };

  const remove = async (iso) => {
    if (!window.confirm(`Delete week ${iso}?`)) return;
    await fetch(`${BACKEND}/api/admin/voyager/weeks/${iso}?market_id=FI`, { method: 'DELETE', headers: headers() });
    await refresh();
  };

  // Merge: take next_iso_weeks scaffold, overlay any existing rows.
  const upcomingRows = (data.next_iso_weeks || []).map((iso) => {
    const existing = data.weeks.find((w) => w.iso_week === iso);
    return existing || { iso_week: iso, _new: true };
  });
  const pastRows = (data.weeks || []).filter((w) => w.iso_week < (data.current_iso_week || '')).reverse();

  const statusColor = (s) => s === 'live' ? '#3B7A57' : s === 'archived' ? 'var(--muted)' : '#E8924A';

  return (
    <section className="mt-10" data-testid="rotation-calendar">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="eyebrow inline-flex items-center gap-2">
            <Calendar strokeWidth={1.5} size={13} /> VOYAGER ROTATION · {data.stats?.total || 0} WEEKS · CURRENT {data.current_iso_week}
          </div>
          <h2 className="display text-2xl mt-1">Voyager rotation calendar</h2>
        </div>
        <button onClick={refresh} className="btn-ghost" data-testid="rotation-refresh">
          <RefreshCw strokeWidth={1.5} size={13} className="mr-2" /> REFRESH
        </button>
      </div>

      <div className="panel p-3 mb-3" data-testid="rotation-stats">
        <div className="mono flex flex-wrap gap-4" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700 }}>
          <span>TOTAL · {data.stats?.total || 0}</span>
          <span style={{ color: '#E8924A' }}>PLANNED · {data.stats?.planned || 0}</span>
          <span style={{ color: '#3B7A57' }}>LIVE · {data.stats?.live || 0}</span>
          <span>ARCHIVED · {data.stats?.archived || 0}</span>
        </div>
      </div>

      <div className="eyebrow mb-2 mt-5">NEXT 12 WEEKS</div>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="rotation-upcoming-table" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
              {['ISO WEEK', 'PARTNER OPERATOR', 'THEME', 'PRIZE SUMMARY', 'SMARTICO TEMPLATE', 'STATUS', ''].map((h) => (
                <th key={h} className="mono py-2 px-2 text-left" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upcomingRows.map((row) => {
              const draft = draftFor(row.iso_week);
              const isCurrent = row.iso_week === data.current_iso_week;
              return (
                <tr key={row.iso_week} data-testid={`rotation-row-${row.iso_week}`} style={{ borderBottom: '1px solid var(--border)', background: isCurrent ? 'var(--surface)' : 'transparent' }}>
                  <td className="py-2 px-2 mono" style={{ fontSize: 11.5, letterSpacing: '0.06em', color: isCurrent ? '#E8924A' : 'var(--ink)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.iso_week}{isCurrent && ' · NYT'}
                  </td>
                  <td className="py-2 px-2">
                    <select value={draft.partner_operator_slug || ''} onChange={(e) => setDraft(row.iso_week, { partner_operator_slug: e.target.value })} data-testid={`rotation-partner-${row.iso_week}`} className="mono" style={{ padding: '6px 8px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 3, minWidth: 140 }}>
                      <option value="">— select partner —</option>
                      {partnerOperators.map((op) => (
                        <option key={op.slug} value={op.slug}>{op.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input value={draft.theme || ''} onChange={(e) => setDraft(row.iso_week, { theme: e.target.value })} data-testid={`rotation-theme-${row.iso_week}`} placeholder="Theme" className="mono" style={{ padding: '6px 8px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 3, minWidth: 160, width: '100%' }} />
                  </td>
                  <td className="py-2 px-2">
                    <input value={draft.prize_summary || ''} onChange={(e) => setDraft(row.iso_week, { prize_summary: e.target.value })} data-testid={`rotation-prize-${row.iso_week}`} placeholder="Prize" className="mono" style={{ padding: '6px 8px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 3, minWidth: 140, width: '100%' }} />
                  </td>
                  <td className="py-2 px-2">
                    <input value={draft.smartico_template_id || ''} onChange={(e) => setDraft(row.iso_week, { smartico_template_id: e.target.value })} data-testid={`rotation-tpl-${row.iso_week}`} placeholder="Optional" className="mono" style={{ padding: '6px 8px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 3, minWidth: 120 }} />
                  </td>
                  <td className="py-2 px-2">
                    <select value={draft.status || 'planned'} onChange={(e) => setDraft(row.iso_week, { status: e.target.value })} data-testid={`rotation-status-${row.iso_week}`} className="mono" style={{ padding: '6px 8px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: statusColor(draft.status), fontSize: 11, borderRadius: 3, fontWeight: 700 }}>
                      <option value="planned">planned</option>
                      <option value="live">live</option>
                      <option value="archived">archived</option>
                    </select>
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <button onClick={() => save(row.iso_week)} disabled={busy === row.iso_week || !draft.partner_operator_slug} className="btn-ghost" data-testid={`rotation-save-${row.iso_week}`}>
                      <Save strokeWidth={1.6} size={12} className="mr-1" /> {busy === row.iso_week ? '…' : 'SAVE'}
                    </button>
                    {!row._new && (
                      <button onClick={() => remove(row.iso_week)} className="btn-ghost ml-2" data-testid={`rotation-delete-${row.iso_week}`} style={{ color: '#C8423C' }}>
                        <Trash2 strokeWidth={1.5} size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pastRows.length > 0 && (
        <>
          <div className="eyebrow mt-7 mb-2">ARCHIVE · PAST WEEKS</div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="rotation-past-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                  {['ISO WEEK', 'PARTNER', 'THEME', 'STATUS', 'ARCHIVE LINK'].map((h) => (
                    <th key={h} className="mono py-2 px-2 text-left" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastRows.map((row) => (
                  <tr key={row.iso_week} style={{ borderBottom: '1px solid var(--border)' }} data-testid={`rotation-past-row-${row.iso_week}`}>
                    <td className="py-2 px-2 mono" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--muted)' }}>{row.iso_week}</td>
                    <td className="py-2 px-2 mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{row.partner_operator_slug || '—'}</td>
                    <td className="py-2 px-2 font-serif" style={{ fontSize: 13, color: 'var(--ink)' }}>{row.theme || '—'}</td>
                    <td className="py-2 px-2 mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: statusColor(row.status), fontWeight: 700 }}>{(row.status || '').toUpperCase()}</td>
                    <td className="py-2 px-2 mono" style={{ fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--brand-blue)' }}>
                      /voita-palkinto/arkisto/{row.iso_week}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

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
            <div className="eyebrow mb-3">{selected ? 'EDIT OPERATOR' : 'NEW OPERATOR'}</div>            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <RotationCalendar token={token} partnerOperators={operators.filter((o) => o.partner && o.active !== false)} />
      </div>
    </div>
  );
};

export default OperatorsAdmin;
