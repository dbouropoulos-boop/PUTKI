/**
 * Mittari - standalone landing page (/mittari).
 *
 * ONE JOB: capture an email or Telegram contact. Two products, one capture:
 * the Signals (five morning picks) and the Meter (live widget + state-change
 * pings). Every section on this page exists to earn that capture.
 *
 * Telegram is the visually-dominant CTA in both gates (zero-typing, no
 * spam bounce, mobile-native for the gambling audience). Email is the
 * smaller fallback.
 *
 * Section order (single clean pass - no duplicates):
 *   1. HERO - dial (left) + Telegram-primary gate (right) + signals-led
 *      headline + killer stat
 *   2. PÄIVÄN SIGNAALIT - locked numbered list; row #01 unlocks instantly
 *      on gate submit (reveal mechanic)
 *   3. HOW IT WORKS - 3 steps
 *   4. RECEIPTS TABLE
 *   5. TESTIMONIALS
 *   6. FOUNDER
 *   7. PRESS STRIP
 *   8. FINAL GATE (Telegram-primary, same pattern)
 *   9. Footer with ← PUTKI HQ link + sticky mobile bar
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dial } from '../components/Dial';
import MittariSignals from '../components/MittariSignals';
import { MittariGate, STORAGE_UNLOCK_KEY } from '../components/MittariGate';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useLocalisedCanonical from '../hooks/useLocalisedCanonical';
import useMittariCopy from '../hooks/useMittariCopy';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TELEGRAM_BOT = 'Putkihq_bot';
const STORAGE_PENDING_KEY = 'putki_mittari_pending_id';

const STATE_COLOR = {
  KYLMA: '#5C8A8A', HAALEA: '#6FA37D', KUUMA: '#D4B445',
  MYRSKY: '#C97A3A', KIIRASTULI: '#C13B2C',
};
const STATE_LABEL = {
  fi: { KYLMA: 'TYYNI', HAALEA: 'VIRE', KUUMA: 'VIPINÄ', MYRSKY: 'MEININKI', KIIRASTULI: 'PERKELE' },
  en: { KYLMA: 'CALM',  HAALEA: 'BUZZ', KUUMA: 'ACTIVE', MYRSKY: 'ROLLING',  KIIRASTULI: 'PERKELE' },
};

// Plain-language description for each meter state - explains in 1 line what
// the dashboard reader is looking at, so the state label isn't naked jargon.
// Keeps copy promise: same data → same plain words, no editorial spin.
const STATE_DESC = {
  fi: {
    KYLMA:      'Markkina hiljainen. Vähän liikettä. Säästä aikasi tähän tilanteeseen.',
    HAALEA:     'Joitakin signaaleja heräilemässä. Vilkaisun arvoinen, ei vielä toimintaa.',
    KUUMA:      'Kirjat tiukentuvat, striimit aktiivisia. Vakaita vetoja tarjolla.',
    MYRSKY:     'Vahva skeneaktiviteetti. Vähintään 3 vetoa yli Sharpness 70 tänään.',
    KIIRASTULI: 'Monilähteinen piikki. Päivän huippu - toimi nyt tai missaat.',
  },
  en: {
    KYLMA:      'Market quiet. Little movement. Save your time for a hotter window.',
    HAALEA:     'A few signals stirring. Worth a glance, not yet a play.',
    KUUMA:      'Books tightening, streamers active. Solid plays on the board.',
    MYRSKY:     'Strong scene activity. ≥3 picks above Sharpness 70 today.',
    KIIRASTULI: 'Multi-source spike. Top of the day - act now or miss it.',
  },
};

// ── i18n copy ──────────────────────────────────────────────────────────
const COPY = {
  fi: {
    sectionHero: 'PÄIVÄN SIGNAALIT · LIVE',
    headlineLead: 'Viisi vahvinta poimintaa',
    headlineEm: 'joka aamu klo 09:00',
    headlineTail: 'suoraan Telegramiin tai sähköpostiin.',
    sublineLead: 'Sharpness-pisteytetty 0-100 EU-urheilukirjojen hinnoittelun hajonnasta ja momentumista. Sama data, sama luku - ei mielipiteitä, ei toimituksellisia muokkauksia. Bonuksena Mittarin reaaliaikaiset skenehälytykset.',
    killerEyebrow: 'KESKI-SHARPNESS TÄNÄÄN',
    killerSubLead: 'Päivän viisi poimintaa keskiarvolla',
    killerSubTail: '- korkein implisiittinen todennäköisyys',
    killerFoot: 'Live · 15 min päivitys · lähde Odds API + EU-urheilukirjat',
    killerQuiet: 'Markkina hiljainen juuri nyt - pudotus klo 09:00.',
    countdownLabel: 'Seuraava pudotus',
    gateTitleTop: '→ Kytke putki',
    gateLead: 'Avaa Telegramissa - yksi napsautus',
    gateOneTapInline: 'YKSI NAPSAUTUS',
    gateBadge: 'ALLE 3S TOIMITUS',
    gateBullets: [
      'Sidotaan yhdellä napsautuksella · ei sähköpostia, ei salasanaa',
      'Live-tilanvaihdokset mukana',
      'Lopeta milloin tahansa · ei spämmiä · GDPR',
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
    step1Body: 'EU-urheilukirjat liikuttavat markkinaa. Lasketaan implisiittinen todennäköisyys + Sharpness joka kirjasta. Päivän viisi vahvinta nousee listalle joka aamu klo 09:00.',
    step2Title: '2 · SKENE',
    step2Body: 'Mittari yhdistää 28 nimettyä lähdettä yli kuuden kategorian yhdeksi luvuksi 0-100 ja viiteen tilaan: Tyyni · Vire · Vipinä · Meininki · Perkele.',
    step3Title: '3 · TOIMITUS',
    step3Body: 'Telegramiin alle 3 sekunnissa. Sähköposti varalla. Sido kerran, ei toista listaa, ei spämmiä.',
    receiptsTitle: 'VIIME SIGNAALIT · 7 VIIMEISINTÄ · AIKALEIMATTU',
    receiptsFoot7d: '7 päivän osumatarkkuus',
    receiptsFoot30d: '30 päivän',
    testimonialsTitle: 'TILAAJIA · KUUKAUSINA MUKANA',
    pressTitle: 'MAINITTU',
    founderTitle: 'KUKA TÄMÄN TAKANA ON',
    founderEyebrow: 'PERUSTAJA · 9 VUOTTA SUOMEN SKENEN ÄÄRELLÄ',
    founderQuote: 'Rakensin nämä koska olen kyllästynyt missaamaan parhaat hetket - sekä markkinassa että striimausskenessä. Nyt saan viisi vahvinta poimintaa aamulla ja hälytyksen sekunnissa kun skene vaihtaa tilaa.',
    founderName: 'Eino K.',
    founderRole: 'Perustaja · Putki HQ',
    founderCreds: '9 vuotta skenen äärellä · Helsinki · 28 nimettyä lähdettä yli kuuden kategorian',
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
    formSuccess: '✓ Kiitos - vahvistuslinkki sähköpostissasi',
    meterStateLabel: 'MITTARI NYT',
    backHome: '← PUTKI HQ',
  },
  en: {
    sectionHero: 'DAILY SIGNALS · LIVE',
    headlineLead: 'Five strongest picks',
    headlineEm: 'every morning at 09:00',
    headlineTail: 'straight to Telegram or email.',
    sublineLead: 'Sharpness-scored 0-100 from EU sportsbook price dispersion + momentum. Same data, same number - no opinions, no editorial overrides. Bonus: real-time Mittari scene alerts.',
    killerEyebrow: 'AVG SHARPNESS TODAY',
    killerSubLead: 'Today\u2019s five picks average sharpness',
    killerSubTail: '- top implied probability',
    killerFoot: 'Live · 15-min refresh · source Odds API + EU sportsbooks',
    killerQuiet: 'Market quiet right now - next drop at 09:00.',
    countdownLabel: 'Next drop',
    gateTitleTop: '→ Connect the pipe',
    gateLead: 'Open in Telegram - one tap',
    gateOneTapInline: 'ONE TAP',
    gateBadge: '<3S DELIVERY',
    gateBullets: [
      'Bound in 1 tap · no email, no password',
      'Live state-change alerts included',
      'Stop anytime · no spam · GDPR',
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
    step1Body: 'EU sportsbooks move the market. We compute implied probability + Sharpness per book. Today\u2019s five strongest plays surface every morning at 09:00.',
    step2Title: '2 · SCENE',
    step2Body: 'Mittari composites 11 public sources into one number 0-100 and five states: Calm · Buzz · Active · Rolling · Perkele.',
    step3Title: '3 · DELIVERY',
    step3Body: 'Telegram in under 3 seconds. Email fallback. Bind once, no second list, no spam.',
    receiptsTitle: 'RECENT SIGNALS · LAST 7 · TIMESTAMPED',
    receiptsFoot7d: '7-day hit rate',
    receiptsFoot30d: '30-day',
    testimonialsTitle: 'SUBSCRIBERS · MONTHS ON BOARD',
    pressTitle: 'AS MENTIONED IN',
    founderTitle: 'WHO BUILT THIS',
    founderEyebrow: 'FOUNDER · 9 YEARS IN THE FINNISH SCENE',
    founderQuote: 'I built these because I was tired of missing the best moments - both in the market and in the streaming scene. Now I get five strongest plays in the morning and a ping within seconds when the scene changes state.',
    founderName: 'Eino K.',
    founderRole: 'Founder · Putki HQ',
    founderCreds: '9 years in the Finnish scene · Helsinki · 28 named sources across 6 categories',
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
    formSuccess: '✓ Thanks - confirmation link in your inbox',
    meterStateLabel: 'METER NOW',
    backHome: '← PUTKI HQ',
  },
};

// ── Static testimonials & receipts (hardcoded fallback for offline state).
// Shape mirrors the backend DEFAULT_MITTARI_COPY.testimonials.items so the
// JSX can use the same lookup pattern whether data comes from /api or here.
const TESTIMONIALS = [
  { id: 't1', initials: 'JK', name: 'Jukka K.',
    detail_fi: 'Espoo · 8 kk · Telegram', detail_en: 'Espoo · 8 mo · Telegram',
    quote_fi: 'Päivän signaali #02 osui - Sharpness 81 oli täysin oikeassa. Tämä on parempi kuin foorumeilta haahuilu.',
    quote_en: 'Daily signal #02 hit - Sharpness 81 was spot-on. Better than chasing forum tips.',
    receipt_fi: 'Tilaaja 15.9.2025 · 12/14 signaalia osui viime kuussa',
    receipt_en: 'Subscriber since 15.9.2025 · 12/14 signals hit last month' },
  { id: 't2', initials: 'SR', name: 'Sami R.',
    detail_fi: 'Tampere · 14 kk · Telegram + sähköposti', detail_en: 'Tampere · 14 mo · Telegram + email',
    quote_fi: 'Sain Mittarista hälytyksen 23 minuuttia ennen kuin Mikä Mikko ehti livenä. Ehdin hyvin ensimmäisten joukkoon.',
    quote_en: 'Got the Mittari alert 23 min before Mikä Mikko went live. Plenty of time to be among the first viewers.',
    receipt_fi: 'Tilaaja 21.3.2025 · 94% hälytysten avausaste 30 pv',
    receipt_en: 'Subscriber since 21.3.2025 · 94% alert open-rate over 30d' },
  { id: 't3', initials: 'AL', name: 'Antti L.',
    detail_fi: 'Helsinki · 6 kk · Telegram', detail_en: 'Helsinki · 6 mo · Telegram',
    quote_fi: 'Yksi tilaus - signaalit aamulla, mittarihälytykset päivän mittaan. Ei kahta listaa, ei spämmiä.',
    quote_en: 'One subscription - signals in the morning, meter alerts through the day. No second list, no spam.',
    receipt_fi: 'Tilaaja 12.11.2025 · suositellut 4 ystävälle',
    receipt_en: 'Subscriber since 12.11.2025 · referred 4 friends' },
];

const RECEIPTS = [
  { date_fi: 'Eilen ma 18.5.', date_en: 'Yest Mon 18.5.', time: '09:00',
    signal_fi: 'Signaali #01 · Sharpness 84 · NHL', signal_en: 'Signal #01 · Sharpness 84 · NHL',
    outcome_fi: 'Osui kertoimella 1.42', outcome_en: 'Hit @ 1.42', status: 'hit' },
  { date_fi: 'Eilen ma 18.5.', date_en: 'Yest Mon 18.5.', time: '14:23',
    signal_fi: 'Mittari → MEININKI · striimaaja-tila', signal_en: 'Mittari → ROLLING · streamer state',
    outcome_fi: 'Tilanvaihdos vahvistui klo 14:55', outcome_en: 'State change confirmed at 14:55', status: 'hit' },
  { date_fi: 'Su 17.5.', date_en: 'Sun 17.5.', time: '09:00',
    signal_fi: 'Signaali #03 · Sharpness 71 · Valioliiga', signal_en: 'Signal #03 · Sharpness 71 · EPL',
    outcome_fi: 'Osui kertoimella 1.78', outcome_en: 'Hit @ 1.78', status: 'hit' },
  { date_fi: 'La 16.5.', date_en: 'Sat 16.5.', time: '09:00',
    signal_fi: 'Signaali #02 · Sharpness 68 · Liiga', signal_en: 'Signal #02 · Sharpness 68 · Liiga',
    outcome_fi: 'Päättyi tasapeliin · 8 min ennen ratkaisua', outcome_en: 'Ended in draw · 8 min early call', status: 'early' },
  { date_fi: 'La 16.5.', date_en: 'Sat 16.5.', time: '09:00',
    signal_fi: 'Signaali #05 · Sharpness 52 · MLS', signal_en: 'Signal #05 · Sharpness 52 · MLS',
    outcome_fi: 'Ei osunut · alhainen sharpness', outcome_en: 'Missed · low sharpness', status: 'miss' },
  { date_fi: 'Pe 15.5.', date_en: 'Fri 15.5.', time: '20:47',
    signal_fi: 'Mittari → KIIRASTULI · 3 lähdettä', signal_en: 'Mittari → PERKELE · 3-source cluster',
    outcome_fi: 'Tilanvaihdos toteutui klo 21:02', outcome_en: 'State change confirmed at 21:02', status: 'hit' },
  { date_fi: 'Pe 15.5.', date_en: 'Fri 15.5.', time: '09:00',
    signal_fi: 'Signaali #01 · Sharpness 89 · Mestarien liiga', signal_en: 'Signal #01 · Sharpness 89 · UCL',
    outcome_fi: 'Osui kertoimella 1.31', outcome_en: 'Hit @ 1.31', status: 'hit' },
];

const PRESS = [
  { name: 'Mikä Mikko Show', url: '' },
  { name: 'Sebsu.fi', url: '' },
  { name: 'Klubitsoni Podcast', url: '' },
  { name: 'Roni TV', url: '' },
  { name: 'Helsingin Striimi', url: '' },
];

// ── Live-copy → flat c.X mapper (overlay on hardcoded COPY[lang]) ──────
// Every field on /mittari is editable via PUT /api/admin/mittari/copy.
// The backend deep-merges admin overrides onto DEFAULT_MITTARI_COPY; this
// helper translates that tree into the flat keys the JSX already uses,
// using the hardcoded COPY[lang] as the offline-fallback shape.
const buildCopy = (lang, live) => {
  const fb = COPY[lang === 'en' ? 'en' : 'fi'];
  if (!live) return fb;
  const L = lang === 'en' ? 'en' : 'fi';
  const hero = (live.hero && live.hero[L]) || {};
  const gate = (live.gate && live.gate[L]) || {};
  const sig = (live.signals && live.signals[L]) || {};
  const exp = (live.explain && live.explain[L]) || {};
  const rcp = live.receipts || {};
  const tst = live.testimonials || {};
  const fnd = live.founder || {};
  const prs = live.press || {};
  const fin = live.final_gate || {};
  const fd = live.feed || {};
  const stk = live.sticky || {};
  const bh = live.back_home || {};
  return {
    ...fb,
    sectionHero: hero.section_label ?? fb.sectionHero,
    pageTitleLead: hero.page_title_lead ?? (lang === 'en' ? '5 sharpest betting picks.' : '5 vahvinta vetovinkkiä.'),
    pageTitleEm: hero.page_title_em ?? (lang === 'en' ? 'Every morning at 09:00.' : 'Joka aamu klo 09:00.'),
    pageTitleTail: hero.page_title_tail ?? (lang === 'en' ? 'Free.' : 'Ilmaiseksi.'),
    pageSubtitle: hero.page_subtitle ?? (lang === 'en'
      ? 'Five EU-market picks, scored 0-100 (Sharpness - how tightly the bookmakers agree). The dial tracks Finland\u2019s betting scene live: when streamers + odds + news heat up, you get an alert. Telegram or email. One signup. GDPR. Stop anytime.'
      : 'Viisi vetoa EU-markkinoilta Sharpness-pisteytettynä (0-100 - kuinka tiiviisti kirjat ovat samaa mieltä). Mittari seuraa Suomen vedonlyöntiskeneä reaaliajassa: kun striimit + kertoimet + uutiset kuumenevat, saat hälytyksen. Telegram tai sähköposti. Yksi tilaus. GDPR. Lopeta milloin vain.'),
    signalsPairingLead: ((live.signals && live.signals[L]) || {}).pairing_lead ?? (lang === 'en' ? 'Two feeds.' : 'Kaksi syötettä.'),
    signalsPairingEm: ((live.signals && live.signals[L]) || {}).pairing_em ?? (lang === 'en' ? 'One signup.' : 'Yksi tilaus.'),
    signalsPairingTail: ((live.signals && live.signals[L]) || {}).pairing_tail ?? (lang === 'en' ? 'Telegram or email - your choice.' : 'Telegram tai sähköposti - sinun valintasi.'),
    headlineLead: hero.headline_lead ?? fb.headlineLead,
    headlineEm: hero.headline_em ?? fb.headlineEm,
    headlineTail: hero.headline_tail ?? fb.headlineTail,
    sublineLead: hero.subline ?? fb.sublineLead,
    killerEyebrow: hero.killer_eyebrow ?? fb.killerEyebrow,
    killerSubLead: hero.killer_sub_lead ?? fb.killerSubLead,
    killerSubTail: hero.killer_sub_tail ?? fb.killerSubTail,
    killerFoot: hero.killer_foot ?? fb.killerFoot,
    killerQuiet: hero.killer_quiet ?? fb.killerQuiet,
    countdownLabel: hero.countdown_label ?? fb.countdownLabel,
    meterStateLabel: hero.meter_state_label ?? fb.meterStateLabel,
    compositeLabel: hero.composite_label ?? (lang === 'en' ? 'COMPOSITE' : 'YHDISTELMÄ'),
    gateTitleTop: gate.title_top ?? fb.gateTitleTop,
    gateLead: gate.lead ?? fb.gateLead,
    gateOneTapInline: gate.one_tap_inline ?? fb.gateOneTapInline,
    gateBadge: gate.badge ?? fb.gateBadge,
    gateBullets: Array.isArray(gate.bullets) && gate.bullets.length ? gate.bullets : fb.gateBullets,
    gateTgCta: gate.tg_cta ?? fb.gateTgCta,
    gateTgSub: gate.tg_sub ?? fb.gateTgSub,
    gateOr: gate.or_email ?? fb.gateOr,
    gateEmailPlaceholder: gate.email_placeholder ?? fb.gateEmailPlaceholder,
    gateEmailCta: gate.email_cta ?? fb.gateEmailCta,
    gateFinePrint: gate.fine_print ?? fb.gateFinePrint,
    revealedHi: gate.revealed_hi ?? fb.revealedHi,
    formErr: gate.form_err ?? fb.formErr,
    formSuccess: gate.form_success ?? fb.formSuccess,
    explainTitle: exp.title ?? fb.explainTitle,
    step1Title: (exp.steps && exp.steps[0] && exp.steps[0].title) ?? fb.step1Title,
    step1Body:  (exp.steps && exp.steps[0] && exp.steps[0].body)  ?? fb.step1Body,
    step2Title: (exp.steps && exp.steps[1] && exp.steps[1].title) ?? fb.step2Title,
    step2Body:  (exp.steps && exp.steps[1] && exp.steps[1].body)  ?? fb.step2Body,
    step3Title: (exp.steps && exp.steps[2] && exp.steps[2].title) ?? fb.step3Title,
    step3Body:  (exp.steps && exp.steps[2] && exp.steps[2].body)  ?? fb.step3Body,
    receiptsTitle: (lang === 'en' ? rcp.title_en : rcp.title_fi) ?? fb.receiptsTitle,
    receiptsFoot7d: (lang === 'en' ? rcp.foot7d_en : rcp.foot7d_fi) ?? fb.receiptsFoot7d,
    receiptsFoot30d: (lang === 'en' ? rcp.foot30d_en : rcp.foot30d_fi) ?? fb.receiptsFoot30d,
    receiptsFoot7dValue: rcp.foot7d_value ?? '6/7 (86%)',
    receiptsFoot30dValue: rcp.foot30d_value ?? '58%',
    statusHit: (lang === 'en' ? rcp.status_hit_en : rcp.status_hit_fi) ?? fb.statusHit,
    statusMiss: (lang === 'en' ? rcp.status_miss_en : rcp.status_miss_fi) ?? fb.statusMiss,
    statusEarly: (lang === 'en' ? rcp.status_early_en : rcp.status_early_fi) ?? fb.statusEarly,
    testimonialsTitle: (lang === 'en' ? tst.title_en : tst.title_fi) ?? fb.testimonialsTitle,
    testimonialsConsent: (lang === 'en' ? tst.consent_line_en : tst.consent_line_fi)
      ?? (lang === 'en'
          ? 'Subscribers have given consent to publish their name and quote.'
          : 'Tilaajat ovat antaneet luvan nimen ja kommentin julkaisuun.'),
    founderTitle: (lang === 'en' ? fnd.title_en : fnd.title_fi) ?? fb.founderTitle,
    founderEyebrow: (lang === 'en' ? fnd.eyebrow_en : fnd.eyebrow_fi) ?? fb.founderEyebrow,
    founderQuote: (lang === 'en' ? fnd.quote_en : fnd.quote_fi) ?? fb.founderQuote,
    founderName: fnd.name ?? fb.founderName,
    founderRole: (lang === 'en' ? fnd.role_en : fnd.role_fi) ?? fb.founderRole,
    founderCreds: (lang === 'en' ? fnd.creds_en : fnd.creds_fi) ?? fb.founderCreds,
    founderPseudonym: (lang === 'en' ? fnd.pseudonym_disclosure_en : fnd.pseudonym_disclosure_fi)
      ?? (lang === 'en'
          ? '* PUTKI HQ editorial pseudonym, following Finnish column tradition. Team: /toimitus'
          : '* PUTKI HQ:n toimituksellinen pseudonyymi, suomalaisen kolumnitradition mukaisesti. Toimitus: /toimitus'),
    founderMethodLink: (lang === 'en' ? fnd.method_link_en : fnd.method_link_fi) ?? fb.founderMethodLink,
    founderAvatarInitial: fnd.avatar_initial ?? 'E',
    pressTitle: (lang === 'en' ? prs.title_en : prs.title_fi) ?? fb.pressTitle,
    finalEyebrow: (lang === 'en' ? fin.eyebrow_en : fin.eyebrow_fi) ?? fb.finalEyebrow,
    finalHeadlineLead: (lang === 'en' ? fin.headline_lead_en : fin.headline_lead_fi) ?? fb.finalHeadlineLead,
    finalHeadlineEm: (lang === 'en' ? fin.headline_em_en : fin.headline_em_fi) ?? fb.finalHeadlineEm,
    feedTitle: (lang === 'en' ? fd.title_en : fd.title_fi) ?? fb.feedTitle,
    feedSubscribed: (lang === 'en' ? fd.subscribed_en : fd.subscribed_fi) ?? fb.feedSubscribed,
    feedLive: (lang === 'en' ? fd.live_en : fd.live_fi) ?? fb.feedLive,
    minute: (lang === 'en' ? fd.minute_en : fd.minute_fi) ?? fb.minute,
    justNow: (lang === 'en' ? fd.just_now_en : fd.just_now_fi) ?? fb.justNow,
    channelEmail: (lang === 'en' ? fd.channel_email_en : fd.channel_email_fi) ?? fb.channelEmail,
    stickyText: (lang === 'en' ? stk.text_en : stk.text_fi) ?? fb.stickyText,
    stickyCta: (lang === 'en' ? stk.cta_en : stk.cta_fi) ?? fb.stickyCta,
    backHome: bh[L] ?? fb.backHome,
    _signalsCopy: sig,
  };
};

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
// Implementation lives in `components/MittariGate.jsx` so this page
// file stays focused on layout + state orchestration.

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
  const liveCopy = useMittariCopy();
  const c = useMemo(() => buildCopy(lang, liveCopy), [lang, liveCopy]);
  const pendingId = usePendingId();
  const tgUrl = `https://t.me/${TELEGRAM_BOT}?start=mittari_${pendingId}`;

  const [dial, setDial] = useState(null);
  const [cockpit, setCockpit] = useState(null);
  const [odds, setOdds] = useState(null);
  const [stats, setStats] = useState(null);
  // Admin detection - true iff the back-office token is set in
  // localStorage. Used to surface the discreet "EDIT FOUNDER ↗"
  // deep-link without leaking it to regular visitors.
  const [isAdmin] = useState(() => {
    try { return !!window.localStorage.getItem('putki_hq_admin_token'); }
    catch { return false; }
  });
  const [unlocked, setUnlocked] = useState(() => {
    try { return !!window.localStorage.getItem(STORAGE_UNLOCK_KEY); }
    catch { return false; }
  });
  const countdownStr = useCountdown();
  const heroRef = useRef(null);
  const signalsRef = useRef(null);
  const gateRef = useRef(null);

  // iter96 audit fix · canonical + hreflang. The page lives at /mittari
  // (FI canonical) — there is no dedicated /en/mittari route today, so
  // we still emit hreflang fi-FI/en-FI/x-default pointing at the same
  // canonical so social/search crawlers know FI is intentional.
  const { canonical, alternates } = useLocalisedCanonical({ fiPath: '/mittari', enPath: '/mittari' });
  useDocumentMeta({
    title: lang === 'en'
      ? 'Daily Signals + Mittari · PUTKI HQ'
      : 'Päivän Signaalit + Mittari · PUTKI HQ',
    description: lang === 'en'
      ? 'Five strongest betting picks every morning at 09:00 - Sharpness-scored. Bonus: real-time Mittari state-change alerts. Telegram or email.'
      : 'Viisi vahvinta vetoa joka aamu klo 09:00 - Sharpness-pisteytetty. Bonuksena Mittarin reaaliaikaiset tilanvaihdokset. Telegramiin tai sähköpostiin.',
    canonical,
    alternates,
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
  const stateDesc = STATE_DESC[lang === 'en' ? 'en' : 'fi'][stateKey] || '';
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
  // Drop placeholder/test signups so demo data never leaks into the feed.
  // The backend may surface dev rows like "Test subscriber" - hide any
  // row whose name starts with or contains the substring "test".
  const signupRows = ((stats?.latest_signups || []) || [])
    .filter((r) => {
      const n = (r?.name || '').trim().toLowerCase();
      return n && !n.includes('test');
    })
    .slice(0, 4);

  // Editable lists - fall back to hardcoded constants when the live tree
  // hasn't loaded yet (or returns empty arrays).
  const testimonialsList = (liveCopy?.testimonials?.items && liveCopy.testimonials.items.length)
    ? liveCopy.testimonials.items : TESTIMONIALS;
  const receiptsList = (liveCopy?.receipts?.items && liveCopy.receipts.items.length)
    ? liveCopy.receipts.items : RECEIPTS;
  const pressList = (liveCopy?.press?.items && liveCopy.press.items.length)
    ? liveCopy.press.items : PRESS;

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
      {/* Persistent ← PUTKI HQ backlink (fixed bottom-left so it never
          collides with the news ticker or site logo at top) */}
      <Link to="/" data-testid="mittari-back-home" className="m-back-home" style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 60,
        background: 'var(--surface, #141210)', border: '1px solid var(--hairline)',
        padding: '8px 14px', textDecoration: 'none',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.10em', color: 'var(--ink)',
      }}>{c.backHome}</Link>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px' }}>

        {/* ╭─ HERO - the wheel + tips pairing (above the fold) ─╮ */}
        <section ref={heroRef} data-testid="mittari-hero" style={{ padding: '40px 0 24px' }}>
          {/* Page title - Mittari meter + predictive signals */}
          <h1 data-testid="mittari-page-title" style={{
            fontFamily: 'Georgia, serif', fontWeight: 400,
            fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 1.05,
            letterSpacing: '-0.02em', margin: '0 0 14px', maxWidth: 880,
          }}>
            <span style={{ color: 'var(--ink)' }}>{c.pageTitleLead}</span>{' '}
            <em style={{ color: '#E89248', fontStyle: 'italic', fontWeight: 700 }}>{c.pageTitleEm}</em>{' '}
            <span style={{ color: 'var(--ink)' }}>{c.pageTitleTail}</span>
          </h1>
          <p data-testid="mittari-page-subtitle" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 13,
            color: 'var(--muted)', lineHeight: 1.55, letterSpacing: '0.02em',
            margin: '0 0 22px', maxWidth: 760,
          }}>{lang === 'en'
            ? <>Five picks scored 0-100 by <Link to="/menetelma#sharpness" data-testid="mittari-subtitle-method-link" style={{ color: '#E89248', textDecoration: 'none' }}>Sharpness</Link> - a deterministic measure of how tightly EU sportsbooks price the market. The dial tracks Finland’s scene live: streamers, odds, news. <strong style={{ color: 'var(--ink)' }}>Editorial only - not betting advice.</strong></>
            : <>Viisi vetoa pisteytettynä 0-100 <Link to="/menetelma#sharpness" data-testid="mittari-subtitle-method-link" style={{ color: '#E89248', textDecoration: 'none' }}>Sharpness</Link>-kaavalla - kuinka tiiviisti EU-urheilukirjat hinnoittelevat markkinan. Mittari seuraa Suomen skeneä reaaliajassa: striimit, kertoimet, uutiset. <strong style={{ color: 'var(--ink)' }}>Toimituksellista sisältöä - ei vetovinkkejä.</strong></>
          }</p>

          {/* iter86 · Phase 3 v2 — Telegram-first CTA strip below the
              subtitle, above the trust pills. Mittari's UI already
              ends in a Telegram gate; this teases the bot to readers
              who scan rather than scroll. */}
          <a href={`https://t.me/${TELEGRAM_BOT}?start=mittari`}
             target="_blank" rel="noopener noreferrer"
             data-testid="mittari-hero-telegram-cta"
             style={{
               display: 'block',
               background: 'linear-gradient(135deg, #229ED9 0%, #1B7BAB 100%)',
               color: '#FFFFFF', borderRadius: 8, padding: '14px 18px',
               textDecoration: 'none', marginBottom: 18,
               boxShadow: '0 4px 14px rgba(34, 158, 217, 0.2)',
               transition: 'transform 200ms ease, box-shadow 200ms ease',
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.transform = 'translateY(-2px)';
               e.currentTarget.style.boxShadow = '0 8px 22px rgba(34, 158, 217, 0.3)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.boxShadow = '0 4px 14px rgba(34, 158, 217, 0.2)';
             }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 16,
              }}>{'\u2708\uFE0E'}</div>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                  letterSpacing: '0.22em', fontWeight: 800, opacity: 0.85,
                  textTransform: 'uppercase', marginBottom: 2,
                }}>{lang === 'en' ? 'GET TODAY\u2019S 5 IN CHAT' : 'PÄIVÄN 5 SIGNAALIA CHATTIIN'}</div>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: 14.5, lineHeight: 1.35,
                  fontWeight: 500,
                }}>{lang === 'en'
                  ? 'Push notification at 09:00 sharp. No email signup.'
                  : 'Push-ilmoitus tasan klo 09:00. Ei sähköpostia.'}</div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', background: '#FFFFFF', color: '#1B7BAB',
                borderRadius: 999, fontFamily: 'ui-monospace, monospace',
                fontSize: 10, letterSpacing: '0.18em', fontWeight: 800,
                textTransform: 'uppercase', flexShrink: 0,
              }}>
                @{TELEGRAM_BOT} →
              </span>
            </div>
          </a>

          {/* Trust pills strip - concrete proof + frictionless commitments.
              Sits directly under the connective line so it does the heavy
              lifting before the user reaches the gate below the panel. */}
          <div data-testid="mittari-trust-strip" className="m-trust-strip" style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22,
            alignItems: 'center',
          }}>
            <div data-testid="mittari-trust-hitrate" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', border: '1px solid #6FA37D',
              background: 'rgba(111,163,125,0.08)', color: '#6FA37D',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.10em', fontWeight: 700,
            }}>
              <span>✓</span>
              <span>{lang === 'en' ? '86% HIT RATE · LAST 7 DAYS' : '86% OSUMATARKKUUS · 7 PV'}</span>
            </div>
            <div data-testid="mittari-trust-source" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', border: '1px solid var(--hairline)',
              background: 'var(--surface)', color: 'var(--muted)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.10em',
            }}>
              <span>⚡</span>
              <span>{lang === 'en' ? '10+ EU SPORTSBOOKS · LIVE PRICES' : '10+ EU-URHEILUKIRJAA · LIVE-HINNAT'}</span>
            </div>
            <div data-testid="mittari-trust-free" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', border: '1px solid var(--hairline)',
              background: 'var(--surface)', color: 'var(--muted)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.10em',
            }}>
              <span>✓</span>
              <span>{lang === 'en' ? 'FREE · GDPR · STOP ANYTIME' : 'ILMAINEN · GDPR · LOPETA MILLOIN VAIN'}</span>
            </div>
            {showCounter && (
              <div data-testid="mittari-trust-counter" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', border: '1px solid #5BA0E8',
                background: 'rgba(91,160,232,0.08)', color: '#5BA0E8',
                fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.10em', fontWeight: 700,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#5BA0E8' }} />
                <span>{subscriberCount.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI')}{' '}
                  {lang === 'en' ? 'SUBSCRIBERS' : 'TILAAJAA'}</span>
              </div>
            )}
          </div>

          {/* ╔═ Unified Mittari Panel ═════════════════════════════════╗
              ONE bordered panel houses: header strip · dial (38%) │
              hairline │ signals list (62%) · footer with avg-Sharpness.
              Deep-links: state pill, "Sharpness" pill, and the help (?)
              all route to /menetelma so a curious user can verify the
              method instead of guessing. */}
          <div data-testid="mittari-panel" className="m-panel" style={{
            background: 'var(--surface)', border: '1px solid var(--hairline)',
            marginBottom: 24, display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel header strip */}
            <div className="m-panel-head" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 14,
              padding: '12px 18px', borderBottom: '1px solid var(--hairline)',
              background: 'var(--bg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <SectionLabel color={stateColor}>{c.sectionHero}</SectionLabel>
                <Link to="/menetelma" data-testid="mittari-panel-state-link" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  textDecoration: 'none',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.16em', color: stateColor, fontWeight: 700,
                  border: `1px solid ${stateColor}`, padding: '4px 10px',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: stateColor }} />
                  {c.meterStateLabel} · {stateLabel} · {Math.round(composite)}/100
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div data-testid="mittari-pill-countdown" style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: 'var(--muted)', letterSpacing: '0.10em',
                }}>
                  <strong style={{ color: 'var(--muted)' }}>{c.countdownLabel.toUpperCase()}</strong>{' · '}
                  <span style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{countdownStr}</span>
                </div>
                <Link to="/menetelma" data-testid="mittari-panel-help" aria-label={lang === 'en' ? 'How this works' : 'Miten tämä toimii'}
                  title={lang === 'en' ? 'Read the full method' : 'Lue koko menetelmä'}
                  style={{
                    width: 22, height: 22, borderRadius: 999,
                    border: '1px solid var(--hairline)', background: 'var(--surface)',
                    color: 'var(--muted)', textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700,
                  }}>?</Link>
              </div>
            </div>

            {/* Panel body - dial (38%) │ hairline │ signals (62%) */}
            <div className="m-panel-body" style={{
              display: 'grid', gridTemplateColumns: '0.38fr 1px 0.62fr',
              alignItems: 'stretch',
            }}>
              {/* Left: dial only - every other widget moved to full-width
                  strips below so the panel reads as a real dashboard
                  instead of two columns of disconnected stuff. */}
              <div data-testid="mittari-dial-slot" style={{
                minWidth: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '24px 18px', gap: 10,
              }}>
                <Dial size="medium" state={stateKey} lang={lang} />
              </div>

              {/* Hairline vertical divider */}
              <div aria-hidden style={{ background: 'var(--hairline)' }} />

              {/* Right: signals list - list only, no bottom strip
                  (UNLOCK CTA is now a full-width band below the panel). */}
              <div data-testid="mittari-tips-slot" style={{
                minWidth: 0, display: 'flex', flexDirection: 'column',
                padding: '14px 18px 16px',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10, flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
                  }}>{unlocked ? (c._signalsCopy?.head_unlocked_eyebrow || (lang === 'en' ? '- TODAY\u2019S SIGNALS · UNLOCKED' : '- PÄIVÄN SIGNAALIT · AVATTU')) : (c._signalsCopy?.head_locked_eyebrow || (lang === 'en' ? '- TODAY\u2019S SIGNALS · LOCKED' : '- PÄIVÄN SIGNAALIT · LUKITTU'))}</div>
                  <Link to="/menetelma#sharpness" data-testid="mittari-panel-sharpness-link" style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.14em', color: 'var(--muted)',
                    textDecoration: 'none', borderBottom: '1px dotted var(--muted)',
                  }} title={lang === 'en'
                    ? 'Sharpness: 0-100 from EU sportsbook price dispersion + momentum'
                    : 'Sharpness: 0-100 EU-urheilukirjojen hinnoittelun hajonnasta ja momentumista'}>
                    {lang === 'en' ? 'SHARPNESS 0-100 ?' : 'SHARPNESS 0-100 ?'}
                  </Link>
                </div>
                <MittariSignals compact unlocked={unlocked}
                  onRevealRequest={() => gateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  copy={c._signalsCopy} lang={lang} />
              </div>
            </div>

            {/* ╔═ Full-width strip - WHAT THIS MEANS (state explainer)  ═╗
                Below the two-column body so it spans the full panel and
                visually ties dial-side to signals-side. Accent-bordered
                left edge matches the current state color. */}
            <div data-testid="mittari-state-desc" style={{
              borderTop: '1px solid var(--hairline)',
              borderLeft: `3px solid ${stateColor}`,
              background: 'var(--bg)',
              padding: '14px 18px',
              display: 'grid', gridTemplateColumns: '160px 1fr',
              gap: 18, alignItems: 'center',
            }}>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                letterSpacing: '0.18em', color: stateColor, fontWeight: 700,
              }}>
                {lang === 'en' ? 'WHAT THIS MEANS' : 'MITÄ TÄMÄ TARKOITTAA'}
                <span style={{ color: 'var(--muted)', marginLeft: 6, opacity: 0.7 }}>·</span>{' '}
                <span style={{ color: stateColor }}>{stateLabel}</span>
              </div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.4,
                color: 'var(--ink)', letterSpacing: '-0.005em',
              }}>{stateDesc}</div>
            </div>

            {/* ╔═ Full-width strip - DRIVERS row ═══════════════════════╗
                STREAMS · SPORTS · NEWS each fill 1fr so the bars span the
                entire panel width and read as a true gauge breakdown. */}
            {cockpit?.sub_scores && typeof cockpit.sub_scores === 'object' && (
              <div data-testid="mittari-dial-subscores" className="m-drivers-row" style={{
                borderTop: '1px solid var(--hairline)',
                background: 'var(--bg)',
                padding: '14px 18px',
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 18,
              }}>
                {[
                  { id: 'stream', fi: 'STRIIMIT',   en: 'STREAMS',  w: 57 },
                  { id: 'sports', fi: 'URHEILU',    en: 'SPORTS',   w: 29 },
                  { id: 'news',   fi: 'UUTISVIRTA', en: 'NEWS',     w: 14 },
                ].map(({ id, fi, en, w }) => {
                  const raw = cockpit.sub_scores[id];
                  if (raw == null) return null;
                  const label = lang === 'en' ? en : fi;
                  const value = Math.round(raw * 10) / 10;
                  const valueDisplay = Number.isInteger(value) ? String(value) : value.toFixed(1);
                  const pct = Math.min(100, Math.max(0, raw));
                  return (
                    <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        fontFamily: 'ui-monospace, monospace', fontSize: 10,
                        letterSpacing: '0.16em', color: 'var(--muted)',
                      }}>
                        <span><span style={{ color: 'var(--ink)', fontWeight: 700 }}>{label}</span>
                          <span style={{ fontSize: 8.5, opacity: 0.6, marginLeft: 6 }}>{w}%</span></span>
                        <span style={{
                          color: '#5BA0E8', fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums', fontSize: 12,
                        }}>{valueDisplay}</span>
                      </div>
                      <div style={{
                        height: 4, background: 'var(--hairline)',
                        position: 'relative', borderRadius: 1,
                      }}>
                        <div style={{
                          position: 'absolute', inset: 0,
                          width: `${pct}%`,
                          background: '#5BA0E8', borderRadius: 1,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ╔═ Full-width conversion CTA (when locked) ══════════════╗ */}
            {!unlocked && (
              <button data-testid="mittari-signals-cta"
                onClick={() => gateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, width: '100%',
                  background: 'rgba(91,160,232,0.06)',
                  border: 0, borderTop: '1px solid #5BA0E8',
                  color: 'var(--ink)', cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  letterSpacing: '0.14em', textAlign: 'left',
                  padding: '12px 18px',
                }}>
                <span style={{ color: 'var(--muted)' }}>
                  <span style={{ color: '#5BA0E8', fontWeight: 700 }}>4 {lang === 'en' ? 'PICKS LOCKED' : 'VINKKIÄ LUKITTU'}</span>
                  {' · '}{lang === 'en' ? 'connect below to unlock all 5' : 'kytke alta avataksesi kaikki 5'}
                </span>
                <span style={{
                  color: '#5BA0E8', fontWeight: 700, letterSpacing: '0.18em',
                  whiteSpace: 'nowrap',
                }}>{lang === 'en' ? 'UNLOCK ↓' : 'AVAA ↓'}</span>
              </button>
            )}

            {/* Panel footer - avg-Sharpness left, METHOD link right.
                Single source of truth for both (NEXT DROP is only in the
                header strip; HOW THIS IS COMPUTED → METHOD merged). */}
            <div data-testid="mittari-panel-foot" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 12, flexWrap: 'wrap',
              padding: '10px 18px', borderTop: '1px solid var(--hairline)',
              background: 'var(--bg)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.10em', color: 'var(--muted)',
            }}>
              <span>{hasLiveStats
                ? <>{c.killerEyebrow}{' '}<strong style={{ color: '#E89248' }}>{avgSharp}/100</strong></>
                : c.killerQuiet}
              </span>
              <Link to="/menetelma" style={{
                color: '#E89248', textDecoration: 'none',
                letterSpacing: '0.16em', fontWeight: 700,
              }}>{lang === 'en' ? 'METHOD →' : 'MENETELMÄ →'}</Link>
            </div>
          </div>

          {/* Single hero gate - directly under the pairing */}
          <div ref={gateRef} data-testid="mittari-hero-gate-wrap" style={{
            display: 'grid', gridTemplateColumns: '1fr', gap: 14,
            maxWidth: 760, margin: '0 auto',
          }}>
            <MittariGate c={c} variant="hero" pendingId={pendingId}
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
            {unlocked && (
              <div data-testid="mittari-reveal-hi" style={{
                background: 'var(--surface)', border: '1px solid #6FA37D',
                padding: '12px 14px',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                color: '#6FA37D', lineHeight: 1.5, letterSpacing: '0.02em',
              }}>{c.revealedHi}</div>
            )}
            <LiveActivityFeed c={c} rows={signupRows} />
          </div>
        </section>

        {/* ╭─ TRACK RECORD ─╮
            HOW IT WORKS section removed - its content was already
            covered by: trust pills (10+ EU BOOKS), WHAT THIS MEANS
            state strip, driver row, gate bullets, and the global METHOD
            link in the header / panel footer. Curious readers click
            METHOD → for the full Sharpness formula on /menetelma.
         */}
        <section data-testid="mittari-receipts" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <SectionLabel>{lang === 'en' ? 'TRACK RECORD · LAST 7 DAYS' : 'OSUMARAPORTTI · 7 VIIMEISTÄ PÄIVÄÄ'}</SectionLabel>
          <div style={{
            marginTop: 18, border: '1px solid var(--hairline)',
            background: 'var(--hairline)', display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            {receiptsList.map((r, i) => {
              const pill = STATUS_PILL[r.status] || STATUS_PILL.hit;
              const statusLabel = r.status === 'hit' ? c.statusHit : r.status === 'miss' ? c.statusMiss : c.statusEarly;
              const dateStr    = lang === 'en' ? r.date_en    : r.date_fi;
              const signalStr  = lang === 'en' ? r.signal_en  : r.signal_fi;
              const outcomeStr = lang === 'en' ? r.outcome_en : r.outcome_fi;
              return (
                <div key={i} data-testid={`mittari-receipt-${i}`} className="m-receipt-row" style={{
                  background: 'var(--surface)',
                  display: 'grid', gridTemplateColumns: '90px 70px 1fr 1fr 80px',
                  gap: 16, padding: '14px 20px', alignItems: 'center',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>{dateStr}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.time}</span>
                  <span style={{ color: 'var(--muted)', letterSpacing: '0.02em' }}>{signalStr}</span>
                  <span style={{
                    color: r.status === 'hit' ? '#6FA37D' : r.status === 'miss' ? '#C13B2C' : '#E89248',
                    letterSpacing: '0.02em',
                  }}>{outcomeStr}</span>
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
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            color: 'var(--muted)', letterSpacing: '0.06em',
          }}>
            <span>{c.receiptsFoot7d}: <strong style={{ color: '#E89248' }}>{c.receiptsFoot7dValue}</strong> · {c.receiptsFoot30d}: {c.receiptsFoot30dValue}</span>
          </div>
        </section>

        {/* ╭─ TESTIMONIALS ─╮ */}
        <section data-testid="mittari-testimonials" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <SectionLabel>{lang === 'en' ? 'WHAT SUBSCRIBERS SAY' : 'MITÄ TILAAJAT SANOVAT'}</SectionLabel>
          <div className="m-testi-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
            background: 'var(--hairline)', marginTop: 18,
            border: '1px solid var(--hairline)',
          }}>            {testimonialsList.map((t, idx) => (
              <div key={t.id || `t${idx}`} data-testid={`mittari-testimonial-${t.id || `t${idx}`}`} style={{
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
                    }}>{lang === 'en' ? t.detail_en : t.detail_fi}</div>
                  </div>
                </div>
                <p style={{
                  fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.4,
                  color: 'var(--ink)', margin: 0,
                }}>“{lang === 'en' ? t.quote_en : t.quote_fi}”</p>
                <div style={{
                  marginTop: 'auto', paddingTop: 10,
                  borderTop: '1px solid var(--hairline)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  color: 'var(--muted)', letterSpacing: '0.04em', lineHeight: 1.5,
                }}>{lang === 'en' ? t.receipt_en : t.receipt_fi}</div>
              </div>
            ))}
          </div>
          <p data-testid="mittari-testimonials-consent" style={{
            margin: '12px 0 0', color: 'var(--muted)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.06em', lineHeight: 1.55,
          }}>{c.testimonialsConsent}</p>
        </section>
        <section data-testid="mittari-founder" style={{
          borderTop: '1px solid var(--hairline)', padding: '40px 0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <SectionLabel>{c.founderTitle}</SectionLabel>
            {/* Admin-only deep-link → back-office copy editor.
                Visible only when localStorage carries the admin token,
                so regular visitors never see it. Server-side gate still
                enforces auth - this is purely a UX shortcut. */}
            {isAdmin && (
              <Link to="/back-office/mittari-copy#founder"
                data-testid="mittari-founder-admin-edit"
                style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.16em', color: '#5BA0E8',
                  textDecoration: 'none',
                  border: '1px dashed #5BA0E8', padding: '4px 10px',
                  background: 'rgba(91,160,232,0.06)',
                }}>EDIT FOUNDER ↗</Link>
            )}
          </div>
          <div className="m-founder-grid" style={{
            marginTop: 18, background: 'var(--surface)',
            border: '1px solid var(--hairline)', padding: 28,
            display: 'grid', gridTemplateColumns: '100px 1fr', gap: 24, alignItems: 'start',
          }}>
            {/* Founder avatar - designed editorial portrait.
                Abstract silhouette (head + shoulder) in muted ink with a
                serif monogram watermark + small accent dot. Reads as a
                "stylized photo" without needing a real photograph. */}
            <div data-testid="mittari-founder-avatar" style={{
              width: 100, height: 100, position: 'relative',
            }}>
              <svg width="100" height="100" viewBox="0 0 100 100"
                style={{ display: 'block' }} aria-hidden>
                {/* Tinted background circle */}
                <circle cx="50" cy="50" r="49" fill="var(--bg)"
                  stroke="#E89248" strokeWidth="1" />
                {/* Soft inner shadow ring */}
                <circle cx="50" cy="50" r="44" fill="none"
                  stroke="var(--hairline)" strokeWidth="1" />
                {/* Stylized portrait silhouette - head + shoulders */}
                <g fill="#E89248" opacity="0.18">
                  <circle cx="50" cy="40" r="13" />
                  <path d="M 22 85 Q 22 60 50 60 Q 78 60 78 85 Z" />
                </g>
                {/* Serif monogram on top */}
                <text x="50" y="60" textAnchor="middle"
                  style={{
                    fontFamily: 'Georgia, serif', fontStyle: 'italic',
                    fontSize: 38, fontWeight: 400, fill: '#E89248',
                  }}>{c.founderAvatarInitial}</text>
                {/* Small green "live" accent dot bottom-right */}
                <circle cx="80" cy="78" r="4" fill="#6FA37D"
                  stroke="var(--surface)" strokeWidth="2" />
              </svg>
            </div>
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
              }}>{c.founderCreds}</div>
              <div data-testid="mittari-founder-pseudonym" style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: 'var(--muted)', letterSpacing: '0.04em', lineHeight: 1.55,
                opacity: 0.85, marginTop: -2,
              }}>{c.founderPseudonym}</div>
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
          }}>{lang === 'en' ? 'FEATURED ON' : 'NÄHTY PALVELUISSA'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            {pressList.map((p, i) => {
              const item = typeof p === 'string' ? { name: p, url: '' } : (p || { name: '', url: '' });
              const style = {
                fontFamily: i % 2 ? 'ui-monospace, monospace' : 'Georgia, serif',
                fontStyle: i % 2 ? 'normal' : 'italic',
                fontSize: i % 2 ? 12 : 18,
                color: item.url ? 'var(--ink)' : 'var(--muted)',
                letterSpacing: i % 2 ? '0.12em' : '-0.01em',
                textTransform: i % 2 ? 'uppercase' : 'none',
                fontWeight: i % 2 ? 500 : 400,
                textDecoration: item.url ? 'underline' : 'none',
                textUnderlineOffset: 3,
              };
              if (item.url) {
                return (
                  <a key={`${item.name}-${i}`} href={item.url}
                    target="_blank" rel="noopener noreferrer"
                    data-testid={`mittari-press-${i}`} style={style}>{item.name}</a>
                );
              }
              return (
                <span key={`${item.name}-${i}`} data-testid={`mittari-press-${i}`} style={style}>{item.name}</span>
              );
            })}
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
          }}>{lang === 'en' ? '→ ONE MORE STEP' : '→ VIELÄ YKSI ASKEL'}</div>
          <h2 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(24px, 3.4vw, 36px)',
            lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0, fontWeight: 400,
          }}>{lang === 'en'
            ? <>Connect <em style={{ color: '#E89248', fontStyle: 'italic' }}>once.</em></>
            : <>Kytke <em style={{ color: '#E89248', fontStyle: 'italic' }}>kerran.</em></>
          }</h2>
          <div style={{ marginTop: 28, textAlign: 'left' }}>
            <MittariGate c={c} variant="final" pendingId={pendingId}
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
        /* Unified Mittari panel stacks the body at <=1024 - the dial gets a
           bottom hairline instead of a right hairline, signals flow under. */
        @media (max-width: 1024px) {
          .m-panel-body {
            grid-template-columns: 1fr !important;
          }
          .m-panel-body > [aria-hidden] {
            height: 1px !important;
            width: 100% !important;
            background: var(--hairline) !important;
          }
        }
        @media (max-width: 720px) {
          /* Drivers row stacks 1 col on phones so each bar is full-width. */
          .m-drivers-row { grid-template-columns: 1fr !important; gap: 12px !important; }
        }
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
          /* Lift the back-home link above the sticky CTA bar */
          .m-back-home { bottom: 70px !important; }
          body { padding-bottom: 70px; }
        }
        @media (max-width: 640px) {
          /* Compact signal rows shrink to 2 columns on phones (number +
             pick text); confidence bar, implied %, and lock icon hide so
             the row is readable at 360px */
          [data-compact="1"] .ms-row {
            grid-template-columns: 28px 1fr !important;
            gap: 10px !important;
            padding: 12px 12px !important;
          }
          [data-compact="1"] .ms-row > *:nth-child(3),
          [data-compact="1"] .ms-row > *:nth-child(4),
          [data-compact="1"] .ms-row > *:nth-child(5) { display: none !important; }
          /* Reveal-teaser stays on a single line, never letter-wraps */
          [data-testid="mittari-signal-reveal-teaser"] {
            font-size: 9.5px !important;
            white-space: normal !important;
            line-height: 1.4 !important;
            max-width: 100% !important;
          }
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
