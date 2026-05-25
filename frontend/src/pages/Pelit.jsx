import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { EditorialArchivePage } from '../components/EditorialArchivePage';

// /pelit + sub-pages - Game literacy archive. V2 §9.5.
// Strict editorial rules:
//   - Skill-based games (blackjack, poker, video poker, craps bets): optimal strategy permitted
//   - Slots: mechanics-only, NEVER picks, NEVER hot/cold framing
//   - All gambling content: NEVER wealth-building frame, ALWAYS implicit responsible-gambling framing

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
      <Link key={to} to={to} className="mono" data-testid={`pelit-nav-${to.split('/').pop()}`} style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--brand-blue, #5A7BB8)', fontWeight: 700 }}>
        {label}
      </Link>
    ))}
  </nav>
);

const PelitShell = ({ testId, surfaceKey, eyebrow, headline, intro, comingSoonHeadline, comingSoonBody }) => {
  const { lang } = useLang();
  return (
    <div>
      <PelitNav lang={lang} />
      <EditorialArchivePage
        testId={testId}
        surfaceKey={surfaceKey}
        eyebrow={eyebrow}
        headline={headline}
        intro={intro}
        comingSoonHeadline={comingSoonHeadline}
        comingSoonBody={comingSoonBody}
      />
    </div>
  );
};

export const Pelit = () => {
  const { lang } = useLang();
  return (
    <PelitShell
      testId="pelit-page"
      surfaceKey="pelit"
      eyebrow={lang === 'en' ? 'GAME LITERACY · INDEX' : 'PELILUKUTAITO · HAKEMISTO'}
      headline={lang === 'en' ? 'Understand the math before you play' : 'Ymmärrä matematiikka ennen kuin pelaat'}
      intro={
        lang === 'en'
          ? 'PUTKI HQ teaches how casino games actually work. Skill-based games (blackjack, poker, video poker) get optimal strategy. Slots get mechanics only - no picks, no hot/cold, ever. House edge is the constant. Wealth-building is not the frame.'
          : 'PUTKI HQ opettaa miten kasinopelit oikeasti toimivat. Taitopohjaisille peleille (blackjack, poker, video poker) optimaalistrategia. Slotit: vain mekaniikka - ei pelipikkejä, ei "kuumaa/kylmää" koskaan. House edge on vakio. Varallisuuden rakentaminen ei ole se kehys.'
      }
      comingSoonHeadline={lang === 'en' ? 'Blackjack basic strategy reference, RTP demystified, bonus EV calculator.' : 'Blackjackin perusstrategian referenssikortti, RTP avattuna, bonusten odotusarvolaskin.'}
      comingSoonBody={
        lang === 'en'
          ? '1-2 literacy pieces per week. 600-1 500 words each. Mathematical, sourced (Wizard of Odds, Casino.guru, academic gambling research), Finnish-context applied.'
          : '1-2 lukutaitojuttua viikossa. 600-1 500 sanaa kukin. Matemaattista, lähteet (Wizard of Odds, Casino.guru, akateeminen tutkimus), suomalaiseen kontekstiin sovellettua.'
      }
    />
  );
};

const makeSub = (slug, eyebrowFi, eyebrowEn, headlineFi, headlineEn, introFi, introEn, comingFi, comingEn) => () => {
  const { lang } = useLang();
  return (
    <PelitShell
      testId={`pelit-${slug}-page`}
      surfaceKey={`pelit_${slug}`}
      eyebrow={lang === 'en' ? eyebrowEn : eyebrowFi}
      headline={lang === 'en' ? headlineEn : headlineFi}
      intro={lang === 'en' ? introEn : introFi}
      comingSoonHeadline={lang === 'en' ? comingEn : comingFi}
      comingSoonBody={
        lang === 'en'
          ? 'PUTKI HQ is sourcing this category from Wizard of Odds, Casino.guru, academic gambling research and applying it to the Finnish context. Three pieces will land in the first publication wave.'
          : 'PUTKI HQ -toimitus hakee tämän kategorian lähteet Wizard of Oddsista, Casino.gurusta ja akateemisesta uhkapelitutkimuksesta ja soveltaa ne suomalaiseen kontekstiin. Kolme juttua ensimmäisessä julkaisuaaltoon.'
      }
    />
  );
};

