/**
 * BellAlertManager — header bell icon + dropdown panel.
 *
 * Click the bell:
 *   • Not signed in   → email + 6-digit code flow (inline)
 *   • Signed in       → list of streamer subscriptions, each with a
 *                       trash button. Plus a "logout" pill.
 *
 * The session lives in localStorage (`putki.alert_session`) so the
 * bell remembers you across reloads. 30-day server-side TTL on the
 * token; refresh by signing in again.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, Trash2, LogOut } from 'lucide-react';
import { useAlertSession } from '../hooks/useAlertSession';
import { useLang } from '../context/LanguageContext';

export const BellAlertManager = () => {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const {
    session, subs, isAuthed, error,
    requestCode, verifyCode, removeSubscription, logout,
  } = useAlertSession();

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const count = subs.length;
  const t = lang === 'en' ? T_EN : T_FI;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.openLabel}
        aria-expanded={open}
        data-testid="header-bell-button"
        className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
        style={{ borderColor: 'var(--border-strong)', color: 'var(--ink)' }}
      >
        <Bell strokeWidth={1.5} size={16} />
        {isAuthed && count > 0 && (
          <span
            data-testid="header-bell-badge"
            style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8, background: '#C13B2C', color: '#0B0A09',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--bg)',
            }}
          >{count}</span>
        )}
      </button>

      {open && (
        <div
          data-testid="header-bell-panel"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: 360, maxWidth: 'calc(100vw - 24px)',
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            zIndex: 60, padding: 16,
          }}
        >
          {!isAuthed
            ? <SigninPanel t={t} error={error} onRequest={requestCode} onVerify={verifyCode} />
            : <SubsPanel t={t} email={session.email} subs={subs}
                         onRemove={removeSubscription} onLogout={logout}
                         onClose={() => setOpen(false)} />}
        </div>
      )}
    </div>
  );
};

// ── Sign-in panel ─────────────────────────────────────────────────────

const SigninPanel = ({ t, error, onRequest, onVerify }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);

  const submitEmail = async (e) => {
    e.preventDefault();
    setBusy(true); setLocalError(null);
    const r = await onRequest(email.trim());
    setBusy(false);
    if (r.ok) setStep(2);
    else setLocalError(r.reason || 'invalid_email');
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setBusy(true); setLocalError(null);
    const r = await onVerify(email.trim(), code.trim());
    setBusy(false);
    if (!r.ok) setLocalError(r.reason || 'code_mismatch');
  };

  return (
    <div data-testid="bell-signin">
      <div style={headingStyle}>{t.signinTitle}</div>
      <p style={leadStyle}>{step === 1 ? t.signinLead1 : t.signinLead2(email)}</p>
      {step === 1 ? (
        <form onSubmit={submitEmail}>
          <input
            type="email" required autoFocus
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="bell-email-input"
            style={inputStyle}
          />
          <button type="submit" disabled={busy} data-testid="bell-request-code-btn" style={primaryBtn}>
            {busy ? '…' : t.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode}>
          <input
            type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            data-testid="bell-code-input"
            style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace',
              fontSize: 22, letterSpacing: '0.4em', textAlign: 'center' }}
          />
          <button type="submit" disabled={busy || code.length !== 6}
                  data-testid="bell-verify-code-btn" style={primaryBtn}>
            {busy ? '…' : t.verifyCode}
          </button>
          <button type="button" onClick={() => { setStep(1); setCode(''); setLocalError(null); }}
                  data-testid="bell-back-to-email" style={secondaryBtn}>
            ← {t.backToEmail}
          </button>
        </form>
      )}
      {(localError || error) && (
        <div data-testid="bell-error" style={errorStyle}>
          {t.errors[localError || error] || (localError || error)}
        </div>
      )}
    </div>
  );
};

// ── Subscriptions panel ───────────────────────────────────────────────

const SubsPanel = ({ t, email, subs, onRemove, onLogout, onClose }) => (
  <div data-testid="bell-subs">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
      <div style={headingStyle}>{t.subsTitle}</div>
      <button type="button" onClick={onClose} aria-label="Close" data-testid="bell-close-btn"
              style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
        <X strokeWidth={1.5} size={16} />
      </button>
    </div>
    <p style={{ ...leadStyle, marginBottom: 10 }}>
      {t.signedInAs} <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{email}</span>
    </p>
    {subs.length === 0 ? (
      <div data-testid="bell-subs-empty" style={emptyStyle}>{t.subsEmpty}</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
        {subs.map((s) => (
          <SubRow key={s.id} sub={s} t={t} onRemove={() => onRemove(s.id)} />
        ))}
      </div>
    )}
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Link to="/striimaajat" onClick={onClose} data-testid="bell-add-link"
            style={{ ...secondaryBtn, textDecoration: 'none', padding: '8px 12px', display: 'inline-block' }}>
        {t.addMore} →
      </Link>
      <button type="button" onClick={onLogout} data-testid="bell-logout-btn"
              style={{ ...secondaryBtn, color: 'var(--muted)', display: 'inline-flex',
                       alignItems: 'center', gap: 6, padding: '8px 12px' }}>
        <LogOut strokeWidth={1.5} size={12} /> {t.logout}
      </button>
    </div>
  </div>
);

const SubRow = ({ sub, t, onRemove }) => {
  const [confirm, setConfirm] = useState(false);
  const platColor = sub.platform === 'kick' ? '#53FC18' : sub.platform === 'youtube' ? '#FF0000' : '#9146FF';
  return (
    <div data-testid={`bell-sub-row-${sub.id}`} style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
      padding: '8px 10px', border: '1px solid var(--border)',
      borderLeft: `3px solid ${platColor}`, background: 'var(--bg)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline',
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
          <span>{sub.platform}</span>
          {(sub.channels || []).map((c) => <span key={c}>· {c}</span>)}
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: 'var(--ink)', fontWeight: 600 }}>
          {sub.streamer_name || sub.streamer_login}
        </div>
      </div>
      {confirm ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={onRemove} data-testid="bell-sub-confirm-btn"
                  style={{ ...dangerBtnSm }}>{t.confirmRemove}</button>
          <button type="button" onClick={() => setConfirm(false)} data-testid="bell-sub-cancel-btn"
                  style={{ ...secondaryBtnSm }}>{t.cancel}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} aria-label={t.removeAria}
                data-testid="bell-sub-remove-btn"
                style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', padding: 6 }}>
          <Trash2 strokeWidth={1.5} size={14} />
        </button>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────

const headingStyle = {
  fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 18,
  color: 'var(--ink)', letterSpacing: '-0.005em', marginBottom: 6,
};
const leadStyle = { color: 'var(--muted)', fontSize: 13, marginBottom: 10, lineHeight: 1.45 };
const emptyStyle = {
  padding: '18px 12px', textAlign: 'center', color: 'var(--muted)',
  fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.12em',
  border: '1px dashed var(--border)',
};
const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--border-strong)', background: 'var(--bg)',
  color: 'var(--ink)', fontSize: 14, marginBottom: 8,
};
const primaryBtn = {
  width: '100%', padding: '11px 14px', background: '#5B8DEE', color: '#0B0A09',
  border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
  fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
  cursor: 'pointer',
};
const secondaryBtn = {
  width: '100%', padding: '9px 12px', background: 'transparent',
  color: 'var(--ink)', border: '1px solid var(--border-strong)',
  fontFamily: 'ui-monospace, monospace', fontSize: 11,
  fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer', marginTop: 8,
};
const dangerBtnSm = {
  padding: '6px 10px', background: '#C13B2C', color: '#F5F2EA',
  border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10,
  fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer',
};
const secondaryBtnSm = {
  padding: '6px 10px', background: 'transparent', color: 'var(--ink)',
  border: '1px solid var(--border-strong)',
  fontFamily: 'ui-monospace, monospace', fontSize: 10,
  fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer',
};
const errorStyle = {
  marginTop: 10, padding: '8px 10px', background: '#2a1418',
  border: '1px solid #5a2b2b', color: '#f4a4a4',
  fontFamily: 'ui-monospace, monospace', fontSize: 11,
};

// ── i18n ──────────────────────────────────────────────────────────────

const T_FI = {
  openLabel: 'Hälytysten hallinta',
  signinTitle: 'Hallinnoi striimerihälytyksiä',
  signinLead1: 'Syötä sähköpostiosoite — lähetämme 6-numeroisen koodin.',
  signinLead2: (email) => `Syötä 6-numeroinen koodi joka lähetettiin osoitteeseen ${email}.`,
  emailPlaceholder: 'sinun@email.fi',
  sendCode: 'Lähetä koodi',
  verifyCode: 'Vahvista koodi',
  backToEmail: 'Vaihda sähköposti',
  subsTitle: 'Hälytyksesi',
  signedInAs: 'Kirjautuneena:',
  subsEmpty: 'Ei vielä hälytyksiä · valitse striimaaja ja paina SET ALERT',
  addMore: 'Lisää striimaaja',
  logout: 'Kirjaudu ulos',
  removeAria: 'Poista hälytys',
  confirmRemove: 'Poista',
  cancel: 'Peru',
  errors: {
    invalid_email: 'Tarkista sähköpostiosoite.',
    invalid_code: 'Koodissa pitää olla 6 numeroa.',
    code_mismatch: 'Koodi ei täsmää. Yritä uudelleen.',
    code_expired_or_unknown: 'Koodi vanheni — pyydä uusi.',
    too_many_attempts: 'Liikaa yrityksiä — pyydä uusi koodi.',
    unauthorized: 'Istunto vanheni. Kirjaudu uudelleen.',
  },
};

const T_EN = {
  openLabel: 'Manage your alerts',
  signinTitle: 'Manage your streamer alerts',
  signinLead1: 'Enter your email — we\u2019ll send you a 6-digit code.',
  signinLead2: (email) => `Enter the 6-digit code sent to ${email}.`,
  emailPlaceholder: 'you@email.com',
  sendCode: 'Send code',
  verifyCode: 'Verify code',
  backToEmail: 'Change email',
  subsTitle: 'Your alerts',
  signedInAs: 'Signed in as',
  subsEmpty: 'No alerts yet · pick a streamer and tap SET ALERT',
  addMore: 'Add a streamer',
  logout: 'Sign out',
  removeAria: 'Remove alert',
  confirmRemove: 'Remove',
  cancel: 'Cancel',
  errors: {
    invalid_email: 'Check the email address.',
    invalid_code: 'Code must be 6 digits.',
    code_mismatch: 'Code doesn\u2019t match. Try again.',
    code_expired_or_unknown: 'Code expired — request a new one.',
    too_many_attempts: 'Too many attempts — request a new code.',
    unauthorized: 'Session expired. Sign in again.',
  },
};

export default BellAlertManager;
