/**
 * SiteMasthead - the canonical PUTKI HQ chrome header.
 *
 * Iter97: unifies three previously-divergent headers (HomeV5 inline
 * masthead, the legacy `<Header />` with "PUTKI HQ" bold sans, and
 * MestariHub's bespoke "← PUTKI HQ" back-link). Used everywhere across
 * the public site so brand, nav and CTA stay consistent.
 *
 * Editorial newspaper aesthetic from the v5 mockup:
 *   • "Putki." serif wordmark with ember dot
 *   • Full nav: News / Streamers / Mittari / Diagnostic / Reviews / Method
 *   • Black "Get morning signals" CTA pill (-> /pelisignaalit)
 *   • Mobile (<900px): hamburger button opens a slide-down nav drawer
 *   • Always: bell · FI/EN toggle · theme toggle (right side controls)
 *
 * Active-route detection uses react-router's useLocation so the underline
 * tracks navigation automatically.
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, Sun, Moon } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { BellAlertManager } from './BellAlertManager';
import '../styles/site_masthead.css';

const NAV_ITEMS_FI = [
  { href: '/uutiset',     label: 'Uutiset',      match: /^\/uutiset/ },
  { href: '/striimaajat', label: 'Striimaajat',  match: /^\/striimaajat/ },
  { href: '/mittari',     label: 'Mittari',      match: /^\/mittari/ },
  { href: '/mestari',     label: 'Pelaajatesti', match: /^\/mestari/ },
  { href: '/kasinot',     label: 'Arvostelut',   match: /^\/kasinot|^\/arvostelut/ },
  { href: '/menetelma',   label: 'Menetelmä',    match: /^\/menetelma/ },
];
const NAV_ITEMS_EN = [
  { href: '/uutiset',     label: 'News',       match: /^\/uutiset/ },
  { href: '/striimaajat', label: 'Streamers',  match: /^\/striimaajat/ },
  { href: '/mittari',     label: 'Mittari',    match: /^\/mittari/ },
  { href: '/mestari',     label: 'Diagnostic', match: /^\/mestari/ },
  { href: '/kasinot',     label: 'Reviews',    match: /^\/kasinot|^\/arvostelut/ },
  { href: '/menetelma',   label: 'Method',     match: /^\/menetelma/ },
];

export const SiteMasthead = ({ forceLang }) => {
  const langCtx = useLang();
  const lang = (forceLang || langCtx?.lang || 'fi').toLowerCase();
  const toggleLang = langCtx?.toggle;
  const { theme, toggle: toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer when route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  const items = lang === 'en' ? NAV_ITEMS_EN : NAV_ITEMS_FI;
  const ctaLabel = lang === 'en' ? 'Get morning signals' : 'Tilaa aamun signaalit';

  return (
    <header className="site-mast" data-testid="site-masthead">
      <div className="site-mast-inner">
        <Link to="/" className="site-mast-brand" data-testid="site-masthead-brand" aria-label="PUTKI HQ">
          Putki<span className="site-mast-bdot">.</span>
        </Link>

        <nav className="site-mast-nav" data-testid="site-masthead-nav" aria-label="Primary">
          {items.map((it) => {
            const active = it.match.test(pathname);
            return (
              <Link
                key={it.href}
                to={it.href}
                className={active ? 'site-mast-active' : ''}
                data-testid={`site-masthead-nav-${it.label.toLowerCase()}`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="site-mast-controls">
          <Link
            to="/pelisignaalit"
            className="site-mast-cta"
            data-testid="site-masthead-cta"
          >
            <span className="site-mast-cta-label">{ctaLabel}</span>
            <ArrowRight size={14} />
          </Link>

          <div className="site-mast-icons">
            <BellAlertManager />
            <button
              type="button"
              onClick={toggleLang}
              className="site-mast-lang"
              data-testid="site-masthead-lang"
              aria-label="Toggle language"
              title={lang === 'fi' ? 'Switch to English' : 'Vaihda suomeksi'}
            >
              <span data-active={lang === 'fi'} className={lang === 'fi' ? 'on' : ''}>FI</span>
              <span data-active={lang === 'en'} className={lang === 'en' ? 'on' : ''}>EN</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="site-mast-theme"
              data-testid="site-masthead-theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} strokeWidth={1.6} /> : <Moon size={15} strokeWidth={1.6} />}
            </button>
          </div>

          <button
            type="button"
            className="site-mast-burger"
            onClick={() => setOpen((o) => !o)}
            data-testid="site-masthead-burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down drawer */}
      {open && (
        <div className="site-mast-drawer" data-testid="site-masthead-drawer">
          <nav>
            {items.map((it) => {
              const active = it.match.test(pathname);
              return (
                <Link
                  key={it.href}
                  to={it.href}
                  className={active ? 'site-mast-drawer-active' : ''}
                  data-testid={`site-masthead-drawer-${it.label.toLowerCase()}`}
                >
                  {it.label}
                </Link>
              );
            })}
            <Link
              to="/pelisignaalit"
              className="site-mast-drawer-cta"
              data-testid="site-masthead-drawer-cta"
            >
              {ctaLabel} <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteMasthead;
