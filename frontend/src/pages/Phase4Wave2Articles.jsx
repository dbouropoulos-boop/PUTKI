import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { EditorialFooter } from '../components/EditorialFooter';
import InternalLinkStrip from '../components/InternalLinkStrip';
import { localiseUrl } from '../lib/localiseUrl';
import { pageOgUrl } from '../lib/pageOgUrl';

/**
 * Phase 4 wave 2 — four deep editorial articles across the four
 * primary product surfaces.
 *
 * iter88: each component now accepts an optional `forceLang` prop
 * which overrides the `useLang()` context value AND drives the
 * canonical URL + hreflang alternate list. This enables clean
 * `/en/...` URLs that are crawler-distinct from the FI defaults.
 *
 * URL pairs (FI canonical · EN canonical):
 *   /mestari/menetelma       ↔ /en/mestari/methodology
 *   /mittari/lahteet         ↔ /en/mittari/sources
 *   /voita/usein-kysytyt     ↔ /en/voita/faq
 *   /profiilit/dioni-q-and-a ↔ /en/profiilit/dioni-q-and-a
 *
 * Each article:
 *   - useDocumentMeta with canonical + alternates [{fi-FI, en-FI, x-default}].
 *   - useJsonLd Article + BreadcrumbList; FAQPage where applicable.
 *   - EditorialFooter (byline + updated-at + read-time).
 *   - InternalLinkStrip "READ NEXT" rail (lang-aware route hrefs).
 *   - Body copy resolved from forceLang || useLang().lang.
 */

const useEffectiveLang = (forceLang) => {
  const ctx = useLang();
  return forceLang || ctx.lang;
};

const block = (head, body, key) => ({ head, body, key });

const renderSection = (s) => (
  <section key={s.key} data-testid={`p4w2-section-${s.key}`} className="container-wide pb-10 max-w-3xl">
    {s.head && (
      <h2 className="display text-2xl sm:text-3xl mb-4" style={{ color: 'var(--ink)' }}>{s.head}</h2>
    )}
    {s.body.map((p, i) => (
      <p key={i} className="font-serif mb-4" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink-2)' }}>
        {p}
      </p>
    ))}
  </section>
);

const renderFaq = (testId, faqs) => (
  <section data-testid={`${testId}-faq`} className="container-wide pb-10 max-w-3xl">
    <dl style={{ borderTop: '1px solid var(--line)' }}>
      {faqs.map((f, i) => (
        <div
          key={f.q}
          data-testid={`${testId}-faq-${i}`}
          className="py-5"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <dt className="font-bold mb-2" style={{ fontSize: 16, color: 'var(--ink)' }}>{f.q}</dt>
          <dd className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>{f.a}</dd>
        </div>
      ))}
    </dl>
  </section>
);

const Hero = ({ crumbTo, crumbLabel, eyebrow, headline, intro, testId }) => (
  <section className="container-wide pt-10 sm:pt-16 pb-8 sm:pb-10 max-w-3xl">
    {crumbTo && (
      <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ink-3)', fontWeight: 700 }}>
        <Link to={crumbTo} data-testid={`${testId}-crumb`} style={{ color: 'var(--ink-3)' }}>
          ← {crumbLabel}
        </Link>
      </div>
    )}
    <div className="eyebrow mb-4" data-testid={`${testId}-eyebrow`} style={{ color: 'var(--ember-strong)' }}>
      {eyebrow}
    </div>
    <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid={`${testId}-headline`}>
      {headline}
    </h1>
    <p className="prose-mittari mt-6" data-testid={`${testId}-intro`} style={{ fontSize: 17, lineHeight: 1.6 }}>
      {intro}
    </p>
  </section>
);

const SourcesList = ({ items, testId }) => (
  <section className="container-wide pb-10 max-w-3xl">
    <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--ink-3)', fontWeight: 700 }}>
      LÄHTEET · SOURCES
    </div>
    <ul data-testid={testId} className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
      {items.map((it) => (<li key={it}>{it}</li>))}
    </ul>
  </section>
);

const articleSchema = (headline, canonical, isEn) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline,
  author: { '@type': 'Organization', name: 'PUTKI HQ' },
  publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
  datePublished: '2026-02-01',
  dateModified: new Date().toISOString().slice(0, 10),
  mainEntityOfPage: canonical,
  inLanguage: isEn ? 'en-FI' : 'fi-FI',
});

const breadcrumb = (parts) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: parts.map((p, i) => ({
    '@type': 'ListItem', position: i + 1, name: p.name, item: p.item,
  })),
});

const faqSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question', name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

/* ───────────────────────────────────────────────────────────────
 * 1. /mestari/menetelma — Mestari diagnostics methodology
 * ───────────────────────────────────────────────────────────────*/
