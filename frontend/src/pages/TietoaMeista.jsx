/**
 * TietoaMeista — About Us / Manifesto.
 *
 * Defines PUTKI HQ's editorial identity: independent, no ads, transparent.
 * Loaded into the route /tietoa-meista. Listed in the header nav.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Mail, ScrollText, Eye } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';

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
  useDocumentMeta({
    title: 'Tietoa meistä — PUTKI HQ',
    description: 'PUTKI HQ on Suomen rehellisin kasino- ja striimaaja-lähde. Toimituksellinen — ei mainontaa.',
    canonical: `${BACKEND}/tietoa-meista`,
  });

  return (
    <div data-testid="tietoa-meista-page">
      {/* MANIFESTO */}
      <section className="container-wide pt-12 sm:pt-20 pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 inline-flex items-center gap-2">
            <ScrollText strokeWidth={1.5} size={13} />
            MANIFESTI
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl" style={{ lineHeight: 1.02, marginBottom: 24 }}>
            Suomen rehellisin kasino- ja&nbsp;striimaaja-lähde.
          </h1>
          <p className="display text-2xl sm:text-3xl" style={{ color: 'var(--muted)', lineHeight: 1.25, marginBottom: 28 }}>
            Toimituksellinen — ei mainontaa.
          </p>
          <p className="prose-mittari max-w-2xl">
            PUTKI HQ on suomalainen riippumaton julkaisu, joka seuraa uhkapeli-, striimi- ja
            urheilumaailmaa reaaliajassa. Kerromme mitä juuri nyt tapahtuu — striimaajat
            livenä, NHL & jalkapallon vahvimmat suosikit, sääntelyn käänteet, alan
            todelliset uutiset. Emme myy sijoituksia. Emme korjaa hiljaa. Jokainen
            kaupallinen suhde on sivulla <Link to="/affiliaatti" className="underline">affiliaatti</Link>{' '}
            avoimesti ja päivämäärällä — myös ennen lanseerausta.
          </p>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="container-wide pb-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="pt-12">
          <div className="eyebrow mb-6">KOLME PERIAATETTA</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Pillar
              icon={Shield}
              title="Riippumattomuus"
              body="Yksikään operaattori ei voi ostaa parempaa P*rkele-pistettä. Kaupallinen painotus on rajattu maksimissaan +5 / 100 ja se ilmoitetaan jokaisella sitä koskevalla sivulla. Tällä hetkellä emme tee kaupallista yhteistyötä yhdenkään operaattorin kanssa."
            />
            <Pillar
              icon={FileText}
              title="Korjaukset näkyvät"
              body="Pistemuutokset kirjataan perusteluineen sivulla /korjaukset. Toimitukselliset virheet lisätään juttujen loppuun — niitä ei korjata hiljaa. Avoimuusraportti julkaistaan vuosittain."
            />
            <Pillar
              icon={Eye}
              title="Reaaliaikainen data"
              body="Mittari yhdistää Twitch / Kick / YouTube -striimit, NHL & F1 & jalkapallon datat ja 11 RSS-lähdettä. Päivittyy 60 sekunnin sykleissä. Kaikki näkyvä data on aitoa — ei mockattua, ei ennustettua."
            />
          </div>
        </div>
      </section>

      {/* METHOD */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-3">MENETELMÄ · MITEN SISÄLTÖ SYNTYY</div>
          <h2 className="display text-3xl sm:text-4xl mb-5">Layer 2 -työntekijät → Claude Opus → toimitus</h2>
          <p className="prose-mittari mb-5">
            PUTKI HQ:n julkaisut syntyvät kolmivaiheisesta putkesta:
          </p>
          <ol className="space-y-4 font-serif" style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.55 }}>
            <li className="flex items-start gap-4">
              <span className="mono inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)',
                             fontSize: 11, fontWeight: 800 }}>01</span>
              <span><strong>Signaali.</strong> Layer 2 -työntekijät seuraavat Twitchiä, Kickiä, YouTubea, NHL & jalkapallon API:eja, F1:tä, 11 RSS-lähdettä — 60 s syklillä.</span>
            </li>
            <li className="flex items-start gap-4">
              <span className="mono inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)',
                             fontSize: 11, fontWeight: 800 }}>02</span>
              <span><strong>Veto.</strong> Riittävän vahva signaali (esim. iso voitto, sääntelyuutinen, NHL-ottelu) syöttää Claude Opus -mallin, joka kirjoittaa Finnish-luonnollisen luonnoksen ankkuroiden lähdedataan.</span>
            </li>
            <li className="flex items-start gap-4">
              <span className="mono inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink)', color: 'var(--bg)',
                             fontSize: 11, fontWeight: 800 }}>03</span>
              <span><strong>Toimitus.</strong> Luonnos käy validointitarkistuksen (vetoangle, sävyfiltteri, pituus). Tier-1 julkaistaan automaattisesti; Tier-2 odottaa toimituksen tarkastusta back-officessa.</span>
            </li>
          </ol>
          <Link to="/menetelma" className="btn-secondary mt-7 inline-flex" data-testid="tietoa-method-link">
            Lue koko menetelmä →
          </Link>
        </div>
      </section>

      {/* TEAM */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-3">TOIMITUS</div>
          <h2 className="display text-3xl sm:text-4xl mb-5">PUTKI HQ -toimitus</h2>
          <p className="prose-mittari mb-5">
            Arvioiden, viikon kortin ja toimituksellisen kommentaarin ääni on <em>PUTKI HQ -toimitus</em>{' '}
            — toimituksellinen tiimi, ei fiktiivinen hahmo. Kun palkkaamme nimettyjä avustajia,
            heidän nimensä ja jälkensä ilmestyvät <Link to="/toimitus" className="underline">toimitussivulle</Link>.
          </p>
          <p className="prose-mittari">
            Etsimme ensimmäisiä nimettyjä toimittajia: urheiluanalyytikkoa viikon korttiin
            ja kasinotoimittajaa operaattoriarvioihin. Yhteys&nbsp;
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
                VINKIT
              </div>
              <h3 className="display mb-3" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                Lähetä uutisvinkki
              </h3>
              <a href="mailto:vinkit@putkihq.fi" className="font-serif underline"
                 style={{ fontSize: 14, color: 'var(--ink)' }}>vinkit@putkihq.fi</a>
            </article>
            <article className="panel p-6" data-testid="contact-card-corrections">
              <div className="eyebrow mb-3 inline-flex items-center gap-2">
                <FileText strokeWidth={1.5} size={12} />
                KORJAUKSET
              </div>
              <h3 className="display mb-3" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                Pyydä korjaus
              </h3>
              <a href="mailto:korjaukset@putkihq.fi" className="font-serif underline"
                 style={{ fontSize: 14, color: 'var(--ink)' }}>korjaukset@putkihq.fi</a>
            </article>
            <article className="panel p-6" data-testid="contact-card-press">
              <div className="eyebrow mb-3 inline-flex items-center gap-2">
                <Mail strokeWidth={1.5} size={12} />
                LEHDISTÖ
              </div>
              <h3 className="display mb-3" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                Mediayhteydet
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
