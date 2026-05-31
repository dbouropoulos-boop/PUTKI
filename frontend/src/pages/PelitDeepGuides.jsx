import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { EditorialFooter } from '../components/EditorialFooter';
import InternalLinkStrip from '../components/InternalLinkStrip';

/**
 * Phase 4 P1 — deep game-literacy guides.
 *
 * Replaces the "coming soon" archive shells for the highest-traffic
 * /pelit/* surfaces with named-source, mathematical, plain-language
 * Finnish/English long-form. Mirrors the existing PelitNav so the
 * sub-navigation across the section stays consistent.
 *
 * Strict editorial rules (enforced by content authors, encoded in copy):
 *   - Skill-based games (blackjack, poker, video poker): optimal strategy permitted.
 *   - Slots: mechanics only — NEVER picks, NEVER hot/cold framing.
 *   - All gambling content: NEVER wealth-building, ALWAYS implicit responsible-gambling framing.
 *
 * Each guide carries:
 *   - useDocumentMeta for canonical / OG.
 *   - useJsonLd Article + BreadcrumbList schemas.
 *   - InternalLinkStrip with 3-4 curated cross-links.
 *   - EditorialFooter with read-time + updated-at + change-log link.
 */

const PelitNav = ({ lang }) => (
  <nav className="container-wide pb-4 flex flex-wrap gap-x-5 gap-y-2" data-testid="pelit-subnav">
    {[
      ['/pelit/blackjack', 'BLACKJACK'],
      ['/pelit/poker', 'POKER'],
      ['/pelit/slotit', lang === 'en' ? 'SLOTS' : 'SLOTIT'],
      ['/pelit/craps', 'CRAPS'],
      ['/pelit/ruletti', lang === 'en' ? 'ROULETTE' : 'RULETTI'],
      ['/pelit/live', 'LIVE'],
      ['/pelit/bonusmatematiikka', lang === 'en' ? 'BONUS MATH' : 'BONUSMATEMATIIKKA'],
    ].map(([to, label]) => (
      <Link
        key={to}
        to={to}
        className="mono"
        data-testid={`pelit-nav-${to.split('/').pop()}`}
        style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ember-strong)', fontWeight: 700 }}
      >
        {label}
      </Link>
    ))}
  </nav>
);

const Block = ({ tag, title, children, testId }) => (
  <section data-testid={testId} className="container-wide pb-10">
    {tag && (
      <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ember-strong)', fontWeight: 700 }}>
        {tag}
      </div>
    )}
    <h2 className="display text-2xl sm:text-3xl mb-4" style={{ color: 'var(--ink)' }}>{title}</h2>
    <div className="font-serif max-w-3xl" style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--ink-2)' }}>
      {children}
    </div>
  </section>
);

