/**
 * PUTKI HQ — BackOfficeStreamerMeta (Phase 1 sprint follow-up).
 *
 * Editorial team's surface for per-streamer context lines (FI + EN) shown
 * on the homepage streamer band hover/expand affordance.
 *
 * Auth: existing X-Admin-Token (BackOfficeContext).
 * Storage: streamer_meta Mongo collection via /api/admin/streamer-meta.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useBackOffice } from '../context/BackOfficeContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const PLATFORMS = ['twitch', 'kick', 'youtube'];

const Row = ({ row, token, onSaved }) => {
  const [metaFi, setMetaFi] = useState(row.meta_fi || '');
  const [metaEn, setMetaEn] = useState(row.meta_en || '');
  const [suppressed, setSuppressed] = useState(!!row.suppressed);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/streamer-meta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          platform: row.platform,
          user_login: row.user_login,
          meta_fi: metaFi, meta_en: metaEn, suppressed,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setSavedAt(d.saved?.updated_at || new Date().toISOString());
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  }, [row.platform, row.user_login, metaFi, metaEn, suppressed, token, onSaved]);

  return (
    <tr data-testid={`meta-row-${row.platform}-${row.user_login}`}>
      <td style={{ padding: 12, verticalAlign: 'top', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
        <div>{row.platform.toUpperCase()}</div>
        <div style={{ color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>{row.user_login}</div>
      </td>
      <td style={{ padding: 12, verticalAlign: 'top' }}>
        <textarea value={metaFi} onChange={(e) => setMetaFi(e.target.value)}
          data-testid="meta-input-fi" rows={2}
          placeholder="FI editorial line (≤280 chars suggested)"
          style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border-strong)', padding: 8, fontSize: 12,
            fontFamily: 'inherit', resize: 'vertical', minHeight: 56 }}
        />
      </td>
      <td style={{ padding: 12, verticalAlign: 'top' }}>
        <textarea value={metaEn} onChange={(e) => setMetaEn(e.target.value)}
          data-testid="meta-input-en" rows={2}
          placeholder="EN editorial line"
          style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border-strong)', padding: 8, fontSize: 12,
            fontFamily: 'inherit', resize: 'vertical', minHeight: 56 }}
        />
      </td>
      <td style={{ padding: 12, verticalAlign: 'top', textAlign: 'center' }}>
        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={suppressed} onChange={(e) => setSuppressed(e.target.checked)}
            data-testid="meta-suppressed-toggle" />
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)' }}>
            HIDE
          </span>
        </label>
      </td>
      <td style={{ padding: 12, verticalAlign: 'top' }}>
        <button onClick={save} disabled={saving}
          data-testid="meta-save-btn"
          style={{
            padding: '8px 16px', background: '#FFFFFF', color: '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.18em', fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
          }}
        >{saving ? '…' : 'SAVE'}</button>
        {savedAt && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#6FA37D', marginTop: 4 }}>SAVED ✓</div>}
      </td>
    </tr>
  );
};

const BackOfficeStreamerMeta = () => {
  const { token } = useBackOffice();
  const [meta, setMeta] = useState([]);
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addPlatform, setAddPlatform] = useState('twitch');
  const [addLogin, setAddLogin] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [m, ...platforms] = await Promise.all([
      fetch(`${BACKEND}/api/admin/streamer-meta`, { headers: { 'X-Admin-Token': token } })
        .then((r) => r.ok ? r.json() : { items: [] }),
      ...PLATFORMS.map((p) => fetch(`${BACKEND}/api/streamers/live${p === 'twitch' ? '' : `?platform=${p}`}`)
        .then((r) => r.ok ? r.json() : { streamers: [] })
        .then((d) => ({ platform: p, list: d.streamers || d.items || [] }))),
    ]);
    setMeta(m.items || []);
    const merged = platforms.flatMap(({ platform, list }) => list.map((s) => ({
      platform, user_login: (s.user_login || s.user_name || s.channel || '').toLowerCase(),
    })).filter((x) => x.user_login));
    setStreamers(merged);
    setLoading(false);
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  // build display rows: union of meta + live streamers
  const seen = new Set();
  const rows = [];
  meta.forEach((m) => {
    const key = `${m.platform}:${m.user_login}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(m);
  });
  streamers.forEach((s) => {
    const key = `${s.platform}:${s.user_login}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ platform: s.platform, user_login: s.user_login, meta_fi: '', meta_en: '', suppressed: false });
  });

  const addCustom = async () => {
    const login = addLogin.trim().toLowerCase();
    if (!login) return;
    setAddLogin('');
    await fetch(`${BACKEND}/api/admin/streamer-meta`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      body: JSON.stringify({ platform: addPlatform, user_login: login, meta_fi: '', meta_en: '' }),
    });
    await load();
  };

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
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, maxWidth: 720, lineHeight: 1.55 }}>
        Per-streamer context line shown on the homepage band hover. Edit FI + EN. Toggle "HIDE" to keep a line written but not surface it (e.g. streamer in controversy / out of rotation).
      </p>

      <div style={{ marginBottom: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value)}
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: 8, fontFamily: 'inherit' }}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={addLogin} onChange={(e) => setAddLogin(e.target.value)}
          placeholder="user_login" data-testid="meta-add-login"
          style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 240px', fontFamily: 'inherit' }} />
        <button onClick={addCustom} data-testid="meta-add-btn"
          style={{ padding: '8px 16px', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', cursor: 'pointer' }}>
          + ADD
        </button>
      </div>

      {loading ? <div>LOADING…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
              <th style={{ padding: 12 }}>STREAMER</th>
              <th style={{ padding: 12 }}>META · FI</th>
              <th style={{ padding: 12 }}>META · EN</th>
              <th style={{ padding: 12, textAlign: 'center' }}>HIDE</th>
              <th style={{ padding: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={`${r.platform}:${r.user_login}`} row={r} token={token} onSaved={load} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BackOfficeStreamerMeta;
