/**
 * PUTKI HQ — MicroYesGate (iter63)
 *
 * Conversion-funnel rebuild per the mockup. Renders below the identity
 * card and steps the user through:
 *
 *   1. Read-line summary
 *   2. Micro-yes CTA ("Show me my blind spot →")
 *   3. Share row (free growth loop)
 *   4. Email gate (ONE FIELD — no name input)
 *   5. Success state with optional Telegram opt-in
 *
 * The "blind spot" copy is generated server-side via the existing
 * persona/strengths data — this component just orchestrates the flow.
 */
import React, { useState } from 'react';
import { useLang } from '../../context/LanguageContext';
import { pickPA, interpolate } from '../../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const MicroYesGate = ({
  // Identity context (used for share text + headline)
  gameSlug,           // e.g. "quiz_gambling_literacy"
  unlockPath,         // e.g. "/api/mini-games/quiz/unlock"
  session,            // { play_id, anon_id }
  profileTitle,       // "The Tactician"
  readLine,           // sentence shown above the micro-yes CTA
  onUnlocked,         // (full_result) => void
}) => {
  const { lang } = useLang();
  const [stage, setStage] = useState('idle');  // idle | gate | success
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true); // pre-checked: voluntary opt-in
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  const openGate = () => {
    setStage('gate');
    // Smooth-scroll to gate after it animates in
    setTimeout(() => {
      const el = document.querySelector('[data-testid="micro-yes-gate"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@') || email.length < 5) {
      setError(pickPA(lang, 'gate.email.invalid'));
      return;
    }
    if (!consent) {
      setError(pickPA(lang, 'gate.consent.required'));
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${BACKEND}${unlockPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          play_id: session.play_id,
          anon_id: session.anon_id,
          email,
          consent: true,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const full = await r.json();
      onUnlocked(full);
      setStage('success');
    } catch (e2) {
      setError(interpolate(pickPA(lang, 'gate.error.save'), { message: e2.message }));
    } finally {
      setSubmitting(false);
    }
  };

  const shareIt = () => {
    const shareText = lang === 'en'
      ? `I'm ${profileTitle} — what are you?`
      : `Olen ${profileTitle} — mikä sinä olet?`;
    if (navigator.share) {
      navigator.share({ text: shareText, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    }
    fetch(`${BACKEND}/api/mini-games/share/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_slug: gameSlug, play_id: session.play_id }),
    }).catch(() => {});
  };

  return (
    <div data-testid="micro-yes-block" style={{ padding: '6px 4px 0' }}>
      {/* Read-line */}
      <p style={{
        fontSize: 17, lineHeight: 1.5,
        color: 'var(--muted)', marginBottom: 22,
        fontFamily: 'Georgia, Newsreader, serif',
      }}>
        {readLine}
      </p>

      {/* Micro-yes button (hidden after gate opens) */}
      {stage === 'idle' && (
        <button
          onClick={openGate}
          data-testid="micro-yes-btn"
          style={{
            display: 'block', width: '100%',
            background: 'var(--ink)', color: 'var(--bg)',
            border: 'none', cursor: 'pointer',
            fontFamily: 'ui-monospace, JetBrains Mono, monospace',
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '17px 20px', borderRadius: 4,
            transition: 'all 180ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#b07d18'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {pickPA(lang, 'card.microYes')} →
        </button>
      )}

      {/* Share row */}
      {stage !== 'success' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 16, padding: '13px 16px',
          border: '1px dashed var(--border)', borderRadius: 4,
          gap: 12, flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: 14, color: 'var(--muted)', fontFamily: 'Georgia, Newsreader, serif', margin: 0 }}>
            {pickPA(lang, 'card.shareLeadPrefix')}{' '}
            <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{profileTitle}</strong>{' '}
            — {pickPA(lang, 'card.shareLeadSuffix')}
          </p>
          <button
            onClick={shareIt}
            data-testid="card-share-btn"
            style={{
              fontFamily: 'ui-monospace, JetBrains Mono, monospace',
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: '1px solid var(--ink)', background: 'none',
              padding: '8px 13px', borderRadius: 3, cursor: 'pointer',
              transition: 'all 180ms ease', whiteSpace: 'nowrap',
              color: 'var(--ink)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = 'var(--bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--ink)'; }}
          >
            {shareCopied ? pickPA(lang, 'card.share.copied') : pickPA(lang, 'card.share.cta')}
          </button>
        </div>
      )}

      {/* Email gate */}
      {stage === 'gate' && (
        <form
          onSubmit={submit}
          data-testid="micro-yes-gate"
          style={{
            marginTop: 8,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)',
            padding: '28px 26px',
            animation: 'putki-slidein 0.5s cubic-bezier(.2,.7,.2,1)',
          }}
        >
          <style>{`@keyframes putki-slidein { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }`}</style>
          <div style={{
            fontFamily: 'ui-monospace, JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: '#b07d18', marginBottom: 12,
          }}>{pickPA(lang, 'card.gate.kicker')}</div>
          <h2 style={{
            fontFamily: 'Georgia, Fraunces, serif', fontWeight: 600,
            fontSize: 'clamp(22px, 4vw, 28px)', lineHeight: 1.1,
            letterSpacing: '-0.015em', marginBottom: 12, color: 'var(--ink)',
          }}>{pickPA(lang, 'card.gate.headline')}</h2>
          <p style={{
            fontSize: 16, lineHeight: 1.5, marginBottom: 22,
            color: 'var(--muted)', fontFamily: 'Georgia, Newsreader, serif',
          }}>{pickPA(lang, 'card.gate.body')}</p>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={pickPA(lang, 'gate.email.placeholder')}
            data-testid="micro-yes-email"
            style={{
              width: '100%',
              border: `1px solid ${error ? '#a64442' : 'var(--border)'}`,
              borderRadius: 4,
              background: 'var(--bg)',
              padding: '15px 16px',
              fontFamily: 'Georgia, Newsreader, serif',
              fontSize: 16, color: 'var(--ink)',
              marginBottom: 10,
              transition: 'all 180ms ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#b07d18'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(176,125,24,.12)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />

          {/* Trust chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', margin: '6px 0 16px' }}>
            {[
              pickPA(lang, 'card.gate.trust.noCard'),
              pickPA(lang, 'card.gate.trust.gdpr'),
              pickPA(lang, 'card.gate.trust.leave'),
            ].map((label) => (
              <span key={label} style={{
                fontFamily: 'ui-monospace, JetBrains Mono, monospace',
                fontSize: 10, letterSpacing: '0.04em',
                color: 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span aria-hidden style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#3f7d4a',
                }} />
                {label}
              </span>
            ))}
          </div>

          {/* Hidden consent — pre-checked because the trust row above is the consent UX */}
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            data-testid="micro-yes-consent"
            style={{ display: 'none' }}
          />

          {error && <p style={{ color: '#a64442', fontSize: 13, marginBottom: 10, fontFamily: 'Georgia, Newsreader, serif' }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            data-testid="micro-yes-submit"
            style={{
              display: 'block', width: '100%',
              background: '#b07d18', color: '#faf8f3',
              border: 'none', cursor: 'pointer',
              fontFamily: 'ui-monospace, JetBrains Mono, monospace',
              fontSize: 12, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '17px 20px', borderRadius: 4,
              opacity: submitting ? 0.6 : 1,
              transition: 'background 180ms ease',
            }}
            onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = '#d59a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#b07d18'; }}
          >
            {submitting ? pickPA(lang, 'gate.submitting') : `${pickPA(lang, 'card.gate.submit')} →`}
          </button>

          <p style={{
            fontFamily: 'ui-monospace, JetBrains Mono, monospace',
            fontSize: 10, lineHeight: 1.6, color: 'var(--muted)',
            marginTop: 14,
          }}>
            {pickPA(lang, 'card.gate.finehint')}{' '}
            <a href="/tietosuoja" style={{ color: 'var(--ink)' }}>
              {pickPA(lang, 'gate.consent.privacy')}
            </a>.
          </p>
        </form>
      )}

      {/* Success block */}
      {stage === 'success' && (
        <div data-testid="micro-yes-success" style={{
          animation: 'putki-slidein 0.5s cubic-bezier(.2,.7,.2,1)',
        }}>
          <div style={{
            fontFamily: 'Georgia, Fraunces, serif', fontSize: 40, fontWeight: 900,
            color: '#3f7d4a', marginBottom: 6,
          }}>✓</div>
          <h2 style={{
            fontFamily: 'Georgia, Fraunces, serif', fontWeight: 600,
            fontSize: 'clamp(22px, 4vw, 26px)', letterSpacing: '-0.01em',
            marginBottom: 8, color: 'var(--ink)',
          }}>{pickPA(lang, 'card.success.headline')}</h2>
          <p style={{
            fontSize: 16, color: 'var(--muted)', marginBottom: 26,
            fontFamily: 'Georgia, Newsreader, serif', lineHeight: 1.5,
          }}>{pickPA(lang, 'card.success.lead')}</p>

          <div style={{
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', padding: '24px 24px',
          }}>
            <div style={{
              fontFamily: 'ui-monospace, JetBrains Mono, monospace',
              fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#d59a2a', marginBottom: 10,
            }}>{pickPA(lang, 'card.tg.kicker')}</div>
            <h3 style={{
              fontFamily: 'Georgia, Fraunces, serif', fontWeight: 600,
              fontSize: 21, letterSpacing: '-0.01em', marginBottom: 8,
              color: 'var(--ink)',
            }}>{pickPA(lang, 'card.tg.headline')}</h3>
            <p style={{
              fontSize: 15, color: 'var(--muted)', lineHeight: 1.5,
              marginBottom: 18, fontFamily: 'Georgia, Newsreader, serif',
            }}>
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>
                {pickPA(lang, 'card.tg.bodyBold')}
              </strong>{' '}
              {pickPA(lang, 'card.tg.body')}
            </p>
            <a
              href="https://t.me/putkihq"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="card-tg-cta"
              style={{
                display: 'block', textAlign: 'center',
                background: '#2c2c2c', color: 'var(--bg)',
                fontFamily: 'ui-monospace, JetBrains Mono, monospace',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '17px 20px', borderRadius: 4,
                textDecoration: 'none',
                transition: 'background 180ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#b07d18'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2c2c2c'; }}
            >
              {pickPA(lang, 'card.tg.cta')} →
            </a>
          </div>

          <p style={{
            fontFamily: 'ui-monospace, JetBrains Mono, monospace',
            fontSize: 9.5, lineHeight: 1.7, color: 'var(--muted)',
            marginTop: 14, textAlign: 'center',
          }}>{pickPA(lang, 'card.success.footnote')}</p>
        </div>
      )}
    </div>
  );
};

export default MicroYesGate;
