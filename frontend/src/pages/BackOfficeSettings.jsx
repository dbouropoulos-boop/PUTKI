/**
 * /back-office/settings - Feature flags & global toggles (iter77).
 *
 * Today: Voita feature gate (was API-only). Designed to be extended -
 * future global flags drop in as additional <Toggle/> rows without
 * needing new routes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Trophy, Send } from 'lucide-react';
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

// iter97k · one-click migration runner. Calls POST /api/admin/dispatch/migrate-iter97j.
// Shows the verification snapshot inline so the operator confirms the
// expected state (bot_config rows, settings values, ~523 subs) without
// needing to leave the page.
const MigrationButton = ({ busy, setBusy, setErr, token }) => {
  const [result, setResult] = useState(null);
  const run = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await adminFetch(`/api/admin/dispatch/migrate-iter97j`, {
        method: 'POST', token,
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setResult(j);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button onClick={run} disabled={busy}
        data-testid="settings-run-migration-btn"
        style={{
          padding: '12px 22px', cursor: busy ? 'wait' : 'pointer',
          background: '#E8C26E', color: '#0F0E0C', border: 'none',
          fontFamily: 'ui-monospace, monospace', fontSize: 11.5, letterSpacing: '0.2em',
          fontWeight: 800, borderRadius: 4,
        }}>
        {busy ? 'RUNNING…' : 'RUN iter97j MIGRATION'}
      </button>
      {result && (
        <div data-testid="settings-migration-result" style={{
          marginTop: 16, padding: 14, background: '#0F0E0C',
          border: '1px solid #2a2722', borderRadius: 4,
          fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
          color: '#A6E0B0', lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>
          {(result.actions || []).map((a, i) => <div key={i}>✓ {a}</div>)}
          {result.verification && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #2a2722', color: '#E8C26E' }}>
              eligible email subscribers: <strong>{result.verification.eligible_email_subscribers}</strong>
              {'\n'}settings: {JSON.stringify(result.verification.settings)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
      // iter97k · pass the shell-injected token as X-Admin-Token fallback
      // so a stale/missing cookie session doesn't 401 the page on every
      // mount. Cookie + header both attempted; either succeeds → 200.
      const r = await adminFetch(`/api/admin/settings`, { token });
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
            method: 'PUT', token,
            body: JSON.stringify({ voita_feature_enabled: next })});
          if (!r.ok) throw new Error(`PUT failed (${r.status})`);
          await refresh();
        } catch (e) { setErr(String(e?.message || e)); }
        finally { setBusy(false); }
      },
    });
  };

  const flipDispatch = (key, label, next) => {
    setConfirm({
      title: `${next ? 'Enable' : 'Disable'} ${label}?`,
      body: next
        ? `Subscribers will start receiving ${label} again. Daily dispatch is also gated by Mittari state (only KUUMA/MYRSKY/KIIRASTULI). Off-state days remain silent regardless of this toggle.`
        : `Subscribers will stop receiving ${label} immediately. The 10:00 Helsinki cron will silent-skip until you flip back on.`,
      danger: false,
      onConfirm: async () => {
        setBusy(true); setErr(null); setConfirm(null);
        try {
          const r = await adminFetch(`/api/admin/settings`, {
            method: 'PUT', token,
            body: JSON.stringify({ [key]: next })});
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

      {/* iter97k — one-click prod migration */}
      <section data-testid="settings-migrate-section" style={{ border: '1px solid #5a4c2e', padding: '20px 22px', marginBottom: 24, background: '#181412' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <CheckCircle2 size={18} style={{ color: '#E8C26E' }} />
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, margin: 0, color: '#F2EBE0' }}>Prod migration · iter97j</h2>
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6, color: '#D8CDB9', margin: '4px 0 16px', maxWidth: 680 }}>
          One-click runner for the iter97j database flags: state-gate eligible states, dispatch kill-switches (parks the 10:00 cron until you flip back on), and indexes. <strong>Safe to re-run.</strong> Each click is idempotent — no destructive writes. Run this once after the iter97j deploy lands in production.
        </p>
        <MigrationButton busy={busy} setBusy={setBusy} setErr={setErr} token={token} />
      </section>

      {/* iter97h — Telegram dispatch rules */}
      <section data-testid="settings-dispatch-section" style={{ border: '1px solid #2a2722', padding: '20px 22px', marginBottom: 24, background: '#13110d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Send size={18} style={{ color: '#E8C26E' }} />
          <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, margin: 0, color: '#F2EBE0' }}>Telegram dispatch rules</h2>
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.6, color: '#D8CDB9', margin: '4px 0 16px', maxWidth: 680 }}>
          State-change broadcasts are <strong>permanently disabled</strong> — there is no toggle for them. Daily dispatch fires only when Mittari is at <code>KUUMA</code>, <code>MYRSKY</code>, or <code>KIIRASTULI</code>; calmer days are silent. Below are the only switches the editor controls.
        </p>
        {settings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} data-testid="settings-daily-dispatch-row">
              <Toggle label="DAILY" on={settings.daily_dispatch_enabled !== false} busy={busy}
                onChange={(n) => flipDispatch('daily_dispatch_enabled', 'daily 10:00 dispatch', n)}
                testid="settings-daily-dispatch-toggle" />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#9C8B6B', letterSpacing: '0.06em' }}>
                Mittari-gated 10:00 Helsinki signals (Telegram + email). Default ON.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} data-testid="settings-special-drops-row">
              <Toggle label="DROPS" on={!!settings.special_drops_enabled} busy={busy}
                onChange={(n) => flipDispatch('special_drops_enabled', 'special drops', n)}
                testid="settings-special-drops-toggle" />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#9C8B6B', letterSpacing: '0.06em' }}>
                Editor-fired one-shot broadcasts. Manual only. Default OFF.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} data-testid="settings-partner-promos-row">
              <Toggle label="PROMOS" on={!!settings.partner_promos_enabled} busy={busy}
                onChange={(n) => flipDispatch('partner_promos_enabled', 'partner promos', n)}
                testid="settings-partner-promos-toggle" />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#9C8B6B', letterSpacing: '0.06em' }}>
                Sponsored partner content. Max 1/week when enabled. Default OFF.
              </span>
            </div>
          </div>
        )}
      </section>

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
