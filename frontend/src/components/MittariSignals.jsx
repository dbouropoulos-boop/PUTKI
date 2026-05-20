/**
 * MittariSignals — Päivän Signaalit (rich numbered list).
 *
 * Mirrors the mockup: numbered rows 01–05, blurred pick (filter: blur 8px)
 * until subscribed, reasoning line, confidence bar, hit-rate, lock icon.
 * Row #01 has a "Kytke → Signaali 01 avautuu heti" reveal teaser.
 * Below the list: title block + meta + mini-gate (email primary, Telegram fallback).
 *
 * Subscribe flow: email-primary via POST /api/voita/lead {source:'mittari'}.
 * Telegram path retained (deep-link `t.me/Putkihq_bot?start=mittari_<pending>`)
 * with the existing /api/mittari/subscribe + binding-status polling.
 *
 * Static signal data is deterministic — picks the existing
 * /api/odds/featured returns nothing useful in this env, and the editorial
 * value of these rows is the *narrative* (state-reasoning + hit-rate),
 * not real-time odds.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TELEGRAM_BOT = 'Putkihq_bot';
const STORAGE_KEY = 'putki_mittari_pending_id';
const STORAGE_UNLOCK_KEY = 'putki_mittari_unlocked_at';

// ── Static signal feed (deterministic, editorial value) ────────────────
const SIGNALS = [
  {
    n: '01',
    pickFi: 'Mikä Mikko · live PEAK-tilassa · 73% todennäköisyys korkealle katsojapiikille 2h sisällä',
    pickEn: 'Mikä Mikko · live in PEAK state · 73% chance of high viewer spike within 2h',
    reasonFi: ['Mittari', 'MEININKI 78', '· striimaaja-signaali korkea · Mikä Mikko livenä 2h 14m · historiallinen osumatarkkuus ', '73%'],
    reasonEn: ['Mittari', 'ROLLING 78', '· streamer-signal high · Mikä Mikko live 2h 14m · historical hit rate ', '73%'],
    confidence: 86, hitRate: 73, isFirst: true,
  },
  {
    n: '02',
    pickFi: 'Tappara–Kärpät · Liigan iltaottelu · foorumi-vipinä korreloi tasapelin kanssa',
    pickEn: 'Tappara–Kärpät · Liiga evening match · forum-buzz correlates with draws',
    reasonFi: ['Urheilusignaali', 'VIPINÄ 64', '· Liiga-ottelu 19:00 · foorumi-aktiivisuus nousussa · hit rate ', '61%'],
    reasonEn: ['Sports signal', 'ACTIVE 64', '· Liiga match 19:00 · forum activity rising · hit rate ', '61%'],
    confidence: 72, hitRate: 61,
  },
  {
    n: '03',
    pickFi: 'Sebsu · katsojakäyrä +12%/1h · ennakoi pidempää sessiota',
    pickEn: 'Sebsu · viewer curve +12%/1h · signals longer session',
    reasonFi: ['Mittari', 'ROLLING 70', '· Sebsu live 47m · katsojapiikki +12%/1h · hit rate ', '55%'],
    reasonEn: ['Mittari', 'ROLLING 70', '· Sebsu live 47m · viewer spike +12%/1h · hit rate ', '55%'],
    confidence: 65, hitRate: 55,
  },
  {
    n: '04',
    pickFi: 'Striimaaja-klusteri aktivoituu · foorumi-spike +47% ennakoi PEAKia 2.4h sisällä',
    pickEn: 'Streamer-cluster activating · forum-spike +47% signals PEAK within 2.4h',
    reasonFi: ['Foorumi-spike', '+47%', '· striimaaja-klusteri aktivoitumassa · avg lead time 2.4h · hit rate ', '68%'],
    reasonEn: ['Forum-spike', '+47%', '· streamer-cluster activating · avg lead time 2.4h · hit rate ', '68%'],
    confidence: 79, hitRate: 68,
  },
  {
    n: '05',
    pickFi: '7 päivän nouseva trendi · vahva korrelaatio striimaaja-PEAK ja foorumi-spike välillä',
    pickEn: '7-day rising trend · strong correlation between streamer-PEAK and forum-spike',
    reasonFi: ['Pitkän aikavälin signaali', 'Mittari-trendi 7 päivää nouseva', '· vahva korrelaatio striimaaja-PEAK ja foorumi-spike välillä · hit rate ', '49%'],
    reasonEn: ['Long-horizon signal', 'Mittari trend 7 days rising', '· strong correlation between streamer-PEAK and forum-spike · hit rate ', '49%'],
    confidence: 58, hitRate: 49,
  },
];

// ── Small static UI parts ──────────────────────────────────────────────
const LockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
    <rect x="5" y="11" width="14" height="10" rx="1" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

// ── Main ───────────────────────────────────────────────────────────────
const MittariSignals = () => {
  const { lang } = useLang();
  const isEn = lang === 'en';

  // Per-browser pending_id for Telegram deep-link binding. Public UUID,
  // not a security secret.
  const [pendingId] = useState(() => {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const fresh = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      window.localStorage.setItem(STORAGE_KEY, fresh);
      return fresh;
    } catch { return Math.random().toString(36).slice(2); }
  });
  const tgUrl = `https://t.me/${TELEGRAM_BOT}?start=mittari_${pendingId}`;

  const [unlocked, setUnlocked] = useState(() => {
    try { return !!window.localStorage.getItem(STORAGE_UNLOCK_KEY); }
    catch { return false; /* storage unavailable */ }
  });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = useCallback(async (e) => {
    e?.preventDefault?.();
    const v = email.trim().toLowerCase();
    if (!v || !v.includes('@')) {
      setErr(isEn ? 'Check your email' : 'Tarkista sähköposti');
      return;
    }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: v, age_18_plus: true, source: 'mittari',
          quiz_tags: { surface: 'mittari_signals' },
        }),
      });
      if (!r.ok) { setErr(isEn ? 'Try again' : 'Yritä uudelleen'); return; }
      try { window.localStorage.setItem(STORAGE_UNLOCK_KEY, String(Date.now())); }
      catch { /* noop: storage unavailable */ }
      setUnlocked(true); setEmail('');
    } catch {
      setErr(isEn ? 'Network error' : 'Verkkovirhe');
    } finally { setBusy(false); }
  }, [email, isEn]);

  const onTelegram = useCallback(async () => {
    // Pre-register the pending_id so the bot can resolve it on /start.
    try {
      await fetch(`${BACKEND}/api/mittari/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_id: pendingId }),
      });
    } catch { /* noop: bot binds without pre-register too */ }
    try { window.localStorage.setItem(STORAGE_UNLOCK_KEY, String(Date.now())); }
    catch { /* noop: storage unavailable */ }
    setUnlocked(true);
  }, [pendingId]);

  // Today's date in Finnish or English format for the title block.
  const dateStr = useMemo(() => {
    const d = new Date();
    if (isEn) {
      return d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      }) + ' · 09:00';
    }
    const wd = ['sunnuntai','maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai'][d.getDay()];
    const months = ['tammikuuta','helmikuuta','maaliskuuta','huhtikuuta','toukokuuta','kesäkuuta','heinäkuuta','elokuuta','syyskuuta','lokakuuta','marraskuuta','joulukuuta'];
    return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d.getDate()}. ${months[d.getMonth()]} · 09:00`;
  }, [isEn]);

  return (
    <section data-testid="mittari-signals" style={{ padding: '40px 0' }}>
      {/* Title + meta */}
      <div className="ms-head" style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, marginBottom: 26, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
            marginBottom: 10,
          }}>{isEn ? '— PÄIVÄN SIGNAALIT · LOCKED' : '— PÄIVÄN SIGNAALIT · LUKITTU'}</div>
          <h2 data-testid="mittari-signals-title" style={{
            fontFamily: 'Georgia, serif', fontSize: 'clamp(34px, 4.5vw, 48px)',
            lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 400, margin: 0,
          }}>{isEn ? 'Today\u2019s ' : 'Päivän '}
            <em style={{ color: '#E89248', fontStyle: 'italic' }}>{isEn ? 'Signals' : 'Signaalit'}</em>
          </h2>
          <div style={{
            marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.10em', color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>{dateStr}</div>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {[
            { l: isEn ? 'METER NOW' : 'MITTARI NYT', v: 'ROLLING', tone: '#E89248' },
            { l: isEn ? 'YESTERDAY HITS' : 'EILEN OSUMAT', v: '3/5', tone: '#6BB877' },
            { l: isEn ? '30D' : '30 PÄIVÄN', v: '58%', tone: 'var(--ink)' },
          ].map((m, i) => (
            <div key={i} data-testid={`mittari-signals-meta-${i}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 9,
                letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
              }}>{m.l}</span>
              <span style={{
                fontFamily: 'Georgia, serif', fontSize: 26, color: m.tone, lineHeight: 1,
              }}>{m.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Signal list */}
      <div data-testid="mittari-signals-list" style={{
        display: 'flex', flexDirection: 'column', gap: 1,
        background: 'var(--hairline)', border: '1px solid var(--hairline)',
      }}>
        {SIGNALS.map((s, i) => {
          const pick = isEn ? s.pickEn : s.pickFi;
          const reason = isEn ? s.reasonEn : s.reasonFi;
          return (
            <div key={s.n} data-testid={`mittari-signal-row-${s.n}`} className="ms-row" style={{
              background: 'var(--surface, #141210)',
              display: 'grid',
              gridTemplateColumns: '52px 1fr 180px 90px 36px',
              gap: 22, padding: '22px 24px', alignItems: 'center',
              ...(s.isFirst ? {
                borderTop: '1px solid #E89248',
                borderBottom: '1px solid #E89248',
              } : null),
            }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.10em',
                color: s.isFirst ? '#E89248' : 'var(--muted)',
              }}>{s.n}</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div data-testid={`mittari-signal-pick-${s.n}`} style={{
                  fontFamily: 'Georgia, serif', fontSize: 21, lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  color: unlocked ? '#E89248' : 'var(--ink)',
                  filter: unlocked ? 'none' : 'blur(8px)',
                  userSelect: unlocked ? 'auto' : 'none',
                  transition: 'filter 320ms ease',
                  overflowWrap: 'anywhere',
                }}>{pick}</div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.05em', color: 'var(--muted)',
                  lineHeight: 1.6, textTransform: 'uppercase',
                }}>
                  <span style={{ color: '#E89248' }}>{reason[0]}</span>{' '}
                  <strong style={{ color: '#E89248' }}>{reason[1]}</strong>
                  {reason[2]}
                  <strong style={{ color: '#E89248' }}>{reason[3]}</strong>
                </div>
                {s.isFirst && !unlocked && (
                  <div data-testid="mittari-signal-reveal-teaser" onClick={() => {
                    document.querySelector('[data-testid="mittari-signals-mini-gate-input"]')?.focus();
                    document.querySelector('[data-testid="mittari-signals-mini-gate"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }} style={{
                    width: 'fit-content', cursor: 'pointer',
                    padding: '6px 12px', marginTop: 4,
                    background: 'var(--bg)', border: '1px dashed #E89248',
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.10em', color: '#E89248',
                    textTransform: 'uppercase',
                  }}>⌥ {isEn ? 'Subscribe → Signal 01 opens instantly' : 'Tilaa → Signaali 01 avautuu heti'}</div>
                )}
              </div>

              <div data-testid={`mittari-signal-conf-${s.n}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
                  textTransform: 'uppercase',
                }}>{isEn ? 'Confidence' : 'Varmuus'}</span>
                <div style={{
                  height: 3, background: 'var(--bg)', position: 'relative',
                }}>
                  <div style={{
                    width: `${s.confidence}%`, height: '100%',
                    background: '#E89248',
                  }} />
                </div>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: 'var(--ink)',
                }}>{s.confidence}%</span>
              </div>

              <div data-testid={`mittari-signal-hr-${s.n}`}
                style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: 21, lineHeight: 1,
                  color: 'var(--ink)',
                }}>{s.hitRate}%</div>
                <div style={{
                  marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  letterSpacing: '0.10em', color: 'var(--muted)',
                  textTransform: 'uppercase',
                }}>{isEn ? 'same setup' : 'samalla setupilla'}</div>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                color: 'var(--muted)',
              }}>
                {unlocked
                  ? <span style={{ color: '#6BB877', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>✓</span>
                  : <LockIcon />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, textAlign: 'center',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.08em', color: 'var(--muted)',
      }}>
        {isEn
          ? 'Daily Signals open by subscribing · next drop'
          : 'Päivän Signaalit avautuvat tilaamalla · seuraava pudotus'}{' '}
        <span style={{ color: '#E89248' }}>{isEn ? 'tomorrow 09:00' : 'huomenna klo 09:00'}</span>
      </div>

      {/* Mini-gate (email primary · Telegram fallback) */}
      <div data-testid="mittari-signals-mini-gate" className="ms-mini-gate" style={{
        marginTop: 40, padding: '28px 32px',
        background: 'var(--surface, #141210)', border: '1px solid #E89248',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 28, position: 'relative', overflow: 'hidden', flexWrap: 'wrap',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 600px 220px at left center, rgba(232,146,72,0.18), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 240 }}>
          <h3 style={{
            fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 400,
            lineHeight: 1.18, letterSpacing: '-0.01em', margin: 0,
          }}>
            {isEn ? (<>Unlock <em style={{ color: '#E89248', fontStyle: 'italic' }}>today\u2019s</em> five signals.<br />Inbox in <em style={{ color: '#E89248', fontStyle: 'italic' }}>under 3 seconds.</em></>)
                  : (<>Avaa <em style={{ color: '#E89248', fontStyle: 'italic' }}>tämän päivän</em> viisi signaalia.<br />Sähköpostiin <em style={{ color: '#E89248', fontStyle: 'italic' }}>alle 3 sekunnissa.</em></>)}
          </h3>
          <div style={{
            marginTop: 10, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase',
          }}>{isEn
              ? 'Yesterday 3/5 hits · 7d streak · Free · GDPR'
              : 'Eilen 3/5 osui · putki 7 päivää · maksuton · GDPR'}</div>
        </div>
        <form onSubmit={submit} className="ms-mini-form" style={{
          position: 'relative', zIndex: 1, display: 'flex', minWidth: 360, flex: 1, gap: 0,
        }}>
          <input type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            placeholder={isEn ? 'you@email.com' : 'sähköpostisi@osoite.fi'}
            data-testid="mittari-signals-mini-gate-input"
            style={{
              flex: 1, minWidth: 0, background: 'var(--bg)',
              border: '1px solid var(--hairline)', borderRight: 'none',
              outline: 'none', color: 'var(--ink)',
              padding: '14px 18px',
              fontFamily: 'ui-monospace, monospace', fontSize: 13,
            }} />
          <button type="submit" disabled={busy}
            data-testid="mittari-signals-mini-gate-submit"
            style={{
              padding: '0 22px', background: '#E89248', color: '#0A0A0B',
              border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
              fontWeight: 800, letterSpacing: '0.16em',
              cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            }}>
            {busy ? '…' : (isEn ? 'UNLOCK SIGNALS →' : 'AVAA SIGNAALIT →')}
          </button>
        </form>
        {err && <div data-testid="mittari-signals-mini-gate-err" style={{
          width: '100%', position: 'relative', zIndex: 1,
          color: '#C13B2C', fontFamily: 'ui-monospace, monospace', fontSize: 11,
        }}>{err}</div>}
      </div>

      <div style={{
        marginTop: 16, textAlign: 'center',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.10em', color: 'var(--muted)',
      }}>
        {isEn ? 'or ' : 'tai '}
        <a href={tgUrl} target="_blank" rel="noopener noreferrer"
          data-testid="mittari-signals-telegram-cta" onClick={onTelegram}
          style={{
            color: '#5BA0E8', textDecoration: 'none',
            borderBottom: '1px dotted #5BA0E8', padding: '0 4px',
          }}>{isEn ? 'open in Telegram →' : 'avaa Telegramissa →'}</a>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .ms-row {
            grid-template-columns: 36px 1fr !important;
            gap: 12px !important;
            padding: 16px !important;
          }
          .ms-row > *:nth-child(3),
          .ms-row > *:nth-child(4),
          .ms-row > *:nth-child(5) { display: none !important; }
          .ms-mini-gate { flex-direction: column !important; align-items: stretch !important; padding: 22px !important; }
          .ms-mini-form { min-width: 100% !important; flex-direction: column !important; }
          .ms-mini-form input { border-right: 1px solid var(--hairline) !important; border-bottom: none !important; }
          .ms-mini-form button { padding: 14px 22px !important; width: 100% !important; border-top: 1px solid var(--hairline) !important; }
        }
      `}</style>
    </section>
  );
};

export default MittariSignals;
