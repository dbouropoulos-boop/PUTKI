import React from 'react';
import { Link } from 'react-router-dom';
import Dial from './Dial';

export const Footer = () => {
  return (
    <footer className="border-t mt-24 sm:mt-32" style={{ borderColor: 'var(--border)' }} data-testid="site-footer">
      {/* BRAND MOMENT */}
      <div className="container-wide pt-14 sm:pt-20 pb-10 flex flex-col items-center text-center">
        <div className="cockpit-divider w-32 mb-10" />
        <div className="opacity-90 mb-5">
          <Dial size="small" state="KUUMA" showLabel={false} />
        </div>
        <p
          className="display"
          style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--muted)', maxWidth: 480 }}
          data-testid="footer-tagline"
        >
          Mittari mittaa. Toimitus tulkitsee. Sinä päätät.
        </p>
        <div className="cockpit-divider w-32 mt-10" />
      </div>

      {/* COLUMNS */}
      <div className="container-wide pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-12">
          <div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display font-black text-xl tracking-tighter" style={{ color: 'var(--ink)' }}>Mittari</span>
              <span className="mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>.fi</span>
            </div>
            <p className="font-serif text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              Suomen rehellisin kasino- ja striimaajalähde. Toimituksellinen, ei mainos.
            </p>
          </div>
          <div>
            <div className="eyebrow mb-3">Sivut</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><Link to="/kasinot" style={{ color: 'var(--ink)' }} className="hover:opacity-70">KASINOT</Link></li>
              <li><Link to="/striimaajat" style={{ color: 'var(--ink)' }} className="hover:opacity-70">STRIIMAAJAT</Link></li>
              <li><Link to="/viikon-kortti" style={{ color: 'var(--ink)' }} className="hover:opacity-70">VIIKON KORTTI</Link></li>
              <li><Link to="/menetelma" style={{ color: 'var(--ink)' }} className="hover:opacity-70">MENETELMÄ</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Vastuullisuus</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><a href="https://www.peluuri.fi" target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }} className="hover:opacity-70">PELUURI</a></li>
              <li><a href="https://www.peli-poikki.fi" target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }} className="hover:opacity-70">PELI POIKKI</a></li>
              <li><span style={{ color: 'var(--muted)' }}>18+ VAIN</span></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Toimitus</div>
            <ul className="space-y-2 mono text-[12px]" style={{ letterSpacing: '0.08em' }}>
              <li><Link to="/menetelma" style={{ color: 'var(--ink)' }} className="hover:opacity-70">ARVIOINTIMENETELMÄ</Link></li>
              <li><span style={{ color: 'var(--muted)' }}>TIETOSUOJA</span></li>
              <li><span style={{ color: 'var(--muted)' }}>KÄYTTÖEHDOT</span></li>
              <li><span style={{ color: 'var(--muted)' }}>AFFILIAATTI-ILMOITUS</span></li>
            </ul>
          </div>
        </div>

        <div className="section-rule mt-10 pt-6 flex flex-col sm:flex-row justify-between gap-3 mono text-[10.5px]" style={{ letterSpacing: '0.12em', color: 'var(--muted)' }}>
          <span>© {new Date().getFullYear()} MITTARI.FI · RIIPPUMATON TOIMITUS</span>
          <span>RAHAPELAAMINEN VOI OLLA ADDIKTOIVAA · PELAA VASTUULLISESTI</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
