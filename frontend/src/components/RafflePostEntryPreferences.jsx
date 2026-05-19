/**
 * PUTKI HQ — RafflePostEntryPreferences.
 *
 * GDPR Article 7(4): marketing opt-in is FREELY GIVEN and SEPARATELY
 * presented from the raffle entry. Three independent unchecked
 * checkboxes. "Skip" is a primary-weight action, not buried styling.
 *
 * Each ticked box writes its own row to optin_consents AND its own
 * audit-trail entry. The raffle entry email may be the same as the
 * marketing opt-in email, but they're stored as separate records with
 * separate legal bases — explicit DPO-survivable.
 *
 * Props:
 *   defaultEmail   — pre-fill from sessionStorage (user can change)
 *   onSaved        — callback after Save (parent can route away)
 *   onSkip         — callback for Skip (parent routes away)
 */
import React, { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TELEGRAM_CHANNEL_URL = 'https://t.me/putkihq_alerts';

const RafflePostEntryPreferences = ({ defaultEmail = '', onSaved, onSkip }) => {
  const { lang } = useLang();

  const [optEmail, setOptEmail] = useState(false);
  const [optSms, setOptSms] = useState(false);
  const [optTelegram, setOptTelegram] = useState(false);

  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const anyTicked = optEmail || optSms || optTelegram;

  const saveAll = async () => {
    setError('');
    if (!anyTicked) {
      // Nothing ticked → treat as skip (same outcome)
      if (onSkip) onSkip();
      return;
    }
    setBusy(true);
    const calls = [];
    if (optEmail) {
      if (!email) { setError(lang === 'en' ? 'Email is required for the email opt-in.' : 'Sähköposti vaaditaan sähköpostitilaukseen.'); setBusy(false); return; }
      calls.push(fetch(`${BACKEND}/api/optin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email', surface: 'voita', email,
          consent_tag: 'daily_game_signals',
        }),
      }));
    }
    if (optSms) {
      if (!phone) { setError(lang === 'en' ? 'Phone is required for SMS alerts.' : 'Puhelinnumero vaaditaan SMS-hälytyksiin.'); setBusy(false); return; }
      calls.push(fetch(`${BACKEND}/api/optin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'sms', surface: 'voita', phone,
          consent_tag: 'mittari_alerts_sms',
        }),
      }));
    }
    if (optTelegram) {
      // Telegram is a channel-join consent — we open the channel in a
      // new tab; the user actually joins on Telegram itself. We record
      // their intent so the dashboard counts it.
      const handle = telegramHandle.trim() || (email || `voita-${Date.now()}`);
      calls.push(fetch(`${BACKEND}/api/optin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'telegram', surface: 'voita',
          telegram_username: handle,
          consent_tag: 'telegram_general',
        }),
      }));
    }

    try {
      const results = await Promise.all(calls);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setError(`HTTP ${failed.status}`);
        setBusy(false);
        return;
      }
      if (optTelegram) {
        // Open the Telegram channel in a new tab so the user can actually join.
        window.open(TELEGRAM_CHANNEL_URL, '_blank', 'noopener,noreferrer');
      }
      setSaved(true);
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="raffle-post-entry-preferences" style={{
      marginTop: 28, padding: '22px 22px',
      border: '1px solid var(--hairline, #221E1B)',
      background: 'var(--surface, #141210)',
      borderLeft: '2px solid #6FA37D',
    }}>
      <h2 style={{
        fontFamily: 'Georgia, serif', fontSize: 20, color: '#FFFFFF',
        margin: '0 0 4px',
      }}>{lang === 'en' ? 'Want more from PUTKI HQ?' : 'Haluatko enemmän PUTKI HQ:lta?'}</h2>
      <p data-testid="raffle-prefs-disclaimer" style={{
        fontSize: 12.5, color: 'var(--muted, #9C9587)', lineHeight: 1.6,
        margin: '6px 0 18px',
      }}>{lang === 'en'
        ? 'These are entirely separate from your raffle entry. You can skip — your entry is already confirmed.'
        : 'Nämä ovat täysin erillisiä raffle-osallistumisestasi. Voit ohittaa — osallistumisesi on jo vahvistettu.'}</p>

      {/* Email */}
      <label data-testid="raffle-opt-email-wrap" style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={optEmail} onChange={(e) => setOptEmail(e.target.checked)}
            data-testid="raffle-opt-email" style={{ marginTop: 3, width: 18, height: 18, accentColor: '#6FA37D' }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
              {lang === 'en' ? 'Daily Pelisignaalit email (10:00)' : 'Päivittäinen Pelisignaalit-sähköposti (klo 10:00)'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
              {lang === 'en' ? 'Tag: daily_game_signals' : 'Tag: daily_game_signals'}
            </div>
          </div>
        </div>
        {optEmail && (
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" data-testid="raffle-opt-email-input"
            style={{ marginTop: 8, marginLeft: 28, width: 'calc(100% - 28px)',
              background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)',
              padding: '10px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
        )}
      </label>

      {/* SMS */}
      <label data-testid="raffle-opt-sms-wrap" style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={optSms} onChange={(e) => setOptSms(e.target.checked)}
            data-testid="raffle-opt-sms" style={{ marginTop: 3, width: 18, height: 18, accentColor: '#6FA37D' }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
              {lang === 'en' ? 'SMS alert when Mittari moves (max 1 / day)' : 'SMS-hälytys, kun Mittari liikkuu (max 1 viesti / päivä)'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
              {lang === 'en' ? 'Tag: mittari_alerts_sms' : 'Tag: mittari_alerts_sms'}
            </div>
          </div>
        </div>
        {optSms && (
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+358..." data-testid="raffle-opt-sms-input"
            style={{ marginTop: 8, marginLeft: 28, width: 'calc(100% - 28px)',
              background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)',
              padding: '10px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
        )}
      </label>

      {/* Telegram */}
      <label data-testid="raffle-opt-telegram-wrap" style={{ display: 'block', cursor: 'pointer', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={optTelegram} onChange={(e) => setOptTelegram(e.target.checked)}
            data-testid="raffle-opt-telegram" style={{ marginTop: 3, width: 18, height: 18, accentColor: '#6FA37D' }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
              {lang === 'en' ? 'Join the Telegram channel (opens in new tab)' : 'Liity Telegram-kanavalle (avautuu uudessa välilehdessä)'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
              {lang === 'en' ? 'Tag: telegram_general' : 'Tag: telegram_general'}
            </div>
          </div>
        </div>
      </label>

      {error && <div data-testid="raffle-prefs-error" style={{
        marginBottom: 12, padding: 10,
        background: '#2b0e0e', border: '1px solid #5a2b2b',
        color: '#f4a4a4', fontSize: 12,
      }}>{error}</div>}
      {saved && <div data-testid="raffle-prefs-saved" style={{
        marginBottom: 12, padding: 10,
        background: '#0e2b1a', border: '1px solid #2b5a3e',
        color: '#9ad4a9', fontSize: 12, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.10em',
      }}>{lang === 'en' ? 'PREFERENCES SAVED.' : 'VALINNAT TALLENNETTU.'}</div>}

      {/* Save + Skip — primary weight on BOTH. Skip is not buried. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={saveAll} disabled={busy}
          data-testid="raffle-prefs-save"
          style={{
            padding: '12px 22px', background: '#FFFFFF', color: '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.20em', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>{busy
            ? (lang === 'en' ? 'SAVING…' : 'TALLENNETAAN…')
            : (lang === 'en' ? 'SAVE PREFERENCES' : 'TALLENNA VALINNAT')}</button>
        <button type="button" onClick={onSkip} disabled={busy}
          data-testid="raffle-prefs-skip"
          style={{
            padding: '12px 22px', background: 'transparent', color: 'var(--ink)',
            border: '1px solid var(--border-strong, #3A332E)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.20em', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>{lang === 'en' ? 'SKIP' : 'OHITA'}</button>
      </div>
    </div>
  );
};

export default RafflePostEntryPreferences;
