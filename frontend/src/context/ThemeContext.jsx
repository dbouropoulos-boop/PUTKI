import React, { createContext, useContext, useEffect } from 'react';

// iter97b: Dark mode retired. PUTKI HQ runs in light mode only — pure
// white background + ember accent (Phase 1 visual system). The context
// is kept as a no-op so any legacy `useTheme()` callers still work; the
// `toggle` action is intentionally a no-op so old buttons that survive
// the cleanup do nothing visible.
const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

export const ThemeProvider = ({ children }) => {
  // Force-strip the `.dark` class on every mount in case a user has
  // `localStorage["mittari-theme"] === "dark"` from a previous visit.
  useEffect(() => {
    try {
      document.documentElement.classList.remove('dark');
      window.localStorage.removeItem('mittari-theme');
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
