import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { BellAlertManager } from './BellAlertManager';

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
          <BellAlertManager />
          <Link
            to="/menetelma"
            data-testid="nav-method-link"
            className="hidden sm:inline-flex mono text-[10px] font-semibold tracking-[0.18em] uppercase h-9 px-3 rounded-full border items-center"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--muted)', textDecoration: 'none' }}
            title={lang === 'fi' ? 'Menetelmä - miten luvut lasketaan' : 'Method - how the numbers are calculated'}
          >
            {lang === 'fi' ? 'Menetelmä' : 'Method'}
          </Link>
          <button
            onClick={toggleLang}
            aria-label="Toggle language · FI / EN"
            data-testid="lang-toggle"
            title={lang === 'fi' ? 'Switch to English' : 'Vaihda suomeksi'}
            className="mono text-[11px] font-semibold tracking-[0.16em] uppercase h-9 rounded-full border flex items-center overflow-hidden"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            <span
              data-active={lang === 'fi'}
              className="px-2.5 h-full flex items-center transition-colors"
              style={{
                background: lang === 'fi' ? 'var(--ink)' : 'transparent',
                color: lang === 'fi' ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              FI
            </span>
            <span
              data-active={lang === 'en'}
              className="px-2.5 h-full flex items-center transition-colors"
              style={{
                background: lang === 'en' ? 'var(--ink)' : 'transparent',
                color: lang === 'en' ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              EN
            </span>
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
