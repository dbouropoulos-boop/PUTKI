import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, interpolate } from '../i18n/translations';

const LanguageContext = createContext({ lang: 'fi', setLang: () => {}, t: (k) => k });

const getInitial = () => {
  // PUTKI HQ launches as a Finnish-only product. Force `fi` regardless of
  // navigator language or stale localStorage from earlier EN sessions —
  // English translation paths still exist for back-office tools but the
  // public site renders Finnish only until Dioni reopens English.
  return 'fi';
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(getInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem('mittari-lang', lang);
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);

  const t = (key, vars) => {
    const dict = translations[lang] || translations.fi;
    const fallback = translations.fi;
    const raw = dict[key] !== undefined ? dict[key] : fallback[key] !== undefined ? fallback[key] : key;
    return vars ? interpolate(raw, vars) : raw;
  };

  const toggle = () => setLang((l) => (l === 'fi' ? 'en' : 'fi'));

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => useContext(LanguageContext);
