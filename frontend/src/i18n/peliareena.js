/**
 * PUTKI HQ — Peliareena (mini-games) UI translations (iter60).
 *
 * Every visible string across the 5 mini-games + hub + shared
 * components, keyed by a stable token. Use via the global
 * `useLang()` hook and the `pickPA(lang, token)` helper below.
 *
 * Adding a new string?
 *   1. Add `fi` + `en` here.
 *   2. Call `pickPA(lang, 'your.new.token')` in the component.
 *
 * No interpolation engine — for dynamic strings (counts, names) use
 * the dedicated `interpolate(...)` exported below.
 */

export const PA_T = {
  fi: {
    /* Hub */
    'hub.eyebrow': 'PUTKI HQ · PELIAREENA',
    'hub.headline': 'Viisi pientä peliä. Yksi viikkoturnaus. Opi pelaamalla.',
    'hub.tagline': 'Pelaa ilman sähköpostia. Kun haluat henkilökohtaiset tuloksesi ja paikan viikon turnauksessa, anna sähköpostisi — siitä alkaa oikea palaute. Palkinnot ovat tunnustuksia ja pääsyjä, ei rahaa.',
    'hub.games.heading': 'VIIKON 5 PELIÄ',
    'hub.tournament.active': 'AKTIIVINEN',
    'hub.tournament.timeLeft': 'JÄLJELLÄ',
    'hub.tournament.playsLine': '{plays} suoritettua pelitestiä · {players} ranattua pelaajaa',
    'hub.tournament.leaderboardTitle': 'VIIKON JOHTO',
    'hub.tournament.empty': 'Olisitko sinä viikon ensimmäinen pelaaja?',
    'hub.coming': 'TULOSSA',
    'hub.playNow': 'PELAA NYT',
    'hub.smallprint.title': 'REHELLINEN PIENI PRINTTI',
    'hub.smallprint.body': 'Palkinnot: viikon mestaruus + pääsy laajempiin sisältöihin. Ei rahaa, ei rahanarvoista. Pelin pelaaminen ei vaadi ostoa. Sähköpostin antaminen on vapaaehtoista — se on vaatimus vain turnauksen rankaukseen ja täysiin tuloksiin. Voit perua tilauksesi koska tahansa.',
    'hub.smallprint.privacyLink': 'Tietosuojaseloste',
    'hub.back': 'Takaisin Peliareenaan',

    /* GameIntroPanel — shared chrome */
    'intro.trust.noEmail': 'Pelaa ilman sähköpostia',
    'intro.trust.gdpr': 'GDPR · vapaaehtoinen liittyminen',
    'intro.trust.weekly': 'Viikkoturnaus · nollautuu maanantaina',
    'intro.trust.noMoney': 'Ei rahaa · ei korttitietoja',
    'intro.howToPlay': 'MITEN PELATAAN',
    'intro.scoring': 'PISTEYTYS',
    'intro.weeklyTop10': 'VIIKON TOP 10',
    'intro.weekLabel': 'VIIKKO',
    'intro.players': 'pelaajaa',
    'intro.empty': 'Tämä viikko on vielä pisteyttämättä. Olisitko sinä viikon ensimmäinen pelaaja?',
    'intro.footer': 'Pelin pelaaminen ei vaadi sähköpostia. Tulokset ja viikon turnaus avautuvat, kun annat sähköpostisi vapaaehtoisesti. Viikon mestaruus on tunnustus — ei rahaa eikä rahanarvoista palkintoa.',

    /* GameStatsStrip */
    'stats.playsThisWeek': 'PELATTU TÄLLÄ VIIKOLLA',
    'stats.rankedPlayers': 'RANATTUA PELAAJAA',
    'stats.weeklyLeader': 'VIIKON JOHTO',

    /* Quiz */
    'quiz.eyebrow': 'TIETOISUUSTESTI · ALOITTELIJA',
    'quiz.headline': '10 kysymystä. ~3 minuuttia. Saat heti tietää, missä olet.',
    'quiz.tagline': 'Testaa rahapelimatematiikan perusteet (RTP, volatiliteetti, house edge), bankroll-hallinnan, pelipsykologian ja vastuullisuuden. Pelaa ilman sähköpostia — jokainen vastaus selitetään, joten opit silloinkin, kun vastaat väärin.',
    'quiz.howTo.1': 'Vastaa 10 kysymykseen omalla tahdillasi — voit ottaa aikalisän milloin tahansa.',
    'quiz.howTo.2': 'Lukitset vastauksen klikkaamalla vaihtoehtoa. Selityksen näet, kun siirryt eteenpäin.',
    'quiz.howTo.3': 'Lopussa näet oikeat vastaukset, profiilisi sekä paikkasi viikon turnauksessa.',
    'quiz.score.1': 'Jokainen oikein vastattu kysymys = 1 piste (max 10).',
    'quiz.score.2': 'Tasapelissä nopeampi pelaaja sijoittuu paremmin.',
    'quiz.score.3': 'Viikon paras pisteytys julkaistaan etunimellä — sähköpostia ei näytetä.',
    'quiz.cta.start': 'Aloita testi',
    'quiz.progress': 'KYSYMYS {n} / {total}',
    'quiz.recorded': 'Vastaus tallennettu. Saat täydet selitykset kunkin kysymyksen kohdalta lopussa.',
    'quiz.next': 'Seuraava kysymys',
    'quiz.showResult': 'Näytä tulos',
    'quiz.preview.eyebrow': 'TULOKSESI · ESIKATSELU',
    'quiz.preview.lead': 'Oikeissa vastauksissa olit {pct}%:n tasolla. Esikatsellaan profiili: ',
    'quiz.preview.feedbackHeading': 'KYSYMYSKOHTAINEN SELITYS',
    'quiz.preview.qLabel': 'KYSYMYS {n}',
    'quiz.preview.correct': 'OIKEIN',
    'quiz.preview.wrong': 'VÄÄRIN (oikea: {key})',
    'quiz.unlocked.eyebrow': 'TÄYSI PROFIILI · TURNAUS PAIKAN VARATTU',
    'quiz.unlocked.correct': 'OIKEIN',
    'quiz.unlocked.pct': 'TULOS-%',
    'quiz.unlocked.rank': 'SIJA · {week}',
    'quiz.unlocked.strengths': 'VAHVUUTESI',
    'quiz.unlocked.gaps': 'KEHITETTÄVÄT KOHDAT',
    'quiz.unlocked.boardTitle': 'VIIKON TURNAUS · TOP 10',
    'quiz.share': 'Jaa tulos',
    'quiz.back': '← Palaa Peliareenaan',

    /* Scenario */
    'sc.eyebrow': 'PÄÄTÖSPOLKU · ALOITTELIJA',
    'sc.headline': '5 oikeaa pelitilannetta. Mitä päättäisit?',
    'sc.tagline': 'Jokainen skenaario tarjoaa kolme vaihtoehtoa. Valinta tehdään ennen kuin seuraukset näkyvät — silloin todellinen arviointikyky punnitaan. Lopussa saat profiilisi: Kärsivällinen taktikko, Kasvava arvioija vai Tuore pelaaja.',
    'sc.howTo.1': 'Lue skenaario ja valitse yksi kolmesta vaihtoehdosta.',
    'sc.howTo.2': 'Valinta lukittuu — saat täydet analyysit kaikista vaihtoehdoista lopussa.',
    'sc.howTo.3': 'Yhteensä 5 päätöstä. Loppupisteet tuottavat profiilin ja sijoituksen viikolla.',
    'sc.score.1': 'Jokainen vaihtoehto on arvioitu 0/1/3 pisteen asteikolla.',
    'sc.score.2': 'Maksimi = 15 pistettä. ≥12 = Kärsivällinen taktikko, 7–11 = Kasvava arvioija, 0–6 = Tuore pelaaja.',
    'sc.score.3': 'Tasapelissä nopeampi peliaika sijoittuu paremmin.',
    'sc.cta.start': 'Aloita päätöspolku',
    'sc.progress': 'SKENAARIO {n} / {total}',
    'sc.locked': 'Valinta lukittu. Saat täydet analyysit jokaisesta vaihtoehdosta lopussa.',
    'sc.next': 'Seuraava skenaario',
    'sc.showResult': 'Näytä tulos',
    'sc.preview.eyebrow': 'TULOKSESI · ESIKATSELU',
    'sc.preview.lead': 'Arviointipisteesi yhteensä. Esikatselu: ',
    'sc.preview.optionsHeading': 'VAIHTOEHTOJEN ARVIOINTI',
    'sc.preview.youPicked': 'SKENAARIO {n} · VALITSIT {key} ({score}/3)',
    'sc.unlocked.eyebrow': 'TÄYSI PROFIILI · TURNAUSPAIKKA VARATTU',
    'sc.unlocked.score': 'ARVIOINTI',
    'sc.unlocked.pct': 'TULOS-%',
    'sc.unlocked.rank': 'SIJA · {week}',
    'sc.unlocked.boardTitle': 'PÄÄTÖSPOLKU · VIIKON TOP 10',

    /* Insight */
    'in.eyebrow': 'TIETORAAPE · 6 LAATTAA',
    'in.headline': 'Raaputa kuusi mikro-oppia. Yksi fakta kerrallaan.',
    'in.tagline': 'Ei oikeita tai vääriä vastauksia — palkinto on jokaisessa laatassa oleva tieto. Raaputa niin monta laattaa kuin haluat; mitä useamman avaat, sitä paremmin sijoitut viikon turnauksessa.',
    'in.howTo.1': 'Klikkaa laattaa avataksesi mikro-opin (esim. RTP, bonusehdot, bankroll-matematiikka).',
    'in.howTo.2': 'Jokainen avattu laatta lisää yhden pisteen — voit avata kaikki kuusi.',
    'in.howTo.3': 'Päätä peli, kun haluat lukita pisteesi ja siirtyä turnauspaikkaan.',
    'in.score.1': '1 piste per avattu laatta. Maksimi 6 pistettä.',
    'in.score.2': 'Tasapelissä nopeampi peliaika sijoittuu paremmin.',
    'in.score.3': 'Saat täydet selitykset ja lähdeviitteet, kun viimeistelet pelin.',
    'in.cta.start': 'Avaa lauta',
    'in.opened': 'AVATTU {n} / {total}',
    'in.finish': 'Päätä peli →',
    'in.unlocked.eyebrow': 'TÄYSI PROFIILI · TURNAUSPAIKKA VARATTU',
    'in.unlocked.score': 'AVATTU',
    'in.unlocked.pct': 'TULOS-%',
    'in.unlocked.rank': 'SIJA · {week}',
    'in.unlocked.boardTitle': 'TIETORAAPE · VIIKON TOP 10',

    /* Snake */
    'sn.eyebrow': 'AIKATAPPO · MATO',
    'sn.headline': 'Yksi mato. Niin pitkä kuin ehdit.',
    'sn.tagline': 'Klassinen 20×20 Mato kohtuullisella nopeudella. Jokainen syöty palanen kasvattaa matoa yhdellä ruudulla. Älä osu seinään tai itseesi — viikon paras pisteytys palkitaan tunnustuksella.',
    'sn.howTo.1': 'Aloita peli ja ohjaa matoa nuolinäppäimillä (desktop), WASD:llä tai mobiilissa pyyhkäisemällä.',
    'sn.howTo.2': 'Syö amber-väriset palaset kasvattaaksesi matoa ja kerätäksesi pisteitä.',
    'sn.howTo.3': 'Peli päättyy seinään tai omaan häntään osumiseen — pisteet tallentuvat automaattisesti.',
    'sn.score.1': '1 piste per syöty palanen.',
    'sn.score.2': 'Liian nopeat pelisessiot eivät pääse leaderboardille (anti-cheat).',
    'sn.score.3': 'Sähköpostin antaminen on vapaaehtoista — sillä lukitset paikan turnauksessa.',
    'sn.cta.start': 'Aloita peli',
    'sn.controls': 'OHJAUS · ↑ ↓ ← → · TAI W A S D · MOBIILI: PYYHKÄISE',
    'sn.points': 'PISTEET',

    /* Tap */
    'tp.eyebrow': 'AIKATAPPO · NAPAUTUS',
    'tp.headline': 'Yksi napautus. Älä osu mihinkään.',
    'tp.tagline': 'Yksinkertaisin mahdollinen ohjaus — yksi näppäin, koko peli. Pidä token-kolikko ilmassa ja kuljeta se amber-värisistä porteista läpi. Mitä useamman portin ohitat, sitä korkeammat pisteet.',
    'tp.howTo.1': 'Napauta peliä tai paina välilyöntiä lentääksesi.',
    'tp.howTo.2': 'Pysy ilmassa ja kuljeta token porttien välistä.',
    'tp.howTo.3': 'Yhteen porttiin osuminen tai putoaminen päättää pelin.',
    'tp.score.1': '1 piste per ohitettu portti.',
    'tp.score.2': 'Liian nopeat pelisessiot eivät pääse leaderboardille (anti-cheat).',
    'tp.score.3': 'Tasapelissä nopeampi peliaika sijoittuu paremmin.',
    'tp.cta.start': 'Aloita peli',
    'tp.controls': 'OHJAUS · NAPAUTA RUUTUA · TAI PAINA VÄLILYÖNTIÄ',
    'tp.hint': 'Napauta peliä tai paina välilyöntiä lentääksesi',

    /* Arcade preview/unlocked */
    'ar.preview.eyebrow': 'PELI PÄÄTTYI · TULOKSESI',
    'ar.points.short': ' pistettä',
    'ar.preview.invalid': 'Pelisessio oli liian lyhyt — tämä pisteytys ei pääse leaderboardille. Voit silti tallentaa sähköpostisi turnausuutiskirjeeseen.',
    'ar.preview.detail': 'Esikatselu: {persona}. Aikaa: {seconds}s.',
    'ar.preview.gateHeadline': 'Liity turnaukseen ja saa viikon tulokset sähköpostiin',
    'ar.unlocked.eyebrow': 'TURNAUSPAIKKA VARATTU',
    'ar.unlocked.points': 'PISTEET',
    'ar.unlocked.rank': 'SIJA · {week}',
    'ar.unlocked.boardTitle': 'VIIKON TOP 10',

    /* ConsentEmailGate */
    'gate.eyebrow': 'AVAA TÄYDET TULOKSET · LIITY TURNAUKSEEN',
    'gate.defaultHeadline': 'Saat henkilökohtaiset vahvuudet, kuilut ja sijoituksen viikolla',
    'gate.body': 'Annetulla sähköpostilla saat: täydellisen profiilisi, sen mihin kannattaa keskittyä, sekä viikon turnaussi sijoituksen ja viikkokirjeet (4 viestiä/viikko: avajaiset, väliaika, sulkemisilmoitus, tulokset).',
    'gate.email.placeholder': 'sinun.sahkoposti@esimerkki.fi',
    'gate.name.placeholder': 'Etunimi (ei pakollinen — käytetään leaderboardissa)',
    'gate.consent': 'Hyväksyn, että Putki HQ tallentaa sähköpostini ja pelin tuloksen voidakseen lähettää minulle henkilökohtaiset tulokset ja viikoittaisen turnauksen päivitykset. Voin perua tilauksen koska tahansa. Lue lisää',
    'gate.consent.privacy': 'tietosuojaselosteesta',
    'gate.consent.required': 'Suostumus vaaditaan turnauksen rankaukseen.',
    'gate.email.invalid': 'Anna kelvollinen sähköposti.',
    'gate.submitting': 'Tallennetaan…',
    'gate.submit': 'Avaa tulokset + Liity turnaukseen',
    'gate.smallprint': 'Ei rahaa, ei kortteja, ei ostopakkoa. Voit perua koska tahansa.',
    'gate.error.save': 'Tallennus epäonnistui: {message}',

    /* Common */
    'common.loading': 'Ladataan…',
  },

  en: {
    /* Hub */
    'hub.eyebrow': 'PUTKI HQ · MINI-GAME ARENA',
    'hub.headline': 'Five small games. One weekly tournament. Learn by playing.',
    'hub.tagline': 'Play without an email. When you want personal results and a place in the weekly tournament, share your email — that\'s when real feedback begins. Prizes are recognitions and access, not money.',
    'hub.games.heading': 'THIS WEEK\'S 5 GAMES',
    'hub.tournament.active': 'ACTIVE',
    'hub.tournament.timeLeft': 'LEFT',
    'hub.tournament.playsLine': '{plays} finished plays · {players} ranked players',
    'hub.tournament.leaderboardTitle': 'THIS WEEK\'S LEADER',
    'hub.tournament.empty': 'Will you be this week\'s first player?',
    'hub.coming': 'COMING',
    'hub.playNow': 'PLAY NOW',
    'hub.smallprint.title': 'HONEST FINE PRINT',
    'hub.smallprint.body': 'Prizes: weekly championship + access to broader content. No money, no monetary value. Playing requires no purchase. Sharing your email is voluntary — it\'s only required for tournament ranking and full results. You can cancel any time.',
    'hub.smallprint.privacyLink': 'Privacy policy',
    'hub.back': 'Back to the Arena',

    /* GameIntroPanel — shared chrome */
    'intro.trust.noEmail': 'Play without email',
    'intro.trust.gdpr': 'GDPR · voluntary opt-in',
    'intro.trust.weekly': 'Weekly tournament · resets every Monday',
    'intro.trust.noMoney': 'No money · no card details',
    'intro.howToPlay': 'HOW TO PLAY',
    'intro.scoring': 'SCORING',
    'intro.weeklyTop10': 'THIS WEEK\'S TOP 10',
    'intro.weekLabel': 'WEEK',
    'intro.players': 'players',
    'intro.empty': 'No scores this week yet. Will you be this week\'s first player?',
    'intro.footer': 'Playing requires no email. Results and the weekly tournament unlock when you voluntarily share your email. The weekly championship is a recognition — no money, no prize of monetary value.',

    /* GameStatsStrip */
    'stats.playsThisWeek': 'PLAYED THIS WEEK',
    'stats.rankedPlayers': 'RANKED PLAYERS',
    'stats.weeklyLeader': 'WEEKLY LEADER',

    /* Quiz */
    'quiz.eyebrow': 'AWARENESS TEST · BEGINNER',
    'quiz.headline': '10 questions. ~3 minutes. You\'ll know where you stand immediately.',
    'quiz.tagline': 'Test the fundamentals: slot math (RTP, volatility, house edge), bankroll, play psychology and responsibility. Play without an email — every answer is explained, so you learn even when you get it wrong.',
    'quiz.howTo.1': 'Answer 10 questions at your own pace — pause any time.',
    'quiz.howTo.2': 'Lock in your answer by clicking an option. The explanation appears once you move on.',
    'quiz.howTo.3': 'At the end you see the correct answers, your profile, and your weekly tournament rank.',
    'quiz.score.1': 'Each correct answer = 1 point (max 10).',
    'quiz.score.2': 'In a tie, the faster player ranks higher.',
    'quiz.score.3': 'The week\'s top scorer is shown by first name — your email is never displayed.',
    'quiz.cta.start': 'Start the test',
    'quiz.progress': 'QUESTION {n} / {total}',
    'quiz.recorded': 'Answer saved. You\'ll get full explanations per question at the end.',
    'quiz.next': 'Next question',
    'quiz.showResult': 'Show result',
    'quiz.preview.eyebrow': 'YOUR RESULT · PREVIEW',
    'quiz.preview.lead': 'You were correct on {pct}% of questions. Profile preview: ',
    'quiz.preview.feedbackHeading': 'PER-QUESTION EXPLANATION',
    'quiz.preview.qLabel': 'QUESTION {n}',
    'quiz.preview.correct': 'CORRECT',
    'quiz.preview.wrong': 'WRONG (correct: {key})',
    'quiz.unlocked.eyebrow': 'FULL PROFILE · TOURNAMENT SEAT LOCKED',
    'quiz.unlocked.correct': 'CORRECT',
    'quiz.unlocked.pct': 'SCORE %',
    'quiz.unlocked.rank': 'RANK · {week}',
    'quiz.unlocked.strengths': 'YOUR STRENGTHS',
    'quiz.unlocked.gaps': 'AREAS TO IMPROVE',
    'quiz.unlocked.boardTitle': 'WEEKLY TOURNAMENT · TOP 10',
    'quiz.share': 'Share result',
    'quiz.back': '← Back to the Arena',

    /* Scenario */
    'sc.eyebrow': 'DECISION PATH · BEGINNER',
    'sc.headline': '5 real gambling situations. What would you decide?',
    'sc.tagline': 'Each scenario offers three options. You commit before consequences appear — that\'s when real judgement is measured. At the end you get your profile: The Patient Tactician, The Growing Judge, or The Fresh Player.',
    'sc.howTo.1': 'Read the scenario and pick one of three options.',
    'sc.howTo.2': 'Your choice is locked — you\'ll see full analyses of all options at the end.',
    'sc.howTo.3': '5 decisions total. The final score yields a profile and a weekly rank.',
    'sc.score.1': 'Each option is scored on a 0/1/3 scale.',
    'sc.score.2': 'Max = 15 points. ≥12 = The Patient Tactician, 7–11 = The Growing Judge, 0–6 = The Fresh Player.',
    'sc.score.3': 'In a tie, the faster play time ranks higher.',
    'sc.cta.start': 'Start the path',
    'sc.progress': 'SCENARIO {n} / {total}',
    'sc.locked': 'Choice locked. You\'ll see full analyses of every option at the end.',
    'sc.next': 'Next scenario',
    'sc.showResult': 'Show result',
    'sc.preview.eyebrow': 'YOUR RESULT · PREVIEW',
    'sc.preview.lead': 'Your total judgement score. Preview: ',
    'sc.preview.optionsHeading': 'OPTION ANALYSIS',
    'sc.preview.youPicked': 'SCENARIO {n} · YOU PICKED {key} ({score}/3)',
    'sc.unlocked.eyebrow': 'FULL PROFILE · TOURNAMENT SEAT LOCKED',
    'sc.unlocked.score': 'JUDGEMENT',
    'sc.unlocked.pct': 'SCORE %',
    'sc.unlocked.rank': 'RANK · {week}',
    'sc.unlocked.boardTitle': 'DECISION PATH · WEEKLY TOP 10',

    /* Insight */
    'in.eyebrow': 'INSIGHT REVEAL · 6 TILES',
    'in.headline': 'Scratch six micro-lessons. One fact at a time.',
    'in.tagline': 'No right or wrong answers — the payoff is the knowledge under each tile. Scratch as many tiles as you want; the more you reveal, the higher you rank in the weekly tournament.',
    'in.howTo.1': 'Click a tile to reveal a micro-lesson (e.g. RTP, bonus terms, bankroll math).',
    'in.howTo.2': 'Each revealed tile adds one point — you can open all six.',
    'in.howTo.3': 'Finish the game when you want to lock in your score and claim a tournament seat.',
    'in.score.1': '1 point per revealed tile. Maximum 6 points.',
    'in.score.2': 'In a tie, the faster play time ranks higher.',
    'in.score.3': 'You get full explanations and source citations when you finish the game.',
    'in.cta.start': 'Open the board',
    'in.opened': 'REVEALED {n} / {total}',
    'in.finish': 'Finish game →',
    'in.unlocked.eyebrow': 'FULL PROFILE · TOURNAMENT SEAT LOCKED',
    'in.unlocked.score': 'REVEALED',
    'in.unlocked.pct': 'SCORE %',
    'in.unlocked.rank': 'RANK · {week}',
    'in.unlocked.boardTitle': 'INSIGHT REVEAL · WEEKLY TOP 10',

    /* Snake */
    'sn.eyebrow': 'TIMEKILLER · SNAKE',
    'sn.headline': 'One snake. As long as you can keep it alive.',
    'sn.tagline': 'Classic 20×20 Snake at moderate speed. Every morsel grows the snake by one cell. Don\'t hit the wall or yourself — the week\'s top score earns a recognition.',
    'sn.howTo.1': 'Start the game and control the snake with arrow keys (desktop), WASD, or swipe on mobile.',
    'sn.howTo.2': 'Eat the amber pieces to grow and earn points.',
    'sn.howTo.3': 'The game ends on wall or self-collision — your score saves automatically.',
    'sn.score.1': '1 point per morsel eaten.',
    'sn.score.2': 'Sessions that finish too fast don\'t qualify for the leaderboard (anti-cheat).',
    'sn.score.3': 'Sharing your email is voluntary — that\'s how you lock in a tournament seat.',
    'sn.cta.start': 'Start game',
    'sn.controls': 'CONTROLS · ↑ ↓ ← → · OR W A S D · MOBILE: SWIPE',
    'sn.points': 'POINTS',

    /* Tap */
    'tp.eyebrow': 'TIMEKILLER · TAP',
    'tp.headline': 'One tap. Don\'t hit anything.',
    'tp.tagline': 'Simplest possible control — one key, whole game. Keep the chip token aloft and guide it through the amber gates. The more gates you pass, the higher your score.',
    'tp.howTo.1': 'Tap the game or press space to flap.',
    'tp.howTo.2': 'Stay aloft and guide the token between the gates.',
    'tp.howTo.3': 'Hitting a gate or falling ends the game.',
    'tp.score.1': '1 point per gate passed.',
    'tp.score.2': 'Sessions that finish too fast don\'t qualify for the leaderboard (anti-cheat).',
    'tp.score.3': 'In a tie, the faster play time ranks higher.',
    'tp.cta.start': 'Start game',
    'tp.controls': 'CONTROLS · TAP THE BOARD · OR PRESS SPACE',
    'tp.hint': 'Tap the board or press space to flap',

    /* Arcade preview/unlocked */
    'ar.preview.eyebrow': 'GAME OVER · YOUR RESULT',
    'ar.points.short': ' points',
    'ar.preview.invalid': 'The session ended too quickly — this score doesn\'t qualify for the leaderboard. You can still subscribe to the tournament newsletter.',
    'ar.preview.detail': 'Preview: {persona}. Time: {seconds}s.',
    'ar.preview.gateHeadline': 'Join the tournament and get the weekly results by email',
    'ar.unlocked.eyebrow': 'TOURNAMENT SEAT LOCKED',
    'ar.unlocked.points': 'POINTS',
    'ar.unlocked.rank': 'RANK · {week}',
    'ar.unlocked.boardTitle': 'WEEKLY TOP 10',

    /* ConsentEmailGate */
    'gate.eyebrow': 'UNLOCK FULL RESULTS · JOIN THE TOURNAMENT',
    'gate.defaultHeadline': 'Get personal strengths, gaps, and your weekly rank',
    'gate.body': 'With the email you share you receive: your full profile, what to focus on, your weekly tournament rank, and the weekly newsletter (4 messages per week: kickoff, midweek, closing notice, results).',
    'gate.email.placeholder': 'your.email@example.com',
    'gate.name.placeholder': 'First name (optional — shown on the leaderboard)',
    'gate.consent': 'I agree that Putki HQ stores my email and game result to send me personal results and weekly tournament updates. I can unsubscribe at any time. Read more in the',
    'gate.consent.privacy': 'privacy policy',
    'gate.consent.required': 'Consent is required for tournament ranking.',
    'gate.email.invalid': 'Please enter a valid email.',
    'gate.submitting': 'Saving…',
    'gate.submit': 'Unlock results + Join the tournament',
    'gate.smallprint': 'No money, no cards, no purchase required. You can cancel any time.',
    'gate.error.save': 'Save failed: {message}',

    /* Common */
    'common.loading': 'Loading…',
  },
};

/** Look up a token in the active language, fall back to FI then to the token itself. */
export const pickPA = (lang, token) => {
  const dict = PA_T[lang] || PA_T.fi;
  if (dict[token] !== undefined) return dict[token];
  return PA_T.fi[token] !== undefined ? PA_T.fi[token] : token;
};

/** Basic {var} substitution. Missing vars are left as `{var}` for visibility. */
export const interpolate = (str, vars) => {
  if (!str || !vars) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
};

/** Pick the language-appropriate field from a backend document.
 * E.g. langField(q, 'prompt', lang) returns q.prompt_en when lang='en'
 * and an `_en` field exists; otherwise q.prompt_fi.  */
export const langField = (doc, base, lang) => {
  if (!doc) return '';
  const enKey = `${base}_en`;
  const fiKey = `${base}_fi`;
  if (lang === 'en' && doc[enKey]) return doc[enKey];
  return doc[fiKey] || doc[enKey] || '';
};
