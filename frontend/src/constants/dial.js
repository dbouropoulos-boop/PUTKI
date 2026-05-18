// Mittari editorial constants — dial state palette + labels.
// NOT mock data. These are the 5 canonical dial states. The backend
// dial_engine returns one of these keys; this file holds the visual palette
// that maps state → color → headline copy.
//
// `label` is the FI brand term used in the on-dial UI; `label_en` is the
// English equivalent rendered when the language toggle is set to 'en'.
//
// 2026-05-18 rebrand: state names converted from "scene temperature" vocabulary
// (KYLMÄ/HAALEA/KUUMA/MYRSKY/KIIRASTULI ↔ COLD/LUKEWARM/HOT/STORM/FRENZY) to
// "WIN PULSE" — gambling-luck sentiment. The underlying state KEYS are
// unchanged so the dial engine + collections don't have to migrate.
//
// FI uses Finnish gambling slang; EN uses luck/win vocabulary.

export const DIAL_STATES = {
  KYLMA:       { key: 'KYLMA',       label: 'TYPÖTYHJÄ',   label_en: 'DRY',     color: '#2C5F8D', value: 12, headline: 'Mittari on TYPÖTYHJÄ. Voittoja ei nyt rapise.' },
  HAALEA:      { key: 'HAALEA',      label: 'NIHKEÄ',      label_en: 'SLOW',    color: '#7A7E83', value: 38, headline: 'Mittari on NIHKEÄ. Pieniä osumia, ei isoja.' },
  KUUMA:       { key: 'KUUMA',       label: 'TULOSSA',     label_en: 'WARM',    color: '#E8924A', value: 64, headline: 'Mittari on TULOSSA. Voittoja alkaa tippua.' },
  MYRSKY:      { key: 'MYRSKY',      label: 'VOITTOPUTKI', label_en: 'RUSH',    color: '#C8423C', value: 82, headline: 'Mittari on VOITTOPUTKI. Klippejä syntyy joka kierroksella.' },
  KIIRASTULI:  { key: 'KIIRASTULI',  label: 'RYÖSTÖPUTKI', label_en: 'JACKPOT', color: '#8B1E1A', value: 96, headline: 'Mittari on RYÖSTÖPUTKI. Älä katso pois.' },
};

/** Return the language-appropriate label for a dial state key. */
export const dialLabel = (state, lang = 'fi') => {
  const s = DIAL_STATES[state] || DIAL_STATES.KYLMA;
  return lang === 'en' ? (s.label_en || s.label) : s.label;
};
