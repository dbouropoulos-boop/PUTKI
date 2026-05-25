/**
 * Methodology (/menetelma) - boxed, scannable layout per Dioni's spec.
 * Fully bilingual via t(). 7 self-contained cards.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Database, Hand, Slash, BarChart3, Clock, FileCheck, Cpu, Calculator } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { EditorialFooter } from '../components/EditorialFooter';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SectionCard = ({ section, idx, t }) => {
  const Icon = section.icon;
  return (
    <article
      id={section.id}
      data-testid={`methodology-section-${idx}`}
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
        <div>
          <div className="mono mb-1" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
            {String(idx + 1).padStart(2,'0')} · {t('method.section_n').toUpperCase()}
          </div>
          <h2 className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.15 }}>
            {section.title}
          </h2>
        </div>
      </div>
      <div className="font-serif space-y-3"
           style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 }}>
        {section.body}
      </div>
    </article>
  );
};

const Methodology = () => {
  const { lang, t } = useLang();

  useDocumentMeta({
    title: lang === 'en' ? 'Method - PUTKI HQ' : 'Menetelmä - PUTKI HQ',
    description: lang === 'en'
      ? 'How Mittari scores are built - objective factors 70 %, editorial weighting 30 %, and what does not count.'
      : 'Miten Mittari-pisteet syntyvät - objektiiviset tekijät 70 %, toimituksellinen painotus 30 %, ja mikä ei vaikuta.',
    canonical: `${BACKEND}/menetelma`,
  });

  const SECTIONS = [
    {
      id: 'mista',
      icon: Compass,
      title: t('method.s1_t'),
      body: (
        <>
          <p>{t('method.s1_p1')}</p>
          <p>{t('method.s1_p2')}</p>
        </>
      ),
    },
    {
      id: 'objektiivi',
      icon: Database,
      title: t('method.s2_t'),
      body: (
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>{t('method.s2_l1')}</strong></li>
          <li><strong>{t('method.s2_l2')}</strong></li>
          <li><strong>{t('method.s2_l3')}</strong></li>
          <li><strong>{t('method.s2_l4')}</strong></li>
          <li><strong>{t('method.s2_l5')}</strong></li>
          <li><strong>{t('method.s2_l6')}</strong></li>
        </ul>
      ),
    },
    {
      id: 'kaupallinen',
      icon: Hand,
      title: t('method.s3_t'),
      body: (
        <p>
          {t('method.s3_b')}{' '}
          <Link to="/affiliaatti" className="underline">
            {lang === 'en' ? 'affiliate' : 'affiliaatti'}
          </Link>.
        </p>
      ),
    },
    {
      id: 'ei-vaikuta',
      icon: Slash,
      title: t('method.s4_t'),
      body: (
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('method.s4_l1')}</li>
          <li>{t('method.s4_l2')}</li>
          <li>{t('method.s4_l3')}</li>
          <li>{t('method.s4_l4')}</li>
        </ul>
      ),
    },
    {
      id: 'floor',
      icon: BarChart3,
      title: t('method.s5_t'),
      body: (
        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('method.s5_l1')}</li>
          <li>{t('method.s5_l2')}</li>
          <li>{t('method.s5_l3')}</li>
          <li>{t('method.s5_l4')}</li>
          <li>{t('method.s5_l5')}</li>
        </ul>
      ),
    },
    {
      id: 'paivitykset',
      icon: Clock,
      title: t('method.s6_t'),
      body: <p>{t('method.s6_b')}</p>,
    },
    {
      id: 'affiliaatti',
      icon: FileCheck,
      title: t('method.s7_t'),
      body: <p>{t('method.s7_b')}</p>,
    },
    // ─── Phase 1 brief Section 9 - AI workflow disclosure ───
    {
      id: 'teknologia',
      icon: Cpu,
      title: lang === 'en' ? 'Technology used' : 'Käytetty teknologia',
      body: (
        <>
          <p>
            {lang === 'en'
              ? 'PUTKI HQ uses artificial intelligence as part of its publishing operations - for monitoring news sources, classifying content, synthesizing articles, and generating editorial material. All published content passes editorial review before publication.'
              : 'PUTKI HQ käyttää tekoälyä julkaisutoimintansa osana - uutislähteiden seurantaan, sisällön luokitteluun, artikkeleiden koostamiseen ja toimituksellisen aineiston tuottamiseen. Kaikki julkaistu sisältö käy läpi toimituksellisen tarkistuksen ennen julkaisua.'}
          </p>
          <p style={{ fontWeight: 600 }}>
            {lang === 'en' ? 'Where AI is used:' : 'Missä tekoälyä käytetään:'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>{lang === 'en' ? 'Ingestion & classification.' : 'Syötteen luokittelu.'}</strong>{' '}
              {lang === 'en'
                ? 'Every RSS item (Yle, HS, IL, IS, MTV, KL, Google News Finland) runs through a deterministic rule-based classifier that tags category, severity, relevance, and entity tags. No LLM in this loop.'
                : 'Jokainen RSS-juttu (Yle, HS, IL, IS, MTV, KL, Google News Suomi) käy läpi deterministisen sääntöpohjaisen luokittelijan, joka merkitsee kategorian, vakavuuden, relevanssin ja entiteettitagit. Ei LLM:ää tässä silmukassa.'}
            </li>
            <li>
              <strong>{lang === 'en' ? 'Article synthesis.' : 'Artikkelien kooste.'}</strong>{' '}
              {lang === 'en'
                ? 'Editorial drafts are generated by Claude (Anthropic) from source-attributed reporting. Every article must cite at least one named source ("according to Yle…"). The generator rejects its own output if attribution is missing.'
                : 'Toimitukselliset luonnokset on generoitu Claudella (Anthropic) lähde-attribuoidusta raportoinnista. Jokaisen artikkelin on viitattava vähintään yhteen nimettyyn lähteeseen ("Ylen mukaan…"). Generaattori hylkää oman tuotoksensa, jos attribuutio puuttuu.'}
            </li>
            <li>
              <strong>{lang === 'en' ? 'Editorial review.' : 'Toimituksellinen tarkistus.'}</strong>{' '}
              {lang === 'en'
                ? 'Generated drafts queue in the back-office. An editor approves before publication. Auto-publish is restricted to low-risk templates (operator listings, regulatory summaries) with stricter validators.'
                : 'Generoidut luonnokset jonottavat back-officessa. Toimittaja hyväksyy ennen julkaisua. Automaattinen julkaisu on rajoitettu vain matalan riskin pohjille (operaattorilistaukset, sääntelytiivistelmät), joilla on tiukemmat validaattorit.'}
            </li>
            <li>
              <strong>{lang === 'en' ? 'What does NOT use AI.' : 'Mikä EI käytä tekoälyä.'}</strong>{' '}
              {lang === 'en'
                ? 'The Mittari score, the Sharpness score, and all dial calculations are deterministic formulas - published in full below. The picks data itself comes from The Odds API. No model generates numbers.'
                : 'Mittari-pisteet, Sharpness-pisteet ja kaikki dialin laskennat ovat deterministisiä kaavoja - julkaistu kokonaisuudessaan alla. Tärppien data itsessään tulee The Odds API:sta. Mikään malli ei generoi numeroita.'}
            </li>
          </ul>
        </>
      ),
    },
    // ─── Phase 1 brief Section 7e + user req - Sharpness formula published verbatim ───
    {
      id: 'sharpness',
      icon: Calculator,
      title: lang === 'en' ? 'Sharpness - formula' : 'Sharpness - kaava',
      body: (
        <>
          <p>
            {lang === 'en'
              ? 'Sharpness is a 0-100 score over bookmaker market behaviour. Deterministic, AI-free, computed live from The Odds API. We publish it verbatim so any reader can verify it.'
              : 'Sharpness on 0-100-pisteen mittari, joka kuvaa vedonlyöntiyhtiöiden markkinakäyttäytymistä. Deterministinen, ei tekoälyä, lasketaan reaaliajassa The Odds API:sta. Julkaisemme sen sellaisenaan, jotta lukija voi tarkistaa sen itse.'}
          </p>
          <pre className="mono panel"
               style={{
                 padding: '14px 16px', background: 'var(--surface)',
                 border: '1px solid var(--border-strong)', overflow: 'auto',
                 fontSize: 12, lineHeight: 1.55, color: 'var(--ink)',
               }}>
{`Sharpness = round(
    0.50 * implied_prob_score
  + 0.30 * consensus_tightness
  + 0.20 * recency_momentum
)

implied_prob_score   = clamp( (1 / best_decimal_odds) * 100, 0, 100 )
consensus_tightness  = 100 - clamp( stdev(implied_per_book) * 7, 0, 100 )
recency_momentum     = clamp( 50 + (avg_implied_now - avg_implied_24h_ago) * 500, 0, 100 )
                        # defaults to 50 when no 24 h history yet`}
          </pre>
          <p style={{ fontWeight: 600 }}>
            {lang === 'en' ? 'Bands:' : 'Tasot:'}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>≥ 90 - {lang === 'en' ? 'Markets are tight' : 'Markkinat ovat tiukat'}</li>
            <li>75-89 - {lang === 'en' ? 'Markets are clear' : 'Markkinat ovat selkeät'}</li>
            <li>60-74 - {lang === 'en' ? 'Markets are mixed' : 'Markkinat ovat sekoittuneet'}</li>
            <li>40-59 - {lang === 'en' ? 'Markets are loose' : 'Markkinat ovat löysät'}</li>
            <li>&lt; 40 - {lang === 'en' ? 'Markets are scattered' : 'Markkinat ovat hajallaan'}</li>
          </ul>
          <p>
            {lang === 'en'
              ? 'A momentum modifier is shown when recency_momentum ≥ 60 ("tightened today") or ≤ 40 ("softened today"). Otherwise none.'
              : 'Momentti-merkki näytetään, kun recency_momentum ≥ 60 ("tiukentunut tänään") tai ≤ 40 ("löystynyt tänään"). Muuten ei merkkiä.'}
          </p>
          <p style={{ fontStyle: 'italic', color: 'var(--muted)' }}>
            {lang === 'en'
              ? 'PUTKI HQ does not place bets. Sharpness is editorial analysis of market consensus, not a recommendation.'
              : 'PUTKI HQ ei lyö vetoa. Sharpness on toimituksellinen analyysi markkinakonsensuksesta, ei suositus.'}
          </p>
        </>
      ),
    },
  ];

  return (
    <div data-testid="methodology-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">{t('method.eyebrow').toUpperCase()}</div>
          <h1 className="display text-4xl sm:text-6xl mb-6">{t('method.title')}</h1>
          <p className="mono mb-5"
             style={{ fontSize: 13, letterSpacing: '0.12em', color: '#E8924A', fontWeight: 700 }}>
            {t('method.tagline').toUpperCase()}
          </p>
          <p className="prose-mittari max-w-2xl">
            {t('method.lead_1')} <strong>{t('method.lead_obj')}</strong> {t('method.lead_2')}{' '}
            <strong>{t('method.lead_edit')}</strong>{t('method.lead_3')}
          </p>
        </div>
      </section>

      <section className="container-wide pb-20 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {SECTIONS.map((s, i) => <SectionCard key={s.id} section={s} idx={i} t={t} />)}
        </div>
        <div className="max-w-3xl mt-8">
          <EditorialFooter />
        </div>
      </section>
    </div>
  );
};

export default Methodology;
