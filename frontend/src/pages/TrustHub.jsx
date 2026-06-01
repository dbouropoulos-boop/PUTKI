import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import useLocalisedCanonical from '../hooks/useLocalisedCanonical';
import { EditorialFooter } from '../components/EditorialFooter';
import InternalLinkStrip from '../components/InternalLinkStrip';

/**
 * Luotettavuus / Trust hub — Phase 4 capstone (iter90).
 *
 * One narrative URL that wires together the trust-signal artefacts
 * shipped in waves 2 + 4:
 *
 *   1. Three editorial principles ("what trust looks like here")
 *   2. The 3 wave-4 data pages (Mestari dataset · Voita ledger · Mittari accuracy)
 *   3. The 4 wave-2 long-form articles (Mestari methodology · Mittari sources · Voita FAQ · founder Q&A)
 *   4. "Where the numbers fall short today" honesty block
 *   5. CTA to the operator runbook / source map
 *
 * FI canonical: /luotettavuus     EN canonical: /en/trust
 */

const FI_PRINCIPLES = [
  {
    eyebrow: 'PRINSIIPPI · 01',
    title: 'Lähde ennen mielipidettä',
    body: 'Jokainen luku tällä sivustolla sidotaan nimettyyn julkiseen lähteeseen tai sisäiseen dokumenttiin jonka päivämäärä ja versiointi on jäljitettävissä. Anonyymejä "sisäpiiri­tietoja" ei julkaista.',
  },
  {
    eyebrow: 'PRINSIIPPI · 02',
    title: 'Mittari ennen markkinointia',
    body: 'Mittari, Mestari ja Voita esitetään lukuina ja kvartiileina, eivät huudahduksina. Kun back-test ei ole vielä valmis, sanomme niin — ei keksitä numeroita.',
  },
  {
    eyebrow: 'PRINSIIPPI · 03',
    title: 'Erotettava kaupallinen kerros',
    body: 'Affiliaatti­linkit on merkitty selkeästi jokaisessa kontekstissa. Sponsorit eivät vaikuta toimituksellisiin valintoihin — kahdesti testattu 2025.',
  },
];

const EN_PRINCIPLES = [
  {
    eyebrow: 'PRINCIPLE · 01',
    title: 'Source before opinion',
    body: 'Every number on this site is bound to a named public source or an internal document with a date and version that can be traced. No anonymous "insider tips".',
  },
  {
    eyebrow: 'PRINCIPLE · 02',
    title: 'Measurement before marketing',
    body: 'Mittari, Mestari and Voita are presented as numbers and quartiles, not exclamations. When a back-test is not ready yet, we say so — we do not fabricate numbers.',
  },
  {
    eyebrow: 'PRINCIPLE · 03',
    title: 'Separated commercial layer',
    body: 'Affiliate links are clearly marked in every context. Sponsors do not influence editorial choices — tested twice during 2025.',
  },
];

const dataPages = (isEn) => [
  {
    eyebrow: isEn ? 'DATA · MESTARI' : 'DATA · MESTARI',
    title: isEn ? 'Mestari diagnostics dataset' : 'Mestari-diagnostiikan aineisto',
    body: isEn
      ? 'Anonymised quartiles + N for every completed diagnostic, across the three games. Refreshed on every read.'
      : 'Anonymisoituja kvartiileja + N jokaisesta valmistuneesta diagnostiikasta, kolmessa pelissä. Päivittyy joka latauksella.',
    to: isEn ? '/en/trust/mestari-dataset' : '/trust/mestari-aineisto',
  },
  {
    eyebrow: isEn ? 'DATA · VOITA' : 'DATA · VOITA',
    title: isEn ? 'Voita raffles ledger' : 'Voita-arvontojen tilikirja',
    body: isEn
      ? 'Every concluded Voita raffle with winner stamp + timestamps. Append-only.'
      : 'Jokainen päättynyt Voita-arvonta voittaja­merkinnällä + aika­leimoilla. Vain-lisättävä.',
    to: isEn ? '/en/trust/voita-ledger' : '/trust/voita-tilikirja',
  },
  {
    eyebrow: isEn ? 'DATA · MITTARI' : 'DATA · MITTARI',
    title: isEn ? 'Mittari accuracy back-test' : 'Mittarin tarkkuus -back-test',
    body: isEn
      ? 'Rolling 90-day per-class hit rate. Today shows "back-test in progress" — flips to live numbers automatically once a class crosses N ≥ 30.'
      : 'Rullaavaa 90 päivän luokka­kohtaista hit-ratea. Tällä hetkellä näyttää "back-test käynnissä" — vaihtuu live-lukuihin automaattisesti, kun luokka ylittää N ≥ 30.',
    to: isEn ? '/en/trust/mittari-accuracy' : '/trust/mittari-tarkkuus',
  },
];

