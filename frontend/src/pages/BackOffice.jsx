import React, { useEffect, useState } from 'react';
import { Lock, Save, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// Mittari.fi simple back-office page — token-protected.
// Token must match BACK_OFFICE_TOKEN env var on backend (default: "mittari-admin").
// Single setting: telegram_channel (URL like https://t.me/mittarifi)

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const BackOffice = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('mittari-admin-token') || ''; } catch { return ''; }
  });
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [telegram, setTelegram] = useState('');
  const [smarticoTemplate, setSmarticoTemplate] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);

  // Try auto-auth from storage on mount
  useEffect(() => {
    if (!token) return;
    fetchSettings(token);
    // eslint-disable-next-line
  }, []);

  const fetchSettings = async (tk) => {
    setBusy(true);
    setAuthError('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, {
        headers: { 'X-Admin-Token': tk },
      });
      if (r.status === 401 || r.status === 403) {
        setAuthError('Wrong token.');
        setAuthed(false);
        return;
      }
      if (!r.ok) throw new Error('Network error');
      const d = await r.json();
      setTelegram(d.telegram_channel || '');
      setSmarticoTemplate(d.smartico_template_id || '');
      setAuthed(true);
      try { localStorage.setItem('mittari-admin-token', tk); } catch {}
    } catch (e) {
      setAuthError(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (!token) return;
    fetchSettings(token);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSaveError('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          telegram_channel: telegram.trim() || null,
          smartico_template_id: smarticoTemplate.trim() || null,
        }),
      });
      if (!r.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <form onSubmit={handleAuth} className="panel w-full max-w-md p-7" data-testid="back-office-auth">
          <div className="flex items-center gap-3 mb-6">
            <Lock strokeWidth={1.5} size={20} style={{ color: 'var(--muted)' }} />
            <div>
              <div className="eyebrow">MITTARI · BACK OFFICE</div>
              <h1 className="display text-2xl mt-1" style={{ color: 'var(--ink)' }}>Admin authentication</h1>
            </div>
          </div>
          <label className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 600 }}>
            ADMIN TOKEN
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            data-testid="back-office-token-input"
            placeholder="••••••••••••"
            className="mono w-full mt-2"
            style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.08em' }}
            required
          />
          {authError && (
            <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.08em' }}>
              {authError}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full mt-5" data-testid="back-office-auth-submit">
            {busy ? 'Checking…' : 'Continue →'}
          </button>
          <div className="mono mt-5 text-center" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            ENV · BACK_OFFICE_TOKEN
          </div>
          <Link to="/" className="btn-ghost mt-4 w-full justify-center">← Back to Mittari</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="container-narrow">
        <div className="flex items-baseline justify-between mb-2">
          <div className="eyebrow">MITTARI · BACK OFFICE</div>
          <Link to="/" className="btn-ghost">← Back to site</Link>
        </div>
        <h1 className="display text-3xl sm:text-4xl mb-8" style={{ color: 'var(--ink)' }}>Site settings</h1>

        <form onSubmit={handleSave} className="panel p-7 space-y-5" data-testid="back-office-settings-form">
          <div>
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 600 }}>
              TELEGRAM CHANNEL URL
            </label>
            <input
              type="url"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              data-testid="back-office-telegram-input"
              placeholder="https://t.me/mittarifi"
              className="mono w-full mt-2"
              style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.04em' }}
            />
            <p className="font-serif mt-2" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              The Telegram subscribe button shown in capture surfaces opens this URL in a new tab.
              Leave empty to disable (button shows <em>“coming soon”</em>).
            </p>
            {telegram && (
              <a
                href={telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="mono inline-flex items-center gap-1 mt-2"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--brand-blue)', fontWeight: 600 }}
                data-testid="back-office-telegram-preview"
              >
                <ExternalLink strokeWidth={1.6} size={11} /> PREVIEW
              </a>
            )}
          </div>

          <div>
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 600 }}>
              SMARTICO VISITOR-MODE TEMPLATE ID
            </label>
            <input
              type="text"
              value={smarticoTemplate}
              onChange={(e) => setSmarticoTemplate(e.target.value)}
              data-testid="back-office-smartico-input"
              placeholder="e.g. vm-weezy-2026-q2-spinwheel"
              className="mono w-full mt-2"
              style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.04em' }}
            />
            <p className="font-serif mt-2" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              The template_id Smartico provides after Visitor Mode setup. When set, <code>/voita-palkinto</code>
              swaps the placeholder spin-wheel for the real Smartico embed. Leave empty to keep the placeholder.
            </p>
          </div>

          {saveError && (
            <div className="mono" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.08em' }}>
              {saveError}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn-primary" data-testid="back-office-save-btn">
            {saved ? (
              <span className="inline-flex items-center gap-2"><Check strokeWidth={1.8} size={14} /> SAVED</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Save strokeWidth={1.6} size={14} /> SAVE</span>
            )}
          </button>
        </form>

        <div className="mono mt-8" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
          P*RKELE-PISTE 100 / 100 · MITTARI 2026
        </div>
      </div>
    </div>
  );
};

export default BackOffice;
