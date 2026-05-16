import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, interpolate } from '../i18n/translations';

const LanguageContext = createContext({ lang: 'fi', setLang: () => {}, t: (k) => k });

const getInitial = () => {
  if (typeof window === 'undefined') return 'fi';
  const stored = window.localStorage.getItem('mittari-lang');
  if (stored === 'fi' || stored === 'en') return stored;
  // Default to Finnish; if browser is English-only, default English
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'fi-FI';
  if (nav.startsWith('en')) return 'en';
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
