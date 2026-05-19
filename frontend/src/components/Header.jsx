import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';

// Phase 1 (2026-05-19): No nav menu by design. Discovery happens through
// contextual links inside sections + the temporary PhaseOneDiscoveryRow
// above the footer. The full Explore section ships in Phase 2.
//
// Visible chrome: logo (left) · language toggle (right) · theme toggle (right).

export const Header = () => {
  const { theme, toggle } = useTheme();
  const { lang, toggle: toggleLang, t } = useLang();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--border)',
        boxShadow: '0 1px 0 0 color-mix(in oklab, var(--ink) 6%, transparent)',
      }}
      data-testid="site-header"
    >
      <div className="container-wide flex items-center justify-between h-16">
        <Link to="/" className="flex items-baseline gap-2" data-testid="logo-link">
          <span className="font-display font-black text-2xl tracking-tighter" style={{ color: 'var(--ink)' }}>PUTKI</span>
          <span className="mono text-[11px] tracking-[0.22em] uppercase" style={{ color: 'var(--muted)' }}>HQ</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLang}
            aria-label="Toggle language"
            data-testid="lang-toggle"
            className="mono text-[11px] font-semibold tracking-[0.16em] uppercase px-3 h-9 rounded-full border flex items-center"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink)' }}
          >
            {lang === 'fi' ? 'FI / EN' : 'EN / FI'}
          </button>
          <button
            onClick={toggle}
            aria-label={t('common.theme_toggle')}
            data-testid="theme-toggle"
            className="w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink)' }}
          >
            {theme === 'dark' ? <Sun strokeWidth={1.5} size={16} /> : <Moon strokeWidth={1.5} size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
