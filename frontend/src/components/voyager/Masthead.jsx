/**
 * Voyager - fixed top strip / masthead.
 *
 * Mirrors the pattern used on /mestari. Sticky so /voyager always
 * feels like a Putki HQ surface even after the visitor scrolls.
 */
import React from 'react';
import { Link } from 'react-router-dom';

const Masthead = ({ lang }) => (
  <header data-testid="voyager-masthead" style={{
    position: 'sticky', top: 0, zIndex: 100,
    background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px',
    fontFamily: 'ui-monospace, monospace', fontSize: 11,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }}>
    <Link to="/" data-testid="voyager-masthead-home"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        textDecoration: 'none', color: 'var(--muted)', fontWeight: 700,
      }}>
      <span>←</span>
      <span style={{ color: 'var(--ink)', letterSpacing: '0.15em' }}>
        PUTKI<span style={{ color: 'var(--muted)', marginLeft: 4 }}>HQ</span>
      </span>
    </Link>
    <span style={{
      color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.16em',
    }}>
      {lang === 'en'
        ? 'VOYAGER · GAME OF THE WEEK'
        : 'VOYAGER · VIIKON PELI'}
    </span>
  </header>
);

export default Masthead;
