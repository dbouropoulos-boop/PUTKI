import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Plus, Save, Trash2, Image } from 'lucide-react';
import StreamerAvatar from '../components/StreamerAvatar';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SCENES = ['finnish', 'intl_global', 'intl_swedish', 'intl_dutch', 'intl_norwegian'];

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('putki-hq-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('putki-hq-admin-token', v); } catch {} }];
};

const emptyStr = () => ({
  slug: '', name: '', platform: 'Twitch', channel: '', tier: 2, scene: 'finnish',
  origin: '', photo: '', followers: '', sub: '', active: true, market_id: 'FI',
});

const StreamersAdmin = () => {
  const [token, setToken] = useToken();
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [streamers, setStreamers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyStr());
  const [saving, setSaving] = useState(false);
  const [sceneFilter, setSceneFilter] = useState('');
  const [refreshingOne, setRefreshingOne] = useState(null);

  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'X-Admin-Token': token }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamers`, { headers: headers() });
      if (!r.ok) { setError('Wrong token'); setAuthed(false); return; }
      const d = await r.json();
      setStreamers(d.streamers || []);
      setAuthed(true);
      setError('');
    } catch (e) { setError(String(e)); }
  }, [token, headers]);

  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);

  const startEdit = (s) => { setSelected(s.slug); setDraft({ ...s }); };
  const startNew = () => { setSelected(null); setDraft(emptyStr()); };

  const save = async () => {
    if (!draft.slug.trim() || !draft.name.trim()) { alert('slug + name required'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamers/${draft.slug}`, {
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
    await fetch(`${BACKEND}/api/admin/streamers/${slug}`, { method: 'DELETE', headers: headers() });
    if (selected === slug) startNew();
    refresh();
  };

  const [refreshingAvatars, setRefreshingAvatars] = useState(false);
  const [avatarSummary, setAvatarSummary] = useState(null);
  const refreshAvatars = async () => {
    if (refreshingAvatars) return;
    if (!window.confirm('Re-fetch every streamer\'s profile picture from Twitch / Kick / YouTube? This takes ~5-10s.')) return;
    setRefreshingAvatars(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamers/refresh-avatars?force=true`, {
        method: 'POST', headers: headers(),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setAvatarSummary(d);
      await refresh();
    } catch (e) {
      alert(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshingAvatars(false);
    }
  };

  const filtered = sceneFilter ? streamers.filter((s) => s.scene === sceneFilter) : streamers;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <form onSubmit={(e) => { e.preventDefault(); refresh(); }} className="panel w-full max-w-md p-7">
          <div className="flex items-center gap-3 mb-6">
            <Lock strokeWidth={1.5} size={20} style={{ color: 'var(--muted)' }} />
            <div>
              <div className="eyebrow">PUTKI HQ · STREAMERS REGISTRY</div>
              <h1 className="display text-2xl mt-1">Admin authentication</h1>
            </div>
          </div>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} data-testid="str-auth-token" placeholder="Admin token" className="mono w-full" style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13 }} required />
          {error && <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C' }}>{error}</div>}
          <button type="submit" className="btn-primary w-full mt-5" data-testid="str-auth-submit">CONTINUE →</button>
          <Link to="/" className="btn-ghost mt-4 w-full justify-center">← Back to PUTKI HQ</Link>
        </form>
      </div>
    );
  }

  const refreshOneAvatar = async (slug) => {
    setRefreshingOne(slug);
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamers/${encodeURIComponent(slug)}/refresh-avatar`, {
        method: 'POST', headers: { 'X-Admin-Token': token },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || 'failed');
      await load();
      alert(`Avatar resolved via "${j.avatar_source}".${j.avatar_url ? '\n\n' + j.avatar_url : '\n\nNo image found across all 4 stages.'}`);
    } catch (e) {
      alert(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshingOne(null);
    }
  };

  return (
    <div className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }} data-testid="streamers-admin-page">
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="eyebrow">PUTKI HQ · STREAMERS REGISTRY · {filtered.length}{sceneFilter ? ' / ' + streamers.length : ''}</div>
            <h1 className="display text-3xl mt-1">Streamers</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={sceneFilter} onChange={(e) => setSceneFilter(e.target.value)} data-testid="str-filter-scene" className="mono" style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 11, borderRadius: 4 }}>
              <option value="">ALL SCENES</option>
              {SCENES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={refresh} className="btn-ghost" data-testid="str-refresh"><RefreshCw strokeWidth={1.5} size={13} className="mr-2" /> REFRESH</button>
            <button onClick={refreshAvatars} disabled={refreshingAvatars} className="btn-ghost" data-testid="str-refresh-avatars" title="Re-fetch profile pics from Twitch/Kick/YouTube">
              <Image strokeWidth={1.5} size={13} className="mr-2" /> {refreshingAvatars ? 'FETCHING…' : 'REFRESH AVATARS'}
            </button>
            <button onClick={startNew} className="btn-primary" data-testid="str-new"><Plus strokeWidth={1.6} size={13} className="mr-2" /> NEW</button>
            <Link to="/back-office/operators" className="btn-ghost">← OPERATORS</Link>
          </div>
        </div>

        {avatarSummary && (
          <div className="mono text-[11px] mb-4" style={{ letterSpacing: '0.06em', color: 'var(--muted)' }} data-testid="str-avatar-summary">
            avatars · resolved {avatarSummary.resolved} · failed {avatarSummary.failed} · twitch {avatarSummary.twitch_count} · kick {avatarSummary.kick_count} · youtube {avatarSummary.youtube_count}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3" data-testid="str-list">
            {filtered.map((s) => (
              <div key={s.slug} className="panel p-4" data-testid={`str-row-${s.slug}`} style={{ borderColor: selected === s.slug ? 'var(--ink)' : 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3" style={{ minWidth: 0 }}>
                    <StreamerAvatar streamer={s} size={44} shape="circle" />
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#5A7BB8', fontWeight: 700 }}>
                        {s.platform.toUpperCase()} · T{s.tier} · {s.scene.toUpperCase()}
                        {s.avatar_failed && <span style={{ color: '#C8423C', marginLeft: 6 }} title={s.avatar_failure_reason || ''}>· AVATAR ?</span>}
                        {s.avatar_source && s.avatar_source !== 'platform_api' && !s.avatar_failed && (
                          <span style={{ color: '#E8C26E', marginLeft: 6 }} title={`Resolved via ${s.avatar_source}`}>
                            · {s.avatar_source.toUpperCase().replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display mt-1" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{s.name} · {s.followers || '—'}</h3>
                      <p className="font-serif mt-1" style={{ fontSize: 13, color: 'var(--muted)' }}>{s.sub || '—'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => startEdit(s)} className="btn-ghost" data-testid={`str-edit-${s.slug}`}>EDIT</button>
                    <button
                      onClick={() => refreshOneAvatar(s.slug)}
                      disabled={refreshingOne === s.slug}
                      className="btn-ghost"
                      data-testid={`str-refresh-avatar-${s.slug}`}
                      title="Re-fetch avatar via platform API → channel OG → DDG image search → Wikipedia"
                      style={{ opacity: refreshingOne === s.slug ? 0.5 : 1 }}
                    >
                      <RefreshCw strokeWidth={1.5} size={13} />
                    </button>
                    <button onClick={() => remove(s.slug)} className="btn-ghost" data-testid={`str-delete-${s.slug}`} style={{ color: '#C8423C' }}><Trash2 strokeWidth={1.5} size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="panel p-5" data-testid="str-editor">
            <div className="eyebrow mb-3">{selected ? 'EDIT STREAMER' : 'NEW STREAMER'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['slug',      'SLUG'],
                ['name',      'NAME'],
                ['platform',  'PLATFORM'],
                ['channel',   'CHANNEL HANDLE'],
                ['tier',      'TIER 1/2', 'number'],
                ['origin',    'ORIGIN (intl only)'],
                ['photo',     'PHOTO URL'],
                ['followers', 'FOLLOWERS (text)'],
              ].map(([key, label, type]) => (
                <label key={key} className="block">
                  <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>{label}</span>
                  <input
                    type={type || 'text'}
                    value={draft[key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                    data-testid={`str-input-${key}`}
                    className="mono w-full"
                    style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>SCENE</span>
                <select value={draft.scene} onChange={(e) => setDraft({ ...draft, scene: e.target.value })} data-testid="str-input-scene" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}>
                  {SCENES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>ACTIVE</span>
                <select value={draft.active ? '1' : '0'} onChange={(e) => setDraft({ ...draft, active: e.target.value === '1' })} data-testid="str-input-active" className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }}>
                  <option value="1">yes</option>
                  <option value="0">no</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700 }}>SUB (one-liner bio)</span>
                <textarea value={draft.sub || ''} onChange={(e) => setDraft({ ...draft, sub: e.target.value })} data-testid="str-input-sub" rows={2} className="mono w-full" style={{ padding: '10px 12px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12, borderRadius: 4 }} />
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} disabled={saving} className="btn-primary" data-testid="str-save">
                <Save strokeWidth={1.6} size={13} className="mr-2" /> {saving ? 'SAVING…' : 'SAVE'}
              </button>
              {selected && <button onClick={startNew} className="btn-ghost" data-testid="str-cancel">CANCEL</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamersAdmin;
