import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, FileText, Mail } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const Toimitus = () => {
  const { lang } = useLang();
  return (
    <div data-testid="toimitus-page">
      <section className="container-wide pt-12 sm:pt-16 pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3 inline-flex items-center gap-2">
            <Users strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'EDITORIAL TEAM' : 'TOIMITUS'}
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5">
            {lang === 'en' ? 'PUTKI HQ -toimitus' : 'PUTKI HQ -toimitus'}
          </h1>
          <p className="prose-mittari max-w-2xl">
            {lang === 'en'
              ? <>PUTKI HQ is an independent Finnish slot-streaming and casino review publication.
                The voice you hear in our reviews, weekly card and editorial commentary is the
                <strong style={{ color: 'var(--ink)' }}> PUTKI HQ -toimitus</strong> — an institutional editorial team, not a fictional persona.
                When we hire named contributors, their bylines and track records will appear on this page.</>
              : <>PUTKI HQ on riippumaton suomalainen slot-striimausta ja kasinoita käsittelevä julkaisu.
                Arvioidemme, viikon kortin ja toimituksellisen kommentaarin ääni on
                <strong style={{ color: 'var(--ink)' }}> PUTKI HQ -toimitus</strong> — toimituksellinen tiimi, ei fiktiivinen hahmo.
                Kun palkkaamme nimettyjä avustajia, heidän nimensä ja jälkensä ilmestyvät tälle sivulle.</>}
          </p>
        </div>
      </section>

      {/* Standards */}
      <section className="container-wide pb-12 sm:pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <article className="panel p-6">
            <div className="eyebrow mb-3 inline-flex items-center gap-2">
              <Shield strokeWidth={1.5} size={12} />
              {lang === 'en' ? 'INDEPENDENCE' : 'RIIPPUMATTOMUUS'}
            </div>
            <h3 className="font-display font-bold mb-3" style={{ fontSize: 18, color: 'var(--ink)' }}>
              {lang === 'en' ? 'No sponsored placements' : 'Ei sponsoroituja sijoituksia'}
            </h3>
            <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Operators cannot buy a higher P*rkele score. Commercial weighting (max +3 points) is disclosed on every operator page.'
                : 'Operaattori ei voi ostaa parempaa P*rkele-pistettä. Kaupallinen painotus (max +3) on aina näkyvillä operaattorisivulla.'}
            </p>
          </article>

          <article className="panel p-6">
            <div className="eyebrow mb-3 inline-flex items-center gap-2">
              <FileText strokeWidth={1.5} size={12} />
              {lang === 'en' ? 'CORRECTIONS' : 'KORJAUKSET'}
            </div>
            <h3 className="font-display font-bold mb-3" style={{ fontSize: 18, color: 'var(--ink)' }}>
              {lang === 'en' ? 'Errors are visible' : 'Virheet näkyvät'}
            </h3>
            <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Score changes are logged with reasoning. Editorial corrections are appended to articles, not silently fixed.'
                : 'Pistemuutokset kirjataan perusteluineen. Toimitukselliset korjaukset lisätään juttujen loppuun — niitä ei korjata hiljaa.'}
            </p>
          </article>

          <article className="panel p-6">
            <div className="eyebrow mb-3 inline-flex items-center gap-2">
              <Mail strokeWidth={1.5} size={12} />
              {lang === 'en' ? 'CONTACT' : 'YHTEYS'}
            </div>
            <h3 className="font-display font-bold mb-3" style={{ fontSize: 18, color: 'var(--ink)' }}>
              {lang === 'en' ? 'Tips & corrections' : 'Vinkit & korjaukset'}
            </h3>
            <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Reach the editorial team at toimitus@putkihq.fi. We read every message — but the dial does not move on whims.'
                : 'Tavoita toimitus osoitteesta toimitus@putkihq.fi. Luemme jokaisen viestin — PUTKI HQ ei kuitenkaan liiku oikuilla.'}
            </p>
          </article>
        </div>
      </section>

      {/* Future bylines placeholder */}
      <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-3">{lang === 'en' ? 'NAMED CONTRIBUTORS' : 'NIMETYT AVUSTAJAT'}</div>
          <h2 className="display text-3xl mb-5">
            {lang === 'en' ? 'To be announced' : 'Tulossa'}
          </h2>
          <p className="font-serif" style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
            {lang === 'en'
              ? <>PUTKI HQ is hiring its first named editors — a Finnish sports analyst for the weekly card, and an industry editor for operator reviews.
                When they join, their bylines, photos and personal track records replace the institutional <em>PUTKI HQ -toimitus</em> placeholder on those surfaces.
                Real human accountability, not a fictional persona.</>
              : <>PUTKI HQ etsii ensimmäisiä nimettyjä toimittajiaan — urheiluanalyytikkoa viikon korttiin ja kasinotoimittajaa operaattoriarvioihin.
                Kun he aloittavat, heidän nimensä, kuvansa ja henkilökohtaiset jälkensä korvaavat institutionaalisen <em>PUTKI HQ -toimitus</em> -pohjan kyseisillä pinnoilla.
                Todellinen vastuullisuus, ei fiktiivinen hahmo.</>}
          </p>
          <Link to="/menetelma" className="btn-secondary mt-6 inline-flex" data-testid="toimitus-method-link">
            {lang === 'en' ? 'Read methodology →' : 'Lue menetelmä →'}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Toimitus;
