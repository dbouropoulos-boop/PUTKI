/*
 * pageOgUrl — build the public /api/og/page/{slug} URL for a given
 * editorial surface key + language. Centralises slug naming so we
 * never accidentally hardcode the same slug twice.
 *
 * Slug naming convention mirrors `routes/page_og.py::PAGE_OG_PROFILES`.
 * Adding a new surface = adding ONE entry to the back-end allow-list
 * + bumping the OG_SLUGS table below.
 */

const HOST = process.env.REACT_APP_BACKEND_URL;

// Surface key → slug stem (FI/EN suffix added at call time).
const OG_SLUGS = {
  'trust-hub': 'trust-hub',
  'reform-2027': 'reform-2027',
  'pelit/blackjack': 'pelit-blackjack',
  'pelit/poker': 'pelit-poker',
  'pelit/slotit': 'pelit-slotit',
  'pelit/craps': 'pelit-craps',
  'pelit/ruletti': 'pelit-ruletti',
  'pelit/live': 'pelit-live',
  'pelit/bonusmatematiikka': 'pelit-bonusmath',
  'mestari/menetelma': 'mestari-method',
  'mittari/lahteet': 'mittari-sources',
  'voita/usein-kysytyt': 'voita-faq',
  'profiilit/dioni-q-and-a': 'founder-qa',
};

export const pageOgUrl = (surface, isEn) => {
  const stem = OG_SLUGS[surface];
  if (!stem || !HOST) return undefined;
  return `${HOST}/api/og/page/${stem}-${isEn ? 'en' : 'fi'}`;
};

export default pageOgUrl;
