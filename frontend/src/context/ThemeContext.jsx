import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggle: () => {} });

// Default: dark mode is the brand's primary home, especially evenings.
// Use time-aware default for first visit (>= 18:00 Helsinki, or any time after sunset feel).
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('mittari-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // Helsinki time = Europe/Helsinki. Use Intl to get current hour.
  try {
    const hours = parseInt(
      new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', hour12: false })
        .format(new Date())
        .split(':')[0],
      10
    );
    // Dark mode default 18:00 → 07:00; light during daytime
    if (hours >= 16 || hours < 7) return 'dark';
    return 'light';
  } catch {
    return 'dark';
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      window.localStorage.setItem('mittari-theme', theme);
    } catch {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
