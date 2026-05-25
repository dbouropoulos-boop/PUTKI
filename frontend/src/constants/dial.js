// Mittari editorial constants - dial state palette + labels.
// NOT mock data. These are the 5 canonical dial states. The backend
// dial_engine returns one of these keys; this file holds the visual palette
// that maps state → color → headline copy.
//
// `label` is the FI brand term used in the on-dial UI; `label_en` is the
// English equivalent rendered when the language toggle is set to 'en'.
//
// 2026-05-19 rebrand: state names converted from "luck-vocab" to
// "Perkele-mittari" - Finnish-cultural intensity register.
// Five states escalating from calm to full perkele:
//   TYYNI · VIRE · VIPINÄ · MEININKI · PERKELE.
// PERKELE is intentionally NOT translated - it is the cultural top state.
//
// Internal state KEYS (KYLMA/HAALEA/KUUMA/MYRSKY/KIIRASTULI) preserved so the
// dial engine + collections don't have to migrate.

export const DIAL_STATES = {
  KYLMA:      { key: 'KYLMA',      label: 'TYYNI',    label_en: 'CALM',    color: '#5C8A8A', value: 12, headline: 'Skene on hiljainen.' },
  HAALEA:     { key: 'HAALEA',     label: 'VIRE',     label_en: 'BUZZ',    color: '#6FA37D', value: 38, headline: 'Skene käy.' },
  KUUMA:      { key: 'KUUMA',      label: 'VIPINÄ',   label_en: 'ACTIVE',  color: '#D4B445', value: 64, headline: 'Skenessä on vipinää.' },
  MYRSKY:     { key: 'MYRSKY',     label: 'MEININKI', label_en: 'ROLLING', color: '#C97A3A', value: 82, headline: 'Skenessä on meininkiä.' },
  KIIRASTULI: { key: 'KIIRASTULI', label: 'PERKELE',  label_en: 'PERKELE', color: '#C13B2C', value: 96, headline: 'Skene on perkele-tasolla.' },
};

/** Return the language-appropriate label for a dial state key. */
export const dialLabel = (state, lang = 'fi') => {
  const s = DIAL_STATES[state] || DIAL_STATES.KYLMA;
  return lang === 'en' ? (s.label_en || s.label) : s.label;
};

/**
 * Format the Mittari plain-language reading for a state, with optional
 * live counts. Returns a single-sentence Bloomberg-rhythm reading.
 * Per Section 13c. Ships deterministic templates today; Sprint 4 will swap
 * in AI-generated rotating variants.
 */
export const dialReading = (state, lang = 'fi', { streams = null, viewers = null } = {}) => {
  const fmtCount = (n) => {
    if (n == null || Number.isNaN(n)) return null;
    return lang === 'en'
      ? Number(n).toLocaleString('en-US')
      : Number(n).toLocaleString('fi-FI').replace(/,/g, ' ');
  };
  const s = fmtCount(streams);
  const v = fmtCount(viewers);
  const countsFi = (s && v) ? ` ${s} striimiä, ${v} katsojaa.` : '';
  const countsEn = (s && v) ? ` ${s} streams, ${v} viewers.` : '';
  const cycleFi = {
    KYLMA: '', HAALEA: '',
    KUUMA: ' Uutiskello aktiivinen.',
    MYRSKY: ' Uutiskello kiihtynyt.',
    KIIRASTULI: ' Uutiskello tulinen.',
  }[state] || '';
  const cycleEn = {
    KYLMA: '', HAALEA: '',
    KUUMA: ' News cycle moving.',
    MYRSKY: ' News cycle elevated.',
    KIIRASTULI: ' News cycle hot.',
  }[state] || '';
  const fi = {
    KYLMA:      `Skene on hiljainen.${countsFi}`,
    HAALEA:     `Skene käy.${countsFi}`,
    KUUMA:      `Skenessä on vipinää.${countsFi}${cycleFi}`,
    MYRSKY:     `Skenessä on meininkiä.${countsFi}${cycleFi}`,
    KIIRASTULI: `Skene on perkele-tasolla.${countsFi}${cycleFi}`,
  };
  const en = {
    KYLMA:      `Scene is quiet.${countsEn}`,
    HAALEA:     `Scene is on.${countsEn}`,
    KUUMA:      `Scene is active.${countsEn}${cycleEn}`,
    MYRSKY:     `Scene is rolling.${countsEn}${cycleEn}`,
    KIIRASTULI: `Scene is perkele.${countsEn}${cycleEn}`,
  };
  return (lang === 'en' ? en : fi)[state] || (lang === 'en' ? en.KYLMA : fi.KYLMA);
};
