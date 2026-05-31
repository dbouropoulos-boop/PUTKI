import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import useLocalisedCanonical from '../hooks/useLocalisedCanonical';
import { EditorialFooter } from '../components/EditorialFooter';
import InternalLinkStrip from '../components/InternalLinkStrip';

/**
 * /saantely/reform-2027 — Finnish Gambling Act 2025/2027 deep briefing.
 *
 * Phase 4 P1 hub: long-form, named-source, structured-data-ready
 * coverage of the December 2025 reform that takes effect 2027-07-01.
 *
 * Sourcing notes (public domain, named):
 *   - HE 167/2025 vp (Finnish government bill, published 2025-09-25)
 *   - Eduskunta vote 2025-12-09 (final passage)
 *   - Sisäministeriö briefing 2025-12-10
 *   - Veikkaus Oy strategy update 2026-01-21
 *
 * This is editorial commentary, NOT legal advice. Page is bilingual
 * (FI default · EN flip via useLang). PUTKI HQ is a comparison site /
 * editorial publication under the reform's §6 classification.
 */

const TIMELINE_FI = [
  { date: '2025-09-25', label: 'HE 167/2025 vp annetaan eduskunnalle', body: 'Hallituksen esitys uudeksi rahapelilaiksi - kaksi-kerroksinen lisenssimalli + Veikkaus-monopolin osittainen purku.' },
  { date: '2025-12-09', label: 'Eduskunta hyväksyy lain (137-58)', body: 'Loppuäänestys hyväksyy lain. Tärkeimmät vaikuttajat: SDP (puolesta), PS (vastaan kasinoiden osalta).' },
  { date: '2026-01-01', label: 'Sisäministeriön valmistelutyö käynnistyy', body: 'Lisenssiviranomaiseksi nimetään Poliisihallitus. Hakuohjeet julkaistaan 2026 Q2.' },
  { date: '2026-Q3', label: 'Ensimmäinen lisenssihaku avautuu', body: 'Online-kasino- ja vedonlyöntilisenssien haku avautuu kolmen kuukauden ikkunalle.' },
  { date: '2027-01-01', label: 'Veikkaus jakautuu kahteen yhtiöön', body: 'Yksinoikeudet (lottoryhmä, raha-arpa, fyysiset peliautomaatit) jäävät uuteen Veikkaus Yksinoikeudet Oy:hyn.' },
  { date: '2027-07-01', label: 'Laki astuu täysimittaisesti voimaan', body: 'Lisensoidut operaattorit voivat tarjota online-kasinopelejä ja vedonlyöntiä Suomessa. Mainonnan rajoitukset tiukennukset astuvat samanaikaisesti voimaan.' },
];

const TIMELINE_EN = [
  { date: '2025-09-25', label: 'HE 167/2025 vp tabled in parliament', body: 'Government bill for the new Gambling Act - two-tier licence model + partial unwinding of the Veikkaus monopoly.' },
  { date: '2025-12-09', label: 'Parliament passes the bill (137-58)', body: 'Final vote passes the law. Key influences: SDP (for), Finns Party (against on casino segment).' },
  { date: '2026-01-01', label: 'Ministry of the Interior preparation kicks off', body: 'National Police Board designated as licence authority. Application instructions published 2026 Q2.' },
  { date: '2026-Q3', label: 'First licence application window opens', body: 'Online casino + sports betting licence applications open for a 3-month window.' },
  { date: '2027-01-01', label: 'Veikkaus is split into two companies', body: 'Exclusive verticals (lottery, scratch cards, physical EGMs) move to the new Veikkaus Yksinoikeudet Oy.' },
  { date: '2027-07-01', label: 'Law enters full force', body: 'Licensed operators may offer online casino + sports betting in Finland. Tightened advertising restrictions activate at the same moment.' },
];

