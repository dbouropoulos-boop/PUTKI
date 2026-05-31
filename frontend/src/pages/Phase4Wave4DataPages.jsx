import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { EditorialFooter } from '../components/EditorialFooter';
import InternalLinkStrip from '../components/InternalLinkStrip';

/**
 * Phase 4 wave 4 — trust-signal data pages.
 *
 * Three pages render REAL aggregated data fetched from public
 * back-end endpoints:
 *
 *   /trust/mestari-dataset   ← GET /api/data/mestari/dataset-summary
 *   /trust/voita-ledger      ← GET /api/data/voita/ledger
 *   /trust/mittari-accuracy  ← GET /api/data/mittari/accuracy-90d
 *
 * Each page emits Article + BreadcrumbList JSON-LD with `Dataset`
 * schema embedded where applicable. EN routes live at /en/trust/*.
 *
 * No fabrication: when a back-test collection is empty the Mittari
 * accuracy page renders an honest "back-test scaffold" block carrying
 * the methodology + N=0 disclosure instead of made-up numbers.
 */

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const useEffectiveLang = (forceLang) => {
  const ctx = useLang();
  return forceLang || ctx.lang;
};

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

const useFetch = (url) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http_${r.status}`))))
      .then((d) => { if (active) setState({ data: d, loading: false, error: null }); })
      .catch((e) => { if (active) setState({ data: null, loading: false, error: e.message || 'fetch_failed' }); });
    return () => { active = false; };
  }, [url]);
  return state;
};

const StatusBadge = ({ tone = 'ok', children }) => {
  const palette = tone === 'warn'
    ? { bg: '#FBEDEC', fg: 'var(--dial-myrsky)' }
    : tone === 'neutral'
      ? { bg: 'var(--surface)', fg: 'var(--ink-3)' }
      : { bg: 'var(--ember-soft)', fg: 'var(--ember-strong)' };
  return (
    <span
      className="mono"
      style={{
        display: 'inline-block',
        background: palette.bg,
        color: palette.fg,
        padding: '4px 10px',
        fontSize: 10.5,
        letterSpacing: '0.14em',
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
};

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
  itemListElement: parts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, item: p.item })),
});

const datasetSchema = (name, canonical, isEn, totalRows) => ({
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name,
  description: isEn
    ? `Public aggregated dataset published by PUTKI HQ. ${totalRows} rows, refreshed on read.`
    : `Julkinen koonti­datajoukko PUTKI HQ:lta. ${totalRows} riviä, päivittyy lukuhetkellä.`,
  url: canonical,
  publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
  license: 'https://putkihq.com/affiliaatti',
  inLanguage: isEn ? 'en-FI' : 'fi-FI',
});

/* ────────────────────────────────────────────────────────────────
 * 1. Mestari diagnostics dataset summary
 *    FI: /trust/mestari-aineisto    EN: /en/trust/mestari-dataset
 * ────────────────────────────────────────────────────────────────*/
export const MestariDatasetSummary = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/trust/mestari-aineisto';
  const enUrl = 'https://putkihq.com/en/trust/mestari-dataset';
  const canonical = isEn ? enUrl : fiUrl;
  const { data, loading, error } = useFetch(`${BACKEND}/api/data/mestari/dataset-summary`);

  useDocumentMeta({
    title: isEn ? 'Mestari diagnostics dataset summary · PUTKI HQ' : 'Mestari-aineiston koonti · PUTKI HQ',
    description: isEn
      ? 'Anonymised quartiles + N for every Mestari diagnostic run. Real data, refreshed on read.'
      : 'Anonymisoituja kvartiileja + N jokaiselta Mestari-diagnostiikan ajoltulokselta. Oikeaa dataa, päivittyy lukuhetkellä.',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Mestari diagnostics dataset summary' : 'Mestari-aineiston koonti', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: isEn ? 'Trust' : 'Luotettavuus', item: isEn ? 'https://putkihq.com/en/trust' : 'https://putkihq.com/luotettavuus' },
      { name: isEn ? 'Mestari dataset' : 'Mestari-aineisto', item: canonical },
    ]),
    datasetSchema(isEn ? 'Mestari diagnostics dataset summary' : 'Mestari-aineiston koonti', canonical, isEn, (data && data.total_runs) || 0),
  ]);

  return (
    <div data-testid="mestari-dataset-summary" className="min-h-screen">
      <Hero
        testId="mestari-dataset"
        crumbTo={isEn ? '/en/mestari' : '/mestari'}
        crumbLabel="MESTARI"
        eyebrow={isEn ? 'DATASET · QUARTILES' : 'AINEISTO · KVARTILIT'}
        headline={isEn ? 'Mestari diagnostics — the actual numbers.' : 'Mestari-diagnostiikat — oikeat luvut.'}
        intro={isEn
          ? 'Every Mestari diagnostic run lands in a single anonymised dataset. Below: total N, per-game quartile distribution on the three axes, and the most recent refresh time. Fetched live from the public dataset endpoint at every load.'
          : 'Jokainen Mestari-diagnostiikan ajo päätyy yhteen anonymisoituun aineistoon. Alla: kokonais-N, peli­kohtainen kvartiili­jakauma kolmella akselilla, ja tuorein virkistys­hetki. Haetaan live julkisesta aineisto-endpointista joka latauksella.'}
      />
      <section className="container-wide pb-4 max-w-3xl">
        {loading && <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>{isEn ? 'LOADING DATASET…' : 'LADATAAN…'}</div>}
        {error && (
          <div className="p-4" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }} data-testid="mestari-dataset-error">
            <StatusBadge tone="warn">{isEn ? 'FETCH FAILED' : 'HAKU EPÄONNISTUI'}</StatusBadge>
            <div className="mt-2 font-serif" style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{error}</div>
          </div>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6" data-testid="mestari-dataset-summary-strip">
              <StatusBadge>{isEn ? `N = ${data.total_runs}` : `N = ${data.total_runs}`}</StatusBadge>
              <StatusBadge tone="neutral">{isEn ? `${data.per_diagnostic.length} GAMES` : `${data.per_diagnostic.length} PELIÄ`}</StatusBadge>
              <StatusBadge tone="neutral">SCHEMA v{data.schema_version}</StatusBadge>
            </div>
            <div className="space-y-6" data-testid="mestari-dataset-per-diag">
              {data.per_diagnostic.map((d) => (
                <article key={d.diagnostic} data-testid={`mestari-dataset-diag-${d.diagnostic}`} style={{ border: '1px solid var(--line)' }}>
                  <header className="px-4 py-3 flex flex-wrap items-baseline gap-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
                    <h2 className="font-bold" style={{ fontSize: 18, color: 'var(--ink)', textTransform: 'capitalize' }}>{d.diagnostic}</h2>
                    <span className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-3)', fontWeight: 700 }}>N = {d.n}</span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--line)' }}>
                          {['Axis', 'min', 'p25', 'p50', 'p75', 'max'].map((h) => (
                            <th key={h} className="text-left px-4 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['process', 'discipline', 'recovery'].map((axis) => (
                          <tr key={axis} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td className="px-4 py-2" style={{ textTransform: 'uppercase', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--ember-strong)', fontWeight: 700, letterSpacing: '0.12em' }}>{axis}</td>
                            {['min', 'p25', 'p50', 'p75', 'max'].map((k) => (
                              <td key={k} className="px-4 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ink)' }}>
                                {d[axis][k] ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
            <div className="mono mt-6" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>
              {isEn ? 'COMPUTED AT' : 'LASKETTU'} · {data.computed_at}
            </div>
          </>
        )}
      </section>
      <InternalLinkStrip
        testId="mestari-dataset-related"
        links={[
          { to: isEn ? '/en/mestari/methodology' : '/mestari/menetelma', labelFi: 'Mestari-menetelmä', labelEn: 'Mestari methodology', hintFi: 'Miten pisteytys oikeasti toimii.', hintEn: 'How the scoring actually works.' },
          { to: '/trust/mittari-accuracy', labelFi: 'Mittari-tarkkuus', labelEn: 'Mittari accuracy', hintFi: 'Signaalien hit-rate 90 päivän rullaavasti.', hintEn: 'Signal hit-rate over a rolling 90-day window.' },
          { to: '/trust/voita-ledger', labelFi: 'Voita-tilikirja', labelEn: 'Voita ledger', hintFi: 'Jokainen voittaja aikajanalla.', hintEn: 'Every winner with timestamps.' },
          { to: '/affiliaatti', labelFi: 'Affiliaattipolitiikka', labelEn: 'Affiliate policy', hintFi: 'Mistä numerot saavat aukottua kontekstin.', hintEn: 'Where the numbers fit into the broader economic model.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={4} />
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
 * 2. Voita raffle outcomes ledger
 *    FI: /trust/voita-tilikirja    EN: /en/trust/voita-ledger
 * ────────────────────────────────────────────────────────────────*/
export const VoitaLedger = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/trust/voita-tilikirja';
  const enUrl = 'https://putkihq.com/en/trust/voita-ledger';
  const canonical = isEn ? enUrl : fiUrl;
  const { data, loading, error } = useFetch(`${BACKEND}/api/data/voita/ledger`);

  useDocumentMeta({
    title: isEn ? 'Voita raffles ledger — every winner since launch · PUTKI HQ' : 'Voita-arvontojen tilikirja — jokainen voittaja alusta saakka · PUTKI HQ',
    description: isEn
      ? 'Every concluded Voita raffle with a winner stamp and timestamps. Real data, no fabrication.'
      : 'Jokainen päättynyt Voita-arvonta voittaja­merkinnällä ja aika­leimoilla. Oikeaa dataa, ei spekulaatiota.',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Voita raffles ledger — every winner since launch' : 'Voita-arvontojen tilikirja — jokainen voittaja alusta saakka', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: isEn ? 'Trust' : 'Luotettavuus', item: isEn ? 'https://putkihq.com/en/trust' : 'https://putkihq.com/luotettavuus' },
      { name: isEn ? 'Voita ledger' : 'Voita-tilikirja', item: canonical },
    ]),
    datasetSchema(isEn ? 'Voita raffles ledger' : 'Voita-arvontojen tilikirja', canonical, isEn, (data && data.count) || 0),
  ]);

  return (
    <div data-testid="voita-ledger-page" className="min-h-screen">
      <Hero
        testId="voita-ledger"
        crumbTo={isEn ? '/en/voita' : '/voita'}
        crumbLabel="VOITA"
        eyebrow={isEn ? 'LEDGER · WINNERS SINCE LAUNCH' : 'TILIKIRJA · VOITTAJAT ALUSTA'}
        headline={isEn ? 'Every Voita winner. Every timestamp.' : 'Jokainen Voita-voittaja. Jokainen aikaleima.'}
        intro={isEn
          ? 'Public, append-only ledger of every concluded Voita raffle. Sourced from the same back-office collection that powers /voita. Pseudonymised per the winner’s choice — the timestamp is the integrity proof.'
          : 'Julkinen, vain-lisättävä tilikirja jokaisesta päättyneestä Voita-arvonnasta. Lähde sama back-officen kokoelma joka pyörittää /voita-sivua. Pseudonymisoitu voittajan valinnan mukaan — aikaleima on rehellisyyden todiste.'}
      />
      <section className="container-wide pb-4 max-w-4xl">
        {loading && <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>{isEn ? 'LOADING LEDGER…' : 'LADATAAN…'}</div>}
        {error && (
          <div className="p-4" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }} data-testid="voita-ledger-error">
            <StatusBadge tone="warn">{isEn ? 'FETCH FAILED' : 'HAKU EPÄONNISTUI'}</StatusBadge>
            <div className="mt-2 font-serif" style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{error}</div>
          </div>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6" data-testid="voita-ledger-summary">
              <StatusBadge>{isEn ? `${data.count} CONCLUDED` : `${data.count} PÄÄTTYNYTTÄ`}</StatusBadge>
              <StatusBadge tone="neutral">SCHEMA v{data.schema_version}</StatusBadge>
            </div>
            {data.count === 0 && (
              <div className="p-5" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }} data-testid="voita-ledger-empty">
                <StatusBadge tone="neutral">{isEn ? 'NO CONCLUDED RAFFLES YET' : 'EI VIELÄ PÄÄTTYNEITÄ'}</StatusBadge>
                <p className="font-serif mt-3" style={{ fontSize: 15, color: 'var(--ink-2)' }}>
                  {isEn ? 'First concluded raffles will appear here within 24h of draw.' : 'Ensimmäiset päättyneet arvonnat ilmestyvät tähän 24h:n sisällä arvonnasta.'}
                </p>
              </div>
            )}
            {data.count > 0 && (
              <div className="overflow-x-auto" style={{ border: '1px solid var(--line)' }} data-testid="voita-ledger-table">
                <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
                      {[isEn ? 'Raffle' : 'Arvonta', isEn ? 'Winner' : 'Voittaja', isEn ? 'Entries' : 'Osallistujia', isEn ? 'Drawn' : 'Arvottu', isEn ? 'Paid' : 'Maksettu', 'STATUS'].map((h) => (
                        <th key={h} className="text-left px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.slug} data-testid={`voita-ledger-row-${r.slug}`} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--ink)' }}>
                          <Link to={`/voita/${r.slug}`} style={{ color: 'var(--ember-strong)', textDecoration: 'none', fontWeight: 600 }}>{r.headline || r.slug}</Link>
                          {r.prize_label && (
                            <div className="font-serif" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{r.prize_label}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 font-serif" style={{ color: 'var(--ink-2)' }}>{r.winner_display || '—'}</td>
                        <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ink)' }}>{r.entries_count}</td>
                        <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: 'var(--ink-2)' }}>{r.drawn_at ? String(r.drawn_at).slice(0, 16).replace('T', ' ') : '—'}</td>
                        <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: 'var(--ink-2)' }}>{r.paid_at ? String(r.paid_at).slice(0, 16).replace('T', ' ') : '—'}</td>
                        <td className="px-3 py-2"><StatusBadge tone={r.status === 'paid' ? 'ok' : 'neutral'}>{(r.status || '').toUpperCase()}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>
              {isEn ? 'COMPUTED AT' : 'LASKETTU'} · {data.computed_at}
            </div>
          </>
        )}
      </section>
      <InternalLinkStrip
        testId="voita-ledger-related"
        links={[
          { to: isEn ? '/en/voita/faq' : '/voita/usein-kysytyt', labelFi: 'Voita FAQ', labelEn: 'Voita FAQ', hintFi: '10 vastausta arvontojen mekaniikkaan.', hintEn: '10 answers on raffle mechanics.' },
          { to: '/voita', labelFi: 'Voita-etusivu', labelEn: 'Voita home', hintFi: 'Aktiiviset arvonnat.', hintEn: 'Active raffles.' },
          { to: '/trust/mestari-dataset', labelFi: 'Mestari-aineisto', labelEn: 'Mestari dataset', hintFi: 'Diagnostiikan oikeat luvut.', hintEn: 'Diagnostics in real numbers.' },
          { to: '/saantely/reform-2027', labelFi: 'Sääntely 2027', labelEn: 'Regulation 2027', hintFi: 'Arpajaislaki §27 säilyy ennallaan.', hintEn: 'Arpajaislaki §27 stays unchanged.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-4xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={3} />
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
 * 3. Mittari accuracy back-test (90d)
 *    FI: /trust/mittari-tarkkuus    EN: /en/trust/mittari-accuracy
 * ────────────────────────────────────────────────────────────────*/
export const MittariAccuracyBacktest = ({ forceLang } = {}) => {
  const lang = useEffectiveLang(forceLang);
  const isEn = lang === 'en';
  const fiUrl = 'https://putkihq.com/trust/mittari-tarkkuus';
  const enUrl = 'https://putkihq.com/en/trust/mittari-accuracy';
  const canonical = isEn ? enUrl : fiUrl;
  const { data, loading, error } = useFetch(`${BACKEND}/api/data/mittari/accuracy-90d`);

  useDocumentMeta({
    title: isEn ? 'Mittari accuracy — rolling 90-day back-test · PUTKI HQ' : 'Mittarin tarkkuus — rullaavaa 90 päivän back-test · PUTKI HQ',
    description: isEn
      ? 'Per-signal-class hit rate over the trailing 90 days. Honest scaffold when the back-test outcome collection is still empty.'
      : 'Signaali­luokka­kohtainen hit-rate viime 90 päivän aikana. Rehellinen scaffold-tila, jos outcome-aineisto on vielä tyhjä.',
    canonical,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  });
  useJsonLd([
    articleSchema(isEn ? 'Mittari accuracy — rolling 90-day back-test' : 'Mittarin tarkkuus — rullaavaa 90 päivän back-test', canonical, isEn),
    breadcrumb([
      { name: isEn ? 'Home' : 'Etusivu', item: 'https://putkihq.com/' },
      { name: isEn ? 'Trust' : 'Luotettavuus', item: isEn ? 'https://putkihq.com/en/trust' : 'https://putkihq.com/luotettavuus' },
      { name: isEn ? 'Mittari accuracy' : 'Mittarin tarkkuus', item: canonical },
    ]),
    datasetSchema(isEn ? 'Mittari accuracy back-test' : 'Mittarin tarkkuus -back-test', canonical, isEn, (data && data.total_n) || 0),
  ]);

  return (
    <div data-testid="mittari-accuracy-page" className="min-h-screen">
      <Hero
        testId="mittari-accuracy"
        crumbTo={isEn ? '/en/mittari' : '/mittari'}
        crumbLabel="MITTARI"
        eyebrow={isEn ? 'ACCURACY · 90D ROLLING' : 'TARKKUUS · 90 PV ROULLAAVA'}
        headline={isEn ? 'Mittari accuracy — measured, not promised.' : 'Mittarin tarkkuus — mitattu, ei luvattu.'}
        intro={isEn
          ? 'Per-signal-class hit rate over the trailing 90 days. When the outcome ledger has fewer than 30 graded outcomes for a class, that class is suppressed from the table — partial data is dishonest data.'
          : 'Signaali­luokka­kohtainen hit-rate viime 90 päivän aikana. Kun outcome-tilikirjassa on alle 30 arvosteltua tulosta luokassa, kyseinen luokka jätetään pois — osittainen data on epärehellistä dataa.'}
      />
      <section className="container-wide pb-4 max-w-3xl">
        {loading && <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>{isEn ? 'LOADING BACK-TEST…' : 'LADATAAN…'}</div>}
        {error && (
          <div className="p-4" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }} data-testid="mittari-accuracy-error">
            <StatusBadge tone="warn">{isEn ? 'FETCH FAILED' : 'HAKU EPÄONNISTUI'}</StatusBadge>
            <div className="mt-2 font-serif" style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{error}</div>
          </div>
        )}
        {data && data.status === 'scaffold' && (
          <div
            className="p-5"
            style={{ borderLeft: '3px solid var(--ember)', background: 'var(--ember-soft)' }}
            data-testid="mittari-accuracy-scaffold"
          >
            <StatusBadge>{isEn ? 'BACK-TEST IN PROGRESS' : 'BACK-TEST KÄYNNISSÄ'}</StatusBadge>
            <h2 className="display mt-3 mb-2" style={{ fontSize: 22, color: 'var(--ink)' }}>
              {isEn ? 'No graded outcomes yet.' : 'Ei vielä arvosteltuja tuloksia.'}
            </h2>
            <p className="font-serif" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
              {isEn
                ? 'The outcome ledger is graded by an editor job that runs weekly. The first per-class hit-rate numbers appear here once a class crosses the minimum N=30 threshold within the rolling 90-day window. Until then we show this scaffold rather than fabricated numbers.'
                : 'Outcome-tilikirja arvostellaan toimittaja-jobilla, joka ajaa viikoittain. Ensimmäiset luokka­kohtaiset hit-rate-luvut ilmestyvät tähän, kun luokka ylittää minimi-N=30 -kynnyksen rullaavassa 90 päivän ikkunassa. Tähän asti näytämme tämän scaffoldin keksittyjen numeroiden sijaan.'}
            </p>
            <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>
              N = {data.total_n} · {isEn ? 'WINDOW' : 'IKKUNA'} {data.rolling_days}D
            </div>
          </div>
        )}
        {data && data.status === 'live' && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6" data-testid="mittari-accuracy-summary">
              <StatusBadge>{isEn ? `N = ${data.total_n}` : `N = ${data.total_n}`}</StatusBadge>
              <StatusBadge tone="ok">{isEn ? `HIT RATE ${(data.total_hit_rate * 100).toFixed(1)}%` : `HIT RATE ${(data.total_hit_rate * 100).toFixed(1)}%`}</StatusBadge>
              <StatusBadge tone="neutral">{data.rolling_days}D ROLLING</StatusBadge>
            </div>
            <div className="overflow-x-auto" style={{ border: '1px solid var(--line)' }} data-testid="mittari-accuracy-table">
              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
                    {[isEn ? 'Signal class' : 'Signaaliluokka', 'N', isEn ? 'Hits' : 'Osumat', isEn ? 'Hit rate' : 'Hit-rate'].map((h) => (
                      <th key={h} className="text-left px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.per_class.filter((c) => c.n >= 30).map((c) => (
                    <tr key={c.signal_class} data-testid={`mittari-accuracy-row-${c.signal_class}`} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td className="px-3 py-2" style={{ textTransform: 'uppercase', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5, color: 'var(--ember-strong)', fontWeight: 700, letterSpacing: '0.12em' }}>{c.signal_class}</td>
                      <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ink)' }}>{c.n}</td>
                      <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ink)' }}>{c.hits}</td>
                      <td className="px-3 py-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ink)', fontWeight: 700 }}>{(c.hit_rate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {data && (
          <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>
            {isEn ? 'COMPUTED AT' : 'LASKETTU'} · {data.computed_at}
          </div>
        )}
      </section>
      <InternalLinkStrip
        testId="mittari-accuracy-related"
        links={[
          { to: isEn ? '/en/mittari/sources' : '/mittari/lahteet', labelFi: 'Mittarin lähteet', labelEn: 'Mittari sources', hintFi: '28 lähdettä auki.', hintEn: '28 sources opened up.' },
          { to: '/trust/mestari-dataset', labelFi: 'Mestari-aineisto', labelEn: 'Mestari dataset', hintFi: 'Diagnostiikan kvartiilit.', hintEn: 'Diagnostic quartiles.' },
          { to: '/trust/voita-ledger', labelFi: 'Voita-tilikirja', labelEn: 'Voita ledger', hintFi: 'Voittajat aikajanalla.', hintEn: 'Winners with timestamps.' },
          { to: '/paivityslog', labelFi: 'Päivitysloki', labelEn: 'Change log', hintFi: 'Jokainen metodologia­muutos.', hintEn: 'Every methodology change.' },
        ]}
      />
      <section className="container-wide pb-14 max-w-3xl">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={4} />
      </section>
    </div>
  );
};

export default MestariDatasetSummary;
