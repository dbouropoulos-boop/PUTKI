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
          ? 'PUTKI HQ publishes corrections to every editorial piece when a material fact changes or an error is identified. Each correction names the piece, the change, and the date. We do not silently rewrite published content.'
          : 'PUTKI HQ julkaisee korjauksen jokaiseen toimitukselliseen juttuun kun olennainen seikka muuttuu tai virhe havaitaan. Jokainen korjaus nimeää jutun, muutoksen ja päivämäärän. Emme hiljaisesti kirjoita julkaistua sisältöä uudelleen.'}
      </p>
      <p data-testid="korjaukset-empty-note">
        {lang === 'en'
          ? 'No corrections logged yet. This page populates from generated_content version history once the first editorial piece ships with an applied correction.'
          : 'Ei kirjattuja korjauksia vielä. Sivu täyttyy generated_content-versiohistoriasta heti kun ensimmäinen juttu saa korjauksen.'}
      </p>
      <p>
        {lang === 'en'
          ? 'Spot an error? Email toimitus@putkihq.fi with the piece URL and what should be corrected.'
          : 'Huomasitko virheen? Lähetä sähköpostia toimitus@putkihq.fi — kerro jutun osoite ja mikä pitäisi korjata.'}
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
          ? 'PUTKI HQ has no active commercial relationships at this time. All operator reviews currently on the site are unsponsored editorial assessments with no affiliate links. This table will be updated the moment any commercial relationship begins, with the score-impact disclosure visible before launch.'
          : 'PUTKI HQ:lla ei ole tällä hetkellä aktiivisia kaupallisia suhteita. Kaikki sivuston operaattoriarviot ovat sponsoroimattomia toimituksellisia arvioita ilman affiliate-linkkejä. Tämä taulukko päivittyy heti, kun kaupallinen suhde alkaa — pistevaikutus on aina näkyvillä ennen lanseerausta.'}
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
          <tr style={{ borderBottom: '1px solid var(--border)' }} data-testid="affiliaatti-empty">
            <td colSpan={3} className="py-6 text-center mono"
                style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              {lang === 'en'
                ? 'NO COMMERCIAL RELATIONSHIPS · UPDATED THE MOMENT ONE OPENS'
                : 'EI KAUPALLISIA SUHTEITA · PÄIVITETÄÄN HETI KUN AVAUTUU'}
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        {lang === 'en'
          ? 'When commercial partnerships open, every score impact will be capped at +5 / 100 and disclosed both here and on each affected operator review page.'
          : 'Kun kaupalliset kumppanuudet avautuvat, jokainen pistevaikutus rajataan +5 / 100 ja ilmoitetaan sekä tässä että jokaisella vaikutuspiiriin kuuluvalla operaattoriarviolla.'}
      </p>
    </StaticPage>
  );
};