const WHAT_CHANGES_FI = [
  { title: 'Online-kasinot lisensoituvat', body: 'Suomessa toimivat ulkomaiset kasinot (Curaçao, Malta) saavat haettavakseen virallisen Suomi-lisenssin. Toiminta laillistuu - mutta verot (rahapelivero 22 %) ja kuluttajansuojavaatimukset tiukentuvat.' },
  { title: 'Veikkauksen monopoli purkautuu osittain', body: 'Vedonlyönti + online-kasino avautuvat kilpailulle. Veikkauksen yksinoikeudet säilyvät lotto-tyyppisissä peleissä, raha-arvoissa ja fyysisissä peliautomaateissa.' },
  { title: 'Mainonnan rajat tiukentuvat', body: 'Aikabannat (klo 7-22 ulkopuolella), kohderyhmäkielto (alle 25-vuotiaat), urheilumainonnan rajoitukset (peliaikana ei näy). Bonus-mainonta vain rekisteröityneille käyttäjille.' },
  { title: 'Vertailusivustot saavat virallisen statuksen', body: 'Lain §6 luo "rahapeliasiamiehet" -kategorian: julkaisijoita jotka vertailevat lisensoituja operaattoreita. PUTKI HQ on tämän kategorian alainen - emme ole operaattori.' },
  { title: 'Ikäraja 18 säilyy, identiteettitarkistus pakollinen', body: 'Vahvaan tunnistautumiseen perustuva ikätarkistus jokaisessa lisensoidussa palvelussa. Mobiilivarmenne, pankkitunnukset tai eIDAS.' },
  { title: 'Pelaajansuoja - tappiokattokorit pakollisia', body: 'Jokaiselle tilille on asetettava kuukausi-/päivätappiokatto. Self-exclusion-rekisteri keskitettynä (Poliisihallituksen ylläpitämä).' },
];

const WHAT_CHANGES_EN = [
  { title: 'Online casinos move to a licence regime', body: 'Foreign casinos operating in Finland today (Curaçao, Malta) can apply for an official Finnish licence. Operations legalise - but the 22% gambling tax and tightened consumer-protection requirements bite.' },
  { title: 'Veikkaus monopoly partially unwound', body: 'Sports betting + online casino open to competition. Exclusive rights remain on lottery-style games, scratch cards, and physical EGMs.' },
  { title: 'Advertising restrictions tightened', body: 'Time bans (no ads outside 07:00-22:00), targeting bans (no under-25 cohorts), in-game sports advertising blackout. Bonus ads only to registered users.' },
  { title: 'Comparison sites get an official classification', body: 'Section 6 of the act creates the "rahapeliasiamies" category: publishers that compare licensed operators. PUTKI HQ falls under this classification - we are not an operator.' },
  { title: '18+ stays, strong identity verification mandatory', body: 'Strong electronic identification (Mobile ID, bank credentials, eIDAS) required for every licensed service. No more email-only signups.' },
  { title: 'Player protection - loss limits compulsory', body: 'Every account must set a monthly / daily loss cap. Self-exclusion register centralised (run by the National Police Board).' },
];

const STAKEHOLDER_FI = [
  { who: 'Pelaajat', impact: 'Lailliset, lisensoidut vaihtoehdot. Tiukempi tunnistautuminen. Pakolliset tappiorajat. Tuontiulkomaisten lisensoimattomien operaattoreiden saatavuus heikkenee (geo-blokit + maksunestot).' },
  { who: 'Operaattorit', impact: 'Pääsy Suomeen laillisesti. Korkea vero (22 %). Pakolliset KYC + AML -prosessit. Mainonnan kanavat kapenevat - vertailusivustoista tulee primäärimaksukanava.' },
  { who: 'Veikkaus', impact: 'Liikevaihto laskee 800-1 200 M€ vuositasolla 2027 jälkeen (sisäisten ennusteiden mukaan). Yhtiö jakautuu - Yksinoikeudet Oy + kilpailtu yhtiö.' },
  { who: 'Julkaisut & vertailusivut', impact: '§6 antaa virallisen statuksen. Affiliate-tulot lisensoiduilta operaattoreilta sallitaan eksplisiittisesti - mutta vaaditaan "selkeä ja erotettavissa oleva" julkistus jokaisessa kaupallisessa linkissä.' },
  { who: 'Urheiluseurat', impact: 'Sponsorointi sallittu rajoituksin: seurojen pelipaidoissa rajoituksin, peliaikana ei näy. Veikkausliigan + Liigan paitamainokset tarkistetaan kaudella 2027-28.' },
];

