import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="border-t border-subtle-border mt-24 sm:mt-32" data-testid="site-footer">
      <div className="container-wide py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-12">
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display font-black text-xl tracking-tighter text-ink">Mittari</span>
              <span className="font-display text-[10px] tracking-widest uppercase text-muted-text">.fi</span>
            </div>
            <p className="font-serif text-[13px] text-muted-text leading-relaxed">
              Suomen rehellisin kasino- ja striimaajalähde. Toimituksellinen, ei mainos.
            </p>
          </div>
          <div>
            <div className="eyebrow mb-3">Sivut</div>
            <ul className="space-y-2 font-display text-[13px]">
              <li><Link to="/kasinot" className="text-ink hover:text-brand-blue">Kasinot</Link></li>
              <li><Link to="/striimaajat" className="text-ink hover:text-brand-blue">Striimaajat</Link></li>
              <li><Link to="/viikon-kortti" className="text-ink hover:text-brand-blue">Topin viikon kortti</Link></li>
              <li><Link to="/menetelma" className="text-ink hover:text-brand-blue">Mittari-menetelmä</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Vastuullisuus</div>
            <ul className="space-y-2 font-display text-[13px]">
              <li><a href="https://www.peluuri.fi" target="_blank" rel="noreferrer" className="text-ink hover:text-brand-blue">Peluuri</a></li>
              <li><a href="https://www.peli-poikki.fi" target="_blank" rel="noreferrer" className="text-ink hover:text-brand-blue">Peli poikki</a></li>
              <li><span className="text-muted-text">18+ vain täysi-ikäisille</span></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Toimitus</div>
            <ul className="space-y-2 font-display text-[13px]">
              <li><Link to="/menetelma" className="text-ink hover:text-brand-blue">Arviointimenetelmä</Link></li>
              <li><span className="text-muted-text">Tietosuoja</span></li>
              <li><span className="text-muted-text">Käyttöehdot</span></li>
              <li><span className="text-muted-text">Affiliaatti-ilmoitus</span></li>
            </ul>
          </div>
        </div>

        <div className="section-rule mt-10 pt-6 flex flex-col sm:flex-row justify-between gap-3 text-[12px] font-display text-muted-text">
          <span>© {new Date().getFullYear()} Mittari.fi — Riippumaton toimitus.</span>
          <span>Rahapelaaminen voi olla addiktoivaa. Pelaa vastuullisesti.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