export const Avoimuus = () => {
  const { lang } = useLang();
  return (
    <StaticPage testId="avoimuus-page" eyebrow={lang === 'en' ? 'TRANSPARENCY · 2026' : 'AVOIMUUS · 2026'}
      headline={lang === 'en' ? 'PUTKI HQ 2026 transparency report' : 'PUTKI HQ:n 2026 avoimuusraportti'}>
      <p>
        {lang === 'en'
          ? 'PUTKI HQ publishes an annual transparency report covering revenue sources, operator relationships, editorial pipeline volume, AI-generated content volume + approval rates, corrections issued, and methodology changes.'
          : 'PUTKI HQ julkaisee vuosittaisen avoimuusraportin joka kattaa tulolähteet, operaattorisuhteet, toimituksellisen putken volyymin, AI-tuotetun sisällön volyymin + hyväksymisasteet, julkaistut korjaukset ja menetelmämuutokset.'}
      </p>
      <p data-testid="avoimuus-coming-soon">
        {lang === 'en'
          ? 'The 2026 report publishes in January 2027. The 2025 partial-year report covering PUTKI HQ\u2019s launch quarter publishes January 2026.'
          : 'Vuoden 2026 raportti julkaistaan tammikuussa 2027. Vuoden 2025 osavuosiraportti, joka kattaa PUTKI HQ:n lanseerausneljänneksen, julkaistaan tammikuussa 2026.'}
      </p>
      <ul className="list-disc pl-5 space-y-2 font-serif">
        <li>{lang === 'en' ? 'Revenue source breakdown (affiliate, banner, partnership, other)' : 'Tulolähteiden erittely (affiliate, banneri, kumppanuus, muu)'}</li>
        <li>{lang === 'en' ? 'AI-generated content volume + human approval rate' : 'AI-tuotetun sisällön volyymi + ihmisen hyväksymisaste'}</li>
        <li>{lang === 'en' ? 'Corrections issued' : 'Julkaistut korjaukset'}</li>
        <li>{lang === 'en' ? 'Methodology changes' : 'Menetelmämuutokset'}</li>
        <li>{lang === 'en' ? 'Editorial roster (when journalists are hired beyond PUTKI HQ placeholder)' : 'Toimituksen kokoonpano (kun journalisteja palkataan PUTKI HQ -placeholderin sijaan)'}</li>
      </ul>
    </StaticPage>
  );
};

