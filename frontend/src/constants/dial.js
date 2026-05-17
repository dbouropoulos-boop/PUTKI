// Mittari editorial constants — dial state palette + labels.
// NOT mock data. These are the 5 canonical dial states. The backend
// dial_engine returns one of these keys; this file holds the visual palette
// that maps state → color → headline copy.

export const DIAL_STATES = {
  KYLMA:       { key: 'KYLMA',       label: 'KYLMÄ',       color: '#2C5F8D', value: 12, headline: 'Mittari on KYLMÄ. Skene nukkuu.' },
  HAALEA:      { key: 'HAALEA',      label: 'HAALEA',      color: '#7A7E83', value: 38, headline: 'Mittari on HAALEA. Tasaista taustakohinaa.' },
  KUUMA:       { key: 'KUUMA',       label: 'KUUMA',       color: '#E8924A', value: 64, headline: 'Mittari on KUUMA. Slot-skene lämpenee illaksi.' },
  MYRSKY:      { key: 'MYRSKY',      label: 'MYRSKY',      color: '#C8423C', value: 82, headline: 'Mittari on MYRSKY. Striimit täynnä, klippejä syntyy.' },
  KIIRASTULI:  { key: 'KIIRASTULI',  label: 'KIIRASTULI',  color: '#8B1E1A', value: 96, headline: 'Mittari on KIIRASTULI. Älä katso pois.' },
};
