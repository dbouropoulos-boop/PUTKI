import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { EditorialFooter } from '../components/EditorialFooter';

// V2 §10.3 accountability surfaces:
//   /korjaukset       — Corrections log
//   /affiliaatti      — Affiliate disclosure (single partner: Weezybet)
//   /avoimuus/2026    — Annual transparency report
//   /lehdistö         — Press kit + media contact
//   /paivityslog      — Site changes / methodology updates / new streamers tracked

const StaticPage = ({ testId, eyebrow, headline, children }) => (
  <div data-testid={testId} className="min-h-screen">
    <section className="container-wide pt-10 sm:pt-16 pb-12 sm:pb-16 max-w-3xl">
      <div className="eyebrow mb-4">{eyebrow}</div>
      <h1 className="display text-4xl sm:text-5xl mb-8" data-testid={`${testId}-headline`}>{headline}</h1>
      <div className="prose-mittari space-y-5">{children}</div>
      <EditorialFooter />
    </section>
  </div>
);

export const Korjaukset = () => {
  const { lang } = useLang();
  return (
    <StaticPage testId="korjaukset-page" eyebrow={lang === 'en' ? 'CORRECTIONS · LOG' : 'KORJAUKSET · LOKI'}
      headline={lang === 'en' ? 'Corrections register' : 'Korjausten rekisteri'}>
      <p>
        {lang === 'en'
          ? 'Mittari publishes corrections to every editorial piece when a material fact changes or an error is identified. Each correction names the piece, the change, and the date. We do not silently rewrite published content.'
          : 'Mittari julkaisee korjauksen jokaiseen toimitukselliseen juttuun kun olennainen seikka muuttuu tai virhe havaitaan. Jokainen korjaus nimeää jutun, muutoksen ja päivämäärän. Emme hiljaisesti kirjoita julkaistua sisältöä uudelleen.'}
      </p>
      <p data-testid="korjaukset-empty-note">
        {lang === 'en'
          ? 'No corrections logged yet. This page populates from generated_content version history once the first editorial piece ships with an applied correction.'
          : 'Ei kirjattuja korjauksia vielä. Sivu täyttyy generated_content-versiohistoriasta heti kun ensimmäinen juttu saa korjauksen.'}
      </p>
      <p>
        {lang === 'en'
          ? 'Spot an error? Email toimitus@mittari.fi with the piece URL and what should be corrected.'
          : 'Huomasitko virheen? Lähetä sähköpostia toimitus@mittari.fi — kerro jutun osoite ja mikä pitäisi korjata.'}
      </p>
    </StaticPage>
  );
};

export const Affiliaatti = () => {
  const { lang } = useLang();
  return (
    <StaticPage testId="affiliaatti-page" eyebrow={lang === 'en' ? 'AFFILIATE · DISCLOSURE' : 'AFFILIATE · ILMOITUS'}
      headline={lang === 'en' ? 'Affiliate relationships' : 'Affiliate-suhteet'}>
      <p>
        {lang === 'en'
          ? 'Mittari operates as a comparison site / publication under the Finnish Gambling Act (2025, in force July 2027). Operators are evaluated by a transparent P*rkele score whose methodology is published at /menetelma. Commercial relationships are capped at 5–15 points of total score impact and are always disclosed.'
          : 'Mittari toimii vertailusivustona / julkaisuna Suomen rahapelilain (2025, voimaan heinäkuussa 2027) puitteissa. Operaattoreita arvioidaan läpinäkyvällä P*rkele-pisteytyksellä, jonka menetelmä on julkaistu osoitteessa /menetelma. Kaupalliset suhteet on rajoitettu 5–15 pisteen vaikutukseen kokonaispisteistä ja ne ilmoitetaan aina.'}
      </p>
      <table className="w-full font-display text-[14px]" data-testid="affiliaatti-table">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th className="py-2 text-left text-muted-text font-display" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600 }}>
              {lang === 'en' ? 'OPERATOR' : 'OPERAATTORI'}
            </th>
            <th className="py-2 text-left text-muted-text font-display" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600 }}>
              {lang === 'en' ? 'RELATIONSHIP' : 'SUHDE'}
            </th>
            <th className="py-2 text-right text-muted-text font-display" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600 }}>
              {lang === 'en' ? 'SCORE IMPACT' : 'PISTEVAIKUTUS'}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <td className="py-3 font-semibold text-ink">Weezybet</td>
            <td className="py-3 text-ink">{lang === 'en' ? 'CPA affiliate partner · data feed integration' : 'CPA affiliate -kumppani · datafeed-integraatio'}</td>
            <td className="py-3 text-right tabular text-ink">+8 / 100</td>
          </tr>
        </tbody>
      </table>
      <p>
        {lang === 'en'
          ? 'No other operator currently has a commercial relationship with Mittari. All other operator reviews on this site are unsponsored editorial assessments with no affiliate links.'
          : 'Muilla operaattoreilla ei tällä hetkellä ole kaupallista suhdetta Mittariin. Kaikki muut operaattoriarviot sivustolla ovat sponsoroimattomia toimituksellisia arvioita ilman affiliate-linkkejä.'}
      </p>
    </StaticPage>
  );
};

