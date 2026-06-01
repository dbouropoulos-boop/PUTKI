import React, { useEffect, useState, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Lock, RefreshCw, Plus, Save, Trash2, Image, Youtube } from 'lucide-react';
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
  // iter82 · Task 2.2 — shell-injected token short-circuits the per-page gate.
  const _shellCtx = useOutletContext() || {};
  const [_tokenLocal, setToken] = useToken();
  const token = _shellCtx.token || _tokenLocal;
  const [_authedLocal, setAuthed] = useState(false);
  const authed = !!_shellCtx.token || _authedLocal;
  const [error, setError] = useState('');
  const [streamers, setStreamers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyStr());
  const [saving, setSaving] = useState(false);
  const [sceneFilter, setSceneFilter] = useState('');
  const [refreshingOne, setRefreshingOne] = useState(null);
  // YouTube channel-ID resolver state - runs against
  // /api/admin/streamers/resolve-youtube-channels. `ytLastRun` holds the
  // full envelope { attempted, resolved, persisted, error_breakdown,
  // results[] } so we can render the per-row outcomes inline.
  const [ytResolving, setYtResolving] = useState(false);
  const [ytLastRun, setYtLastRun] = useState(null);
  // iter75 - Channel Audit. Polls GET /admin/streamers/audit-youtube
  // on first auth + after every resolve/save. Surfaces the totals
  // (unresolved / stale / fresh) plus the actionable row list so the
  // editor can see at a glance whether the roster is healthy.
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('all');  // all | unresolved | stale | fresh

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

  // iter75 - YouTube channel audit loader. Cheap (single Mongo scan,
  // no YouTube API call), safe to call on every mount + after every
  // resolve/save cycle. Hook lives near `refresh` so React's call-order
  // invariant is preserved across both authed and !authed renders.
  const loadAudit = useCallback(async () => {
    if (!token) return;
    setAuditLoading(true);
    try {
      const r = await fetch(
        `${BACKEND}/api/admin/streamers/audit-youtube?stale_days=30`,
        { headers: { 'X-Admin-Token': token } },
      );
      if (!r.ok) return;
      const j = await r.json();
      setAudit(j);
    } catch { /* swallow - panel just stays blank */ }
    finally { setAuditLoading(false); }
  }, [token]);

  useEffect(() => { if (authed) loadAudit(); }, [authed, loadAudit]);

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

  const [refreshingFailed, setRefreshingFailed] = useState(false);
  const refreshFailedAvatars = async () => {
    if (refreshingFailed) return;
    if (!window.confirm('Re-run the FULL fallback cascade (platform → channel OG → DDG search → Wikipedia) on every streamer currently flagged avatar_failed=true. Can take 30-60s.')) return;
    setRefreshingFailed(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamers/refresh-failed-avatars`, {
        method: 'POST', headers: headers(),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const lines = [
        `Attempted: ${j.attempted}`,
        `Succeeded: ${j.succeeded}`,
        `Still failed: ${j.still_failed}`,
      ];
      if (j.succeeded > 0) {
        lines.push('', 'Resolved:');
        j.results.filter(x => x.ok).slice(0, 15).forEach(x => {
          lines.push(`  • ${x.name || x.slug} (${x.source})`);
        });
      }
      alert(lines.join('\n'));
      await refresh();
    } catch (e) {
      alert(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshingFailed(false);
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
        credentials: 'include',
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

  const resolveYoutubeChannels = async (dryRun) => {
    setYtResolving(true);
    try {
      const q = new URLSearchParams({ limit: '50', dry_run: String(!!dryRun) });
      const r = await fetch(
        `${BACKEND}/api/admin/streamers/resolve-youtube-channels?${q}`,
        { method: 'POST', headers: { 'X-Admin-Token': token } },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || 'failed');
      setYtLastRun(j);
      if (!dryRun) { await refresh(); await loadAudit(); }
    } catch (e) {
      alert(`YouTube resolve failed: ${e.message}`);
    } finally {
      setYtResolving(false);
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
            <button onClick={refreshFailedAvatars} disabled={refreshingFailed} className="btn-ghost" data-testid="str-refresh-failed-avatars"
                    title="Run the full 4-stage cascade (platform → OG → DDG → Wikipedia) on streamers whose avatar is currently missing or marked failed"
                    style={{ borderColor: '#A0750F', color: '#A0750F' }}>
              <RefreshCw strokeWidth={1.5} size={13} className="mr-2" /> {refreshingFailed ? 'CASCADING…' : 'REFRESH FAILED'}
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

        {/* ╭─ YouTube Channel Audit panel (iter75) ─╮
            Read-only counterpart to the resolver. Shows totals + per-row
            health so the editor can spot stale (>30d) and unresolved
            rows at a glance. Filter chip narrows the row table without
            re-fetching. */}
        {audit && (
          <div className="panel p-4 mb-5" data-testid="str-yt-audit"
            style={{ border: '1px solid var(--border-strong)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <Youtube strokeWidth={1.6} size={18} style={{ color: '#9C8B6B' }} />
                <div style={{ minWidth: 0 }}>
                  <div className="mono text-[10px]" style={{ letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700 }}>YOUTUBE CHANNEL AUDIT · STALE &gt; 30d</div>
                  <div className="font-serif text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
                    Live snapshot of every YouTube streamer&apos;s channel-ID resolution status. Filter to focus on rows that need a re-resolve.
                  </div>
                </div>
              </div>
              <button onClick={loadAudit} disabled={auditLoading}
                data-testid="str-yt-audit-refresh" className="btn-ghost">
                <RefreshCw strokeWidth={1.5} size={13} className="mr-2" />
                {auditLoading ? 'LOADING…' : 'RE-AUDIT'}
              </button>
            </div>

            {/* 4-cell totals strip */}
            <div className="grid mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', border: '1px solid var(--border)' }}>
              {[
                { label: 'TOTAL', value: audit.totals.total, color: 'var(--ink)' },
                { label: 'UNRESOLVED', value: audit.totals.unresolved, color: '#C8423C', filter: 'unresolved' },
                { label: `STALE >${audit.stale_days}d`, value: audit.totals.stale, color: '#E8A33C', filter: 'stale' },
                { label: 'FRESH', value: audit.totals.fresh, color: '#6FA37D', filter: 'fresh' },
              ].map((cell) => (
                <button key={cell.label}
                  type="button"
                  data-testid={`str-yt-audit-cell-${(cell.filter || 'total').toLowerCase()}`}
                  onClick={() => cell.filter && setAuditFilter(auditFilter === cell.filter ? 'all' : cell.filter)}
                  style={{
                    padding: '12px 14px', textAlign: 'left',
                    borderRight: '1px solid var(--border)',
                    background: cell.filter && auditFilter === cell.filter ? 'color-mix(in srgb, var(--surface) 60%, transparent)' : 'transparent',
                    cursor: cell.filter ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                  <span className="mono" style={{
                    fontSize: 9.5, letterSpacing: '0.22em',
                    fontWeight: 700, color: 'var(--muted)',
                  }}>{cell.label}</span>
                  <span className="font-serif" style={{
                    fontSize: 22, fontWeight: 700, color: cell.color,
                    letterSpacing: '-0.01em',
                  }}>{cell.value}</span>
                </button>
              ))}
            </div>

            {/* Row table - filtered by chip */}
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)' }}>
              <table className="w-full mono text-[11px]" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>SLUG</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>CHANNEL_ID</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>AGE</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit.rows || [])
                    .filter((r) => auditFilter === 'all' || r.status === auditFilter)
                    .map((r) => {
                      const c = r.status === 'fresh' ? '#6FA37D'
                        : r.status === 'stale' ? '#E8A33C'
                        : r.status === 'never_resolved' ? '#9C8B6B'
                        : '#C8423C';
                      return (
                        <tr key={r.slug} data-testid={`str-yt-audit-row-${r.slug}`}
                          style={{ borderTop: '1px solid var(--border)',
                                   opacity: r.active ? 1 : 0.5 }}>
                          <td style={{ padding: '6px 10px', color: 'var(--ink)' }}>
                            {r.slug}{!r.active && <span className="mono text-[9px]" style={{ color: 'var(--muted)', marginLeft: 6, letterSpacing: '0.10em' }}>· INACTIVE</span>}
                          </td>
                          <td style={{ padding: '6px 10px', color: r.youtube_channel_id ? 'var(--muted)' : '#C8423C', fontSize: 10.5 }}>
                            {r.youtube_channel_id || '— none —'}
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>
                            {r.age_days == null ? '—' : `${r.age_days}d`}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px',
                              border: `1px solid ${c}`, color: c,
                              letterSpacing: '0.10em', fontWeight: 700,
                              fontSize: 9.5,
                            }}>
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ╭─ YouTube channel-ID resolver strip ─╮
            Drives POST /api/admin/streamers/resolve-youtube-channels.
            Dry-run first → confirms which slugs the API can reach without
            burning daily quota on a write run. Full run persists hits
            to `streamers.youtube_channel_id`. Status pills surface
            the per-row reason so a `quotaExceeded` breakdown is
            distinguishable from `not_found` (= wrong handle in seed data). */}
        <div className="panel p-4 mb-5" data-testid="str-yt-resolver"
          style={{ border: '1px solid var(--border-strong)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Youtube strokeWidth={1.6} size={18} style={{ color: '#C8423C' }} />
              <div style={{ minWidth: 0 }}>
                <div className="mono text-[10px]" style={{ letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700 }}>YOUTUBE CHANNEL-ID RESOLVER</div>
                <div className="font-serif text-[13px] mt-1" style={{ color: 'var(--muted)' }}>
                  Bulk-resolves <code>@handle</code> → <code>UCxxxxxxxx</code> for YouTube rows that don\u2019t yet have a cached channel id. Strips internal <code>-yt</code> suffix automatically. Persists hits to <code>streamers.youtube_channel_id</code>.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => resolveYoutubeChannels(true)} disabled={ytResolving}
                data-testid="str-yt-dry-run" className="btn-ghost"
                title="Probe the YouTube API without persisting - confirms which handles resolve">
                <RefreshCw strokeWidth={1.5} size={13} className="mr-2" />
                {ytResolving ? 'PROBING…' : 'DRY RUN'}
              </button>
              <button onClick={() => resolveYoutubeChannels(false)} disabled={ytResolving}
                data-testid="str-yt-resolve" className="btn-primary"
                title="Resolve and persist channel IDs to the DB. Audit-logged.">
                <Youtube strokeWidth={1.6} size={13} className="mr-2" />
                {ytResolving ? 'RESOLVING…' : 'RESOLVE & SAVE'}
              </button>
            </div>
          </div>

          {ytLastRun && (
            <div className="mt-4" data-testid="str-yt-last-run">
              {/* Summary line */}
              <div className="mono text-[11px] mb-3 flex flex-wrap gap-x-4 gap-y-1"
                style={{ letterSpacing: '0.06em', color: 'var(--muted)' }}>
                <span>attempted: <strong style={{ color: 'var(--ink)' }}>{ytLastRun.attempted}</strong></span>
                <span>resolved: <strong style={{ color: '#6FA37D' }}>{ytLastRun.resolved}</strong></span>
                <span>still unresolved: <strong style={{ color: '#C8423C' }}>{ytLastRun.still_unresolved}</strong></span>
                <span>persisted: <strong style={{ color: ytLastRun.persisted ? '#5BA0E8' : 'var(--muted)' }}>{ytLastRun.persisted}</strong>{ytLastRun.dry_run ? ' (dry-run)' : ''}</span>
                {ytLastRun.error_breakdown && Object.keys(ytLastRun.error_breakdown).length > 0 && (
                  <span>errors:{' '}
                    {Object.entries(ytLastRun.error_breakdown).map(([k, v]) => (
                      <span key={k} style={{ color: '#C8423C', marginRight: 6 }}>
                        <strong>{k}</strong>×{v}
                      </span>
                    ))}
                  </span>
                )}
              </div>

              {/* Per-row outcome table */}
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)' }}>
                <table className="w-full mono text-[11px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>SLUG</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>CHANNEL</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', letterSpacing: '0.12em', color: 'var(--muted)' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ytLastRun.results || []).map((r) => {
                      const ok = !!r.channel_id;
                      const reason = r.error || (ok ? null : 'unresolved');
                      const pillColor = ok ? '#6FA37D'
                        : reason === 'quotaExceeded' ? '#E8A33C'
                        : reason === 'not_found' ? '#C8423C'
                        : '#A0A0A0';
                      return (
                        <tr key={r.slug} data-testid={`str-yt-row-${r.slug}`}
                          style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--ink)' }}>{r.slug}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{r.channel}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px',
                              border: `1px solid ${pillColor}`, color: pillColor,
                              letterSpacing: '0.10em', fontWeight: 700,
                            }}>
                              {ok ? `✓ ${r.channel_id}` : `✗ ${reason}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

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
                      <h3 className="font-display mt-1" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{s.name} · {s.followers || '-'}</h3>
                      <p className="font-serif mt-1" style={{ fontSize: 13, color: 'var(--muted)' }}>{s.sub || '-'}</p>
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
