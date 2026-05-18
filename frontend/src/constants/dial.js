// Mittari editorial constants — dial state palette + labels.
// NOT mock data. These are the 5 canonical dial states. The backend
// dial_engine returns one of these keys; this file holds the visual palette
// that maps state → color → headline copy.
//
// `label` is the FI brand term used in the on-dial UI; `label_en` is the
// English equivalent rendered when the language toggle is set to 'en'.

export const DIAL_STATES = {
  KYLMA:       { key: 'KYLMA',       label: 'KYLMÄ',       label_en: 'COLD',    color: '#2C5F8D', value: 12, headline: 'Mittari on KYLMÄ. Skene nukkuu.' },
  HAALEA:      { key: 'HAALEA',      label: 'HAALEA',      label_en: 'LUKEWARM', color: '#7A7E83', value: 38, headline: 'Mittari on HAALEA. Tasaista taustakohinaa.' },
  KUUMA:       { key: 'KUUMA',       label: 'KUUMA',       label_en: 'HOT',     color: '#E8924A', value: 64, headline: 'Mittari on KUUMA. Slot-skene lämpenee illaksi.' },
  MYRSKY:      { key: 'MYRSKY',      label: 'MYRSKY',      label_en: 'STORM',   color: '#C8423C', value: 82, headline: 'Mittari on MYRSKY. Striimit täynnä, klippejä syntyy.' },
  KIIRASTULI:  { key: 'KIIRASTULI',  label: 'KIIRASTULI',  label_en: 'FRENZY',  color: '#8B1E1A', value: 96, headline: 'Mittari on KIIRASTULI. Älä katso pois.' },
};

/** Return the language-appropriate label for a dial state key. */
export const dialLabel = (state, lang = 'fi') => {
  const s = DIAL_STATES[state] || DIAL_STATES.KYLMA;
  return lang === 'en' ? (s.label_en || s.label) : s.label;
};
