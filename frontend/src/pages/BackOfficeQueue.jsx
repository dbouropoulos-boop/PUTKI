import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Sparkles, Check, X, Pencil, Edit3, FileText, Save } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Phase 3 unified approval queue back-office.
// Token-protected (X-Admin-Token), MVP per Phase 3 brief — single approve/edit/kill per item, 3 variants visible, guidelines editor inline.

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('putki-hq-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('putki-hq-admin-token', v); } catch {} }];
};

const TimeAgo = ({ iso }) => {
  if (!iso) return <span>—</span>;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return <span>{diff}s sitten</span>;
  if (diff < 3600) return <span>{Math.floor(diff / 60)}min sitten</span>;
  if (diff < 86400) return <span>{Math.floor(diff / 3600)}h sitten</span>;
  return <span>{Math.floor(diff / 86400)}pv sitten</span>;
};

const QueueItem = ({ item, onApprove, onKill, onEdit, busy }) => {
  const [variantIdx, setVariantIdx] = useState(item.selected_variant_index || 0);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(
    (item.generated_variants?.[item.selected_variant_index || 0] || {}).text || item.generated_text || ''
  );

  const variants = item.generated_variants || [{ text: item.generated_text }];
  const isAuto = !item.approval_required && false; // queued items are by definition approval-required

  const handleApprove = () => onApprove(item.id, { selected_variant_index: variantIdx });
  const handleEditApprove = () => onEdit(item.id, { selected_variant_index: variantIdx, edited_text: editText });
  const handleKill = () => onKill(item.id);

  return (
    <div className="panel p-5 sm:p-6" data-testid={`queue-item-${item.id}`}>
      <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="eyebrow inline-flex items-center gap-2">
            <span className="led" style={{ background: '#E8924A' }} />
            {item.content_type.toUpperCase().replace(/_/g, ' ')}
          </div>
          <div className="mono mt-1" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
            <TimeAgo iso={item.generated_at} /> ·
            <span style={{ marginLeft: 8 }}>SOURCE: {item.source_signal_type || 'manual'}</span> ·
            <span style={{ marginLeft: 8 }}>SURFACE: {item.proposed_publication_surface}</span>
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>
          ID · {item.id.slice(0, 8)}
        </div>
      </div>

      {/* Signal payload */}
      {item.signal_payload && Object.keys(item.signal_payload).length > 0 && (
        <details className="mb-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <summary className="mono cursor-pointer" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700 }}>
            SIGNAL PAYLOAD
          </summary>
          <pre className="mono mt-2" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
            {JSON.stringify(item.signal_payload, null, 2)}
          </pre>
        </details>
      )}

      {/* Variants */}
      <div className="space-y-3 mb-5">
        {variants.map((v, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => { setVariantIdx(idx); setEditText(v.text); }}
            data-testid={`queue-variant-${item.id}-${idx}`}
            className="block w-full text-left panel"
            style={{
              padding: '14px 18px',
              borderColor: idx === variantIdx ? 'var(--ink)' : 'var(--border)',
              background: idx === variantIdx ? 'var(--surface-2)' : 'var(--bg)',
              cursor: 'pointer',
            }}
          >
            <div className="mono mb-2" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: idx === variantIdx ? '#E8924A' : 'var(--muted)', fontWeight: 700 }}>
              VARIANT {idx + 1}{idx === variantIdx ? ' · SELECTED' : ''}
            </div>
            <p className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)' }}>
              {v.text}
            </p>
          </button>
        ))}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="panel p-4 mb-4" style={{ background: 'var(--surface-2)' }}>
          <label className="eyebrow mb-2 block">EDIT BEFORE PUBLISH</label>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            data-testid={`queue-edit-textarea-${item.id}`}
            rows={4}
            className="mono w-full"
            style={{ padding: '12px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.5 }}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleEditApprove} disabled={busy} className="btn-primary" data-testid={`queue-edit-save-${item.id}`}>
              <Save strokeWidth={1.6} size={13} className="mr-2" /> SAVE & APPROVE
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary" data-testid={`queue-edit-cancel-${item.id}`}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Distribution targets */}
      <div className="mono mb-5" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
        DISTRIBUTION · {(item.distribution_targets || []).map((d) => d.toUpperCase()).join(' · ')}
      </div>

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2 flex-wrap" data-testid={`queue-actions-${item.id}`}>
          <button onClick={handleApprove} disabled={busy} className="btn-primary" data-testid={`queue-approve-${item.id}`}>
            <Check strokeWidth={1.8} size={14} className="mr-2" /> APPROVE
          </button>
          <button onClick={() => setEditing(true)} disabled={busy} className="btn-secondary" data-testid={`queue-edit-${item.id}`}>
            <Pencil strokeWidth={1.6} size={13} className="mr-2" /> EDIT
          </button>
          <button onClick={handleKill} disabled={busy} className="btn-ghost" data-testid={`queue-kill-${item.id}`}>
            <X strokeWidth={1.6} size={14} className="mr-2" /> KILL
          </button>
        </div>
      )}
    </div>
  );
};