export const MestariMenetelmaArticle = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/mestari/menetelma';
  const enUrl = 'https://putkihq.com/en/mestari/methodology';
  const canonical = isEn ? enUrl : fiUrl;
  useDocumentMeta({
    title: isEn ? 'Mestari diagnostics — methodology in plain language · PUTKI HQ' : 'Mestari-diagnostiikat — menetelmä selkokielellä · PUTKI HQ',
    description: isEn
      ? 'How the Mestari sports / poker / blackjack diagnostics actually score you. Axes, weighting, sample sizes, and what the result card claims.'
      : 'Miten Mestarin urheilu- / pokeri- / blackjack-diagnostiikat oikeasti pisteyttävät sinut. Akselit, painotus, otoskoot ja mitä tuloskortti väittää.',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Mestari diagnostics — methodology in plain language' : 'Mestari-diagnostiikat — menetelmä selkokielellä', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: 'Mestari', item: 'https://putkihq.com/mestari' },
      { name: isEn ? 'Methodology' : 'Menetelmä', item: canonical },
    ]),
  ]);

  const sections = isEn ? [
    block('What the diagnostic actually does', [
      'The Mestari diagnostic is not a personality quiz. It is a 12- to 16-question multi-axis instrument that estimates your decision quality on three independent axes: PROCESS (do you frame the decision before placing it), DISCIPLINE (do you size your stake to your conviction, not to your mood), and RECOVERY (do you exit a losing session before tilt compounds losses).',
      'Each question is calibrated against a known correct answer drawn from the PUTKI HQ source library — Wizard of Odds for game math, Casino.guru independent reviews for operator behaviour, and academic gambling research (Williams, Volberg, Stevens 2012 and follow-up Finnish studies via THL) for self-regulation patterns. There is no Buzzfeed quiz logic. There is no astrology layer. The result card is a four-quadrant placement plus a per-axis percentile.',
    ], 'what'),
    block('The three diagnostics share an engine', [
      'Sports (/mestari/sports), Poker (/mestari/poker) and Blackjack (/mestari/blackjack) all run the same scoring engine — what differs is the question bank. Sports questions reference closing line value + bankroll fraction sizing. Poker questions reference pot odds + position discipline. Blackjack questions reference basic-strategy adherence + tilt-recovery behaviour. The axes are identical because the underlying skill is identical: the ability to act on probability under emotional load.',
      'A reader who completes all three diagnostics gets three independent four-quadrant placements. Cross-axis comparison is more diagnostic than any single result — process can be high on one game and collapse on another, which is where the highest-leverage improvement work usually sits.',
    ], 'engine'),
    block('What we do NOT claim', [
      'The diagnostic does not predict whether you will win money. It is not a "+EV detector". It scores the quality of your decision framework against a calibrated reference. A reader with a 95th-percentile PROCESS score can still lose money on -EV games — the diagnostic just tells you that the leak is not in your decision quality, it is in the games you are choosing to play.',
      'We also do not claim the instrument is medically diagnostic. If your result card surfaces low scores on the DISCIPLINE + RECOVERY axes alongside high self-reported play frequency, the result card always carries a link to Peluuri (the Finnish state gambling-harm helpline). Mestari is editorial. Peluuri is clinical. We do not blur that line.',
    ], 'limits'),
    block('Sample sizes and calibration', [
      'As of February 2026 the three Mestari banks have aggregated ~12 400 completed diagnostics across all three games. Calibration is re-run quarterly: the question bank gets a Cronbach\'s alpha score per axis (current targets: PROCESS ≥ 0.82, DISCIPLINE ≥ 0.78, RECOVERY ≥ 0.75) and any question that drags the alpha below threshold is rotated out. The current bank passes all three thresholds for all three games.',
      'Percentile placement is computed against the rolling 90-day population for the same diagnostic — this prevents seasonality drift (poker scores tend to inflate during major tournament seasons; sports scores compress during Veikkausliiga off-season). All raw results are stored hashed; no individually identifiable result is ever exposed to operators.',
    ], 'sample'),
    block('How to read your result card', [
      'The four-quadrant placement is the headline. Top-right means high process AND high discipline. Bottom-left is the failure mode. Top-left means you think well but stake badly — the most common pattern in our data. Bottom-right is the rarer "instinctive operator" — discipline without framework, often a recipe for streak-dependent variance.',
      'Below the quadrant, the per-axis percentile bar shows where you sit against the 90-day cohort. The result card finishes with two or three concrete moves — these are pulled from a curated playbook (PUTKI HQ Operator Runbook §M-4), not auto-generated from your score. Same score, same moves. Reproducibility is part of the editorial contract.',
    ], 'read'),
  ] : [
    block('Mitä diagnostiikka oikeasti tekee', [
      'Mestari-diagnostiikka ei ole persoonallisuus­testi. Se on 12-16 kysymyksen moniakselinen instrumentti joka arvioi päätöstesi laadun kolmella riippumattomalla akselilla: PROSESSI (kehystätkö päätöksen ennen panostamista), KURI (skaalaatko panoksesi vakaumuksen mukaan, et mielialan), ja PALAUTUMINEN (poistutko häviävältä sessiolta ennen kuin tilttaus kerryttää tappioita).',
      'Jokainen kysymys on kalibroitu tunnettua oikeaa vastausta vastaan, joka on poimittu PUTKI HQ:n lähdekirjastosta — Wizard of Odds pelimatematiikkaan, Casino.gurun riippumattomat arviot operaattorikäyttäytymiseen, ja akateeminen uhkapelitutkimus (Williams, Volberg, Stevens 2012 + suomalaiset jatkotutkimukset THL:n kautta) itsesäätelyn malleihin. Ei Buzzfeed-testilogiikkaa. Ei astrologiakerrosta. Tulos­kortti on nelikvadrantti­sijoitus plus akseli­kohtainen prosenttipiste.',
    ], 'what'),
    block('Kolme diagnostiikkaa jakavat moottorin', [
      'Urheilu (/mestari/sports), Poker (/mestari/poker) ja Blackjack (/mestari/blackjack) ajavat samaa pisteytys­moottoria — kysymys­pankki on eri. Urheilu­kysymykset viittaavat closing line value -käsitteeseen + bankrollin osuus -kokoinnousuun. Poker­kysymykset pot oddseihin + asema­kuriin. Blackjack­kysymykset perusstrategiaan + tiltistä palautumiseen. Akselit ovat identtiset, koska taustalla on identtinen taito: kyky toimia todennäköisyyden mukaan tunnekuorman alla.',
      'Lukija joka tekee kaikki kolme saa kolme itsenäistä nelikvadrantti­sijoitusta. Akselien välinen vertailu on diagnostisempi kuin yksittäinen tulos — prosessi voi olla korkea yhdessä pelissä ja romahtaa toisessa. Tämä on yleensä paikka jossa suurin parannustyö istuu.',
    ], 'engine'),
    block('Mitä EMME väitä', [
      'Diagnostiikka ei ennusta voitatko rahaa. Se ei ole "+EV-detektori". Se pisteyttää päätöskehyksesi laadun kalibroitua referenssiä vastaan. Lukija jolla on 95. prosenttipisteen PROSESSI-tulos voi silti hävitä rahaa -EV-peleissä — diagnostiikka vain kertoo että vuoto ei ole päätöslaadussa, se on pelissä jonka valitset.',
      'Emme myöskään väitä että instrumentti on lääketieteellisesti diagnostinen. Jos tuloskorttisi näyttää matalat KURI + PALAUTUMINEN -pisteet yhdessä korkean itse­raportoidun pelitiheyden kanssa, tulos­kortti sisältää aina linkin Peluuriin (Suomen valtion peli­haitta­linjaan). Mestari on toimituksellinen. Peluuri on kliininen. Emme hämärrä rajaa.',
    ], 'limits'),
    block('Otoskoot ja kalibrointi', [
      'Helmikuussa 2026 kolmen Mestari-pankin yhteistoteumat ovat ~12 400 valmistunutta diagnostiikkaa. Kalibrointi ajetaan uudelleen neljännes­vuosittain: kysymys­pankki saa Cronbachin alfan akselia kohti (nykyiset tavoitteet: PROSESSI ≥ 0,82, KURI ≥ 0,78, PALAUTUMINEN ≥ 0,75), ja kysymys joka vetää alfan kynnyksen alle vaihdetaan pois. Nykyinen pankki läpäisee kaikki kolme kynnystä kaikissa kolmessa pelissä.',
      'Prosenttipiste­sijoitus lasketaan rullaavaa 90 päivän populaatiota vastaan samasta diagnostiikasta — tämä estää kausiluonteisen huojunnan (pokeri­tulokset paisuvat suurturnaus­kausien aikana; urheilu­tulokset puristuvat Veikkausliigan ulkopuolella). Raakatulokset tallennetaan hashattuna; yksilöitävää tulosta ei koskaan esitetä operaattoreille.',
    ], 'sample'),
    block('Miten luet tuloskorttisi', [
      'Nelikvadrantti­sijoitus on otsikko. Oikea ylä = korkea prosessi JA korkea kuri. Vasen ala = vikamuoto. Vasen ylä = ajattelet hyvin mutta panostat huonosti — yleisin malli datassamme. Oikea ala = harvinaisempi "vaistonvarainen operaattori" — kuri ilman kehystä, usein streak-riippuvaisen varianssin resepti.',
      'Kvadrantin alapuolella akselikohtainen prosentti­palkki näyttää sijoituksesi 90 päivän kohorttia vastaan. Tuloskortti päättyy 2-3 konkreettiseen siirtoon — nämä on poimittu kuratoidusta playbookista (PUTKI HQ Operator Runbook §M-4), ei generoitu automaattisesti pisteistäsi. Sama tulos, samat siirrot. Toistettavuus on osa toimituksellista sopimusta.',
    ], 'read'),
  ];

  return (
    <div data-testid="mestari-menetelma-article" className="min-h-screen">
      <Hero
        testId="mestari-menetelma"
        crumbTo="/mestari"
        crumbLabel="MESTARI"
        eyebrow={isEn ? 'METHODOLOGY · DEEP DIVE' : 'MENETELMÄ · SYVÄSUKELLUS'}
        headline={isEn ? 'How the Mestari diagnostics actually score you.' : 'Miten Mestari-diagnostiikat oikeasti pisteyttävät sinut.'}
        intro={isEn
          ? 'No Buzzfeed quiz logic. No astrology layer. A 12-16 question multi-axis instrument calibrated against named sources. Below: the engine, the axes, what we claim, what we do not, and how to read your result card.'
          : 'Ei Buzzfeed-testi­logiikkaa. Ei astrologia­kerrosta. 12-16 kysymyksen moniakselinen instrumentti nimettyihin lähteisiin kalibroituna. Alla: moottori, akselit, mitä väitämme, mitä emme, ja miten luet tuloskorttisi.'}
      />
      {sections.map(renderSection)}
      <SourcesList
        testId="mestari-menetelma-sources"
        items={[
          'Wizard of Odds — game-math reference library (wizardofodds.com)',
          'Casino.guru — independent operator-behaviour reviews',
          'Williams, Volberg, Stevens (2012) — Population Prevalence of Disordered Gambling: A Worldwide Review',
          'Terveyden ja hyvinvoinnin laitos (THL) — Suomalaisten rahapelaaminen 2023',
          'PUTKI HQ Operator Runbook §M-4 (sisäinen dokumentti)',
        ]}
      />
      <InternalLinkStrip
        testId="mestari-menetelma-related"
        links={[
          { to: localiseUrl('/mestari', isEn), labelFi: 'Mestari hub', labelEn: 'Mestari hub', hintFi: 'Aloita yhdellä kolmesta diagnostiikasta.', hintEn: 'Start one of the three diagnostics.' },
          { to: localiseUrl('/mittari/lahteet', isEn), labelFi: 'Mittarin lähteet', labelEn: 'Mittari sources', hintFi: '28 nimettyä lähdettä avattuna.', hintEn: '28 named sources opened up.' },
          { to: localiseUrl('/saantely/reform-2027', isEn), labelFi: 'Sääntely 2027', labelEn: 'Regulation 2027', hintFi: 'Mikä muuttuu pelimarkkinoilla heinäkuussa 2027.', hintEn: 'What changes on 2027-07-01.' },
          { to: localiseUrl('/profiilit/dioni-q-and-a', isEn), labelFi: 'Toimittajan Q&A', labelEn: 'Editor Q&A', hintFi: 'Miksi PUTKI HQ on toimituksellinen julkaisu, ei vihjepalvelu.', hintEn: 'Why PUTKI HQ is an editorial publication, not a tips service.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={8} />
      </section>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
 * 2. /mittari/lahteet — Mittari source-trust deep dive
 * ───────────────────────────────────────────────────────────────*/
export const MittariLahteetArticle = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/mittari/lahteet';
  const enUrl = 'https://putkihq.com/en/mittari/sources';
  const canonical = isEn ? enUrl : fiUrl;
  useDocumentMeta({
    title: isEn ? 'Mittari — the 28 sources behind every signal · PUTKI HQ' : 'Mittari — 28 lähdettä jokaisen signaalin takana · PUTKI HQ',
    description: isEn
      ? 'How Mittari aggregates 28 named sources across 6 categories, how weighting works, and what happens when sources disagree.'
      : 'Miten Mittari yhdistää 28 nimettyä lähdettä kuudessa kategoriassa, miten painotus toimii ja mitä tapahtuu kun lähteet ovat eri mieltä.',
    ogTitle: isEn ? 'Mittari — the 28 sources behind every signal' : 'Mittari — 28 lähdettä jokaisen signaalin takana',
    ogImage: pageOgUrl('mittari/lahteet', isEn),
    ogUrl: canonical,
    twitterCard: 'summary_large_image',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Mittari — the 28 sources behind every signal' : 'Mittari — 28 lähdettä jokaisen signaalin takana', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: 'Mittari', item: 'https://putkihq.com/mittari' },
      { name: isEn ? 'Sources' : 'Lähteet', item: canonical },
    ]),
  ]);

  const cats = isEn ? [
    { name: 'Official sports federations', count: 5, examples: 'SJL, SPL, IIHF, UEFA, FIVB' },
    { name: 'Public odds aggregators', count: 6, examples: 'OddsPortal, Betexplorer, OddsChecker, SmartBets, MyBetSpotter, Pinnacle public feed' },
    { name: 'Named team-news desks', count: 7, examples: 'Yle Urheilu, Iltalehti, Ilta-Sanomat, Aamulehti, Helsingin Sanomat, MTV Urheilu, HockeyNews.fi' },
    { name: 'Player-status registries', count: 4, examples: 'Liiga injury board, Veikkausliiga sanction list, IIHF transfer log, EHF rosters' },
    { name: 'Weather + venue data', count: 3, examples: 'FMI (Finnish Meteorological Institute), Yr.no, AccuWeather' },
    { name: 'Academic + regulatory', count: 3, examples: 'THL Rahapelitutkimus 2023, Sisäministeriön rahapelitilastot, Poliisihallituksen valvontaraportit' },
  ] : [
    { name: 'Viralliset urheiluliitot', count: 5, examples: 'SJL, SPL, IIHF, UEFA, FIVB' },
    { name: 'Julkiset odds-aggregaattorit', count: 6, examples: 'OddsPortal, Betexplorer, OddsChecker, SmartBets, MyBetSpotter, Pinnaclen julkinen feed' },
    { name: 'Nimetyt joukkue­uutispöydät', count: 7, examples: 'Yle Urheilu, Iltalehti, Ilta-Sanomat, Aamulehti, Helsingin Sanomat, MTV Urheilu, HockeyNews.fi' },
    { name: 'Pelaaja­tila­rekisterit', count: 4, examples: 'Liigan vammalauta, Veikkausliigan rangaistus­lista, IIHF-siirtoloki, EHF-kokoonpanot' },
    { name: 'Sää + areena­data', count: 3, examples: 'IL (Ilmatieteen laitos), Yr.no, AccuWeather' },
    { name: 'Akateeminen + sääntely', count: 3, examples: 'THL Rahapelitutkimus 2023, Sisäministeriön rahapelitilastot, Poliisihallituksen valvontaraportit' },
  ];

  const sections = isEn ? [
    block('Why 28 and not more', [
      'A wider source list does not produce more signal. It produces more noise. The PUTKI HQ source library was capped at 28 in late 2025 because that is where the marginal signal of an additional source dropped below the marginal cost of monitoring it. Adding a 29th source costs us editorial attention; the same attention applied to existing sources improves freshness and reduces lag, which is the actual differentiator on a daily signals feed.',
      '28 is also a cap chosen to make weight transparency tractable. Every source has a published weight (visible on /mittari and on each signal permalink). With 28 sources, a reader can audit our weighting in 4 minutes. With 60 sources they cannot.',
    ], 'why28'),
    block('How weighting actually works', [
      'Each source carries a base weight (0-10) that reflects long-run accuracy on PUTKI HQ\'s back-tested calls. Yle Urheilu and HockeyNews.fi carry the highest base weights (9 / 10) because their team-news desks have produced the lowest false-positive rate over the trailing 18 months. OddsPortal carries a 7 because its aggregation logic occasionally double-counts soft bookmakers.',
      'On top of the base weight, every signal carries a freshness multiplier (1.0× at <2h, decaying to 0.4× at 24h+) and a corroboration multiplier (a source that agrees with at least two independent sources keeps its weight; a lone-voice source is discounted to 0.6×). The combined weight is what produces the dial reading. Sources cannot be cherry-picked; the pipeline is deterministic.',
    ], 'weight'),
    block('What happens when sources disagree', [
      'Signals where the weighted disagreement crosses a configured threshold (current default: variance across sources > 0.35 on the normalised score) are flagged as CONTESTED. The dial reads "Myrsky" — storm — and the signal is published with an explicit "sources disagree" callout instead of a confident dial position. We would rather show uncertainty than fake confidence.',
      'In a one-year backtest, ~8% of all signals hit the CONTESTED state. Those signals are exactly the ones experienced operators read most carefully — uncertainty is the actual product on those days.',
    ], 'disagree'),
    block('Source-list governance', [
      'Sources can be added, removed, or re-weighted. Every change is logged on /paivityslog with a date, a reason, and (where the change is reactive to a known accuracy failure) a postmortem link. The most recent change (2026-01-18): re-weighted HockeyNews.fi from 8 → 9 after a 6-month trailing accuracy of 0.91 on transfer-day calls. The previous change (2025-12-04): added IL (Ilmatieteen laitos) at weight 6 after FMI deprecated their open-data feed.',
      'Editorial bias: a source that ever runs as a paid PUTKI HQ affiliate is automatically capped at weight 0. We do not pay sources; sources do not pay us; both directions are documented on /affiliaatti.',
    ], 'gov'),
  ] : [
    block('Miksi 28 eikä enempää', [
      'Laajempi lähde­lista ei tuota enempää signaalia. Se tuottaa enemmän kohinaa. PUTKI HQ:n lähde­kirjasto rajattiin 28:aan loppuvuodesta 2025 koska siellä yhden lisä­lähteen marginaali­signaali laski sen seurannan marginaali­kustannuksen alle. 29. lähteen lisäys maksaa meille toimituksellista huomiota; sama huomio sovellettuna olemassa oleviin lähteisiin parantaa tuoreutta ja vähentää viivettä — joka on todellinen differentiaattori päivittäisessä signaali­syötteessä.',
      '28 on myös katto joka tehdään painotuksen läpinäkyvyyden saavuttamiseksi. Jokaisella lähteellä on julkaistu paino (näkyy /mittari-sivulla ja jokaisessa signaali-permalinkissä). 28 lähteellä lukija voi auditoida painotuksen 4 minuutissa. 60 lähteellä ei voi.',
    ], 'why28'),
    block('Miten painotus oikeasti toimii', [
      'Jokaisella lähteellä on perus­paino (0-10) joka heijastaa pitkän aikavälin tarkkuutta PUTKI HQ:n back-testatuissa callaiusissa. Yle Urheilu ja HockeyNews.fi kantavat korkeimmat perus­painot (9 / 10) koska niiden joukkue­uutispöydät ovat tuottaneet alhaisimman virhe­positiivi­määrän viimeisten 18 kuukauden aikana. OddsPortal kantaa 7:n koska sen aggregointi­logiikka satunnaisesti laskee kahdesti pehmeät vedonvälittäjät.',
      'Perus­painon päällä jokaisella signaalilla on tuoreus­kerroin (1,0× alle 2h iässä, laskien 0,4×:ään 24h jälkeen) ja vahvistus­kerroin (lähde joka on samaa mieltä vähintään kahden riippumattoman lähteen kanssa säilyttää painonsa; yksin­äänen lähde diskontataan 0,6×:ään). Yhdistetty paino tuottaa mittari­lukeman. Lähteitä ei voi cherry-pickata; putki on deterministinen.',
    ], 'weight'),
    block('Mitä tapahtuu kun lähteet ovat eri mieltä', [
      'Signaalit joissa painotettu erimielisyys ylittää konfiguroidun kynnyksen (nykyinen oletus: lähteiden välinen varianssi > 0,35 normalisoidussa pisteessä) lipputetaan KIISTETYIKSI. Mittari lukee "Myrsky" ja signaali julkaistaan eksplisiittisellä "lähteet eri mieltä" -kalloutilla itse­varman mittari­lukeman sijaan. Mieluummin näytämme epävarmuutta kuin teemme valhetta varmuudesta.',
      'Vuoden back-testissä ~8 % kaikista signaaleista osui KIISTETYKSI -tilaan. Nuo signaalit ovat juuri niitä joita kokeneet operaattorit lukevat tarkimmin — epävarmuus on todellinen tuote noina päivinä.',
    ], 'disagree'),
    block('Lähde­listan hallinto', [
      'Lähteitä voidaan lisätä, poistaa tai painottaa uudelleen. Jokainen muutos lokitetaan sivulla /paivityslog päivämäärällä, syyllä ja (jos muutos on reaktiivinen tunnettuun tarkkuus­vikaan) postmortem-linkillä. Tuorein muutos (2026-01-18): HockeyNews.fi painotettiin 8 → 9 6 kuukauden trailing-tarkkuuden 0,91 jälkeen siirto­päivä-callaisuissa. Edellinen (2025-12-04): IL (Ilmatieteen laitos) lisättiin painolla 6 sen jälkeen kun FMI lopetti avoimen datansa.',
      'Toimituksellinen vinouma: lähde joka koskaan toimii maksullisena PUTKI HQ -affiliaattina rajataan automaattisesti painoon 0. Emme maksa lähteille; lähteet eivät maksa meille; molemmat suunnat on dokumentoitu sivulla /affiliaatti.',
    ], 'gov'),
  ];

  return (
    <div data-testid="mittari-lahteet-article" className="min-h-screen">
      <Hero
        testId="mittari-lahteet"
        crumbTo="/mittari"
        crumbLabel="MITTARI"
        eyebrow={isEn ? 'SOURCES · DEEP DIVE' : 'LÄHTEET · SYVÄSUKELLUS'}
        headline={isEn ? '28 named sources, 6 categories, one weighted dial.' : '28 nimettyä lähdettä, 6 kategoriaa, yksi painotettu mittari.'}
        intro={isEn
          ? 'Mittari does not scrape Twitter. It aggregates 28 named, named-source feeds across 6 categories with published per-source weights. Below: the categories, how the weighting works, what we do when sources disagree, and how source-list changes are governed.'
          : 'Mittari ei kaiva Twitteristä. Se yhdistää 28 nimettyä lähdettä 6 kategoriassa julkaistuilla lähde­kohtaisilla painoilla. Alla: kategoriat, miten painotus toimii, mitä teemme kun lähteet ovat eri mieltä ja miten lähde­listan muutoksia hallitaan.'}
      />
      <section className="container-wide pb-10 max-w-3xl">
        <h2 className="display text-2xl sm:text-3xl mb-5" data-testid="mittari-lahteet-cats-h">
          {isEn ? 'The six categories' : 'Kuusi kategoriaa'}
        </h2>
        <div data-testid="mittari-lahteet-cats" style={{ borderTop: '1px solid var(--line)' }}>
          {cats.map((c, i) => (
            <div
              key={c.name}
              data-testid={`mittari-lahteet-cat-${i}`}
              className="py-4 grid sm:grid-cols-[1fr_64px] gap-4"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <div>
                <div className="font-bold mb-1" style={{ fontSize: 16, color: 'var(--ink)' }}>{c.name}</div>
                <div className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{c.examples}</div>
              </div>
              <div
                className="mono"
                style={{ fontSize: 22, letterSpacing: '0.05em', color: 'var(--ember-strong)', fontWeight: 700, textAlign: 'right' }}
              >
                {c.count}
              </div>
            </div>
          ))}
        </div>
      </section>
      {sections.map(renderSection)}
      <SourcesList
        testId="mittari-lahteet-sources"
        items={[
          'PUTKI HQ source library /source_map.py (commit-tracked, public via /api/mittari/copy)',
          'PUTKI HQ Operator Runbook §M-7 — source weighting governance',
          '/paivityslog — change log for every source-list edit since 2025-11',
          'THL Rahapelitutkimus 2023 (academic reference for trust calibration)',
        ]}
      />
      <InternalLinkStrip
        testId="mittari-lahteet-related"
        links={[
          { to: localiseUrl('/mittari', isEn), labelFi: 'Mittari', labelEn: 'Mittari', hintFi: 'Päivittäinen signaali­syöte näkyvissä etusivulla.', hintEn: 'The daily signals feed itself.' },
          { to: localiseUrl('/mestari/menetelma', isEn), labelFi: 'Mestari-menetelmä', labelEn: 'Mestari methodology', hintFi: 'Miten diagnostiikat pisteyttävät päätös­laadun.', hintEn: 'How the diagnostics score decision quality.' },
          { to: '/affiliaatti', labelFi: 'Affiliaattipolitiikka', labelEn: 'Affiliate policy', hintFi: 'Miten PUTKI HQ ansaitsee ja missä se julkistetaan.', hintEn: 'How PUTKI HQ earns and where it is disclosed.' },
          { to: '/paivityslog', labelFi: 'Päivitysloki', labelEn: 'Change log', hintFi: 'Kaikki lähde­listan muutokset.', hintEn: 'Every source-list change tracked.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={7} />
      </section>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
 * 3. /voita/usein-kysytyt — Voita FAQ explainer (FAQPage schema)
 * ───────────────────────────────────────────────────────────────*/
export const VoitaUseinKysytytArticle = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/voita/usein-kysytyt';
  const enUrl = 'https://putkihq.com/en/voita/faq';
  const canonical = isEn ? enUrl : fiUrl;
  const faqs = isEn ? [
    { q: 'Is Voita gambling?', a: 'No. Voita raffles are non-monetary prize draws conducted under the Finnish raffles framework (Arpajaislaki §27). Entry is free, no purchase is required, and there is no element of stake.' },
    { q: 'How do I enter?', a: 'Each raffle landing page (e.g. /voita/<slug>) lists the exact entry actions — typically subscribing to the PUTKI HQ Telegram channel or completing a free diagnostic. We never ask for payment.' },
    { q: 'When is the winner drawn?', a: 'Each raffle has a published draw date and time on its landing page. The draw is conducted in the back-office, the winner is recorded with a timestamp, and the result is published within 24 hours on the same landing page plus /voita.' },
    { q: 'Who is eligible?', a: 'Anyone 18 years or older who is a resident of Finland or the EU/EEA, unless the individual raffle says otherwise. Employees of PUTKI HQ and immediate family are excluded. No purchase, no subscription fee, no element of stake.' },
    { q: 'How are winners contacted?', a: 'The winner is contacted via the channel they used to enter (Telegram DM, email, or in-app message depending on the raffle). If we cannot reach the winner within 14 days, the prize rolls into the next raffle and a new winner is drawn.' },
    { q: 'Is there a partner / sponsor?', a: 'Some raffles are sponsored by operators (Smartico-listed partners only). The sponsor is displayed prominently on the landing page along with the commercial disclosure required by /affiliaatti policy. PUTKI HQ retains full editorial control over the raffle mechanics.' },
    { q: 'Is the prize taxable?', a: 'Non-monetary raffle prizes under the Finnish raffles framework are tax-exempt for the winner when the organising publication operates under §27. PUTKI HQ pays the prize value as a non-cash item; we strongly recommend the winner verifies their own tax situation with Verohallinto if the prize value exceeds €5 000.' },
    { q: 'What if I do not want to be publicly named as a winner?', a: 'We honour pseudonymity on request. The default public announcement uses first name + city. Winners can request first-name-only, initials-only, or full anonymity (the raffle still publishes "Winner drawn" with the timestamp — the absence of name is the privacy preserve).' },
    { q: 'Can I see past winners?', a: 'Yes. /voita lists every completed raffle with the winner field populated (subject to the pseudonymity choice above). The historical archive goes back to the platform launch.' },
    { q: 'How does this relate to the Finnish Gambling Act 2025/2027?', a: 'The new act does not change the legal status of non-monetary free-entry raffles. Voita continues under Arpajaislaki §27 unchanged after 2027-07-01. We documented our position fully on /saantely/reform-2027.' },
  ] : [
    { q: 'Onko Voita rahapelaamista?', a: 'Ei. Voita-arvonnat ovat ei-rahamääräisiä palkinto­arvontoja jotka toteutetaan Suomen arpajais­lain (§27) puitteissa. Osallistuminen on ilmaista, ostoa ei vaadita, eikä panos­ta ole.' },
    { q: 'Miten osallistun?', a: 'Jokaisen arvonnan laskeutumissivu (esim. /voita/<slug>) listaa tarkat osallistumis­toimet — yleensä PUTKI HQ -Telegram-kanavan tilaaminen tai ilmaisen diagnostiikan tekeminen. Emme koskaan pyydä maksua.' },
    { q: 'Milloin voittaja arvotaan?', a: 'Jokaisella arvonnalla on julkaistu arvonta­päivä ja -aika sen laskeutumis­sivulla. Arvonta suoritetaan back-officessa, voittaja kirjataan aika­leiman kanssa ja tulos julkaistaan 24 tunnin sisällä samalla laskeutumis­sivulla sekä /voita-sivulla.' },
    { q: 'Kuka voi osallistua?', a: '18-vuotta täyttänyt Suomen tai EU/ETA:n asukas, ellei yksittäinen arvonta sano muuta. PUTKI HQ:n työntekijät ja heidän lähiomaisensa eivät voi osallistua. Ei ostoa, ei tilausmaksua, ei panosta.' },
    { q: 'Miten voittajaan otetaan yhteyttä?', a: 'Voittajaan otetaan yhteyttä sen kanavan kautta jolla hän osallistui (Telegram-DM, sähköposti tai sovelluksen sisäinen viesti arvonnasta riippuen). Jos voittajaa ei tavoiteta 14 vrk:n sisällä, palkinto siirtyy seuraavaan arvontaan ja uusi voittaja arvotaan.' },
    { q: 'Onko arvontaa sponsoroidaan?', a: 'Osa arvonnoista on operaattori­sponsoroituja (vain Smartico-listatut kumppanit). Sponsori näkyy selkeästi laskeutumis­sivulla yhdessä /affiliaatti-politiikan vaatiman kaupallisen julkistuksen kanssa. PUTKI HQ säilyttää täyden toimituksellisen kontrollin arvonta­mekaniikasta.' },
    { q: 'Onko palkinto verollinen?', a: 'Ei-rahamääräiset arvonta­palkinnot Suomen arpajais­laissa ovat voittajalle vero­vapaita kun järjestävä julkaisu toimii §27 puitteissa. PUTKI HQ maksaa palkinnon ei-rahamääräisenä; suosittelemme vahvasti että voittaja varmistaa oman vero­tilanteensa Verohallinnosta jos palkinnon arvo ylittää 5 000 €.' },
    { q: 'Mitä jos en halua nimeäni julkisesti voittajana?', a: 'Kunnioitamme pseudonymiteettiä pyynnöstä. Oletus on etunimi + paikkakunta. Voittajat voivat pyytää etunimen vain, nimikirjaimet vain tai täyden anonymiteetin (arvonta julkaisee silti "Voittaja arvottu" aikaleimalla — nimen poissaolo on yksityisyyden suoja).' },
    { q: 'Voinko nähdä aiemmat voittajat?', a: 'Kyllä. /voita-sivu listaa kaikki päättyneet arvonnat joissa voittaja-kenttä on täytetty (yo. pseudonymiteetti­valinnan mukaisesti). Historiallinen arkisto ulottuu alustan käynnistymiseen.' },
    { q: 'Miten tämä liittyy Suomen rahapelilakiin 2025/2027?', a: 'Uusi laki ei muuta ei-rahamääräisten ilmais­osallistumis­arvontojen oikeudellista asemaa. Voita jatkuu Arpajais­lain §27 puitteissa muuttumattomana 1.7.2027 jälkeen. Olemme dokumentoineet asemaamme täydellisesti sivulla /saantely/reform-2027.' },
  ];

  useDocumentMeta({
    title: isEn ? 'Voita raffles — FAQ · PUTKI HQ' : 'Voita-arvonnat — kysytyt · PUTKI HQ',
    description: isEn
      ? 'Free-entry raffle FAQ. Eligibility, draw mechanics, taxation, post-2027 status. PUTKI HQ operates under Arpajaislaki §27.'
      : 'Ilmais­osallistumis­arvontojen FAQ. Osallistumis­oikeus, arvonta­mekaniikka, verotus, 2027 jälkeinen status. PUTKI HQ toimii Arpajais­lain §27 puitteissa.',
    ogTitle: isEn ? 'Voita raffles — FAQ' : 'Voita-arvonnat — kysytyt',
    ogImage: pageOgUrl('voita/usein-kysytyt', isEn),
    ogUrl: canonical,
    twitterCard: 'summary_large_image',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Voita raffles — FAQ' : 'Voita-arvonnat — kysytyt', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: 'Voita', item: 'https://putkihq.com/voita' },
      { name: 'FAQ', item: canonical },
    ]),
    faqSchema(faqs),
  ]);

  return (
    <div data-testid="voita-faq-article" className="min-h-screen">
      <Hero
        testId="voita-faq"
        crumbTo="/voita"
        crumbLabel="VOITA"
        eyebrow={isEn ? 'FAQ · OFFICIAL' : 'KYSYTYT · VIRALLINEN'}
        headline={isEn ? 'Voita raffles — 10 questions, plain answers.' : 'Voita-arvonnat — 10 kysymystä, suorat vastaukset.'}
        intro={isEn
          ? 'PUTKI HQ runs free-entry, non-monetary raffles under the Finnish Arpajaislaki §27 framework. No purchase, no element of stake, no gambling. Below: the 10 questions readers ask most often.'
          : 'PUTKI HQ pyörittää ilmais­osallistuvia, ei-rahamääräisiä arvontoja Suomen Arpajais­lain §27 puitteissa. Ei ostoa, ei panosta, ei rahapelaamista. Alla: 10 kysymystä joita lukijat kysyvät useimmin.'}
      />
      {renderFaq('voita-faq', faqs)}
      <SourcesList
        testId="voita-faq-sources"
        items={[
          'Arpajaislaki (1047/2001) — Finlex',
          'Poliisihallitus — Arpajaisten valvonta (poliisi.fi)',
          'Verohallinto — Arvontavoittojen verotus (vero.fi)',
          'HE 167/2025 vp — uusi rahapelilaki, jonka §6 ei kosketa §27-arvontoja',
          'PUTKI HQ /voita arkistosivu (julkiset voittaja­merkinnät)',
        ]}
      />
      <InternalLinkStrip
        testId="voita-faq-related"
        links={[
          { to: localiseUrl('/voita', isEn), labelFi: 'Voita-etusivu', labelEn: 'Voita home', hintFi: 'Aktiiviset arvonnat ja aiemmat voittajat.', hintEn: 'Active raffles + past winners.' },
          { to: '/voita/saannot', labelFi: 'Voita-säännöt', labelEn: 'Voita rules', hintFi: 'Täydelliset osallistumis­ehdot pdf:nä.', hintEn: 'Full T&C document.' },
          { to: localiseUrl('/saantely/reform-2027', isEn), labelFi: 'Sääntely 2027', labelEn: 'Regulation 2027', hintFi: 'Voita-arvonnat säilyvät uudistuksen jälkeen.', hintEn: 'Voita raffles survive the reform unchanged.' },
          { to: '/affiliaatti', labelFi: 'Affiliaattipolitiikka', labelEn: 'Affiliate policy', hintFi: 'Sponsoroitujen arvontojen julkistus.', hintEn: 'Sponsored raffle disclosure.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={6} />
      </section>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────
 * 4. /profiilit/dioni-q-and-a — Profiilit founder Q&A
 * ───────────────────────────────────────────────────────────────*/
export const ProfiilitFounderQAArticle = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/profiilit/dioni-q-and-a';
  const enUrl = 'https://putkihq.com/en/profiilit/dioni-q-and-a';
  const canonical = isEn ? enUrl : fiUrl;
  const faqs = isEn ? [
    { q: 'Why launch PUTKI HQ now, ahead of the 2027 reform?', a: 'Because a comparison publication built in 2027 inside the new licensed market looks like an operator marketing arm. Building it in 2026 — outside the licensed system, under §6 of the act explicitly — establishes the editorial independence first. That is what makes the publication credible after July 2027.' },
    { q: 'What is the editorial line in one sentence?', a: 'Gambling math is honest; the marketing wrapped around it usually is not. PUTKI HQ unwraps the math.' },
    { q: 'Why Mittari and Mestari? Why not just operator reviews?', a: 'Operator reviews are downstream. A reader who arrives at an operator review is already choosing between two products that both cost them money. Mittari and Mestari work upstream of that choice — the daily signal feed forces a pre-bet decision framework, and the diagnostic surfaces whether the reader has one. The reviews then serve a reader who has already done the upstream work.' },
    { q: 'You use a pseudonym (Eino K.) for some editorial. Why?', a: 'Some pieces are written collaboratively or use a house style that is not attributable to a single named author. Eino K. is that house byline, and the disclosure is on every page that uses it. Bylined pieces with a real name (mine) carry my actual name — Dioni Bouropoulos. The pseudonym disclosure is on /toimitus and is mirrored under the founder block on /mittari.' },
    { q: 'How does PUTKI HQ make money?', a: 'Affiliate commissions from licensed operators, capped at a weighted maximum of 5/100 points on any review per /affiliaatti, with clear disclosure on every commercial link. No paid placements, no sponsored content disguised as editorial, no source payments. The economic model is documented end-to-end on /affiliaatti.' },
    { q: 'What happens if a partner asks you to soften a negative review?', a: 'We refuse. The reviewer-partner relationship is one-way: we can decline to feature a partner; the partner cannot influence what we say about them once featured. This has been tested twice in 2025 — both partners stayed; both reviews stayed unchanged. The §6 framework after July 2027 makes this explicit in law, but we operate that way already.' },
    { q: 'Is there a long-term ambition beyond comparison content?', a: 'Yes. The 2027 market will produce structural questions about player protection, regulator effectiveness, sponsorship spillover into youth sport, and the long-run social cost of legalising online casinos. PUTKI HQ is positioned to cover those questions because the editorial foundation — named sources, transparent weighting, separated commercial layer — is the foundation that long-run reporting requires.' },
    { q: 'What would make you shut PUTKI HQ down?', a: 'If the publication ever became economically dependent on a single partner, or if I could no longer guarantee the editorial line against commercial pressure. Both are documented exit triggers in the operator playbook. Neither is close.' },
  ] : [
    { q: 'Miksi käynnistää PUTKI HQ nyt, ennen 2027-uudistusta?', a: 'Koska vuonna 2027 rakennettu vertailujulkaisu uuden lisensoidun markkinan sisällä näyttää operaattorien markkinointi­käden­jatkeelta. Sen rakentaminen 2026:ssa — lisensoidun järjestelmän ulkopuolella, lain §6:n alla eksplisiittisesti — vahvistaa toimituksellisen riippumattomuuden ensin. Tämä tekee julkaisusta uskottavan heinäkuun 2027 jälkeen.' },
    { q: 'Mikä on toimituksellinen linja yhdessä lauseessa?', a: 'Uhkapeli­matematiikka on rehellistä; sen ympärille käärittu markkinointi on yleensä ei. PUTKI HQ purkaa matematiikan kääreestä.' },
    { q: 'Miksi Mittari ja Mestari? Miksi ei pelkkiä operaattori­arviointeja?', a: 'Operaattori­arvioinnit ovat ala­virtaa. Lukija joka päätyy operaattori­arvioon on jo valitsemassa kahden tuotteen välillä jotka molemmat maksavat hänelle rahaa. Mittari ja Mestari toimivat tämän valinnan ylä­virrassa — päivittäinen signaali­syöte pakottaa pre-bet päätös­kehyksen, ja diagnostiikka pintaan, onko sellainen kehys lukijalla. Arvioinnit sitten palvelevat lukijaa joka on jo tehnyt ylä­virran työn.' },
    { q: 'Käytät pseudonyymiä (Eino K.) osassa toimitusta. Miksi?', a: 'Osa jutuista on kirjoitettu yhteistyössä tai käyttää talotyyliä jota ei voi attributoida yhdelle nimetylle kirjoittajalle. Eino K. on tämä talo­byline, ja julkistus on jokaisella sivulla jota se käytetään. Bylined-jutut oikealla nimellä (minun) kantavat oikean nimeni — Dioni Bouropoulos. Pseudonymi­julkistus on sivulla /toimitus ja peilattu founder-blokissa /mittari-sivulla.' },
    { q: 'Miten PUTKI HQ tekee rahaa?', a: 'Lisensoitujen operaattorien affiliaatti-komissioista, rajattu painotetulla maksimilla 5/100-pistettä arviossa /affiliaatti-politiikan mukaisesti, selkeällä julkistuksella jokaisessa kaupallisessa linkissä. Ei maksullisia sijoituksia, ei toimitukselliseksi naamioitua sponsoroitua sisältöä, ei lähde­maksuja. Talous­malli on dokumentoitu kokonaan sivulla /affiliaatti.' },
    { q: 'Mitä tapahtuu jos kumppani pyytää pehmentämään negatiivista arviota?', a: 'Kieltäydymme. Arvostelija-kumppani-suhde on yksi­suuntainen: voimme kieltäytyä esittelemästä kumppania; kumppani ei voi vaikuttaa siihen mitä sanomme heistä kun kerran on esitelty. Tämä on testattu kahdesti 2025 — molemmat kumppanit jäivät; molemmat arviot säilyivät muuttumattomina. §6-kehys heinäkuun 2027 jälkeen tekee tämän eksplisiittiseksi laissa, mutta toimimme jo nyt näin.' },
    { q: 'Onko pitkän aikavälin tavoite muu kuin vertailusisältö?', a: 'On. 2027-markkina tuottaa rakenteellisia kysymyksiä pelaajansuojasta, sääntelyviranomaisen tehokkuudesta, sponsorointi­läikästä nuoriso­urheiluun ja online-kasinoiden laillistamisen pitkän aikavälin sosiaalisesta kustannuksesta. PUTKI HQ on asetettu kattamaan nuo kysymykset, koska toimituksellinen pohja — nimetyt lähteet, läpinäkyvä painotus, eroteltu kaupallinen kerros — on pohja joka pitkän aikavälin raportointi vaatii.' },
    { q: 'Mikä saisi sinut lopettamaan PUTKI HQ:n?', a: 'Jos julkaisu tulisi koskaan taloudellisesti riippuvaiseksi yhdestä kumppanista, tai jos en voisi enää taata toimituksellista linjaa kaupallista painetta vastaan. Molemmat ovat dokumentoituja poistumis­triggereitä operaattorin playbookissa. Kumpikaan ei ole lähellä.' },
  ];

  useDocumentMeta({
    title: isEn ? 'Dioni Bouropoulos — PUTKI HQ founder Q&A · PUTKI HQ' : 'Dioni Bouropoulos — PUTKI HQ -perustajan Q&A · PUTKI HQ',
    description: isEn
      ? 'Why launch ahead of the 2027 reform, how PUTKI HQ makes money, and what would make the founder shut it down. Named, on-the-record.'
      : 'Miksi käynnistää ennen 2027-uudistusta, miten PUTKI HQ tekee rahaa, ja mikä saisi perustajan lopettamaan sen. Nimellä, virallisesti.',
    ogTitle: isEn ? 'Dioni Bouropoulos — PUTKI HQ founder Q&A' : 'Dioni Bouropoulos — PUTKI HQ -perustajan Q&A',
    ogImage: pageOgUrl('profiilit/dioni-q-and-a', isEn),
    ogUrl: canonical,
    twitterCard: 'summary_large_image',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Dioni Bouropoulos — PUTKI HQ founder Q&A' : 'Dioni Bouropoulos — PUTKI HQ -perustajan Q&A', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: 'Profiilit', item: 'https://putkihq.com/profiilit' },
      { name: 'Q&A', item: canonical },
    ]),
    faqSchema(faqs),
  ]);

  return (
    <div data-testid="profiilit-founder-qa-article" className="min-h-screen">
      <Hero
        testId="profiilit-founder-qa"
        crumbTo="/profiilit"
        crumbLabel="PROFIILIT"
        eyebrow={isEn ? 'FOUNDER · Q&A' : 'PERUSTAJA · Q&A'}
        headline={isEn ? 'Dioni Bouropoulos — eight questions, on the record.' : 'Dioni Bouropoulos — kahdeksan kysymystä, virallisesti.'}
        intro={isEn
          ? 'PUTKI HQ founder Dioni Bouropoulos answers eight on-the-record questions: why launch ahead of the 2027 reform, what the editorial line is, how the publication earns, what happens when partners push back, and what would shut PUTKI HQ down.'
          : 'PUTKI HQ:n perustaja Dioni Bouropoulos vastaa kahdeksaan viralliseen kysymykseen: miksi käynnistää ennen 2027-uudistusta, mikä toimituksellinen linja on, miten julkaisu ansaitsee, mitä tapahtuu kun kumppanit puuskahtavat, ja mikä lopettaisi PUTKI HQ:n.'}
      />
      {renderFaq('profiilit-founder-qa', faqs)}
      <SourcesList
        testId="profiilit-founder-qa-sources"
        items={[
          'PUTKI HQ /toimitus — founder block + pseudonym disclosure',
          'PUTKI HQ /affiliaatti — full commercial model documentation',
          'HE 167/2025 vp §6 — rahapeliasiamies classification',
          'PUTKI HQ Operator Runbook §exit-triggers (sisäinen dokumentti)',
        ]}
      />
      <InternalLinkStrip
        testId="profiilit-founder-qa-related"
        links={[
          { to: '/toimitus', labelFi: 'Toimitus', labelEn: 'Editorial team', hintFi: 'Founder-blokki + pseudonymi­julkistus.', hintEn: 'Founder block + pseudonym disclosure.' },
          { to: '/affiliaatti', labelFi: 'Affiliaattipolitiikka', labelEn: 'Affiliate policy', hintFi: 'Talous­malli kokonaan auki.', hintEn: 'Full commercial model opened up.' },
          { to: localiseUrl('/saantely/reform-2027', isEn), labelFi: 'Sääntely 2027', labelEn: 'Regulation 2027', hintFi: 'Konteksti perustajan käynnistämis­ajalle.', hintEn: 'The context for the founder’s launch timing.' },
          { to: '/profiilit', labelFi: 'Profiilit-arkisto', labelEn: 'Profiilit archive', hintFi: 'Lisää nimettyjä profiileja.', hintEn: 'More named profiles.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter byline="Dioni Bouropoulos" updatedAt="2026-02-01T09:00:00Z" readMinutes={7} />
      </section>
    </div>
  );
};

export default MestariMenetelmaArticle;
