import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';

export const Header = () => {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { lang, toggle: toggleLang, t } = useLang();

  // Pre-launch polish: CASINOS + VOITA PALKINTO (Voyager) hidden from nav
  // per user spec. Routes remain so deep-links still resolve. CasinoRanking
  // also carries a robots:noindex meta tag during this window.
  // Finnish-only labels per Dioni's strategy reset — t() not used here to
  // avoid English keys leaking in via the language toggle.
  const navLinks = [
    { to: '/uutiset',         label: 'UUTISET' },
    { to: '/striimaajat',     label: 'STRIIMAAJAT' },
    { to: '/viikon-kortti',   label: 'VIIKON KORTTI' },
    { to: '/peli',            label: 'PELI · VOITA 500 €' },
    { to: '/menetelma',       label: 'MENETELMÄ' },
    { to: '/tietoa-meista',   label: 'TIETOA' },
  ];

  return (
    <header
      className="sticky z-40 border-b backdrop-blur-md"
      style={{ top: 30, background: 'color-mix(in oklab, var(--bg) 88%, transparent)', borderColor: 'var(--border)' }}
      data-testid="site-header"
    >
      <div className="container-wide flex items-center justify-between h-16">
        <Link to="/" className="flex items-baseline gap-2" data-testid="logo-link">
          <span className="font-display font-black text-2xl tracking-tighter" style={{ color: 'var(--ink)' }}>PUTKI</span>
          <span className="mono text-[11px] tracking-[0.22em] uppercase" style={{ color: 'var(--muted)' }}>HQ</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.to.replace('/', '')}`}
              className={({ isActive }) =>
                `mono text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors duration-200 ${
                  isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                }`
              }
              style={({ isActive }) => ({ color: isActive ? 'var(--brand-blue)' : 'var(--ink)' })}
            >
              {l.label}
            </NavLink>
          ))}
          {/* Language toggle hidden during Finnish-only launch.
              Theme toggle remains visible. */}
          {/* Theme toggle */}
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

        <div className="md:hidden flex items-center gap-1">
          {/* Mobile lang toggle hidden during Finnish-only launch. */}
          <button
            onClick={toggle}
            aria-label={t('common.theme_toggle')}
            data-testid="theme-toggle-mobile"
            className="p-2"
            style={{ color: 'var(--ink)' }}
          >
            {theme === 'dark' ? <Sun strokeWidth={1.5} size={18} /> : <Moon strokeWidth={1.5} size={18} />}
          </button>
          <button
            aria-label={t('common.menu_open')}
            className="p-2 -mr-2"
            onClick={() => setOpen((v) => !v)}
            data-testid="mobile-menu-toggle"
            style={{ color: 'var(--ink)' }}
          >
            {open ? <X strokeWidth={1.5} size={22} /> : <Menu strokeWidth={1.5} size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <nav className="container-wide py-4 flex flex-col gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={`mobile-nav-link-${l.to.replace('/', '')}`}
                onClick={() => setOpen(false)}
                className="mono text-[12px] font-semibold tracking-[0.16em] uppercase py-3"
                style={{ color: 'var(--ink)' }}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
