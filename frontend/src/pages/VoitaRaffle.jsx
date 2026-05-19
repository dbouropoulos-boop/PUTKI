/**
 * PUTKI HQ — VoitaRaffle (Step 1: entry form).
 *
 * GDPR Art. 7(4) compliance: this form captures the minimum required
 * to administer the contest. ZERO marketing consent is bundled here.
 * The "Olen lukenut ja hyväksyn säännöt" checkbox is mandatory and is
 * a participation prerequisite, NOT a marketing consent.
 *
 * Email captured here is stored under legitimate-interest basis
 * (contest administration), separate record from any marketing
 * opt-in the user may give on the /kiitos page.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const VoitaRaffle = () => {
  const { lang } = useLang();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [raffle, setRaffle] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  // Form state
  const [prediction, setPrediction] = useState('');
  const [homeGoals, setHomeGoals] = useState('');
  const [awayGoals, setAwayGoals] = useState('');
  const [email, setEmail] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/voita/raffles/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setRaffle(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [slug]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!prediction) { setServerError(lang === 'en' ? 'Pick 1, X or 2.' : 'Valitse 1, X tai 2.'); return; }
    if (homeGoals === '' || awayGoals === '') { setServerError(lang === 'en' ? 'Predict the score.' : 'Ennusta lopputulos.'); return; }
    if (!email) { setServerError(lang === 'en' ? 'Email is required.' : 'Sähköposti vaaditaan.'); return; }
    if (!rulesAccepted) { setServerError(lang === 'en' ? 'You must accept the rules to enter.' : 'Sinun on hyväksyttävä säännöt voidaksesi osallistua.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/voita/raffles/${slug}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          prediction_one_x_two: prediction,
          predicted_home_goals: Number(homeGoals),
          predicted_away_goals: Number(awayGoals),
          rules_accepted: true,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setServerError(j.detail || `HTTP ${r.status}`);
        return;
      }
      // Store the entry's email in sessionStorage so /kiitos can pre-fill
      // any optional marketing opt-in — user can still freely choose to
      // give a different address (or none).
      try {
        sessionStorage.setItem(`voita:${slug}:entry`, JSON.stringify({
          email, entry_id: j.entry_id, prediction, home: homeGoals, away: awayGoals,
        }));
      } catch { /* storage quota / private mode — non-blocking */ }
      navigate(`/voita/${slug}/kiitos`);
    } catch (err) {
      setServerError(err.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return <div data-testid="voita-raffle-loading" style={{ padding: 64, color: 'var(--muted)', textAlign: 'center' }}>…</div>;
  }
  if (!raffle) {
    return (
      <div data-testid="voita-raffle-not-found" style={{ maxWidth: 720, margin: '64px auto', padding: '0 32px', color: 'var(--ink)' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32 }}>{lang === 'en' ? 'Raffle not found' : 'Arvontaa ei löydy'}</h1>
        <p style={{ color: 'var(--muted)' }}><Link to="/voita" style={{ color: 'var(--ink)' }}>← Voita</Link></p>
      </div>
    );
  }

  const title = lang === 'en' ? (raffle.title_en || raffle.title_fi) : (raffle.title_fi || raffle.title_en);
  const summary = lang === 'en' ? (raffle.summary_en || raffle.summary_fi) : (raffle.summary_fi || raffle.summary_en);

  return (
    <div data-testid="voita-raffle-page" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)' }}>
      <Link to="/voita" data-testid="voita-back-link" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← VOITA</Link>

      <h1 data-testid="voita-raffle-title" style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36, color: '#FFFFFF',
        margin: '20px 0 6px', letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>{raffle.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {raffle.away_team}</h1>
      <div style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', marginBottom: 18 }}>
        {(raffle.sport || '').toUpperCase()} {raffle.league ? `· ${raffle.league.toUpperCase()}` : ''}
        {title ? <span style={{ marginLeft: 12, color: '#FFFFFF', textTransform: 'none', letterSpacing: 0, fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic' }}>· {title}</span> : null}
      </div>
      {summary && <p style={{ color: 'var(--ink)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{summary}</p>}

      <form onSubmit={onSubmit} data-testid="voita-entry-form" style={{
        display: 'grid', gap: 18,
        padding: '24px 22px',
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}>
        {/* 1-X-2 */}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
            {lang === 'en' ? '01 · PICK THE WINNER · 1 / X / 2' : '01 · ARVAA VOITTAJA · 1 / X / 2'}
          </legend>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1', 'X', '2'].map((v) => (
              <label key={v} data-testid={`voita-pick-${v.toLowerCase()}`}
                style={{
                  flex: 1, padding: '14px 0', textAlign: 'center', cursor: 'pointer',
                  background: prediction === v ? '#FFFFFF' : 'var(--bg, #0B0A09)',
                  color: prediction === v ? '#0B0A09' : 'var(--ink)',
                  border: `1px solid ${prediction === v ? '#FFFFFF' : 'var(--border-strong, #3A332E)'}`,
                  fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700,
                }}>
                <input type="radio" name="prediction" value={v}
                  checked={prediction === v} onChange={(e) => setPrediction(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                {v === '1' ? `${raffle.home_team || '1'}` : v === '2' ? `${raffle.away_team || '2'}` : 'X'}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Closest score */}
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
            {lang === 'en' ? '02 · PREDICT THE SCORE' : '02 · ENNUSTA LOPPUTULOS'}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input data-testid="voita-home-goals" type="number" min={0} max={50} value={homeGoals}
              onChange={(e) => setHomeGoals(e.target.value)}
              placeholder={raffle.home_team || 'Home'}
              style={{ flex: 1, background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '12px 14px', fontFamily: 'Georgia, serif', fontSize: 22, textAlign: 'center' }} />
            <span style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>—</span>
            <input data-testid="voita-away-goals" type="number" min={0} max={50} value={awayGoals}
              onChange={(e) => setAwayGoals(e.target.value)}
              placeholder={raffle.away_team || 'Away'}
              style={{ flex: 1, background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '12px 14px', fontFamily: 'Georgia, serif', fontSize: 22, textAlign: 'center' }} />
          </div>
        </div>

        {/* Email */}
        <label>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
            {lang === 'en' ? '03 · EMAIL (FOR WINNER NOTIFICATION)' : '03 · SÄHKÖPOSTI (VOITTAJAN ILMOITUSTA VARTEN)'}
          </div>
          <input data-testid="voita-email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
            {lang === 'en'
              ? "Used only to notify winners and announce results. Stored under the legitimate-interest basis until 30 days after the match."
              : 'Käytetään vain voittajien ilmoittamiseen ja tulosten julkistamiseen. Tallennetaan oikeutetun edun perusteella 30 päivää ottelun jälkeen.'}
          </div>
        </label>

        {/* Rules acceptance — mandatory */}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input data-testid="voita-rules-accepted" type="checkbox" checked={rulesAccepted}
            onChange={(e) => setRulesAccepted(e.target.checked)}
            style={{ marginTop: 3, flex: '0 0 18px', width: 18, height: 18, accentColor: '#6FA37D' }} />
          <span style={{ color: 'var(--ink)', fontSize: 13, lineHeight: 1.55 }}>
            {lang === 'en' ? 'I have read and accept the ' : 'Olen lukenut ja hyväksyn '}
            <Link to="/voita/saannot" target="_blank" rel="noopener" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
              {lang === 'en' ? 'raffle rules' : 'arvonnan säännöt'}
            </Link>.
          </span>
        </label>

        {serverError && <div data-testid="voita-form-error" style={{
          padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12,
        }}>{serverError}</div>}

        <button type="submit" disabled={busy} data-testid="voita-submit"
          style={{
            padding: '14px 22px', background: '#FFFFFF', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.20em',
            fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>
          {busy ? (lang === 'en' ? 'SUBMITTING…' : 'LÄHETETÄÄN…') : (lang === 'en' ? 'ENTER →' : 'OSALLISTU →')}
        </button>
      </form>
    </div>
  );
};

export default VoitaRaffle;
