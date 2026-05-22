/**
 * PUTKI HQ — Shared email-gate component for Phase 2 mini-games · iter56
 *
 * Extracted from the quiz to avoid duplicating GDPR consent UX across
 * scenario + insight unlock flows. Mirrors the contract baked into the
 * backend `_unlock_for_game` helper: consent checkbox is mandatory,
 * email is validated, full personalized result returns from the server.
 */
import React, { useState } from 'react';
import { Trophy } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const ConsentEmailGate = ({ session, unlockPath, onUnlocked, headline, gameSlug = 'mini' }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!consent) { setError('Suostumus vaaditaan turnauksen rankaukseen.'); return; }
    if (!email.includes('@')) { setError('Anna kelvollinen sähköposti.'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${BACKEND}${unlockPath}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          play_id: session.play_id, anon_id: session.anon_id,
          email, name, consent: true,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      onUnlocked(await r.json());
    } catch (e2) {
      setError(`Tallennus epäonnistui: ${e2.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid={`${gameSlug}-email-gate`} style={{
      padding: 24, border: '2px solid var(--ink)', borderRadius: 6, background: 'var(--surface-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Trophy size={16} strokeWidth={1.8} style={{ color: 'var(--ink)' }} />
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}>
          AVAA TÄYDET TULOKSET · LIITY TURNAUKSEEN
        </span>
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {headline}
      </h2>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Annetulla sähköpostilla saat: täydellisen profiilin, viikon turnauspaikan, ja viikkokirjeen
        (4 viestiä/viikko: avajaiset, väliaika, sulkemisilmoitus, tulokset).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="sinun.sahkoposti@esimerkki.fi" data-testid={`${gameSlug}-email-input`}
          style={inputStyle} />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Etunimi (vapaaehtoinen — käytetään leaderboardissa)" data-testid={`${gameSlug}-name-input`}
          style={inputStyle} />
      </div>
      <label style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)',
        lineHeight: 1.5, marginBottom: 14, cursor: 'pointer',
      }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          data-testid={`${gameSlug}-consent-checkbox`} style={{ marginTop: 3, flexShrink: 0 }} />
        <span>
          Hyväksyn, että Putki HQ tallentaa sähköpostini ja pelin tuloksen voidakseen lähettää
          henkilökohtaiset tulokset ja viikoittaisen turnauksen päivitykset. Voin perua tilauksen
          koska tahansa.{' '}
          <a href="/tietosuoja" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            Tietosuojaseloste
          </a>.
        </span>
      </label>
      {error && <p style={{ color: '#C8423C', fontFamily: 'Georgia, serif', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
      <button type="submit" disabled={submitting} data-testid={`${gameSlug}-unlock-btn`} style={{
        padding: '14px 24px',
        background: 'var(--ink)', color: 'var(--bg)',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        width: '100%', opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? 'Tallennetaan…' : 'Avaa tulokset + Liity turnaukseen'}
      </button>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: 'var(--muted)', textAlign: 'center', margin: '10px 0 0' }}>
        Ei rahaa, ei kortteja, ei ostopakkoa. Voit perua koska tahansa.
      </p>
    </form>
  );
};

const inputStyle = {
  padding: '12px 14px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontFamily: 'inherit', fontSize: 15,
  background: 'var(--bg)', color: 'var(--ink)',
};