export const Lehdisto = () => {
  const { lang } = useLang();
  const [sources, setSources] = React.useState({});
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sources/public`)
      .then((r) => r.json())
      .then((d) => { setSources(d.by_category || {}); setTotal(d.total || 0); })
      .catch(() => {});
  }, []);

  const CATEGORY_LABELS = {
    regulatory:        { fi: 'Sääntely ja toimiala',         en: 'Regulatory and industry' },
    betting_discourse: { fi: 'Vedonlyöntidiskurssi',         en: 'Betting discourse' },
    sports_media:      { fi: 'Urheilumedia',                 en: 'Sports media' },
    streamer_data:     { fi: 'Striimaajadataekosysteemi',    en: 'Streamer data ecosystem' },
    esports:           { fi: 'Esports-referenssit',          en: 'Esports references' },
    culture:           { fi: 'Kulttuuri ja musiikkimedia',   en: 'Culture and music media' },
    operator_signal:   { fi: 'Operaattorisignaalit',         en: 'Operator signals' },
  };
  const CATEGORY_ORDER = ['regulatory', 'betting_discourse', 'sports_media', 'streamer_data', 'esports', 'culture', 'operator_signal'];

  return (
    <StaticPage testId="lehdisto-page" eyebrow={lang === 'en' ? 'PRESS · MEDIA KIT' : 'LEHDISTÖ · MEDIAKITTI'}
      headline={lang === 'en' ? 'Press kit and media contact' : 'Lehdistöpaketti ja mediayhteydet'}>
      <p>
        {lang === 'en'
          ? 'PUTKI HQ is a Finnish gambling culture publication. We provide commentary on the Finnish gambling reform (Rahapelilaki 2025/2027), operator landscape, slot-streaming scene, sports betting culture, and adjacent cultural territory.'
          : 'PUTKI HQ on suomalainen rahapelikulttuurin julkaisu. Kommentoimme Suomen rahapeliuudistusta (Rahapelilaki 2025/2027), operaattorimaisemaa, slot-striimausskeneä, urheiluvedonlyöntikulttuuria ja viereistä kulttuuriterritoriota.'}
      </p>
      <p>
        {lang === 'en'
          ? 'For interviews, expert commentary, data requests, or partnership enquiries:'
          : 'Haastattelut, asiantuntijakommentit, datapyynnöt tai yhteistyökyselyt:'}
      </p>
      <ul className="list-disc pl-5 space-y-2 font-serif">
        <li>{lang === 'en' ? 'Editorial' : 'Toimitus'}: <strong>toimitus@putkihq.fi</strong></li>
        <li>{lang === 'en' ? 'Press' : 'Lehdistö'}: <strong>press@putkihq.fi</strong></li>
        <li>{lang === 'en' ? 'Partnerships' : 'Kumppanuudet'}: <strong>partner@putkihq.fi</strong></li>
      </ul>
      <p>
        <Link to="/menetelma" data-testid="lehdisto-link-method" className="mono" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--brand-blue, #5A7BB8)', fontWeight: 700 }}>
          {lang === 'en' ? 'METHODOLOGY →' : 'MENETELMÄ →'}
        </Link>
      </p>

      {/* V2 §4.1 — Named Finnish editorial sources */}
      <div className="mt-10" data-testid="lehdisto-sources">
        <div className="eyebrow mb-2">{lang === 'en' ? `EDITORIAL SOURCE MAP · ${total}` : `TOIMITUKSELLINEN LÄHDEKARTTA · ${total}`}</div>
        <h2 className="display text-2xl mb-3" data-testid="lehdisto-sources-headline">
          {lang === 'en' ? 'Named sources PUTKI HQ monitors' : 'PUTKI HQ:n seuraamat nimetyt lähteet'}
        </h2>
        <p style={{ marginBottom: 20 }}>
          {lang === 'en'
            ? 'PUTKI HQ\u2019s editorial pipeline monitors a curated set of named Finnish-language and international sources for regulatory, sponsorship, scene, and cultural context. Tier 1 sources feed primary editorial coverage; Tier 2–3 sources provide secondary context and cross-reference. We publish this map so readers can audit who informs our coverage.'
            : 'PUTKI HQ:n toimituksellinen putki seuraa kuratoitua joukkoa nimettyjä suomenkielisiä ja kansainvälisiä lähteitä sääntelyn, sponsoroinnin, skenen ja kulttuurin konteksteihin. Tier 1 -lähteet syöttävät pääosin toimituksellista kattavuutta; Tier 2–3 antaa toissijaista kontekstia ja ristireferenssejä. Julkaisemme tämän kartan jotta lukijat voivat tarkistaa kuka kattavuuttamme informoi.'}
        </p>

        {CATEGORY_ORDER.map((cat) => {
          const rows = sources[cat];
          if (!rows || !rows.length) return null;
          return (
            <div key={cat} className="mb-6" data-testid={`lehdisto-cat-${cat}`}>
              <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--brand-blue, #5A7BB8)', fontWeight: 700 }}>
                {(CATEGORY_LABELS[cat] || {})[lang] || cat.toUpperCase()} · {rows.length}
              </div>
              <table className="w-full font-display text-[13.5px]">
                <tbody>
                  {rows.sort((a, b) => (a.tier || 9) - (b.tier || 9)).map((s) => (
                    <tr key={s.key} style={{ borderBottom: '1px solid var(--border)' }} data-testid={`lehdisto-source-${s.key}`}>
                      <td className="py-2 pr-3" style={{ width: 56, verticalAlign: 'top' }}>
                        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: s.tier === 1 ? '#E8924A' : 'var(--muted)', fontWeight: 700 }}>
                          T{s.tier}
                        </span>
                      </td>
                      <td className="py-2 pr-3" style={{ verticalAlign: 'top' }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">{s.name}</a>
                        {s.note && (
                          <div className="font-serif" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{s.note}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
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
          ? 'PUTKI HQ publishes every methodology change, every new streamer added to the tracked roster, and every editorial system change. Auto-generated from the system\u2019s change history. Compounding evidence of editorial discipline.'
          : 'PUTKI HQ julkaisee jokaisen menetelmämuutoksen, jokaisen uuden seurattavaksi lisätyn striimaajan ja jokaisen toimituksellisen järjestelmämuutoksen. Auto-generoitu järjestelmän muutoshistoriasta. Kasautuvaa todistusaineistoa toimituksellisesta kurinalaisuudesta.'}
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