const GenerateForm = ({ token, onGenerated, contentTypes }) => {
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState('moment_commentary');
  const [payload, setPayload] = useState(JSON.stringify({
    streamer_name: 'AndyPyro',
    game: 'Fire in the Hole 2',
    amount: '€42 800',
    event_type: 'big_win',
    source_url: 'https://youtube.com/watch?v=example',
  }, null, 2));
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const parsed = JSON.parse(payload);
      const r = await fetch(`${BACKEND}/api/admin/queue/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ content_type: type, signal_payload: parsed }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`${r.status}: ${txt}`);
      }
      const doc = await r.json();
      onGenerated(doc);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel p-5 mb-5" data-testid="queue-generate-form">
      <div className="eyebrow mb-3 inline-flex items-center gap-2">
        <Sparkles strokeWidth={1.5} size={12} /> SEED A NEW SIGNAL · CALLS CLAUDE
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700 }}>CONTENT TYPE</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            data-testid="queue-generate-type"
            className="mono w-full"
            style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}
          >
            {contentTypes.map((c) => (
              <option key={c.key} value={c.key}>{c.key}{c.approval_required ? '' : ' (auto)'}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700 }}>SIGNAL PAYLOAD (JSON)</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            data-testid="queue-generate-payload"
            rows={5}
            className="mono w-full"
            style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11.5, borderRadius: 4 }}
          />
        </div>
      </div>
      {error && (
        <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.06em' }}>{error}</div>
      )}
      <button type="submit" disabled={busy} className="btn-primary mt-4" data-testid="queue-generate-submit">
        {busy ? 'GENERATING…' : 'GENERATE WITH CLAUDE →'}
      </button>
    </form>
  );
};

const GuidelinesPanel = ({ token, onClose }) => {
  const [guidelines, setGuidelines] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/admin/guidelines`, { headers: { 'X-Admin-Token': token } })
      .then((r) => r.json())
      .then((d) => {
        setGuidelines(d.guidelines || []);
        if (d.guidelines?.[0]) {
          setActiveKey(d.guidelines[0].key);
          setEditText(d.guidelines[0].text);
        }
      });
  }, [token]);

  const select = (g) => { setActiveKey(g.key); setEditText(g.text); };

  const save = async () => {
    if (!activeKey) return;
    setSaving(true);
    try {
      await fetch(`${BACKEND}/api/admin/guidelines/${activeKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ text: editText }),
      });
      setGuidelines((prev) => prev.map((g) => (g.key === activeKey ? { ...g, text: editText, updated_at: new Date().toISOString() } : g)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose} data-testid="guidelines-modal">
      <div className="absolute inset-x-0 top-10 mx-auto max-w-5xl px-5" onClick={(e) => e.stopPropagation()}>
        <div className="panel p-5 sm:p-6" style={{ background: 'var(--bg)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="eyebrow inline-flex items-center gap-2">
                <FileText strokeWidth={1.5} size={12} /> EDITORIAL GUIDELINES
              </div>
              <h2 className="display text-2xl mt-1">PUTKI HQ voice + per-type prompts</h2>
            </div>
            <button onClick={onClose} className="btn-ghost" data-testid="guidelines-close">CLOSE</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              {guidelines.map((g) => (
                <button
                  key={g.key}
                  onClick={() => select(g)}
                  data-testid={`guideline-key-${g.key}`}
                  className="mono block w-full text-left"
                  style={{
                    padding: '10px 12px', borderRadius: 4,
                    background: g.key === activeKey ? 'var(--ink)' : 'var(--surface)',
                    color: g.key === activeKey ? 'var(--bg)' : 'var(--ink)',
                    fontSize: 11, letterSpacing: '0.08em', fontWeight: 600,
                  }}
                >
                  {g.key}
                </button>
              ))}
            </div>
            <div className="md:col-span-3">
              {activeKey && (
                <>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    data-testid="guideline-textarea"
                    rows={20}
                    className="mono w-full"
                    style={{ padding: 14, borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.55 }}
                  />
                  <button onClick={save} disabled={saving} className="btn-primary mt-3" data-testid="guideline-save">
                    {saving ? 'SAVING…' : 'SAVE GUIDELINE'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SignalPipelineStatus = ({ token }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/signals?limit=200`, { headers: { 'X-Admin-Token': token } });
      if (!r.ok) return;
      setData(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const triggerPoll = async () => {
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/admin/signals/poll`, { method: 'POST', headers: { 'X-Admin-Token': token } });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;
  const { signals = [], counts = {} } = data;
  const sources = ['twitch', 'kick', 'youtube', 'forum', 'sports', 'internal'];
  const liveByCat = sources.reduce((acc, src) => {
    const recent = signals.filter((s) => s.source === src);
    const real = recent.filter((s) => !s.mocked).length;
    acc[src] = { total: counts[src] || 0, recent: recent.length, real, mocked: recent.length - real };
    return acc;
  }, {});

  return (
    <div className="panel p-5 mb-5" data-testid="signal-pipeline-status">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="eyebrow inline-flex items-center gap-2">
          <span className="led" style={{ background: '#5A7BB8' }} /> SIGNAL PIPELINE · LIVE
        </div>
        <button onClick={triggerPoll} disabled={busy} className="btn-ghost" data-testid="signal-pipeline-poll">
          {busy ? 'POLLING…' : 'FORCE POLL →'}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {sources.map((src) => {
          const c = liveByCat[src];
          const isLive = c.real > 0;
          const isMockedOnly = c.recent > 0 && c.real === 0;
          const color = isLive ? '#3B7A57' : isMockedOnly ? '#7A7E83' : '#3B3F44';
          return (
            <div key={src} className="panel" style={{ padding: '12px 14px', borderColor: color }} data-testid={`signal-source-${src}`}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color, fontWeight: 700 }}>
                {src.toUpperCase()}{isMockedOnly && ' · MOCKED'}{isLive && ' · LIVE'}
              </div>
              <div className="mono mt-1" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                {c.recent}
              </div>
              <div className="mono mt-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                {c.real} REAL · {c.mocked} MOCK · {c.total} TOTAL
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScheduleStatus = ({ token }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/scheduler/status`, { headers: { 'X-Admin-Token': token } });
      if (!r.ok) return;
      setData(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [refresh]);

  const fire = async (ct) => {
    setBusy(ct);
    try {
      await fetch(`${BACKEND}/api/admin/scheduler/tick?force_content_type=${encodeURIComponent(ct)}`, {
        method: 'POST', headers: { 'X-Admin-Token': token },
      });
      await refresh();
    } finally { setBusy(null); }
  };

  if (!data) return null;
  const { cadences = [], research_available = {} } = data;
  return (
    <div className="panel p-5 mb-5" data-testid="schedule-status">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="eyebrow inline-flex items-center gap-2">
          <span className="led" style={{ background: '#E8924A' }} /> EDITORIAL SCHEDULER · CADENCE STATUS
        </div>
        <button onClick={refresh} className="btn-ghost" data-testid="schedule-refresh">REFRESH</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cadences.map((c) => {
          const research = research_available[c.content_type] ?? 0;
          const blocked = research === 0;
          const status = blocked ? 'NO RESEARCH' : (c.is_due_now ? 'DUE NOW' : 'WAITING');
          const color = blocked ? '#7A7E83' : (c.is_due_now ? '#E8924A' : '#3B7A57');
          return (
            <div key={c.content_type} className="panel" style={{ padding: '12px 14px', borderColor: color }} data-testid={`schedule-row-${c.content_type}`}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color, fontWeight: 700 }}>
                {c.content_type.replace(/_/g, ' ').toUpperCase()} · {status}
              </div>
              <div className="mono mt-1" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                {c.surface_label} · {c.frequency} · GAP {c.min_gap_hours}H
              </div>
              <div className="mono mt-1" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--ink)' }}>
                RESEARCH POOL · {research} {research === 0 && '— PIPELINE BLOCKED'}
              </div>
              <div className="mono mt-1" style={{ fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                LAST · {c.last_seeded_at ? new Date(c.last_seeded_at).toISOString().slice(0, 10) : 'never'}
                {c.last_status && ` (${c.last_status})`}
              </div>
              <button
                onClick={() => fire(c.content_type)}
                disabled={busy === c.content_type || blocked}
                className="btn-ghost mt-2"
                data-testid={`schedule-fire-${c.content_type}`}
                style={{ opacity: blocked ? 0.5 : 1 }}
              >
                {busy === c.content_type ? 'FIRING…' : 'FORCE FIRE →'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BackOfficeQueue = () => {
  const [token, setToken] = useToken();
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ queued: 0, approved: 0, killed: 0 });
  const [statusFilter, setStatusFilter] = useState('queued');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [contentTypes, setContentTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const qs = new URLSearchParams({ status: statusFilter });
    if (contentTypeFilter) qs.set('content_type', contentTypeFilter);
    const r = await fetch(`${BACKEND}/api/admin/queue?${qs.toString()}`, { headers: headers() });
    if (!r.ok) { setAuthError('Wrong token'); setAuthed(false); return; }
    const d = await r.json();
    setItems(d.items || []);
    setCounts(d.counts || {});
    setAuthed(true);
    setAuthError('');
  }, [statusFilter, contentTypeFilter, token, headers]);

  useEffect(() => {
    if (!authed) return;
    refresh();
    fetch(`${BACKEND}/api/admin/content-types`, { headers: headers() })
      .then((r) => r.json())
      .then((d) => setContentTypes(d.content_types || []));
  }, [authed, refresh, headers]);

  const handleAuth = (e) => {
    e.preventDefault();
    if (!token) return;
    refresh();
  };

  const onGenerated = (doc) => {
    if (doc.status === 'queued') setItems((prev) => [doc, ...prev]);
    refresh();
  };

  const onApprove = async (id, body) => {
    setBusy(true);
    await fetch(`${BACKEND}/api/admin/queue/${id}/approve`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    setBusy(false);
    refresh();
  };
  const onEdit = onApprove; // edit goes through approve with edited_text in body
  const onKill = async (id) => {
    setBusy(true);
    await fetch(`${BACKEND}/api/admin/queue/${id}/kill`, { method: 'POST', headers: headers() });
    setBusy(false);
    refresh();
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <form onSubmit={handleAuth} className="panel w-full max-w-md p-7" data-testid="queue-auth-form">
          <div className="flex items-center gap-3 mb-6">
            <Lock strokeWidth={1.5} size={20} style={{ color: 'var(--muted)' }} />
            <div>
              <div className="eyebrow">PUTKI HQ · BACK OFFICE · APPROVAL QUEUE</div>
              <h1 className="display text-2xl mt-1">Admin authentication</h1>
            </div>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            data-testid="queue-auth-token"
            placeholder="Admin token"
            className="mono w-full"
            style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13 }}
            required
          />
          {authError && <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C' }}>{authError}</div>}
          <button type="submit" className="btn-primary w-full mt-5" data-testid="queue-auth-submit">CONTINUE →</button>
          <Link to="/" className="btn-ghost mt-4 w-full justify-center">← Back to PUTKI HQ</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }} data-testid="queue-page">
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-3">
          <div>
            <div className="eyebrow">PUTKI HQ · APPROVAL QUEUE</div>
            <h1 className="display text-3xl sm:text-4xl mt-1">Editorial pipeline</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowGuidelines(true)} className="btn-secondary" data-testid="open-guidelines">
              <FileText strokeWidth={1.5} size={13} className="mr-2" /> GUIDELINES
            </button>
            <Link to="/back-office" className="btn-ghost">← SETTINGS</Link>
            <Link to="/" className="btn-ghost">← PUTKI HQ</Link>
          </div>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 gap-3 mb-6 mt-4">
          {[
            { k: 'queued',   label: 'QUEUED',   color: '#E8924A' },
            { k: 'approved', label: 'APPROVED', color: '#5A7BB8' },
            { k: 'killed',   label: 'KILLED',   color: '#7A7E83' },
          ].map((c) => (
            <button
              key={c.k}
              onClick={() => setStatusFilter(c.k)}
              data-testid={`queue-filter-${c.k}`}
              className="panel"
              style={{
                padding: '14px 18px', textAlign: 'left',
                borderColor: statusFilter === c.k ? c.color : 'var(--border)',
                background: statusFilter === c.k ? 'var(--surface-2)' : 'var(--surface)',
              }}
            >
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: c.color, fontWeight: 700 }}>{c.label}</div>
              <div className="mono mt-1" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                {counts[c.k] || 0}
              </div>
            </button>
          ))}
        </div>

        <GenerateForm token={token} onGenerated={onGenerated} contentTypes={contentTypes} />

        <ScheduleStatus token={token} />

        <SignalPipelineStatus token={token} />

        <div className="flex items-baseline justify-between mb-3 mt-7 flex-wrap gap-3">
          <div className="eyebrow">{statusFilter.toUpperCase()} · {items.length}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value)}
              data-testid="queue-content-type-filter"
              className="mono"
              style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }}
            >
              <option value="">ALL CONTENT TYPES</option>
              {contentTypes.map((c) => (
                <option key={c.key} value={c.key}>{c.key}</option>
              ))}
            </select>
            <button onClick={refresh} className="btn-ghost" data-testid="queue-refresh">
              <RefreshCw strokeWidth={1.5} size={13} className="mr-2" /> REFRESH
            </button>
          </div>
        </div>

        <div className="space-y-4" data-testid="queue-list">
          {items.length === 0 ? (
            <div className="panel p-7 text-center mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }} data-testid="queue-empty">
              {statusFilter === 'queued' ? 'NO ITEMS WAITING — GENERATE A SIGNAL ABOVE' : `NO ${statusFilter.toUpperCase()} ITEMS`}
            </div>
          ) : (
            items.map((item) => (
              <QueueItem key={item.id} item={item} onApprove={onApprove} onKill={onKill} onEdit={onEdit} busy={busy} />
            ))
          )}
        </div>

        {showGuidelines && (
          <GuidelinesPanel token={token} onClose={() => setShowGuidelines(false)} />
        )}
      </div>
    </div>
  );
};

export default BackOfficeQueue;