const Table = ({ head, rows, testId, mono = true }) => (
  <div data-testid={testId} className="container-wide pb-8">
    <div className="overflow-x-auto" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)' }}>
            {head.map((h) => (
              <th
                key={h}
                className="text-left p-3"
                style={{
                  fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : 'inherit',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className="p-3"
                  style={{
                    fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : 'inherit',
                    color: 'var(--ink)',
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const baseLinkStrip = (skip) => [
  { to: '/pelit', labelFi: 'Peliarkisto', labelEn: 'Game archive', hintFi: 'Kaikki PUTKI HQ:n peliluku­taitojutut yhdessä paikassa.', hintEn: 'Every PUTKI HQ literacy piece in one place.' },
  { to: '/pelit/bonusmatematiikka', labelFi: 'Bonusmatematiikka', labelEn: 'Bonus math', hintFi: 'Miksi 35x-kierrätys tappaa odotusarvon.', hintEn: 'Why 35× wagering kills expected value.' },
  { to: '/pelit/blackjack', labelFi: 'Blackjack', labelEn: 'Blackjack', hintFi: 'Perusstrategian referenssi ja sivupanosten matematiikka.', hintEn: 'Basic strategy reference + side-bet math.' },
  { to: '/pelit/slotit', labelFi: 'Slotit', labelEn: 'Slots', hintFi: 'RTP, volatiliteetti, bonus buy — pelkkä mekaniikka.', hintEn: 'RTP, volatility, bonus buy — mechanics only.' },
  { to: '/saantely/reform-2027', labelFi: 'Sääntely 2027', labelEn: 'Regulation 2027', hintFi: 'Mikä muuttuu pelimarkkinoilla heinäkuussa 2027.', hintEn: 'What changes in the gambling market on 2027-07-01.' },
].filter((l) => l.to !== skip).slice(0, 4);

/* ────────────────────────────────────────────────────────────────
 * /pelit/blackjack — deep guide
 * ────────────────────────────────────────────────────────────────*/
export const PelitBlackjackDeep = () => {
  const { lang } = useLang();
  const isEn = lang === 'en';
  useDocumentMeta({
    title: isEn ? 'Blackjack — basic strategy, side bets, card counting · PUTKI HQ' : 'Blackjack — perusstrategia, sivupanokset, korttilaskenta · PUTKI HQ',
    description: isEn
      ? 'PUTKI HQ basic-strategy reference + side-bet math + card-counting state of play in Finland 2026.'
      : 'PUTKI HQ:n perusstrategian referenssi, sivupanosten matematiikka, korttilaskennan nykytila Suomessa 2026.',
    canonical: 'https://putkihq.com/pelit/blackjack',
  });
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: isEn ? 'Blackjack — basic strategy, side bets, card counting' : 'Blackjack — perusstrategia, sivupanokset, korttilaskenta',
    author: { '@type': 'Organization', name: 'PUTKI HQ' },
    publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
    datePublished: '2026-02-01',
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: 'https://putkihq.com/pelit/blackjack',
    inLanguage: isEn ? 'en-FI' : 'fi-FI',
  });
  return (
    <div data-testid="pelit-blackjack-page" className="min-h-screen">
      <PelitNav lang={lang} />
      <section className="container-wide pt-6 pb-6">
        <div className="eyebrow mb-3" style={{ color: 'var(--ember-strong)' }}>{isEn ? 'BLACKJACK · OPTIMAL STRATEGY' : 'BLACKJACK · OPTIMAALISTRATEGIA'}</div>
        <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid="pelit-blackjack-page-headline">
          {isEn ? 'Blackjack — the one page you need before sitting down.' : 'Blackjack — yksi sivu jonka tarvitset ennen kuin istut pöytään.'}
        </h1>
        <p className="prose-mittari mt-5 max-w-3xl" data-testid="pelit-blackjack-page-intro">
          {isEn
            ? 'PUTKI HQ basic-strategy reference, side-bet math, and the state of card counting in Finland 2026. Sourced from Wizard of Odds + Casino.guru + academic gambling research. House edge with perfect basic strategy on a six-deck S17 game: 0.42%. Make a single mistake per shoe and you double it.'
            : 'PUTKI HQ:n perusstrategian referenssi, sivupanosten matematiikka ja korttilaskennan nykytila Suomessa 2026. Lähteet: Wizard of Odds + Casino.guru + akateeminen uhkapelitutkimus. Talon edge täydellisellä perusstrategialla kuuden pakan S17-pelissä: 0,42 %. Yksikin virhe kengässä tuplaa sen.'}
        </p>
      </section>

      <Block testId="pelit-blackjack-edge" tag={isEn ? 'HOUSE EDGE' : 'TALON EDGE'} title={isEn ? 'The math of the table' : 'Pöydän matematiikka'}>
        <p className="mb-4">
          {isEn
            ? 'Every blackjack ruleset publishes its own house edge. The two variables that move the needle most: number of decks and whether the dealer hits or stands on a soft 17. Below: standard online configurations and their edge with perfect basic strategy.'
            : 'Jokainen blackjack-säännöstö tuottaa oman talon edgen. Kaksi muuttujaa heiluttavat lukua eniten: pakkojen määrä ja jakajan tapa pehmeään 17:ään. Alla: yleisimmät online-asetukset ja niiden edge perusstrategialla.'}
        </p>
      </Block>
      <Table
        testId="pelit-blackjack-edge-table"
        head={isEn ? ['Decks', 'Dealer 17', 'Edge', 'EV / €100'] : ['Pakat', 'Jakaja 17', 'Edge', 'EV / 100 €']}
        rows={[
          ['1', 'S17', '0.17%', '-€0.17'],
          ['2', 'S17', '0.34%', '-€0.34'],
          ['6', 'S17', '0.42%', '-€0.42'],
          ['6', 'H17', '0.62%', '-€0.62'],
          ['8', 'H17', '0.65%', '-€0.65'],
        ]}
      />

      <Block testId="pelit-blackjack-strategy" tag={isEn ? 'BASIC STRATEGY' : 'PERUSSTRATEGIA'} title={isEn ? 'Eight rules that cover 95% of decisions' : 'Kahdeksan sääntöä joka kattaa 95 % päätöksistä'}>
        <ol className="list-decimal pl-6 space-y-2" data-testid="pelit-blackjack-rules">
          <li>{isEn ? 'Always split aces and 8s. Never split 5s or 10s.' : 'Jaa aina ässät ja 8:t. Älä koskaan jaa 5:iä tai 10:iä.'}</li>
          <li>{isEn ? 'Hard 11: always double if allowed.' : 'Kova 11: aina tuplaa, jos sallittu.'}</li>
          <li>{isEn ? 'Hard 10: double vs dealer 2-9, otherwise hit.' : 'Kova 10: tuplaa jakajaa vastaan 2-9, muuten lyö.'}</li>
          <li>{isEn ? 'Hard 9: double vs dealer 3-6, otherwise hit.' : 'Kova 9: tuplaa jakajaa vastaan 3-6, muuten lyö.'}</li>
          <li>{isEn ? 'Hard 12-16: stand vs dealer 2-6, hit vs 7+.' : 'Kova 12-16: passaa jakajaa vastaan 2-6, lyö 7+.'}</li>
          <li>{isEn ? 'Hard 17+: always stand.' : 'Kova 17+: passaa aina.'}</li>
          <li>{isEn ? 'Soft 18: hit vs 9, 10, A. Stand otherwise.' : 'Pehmeä 18: lyö 9:ää, 10:ää, A:ta vastaan. Muuten passaa.'}</li>
          <li>{isEn ? 'Never take insurance. The bet pays 2:1 against a ~1/3 probability — it’s a 5.9% house-edge prop.' : 'Älä koskaan ota vakuutusta. Veto maksaa 2:1 ~1/3 todennäköisyyttä vastaan — 5,9 % talon edgen sivuveto.'}</li>
        </ol>
      </Block>

      <Block testId="pelit-blackjack-sidebets" tag={isEn ? 'SIDE BETS' : 'SIVUPANOKSET'} title={isEn ? 'Side bets ranked by expected value' : 'Sivupanokset järjestettynä odotusarvon mukaan'}>
        <p className="mb-3">
          {isEn
            ? 'Side bets exist to widen the casino’s margin. None are worth playing without a card-counting overlay. House edges sourced from Wizard of Odds.'
            : 'Sivupanokset ovat olemassa kasinon marginaalin laajentamiseksi. Yhtäkään ei kannata pelata ilman korttilaskenta-overlayta. Talon edget Wizard of Oddsista.'}
        </p>
      </Block>
      <Table
        testId="pelit-blackjack-sidebets-table"
        head={isEn ? ['Side bet', 'House edge', 'Verdict'] : ['Sivupanos', 'Talon edge', 'Verdikti']}
        rows={[
          ['21+3', '3.24%', isEn ? 'Least bad' : 'Vähiten huono'],
          ['Perfect Pairs', '4.10%', isEn ? 'Skip' : 'Ohita'],
          ['Lucky Ladies', '17.6%', isEn ? 'Avoid' : 'Vältä'],
          ['Insurance', '5.9%', isEn ? 'Never' : 'Ei koskaan'],
        ]}
      />

      <Block testId="pelit-blackjack-counting" tag={isEn ? 'CARD COUNTING' : 'KORTTILASKENTA'} title={isEn ? 'Card counting in Finland 2026' : 'Korttilaskenta Suomessa 2026'}>
        <p>
          {isEn
            ? 'Online: continuous-shuffle RNG kills any count. Counting only works at live-dealer studios that deal from a real shoe AND don’t reshuffle every hand — increasingly rare. Land-based Veikkaus-operated casinos (Helsinki, Tampere) reshuffle aggressively. Practical EV for a counter today: marginal. PUTKI HQ records this for completeness, not as a strategy recommendation.'
            : 'Online: jatkuvasti sekoittava RNG tappaa minkä tahansa lasun. Laskenta toimii vain live-jakajastudoissa joissa jaetaan oikeasta kengästä EIKÄ sekoiteta joka kädessä — yhä harvinaisempaa. Veikkauksen kasinot (Helsinki, Tampere) sekoittavat aggressiivisesti. Käytännön EV laskijalle 2026: marginaalinen. PUTKI HQ kirjaa tämän kattavuuden vuoksi, ei strategiasuosituksena.'}
        </p>
      </Block>

      <InternalLinkStrip testId="pelit-blackjack-related" links={baseLinkStrip('/pelit/blackjack')} />
      <section className="container-wide pb-14">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={6} />
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
 * /pelit/slotit — deep guide (mechanics-only)
 * ────────────────────────────────────────────────────────────────*/
export const PelitSlotitDeep = () => {
  const { lang } = useLang();
  const isEn = lang === 'en';
  useDocumentMeta({
    title: isEn ? 'Slots — mechanics, RTP, volatility · PUTKI HQ' : 'Slotit — mekaniikka, RTP, volatiliteetti · PUTKI HQ',
    description: isEn
      ? 'RTP, volatility, bonus-buy mathematics. PUTKI HQ does not recommend specific slot games — only mechanics.'
      : 'RTP, volatiliteetti, bonus buy -matematiikka. PUTKI HQ ei suosittele yksittäisiä slotteja — vain mekaniikkaa.',
    canonical: 'https://putkihq.com/pelit/slotit',
  });
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: isEn ? 'Slots — mechanics, RTP, volatility' : 'Slotit — mekaniikka, RTP, volatiliteetti',
    author: { '@type': 'Organization', name: 'PUTKI HQ' },
    publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
    datePublished: '2026-02-01',
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: 'https://putkihq.com/pelit/slotit',
    inLanguage: isEn ? 'en-FI' : 'fi-FI',
  });
  return (
    <div data-testid="pelit-slotit-page" className="min-h-screen">
      <PelitNav lang={lang} />
      <section className="container-wide pt-6 pb-6">
        <div className="eyebrow mb-3" style={{ color: 'var(--ember-strong)' }}>{isEn ? 'SLOTS · LITERACY ONLY' : 'SLOTIT · VAIN LUKUTAITO'}</div>
        <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid="pelit-slotit-page-headline">
          {isEn ? 'Slots — the mechanics. No picks. No hot / cold.' : 'Slotit — mekaniikka. Ei pelipikkejä. Ei kuumaa / kylmää.'}
        </h1>
        <p className="prose-mittari mt-5 max-w-3xl" data-testid="pelit-slotit-page-intro">
          {isEn
            ? 'PUTKI HQ does not recommend specific slot games. We explain how RTP, volatility, hit rate, and bonus-buy math work — so you can read a paytable before you click "spin". A "hot" slot does not exist outside variance. A "due" win does not exist at all.'
            : 'PUTKI HQ ei suosittele yksittäisiä slotteja. Selitämme miten RTP, volatiliteetti, osumataajuus ja bonus buy -matematiikka toimivat — jotta osaat lukea pelitaulukon ennen kuin painat "pyöritä". "Kuuma" slotti ei ole olemassa varianssin ulkopuolella. "Tulossa oleva" voitto ei ole olemassa lainkaan.'}
        </p>
      </section>

      <Block testId="pelit-slotit-rtp" tag={isEn ? 'RTP' : 'RTP'} title={isEn ? 'RTP is a long-run average — not your night' : 'RTP on pitkän ajan keskiarvo — ei sinun iltasi'}>
        <p>
          {isEn
            ? 'A 96% RTP slot returns €96 per €100 wagered — averaged over hundreds of millions of spins. Your 200-spin session is 99.9999% variance, 0.0001% RTP. The expected loss on €1 × 200 spins at 96% RTP is €8, but the actual outcome distribution has a standard deviation of ~€50-€150 depending on volatility.'
            : '96 %:n RTP slotti palauttaa 96 € jokaisesta 100 €:n panoksesta — keskiarvona satojen miljoonien pyöritysten yli. Sinun 200 pyörityksen sessiosi on 99,9999 % varianssia, 0,0001 % RTP:tä. Odotettu tappio 1 € × 200 pyöritystä 96 %:n RTP:llä on 8 €, mutta jakauman keskihajonta on noin 50-150 € volatiliteetista riippuen.'}
        </p>
      </Block>

      <Block testId="pelit-slotit-volatility" tag={isEn ? 'VOLATILITY' : 'VOLATILITEETTI'} title={isEn ? 'Volatility is shaped by hit rate × max win' : 'Volatiliteetti = osumataajuus × maxvoitto'}>
        <p className="mb-3">
          {isEn ? 'Two slots with identical 96% RTP can feel completely different. The difference is volatility: how often you hit anything (hit rate) and how big the top end is (max-win cap).' : 'Kaksi 96 %:n RTP-slottia voivat tuntua täysin erilaisilta. Ero on volatiliteetti: kuinka usein osut mihinkään (osumataajuus) ja kuinka iso huippu on (maxvoittokatto).'}
        </p>
      </Block>
      <Table
        testId="pelit-slotit-volatility-table"
        head={isEn ? ['Volatility', 'Hit rate', 'Max win', 'Typical title'] : ['Volatiliteetti', 'Osumataajuus', 'Maxvoitto', 'Tyyppipeli']}
        rows={[
          [isEn ? 'Low' : 'Matala', '30-35%', '500×', 'Starburst-tyylinen'],
          [isEn ? 'Medium' : 'Keski', '25-30%', '2 000×', 'Book-of-tyylinen'],
          [isEn ? 'High' : 'Korkea', '20-24%', '10 000×', 'Megaways-tyylinen'],
          [isEn ? 'Extreme' : 'Äärimmäinen', '15-20%', '50 000×+', 'Nolimit-tyylinen'],
        ]}
      />

      <Block testId="pelit-slotit-bonusbuy" tag={isEn ? 'BONUS BUY' : 'BONUS BUY'} title={isEn ? 'Bonus buy maths: paying for variance compression' : 'Bonus buy -matematiikka: maksat varianssin tiivistämisestä'}>
        <p>
          {isEn
            ? 'A "bonus buy" lets you skip base spins and enter the feature for 50× — 100× your stake. Most bonus-buy modes raise the slot RTP by 0.5-1.5 percentage points compared to base play, but at the cost of an enormous single-spin variance. Math: a €100 buy at 96.5% RTP has an expected loss of €3.50 with a per-buy standard deviation often exceeding €300. Two unlucky buys can spend a session’s budget in 90 seconds.'
            : '"Bonus buy" antaa sinun ohittaa peruspyörityksen ja siirtyä bonusominaisuuteen 50× — 100× panoksellasi. Useimmat bonus buy -tilat nostavat slotin RTP:tä 0,5-1,5 prosenttiyksikköä peruspeliin verrattuna, mutta jättimäisen yksittäispyörityksen varianssin hinnalla. Matematiikka: 100 €:n osto 96,5 %:n RTP:llä → odotettu tappio 3,50 €, mutta keskihajonta usein yli 300 € per osto. Kaksi epäonnista ostoa polttaa illan budjetin 90 sekunnissa.'}
        </p>
      </Block>

      <Block testId="pelit-slotit-myths" tag={isEn ? 'MYTHS' : 'MYYTIT'} title={isEn ? 'What is NOT real' : 'Mikä EI ole totta'}>
        <ul className="list-disc pl-6 space-y-2" data-testid="pelit-slotit-myths-list">
          <li>{isEn ? '"This slot is hot." Slots have no memory. Every spin is independent.' : '"Tämä slotti on kuuma." Slotilla ei ole muistia. Jokainen pyöritys on itsenäinen.'}</li>
          <li>{isEn ? '"It’s about to hit." There is no due event. Probability does not accumulate.' : '"Se on tulossa." Ei ole olemassa tulossa olevaa tapahtumaa. Todennäköisyys ei kerry.'}</li>
          <li>{isEn ? '"Auto-spin is rigged differently." It’s the same RNG, same RTP.' : '"Auto-spin on säädetty toisin." Sama RNG, sama RTP.'}</li>
          <li>{isEn ? '"Higher stakes pay better." RTP is fixed per game variant, not per stake.' : '"Isommat panokset maksavat paremmin." RTP on kiinteä peliversioon, ei panokseen.'}</li>
        </ul>
      </Block>

      <InternalLinkStrip testId="pelit-slotit-related" links={baseLinkStrip('/pelit/slotit')} />
      <section className="container-wide pb-14">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={5} />
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
 * /pelit/bonusmatematiikka — deep guide
 * ────────────────────────────────────────────────────────────────*/
export const PelitBonusmatematiikkaDeep = () => {
  const { lang } = useLang();
  const isEn = lang === 'en';
  useDocumentMeta({
    title: isEn ? 'Bonus math — why 35× kills · PUTKI HQ' : 'Bonusmatematiikka — miksi 35× tappaa · PUTKI HQ',
    description: isEn
      ? 'Wagering, sticky vs cashable, EV math by hand. Most bonuses are negative-EV.'
      : 'Kierrätys, sticky vs cashable, odotusarvon laskenta käsin. Useimmat bonukset ovat negatiivisen odotusarvon.',
    canonical: 'https://putkihq.com/pelit/bonusmatematiikka',
  });
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: isEn ? 'Bonus math — why 35× kills' : 'Bonusmatematiikka — miksi 35× tappaa',
    author: { '@type': 'Organization', name: 'PUTKI HQ' },
    publisher: { '@type': 'Organization', name: 'PUTKI HQ', url: 'https://putkihq.com' },
    datePublished: '2026-02-01',
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: 'https://putkihq.com/pelit/bonusmatematiikka',
    inLanguage: isEn ? 'en-FI' : 'fi-FI',
  });
  return (
    <div data-testid="pelit-bonusmatematiikka-page" className="min-h-screen">
      <PelitNav lang={lang} />
      <section className="container-wide pt-6 pb-6">
        <div className="eyebrow mb-3" style={{ color: 'var(--ember-strong)' }}>{isEn ? 'BONUS · MATHEMATICS' : 'BONUS · MATEMATIIKKA'}</div>
        <h1 className="display text-4xl sm:text-5xl lg:text-6xl" data-testid="pelit-bonusmatematiikka-page-headline">
          {isEn ? 'Bonus math — why 35× wagering kills the EV.' : 'Bonusmatematiikka — miksi 35× kierrätys tappaa odotusarvon.'}
        </h1>
        <p className="prose-mittari mt-5 max-w-3xl" data-testid="pelit-bonusmatematiikka-page-intro">
          {isEn
            ? 'A €100 "100% bonus + €100 free spins" looks like €200 of upside. The wagering requirement does the actual math. PUTKI HQ runs the EV by hand so you can read a T&C in 30 seconds.'
            : '100 €:n "100 % bonus + 100 €:n ilmaispyöräytykset" näyttää 200 €:n nousulta. Kierrätysvaatimus tekee oikean matematiikan. PUTKI HQ laskee odotusarvon käsin, jotta osaat lukea ehdot 30 sekunnissa.'}
        </p>
      </section>

      <Block testId="pelit-bonusmatematiikka-formula" tag={isEn ? 'FORMULA' : 'KAAVA'} title={isEn ? 'The one-line EV formula' : 'Yhden rivin EV-kaava'}>
        <p className="mb-3">
          {isEn ? 'For a cashable bonus on a slot with RTP r and wagering requirement w on (deposit + bonus):' : 'Cashable-bonukselle slotissa, jonka RTP on r ja kierrätysvaatimus w (talletus + bonus):'}
        </p>
        <pre
          data-testid="pelit-bonusmatematiikka-formula-code"
          className="overflow-x-auto p-4"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ink)',
          }}
        >{`EV = (deposit + bonus) × (1 - (1 - r) × w) - deposit`}</pre>
        <p className="mt-3">
          {isEn
            ? 'Concretely: a €100 deposit + €100 bonus with 35× wagering on a 96% RTP slot gives EV = €200 × (1 - 0.04 × 35) - €100 = €200 × (-0.40) - €100 = -€180. That is the expected outcome.'
            : 'Käytännössä: 100 €:n talletus + 100 €:n bonus, 35× kierrätys, 96 %:n RTP-slot tuottaa EV = 200 € × (1 - 0,04 × 35) - 100 € = 200 € × (-0,40) - 100 € = -180 €. Sen verran odotusarvossa.'}
        </p>
      </Block>

      <Table
        testId="pelit-bonusmatematiikka-table"
        head={isEn ? ['Wagering ×', 'RTP', 'Net EV on €100+€100'] : ['Kierrätys ×', 'RTP', 'Netto EV 100 €+100 €']}
        rows={[
          ['15×', '97%', '+€10'],
          ['20×', '97%', '-€20'],
          ['25×', '96%', '-€100'],
          ['35×', '96%', '-€180'],
          ['40×', '96%', '-€220'],
          ['50×', '95%', '-€400'],
        ]}
      />

      <Block testId="pelit-bonusmatematiikka-sticky" tag={isEn ? 'STICKY VS CASHABLE' : 'STICKY VS CASHABLE'} title={isEn ? 'Read the bonus type first' : 'Lue ensin bonustyyppi'}>
        <p>
          {isEn
            ? 'Cashable: the bonus amount stays in your balance after wagering is cleared. Sticky: the bonus disappears at withdrawal — you only keep winnings above the bonus. A sticky bonus is mathematically a free shot with bounded upside; never treat it as deposit value. Hybrid sticky (a.k.a. "phantom") bonuses subtract the bonus from your balance at cashout — the difference matters once you do real arithmetic.'
            : 'Cashable: bonusraha jää saldoosi kierrätyksen jälkeen. Sticky: bonus katoaa nostohetkellä — pidät vain voitot bonuksen yli. Sticky-bonus on matemaattisesti ilmainen yritys rajatulla nousulla; älä koskaan kohtele sitä talletuksen arvona. Hybrid sticky (eli "phantom") vähentää bonuksen saldosta nostoon — ero on merkittävä, kun lasket käsin.'}
        </p>
      </Block>

      <Block testId="pelit-bonusmatematiikka-redflags" tag={isEn ? 'RED FLAGS' : 'PUNAISET LIPUT'} title={isEn ? 'Five lines in any T&C that destroy value' : 'Viisi riviä ehdoista jotka tappavat arvon'}>
        <ol className="list-decimal pl-6 space-y-2" data-testid="pelit-bonusmatematiikka-redflags-list">
          <li>{isEn ? 'Wagering on (deposit + bonus), not just bonus.' : 'Kierrätys (talletus + bonus), ei pelkkä bonus.'}</li>
          <li>{isEn ? 'Max bet during wagering < €5 — easy to forget, instant void.' : 'Maxpanos kierrätyksen aikana < 5 € — helppo unohtaa, mitätöinti välitön.'}</li>
          <li>{isEn ? 'Game weighting: blackjack at 5%, slots at 100% — kills any low-edge strategy.' : 'Pelipainotus: blackjack 5 %, slotit 100 % — tappaa minkä tahansa low-edge-strategian.'}</li>
          <li>{isEn ? 'Max cashout cap (e.g., 5× bonus) — bounds your upside while leaving downside open.' : 'Maxnoston katto (esim. 5× bonus) — rajoittaa nousun ja jättää laskun auki.'}</li>
          <li>{isEn ? 'Bonus expiration < 14 days — forces play volume.' : 'Bonuksen vanhenemisaika < 14 vrk — pakottaa pelin volyymiin.'}</li>
        </ol>
      </Block>

      <InternalLinkStrip testId="pelit-bonusmatematiikka-related" links={baseLinkStrip('/pelit/bonusmatematiikka')} />
      <section className="container-wide pb-14">
        <EditorialFooter updatedAt="2026-02-01T09:00:00Z" readMinutes={5} />
      </section>
    </div>
  );
};

export default PelitBlackjackDeep;
