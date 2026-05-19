/**
 * PUTKI HQ — VoitaRaffle (Step 1: entry form).
 *
 * Editorial brief: super-clear funnel. Plain Finnish/English copy,
 * step labels visible as the user scrolls, no jargon. The most
 * important goal is that the visitor gives us their email +
 * (optionally) their phone or Telegram so we can notify winners
 * fast. Everything below is built around that.
 *
 * GDPR Art. 7(4) compliance: this form captures ONLY the data
 * required to administer the contest. Zero marketing consent is
 * bundled here. The rules checkbox is mandatory participation
 * prerequisite, NOT a marketing consent.
 *
 * Live urgency strip: real entry count + countdown to kickoff +
 * the "winners paid 48h" operational commitment.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import RecentWinnersStrip from '../components/RecentWinnersStrip';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Refresh entry count + countdown every 30s.
const REFRESH_MS = 30 * 1000;

const fmtCountdown = (msRemaining, lang) => {
  if (msRemaining <= 0) return null;
  const totalMin = Math.floor(msRemaining / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m`;
};


const UrgencyStrip = ({ raffle, lang }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);
  const kickoffMs = useMemo(() => {
    try { return new Date(raffle.kickoff_at).getTime(); } catch { return 0; }
  }, [raffle.kickoff_at]);
  const remaining = kickoffMs - now;
  const countdown = fmtCountdown(remaining, lang);
  const entryCount = raffle.entries_count || 0;
  const closed = remaining <= 0;

  if (closed) {
    return (
      <div data-testid="voita-urgency-strip" data-state="closed" style={{
        padding: '10px 14px', marginBottom: 16,
        background: 'var(--bg)', border: '1px dashed var(--border-strong)',
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
        letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 700,
      }}>
        {lang === 'en'
          ? `ENTRY CLOSED · DRAW HAPPENS AFTER THE MATCH · WINNER PAID WITHIN 48h`
          : `VEIKKAUS SULJETTU · ARVONTA OTTELUN JÄLKEEN · VOITTAJA MAKSETTU 48h SISÄLLÄ`}
      </div>
    );
  }

  return (
    <div data-testid="voita-urgency-strip" data-state="open" style={{
      padding: '11px 14px', marginBottom: 16,
      background: '#0e1a14', border: '1px solid #2b5a3e',
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.14em', color: '#9ad4a9', fontWeight: 700,
      display: 'flex', flexWrap: 'wrap', gap: '4px 18px',
    }}>
      <span data-testid="voita-urgency-live" style={{ color: '#6FA37D' }}>● {lang === 'en' ? 'LIVE' : 'LIVE'}</span>
      <span data-testid="voita-urgency-count">
        {entryCount} {lang === 'en' ? 'ENTRIES' : 'OSALLISTUNUT'}
      </span>
      <span style={{ color: 'var(--muted)' }}>·</span>
      <span data-testid="voita-urgency-countdown">
        {lang === 'en' ? 'CLOSES IN ' : 'SULKEUTUU '}{countdown}
      </span>
      <span style={{ color: 'var(--muted)' }}>·</span>
      <span data-testid="voita-urgency-payout" style={{ color: '#E8C26E' }}>
        {lang === 'en' ? 'WINNERS PAID WITHIN 48h' : 'VOITTAJA MAKSETTU 48h SISÄLLÄ'}
      </span>
    </div>
  );
};


// Three-step "how it works" explainer rendered BEFORE the form.
const HowItWorks = ({ lang }) => {
  const steps = lang === 'en' ? [
    { n: '1', t: 'Pick the winner', d: 'Choose who wins the match — home, draw, or away.' },
    { n: '2', t: 'Predict the score', d: 'Closest score wins. Tie-broken by exact goals, then goal difference.' },
    { n: '3', t: 'Leave your email', d: 'We only contact you if you win. No marketing. Stored 30 days.' },
  ] : [
    { n: '1', t: 'Arvaa voittaja', d: 'Valitse kuka voittaa ottelun — kotijoukkue, tasapeli vai vieras.' },
    { n: '2', t: 'Ennusta lopputulos', d: 'Lähimmäs osunut voittaa. Tasatilanne ratkaistaan tarkalla maalimäärällä.' },
    { n: '3', t: 'Jätä sähköpostisi', d: 'Otamme yhteyttä vain jos voitat. Ei markkinointia. Säilytetään 30 päivää.' },
  ];
  return (
    <div data-testid="voita-how-it-works" style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
      marginBottom: 22,
    }}>
      {steps.map((s) => (
        <div key={s.n} style={{
          padding: '14px 16px', background: 'var(--surface)',
          border: '1px solid var(--hairline)',
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700,
            marginBottom: 6,
          }}>{lang === 'en' ? 'STEP' : 'VAIHE'} {s.n}</div>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700,
            color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em',
          }}>{s.t}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>{s.d}</div>
        </div>
      ))}
    </div>
  );
};


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
  const [contactMethod, setContactMethod] = useState('email_only'); // email_only | phone | telegram
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);

  // Refresh raffle data so entry count + countdown move while user
  // is on the page. Doesn't reset form state.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/voita/raffles/${slug}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancelled) { setRaffle(d); setLoaded(true); } })
        .catch(() => { if (!cancelled) setLoaded(true); });
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
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
      const body = {
        email,
        prediction_one_x_two: prediction,
        predicted_home_goals: Number(homeGoals),
        predicted_away_goals: Number(awayGoals),
        rules_accepted: true,
        display_name: (displayName || '').trim(),
      };
      // Optional fast-contact preferences are captured for our own
      // operational use (winner notification routing). Stored in
      // sessionStorage so /kiitos can convert them into separate
      // marketing-consent rows if the user opts in there.
      const r = await fetch(`${BACKEND}/api/voita/raffles/${slug}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setServerError(j.detail || `HTTP ${r.status}`);
        return;
      }
      try {
        sessionStorage.setItem(`voita:${slug}:entry`, JSON.stringify({
          email, entry_id: j.entry_id, prediction,
          home: homeGoals, away: awayGoals,
          position: j.position,
          contact_method: contactMethod,
          phone: contactMethod === 'phone' ? phone : '',
          telegram: contactMethod === 'telegram' ? telegram : '',
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
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36, color: 'var(--ink)',
        margin: '20px 0 6px', letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>{raffle.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {raffle.away_team}</h1>
      <div style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', marginBottom: 18 }}>
        {(raffle.sport || '').toUpperCase()} {raffle.league ? `· ${raffle.league.toUpperCase()}` : ''}
        {title ? <span style={{ marginLeft: 12, color: 'var(--ink)', textTransform: 'none', letterSpacing: 0, fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic' }}>· {title}</span> : null}
      </div>
      {summary && <p style={{ color: 'var(--ink)', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>{summary}</p>}

      {/* Live urgency strip — entry count + countdown + payout commitment */}
      <UrgencyStrip raffle={raffle} lang={lang} />

      {/* Trust strip — only renders when ≥1 paid raffle exists. */}
      <RecentWinnersStrip />

      {/* How it works — 3 plain-language steps */}
      <HowItWorks lang={lang} />

      <form onSubmit={onSubmit} data-testid="voita-entry-form" style={{
        display: 'grid', gap: 22,
        padding: '24px 22px',
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
      }}>
        {/* 1-X-2 */}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: '#E8C26E', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'STEP 1 · WHO WINS?' : 'VAIHE 1 · KUKA VOITTAA?'}
          </legend>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
            {lang === 'en' ? 'Tap one — home team, draw, or away team.' : 'Napauta yhtä — kotijoukkue, tasapeli tai vieras.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: '1', label: raffle.home_team || '1', sub: lang === 'en' ? 'Home' : 'Koti' },
              { v: 'X', label: 'X', sub: lang === 'en' ? 'Draw' : 'Tasapeli' },
              { v: '2', label: raffle.away_team || '2', sub: lang === 'en' ? 'Away' : 'Vieras' },
            ].map((opt) => {
              const active = prediction === opt.v;
              return (
                <label key={opt.v} data-testid={`voita-pick-${opt.v.toLowerCase()}`}
                  style={{
                    flex: 1, padding: '14px 6px', textAlign: 'center', cursor: 'pointer',
                    background: active ? 'var(--ink)' : 'var(--bg, #0B0A09)',
                    color: active ? 'var(--bg)' : 'var(--ink)',
                    border: `1px solid ${active ? 'var(--ink)' : 'var(--border-strong, #3A332E)'}`,
                    transition: 'background 120ms, color 120ms',
                  }}>
                  <input type="radio" name="prediction" value={opt.v}
                    checked={active} onChange={(e) => setPrediction(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{opt.label}</div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em',
                    opacity: active ? 0.7 : 0.55, marginTop: 4,
                  }}>{opt.sub.toUpperCase()}</div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Closest score */}
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: '#E8C26E', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'STEP 2 · WHAT\'S THE SCORE?' : 'VAIHE 2 · MIKÄ ON LOPPUTULOS?'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
            {lang === 'en' ? 'Enter the goals you think each team will score.' : 'Syötä montako maalia kumpikin tekee.'}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 4, textAlign: 'center' }}>
                {(raffle.home_team || 'HOME').toUpperCase()}
              </div>
              <input data-testid="voita-home-goals" type="number" min={0} max={50} value={homeGoals}
                onChange={(e) => setHomeGoals(e.target.value)}
                placeholder="0"
                style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '14px 14px', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, textAlign: 'center' }} />
            </div>
            <span style={{ color: 'var(--muted)', fontFamily: 'Georgia, serif', fontSize: 24, marginTop: 22 }}>—</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 4, textAlign: 'center' }}>
                {(raffle.away_team || 'AWAY').toUpperCase()}
              </div>
              <input data-testid="voita-away-goals" type="number" min={0} max={50} value={awayGoals}
                onChange={(e) => setAwayGoals(e.target.value)}
                placeholder="0"
                style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '14px 14px', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, textAlign: 'center' }} />
            </div>
          </div>
        </div>

        {/* Email */}
        <label>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: '#E8C26E', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'STEP 3 · YOUR EMAIL' : 'VAIHE 3 · SÄHKÖPOSTIOSOITTEESI'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
            {lang === 'en'
              ? 'We use this only to tell you the result and notify you if you win.'
              : 'Käytämme tätä vain tuloksen ja voiton ilmoittamiseen.'}
          </div>
          <input data-testid="voita-email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="esim. matti@gmail.com"
            style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '14px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
        </label>

        {/* Optional fast-contact — phone or Telegram. Recommended, not required. */}
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'STEP 4 · FAST CONTACT (OPTIONAL)' : 'VAIHE 4 · NOPEA YHTEYS (VAPAAEHTOINEN)'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
            {lang === 'en'
              ? 'Give us a fast way to reach you if you win. Recommended but not required.'
              : 'Anna meille nopea tapa tavoittaa sinut jos voitat. Suositeltu mutta ei pakollinen.'}
          </div>
          <select data-testid="voita-contact-method"
            value={contactMethod} onChange={(e) => setContactMethod(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg)', color: 'var(--ink)',
              border: '1px solid var(--border-strong)', padding: '12px 14px',
              fontFamily: 'inherit', fontSize: 14, marginBottom: 10,
            }}>
            <option value="email_only">{lang === 'en' ? 'Email is enough — skip this' : 'Sähköposti riittää — ohita tämä'}</option>
            <option value="phone">{lang === 'en' ? 'Phone number (SMS / call)' : 'Puhelinnumero (SMS / soitto)'}</option>
            <option value="telegram">{lang === 'en' ? 'Telegram @username' : 'Telegram @käyttäjänimi'}</option>
          </select>
          {contactMethod === 'phone' && (
            <input data-testid="voita-phone" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+358 40 123 4567"
              style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
          )}
          {contactMethod === 'telegram' && (
            <input data-testid="voita-telegram" type="text" value={telegram}
              onChange={(e) => setTelegram(e.target.value.replace(/^@?/, '@'))}
              placeholder="@username"
              style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
          )}
        </div>

        {/* Optional display name */}
        <label>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'STEP 5 · DISPLAY NAME (OPTIONAL)' : 'VAIHE 5 · NÄYTTÖNIMI (VAPAAEHTOINEN)'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
            {lang === 'en'
              ? 'How you appear on the public winners list if you win. Leave blank to show only a masked email.'
              : 'Miten näyt julkisella voittajalistalla. Jos jätät tyhjäksi, sähköposti näytetään peitettynä.'}
          </div>
          <input data-testid="voita-display-name" type="text" maxLength={40}
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder={lang === 'en' ? 'e.g. Mikko H. or @nickname' : 'esim. Mikko H. tai @nimimerkki'}
            style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '12px 14px', fontFamily: 'inherit', fontSize: 14 }} />
        </label>

        {/* Rules acceptance — mandatory */}
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input data-testid="voita-rules-accepted" type="checkbox" checked={rulesAccepted}
            onChange={(e) => setRulesAccepted(e.target.checked)}
            style={{ marginTop: 3, flex: '0 0 18px', width: 18, height: 18, accentColor: '#6FA37D' }} />
          <span style={{ color: 'var(--ink)', fontSize: 13, lineHeight: 1.55 }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              {lang === 'en' ? 'RULES' : 'SÄÄNNÖT'}
            </span>
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
            padding: '16px 22px', background: '#E8C26E', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.22em',
            fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
          }}>
          {busy ? (lang === 'en' ? 'SUBMITTING…' : 'LÄHETETÄÄN…') : (lang === 'en' ? 'ENTER THE RAFFLE →' : 'OSALLISTU ARVONTAAN →')}
        </button>

        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginTop: -8 }}>
          {lang === 'en'
            ? 'Free entry. No deposit. No betting. Data stored 30 days after the match, then deleted unless you opt in to news.'
            : 'Maksuton osallistuminen. Ei talletusta. Ei vedonlyöntiä. Tiedot säilytetään 30 päivää ottelun jälkeen, sitten poistetaan ellet tilaa uutiskirjettä.'}
        </div>
      </form>
    </div>
  );
};

export default VoitaRaffle;
