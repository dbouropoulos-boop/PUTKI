import React, { useEffect, useState } from 'react';
import { Lock, Save, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// PUTKI HQ simple back-office page — token-protected.
// Token must match BACK_OFFICE_TOKEN env var on backend (default: "putki-hq-admin").
// Single setting: telegram_channel (URL like https://t.me/putkihq)

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const BackOffice = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('putki-hq-admin-token') || ''; } catch { return ''; }
  });
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [telegram, setTelegram] = useState('');
  const [smarticoTemplate, setSmarticoTemplate] = useState('');
  const [smarticoLoaderUrl, setSmarticoLoaderUrl] = useState('');
  const [smarticoBrandKey, setSmarticoBrandKey] = useState('');
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
      setSmarticoLoaderUrl(d.smartico_loader_url || '');
      setSmarticoBrandKey(d.smartico_brand_key || '');
      setAuthed(true);
      try { localStorage.setItem('putki-hq-admin-token', tk); } catch {}
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
          smartico_loader_url: smarticoLoaderUrl.trim() || null,
          smartico_brand_key: smarticoBrandKey.trim() || null,
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
              <div className="eyebrow">PUTKI HQ · BACK OFFICE</div>
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
          <Link to="/" className="btn-ghost mt-4 w-full justify-center">← Back to PUTKI HQ</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="container-narrow">
        <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
          <div className="eyebrow">PUTKI HQ · BACK OFFICE</div>
          <Link to="/" className="btn-ghost" data-testid="back-office-back-home">← Back to site</Link>
        </div>
        <h1 className="display text-3xl sm:text-4xl mb-2" style={{ color: 'var(--ink)' }}>Operations</h1>
        <p className="font-serif mb-10" style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.55, maxWidth: 640 }}>
          Compose, monitor and ship every public surface. Pick a section below — or scroll past the index for global site settings.
        </p>

        <BackOfficeIndex />

        <div className="mt-14" style={{ borderTop: '1px solid var(--border)', paddingTop: 36 }}>
          <div className="eyebrow mb-2">GLOBAL · SITE SETTINGS</div>
          <h2 className="display text-2xl mb-6" style={{ color: 'var(--ink)' }}>Telegram channel + Smartico embed</h2>

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
              placeholder="https://t.me/putkihq"
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

          <div>
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 600 }}>
              SMARTICO LOADER SCRIPT URL
            </label>
            <input
              type="text"
              value={smarticoLoaderUrl}
              onChange={(e) => setSmarticoLoaderUrl(e.target.value)}
              data-testid="back-office-smartico-loader-input"
              placeholder="https://cdn.smartico.ai/loader/your-brand.js"
              className="mono w-full mt-2"
              style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.04em' }}
            />
            <p className="font-serif mt-2" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Once both <em>template_id</em> and <em>loader URL</em> are set, the Smartico SDK is injected on
              <code> /voita-palkinto</code> and the embed div is auto-discovered. Leave empty to keep the static
              embed div without SDK initialization.
            </p>
          </div>

          <div>
            <label className="mono" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 600 }}>
              SMARTICO BRAND KEY (OPTIONAL)
            </label>
            <input
              type="text"
              value={smarticoBrandKey}
              onChange={(e) => setSmarticoBrandKey(e.target.value)}
              data-testid="back-office-smartico-brand-input"
              placeholder="weezybet-fi"
              className="mono w-full mt-2"
              style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.04em' }}
            />
            <p className="font-serif mt-2" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Optional Smartico brand key — passed as a <code>data-smartico-brand-key</code> attribute on the
              loader script tag.
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
        </div>

        <div className="mono mt-8" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
          P*RKELE-PISTE 100 / 100 · PUTKI HQ 2026
        </div>
      </div>
    </div>
  );
};

// ── Back-office grouped index ─────────────────────────────────────────
// 3 themed columns so admins can scan-find instead of scan-read.
// Each tile preserves its original data-testid (`back-office-link-*`) so
// regression tests and deep-links keep working.

