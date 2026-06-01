/**
 * PUTKI HQ - BackOfficeStreamerMeta (AI-assisted drafting workflow).
 *
 * Editorial surface for per-streamer context lines. The AI proposes,
 * humans publish. Drafts NEVER reach the public site - only PUBLISHED
 * rows surface in the homepage streamer band tooltip.
 *
 * Status pills:
 *   NO META            - nothing drafted, nothing published
 *   DRAFT NEEDS REVIEW - AI draft pending review
 *   PUBLISHED          - editorial line live on the site
 *   SUPPRESSED         - published but hidden from frontend
 *
 * Auth: existing X-Admin-Token (BackOfficeContext).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const PLATFORMS = ['twitch', 'kick', 'youtube'];

const STATUS_LABELS = {
  no_meta: { label: 'NO META', bg: 'transparent', color: 'var(--muted)', border: 'var(--border-strong)' },
  draft_needs_review: { label: 'DRAFT · NEEDS REVIEW', bg: '#3a2b08', color: '#f4c66a', border: '#7a5c1d' },
  published: { label: 'PUBLISHED', bg: '#0e2b1a', color: '#6FA37D', border: '#2b5a3e' },
  suppressed: { label: 'SUPPRESSED', bg: '#1a1f2a', color: '#8b97aa', border: '#36404f' },
};
const FILTERS = ['all', 'no_meta', 'draft_needs_review', 'published', 'suppressed'];
const FILTER_LABELS = { all: 'ALL', no_meta: 'NO META', draft_needs_review: 'NEEDS REVIEW', published: 'PUBLISHED', suppressed: 'SUPPRESSED' };

const StatusPill = ({ status }) => {
  const cfg = STATUS_LABELS[status] || STATUS_LABELS.no_meta;
  return (
    <span data-testid={`status-pill-${status}`}
      style={{
        display: 'inline-block', padding: '3px 8px', fontFamily: 'ui-monospace, monospace',
        fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 700,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      }}>{cfg.label}</span>
  );
};

const ConfidencePill = ({ confidence }) => {
  if (!confidence) return null;
  const colors = { high: '#6FA37D', medium: '#E8C26E', low: '#C8423C' };
  return (
    <span data-testid="confidence-pill" style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.18em', fontWeight: 700,
      color: colors[confidence] || 'var(--muted)', textTransform: 'uppercase',
    }}>CONFIDENCE · {confidence}</span>
  );
};

const Row = ({ row, token, onChanged }) => {
  const isPublished = row.status === 'published' || row.status === 'suppressed';
  const hasDraft = !!row.draft_line_fi || !!row.draft_line_en;
  const [open, setOpen] = useState(false);
  const [editFi, setEditFi] = useState(hasDraft ? row.draft_line_fi : row.meta_line_fi);
  const [editEn, setEditEn] = useState(hasDraft ? row.draft_line_en : row.meta_line_en);
  const [busy, setBusy] = useState(null); // 'draft' | 'publish' | 'suppress' | null
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const reset = useCallback(() => {
    setEditFi(hasDraft ? row.draft_line_fi : row.meta_line_fi);
    setEditEn(hasDraft ? row.draft_line_en : row.meta_line_en);
  }, [row, hasDraft]);

  useEffect(() => { reset(); }, [reset]);

  const generateDraft = useCallback(async (force = false) => {
    setBusy('draft'); setError(''); setInfo('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamer-meta/generate-draft`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ platform: row.platform, user_login: row.user_login, force }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const reason = j?.detail?.reason || j?.detail || 'unknown_error';
        setError(`AI draft failed · ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
      } else {
        const j = await r.json();
        if (j.cached) setInfo('Returned cached draft (≤30d old). Pass FORCE to regenerate.');
        await onChanged();
      }
    } catch (e) {
      setError(`Network error · ${e.message}`);
    } finally {
      setBusy(null);
    }
  }, [row.platform, row.user_login, token, onChanged]);

  const publish = useCallback(async () => {
    setBusy('publish'); setError(''); setInfo('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamer-meta/publish`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          platform: row.platform, user_login: row.user_login,
          meta_line_fi: editFi, meta_line_en: editEn,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(`Publish failed · ${j.detail || r.status}`);
      } else {
        setInfo('Published.');
        await onChanged();
      }
    } catch (e) {
      setError(`Network error · ${e.message}`);
    } finally {
      setBusy(null);
    }
  }, [row.platform, row.user_login, editFi, editEn, token, onChanged]);

  const toggleSuppress = useCallback(async () => {
    setBusy('suppress'); setError(''); setInfo('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamer-meta/suppress`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          platform: row.platform, user_login: row.user_login,
          suppressed: !row.suppressed,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(`Suppress failed · ${j.detail || r.status}`);
      } else {
        await onChanged();
      }
    } catch (e) {
      setError(`Network error · ${e.message}`);
    } finally {
      setBusy(null);
    }
  }, [row.platform, row.user_login, row.suppressed, token, onChanged]);

  return (
    <>
      <tr data-testid={`meta-row-${row.platform}-${row.user_login}`}
        style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}>
        <td style={{ padding: '14px 12px', verticalAlign: 'middle', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
          <div>{row.platform.toUpperCase()}</div>
          <div style={{ color: 'var(--ink)', fontSize: 13, fontWeight: 600, marginTop: 2 }}>{row.user_login}</div>
        </td>
        <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
          <StatusPill status={row.status} />
        </td>
        <td style={{ padding: '14px 12px', verticalAlign: 'middle', color: 'var(--muted)', fontSize: 12, fontStyle: 'italic', maxWidth: 460 }}>
          {row.status === 'published' || row.status === 'suppressed'
            ? (row.meta_line_fi || row.meta_line_en || '-')
            : (row.draft_line_fi || row.draft_line_en || '-')}
        </td>
        <td style={{ padding: '14px 12px', verticalAlign: 'middle', textAlign: 'right',
          fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
          {open ? 'CLOSE ▲' : 'OPEN ▾'}
        </td>
      </tr>
      {open && (
        <tr data-testid={`meta-row-expanded-${row.platform}-${row.user_login}`} style={{ background: 'var(--surface)' }}>
          <td colSpan={4} style={{ padding: '20px 24px' }}>
            {row.status === 'no_meta' && !hasDraft ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 540, lineHeight: 1.55 }}>
                  No editorial line yet. Generate an AI draft from live Twitch / Kick / YouTube data,
                  then edit + publish. The AI proposes; only you publish.
                </div>
                <button onClick={() => generateDraft(false)} disabled={busy === 'draft'}
                  data-testid="generate-ai-draft-btn"
                  style={{
                    padding: '10px 18px', background: '#FFFFFF', color: '#0B0A09',
                    border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                    letterSpacing: '0.18em', fontWeight: 700, cursor: busy === 'draft' ? 'wait' : 'pointer',
                  }}>
                  {busy === 'draft' ? 'CALLING HAIKU…' : '✨ GENERATE AI DRAFT'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  {row.draft_confidence && <ConfidencePill confidence={row.draft_confidence} />}
                  {row.draft_generated_at && (
                    <span data-testid="draft-generated-at" style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em',
                    }}>DRAFTED {new Date(row.draft_generated_at).toISOString().slice(0, 16).replace('T', ' ')}</span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
                    EDITORIAL LINE · FI
                    <textarea value={editFi} onChange={(e) => setEditFi(e.target.value)}
                      data-testid="edit-line-fi" rows={3}
                      style={{ width: '100%', marginTop: 6, background: 'var(--bg)', color: 'var(--ink)',
                        border: '1px solid var(--border-strong)', padding: 10, fontSize: 13,
                        fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                  </label>
                  <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
                    EDITORIAL LINE · EN
                    <textarea value={editEn} onChange={(e) => setEditEn(e.target.value)}
                      data-testid="edit-line-en" rows={3}
                      style={{ width: '100%', marginTop: 6, background: 'var(--bg)', color: 'var(--ink)',
                        border: '1px solid var(--border-strong)', padding: 10, fontSize: 13,
                        fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                  </label>
                </div>

                {row.draft_notes_for_reviewer && (
                  <div data-testid="notes-for-reviewer" style={{
                    background: '#1a1408', border: '1px solid #4a3a1a', padding: 12,
                    marginBottom: 14, fontSize: 12, color: '#f4c66a', lineHeight: 1.55,
                  }}>
                    <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', display: 'block', marginBottom: 4 }}>
                      NOTES FOR REVIEWER
                    </strong>
                    {row.draft_notes_for_reviewer}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={publish} disabled={busy === 'publish' || (!editFi && !editEn)}
                    data-testid="publish-btn"
                    style={{
                      padding: '10px 20px', background: '#6FA37D', color: '#0B0A09',
                      border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                      letterSpacing: '0.18em', fontWeight: 700, cursor: busy === 'publish' ? 'wait' : 'pointer',
                    }}>
                    {busy === 'publish' ? 'PUBLISHING…' : (isPublished ? 'UPDATE' : 'PUBLISH')}
                  </button>
                  <button onClick={() => generateDraft(true)} disabled={busy === 'draft'}
                    data-testid="regenerate-draft-btn"
                    style={{
                      padding: '10px 18px', background: 'transparent', color: 'var(--ink)',
                      border: '1px solid var(--border-strong)', fontFamily: 'ui-monospace, monospace',
                      fontSize: 10.5, letterSpacing: '0.18em', cursor: busy === 'draft' ? 'wait' : 'pointer',
                    }}>
                    {busy === 'draft' ? 'CALLING HAIKU…' : '↻ REGENERATE DRAFT'}
                  </button>
                  {isPublished && (
                    <button onClick={toggleSuppress} disabled={busy === 'suppress'}
                      data-testid="suppress-toggle-btn"
                      style={{
                        padding: '10px 18px', background: 'transparent',
                        color: row.suppressed ? '#6FA37D' : '#C8423C',
                        border: `1px solid ${row.suppressed ? '#2b5a3e' : '#5a2b2b'}`,
                        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                        letterSpacing: '0.18em', cursor: busy === 'suppress' ? 'wait' : 'pointer',
                      }}>
                      {row.suppressed ? '↩ UNSUPPRESS' : '⊘ SUPPRESS'}
                    </button>
                  )}
                  <button onClick={reset}
                    style={{
                      padding: '10px 14px', background: 'transparent', color: 'var(--muted)',
                      border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace',
                      fontSize: 10.5, letterSpacing: '0.18em', cursor: 'pointer',
                    }}>
                    DISCARD EDITS
                  </button>
                </div>

                {error && <div data-testid="row-error" style={{ marginTop: 12, padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
                {info && <div data-testid="row-info" style={{ marginTop: 12, padding: 10, background: '#0e2b1a', border: '1px solid #2b5a3e', color: '#9ad4a9', fontSize: 12 }}>{info}</div>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

const BackOfficeStreamerMeta = () => {
  const { token, setToken, authed, authError, checkAuth } = useBackOfficeToken();
  const [data, setData] = useState({ items: [], rate_limit: null });
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [addPlatform, setAddPlatform] = useState('twitch');
  const [addLogin, setAddLogin] = useState('');

  const load = useCallback(async () => {
    if (!token || !authed) return;
    setLoading(true);
    try {
      const [metaRes, liveRes] = await Promise.all([
        fetch(`${BACKEND}/api/admin/streamer-meta/v2`, { headers: { 'X-Admin-Token': token } })
          .then((r) => r.ok ? r.json() : { items: [], rate_limit: null }),
        fetch(`${BACKEND}/api/streamers/live`)
          .then((r) => r.ok ? r.json() : { streamers: [] }),
      ]);
      setData(metaRes);
      const live = (liveRes.streamers || []).map((s) => ({
        platform: 'twitch',
        user_login: (s.user_login || '').toLowerCase(),
      })).filter((x) => x.user_login);
      setStreamers(live);
    } finally {
      setLoading(false);
    }
  }, [token, authed]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const seen = new Set();
    const out = [];
    (data.items || []).forEach((m) => {
      const key = `${m.platform}:${m.user_login}`;
      if (seen.has(key)) return;
      seen.add(key); out.push(m);
    });
    streamers.forEach((s) => {
      const key = `${s.platform}:${s.user_login}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        platform: s.platform, user_login: s.user_login,
        status: 'no_meta', meta_line_fi: '', meta_line_en: '',
        draft_line_fi: '', draft_line_en: '', suppressed: false,
      });
    });
    const q = search.trim().toLowerCase();
    return out
      .filter((r) => filter === 'all' ? true : r.status === filter)
      .filter((r) => !q || r.user_login.includes(q) || r.platform.includes(q));
  }, [data, streamers, filter, search]);

  const counts = useMemo(() => {
    const c = { all: 0, no_meta: 0, draft_needs_review: 0, published: 0, suppressed: 0 };
    const allRows = [
      ...(data.items || []),
      ...streamers.map((s) => ({ platform: s.platform, user_login: s.user_login, status: 'no_meta' })),
    ];
    const seen = new Set();
    allRows.forEach((r) => {
      const key = `${r.platform}:${r.user_login}`;
      if (seen.has(key)) return; seen.add(key);
      c.all += 1;
      if (c[r.status] !== undefined) c[r.status] += 1;
    });
    return c;
  }, [data, streamers]);

  if (!authed) {
    return null; // iter84: legacy AuthGate dead-stripped (shell handles auth)
  }

  const addCustom = async () => {
    const login = addLogin.trim().toLowerCase();
    if (!login || !token) return;
    setAddLogin('');
    // Just seed the row with empty fields so it shows up; AI draft can fill it in.
    await fetch(`${BACKEND}/api/admin/streamer-meta`, {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      body: JSON.stringify({ platform: addPlatform, user_login: login, meta_fi: '', meta_en: '' }),
    });
    await load();
  };

  const rl = data.rate_limit;

  return (
    <div data-testid="back-office-streamer-meta" style={{
      maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/back-office" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← BACK-OFFICE</Link>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36,
        letterSpacing: '-0.02em', color: '#FFFFFF', margin: '16px 0 8px',
      }}>Streamer editorial meta</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8, maxWidth: 760, lineHeight: 1.55 }}>
        Per-streamer context line shown on the homepage streamer band tooltip. Generate an AI draft
        from live data, review it, then publish. Drafts NEVER reach the live site - only published
        rows surface. Suppression hides published rows without deleting them.
      </p>
      {rl && (
        <div data-testid="rate-limit-status" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.14em',
          color: rl.remaining > 0 ? 'var(--muted)' : '#C8423C', marginBottom: 24,
        }}>
          AI BUDGET · {rl.remaining}/{rl.limit_per_hour} DRAFTS REMAINING THIS HOUR
          {!rl.ai_enabled && <span style={{ marginLeft: 12, color: '#C8423C' }}>· AI DISABLED VIA ENV</span>}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
            style={{
              padding: '8px 14px', background: filter === f ? '#FFFFFF' : 'transparent',
              color: filter === f ? '#0B0A09' : 'var(--ink)',
              border: `1px solid ${filter === f ? '#FFFFFF' : 'var(--border-strong)'}`,
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
              fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
            }}>
            {FILTER_LABELS[f]} <span style={{ opacity: 0.6, marginLeft: 6 }}>{counts[f] ?? 0}</span>
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search login…"
          data-testid="search-input"
          style={{
            marginLeft: 'auto', background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 220px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
          }} />
      </div>

      {/* Add custom streamer */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: 8, fontFamily: 'inherit', fontSize: 12 }}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={addLogin} onChange={(e) => setAddLogin(e.target.value)}
          placeholder="user_login" data-testid="meta-add-login"
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 240px', fontFamily: 'inherit', fontSize: 12 }} />
        <button onClick={addCustom} data-testid="meta-add-btn"
          style={{ padding: '8px 16px', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', cursor: 'pointer' }}>
          + ADD ROW
        </button>
      </div>

      {loading ? <div data-testid="loading">LOADING…</div> : rows.length === 0 ? (
        <div data-testid="empty" style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', padding: 32, textAlign: 'center', border: '1px dashed var(--border)' }}>
          NO STREAMERS MATCH THIS FILTER.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="meta-table">
          <thead>
            <tr style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ padding: 12 }}>STREAMER</th>
              <th style={{ padding: 12 }}>STATUS</th>
              <th style={{ padding: 12 }}>PREVIEW</th>
              <th style={{ padding: 12, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={`${r.platform}:${r.user_login}`} row={r} token={token} onChanged={load} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BackOfficeStreamerMeta;
