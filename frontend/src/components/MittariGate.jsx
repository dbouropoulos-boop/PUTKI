/**
 * MittariGate - email + Telegram capture block used twice on /mittari
 * (once in the hero, once as the final CTA).
 *
 * Extracted from Mittari.jsx to keep the page file readable. Owns its
 * own form state + submission to /api/voita/lead (email) and
 * /api/mittari/subscribe (telegram pre-bind). Persists an unlock
 * timestamp to localStorage so the page can stay revealed across
 * reloads.
 */
import React, { useCallback, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Exported so Mittari.jsx can also probe the unlock flag without
// duplicating the storage key.
export const STORAGE_UNLOCK_KEY = 'putki_mittari_unlocked_at';

export const MittariGate = ({ c, variant, pendingId, onUnlock, tgUrl }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const submitEmail = useCallback(async (e) => {
    e?.preventDefault?.();
    const v = email.trim().toLowerCase();
    if (!v || !v.includes('@')) { setStatus('err'); return; }
    setBusy(true); setStatus(null);
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: v, age_18_plus: true, source: 'mittari',
          quiz_tags: { surface: `mittari_gate_${variant}` },
        }),
      });
      if (!r.ok) { setStatus('err'); return; }
      try { window.localStorage.setItem(STORAGE_UNLOCK_KEY, String(Date.now())); }
      catch { /* noop */ }
      setStatus('ok'); setEmail(''); onUnlock?.();
    } catch { setStatus('err'); }
    finally { setBusy(false); }
  }, [email, variant, onUnlock]);

  const onTelegramClick = useCallback(async () => {
    try {
      await fetch(`${BACKEND}/api/mittari/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_id: pendingId }),
      });
    } catch { /* noop: bot can still bind on /start */ }
    try { window.localStorage.setItem(STORAGE_UNLOCK_KEY, String(Date.now())); }
    catch { /* noop */ }
    onUnlock?.();
  }, [pendingId, onUnlock]);

  return (
    <div data-testid={`mittari-gate-${variant}`} className="m-gate" style={{
      background: 'var(--surface, #141210)', border: '1px solid var(--hairline)',
      padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 500px 200px at center top, #5BA0E826, transparent 70%)',
      }} />
      <div style={{
        position: 'relative', zIndex: 1,
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
      }}>{c.gateTitleTop}</div>

      {/* Primary: Telegram block */}
      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--bg)',
        border: '2px solid #5BA0E8',
        padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, flexWrap: 'wrap',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.20em', color: '#5BA0E8', fontWeight: 800,
        }}>
          <span>✈ TELEGRAM{variant === 'hero' ? ' · ' + c.gateOneTapInline : ''}</span>
          <span data-testid={`mittari-gate-${variant}-badge`} style={{
            background: '#5BA0E8', color: '#0A0A0B',
            padding: '4px 10px', fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
          }}>{c.gateBadge}</span>
        </div>
        <h3 style={{
          fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400,
          lineHeight: 1.18, letterSpacing: '-0.015em', margin: 0,
        }}>{c.gateLead}</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {c.gateBullets.map((b, i) => (
            <li key={i} style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              color: 'var(--ink)', letterSpacing: '0.02em', lineHeight: 1.5,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ color: '#5BA0E8' }}>✓</span>{b}
            </li>
          ))}
        </ul>
        <a href={tgUrl} target="_blank" rel="noopener noreferrer"
          data-testid={`mittari-gate-${variant}-telegram-cta`}
          onClick={onTelegramClick} style={{
            display: 'block', textAlign: 'center',
            background: '#5BA0E8', color: '#0A0A0B',
            padding: '16px 22px', textDecoration: 'none',
            fontFamily: 'ui-monospace, monospace', fontSize: 13,
            fontWeight: 800, letterSpacing: '0.18em',
          }}>{c.gateTgCta} →</a>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          color: 'var(--muted)', letterSpacing: '0.05em', textAlign: 'center',
        }}>{c.gateTgSub}</div>
      </div>

      {/* Secondary: email fallback */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.12em', color: 'var(--muted)', textAlign: 'center',
          paddingTop: 4,
        }}>- {c.gateOr} -</div>
        <form onSubmit={submitEmail} className="m-emailrow" style={{
          display: 'flex', border: '1px solid var(--hairline)',
        }}>
          <input type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={c.gateEmailPlaceholder}
            data-testid={`mittari-gate-${variant}-email-input`}
            style={{
              flex: 1, minWidth: 0, background: 'var(--bg)',
              border: 0, outline: 'none', color: 'var(--ink)',
              padding: '13px 16px',
              fontFamily: 'ui-monospace, monospace', fontSize: 13,
              letterSpacing: '0.02em',
            }} />
          <button type="submit" disabled={busy}
            data-testid={`mittari-gate-${variant}-email-submit`}
            className="m-email-submit"
            style={{
              padding: '0 18px', background: 'var(--surface)', color: 'var(--ink)',
              border: 0, borderLeft: '1px solid var(--hairline)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>{busy ? '…' : c.gateEmailCta}</button>
        </form>
        {status === 'ok' && (
          <div data-testid={`mittari-gate-${variant}-email-success`} style={{
            color: '#6FA37D', fontFamily: 'ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.04em',
          }}>{c.formSuccess}</div>
        )}
        {status === 'err' && (
          <div data-testid={`mittari-gate-${variant}-email-err`} style={{
            color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.04em',
          }}>{c.formErr}</div>
        )}
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.10em', color: 'var(--muted)', textAlign: 'center',
          paddingTop: 2,
        }}>{c.gateFinePrint}</div>
      </div>
    </div>
  );
};

export default MittariGate;
