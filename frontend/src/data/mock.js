// Mock data for Mittari.fi Phase 1
// All Finnish copy in Mittari editorial voice: honest, restrained, occasionally pointed.

export const DIAL_STATES = {
  KYLMA:       { key: 'KYLMA',       label: 'KYLMÄ',       color: '#2C5F8D', value: 12, headline: 'Mittari on KYLMÄ. Skene nukkuu.' },
  HAALEA:      { key: 'HAALEA',      label: 'HAALEA',      color: '#7A7E83', value: 38, headline: 'Mittari on HAALEA. Tasaista taustakohinaa.' },
  KUUMA:       { key: 'KUUMA',       label: 'KUUMA',       color: '#E8924A', value: 64, headline: 'Mittari on KUUMA. Slot-skene lämpenee illaksi.' },
  MYRSKY:      { key: 'MYRSKY',      label: 'MYRSKY',      color: '#C8423C', value: 82, headline: 'Mittari on MYRSKY. Striimit täynnä, klippejä syntyy.' },
  KIIRASTULI:  { key: 'KIIRASTULI',  label: 'KIIRASTULI',  color: '#8B1E1A', value: 96, headline: 'Mittari on KIIRASTULI. Älä katso pois.' },
};

export const CURRENT_DIAL = DIAL_STATES.KUUMA;

