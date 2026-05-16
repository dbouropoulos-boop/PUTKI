import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const navLinks = [
  { to: '/kasinot',       label: 'Kasinot' },
  { to: '/striimaajat',   label: 'Striimaajat' },
  { to: '/viikon-kortti', label: 'Viikon kortti' },
  { to: '/peli',          label: 'Peli' },
  { to: '/menetelma',     label: 'Menetelmä' },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{ background: 'color-mix(in oklab, var(--bg) 88%, transparent)', borderColor: 'var(--border)' }}
      data-testid="site-header"
    >
      <div className="container-wide flex items-center justify-between h-16">
        <Link to="/" className="flex items-baseline gap-2" data-testid="logo-link">
          <span className="font-display font-black text-2xl tracking-tighter" style={{ color: 'var(--ink)' }}>Mittari</span>
          <span className="mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>.fi</span>
        </Link>

        <div className="hidden md:flex items-center gap-7">
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
          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label="Vaihda teema"
            data-testid="theme-toggle"
            className="ml-2 w-9 h-9 rounded-full border flex items-center justify-center transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink)' }}
          >
            {theme === 'dark' ? <Sun strokeWidth={1.5} size={16} /> : <Moon strokeWidth={1.5} size={16} />}
          </button>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Vaihda teema"
            data-testid="theme-toggle-mobile"
            className="p-2"
            style={{ color: 'var(--ink)' }}
          >
            {theme === 'dark' ? <Sun strokeWidth={1.5} size={18} /> : <Moon strokeWidth={1.5} size={18} />}
          </button>
          <button
            aria-label="Avaa valikko"
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