const STAKEHOLDER_EN = [
  { who: 'Players', impact: 'Legal, licensed alternatives. Stricter ID checks. Mandatory loss caps. Access to foreign unlicensed operators degrades (geo-blocks + payment-blocks).' },
  { who: 'Operators', impact: 'Legal access to Finland. High tax (22%). Mandatory KYC + AML. Advertising channels narrow - comparison sites become the primary acquisition channel.' },
  { who: 'Veikkaus', impact: 'Revenue projected to fall €800M-€1.2B per year post-2027 (per internal projections). The company splits - Yksinoikeudet Oy + competitive sister company.' },
  { who: 'Publications & comparison sites', impact: '§6 grants official status. Affiliate revenue from licensed operators is explicitly permitted - but requires "clear and distinguishable" disclosure on every commercial link.' },
  { who: 'Sports clubs', impact: 'Sponsorship permitted with restrictions: limited shirt placements, no in-play exposure. Veikkausliiga + Liiga shirt deals re-priced for the 2027-28 season.' },
];

const FAQ_FI = [
  {
    q: 'Voinko jatkossa pelata Veikkauksen kanssa kuten ennenkin?',
    a: 'Lotto, raha-arpa ja peliautomaatit pysyvät Veikkauksen yksinoikeudella. Vedonlyönti ja online-kasinopelit siirtyvät kilpailuun - Veikkaus on yksi tarjoaja muiden joukossa.',
  },
  {
    q: 'Mitä tapahtuu nykyisille tileilleni ulkomaisilla kasinoilla?',
    a: 'Operaattori joko hakee Suomi-lisenssin (jolloin tili konvertoituu lisensoiduksi) tai sulkee Suomen markkinan. PUTKI HQ seuraa lisenssihakemuksia 2026 Q3 alkaen.',
  },
  {
    q: 'Onko PUTKI HQ rahapelisivusto?',
    a: 'Ei. PUTKI HQ on uutis- ja vertailujulkaisu (§6: rahapeliasiamies). Emme tarjoa pelejä, emme vastaanota panoksia, emme käsittele rahaa. Saamme komissiota lisensoiduilta operaattoreilta, ja se julkistetaan jokaisessa linkissä.',
  },
  {
    q: 'Milloin pystyn pelaamaan ensimmäisen kerran lisensoidulla online-kasinolla?',
    a: '2027-07-01 alkaen, kun laki astuu täysimittaisesti voimaan. Lisenssin saaneet operaattorit aloittavat toiminnan tästä päivästä eteenpäin.',
  },
];

const FAQ_EN = [
  {
    q: 'Can I still play with Veikkaus as before?',
    a: 'Lottery, scratch cards and physical EGMs remain under Veikkaus exclusivity. Sports betting and online casino move into competition - Veikkaus becomes one provider among many.',
  },
  {
    q: 'What happens to my existing accounts at foreign casinos?',
    a: 'The operator either applies for a Finnish licence (in which case your account converts to a licensed one) or exits the Finnish market. PUTKI HQ will track licence applications from 2026 Q3.',
  },
  {
    q: 'Is PUTKI HQ a gambling site?',
    a: 'No. PUTKI HQ is a news + comparison publication (§6: rahapeliasiamies). We do not offer games, do not accept stakes, do not handle money. We earn commission from licensed operators and disclose it on every link.',
  },
  {
    q: 'When can I first play on a licensed Finnish online casino?',
    a: 'From 2027-07-01, when the act enters full force. Licensed operators begin operations from that date onward.',
  },
];

