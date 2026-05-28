/**
 * TietoaMeista - About Us / Manifesto. Fully bilingual via t().
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Mail, ScrollText, Eye } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Pillar = ({ icon: Icon, title, body }) => (
  <article className="panel p-6" style={{ background: 'var(--bg)' }}>
    <div className="eyebrow mb-3 inline-flex items-center gap-2">
      <Icon strokeWidth={1.5} size={12} />
      {title.toUpperCase()}
    </div>
    <p className="font-serif" style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 }}>
      {body}
    </p>
  </article>
);

const TietoaMeista = () => {
  const { lang, t } = useLang();

  useDocumentMeta({
    title: lang === 'en'
      ? 'About - PUTKI HQ'
      : 'Tietoa meistä - PUTKI HQ',
    description: lang === 'en'
      ? 'PUTKI HQ is Finland\u2019s independent gambling, sports and streaming publication. Editorial - commercial relationships openly listed.'
      : 'PUTKI HQ on Suomen riippumaton uhkapeli-, urheilu- ja striimausjulkaisu. Toimituksellinen - kaupalliset suhteet avoimesti merkitty.',
    canonical: `${BACKEND}/tietoa-meista`,
  });

  return (
    <div data-testid="tietoa-meista-page">
      {/* MANIFESTO */}
      <section className="container-wide pt-12 sm:pt-20 pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 inline-flex items-center gap-2">
            <ScrollText strokeWidth={1.5} size={13} />
            {t('tietoa.eyebrow').toUpperCase()}
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl" style={{ lineHeight: 1.02, marginBottom: 24 }}>
            {t('tietoa.title')}
          </h1>
          <p className="display text-2xl sm:text-3xl" style={{ color: 'var(--muted)', lineHeight: 1.25, marginBottom: 28 }}>
            {t('tietoa.subtitle')}
          </p>
          <p className="prose-mittari max-w-2xl">
            {t('tietoa.lead')}{' '}
            <Link to="/affiliaatti" className="underline">{t('tietoa.lead_affiliate')}</Link>{' '}
            {t('tietoa.lead_after')}
          </p>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="container-wide pb-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="pt-12">
          <div className="eyebrow mb-6">{t('tietoa.pillars_eyebrow').toUpperCase()}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Pillar icon={Shield}   title={t('tietoa.p1_t')} body={t('tietoa.p1_b')} />
            <Pillar icon={FileText} title={t('tietoa.p2_t')} body={t('tietoa.p2_b')} />
            <Pillar icon={Eye}      title={t('tietoa.p3_t')} body={t('tietoa.p3_b')} />
          </div>
        </div>
      </section>

      {/* METHOD */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-3">{t('tietoa.method_eyebrow').toUpperCase()}</div>
          <h2 className="display text-3xl sm:text-4xl mb-5">{t('tietoa.method_title')}</h2>
          <p className="prose-mittari mb-5">
            {t('tietoa.method_lead')}
          </p>
          <ol className="space-y-4 font-serif" style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.55 }}>
            {[
              { n: '01', t: t('tietoa.method_s1_t'), b: t('tietoa.method_s1_b') },
              { n: '02', t: t('tietoa.method_s2_t'), b: t('tietoa.method_s2_b') },
              { n: '03', t: t('tietoa.method_s3_t'), b: t('tietoa.method_s3_b') },
            ].map((step) => (
              <li key={step.n} className="flex items-start gap-4">
                <span className="mono inline-flex items-center justify-center flex-shrink-0"
                      style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)',
                               fontSize: 11, fontWeight: 800 }}>{step.n}</span>
                <span><strong>{step.t}</strong> {step.b}</span>
              </li>
            ))}
          </ol>
          <Link to="/menetelma" className="btn-secondary mt-7 inline-flex" data-testid="tietoa-method-link">
            {t('tietoa.method_link')}
          </Link>
        </div>
      </section>

      {/* TEAM */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-3">{t('tietoa.team_eyebrow').toUpperCase()}</div>
          <h2 className="display text-3xl sm:text-4xl mb-5">{t('tietoa.team_title')}</h2>
          <p className="prose-mittari mb-5">
            {t('tietoa.team_body1')} <em>{t('tietoa.team_body1_em')}</em>{' '}
            {t('tietoa.team_body1_after')}{' '}
            <Link to="/toimitus" className="underline">{t('tietoa.team_link')}</Link>.
          </p>
          <p className="prose-mittari">
            {t('tietoa.team_body2')}&nbsp;
            <a href="mailto:toimitus@putkihq.fi" className="underline">toimitus@putkihq.fi</a>.
          </p>
        </div>
      </section>

      {/* CONTACT */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <article className="panel p-6" data-testid="contact-card-tips">
              <div className="eyebrow mb-3 inline-flex items-center gap-2">
                <Mail strokeWidth={1.5} size={12} />
                {t('tietoa.contact_tips').toUpperCase()}
              </div>
              <h3 className="display mb-3" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                {t('tietoa.contact_tips_t')}
              </h3>
              <a href="mailto:vinkit@putkihq.fi" className="font-serif underline"
                 style={{ fontSize: 14, color: 'var(--ink)' }}>vinkit@putkihq.fi</a>
            </article>
            <article className="panel p-6" data-testid="contact-card-corrections">
              <div className="eyebrow mb-3 inline-flex items-center gap-2">
                <FileText strokeWidth={1.5} size={12} />
                {t('tietoa.contact_corr').toUpperCase()}
              </div>
              <h3 className="display mb-3" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                {t('tietoa.contact_corr_t')}
              </h3>
              <a href="mailto:korjaukset@putkihq.fi" className="font-serif underline"
                 style={{ fontSize: 14, color: 'var(--ink)' }}>korjaukset@putkihq.fi</a>
            </article>
            <article className="panel p-6" data-testid="contact-card-press">
              <div className="eyebrow mb-3 inline-flex items-center gap-2">
                <Mail strokeWidth={1.5} size={12} />
                {t('tietoa.contact_press').toUpperCase()}
              </div>
              <h3 className="display mb-3" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                {t('tietoa.contact_press_t')}
              </h3>
              <a href="mailto:toimitus@putkihq.fi" className="font-serif underline"
                 style={{ fontSize: 14, color: 'var(--ink)' }}>toimitus@putkihq.fi</a>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TietoaMeista;
