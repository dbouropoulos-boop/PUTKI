/**
 * Back-office · Mestari diagnostic landing-copy editor.
 *
 * Edits the editable landing-copy tree (hub + poker + blackjack) that
 * was previously hardcoded in MestariHub.jsx + MestariDiagnostic.jsx.
 * Section-by-section; FI + EN side-by-side. Sports diagnostic landing
 * copy is NOT edited here - it lives at /back-office/mestari-copy
 * (separate singleton, separate editor, per Section 8 lock).
 *
 * Path: /back-office/mestari-diagnostics-copy
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const BLUE = '#5B8DEE';

const SECTIONS = [
  { key: 'hub', label: 'CHOOSER HUB (/mestari)' },
  { key: 'poker', label: 'POKER LANDING (/mestari/poker)' },
  { key: 'blackjack', label: 'BLACKJACK LANDING (/mestari/blackjack)' },
];

const Field = ({ label, value, onChange, multiline, testid }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700,
      textTransform: 'uppercase',
    }}>{label}</span>
    {multiline ? (
      <textarea data-testid={testid} value={value ?? ''}
        onChange={(e) => onChange(e.target.value)} rows={3}
        style={{
          background: 'var(--bg)', color: 'var(--ink)',
          border: '1px solid var(--border)', padding: '9px 12px',
          fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5,
        }} />
    ) : (
      <input type="text" data-testid={testid} value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg)', color: 'var(--ink)',
          border: '1px solid var(--border)', padding: '9px 12px',
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
        }} />
    )}
  </label>
);

const BackOfficeMestariDiagnosticsCopy = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const headers = useMemo(() => ({ 'X-Admin-Token': token }), [token]);
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [activeSection, setActiveSection] = useState('hub');

  const refresh = useCallback(() => {
    if (!authed) return;
    fetch(`${BACKEND}/api/admin/mestari/diagnostic-copy`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch((e) => console.warn('[diag-copy]', e));
  }, [authed, headers]);
  useEffect(refresh, [refresh]);

  if (!authed) {
    return null; // iter84: legacy AuthGate dead-stripped (shell handles auth)
  }
  if (!data) return <div style={{ padding: 24, color: 'var(--muted)' }}>Loading…</div>;

  const setField = (section, key, value) => {
    setData({
      ...data,
      merged: { ...data.merged, [section]: { ...data.merged[section], [key]: value } },
    });
  };
  const resetSection = (section) => {
    setData({
      ...data,
      merged: { ...data.merged, [section]: { ...data.defaults[section] } },
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/mestari/diagnostic-copy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ copy: data.merged }),
      });
      if (r.ok) {
        setSavedAt(new Date().toISOString());
        refresh();
      }
    } finally { setSaving(false); }
  };

  const section = data.merged[activeSection] || {};
  const keys = Object.keys(data.defaults[activeSection] || {});

  // Pair FI/EN by stripping the suffix. e.g. headline_fi + headline_en
  // become one logical field "headline".
  const pairs = Array.from(new Set(keys.map((k) => k.replace(/_fi$|_en$/, ''))))
    .sort((a, b) => keys.indexOf(`${a}_fi`) - keys.indexOf(`${b}_fi`));

  return (
    <div data-testid="bo-diag-copy-page" style={{
      background: 'var(--bg)', minHeight: '100vh', color: 'var(--ink)',
      padding: '24px 24px 56px',
    }}>
      <header style={{ marginBottom: 18 }}>
        <Link to="/back-office" data-testid="bo-diag-copy-back" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', color: 'var(--muted)', textDecoration: 'none',
        }}>← BACK-OFFICE</Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, margin: '6px 0 6px', letterSpacing: '-0.02em' }}>
          Mestari diagnostic landing copy
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13, maxWidth: 720 }}>
          Hub headline + trust line + method strip · poker + blackjack landing eyebrow / H1 / sub / disclaimer / 1st-stat / method.
          Sports diagnostic copy lives at <Link to="/back-office/mestari-copy" style={{ color: BLUE }}>/back-office/mestari-copy</Link>.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" onClick={() => setActiveSection(s.key)}
            data-testid={`bo-diag-copy-tab-${s.key}`}
            style={{
              padding: '8px 14px',
              background: activeSection === s.key ? BLUE : 'transparent',
              color: activeSection === s.key ? '#0B0A09' : 'var(--ink)',
              border: '1px solid var(--border-strong)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', fontWeight: 700, cursor: 'pointer',
            }}>{s.label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => resetSection(activeSection)}
            data-testid="bo-diag-copy-reset"
            style={{
              padding: '8px 14px', background: 'transparent', color: 'var(--muted)',
              border: '1px solid var(--border-strong)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', fontWeight: 700, cursor: 'pointer',
            }}>↺ RESET SECTION</button>
          <button type="button" onClick={save} disabled={saving}
            data-testid="bo-diag-copy-save"
            style={{
              padding: '8px 14px', background: BLUE, color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.18em', fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
            }}>{saving ? 'SAVING…' : 'SAVE ALL'}</button>
        </div>
      </div>
      {savedAt && (
        <div data-testid="bo-diag-copy-saved" style={{ color: '#6FA37D', fontSize: 11, marginBottom: 10 }}>
          ✓ Saved at {savedAt.slice(11, 19)}
        </div>
      )}

      <div data-testid={`bo-diag-copy-section-${activeSection}`} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {pairs.map((base) => {
          const fiKey = `${base}_fi`;
          const enKey = `${base}_en`;
          const hasFi = keys.includes(fiKey);
          const hasEn = keys.includes(enKey);
          if (!hasFi && !hasEn) {
            // Singleton key (e.g. hero_stat_num) → render as one input
            return (
              <Field key={base} label={base} testid={`bo-diag-copy-${activeSection}-${base}`}
                value={section[base]} onChange={(v) => setField(activeSection, base, v)} />
            );
          }
          // Long content → multiline. Heuristic: any key ending in
          // _body / _sub / _rest / _line / _desc is multiline.
          const ml = /(body|sub|rest|line|desc|trust|tagline|disclaimer)/i.test(base);
          return (
            <div key={base} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {hasFi && (
                <Field label={`${base} · FI`}
                  testid={`bo-diag-copy-${activeSection}-${fiKey}`}
                  value={section[fiKey]} multiline={ml}
                  onChange={(v) => setField(activeSection, fiKey, v)} />
              )}
              {hasEn && (
                <Field label={`${base} · EN`}
                  testid={`bo-diag-copy-${activeSection}-${enKey}`}
                  value={section[enKey]} multiline={ml}
                  onChange={(v) => setField(activeSection, enKey, v)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BackOfficeMestariDiagnosticsCopy;
