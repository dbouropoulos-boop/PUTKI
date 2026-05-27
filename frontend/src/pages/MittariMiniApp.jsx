/**
 * /tma - Telegram Mini App (iter76, Slice 4).
 *
 * Loads inside Telegram via the Web App JS SDK. On mount:
 *   1. Pull window.Telegram.WebApp.initData (HMAC-signed query string).
 *   2. POST it to /api/tma/auth → session token + subscriber profile.
 *   3. GET /api/tma/signals → 5 picks with per-card lock state.
 *   4. Render locked/unlocked cards. Bot CTA on locked cards opens the
 *      website /signup to bind the user.
 *
 * Outside Telegram (preview / direct browse) the page falls back to a
 * "Open in Telegram" landing. Dev environments without TELEGRAM_BOT_TOKEN
 * are supported via the `?dev=<tg_id>` query (matches backend dev path).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const COPY = {
  fi: {
    eyebrow: 'PUTKI HQ · MINI APP',
    h1: 'Päivän signaalit',
    open_in_tg: 'Avaa Mini App Telegramissa',
    not_in_tg_body: 'Avaa tämä sivu Telegram-botin kautta: napauta START @Putkihq_bot:lla.',
    bind_cta: 'Sido Telegram → Avaa kaikki',
    sign_up_cta: 'Avaa signaalit',
    locked: 'LUKITTU',
    unlocked: 'AUKI',
    sharpness: 'Sharpness',
    no_picks: 'Ei tänään signaaleja - palaa huomenna klo 09:00.',
    loading: 'Ladataan…',
    error: 'Hetkellinen virhe. Yritä myöhemmin uudelleen.',
    footer: 'Toimituksellinen sisältö · 18+ · Ei vetovinkki.',
  },
  en: {
    eyebrow: 'PUTKI HQ · MINI APP',
    h1: "Today's signals",
    open_in_tg: 'Open Mini App in Telegram',
    not_in_tg_body: 'Open this page through the Telegram bot: tap START on @Putkihq_bot.',
    bind_cta: 'Bind Telegram → Unlock all',
    sign_up_cta: 'Unlock signals',
    locked: 'LOCKED',
    unlocked: 'OPEN',
    sharpness: 'Sharpness',
    no_picks: "No signals today - check back tomorrow at 09:00.",
    loading: 'Loading…',
    error: 'Temporary error. Please retry shortly.',
    footer: 'Editorial only · 18+ · Not betting advice.',
  },
};

const formatKickoff = (iso) => {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const SignalCard = ({ card, t, onUnlock }) => {
  const odds = card.odds_decimal ? `@${card.odds_decimal.toFixed(2)}` : '@?.??';
  const sharp = card.sharpness ?? 0;
  return (
    <div data-testid={`tma-card-${card.index}`} style={{
      border: '1px solid var(--tma-border)', padding: 14, marginBottom: 10,
      background: card.locked ? 'var(--tma-locked-bg)' : 'var(--tma-card-bg)',
      borderRadius: 6, position: 'relative',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em',
          fontWeight: 700, color: 'var(--tma-muted)',
        }}>{String(card.index).padStart(2, '0')} · {(card.sport || '').slice(0, 24).toUpperCase()}</span>
        <span data-testid={`tma-card-${card.index}-state`} style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em',
          fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: card.locked ? '#3a2a18' : '#1f3a25',
          color: card.locked ? '#E8C26E' : '#A6E0B0',
        }}>{card.locked ? t.locked : t.unlocked}</span>
      </div>
      {card.locked ? (
        <>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: 'var(--tma-muted)' }}>
            ▦ ▦ ▦ ▦ ▦ ▦
          </div>
          <button onClick={onUnlock} data-testid={`tma-card-${card.index}-unlock`}
            style={{
              marginTop: 10, padding: '10px 14px', background: '#E8C26E', color: '#0B0A09',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.2em', fontWeight: 800, cursor: 'pointer', width: '100%', borderRadius: 4,
            }}>{t.bind_cta}</button>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
            {card.event_name || '—'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--tma-ink-soft)' }}>
            <strong>{card.pick || '?'}</strong>{' '}
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{odds}</span>
            {' · '}{t.sharpness} {sharp}
          </div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--tma-muted)',
            marginTop: 4, letterSpacing: '0.06em',
          }}>
            {formatKickoff(card.kickoff_at)} {card.bookmaker ? `· ${card.bookmaker}` : ''}
          </div>
        </>
      )}
    </div>
  );
};

const MittariMiniApp = () => {
  const [search] = useSearchParams();
  const devUserId = search.get('dev'); // local-dev fallback
  const lang = (search.get('lang') === 'en' || (navigator.language || '').startsWith('en')) ? 'en' : 'fi';
  const t = COPY[lang];

  const [tg, setTg] = useState(null);
  const [auth, setAuth] = useState(null);
  const [signals, setSignals] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Load Telegram WebApp JS SDK once. Idempotent - if the user opens
  // the page outside Telegram, the SDK simply attaches a stub-ish API.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Telegram && window.Telegram.WebApp) {
      setTg(window.Telegram.WebApp);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.async = true;
    s.onload = () => {
      if (window.Telegram && window.Telegram.WebApp) {
        try { window.Telegram.WebApp.ready(); } catch { /* noop */ }
        try { window.Telegram.WebApp.expand(); } catch { /* noop */ }
        setTg(window.Telegram.WebApp);
      }
    };
    document.head.appendChild(s);
    return () => { try { document.head.removeChild(s); } catch { /* noop */ } };
  }, []);

  // Authenticate once we have either initData (real TG) or a dev_user_id.
  const initData = useMemo(() => {
    if (tg && tg.initData) return tg.initData;
    return '';
  }, [tg]);

  const runAuth = useCallback(async () => {
    if (!initData && !devUserId) return;
    setBusy(true); setErr(null);
    try {
      const body = initData
        ? { init_data: initData }
        : { init_data: '', dev_user_id: parseInt(devUserId, 10) };
      const r = await fetch(`${BACKEND}/api/tma/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) { setErr(t.error); return; }
      setAuth(await r.json());
    } catch { setErr(t.error); }
    finally { setBusy(false); }
  }, [initData, devUserId, t]);

  useEffect(() => { runAuth(); }, [runAuth]);

  // Once authed, fetch signals.
  useEffect(() => {
    if (!auth?.token || !auth?.tg_user?.id) return;
    let cancelled = false;
    // Fire the open beacon once per session (best-effort, no auth).
    try {
      fetch(`${BACKEND}/api/tma/event`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'tma_open',
          tg_user_id: auth.tg_user.id,
          pending_id: auth.subscriber?.pending_id,
        }),
      });
    } catch { /* fire-and-forget */ }
    (async () => {
      setBusy(true); setErr(null);
      try {
        const r = await fetch(
          `${BACKEND}/api/tma/signals?tg_user_id=${auth.tg_user.id}&token=${encodeURIComponent(auth.token)}`,
        );
        if (!r.ok) { if (!cancelled) setErr(t.error); return; }
        const j = await r.json();
        if (!cancelled) setSignals(j);
      } catch { if (!cancelled) setErr(t.error); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [auth, t]);

  const openSignup = useCallback(() => {
    // Beacon the unlock-click event before opening so the funnel widget
    // attributes it to this subscriber even if the new tab steals focus.
    try {
      fetch(`${BACKEND}/api/tma/event`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'unlock_click',
          tg_user_id: auth?.tg_user?.id,
          pending_id: auth?.subscriber?.pending_id,
        }),
      });
    } catch { /* fire-and-forget */ }
    const url = `${(process.env.REACT_APP_BACKEND_URL || '')
      .replace(/\/$/, '')
      .replace(/\/api$/, '')}/signup?lang=${lang}`;
    if (tg && typeof tg.openLink === 'function') tg.openLink(url);
    else if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  }, [tg, lang, auth]);

  const styles = {
    page: {
      minHeight: '100vh',
      // Telegram Mini Apps inject theme params via CSS vars; we fall
      // back to a dark palette that reads cleanly on both light + dark.
      background: 'var(--tg-theme-bg-color, #16151A)',
      color: 'var(--tg-theme-text-color, #F2EBE0)',
      padding: '18px 16px 36px',
      // Bridge Telegram CSS vars to local names so SignalCard can reuse.
      ['--tma-border']: '#2a2722',
      ['--tma-card-bg']: 'var(--tg-theme-secondary-bg-color, #1F1D22)',
      ['--tma-locked-bg']: '#211C16',
      ['--tma-muted']: 'var(--tg-theme-hint-color, #9C8B6B)',
      ['--tma-ink-soft']: 'var(--tg-theme-text-color, #D8CDB9)',
    },
    eyebrow: {
      fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.26em',
      fontWeight: 800, color: 'var(--tma-muted)', marginBottom: 8,
    },
    h1: { fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, margin: '0 0 14px' },
    fallbackBox: {
      padding: 16, border: '1px dashed var(--tma-border)', borderRadius: 4,
      fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.5,
    },
    primaryBtn: {
      width: '100%', padding: '14px', marginTop: 14, background: '#E8C26E', color: '#0B0A09',
      border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.24em', fontWeight: 800, cursor: 'pointer', borderRadius: 4,
    },
    footer: {
      marginTop: 24, fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.1em', color: 'var(--tma-muted)', lineHeight: 1.6, textAlign: 'center',
    },
  };

  // Not inside Telegram + no dev fallback: render the "open in TG" splash.
  if (!initData && !devUserId) {
    return (
      <div style={styles.page} data-testid="tma-page-fallback">
        <div style={styles.eyebrow}>{t.eyebrow}</div>
        <h1 style={styles.h1}>{t.h1}</h1>
        <div style={styles.fallbackBox} data-testid="tma-fallback-body">{t.not_in_tg_body}</div>
        <a href="https://t.me/Putkihq_bot" target="_blank" rel="noreferrer"
          data-testid="tma-fallback-cta"
          style={{ ...styles.primaryBtn, display: 'block', textDecoration: 'none', textAlign: 'center' }}>
          {t.open_in_tg} →
        </a>
        <p style={styles.footer}>
          <Link to="/" style={{ color: 'var(--tma-muted)', textDecoration: 'none' }}>← Putki HQ</Link>
          {' · '}{t.footer}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page} data-testid="tma-page">
      <div style={styles.eyebrow}>{t.eyebrow}</div>
      <h1 style={styles.h1}>{t.h1}</h1>

      {busy && !signals && (
        <div data-testid="tma-loading" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--tma-muted)' }}>
          {t.loading}
        </div>
      )}

      {err && (
        <div data-testid="tma-error" style={{
          padding: 12, border: '1px solid #C8423C', background: '#2b0e0e', color: '#FF8A7F',
          fontFamily: 'ui-monospace, monospace', fontSize: 12, marginBottom: 12, borderRadius: 4,
        }}>{err}</div>
      )}

      {signals && (
        <>
          {signals.picks.length === 0 ? (
            <div data-testid="tma-empty" style={styles.fallbackBox}>{t.no_picks}</div>
          ) : (
            signals.picks.map((card) => (
              <SignalCard key={card.index} card={card} t={t} onUnlock={openSignup} />
            ))
          )}

          {/* Bottom CTA only when user is not bound yet. */}
          {signals.subscriber && !signals.subscriber.bound && (
            <button onClick={openSignup} data-testid="tma-bind-cta" style={styles.primaryBtn}>
              {t.bind_cta}
            </button>
          )}
        </>
      )}

      <p style={styles.footer}>{t.footer}</p>
    </div>
  );
};

export default MittariMiniApp;
