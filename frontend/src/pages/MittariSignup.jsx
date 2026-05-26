/**
 * /signup - Putki HQ Mittari signup capture (iter76, Slice 2).
 *
 * One-screen funnel:
 *   email · segment radio · 18+ hard gate · marketing consent
 *   → POST /api/signup/mittari
 *   → success state: big "OPEN TELEGRAM" CTA + email-fallback note +
 *     plain-text pending_id + segment confirmation.
 *
 * Strict capture: every gate is enforced both client- and server-side.
 * No social, no progressive disclosure - the funnel is single-screen
 * on purpose (Doc 2 §A.1).
 */
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SEGMENTS = [
  { value: 'football', label_fi: 'Jalkapallo', label_en: 'Football',  hint_fi: 'Vain jalkapallosignaalit',     hint_en: 'Football signals only' },
  { value: 'hockey',   label_fi: 'Jääkiekko',  label_en: 'Ice Hockey', hint_fi: 'Vain jääkiekkosignaalit',     hint_en: 'Hockey signals only' },
  { value: 'all',      label_fi: 'Molemmat',   label_en: 'Both',       hint_fi: 'Päivän vahvin pelistä riippumatta', hint_en: 'Strongest pick across both' },
];

const COPY = {
  fi: {
    eyebrow: 'PUTKI HQ · MITTARI',
    h1: 'Päivän vahvimmat vetovinkit.',
    h1_em: 'Suoraan Telegramiin.',
    sub: 'Aamulla klo 09:00 - sähköposti tai Telegram. Ilmainen. Lopetus milloin tahansa.',
    email_label: 'Sähköposti',
    email_placeholder: 'sinun@email.fi',
    segment_label: 'Mitä lajia seuraat?',
    age_label: 'Olen vähintään 18-vuotias',
    consent_label: 'Saa lähettää harvoja, valikoituja viestejä Putki HQ:n tuotteista (vapaaehtoinen, lopetus milloin tahansa).',
    submit: 'AVAA TELEGRAM',
    submit_busy: 'TALLENNETAAN…',
    success_eyebrow: 'VALMIS · SEURAAVA VAIHE',
    success_h1: 'Yksi klikkaus auki.',
    success_body: 'Avaa Telegram alla olevasta painikkeesta ja paina START - sitten saat aamulla klo 09:00 päivän vahvimman vinkin.',
    open_tg: 'AVAA TELEGRAM →',
    fallback_label: 'Ei Telegramia?',
    fallback_body: 'Lähetämme saman vinkin sähköpostiisi joka aamu. Ei tarvitse tehdä mitään.',
    legal: 'Toimituksellinen sisältö. 18+. Ei vetovinkki, ei rahapeli, ei sijoitusneuvo. Vain editoriaalinen sisältö.',
    pending_label: 'PENDING ID',
    error_age: 'Sinun on oltava vähintään 18-vuotias.',
    error_segment: 'Valitse laji.',
    error_email: 'Tarkista sähköpostiosoitteesi.',
    error_generic: 'Tallennus epäonnistui. Yritä hetken päästä uudelleen.',
    back: '← Putki HQ',
  },
  en: {
    eyebrow: 'PUTKI HQ · MITTARI',
    h1: "Today's sharpest picks.",
    h1_em: 'Straight to Telegram.',
    sub: '09:00 every morning - email or Telegram. Free. Stop any time.',
    email_label: 'Email',
    email_placeholder: 'you@email.com',
    segment_label: 'What do you follow?',
    age_label: 'I am at least 18 years old',
    consent_label: 'You may send me occasional, curated updates about Putki HQ products (optional, stop any time).',
    submit: 'OPEN TELEGRAM',
    submit_busy: 'SAVING…',
    success_eyebrow: 'DONE · NEXT STEP',
    success_h1: 'One tap to go.',
    success_body: "Open Telegram with the button below, press START - and tomorrow morning at 09:00 you'll get today's strongest pick.",
    open_tg: 'OPEN TELEGRAM →',
    fallback_label: 'No Telegram?',
    fallback_body: "We'll email you the same pick every morning. Nothing else needed.",
    legal: 'Editorial only. 18+. Not betting advice, not gambling, not investment advice. Editorial content only.',
    pending_label: 'PENDING ID',
    error_age: 'You must be at least 18.',
    error_segment: 'Pick a segment.',
    error_email: 'Check your email address.',
    error_generic: 'Save failed. Please retry shortly.',
    back: '← Putki HQ',
  },
};

