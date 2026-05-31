/**
 * BackOfficeMestariCopy - every line on /mestari is editable here.
 *
 * Iter50: section rendering extracted to
 *   `components/back-office/mestariCopySectionsTop.jsx`
 *   `components/back-office/mestariCopySectionsBottom.jsx`
 * to keep this page under the 700-LOC soft cap. State + save/fetch lives
 * here; pure presentational rendering lives in the section files.
 *
 * Data source: GET /api/admin/mestari/copy returns
 *   { raw, merged, defaults, updated_at }
 *   - `raw` = user override doc (what's actually persisted)
 *   - `merged` = effective copy tree the public endpoint serves
 *   - `defaults` = stock copy (fallback for any missing field)
 *
 * We start the form bound to `merged` so users see exactly what the page
 * is showing right now. Submit issues PUT /api/admin/mestari/copy with
 * the full payload. Backend sanitises + caps each field, so a paste-bomb
 * in any cell self-recovers on the next read.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';
import {
  HeaderHeroSection,
  MethodStackSection,
} from '../components/back-office/mestariCopySectionsTop';
import {
  ClarityTeamSection,
  FaqFinalFooterSection,
} from '../components/back-office/mestariCopySectionsBottom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const BackOfficeMestariCopy = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json', 'X-Admin-Token': token,
  }), [token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setStatus('Loading…');
    try {
      const r = await fetch(`${BACKEND}/api/admin/mestari/copy`, { headers });
      if (!r.ok) { setStatus(`Load failed (${r.status})`); return; }
      const j = await r.json();
      setData(j);
      setForm(structuredClone(j.merged));
      setDefaults(j.defaults);
      setStatus(j.updated_at ? `Loaded · last save ${new Date(j.updated_at).toLocaleString()}` : 'Loaded · using defaults');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }, [token, headers]);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const save = async () => {
    if (!form) return;
    setSaving(true); setStatus('Saving…');
    try {
      const r = await fetch(`${BACKEND}/api/admin/mestari/copy`, {
        method: 'PUT', headers, body: JSON.stringify(form),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setStatus(`Save failed: ${j.detail || r.status}`);
        return;
      }
      const j = await r.json();
      setData(j);
      setForm(structuredClone(j.merged));
      setStatus(`✓ Saved · ${new Date(j.updated_at).toLocaleString()}`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetSection = (key) => {
    if (!defaults || !form) return;
    setForm({ ...form, [key]: structuredClone(defaults[key]) });
    setStatus(`Reset section "${key}" (unsaved)`);
  };

  // ── Auth gate ────────────────────────────────────────────────────
  if (!authed) {
    return null; // iter84: legacy AuthGate dead-stripped (shell handles auth)
  }
  if (!form) {
    return (
      <div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
        {status || 'Loading Mestari copy…'}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  const sectionProps = { form, setForm, resetSection };
  return (
    <div data-testid="back-office-mestari-copy" style={{
      maxWidth: 1100, margin: '0 auto', padding: '32px 24px 120px',
      color: 'var(--ink)', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 16, marginBottom: 24, flexWrap: 'wrap',
      }}>
        <div>
          <Link to="/back-office" data-testid="back-office-back-link" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', color: 'var(--muted)',
            textDecoration: 'none', textTransform: 'uppercase', fontWeight: 700,
          }}>← BACK-OFFICE</Link>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700,
            margin: '12px 0 4px', color: 'var(--ink)', letterSpacing: '-0.015em',
          }}>Mestari copy editor</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            Every visible line on <code>/mestari</code> is live-editable. FI primary + EN. Saves apply within ~1s.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.12em', color: 'var(--muted)',
          }} data-testid="mec-status">{status}</span>
          <button type="button" onClick={save} disabled={saving}
            data-testid="mec-save-top"
            style={{
              padding: '10px 18px', background: '#5B8DEE', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? 'SAVING…' : 'SAVE'}</button>
        </div>
      </div>

      {/* Section renderers - pure presentation, see /components/back-office/mestariCopySections{Top,Bottom}.jsx */}
      <HeaderHeroSection {...sectionProps} />
      <MethodStackSection {...sectionProps} />
      <ClarityTeamSection {...sectionProps} />
      <FaqFinalFooterSection {...sectionProps} />

      {/* Sticky bottom save bar */}
      <div style={{
        position: 'sticky', bottom: 16, marginTop: 36,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        padding: '12px 16px', gap: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.12em', color: 'var(--muted)',
        }} data-testid="mec-status-bottom">{status}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/mestari" target="_blank" rel="noopener noreferrer"
            data-testid="mec-preview-link"
            style={{
              padding: '10px 16px', background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--border-strong)', textDecoration: 'none',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
            }}>OPEN /MESTARI ↗</Link>
          <button type="button" onClick={save} disabled={saving}
            data-testid="mec-save-bottom"
            style={{
              padding: '10px 18px', background: '#5B8DEE', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
              cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? 'SAVING…' : 'SAVE ALL'}</button>
        </div>
      </div>
    </div>
  );
};

export default BackOfficeMestariCopy;
