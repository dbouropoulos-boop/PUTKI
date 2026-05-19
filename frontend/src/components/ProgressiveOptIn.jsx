/**
 * PUTKI HQ — ProgressiveOptIn (Phase 1 Final · Chunk B).
 *
 * 3-step sequential funnel. Steps render ONE AT A TIME, never simultaneously.
 * Skip is always available. Each step writes a distinct consent tag.
 *
 * Channel ↔ purpose split:
 *   Step 1 · EMAIL    → sentiment digest (slow channel)
 *   Step 2 · SMS      → daily bets (fast channel, time-critical signals)
 *   Step 3 · TELEGRAM → daily bets (same content, alternative inbox)
 *
 * Per-surface customisation via `valueProps` prop.
 *
 * Props
 * -----
 *   surface: 'mittari' | 'pelisignaalit' | 'voita' | 'peli' | 'homepage'
 *   valueProps: { email, sms, telegram } strings — per-surface copy
 *   telegramUrl: full t.me URL (defaults to /api/settings/public telegram_channel)
 *   dataTestId: scoped test id prefix
 */
import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const post = async (payload) => {
  const r = await fetch(`${BACKEND}/api/optin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${r.status}`);
  }
  return r.json();
};

const stepNum = (n, label) => (
  <span style={{
    fontFamily: 'ui-monospace, monospace', fontSize: 10,
    letterSpacing: '0.22em', color: 'var(--muted, #9C9587)',
    display: 'block', marginBottom: 10, fontWeight: 700,
  }}>STEP {n} · {label}</span>
);

const fieldRow = (children) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>{children}</div>
);

const inputStyle = {
  flex: 1, background: 'var(--bg, #0B0A09)',
  border: '1px solid var(--border-strong, #3A3530)',
  color: 'var(--ink, #ECE6D8)',
  padding: '11px 13px', fontFamily: 'inherit',
  fontSize: 13, outline: 'none', borderRadius: 2,
};

const btnPrimary = (disabled) => ({
  background: disabled ? 'var(--muted, #9C9587)' : '#FFFFFF',
  color: '#0B0A09', border: 0,
  padding: '11px 18px',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: 2, opacity: disabled ? 0.6 : 1,
});

const skipBtn = {
  background: 'transparent', border: 0, padding: 0,
  color: 'var(--muted, #9C9587)',
  fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
  letterSpacing: '0.14em', cursor: 'pointer',
};

