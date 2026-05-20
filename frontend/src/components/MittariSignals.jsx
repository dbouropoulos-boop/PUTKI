/**
 * PUTKI HQ — Mittari Signals (Sprint B Slice 4).
 *
 * Daily signals feed gated behind a Telegram binding. Top pick is shown
 * as a teaser; full top-5 + state-change pings unlock after the user
 * taps "OPEN IN TELEGRAM →" and the bot resolves `/start mittari_<id>`.
 *
 * Binding state machine:
 *   - "locked"   → teaser pick + Telegram CTA
 *   - "pending"  → CTA tapped, polling /api/mittari/binding-status
 *   - "unlocked" → all signals visible + "you're subscribed" badge
 *
 * The optimistic UX is: we DO NOT block on bot confirmation — the user
 * sees all 5 signals as soon as they tap the CTA. The polling check
 * upgrades the badge from "PENDING" to "BOUND" once the bot binds.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TELEGRAM_BOT = 'Putkihq_bot';
const STORAGE_KEY = 'putki_mittari_pending_id';
const STORAGE_TS_KEY = 'putki_mittari_unlocked_at';

const trackBand = (score) => {
  if (score >= 90) return { label: 'TIGHT', color: '#6FA37D' };
  if (score >= 75) return { label: 'CLEAR', color: '#6FA37D' };
  if (score >= 60) return { label: 'MIXED', color: '#D4B445' };
  if (score >= 40) return { label: 'LOOSE', color: '#C97A3A' };
  return { label: 'SCATTERED', color: '#C13B2C' };
};

const SignalCard = ({ pick, idx, lang, blurred }) => {
  const sharpness = pick?.sharpness?.sharpness ?? 0;
  const band = trackBand(sharpness);
  const event = pick?.event_name || pick?.label
    || `${pick?.home_team || ''} – ${pick?.away_team || ''}`.trim();
  return (
    <div data-testid={`signal-card-${idx}`} style={{
      position: 'relative',
      padding: '18px 20px',
      background: 'var(--surface, #141210)',
      border: '1px solid var(--hairline, #221E1B)',
      filter: blurred ? 'blur(4px)' : 'none',
      pointerEvents: blurred ? 'none' : 'auto',
      transition: 'filter 320ms ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10, gap: 10,
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
        }}>#{idx + 1} · {(pick?.sport || pick?.league || 'SPORTS').toUpperCase()}</div>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', color: band.color, fontWeight: 700,
        }}>{band.label}</div>
      </div>
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
        color: 'var(--ink)', lineHeight: 1.25,
        letterSpacing: '-0.01em', marginBottom: 10,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{event || '—'}</div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        color: 'var(--muted)', letterSpacing: '0.06em',
        marginBottom: 12,
      }}>
        {(pick?.pick_team || pick?.pick) && (
          <span style={{ color: 'var(--ink)' }}>
            {pick.pick_team || pick.pick}
            {pick.odds_decimal ? ` · ${pick.odds_decimal.toFixed(2)}` : ''}
          </span>
        )}
        {pick?.bookmaker && (
          <span style={{
            maxWidth: 150, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{pick.bookmaker}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          color: band.color,
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 32, lineHeight: 1, letterSpacing: '-0.02em',
        }}>{Math.round(sharpness)}</span>
        <span style={{
          color: 'var(--muted)',
          fontFamily: 'ui-monospace, monospace', fontSize: 9,
          letterSpacing: '0.22em', fontWeight: 700,
        }}>SHARPNESS</span>
      </div>
    </div>
  );
};

const MittariSignals = () => {
  const { lang } = useLang();
  const [picks, setPicks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Stable per-browser pending_id for the Telegram deep-link binding.
  // Stored in localStorage so a returning visitor reuses the same id
  // (one tap binds the same browser permanently to the same Telegram
  // chat). NOT a security secret — just an opaque correlation UUID
  // bound to a public bot deep-link.
  const [pendingId] = useState(() => {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const fresh = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(STORAGE_KEY, fresh);
      return fresh;
    } catch { return Math.random().toString(36).slice(2); }
  });

  // status: 'locked' | 'pending' | 'unlocked'
  const [status, setStatus] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_TS_KEY) ? 'unlocked' : 'locked';
    } catch { return 'locked'; /* storage unavailable */ }
  });
  const [bound, setBound] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/odds/featured`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (stop || !d) return;
      const sorted = (d.picks || [])
        .filter((p) => (p?.sharpness?.sharpness || 0) >= 40)
        .sort((a, b) => (b?.sharpness?.sharpness || 0) - (a?.sharpness?.sharpness || 0))
        .slice(0, 5);
      setPicks(sorted);
    }).catch(() => {}).finally(() => { if (!stop) setLoaded(true); });
    return () => { stop = true; };
  }, []);

  // Poll for bot binding once we've launched Telegram. Stops after 60s
  // or after binding flips true.
  useEffect(() => {
    if (status !== 'pending' && status !== 'unlocked') return undefined;
    const startedAt = Date.now();
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/mittari/binding-status?pending_id=${encodeURIComponent(pendingId)}`);
        const j = await r.json();
        if (j.bound) {
          setBound(true);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
      } catch { /* noop: polling — next tick will retry */ }
      if (Date.now() - startedAt > 60_000 && pollRef.current) {
        clearInterval(pollRef.current); pollRef.current = null;
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [status, pendingId]);

  const onTelegram = useCallback(async () => {
    // Optimistic unlock: server-side pre-registration + client-side flip.
    try {
      await fetch(`${BACKEND}/api/mittari/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_id: pendingId }),
      });
    } catch { /* noop: bot binding still works without server pre-register */ }
    try { window.localStorage.setItem(STORAGE_TS_KEY, String(Date.now())); } catch { /* noop: storage unavailable */ }
    setStatus('unlocked');
  }, [pendingId]);

  const visiblePicks = useMemo(() => picks, [picks]);
  const tgUrl = `https://t.me/${TELEGRAM_BOT}?start=mittari_${pendingId}`;

  if (!loaded) return null;

  const isLocked = status === 'locked';

  return (
    <section data-testid="mittari-signals" style={{
      borderTop: '1px solid var(--hairline, #221E1B)',
      padding: '32px 0',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 14, flexWrap: 'wrap', marginBottom: 14,
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700,
        }}>{lang === 'en' ? 'DAILY SIGNALS · TOP 5' : 'PÄIVÄN SIGNAALIT · TOP 5'}</span>
        {status === 'unlocked' && (
          <span data-testid="mittari-signals-status" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.20em', fontWeight: 700,
            color: bound ? '#6FA37D' : '#D4B445',
          }}>
            {bound
              ? (lang === 'en' ? '✓ TELEGRAM BOUND' : '✓ TELEGRAM YHDISTETTY')
              : (lang === 'en' ? '⏳ WAITING FOR TELEGRAM /START' : '⏳ ODOTETAAN TELEGRAM /START')}
          </span>
        )}
      </div>

      {picks.length === 0 ? (
        <div data-testid="mittari-signals-empty" style={{
          color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
          fontSize: 11.5, letterSpacing: '0.10em', padding: '20px 0',
        }}>{lang === 'en' ? 'NO SIGNALS TODAY YET — CHECK BACK AT 10:00 EET.' : 'EI SIGNAALEJA VIELÄ TÄNÄÄN — TARKISTA KLO 10:00 EET.'}</div>
      ) : (
        <>
          <div data-testid="mittari-signals-grid" style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            position: 'relative',
          }}>
            {visiblePicks.map((p, i) => (
              <SignalCard key={i} pick={p} idx={i} lang={lang}
                blurred={isLocked && i > 0} />
            ))}
          </div>

          {isLocked && (
            <div data-testid="mittari-signals-gate" style={{
              marginTop: 18, padding: '20px 22px',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              display: 'grid', gap: 14,
            }}>
              <div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.22em', color: '#229ED9', fontWeight: 700,
                  marginBottom: 8,
                }}>
                  {lang === 'en' ? 'UNLOCK ALL 5 SIGNALS' : 'AVAA KAIKKI 5 SIGNAALIA'}
                </div>
                <p style={{
                  color: 'var(--ink)', fontSize: 14, lineHeight: 1.55,
                  margin: 0, opacity: 0.94,
                }}>{lang === 'en'
                  ? 'Tap below to bind Telegram. You get all 5 signals daily at 10:00 EET — plus an instant ping when Mittari changes state.'
                  : 'Avaa Telegram alta. Saat kaikki 5 signaalia päivittäin klo 10:00 EET — ja heti-ilmoituksen kun Mittari vaihtaa tilaa.'}</p>
              </div>
              <a href={tgUrl} target="_blank" rel="noopener noreferrer"
                data-testid="mittari-signals-telegram-cta"
                onClick={onTelegram}
                style={{
                  display: 'block', textDecoration: 'none',
                  padding: '15px 22px',
                  background: '#229ED9', color: '#FFFFFF',
                  fontFamily: 'ui-monospace, monospace', fontSize: 12,
                  letterSpacing: '0.20em', fontWeight: 800,
                  textAlign: 'center',
                  boxShadow: '0 0 24px rgba(34,158,217,0.25)',
                }}>{lang === 'en' ? 'OPEN IN TELEGRAM →' : 'AVAA TELEGRAMISSA →'}</a>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.18em', color: 'var(--muted)',
                textAlign: 'center',
              }}>{lang === 'en'
                ? `Opens @${TELEGRAM_BOT}. Free. Stop anytime with /stop.`
                : `Avaa @${TELEGRAM_BOT}. Ilmainen. Lopeta milloin vain: /stop.`}</div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default MittariSignals;
