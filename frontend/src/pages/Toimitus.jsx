import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, FileText, Mail, AtSign, Linkedin } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

// Founder block. Photo + LinkedIn are wired as graceful fallbacks until
// Dioni provides the real assets. Once /team/dioni.jpg is dropped into
// /app/frontend/public/team/, the initials avatar swaps for the photo.
const FOUNDER = {
  name: 'Dioni Bouropoulos',
  role_fi: 'Perustaja · Toimituksellinen suunta',
  role_en: 'Founder · Editorial direction',
  initial: 'DB',
  photo_src: '/team/dioni.jpg',
  bio_fi: 'Perustaja ja toimituksellinen johtaja. Vastaa PUTKI HQ:n metodologiasta, redaktiosta ja julkaisupolitiikasta. Pidempi bio päivittyy pian.',
  bio_en: 'Founder and editorial director. Owns PUTKI HQ\u2019s methodology, editorial standards and publishing policy. Longer bio to follow.',
  linkedin: '',          // set when Dioni provides
  email: 'toimitus@putkihq.fi',
};

const Avatar = ({ founder }) => {
  const [errored, setErrored] = React.useState(false);
  if (errored || !founder.photo_src) {
    return (
      <div data-testid="toimitus-founder-avatar-initials" style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'var(--surface)', border: '1px solid var(--hairline, var(--border))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'ui-monospace, monospace', fontSize: 28, fontWeight: 700,
        color: 'var(--ink)', letterSpacing: '0.04em',
      }}>{founder.initial}</div>
    );
  }
  return (
    <img
      data-testid="toimitus-founder-avatar"
      src={founder.photo_src}
      alt={founder.name}
      onError={() => setErrored(true)}
      style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }}
    />
  );
};

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
            {lang === 'en' ? 'Toimitus' : 'Toimitus'}
          </h1>
          <p className="prose-mittari max-w-2xl">
            {lang === 'en'
              ? <>PUTKI HQ is an independent Finnish publication covering the gambling, sports and streaming scenes.
                  Below is the editorial team — named and accountable. When we hire additional named contributors,
                  their bylines and track records will appear on this page.</>
              : <>PUTKI HQ on riippumaton suomalainen rahapeli-, urheilu- ja striimausjulkaisu.
                  Alla on toimitus — nimellä ja vastuullisesti. Kun palkkaamme uusia nimettyjä avustajia,
                  heidän nimensä ja jälkensä ilmestyvät tälle sivulle.</>}
          </p>
        </div>
      </section>

      {/* Founder block — named, accountable */}
      <section className="container-wide pb-10" data-testid="toimitus-founder-section">
        <div className="panel p-6 sm:p-8" style={{ background: 'var(--bg)' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Avatar founder={FOUNDER} />
            <div style={{ flex: '1 1 360px', minWidth: 280 }}>
              <div className="eyebrow mb-2 inline-flex items-center gap-2">
                {lang === 'en' ? 'FOUNDER' : 'PERUSTAJA'}
              </div>
              <h2 data-testid="toimitus-founder-name"
                  className="display"
                  style={{ fontSize: 28, lineHeight: 1.15, marginBottom: 4, color: 'var(--ink)' }}>
                {FOUNDER.name}
              </h2>
              <div data-testid="toimitus-founder-role"
                   className="mono"
                   style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)',
                            fontWeight: 600, marginBottom: 14 }}>
                {(lang === 'en' ? FOUNDER.role_en : FOUNDER.role_fi).toUpperCase()}
              </div>
              <p data-testid="toimitus-founder-bio"
                 className="font-serif"
                 style={{ fontSize: 15, color: 'var(--ink-2, #3A3833)', lineHeight: 1.6, marginBottom: 16 }}>
                {lang === 'en' ? FOUNDER.bio_en : FOUNDER.bio_fi}
              </p>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                {FOUNDER.linkedin && (
                  <a data-testid="toimitus-founder-linkedin"
                     href={FOUNDER.linkedin}
                     target="_blank" rel="noopener noreferrer"
                     className="mono"
                     style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink)',
                              fontWeight: 700, textDecoration: 'none',
                              display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Linkedin strokeWidth={1.5} size={12} />
                    LINKEDIN
                  </a>
                )}
                <a data-testid="toimitus-founder-email"
                   href={`mailto:${FOUNDER.email}`}
                   className="mono"
                   style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink)',
                            fontWeight: 700, textDecoration: 'none',
                            display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AtSign strokeWidth={1.5} size={12} />
                  {FOUNDER.email.toUpperCase()}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pseudonym disclosure — Eino K. */}
      <section className="container-wide pb-10" data-testid="toimitus-pseudonym-section">
        <div className="panel p-6 sm:p-8"
             style={{ background: 'var(--surface)', borderLeft: '3px solid var(--ember, var(--ink))' }}>
          <div className="eyebrow mb-3">
            {lang === 'en' ? 'EDITORIAL PSEUDONYM' : 'TOIMITUKSELLINEN PSEUDONYYMI'}
          </div>
          <h3 className="display mb-3" style={{ fontSize: 22, color: 'var(--ink)' }}>
            {lang === 'en' ? 'Eino K. — disclosed column pseudonym' : 'Eino K. — avoimesti merkitty kolumni-pseudonyymi'}
          </h3>
          <p data-testid="toimitus-pseudonym-disclosure"
             className="font-serif"
             style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-2, #3A3833)', maxWidth: 720 }}>
            {lang === 'en'
              ? <>The first-person editorial voice signed as <strong>Eino K.</strong> on /mittari and /pelisignaalit is
                  a PUTKI HQ editorial pseudonym, used following the Finnish column tradition. The actual editorial team
                  behind that voice is listed above. The pseudonym exists to keep the column voice consistent across
                  contributors and time; it does not represent a real person.</>
              : <>Etunimellä <strong>Eino K.</strong> allekirjoitettu ensimmäisen persoonan kolumniääni sivuilla /mittari ja
                  /pelisignaalit on PUTKI HQ:n toimituksellinen pseudonyymi, joka noudattaa suomalaista kolumniperinnettä.
                  Todellinen sen takana oleva toimitus on listattu yllä. Pseudonyymi pitää kolumnin äänen yhtenäisenä
                  yli avustajien ja ajan; se ei edusta yksittäistä henkilöä.</>}
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
              {lang === 'en' ? 'No bought placements' : 'Ei ostettuja sijoituksia'}
            </h3>
            <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Operators cannot buy a higher Mittari score. Commercial weighting is capped at +5/100 and is disclosed on every relevant page. Active commercial relationships are listed at /affiliaatti.'
                : 'Operaattori ei voi ostaa parempaa Mittari-pistettä. Kaupallinen painotus on rajattu maksimissaan +5/100 ja se ilmoitetaan jokaisella sitä koskevalla sivulla. Aktiiviset kaupalliset suhteet listataan sivulla /affiliaatti.'}
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
                : 'Pistemuutokset kirjataan perusteluineen. Toimitukselliset korjaukset lisätään juttujen loppuun - niitä ei korjata hiljaa.'}
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
                ? 'Reach the editorial team at toimitus@putkihq.fi. We read every message - but the dial does not move on whims.'
                : 'Tavoita toimitus osoitteesta toimitus@putkihq.fi. Luemme jokaisen viestin - PUTKI HQ ei kuitenkaan liiku oikuilla.'}
            </p>
          </article>
        </div>
      </section>

      {/* Open roles + future bylines */}
      <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-3">{lang === 'en' ? 'OPEN ROLES' : 'AVOIMET ROOLIT'}</div>
          <h2 className="display text-3xl mb-5">
            {lang === 'en' ? 'We\u2019re hiring' : 'Etsimme'}
          </h2>
          <p className="font-serif" style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
            {lang === 'en'
              ? <>PUTKI HQ is hiring its first named contributors — a sports analyst (Mestari sports playbook + weekly card)
                  and a casino editor (operator reviews + reform-2027 coverage). Send a writing sample to
                  <strong style={{ color: 'var(--ink)' }}> toimitus@putkihq.fi</strong>. We read every submission.</>
              : <>PUTKI HQ etsii ensimmäisiä nimettyjä avustajiaan — urheiluanalyytikkoa (Mestari-urheilun käsikirja + viikon kortti)
                  ja kasinotoimittajaa (operaattoriarviot + 2027-uudistus). Lähetä kirjoitusnäyte osoitteeseen
                  <strong style={{ color: 'var(--ink)' }}> toimitus@putkihq.fi</strong>. Luemme jokaisen hakemuksen.</>}
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
