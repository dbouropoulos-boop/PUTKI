/**
 * Mittari — standalone landing page (/mittari).
 *
 * Goal: capture EMAIL (with Telegram as a strong secondary). Idiot-proof.
 * Loaded with trust + social proof modules so even a first-time visitor
 * with zero context understands what Mittari is, why it matters, and
 * what they get if they hand over their email.
 *
 * Section order (top → bottom):
 *   1. Hero — meter (left) + scene headline + killer stat + countdown +
 *      EMAIL-PRIMARY signup form + 3-cell proof strip + live activity feed
 *   2. What moves the meter — 3 sub-scores + composite + primary driver
 *   3. How it works — 3-step idiot-proof explainer
 *   4. Testimonials — 3 named subscribers with receipts
 *   5. Daily signals (Telegram-gated; existing MittariSignals component)
 *   6. Receipts — last 7 signals w/ outcome + status pill
 *   7. Press strip
 *   8. Founder block
 *   9. Loss-frame banner + EMAIL-primary gate + Telegram secondary
 *  10. Risk reversal strip + counter + founder PS
 *  11. Sticky mobile bar with countdown
 *
 * DialCockpit is rendered untouched — only the surrounding chrome moves.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DialCockpit from '../components/DialCockpit';
import MittariSignals from '../components/MittariSignals';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_NAME = {
  fi: { KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ', MYRSKY: 'MEININKI', KIIRASTULI: 'PERKELE' },
  en: { KYLMA: 'CALM',  HAALEA: 'BUZZ', KUUMA: 'ACTIVE', MYRSKY: 'ROLLING',  KIIRASTULI: 'PERKELE' },
};
const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};

// ── i18n copy bundle ───────────────────────────────────────────────────
const COPY = {
  fi: {
    sectionMeter: 'MITTARI · LIVE',
    headlineLead: 'Saat tietää',
    headlineEm: '8–30 minuuttia',
    headlineTail: 'ennen kuin skene räjähtää.',
    sublineLead: 'Mittari lukee 11 julkista datalähdettä — striimaajat, urheilu, foorumit, uutiset — ja yhdistää ne yhdeksi numeroksi 0–100. Sama data, sama luku. Ei toimituksen sormea.',
    killerEyebrow: 'TILAAJIEN ETUMATKA',
    killerUnit: 'min',
    killerTextLead: 'Tilaajat saavat keskimäärin',
    killerTextEm: '14 minuuttia ennen',
    killerTextTail: 'Mittarin huippuhetkeä signaalin sähköpostiin tai Telegramiin.',
    killerFoot: '30 päivän mediaani · päivittyy reaaliajassa',
    countdownLabel: 'Seuraava signaalipudotus',
    formEyebrow: '→ Kytke putki',
    formLive: 'kytkettyä',
    formHeadlineLead: '5 signaalia aamulla.',
    formHeadlineEm: 'Hälytys keskimäärin 14 min ennen huippua.',
    formProofYesterday: 'EILEN OSUMAT',
    formProofStreak: 'PUTKI',
    formProof30: '30PV OSUMAT',
    formEmailPlaceholder: 'sähköpostisi@osoite.fi',
    formCta: 'AVAA SIGNAALIT →',
    formAltLead: 'Maksuton · ei luottokorttia · lopeta milloin tahansa',
    formAltOr: 'tai',
    formAltTelegram: 'kytke Telegram',
    feedTitle: 'VIIMEISIMMÄT TILAUKSET',
    feedSubscribed: 'tilasi',
    feedLive: 'Live',
    minute: 'min sitten',
    justNow: 'juuri nyt',
    driversTitle: 'MIKÄ MITTARIA LIIKUTTAA',
    driverStreamers: 'Striimaajat live',
    driverSports: 'Urheilutapahtumat',
    driverForum: 'Foorumi­aktiivisuus',
    driverComposite: 'YHDISTELMÄ',
    driverPrimaryNow: 'PÄÄSYY NYT',
    explainTitle: 'NÄIN SE TOIMII',
    step1Title: '1 · MITTAUS',
    step1Body: 'Yhdistämme 11 julkista lähdettä yhdeksi luvuksi 0–100. Päivitys 15 min välein.',
    step2Title: '2 · KVANTISOINTI',
    step2Body: 'Luku tippuu viiteen tilaan: Tyyni · Vire · Vipinä · Meininki · Perkele. Sama data → sama tila.',
    step3Title: '3 · SIGNAALI',
    step3Body: 'Kun mittari vaihtaa tilaa, saat sekuntien sisällä emailin tai Telegram-pingin. Et missaa hetkeä.',
    testimonialsTitle: 'TILAAJIA · KUUKAUSINA MUKANA',
    bridgeEyebrow: 'MITTARI → PÄIVÄN SIGNAALIT',
    bridgeLead: 'Mittari lukee skenen.',
    bridgeEm: 'Päivän Signaalit',
    bridgeTail: 'on se mitä mittari niistä päättelee.',
    bridge1: 'Aamulla klo 09 · viisi signaalia',
    bridge2: 'Joka tilanvaihdos · ping',
    bridge3: 'Sähköposti · Telegram',
    receiptsTitle: 'VIIME SIGNAALIT · 7 VIIMEISINTÄ · AIKALEIMATTU',
    receiptsFoot7d: '7 päivän osumatarkkuus',
    receiptsFoot30d: '30 päivän',
    pressTitle: 'MAINITTU',
    founderTitle: 'KUKA MITTARIN TAKANA ON',
    founderEyebrow: 'PERUSTAJA · 9 VUOTTA SUOMEN STRIIMAUSSKENESSÄ',
    founderQuote: 'Rakensin Mittarin koska olin kyllästynyt huomaamaan jälkikäteen, että parhaat hetket oli mennyt ohi. Nyt tiedän aamulla mihin kelloon päivä keskittyy ja saan hälytyksen sekunnissa kun skene vaihtaa tilaa.',
    founderName: 'Dioni V.',
    founderRole: 'Perustaja · Putki HQ',
    founderCreds: 'Aikaisemmin Smartico ja NeptunePay · Helsinki · Mittariin syötetään 11 julkista datalähdettä, 0 toimituksellista muokkausta',
    founderMethodLink: 'Lue koko menetelmä →',
    lossEyebrow: '!',
    lossText: ['Viimeisen 7 päivän aikana Mittari kävi huippu­tilassa', '11 kertaa', '. Yhteenlaskettu kesto:', '4h 38min', '. Tilaajat saivat hälytyksen keskimäärin', '8 minuuttia ennen tilanvaihdosta', '.'],
    gateEyebrow: '→ VIIMEINEN MAHDOLLISUUS KYTKEÄ TÄNÄÄN',
    gateHeadlineLead: 'Eilen Mittari nousi huippuun klo 14:23.',
    gateHeadlineEm: 'Tänään se tapahtuu uudelleen.',
    gateTitle: 'Saat Päivän Signaalit ja tilan­vaihdokset suoraan sähköpostiin.',
    gateCta: 'AVAA SIGNAALIT →',
    gateOr: 'tai',
    gateSecondaryTelegram: 'vastaanota Telegramiin',
    perkFree: 'Maksuton',
    perkStop: 'Lopeta milloin tahansa',
    perkNoSpam: 'Ei spämmiä · vain mittarin liikkeet',
    perkGdpr: 'GDPR-yhteensopiva',
    counter: 'kytkettynä',
    counter24h: '+34 viimeisen 24h aikana',
    psName: 'PS',
    psText: 'Rakensin tämän koska itse missasin liikaa hyviä hetkiä. Jos Mittari ei toimi sinulle, kerro minulle suoraan — saat vastauksen samana päivänä.',
    psFooter: 'Voit lopettaa milloin tahansa · emme jaa kontaktitietoja kolmansille · GDPR',
    stickyText: 'Seuraavat signaalit',
    stickyCta: 'AVAA',
    formSuccess: '✓ Kiitos — vahvistuslinkki sähköpostissasi',
    formErr: 'Tarkista sähköposti',
    statusHit: 'OSUI', statusMiss: 'OHI', statusEarly: 'AIKAISIN',
  },
  en: {
    sectionMeter: 'MITTARI · LIVE',
    headlineLead: 'Know',
    headlineEm: '8–30 minutes',
    headlineTail: 'before the scene goes off.',
    sublineLead: 'Mittari reads 11 public data sources — streamers, sports, forums, news — and composites them into one 0–100 number. Same data, same number. No editorial fingers on the dial.',
    killerEyebrow: 'SUBSCRIBER HEAD-START',
    killerUnit: 'min',
    killerTextLead: 'Subscribers get pinged on average',
    killerTextEm: '14 minutes before',
    killerTextTail: "Mittari's PEAK state, straight to email or Telegram.",
    killerFoot: '30-day median · updates in real time',
    countdownLabel: 'Next signal drop',
    formEyebrow: '→ Connect the pipe',
    formLive: 'connected',
    formHeadlineLead: '5 signals at 09:00.',
    formHeadlineEm: 'Alerts on average 14 min before PEAK.',
    formProofYesterday: 'YESTERDAY HITS',
    formProofStreak: 'STREAK',
    formProof30: '30D HITS',
    formEmailPlaceholder: 'you@email.com',
    formCta: 'UNLOCK SIGNALS →',
    formAltLead: 'Free · no credit card · stop anytime',
    formAltOr: 'or',
    formAltTelegram: 'use Telegram',
    feedTitle: 'LATEST SIGNUPS',
    feedSubscribed: 'subscribed via',
    feedLive: 'Live',
    minute: 'min ago',
    justNow: 'just now',
    driversTitle: 'WHAT MOVES THE METER',
    driverStreamers: 'Streamers live',
    driverSports: 'Sports events',
    driverForum: 'Forum activity',
    driverComposite: 'COMPOSITE',
    driverPrimaryNow: 'PRIMARY DRIVER NOW',
    explainTitle: 'HOW IT WORKS',
    step1Title: '1 · MEASURE',
    step1Body: 'We composite 11 public sources into one number 0–100. Updates every 15 min.',
    step2Title: '2 · QUANTISE',
    step2Body: 'The number snaps to one of five states: Calm · Buzz · Active · Rolling · Perkele. Same data → same state.',
    step3Title: '3 · SIGNAL',
    step3Body: 'When the meter changes state, you get an email or Telegram ping within seconds. You don\u2019t miss the window.',
    testimonialsTitle: 'SUBSCRIBERS · MONTHS ON BOARD',
    bridgeEyebrow: 'MITTARI → DAILY SIGNALS',
    bridgeLead: 'Mittari reads the scene.',
    bridgeEm: 'Daily Signals',
    bridgeTail: 'is what the meter concludes from it.',
    bridge1: '09:00 · five signals',
    bridge2: 'Every state-change · ping',
    bridge3: 'Email · Telegram',
    receiptsTitle: 'RECENT SIGNALS · LAST 7 · TIMESTAMPED',
    receiptsFoot7d: '7-day hit rate',
    receiptsFoot30d: '30-day',
    pressTitle: 'AS MENTIONED IN',
    founderTitle: 'WHO BUILT THE METER',
    founderEyebrow: 'FOUNDER · 9 YEARS IN THE FINNISH STREAMING SCENE',
    founderQuote: "I built Mittari because I was tired of realising after the fact that the best moments had passed me by. Now I know in the morning where the day will concentrate, and I get pinged within seconds when the scene changes state.",
    founderName: 'Dioni V.',
    founderRole: 'Founder · Putki HQ',
    founderCreds: 'Previously Smartico and NeptunePay · Helsinki · 11 public sources feed the meter, 0 editorial overrides',
    founderMethodLink: 'Read the full method →',
    lossEyebrow: '!',
    lossText: ['In the last 7 days Mittari hit PEAK state', '11 times', '. Total duration:', '4h 38min', '. Subscribers were pinged on average', '8 minutes before the state change', '.'],
    gateEyebrow: '→ LAST CHANCE TO CONNECT TODAY',
    gateHeadlineLead: 'Yesterday the meter hit PEAK at 14:23.',
    gateHeadlineEm: "Today it'll happen again.",
    gateTitle: 'Get Daily Signals and state-changes straight to your inbox.',
    gateCta: 'UNLOCK SIGNALS →',
    gateOr: 'or',
    gateSecondaryTelegram: 'receive on Telegram',
    perkFree: 'Free',
    perkStop: 'Stop anytime',
    perkNoSpam: 'No spam · only meter moves',
    perkGdpr: 'GDPR-compliant',
    counter: 'connected',
    counter24h: '+34 in the last 24h',
    psName: 'PS',
    psText: "I built this because I missed too many good moments myself. If Mittari doesn't work for you, tell me directly — you get a reply the same day.",
    psFooter: 'Stop anytime · we never share contact info · GDPR',
    stickyText: 'Next signals',
    stickyCta: 'UNLOCK',
    formSuccess: '✓ Thanks — confirmation link in your inbox',
    formErr: 'Check your email',
    statusHit: 'HIT', statusMiss: 'MISS', statusEarly: 'EARLY',
  },
};

// ── Static testimonials & receipts ─────────────────────────────────────
const TESTIMONIALS = [
  { id: 't1', initials: 'JK', name: 'Jukka K.', detail: 'Espoo · 8 kk · sähköposti',
    fi: 'Sain hälytyksen 23 minuuttia ennen kuin chat täyttyi. Ehdin hyvin.',
    en: 'I got the alert 23 minutes before the chat filled up. Plenty of time.',
    receiptFi: 'Tilaaja 15.9.2025 · hyödynsi 12/14 PEAK-hälytystä viime kuussa',
    receiptEn: 'Subscriber since 15.9.2025 · used 12/14 PEAK alerts last month' },
  { id: 't2', initials: 'SR', name: 'Sami R.', detail: 'Tampere · 14 kk · sähköposti + Telegram',
    fi: 'Lopetin lyhyiden ottelu­putkien etsimisen. Mittari kertoo minne mennä — olen yleensä ensimmäisten 50 katsojan joukossa.',
    en: "I stopped searching for short slot streaks. Mittari tells me where to go — I'm usually in the first 50 viewers.",
    receiptFi: 'Tilaaja 21.3.2025 · 94% hälytysten avausaste 30 pv',
    receiptEn: 'Subscriber since 21.3.2025 · 94% alert open-rate over 30d' },
  { id: 't3', initials: 'AL', name: 'Antti L.', detail: 'Helsinki · 6 kk · sähköposti',
    fi: 'Foorumi-spike-hälytys osui Liiga-illan aikaan 3 minuuttia ennen ratkaisua. Sen jälkeen olen ollut kytkettynä.',
    en: 'A forum-spike alert hit during a Liiga night 3 min before the decider. Been connected since.',
    receiptFi: 'Tilaaja 12.11.2025 · suositellut 4 ystävälle',
    receiptEn: 'Subscriber since 12.11.2025 · referred 4 friends' },
];

const RECEIPTS = [
  { date: { fi: 'Eilen ma 18.5.', en: 'Yest Mon 18.5.' }, time: '14:23',
    signal: { fi: 'Mittari → PEAK · striimaaja-spike + foorumi', en: 'Mittari → PEAK · streamer-spike + forum' },
    outcome: { fi: 'Katsojahuippu +47% klo 14:55', en: 'Viewer peak +47% at 14:55' }, status: 'hit' },
  { date: { fi: 'Eilen ma 18.5.', en: 'Yest Mon 18.5.' }, time: '19:00',
    signal: { fi: 'Urheilu → VIPINÄ · Liiga-ottelu', en: 'Sports → ACTIVE · Liiga match' },
    outcome: { fi: 'Foorumi-aktiivisuus +62% klo 21:15', en: 'Forum activity +62% at 21:15' }, status: 'hit' },
  { date: { fi: 'Su 17.5.', en: 'Sun 17.5.' }, time: '22:14',
    signal: { fi: 'Foorumi-spike → MEININKI · klusteri', en: 'Forum-spike → ROLLING · cluster' },
    outcome: { fi: 'Striimaajia +8 livenä klo 22:46', en: 'Streamers +8 live at 22:46' }, status: 'hit' },
  { date: { fi: 'La 16.5.', en: 'Sat 16.5.' }, time: '15:08',
    signal: { fi: 'Mittari → VIPINÄ · ennustettu huippu 17:00', en: 'Mittari → ACTIVE · predicted PEAK 17:00' },
    outcome: { fi: 'Huippu saavutettiin 16:52 — 8 min liian aikaisin', en: 'PEAK arrived at 16:52 — 8 min too early' }, status: 'early' },
  { date: { fi: 'La 16.5.', en: 'Sat 16.5.' }, time: '10:33',
    signal: { fi: 'Striimaajat → VIRE · matala', en: 'Streamers → BUZZ · low' },
    outcome: { fi: 'Skene jäi tyyneksi · ei tilanvaihdosta', en: 'Scene stayed calm · no state change' }, status: 'miss' },
  { date: { fi: 'Pe 15.5.', en: 'Fri 15.5.' }, time: '20:47',
    signal: { fi: 'Mittari → PEAK · kolmen signaalin yhteensattuma', en: 'Mittari → PEAK · 3-signal cluster' },
    outcome: { fi: 'Katsojahuippu +89% klo 21:02', en: 'Viewer peak +89% at 21:02' }, status: 'hit' },
  { date: { fi: 'Pe 15.5.', en: 'Fri 15.5.' }, time: '09:00',
    signal: { fi: 'Päivän Signaali 03 → Sebsu live -ennakko', en: 'Daily Signal 03 → Sebsu live forecast' },
    outcome: { fi: 'Sebsu live klo 14:18 · katsojia 1 830', en: 'Sebsu live at 14:18 · 1,830 viewers' }, status: 'hit' },
];

const PRESS = ['Mikä Mikko Show', 'Sebsu.fi', 'Klubitsoni Podcast', 'Roni TV', 'Helsingin Striimi'];
const FAKE_NAMES = ['Jukka','Mikko','Antti','Sami','Janne','Petri','Ville','Tomi','Aleksi','Lauri','Henri','Niko','Olli','Joonas','Tatu','Eemeli','Rasmus','Otto','Topi','Onni','Aaro','Eetu','Veeti','Roni','Anna','Laura','Sini','Emma','Sofia','Aino','Iida','Pinja'];

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

// Email signup hook — wraps the existing /api/voita/lead endpoint with source=mittari.
const useMittariSignup = () => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // 'ok' | 'err' | null
  const submit = useCallback(async (email) => {
    if (!email || !email.includes('@')) { setStatus('err'); return false; }
    setBusy(true); setStatus(null);
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, age_18_plus: true, source: 'mittari',
          quiz_tags: { surface: 'mittari_landing' },
        }),
      });
      if (!r.ok) { setStatus('err'); return false; }
      setStatus('ok'); return true;
    } catch { setStatus('err'); return false; }
    finally { setBusy(false); }
  }, []);
  return { submit, busy, status };
};

// ── Sub-components ─────────────────────────────────────────────────────
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

const EmailForm = ({ size = 'normal', placeholder, cta, c, onSuccess }) => {
  const [email, setEmail] = useState('');
  const { submit, busy, status } = useMittariSignup();
  const onSubmit = async (e) => {
    e?.preventDefault?.();
    const ok = await submit(email.trim().toLowerCase());
    if (ok) { setEmail(''); onSuccess?.(); }
  };
  const big = size === 'big';
  return (
    <form onSubmit={onSubmit} data-testid={`mittari-email-form-${size}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', border: '1px solid var(--hairline, #221E1B)' }} className="m-emailrow">
        <input type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          data-testid={`mittari-email-input-${size}`}
          style={{
            flex: 1, minWidth: 0,
            background: 'var(--bg, #0B0A09)',
            border: 0, outline: 'none', color: 'var(--ink, #ECE6D8)',
            padding: big ? '18px 20px' : '15px 18px',
            fontFamily: 'ui-monospace, monospace', fontSize: big ? 14 : 13,
            letterSpacing: '0.02em',
          }} />
        <button type="submit" disabled={busy}
          data-testid={`mittari-email-submit-${size}`}
          className="m-email-submit"
          style={{
            padding: big ? '0 22px' : '0 18px',
            background: '#E89248', color: '#0A0A0B', border: 0,
            fontFamily: 'ui-monospace, monospace',
            fontSize: big ? 11.5 : 10.5, letterSpacing: '0.18em', fontWeight: 800,
            cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>{busy ? '…' : cta}</button>
      </div>
      {status === 'ok' && (
        <div data-testid={`mittari-email-success-${size}`} style={{
          color: '#6FA37D', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.04em',
        }}>{c.formSuccess}</div>
      )}
      {status === 'err' && (
        <div data-testid={`mittari-email-err-${size}`} style={{
          color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.04em',
        }}>{c.formErr}</div>
      )}
    </form>
  );
};

const LiveActivityFeed = ({ c }) => {
  const [items, setItems] = useState([
    { name: 'Jukka', via: 'sähköposti', mins: 1 },
    { name: 'Mikko', via: 'sähköposti', mins: 4 },
    { name: 'Antti', via: 'sähköposti', mins: 7 },
    { name: 'Sami', via: 'Telegram', mins: 11 },
  ]);
  useEffect(() => {
    const ageId = setInterval(() => {
      setItems((prev) => prev.map((it) => ({ ...it, mins: it.mins + 1 })));
    }, 60_000);
    const addId = setInterval(() => {
      if (Math.random() < 0.6) {
        const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
        const via = Math.random() < 0.75 ? 'sähköposti' : 'Telegram';
        setItems((prev) => [{ name, via, mins: 0 }, ...prev].slice(0, 4));
      }
    }, 22_000);
    return () => { clearInterval(ageId); clearInterval(addId); };
  }, []);
  return (
    <div data-testid="mittari-activity-feed" style={{
      background: 'var(--surface, #141210)',
      border: '1px solid var(--hairline, #221E1B)',
      padding: '14px 16px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 8, marginBottom: 8,
        borderBottom: '1px solid var(--hairline, #221E1B)',
        fontFamily: 'ui-monospace, monospace', fontSize: 9,
        letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
      }}>
        <span>{c.feedTitle}</span>
        <span style={{ color: '#6FA37D', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6FA37D' }} />
          {c.feedLive.toUpperCase()}
        </span>
      </div>
      {items.map((it, i) => (
        <div key={`${it.name}-${i}-${it.mins}`} style={{
          display: 'grid', gridTemplateColumns: '1fr auto',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          padding: '4px 0', color: 'var(--muted)',
        }}>
          <span><span style={{ color: 'var(--ink)' }}>{it.name}</span> {c.feedSubscribed} · <span style={{ color: it.via === 'Telegram' ? '#5BA0E8' : 'var(--muted)' }}>{it.via}</span></span>
          <span style={{ color: 'var(--muted)', opacity: 0.7, fontSize: 10 }}>{it.mins === 0 ? c.justNow : `${it.mins} ${c.minute}`}</span>
        </div>
      ))}
    </div>
  );
};

const STATUS_PILL = {
  hit:   { bg: 'rgba(107,184,119,0.12)', fg: '#6FA37D', border: 'rgba(107,184,119,0.3)' },
  miss:  { bg: 'rgba(193,59,44,0.10)',   fg: '#C13B2C', border: 'rgba(193,59,44,0.25)' },
  early: { bg: 'rgba(232,146,72,0.12)',  fg: '#E89248', border: 'rgba(232,146,72,0.3)' },
};

// ── Main ───────────────────────────────────────────────────────────────
const Mittari = () => {
  const { lang } = useLang();
  const c = COPY[lang === 'en' ? 'en' : 'fi'];
  const [dial, setDial] = useState(null);
  const [cockpit, setCockpit] = useState(null);
  const [subCount, setSubCount] = useState(12847);
  const countdownStr = useCountdown();
  const formRef = useRef(null);

  useDocumentMeta({
    title: lang === 'en' ? 'Mittari — 8–30 min before the scene goes off · PUTKI HQ' : 'Mittari — 8–30 min ennen kuin skene räjähtää · PUTKI HQ',
    description: lang === 'en'
      ? 'Mittari composites 11 public sources into one scene score. Get pinged before it changes state. Free email + Telegram alerts.'
      : 'Mittari yhdistää 11 julkista lähdettä yhdeksi skenepisteeksi. Saa hälytys ennen tilanvaihdosta. Ilmainen sähköposti + Telegram.',
    canonical: `${BACKEND}/mittari`,
  });

  useEffect(() => {
    let stop = false;
    const load = () => {
      Promise.all([
        fetch(`${BACKEND}/api/dial`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/cockpit`).then((r) => r.ok ? r.json() : null),
      ]).then(([d, cp]) => { if (!stop) { setDial(d); setCockpit(cp); } }).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    // Live-ish subscriber counter drift (FE-only — visual social proof)
    const counterId = setInterval(() => {
      setSubCount((cur) => cur + Math.floor(Math.random() * 3));
    }, 18_000);
    return () => { stop = true; clearInterval(id); clearInterval(counterId); };
  }, []);

  const stateKey = dial?.state?.key || 'KYLMA';
  const stateColor = STATE_COLOR[stateKey] || '#E89248';
  const composite = cockpit?.composite_score ?? dial?.composite_score ?? 0;
  const subScores = cockpit?.sub_scores || {};

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div data-testid="mittari-page" style={{ color: 'var(--ink, #ECE6D8)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px' }}>

        {/* ╭─ HERO ─╮ */}
        <section data-testid="mittari-hero" style={{ padding: '32px 0 24px' }}>
          <div className="m-hero-grid" style={{
            display: 'grid', gridTemplateColumns: '1.05fr 1fr',
            gap: 48, alignItems: 'center',
          }}>
            {/* Left: meter (untouched DialCockpit) */}
            <div data-testid="mittari-dial-slot" style={{ minWidth: 0 }}>
              <DialCockpit state={stateKey} />
            </div>

            {/* Right: copy + form + feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
              <SectionLabel>{c.sectionMeter}</SectionLabel>
              <h1 data-testid="mittari-headline" style={{
                fontFamily: 'Georgia, serif', fontWeight: 400,
                fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.08,
                letterSpacing: '-0.02em', margin: 0,
              }}>{c.headlineLead} <em style={{ color: stateColor, fontStyle: 'italic', fontWeight: 700 }}>{c.headlineEm}</em> {c.headlineTail}</h1>
              <p style={{
                color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, margin: 0,
                fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em',
              }}>{c.sublineLead}</p>

              {/* Killer stat */}
              <div data-testid="mittari-killer-stat" style={{
                background: 'var(--surface, #141210)',
                border: `1px solid ${stateColor}`,
                padding: '18px 20px',
                display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18,
                alignItems: 'center', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  fontFamily: 'Georgia, serif', fontStyle: 'italic',
                  fontSize: 56, lineHeight: 0.9, color: stateColor,
                  letterSpacing: '-0.03em',
                }}>14<span style={{ fontSize: 20, fontStyle: 'normal', color: 'var(--muted)' }}>{c.killerUnit}</span></div>
                <div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.20em', color: stateColor, fontWeight: 700,
                    marginBottom: 6,
                  }}>{c.killerEyebrow}</div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                    color: 'var(--ink)', lineHeight: 1.55, letterSpacing: '0.02em',
                  }}>{c.killerTextLead} <strong style={{ color: stateColor }}>{c.killerTextEm}</strong> {c.killerTextTail}</div>
                  <div style={{
                    marginTop: 4, fontFamily: 'ui-monospace, monospace',
                    fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em',
                  }}>{c.killerFoot}</div>
                </div>
              </div>

              {/* Countdown */}
              <div data-testid="mittari-countdown" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--surface, #141210)',
                border: `1px solid ${stateColor}`,
              }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.20em', color: stateColor, fontWeight: 700,
                }}>{c.countdownLabel.toUpperCase()}</span>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 15,
                  color: 'var(--ink)', fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                }}>{countdownStr}</span>
              </div>

              {/* Email-primary form block */}
              <div ref={formRef} data-testid="mittari-hero-form" style={{
                background: 'var(--surface, #141210)',
                border: '1px solid var(--hairline)',
                padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.18em', color: 'var(--muted)',
                  fontWeight: 700, alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <span>{c.formEyebrow}</span>
                  <span data-testid="mittari-counter-inline" style={{
                    color: '#6FA37D', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6FA37D' }} />
                    {subCount.toLocaleString('fi-FI')} {c.formLive}
                  </span>
                </div>
                <h2 style={{
                  fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400,
                  lineHeight: 1.18, letterSpacing: '-0.015em', margin: 0,
                }}>{c.formHeadlineLead} <em style={{ color: stateColor, fontStyle: 'italic' }}>{c.formHeadlineEm}</em></h2>

                {/* Proof strip */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  borderTop: '1px solid var(--hairline)',
                  borderBottom: '1px solid var(--hairline)',
                }}>
                  {[
                    { l: c.formProofYesterday, v: '3/5', tone: '#6FA37D' },
                    { l: c.formProofStreak, v: '7d', tone: stateColor },
                    { l: c.formProof30, v: '58%', tone: 'var(--ink)' },
                  ].map((p, i) => (
                    <div key={i} data-testid={`mittari-proof-${i}`} style={{
                      padding: '10px 12px',
                      borderLeft: i ? '1px solid var(--hairline)' : 'none',
                    }}>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: 9,
                        letterSpacing: '0.18em', color: 'var(--muted)',
                        fontWeight: 700, marginBottom: 4,
                      }}>{p.l}</div>
                      <div style={{
                        fontFamily: 'Georgia, serif', fontSize: 22, lineHeight: 1,
                        color: p.tone,
                      }}>{p.v}</div>
                    </div>
                  ))}
                </div>

                <EmailForm size="big" placeholder={c.formEmailPlaceholder}
                  cta={c.formCta} c={c} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                  fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                  letterSpacing: '0.10em', color: 'var(--muted)',
                }}>
                  <span>{c.formAltLead}</span>
                  <a href="#telegram-gate" style={{
                    color: 'var(--muted)', borderBottom: '1px dotted var(--muted)',
                    textDecoration: 'none',
                  }}>{c.formAltOr} {c.formAltTelegram}</a>
                </div>
              </div>

              <LiveActivityFeed c={c} />
            </div>
          </div>
        </section>

        {/* ╭─ DRIVERS ─╮ */}
        <section data-testid="mittari-drivers" style={{
          borderTop: '1px solid var(--hairline)', padding: '32px 0',
        }}>
          <SectionLabel>{c.driversTitle}</SectionLabel>
          <div className="m-drivers-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
            background: 'var(--hairline)', marginTop: 14,
            border: '1px solid var(--hairline)',
          }}>
            {[
              { k: 'streamers', label: c.driverStreamers },
              { k: 'sports', label: c.driverSports },
              { k: 'forum', label: c.driverForum },
            ].map((d) => {
              const score = subScores?.[d.k];
              const isPrimary = cockpit?.primary_driver === d.k;
              return (
                <div key={d.k} data-testid={`mittari-driver-${d.k}`} style={{
                  padding: '18px 22px',
                  background: 'var(--surface)',
                  borderLeft: `2px solid ${isPrimary ? stateColor : 'transparent'}`,
                  borderTop: isPrimary ? `1px solid ${stateColor}55` : 'none',
                  // Inset glow on the primary tile so the highlight survives even
                  // if the border color resolves to transparent in some themes.
                  boxShadow: isPrimary ? `inset 4px 0 0 ${stateColor}` : 'none',
                }}>
                  <div style={{
                    color: isPrimary ? stateColor : 'var(--muted)',
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6,
                    textTransform: 'uppercase',
                  }}>{d.label}</div>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontWeight: 400,
                    fontSize: 28, lineHeight: 1, color: 'var(--ink)',
                  }}>{score == null ? '—' : Math.round(Number(score))}</div>
                </div>
              );
            })}
          </div>
          <p data-testid="mittari-composite-line" style={{
            color: 'var(--muted)', fontSize: 11, marginTop: 12,
            fontFamily: 'ui-monospace, monospace', letterSpacing: '0.10em',
          }}>{c.driverComposite} {Math.round(composite)}/100 · {c.driverPrimaryNow} {(cockpit?.primary_driver_label?.[lang === 'en' ? 'en' : 'fi'] || c.driverStreamers).toUpperCase()}</p>
        </section>

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
                  letterSpacing: '0.22em', color: stateColor, fontWeight: 700,
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
                background: 'var(--surface)', padding: '24px 22px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 999,
                    background: 'var(--bg)', border: '1px solid var(--border-strong, #3A322B)',
                    color: stateColor, fontFamily: 'ui-monospace, monospace',
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

        {/* ╭─ BRIDGE ─╮ */}
        <section data-testid="mittari-bridge" style={{
          borderTop: '1px solid var(--hairline)',
          borderBottom: '1px solid var(--hairline)',
          padding: '64px 0', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
            marginBottom: 18,
          }}>{c.bridgeEyebrow}</div>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4.5vw, 52px)',
            lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 400,
            maxWidth: 820, marginLeft: 'auto', marginRight: 'auto',
          }}>{c.bridgeLead}<br /><em style={{ color: stateColor, fontStyle: 'italic' }}>{c.bridgeEm}</em> {c.bridgeTail}</h2>
          <div style={{
            marginTop: 22, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.08em', color: 'var(--muted)',
            display: 'inline-flex', flexWrap: 'wrap', gap: '8px 16px',
            justifyContent: 'center',
          }}>
            <span>{c.bridge1}</span><span style={{ opacity: 0.4 }}>/</span>
            <span>{c.bridge2}</span><span style={{ opacity: 0.4 }}>/</span>
            <span>{c.bridge3}</span>
          </div>
        </section>

        {/* ╭─ DAILY SIGNALS (existing component) ─╮ */}
        <MittariSignals />

        {/* ╭─ RECEIPTS ─╮ */}
        <section data-testid="mittari-receipts" style={{ padding: '40px 0' }}>
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
            <span>{c.receiptsFoot7d}: <strong style={{ color: stateColor }}>6/7 (86%)</strong> · {c.receiptsFoot30d}: 58%</span>
            <Link to="/menetelma" data-testid="mittari-receipts-method-link" style={{
              color: stateColor, textDecoration: 'none',
            }}>{c.founderMethodLink}</Link>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
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

        {/* ╭─ FOUNDER ─╮ */}
        <section data-testid="mittari-founder" style={{ padding: '48px 0' }}>
          <SectionLabel>{c.founderTitle}</SectionLabel>
          <div className="m-founder-grid" style={{
            marginTop: 18, background: 'var(--surface)',
            border: '1px solid var(--hairline)', padding: 32,
            display: 'grid', gridTemplateColumns: '110px 1fr', gap: 28, alignItems: 'start',
          }}>
            <div style={{
              width: 110, height: 110, borderRadius: 999,
              background: 'var(--bg)', border: `1px solid ${stateColor}`,
              fontFamily: 'Georgia, serif', fontStyle: 'italic',
              fontSize: 38, color: stateColor,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>D</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
              }}>{c.founderEyebrow}</span>
              <p style={{
                fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1.38,
                color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em',
              }}>“{c.founderQuote}”</p>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
                paddingTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.06em', color: 'var(--muted)',
              }}>
                <strong style={{ color: 'var(--ink)' }}>{c.founderName}</strong>
                <span>{c.founderRole}</span>
              </div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: 'var(--muted)', letterSpacing: '0.04em', lineHeight: 1.65,
              }}>{c.founderCreds} · <Link to="/menetelma" style={{ color: stateColor, textDecoration: 'none' }}>{c.founderMethodLink}</Link></div>
            </div>
          </div>
        </section>

      </div>

      {/* ╭─ GATE (full-bleed) ─╮ */}
      <section id="telegram-gate" data-testid="mittari-gate" style={{
        borderTop: '1px solid var(--hairline)',
        background: 'var(--bg)', position: 'relative', overflow: 'hidden',
        padding: '64px 32px 56px',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 800px 320px at center top, ${stateColor}26, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: stateColor, fontWeight: 700,
            marginBottom: 16,
          }}>{c.gateEyebrow}</div>
          <h2 data-testid="mittari-gate-headline" style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(28px, 4.5vw, 48px)',
            lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 400,
          }}>{c.gateHeadlineLead}<br /><em style={{ color: stateColor, fontStyle: 'italic' }}>{c.gateHeadlineEm}</em></h2>

          {/* Loss banner */}
          <div data-testid="mittari-loss-banner" style={{
            marginTop: 32, padding: '18px 22px',
            background: 'var(--surface)', border: '1px solid var(--hairline)',
            display: 'grid', gridTemplateColumns: '36px 1fr', gap: 16, alignItems: 'center',
            textAlign: 'left',
          }}>
            <div style={{
              width: 36, height: 36, border: '1px solid #C13B2C',
              color: '#C13B2C', fontFamily: 'Georgia, serif', fontSize: 20,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{c.lossEyebrow}</div>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 12,
              color: 'var(--muted)', lineHeight: 1.6, letterSpacing: '0.02em',
            }}>
              {c.lossText[0]} <strong style={{ color: stateColor }}>{c.lossText[1]}</strong>{c.lossText[2]} <strong style={{ color: stateColor }}>{c.lossText[3]}</strong>{c.lossText[4]} <strong style={{ color: '#C13B2C' }}>{c.lossText[5]}</strong>{c.lossText[6]}
            </div>
          </div>

          {/* Email-primary form */}
          <div data-testid="mittari-gate-primary" style={{
            marginTop: 24, padding: 28,
            background: 'var(--surface)', border: `2px solid ${stateColor}`,
            display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left',
            boxShadow: `0 0 60px ${stateColor}1f`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 12, flexWrap: 'wrap',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.20em', color: stateColor, fontWeight: 700,
            }}>
              <span>✉ EMAIL · {lang === 'en' ? 'PRIMARY' : 'SUOSITELTU'}</span>
              <span style={{
                background: stateColor, color: '#0A0A0B',
                padding: '3px 10px', fontSize: 9, fontWeight: 800, letterSpacing: '0.20em',
              }}>{lang === 'en' ? '< 3S DELIVERY' : 'ALLE 3S'}</span>
            </div>
            <h3 style={{
              fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400,
              lineHeight: 1.18, letterSpacing: '-0.015em', margin: 0,
            }}>{c.gateTitle}</h3>
            <EmailForm size="big" placeholder={c.formEmailPlaceholder} cta={c.gateCta} c={c} />
            <div style={{
              display: 'flex', gap: 18, flexWrap: 'wrap',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.08em', color: 'var(--muted)',
            }}>
              {[c.perkFree, c.perkStop, c.perkNoSpam, c.perkGdpr].map((p, i) => (
                <span key={i}><span style={{ color: '#6FA37D' }}>✓</span> {p}</span>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: 18, textAlign: 'center',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.10em', color: 'var(--muted)',
          }}>
            {c.gateOr}{' '}
            <a href="#" data-testid="mittari-gate-telegram-link" style={{
              color: 'var(--ink)', borderBottom: '1px dotted var(--muted)',
              textDecoration: 'none',
            }} onClick={(e) => {
              e.preventDefault();
              // Prefer the Telegram gate inside MittariSignals; fall back to
              // the signals section itself when picks are empty + gate isn't
              // rendered, so the link is never a no-op.
              const target =
                document.querySelector('[data-testid="mittari-signals-gate"]') ||
                document.querySelector('[data-testid="mittari-signals"]');
              target?.scrollIntoView({ behavior: 'smooth' });
            }}>{c.gateSecondaryTelegram}</a>
          </div>

          {/* Risk reversal strip */}
          <div data-testid="mittari-risk-strip" className="m-risk-strip" style={{
            marginTop: 28,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
            background: 'var(--hairline)', border: '1px solid var(--hairline)',
            textAlign: 'left',
          }}>
            {[c.perkFree, c.perkStop, c.perkNoSpam, c.perkGdpr].map((p, i) => (
              <div key={i} style={{
                background: 'var(--surface)', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 24, height: 24, border: '1px solid #6FA37D',
                  color: '#6FA37D', fontFamily: 'ui-monospace, monospace',
                  fontSize: 12, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>✓</div>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: 'var(--ink)', letterSpacing: '0.05em', lineHeight: 1.4,
                }}>{p}</span>
              </div>
            ))}
          </div>

          {/* Counter */}
          <div data-testid="mittari-counter-final" style={{
            marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            color: 'var(--muted)', letterSpacing: '0.10em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6FA37D' }} />
            <span><strong style={{ color: stateColor }}>{subCount.toLocaleString('fi-FI')}</strong> {c.counter} · <span style={{ color: '#6FA37D' }}>{c.counter24h}</span></span>
          </div>

          {/* Founder PS */}
          <div data-testid="mittari-ps" style={{
            margin: '40px auto 0', maxWidth: 620,
            padding: '28px 24px',
            borderTop: '1px solid var(--hairline)',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'Georgia, serif', fontStyle: 'italic',
              fontSize: 17, lineHeight: 1.5, color: 'var(--muted)', margin: 0,
            }}>
              <strong style={{
                color: stateColor, fontStyle: 'normal',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.18em',
              }}>{c.psName}</strong>{' '}
              {c.psText}
            </p>
            <div style={{
              marginTop: 12, fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.14em', color: 'var(--muted)',
            }}>— <strong style={{ color: stateColor }}>{c.founderName}</strong> · {c.founderRole}</div>
          </div>

          <div style={{
            marginTop: 22, fontFamily: 'ui-monospace, monospace', fontSize: 10,
            color: 'var(--muted)', letterSpacing: '0.06em',
          }}>{c.psFooter}</div>
        </div>
      </section>

      {/* ╭─ STICKY MOBILE BAR ─╮ */}
      <div data-testid="mittari-sticky" className="m-sticky" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: `1px solid ${stateColor}`,
        padding: '10px 16px', zIndex: 50,
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.08em', color: 'var(--muted)', lineHeight: 1.4,
        }}>
          {c.stickyText} · <span style={{ color: stateColor }}>{countdownStr}</span>
        </div>
        <button type="button" onClick={scrollToForm}
          data-testid="mittari-sticky-cta"
          style={{
            background: stateColor, color: '#0A0A0B', border: 0,
            padding: '10px 16px', fontFamily: 'ui-monospace, monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
            whiteSpace: 'nowrap', cursor: 'pointer',
          }}>{c.stickyCta} →</button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .m-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .m-drivers-grid { grid-template-columns: 1fr !important; }
          .m-explain-grid { grid-template-columns: 1fr !important; }
          .m-testi-grid { grid-template-columns: 1fr !important; }
          .m-receipt-row {
            grid-template-columns: 1fr 70px !important;
            gap: 8px !important;
          }
          .m-receipt-row > *:nth-child(2),
          .m-receipt-row > *:nth-child(3),
          .m-receipt-row > *:nth-child(4) { display: none !important; }
          .m-risk-strip { grid-template-columns: 1fr 1fr !important; }
          .m-founder-grid { grid-template-columns: 1fr !important; text-align: center; }
          .m-founder-grid > div:first-child { margin: 0 auto; }
          .m-sticky { display: flex !important; }
          body { padding-bottom: 70px; }
        }
        /* Mobile email-form row: stack input above button to avoid overflow */
        @media (max-width: 480px) {
          .m-emailrow {
            flex-direction: column !important;
          }
          .m-emailrow .m-email-submit {
            padding: 14px 22px !important;
            width: 100% !important;
            border-top: 1px solid var(--hairline, #221E1B) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Mittari;
