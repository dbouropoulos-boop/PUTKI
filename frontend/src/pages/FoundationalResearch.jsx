import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Plus, Save, Trash2, Upload } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Phase 3 V2 — Foundational research admin surface (§seed-scheduler track).
// The editorial scheduler reads from this collection to surface topics. It
// sits empty by design until the user populates it with structured datasets.

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('mittari-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('mittari-admin-token', v); } catch {} }];
};

const emptyEntry = () => ({
  id: '',
  topic_area: '',
  beat: 'scene',
  sub_beat: '',
  editorial_angle: '',
  key_facts: [],
  named_sources_cited: [],
  applicable_content_types: [],
  freshness_window_days: 90,
  active: true,
});

const FoundationalResearch = () => {
  const [token, setToken] = useToken();
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, by_beat: {} });
  const [validBeats, setValidBeats] = useState([]);
  const [contentTypeToBeats, setContentTypeToBeats] = useState({});
  const [filterBeat, setFilterBeat] = useState('');
  const [filterContentType, setFilterContentType] = useState('');
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyEntry());
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token }),
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const qs = new URLSearchParams();
    if (filterBeat) qs.set('beat', filterBeat);
    if (filterContentType) qs.set('content_type', filterContentType);
    qs.set('limit', '500');
    const r = await fetch(`${BACKEND}/api/admin/foundational-research?${qs.toString()}`, { headers: headers() });
    if (!r.ok) { setAuthError('Wrong token'); setAuthed(false); return; }
    const d = await r.json();
    setEntries(d.entries || []);
    setStats(d.stats || {});
    setValidBeats(d.valid_beats || []);
    setContentTypeToBeats(d.content_type_to_beats || {});
    setAuthed(true);
    setAuthError('');
  }, [token, filterBeat, filterContentType, headers]);

  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);

  const handleAuth = (e) => { e.preventDefault(); refresh(); };

  const startNew = () => { setSelected(null); setDraft(emptyEntry()); };
  const startEdit = (entry) => { setSelected(entry.id); setDraft({ ...entry, key_facts: entry.key_facts || [] }); };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...draft };
      let url = `${BACKEND}/api/admin/foundational-research`;
      let method = 'POST';
      if (selected) {
        url = `${BACKEND}/api/admin/foundational-research/${selected}`;
        method = 'PUT';
      }
      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await r.text());
      await refresh();
      startNew();
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this research entry?')) return;
    await fetch(`${BACKEND}/api/admin/foundational-research/${id}`, { method: 'DELETE', headers: headers() });
    if (selected === id) startNew();
    refresh();
  };

  const bulkImport = async () => {
    setBulkBusy(true); setBulkMsg('');
    try {
      const parsed = JSON.parse(bulkText);
      const arr = Array.isArray(parsed) ? parsed : parsed.entries;
      const r = await fetch(`${BACKEND}/api/admin/foundational-research/bulk`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ entries: arr }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setBulkMsg(`Imported ${d.imported} entries.`);
      await refresh();
    } catch (e) {
      setBulkMsg(`Import failed: ${e.message}`);
    } finally {
      setBulkBusy(false);
    }
  };

  const updateFact = (idx, patch) => {
    const next = [...(draft.key_facts || [])];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, key_facts: next });
  };
  const addFact = () => setDraft({
    ...draft,
    key_facts: [...(draft.key_facts || []), { fact: '', source_attribution: '', verified_date: new Date().toISOString().slice(0, 10), confidence: 'medium', url: '' }],
  });
  const removeFact = (idx) => setDraft({ ...draft, key_facts: (draft.key_facts || []).filter((_, i) => i !== idx) });

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <form onSubmit={handleAuth} className="panel w-full max-w-md p-7" data-testid="research-auth-form">
          <div className="flex items-center gap-3 mb-6">
            <Lock strokeWidth={1.5} size={20} style={{ color: 'var(--muted)' }} />
            <div>
              <div className="eyebrow">MITTARI · FOUNDATIONAL RESEARCH</div>
              <h1 className="display text-2xl mt-1">Admin authentication</h1>
            </div>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            data-testid="research-auth-token"
            placeholder="Admin token"
            className="mono w-full"
            style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13 }}
            required
          />
          {authError && <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C' }}>{authError}</div>}
          <button type="submit" className="btn-primary w-full mt-5" data-testid="research-auth-submit">CONTINUE →</button>
          <Link to="/" className="btn-ghost mt-4 w-full justify-center">← Back to Mittari</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }} data-testid="research-page">
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
          <div>
            <div className="eyebrow">MITTARI · FOUNDATIONAL RESEARCH STORE</div>
            <h1 className="display text-3xl sm:text-4xl mt-1">Editorial knowledge base</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setBulkOpen((v) => !v)} className="btn-secondary" data-testid="research-bulk-toggle">
              <Upload strokeWidth={1.5} size={13} className="mr-2" /> BULK IMPORT
            </button>
            <Link to="/back-office/queue" className="btn-ghost">← QUEUE</Link>
            <Link to="/back-office" className="btn-ghost">SETTINGS</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-5">
          <div className="panel" style={{ padding: '14px 18px' }} data-testid="research-stats-total">
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700 }}>TOTAL</div>
            <div className="mono mt-1" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{stats.total || 0}</div>
          </div>
          <div className="panel" style={{ padding: '14px 18px' }}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: '#3B7A57', fontWeight: 700 }}>ACTIVE</div>
            <div className="mono mt-1" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{stats.active || 0}</div>
          </div>
          <div className="panel sm:col-span-2" style={{ padding: '14px 18px' }}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>BY BEAT</div>
            <div className="mono mt-1" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--ink)' }}>
              {Object.entries(stats.by_beat || {}).map(([k, v]) => `${k}:${v}`).join(' · ')}
            </div>
          </div>
        </div>

        {/* Bulk import panel */}
        {bulkOpen && (
          <div className="panel p-5 mb-5" data-testid="research-bulk-panel">
            <div className="eyebrow mb-2">BULK IMPORT · JSON ARRAY OR {`{entries:[…]}`}</div>
            <p className="mono mb-3" style={{ fontSize: 11, color: 'var(--muted)' }}>
              Each entry: {`{topic_area, beat, sub_beat?, editorial_angle, key_facts:[{fact, source_attribution, verified_date, confidence, url?}], named_sources_cited:[…], applicable_content_types:[…], freshness_window_days?, active?}`}
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              data-testid="research-bulk-textarea"
              rows={10}
              placeholder='[{"topic_area":"Veikkaus sponsorship", "beat":"sponsorship", "editorial_angle":"…", "key_facts":[{"fact":"…", "source_attribution":"Veikkaus Newsroom", "verified_date":"2026-05-01", "confidence":"high"}], "named_sources_cited":["veikkaus_news"], "applicable_content_types":["sponsorship_update"]}]'
              className="mono w-full"
              style={{ padding: 12, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11.5, borderRadius: 4 }}
            />
            <div className="flex gap-2 mt-3 items-center flex-wrap">
              <button onClick={bulkImport} disabled={bulkBusy || !bulkText.trim()} className="btn-primary" data-testid="research-bulk-submit">
                {bulkBusy ? 'IMPORTING…' : 'IMPORT →'}
              </button>
              {bulkMsg && <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{bulkMsg}</span>}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="panel p-4 mb-5 flex items-center gap-3 flex-wrap">
          <span className="eyebrow">FILTER</span>
          <select value={filterBeat} onChange={(e) => setFilterBeat(e.target.value)} data-testid="research-filter-beat" className="mono" style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }}>
            <option value="">ALL BEATS</option>
            {validBeats.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterContentType} onChange={(e) => setFilterContentType(e.target.value)} data-testid="research-filter-content-type" className="mono" style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }}>
            <option value="">ALL CONTENT TYPES</option>
            {Object.keys(contentTypeToBeats).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={refresh} className="btn-ghost" data-testid="research-refresh">
            <RefreshCw strokeWidth={1.5} size={13} className="mr-2" /> REFRESH
          </button>
          <button onClick={startNew} className="btn-primary ml-auto" data-testid="research-new">
            <Plus strokeWidth={1.6} size={13} className="mr-2" /> NEW ENTRY
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* List */}
          <div className="space-y-3" data-testid="research-list">
            {entries.length === 0 ? (
              <div className="panel p-7 text-center mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }} data-testid="research-empty">
                NO ENTRIES — POPULATE WITH STRUCTURED DATASETS. SCHEDULER STAYS QUIET UNTIL POPULATED.
              </div>
            ) : entries.map((e) => (
              <div key={e.id} className="panel p-4" data-testid={`research-row-${e.id}`} style={{ borderColor: selected === e.id ? 'var(--ink)' : 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
                      {e.beat.toUpperCase()}{e.sub_beat ? ` · ${e.sub_beat}` : ''}
                    </div>
                    <h3 className="font-display mt-1" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                      {e.topic_area}
                    </h3>
                    <p className="font-serif mt-2" style={{ fontSize: 13, color: 'var(--muted)' }}>{e.editorial_angle}</p>
                    <div className="mono mt-2" style={{ fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                      {(e.key_facts || []).length} FACTS · {(e.applicable_content_types || []).length} CTs · {e.active ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => startEdit(e)} className="btn-ghost" data-testid={`research-edit-${e.id}`}>EDIT</button>
                    <button onClick={() => remove(e.id)} className="btn-ghost" data-testid={`research-delete-${e.id}`} style={{ color: '#C8423C' }}>
                      <Trash2 strokeWidth={1.5} size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="panel p-5" data-testid="research-editor">
            <div className="eyebrow mb-3">{selected ? 'EDIT ENTRY' : 'NEW ENTRY'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>TOPIC AREA</span>
                <input value={draft.topic_area} onChange={(e) => setDraft({ ...draft, topic_area: e.target.value })} data-testid="research-input-topic" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>BEAT</span>
                <select value={draft.beat} onChange={(e) => setDraft({ ...draft, beat: e.target.value })} data-testid="research-input-beat" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}>
                  {validBeats.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>SUB-BEAT</span>
                <input value={draft.sub_beat || ''} onChange={(e) => setDraft({ ...draft, sub_beat: e.target.value })} data-testid="research-input-subbeat" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>FRESHNESS DAYS</span>
                <input type="number" value={draft.freshness_window_days} onChange={(e) => setDraft({ ...draft, freshness_window_days: Number(e.target.value) })} className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>EDITORIAL ANGLE</span>
                <textarea value={draft.editorial_angle} onChange={(e) => setDraft({ ...draft, editorial_angle: e.target.value })} data-testid="research-input-angle" rows={2} className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>NAMED SOURCES (comma-separated keys)</span>
                <input value={(draft.named_sources_cited || []).join(', ')} onChange={(e) => setDraft({ ...draft, named_sources_cited: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>APPLICABLE CONTENT TYPES (comma-separated)</span>
                <input value={(draft.applicable_content_types || []).join(', ')} onChange={(e) => setDraft({ ...draft, applicable_content_types: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow">KEY FACTS</span>
                <button onClick={addFact} className="btn-ghost" data-testid="research-add-fact">
                  <Plus strokeWidth={1.6} size={12} className="mr-1" /> ADD FACT
                </button>
              </div>
              <div className="space-y-2">
                {(draft.key_facts || []).map((f, idx) => (
                  <div key={idx} className="panel" style={{ padding: 12 }} data-testid={`research-fact-${idx}`}>
                    <textarea value={f.fact} onChange={(e) => updateFact(idx, { fact: e.target.value })} placeholder="Fact" rows={2} className="mono w-full mb-2" style={{ padding: 8, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input value={f.source_attribution || ''} onChange={(e) => updateFact(idx, { source_attribution: e.target.value })} placeholder="Source" className="mono w-full" style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }} />
                      <input value={f.verified_date || ''} onChange={(e) => updateFact(idx, { verified_date: e.target.value })} placeholder="YYYY-MM-DD" className="mono w-full" style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }} />
                      <select value={f.confidence || 'medium'} onChange={(e) => updateFact(idx, { confidence: e.target.value })} className="mono w-full" style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }}>
                        <option value="high">high</option>
                        <option value="medium">medium</option>
                        <option value="low">low</option>
                      </select>
                    </div>
                    <input value={f.url || ''} onChange={(e) => updateFact(idx, { url: e.target.value })} placeholder="URL (optional)" className="mono w-full mt-2" style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }} />
                    <button onClick={() => removeFact(idx)} className="btn-ghost mt-2" style={{ color: '#C8423C' }} data-testid={`research-remove-fact-${idx}`}>
                      <Trash2 strokeWidth={1.5} size={12} className="mr-1" /> REMOVE
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-5 flex-wrap">
              <button onClick={save} disabled={saving || !draft.topic_area.trim()} className="btn-primary" data-testid="research-save">
                <Save strokeWidth={1.6} size={13} className="mr-2" /> {saving ? 'SAVING…' : (selected ? 'SAVE CHANGES' : 'CREATE ENTRY')}
              </button>
              {selected && (
                <button onClick={startNew} className="btn-ghost" data-testid="research-cancel">CANCEL</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoundationalResearch;
