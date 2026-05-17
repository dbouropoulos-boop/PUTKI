/**
 * Methodology (/menetelma) — boxed, scannable layout per Dioni's spec.
 * Replaces the previous wall-of-text rendering with 7 self-contained cards.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Database, Hand, Slash, BarChart3, Clock, FileCheck } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { EditorialFooter } from '../components/EditorialFooter';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const SECTIONS = [
  {
    id: 'mista',
    icon: Compass,
    title: 'Mistä Mittari-pisteet kertovat',
    body: (
      <>
        <p>
          Mittari-pisteet (0–100) kertovat yhdessä numerossa, kuinka hyvä operaattori on
          suomalaiselle pelaajalle <em>juuri tänään</em>. Pisteet päivittyvät viikoittain
          ja reagoivat siihen, mitä todella tapahtuu — maksunopeudet, valitukset, lisenssi.
        </p>
        <p>
          Pisteet eivät kerro voitatko sinä. Ne kertovat, kuinka todennäköisesti
          operaattori käyttäytyy reilusti kun jotain menee pieleen.
        </p>
      </>
    ),
  },
  {
    id: 'objektiivi',
    icon: Database,
    title: 'Objektiiviset tekijät · 70 %',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Lisenssi ja turva · 20 %</strong></li>
        <li><strong>Maksunopeus · 18 %</strong> — 50 testitalletuksen mediaani</li>
        <li><strong>Pelivalikoima · 12 %</strong></li>
        <li><strong>Suomenkieliset ominaisuudet · 10 %</strong></li>
        <li><strong>Asiakaspalvelun reagointi · 5 %</strong></li>
        <li><strong>Bonusten rehellisyys · 5 %</strong></li>
      </ul>
    ),
  },
  {
    id: 'kaupallinen',
    icon: Hand,
    title: 'Toimituksellinen painotus · 30 %',
    body: (
      <p>
        Yhteisön signaalit, valitusten käsittely, toimituksen näkemys siitä, miten
        operaattori käyttäytyy poikkeuksissa. Kaupallinen yhteistyö <em>ei nosta</em>{' '}
        pisteitä. Affiliaatti-suhteet listataan sivulla{' '}
        <Link to="/affiliaatti" className="underline">affiliaatti</Link>.
      </p>
    ),
  },
  {
    id: 'ei-vaikuta',
    icon: Slash,
    title: 'Mikä EI vaikuta pisteisiin',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Affiliaatti-CPA · paljonko meille maksetaan asiakkaasta</li>
        <li>Mainossponsorit · ei mainoksia, ei sponsoreita</li>
        <li>Striimaajien suhteet operaattoriin</li>
        <li>Tervetuliaisbonuksen koko</li>
      </ul>
    ),
  },
  {
    id: 'floor',
    icon: BarChart3,
    title: 'Floor · minimivaatimukset',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Voimassa oleva eurooppalainen lisenssi</li>
        <li>Maksunopeus mediaani &lt; 48 h</li>
        <li>Suomenkielinen asiakaspalvelu arkisin 09–21</li>
        <li>Bonusehdot avoimesti suomeksi</li>
        <li>Vähintään 60 / 100 — alemmat eivät listalla</li>
      </ul>
    ),
  },
  {
    id: 'paivitykset',
    icon: Clock,
    title: 'Päivitysten taajuus',
    body: (
      <p>
        Datapohjaiset tekijät päivitetään <strong>viikoittain</strong>. Toimitukselliset
        arviot <strong>kuukausittain</strong>. Merkittävät muutokset (lisenssi katoaa,
        valitukset kasvavat) → päivitämme heti.
      </p>
    ),
  },
  {
    id: 'affiliaatti',
    icon: FileCheck,
    title: 'Affiliaatti-suhteet',
    body: (
      <p>
        Kaupalliset suhteet on rajattu maksimissaan <strong>+5 / 100</strong> ja
        ilmoitetaan jokaisen operaattorin arvio-sivulla. Vuonna 2027 (Suomen oma lisenssi)
        päivitämme suhteet kokonaan ja kerromme uudet etukäteen.
      </p>
    ),
  },
];

const SectionCard = ({ section, idx }) => {
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
            {String(idx + 1).padStart(2,'0')} · MENETELMÄ
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
  useDocumentMeta({
    title: 'Menetelmä — PUTKI HQ',
    description: 'Miten Mittari-pisteet syntyvät — objektiiviset tekijät 70 %, toimituksellinen painotus 30 %, ja mikä ei vaikuta.',
    canonical: `${BACKEND}/menetelma`,
  });

  return (
    <div data-testid="methodology-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">TOIMITUKSELLINEN MENETELMÄ</div>
          <h1 className="display text-4xl sm:text-6xl mb-6">Miten Mittari-pisteet syntyvät</h1>
          <p className="mono mb-5"
             style={{ fontSize: 13, letterSpacing: '0.12em', color: '#E8924A', fontWeight: 700 }}>
            MITTARI EI MITTAA RAHAA. MITTARI MITTAA HUOMIOTA.
          </p>
          <p className="prose-mittari max-w-2xl">
            Mittari-pisteet (0–100) muodostuvat <strong>objektiivisesta datasta (70 %)</strong> ja{' '}
            <strong>toimituksellisesta painotuksesta (30 %)</strong>. Tämä sivu on auki
            kaikille. Jos joku väittää meidän mainostaneen sijoituksia, lue tämä ja katso uudelleen.
          </p>
        </div>
      </section>

      <section className="container-wide pb-20 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {SECTIONS.map((s, i) => <SectionCard key={s.id} section={s} idx={i} />)}
        </div>
        <div className="max-w-3xl mt-8">
          <EditorialFooter />
        </div>
      </section>
    </div>
  );
};

export default Methodology;
