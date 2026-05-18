/**
 * PhaseOneDiscoveryRow — temporary discovery bar.
 *
 * Phase 1 ships with no nav menu in the top bar by design. Until the
 * Phase 2 "Explore" section lands, this low-contrast row above the
 * footer bridges the discovery gap.
 *
 * REMOVE THIS COMPONENT when Phase 2 Explore ships.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const PhaseOneDiscoveryRow = () => {
  const { lang } = useLang();
  const label = lang === 'en' ? 'Read more:' : 'Lue lisää:';
  const links = lang === 'en'
    ? [
        { to: '/uutiset',       text: 'News' },
        { to: '/vihjeet',       text: 'Tips' },
        { to: '/tietoa-meista', text: 'About' },
        { to: '/menetelma',     text: 'Method' },
      ]
    : [
        { to: '/uutiset',       text: 'Uutiset' },
        { to: '/vihjeet',       text: 'Vinkit' },
        { to: '/tietoa-meista', text: 'Tietoa meistä' },
        { to: '/menetelma',     text: 'Menetelmä' },
      ];

  return (
    <div
      className="border-t border-b"
      data-testid="phase-one-discovery-row"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
      }}
    >
      <div className="container-wide py-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span
          className="mono"
          style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}
        >
          {label.toUpperCase()}
        </span>
        {links.map((l, i) => (
          <React.Fragment key={l.to}>
            <Link
              to={l.to}
              data-testid={`discovery-link-${l.to.slice(1)}`}
              className="mono hover:opacity-100"
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                color: 'var(--ink)',
                fontWeight: 700,
                textTransform: 'uppercase',
                opacity: 0.75,
                textDecoration: 'none',
              }}
            >
              {l.text}
            </Link>
            {i < links.length - 1 && (
              <span style={{ color: 'var(--border-strong)' }}>·</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default PhaseOneDiscoveryRow;
