/*
 * useLocalisedCanonical — Phase 4 localisation helper.
 *
 * Given a (fiPath, enPath, forceLang) triplet, returns:
 *
 *   { lang, isEn, canonical, alternates }
 *
 * - `lang` is the effective language (forceLang takes priority over
 *   the LanguageContext value).
 * - `canonical` is the absolute URL of the current page's canonical
 *   variant (FI by default, EN when forceLang === 'en').
 * - `alternates` is the [{lang, href}] array that useDocumentMeta
 *   feeds into the <link rel="alternate" hreflang> injection.
 *
 * Single source of truth — eliminates the boilerplate "build a
 * canonical+alternates block by hand in every article" pattern.
 */

import { useLang } from '../context/LanguageContext';

const HOST = 'https://putkihq.com';

const useLocalisedCanonical = ({ fiPath, enPath, forceLang } = {}) => {
  const ctx = useLang();
  const lang = forceLang || ctx.lang;
  const isEn = lang === 'en';
  const fiUrl = `${HOST}${fiPath || ''}`;
  const enUrl = `${HOST}${enPath || fiPath || ''}`;
  return {
    lang,
    isEn,
    canonical: isEn ? enUrl : fiUrl,
    alternates: [
      { lang: 'fi-FI', href: fiUrl },
      { lang: 'en-FI', href: enUrl },
      { lang: 'x-default', href: fiUrl },
    ],
  };
};

export default useLocalisedCanonical;
export { useLocalisedCanonical };
