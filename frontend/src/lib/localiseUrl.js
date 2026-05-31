/*
 * localiseUrl — flip a FI path → EN equivalent (or vice versa) when
 * the page is rendering in EN canonical mode.
 *
 * Used by the internal-link strips on the EN deep pages so their
 * "READ NEXT" rails stay inside the EN canonical tree instead of
 * dumping the reader back into the FI default URL space.
 *
 * Pure data — no React state, importable from anywhere.
 */

export const FI_TO_EN_URL_MAP = {
  // Wave-1 deep pages
  '/saantely/reform-2027': '/en/regulation/reform-2027',
  '/saantely': '/en/regulation',
  '/pelit': '/en/games',
  '/pelit/blackjack': '/en/games/blackjack',
  '/pelit/poker': '/en/games/poker',
  '/pelit/slotit': '/en/games/slots',
  '/pelit/craps': '/en/games/craps',
  '/pelit/ruletti': '/en/games/roulette',
  '/pelit/live': '/en/games/live',
  '/pelit/bonusmatematiikka': '/en/games/bonus-math',
  // Wave-2 long-form articles
  '/mestari/menetelma': '/en/mestari/methodology',
  '/mittari/lahteet': '/en/mittari/sources',
  '/voita/usein-kysytyt': '/en/voita/faq',
  '/profiilit/dioni-q-and-a': '/en/profiilit/dioni-q-and-a',
  // Wave-4 trust-signal data pages
  '/trust/mestari-aineisto': '/en/trust/mestari-dataset',
  '/trust/voita-tilikirja': '/en/trust/voita-ledger',
  '/trust/mittari-tarkkuus': '/en/trust/mittari-accuracy',
  // Trust hub capstone
  '/luotettavuus': '/en/trust',
};

export const localiseUrl = (path, isEn) => {
  if (!isEn || !path) return path;
  return FI_TO_EN_URL_MAP[path] || path;
};

export default localiseUrl;