const articles = (isEn) => [
  {
    eyebrow: isEn ? 'METHOD · MESTARI' : 'METODI · MESTARI',
    title: isEn ? 'How Mestari scores you' : 'Miten Mestari pisteyttää',
    body: isEn
      ? 'The 3-axis multi-question instrument, the Cronbach-α calibration cycle, what the result card claims and does not claim.'
      : '3-akselinen moni­kysymys­instrumentti, Cronbachin α -kalibrointi­sykli, mitä tuloskortti väittää ja mitä ei.',
    to: isEn ? '/en/mestari/methodology' : '/mestari/menetelma',
  },
  {
    eyebrow: isEn ? 'METHOD · MITTARI' : 'METODI · MITTARI',
    title: isEn ? 'The 28 named sources' : '28 nimettyä lähdettä',
    body: isEn
      ? '6 categories, published weights, the contested-signal handling rule, and how source-list changes are governed.'
      : '6 kategoriaa, julkaistut painot, kiistetyn signaalin käsittely­sääntö, ja miten lähde­listan muutoksia hallitaan.',
    to: isEn ? '/en/mittari/sources' : '/mittari/lahteet',
  },
  {
    eyebrow: isEn ? 'POSITION · VOITA' : 'ASEMA · VOITA',
    title: isEn ? 'Voita raffle FAQ' : 'Voita-arvontojen FAQ',
    body: isEn
      ? '10 questions on eligibility, draw mechanics, taxation and the publication’s position under Arpajaislaki §27.'
      : '10 kysymystä osallistumisesta, arvonta­mekaniikasta, verotuksesta ja julkaisun asemasta Arpajais­lain §27 alla.',
    to: isEn ? '/en/voita/faq' : '/voita/usein-kysytyt',
  },
  {
    eyebrow: isEn ? 'PROFILE · FOUNDER' : 'PROFIILI · PERUSTAJA',
    title: isEn ? 'Dioni Bouropoulos Q&A' : 'Dioni Bouropoulos · Q&A',
    body: isEn
      ? '8 on-the-record questions — why launch ahead of 2027, how PUTKI HQ makes money, what would shut it down.'
      : '8 virallista kysymystä — miksi käynnistää ennen 2027:ää, miten PUTKI HQ tekee rahaa, mikä lopettaisi sen.',
    to: isEn ? '/en/profiilit/dioni-q-and-a' : '/profiilit/dioni-q-and-a',
  },
];

const Card = ({ row, testId }) => (
  <Link
    to={row.to}
    data-testid={testId}
    className="block p-5 sm:p-6 transition-colors"
    style={{ border: '1px solid var(--line)', background: 'var(--bg)', textDecoration: 'none' }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ember-strong)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
  >
    <div
      className="mono mb-2"
      style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ember-strong)', fontWeight: 700 }}
    >{row.eyebrow}</div>
    <h3 className="font-bold mb-2" style={{ fontSize: 18, lineHeight: 1.25, color: 'var(--ink)' }}>{row.title}</h3>
    <p className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{row.body}</p>
    <div
      className="mono mt-3"
      style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--ember-strong)', fontWeight: 700 }}
    >READ →</div>
  </Link>
);

