/**
 * /back-office/settings - Feature flags & global toggles (iter77).
 *
 * Today: Voita feature gate (was API-only). Designed to be extended -
 * future global flags drop in as additional <Toggle/> rows without
 * needing new routes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Trophy } from 'lucide-react';
import { adminFetch } from '../lib/fetchAdmin';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Toggle = ({ label, on, busy, onChange, testid }) => (
  <button type="button" onClick={() => onChange(!on)} disabled={busy}
    data-testid={testid}
    aria-pressed={on}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', cursor: busy ? 'wait' : 'pointer',
      background: on ? '#1e3526' : '#1a1610',
      border: `1px solid ${on ? '#6FA37D' : '#E8C26E'}`,
      color: on ? '#A6E0B0' : '#E8C26E',
      fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 800,
      borderRadius: 4, minWidth: 110, justifyContent: 'center',
    }}>
    {on ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
    {on ? `${label} ON` : `${label} OFF`}
  </button>
);

const ConfirmModal = ({ open, title, body, onConfirm, onCancel, danger }) => {
  if (!open) return null;
  return (
    <div data-testid="settings-confirm-modal" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: 480, background: '#141210', border: `1px solid ${danger ? '#C8423C' : '#E8C26E'}`,
        padding: 28, borderRadius: 4,
      }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px', color: '#F2EBE0' }}>{title}</h2>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6, color: '#D8CDB9', margin: '0 0 22px' }}>{body}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} data-testid="settings-confirm-cancel" style={{
            padding: '10px 16px', background: 'transparent', color: '#9C8B6B',
            border: '1px solid #2a2722', fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.2em', fontWeight: 700, cursor: 'pointer', borderRadius: 4,
          }}>CANCEL</button>
          <button onClick={onConfirm} data-testid="settings-confirm-ok" style={{
            padding: '10px 16px', background: danger ? '#C8423C' : '#E8C26E', color: '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.2em', fontWeight: 800, cursor: 'pointer', borderRadius: 4,
          }}>CONFIRM</button>
        </div>
      </div>
    </div>
  );
};


const BackOfficeSettings = () => {
  const ctx = useOutletContext() || {};
  const { token } = ctx;
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirm, setConfirm] = useState(null);  // { title, body, onConfirm, danger }

  const refresh = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const r = await adminFetch(`/api/admin/settings`, {});
      if (!r.ok) { setErr(`auth failed (${r.status})`); return; }
      setSettings(await r.json());
    } catch (e) { setErr(String(e?.message || e)); }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener('bo-shell-refresh', h);
    return () => window.removeEventListener('bo-shell-refresh', h);
  }, [refresh]);

  const flipVoita = (next) => {
    setConfirm({
      title: next ? 'Enable Voita raffles?' : 'Disable Voita raffles (rollback)?',
      body: next
        ? "This will un-gate the public /voita page and allow new entries. Only do this after you've confirmed the raffle mechanic complies with Finnish gambling law (Veikkaus monopoly + Arpajaislaki §27). Captured PII becomes permanent record."
        : 'This will re-gate the public /voita page. Existing entries are preserved but new entries are blocked. Safe to flip on/off as many times as you need.',
      danger: next,
      onConfirm: async () => {
        setBusy(true); setErr(null); setConfirm(null);
        try {
          const r = await adminFetch(`/api/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify({ voita_feature_enabled: next })});
          if (!r.ok) throw new Error(`PUT failed (${r.status})`);
          await refresh();
        } catch (e) { setErr(String(e?.message || e)); }
        finally { setBusy(false); }
      },
    });
  };

  return (
    <div data-testid="settings-page">
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '-0.02em', color: '#F2EBE0', margin: 0 }}>Settings</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#9C8B6B', margin: '6px 0 28px', maxWidth: 640 }}>
        Global feature flags and runtime toggles. Each flip writes to the database immediately — no deploy required, rollback is one click away.
      </p>

      {err && <div data-testid="settings-error" style={{ padding: 12, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#FF8A7F', marginBottom: 24, fontFamily: 'ui-monospace, monospace' }}>{err}</div>}

      {/* Voita */}
      <section data-testid="settings-voita-section" style={{ border: '1px solid #2a2722', padding: '20px 22px', marginBottom: 24, background: '#13110d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Trophy size={18} style={{ color: '#E8C26E' }} />
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, margin: 0, color: '#F2EBE0' }}>Voita raffles</h2>
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6, color: '#D8CDB9', margin: '4px 0 16px', maxWidth: 680 }}>
          When OFF, <code>/voita</code> renders a gated state and captures zero PII. When ON, raffles created in the back-office become publicly visible and accept entries. <strong>Flip ON only after internal sign-off that the mechanic complies with Finnish gambling law</strong> (Veikkaus monopoly + Arpajaislaki §27).
        </p>
        {settings && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Toggle label="VOITA" on={!!settings.voita_feature_enabled} busy={busy}
              onChange={flipVoita}
              testid="settings-voita-toggle" />
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#9C8B6B', letterSpacing: '0.06em' }}>
              {settings.voita_feature_enabled
                ? 'Public /voita page is LIVE. Entries are being captured.'
                : 'Public /voita page is GATED. Zero PII captured.'}
            </span>
          </div>
        )}
      </section>

      {/* Future toggles can drop in below. */}
      <section data-testid="settings-roadmap" style={{ border: '1px dashed #2a2722', padding: '14px 18px', background: 'transparent' }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.24em', color: '#5a4c2e', fontWeight: 800, marginBottom: 6 }}>
          ROADMAP
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#9C8B6B', margin: 0, lineHeight: 1.6 }}>
          Future global flags land here: dispatch cron pause, OG image generator on/off, classifier tier-2 fallback, etc. For per-funnel switches (signal_unlock_mode, daily_dm_enabled, sharpness_min) see <code>Bot &amp; Routing</code>.
        </p>
      </section>

      <ConfirmModal open={!!confirm}
        title={confirm?.title} body={confirm?.body} danger={confirm?.danger}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)} />
    </div>
  );
};

export default BackOfficeSettings;