export const Avoimuus = () => {
  const { lang } = useLang();
  return (
    <StaticPage testId="avoimuus-page" eyebrow={lang === 'en' ? 'TRANSPARENCY · 2026' : 'AVOIMUUS · 2026'}
      headline={lang === 'en' ? 'Mittari 2026 transparency report' : 'Mittarin 2026 avoimuusraportti'}>
      <p>
        {lang === 'en'
          ? 'Mittari publishes an annual transparency report covering revenue sources, operator relationships, editorial pipeline volume, AI-generated content volume + approval rates, corrections issued, and methodology changes.'
          : 'Mittari julkaisee vuosittaisen avoimuusraportin joka kattaa tulolähteet, operaattorisuhteet, toimituksellisen putken volyymin, AI-tuotetun sisällön volyymin + hyväksymisasteet, julkaistut korjaukset ja menetelmämuutokset.'}
      </p>
      <p data-testid="avoimuus-coming-soon">
        {lang === 'en'
          ? 'The 2026 report publishes in January 2027. The 2025 partial-year report covering Mittari\u2019s launch quarter publishes January 2026.'
          : 'Vuoden 2026 raportti julkaistaan tammikuussa 2027. Vuoden 2025 osavuosiraportti, joka kattaa Mittarin lanseerausneljänneksen, julkaistaan tammikuussa 2026.'}
      </p>
      <ul className="list-disc pl-5 space-y-2 font-serif">
        <li>{lang === 'en' ? 'Revenue source breakdown (affiliate, banner, partnership, other)' : 'Tulolähteiden erittely (affiliate, banneri, kumppanuus, muu)'}</li>
        <li>{lang === 'en' ? 'AI-generated content volume + human approval rate' : 'AI-tuotetun sisällön volyymi + ihmisen hyväksymisaste'}</li>
        <li>{lang === 'en' ? 'Corrections issued' : 'Julkaistut korjaukset'}</li>
        <li>{lang === 'en' ? 'Methodology changes' : 'Menetelmämuutokset'}</li>
        <li>{lang === 'en' ? 'Editorial roster (when journalists are hired beyond MITTARIN TOIMITUS placeholder)' : 'Toimituksen kokoonpano (kun journalisteja palkataan MITTARIN TOIMITUS -placeholderin sijaan)'}</li>
      </ul>
    </StaticPage>
  );
};

export const Lehdisto = () => {
  const { lang } = useLang();
  return (
    <StaticPage testId="lehdisto-page" eyebrow={lang === 'en' ? 'PRESS · MEDIA KIT' : 'LEHDISTÖ · MEDIAKITTI'}
      headline={lang === 'en' ? 'Press kit and media contact' : 'Lehdistöpaketti ja mediayhteydet'}>
      <p>
        {lang === 'en'
          ? 'Mittari is a Finnish gambling culture publication. We provide commentary on the Finnish gambling reform (Rahapelilaki 2025/2027), operator landscape, slot-streaming scene, sports betting culture, and adjacent cultural territory.'
          : 'Mittari on suomalainen rahapelikulttuurin julkaisu. Kommentoimme Suomen rahapeliuudistusta (Rahapelilaki 2025/2027), operaattorimaisemaa, slot-striimausskeneä, urheiluvedonlyöntikulttuuria ja viereistä kulttuuriterritoriota.'}
      </p>
      <p>
        {lang === 'en'
          ? 'For interviews, expert commentary, data requests, or partnership enquiries:'
          : 'Haastattelut, asiantuntijakommentit, datapyynnöt tai yhteistyökyselyt:'}
      </p>
      <ul className="list-disc pl-5 space-y-2 font-serif">
        <li>{lang === 'en' ? 'Editorial' : 'Toimitus'}: <strong>toimitus@mittari.fi</strong></li>
        <li>{lang === 'en' ? 'Press' : 'Lehdistö'}: <strong>press@mittari.fi</strong></li>
        <li>{lang === 'en' ? 'Partnerships' : 'Kumppanuudet'}: <strong>partner@mittari.fi</strong></li>
      </ul>
      <p>
        <Link to="/menetelma" data-testid="lehdisto-link-method" className="mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--brand-blue, #5A7BB8)', fontWeight: 700 }}>
          {lang === 'en' ? 'METHODOLOGY →' : 'MENETELMÄ →'}
        </Link>
      </p>
    </StaticPage>
  );
};

export const Paivityslog = () => {
  const { lang } = useLang();
  return (
    <StaticPage testId="paivityslog-page" eyebrow={lang === 'en' ? 'CHANGE LOG' : 'PÄIVITYSLOG'}
      headline={lang === 'en' ? 'Site changes, methodology updates, new tracked streamers' : 'Sivustomuutokset, menetelmäpäivitykset, uudet seurattavat striimaajat'}>
      <p>
        {lang === 'en'
          ? 'Mittari publishes every methodology change, every new streamer added to the tracked roster, and every editorial system change. Auto-generated from the system\u2019s change history. Compounding evidence of editorial discipline.'
          : 'Mittari julkaisee jokaisen menetelmämuutoksen, jokaisen uuden seurattavaksi lisätyn striimaajan ja jokaisen toimituksellisen järjestelmämuutoksen. Auto-generoitu järjestelmän muutoshistoriasta. Kasautuvaa todistusaineistoa toimituksellisesta kurinalaisuudesta.'}
      </p>
      <p data-testid="paivityslog-empty-note">
        {lang === 'en'
          ? 'Change log entries surface here as soon as the methodology_changes and corrections_log collections receive their first records.'
          : 'Päivityslokimerkinnät ilmestyvät tänne heti kun methodology_changes- ja corrections_log-kokoelmiin tulee ensimmäiset tietueet.'}
      </p>
    </StaticPage>
  );
};

export default Korjaukset;
