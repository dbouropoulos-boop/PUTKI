/**
 * BackOfficeIntegrations - first-class home for third-party service
 * configuration. Currently surfaces Smartico Visitor Mode. Future
 * integrations (Resend, Twilio, Telegram, OAuth providers, analytics)
 * land here next.
 *
 * Lives under <BackOfficeShell />, so auth/token + sidebar/status-strip/
 * breadcrumb/density/Cmd+K all come from the outlet context.
 *
 * Smartico fields persist via the existing /api/admin/settings endpoint;
 * the public renderer (/voita-palkinto) keeps consuming them via
 * /api/settings/public unchanged. No backend migration was needed —
 * this page just gives the live values a proper editorial UI.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CheckCircle2, AlertCircle, ExternalLink, Save, Link2, Activity,
} from 'lucide-react';
import useFormAutosave, { AutosaveStatus } from '../hooks/useFormAutosave';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SMARTICO_FIELDS = ['smartico_template_id', 'smartico_loader_url', 'smartico_brand_key'];

const Pill = ({ tone = 'neutral', icon: Icon, label, testid }) => {
  const toneColor = {
    ok:      { bg: 'var(--ember-soft)', text: 'var(--ember-strong)', dot: 'var(--ember-strong)' },
    warn:    { bg: '#FBEDEC',           text: 'var(--dial-myrsky)',  dot: 'var(--dial-myrsky)' },
    neutral: { bg: 'var(--surface)',    text: 'var(--ink-2)',        dot: 'var(--ink-3)' },
  }[tone];
  return (
    <span data-testid={testid} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', background: toneColor.bg,
      border: '1px solid var(--line)', borderRadius: 999,
      fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.08em',
      color: toneColor.text, fontWeight: 700, textTransform: 'uppercase',
    }}>
      {Icon && <Icon size={12} strokeWidth={2.4} style={{ color: toneColor.dot }} />}
      {label}
    </span>
  );
};

const Field = ({ label, helper, value, onChange, placeholder, testid, type = 'text' }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{
      display: 'block', fontFamily: MONO, fontSize: 10.5,
      letterSpacing: '0.14em', color: 'var(--ink-3)', fontWeight: 700,
      textTransform: 'uppercase', marginBottom: 6,
    }}>{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--ember)';
        e.target.style.boxShadow = '0 0 0 3px var(--ember-soft)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = 'var(--line-strong)';
        e.target.style.boxShadow = 'none';
      }}
      style={{
        width: '100%', padding: '10px 12px', background: 'var(--bg)',
        color: 'var(--ink)', border: '1px solid var(--line-strong)',
        borderRadius: 4, fontFamily: MONO, fontSize: 13, boxSizing: 'border-box',
        outline: 'none', transition: 'border-color 100ms ease, box-shadow 100ms ease',
      }} />
    {helper && (
      <p style={{
        margin: '6px 0 0', fontFamily: MONO, fontSize: 10,
        letterSpacing: '0.04em', color: 'var(--ink-3)', lineHeight: 1.55,
      }}>{helper}</p>
    )}
  </div>
);

const _fmtTimestamp = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fi-FI', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki',
    });
  } catch { return iso; }
};

const BackOfficeIntegrations = () => {
  const { token } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [serverState, setServerState] = useState(null);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [form, setForm] = useState({
    smartico_template_id: '',
    smartico_loader_url: '',
    smartico_brand_key: '',
  });

  const headers = useMemo(() => ({ 'X-Admin-Token': token || '' }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true); setFeedback(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setServerState(data);
      setForm({
        smartico_template_id: data.smartico_template_id || '',
        smartico_loader_url: data.smartico_loader_url || '',
        smartico_brand_key: data.smartico_brand_key || '',
      });
    } catch (e) {
      setFeedback({ ok: false, text: `Load failed: ${String(e?.message || e)}` });
    } finally { setLoading(false); }
  }, [token, headers]);

  useEffect(() => { refresh(); }, [refresh]);

  const dirty = useMemo(() => {
    if (!serverState) return false;
    return SMARTICO_FIELDS.some((k) => (form[k] || '') !== (serverState[k] || ''));
  }, [form, serverState]);

  const isConfigured = Boolean(
    form.smartico_template_id?.trim() && form.smartico_brand_key?.trim(),
  );

  const save = useCallback(async (formForSave) => {
    setFeedback(null);
    const src = formForSave || form;
    // Send all 3 fields together — the admin endpoint always overwrites,
    // so we must include every Smartico field even if the editor only
    // touched one of them.
    const payload = {};
    for (const k of SMARTICO_FIELDS) {
      const trimmed = (src[k] || '').trim();
      payload[k] = trimmed === '' ? null : trimmed;
    }
    const r = await fetch(`${BACKEND}/api/admin/settings`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`HTTP ${r.status}: ${txt}`);
    }
    const data = await r.json();
    setServerState(data);
    setFeedback({ ok: true, text: 'Saved.' });
    return data;
  }, [form, headers]);

  // iter84 · Task 2.8 — debounced autosave + Cmd+S shortcut. Mirrors
  // the dirty flag this page already maintains. The shell-handled
  // AuthGate guarantees `token` exists by the time the autosave hook
  // fires.
  const autosave = useFormAutosave({
    form, dirty, onSave: save, delay: 2000,
  });
  // Surface `saving` to the existing Save button without a second
  // useState round-trip.
  const saving = autosave.saving;

  const setField = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Test connection probe — pings the loader URL via the new admin
  // endpoint and confirms the response is a JS SDK. Uses the form's
  // current loader_url (not the persisted one) so editors can validate
  // BEFORE saving.
  const doProbe = async () => {
    const url = (form.smartico_loader_url || '').trim();
    if (!url) {
      setProbeResult({ ok: false, message: 'Loader URL required for probe.' });
      return;
    }
    setProbing(true); setProbeResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/integrations/smartico/test-connection`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loader_url: url }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt}`);
      }
      setProbeResult(await r.json());
    } catch (e) {
      setProbeResult({ ok: false, message: `Probe failed: ${String(e?.message || e)}` });
    } finally { setProbing(false); }
  };

  return (
    <div data-testid="bo-integrations-page">
      <header style={{ marginBottom: 22 }}>
        <h1 style={{
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 28,
          fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)',
        }}>Integrations</h1>
        <p style={{
          color: 'var(--ink-3)', fontFamily: MONO, fontSize: 11,
          letterSpacing: '0.06em', marginTop: 6,
        }}>
          Third-party services in active use. Smartico powers the Visitor Mode game on /voita-palkinto.
        </p>
      </header>

      {loading ? (
        <div data-testid="bo-integrations-loading" style={{
          padding: '40px 16px', background: 'var(--surface)',
          border: '1px dashed var(--line)', borderRadius: 6,
          fontFamily: MONO, fontSize: 11, color: 'var(--ink-3)', textAlign: 'center',
        }}>Loading current configuration…</div>
      ) : (
        <section data-testid="bo-integrations-smartico" style={{
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 24, marginBottom: 24,
        }}>
          {/* Header row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 14,
          }}>
            <div>
              <h2 style={{
                fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22,
                fontWeight: 700, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)',
              }}>Smartico Visitor Mode</h2>
              <p style={{
                margin: '4px 0 0', fontFamily: MONO, fontSize: 10.5,
                letterSpacing: '0.06em', color: 'var(--ink-3)',
              }}>
                Spin-the-wheel / first-deposit promotion widget embedded on{' '}
                <code style={{ color: 'var(--ink)' }}>/voita-palkinto</code>.
              </p>
            </div>
            {isConfigured ? (
              <Pill tone="ok" icon={CheckCircle2} label="CONFIGURED" testid="bo-smartico-status-configured" />
            ) : (
              <Pill tone="warn" icon={AlertCircle} label="NOT CONFIGURED" testid="bo-smartico-status-missing" />
            )}
          </div>

          {/* Test connection bar — lives right under the status pill so
              editors can verify their loader URL without leaving the page. */}
          <div data-testid="bo-smartico-probe-bar" style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 4, padding: '10px 14px', marginBottom: 18,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
              color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
            }}>HEALTH CHECK</span>
            <span style={{ flex: 1, minWidth: 8 }} />
            <button data-testid="bo-smartico-probe-btn" onClick={doProbe}
              disabled={probing || !form.smartico_loader_url?.trim()}
              style={{
                padding: '7px 14px',
                background: probing ? 'var(--surface-2)' : 'var(--bg)',
                color: 'var(--ink)',
                border: '1px solid var(--line-strong)',
                fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em',
                fontWeight: 700, borderRadius: 3, textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                cursor: probing || !form.smartico_loader_url?.trim() ? 'not-allowed' : 'pointer',
                opacity: probing || !form.smartico_loader_url?.trim() ? 0.55 : 1,
                transition: 'background-color 100ms ease, opacity 100ms ease',
              }}>
              <Activity size={11} strokeWidth={2.4} />
              {probing ? 'PROBING…' : 'TEST CONNECTION'}
            </button>
          </div>
          {probeResult && (
            <div data-testid="bo-smartico-probe-result" style={{
              padding: '10px 14px', borderRadius: 4, marginBottom: 18,
              background: probeResult.ok ? 'var(--ember-soft)' : '#FBEDEC',
              color: probeResult.ok ? 'var(--ember-strong)' : 'var(--dial-myrsky)',
              border: `1px solid ${probeResult.ok ? 'var(--ember-soft)' : '#F5C4BF'}`,
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', lineHeight: 1.55,
            }}>
              <div style={{ fontWeight: 700, marginBottom: probeResult.message ? 4 : 0 }}>
                {probeResult.ok ? '✓ ' : '× '}
                {probeResult.status != null
                  ? `HTTP ${probeResult.status} · ${probeResult.content_type || 'unknown content-type'}`
                  : 'Unreachable'}
                {probeResult.latency_ms != null && (
                  <span style={{ marginLeft: 8, opacity: 0.75 }}>
                    · {probeResult.latency_ms} ms
                  </span>
                )}
              </div>
              {probeResult.message && (
                <div style={{ fontWeight: 500 }}>{probeResult.message}</div>
              )}
            </div>
          )}

          {/* Docs link */}
          <div style={{ marginBottom: 22 }}>
            <a href="https://docs.smartico.ai/" target="_blank" rel="noopener noreferrer"
              data-testid="bo-smartico-docs"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
                color: 'var(--ember-strong)', textDecoration: 'none', fontWeight: 700,
                textTransform: 'uppercase',
              }}>
              <ExternalLink size={12} strokeWidth={2.2} />
              Smartico admin docs
            </a>
          </div>

          {/* Form */}
          <Field label="Template ID" testid="bo-smartico-template-id"
            value={form.smartico_template_id}
            onChange={setField('smartico_template_id')}
            placeholder="e.g. 3383"
            helper="The Smartico template ID for the active visitor-mode widget. Find under Smartico → Visitor Mode → Templates." />

          <Field label="Loader URL" testid="bo-smartico-loader-url"
            value={form.smartico_loader_url}
            onChange={setField('smartico_loader_url')}
            placeholder="https://loader.smr-cdn.com/loader.js"
            helper="CDN URL of the Smartico SDK loader script. Copy from the integration snippet provided by Smartico." />

          <Field label="Brand key" testid="bo-smartico-brand-key"
            value={form.smartico_brand_key}
            onChange={setField('smartico_brand_key')}
            placeholder="e.g. weezybet-fi"
            helper="Identifies which brand inside the Smartico tenant should receive visitor events. PRESERVE existing value." />

          {/* Footer row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--line)',
            paddingTop: 16, marginTop: 6,
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em',
              color: 'var(--ink-3)',
            }}>
              <span style={{
                color: 'var(--ink-3)', textTransform: 'uppercase',
                letterSpacing: '0.14em', fontWeight: 700, marginRight: 6,
              }}>LAST SAVED</span>
              <span data-testid="bo-smartico-last-saved" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                {_fmtTimestamp(serverState?.updated_at)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AutosaveStatus
                status={autosave.status}
                error={autosave.error}
                lastSavedAt={autosave.lastSavedAt}
                testid="bo-smartico-autosave-status"
              />
              {dirty && (
                <span data-testid="bo-smartico-dirty"
                  style={{
                    fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.18em',
                    color: 'var(--dial-myrsky)', fontWeight: 700,
                  }}>UNSAVED</span>
              )}
              <button data-testid="bo-smartico-save" onClick={autosave.forceSave}
                disabled={saving || !dirty}
                style={{
                  padding: '10px 18px', background: 'var(--ember)', color: '#FFFFFF',
                  border: 0, fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em',
                  fontWeight: 700, cursor: saving || !dirty ? 'not-allowed' : 'pointer',
                  borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: saving || !dirty ? 0.55 : 1, transition: 'opacity 100ms ease',
                  textTransform: 'uppercase',
                }}>
                <Save size={12} /> {saving ? 'SAVING…' : 'SAVE'}
              </button>
            </div>
          </div>

          {feedback && (
            <div data-testid="bo-smartico-feedback" style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 4,
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
              background: feedback.ok ? 'var(--ember-soft)' : '#FBEDEC',
              color: feedback.ok ? 'var(--ember-strong)' : 'var(--dial-myrsky)',
              border: `1px solid ${feedback.ok ? 'var(--ember-soft)' : '#F5C4BF'}`,
            }}>{feedback.text}</div>
          )}
        </section>
      )}

      {/* Empty-state slot for future integrations */}
      <section data-testid="bo-integrations-roadmap" style={{
        background: 'var(--surface)', border: '1px dashed var(--line)',
        borderRadius: 6, padding: 24,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em',
          color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          <Link2 size={12} strokeWidth={2.2} /> COMING SOON
        </div>
        <p style={{
          margin: 0, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
          color: 'var(--ink-2)', lineHeight: 1.55,
        }}>
          Future integrations (Resend, Twilio, Telegram bot config, OAuth providers, analytics)
          will land on this page with status pills + per-integration save flow.
        </p>
      </section>
    </div>
  );
};

export default BackOfficeIntegrations;
