import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, interpolate } from '../i18n/translations';

const LanguageContext = createContext({ lang: 'fi', setLang: () => {}, t: (k) => k });

const getInitial = () => {
  if (typeof window === 'undefined') return 'fi';
  // Explicit user choice (from a prior visit or URL ?lang=) always wins.
  try {
    const stored = window.localStorage.getItem('mittari-lang');
    if (stored === 'fi' || stored === 'en') return stored;
    const url = new URL(window.location.href);
    const q = (url.searchParams.get('lang') || '').toLowerCase();
    if (q === 'fi' || q === 'en') return q;
  } catch {}
  // Auto-detect on first visit: any non-Finnish browser defaults to English.
  // Finnish browsers stay on Finnish (the home market). This serves streamer
  // affiliate traffic from outside Finland a usable experience by default.
  const langs = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || ['fi-FI'];
  for (const l of langs) {
    const low = String(l || '').toLowerCase();
    if (low.startsWith('fi')) return 'fi';
    if (low.startsWith('en')) return 'en';
  }
  // Other languages — default to English (it's the wider fallback).
  return 'en';
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
