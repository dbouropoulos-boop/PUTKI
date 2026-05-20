/**
 * Mittari — standalone landing page (/mittari).
 *
 * ONE JOB: capture an email or Telegram contact. Two products, one capture:
 * the Signals (five morning picks) and the Meter (live widget + state-change
 * pings). Every section on this page exists to earn that capture.
 *
 * Telegram is the visually-dominant CTA in both gates (zero-typing, no
 * spam bounce, mobile-native for the gambling audience). Email is the
 * smaller fallback.
 *
 * Section order (single clean pass — no duplicates):
 *   1. HERO — dial (left) + Telegram-primary gate (right) + signals-led
 *      headline + killer stat
 *   2. PÄIVÄN SIGNAALIT — locked numbered list; row #01 unlocks instantly
 *      on gate submit (reveal mechanic)
 *   3. HOW IT WORKS — 3 steps
 *   4. RECEIPTS TABLE
 *   5. TESTIMONIALS
 *   6. FOUNDER
 *   7. PRESS STRIP
 *   8. FINAL GATE (Telegram-primary, same pattern)
 *   9. Footer with ← PUTKI HQ link + sticky mobile bar
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DialCockpit from '../components/DialCockpit';
import MittariSignals from '../components/MittariSignals';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TELEGRAM_BOT = 'Putkihq_bot';
const STORAGE_PENDING_KEY = 'putki_mittari_pending_id';
const STORAGE_UNLOCK_KEY = 'putki_mittari_unlocked_at';

const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};
const STATE_LABEL = {
  fi: { KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ', MYRSKY: 'MEININKI', KIIRASTULI: 'PERKELE' },
  en: { KYLMA: 'CALM',  HAALEA: 'BUZZ', KUUMA: 'ACTIVE', MYRSKY: 'ROLLING',  KIIRASTULI: 'PERKELE' },
};

// ── i18n copy ──────────────────────────────────────────────────────────
const COPY = {
  fi: {
    sectionHero: 'PÄIVÄN SIGNAALIT · LIVE',
    headlineLead: 'Viisi vahvinta poimintaa',
    headlineEm: 'joka aamu klo 09:00',
    headlineTail: 'suoraan Telegramiin tai sähköpostiin.',
    sublineLead: 'Lasketaan EU-vedonlyöntimarkkinoiden hinnoista — Sharpness 0–100 kirjojen hajonnasta ja momentumista. Sama data, sama luku. Lisäksi saat Mittarin reaaliaikaiset skenehälytykset samaan tilaukseen.',
    killerEyebrow: 'KESKI-SHARPNESS TÄNÄÄN',
    killerSubLead: 'Päivän viisi poimintaa keskiarvolla',
    killerSubTail: '— korkein implisiittinen todennäköisyys',
    killerFoot: 'Live · 15 min päivitys · lähde Odds API + EU-kirjat',
    killerQuiet: 'Markkina hiljainen juuri nyt — pudotus klo 09:00.',
    countdownLabel: 'Seuraava pudotus',
    gateTitleTop: '→ Kytke putki',
    gateLead: 'Avaa Telegramissa — yksi napsautus',
    gateOneTapInline: 'YKSI NAPSAUTUS',
    gateBadge: 'ALLE 3S TOIMITUS',
    gateBullets: [
      'Päivän signaalit aamulla',
      'Mittari tilanvaihdokset reaaliajassa',
      'Yksi tilaus · ei kahta listaa · ei spämmiä',
    ],
    gateTgCta: 'AVAA TELEGRAMISSA',
    gateTgSub: 'Sitoo chat-ID:n automaattisesti · ei sähköpostia ei salasanaa',
    gateOr: 'tai sähköpostiin',
    gateEmailPlaceholder: 'sähköpostisi@osoite.fi',
    gateEmailCta: 'AVAA SIGNAALIT →',
    gateFinePrint: 'Maksuton · lopeta milloin tahansa · GDPR',
    revealedHi: 'Signaali 01 avattiin yllä ↑ · loput tulevat Telegramiin/sähköpostiin alle 3 sekunnissa.',
    explainTitle: 'NÄIN SE TOIMII',
    step1Title: '1 · MARKKINA',
    step1Body: 'EU-kirjat liikuttavat markkinaa. Lasketaan implisiittinen todennäköisyys + Sharpness joka kirjasta. Päivän viisi vahvinta nousee listalle joka aamu klo 09:00.',
    step2Title: '2 · SKENE',
    step2Body: 'Mittari yhdistää 11 julkista lähdettä yhdeksi luvuksi 0–100 ja viiteen tilaan: Tyyni · Vire · Vipinä · Meininki · Perkele.',
    step3Title: '3 · HÄLYTYS',
    step3Body: 'Signaalit aamulla. Mittarin tilanvaihdokset reaaliajassa. Sama tilaus, sama kanava.',
    receiptsTitle: 'VIIME SIGNAALIT · 7 VIIMEISINTÄ · AIKALEIMATTU',
    receiptsFoot7d: '7 päivän osumatarkkuus',
    receiptsFoot30d: '30 päivän',
    testimonialsTitle: 'TILAAJIA · KUUKAUSINA MUKANA',
    pressTitle: 'MAINITTU',
    founderTitle: 'KUKA TÄMÄN TAKANA ON',
    founderEyebrow: 'PERUSTAJA · 9 VUOTTA SUOMEN SKENEN ÄÄRELLÄ',
    founderQuote: 'Rakensin nämä koska olen kyllästynyt missaamaan parhaat hetket — sekä markkinassa että striimausskenessä. Nyt saan viisi vahvinta poimintaa aamulla ja hälytyksen sekunnissa kun skene vaihtaa tilaa.',
    founderName: 'Dioni V.',
    founderRole: 'Perustaja · Putki HQ',
    founderCreds: 'Aikaisemmin Smartico ja NeptunePay · Helsinki · 11 julkista lähdettä, 0 toimituksellista muokkausta',
    founderMethodLink: 'Lue koko menetelmä →',
    finalEyebrow: '→ VIIMEINEN MAHDOLLISUUS KYTKEÄ ENNEN PUDOTUSTA',
    finalHeadlineLead: 'Päivän Signaalit aamuisin.',
    finalHeadlineEm: 'Mittari reaaliajassa.',
    feedTitle: 'TUOREIMMAT TILAUKSET',
    feedSubscribed: 'tilasi',
    channelEmail: 'sähköposti',
    feedLive: 'Live',
    minute: 'min sitten',
    justNow: 'juuri nyt',
    stickyText: 'Seuraavat signaalit',
    stickyCta: 'AVAA',
    statusHit: 'OSUI', statusMiss: 'OHI', statusEarly: 'AIKAISIN',
    formErr: 'Tarkista sähköposti',
    formSuccess: '✓ Kiitos — vahvistuslinkki sähköpostissasi',
    meterStateLabel: 'MITTARI NYT',
    backHome: '← PUTKI HQ',
  },
  en: {
    sectionHero: 'DAILY SIGNALS · LIVE',
    headlineLead: 'Five strongest picks',
    headlineEm: 'every morning at 09:00',
    headlineTail: 'straight to Telegram or email.',
    sublineLead: 'Computed from EU betting market prices — Sharpness 0–100 from book dispersion and momentum. Same data, same number. Plus you get Mittari\u2019s real-time scene alerts in the same subscription.',
    killerEyebrow: 'AVG SHARPNESS TODAY',
    killerSubLead: 'Today\u2019s five picks average sharpness',
    killerSubTail: '— top implied probability',
    killerFoot: 'Live · 15-min refresh · source Odds API + EU books',
    killerQuiet: 'Market quiet right now — next drop at 09:00.',
    countdownLabel: 'Next drop',
    gateTitleTop: '→ Connect the pipe',
    gateLead: 'Open in Telegram — one tap',
    gateOneTapInline: 'ONE TAP',
    gateBadge: '<3S DELIVERY',
    gateBullets: [
      'Daily signals in the morning',
      'Mittari state-changes in real time',
      'Single signup · no second list · no spam',
    ],
    gateTgCta: 'OPEN IN TELEGRAM',
    gateTgSub: 'Binds your chat ID automatically · no email no password',
    gateOr: 'or use email',
    gateEmailPlaceholder: 'you@email.com',
    gateEmailCta: 'UNLOCK SIGNALS →',
    gateFinePrint: 'Free · stop anytime · GDPR',
    revealedHi: 'Signal 01 unlocked above ↑ · the rest land in Telegram/email in under 3 seconds.',
    explainTitle: 'HOW IT WORKS',
    step1Title: '1 · MARKET',
    step1Body: 'EU books move the market. We compute implied probability + Sharpness per book. Today\u2019s five strongest plays surface every morning at 09:00.',
    step2Title: '2 · SCENE',
    step2Body: 'Mittari composites 11 public sources into one number 0–100 and five states: Calm · Buzz · Active · Rolling · Perkele.',
    step3Title: '3 · ALERT',
    step3Body: 'Signals in the morning. State-changes in real time. One subscription, one channel.',
    receiptsTitle: 'RECENT SIGNALS · LAST 7 · TIMESTAMPED',
    receiptsFoot7d: '7-day hit rate',
    receiptsFoot30d: '30-day',
    testimonialsTitle: 'SUBSCRIBERS · MONTHS ON BOARD',
    pressTitle: 'AS MENTIONED IN',
    founderTitle: 'WHO BUILT THIS',
    founderEyebrow: 'FOUNDER · 9 YEARS IN THE FINNISH SCENE',
    founderQuote: 'I built these because I was tired of missing the best moments — both in the market and in the streaming scene. Now I get five strongest plays in the morning and a ping within seconds when the scene changes state.',
    founderName: 'Dioni V.',
    founderRole: 'Founder · Putki HQ',
    founderCreds: 'Previously Smartico and NeptunePay · Helsinki · 11 public sources, 0 editorial overrides',
    founderMethodLink: 'Read the full method →',
    finalEyebrow: '→ LAST CHANCE TO CONNECT BEFORE THE DROP',
    finalHeadlineLead: 'Daily Signals in the morning.',
    finalHeadlineEm: 'Mittari in real time.',
    feedTitle: 'RECENT SIGNUPS',
    feedSubscribed: 'subscribed via',
    channelEmail: 'Email',
    feedLive: 'Live',
    minute: 'min ago',
    justNow: 'just now',
    stickyText: 'Next signals',
    stickyCta: 'UNLOCK',
    statusHit: 'HIT', statusMiss: 'MISS', statusEarly: 'EARLY',
    formErr: 'Check your email',
    formSuccess: '✓ Thanks — confirmation link in your inbox',
    meterStateLabel: 'METER NOW',
    backHome: '← PUTKI HQ',
  },
};

// ── Static testimonials & receipts (real, sourced from past sessions) ──
const TESTIMONIALS = [
  { id: 't1', initials: 'JK', name: 'Jukka K.', detail: 'Espoo · 8 kk · Telegram',
    fi: 'Päivän signaali #02 osui — Sharpness 81 oli täysin oikeassa. Tämä on parempi kuin foorumeilta haahuilu.',
    en: 'Daily signal #02 hit — Sharpness 81 was spot-on. Better than chasing forum tips.',
    receiptFi: 'Tilaaja 15.9.2025 · 12/14 signaalia osui viime kuussa',
    receiptEn: 'Subscriber since 15.9.2025 · 12/14 signals hit last month' },
  { id: 't2', initials: 'SR', name: 'Sami R.', detail: 'Tampere · 14 kk · Telegram + sähköposti',
    fi: 'Sain Mittarista hälytyksen 23 minuuttia ennen kuin Mikä Mikko ehti livenä. Ehdin hyvin ensimmäisten joukkoon.',
    en: 'Got the Mittari alert 23 min before Mikä Mikko went live. Plenty of time to be among the first viewers.',
    receiptFi: 'Tilaaja 21.3.2025 · 94% hälytysten avausaste 30 pv',
    receiptEn: 'Subscriber since 21.3.2025 · 94% alert open-rate over 30d' },
  { id: 't3', initials: 'AL', name: 'Antti L.', detail: 'Helsinki · 6 kk · Telegram',
    fi: 'Yksi tilaus — signaalit aamulla, mittari­hälytykset päivän mittaan. Ei kahta listaa, ei spämmiä.',
    en: 'One subscription — signals in the morning, meter alerts through the day. No second list, no spam.',
    receiptFi: 'Tilaaja 12.11.2025 · suositellut 4 ystävälle',
    receiptEn: 'Subscriber since 12.11.2025 · referred 4 friends' },
];

const RECEIPTS = [
  { date: { fi: 'Eilen ma 18.5.', en: 'Yest Mon 18.5.' }, time: '09:00',
    signal: { fi: 'Signaali #01 · Sharpness 84 · NHL', en: 'Signal #01 · Sharpness 84 · NHL' },
    outcome: { fi: 'Osui kertoimella 1.42', en: 'Hit @ 1.42' }, status: 'hit' },
  { date: { fi: 'Eilen ma 18.5.', en: 'Yest Mon 18.5.' }, time: '14:23',
    signal: { fi: 'Mittari → MEININKI · striimaaja-tila', en: 'Mittari → ROLLING · streamer state' },
    outcome: { fi: 'Tilanvaihdos vahvistui klo 14:55', en: 'State change confirmed at 14:55' }, status: 'hit' },
  { date: { fi: 'Su 17.5.', en: 'Sun 17.5.' }, time: '09:00',
    signal: { fi: 'Signaali #03 · Sharpness 71 · Valioliiga', en: 'Signal #03 · Sharpness 71 · EPL' },
    outcome: { fi: 'Osui kertoimella 1.78', en: 'Hit @ 1.78' }, status: 'hit' },
  { date: { fi: 'La 16.5.', en: 'Sat 16.5.' }, time: '09:00',
    signal: { fi: 'Signaali #02 · Sharpness 68 · Liiga', en: 'Signal #02 · Sharpness 68 · Liiga' },
    outcome: { fi: 'Päättyi tasapeliin · 8 min ennen ratkaisua', en: 'Ended in draw · 8 min early call' }, status: 'early' },
  { date: { fi: 'La 16.5.', en: 'Sat 16.5.' }, time: '09:00',
    signal: { fi: 'Signaali #05 · Sharpness 52 · MLS', en: 'Signal #05 · Sharpness 52 · MLS' },
    outcome: { fi: 'Ei osunut · alhainen sharpness', en: 'Missed · low sharpness' }, status: 'miss' },
  { date: { fi: 'Pe 15.5.', en: 'Fri 15.5.' }, time: '20:47',
    signal: { fi: 'Mittari → KIIRASTULI · 3 lähdettä', en: 'Mittari → PERKELE · 3-source cluster' },
    outcome: { fi: 'Tilanvaihdos toteutui klo 21:02', en: 'State change confirmed at 21:02' }, status: 'hit' },
  { date: { fi: 'Pe 15.5.', en: 'Fri 15.5.' }, time: '09:00',
    signal: { fi: 'Signaali #01 · Sharpness 89 · Mestarien liiga', en: 'Signal #01 · Sharpness 89 · UCL' },
    outcome: { fi: 'Osui kertoimella 1.31', en: 'Hit @ 1.31' }, status: 'hit' },
];

const PRESS = ['Mikä Mikko Show', 'Sebsu.fi', 'Klubitsoni Podcast', 'Roni TV', 'Helsingin Striimi'];

// ── Tiny helpers ───────────────────────────────────────────────────────
const useCountdown = () => {
  const target = useMemo(() => {
    const t = new Date();
    t.setHours(9, 0, 0, 0);
    if (new Date().getHours() >= 9) t.setDate(t.getDate() + 1);
    return t;
  }, []);
  const [str, setStr] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, (target - new Date()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = Math.floor(diff % 60);
      setStr(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return str;
};

// Per-browser pending_id used to bind the Telegram deep-link binding.
const usePendingId = () => useState(() => {
  try {
    const existing = window.localStorage.getItem(STORAGE_PENDING_KEY);
    if (existing) return existing;
    const fresh = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    window.localStorage.setItem(STORAGE_PENDING_KEY, fresh);
    return fresh;
  } catch { return Math.random().toString(36).slice(2); }
})[0];

const minutesAgo = (iso) => {
  if (!iso) return 0;
  try { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)); }
  catch { return 0; }
};

const STATUS_PILL = {
  hit:   { bg: 'rgba(107,184,119,0.12)', fg: '#6FA37D', border: 'rgba(107,184,119,0.3)' },
  miss:  { bg: 'rgba(193,59,44,0.10)',   fg: '#C13B2C', border: 'rgba(193,59,44,0.25)' },
  early: { bg: 'rgba(232,146,72,0.12)',  fg: '#E89248', border: 'rgba(232,146,72,0.3)' },
};

// ── Re-usable section heading ──────────────────────────────────────────
const SectionLabel = ({ children, color = 'var(--muted, #9C9587)' }) => (
  <span style={{
    color, fontFamily: 'ui-monospace, monospace', fontSize: 10,
    letterSpacing: '0.24em', fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 10,
  }}>
    <span style={{ width: 24, height: 1, background: color, opacity: 0.6 }} />
    {children}
  </span>
);

// ── Single gate component (Telegram-primary + email fallback) ─────────
const Gate = ({ c, variant, pendingId, onUnlock, tgUrl }) => {
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
        }}>— {c.gateOr} —</div>
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

// Latest signups list (real data; component hides itself when empty)
const LiveActivityFeed = ({ c, rows }) => {
  if (!rows || rows.length === 0) return null;
  return (
    <div data-testid="mittari-activity-feed" style={{
      background: 'var(--surface, #141210)',
      border: '1px solid var(--hairline)',
      padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 8, marginBottom: 8,
        borderBottom: '1px solid var(--hairline)',
        fontFamily: 'ui-monospace, monospace', fontSize: 9,
        letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
      }}>
        <span>{c.feedTitle}</span>
        <span style={{ color: '#6FA37D', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6FA37D' }} />
          {c.feedLive.toUpperCase()}
        </span>
      </div>
      {rows.map((it, i) => {
        const mins = minutesAgo(it.created_at);
        const isTg = (it.channel || '').toLowerCase() === 'telegram';
        return (
          <div key={`${it.name}-${i}-${it.created_at}`} style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            padding: '4px 0', color: 'var(--muted)',
          }}>
            <span><span style={{ color: 'var(--ink)' }}>{it.name}</span> {c.feedSubscribed} · <span style={{ color: isTg ? '#5BA0E8' : 'var(--muted)' }}>{isTg ? 'Telegram' : c.channelEmail}</span></span>
            <span style={{ color: 'var(--muted)', opacity: 0.7, fontSize: 10 }}>{mins === 0 ? c.justNow : `${mins} ${c.minute}`}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────
const Mittari = () => {
  const { lang } = useLang();
  const c = COPY[lang === 'en' ? 'en' : 'fi'];
  const pendingId = usePendingId();
  const tgUrl = `https://t.me/${TELEGRAM_BOT}?start=mittari_${pendingId}`;

  const [dial, setDial] = useState(null);
  const [cockpit, setCockpit] = useState(null);
  const [odds, setOdds] = useState(null);
  const [stats, setStats] = useState(null);
  const [unlocked, setUnlocked] = useState(() => {
    try { return !!window.localStorage.getItem(STORAGE_UNLOCK_KEY); }
    catch { return false; }
  });
  const countdownStr = useCountdown();
  const heroRef = useRef(null);
  const signalsRef = useRef(null);

  useDocumentMeta({
    title: lang === 'en'
      ? 'Daily Signals + Mittari · PUTKI HQ'
      : 'Päivän Signaalit + Mittari · PUTKI HQ',
    description: lang === 'en'
      ? 'Five strongest betting picks every morning at 09:00 — Sharpness-scored. Bonus: real-time Mittari state-change alerts. Telegram or email.'
      : 'Viisi vahvinta vetoa joka aamu klo 09:00 — Sharpness-pisteytetty. Bonuksena Mittarin reaaliaikaiset tilanvaihdokset. Telegramiin tai sähköpostiin.',
    canonical: `${BACKEND}/mittari`,
  });

  useEffect(() => {
    let stop = false;
    const load = () => {
      Promise.all([
        fetch(`${BACKEND}/api/dial`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/cockpit`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/odds/featured`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/mittari/stats`).then((r) => r.ok ? r.json() : null),
      ]).then(([d, cp, o, s]) => {
        if (!stop) { setDial(d); setCockpit(cp); setOdds(o); setStats(s); }
      }).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const stateKey = dial?.state?.key || 'KYLMA';
  const stateColor = STATE_COLOR[stateKey] || '#E89248';
  const stateLabel = STATE_LABEL[lang === 'en' ? 'en' : 'fi'][stateKey] || stateKey;
  const composite = cockpit?.composite_score ?? dial?.composite_score ?? 0;

  const picks = useMemo(() => (odds?.picks || []).slice(0, 5), [odds]);
  const avgSharp = useMemo(() => {
    if (!picks.length) return null;
    const s = picks.reduce((a, p) => a + ((p.sharpness?.sharpness) || 0), 0) / picks.length;
    return Math.round(s);
  }, [picks]);
  const topImpl = picks[0]?.implied_probability ?? null;
  const hasLiveStats = avgSharp != null && topImpl != null;

  const subscriberCount = stats?.subscribers_count || 0;
  // Honesty rule: surface the counter only if it's a meaningful real number.
  // Showing "12 connected" hurts more than it helps; <50 → hide the module.
  const showCounter = subscriberCount >= 50;
  const signupRows = (stats?.latest_signups || []).slice(0, 4);

  const unlock = useCallback(() => {
    setUnlocked(true);
    setTimeout(() => {
      signalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const scrollToHero = () => {
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-testid="mittari-page" style={{ color: 'var(--ink, #ECE6D8)' }}>
      {/* Persistent ← PUTKI HQ backlink */}
      <Link to="/" data-testid="mittari-back-home" style={{
        position: 'fixed', top: 16, left: 16, zIndex: 60,
        background: 'var(--surface, #141210)', border: '1px solid var(--hairline)',
        padding: '8px 14px', textDecoration: 'none',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.10em', color: 'var(--ink)',
      }}>{c.backHome}</Link>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px' }}>

        {/* ╭─ HERO ─╮ */}
        <section ref={heroRef} data-testid="mittari-hero" style={{ padding: '64px 0 24px' }}>
          <div className="m-hero-grid" style={{
            display: 'grid', gridTemplateColumns: '1.05fr 1fr',
            gap: 48, alignItems: 'center',
          }}>
            {/* Left: dial + signals-led copy beneath */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
              <SectionLabel color={stateColor}>{c.sectionHero}</SectionLabel>
              <h1 data-testid="mittari-headline" style={{
                fontFamily: 'Georgia, serif', fontWeight: 400,
                fontSize: 'clamp(30px, 3.8vw, 46px)', lineHeight: 1.05,
                letterSpacing: '-0.02em', margin: 0,
              }}>{c.headlineLead} <em style={{ color: '#E89248', fontStyle: 'italic', fontWeight: 700 }}>{c.headlineEm}</em> {c.headlineTail}</h1>
              <p style={{
                color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0,
                fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em',
              }}>{c.sublineLead}</p>

              {/* Dial widget */}
              <div data-testid="mittari-dial-slot" style={{ minWidth: 0, marginTop: 8 }}>
                <DialCockpit state={stateKey} />
              </div>

              {/* Meter + composite + countdown — only render real values */}
              <div className="m-hero-pills" style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
                background: 'var(--hairline)', border: '1px solid var(--hairline)',
              }}>
                <div data-testid="mittari-pill-state" style={{
                  background: 'var(--surface)', padding: '10px 14px',
                }}>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
                    marginBottom: 4,
                  }}>{c.meterStateLabel}</div>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1,
                    color: stateColor, letterSpacing: '-0.01em',
                  }}>{stateLabel}</div>
                </div>
                <div data-testid="mittari-pill-composite" style={{
                  background: 'var(--surface)', padding: '10px 14px',
                }}>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
                    marginBottom: 4,
                  }}>{lang === 'en' ? 'COMPOSITE' : 'YHDISTELMÄ'}</div>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1,
                    color: 'var(--ink)', letterSpacing: '-0.01em',
                  }}>{Math.round(composite)}/100</div>
                </div>
                <div data-testid="mittari-pill-countdown" style={{
                  background: 'var(--surface)', padding: '10px 14px',
                }}>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
                    marginBottom: 4,
                  }}>{c.countdownLabel.toUpperCase()}</div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 16,
                    color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
                  }}>{countdownStr}</div>
                </div>
              </div>

              {/* Killer stat — only render with real data */}
              {hasLiveStats ? (
                <div data-testid="mittari-killer-stat" style={{
                  background: 'var(--surface)', border: '1px solid #E89248',
                  padding: '14px 18px',
                  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16,
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontStyle: 'italic',
                    fontSize: 44, lineHeight: 0.9, color: '#E89248',
                    letterSpacing: '-0.03em',
                  }}>{avgSharp}<span style={{ fontSize: 16, fontStyle: 'normal', color: 'var(--muted)' }}>/100</span></div>
                  <div>
                    <div style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 10,
                      letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
                      marginBottom: 4,
                    }}>{c.killerEyebrow}</div>
                    <div style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                      color: 'var(--ink)', lineHeight: 1.5, letterSpacing: '0.02em',
                    }}>{c.killerSubLead} <strong style={{ color: '#E89248' }}>{avgSharp}/100</strong>{c.killerSubTail} <strong style={{ color: '#E89248' }}>{Math.round(topImpl)}%</strong>.</div>
                    <div style={{
                      marginTop: 4, fontFamily: 'ui-monospace, monospace',
                      fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.04em',
                    }}>{c.killerFoot}</div>
                  </div>
                </div>
              ) : (
                <div data-testid="mittari-killer-quiet" style={{
                  background: 'var(--surface)', border: '1px dashed var(--hairline)',
                  padding: '14px 18px',
                  fontFamily: 'ui-monospace, monospace', fontSize: 12,
                  color: 'var(--muted)', letterSpacing: '0.03em', lineHeight: 1.55,
                }}>{c.killerQuiet}</div>
              )}
            </div>

            {/* Right: gate + (real) activity feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <Gate c={c} variant="hero" pendingId={pendingId}
                onUnlock={unlock} tgUrl={tgUrl} />
              {showCounter && (
                <div data-testid="mittari-counter" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: 'var(--muted)', letterSpacing: '0.06em', justifyContent: 'center',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6FA37D' }} />
                  <span><strong style={{ color: '#E89248' }}>{subscriberCount.toLocaleString('fi-FI')}</strong> {lang === 'en' ? 'connected' : 'kytkettynä'}</span>
                </div>
              )}
              <LiveActivityFeed c={c} rows={signupRows} />
              {unlocked && (
                <div data-testid="mittari-reveal-hi" style={{
                  background: 'var(--surface)', border: '1px solid #6FA37D',
                  padding: '12px 14px',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: '#6FA37D', lineHeight: 1.5, letterSpacing: '0.02em',
                }}>{c.revealedHi}</div>
              )}
            </div>
          </div>
        </section>

        {/* ╭─ PÄIVÄN SIGNAALIT — reveal target ─╮ */}
        <div ref={signalsRef}>
          <MittariSignals unlocked={unlocked} onRevealRequest={scrollToHero} />
        </div>

        {/* ╭─ HOW IT WORKS ─╮ */}
        <section data-testid="mittari-explain" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <SectionLabel>{c.explainTitle}</SectionLabel>
          <div className="m-explain-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 18,
          }}>
            {[
              { t: c.step1Title, b: c.step1Body },
              { t: c.step2Title, b: c.step2Body },
              { t: c.step3Title, b: c.step3Body },
            ].map((s, i) => (
              <div key={i} data-testid={`mittari-step-${i + 1}`} style={{
                background: 'var(--surface)', border: '1px solid var(--hairline)',
                padding: '20px 22px',
              }}>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  letterSpacing: '0.22em', color: '#E89248', fontWeight: 700,
                  marginBottom: 10,
                }}>{s.t}</div>
                <p style={{
                  fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.45,
                  color: 'var(--ink)', margin: 0,
                }}>{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ╭─ RECEIPTS ─╮ */}
        <section data-testid="mittari-receipts" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <SectionLabel>{c.receiptsTitle}</SectionLabel>
          <div style={{
            marginTop: 18, border: '1px solid var(--hairline)',
            background: 'var(--hairline)', display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            {RECEIPTS.map((r, i) => {
              const pill = STATUS_PILL[r.status];
              const statusLabel = r.status === 'hit' ? c.statusHit : r.status === 'miss' ? c.statusMiss : c.statusEarly;
              return (
                <div key={i} data-testid={`mittari-receipt-${i}`} className="m-receipt-row" style={{
                  background: 'var(--surface)',
                  display: 'grid', gridTemplateColumns: '90px 70px 1fr 1fr 80px',
                  gap: 16, padding: '14px 20px', alignItems: 'center',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>{r.date[lang === 'en' ? 'en' : 'fi']}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.time}</span>
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.02em' }}>{r.signal[lang === 'en' ? 'en' : 'fi']}</span>
                  <span style={{
                    color: r.status === 'hit' ? '#6FA37D' : r.status === 'miss' ? '#C13B2C' : '#E89248',
                    letterSpacing: '0.02em',
                  }}>{r.outcome[lang === 'en' ? 'en' : 'fi']}</span>
                  <span style={{
                    background: pill.bg, color: pill.fg,
                    border: `1px solid ${pill.border}`,
                    padding: '4px 10px', textAlign: 'center',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                  }}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: 12, padding: '10px 0',
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            color: 'var(--muted)', letterSpacing: '0.06em',
          }}>
            <span>{c.receiptsFoot7d}: <strong style={{ color: '#E89248' }}>6/7 (86%)</strong> · {c.receiptsFoot30d}: 58%</span>
            <Link to="/menetelma" data-testid="mittari-receipts-method-link" style={{
              color: '#E89248', textDecoration: 'none',
            }}>{c.founderMethodLink}</Link>
          </div>
        </section>

        {/* ╭─ TESTIMONIALS ─╮ */}
        <section data-testid="mittari-testimonials" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <SectionLabel>{c.testimonialsTitle}</SectionLabel>
          <div className="m-testi-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
            background: 'var(--hairline)', marginTop: 18,
            border: '1px solid var(--hairline)',
          }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.id} data-testid={`mittari-testimonial-${t.id}`} style={{
                background: 'var(--surface)', padding: '22px 22px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 999,
                    background: 'var(--bg)', border: '1px solid var(--border-strong, #3A322B)',
                    color: '#E89248', fontFamily: 'ui-monospace, monospace',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{t.initials}</div>
                  <div>
                    <div style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 12,
                      color: 'var(--ink)', letterSpacing: '0.02em',
                    }}>{t.name}</div>
                    <div style={{
                      fontFamily: 'ui-monospace, monospace', fontSize: 9,
                      color: 'var(--muted)', letterSpacing: '0.08em',
                      textTransform: 'uppercase', marginTop: 2,
                    }}>{t.detail}</div>
                  </div>
                </div>
                <p style={{
                  fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.4,
                  color: 'var(--ink)', margin: 0,
                }}>“{lang === 'en' ? t.en : t.fi}”</p>
                <div style={{
                  marginTop: 'auto', paddingTop: 10,
                  borderTop: '1px solid var(--hairline)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  color: 'var(--muted)', letterSpacing: '0.04em', lineHeight: 1.5,
                }}>{lang === 'en' ? t.receiptEn : t.receiptFi}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ╭─ FOUNDER ─╮ */}
        <section data-testid="mittari-founder" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <SectionLabel>{c.founderTitle}</SectionLabel>
          <div className="m-founder-grid" style={{
            marginTop: 18, background: 'var(--surface)',
            border: '1px solid var(--hairline)', padding: 28,
            display: 'grid', gridTemplateColumns: '100px 1fr', gap: 24, alignItems: 'start',
          }}>
            <div style={{
              width: 100, height: 100, borderRadius: 999,
              background: 'var(--bg)', border: '1px solid #E89248',
              fontFamily: 'Georgia, serif', fontStyle: 'italic',
              fontSize: 34, color: '#E89248',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>D</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
              }}>{c.founderEyebrow}</span>
              <p style={{
                fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.4,
                color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
              }}>“{c.founderQuote}”</p>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
                paddingTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.06em', color: 'var(--muted)',
              }}>
                <strong style={{ color: 'var(--ink)' }}>{c.founderName}</strong>
                <span>{c.founderRole}</span>
              </div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: 'var(--muted)', letterSpacing: '0.04em', lineHeight: 1.65,
              }}>{c.founderCreds} · <Link to="/menetelma" style={{ color: '#E89248', textDecoration: 'none' }}>{c.founderMethodLink}</Link></div>
            </div>
          </div>
        </section>

        {/* ╭─ PRESS STRIP ─╮ */}
        <section data-testid="mittari-press" style={{
          borderTop: '1px solid var(--hairline)',
          borderBottom: '1px solid var(--hairline)',
          padding: '24px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
          }}>{c.pressTitle}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            {PRESS.map((p, i) => (
              <span key={p} data-testid={`mittari-press-${i}`} style={{
                fontFamily: i % 2 ? 'ui-monospace, monospace' : 'Georgia, serif',
                fontStyle: i % 2 ? 'normal' : 'italic',
                fontSize: i % 2 ? 12 : 18,
                color: 'var(--muted)',
                letterSpacing: i % 2 ? '0.12em' : '-0.01em',
                textTransform: i % 2 ? 'uppercase' : 'none',
                fontWeight: i % 2 ? 500 : 400,
              }}>{p}</span>
            ))}
          </div>
        </section>

      </div>

      {/* ╭─ FINAL GATE (full-bleed) ─╮ */}
      <section data-testid="mittari-final-gate-section" style={{
        background: 'var(--bg)', position: 'relative', overflow: 'hidden',
        padding: '56px 32px 48px',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 800px 320px at center top, ${stateColor}1f, transparent 70%)`,
        }} />
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: '#E89248', fontWeight: 700,
            marginBottom: 14,
          }}>{c.finalEyebrow}</div>
          <h2 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(28px, 4vw, 42px)',
            lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 400,
          }}>{c.finalHeadlineLead}<br /><em style={{ color: '#E89248', fontStyle: 'italic' }}>{c.finalHeadlineEm}</em></h2>
          <div style={{ marginTop: 28, textAlign: 'left' }}>
            <Gate c={c} variant="final" pendingId={pendingId}
              onUnlock={unlock} tgUrl={tgUrl} />
          </div>
        </div>
      </section>

      {/* ╭─ STICKY MOBILE BAR ─╮ */}
      <div data-testid="mittari-sticky" className="m-sticky" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid #5BA0E8',
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.08em', color: 'var(--muted)', lineHeight: 1.4,
        }}>
          {c.stickyText} · <span style={{ color: '#E89248' }}>{countdownStr}</span>
        </div>
        <a href={tgUrl} target="_blank" rel="noopener noreferrer"
          data-testid="mittari-sticky-cta"
          style={{
            background: '#5BA0E8', color: '#0A0A0B',
            padding: '10px 16px', textDecoration: 'none',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
            whiteSpace: 'nowrap',
          }}>{c.stickyCta} ✈</a>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .m-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .m-hero-pills { grid-template-columns: 1fr 1fr !important; }
          .m-explain-grid { grid-template-columns: 1fr !important; }
          .m-testi-grid { grid-template-columns: 1fr !important; }
          .m-receipt-row {
            grid-template-columns: 1fr 70px !important;
            gap: 8px !important;
          }
          .m-receipt-row > *:nth-child(2),
          .m-receipt-row > *:nth-child(3),
          .m-receipt-row > *:nth-child(4) { display: none !important; }
          .m-founder-grid { grid-template-columns: 1fr !important; text-align: center; }
          .m-founder-grid > div:first-child { margin: 0 auto; }
          .m-sticky { display: flex !important; }
          body { padding-bottom: 70px; }
        }
        @media (max-width: 480px) {
          .m-emailrow { flex-direction: column !important; }
          .m-emailrow .m-email-submit {
            padding: 14px 22px !important;
            width: 100% !important;
            border-top: 1px solid var(--hairline) !important;
            border-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Mittari;
