/**
 * PUTKI HQ - Mestari standalone diagnostic entry page.
 *
 * Two visual states share one component:
 *   1. `step === 'intro'` → premium cold-traffic landing page
 *      (hero · credibility bar · method · stack · how-it-works ·
 *       clarity · founder · FAQ · final CTA · footer with full disclaimer)
 *   2. otherwise → existing 5-question diagnostic + zinger + tease +
 *      email gate + confirmation flow (UNCHANGED logic).
 *
 * Positioning is locked: this is a research/analytics tool, NOT
 * betting advice or gambling promotion. Zero mention of tips on the
 * entry surface - the first allowed mention is the confirmation
 * screen, per brief.
 *
 * Backend endpoints (unchanged):
 *   GET  /api/settings/public            → voita_quiz_config
 *   POST /api/voita/profile/resolve      → resolved profile from tags
 *   POST /api/voita/lead                 → lead capture (source=mestari)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useMestariCopy from '../hooks/useMestariCopy';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// ── Design tokens (brand-aligned: uses Putki HQ CSS variables so the page
// adapts to the user's chosen light/dark theme. Only the Mestari-signature
// blue accent is held constant - it's the deliberate visual handshake
// that says "this is the diagnostic", distinct from Mittari orange and
// Voita red.) ──────────────────────────────────────────────────────────
const T = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  ink: 'var(--ink)',
  muted: 'var(--muted)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  accent: '#5B8DEE',
  accentBright: '#7BA5F5',
  accentGlow: 'rgba(91,141,238,0.16)',
  success: '#6FA37D',
  warn: '#C99A4A',
  serif: 'Georgia, "Source Serif 4", serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
};

// ── Copy bundle (Finnish primary, English mirror) ───────────────────────
const COPY = {
  fi: {
    header: { back: 'PUTKIHQ', backArrow: '←' },
    hero: {
      eyebrow: 'Mestari · Toimituksellinen diagnostiikka · Tutkimustyökalu',
      headline: 'Millainen urheiluvedonlyöjä sinä olet?',
      sub: '90 sekunnin diagnostiikka, joka perustuu vedonlyöntimarkkinoiden tutkimukseen. Vastaa viiteen kysymykseen siitä, miten luet ottelua - saat henkilökohtaisen analyyttisen profiilin ja 5 päivän pelikirjan siihen, miten markkinat oikeasti käyttäytyvät.',
      positioningStrong: 'Tämä on tutkimus- ja analytiikkatyökalu.',
      positioningRest: ' Mestari tutkii, miten vedonlyöntimarkkinat liikkuvat ja miten ihmiset tulkitsevat niitä. Se ei ole vedonlyöntineuvontaa, se ei mainosta rahapelaamista, eikä se koskaan kerro mitä lyödä vetoa. Vain opetuskäyttöön.',
      cta: 'Aloita diagnostiikka →',
      ctaMeta: ['90 sekuntia', 'Maksuton', 'Ei talletusta', 'Ei vedonlyöntiä'],
    },
    cred: [
      { num: '11', unit: ' lähdettä', desc: 'Julkista markkina- ja skenedatalähdettä analysoidaan' },
      { num: '0', unit: ' muokkausta', desc: 'Ei toimituksen sormea mallissa. Sama data, sama tulos.' },
      { num: '5', unit: ' päivää', desc: 'Strukturoitu opas markkinakäyttäytymisen lukemiseen' },
      { num: '90', unit: ' sek', desc: 'Suoritusaika · 5 tutkimuspohjaista kysymystä' },
    ],
    method: {
      label: 'Menetelmä · Miten Mestari analysoi',
      intro: ['Mestari soveltaa ', 'strukturoitua analyyttistä viitekehystä', ' kysymykseen, johon useimmat vastaavat vaistolla: miten oikeasti luet vedonlyöntimarkkinaa? Diagnostiikka pohjautuu dokumentoituun tutkimukseen päätöksenteosta, markkinatehokkuudesta ja vinoumista.'],
      cards: [
        {
          num: '01 · Viitekehys', title: 'Tutkimuspohjaiset kysymykset',
          body: ['Jokainen viidestä kysymyksestä vastaa tunnistettua ennustavan päätöksenteon ulottuvuutta - ankkurointia, tuoreuden painotusta, markkinaluottamusta, vastavirran vaistoa ja tiedon käsittelyä. Diagnostiikka rakentuu ', 'tunnetulle käyttäytymistutkimukselle', ', ei mielipiteille.'],
          tag: 'Käyttäytymistiede · Päätöksenteon teoria',
        },
        {
          num: '02 · Data', title: 'Todelliset markkinasignaalit',
          body: ['Profiilisi tulkitaan suhteessa kuvioihin, joita havaitaan ', '11 julkisessa datalähteessä', ' - kertoimien hajonta, markkinaliike ja skeneaktiivisuus. Analysoimme miten markkinat käyttäytyvät; emme ennusta lopputuloksia.'],
          tag: 'Julkinen data · Kerroin-API:t · EU-markkinat',
        },
        {
          num: '03 · Mallit', title: 'Tekoälyavusteinen analyysi',
          body: ['Käytämme koneoppivaa luokittelua tulkitaksemme vastauskuviot johdonmukaisesti ja nostaaksemme esiin profiiliisi sopivimman oppaan. ', 'Mallit avustavat analyysiä', ' - ne tarkistetaan kiinteää menetelmää vasten, ei jätetä toimimaan valvomatta.'],
          tag: 'ML-luokittelu · Ihmisen tarkistama',
        },
        {
          num: '04 · Läpinäkyvyys', title: 'Dokumentoitu menetelmä',
          body: ['Jokainen profiili, pistemäärä ja oppitunti jäljittyy ', 'dokumentoituun menetelmään', '. Toimituksellista muokkausta ei ole - samat vastaukset tuottavat aina saman profiilin. Voit pyytää koko menetelmäkuvauksen.'],
          tag: 'Avoin menetelmä · Toistettava',
        },
      ],
    },
    stack: {
      label: 'Mitä diagnostiikan takana on',
      items: [
        { label: 'Datakerros', title: 'Live-markkinasyötteet', body: 'Jatkuva julkisten kertoimien ja markkinaliikedatan keruu eurooppalaisista kirjoista - samat raakasyötteet kuin ammattimaisilla markkina-analyytikoilla.' },
        { label: 'Analyysikerros', title: 'Todennäköisyysmallinnus', body: 'Implisiittisen todennäköisyyden laskenta ja hajontapisteytys kvantifioivat, kuinka varma - ja kuinka jakautunut - markkina on. Tilastoa, ei ennusteita.' },
        { label: 'Älykkyyskerros', title: 'Tekoälyluokittelu, tarkistettuna', body: 'Koneoppivat mallit luokittelevat vastauskuviot ja yhdistävät ne tutkimusviitekehykseen. Jokainen tulos tarkistetaan kiinteää menetelmää vasten.' },
      ],
    },
    steps: {
      label: 'Mitä tapahtuu kun aloitat',
      rows: [
        { num: '1', title: 'Viisi kysymystä · noin 90 sekuntia', desc: 'Jokainen kysymys tutkii yhtä ulottuvuutta siinä, miten luet ottelua. Oikeita vastauksia ei ole - diagnostiikka mittaa analyyttistä tyyliäsi, ei tietämystäsi.' },
        { num: '2', title: 'Analyyttinen profiilisi', desc: 'Malli luokittelee vastauksesi yhdeksi tutkimuksessa määritellyistä ennustajaprofiileista, selkokielisellä selityksellä siitä, missä tyyli on vahva ja missä se taipuu harhaan.' },
        { num: '3', title: 'Koko raportti + 5 päivän pelikirja', desc: 'Anna sähköpostisi ja lähetämme täyden raportin sekä viiden päivän opetussarjan siitä, miten vedonlyöntimarkkinat käyttäytyvät. Vain sähköposti - muuta tietoa ei kerätä.' },
      ],
    },
    clarity: {
      label: 'Tärkeää · Mitä Mestari on ja mitä se ei ole',
      is: { head: 'Mitä Mestari on', items: [
        'Tutkimus- ja analytiikkatyökalu, joka tutkii markkinoiden liikettä',
        'Opetuksellinen diagnostiikka päätöksenteosta ja vinoumista',
        'Strukturoitu, dokumentoitu ja toistettava menetelmä',
        'Maksuton - ei talletusta, ei tiliä',
      ] },
      isnt: { head: 'Mitä Mestari ei ole', items: [
        'Ei vedonlyöntineuvontaa eikä vihjepalvelua',
        'Ei rahapelaamisen eikä minkään peliyhtiön mainontaa',
        'Ei minkään ottelun lopputuloksen ennustetta',
        'Ei tulostakuu - mikään menetelmä ei poista riskiä',
      ] },
    },
    team: {
      label: 'Kuka tämän rakensi',
      initial: 'D',
      eyebrow: 'Perustaja · 9 vuotta Suomen vedonlyöntiskenen parissa',
      quote: ['Rakensimme Mestarin koska useimmat lukevat vedonlyöntimarkkinaa ', 'vaistolla eivätkä koskaan tarkista vaistoa', '. Diagnostiikka antaa selkeän, tutkimukseen pohjaavan kuvan siitä, miten oikeasti ajattelet.'],
      signName: 'Dioni V.', signRest: ' · Perustaja · Putki HQ',
      credPre: 'Helsinki · Menetelmä rakennettu julkiselle datalle ja dokumentoidulle tutkimukselle · ',
      credLink: 'Menetelmäkuvaus pyynnöstä →',
    },
    faq: {
      label: 'Kysymyksiä ennen aloitusta',
      items: [
        { q: 'Onko tämä vedonlyöntineuvontaa?', a: 'Ei. Mestari on tutkimus- ja analytiikkatyökalu. Se tutkii miten vedonlyöntimarkkinat käyttäytyvät ja miten ihmiset tulkitsevat niitä. Se ei koskaan kerro mitä lyödä vetoa, eikä se mainosta rahapelaamista. Tarkoitettu opetuskäyttöön.' },
        { q: 'Pitääkö minun lyödä vetoa jotain?', a: 'Ei. Missään vaiheessa ei ole talletusta, panosta tai rahapelitiliä. Diagnostiikka on kyselylomake analyyttisestä tyylistä.' },
        { q: 'Mitä teette sähköpostiosoitteellani?', a: 'Käytämme sitä kerran raporttisi lähettämiseen ja sen jälkeen viiden päivän opetussarjaan. Muuta henkilötietoa ei kerätä. Voit perua tilauksen milloin tahansa. GDPR-yhteensopiva.' },
        { q: 'Miten profiili lasketaan?', a: 'Viisi vastaustasi luokitellaan kiinteää tutkimusviitekehystä vasten tekoälyavusteisella analyysillä, joka tarkistetaan dokumentoitua menetelmää vasten. Samat vastaukset tuottavat aina saman profiilin - toimituksellista muokkausta ei ole.' },
      ],
    },
    final: {
      eyebrow: '→ Diagnostiikka · 90 sekuntia · Maksuton',
      headlinePre: 'Selvitä, miten ',
      headlineAccent: 'oikeasti',
      headlinePost: ' luet markkinaa.',
      cta: 'Aloita diagnostiikka →',
      meta: ['Tutkimustyökalu', 'Ei vedonlyöntiä', 'Ei talletusta', 'Vain sähköposti', 'GDPR'],
    },
    footer: {
      home: '← Takaisin Putki HQ:hun',
      links: [
        { href: '#', label: 'Menetelmä' },
        { href: '/tietosuoja', label: 'Tietosuoja' },
        { href: '/ehdot', label: 'Ehdot' },
        { href: '/yhteys', label: 'Yhteys' },
      ],
      disclaimer: 'Mestari on Putki HQ:n toimituksellinen tutkimus- ja analytiikkatuote. Se analysoi julkisesti saatavilla olevaa vedonlyöntimarkkinadataa opetustarkoituksessa. Mestari ei tarjoa vedonlyöntineuvontaa, ei ennusta otteluiden lopputuloksia eikä mainosta rahapelaamista tai mitään peliyhtiötä. Mikään tällä sivulla ei ole kehotus pelata rahapelejä. Jos rahapelaaminen huolettaa, apua on saatavilla - Suomessa katso ',
      disclaimerLink: { href: 'https://peluuri.fi', label: 'peluuri.fi' },
      disclaimerTail: '. 18+.',
    },
    trust: {
      pills: ['GDPR', 'Ei spämmiä', 'Emme myy tietoja', 'Vain sähköposti'],
      note: 'Tietosi tallennetaan tämän raportin lähettämistä varten. Käytämme niitä vain raporttiin ja 5 päivän oppaaseen. Emme jaa, myy tai luovuta tietojasi kolmansille osapuolille. Peruuttamislinkki jokaisessa viestissä.',
      acceptPre: 'Hyväksyn ',
      acceptLink: 'tietosuojaehdot',
      acceptPost: ' ja haluan vastaanottaa raportin + 5 päivän pelikirjan.',
      links: [
        { href: '/ehdot', label: 'Tietosuoja & GDPR' },
        { href: '/menetelma', label: 'Miten viestimme' },
        { href: '/tietoa-meista', label: 'Ota yhteyttä' },
      ],
    },
  },
  en: {
    header: { back: 'PUTKIHQ', backArrow: '←' },
    hero: {
      eyebrow: 'Mestari · Editorial diagnostic · Research tool',
      headline: 'What kind of sports bettor are you?',
      sub: 'A 90-second diagnostic grounded in betting-market research. Answer five questions about how you read a match - receive a personal analytical profile and a 5-day playbook on how the markets actually behave.',
      positioningStrong: 'This is a research and analytics tool.',
      positioningRest: ' Mestari studies how betting markets move and how people interpret them. It is not betting advice, it does not promote gambling, and it will never tell you what to bet. For educational use only.',
      cta: 'Start the diagnostic →',
      ctaMeta: ['90 seconds', 'Free', 'No deposit', 'No betting'],
    },
    cred: [
      { num: '11', unit: ' sources', desc: 'Public market and scene data feeds analysed' },
      { num: '0', unit: ' overrides', desc: 'No editorial finger on the model. Same data, same output.' },
      { num: '5', unit: ' days', desc: 'Structured playbook on reading market behaviour' },
      { num: '90', unit: ' sec', desc: 'Run time · 5 research-grounded questions' },
    ],
    method: {
      label: 'Method · How Mestari analyses',
      intro: ['Mestari applies a ', 'structured analytical framework', ' to a question most people answer on instinct: how do you actually read a betting market? The diagnostic draws on documented research in decision-making, market efficiency and cognitive bias.'],
      cards: [
        { num: '01 · Framework', title: 'Research-grounded questions', body: ['Each of the five questions targets a recognised dimension of predictive decision-making - anchoring, recency weighting, market trust, contrarian instinct and information processing. The diagnostic is built on ', 'established behavioural research', ', not opinion.'], tag: 'Behavioural science · Decision theory' },
        { num: '02 · Data', title: 'Real market signals', body: ['Your profile is read against patterns observed across ', '11 public data sources', ' - odds dispersion, market movement and scene activity. We analyse how markets behave; we do not predict outcomes.'], tag: 'Public data · Odds APIs · EU markets' },
        { num: '03 · Models', title: 'AI-assisted analysis', body: ['We use machine-learning classification to interpret answer patterns consistently and to surface the playbook that best fits your profile. ', 'Models assist analysis', ' - they are checked against a fixed method, not left to run unsupervised.'], tag: 'ML classification · Human-reviewed' },
        { num: '04 · Transparency', title: 'Documented method', body: ['Every profile, score and lesson traces back to a ', 'documented method', '. There is no editorial override - the same answers always yield the same profile. The full methodology is available on request.'], tag: 'Open method · Reproducible' },
      ],
    },
    stack: {
      label: 'What sits behind the diagnostic',
      items: [
        { label: 'Data layer', title: 'Live market feeds', body: 'Continuous ingestion of public odds and market-movement data from European books - the same raw feeds professional market analysts work with.' },
        { label: 'Analysis layer', title: 'Probability modelling', body: 'Implied-probability calculations and dispersion scoring quantify how confident - and how split - a market is. Statistics, not predictions.' },
        { label: 'Intelligence layer', title: 'AI classification, reviewed', body: 'Machine-learning models classify answer patterns and map them onto the research framework. Every output is checked against a fixed method.' },
      ],
    },
    steps: {
      label: 'What happens when you start',
      rows: [
        { num: '1', title: 'Five questions · about 90 seconds', desc: 'Each question explores one dimension of how you read a match. There are no correct answers - the diagnostic measures analytical style, not knowledge.' },
        { num: '2', title: 'Your analytical profile', desc: 'The model classifies your answers into one of the predictor profiles defined in the research, with a plain-language read on where your style is strong and where it tends to bend.' },
        { num: '3', title: 'Full report + 5-day playbook', desc: 'Hand over your email and we send the full report plus a five-day teaching series on how betting markets behave. Email only - no other data is collected.' },
      ],
    },
    clarity: {
      label: 'Important · What Mestari is and is not',
      is: { head: 'What Mestari is', items: [
        'A research and analytics tool studying market movement',
        'An educational diagnostic on decision-making and bias',
        'A structured, documented, reproducible method',
        'Free - no deposit, no account',
      ] },
      isnt: { head: 'What Mestari is not', items: [
        'Not betting advice and not a tipster service',
        'Not gambling promotion or promotion of any operator',
        'Not a prediction of any match outcome',
        'No outcome guarantee - no method removes risk',
      ] },
    },
    team: {
      label: 'Who built this',
      initial: 'D',
      eyebrow: 'Founder · 9 years inside the Finnish betting scene',
      quote: ['We built Mestari because most people read a betting market ', 'on instinct and never check the instinct', '. The diagnostic gives a clear, research-grounded picture of how you actually think.'],
      signName: 'Dioni V.', signRest: ' · Founder · Putki HQ',
      credPre: 'Helsinki · Method built on public data and documented research · ',
      credLink: 'Methodology on request →',
    },
    faq: {
      label: 'Questions before you start',
      items: [
        { q: 'Is this betting advice?', a: 'No. Mestari is a research and analytics tool. It studies how betting markets behave and how people interpret them. It will never tell you what to bet, and it does not promote gambling. For educational use.' },
        { q: 'Do I have to bet anything?', a: 'No. There is no deposit, no stake and no gambling account at any point. The diagnostic is a questionnaire on analytical style.' },
        { q: 'What do you do with my email?', a: 'We use it once to send your report and then for the 5-day teaching series. No other personal data is collected. You can unsubscribe at any time. GDPR compliant.' },
        { q: 'How is the profile calculated?', a: 'Your five answers are classified against a fixed research framework with AI-assisted analysis that is checked against a documented method. The same answers always yield the same profile - there is no editorial override.' },
      ],
    },
    final: {
      eyebrow: '→ Diagnostic · 90 seconds · Free',
      headlinePre: 'Find out how you ',
      headlineAccent: 'actually',
      headlinePost: ' read the market.',
      cta: 'Start the diagnostic →',
      meta: ['Research tool', 'No betting', 'No deposit', 'Email only', 'GDPR'],
    },
    footer: {
      home: '← Back to Putki HQ',
      links: [
        { href: '#', label: 'Method' },
        { href: '/tietosuoja', label: 'Privacy' },
        { href: '/ehdot', label: 'Terms' },
        { href: '/yhteys', label: 'Contact' },
      ],
      disclaimer: 'Mestari is an editorial research and analytics product by Putki HQ. It analyses publicly available betting-market data for educational purposes. Mestari does not provide betting advice, does not predict match outcomes and does not promote gambling or any operator. Nothing on this page is an invitation to gamble. If gambling is a concern, help is available - in Finland see ',
      disclaimerLink: { href: 'https://peluuri.fi', label: 'peluuri.fi' },
      disclaimerTail: '. 18+.',
    },
    trust: {
      pills: ['GDPR', 'No spam', 'We never sell data', 'Email only'],
      note: 'Your email is stored to send this report. We use it only for the report and the 5-day playbook. We never share, sell or pass on your data to third parties. An unsubscribe link sits in every message.',
      acceptPre: 'I accept the ',
      acceptLink: 'privacy policy',
      acceptPost: ' and want to receive the report + 5-day playbook.',
      links: [
        { href: '/ehdot', label: 'Privacy & GDPR' },
        { href: '/menetelma', label: 'How we communicate' },
        { href: '/tietoa-meista', label: 'Contact' },
      ],
    },
  },
};

// ── Shared atoms ────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{
    fontFamily: T.mono, fontSize: 10, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: T.muted, marginBottom: 26,
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <span style={{ display: 'inline-block', width: 24, height: 1, background: T.muted }} />
    <span>{children}</span>
  </div>
);

// Big CTA used in hero + final.
const HeroCTA = ({ children, onClick, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    onMouseEnter={(e) => { e.currentTarget.style.background = T.accentBright; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = T.accent; }}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 12,
      background: T.accent, color: T.bg, border: 'none',
      padding: '16px 28px', fontFamily: T.mono, fontSize: 12.5, fontWeight: 700,
      letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer',
      transition: 'background 0.2s', textDecoration: 'none',
    }}>{children}</button>
);

// ── Adapter: backend tree → per-lang flat shape MestariLanding expects.
// The backend stores fi/en variants on every field; this fans them out
// into the shape the JSX was originally written against (so the editor
// can override any field with zero JSX churn). Falls through to the
// hardcoded COPY const when the network call hasn't returned yet.
const buildLandingCopy = (lang, live) => {
  if (!live) return COPY[lang];
  const k = (key) => `${key}_${lang}`;
  const h = (live.hero && live.hero[lang]) || COPY[lang].hero;
  return {
    header: {
      back: (live.header && live.header[k('back')]) || COPY[lang].header.back,
      backArrow: COPY[lang].header.backArrow,
    },
    hero: {
      eyebrow: h.eyebrow,
      headline: h.headline,
      sub: h.sub,
      positioningStrong: h.positioning_strong,
      positioningRest: h.positioning_rest,
      cta: h.cta,
      ctaMeta: [h.meta_1, h.meta_2, h.meta_3, h.meta_4].filter(Boolean),
    },
    cred: (live.cred || []).map((cell) => ({
      num: cell.num,
      unit: cell[k('unit')],
      desc: cell[k('desc')],
    })),
    method: {
      label: live.method[k('label')],
      intro: [
        live.method[`intro_pre_${lang}`],
        live.method[`intro_em_${lang}`],
        live.method[`intro_post_${lang}`],
      ],
      cards: (live.method.cards || []).map((card) => ({
        num: card[`num_${lang}`],
        title: card[`title_${lang}`],
        body: [card[`body_pre_${lang}`], card[`body_em_${lang}`], card[`body_post_${lang}`]],
        tag: card[`tag_${lang}`],
      })),
    },
    stack: {
      label: live.stack[k('label')],
      items: (live.stack.items || []).map((it) => ({
        label: it[`label_${lang}`],
        title: it[`title_${lang}`],
        body: it[`body_${lang}`],
      })),
    },
    steps: {
      label: live.steps[k('label')],
      rows: (live.steps.rows || []).map((r) => ({
        num: r.num,
        title: r[`title_${lang}`],
        desc: r[`desc_${lang}`],
      })),
    },
    clarity: {
      label: live.clarity[k('label')],
      is: {
        head: live.clarity[`is_head_${lang}`],
        items: live.clarity[`is_items_${lang}`] || [],
      },
      isnt: {
        head: live.clarity[`isnt_head_${lang}`],
        items: live.clarity[`isnt_items_${lang}`] || [],
      },
    },
    team: {
      label: live.team[k('label')],
      initial: live.team.initial,
      eyebrow: live.team[`eyebrow_${lang}`],
      quote: [live.team[`quote_pre_${lang}`], live.team[`quote_em_${lang}`], live.team[`quote_post_${lang}`]],
      signName: live.team.sign_name,
      signRest: live.team[`sign_rest_${lang}`],
      credPre: live.team[`cred_pre_${lang}`],
      credLink: live.team[`cred_link_${lang}`],
    },
    faq: {
      label: live.faq[k('label')],
      items: (live.faq.items || []).map((it) => ({
        q: it[`q_${lang}`],
        a: it[`a_${lang}`],
      })),
    },
    final: {
      eyebrow: live.final[`eyebrow_${lang}`],
      headlinePre: live.final[`headline_pre_${lang}`],
      headlineAccent: live.final[`headline_em_${lang}`],
      headlinePost: live.final[`headline_post_${lang}`],
      cta: live.final[`cta_${lang}`],
      meta: [1, 2, 3, 4, 5]
        .map((i) => live.final[`meta_${lang}_${i}`])
        .filter(Boolean),
    },
    trust: (() => {
      const tBase = (live.trust && live.trust[lang]) || {};
      return {
        pills: [tBase.pill_1, tBase.pill_2, tBase.pill_3, tBase.pill_4].filter(Boolean),
        note: tBase.note || '',
        acceptPre: tBase.accept_pre || '',
        acceptLink: tBase.accept_link || '',
        acceptPost: tBase.accept_post || '',
        links: ((live.trust && live.trust.links) || []).map((l) => ({
          href: l.href, label: l[`label_${lang}`],
        })),
      };
    })(),
    footer: {
      home: live.footer[k('home')],
      links: (live.footer.links || []).map((l) => ({
        href: l.href,
        label: l[`label_${lang}`],
      })),
      disclaimer: live.footer[`disclaimer_${lang}`],
      disclaimerLink: {
        href: live.footer.disclaimer_link_href,
        label: live.footer.disclaimer_link_label,
      },
      disclaimerTail: live.footer[`disclaimer_tail_${lang}`],
    },
  };
};

// ── Landing page (intro state) ──────────────────────────────────────────
const MestariLanding = ({ lang, toggleLang, theme, toggleTheme, onStart, c }) => {
  return (
    <div data-testid="mestari-landing" style={{
      background: T.bg, color: T.ink, fontFamily: T.sans, fontWeight: 300,
      minHeight: '100vh',
    }}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <Link to="/" data-testid="mestari-header-home"
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: T.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
          <span>{c.header.backArrow}</span>
          <span style={{ fontWeight: 600, letterSpacing: '0.15em', color: T.ink }}>
            PUTKI<span style={{ color: T.muted, marginLeft: 4 }}>HQ</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={toggleLang} data-testid="mestari-lang-toggle"
            style={{
              color: T.ink, height: 34, padding: '0 12px',
              border: `1px solid ${T.borderStrong}`, borderRadius: 999,
              cursor: 'pointer', background: 'transparent',
              fontFamily: T.mono, fontSize: 11, letterSpacing: '0.16em',
              fontWeight: 600, textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center',
            }}>
            {lang === 'fi' ? 'FI / EN' : 'EN / FI'}
          </button>
          <button type="button" onClick={toggleTheme} data-testid="mestari-theme-toggle"
            aria-label="Toggle theme"
            style={{
              width: 34, height: 34, borderRadius: 999,
              border: `1px solid ${T.borderStrong}`, background: 'transparent',
              color: T.ink, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {theme === 'dark' ? <Sun strokeWidth={1.5} size={16} /> : <Moon strokeWidth={1.5} size={16} />}
          </button>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '120px 24px 56px' }}>
        <div data-testid="mestari-hero-eyebrow" style={{
          fontFamily: T.mono, fontSize: 11, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: T.accent, marginBottom: 22,
        }}>{c.hero.eyebrow}</div>
        <h1 data-testid="mestari-hero-headline" style={{
          fontFamily: T.serif, fontSize: 'clamp(36px, 5.6vw, 56px)', lineHeight: 1.05,
          letterSpacing: '-0.025em', maxWidth: 820, marginBottom: 22, fontWeight: 700,
        }}>{c.hero.headline}</h1>
        <p style={{
          fontFamily: T.sans, fontSize: 17, lineHeight: 1.55, color: T.muted,
          fontWeight: 300, maxWidth: 640, marginBottom: 14,
        }}>{c.hero.sub}</p>
        <div data-testid="mestari-hero-positioning" style={{
          fontFamily: T.mono, fontSize: 11, lineHeight: 1.7, letterSpacing: '0.03em',
          color: T.muted, maxWidth: 640, marginBottom: 34,
          paddingLeft: 14, borderLeft: `2px solid ${T.borderStrong}`,
        }}>
          <strong style={{ color: T.muted, fontWeight: 500 }}>{c.hero.positioningStrong}</strong>
          {c.hero.positioningRest}
        </div>
        <HeroCTA onClick={onStart} testid="mestari-hero-cta">{c.hero.cta}</HeroCTA>
        <div style={{
          marginTop: 16, fontFamily: T.mono, fontSize: 11, letterSpacing: '0.1em',
          color: T.muted, textTransform: 'uppercase',
        }}>
          {c.hero.ctaMeta.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: T.muted, margin: '0 10px' }}>·</span>}
              {m}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── CREDIBILITY BAR ────────────────────────────────────────── */}
      <div data-testid="mestari-cred-bar" style={{
        borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      }}
        className="mestari-cred-grid">
        {c.cred.map((cell, i) => (
          <div key={i} data-testid={`mestari-cred-${i}`} style={{
            padding: '26px 24px',
            borderRight: i < c.cred.length - 1 ? `1px solid ${T.border}` : 'none',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontFamily: T.serif, fontSize: 34, lineHeight: 1, color: T.ink, fontWeight: 700 }}>
              {cell.num}<span style={{ fontSize: 18, color: T.muted }}>{cell.unit}</span>
            </div>
            <div style={{
              fontFamily: T.mono, fontSize: 10, letterSpacing: '0.06em', color: T.muted,
              textTransform: 'uppercase', lineHeight: 1.6,
            }}>{cell.desc}</div>
          </div>
        ))}
      </div>

      {/* ── METHOD ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '72px 24px' }}>
        <SectionLabel>{c.method.label}</SectionLabel>
        <p data-testid="mestari-method-intro" style={{
          fontFamily: T.serif, fontSize: 26, lineHeight: 1.3, letterSpacing: '-0.01em',
          maxWidth: 780, marginBottom: 44, color: T.ink, fontWeight: 700,
        }}>
          {c.method.intro[0]}
          <span style={{ color: T.accent, fontWeight: 700 }}>{c.method.intro[1]}</span>
          {c.method.intro[2]}
        </p>
        <div className="mestari-method-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1,
          background: T.border, border: `1px solid ${T.border}`,
        }}>
          {c.method.cards.map((card, i) => (
            <div key={i} data-testid={`mestari-method-${i}`} style={{
              background: T.bg, padding: 32,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.14em', color: T.accent, textTransform: 'uppercase' }}>
                {card.num}
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, letterSpacing: '-0.01em', fontWeight: 700 }}>
                {card.title}
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 14, lineHeight: 1.6, color: T.muted, fontWeight: 300 }}>
                {card.body[0]}
                <span style={{ color: T.accent }}>{card.body[1]}</span>
                {card.body[2]}
              </div>
              <div style={{
                marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${T.border}`,
                fontFamily: T.mono, fontSize: 9, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase',
              }}>{card.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STACK ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '72px 24px' }}>
        <SectionLabel>{c.stack.label}</SectionLabel>
        <div className="mestari-stack-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {c.stack.items.map((it, i) => (
            <div key={i} data-testid={`mestari-stack-${i}`} style={{
              background: T.surface, border: `1px solid ${T.border}`, padding: 24,
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.13em', color: T.accent, textTransform: 'uppercase', marginBottom: 12 }}>
                {it.label}
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 19, color: T.ink, marginBottom: 8, fontWeight: 700 }}>
                {it.title}
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 13, lineHeight: 1.55, color: T.muted, fontWeight: 300 }}>
                {it.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '72px 24px' }}>
        <SectionLabel>{c.steps.label}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
          {c.steps.rows.map((row, i) => (
            <div key={i} data-testid={`mestari-step-${i}`} className="mestari-step-row" style={{
              background: T.bg, padding: '24px 28px',
              display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24, alignItems: 'baseline',
            }}>
              <div style={{ fontFamily: T.serif, fontSize: 30, color: T.accent, lineHeight: 1, fontWeight: 700 }}>
                {row.num}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, fontWeight: 700 }}>{row.title}</div>
                <div style={{ fontFamily: T.sans, fontSize: 14, lineHeight: 1.55, color: T.muted, fontWeight: 300 }}>{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLARITY (is / isn't) ──────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '72px 24px' }}>
        <SectionLabel>{c.clarity.label}</SectionLabel>
        <div className="mestari-clarity-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div data-testid="mestari-clarity-is" style={{
            border: '1px solid rgba(107,184,119,0.3)', padding: 30, background: T.surface,
          }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 18, color: T.success }}>
              {c.clarity.is.head}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {c.clarity.is.items.map((it, i) => (
                <div key={i} style={{
                  fontFamily: T.sans, fontSize: 14, lineHeight: 1.5, color: T.muted,
                  fontWeight: 300, paddingLeft: 20, position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: T.success, fontFamily: T.mono }}>✓</span>
                  {it}
                </div>
              ))}
            </div>
          </div>
          <div data-testid="mestari-clarity-isnt" style={{
            border: '1px solid rgba(232,168,72,0.3)', padding: 30, background: T.surface,
          }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 18, color: T.warn }}>
              {c.clarity.isnt.head}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {c.clarity.isnt.items.map((it, i) => (
                <div key={i} style={{
                  fontFamily: T.sans, fontSize: 14, lineHeight: 1.5, color: T.muted,
                  fontWeight: 300, paddingLeft: 20, position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: T.warn, fontFamily: T.mono }}>✕</span>
                  {it}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TEAM ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '72px 24px' }}>
        <SectionLabel>{c.team.label}</SectionLabel>
        <div data-testid="mestari-team" className="mestari-team" style={{
          background: T.surface, border: `1px solid ${T.border}`, padding: 38,
          display: 'grid', gridTemplateColumns: '110px 1fr', gap: 30,
        }}>
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            background: T.surface2, border: `1px solid ${T.borderStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.serif, fontSize: 38, color: T.accent, fontWeight: 700, fontWeight: 700,
          }}>{c.team.initial}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em', color: T.muted, textTransform: 'uppercase' }}>
              {c.team.eyebrow}
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 21, lineHeight: 1.4, color: T.ink, fontWeight: 700 }}>
              {c.team.quote[0]}
              <span style={{ color: T.accent, fontWeight: 700 }}>{c.team.quote[1]}</span>
              {c.team.quote[2]}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.05em', color: T.muted, textTransform: 'uppercase', paddingTop: 6 }}>
              <span style={{ color: T.ink, fontWeight: 500 }}>{c.team.signName}</span>{c.team.signRest}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.04em', lineHeight: 1.7 }}>
              {c.team.credPre}
              <a href="#" style={{ color: T.accent, textDecoration: 'none' }}>{c.team.credLink}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '72px 24px' }}>
        <SectionLabel>{c.faq.label}</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
          {c.faq.items.map((it, i) => (
            <div key={i} data-testid={`mestari-faq-${i}`} style={{ background: T.bg, padding: '24px 28px' }}>
              <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, marginBottom: 8, fontWeight: 700 }}>{it.q}</div>
              <div style={{ fontFamily: T.sans, fontSize: 14, lineHeight: 1.6, color: T.muted, fontWeight: 300 }}>{it.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────── */}
      <section data-testid="mestari-final-cta" style={{
        background: T.bg, borderTop: `1px solid ${T.border}`,
        padding: '88px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          content: '', position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 700px 340px at center top, ${T.accentGlow}, transparent)`,
        }} />
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.2em', color: T.accent, textTransform: 'uppercase', marginBottom: 22 }}>
            {c.final.eyebrow}
          </div>
          <h2 style={{
            fontFamily: T.serif, fontSize: 'clamp(30px, 4.6vw, 44px)', lineHeight: 1.05,
            letterSpacing: '-0.02em', marginBottom: 28, fontWeight: 700, color: T.ink,
          }}>
            {c.final.headlinePre}
            <span style={{ fontStyle: 'italic', color: T.accent }}>{c.final.headlineAccent}</span>
            {c.final.headlinePost}
          </h2>
          <HeroCTA onClick={onStart} testid="mestari-final-cta-btn">{c.final.cta}</HeroCTA>
          <div style={{
            marginTop: 16, fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em',
            color: T.muted, textTransform: 'uppercase',
          }}>
            {c.final.meta.map((m, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: T.muted, margin: '0 10px' }}>·</span>}
                {m}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: '36px 24px' }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, alignItems: 'center',
        }}>
          <Link to="/" data-testid="mestari-footer-home" style={{
            fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em',
            color: T.accent, textTransform: 'uppercase', textDecoration: 'none',
          }}>{c.footer.home}</Link>
          <div style={{ display: 'flex', gap: 28, fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>
            {c.footer.links.map((l, i) => (
              <a key={i} href={l.href} style={{ textDecoration: 'none', color: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = T.muted; }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
        <div data-testid="mestari-footer-disclaimer" style={{
          maxWidth: 1140, margin: '24px auto 0', paddingTop: 20,
          borderTop: `1px solid ${T.border}`,
          fontFamily: T.mono, fontSize: 10, lineHeight: 1.7, color: T.muted, letterSpacing: '0.03em',
        }}>
          {c.footer.disclaimer}
          <a href={c.footer.disclaimerLink.href} rel="noopener noreferrer" target="_blank"
            style={{ color: T.accent, textDecoration: 'none' }}>{c.footer.disclaimerLink.label}</a>
          {c.footer.disclaimerTail}
        </div>
      </footer>

      {/* ── Responsive overrides ───────────────────────────────────── */}
      <style>{`
        @media (max-width: 880px) {
          .mestari-cred-grid { grid-template-columns: 1fr 1fr !important; }
          .mestari-cred-grid > div:nth-child(2) { border-right: none !important; }
          .mestari-method-grid { grid-template-columns: 1fr !important; }
          .mestari-stack-row { grid-template-columns: 1fr !important; }
          .mestari-clarity-grid { grid-template-columns: 1fr !important; }
          .mestari-team { grid-template-columns: 1fr !important; text-align: center; }
          .mestari-team > div:first-child { margin: 0 auto; }
          .mestari-step-row { grid-template-columns: 40px 1fr !important; gap: 14px !important; }
        }
      `}</style>
    </div>
  );
};

// ── Quiz step (unchanged logic, tightened styling to match dark theme) ──
const QuestionStep = ({ q, idx, total, answers, setAnswers, onAdvance, lang }) => {
  const title = lang === 'en' ? q.title_en : q.title_fi;
  const sub = lang === 'en' ? q.sub_en : q.sub_fi;
  const answer = answers[q.key];
  const pick = (v) => {
    setAnswers({ ...answers, [q.key]: v });
    if (q.auto !== false) setTimeout(onAdvance, 320);
  };
  return (
    <div data-testid={`mestari-q-${q.key}`}>
      <div style={{
        fontFamily: T.mono, fontSize: 10,
        letterSpacing: '0.22em', color: T.accent, fontWeight: 700, marginBottom: 10,
      }}>
        {lang === 'en' ? `QUESTION ${idx + 1} OF ${total}` : `KYSYMYS ${idx + 1} / ${total}`}
      </div>
      <h2 data-testid="mestari-q-title" style={{
        fontFamily: T.serif, fontSize: 28, fontWeight: 700, color: T.ink,
        margin: '0 0 12px', letterSpacing: '-0.015em', lineHeight: 1.2,
      }}>{title}</h2>
      {sub && (
        <p style={{ color: T.muted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.55 }}>{sub}</p>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {(q.options || []).map((o) => {
          const selected = answer === o.v;
          return (
            <motion.button key={o.v} whileTap={{ scale: 0.98 }} type="button"
              onClick={() => pick(o.v)}
              data-testid={`mestari-option-${q.key}-${o.v}`}
              style={{
                padding: '16px 18px', textAlign: 'left',
                background: selected ? 'rgba(91,141,238,0.12)' : T.surface,
                border: `1px solid ${selected ? T.accent : T.border}`,
                color: T.ink, fontSize: 14.5, lineHeight: 1.4,
                fontFamily: T.sans, fontWeight: 400, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              <span style={{ fontSize: 20 }}>{o.emoji || '·'}</span>
              <span>{lang === 'en' ? o.label_en : o.label_fi}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// ── Zinger card ─────────────────────────────────────────────────────────
const Zinger = ({ q, answer, onContinue, lang, isLast }) => {
  React.useEffect(() => {
    if (!q) return;
    const t = setTimeout(onContinue, 2000);
    return () => clearTimeout(t);
  }, [q, onContinue]);
  if (!q) return null;
  let zinger = lang === 'en' ? (q.zinger_en || '') : (q.zinger_fi || '');
  if (answer) {
    const opt = (q.options || []).find((o) => o.v === answer);
    const per = opt && (lang === 'en' ? opt.zinger_personalized_en : opt.zinger_personalized_fi);
    if (per) zinger = per;
  }
  const cta = lang === 'en'
    ? (isLast ? 'SEE YOUR PROFILE →' : 'CONTINUE →')
    : (isLast ? 'NÄYTÄ PROFIILISI →' : 'JATKA →');
  return (
    <div data-testid={`mestari-zinger-${q.key}`} onClick={onContinue}
      style={{
        padding: '40px 22px 32px', cursor: 'pointer',
        minHeight: 240, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
      <div style={{
        fontFamily: T.mono, fontSize: 10, letterSpacing: '0.22em',
        color: T.accent, fontWeight: 700, marginBottom: 14,
      }}>
        {lang === 'en' ? 'INSIGHT' : 'OIVALLUS'}
      </div>
      <p data-testid="mestari-zinger-text" style={{
        fontFamily: T.serif, fontSize: 24, fontWeight: 700, color: T.ink,
        lineHeight: 1.3, letterSpacing: '-0.01em', margin: '0 0 22px',
      }}>{zinger}</p>
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.22em', color: T.muted, fontWeight: 700 }}>{cta}</div>
    </div>
  );
};

// ── Result tease ────────────────────────────────────────────────────────
const Tease = ({ profile, loading, onContinue, lang }) => {
  if (loading || !profile) {
    return (
      <div data-testid="mestari-tease-loading" style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.22em', color: T.muted, fontWeight: 700 }}>
          {lang === 'en' ? 'COMPILING YOUR PROFILE…' : 'KOOSTAN PROFIILIASI…'}
        </div>
      </div>
    );
  }
  const name = lang === 'en' ? profile.name_en : profile.name_fi;
  const tease = lang === 'en' ? (profile.on_site_tease_en || profile.diagnosis_en || '') : (profile.on_site_tease_fi || profile.diagnosis_fi || '');
  return (
    <div data-testid="mestari-tease">
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.22em', color: T.accent, fontWeight: 700, marginBottom: 10 }}>
        {lang === 'en' ? 'YOUR PROFILE' : 'PROFIILISI'}
      </div>
      <h2 data-testid="mestari-profile-name" style={{
        fontFamily: T.serif, fontSize: 34, fontWeight: 700, color: T.ink,
        margin: '0 0 16px', letterSpacing: '-0.02em', lineHeight: 1.05,
      }}>{name}</h2>
      <p data-testid="mestari-tease-paragraph" style={{
        color: T.ink, fontSize: 15, lineHeight: 1.6, margin: '0 0 22px', opacity: 0.94,
      }}>{tease}</p>
      <div style={{
        padding: '14px 16px', marginBottom: 28,
        background: 'rgba(91,141,238,0.08)', border: '1px solid rgba(91,141,238,0.3)',
      }}>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '0.22em', color: T.accent, fontWeight: 700, marginBottom: 6 }}>
          {lang === 'en' ? 'LOCKED - EMAIL UNLOCKS' : 'LUKITTU - SÄHKÖPOSTI AVAA'}
        </div>
        <p style={{ color: T.ink, fontSize: 13.5, lineHeight: 1.55, margin: 0, opacity: 0.9 }}>
          {lang === 'en'
            ? "Full report: diagnosis · weakness · edge · what the method reveals · plus a 5-day playbook on how betting markets behave, one chapter per day."
            : 'Täysi raportti: diagnoosi · heikkous · etu · mitä menetelmä paljastaa · sekä 5 päivän pelikirja vedonlyöntimarkkinoiden lukemiseen, yksi luku päivässä.'}
        </p>
      </div>
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onContinue}
        data-testid="mestari-tease-continue"
        style={{
          padding: '15px 22px', width: '100%',
          background: T.accent, color: T.bg, border: 0,
          fontFamily: T.mono, fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
        }}>{lang === 'en' ? 'SEND ME MY REPORT →' : 'LÄHETÄ RAPORTTINI →'}</motion.button>
    </div>
  );
};

// ── Email gate ──────────────────────────────────────────────────────────
// Trust pills + a privacy/method link row sit above the submit button to
// reassure cold-traffic visitors before they hand over their email. All
// copy (pills, GDPR note, accept-link wording, link labels) lives in the
// editable `trust` slice of the mestari copy tree, so any line can be
// A/B-tested from /back-office/mestari-copy without code changes.
const TrustStrip = ({ trust }) => {
  if (!trust) return null;
  return (
    <div data-testid="mestari-trust-strip" style={{
      marginTop: 10, padding: '16px 16px 14px',
      background: 'color-mix(in srgb, var(--surface) 70%, transparent)',
      border: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Trust pills row */}
      <div data-testid="mestari-trust-pills" style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
      }}>
        {(trust.pills || []).map((p, i) => (
          <span key={i} data-testid={`mestari-trust-pill-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 999,
            border: `1px solid ${T.border}`,
            background: T.bg,
            fontFamily: T.mono, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: T.ink,
          }}>
            <span aria-hidden="true" style={{ color: T.accent }}>✓</span>{p}
          </span>
        ))}
      </div>
      {/* Plain-language note */}
      <p style={{
        margin: 0, color: T.muted, fontSize: 12.5, lineHeight: 1.55,
        fontFamily: T.sans, fontWeight: 300,
      }}>{trust.note}</p>
      {/* Links row */}
      <div data-testid="mestari-trust-links" style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 18px',
        fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.16em',
        textTransform: 'uppercase', fontWeight: 700,
      }}>
        {(trust.links || []).map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: T.muted, opacity: 0.5 }}>·</span>}
            <Link to={l.href} target="_blank" rel="noopener noreferrer"
              data-testid={`mestari-trust-link-${i}`}
              style={{ color: T.accent, textDecoration: 'none' }}>
              {l.label} ↗
            </Link>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const Gate = ({ email, setEmail, rules, setRules, onSubmit, busy, error, lang, trust }) => {
  const canSubmit = !!email && rules && !busy;
  const acceptPre = (trust && trust.acceptPre) || (lang === 'en' ? 'I accept the ' : 'Hyväksyn ');
  const acceptLink = (trust && trust.acceptLink) || (lang === 'en' ? 'privacy policy' : 'tietosuojaehdot');
  const acceptPost = (trust && trust.acceptPost) || (lang === 'en'
    ? ' and want to receive the report + 5-day playbook.'
    : ' ja haluan vastaanottaa raportin + 5 päivän pelikirjan.');
  return (
    <div data-testid="mestari-gate">
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.22em', color: T.accent, fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'SEND ME MY REPORT' : 'LÄHETÄ RAPORTTINI'}
      </div>
      <h2 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 700, color: T.ink, margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.15 }}>
        {lang === 'en' ? 'Where do we send your report?' : 'Mihin lähetämme raporttisi?'}
      </h2>
      <p style={{ color: T.muted, fontSize: 14, marginBottom: 22, lineHeight: 1.55 }}>
        {lang === 'en'
          ? 'Full report in 5 minutes. The 5-day playbook starts tomorrow at 09:00. No spam - unsubscribe anytime.'
          : 'Täysi raportti 5 minuutissa. 5 päivän pelikirja alkaa huomenna klo 09. Ei spämmiä - peruuta milloin tahansa.'}
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={lang === 'en' ? 'your@email.com' : 'sähköpostisi@osoite.fi'}
          data-testid="mestari-email-input"
          style={{
            padding: '14px 16px', background: T.surface,
            border: `1px solid ${T.border}`, color: T.ink,
            fontFamily: T.mono, fontSize: 14, letterSpacing: '0.02em',
            outline: 'none',
          }} />

        {/* Trust strip - pills, GDPR note, and external links */}
        <TrustStrip trust={trust} />

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: T.ink, cursor: 'pointer' }}>
          <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)}
            data-testid="mestari-rules-checkbox"
            style={{ marginTop: 2, width: 18, height: 18 }} />
          <span style={{ lineHeight: 1.5, opacity: 0.92 }}>
            {acceptPre}
            <Link to="/ehdot" target="_blank" rel="noopener noreferrer"
              data-testid="mestari-rules-privacy-link"
              onClick={(e) => e.stopPropagation()}
              style={{ color: T.accent, textDecoration: 'underline', textUnderlineOffset: 2 }}>
              {acceptLink}
            </Link>
            {acceptPost}
          </span>
        </label>
        {error && (
          <div data-testid="mestari-error" style={{
            color: '#E8A848', fontFamily: T.mono, fontSize: 12, letterSpacing: '0.05em',
          }}>{error}</div>
        )}
        <motion.button whileTap={{ scale: 0.97 }} type="button"
          onClick={onSubmit} disabled={!canSubmit}
          data-testid="mestari-submit"
          style={{
            padding: '15px 22px',
            background: canSubmit ? T.accent : T.surface,
            color: canSubmit ? T.bg : T.muted,
            border: canSubmit ? 0 : `1px solid ${T.border}`,
            fontFamily: T.mono, fontSize: 12,
            letterSpacing: '0.22em', fontWeight: 800,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
          {busy ? '…' : (lang === 'en' ? 'SEND MY REPORT →' : 'LÄHETÄ RAPORTTI →')}
        </motion.button>
      </div>
    </div>
  );
};

// ── Confirmation ────────────────────────────────────────────────────────
// First (and only) place where the daily-signals product is allowed to be
// mentioned on the cold-traffic surface, per brief.
const Confirmation = ({ email, profileName, lang }) => (
  <div data-testid="mestari-confirm">
    <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.22em', color: T.success, fontWeight: 700, marginBottom: 10 }}>
      ✓ {lang === 'en' ? 'REPORT ON ITS WAY' : 'RAPORTTI MATKALLA'}
    </div>
    <h2 style={{
      fontFamily: T.serif, fontSize: 34, fontWeight: 700, color: T.ink,
      margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.05,
    }}>{lang === 'en' ? 'Check your inbox.' : 'Tarkista sähköpostisi.'}</h2>
    <p style={{ color: T.ink, fontSize: 15, lineHeight: 1.6, margin: '0 0 6px', opacity: 0.94 }}>
      {lang === 'en' ? 'Your full report' : 'Täysi raporttisi'}
      {profileName && ` (${profileName})`}
      {lang === 'en' ? ' lands at ' : ' saapuu osoitteeseen '}
      <span style={{ fontFamily: T.mono, fontSize: 13, color: T.accent }}>{email}</span>
      {lang === 'en' ? ' within 5 minutes.' : ' 5 minuutin sisällä.'}
    </p>
    <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.55, margin: '0 0 18px' }}>
      {lang === 'en'
        ? 'Day 1 of the 5-day playbook arrives tomorrow at 09:00. One per day. Read at your pace.'
        : 'Päivä 1/5 pelikirjasta saapuu huomenna klo 09. Yksi per päivä. Lue omassa tahdissasi.'}
    </p>
    {/* Section 7.3 value block - required on every diagnostic, verbatim. */}
    <div data-testid="mestari-confirm-value-block" style={{
      padding: '20px 20px', background: T.surface,
      border: `1px solid ${T.border}`, marginBottom: 24,
    }}>
      <span data-testid="mestari-confirm-value-kicker" style={{
        fontFamily: T.mono, fontSize: 10, letterSpacing: '0.24em',
        fontWeight: 700, color: T.accent, textTransform: 'uppercase',
      }}>{lang === 'en' ? 'WHAT THIS REPORT GIVES YOU' : 'MITÄ TÄMÄ RAPORTTI ANTAA'}</span>
      <p data-testid="mestari-confirm-value-body" style={{
        fontFamily: T.serif, fontSize: 15.5, lineHeight: 1.65,
        color: T.ink, margin: '12px 0 0',
      }}>{lang === 'en'
        ? "A read on how you actually approach a match - drawn from your answers, not from how you'd describe yourself. It's deterministic: the same answers always produce the same profile, with no editorial thumb on the scale. You get an honest account of where your approach is sharp and where it costs you, and a 5-day playbook on how betting markets genuinely behave. No tips, no picks - a clearer view of your own thinking, which is the thing most readers never get."
        : "Lukeman siitä, miten oikeasti lähestyt ottelua - vastauksistasi, ei siitä miten kuvailisit itseäsi. Se on deterministinen: samat vastaukset tuottavat aina saman profiilin, ilman toimituksen peukaloa vaa'assa. Saat rehellisen kuvauksen siitä, missä lähestymistapasi on terävä ja missä se maksaa, sekä 5 päivän pelikirjan siitä, miten vedonlyöntimarkkinat aidosti käyttäytyvät. Ei vinkkejä, ei valintoja - selkeämpi näkymä omaan ajatteluusi, jota useimmat lukijat eivät koskaan saa."}</p>
    </div>
    {/* The single allowed PS on cold-traffic - soft, link-only mention. */}
    <p data-testid="mestari-confirm-ps" style={{
      color: T.muted, fontSize: 13, lineHeight: 1.55, margin: '0 0 24px',
      fontFamily: T.sans, fontStyle: 'italic',
    }}>
      {lang === 'en' ? 'PS - Putki HQ also publishes daily market signals. ' : 'PS - Putki HQ julkaisee myös päivittäiset markkinasignaalit. '}
      <Link to="/pelisignaalit" style={{ color: T.accent, textDecoration: 'none' }}>
        {lang === 'en' ? 'See today →' : 'Katso tänään →'}
      </Link>
    </p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Link to="/" data-testid="mestari-confirm-home"
        style={{
          padding: '13px 22px', background: 'transparent', color: T.muted,
          border: `1px solid ${T.border}`, textDecoration: 'none',
          fontFamily: T.mono, fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700,
        }}>{lang === 'en' ? 'BACK TO PUTKI HQ' : 'TAKAISIN PUTKI HQ'}</Link>
    </div>
  </div>
);

// ── Quiz flow shell (dark themed container) ─────────────────────────────
const QuizFlow = ({ children, onExit, lang, step, qIdx, total }) => {
  const stepNumber = useMemo(() => {
    if (step === 'quiz') return qIdx + 1;
    if (step === 'zinger') return qIdx + 1.5;
    if (step === 'tease') return total + 0.5;
    if (step === 'gate') return total + 1;
    if (step === 'confirm') return total + 2;
    return 0;
  }, [step, qIdx, total]);
  const progressPct = Math.min(100, Math.round((stepNumber / (total + 2)) * 100));

  return (
    <div data-testid="mestari-quiz-shell" style={{
      background: T.bg, color: T.ink, fontFamily: T.sans,
      minHeight: '100vh', paddingTop: 64,
    }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        <button type="button" onClick={onExit} data-testid="mestari-quiz-exit"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.muted, fontFamily: T.mono, fontSize: 11,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
          <span>←</span>
          <span style={{ fontWeight: 600, letterSpacing: '0.15em', color: T.ink }}>
            PUTKI<span style={{ color: T.muted, marginLeft: 4 }}>HQ</span>
          </span>
        </button>
        <div style={{ color: T.muted }}>
          {step === 'confirm'
            ? (lang === 'en' ? '✓ DONE' : '✓ VALMIS')
            : (lang === 'en' ? 'DIAGNOSTIC' : 'DIAGNOSTIIKKA')}
        </div>
      </header>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '24px 20px 56px' }}>
        {step !== 'confirm' && (
          <div style={{
            height: 3, background: T.border, marginBottom: 32,
            position: 'relative', overflow: 'hidden',
          }}>
            <motion.div
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
              style={{
                height: '100%', background: T.accent,
                boxShadow: '0 0 12px rgba(91,141,238,0.4)',
              }} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

// ── Main page ───────────────────────────────────────────────────────────
const Mestari = () => {
  const { lang, toggle } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const liveCopy = useMestariCopy();
  const landingCopy = useMemo(() => buildLandingCopy(lang, liveCopy), [lang, liveCopy]);
  const [quiz, setQuiz] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState('intro');
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useDocumentMeta({
    title: lang === 'en' ? 'Mestari - What kind of sports bettor are you?' : 'Mestari - Millainen urheiluvedonlyöjä sinä olet?',
    description: lang === 'en'
      ? '90-second research-grounded diagnostic. Personal analytical profile + 5-day playbook to your inbox. Free, no deposit, no betting.'
      : '90-sekunnin tutkimuspohjainen diagnostiikka. Henkilökohtainen analyyttinen profiili + 5 päivän pelikirja sähköpostiisi. Ilmainen, ei talletusta, ei vedonlyöntiä.',
    canonical: `${BACKEND}/mestari`,
  });

  useEffect(() => {
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && Array.isArray(d.voita_quiz_config)) setQuiz(d.voita_quiz_config);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const composeTags = useCallback(() => {
    const tags = {};
    for (const q of quiz) {
      const v = answers[q.key];
      if (!v) continue;
      const opt = (q.options || []).find((o) => o.v === v);
      if (opt) tags[q.key] = opt.tag || opt.v;
    }
    return tags;
  }, [quiz, answers]);

  const startQuiz = useCallback(() => {
    if (!loaded || quiz.length === 0) return;
    setStep('quiz');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
  }, [loaded, quiz.length]);

  const exitToIntro = useCallback(() => {
    setStep('intro');
    setQIdx(0);
    setAnswers({});
    setProfile(null);
    setEmail('');
    setRules(false);
    setError('');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
  }, []);

  const advanceQ = useCallback(() => {
    setStep('zinger');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
  }, []);

  const afterZinger = useCallback(async () => {
    if (qIdx + 1 < quiz.length) {
      setQIdx(qIdx + 1);
      setStep('quiz');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
      return;
    }
    setProfileLoading(true);
    setStep('tease');
    try {
      const r = await fetch(`${BACKEND}/api/voita/profile/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: composeTags() }),
      });
      const j = await r.json();
      setProfile(j.profile || null);
    } catch { setProfile(null); }
    finally { setProfileLoading(false); }
  }, [qIdx, quiz.length, composeTags]);

  const submitLead = async () => {
    if (!email || !rules) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, raffle_slug: null, age_18_plus: true,
          favorite_sport: null, bet_frequency: null, sportsbooks: [],
          confidence: null, quiz_tags: composeTags(), lang,
          source: 'mestari',
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.detail || `HTTP ${r.status}`);
        return;
      }
      setStep('confirm');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
    } catch (e) {
      setError(e.message || 'Network');
    } finally { setBusy(false); }
  };

  const total = quiz.length || 5;

  // ── Intro / landing surface ──────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div data-testid="mestari-page">
        <MestariLanding lang={lang} toggleLang={toggle}
          theme={theme} toggleTheme={toggleTheme}
          c={landingCopy}
          onStart={startQuiz} />
      </div>
    );
  }

  // ── Quiz / Zinger / Tease / Gate / Confirmation surface ─────────────
  return (
    <div data-testid="mestari-page">
      <QuizFlow onExit={exitToIntro} lang={lang} step={step} qIdx={qIdx} total={total}>
        <AnimatePresence mode="wait">
          {step === 'quiz' && quiz[qIdx] && (
            <motion.div key={`q-${qIdx}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32 }}>
              <QuestionStep
                q={quiz[qIdx]} idx={qIdx} total={total}
                answers={answers} setAnswers={setAnswers}
                onAdvance={advanceQ} lang={lang}
              />
            </motion.div>
          )}
          {step === 'zinger' && quiz[qIdx] && (
            <motion.div key={`z-${qIdx}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32 }}>
              <Zinger
                q={quiz[qIdx]} answer={answers[quiz[qIdx].key]}
                onContinue={afterZinger} isLast={qIdx + 1 >= quiz.length} lang={lang}
              />
            </motion.div>
          )}
          {step === 'tease' && (
            <motion.div key="tease" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32 }}>
              <Tease profile={profile} loading={profileLoading}
                onContinue={() => setStep('gate')} lang={lang} />
            </motion.div>
          )}
          {step === 'gate' && (
            <motion.div key="gate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32 }}>
              <Gate email={email} setEmail={setEmail}
                rules={rules} setRules={setRules}
                trust={landingCopy && landingCopy.trust}
                onSubmit={submitLead} busy={busy} error={error} lang={lang} />
            </motion.div>
          )}
          {step === 'confirm' && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32 }}>
              <Confirmation email={email}
                profileName={profile ? (lang === 'en' ? profile.name_en : profile.name_fi) : ''}
                lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>
      </QuizFlow>
    </div>
  );
};

export default Mestari;
