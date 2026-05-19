/**
 * PUTKI HQ — VoitaRaffle landing funnel.
 *
 * /voita/{slug} is the affiliate-email landing page. Cold visitors land
 * here from paid email traffic, don't know what PUTKI HQ is, and either
 * convert or bounce. Conversion strategy = data capture.
 *
 * Funnel state machine:
 *   1. QUIZ          — 4 fun qualifying questions + age-gate
 *   2. SOCIAL_PROOF  — show paid winners + €N paid total
 *   3. EMAIL_GATE    — capture email (lead row written; even bouncers retained)
 *   4. PLAY          — actual raffle form (1-X-2 + score + display name)
 *   5. (submit)      → navigates to /voita/{slug}/kiitos
 *
 * Lead capture happens at step 3 (email_gate). Quiz answers + email get
 * POSTed to /api/voita/lead → upserts into `optin_consents` with tag
 * `voita_lead` BEFORE the user sees the play form. If they bounce at
 * step 4 we still have the data.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import RecentWinnersStrip from '../components/RecentWinnersStrip';
import { useOpsFacts } from '../hooks/useOpsFacts';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// ── Quiz definition ─────────────────────────────────────────────────────
// Fun, casual phrasing. Each question is also a qualifying signal we use
// for content routing.
const QUIZ_FI = [
  {
    key: 'age_18_plus', mandatory: true,
    title: 'Oletko 18+?',
    sub: 'Pakollinen — tämä on lain vaatima ikäraja arvonnassa.',
    options: [
      { v: 'yes', label: 'Kyllä, olen 18+', accent: '#6FA37D' },
      { v: 'no', label: 'En ole', accent: '#5a2b2b', blocker: true },
    ],
  },
  {
    key: 'favorite_sport',
    title: 'Mikä on lempilajisi?',
    sub: 'Valitse yksi — tämä auttaa meitä lähettämään vain sinulle relevantit signaalit.',
    options: [
      { v: 'football', label: 'Jalkapallo', emoji: '⚽' },
      { v: 'icehockey', label: 'Jääkiekko', emoji: '🏒' },
      { v: 'nhl', label: 'NHL', emoji: '🏒' },
      { v: 'tennis', label: 'Tennis', emoji: '🎾' },
      { v: 'basketball', label: 'Koripallo', emoji: '🏀' },
      { v: 'other', label: 'Jokin muu', emoji: '🎯' },
    ],
  },
  {
    key: 'bet_frequency',
    title: 'Kuinka usein lyöt vetoa?',
    sub: 'Rehellinen vastaus auttaa meitä — emme tuomitse.',
    options: [
      { v: 'daily', label: 'Päivittäin' },
      { v: 'weekly', label: 'Viikoittain' },
      { v: 'monthly', label: 'Kuukausittain' },
      { v: 'rare', label: 'Vain isojen otteluiden aikaan' },
      { v: 'never', label: 'En koskaan — vain seuraan urheilua' },
    ],
  },
  {
    key: 'sportsbooks', multi: true,
    title: 'Mitä vedonlyöntiyhtiöitä käytät?',
    sub: 'Valitse niin monta kuin haluat — tai ohita.',
    options: [
      { v: 'veikkaus', label: 'Veikkaus' },
      { v: 'unibet', label: 'Unibet' },
      { v: 'bet365', label: 'Bet365' },
      { v: 'leovegas', label: 'LeoVegas' },
      { v: 'betsson', label: 'Betsson' },
      { v: 'nordicbet', label: 'NordicBet' },
      { v: 'other', label: 'Jokin muu' },
      { v: 'none', label: 'En käytä mitään' },
    ],
  },
  {
    key: 'confidence',
    title: 'Kuinka itsevarma olet ennustuksissasi?',
    sub: 'Tämä on kevyt — vastaa fiiliksen mukaan.',
    options: [
      { v: 'casual', label: 'Veikkaan fiiliksellä', emoji: '🎲' },
      { v: 'enthusiast', label: 'Seuraan tilastoja', emoji: '📊' },
      { v: 'sharp', label: 'Tiedän mitä teen', emoji: '🎯' },
    ],
  },
];

const QUIZ_EN = [
  {
    key: 'age_18_plus', mandatory: true,
    title: 'Are you 18+?',
    sub: 'Required by law for raffle entry.',
    options: [
      { v: 'yes', label: 'Yes, I\'m 18+', accent: '#6FA37D' },
      { v: 'no', label: 'No', accent: '#5a2b2b', blocker: true },
    ],
  },
  {
    key: 'favorite_sport',
    title: 'What\'s your favorite sport?',
    sub: 'Pick one — helps us route signals you actually care about.',
    options: [
      { v: 'football', label: 'Football', emoji: '⚽' },
      { v: 'icehockey', label: 'Ice hockey', emoji: '🏒' },
      { v: 'nhl', label: 'NHL', emoji: '🏒' },
      { v: 'tennis', label: 'Tennis', emoji: '🎾' },
      { v: 'basketball', label: 'Basketball', emoji: '🏀' },
      { v: 'other', label: 'Something else', emoji: '🎯' },
    ],
  },
  {
    key: 'bet_frequency',
    title: 'How often do you bet?',
    sub: 'Honest answer helps us — no judgment.',
    options: [
      { v: 'daily', label: 'Daily' },
      { v: 'weekly', label: 'Weekly' },
      { v: 'monthly', label: 'Monthly' },
      { v: 'rare', label: 'Only big matches' },
      { v: 'never', label: 'Never — just follow sports' },
    ],
  },
  {
    key: 'sportsbooks', multi: true,
    title: 'Which sportsbooks do you use?',
    sub: 'Pick any number — or skip.',
    options: [
      { v: 'veikkaus', label: 'Veikkaus' },
      { v: 'unibet', label: 'Unibet' },
      { v: 'bet365', label: 'Bet365' },
      { v: 'leovegas', label: 'LeoVegas' },
      { v: 'betsson', label: 'Betsson' },
      { v: 'nordicbet', label: 'NordicBet' },
      { v: 'other', label: 'Other' },
      { v: 'none', label: 'None' },
    ],
  },
  {
    key: 'confidence',
    title: 'How confident are you in your picks?',
    sub: 'Casual — pick whichever fits.',
    options: [
      { v: 'casual', label: 'Gut feeling', emoji: '🎲' },
      { v: 'enthusiast', label: 'I check the stats', emoji: '📊' },
      { v: 'sharp', label: 'I know what I\'m doing', emoji: '🎯' },
    ],
  },
];


// ── Progress bar ────────────────────────────────────────────────────────
const Progress = ({ pct }) => (
  <div data-testid="funnel-progress" style={{
    height: 3, background: 'var(--hairline)', marginBottom: 26,
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', inset: 0, width: `${Math.max(4, Math.min(100, pct))}%`,
      background: '#E8C26E', transition: 'width 240ms cubic-bezier(.2,.7,.3,1)',
    }} />
  </div>
);


// ── Step 1: Quiz ────────────────────────────────────────────────────────
const QuizStep = ({ quiz, answers, setAnswers, onComplete, onBlocked, lang }) => {
  const [idx, setIdx] = useState(0);
  const q = quiz[idx];
  const answer = answers[q.key];
  const canAdvance = q.multi ? true : !!answer;

  const advance = () => {
    if (idx + 1 < quiz.length) {
      setIdx(idx + 1);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    } else {
      onComplete();
    }
  };

  const pick = (v) => {
    if (q.multi) {
      const cur = answers[q.key] || [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      setAnswers({ ...answers, [q.key]: next });
      return;
    }
    setAnswers({ ...answers, [q.key]: v });
    const opt = q.options.find((o) => o.v === v);
    if (opt?.blocker) { onBlocked(); return; }
    // Auto-advance on single-pick non-blocker.
    setTimeout(advance, 220);
  };

  return (
    <div data-testid="quiz-step">
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700,
        marginBottom: 8,
      }}>{lang === 'en' ? `QUESTION ${idx + 1} / ${quiz.length}` : `KYSYMYS ${idx + 1} / ${quiz.length}`}</div>
      <h2 data-testid="quiz-question-title" style={{
        fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, color: 'var(--ink)',
        margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.15,
      }}>{q.title}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
        {q.sub}
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {q.options.map((opt) => {
          const active = q.multi
            ? (answers[q.key] || []).includes(opt.v)
            : answer === opt.v;
          return (
            <button type="button" key={opt.v}
              data-testid={`quiz-option-${q.key}-${opt.v}`}
              onClick={() => pick(opt.v)}
              style={{
                textAlign: 'left', padding: '14px 18px', cursor: 'pointer',
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${active ? 'var(--ink)' : (opt.accent || 'var(--border-strong)')}`,
                fontFamily: 'Georgia, serif', fontSize: 16,
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'background 120ms',
              }}>
              {opt.emoji && <span style={{ fontSize: 22 }} aria-hidden>{opt.emoji}</span>}
              <span style={{ flex: 1 }}>{opt.label}</span>
              {q.multi && (
                <span style={{
                  width: 18, height: 18, border: `2px solid ${active ? 'var(--bg)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--bg)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink)', fontSize: 12, fontWeight: 700,
                }}>{active ? '✓' : ''}</span>
              )}
            </button>
          );
        })}
      </div>
      {q.multi && (
        <button type="button" data-testid="quiz-multi-continue"
          onClick={advance}
          style={{
            marginTop: 18, padding: '13px 20px',
            background: '#E8C26E', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', fontWeight: 700, cursor: 'pointer', width: '100%',
          }}>
          {canAdvance ? (lang === 'en' ? 'CONTINUE →' : 'JATKA →') : (lang === 'en' ? 'SKIP →' : 'OHITA →')}
        </button>
      )}
    </div>
  );
};


// ── Step 2: Social proof + ops facts ────────────────────────────────────
const SocialProofStep = ({ onContinue, lang }) => {
  const { facts } = useOpsFacts();
  const eur = facts.voita_eur_paid_total || 0;
  const count = facts.voita_raffles_paid_count || 0;
  return (
    <div data-testid="social-proof-step">
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', color: '#6FA37D', fontWeight: 700,
        marginBottom: 8,
      }}>● {lang === 'en' ? 'REAL · PAID · VERIFIED' : 'AITOA · MAKSETTU · TODISTETTU'}</div>
      <h2 style={{
        fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: 'var(--ink)',
        margin: '0 0 16px', letterSpacing: '-0.015em', lineHeight: 1.1,
      }}>
        {lang === 'en' ? 'We\'ve paid out ' : 'Olemme maksaneet '}
        <span style={{ color: '#E8C26E' }}>€{eur}</span>
        {lang === 'en' ? ` across ${count} raffles.` : ` ${count} arvonnan voittajille.`}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
        {lang === 'en'
          ? 'No deposit. No betting. Free entry, winners paid within 48 hours.'
          : 'Ei talletusta. Ei vedonlyöntiä. Maksuton osallistuminen, voittaja maksetaan 48 tunnin sisällä.'}
      </p>
      <RecentWinnersStrip />
      <button type="button" onClick={onContinue} data-testid="social-proof-continue"
        style={{
          marginTop: 10, padding: '14px 22px', width: '100%',
          background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: 'pointer',
        }}>
        {lang === 'en' ? 'OK, I\'M IN — CONTINUE →' : 'OK, OLEN MUKANA — JATKA →'}
      </button>
    </div>
  );
};


// ── Step 3: Email gate ──────────────────────────────────────────────────
const EmailGateStep = ({ email, setEmail, onContinue, busy, error, lang }) => (
  <div data-testid="email-gate-step">
    <div style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700,
      marginBottom: 8,
    }}>{lang === 'en' ? 'ALMOST THERE' : 'MELKEIN VALMIS'}</div>
    <h2 style={{
      fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: 'var(--ink)',
      margin: '0 0 12px', letterSpacing: '-0.015em', lineHeight: 1.15,
    }}>{lang === 'en' ? 'Where do we send your result?' : 'Mihin lähetämme tuloksen?'}</h2>
    <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
      {lang === 'en'
        ? 'Email is the only required field. We use it to tell you the result and notify you if you win — nothing else. No marketing unless you opt in later.'
        : 'Sähköposti on ainoa pakollinen tieto. Käytämme sitä vain tuloksen ja voiton ilmoittamiseen — ei muuhun. Markkinointiviestit vain jos myöhemmin tilaat.'}
    </p>
    <input data-testid="email-gate-input" type="email" required value={email}
      onChange={(e) => setEmail(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && email) { e.preventDefault(); onContinue(); } }}
      placeholder="esim. matti@gmail.com"
      autoFocus
      style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '16px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 15 }} />
    {error && <div data-testid="email-gate-error" style={{ marginTop: 10, padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
    <button type="button" onClick={onContinue} disabled={busy || !email}
      data-testid="email-gate-submit"
      style={{
        marginTop: 14, padding: '14px 22px', width: '100%',
        background: (busy || !email) ? 'var(--surface)' : '#E8C26E',
        color: (busy || !email) ? 'var(--muted)' : '#0B0A09',
        border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
        letterSpacing: '0.22em', fontWeight: 700,
        cursor: (busy || !email) ? 'not-allowed' : 'pointer',
      }}>
      {busy ? (lang === 'en' ? 'SAVING…' : 'TALLENNETAAN…') : (lang === 'en' ? 'CONTINUE TO THE RAFFLE →' : 'JATKA ARVONTAAN →')}
    </button>
    <p style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
      {lang === 'en'
        ? 'GDPR: stored 30 days after the match, then auto-deleted unless you separately opt in to news.'
        : 'GDPR: säilytetään 30 päivää ottelun jälkeen, sitten poistetaan ellet erikseen tilaa uutiskirjettä.'}
    </p>
  </div>
);


// ── Step 4: Play ────────────────────────────────────────────────────────
const PlayStep = ({ raffle, lang, busy, onSubmit, serverError, fromQuiz }) => {
  const [prediction, setPrediction] = useState('');
  const [homeGoals, setHomeGoals] = useState('');
  const [awayGoals, setAwayGoals] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      prediction_one_x_two: prediction,
      predicted_home_goals: homeGoals === '' ? null : Number(homeGoals),
      predicted_away_goals: awayGoals === '' ? null : Number(awayGoals),
      display_name: displayName.trim(),
      rules_accepted: rulesAccepted,
    });
  };

  return (
    <form onSubmit={submit} data-testid="play-step" style={{ display: 'grid', gap: 22 }}>
      <div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 4 }}>
          {lang === 'en' ? 'NOW THE FUN PART' : 'NYT SE HAUSKA OSUUS'}
        </div>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, color: 'var(--ink)',
          margin: '0 0 6px', letterSpacing: '-0.015em', lineHeight: 1.15,
        }}>{lang === 'en' ? 'Make your pick' : 'Tee veikkaus'}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>
          {fromQuiz?.confidence === 'casual'
            ? (lang === 'en' ? 'No pressure — closest score wins.' : 'Ei paineita — lähimmäs osunut voittaa.')
            : (lang === 'en' ? 'Tie-broken by exact goals, then goal difference, then total goals.' : 'Tasatilanne ratkaistaan tarkalla maalimäärällä, sitten maalierolla, sitten kokonaismaaleilla.')}
        </p>
      </div>

      {/* 1-X-2 */}
      <div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 8 }}>
          {lang === 'en' ? 'WHO WINS?' : 'KUKA VOITTAA?'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { v: '1', label: raffle.home_team || '1', sub: lang === 'en' ? 'Home' : 'Koti' },
            { v: 'X', label: 'X', sub: lang === 'en' ? 'Draw' : 'Tasapeli' },
            { v: '2', label: raffle.away_team || '2', sub: lang === 'en' ? 'Away' : 'Vieras' },
          ].map((opt) => {
            const active = prediction === opt.v;
            return (
              <label key={opt.v} data-testid={`play-pick-${opt.v.toLowerCase()}`}
                style={{
                  flex: 1, padding: '14px 6px', textAlign: 'center', cursor: 'pointer',
                  background: active ? 'var(--ink)' : 'var(--bg, #0B0A09)',
                  color: active ? 'var(--bg)' : 'var(--ink)',
                  border: `1px solid ${active ? 'var(--ink)' : 'var(--border-strong, #3A332E)'}`,
                }}>
                <input type="radio" name="prediction" value={opt.v}
                  checked={active} onChange={() => setPrediction(opt.v)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>{opt.label}</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', opacity: active ? 0.7 : 0.55, marginTop: 4 }}>
                  {opt.sub.toUpperCase()}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Score */}
      <div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 8 }}>
          {lang === 'en' ? 'WHAT\'S THE SCORE?' : 'MIKÄ LOPPUTULOS?'}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 4, textAlign: 'center' }}>
              {(raffle.home_team || 'HOME').toUpperCase()}
            </div>
            <input data-testid="play-home-goals" type="number" min={0} max={50} value={homeGoals}
              onChange={(e) => setHomeGoals(e.target.value)} placeholder="0"
              style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '14px', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, textAlign: 'center' }} />
          </div>
          <span style={{ color: 'var(--muted)', fontFamily: 'Georgia, serif', fontSize: 24, marginTop: 22 }}>—</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 4, textAlign: 'center' }}>
              {(raffle.away_team || 'AWAY').toUpperCase()}
            </div>
            <input data-testid="play-away-goals" type="number" min={0} max={50} value={awayGoals}
              onChange={(e) => setAwayGoals(e.target.value)} placeholder="0"
              style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '14px', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, textAlign: 'center' }} />
          </div>
        </div>
      </div>

      {/* Display name */}
      <label>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 4 }}>
          {lang === 'en' ? 'DISPLAY NAME · OPTIONAL' : 'NÄYTTÖNIMI · VAPAAEHTOINEN'}
        </div>
        <input data-testid="play-display-name" type="text" maxLength={40}
          value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder={lang === 'en' ? 'How you appear if you win' : 'Miten näyt jos voitat'}
          style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '12px', fontFamily: 'inherit', fontSize: 14 }} />
      </label>

      {/* Rules */}
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input data-testid="play-rules-accepted" type="checkbox" checked={rulesAccepted}
          onChange={(e) => setRulesAccepted(e.target.checked)}
          style={{ marginTop: 3, flex: '0 0 18px', width: 18, height: 18, accentColor: '#6FA37D' }} />
        <span style={{ color: 'var(--ink)', fontSize: 13, lineHeight: 1.55 }}>
          {lang === 'en' ? 'I have read and accept the ' : 'Olen lukenut ja hyväksyn '}
          <Link to="/voita/saannot" target="_blank" rel="noopener" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            {lang === 'en' ? 'raffle rules' : 'arvonnan säännöt'}
          </Link>.
        </span>
      </label>

      {serverError && <div data-testid="play-error" style={{ padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{serverError}</div>}

      <button type="submit" disabled={busy} data-testid="play-submit"
        style={{
          padding: '16px 22px', background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '0.22em',
          fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
        }}>
        {busy ? (lang === 'en' ? 'SUBMITTING…' : 'LÄHETETÄÄN…') : (lang === 'en' ? 'ENTER THE RAFFLE →' : 'OSALLISTU →')}
      </button>
    </form>
  );
};


