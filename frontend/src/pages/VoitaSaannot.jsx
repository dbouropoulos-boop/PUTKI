/**
 * PUTKI HQ — VoitaSaannot (rules page).
 *
 * Pre-launch placeholder. Sako-reviewed final copy will replace the
 * body. Keep the structure: scoring, eligibility, draw mechanism, data
 * handling. Frontend never inlines marketing copy here — this is the
 * legal surface.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const VoitaSaannot = () => {
  const { lang } = useLang();
  return (
    <div data-testid="voita-saannot-page" style={{
      maxWidth: 760, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/voita" data-testid="voita-back-link" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← VOITA</Link>

      <h1 data-testid="voita-saannot-title" style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36,
        color: '#FFFFFF', margin: '20px 0 16px', letterSpacing: '-0.02em',
      }}>{lang === 'en' ? 'Voita raffle rules' : 'Voita-arvonnan säännöt'}</h1>

      <div style={{
        padding: 14, marginBottom: 24,
        background: '#3a2b08', border: '1px solid #7a5c1d',
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.10em',
        color: '#f4c66a',
      }}>{lang === 'en'
        ? 'DRAFT — AWAITING SAKO REVIEW. Final binding rules will replace this draft.'
        : 'LUONNOS — ODOTTAA SAKON TARKASTUSTA. Lopulliset sitovat säännöt korvaavat tämän luonnoksen.'}</div>

      <section style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFFFFF', marginTop: 0 }}>
          {lang === 'en' ? '1. Eligibility' : '1. Osallistumiskelpoisuus'}
        </h2>
        <p>{lang === 'en'
          ? 'Open to natural persons aged 18 or older residing in Finland. Free to enter. No purchase, no deposit, no operator account required.'
          : 'Osallistumisoikeus on Suomessa asuvilla 18 vuotta täyttäneillä luonnollisilla henkilöillä. Ilmainen osallistua. Ei ostoa, talletusta tai operaattoritiliä.'}</p>

        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFFFFF' }}>
          {lang === 'en' ? '2. Scoring' : '2. Pisteytys'}
        </h2>
        <ul>
          <li>{lang === 'en' ? 'Correct 1-X-2 prediction: 3 points.' : 'Oikea 1-X-2-veikkaus: 3 pistettä.'}</li>
          <li>{lang === 'en' ? 'Best-of score-variant points (not stackable):' : 'Lopputulospisteet (paras, eivät kasaudu):'}
            <ul>
              <li>{lang === 'en' ? 'Exact score: 5 points.' : 'Tarkka lopputulos: 5 pistettä.'}</li>
              <li>{lang === 'en' ? 'Goal-difference match: 3 points.' : 'Sama maaliero: 3 pistettä.'}</li>
              <li>{lang === 'en' ? 'Total-goals match: 1 point.' : 'Sama maalisumma: 1 piste.'}</li>
            </ul>
          </li>
          <li>{lang === 'en' ? 'Maximum per entry: 8 points (3 + 5).' : 'Suurin pistemäärä per osallistuminen: 8 pistettä (3 + 5).'}</li>
        </ul>

        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFFFFF' }}>
          {lang === 'en' ? '3. Draw mechanism' : '3. Arvontamenetelmä'}
        </h2>
        <p>{lang === 'en'
          ? 'Top 5 entries by points win a prize. Ties are broken by a deterministic random seed derived from the raffle ID and entry ID, allowing the editorial team to reproduce the draw for audit.'
          : 'Viisi eniten pisteitä saanutta osallistujaa voittaa palkinnon. Tasapelit ratkaistaan toistettavissa olevalla satunnaisluvulla, joka johdetaan arvonnan tunnuksesta ja osallistumistunnuksesta. Toimitus voi toistaa arvonnan auditointia varten.'}</p>

        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFFFFF' }}>
          {lang === 'en' ? '4. Prize cap' : '4. Palkintojen yläraja'}
        </h2>
        <p>{lang === 'en'
          ? 'Per-raffle prize pool is capped at €500 in total across all positions.'
          : 'Arvonnan palkintopotti on yhteensä enintään 500 €.'}</p>

        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFFFFF' }}>
          {lang === 'en' ? '5. Data handling' : '5. Henkilötietojen käsittely'}
        </h2>
        <p>{lang === 'en'
          ? 'Your email is used only to notify winners and announce results, on a legitimate-interest legal basis (contest administration). It is retained until 30 days after the match and then deleted, unless you separately and freely consented to marketing on the post-entry preferences page.'
          : 'Sähköpostiosoitettasi käytetään vain voittajien ilmoittamiseen ja tulosten julkaisuun oikeutetun edun perusteella (kilpailun hallinta). Tietosi säilytetään 30 päivää ottelun jälkeen ja poistetaan, ellet ole erikseen ja vapaaehtoisesti antanut suostumusta markkinointiin osallistumisen jälkeisellä sivulla.'}</p>
        <p>{lang === 'en'
          ? 'Marketing consents are stored as separate records with separate consent timestamps and separate retention periods. You may withdraw any marketing consent at any time without affecting your raffle entry.'
          : 'Markkinointisuostumukset tallennetaan erillisinä tietueina, joilla on omat suostumusaikaleimansa ja säilytysaikansa. Voit perua minkä tahansa markkinointisuostumuksen milloin tahansa ilman, että se vaikuttaa raffle-osallistumiseesi.'}</p>

        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#FFFFFF' }}>
          {lang === 'en' ? '6. Editorial product, not gambling' : '6. Toimituksellinen tuote, ei rahapeli'}
        </h2>
        <p>{lang === 'en'
          ? 'This is a free editorial raffle. It is not gambling: no stake is required, no monetary transaction is involved, and entries cannot be purchased.'
          : 'Tämä on ilmainen toimituksellinen arvonta. Se ei ole rahapeli: panosta ei vaadita, rahaliikennettä ei ole, eikä osallistumisia voi ostaa.'}</p>
      </section>
    </div>
  );
};

export default VoitaSaannot;