const ProgressiveOptIn = ({
  surface,
  valueProps = {},
  telegramUrl,
  dataTestId = 'progressive-optin',
}) => {
  const { lang } = useLang();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tgUrl, setTgUrl] = useState(telegramUrl || '');

  useEffect(() => {
    if (telegramUrl) return;
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => {
        const ch = (d?.telegram_channel || '').trim();
        if (ch) {
          const url = ch.startsWith('http') ? ch : `https://t.me/${ch.replace(/^@/, '')}`;
          setTgUrl(url);
        }
      })
      .catch(() => {});
  }, [telegramUrl]);

  // Default per-surface copy. Caller can override entirely via valueProps.
  const defaults = {
    email: lang === 'en'
      ? "Daily scene sentiment — Mittari state, four headlines, the mood. 09:00, one email."
      : "Päivän skene-tunnelma — Mittarin tila, neljä otsikkoa, kokonais­kuva. Klo 09.00, yksi sähköposti.",
    sms: lang === 'en'
      ? "The day's bets — five signals, Sharpness 75+, straight to your phone at 10:00."
      : "Päivän vedot — viisi signaalia, Sharpness 75+, suoraan puhelimeen klo 10.00.",
    telegram: lang === 'en'
      ? "Same daily bets on Telegram. Pick one channel, not both."
      : "Samat päivän vedot Telegramissa. Valitse yksi kanava, ei molempia.",
  };
  const props = { ...defaults, ...valueProps };

  const submitEmail = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await post({ channel: 'email', surface, email });
      setStep(2);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSms = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await post({ channel: 'sms', surface, phone });
      setStep(3);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const joinTelegram = async () => {
    if (tgUrl) {
      try {
        const handle = tgUrl.replace(/^.*t\.me\//, '').replace(/^@/, '').trim();
        if (handle) {
          await post({
            channel: 'telegram', surface,
            telegram_username: handle, consent_tag: 'telegram_alerts',
          });
        }
      } catch {/* non-blocking */}
      window.open(tgUrl, '_blank', 'noopener,noreferrer');
    }
    setStep(4); // done
  };

  // === DONE ===
  if (step === 4) {
    return (
      <div data-testid={`${dataTestId}-done`} style={{
        padding: '22px 24px',
        border: '1px solid var(--hairline, #221E1B)',
        borderLeft: '2px solid #6FA37D',
        background: 'var(--surface, #141210)',
      }}>
        <span style={{
          color: '#6FA37D', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.16em', fontWeight: 700,
          display: 'block', marginBottom: 6,
        }}>{lang === 'en' ? 'YOU\u2019RE SET ✓' : 'OLET MUKANA ✓'}</span>
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 13.5, lineHeight: 1.55,
          margin: 0,
        }}>{lang === 'en'
          ? 'Thanks. Tunnelma at 09:00, bets at 10:00. We respect your inbox — no spam, ever.'
          : 'Kiitos. Tunnelma klo 09.00, vedot klo 10.00. Kunnioitamme postilaatikkoasi — ei roska­postia, koskaan.'}</p>
      </div>
    );
  }

  // === STEP 1 — EMAIL ===
  if (step === 1) {
    return (
      <div data-testid={`${dataTestId}-step1`} style={{
        padding: '22px 24px',
        border: '1px solid var(--hairline, #221E1B)',
        background: 'var(--surface, #141210)',
      }}>
        {stepNum(1, lang === 'en' ? 'EMAIL · SENTIMENT' : 'SÄHKÖPOSTI · TUNNELMA')}
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 13.5, lineHeight: 1.55,
          margin: '0 0 14px', opacity: 0.92,
        }}>{props.email}</p>
        <form onSubmit={submitEmail}>
          {fieldRow([
            <input key="i" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={lang === 'en' ? 'you@email.com' : 'sinun@email.fi'}
              data-testid={`${dataTestId}-step1-email`}
              style={inputStyle} />,
            <button key="b" type="submit" disabled={submitting}
              data-testid={`${dataTestId}-step1-submit`}
              style={btnPrimary(submitting)}>
              {submitting
                ? (lang === 'en' ? '…' : '…')
                : (lang === 'en' ? 'SUBSCRIBE' : 'TILAA')}
            </button>,
          ])}
        </form>
        {error && (
          <div data-testid={`${dataTestId}-error`} style={{
            color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
            fontSize: 10.5, letterSpacing: '0.12em', marginTop: 6,
          }}>{error.toUpperCase()}</div>
        )}
        <div style={{
          color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.10em', marginTop: 10,
        }}>{lang === 'en'
          ? 'Tag: email_sentiment · 1 email · 0 spam'
          : 'Tag: email_sentiment · 1 sähköposti · 0 spämmiä'}</div>
      </div>
    );
  }

  // === STEP 2 — SMS upsell ===
  if (step === 2) {
    return (
      <div data-testid={`${dataTestId}-step2`} style={{
        padding: '22px 24px',
        border: '1px solid var(--hairline, #221E1B)',
        borderLeft: '2px solid #6FA37D',
        background: 'var(--surface, #141210)',
      }}>
        <span style={{
          color: '#6FA37D', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.16em', fontWeight: 700,
          display: 'block', marginBottom: 14,
        }}>{lang === 'en' ? 'EMAIL CONFIRMED ✓' : 'SÄHKÖPOSTI VAHVISTETTU ✓'}</span>
        {stepNum(2, lang === 'en' ? 'SMS · DAILY BETS' : 'SMS · PÄIVÄN VEDOT')}
        <p style={{
          color: 'var(--ink, #ECE6D8)', fontSize: 13.5, lineHeight: 1.55,
          margin: '0 0 14px', opacity: 0.92,
        }}>{props.sms}</p>
        <form onSubmit={submitSms}>
          {fieldRow([
            <input key="i" type="tel" required value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+358 40 123 4567"
              data-testid={`${dataTestId}-step2-phone`}
              style={inputStyle} />,
            <button key="b" type="submit" disabled={submitting}
              data-testid={`${dataTestId}-step2-submit`}
              style={btnPrimary(submitting)}>
              {submitting
                ? '…'
                : (lang === 'en' ? 'ADD' : 'LISÄÄ')}
            </button>,
          ])}
        </form>
        <button type="button"
          data-testid={`${dataTestId}-step2-skip`}
          onClick={() => setStep(3)} style={{ ...skipBtn, marginTop: 8 }}>
          {lang === 'en' ? 'CONTINUE WITH EMAIL ONLY →' : 'JATKA PELKÄLLÄ SÄHKÖPOSTILLA →'}
        </button>
        {error && (
          <div data-testid={`${dataTestId}-error`} style={{
            color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
            fontSize: 10.5, letterSpacing: '0.12em', marginTop: 6,
          }}>{error.toUpperCase()}</div>
        )}
      </div>
    );
  }

  // === STEP 3 — Telegram ===
  return (
    <div data-testid={`${dataTestId}-step3`} style={{
      padding: '22px 24px',
      border: '1px solid var(--hairline, #221E1B)',
      background: 'var(--surface, #141210)',
    }}>
      {stepNum(3, lang === 'en' ? 'TELEGRAM · DAILY BETS' : 'TELEGRAM · PÄIVÄN VEDOT')}
      <p style={{
        color: 'var(--ink, #ECE6D8)', fontSize: 13.5, lineHeight: 1.55,
        margin: '0 0 14px', opacity: 0.92,
      }}>{props.telegram}</p>
      <button type="button"
        data-testid={`${dataTestId}-step3-join`}
        onClick={joinTelegram}
        disabled={!tgUrl}
        style={{
          background: 'transparent', color: 'var(--ink, #ECE6D8)',
          border: '1px solid var(--border-strong, #3A3530)',
          padding: '11px 18px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.14em',
          cursor: tgUrl ? 'pointer' : 'not-allowed',
          opacity: tgUrl ? 1 : 0.5,
          borderRadius: 2,
        }}>
        {tgUrl
          ? (lang === 'en' ? 'JOIN CHANNEL →' : 'LIITY KANAVALLE →')
          : (lang === 'en' ? 'TELEGRAM SOON' : 'TELEGRAM TULOSSA')}
      </button>
      <div style={{ marginTop: 14 }}>
        <button type="button"
          data-testid={`${dataTestId}-step3-done`}
          onClick={() => setStep(4)} style={skipBtn}>
          {lang === 'en' ? "I\u2019M GOOD →" : 'OLEN VALMIS →'}
        </button>
      </div>
    </div>
  );
};

export default ProgressiveOptIn;