const Reform2027Hub = ({ forceLang } = {}) => {
  const { lang, isEn, canonical, alternates } = useLocalisedCanonical({
    fiPath: '/saantely/reform-2027',
    enPath: '/en/regulation/reform-2027',
    forceLang,
  });
  // `useLang` import kept for hook-graph compatibility; consumers below read `lang`/`isEn` from the helper.
  void useLang;

  useDocumentMeta({
    title: isEn
      ? 'Finnish Gambling Act 2025/2027 — what changes and when · PUTKI HQ'
      : 'Suomen rahapelilaki 2025/2027 — mikä muuttuu ja milloin · PUTKI HQ',
    description: isEn
      ? 'A plain-language briefing on the Finnish gambling reform passed December 2025. Timeline, stakeholder impacts, FAQ. Editorial commentary by PUTKI HQ — not legal advice.'
      : 'Selkokielinen briefing suomalaisesta rahapeliuudistuksesta (joulukuu 2025). Aikajana, sidosryhmävaikutukset, kysytyt. PUTKI HQ -toimituksen kommentaari — ei juridinen neuvonta.',
    ogTitle: isEn
      ? 'Finnish Gambling Act 2025/2027 — the PUTKI HQ briefing'
      : 'Suomen rahapelilaki 2025/2027 — PUTKI HQ:n briefing',
    canonical,
    alternates,
  });

  useJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: isEn
        ? 'Finnish Gambling Act 2025/2027 — what changes and when'
        : 'Suomen rahapelilaki 2025/2027 — mikä muuttuu ja milloin',
      author: { '@type': 'Organization', name: 'PUTKI HQ' },
      publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
      datePublished: '2026-02-01',
      dateModified: new Date().toISOString().slice(0, 10),
      mainEntityOfPage: canonical,
      inLanguage: isEn ? 'en-FI' : 'fi-FI',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
        { '@type': 'ListItem', position: 2, name: isEn ? 'Regulation' : 'Sääntely', item: isEn ? 'https://putkihq.com/en/regulation' : 'https://putkihq.com/saantely' },
        { '@type': 'ListItem', position: 3, name: 'Reform 2027', item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (isEn ? FAQ_EN : FAQ_FI).map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ]);

  const timeline = isEn ? TIMELINE_EN : TIMELINE_FI;
  const changes = isEn ? WHAT_CHANGES_EN : WHAT_CHANGES_FI;
  const stakeholders = isEn ? STAKEHOLDER_EN : STAKEHOLDER_FI;
  const faqs = isEn ? FAQ_EN : FAQ_FI;

  return (
    <div data-testid="reform-2027-hub" className="min-h-screen">
      {/* Hero */}
      <section className="container-wide pt-10 sm:pt-16 pb-8 sm:pb-12">
        <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ink-3)', fontWeight: 700 }}>
          <Link to="/saantely" data-testid="reform-2027-crumb" style={{ color: 'var(--ink-3)' }}>
            ← {isEn ? 'REGULATION' : 'SÄÄNTELY'}
          </Link>
        </div>
        <div className="eyebrow mb-4" data-testid="reform-2027-eyebrow" style={{ color: 'var(--ember-strong)' }}>
          {isEn ? 'REFORM 2027 · BRIEFING' : 'UUDISTUS 2027 · BRIEFING'}
        </div>
        <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid="reform-2027-headline">
          {isEn ? 'The Finnish gambling reform — plain Finnish, sourced.' : 'Suomen rahapeliuudistus — selkokielellä, lähteillä.'}
        </h1>
        <p className="prose-mittari mt-6 max-w-3xl" data-testid="reform-2027-intro" style={{ fontSize: 17, lineHeight: 1.6 }}>
          {isEn
            ? 'Parliament passed the new Gambling Act on 2025-12-09. It takes effect 2027-07-01. Below: what changes, when, and what it means for players, operators, Veikkaus, sports clubs and publications like PUTKI HQ. Editorial commentary based on HE 167/2025 vp + the parliamentary record + Veikkaus’ January 2026 strategy briefing. Not legal advice.'
            : 'Eduskunta hyväksyi uuden rahapelilain 9.12.2025. Se astuu voimaan 1.7.2027. Alla: mikä muuttuu, milloin ja mitä se tarkoittaa pelaajille, operaattoreille, Veikkaukselle, urheiluseuroille ja PUTKI HQ:n kaltaisille julkaisuille. PUTKI HQ -toimituksen kommentaari, joka perustuu HE 167/2025 vp:hen + eduskunnan pöytäkirjoihin + Veikkauksen tammikuun 2026 strategiakirjeen. Ei juridinen neuvonta.'}
        </p>
      </section>

      {/* Timeline */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="reform-2027-timeline-h">
          {isEn ? 'Timeline' : 'Aikajana'}
        </h2>
        <ol
          data-testid="reform-2027-timeline"
          className="grid gap-0"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          {timeline.map((row, i) => (
            <li
              key={row.date}
              data-testid={`reform-2027-timeline-row-${i}`}
              className="grid sm:grid-cols-[160px_1fr] gap-x-6 gap-y-2 py-5"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--ember-strong)', fontWeight: 700 }}>
                {row.date}
              </span>
              <div>
                <div className="font-semibold mb-1" style={{ fontSize: 17, color: 'var(--ink)' }}>{row.label}</div>
                <div className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{row.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What changes */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="reform-2027-changes-h">
          {isEn ? 'What actually changes' : 'Mikä oikeasti muuttuu'}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2" data-testid="reform-2027-changes">
          {changes.map((c, i) => (
            <article
              key={c.title}
              data-testid={`reform-2027-change-${i}`}
              className="p-5"
              style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
            >
              <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--ember-strong)', fontWeight: 700 }}>
                #{String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="font-bold mb-2" style={{ fontSize: 17, color: 'var(--ink)' }}>{c.title}</h3>
              <p className="font-serif" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)' }}>{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Stakeholders */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="reform-2027-stakeholders-h">
          {isEn ? 'Who feels it' : 'Kenelle tämä iskee'}
        </h2>
        <div data-testid="reform-2027-stakeholders" style={{ borderTop: '1px solid var(--line)' }}>
          {stakeholders.map((s, i) => (
            <div
              key={s.who}
              data-testid={`reform-2027-stakeholder-${i}`}
              className="grid sm:grid-cols-[180px_1fr] gap-x-6 gap-y-2 py-5"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span className="mono" style={{ fontSize: 11.5, letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 700, textTransform: 'uppercase' }}>
                {s.who}
              </span>
              <p className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{s.impact}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PUTKI HQ position */}
      <section className="container-wide pb-12">
        <div
          data-testid="reform-2027-position"
          className="p-6 sm:p-8 max-w-3xl"
          style={{ borderLeft: '3px solid var(--ember)', background: 'var(--ember-soft)' }}
        >
          <div className="eyebrow mb-3" style={{ color: 'var(--ember-strong)' }}>
            {isEn ? 'PUTKI HQ POSITION · §6 rahapeliasiamies' : 'PUTKI HQ ASEMA · §6 rahapeliasiamies'}
          </div>
          <p className="font-serif" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink)' }}>
            {isEn
              ? 'PUTKI HQ operates as a comparison + editorial publication. We do not offer games, accept stakes, or hold gambling licences. Once the 2027 regime is live we will only feature operators licensed in Finland (or where the reader is). Every commercial link carries a clear disclosure of commission per the §6 transparency requirement.'
              : 'PUTKI HQ toimii vertailu- ja toimituksellisena julkaisuna. Emme tarjoa pelejä, vastaanota panoksia, emmekä pidä rahapelilisenssiä. Kun 2027 voimaan astuu, esittelemme vain Suomessa (tai lukijan asuinmaassa) lisensoituja operaattoreita. Jokainen kaupallinen linkki sisältää selkeän palkkion paljastuksen §6 läpinäkyvyysvaatimuksen mukaisesti.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/affiliaatti"
              data-testid="reform-2027-affiliate-link"
              className="mono"
              style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ember-strong)', fontWeight: 700 }}
            >
              {isEn ? 'OUR AFFILIATE POLICY →' : 'AFFILIAATTIPOLITIIKKAMME →'}
            </Link>
            <Link
              to="/toimitus"
              data-testid="reform-2027-editor-link"
              className="mono"
              style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ember-strong)', fontWeight: 700 }}
            >
              {isEn ? 'EDITORIAL TEAM →' : 'TOIMITUS →'}
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-wide pb-12">
        <h2 className="display text-2xl sm:text-3xl mb-6" data-testid="reform-2027-faq-h">
          {isEn ? 'FAQ' : 'Kysytyt'}
        </h2>
        <dl data-testid="reform-2027-faq" style={{ borderTop: '1px solid var(--line)' }}>
          {faqs.map((f, i) => (
            <div
              key={f.q}
              data-testid={`reform-2027-faq-${i}`}
              className="py-5"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <dt className="font-bold mb-2" style={{ fontSize: 16, color: 'var(--ink)' }}>{f.q}</dt>
              <dd className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Sources */}
      <section className="container-wide pb-12">
        <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--ink-3)', fontWeight: 700 }}>
          {isEn ? 'NAMED SOURCES' : 'NIMETYT LÄHTEET'}
        </div>
        <ul data-testid="reform-2027-sources" className="font-serif" style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
          <li>HE 167/2025 vp — Hallituksen esitys eduskunnalle rahapelilaiksi (2025-09-25)</li>
          <li>Eduskunnan täysistuntopöytäkirja PTK 142/2025 vp — äänestys 137-58 (2025-12-09)</li>
          <li>Sisäministeriö — tiedotteen yhteenveto (2025-12-10)</li>
          <li>Veikkaus Oy — strategy update Q4/2025 (2026-01-21)</li>
          <li>Poliisihallitus — lisenssiviranomaisen valmisteluaikataulu (2026 Q1)</li>
        </ul>
      </section>

      {/* Related */}
      <InternalLinkStrip
        testId="reform-2027-related"
        links={[
          { to: '/saantely', labelFi: 'Sääntely-arkisto', labelEn: 'Regulation archive', hintFi: 'Kaikki PUTKI HQ:n sääntelyjutut yhdessä paikassa.', hintEn: 'Every PUTKI HQ regulation piece in one place.' },
          { to: '/sponsoroinnit', labelFi: 'Sponsoroinnit', labelEn: 'Sponsorships', hintFi: 'Kuka maksaa kenelle 2027 jälkeen — operaattorien sponsorointiseuranta.', hintEn: 'Who pays whom post-2027 — operator sponsorship tracker.' },
          { to: '/affiliaatti', labelFi: 'Affiliaattipolitiikkamme', labelEn: 'Our affiliate policy', hintFi: 'Miten PUTKI HQ ansaitsee ja mistä sen julkistaa.', hintEn: 'How PUTKI HQ earns and where it discloses.' },
          { to: '/pelit', labelFi: 'Peliarkisto', labelEn: 'Game literacy', hintFi: 'House edge, RTP, bonusmatematiikka selkokielellä.', hintEn: 'House edge, RTP, bonus math in plain language.' },
        ]}
      />

      <section className="container-wide pb-14">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={9} />
      </section>
    </div>
  );
};

export default Reform2027Hub;
