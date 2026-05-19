/**
 * PUTKI HQ — VoitaKiitos (confirmation page).
 *
 * Renders ONLY when an entry was just submitted (sessionStorage holds
 * the entry token). Direct hits without a session token redirect to
 * /voita.
 *
 * The marketing opt-in is rendered via the separate
 * RafflePostEntryPreferences component — explicitly NOT bundled with
 * the entry-form submission.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import RafflePostEntryPreferences from '../components/RafflePostEntryPreferences';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const VoitaKiitos = () => {
  const { lang } = useLang();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [raffle, setRaffle] = useState(null);

  useEffect(() => {
    let stop = false;
    try {
      const raw = sessionStorage.getItem(`voita:${slug}:entry`);
      if (!raw) {
        // No entry token — bounce back to /voita
        navigate('/voita', { replace: true });
        return;
      }
      const parsed = JSON.parse(raw);
      if (!stop) setEntry(parsed);
    } catch {
      navigate('/voita', { replace: true });
      return;
    }
    fetch(`${BACKEND}/api/voita/raffles/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop) setRaffle(d); })
      .catch(() => { /* keep null */ });
    return () => { stop = true; };
  }, [slug, navigate]);

  if (!entry) return null;

  return (
    <div data-testid="voita-kiitos-page" style={{
      maxWidth: 720, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/voita" data-testid="voita-back-link" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← VOITA</Link>

      {/* Confirmation block */}
      <section data-testid="voita-confirmed" style={{
        marginTop: 20, padding: '22px 22px',
        border: '1px solid #2b5a3e', background: '#0e2b1a',
      }}>
        <div style={{
          color: '#9ad4a9', fontFamily: 'ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.24em', fontWeight: 700,
        }}>{lang === 'en' ? 'CONFIRMED ✓' : 'VAHVISTETTU ✓'}</div>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 30,
          color: '#FFFFFF', margin: '8px 0 8px', letterSpacing: '-0.01em',
        }}>{lang === 'en' ? 'Your entry is in.' : 'Osallistumisesi on rekisteröity.'}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#cfd9d3', margin: 0 }}>
          {lang === 'en'
            ? `Results will be announced to all entrants by email after the match. Your pick: `
            : 'Tulokset ilmoitetaan kaikille osallistujille sähköpostilla ottelun jälkeen. Veikkauksesi: '}
          <strong style={{ color: '#FFFFFF' }}>{entry.prediction}</strong>
          {' · '}
          <strong style={{ color: '#FFFFFF' }}>{entry.home}–{entry.away}</strong>
        </p>
      </section>

      {/* Match meta */}
      {raffle && (
        <div data-testid="voita-kiitos-match" style={{
          marginTop: 18, padding: '14px 22px',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.04em',
          color: 'var(--ink)',
        }}>
          {(raffle.sport || '').toUpperCase()} {raffle.league ? `· ${raffle.league.toUpperCase()}` : ''} · {raffle.home_team} vs {raffle.away_team}
        </div>
      )}

      {/* Optional marketing preferences — separate from entry */}
      <RafflePostEntryPreferences
        defaultEmail={entry.email || ''}
        onSaved={() => { /* keep user on the page, they see "saved" pill */ }}
        onSkip={() => navigate('/voita', { replace: true })}
      />

      <p style={{
        marginTop: 24, fontSize: 11, color: 'var(--muted)',
        fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', lineHeight: 1.7,
      }}>
        {lang === 'en' ? 'Read the ' : 'Lue '}
        <Link to="/voita/saannot" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
          {lang === 'en' ? 'rules' : 'säännöt'}
        </Link>
        {lang === 'en'
          ? ' or come back to ' : ' tai palaa '}
        <Link to="/voita" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>/voita</Link>
        {lang === 'en' ? '.' : '.'}
      </p>
    </div>
  );
};

export default VoitaKiitos;