const TrustHub = ({ forceLang } = {}) => {
  const { lang, isEn, canonical, alternates } = useLocalisedCanonical({
    fiPath: '/luotettavuus', enPath: '/en/trust', forceLang,
  });
  void useLang;

  const ogImage = `${process.env.REACT_APP_BACKEND_URL}/api/og/page/${isEn ? 'trust-hub-en' : 'trust-hub-fi'}`;

  useDocumentMeta({
    title: isEn ? 'Trust — how PUTKI HQ measures itself · PUTKI HQ' : 'Luotettavuus — miten PUTKI HQ mittaa itseään · PUTKI HQ',
    description: isEn
      ? 'Three principles, three live datasets, four long-form methodology pieces. The single page that shows how PUTKI HQ keeps itself accountable.'
      : 'Kolme periaatetta, kolme live-aineistoa, neljä menetelmä­juttua. Yksi sivu joka näyttää miten PUTKI HQ pitää itsensä vastuullisena.',
    ogTitle: isEn ? 'Trust — how PUTKI HQ measures itself' : 'Luotettavuus — miten PUTKI HQ mittaa itseään',
    ogImage,
    ogUrl: canonical,
    twitterCard: 'summary_large_image',
    canonical,
    alternates,
  });
  useJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: isEn ? 'Trust — how PUTKI HQ measures itself' : 'Luotettavuus — miten PUTKI HQ mittaa itseään',
      url: canonical,
      inLanguage: isEn ? 'en-FI' : 'fi-FI',
      publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
      dateModified: new Date().toISOString().slice(0, 10),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
        { '@type': 'ListItem', position: 2, name: isEn ? 'Trust' : 'Luotettavuus', item: canonical },
      ],
    },
  ]);

  const principles = isEn ? EN_PRINCIPLES : FI_PRINCIPLES;

  return (
    <div data-testid="trust-hub-page" className="min-h-screen">
      {/* Hero */}
      <section className="container-wide pt-10 sm:pt-16 pb-8 sm:pb-12 max-w-3xl">
        <div className="eyebrow mb-4" data-testid="trust-hub-eyebrow" style={{ color: 'var(--ember-strong)' }}>
          {isEn ? 'TRUST · CAPSTONE' : 'LUOTETTAVUUS · KOOSTE'}
        </div>
        <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid="trust-hub-headline">
          {isEn ? 'How PUTKI HQ measures itself.' : 'Miten PUTKI HQ mittaa itseään.'}
        </h1>
        <p className="prose-mittari mt-6" data-testid="trust-hub-intro" style={{ fontSize: 17, lineHeight: 1.6 }}>
          {isEn
            ? 'A publication that publishes numbers should publish the numbers about itself first. Below: three editorial principles, three live datasets refreshed on every read, and four long-form methodology pieces. Nothing here is marketing copy — every block links to a primary artefact.'
            : 'Julkaisun joka julkaisee numeroita pitäisi julkaista numerot itsestään ensin. Alla: kolme toimituksellista periaatetta, kolme live-aineistoa jotka päivittyvät joka latauksella, ja neljä menetelmä­juttua. Mikään tässä ei ole markkinointi­tekstiä — jokainen blokki linkkaa raaka-artefaktiin.'}
        </p>
      </section>

      {/* Principles */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="trust-hub-principles-h">
          {isEn ? 'Three principles' : 'Kolme periaatetta'}
        </h2>
        <div className="grid gap-5 sm:grid-cols-3" data-testid="trust-hub-principles">
          {principles.map((p, i) => (
            <div
              key={p.title}
              data-testid={`trust-hub-principle-${i}`}
              className="p-5"
              style={{ borderLeft: '3px solid var(--ember)', background: 'var(--ember-soft)' }}
            >
              <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ember-strong)', fontWeight: 700 }}>{p.eyebrow}</div>
              <h3 className="font-bold mb-2" style={{ fontSize: 17, color: 'var(--ink)' }}>{p.title}</h3>
              <p className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live data section */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="trust-hub-data-h">
          {isEn ? 'Three live datasets' : 'Kolme live-aineistoa'}
        </h2>
        <p className="font-serif max-w-3xl mb-6" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
          {isEn
            ? 'Fetched fresh on every page load. No fabricated rows. When the underlying ledger is empty, the page says so — never invents numbers to fill the table.'
            : 'Haetaan tuoreena joka sivun latauksella. Ei keksittyjä rivejä. Kun taustalla oleva tilikirja on tyhjä, sivu sanoo niin — ei keksi numeroita pöydän täyttämiseksi.'}
        </p>
        <div className="grid gap-5 sm:grid-cols-3" data-testid="trust-hub-data">
          {dataPages(isEn).map((d, i) => (
            <Card key={d.to} row={d} testId={`trust-hub-data-${i}`} />
          ))}
        </div>
      </section>

      {/* Methodology articles */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="trust-hub-articles-h">
          {isEn ? 'Four methodology pieces' : 'Neljä menetelmä­juttua'}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2" data-testid="trust-hub-articles">
          {articles(isEn).map((a, i) => (
            <Card key={a.to} row={a} testId={`trust-hub-article-${i}`} />
          ))}
        </div>
      </section>

      {/* Honest gaps section */}
      <section className="container-wide pb-12 max-w-3xl">
        <h2 className="display text-2xl sm:text-3xl mb-4" data-testid="trust-hub-gaps-h">
          {isEn ? 'Where the numbers fall short today' : 'Missä numerot eivät vielä yllä'}
        </h2>
        <div
          data-testid="trust-hub-gaps"
          className="p-5 sm:p-6"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
        >
          <ul className="font-serif space-y-3" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            <li>
              <strong style={{ color: 'var(--ink)' }}>{isEn ? 'Mittari back-test:' : 'Mittari-back-test:'}</strong>{' '}
              {isEn
                ? 'currently in scaffold mode. Signals are being snapshotted daily; an editor grades them weekly. The public table flips to live numbers once any class crosses N ≥ 30 inside the rolling 90-day window.'
                : 'tällä hetkellä scaffold-tilassa. Signaaleita snapshotataan päivittäin; toimittaja arvostelee viikoittain. Julkinen taulukko vaihtuu live-lukuihin, kun mikä tahansa luokka ylittää N ≥ 30 rullaavassa 90 päivän ikkunassa.'}
            </li>
            <li>
              <strong style={{ color: 'var(--ink)' }}>{isEn ? 'Mestari sample:' : 'Mestari-otos:'}</strong>{' '}
              {isEn
                ? 'currently small (~12 400 runs aggregated by Feb 2026). The quartile bars on the dataset page are real but the tails are sparse. Re-calibration runs quarterly with a published Cronbach-α threshold.'
                : 'tällä hetkellä pieni (~12 400 ajoa helmikuuhun 2026 mennessä). Kvartiili­palkit aineisto-sivulla ovat oikeita mutta hännät ovat harvat. Uudelleen­kalibrointi ajetaan neljännes­vuosittain julkaistulla Cronbachin α -kynnyksellä.'}
            </li>
            <li>
              <strong style={{ color: 'var(--ink)' }}>{isEn ? 'Voita pseudonymity:' : 'Voita-pseudonymiteetti:'}</strong>{' '}
              {isEn
                ? 'winners pick how they appear in the ledger. The timestamp is the public integrity proof. Anonymous winners do not show a name — they show "Winner drawn" + the timestamp.'
                : 'voittajat valitsevat itse miten näkyvät tilikirjassa. Aika­leima on julkinen rehellisyyden todiste. Anonyymit voittajat eivät näytä nimeä — näytetään "Voittaja arvottu" + aikaleima.'}
            </li>
          </ul>
        </div>
      </section>

      <InternalLinkStrip
        testId="trust-hub-related"
        links={[
          { to: '/affiliaatti', labelFi: 'Affiliaattipolitiikkamme', labelEn: 'Our affiliate policy', hintFi: 'Talousmalli kokonaan dokumentoituna.', hintEn: 'Commercial model fully documented.' },
          { to: '/saantely/reform-2027', labelFi: 'Sääntely 2027', labelEn: 'Regulation 2027', hintFi: 'Konteksti uudelle markkinalle.', hintEn: 'Context for the new market.' },
          { to: '/toimitus', labelFi: 'Toimitus', labelEn: 'Editorial team', hintFi: 'Bylineet, pseudonyymit, vastuut.', hintEn: 'Bylines, pseudonyms, responsibilities.' },
          { to: '/paivityslog', labelFi: 'Päivitysloki', labelEn: 'Change log', hintFi: 'Jokainen metodologia­muutos avoimena.', hintEn: 'Every methodology change in the open.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={5} />
      </section>
    </div>
  );
};

export default TrustHub;
export { TrustHub };