// ── Container ───────────────────────────────────────────────────────────
const VoitaRaffle = () => {
  const { lang } = useLang();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [raffle, setRaffle] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState('quiz'); // quiz | social | email | play | blocked
  const [answers, setAnswers] = useState({});
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const quiz = lang === 'en' ? QUIZ_EN : QUIZ_FI;

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/voita/raffles/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) { setRaffle(d); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [slug]);

  const progressPct = useMemo(() => {
    const map = { quiz: 25, social: 50, email: 75, play: 90, blocked: 100 };
    return map[step] || 0;
  }, [step]);

  const saveLead = async () => {
    setBusy(true); setEmailError('');
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          raffle_slug: slug,
          age_18_plus: answers.age_18_plus === 'yes',
          favorite_sport: answers.favorite_sport,
          bet_frequency: answers.bet_frequency,
          sportsbooks: answers.sportsbooks || [],
          confidence: answers.confidence,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setEmailError(j.detail || `HTTP ${r.status}`);
        return;
      }
      setStep('play');
    } catch (e) {
      setEmailError(e.message || 'Network error');
    } finally { setBusy(false); }
  };

  const submitEntry = async (form) => {
    setServerError('');
    if (!form.prediction_one_x_two) { setServerError(lang === 'en' ? 'Pick 1, X or 2.' : 'Valitse 1, X tai 2.'); return; }
    if (form.predicted_home_goals === null || form.predicted_away_goals === null) {
      setServerError(lang === 'en' ? 'Predict the score.' : 'Ennusta lopputulos.'); return;
    }
    if (!form.rules_accepted) { setServerError(lang === 'en' ? 'Accept the rules to enter.' : 'Hyväksy säännöt.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/voita/raffles/${slug}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setServerError(j.detail || `HTTP ${r.status}`); return; }
      try {
        sessionStorage.setItem(`voita:${slug}:entry`, JSON.stringify({
          email, entry_id: j.entry_id, position: j.position,
          prediction: form.prediction_one_x_two,
          home: form.predicted_home_goals, away: form.predicted_away_goals,
          quiz: answers,
        }));
      } catch {}
      navigate(`/voita/${slug}/kiitos`);
    } catch (e) {
      setServerError(e.message || 'Network error');
    } finally { setBusy(false); }
  };

  if (!loaded) return <div style={{ padding: 64, color: 'var(--muted)', textAlign: 'center' }} data-testid="voita-raffle-loading">…</div>;
  if (!raffle) {
    return (
      <div data-testid="voita-raffle-not-found" style={{ maxWidth: 720, margin: '64px auto', padding: '0 32px', color: 'var(--ink)' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32 }}>{lang === 'en' ? 'Raffle not found' : 'Arvontaa ei löydy'}</h1>
        <p><Link to="/voita" style={{ color: 'var(--ink)' }}>← Voita</Link></p>
      </div>
    );
  }

  // Tiny match strap so visitors always know what they're playing for.
  const matchStrap = (
    <div data-testid="match-strap" style={{
      marginBottom: 26, padding: '12px 14px',
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700 }}>
        {lang === 'en' ? 'TODAY\'S RAFFLE' : 'PÄIVÄN ARVONTA'}
      </span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
        {raffle.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {raffle.away_team}
      </span>
      <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)' }}>
        {(raffle.league || raffle.sport || '').toUpperCase()}
      </span>
    </div>
  );

  return (
    <div data-testid="voita-raffle-page" style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px 64px', color: 'var(--ink)' }}>
      <Progress pct={progressPct} />
      {matchStrap}

      {step === 'blocked' && (
        <div data-testid="age-blocked" style={{
          padding: '22px 22px', background: '#2b0e0e', border: '1px solid #5a2b2b',
          color: '#f4a4a4',
        }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', fontWeight: 700, marginBottom: 8 }}>
            {lang === 'en' ? 'AGE RESTRICTED' : 'IKÄRAJOITUS'}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#FFE5E5' }}>
            {lang === 'en'
              ? 'You must be 18 or older to enter. Come back when you are — the raffles aren\'t going anywhere.'
              : 'Sinun on oltava 18 tai yli osallistuaksesi. Tule takaisin myöhemmin — arvonnat eivät katoa minnekään.'}
          </p>
        </div>
      )}

      {step === 'quiz' && (
        <QuizStep
          quiz={quiz} answers={answers} setAnswers={setAnswers}
          onComplete={() => setStep('social')}
          onBlocked={() => setStep('blocked')}
          lang={lang}
        />
      )}

      {step === 'social' && (
        <SocialProofStep onContinue={() => setStep('email')} lang={lang} />
      )}

      {step === 'email' && (
        <EmailGateStep
          email={email} setEmail={setEmail} onContinue={saveLead}
          busy={busy} error={emailError} lang={lang}
        />
      )}

      {step === 'play' && (
        <PlayStep
          raffle={raffle} lang={lang} busy={busy}
          onSubmit={submitEntry} serverError={serverError}
          fromQuiz={answers}
        />
      )}

      {/* Tiny footer escape for visitors who want to learn more */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Link to="/" data-testid="voita-funnel-newsroom-link" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.22em', color: 'var(--muted)',
          textDecoration: 'underline', textUnderlineOffset: 4,
        }}>
          {lang === 'en' ? 'WHAT IS PUTKI HQ? · READ THE NEWSROOM →' : 'MIKÄ ON PUTKI HQ? · LUE UUTISHUONE →'}
        </Link>
      </div>
    </div>
  );
};

export default VoitaRaffle;