// 18 launch streamers — real names per problem statement
export const STREAMERS = [
  { slug: 'jarttu84',     name: 'Jarttu84',     platform: 'Twitch', tier: 1, live: true,  viewers: 4820, playing: 'Sweet Bonanza 1000',         photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '128k', sub: 'Jarttu84 on Suomen slot-skenen perustuskivi — vuodesta 2016 lähtien.' },
  { slug: 'jugipelaa',    name: 'JugiPelaa',    platform: 'Twitch', tier: 1, live: true,  viewers: 3120, playing: 'Gates of Olympus',           photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',                                                              dial: 'MYRSKY',    followers: '66k',  sub: 'Energinen, äänekäs, lähes meemiksi muodostunut tyyli.' },
  { slug: 'andypyro',     name: 'AndyPyro',     platform: 'Twitch', tier: 1, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '54k',  sub: 'Anssi Huovinen. Fire in the Hole -ikoni.' },
  { slug: 'ogumtv',       name: 'OgumTV',       platform: 'Twitch', tier: 1, live: true,  viewers: 2410, playing: 'The Dog House Megaways',     photo: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '42k',  sub: 'Top 3 suomalainen Twitch-katselutuntien mukaan.' },
  { slug: 'pact',         name: 'pact',         platform: 'Kick',   tier: 1, live: true,  viewers: 5640, playing: 'Big Bass Splash',            photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',                                                              dial: 'MYRSKY',    followers: '89k',  sub: 'Kickin suomalainen ykkönen.' },
  { slug: 'jamppa',       name: 'Jamppa',       platform: 'Twitch', tier: 1, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop',                                                              dial: 'HAALEA',    followers: '31k',  sub: 'Yhteisön top-5:n vakionimi.' },
  { slug: 'ella',         name: 'Ella',         platform: 'Twitch', tier: 1, live: true,  viewers: 1840, playing: 'Sugar Rush',                 photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '28k',  sub: 'Vakaa esiintyjä, yhteisön kestosuosikki.' },
  { slug: 'teukka',       name: 'Teukka',       platform: 'Twitch', tier: 1, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop',                                                              dial: 'HAALEA',    followers: '24k',  sub: 'Pitkä linja, pelaa monipuolisesti.' },
  { slug: 'julia',        name: 'Julia',        platform: 'Twitch', tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',                                                              dial: 'HAALEA',    followers: '19k',  sub: null },
  { slug: 'huispaaja',    name: 'Huispaaja',    platform: 'Twitch', tier: 2, live: true,  viewers: 720,  playing: 'Money Train 4',              photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '17k',  sub: null },
  { slug: 'korpisoturi',  name: 'Korpisoturi',  platform: 'Twitch', tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400&h=400&fit=crop',                                                              dial: 'KYLMA',     followers: '15k',  sub: null },
  { slug: 'slotsband',    name: 'Slotsband',    platform: 'Twitch', tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop',                                                              dial: 'HAALEA',    followers: '12k',  sub: null },
  { slug: 'lyijyleka',    name: 'Lyijyleka',    platform: 'Twitch', tier: 2, live: true,  viewers: 420,  playing: 'Fire in the Hole 2',         photo: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '11k',  sub: null },
  { slug: 'vihis',        name: 'Vihis',        platform: 'Twitch', tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&h=400&fit=crop',                                                              dial: 'KYLMA',     followers: '9k',   sub: null },
  { slug: 'konna',        name: 'Konna',        platform: 'Twitch', tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop',                                                              dial: 'HAALEA',    followers: '8k',   sub: null },
  { slug: 'larvinen',     name: 'Lärvinen',     platform: 'Twitch', tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop',                                                              dial: 'KYLMA',     followers: '14k',  sub: null },
  { slug: 'monnirs',      name: 'monnirs',      platform: 'Kick',   tier: 2, live: true,  viewers: 1120, playing: 'Gates of Olympus 1000',      photo: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400&h=400&fit=crop',                                                              dial: 'KUUMA',     followers: '22k',  sub: null },
  { slug: 'iippadaa',     name: 'iippadaa',     platform: 'Kick',   tier: 2, live: false, viewers: 0,    playing: null,                          photo: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop',                                                              dial: 'HAALEA',    followers: '18k',  sub: null },
];

// 12 mock operators ranked
export const OPERATORS = [
  { slug: 'weezybet',      name: 'Weezybet',      logo: 'W',  score: 94, oneLiner: 'Maksunopeus kuin Veikkauksella, kirjasto kuin Pinnacle.',                offer: '100% / 500€ + 200 FS',  payout: '< 2 h', license: 'MGA',  trustpilot: 4.4, year: 2022 },
  { slug: 'norgekasino',   name: 'Norge Kasino',  logo: 'N',  score: 88, oneLiner: 'Pohjoismaisia kasinoita parhaimmillaan — selkeät ehdot.',               offer: '200% / 1000€',           payout: '4–8 h', license: 'MGA',  trustpilot: 4.2, year: 2019 },
  { slug: 'tilttarkka',    name: 'Tilttarkka',    logo: 'T',  score: 84, oneLiner: 'Pragmatic Play -valikoima täynnä, mobiili toimii.',                     offer: '100% / 300€ + 100 FS',  payout: '< 4 h', license: 'MGA',  trustpilot: 4.1, year: 2021 },
  { slug: 'paf',           name: 'Paf',           logo: 'P',  score: 81, oneLiner: 'Ahvenanmaalainen, lisensoitu — kotimaisen turvallinen.',                 offer: 'Talletusbonus 100€',     payout: '< 24 h', license: 'AÅL', trustpilot: 3.9, year: 1966 },
  { slug: 'castcasino',    name: 'Cast Casino',   logo: 'C',  score: 76, oneLiner: 'Hyvä uusi tulokas — pikamaksut, ei jähnää.',                            offer: '100% / 200€ + 50 FS',   payout: '< 2 h', license: 'MGA',  trustpilot: 4.0, year: 2023 },
  { slug: 'rapidplay',     name: 'RapidPlay',     logo: 'R',  score: 74, oneLiner: 'Live-kasino kunnossa, slotit OK.',                                       offer: '50% / 100€',             payout: '< 6 h', license: 'MGA',  trustpilot: 3.8, year: 2020 },
  { slug: 'kruunabet',     name: 'KruunaBet',     logo: 'K',  score: 71, oneLiner: 'Toimiva paketti, asiakaspalvelu hidasta.',                              offer: '100% / 250€',            payout: '12–24 h', license: 'Curaçao', trustpilot: 3.6, year: 2021 },
  { slug: 'helsinkislots', name: 'HelsinkiSlots', logo: 'H',  score: 68, oneLiner: 'Nimi on kotimainen, lisenssi ei.',                                       offer: '100% / 500€',            payout: '24–48 h', license: 'Curaçao', trustpilot: 3.4, year: 2022 },
  { slug: 'pikavoittoa',   name: 'Pikavoittoa',   logo: 'P',  score: 67, oneLiner: 'Bonuksen kiertovaatimukset rehellisesti merkitty — harvinaista.',       offer: '100% / 200€',            payout: '< 8 h', license: 'MGA',  trustpilot: 3.7, year: 2021 },
  { slug: 'nordlys',       name: 'Nordlys',       logo: 'N',  score: 64, oneLiner: 'Kelvollinen, ei loistava — bonuksen ehdot tarkasti luettava.',          offer: '50% / 100€',             payout: '24 h', license: 'Curaçao', trustpilot: 3.5, year: 2020 },
  { slug: 'arctic',        name: 'Arctic Casino', logo: 'A',  score: 62, oneLiner: 'Hidas verifiointi, muuten OK.',                                          offer: '100% / 100€',            payout: '48 h', license: 'Curaçao', trustpilot: 3.3, year: 2022 },
  { slug: 'lapinkulta',    name: 'Lapinkulta Casino', logo: 'L', score: 60, oneLiner: 'Markkinoinnissa lupauksia, käytännössä tasapaksua.',                  offer: '200% / 50€',             payout: '24–72 h', license: 'Curaçao', trustpilot: 3.2, year: 2023 },
];

export const MOMENTS = [
  { id: 'm1', streamer: 'AndyPyro', game: 'Fire in the Hole 2', win: '€42,800', headline: 'AndyPyro räjäytti — €100 panoksella €42 800 tunnissa.', body: 'Klippi kiersi Ylilautaa puoli yötä. Mittarin näkemys: stake-koko ja symbolitäysi yhdistyivät epätodennäköisesti — älä yritä.', source: 'Twitch-klippi', operator: 'weezybet', operatorName: 'Weezybet', thumb: 'https://images.unsplash.com/photo-1605870445919-838d190e8e1b?w=800&h=500&fit=crop' },
  { id: 'm2', streamer: 'pact',      game: 'Big Bass Splash',      win: '€18,200', headline: 'pact veti Kickillä illalla — kolme bonus-osumaa peräjälkeen.', body: 'Striimi kerräsi 12 000 katsojaa kymmenessä minuutissa. Suomalainen Kick-ennätys viikolle.', source: 'Kick-stream', operator: 'tilttarkka', operatorName: 'Tilttarkka', thumb: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800&h=500&fit=crop' },
  { id: 'm3', streamer: 'Jarttu84',  game: 'Sweet Bonanza 1000',  win: '€11,500', headline: 'Jarttu osui supermultiplieriin — rauhallisesti, tyylikkäästi.', body: 'Kahdeksan vuoden kokemus näkyy. Ei dramaattisia eleitä, vain rivakkaa kommentointia.', source: 'Twitch-stream', operator: 'norgekasino', operatorName: 'Norge Kasino', thumb: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=800&h=500&fit=crop' },
  { id: 'm4', streamer: 'JugiPelaa', game: 'Gates of Olympus',   win: '€8,400',  headline: 'JugiPelaa huusi taas — chat repesi.', body: 'JugiPelaan reaktio on jo oma sisältönsä. Voitto oli kohtuullinen, esitys ei.', source: 'Twitch-klippi', operator: 'castcasino', operatorName: 'Cast Casino', thumb: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=500&fit=crop' },
  { id: 'm5', streamer: 'OgumTV',    game: 'The Dog House Megaways', win: '€6,100', headline: 'OgumTV löysi Dog Housen rytmin — kestoaika ratkaisi.', body: 'Pitkä sessio, malttava panostus. Lopputulos kolmessa tunnissa.', source: 'Twitch-stream', operator: 'paf', operatorName: 'Paf', thumb: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&h=500&fit=crop' },
];

export const WEEKLY_FIXTURES = [
  { id: 'f1', league: 'Liiga',          home: 'Tappara',     away: 'TPS',          kickoff: 'La 18:30', odds: { h: 1.62, x: 4.20, a: 4.80 }, take: 'Tappara liikkuu kotonaan, TPS:n tehot ovat olleet yskähtelevät. Ei dramatiikkaa — odotettu kotivoitto.' },
  { id: 'f2', league: 'NHL',            home: 'Carolina',    away: 'Florida',      kickoff: 'Su 02:00', odds: { h: 2.10, x: 4.00, a: 2.85 }, take: 'Aho ja Barkov samalla jäällä. Kotijoukkue on hieman terävämpi, mutta ottelu menee jatkoajalle.' },
  { id: 'f3', league: 'F1',             home: 'Verstappen',  away: 'Norris',       kickoff: 'Su 16:00', odds: { h: 1.95, x: null, a: 1.80 }, take: 'Monza tasoittaa. McLarenin nopeus pitkillä suorilla, Red Bullin tempo mutkissa.' },
  { id: 'f4', league: 'Premier League', home: 'Liverpool',   away: 'Arsenal',      kickoff: 'Su 18:30', odds: { h: 2.20, x: 3.50, a: 3.10 }, take: 'Anfield ratkaisee. Salahin viimeinen vire on parempi kuin tilastot kertovat.' },
  { id: 'f5', league: 'Veikkausliiga',  home: 'HJK',         away: 'KuPS',         kickoff: 'La 18:00', odds: { h: 1.75, x: 3.80, a: 4.50 }, take: 'HJK:n pelaajakaarti on syvempi, KuPS on selvinnyt tasapelillä viime kohtaamisissa. Maaleja syntyy.' },
];

export const LEADERBOARD = [
  { rank: 1,  name: 'Mikko_84',      score: 4, points: 18 },
  { rank: 2,  name: 'KaisaP',        score: 4, points: 17 },
  { rank: 3,  name: 'Veikkari',      score: 3, points: 14 },
  { rank: 4,  name: 'Topi',          score: 3, points: 13 },
  { rank: 5,  name: 'Lilja92',       score: 3, points: 12 },
  { rank: 6,  name: 'Janne_K',       score: 2, points: 10 },
  { rank: 7,  name: 'Heikkinen',     score: 2, points: 9  },
  { rank: 8,  name: 'NHL_fani',      score: 2, points: 8  },
  { rank: 9,  name: 'Tampere_pelaaja', score: 2, points: 7  },
  { rank: 10, name: 'Salli',         score: 1, points: 5  },
];

export const MINIGAME_LEADERBOARD = [
  { rank: 1,  name: 'Mikko_84',  score: 18420, prize: '500€ Weezybet' },
  { rank: 2,  name: 'KaisaP',    score: 17890, prize: '250€ Weezybet' },
  { rank: 3,  name: 'Veikkari',  score: 17100, prize: '100€ Weezybet' },
  { rank: 4,  name: 'Topi',      score: 15440, prize: '50€ FS' },
  { rank: 5,  name: 'Lilja92',   score: 14920, prize: '50€ FS' },
  { rank: 6,  name: 'Janne_K',   score: 13800, prize: '25 FS' },
  { rank: 7,  name: 'Heikkinen', score: 12700, prize: '25 FS' },
  { rank: 8,  name: 'NHL_fani',  score: 11020, prize: '—' },
  { rank: 9,  name: 'Tampere_p', score: 10440, prize: '—' },
  { rank: 10, name: 'Salli',     score: 9820,  prize: '—' },
];
