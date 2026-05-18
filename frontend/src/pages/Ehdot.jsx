/**
 * Ehdot (/ehdot) — Phase 1 brief Section 9.
 *
 * Lightweight Terms & Conditions page. Adds the "KÄYTETTY TEKNOLOGIA" /
 * "TECHNOLOGY USED" section at heading level (as the brief requires),
 * pointing readers to /menetelma for the workflow detail.
 *
 * Existing legal copy stubs are placeholders — full editorial T&C copy
 * is editor-supplied; this page is structured so each clause is a
 * labeled section that's easy to extend.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, Cpu } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SectionCard = ({ id, icon: Icon, title, children, testId }) => (
  <article
    id={id}
    data-testid={testId}
    className="panel p-6 sm:p-7"
    style={{ background: 'var(--bg)', borderRadius: 4 }}
  >
    <div className="flex items-start gap-4 mb-4">
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 40, height: 40, borderRadius: 2,
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
        }}
      >
        <Icon strokeWidth={1.5} size={18} style={{ color: 'var(--ink)' }} />
      </div>
      <h2 className="display"
          style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.15 }}>
        {title}
      </h2>
    </div>
    <div className="font-serif space-y-3"
         style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.6 }}>
      {children}
    </div>
  </article>
);

const Ehdot = () => {
  const { lang } = useLang();

  useDocumentMeta({
    title: lang === 'en' ? 'Terms & conditions — PUTKI HQ' : 'Ehdot — PUTKI HQ',
    description: lang === 'en'
      ? 'Terms of use, editorial independence policy, and technology disclosure.'
      : 'Käyttöehdot, toimituksellisen riippumattomuuden linja ja teknologiailmoitus.',
    canonical: `${BACKEND}/ehdot`,
  });

  return (
    <div data-testid="ehdot-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">
            {lang === 'en' ? 'TERMS · CONDITIONS' : 'EHDOT · KÄYTTÖEHDOT'}
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-6">
            {lang === 'en' ? 'Terms & conditions' : 'Käyttöehdot'}
          </h1>
          <p className="prose-mittari max-w-2xl">
            {lang === 'en'
              ? 'PUTKI HQ is an independent editorial publication. The clauses below define how we operate, what we publish, and which technologies we use.'
              : 'PUTKI HQ on riippumaton toimituksellinen julkaisu. Alla olevat kohdat määrittävät, miten toimimme, mitä julkaisemme ja mitä teknologioita käytämme.'}
          </p>
        </div>
      </section>

      <section className="container-wide pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 max-w-5xl">
          {/* CLAUSE — Editorial position */}
          <SectionCard
            id="toimituksellinen"
            icon={ScrollText}
            testId="ehdot-section-editorial"
            title={lang === 'en' ? 'Editorial position' : 'Toimituksellinen linja'}
          >
            <p>
              {lang === 'en'
                ? 'PUTKI HQ is for entertainment purposes only. No betting activity takes place on this site. We are an independent media outlet covering Finnish streamers, sports betting markets, and gambling regulation.'
                : 'PUTKI HQ on tarkoitettu vain viihdetarkoituksiin. Sivustolla ei tapahdu vedonlyöntitoimintaa. Olemme riippumaton mediakanava, joka kattaa suomalaisia striimaajia, vedonlyöntimarkkinoita ja rahapelisääntelyä.'}
            </p>
          </SectionCard>

          {/* CLAUSE — KÄYTETTY TEKNOLOGIA — required by Phase 1 brief Section 9 */}
          <SectionCard
            id="kaytetty-teknologia"
            icon={Cpu}
            testId="ehdot-section-technology"
            title={lang === 'en' ? 'Technology used' : 'Käytetty teknologia'}
          >
            <p>
              {lang === 'en'
                ? 'PUTKI HQ uses artificial intelligence as part of its publishing operations — for monitoring news sources, classifying content, synthesizing articles, and generating editorial material. All published content passes editorial review before publication. A detailed description of our workflow is available on our methodology page at '
                : 'PUTKI HQ käyttää tekoälyä julkaisutoimintansa osana — uutislähteiden seurantaan, sisällön luokitteluun, artikkeleiden koostamiseen ja toimituksellisen aineiston tuottamiseen. Kaikki julkaistu sisältö käy läpi toimituksellisen tarkistuksen ennen julkaisua. Yksityiskohtainen kuvaus työnkulustamme on saatavilla menetelmäsivultamme osoitteessa '}
              <Link to="/menetelma" className="underline" data-testid="ehdot-menetelma-link">
                putkihq.fi/menetelma
              </Link>
              .
            </p>
          </SectionCard>
        </div>
      </section>
    </div>
  );
};

export default Ehdot;
