import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { to: '/', label: 'Mittari' },
  { to: '/kasinot', label: 'Kasinot' },
  { to: '/striimaajat', label: 'Striimaajat' },
  { to: '/viikon-kortti', label: 'Viikon kortti' },
  { to: '/peli', label: 'Peli' },
  { to: '/menetelma', label: 'Menetelmä' },
];

export const Header = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-sm border-b border-subtle-border" data-testid="site-header">
      <div className="container-wide flex items-center justify-between h-16">
        <Link to="/" className="flex items-baseline gap-2" data-testid="logo-link">
          <span className="font-display font-black text-2xl tracking-tighter text-ink">Mittari</span>
          <span className="font-display text-xs tracking-widest uppercase text-muted-text">.fi</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.slice(1).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.to.replace('/', '') || 'home'}`}
              className={({ isActive }) =>
                `font-display text-[13px] font-semibold tracking-wide uppercase transition-colors duration-200 ${
                  isActive ? 'text-brand-blue' : 'text-ink hover:text-brand-blue'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile toggle */}
        <button
          aria-label="Avaa valikko"
          className="md:hidden p-2 -mr-2"
          onClick={() => setOpen((v) => !v)}
          data-testid="mobile-menu-toggle"
        >
          {open ? <X strokeWidth={1.5} size={22} /> : <Menu strokeWidth={1.5} size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-subtle-border bg-paper">
          <nav className="container-wide py-4 flex flex-col gap-1">
            {navLinks.slice(1).map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={`mobile-nav-link-${l.to.replace('/', '') || 'home'}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `font-display text-base font-semibold tracking-tight py-3 ${
                    isActive ? 'text-brand-blue' : 'text-ink'
                  }`
                }
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
