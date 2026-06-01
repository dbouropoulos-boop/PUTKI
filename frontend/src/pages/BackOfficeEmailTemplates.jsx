/**
 * Back-office · Email + Telegram template editor.
 *
 * Single-pane editor backed by `db.settings.email_templates`. Sidebar
 * lists every known slug (catalogue, fixed order). Selecting a slug
 * loads the live template into an FI / EN side-by-side form with
 * subject + plain-text body + HTML body. Save is per-template; preview
 * renders against sample vars without dispatching.
 *
 * Editable fields (per template):
 *   subject_fi · subject_en
 *   body_text_fi · body_text_en
 *   body_html_fi · body_html_en
 *
 * Immutable from the editor:
 *   channel (email / telegram) - set in default seed
 *   gated   (true for placeholder copy)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';
import { adminFetch } from '../lib/fetchAdmin';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const GOLD = '#FFBF6B';

const Variables = ['{name}', '{profile_name}', '{diagnostic}', '{raffle_title}',
  '{entry_position}', '{prize_label}', '{redeem_url}', '{magic_link}',
  '{unsubscribe_url}', '{site_url}'];

const BackOfficeEmailTemplates = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const headers = useMemo(() => ({ 'X-Admin-Token': token }), [token]);
  const [data, setData] = useState(null);
  const [activeSlug, setActiveSlug] = useState('voita_playbook');
  const [draft, setDraft] = useState(null);   // local edits to active template
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLang, setPreviewLang] = useState('fi');
  const [savedAt, setSavedAt] = useState(null);

  const refresh = useCallback(() => {
    if (!authed) return;
    adminFetch(`/api/admin/email-templates`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setData(d);
      })
      .catch((e) => console.warn('[email-templates]', e));
  }, [authed, headers]);

  useEffect(refresh, [refresh]);

  // Snap the draft to the active slug whenever it changes.
  useEffect(() => {
    if (!data?.templates) return;
    setDraft({ ...(data.templates[activeSlug] || {}) });
    setPreview(null);
  }, [activeSlug, data]);

  const save = async () => {
    if (!data || !draft) return;
    setSaving(true);
    const next = { ...(data.templates || {}), [activeSlug]: draft };
    try {
      const r = await adminFetch(`/api/admin/email-templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },body: JSON.stringify({ templates: next })});
      if (r.ok) {
        setSavedAt(new Date().toISOString());
        refresh();
      }
    } finally { setSaving(false); }
  };

  const doPreview = async () => {
    const r = await adminFetch(`/api/admin/email-templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },body: JSON.stringify({ slug: activeSlug, lang: previewLang })});
    if (r.ok) setPreview(await r.json());
  };

  const catalogue = useMemo(() => (data?.catalogue || []), [data]);
  const activeMeta = catalogue.find((c) => c.slug === activeSlug);

  if (!authed) {
    return null; // iter84: legacy AuthGate dead-stripped (shell handles auth)
  }
  if (!data || !draft) {
    return <div style={{ padding: 24, color: 'var(--muted)' }}>Loading templates…</div>;
  }

  const Banner = () => (
    <div style={{
      padding: '10px 14px',
      background: data.resend_configured ? '#0F2A1B' : '#2A1A10',
      border: `1px solid ${data.resend_configured ? '#1F4A33' : '#5C3A1F'}`,
      color: data.resend_configured ? '#A5D7B8' : '#FFBF6B',
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.06em', marginBottom: 18,
    }}>
      {data.resend_configured
        ? 'RESEND_API_KEY · RESEND_FROM are set. Templates dispatch the moment a lead triggers them.'
        : 'RESEND_API_KEY is NOT set yet - outbox holds all queued emails. Templates can still be edited + previewed; nothing sends.'}
      {!data.dispatch_ready_flag && (
        <span style={{ marginLeft: 8, color: GOLD }}>
          PLAYBOOK_EMAIL_DISPATCH_READY=0 - gated templates (poker/blackjack playbooks) cannot dispatch even with Resend live.
        </span>
      )}
    </div>
  );

  const Field = ({ label, value, onChange, multiline, lang }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700,
        textTransform: 'uppercase',
      }}>{label} · {lang.toUpperCase()}</span>
      {multiline ? (
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          data-testid={`bo-tpl-${label.toLowerCase().replace(/\s+/g, '-')}-${lang}`}
          rows={multiline === 'tall' ? 10 : 5}
          style={{
            background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border)', padding: '10px 12px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.55,
          }} />
      ) : (
        <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          data-testid={`bo-tpl-${label.toLowerCase().replace(/\s+/g, '-')}-${lang}`}
          style={{
            background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border)', padding: '10px 12px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
          }} />
      )}
    </label>
  );

  return (
    <div data-testid="bo-tpl-page" style={{
      background: 'var(--bg)', minHeight: '100vh', color: 'var(--ink)',
      padding: '24px 24px 56px',
    }}>
      <header style={{ marginBottom: 22 }}>
        <Link to="/back-office" data-testid="bo-tpl-back" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', color: 'var(--muted)', textDecoration: 'none',
        }}>← BACK-OFFICE</Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, margin: '6px 0 6px', letterSpacing: '-0.02em' }}>
          Email + Telegram templates
        </h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
          Every templated message the platform sends. FI + EN. Persisted overrides; defaults are kept as fallback.
        </p>
      </header>
      <Banner />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
        {/* Catalogue sidebar */}
        <aside data-testid="bo-tpl-sidebar" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          padding: '8px 0', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto',
        }}>
          {catalogue.map((c) => {
            const active = c.slug === activeSlug;
            return (
              <button key={c.slug} type="button"
                data-testid={`bo-tpl-pick-${c.slug}`}
                onClick={() => setActiveSlug(c.slug)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', background: active ? 'var(--bg)' : 'transparent',
                  border: 0, borderLeft: `3px solid ${active ? '#5B8DEE' : 'transparent'}`,
                  color: 'var(--ink)', cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                }}>
                <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{c.slug}</div>
                <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.08em' }}>
                  {c.channel.toUpperCase()}{c.gated ? ' · GATED' : ''}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Editor */}
        <main>
          <div style={{
            padding: '14px 16px', background: 'var(--surface)',
            border: '1px solid var(--border)', marginBottom: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.16em', fontWeight: 700, color: '#5B8DEE',
              }} data-testid="bo-tpl-active-slug">{activeSlug}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, maxWidth: 720 }}>
                {activeMeta?.description}
                {activeMeta?.gated && (
                  <span style={{ color: GOLD, marginLeft: 8 }}>· GATED until PLAYBOOK_EMAIL_DISPATCH_READY=1</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={doPreview}
                data-testid="bo-tpl-preview-btn"
                style={{
                  padding: '8px 14px', background: 'transparent', color: 'var(--ink)',
                  border: '1px solid var(--border-strong)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.16em', fontWeight: 700, cursor: 'pointer',
                }}>PREVIEW →</button>
              <button type="button" onClick={save} disabled={saving}
                data-testid="bo-tpl-save"
                style={{
                  padding: '8px 14px', background: '#5B8DEE', color: '#0B0A09',
                  border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.18em', fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
                }}>{saving ? 'SAVING…' : 'SAVE'}</button>
            </div>
          </div>
          {savedAt && (
            <div data-testid="bo-tpl-saved" style={{ color: '#6FA37D', fontSize: 11, marginBottom: 10 }}>
              ✓ Saved at {savedAt.slice(11, 19)}
            </div>
          )}

          {/* Variables row */}
          <div style={{
            padding: '10px 14px', background: 'var(--surface)',
            border: '1px solid var(--border)', marginBottom: 14,
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            color: 'var(--muted)', letterSpacing: '0.06em',
          }}>
            <strong style={{ color: 'var(--ink)' }}>VARIABLES (paste anywhere):</strong>{' '}
            {Variables.map((v) => (
              <span key={v} style={{ marginRight: 8, color: '#FFBF6B' }}>{v}</span>
            ))}
          </div>

          {/* Side-by-side FI / EN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {['fi', 'en'].map((lang) => (
              <div key={lang} data-testid={`bo-tpl-col-${lang}`} style={{
                padding: 14, background: 'var(--surface)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <Field label="subject" lang={lang}
                  value={draft[`subject_${lang}`]}
                  onChange={(v) => setDraft({ ...draft, [`subject_${lang}`]: v })} />
                <Field label="body-text" lang={lang} multiline
                  value={draft[`body_text_${lang}`]}
                  onChange={(v) => setDraft({ ...draft, [`body_text_${lang}`]: v })} />
                <Field label="body-html" lang={lang} multiline="tall"
                  value={draft[`body_html_${lang}`]}
                  onChange={(v) => setDraft({ ...draft, [`body_html_${lang}`]: v })} />
              </div>
            ))}
          </div>

          {/* Preview pane */}
          {preview && (
            <div data-testid="bo-tpl-preview" style={{
              marginTop: 18, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
              }}>
                <strong style={{ letterSpacing: '0.16em' }}>PREVIEW</strong>
                <select value={previewLang} onChange={(e) => setPreviewLang(e.target.value)}
                  data-testid="bo-tpl-preview-lang"
                  style={{ padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                  <option value="fi">FI</option>
                  <option value="en">EN</option>
                </select>
                <button type="button" onClick={doPreview}
                  style={{
                    padding: '4px 10px', background: 'transparent',
                    border: '1px solid var(--border)', color: 'var(--ink)',
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  }}>REFRESH</button>
                {preview.gated && <span style={{ color: GOLD }}>· GATED</span>}
              </div>
              <div data-testid="bo-tpl-preview-subject" style={{
                fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
                marginBottom: 8,
              }}>{preview.subject || <em style={{ color: 'var(--muted)' }}>(no subject)</em>}</div>
              {preview.body_html ? (
                // sandboxed iframe so back-office isn't styled by template CSS.
                <iframe title="preview" sandbox=""
                  srcDoc={preview.body_html}
                  data-testid="bo-tpl-preview-frame"
                  style={{
                    width: '100%', height: 380, background: '#FFFFFF',
                    border: '1px solid var(--border)',
                  }} />
              ) : (
                <pre data-testid="bo-tpl-preview-text" style={{
                  padding: 14, background: '#FFFFFF', color: '#0B0A09',
                  fontFamily: 'ui-monospace, monospace', fontSize: 12,
                  whiteSpace: 'pre-wrap', border: '1px solid var(--border)',
                }}>{preview.body_text}</pre>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default BackOfficeEmailTemplates;