const MittariSignup = () => {
  const [search] = useSearchParams();
  // Honour ?lang=en if the page is opened from an EN context.
  const lang = (search.get('lang') || (typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'fi')).toLowerCase().startsWith('en') ? 'en' : 'fi';
  const t = COPY[lang];

  const [email, setEmail] = useState('');
  const [segment, setSegment] = useState('all');
  const [ageOk, setAgeOk] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const valid = useMemo(
    () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && ageOk && SEGMENTS.some((s) => s.value === segment),
    [email, ageOk, segment],
  );

  const submit = async (e) => {
    e?.preventDefault();
    setErr(null);
    if (!ageOk) return setErr(t.error_age);
    if (!segment) return setErr(t.error_segment);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t.error_email);
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/signup/mittari`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          segment,
          age_confirmed: ageOk,
          marketing_consent: consent,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        if (body?.detail === 'age_gate_required') setErr(t.error_age);
        else if (body?.detail === 'invalid_segment') setErr(t.error_segment);
        else if (body?.detail === 'invalid_email') setErr(t.error_email);
        else setErr(t.error_generic);
        return;
      }
      setResult(await r.json());
    } catch {
      setErr(t.error_generic);
    } finally {
      setBusy(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh', background: '#F4EFE6', color: '#1A1815',
      padding: '40px 24px 80px', display: 'flex', justifyContent: 'center',
    },
    card: { maxWidth: 540, width: '100%' },
    eyebrow: {
      fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.28em',
      fontWeight: 800, color: '#5A4C2E', marginBottom: 18,
    },
    h1: {
      fontFamily: 'Georgia, serif', fontSize: 40, lineHeight: 1.08, fontWeight: 700,
      letterSpacing: '-0.02em', margin: '0 0 16px',
    },
    em: { color: '#A0750F', fontStyle: 'italic' },
    sub: {
      fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.55,
      color: '#3A332A', margin: '0 0 28px', maxWidth: 460,
    },
    label: {
      fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em',
      fontWeight: 700, color: '#5A4C2E', textTransform: 'uppercase',
      display: 'block', marginBottom: 6,
    },
    input: {
      width: '100%', padding: '13px 14px', background: '#FFFCF6', color: '#1A1815',
      border: '1px solid #C9BFAD', fontFamily: 'Georgia, serif', fontSize: 16,
      borderRadius: 2,
    },
    segGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
    segBtn: (on) => ({
      padding: '12px 10px', background: on ? '#1A1815' : '#FFFCF6', color: on ? '#F4EFE6' : '#1A1815',
      border: `1px solid ${on ? '#1A1815' : '#C9BFAD'}`, cursor: 'pointer',
      fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, lineHeight: 1.15,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      borderRadius: 2, transition: 'all 140ms ease',
    }),
    checkRow: {
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
      cursor: 'pointer',
    },
    checkbox: {
      width: 18, height: 18, marginTop: 2, accentColor: '#A0750F', cursor: 'pointer', flexShrink: 0,
    },
    checkText: { fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.45, color: '#1A1815' },
    submit: (ok, busy) => ({
      width: '100%', padding: '16px', marginTop: 18,
      background: ok && !busy ? '#1A1815' : '#9C8B6B', color: '#F4EFE6',
      border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
      letterSpacing: '0.24em', fontWeight: 800,
      cursor: ok && !busy ? 'pointer' : 'not-allowed',
      borderRadius: 2, transition: 'background 160ms ease',
    }),
    err: {
      marginTop: 12, padding: '10px 12px', background: '#FBE7E2',
      border: '1px solid #C8423C', color: '#7A1F1A',
      fontFamily: 'ui-monospace, monospace', fontSize: 12, borderRadius: 2,
    },
    legal: {
      marginTop: 28, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
      color: '#5A4C2E', letterSpacing: '0.04em', lineHeight: 1.6,
    },
    back: {
      fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em',
      color: '#5A4C2E', textDecoration: 'none', display: 'inline-block', marginBottom: 24,
    },
  };

  // Success state
  if (result) {
    return (
      <div style={styles.page} data-testid="signup-success-page">
        <div style={styles.card}>
          <Link to="/" style={styles.back} data-testid="signup-success-back">{t.back}</Link>
          <div style={styles.eyebrow}>{t.success_eyebrow}</div>
          <h1 style={styles.h1}>{t.success_h1}</h1>
          <p style={styles.sub} data-testid="signup-success-body">{t.success_body}</p>
          <a href={result.telegram_deep_link} target="_blank" rel="noreferrer"
            data-testid="signup-success-tg-cta"
            style={{ ...styles.submit(true, false), display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            {t.open_tg}
          </a>
          <div style={{ marginTop: 20, padding: 14, background: '#FFFCF6', border: '1px dashed #C9BFAD', borderRadius: 2 }}>
            <div style={styles.label}>{t.fallback_label}</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 13.5, lineHeight: 1.5, margin: '4px 0 0', color: '#3A332A' }}
              data-testid="signup-success-fallback">{t.fallback_body}</p>
          </div>
          <div style={{ marginTop: 14, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#7A6C4A', letterSpacing: '0.1em' }}>
            <span data-testid="signup-success-pending-id">{t.pending_label}: {result.pending_id}</span>
            <span style={{ marginLeft: 12 }}>SEGMENT: {result.segment?.toUpperCase()}</span>
          </div>
          <p style={styles.legal}>{t.legal}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page} data-testid="signup-page">
      <div style={styles.card}>
        <Link to="/" style={styles.back} data-testid="signup-back">{t.back}</Link>
        <div style={styles.eyebrow} data-testid="signup-eyebrow">{t.eyebrow}</div>
        <h1 style={styles.h1} data-testid="signup-h1">{t.h1} <span style={styles.em}>{t.h1_em}</span></h1>
        <p style={styles.sub} data-testid="signup-sub">{t.sub}</p>

        <form onSubmit={submit} data-testid="signup-form" noValidate>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="signup-email" style={styles.label}>{t.email_label}</label>
            <input id="signup-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.email_placeholder} autoComplete="email"
              data-testid="signup-email-input" style={styles.input} />
          </div>

          {/* Segment */}
          <div style={{ marginBottom: 18 }}>
            <span style={styles.label}>{t.segment_label}</span>
            <div style={styles.segGrid}>
              {SEGMENTS.map((s) => {
                const on = segment === s.value;
                return (
                  <button type="button" key={s.value}
                    onClick={() => setSegment(s.value)}
                    aria-pressed={on}
                    data-testid={`signup-segment-${s.value}`}
                    style={styles.segBtn(on)}>
                    <span>{lang === 'en' ? s.label_en : s.label_fi}</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                      color: on ? '#E0D4B7' : '#7A6C4A', fontWeight: 500,
                      letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.3 }}>
                      {lang === 'en' ? s.hint_en : s.hint_fi}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 18+ */}
          <label style={styles.checkRow} data-testid="signup-age-row">
            <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)}
              data-testid="signup-age-checkbox" style={styles.checkbox} />
            <span style={styles.checkText}><strong>{t.age_label}</strong></span>
          </label>

          {/* Marketing */}
          <label style={styles.checkRow} data-testid="signup-consent-row">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              data-testid="signup-consent-checkbox" style={styles.checkbox} />
            <span style={styles.checkText}>{t.consent_label}</span>
          </label>

          <button type="submit" disabled={!valid || busy}
            data-testid="signup-submit"
            style={styles.submit(valid, busy)}>
            {busy ? t.submit_busy : t.submit}
          </button>

          {err && <div style={styles.err} data-testid="signup-error">{err}</div>}
        </form>

        <p style={styles.legal} data-testid="signup-legal">{t.legal}</p>
      </div>
    </div>
  );
};

export default MittariSignup;