const INDEX_GROUPS = [
  {
    key: 'content',
    title: 'Content',
    eyebrow: 'COPY · DRAFTS · DISPATCH',
    accent: '#5B8DEE',
    tiles: [
      { to: '/back-office/mittari-copy',              testid: 'back-office-link-mittari-copy',          label: 'Mittari copy',           desc: 'Every line on /mittari — hero, signals, founder, FAQ.' },
      { to: '/back-office/mestari-copy',              testid: 'back-office-link-mestari-copy',          label: 'Mestari copy',           desc: 'Sports diagnostic landing — 8 sections, FI + EN.' },
      { to: '/back-office/mestari-diagnostics-copy',  testid: 'back-office-link-mestari-diag-copy',     label: 'Mestari diagnostics',    desc: 'Hub chooser + poker + blackjack landings.' },
      { to: '/back-office/voita-quiz',                testid: 'back-office-link-voita-quiz',            label: 'Voita hero + quiz',      desc: 'Banner + 5-question lesson set + profiles.' },
      { to: '/back-office/voyager',                   testid: 'back-office-link-voyager',               label: 'Voyager rotation',       desc: '/game weekly partner + prize variance.' },
      { to: '/back-office/email-templates',           testid: 'back-office-link-email-templates',       label: 'Email + TG templates',   desc: '20 templates — Voita / Mestari / Telegram welcome.' },
      { to: '/back-office/news-watch',                testid: 'back-office-link-news-watch',            label: 'News-watch',             desc: 'Promote · demote · kill — editor veto over the classifier.' },
      { to: '/back-office/queue',                     testid: 'back-office-link-queue',                 label: 'Editorial queue',        desc: 'Auto-generated drafts awaiting your green light.' },
      { to: '/back-office/dispatch-preview',          testid: 'back-office-link-dispatch-preview',      label: 'Dispatch preview',       desc: 'Dry-run the daily digest before send.' },
      { to: '/back-office/foundational-research',     testid: 'back-office-link-research',              label: 'Research',               desc: 'Foundational dataset · 305 subjects.' },
    ],
  },
  {
    key: 'leads',
    title: 'Leads & raffles',
    eyebrow: 'CAPTURE · LIFECYCLE · PAYOUTS',
    accent: '#C13B2C',
    tiles: [
      { to: '/back-office/leads',                     testid: 'back-office-link-leads',                 label: 'Leads lifecycle',        desc: 'Every signup joined across email / TG / surfaces.' },
      { to: '/back-office/playbook',                  testid: 'back-office-link-playbook',              label: 'Playbook + email queue', desc: 'Universal PDF + outbox status (per-row retry).' },
      { to: '/back-office/optin-segments',            testid: 'back-office-link-optin-segments',        label: 'Opt-in segments',        desc: 'Subscriber tags + per-source counts.' },
      { to: '/back-office/voita',                     testid: 'back-office-link-voita',                 label: 'Voita raffles',          desc: 'Create · draw · mark paid · notify winner.' },
      { to: '/back-office/weekly',                    testid: 'back-office-link-weekly',                label: 'Weekly card',            desc: 'Five-pick prediction prize + leaderboard.' },
      { to: '/back-office/peli',                      testid: 'back-office-link-peli',                  label: 'Peli',                   desc: 'Monthly Voyager raffle entries + partner config.' },
      { to: '/back-office/telegram',                  testid: 'back-office-link-telegram',              label: 'Telegram bot',           desc: 'Webhook · bound chats · audit log.' },
    ],
  },
  {
    key: 'ops',
    title: 'Ops & inventory',
    eyebrow: 'ROSTERS · PLUMBING',
    accent: '#6FA37D',
    tiles: [
      { to: '/back-office/operators',                 testid: 'back-office-link-operators',             label: 'Operators',              desc: 'Casino roster + partner flags + scores.' },
      { to: '/back-office/streamers',                 testid: 'back-office-link-streamers',             label: 'Streamers',              desc: 'Editorial streamer roster (Twitch + Kick + YT).' },
      { to: '/back-office/mini-games',                testid: 'back-office-link-mini-games',            label: 'Mini-games',             desc: 'CRUD for quiz / scenario / insight question banks.' },
      { to: '/back-office/streamer-meta',             testid: 'back-office-link-streamer-meta',         label: 'Streamer meta',          desc: 'Per-streamer subtitles + meta lines.' },
      { to: '/back-office/slot-registry',             testid: 'back-office-link-slot-registry',         label: 'Slot registry',          desc: 'Game inventory + provider tags.' },
      { to: '/back-office/webhooks',                  testid: 'back-office-link-webhooks',              label: 'Webhooks',               desc: 'Twitch / Kick / YouTube subscription state.' },
    ],
  },
];

const BackOfficeIndex = () => (
  <div className="space-y-10" data-testid="back-office-index">
    {INDEX_GROUPS.map((group) => (
      <section key={group.key} data-testid={`back-office-group-${group.key}`}>
        <div className="flex items-baseline gap-3 mb-4">
          <span aria-hidden style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: group.accent, transform: 'translateY(-2px)',
          }} />
          <div>
            <div className="mono" style={{
              fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)',
              fontWeight: 700, textTransform: 'uppercase',
            }}>{group.eyebrow}</div>
            <h2 className="display text-xl sm:text-2xl mt-1" style={{
              color: 'var(--ink)', fontWeight: 700, letterSpacing: '-0.01em',
            }}>{group.title}</h2>
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {group.tiles.map((tile) => (
            <Link
              key={tile.testid}
              to={tile.to}
              data-testid={tile.testid}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '14px 16px',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${group.accent}`,
                background: 'var(--surface)',
                textDecoration: 'none',
                transition: 'border-color 120ms ease, transform 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              <div className="display" style={{
                color: 'var(--ink)', fontWeight: 700, fontSize: 15,
                letterSpacing: '-0.005em', lineHeight: 1.2,
              }}>{tile.label} <span style={{ color: group.accent, fontWeight: 600 }}>→</span></div>
              <div className="font-serif" style={{
                color: 'var(--muted)', fontSize: 13, lineHeight: 1.45,
              }}>{tile.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export default BackOffice;
