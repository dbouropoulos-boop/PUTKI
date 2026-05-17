import React from 'react';
import { EditorialFooter } from '../components/EditorialFooter';

const SECTIONS = [
  { id: 'mista',       title: 'Mistä Mittari-pisteet kertovat' },
  { id: 'objektiivi',  title: 'Objektiiviset tekijät' },
  { id: 'kaupallinen', title: 'Kaupallinen painotus' },
  { id: 'ei-vaikuta',  title: 'Mikä ei vaikuta pisteisiin' },
  { id: 'floor',       title: 'Floor: minimivaatimukset' },
  { id: 'paivitykset', title: 'Päivitysten taajuus' },
  { id: 'affiliaatti', title: 'Affiliaatiosuhteet' },
];

const Methodology = () => {
  return (
    <div data-testid="methodology-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">Toimituksellinen menetelmä</div>
          <h1 className="display text-4xl sm:text-6xl mb-6">Miten Mittari-pisteet syntyvät</h1>
          <p className="mono mb-5" data-testid="methodology-tagline" style={{ fontSize: 13, letterSpacing: '0.12em', color: '#E8924A', fontWeight: 700 }}>
            MITTARI EI MITTAA RAHAA. MITTARI MITTAA HUOMIOTA.
          </p>
          <p className="prose-mittari text-muted-text">
            Mittari-pisteet (0–100) muodostuvat kahdesta osasta: kovasta datasta ja toimituksellisesta painotuksesta. Tämä sivu on auki kaikille. Jos joku väittää meidän mainostaneen sijoituksia, lue tämä ja katso uudelleen.
          </p>
        </div>
      </section>

      <section className="container-wide pb-20 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          {/* TOC */}
          <aside className="lg:col-span-3 lg:sticky lg:top-24 lg:self-start" data-testid="methodology-toc">
            <div className="eyebrow mb-4">Sisältö</div>
            <nav className="space-y-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block font-display text-[13px] text-ink hover:text-brand-blue py-1"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* CONTENT */}
          <article className="lg:col-span-9 prose-mittari max-w-3xl">
            <section id="mista" className="mb-16" data-testid="section-0">
              <h2 className="display text-3xl sm:text-4xl mb-5">Mistä Mittari-pisteet kertovat</h2>
              <p>
                Mittari-pisteet kertovat yhdessä numerossa, kuinka hyvä operaattori on suomalaiselle pelaajalle <em>juuri tänään</em>. Pisteet eivät ole pysyvät — ne päivittyvät viikoittain ja reagoivat siihen, mitä todella tapahtuu (maksunopeudet hidastuvat, valitusten määrä kasvaa, lisenssi muuttuu).
              </p>
              <p>
                Pisteet eivät kerro, voitatko juuri sinä. Ne kertovat, kuinka todennäköisesti operaattori käyttäytyy reilusti, kun jotain menee pieleen.
              </p>
            </section>

            <section id="objektiivi" className="mb-16" data-testid="section-1">
              <h2 className="display text-3xl sm:text-4xl mb-5">Objektiiviset tekijät</h2>
              <p>
                70 prosenttia pisteistä tulee mitattavasta datasta:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Lisenssi ja turva (20 %)</strong> — MGA, AGCC, UKGC, Curaçao. Painotus eroavaisuuksiin.</li>
                <li><strong>Maksunopeus (18 %)</strong> — 50 testitalletuksen ja kotiutuksen mediaani per operaattori.</li>
                <li><strong>Pelivalikoima (12 %)</strong> — pelistudioiden määrä, uusien julkaisujen aikataulu.</li>
                <li><strong>Suomenkieliset ominaisuudet (10 %)</strong> — käyttöliittymä, asiakaspalvelu, bonusehdot suomeksi.</li>
                <li><strong>Asiakaspalvelun reagointi (5 %)</strong> — chat-vastausaika eri vuorokaudenaikoina.</li>
                <li><strong>Bonusten rehellisyys (5 %)</strong> — kierron, voimassaolon ja peli-rajoitusten selkeys.</li>
              </ul>
            </section>

            <section id="kaupallinen" className="mb-16" data-testid="section-2">
              <h2 className="display text-3xl sm:text-4xl mb-5">Kaupallinen painotus</h2>
              <p>
                30 prosenttia pisteistä on toimituksellinen arvio. Tähän kuuluu yhteisön signaalit (Ylilauta, Suomi24, Discord), pitkän aikavälin maine, valitusten käsittely AskGamblersilla ja Casino.Gurussa, sekä toimituksen oma näkemys siitä, kuinka operaattori käyttäytyy poikkeustilanteissa.
              </p>
              <p>
                Kaupallinen yhteistyö operaattorin kanssa <em>ei nosta</em> pisteitä. Affiliaatiosuhteet on listattu erikseen sivulla, ja ne ovat aina näkyvissä.
              </p>
            </section>

            <section id="ei-vaikuta" className="mb-16" data-testid="section-3">
              <h2 className="display text-3xl sm:text-4xl mb-5">Mikä ei vaikuta pisteisiin</h2>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Affiliaatti-CPA — paljonko meille maksetaan asiakkaasta.</li>
                <li>Mainossponsorit — ei mainoksia, ei sponsoreita.</li>
                <li>Striimaajien suhteet — operaattorin yhteistyö Jarttu84:n kanssa ei nosta pisteitä.</li>
                <li>Tervetuliaisbonuksen koko — bonuksen suuruus ei nosta pisteitä, ehdot voivat laskea niitä.</li>
              </ul>
            </section>

            <section id="floor" className="mb-16" data-testid="section-4">
              <h2 className="display text-3xl sm:text-4xl mb-5">Floor: minimivaatimukset</h2>
              <p>
                PUTKI HQ:n listauksessa olevien operaattoreiden täytyy täyttää nämä ehdot:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Voimassa oleva eurooppalainen lisenssi (tai vastaava).</li>
                <li>Maksunopeus alle 48 tuntia mediaanina.</li>
                <li>Suomenkielinen asiakaspalvelu vähintään arkisin 09–21.</li>
                <li>Avoin bonusehtojen julkaisu suomeksi.</li>
                <li>Vähintään 60 / 100 Mittari-pisteissä — alemmat eivät listalla.</li>
              </ul>
            </section>

            <section id="paivitykset" className="mb-16" data-testid="section-5">
              <h2 className="display text-3xl sm:text-4xl mb-5">Päivitysten taajuus</h2>
              <p>
                Datapohjaiset tekijät päivitetään viikoittain. Toimitukselliset arviot kuukausittain. Jos operaattorilla tapahtuu merkittävä muutos (lisenssi katoaa, maksuvalitukset kasvavat) — päivitämme heti.
              </p>
            </section>

            <section id="affiliaatti" className="mb-4" data-testid="section-6">
              <h2 className="display text-3xl sm:text-4xl mb-5">Affiliaatiosuhteet</h2>
              <p>
                PUTKI HQ saa affiliaattipalkkion osasta operaattoreita, kun pelaaja avaa tilin sivumme kautta. Tämä on ainoa ansaintamallimme. Se on listattu jokaisen operaattorin arvio-sivulla erikseen.
              </p>
              <p>
                Vuonna 2027, kun Suomen oma lisenssijärjestelmä avautuu, päivitämme tämän sivun täysin uudelleen ja kerromme uudet suhteet ennen niiden voimaantuloa.
              </p>
            </section>
          </article>
        </div>
        <div className="max-w-3xl mt-6">
          <EditorialFooter />
        </div>
      </section>
    </div>
  );
};

export default Methodology;