export const PelitBlackjack = makeSub('blackjack',
  'BLACKJACK · OPTIMAL STRATEGY', 'BLACKJACK · OPTIMAL STRATEGY',
  'Blackjack - yhden sivun referenssi', 'Blackjack - one-page reference',
  'PUTKI HQ -perusstrategian referenssi, sivupanosten matematiikka, korttilaskennan nykytila Suomessa 2026.',
  'PUTKI HQ basic-strategy reference, side-bet mathematics, card counting state of play in Finland 2026.',
  'Perusstrategia, sivupanokset, korttilaskenta käytännössä.', 'Basic strategy, side bets, card counting in practice.');

export const PelitPoker = makeSub('poker',
  'POKER · FUNDAMENTALS', 'POKER · FUNDAMENTALS',
  'Texas Hold\u2019em ja video poker', 'Texas Hold\u2019em and video poker',
  'Aloittelijan matemaattinen opas. Pelkkää matematiikkaa - ei psykologiaa, ei "tells", ei flexiä.',
  'A beginner\u2019s mathematical guide. Just math - no psychology, no tells, no flex.',
  'Pot odds, video poker pay-table-vaikutus, käden valinta.', 'Pot odds, video poker pay table impact, hand selection.');

export const PelitSlotit = makeSub('slotit',
  'SLOTS · LITERACY ONLY', 'SLOTS · LITERACY ONLY',
  'Slotit - mekaniikka, ei pikkejä', 'Slots - mechanics only, no picks',
  'PUTKI HQ ei suosittele yksittäisiä slot-pelejä. Selitämme RTP:n, volatiliteetin, bonus buy -matematiikan. "Kuuma" tai "kylmä" eivät ole olemassa varianssin ulkopuolella.',
  'PUTKI HQ does not recommend specific slot games. We explain RTP, volatility, bonus-buy mathematics. "Hot" or "cold" do not exist outside variance.',
  'RTP, volatiliteetti, bonus buy -matematiikka.', 'RTP, volatility, bonus-buy mathematics.');

export const PelitCraps = makeSub('craps',
  'CRAPS · BET ANALYSIS', 'CRAPS · BET ANALYSIS',
  'Craps - vetojen matemaattinen järjestys', 'Craps - bets ranked by math',
  'Pass-line ja Don\u2019t-pass odds-tuelle saatavissa parhaat odotusarvot. Sucker bets keskellä pöytää.',
  'Pass-line and Don\u2019t-pass with odds offer the best expected value. Sucker bets sit in the middle of the table.',
  'Vetojen luokitus, odds-vedot, vältettävät panokset.', 'Bet ranking, odds bets, what to avoid.');

export const PelitRuletti = makeSub('ruletti',
  'ROULETTE · MATH', 'ROULETTE · MATH',
  'Ruletti - kaikki panostukset palaavat samaan', 'Roulette - every bet returns the same edge',
  'Eurooppalainen ruletti 2,7 % house edge. Yhdysvaltalainen 5,26 %. Loput on visualisointia.',
  'European wheel 2.7% house edge. American wheel 5.26%. Everything else is visualization.',
  'House edge, eurooppalainen vs amerikkalainen, järjestelmäharha.', 'House edge, European vs American, systems fallacy.');

export const PelitLive = makeSub('live',
  'LIVE CASINO · LITERACY', 'LIVE CASINO · LITERACY',
  'Live-kasino - miten pelit oikeasti toimivat', 'Live casino - how the games actually work',
  'Live blackjack, live ruletti, Crazy Time. Mekaniikka, talohacks, missä studio sijaitsee, mitä se merkitsee odotusarvolle.',
  'Live blackjack, live roulette, Crazy Time. Mechanics, studio locations, what they mean for expected value.',
  'Studio-talous, latenssi, RNG vs ihmiset.', 'Studio economics, latency, RNG vs human dealers.');

export const PelitBonusmatematiikka = makeSub('bonusmatematiikka',
  'BONUS · MATHEMATICS', 'BONUS · MATHEMATICS',
  'Bonusmatematiikka - miksi 35x tappaa', 'Bonus mathematics - why 35x kills',
  'Kierrätysvaatimukset, sticky vs cashable, odotusarvon laskenta käsin. Useimmat bonukset ovat negatiivisen odotusarvon.',
  'Wagering, sticky vs cashable, expected-value math by hand. Most bonuses are negative-EV.',
  'Kierrätys, EV-laskenta, sticky-mekaniikka.', 'Wagering, EV calculation, sticky mechanics.');

export default Pelit;
