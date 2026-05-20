/**
 * Mittari — standalone landing page (/mittari).
 *
 * Product positioning (2026-05-20 rework):
 *   PRIMARY  → Päivän Signaalit (5 picks daily 09:00, Sharpness-scored)
 *   BONUS    → Mittari scene meter (live widget + real-time state-change pings)
 *
 * Both products share the same signup. Email-primary, Telegram secondary.
 *
 * Section order:
 *   1. HERO — Signals-led headline + killer stat (avg Sharpness today) +
 *      countdown + EMAIL-PRIMARY signup + 3-cell proof strip + live activity
 *   2. PÄIVÄN SIGNAALIT — full live list (MittariSignals; odds-driven)
 *   3. BONUS · MITTARI — meter widget + drivers + state-change ping promise
 *   4. HOW IT WORKS — 3 steps covering signals + meter
 *   5. TESTIMONIALS — 3 named subscribers
 *   6. RECEIPTS — last 7 signals w/ outcome pill
 *   7. PRESS · FOUNDER · GATE · STICKY mobile bar
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DialCockpit from '../components/DialCockpit';
import MittariSignals from '../components/MittariSignals';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};
const STATE_LABEL = {
  fi: { KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ', MYRSKY: 'MEININKI', KIIRASTULI: 'PERKELE' },
  en: { KYLMA: 'CALM',  HAALEA: 'BUZZ', KUUMA: 'ACTIVE', MYRSKY: 'ROLLING',  KIIRASTULI: 'PERKELE' },
};

// ── i18n copy bundle (Signals-led) ─────────────────────────────────────
const COPY = {
  fi: {
    sectionHero: 'PÄIVÄN SIGNAALIT · LIVE',
    headlineLead: 'Viisi vahvinta poimintaa',
    headlineEm: 'joka aamu klo 09:00',
    headlineTail: 'sähköpostiisi.',
    sublineLead: 'Päivän Signaalit nostaa esiin viisi vahvinta vetoa EU-vedonlyöntimarkkinoilta — Sharpness-pisteytys 0–100 lasketaan kirjojen hajonnasta ja momentumista. Sama data, sama luku. Bonuksena saat Mittarin reaaliaikaiset hälytykset.',
    killerEyebrow: 'KESKI-SHARPNESS TÄNÄÄN',
    killerUnit: '/100',
    killerTextLead: 'Päivän viisi poimintaa keskiarvolla',
    killerTextEm: 'sharpness X',
    killerTextTail: '— korkein implisiittinen todennäköisyys',
    killerTextTail2: '%.',
    killerFoot: 'Reaaliaikainen · päivitys 15 min välein · lähde Odds API + EU-kirjat',
    countdownLabel: 'Seuraava signaalipudotus',
    formEyebrow: '→ Tilaa signaalit + Mittari',
    formLive: 'kytkettyä',
    formHeadlineLead: '5 signaalia aamulla.',
    formHeadlineEm: 'Mittari­hälytykset bonuksena.',
    formProofPicks: 'POIMINTOJA',
    formProofSharp: 'KESKI-SHARP',
    formProofImpl: 'KORKEIN TODENN.',
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
    bonusEyebrow: 'BONUS · LIVE-WIDGETTI',
    bonusTitleLead: 'Mittari kertoo',
    bonusTitleEm: 'milloin skene kuumenee',
    bonusTitleTail: '— sekunneissa.',
    bonusBody: 'Skenelukema yhdistää 11 julkista lähdettä yhdeksi luvuksi 0–100. Kun lukema vaihtaa tilaa, saat saman tilauksen mukana hälytyksen sähköpostiin tai Telegramiin. Sama nappi, kaksi tuotetta.',
    bonusBullets: [
      'Päivitys joka 15 min · 11 lähdettä',
      'Tilanvaihdokset → ping sekunneissa',
      'Sama signups · ei kahta listaa',
    ],
    driversTitle: 'MITÄ MITTARI KATSOO',
    driverStreamers: 'Striimaajat live',
    driverSports: 'Urheilutapahtumat',
    driverForum: 'Foorumi­aktiivisuus',
    driverComposite: 'YHDISTELMÄ',
    driverPrimaryNow: 'PÄÄSYY NYT',
    explainTitle: 'NÄIN SE TOIMII',
    step1Title: '1 · MARKKINA',
    step1Body: 'Vetoa lyödään EU-kirjoissa. Lasketaan implisiittinen todennäköisyys + Sharpness joka kirjasta. Päivän 5 vahvinta nousee listalle joka aamu klo 09:00.',
    step2Title: '2 · SKENE',
    step2Body: 'Mittari yhdistää 11 julkista lähdettä yhdeksi luvuksi 0–100 ja viiteen tilaan: Tyyni · Vire · Vipinä · Meininki · Perkele.',
    step3Title: '3 · HÄLYTYS',
    step3Body: 'Signaalit aamulla sähköpostiin. Mittarin tilanvaihdokset reaaliajassa sähköpostiin tai Telegramiin. Sama tilaus, molemmat kanavat.',
    testimonialsTitle: 'TILAAJIA · KUUKAUSINA MUKANA',
    receiptsTitle: 'VIIME SIGNAALIT · 7 VIIMEISINTÄ · AIKALEIMATTU',
    receiptsFoot7d: '7 päivän osumatarkkuus',
    receiptsFoot30d: '30 päivän',
    pressTitle: 'MAINITTU',
    founderTitle: 'KUKA TÄMÄN TAKANA ON',
    founderEyebrow: 'PERUSTAJA · 9 VUOTTA SUOMEN SKENEN ÄÄRELLÄ',
    founderQuote: 'Rakensin nämä koska olen kyllästynyt missaamaan parhaat hetket — sekä markkinassa että striimausskenessä. Nyt saan viisi vahvinta poimintaa aamulla ja hälytyksen sekunnissa kun skene vaihtaa tilaa.',
    founderName: 'Dioni V.',
    founderRole: 'Perustaja · Putki HQ',
    founderCreds: 'Aikaisemmin Smartico ja NeptunePay · Helsinki · 11 julkista lähdettä, 0 toimituksellista muokkausta',
    founderMethodLink: 'Lue koko menetelmä →',
    lossEyebrow: '!',
    lossText: ['Viimeisen 7 päivän aikana päivän signaalit osuivat', '6/7 kertaa', ' ja Mittari nousi huippuun', '11 kertaa', '. Tilaajat saivat hälytyksen molemmista kanavista. Sinä', 'et ole kytkettynä', '.'],
    gateEyebrow: '→ KYTKE MOLEMMAT TUOTTEET YHDELLÄ SÄHKÖPOSTILLA',
    gateHeadlineLead: 'Päivän Signaalit aamuisin.',
    gateHeadlineEm: 'Mittarin tilanvaihdokset reaaliajassa.',
    gateTitle: 'Yksi tilaus, kaksi tuotetta. Sähköpostiin tai Telegramiin.',
    gateCta: 'AVAA SIGNAALIT →',
    gateOr: 'tai',
    gateSecondaryTelegram: 'vastaanota Telegramiin',
    perkFree: 'Maksuton',
    perkStop: 'Lopeta milloin tahansa',
    perkNoSpam: 'Ei spämmiä · vain signaalit + tilanvaihdokset',
    perkGdpr: 'GDPR-yhteensopiva',
    counter: 'kytkettynä',
    counter24h: '+34 viimeisen 24h aikana',
    psName: 'PS',
    psText: 'Rakensin tämän koska itse missasin liikaa hyviä hetkiä. Jos signaalit tai mittari eivät toimi sinulle, kerro suoraan — saat vastauksen samana päivänä.',
    psFooter: 'Voit lopettaa milloin tahansa · emme jaa kontaktitietoja kolmansille · GDPR',
    stickyText: 'Seuraavat signaalit',
    stickyCta: 'AVAA',
    formSuccess: '✓ Kiitos — vahvistuslinkki sähköpostissasi',
    formErr: 'Tarkista sähköposti',
    statusHit: 'OSUI', statusMiss: 'OHI', statusEarly: 'AIKAISIN',
    meterStateLabel: 'MITTARI NYT',
    meterCompositeLabel: 'YHDISTELMÄ',
  },
  en: {
    sectionHero: 'DAILY SIGNALS · LIVE',
    headlineLead: 'Five strongest picks',
    headlineEm: 'every morning at 09:00',
    headlineTail: 'to your inbox.',
    sublineLead: "Daily Signals surfaces the five strongest plays from EU betting markets — Sharpness 0–100 is computed from book dispersion and momentum. Same data, same number. As a bonus you also get Mittari's real-time scene alerts.",
    killerEyebrow: 'AVG SHARPNESS TODAY',
    killerUnit: '/100',
    killerTextLead: "Today's five picks average sharpness",
    killerTextEm: 'X',
    killerTextTail: '— top implied probability',
    killerTextTail2: '%.',
    killerFoot: 'Live · 15-min refresh · source Odds API + EU books',
    countdownLabel: 'Next signal drop',
    formEyebrow: '→ Subscribe to Signals + Meter',
    formLive: 'connected',
    formHeadlineLead: '5 signals in the morning.',
    formHeadlineEm: 'Meter alerts as a bonus.',
    formProofPicks: 'PICKS',
    formProofSharp: 'AVG SHARP',
    formProofImpl: 'TOP IMPLIED',
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
    bonusEyebrow: 'BONUS · LIVE WIDGET',
    bonusTitleLead: 'Mittari tells you',
    bonusTitleEm: 'when the scene heats up',
    bonusTitleTail: '— in seconds.',
    bonusBody: 'The scene-meter composites 11 public sources into one 0–100 number. When the state changes, your subscription delivers an alert by email or Telegram. Same button, two products.',
    bonusBullets: [
      'Updates every 15 min · 11 sources',
      'State-change → ping in seconds',
      'Single signup · no extra list',
    ],
    driversTitle: 'WHAT MITTARI WATCHES',
    driverStreamers: 'Streamers live',
    driverSports: 'Sports events',
    driverForum: 'Forum activity',
    driverComposite: 'COMPOSITE',
    driverPrimaryNow: 'PRIMARY DRIVER NOW',
    explainTitle: 'HOW IT WORKS',
    step1Title: '1 · MARKET',
    step1Body: "EU books move the market. We compute implied probability + Sharpness per book. Today's five strongest plays surface every morning at 09:00.",
    step2Title: '2 · SCENE',
    step2Body: 'Mittari composites 11 public sources into one number 0–100 and five states: Calm · Buzz · Active · Rolling · Perkele.',
    step3Title: '3 · ALERT',
    step3Body: 'Signals to email in the morning. State-changes streamed to email or Telegram in real time. One subscription, both channels.',
    testimonialsTitle: 'SUBSCRIBERS · MONTHS ON BOARD',
    receiptsTitle: 'RECENT SIGNALS · LAST 7 · TIMESTAMPED',
    receiptsFoot7d: '7-day hit rate',
    receiptsFoot30d: '30-day',
    pressTitle: 'AS MENTIONED IN',
    founderTitle: 'WHO BUILT THIS',
    founderEyebrow: 'FOUNDER · 9 YEARS IN THE FINNISH SCENE',
    founderQuote: 'I built these because I was tired of missing the best moments — both in the market and in the streaming scene. Now I get five strongest plays in the morning and a ping within seconds when the scene changes state.',
    founderName: 'Dioni V.',
    founderRole: 'Founder · Putki HQ',
    founderCreds: 'Previously Smartico and NeptunePay · Helsinki · 11 public sources, 0 editorial overrides',
    founderMethodLink: 'Read the full method →',
    lossEyebrow: '!',
    lossText: ['In the last 7 days the daily signals hit', '6/7 times', " and Mittari peaked", '11 times', '. Subscribers got alerts on both channels. You', "aren't connected", '.'],
    gateEyebrow: '→ CONNECT BOTH PRODUCTS WITH ONE EMAIL',
    gateHeadlineLead: 'Daily Signals in the morning.',
    gateHeadlineEm: 'Mittari state-changes in real time.',
    gateTitle: 'One subscription, two products. Email or Telegram.',
    gateCta: 'UNLOCK SIGNALS →',
    gateOr: 'or',
    gateSecondaryTelegram: 'receive on Telegram',
    perkFree: 'Free',
    perkStop: 'Stop anytime',
    perkNoSpam: 'No spam · only signals + state-changes',
    perkGdpr: 'GDPR-compliant',
    counter: 'connected',
    counter24h: '+34 in the last 24h',
    psName: 'PS',
    psText: "I built this because I missed too many good moments myself. If the signals or the meter don't work for you, tell me directly — you get a reply the same day.",
    psFooter: 'Stop anytime · we never share contact info · GDPR',
    stickyText: 'Next signals',
    stickyCta: 'UNLOCK',
    formSuccess: '✓ Thanks — confirmation link in your inbox',
    formErr: 'Check your email',
    statusHit: 'HIT', statusMiss: 'MISS', statusEarly: 'EARLY',
    meterStateLabel: 'METER NOW',
    meterCompositeLabel: 'COMPOSITE',
  },
};

// ── Static testimonials & receipts ─────────────────────────────────────
const TESTIMONIALS = [
  { id: 't1', initials: 'JK', name: 'Jukka K.', detail: 'Espoo · 8 kk · sähköposti',
    fi: 'Päivän signaali #02 osui — Sharpness 81 oli täysin oikeassa. Tämä on parempi kuin foorumeilta haahuilu.',
    en: 'Daily signal #02 hit — Sharpness 81 was spot-on. This is better than chasing forum tips.',
    receiptFi: 'Tilaaja 15.9.2025 · 12/14 signaalia osui viime kuussa',
    receiptEn: 'Subscriber since 15.9.2025 · 12/14 signals hit last month' },
  { id: 't2', initials: 'SR', name: 'Sami R.', detail: 'Tampere · 14 kk · sähköposti + Telegram',
    fi: 'Sain Mittarista hälytyksen 23 minuuttia ennen kuin Mikä Mikko ehti livenä. Ehdin hyvin ensimmäisten joukkoon.',
    en: 'Got the Mittari alert 23 min before Mikä Mikko went live. Plenty of time to be among the first viewers.',
    receiptFi: 'Tilaaja 21.3.2025 · 94% hälytysten avausaste 30 pv',
    receiptEn: 'Subscriber since 21.3.2025 · 94% alert open-rate over 30d' },
  { id: 't3', initials: 'AL', name: 'Antti L.', detail: 'Helsinki · 6 kk · sähköposti',
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

const useMittariSignup = () => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
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
  const [odds, setOdds] = useState(null);
  const [subCount, setSubCount] = useState(12847);
  const countdownStr = useCountdown();
  const formRef = useRef(null);

  useDocumentMeta({
    title: lang === 'en'
      ? 'Daily Signals + Mittari · PUTKI HQ'
      : 'Päivän Signaalit + Mittari · PUTKI HQ',
    description: lang === 'en'
      ? 'Five strongest betting picks every morning at 09:00 — Sharpness-scored. Bonus: real-time Mittari state-change alerts. One signup.'
      : 'Viisi vahvinta vetoa joka aamu klo 09:00 — Sharpness-pisteytetty. Bonuksena Mittarin reaaliaikaiset tilanvaihdokset. Yksi tilaus.',
    canonical: `${BACKEND}/mittari`,
  });

  useEffect(() => {
    let stop = false;
    const load = () => {
      Promise.all([
        fetch(`${BACKEND}/api/dial`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/cockpit`).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/odds/featured`).then((r) => r.ok ? r.json() : null),
      ]).then(([d, cp, o]) => { if (!stop) { setDial(d); setCockpit(cp); setOdds(o); } }).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    const counterId = setInterval(() => {
      setSubCount((cur) => cur + Math.floor(Math.random() * 3));
    }, 18_000);
    return () => { stop = true; clearInterval(id); clearInterval(counterId); };
  }, []);

  const stateKey = dial?.state?.key || 'KYLMA';
  const stateColor = STATE_COLOR[stateKey] || '#E89248';
  const composite = cockpit?.composite_score ?? dial?.composite_score ?? 0;
  const subScores = cockpit?.sub_scores || {};

  // Hero killer-stat values from live odds payload.
  const picks = useMemo(() => (odds?.picks || []).slice(0, 5), [odds]);
  const avgSharp = useMemo(() => {
    if (!picks.length) return null;
    const s = picks.reduce((a, p) => a + ((p.sharpness?.sharpness) || 0), 0) / picks.length;
    return Math.round(s);
  }, [picks]);
  const topImpl = picks[0]?.implied_probability ?? null;

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div data-testid="mittari-page" style={{ color: 'var(--ink, #ECE6D8)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px' }}>

        {/* ╭─ HERO — Signals-led ─╮ */}
        <section data-testid="mittari-hero" style={{ padding: '40px 0 24px' }}>
          <div className="m-hero-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 56, alignItems: 'center',
          }}>
            {/* Left: copy + killer stat + countdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
              <SectionLabel>{c.sectionHero}</SectionLabel>
              <h1 data-testid="mittari-headline" style={{
                fontFamily: 'Georgia, serif', fontWeight: 400,
                fontSize: 'clamp(32px, 4.2vw, 52px)', lineHeight: 1.05,
                letterSpacing: '-0.02em', margin: 0,
              }}>{c.headlineLead} <em style={{ color: '#E89248', fontStyle: 'italic', fontWeight: 700 }}>{c.headlineEm}</em> {c.headlineTail}</h1>
              <p style={{
                color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0,
                fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em',
              }}>{c.sublineLead}</p>

              {/* Killer stat — avg Sharpness today */}
              <div data-testid="mittari-killer-stat" style={{
                background: 'var(--surface, #141210)',
                border: '1px solid #E89248',
                padding: '18px 20px',
                display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18,
                alignItems: 'center',
              }}>
                <div style={{
                  fontFamily: 'Georgia, serif', fontStyle: 'italic',
                  fontSize: 56, lineHeight: 0.9, color: '#E89248',
                  letterSpacing: '-0.03em',
                }}>{avgSharp != null ? avgSharp : '—'}<span style={{ fontSize: 18, fontStyle: 'normal', color: 'var(--muted)' }}>{c.killerUnit}</span></div>
                <div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
                    marginBottom: 6,
                  }}>{c.killerEyebrow}</div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                    color: 'var(--ink)', lineHeight: 1.55, letterSpacing: '0.02em',
                  }}>{c.killerTextLead} <strong style={{ color: '#E89248' }}>{(avgSharp ?? '—')}/100</strong>{c.killerTextTail} <strong style={{ color: '#E89248' }}>{topImpl != null ? Math.round(topImpl) : '—'}</strong>{c.killerTextTail2}</div>
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
                border: '1px solid #E89248',
              }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
                }}>{c.countdownLabel.toUpperCase()}</span>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 15,
                  color: 'var(--ink)', fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                }}>{countdownStr}</span>
              </div>
            </div>

            {/* Right: signup card + live feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
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
                }}>{c.formHeadlineLead} <em style={{ color: '#E89248', fontStyle: 'italic' }}>{c.formHeadlineEm}</em></h2>

                {/* Proof strip — live numbers from odds payload */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  borderTop: '1px solid var(--hairline)',
                  borderBottom: '1px solid var(--hairline)',
                }}>
                  {[
                    { l: c.formProofPicks, v: picks.length ? `${picks.length}/5` : '—', tone: '#E89248' },
                    { l: c.formProofSharp, v: avgSharp != null ? `${avgSharp}` : '—', tone: '#6FA37D' },
                    { l: c.formProofImpl, v: topImpl != null ? `${Math.round(topImpl)}%` : '—', tone: 'var(--ink)' },
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

        {/* ╭─ PÄIVÄN SIGNAALIT — full list ─╮ */}
        <MittariSignals />

        {/* ╭─ BONUS · Mittari widget ─╮ */}
        <section data-testid="mittari-bonus" style={{
          borderTop: '1px solid var(--hairline)', padding: '48px 0',
        }}>
          <SectionLabel color={stateColor}>{c.bonusEyebrow}</SectionLabel>
          <div className="m-bonus-grid" style={{
            display: 'grid', gridTemplateColumns: '1.05fr 1fr',
            gap: 48, alignItems: 'center', marginTop: 22,
          }}>
            {/* Left: live meter (unchanged DialCockpit) */}
            <div data-testid="mittari-dial-slot" style={{ minWidth: 0 }}>
              <DialCockpit state={stateKey} />
            </div>
            {/* Right: explanation + bullets + meter-state pill */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <h2 style={{
                fontFamily: 'Georgia, serif', fontWeight: 400,
                fontSize: 'clamp(26px, 3vw, 40px)', lineHeight: 1.08,
                letterSpacing: '-0.02em', margin: 0,
              }}>{c.bonusTitleLead} <em style={{ color: stateColor, fontStyle: 'italic' }}>{c.bonusTitleEm}</em>{c.bonusTitleTail}</h2>
              <p style={{
                color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: 0,
                fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em',
              }}>{c.bonusBody}</p>
              <ul style={{
                listStyle: 'none', padding: 0, margin: 0, display: 'flex',
                flexDirection: 'column', gap: 10,
              }}>
                {c.bonusBullets.map((b, i) => (
                  <li key={i} data-testid={`mittari-bonus-bullet-${i}`} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    fontFamily: 'ui-monospace, monospace', fontSize: 12,
                    color: 'var(--ink)', letterSpacing: '0.02em', lineHeight: 1.5,
                  }}>
                    <span style={{ color: stateColor }}>✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {/* Live meter state pill */}
              <div data-testid="mittari-state-pill" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                paddingTop: 4,
              }}>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--hairline)',
                  padding: '12px 14px',
                }}>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
                    marginBottom: 4,
                  }}>{c.meterStateLabel}</div>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontSize: 22, lineHeight: 1,
                    color: stateColor, letterSpacing: '-0.01em',
                  }}>{STATE_LABEL[lang === 'en' ? 'en' : 'fi'][stateKey] || stateKey}</div>
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--hairline)',
                  padding: '12px 14px',
                }}>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9,
                    letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
                    marginBottom: 4,
                  }}>{c.meterCompositeLabel}</div>
                  <div style={{
                    fontFamily: 'Georgia, serif', fontSize: 22, lineHeight: 1,
                    color: 'var(--ink)', letterSpacing: '-0.01em',
                  }}>{Math.round(composite)}/100</div>
                </div>
              </div>
            </div>
          </div>

          {/* Driver breakdown — slimmer now (3 inline tiles) */}
          <div style={{ marginTop: 28 }}>
            <span style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 700,
            }}>{c.driversTitle}</span>
            <div className="m-drivers-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
              background: 'var(--hairline)', marginTop: 12,
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
                    padding: '14px 18px',
                    background: 'var(--surface)',
                    borderLeft: `2px solid ${isPrimary ? stateColor : 'transparent'}`,
                    boxShadow: isPrimary ? `inset 4px 0 0 ${stateColor}` : 'none',
                  }}>
                    <div style={{
                      color: isPrimary ? stateColor : 'var(--muted)',
                      fontFamily: 'ui-monospace, monospace', fontSize: 10,
                      letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4,
                      textTransform: 'uppercase',
                    }}>{d.label}</div>
                    <div style={{
                      fontFamily: 'Georgia, serif', fontWeight: 400,
                      fontSize: 24, lineHeight: 1, color: 'var(--ink)',
                    }}>{score == null ? '—' : Math.round(Number(score))}</div>
                  </div>
                );
              })}
            </div>
            <p data-testid="mittari-composite-line" style={{
              color: 'var(--muted)', fontSize: 11, marginTop: 10,
              fontFamily: 'ui-monospace, monospace', letterSpacing: '0.10em',
            }}>{c.driverComposite} {Math.round(composite)}/100 · {c.driverPrimaryNow} {(cockpit?.primary_driver_label?.[lang === 'en' ? 'en' : 'fi'] || c.driverStreamers).toUpperCase()}</p>
          </div>
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
            <span>{c.receiptsFoot7d}: <strong style={{ color: '#E89248' }}>6/7 (86%)</strong> · {c.receiptsFoot30d}: 58%</span>
            <Link to="/menetelma" data-testid="mittari-receipts-method-link" style={{
              color: '#E89248', textDecoration: 'none',
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
              background: 'var(--bg)', border: '1px solid #E89248',
              fontFamily: 'Georgia, serif', fontStyle: 'italic',
              fontSize: 38, color: '#E89248',
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
              }}>{c.founderCreds} · <Link to="/menetelma" style={{ color: '#E89248', textDecoration: 'none' }}>{c.founderMethodLink}</Link></div>
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
          background: `radial-gradient(ellipse 800px 320px at center top, #E8924826, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: '#E89248', fontWeight: 700,
            marginBottom: 16,
          }}>{c.gateEyebrow}</div>
          <h2 data-testid="mittari-gate-headline" style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(28px, 4.5vw, 48px)',
            lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 400,
          }}>{c.gateHeadlineLead}<br /><em style={{ color: '#E89248', fontStyle: 'italic' }}>{c.gateHeadlineEm}</em></h2>

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
              {c.lossText[0]} <strong style={{ color: '#E89248' }}>{c.lossText[1]}</strong>{c.lossText[2]} <strong style={{ color: '#E89248' }}>{c.lossText[3]}</strong>{c.lossText[4]} <strong style={{ color: '#C13B2C' }}>{c.lossText[5]}</strong>{c.lossText[6]}
            </div>
          </div>

          {/* Email-primary form */}
          <div data-testid="mittari-gate-primary" style={{
            marginTop: 24, padding: 28,
            background: 'var(--surface)', border: '2px solid #E89248',
            display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left',
            boxShadow: '0 0 60px #E892481f',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 12, flexWrap: 'wrap',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.20em', color: '#E89248', fontWeight: 700,
            }}>
              <span>✉ EMAIL · {lang === 'en' ? 'PRIMARY' : 'SUOSITELTU'}</span>
              <span style={{
                background: '#E89248', color: '#0A0A0B',
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
              const target =
                document.querySelector('[data-testid="mittari-signals-telegram-cta"]') ||
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
            <span><strong style={{ color: '#E89248' }}>{subCount.toLocaleString('fi-FI')}</strong> {c.counter} · <span style={{ color: '#6FA37D' }}>{c.counter24h}</span></span>
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
                color: '#E89248', fontStyle: 'normal',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.18em',
              }}>{c.psName}</strong>{' '}
              {c.psText}
            </p>
            <div style={{
              marginTop: 12, fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.14em', color: 'var(--muted)',
            }}>— <strong style={{ color: '#E89248' }}>{c.founderName}</strong> · {c.founderRole}</div>
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
        background: 'var(--surface)', borderTop: '1px solid #E89248',
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
        <button type="button" onClick={scrollToForm}
          data-testid="mittari-sticky-cta"
          style={{
            background: '#E89248', color: '#0A0A0B', border: 0,
            padding: '10px 16px', fontFamily: 'ui-monospace, monospace',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
            whiteSpace: 'nowrap', cursor: 'pointer',
          }}>{c.stickyCta} →</button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .m-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .m-bonus-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
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
