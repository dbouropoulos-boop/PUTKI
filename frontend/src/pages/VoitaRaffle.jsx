/**
 * PUTKI HQ — Voita game-beat funnel.
 *
 * Replaces the 5-step form with a casino-grade quiz → reveal → email →
 * prediction-beats → confirmation sequence. Every screen is a single
 * beat with smooth motion. Quiz answers drive the prediction-beat
 * variant ("mode_with_data" / "mode_quick" / "mode_with_editorial").
 *
 * All data shown is real: bookmaker consensus, team form, raffle-
 * internal pick distribution, paid winners. Nothing fabricated.
 *
 * State machine:
 *   1. quiz_<q1..q5>        — 5 fun qualifying questions
 *   2. reveal_open_raffles  — between Q2 and Q3, "we have N open raffles"
 *   3. email_gate           — capture email + 18+ + rules
 *   4. prediction_match     — match hero / Beat 1
 *   5. prediction_pick      — 1-X-2 / Beat 2 (mode-aware reveals)
 *   6. prediction_score     — score wheels / Beat 3 (mode-aware reveals)
 *   7. prediction_review    — multiplier reveal / Beat 4
 *   8. (submit → /kiitos)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '../context/LanguageContext';
import RecentWinnersStrip from '../components/RecentWinnersStrip';
import { useOpsFacts } from '../hooks/useOpsFacts';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// ── Quiz definition ────────────────────────────────────────────────────
const QUIZ_FI = [
  {
    key: 'style', auto: true,
    title: 'Mikä veikkaajatyyppi sinä olet?',
    sub: 'Yksi vastaus — autamme räätälöimään fiiliksen.',
    options: [
      { v: 'stats', label: 'Tilastoja seuraan', emoji: '🧊' },
      { v: 'gut', label: 'Tunteella menen', emoji: '🔥' },
      { v: 'loyal', label: 'Lempijoukkue aina', emoji: '🎯' },
      { v: 'chaos', label: 'Tuuripeli, baby', emoji: '🎲' },
    ],
  },
  {
    key: 'sports', multi: true,
    title: 'Minkä lajin parissa olet kotonasi?',
    sub: 'Valitse vähintään yksi.',
    options: [
      { v: 'football', label: 'Jalkapallo', emoji: '⚽' },
      { v: 'icehockey', label: 'Jääkiekko', emoji: '🏒' },
      { v: 'tennis', label: 'Tennis', emoji: '🎾' },
      { v: 'basketball', label: 'Koripallo', emoji: '🏀' },
      { v: 'f1', label: 'F1', emoji: '🏎️' },
      { v: 'mma', label: 'MMA / Nyrkkeily', emoji: '🥊' },
    ],
  },
  {
    key: 'frequency', auto: true,
    title: 'Kuinka usein olet veikkaamassa?',
    options: [
      { v: 'weekly', label: 'Viikoittain — joka peli mukaan', emoji: '🔥' },
      { v: 'monthly', label: 'Kuukausittain — vain isot ottelut', emoji: '📅' },
      { v: 'rare', label: 'Vain finaalihetkinä', emoji: '🎯' },
      { v: 'first', label: 'Tämä on ensimmäiseni', emoji: '🆕' },
    ],
  },
  {
    key: 'skill', auto: true, callback: true,
    title: 'Kuinka usein veikkauksesi osuvat?',
    options: [
      { v: 'often', label: 'Useammin kuin kerran kuussa', emoji: '😤' },
      { v: 'fifty', label: 'Joskus osuu, joskus ei', emoji: '🤷' },
      { v: 'unknown', label: 'En oikeasti tiedä', emoji: '😅' },
      { v: 'first', label: 'En ole vielä veikannut', emoji: '🎯' },
    ],
  },
  {
    key: 'mode', auto: true,
    title: 'Kuinka haluat veikata?',
    sub: 'Tämä määrittää loppupelin tyylin.',
    options: [
      { v: 'with_data', label: 'Näytä mulle data — sitten valitsen', emoji: '🎯' },
      { v: 'quick', label: 'Tuurilla menen — heti lukkoon', emoji: '⚡' },
      { v: 'with_editorial', label: 'Toimitus kertoo mitä se ajattelee', emoji: '🤝' },
    ],
  },
];

const QUIZ_EN = [
  {
    key: 'style', auto: true,
    title: 'What kind of predictor are you?',
    sub: 'One answer — helps us tune the experience.',
    options: [
      { v: 'stats', label: 'Numbers guy', emoji: '🧊' },
      { v: 'gut', label: 'Gut player', emoji: '🔥' },
      { v: 'loyal', label: 'Loyal to my team', emoji: '🎯' },
      { v: 'chaos', label: 'Pure luck', emoji: '🎲' },
    ],
  },
  {
    key: 'sports', multi: true,
    title: 'What\'s your home turf?',
    sub: 'Pick at least one.',
    options: [
      { v: 'football', label: 'Football', emoji: '⚽' },
      { v: 'icehockey', label: 'Ice hockey', emoji: '🏒' },
      { v: 'tennis', label: 'Tennis', emoji: '🎾' },
      { v: 'basketball', label: 'Basketball', emoji: '🏀' },
      { v: 'f1', label: 'F1', emoji: '🏎️' },
      { v: 'mma', label: 'MMA / Boxing', emoji: '🥊' },
    ],
  },
  {
    key: 'frequency', auto: true,
    title: 'How often do you predict?',
    options: [
      { v: 'weekly', label: 'Weekly — every match', emoji: '🔥' },
      { v: 'monthly', label: 'Monthly — only big games', emoji: '📅' },
      { v: 'rare', label: 'Only championship moments', emoji: '🎯' },
      { v: 'first', label: 'This is my first time', emoji: '🆕' },
    ],
  },
  {
    key: 'skill', auto: true, callback: true,
    title: 'How often do your predictions hit?',
    options: [
      { v: 'often', label: 'More often than not', emoji: '😤' },
      { v: 'fifty', label: '50/50 — fair coin', emoji: '🤷' },
      { v: 'unknown', label: 'I genuinely don\'t know', emoji: '😅' },
      { v: 'first', label: 'I haven\'t predicted before', emoji: '🎯' },
    ],
  },
  {
    key: 'mode', auto: true,
    title: 'How do you want to predict?',
    sub: 'This shapes the rest of the experience.',
    options: [
      { v: 'with_data', label: 'Show me the data — I\'ll decide', emoji: '🎯' },
      { v: 'quick', label: 'Trust my gut — lock it now', emoji: '⚡' },
      { v: 'with_editorial', label: 'Editorial gives me their read', emoji: '🤝' },
    ],
  },
];

const TOTAL_BEATS = 9; // 5 quiz + reveal + email + 4 prediction (match/pick/score/review)

// ── Animation primitives ───────────────────────────────────────────────
const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.2, 0.7, 0.3, 1] } },
  exit:    { opacity: 0, x: -60, transition: { duration: 0.22, ease: [0.4, 0, 0.6, 0.3] } },
};


const ProgressBar = ({ step, total }) => (
  <div data-testid="funnel-progress" style={{
    height: 3, background: 'var(--hairline)', marginBottom: 26, position: 'relative', overflow: 'hidden',
  }}>
    <motion.div
      animate={{ width: `${Math.min(100, (step / total) * 100)}%` }}
      transition={{ duration: 0.36, ease: [0.2, 0.7, 0.3, 1] }}
      style={{ position: 'absolute', inset: 0, background: '#E8C26E', width: 0 }}
    />
  </div>
);


// ── Quiz screen ────────────────────────────────────────────────────────
const QuizScreen = ({ q, idx, total, answers, setAnswers, onAdvance, lang }) => {
  const answer = answers[q.key];
  const pick = (v) => {
    if (q.multi) {
      const cur = answers[q.key] || [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      setAnswers({ ...answers, [q.key]: next });
      return;
    }
    setAnswers({ ...answers, [q.key]: v });
    if (q.auto) setTimeout(onAdvance, 260);
  };
  return (
    <div data-testid={`quiz-step-${q.key}`}>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8,
      }}>{lang === 'en' ? `QUESTION ${idx + 1} / ${total}` : `KYSYMYS ${idx + 1} / ${total}`}</div>
      <h2 data-testid="quiz-question-title" style={{
        fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, color: 'var(--ink)',
        margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.15,
      }}>{q.title}</h2>
      {q.sub && <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>{q.sub}</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {q.options.map((opt) => {
          const active = q.multi ? (answers[q.key] || []).includes(opt.v) : answer === opt.v;
          return (
            <motion.button type="button" key={opt.v}
              data-testid={`quiz-option-${q.key}-${opt.v}`}
              onClick={() => pick(opt.v)}
              whileTap={{ scale: 0.97 }}
              animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.24 }}
              style={{
                textAlign: 'left', padding: '14px 18px', cursor: 'pointer',
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--border-strong)'}`,
                fontFamily: 'Georgia, serif', fontSize: 16,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              {opt.emoji && <span style={{ fontSize: 22 }} aria-hidden>{opt.emoji}</span>}
              <span style={{ flex: 1 }}>{opt.label}</span>
              {q.multi && (
                <span style={{
                  width: 18, height: 18, border: `2px solid ${active ? 'var(--bg)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--bg)' : 'transparent',
                  color: 'var(--ink)', fontSize: 12, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{active ? '✓' : ''}</span>
              )}
            </motion.button>
          );
        })}
      </div>
      {q.multi && (
        <motion.button type="button" data-testid="quiz-multi-continue"
          whileTap={{ scale: 0.97 }}
          onClick={onAdvance}
          disabled={(answers[q.key] || []).length === 0}
          style={{
            marginTop: 18, padding: '13px 20px', width: '100%',
            background: (answers[q.key] || []).length === 0 ? 'var(--surface)' : '#E8C26E',
            color: (answers[q.key] || []).length === 0 ? 'var(--muted)' : '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', fontWeight: 700,
            cursor: (answers[q.key] || []).length === 0 ? 'not-allowed' : 'pointer',
          }}>
          {lang === 'en' ? 'CONTINUE →' : 'JATKA →'}
        </motion.button>
      )}
    </div>
  );
};


// ── Between Q2 and Q3: reveal open raffles in chosen sports ────────────
const RevealOpenRaffles = ({ sports, onAdvance, lang }) => {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/voita/raffles?status=open&limit=20`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => {
        if (stop) return;
        const filtered = (d.items || []).filter((r) =>
          sports.length === 0 || sports.includes(r.sport),
        );
        setCount(filtered.length);
        setTimeout(onAdvance, 1700);
      })
      .catch(() => { if (!stop) { setCount(0); setTimeout(onAdvance, 1700); } });
    return () => { stop = true; };
  }, [sports, onAdvance]);
  return (
    <div data-testid="reveal-open-raffles" style={{ textAlign: 'center', padding: '32px 0' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.36, ease: [0.2, 0.7, 0.3, 1] }}
        style={{ fontFamily: 'Georgia, serif', fontSize: 56, color: '#E8C26E', fontWeight: 700, lineHeight: 1 }}>
        {count === null ? '…' : count}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3 }}
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', marginTop: 10, fontWeight: 700 }}>
        {count === 0
          ? (lang === 'en' ? 'NO OPEN RAFFLES IN YOUR SPORTS — FIRST ONES COMING SOON' : 'EI VIELÄ AVOIMIA ARVONTOJA LAJEISSASI — ENSIMMÄISET TULOSSA PIAN')
          : (lang === 'en' ? `OPEN RAFFLE${count === 1 ? '' : 'S'} IN YOUR SPORTS` : `AVOIN${count === 1 ? '' : 'TA'} ARVONTA${count === 1 ? '' : 'A'} LAJEISSASI`)}
      </motion.div>
    </div>
  );
};


// ── Email gate (after quiz) ────────────────────────────────────────────
const EmailGate = ({ email, setEmail, displayName, setDisplayName, age, setAge, rules, setRules, onSubmit, busy, error, lang }) => {
  const canSubmit = !!email && age && rules && !busy;
  return (
    <div data-testid="email-gate-step">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'LOCK YOUR ENTRY' : 'LUKITSE VEIKKAUKSESI'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 18px', letterSpacing: '-0.015em', lineHeight: 1.15 }}>
        {lang === 'en' ? 'Where do we send your result?' : 'Mihin lähetämme tuloksen?'}
      </h2>
      <div style={{ display: 'grid', gap: 14 }}>
        <input data-testid="email-gate-input" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={lang === 'en' ? 'Email address' : 'Sähköpostiosoite'}
          autoFocus
          style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '14px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 15 }} />
        <input data-testid="email-gate-display-name" type="text" maxLength={40}
          value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder={lang === 'en' ? 'Display name (optional)' : 'Näyttönimi (vapaaehtoinen)'}
          style={{ width: '100%', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '12px 16px', fontFamily: 'inherit', fontSize: 13.5 }} />
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input data-testid="email-gate-age" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, accentColor: '#6FA37D' }} />
          <span style={{ color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>
            {lang === 'en' ? 'I am 18 or older (required).' : 'Olen yli 18-vuotias (pakollinen).'}
          </span>
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input data-testid="email-gate-rules" type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, accentColor: '#6FA37D' }} />
          <span style={{ color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 }}>
            {lang === 'en' ? 'I have read the ' : 'Olen lukenut '}
            <Link to="/voita/saannot" target="_blank" rel="noopener" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
              {lang === 'en' ? 'raffle rules' : 'arvonnan säännöt'}
            </Link> (required).
          </span>
        </label>
        {error && <div data-testid="email-gate-error" style={{ padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
        <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onSubmit} disabled={!canSubmit}
          data-testid="email-gate-submit"
          style={{
            padding: '15px 22px', width: '100%',
            background: canSubmit ? '#E8C26E' : 'var(--surface)',
            color: canSubmit ? '#0B0A09' : 'var(--muted)',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.22em', fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
          {busy ? '…' : (lang === 'en' ? 'CONTINUE →' : 'JATKA →')}
        </motion.button>
        <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
          {lang === 'en' ? 'Stored 30 days after match, then auto-deleted unless you opt in to news separately.' : 'Säilytetään 30 päivää ottelun jälkeen, sitten poistetaan ellet erikseen tilaa uutiskirjettä.'}
        </p>
      </div>
    </div>
  );
};


// ── Beat 1: Match hero ─────────────────────────────────────────────────
const PredictionMatch = ({ raffle, lang, onAdvance }) => {
  const prize = (raffle.prize_distribution?.payouts || []).reduce((s, p) => s + (p.amount_eur || 0), 0);
  const entryNumber = (raffle.entries_count || 0) + 1;
  return (
    <div data-testid="prediction-match" style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 16 }}>
        {(raffle.league || raffle.sport || '').toUpperCase()}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        style={{ marginBottom: 22 }}>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 700,
          color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05,
        }}>{raffle.home_team}</h2>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic', color: 'var(--muted)', margin: '4px 0' }}>vs</div>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 700,
          color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05,
        }}>{raffle.away_team}</h2>
      </motion.div>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 28,
        padding: '14px 0', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)',
      }}>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'PRIZE POOL' : 'PALKINTOPOTTI'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#E8C26E' }}>€{prize}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'YOU\'LL BE #' : 'OSALLISTUJA #'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{entryNumber}</div>
        </div>
      </div>
      <motion.button whileTap={{ scale: 0.97 }}
        onClick={onAdvance} data-testid="prediction-match-cta"
        style={{
          padding: '15px 28px', background: '#E8C26E', color: '#0B0A09',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: 'pointer',
        }}>
        {lang === 'en' ? 'PREDICT →' : 'VEIKKAA →'}
      </motion.button>
    </div>
  );
};


// ── Beat 2: 1-X-2 pick (mode-aware) ────────────────────────────────────
const Predict1X2 = ({ raffle, ctx, mode, pick, setPick, onAdvance, lang }) => {
  const odds = ctx?.odds;
  const dist = ctx?.pick_distribution;
  const editorial = ctx?.editorial_pick;
  const editorialPick = editorial?.one_x_two;

  const optionMeta = (v) => {
    if (mode === 'with_data' && odds) {
      const key = v === '1' ? 'home' : (v === 'X' ? 'draw' : 'away');
      const o = odds[key];
      if (o) return { line: `${o.avg_decimal} · ${o.n_books} ${lang === 'en' ? 'books' : 'kirjaa'}`, implied: o.implied_pct };
    }
    if (mode === 'with_data' && dist && dist.total > 0) {
      return { line: `${dist.pct[v] || 0}% ${lang === 'en' ? 'picked this' : 'valitsi tämän'}`, implied: dist.pct[v] };
    }
    return null;
  };

  return (
    <div data-testid="prediction-pick">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'BEAT 2 · WHO WINS?' : 'OSA 2 · KUKA VOITTAA?'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 18px', letterSpacing: '-0.015em' }}>
        {raffle.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {raffle.away_team}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { v: '1', label: raffle.home_team, sub: lang === 'en' ? 'Home win' : 'Kotivoitto' },
          { v: 'X', label: 'X', sub: lang === 'en' ? 'Draw' : 'Tasapeli' },
          { v: '2', label: raffle.away_team, sub: lang === 'en' ? 'Away win' : 'Vierasvoitto' },
        ].map((opt) => {
          const active = pick === opt.v;
          const meta = optionMeta(opt.v);
          const editorialOnThis = mode === 'with_editorial' && editorialPick === opt.v;
          return (
            <motion.button key={opt.v} type="button"
              data-testid={`predict-pick-${opt.v.toLowerCase()}`}
              whileTap={{ scale: 0.96 }}
              animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.24 }}
              onClick={() => setPick(opt.v)}
              style={{
                padding: '18px 8px', textAlign: 'center', cursor: 'pointer',
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${editorialOnThis ? '#E8C26E' : (active ? 'var(--ink)' : 'var(--border-strong)')}`,
                position: 'relative',
              }}>
              {editorialOnThis && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 8.5, letterSpacing: '0.22em',
                  background: '#E8C26E', color: '#0B0A09', fontWeight: 700,
                  padding: '2px 6px',
                }}>{lang === 'en' ? 'EDITORIAL' : 'TOIMITUS'}</div>
              )}
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', opacity: active ? 0.7 : 0.55, marginTop: 6 }}>{opt.sub.toUpperCase()}</div>
              {meta && (
                <div data-testid={`predict-pick-meta-${opt.v.toLowerCase()}`}
                  style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: active ? '#E8C26E' : 'var(--muted)' }}>
                  {meta.line}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
      {mode === 'with_data' && odds && pick && (
        <motion.div data-testid="pick-reveal-line"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--hairline)', fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          {(() => {
            const key = pick === '1' ? 'home' : (pick === 'X' ? 'draw' : 'away');
            const o = odds[key];
            if (!o) return null;
            const implied = o.implied_pct;
            const tag = implied > 55 ? (lang === 'en' ? 'Markets call this likely.' : 'Markkinat pitävät tätä todennäköisenä.')
              : implied > 35 ? (lang === 'en' ? 'Markets call this 50/50.' : 'Markkinat näkevät tämän tasaisena.')
              : (lang === 'en' ? 'Markets call this an upset.' : 'Markkinat pitävät tätä yllätyksenä.');
            return <span><strong>{implied}%</strong> {lang === 'en' ? 'implied probability across' : 'todennäköisyys —'} {o.n_books} {lang === 'en' ? 'bookmakers.' : 'kirjaa.'} {tag}</span>;
          })()}
        </motion.div>
      )}
      {mode === 'with_editorial' && editorial && (
        <motion.div data-testid="editorial-rationale"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: 14, padding: '10px 14px', background: '#1a1810', border: '1px solid #E8C26E55', fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'TOIMITUS · EDITORIAL READ' : 'TOIMITUKSEN VEIKKAUS'}
          </div>
          {(lang === 'en' ? editorial.rationale_en : editorial.rationale_fi) || (lang === 'en' ? 'Editorial team picks ' : 'Toimitus veikkaa ') + editorialPick + '.'}
        </motion.div>
      )}
      <motion.button whileTap={{ scale: 0.97 }}
        type="button" onClick={onAdvance} disabled={!pick}
        data-testid="predict-pick-continue"
        style={{
          marginTop: 18, padding: '14px 22px', width: '100%',
          background: pick ? '#E8C26E' : 'var(--surface)',
          color: pick ? '#0B0A09' : 'var(--muted)',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: pick ? 'pointer' : 'not-allowed',
        }}>
        {lang === 'en' ? 'PREDICT SCORE →' : 'ENNUSTA TULOS →'}
      </motion.button>
    </div>
  );
};


// ── Beat 3: Score wheels (mode-aware) ──────────────────────────────────
const PredictScore = ({ raffle, ctx, mode, homeGoals, awayGoals, setHomeGoals, setAwayGoals, onAdvance, lang }) => {
  const form = ctx?.team_form;
  const editorial = ctx?.editorial_pick;
  const Step = ({ team, value, setValue, alignStat }) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => setValue(Math.max(0, value - 1))}
          style={{ width: 38, height: 38, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'Georgia, serif', fontSize: 22, cursor: 'pointer' }}>−</motion.button>
        <div style={{ width: 60, fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => setValue(Math.min(20, value + 1))}
          style={{ width: 38, height: 38, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'Georgia, serif', fontSize: 22, cursor: 'pointer' }}>+</motion.button>
      </div>
      {alignStat && (
        <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)' }}>{alignStat}</div>
      )}
    </div>
  );

  const homeStat = mode === 'with_data' && form?.home
    ? `${lang === 'en' ? 'avg' : 'k.a.'} ${form.home.goals_per_game} ${lang === 'en' ? 'goals/game' : 'maalia/peli'}`
    : null;
  const awayStat = mode === 'with_data' && form?.away
    ? `${lang === 'en' ? 'concedes' : 'päästää'} ${form.away.goals_conceded_per_game}/${lang === 'en' ? 'game' : 'peli'}`
    : null;

  return (
    <div data-testid="prediction-score">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'BEAT 3 · WHAT\'S THE SCORE?' : 'OSA 3 · LOPPUTULOS?'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.015em' }}>
        {lang === 'en' ? 'Pick the exact score.' : 'Veikkaa tarkka tulos.'}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        {lang === 'en' ? 'Closest wins. Tie-broken by exact goals → goal difference → total goals.' : 'Lähimmäs voittaa. Tasatilanne: tarkka tulos → maaliero → kokonaismaalit.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 0', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <Step team={raffle.home_team || 'HOME'} value={homeGoals} setValue={setHomeGoals} alignStat={homeStat} />
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'var(--muted)', marginTop: 20 }}>—</span>
        <Step team={raffle.away_team || 'AWAY'} value={awayGoals} setValue={setAwayGoals} alignStat={awayStat} />
      </div>
      {mode === 'with_editorial' && editorial?.predicted_home_goals != null && editorial?.predicted_away_goals != null && (
        <div data-testid="editorial-score-hint" style={{ marginTop: 12, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#E8C26E55', textAlign: 'center', letterSpacing: '0.14em' }}>
          {lang === 'en' ? 'TOIMITUS\' SCORE' : 'TOIMITUKSEN VEIKKAUS'}: {editorial.predicted_home_goals}-{editorial.predicted_away_goals}
        </div>
      )}
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onAdvance}
        data-testid="predict-score-continue"
        style={{
          marginTop: 18, padding: '14px 22px', width: '100%',
          background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: 'pointer',
        }}>
        {lang === 'en' ? 'REVIEW →' : 'TARKISTA →'}
      </motion.button>
    </div>
  );
};


// ── Beat 4: Review with multiplier reveal ──────────────────────────────
const PredictReview = ({ raffle, pick, homeGoals, awayGoals, skillAnswer, onSubmit, busy, error, lang }) => {
  const scoring = raffle.scoring || {};
  const maxPoints = (scoring.one_x_two_points || 3) + (scoring.exact_score_points || 5);
  const skillLabel = useMemo(() => {
    const map = { often: 'often', fifty: 'fifty', unknown: 'unknown', first: 'first' };
    const fi = { often: 'Useammin kuin kerran kuussa', fifty: 'Joskus osuu, joskus ei', unknown: 'En oikeasti tiedä', first: 'En ole vielä veikannut' };
    const en = { often: 'More often than not', fifty: '50/50 — fair coin', unknown: 'I genuinely don\'t know', first: 'I haven\'t predicted before' };
    return lang === 'en' ? en[map[skillAnswer] || 'unknown'] : fi[map[skillAnswer] || 'unknown'];
  }, [skillAnswer, lang]);
  return (
    <div data-testid="prediction-review">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'BEAT 4 · YOUR PREDICTION' : 'OSA 4 · VEIKKAUKSESI'}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.34, ease: [0.2, 0.7, 0.3, 1] }}
        style={{ padding: '22px 22px', background: 'var(--surface)', border: '1px solid var(--hairline)', marginBottom: 18 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: 'var(--muted)', marginBottom: 4 }}>
          {raffle.home_team} <span style={{ color: 'var(--ink)' }}>{homeGoals}</span> — <span style={{ color: 'var(--ink)' }}>{awayGoals}</span> {raffle.away_team}
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginTop: 8 }}>
          {lang === 'en' ? 'PICK' : 'VEIKKAUS'} · {pick}
        </div>
        <div style={{ marginTop: 14, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)' }}>
          {lang === 'en' ? 'SCORING POTENTIAL' : 'PISTEPOTENTIAALI'}
        </div>
        <motion.div
          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.18, type: 'spring', stiffness: 240, damping: 18 }}
          style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: '#E8C26E', lineHeight: 1 }}>
          {maxPoints} {lang === 'en' ? 'pts max' : 'pistettä max'}
        </motion.div>
      </motion.div>
      {/* Q4 callback */}
      {skillAnswer && (
        <motion.div data-testid="q4-callback"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.3 }}
          style={{ marginBottom: 18, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          {lang === 'en' ? 'You said: ' : 'Sanoit: '} "<span style={{ fontWeight: 700, fontStyle: 'normal' }}>{skillLabel}</span>".{' '}
          {lang === 'en' ? 'Let\'s see who\'s right.' : 'Katsotaan kumpi oli oikeassa.'}
        </motion.div>
      )}
      {error && <div data-testid="review-error" style={{ marginBottom: 12, padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onSubmit} disabled={busy}
        data-testid="predict-submit"
        style={{
          padding: '16px 22px', width: '100%',
          background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
        }}>
        {busy ? (lang === 'en' ? 'LOCKING IN…' : 'LUKITAAN…') : (lang === 'en' ? 'LOCK IT IN →' : 'LUKITSE →')}
      </motion.button>
    </div>
  );
};


// ── Container ──────────────────────────────────────────────────────────
const VoitaRaffle = () => {
  const { lang } = useLang();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [raffle, setRaffle] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState('quiz'); // quiz | reveal | email | match | pick | score | review | blocked
  const [quizIdx, setQuizIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState(false);
  const [rules, setRules] = useState(false);
  const [pick, setPick] = useState('');
  const [homeGoals, setHomeGoals] = useState(1);
  const [awayGoals, setAwayGoals] = useState(0);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const quiz = lang === 'en' ? QUIZ_EN : QUIZ_FI;

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/voita/raffles/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop) { setRaffle(d); setLoaded(true); } })
      .catch(() => { if (!stop) setLoaded(true); });
    fetch(`${BACKEND}/api/voita/raffles/${slug}/match-context`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop) setCtx(d); })
      .catch(() => {});
    return () => { stop = true; };
  }, [slug]);

  const stepNumber = useMemo(() => {
    if (step === 'quiz') return quizIdx + 1;
    if (step === 'reveal') return quizIdx + 1.5;
    if (step === 'email') return 6;
    if (step === 'match') return 6.5;
    if (step === 'pick') return 7;
    if (step === 'score') return 8;
    if (step === 'review') return 9;
    return 0;
  }, [step, quizIdx]);

  const advanceQuiz = useCallback(() => {
    const q = quiz[quizIdx];
    // After Q2 (sports) we drop into the reveal screen, then continue.
    if (q.key === 'sports') {
      setStep('reveal');
      return;
    }
    if (quizIdx + 1 < quiz.length) {
      setQuizIdx(quizIdx + 1);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      return;
    }
    // Quiz complete → email gate.
    setStep('email');
  }, [quiz, quizIdx]);

  const afterReveal = useCallback(() => {
    setQuizIdx(quizIdx + 1);
    setStep('quiz');
  }, [quizIdx]);

  const saveLeadAndAdvance = async () => {
    if (!email || !age || !rules) return;
    setBusy(true); setEmailError('');
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, raffle_slug: slug, age_18_plus: true,
          favorite_sport: (answers.sports || [])[0],
          bet_frequency: answers.frequency,
          sportsbooks: answers.style ? [answers.style] : [],
          confidence: answers.skill,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setEmailError(j.detail || `HTTP ${r.status}`); return;
      }
      setStep('match');
    } catch (e) {
      setEmailError(e.message || 'Network');
    } finally { setBusy(false); }
  };

  const submitEntry = async () => {
    setServerError('');
    if (!pick) { setServerError(lang === 'en' ? 'Pick missing.' : 'Veikkaus puuttuu.'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/voita/raffles/${slug}/enter`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          prediction_one_x_two: pick,
          predicted_home_goals: homeGoals,
          predicted_away_goals: awayGoals,
          rules_accepted: true,
          display_name: displayName.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setServerError(j.detail || `HTTP ${r.status}`); return; }
      try {
        sessionStorage.setItem(`voita:${slug}:entry`, JSON.stringify({
          email, entry_id: j.entry_id, position: j.position,
          prediction: pick, home: homeGoals, away: awayGoals,
          quiz: answers, mode: answers.mode || 'quick',
        }));
      } catch {}
      navigate(`/voita/${slug}/kiitos`);
    } catch (e) {
      setServerError(e.message || 'Network');
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

  const mode = answers.mode || 'quick';

  return (
    <div data-testid="voita-raffle-page" style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px 64px', color: 'var(--ink)' }}>
      <ProgressBar step={stepNumber} total={TOTAL_BEATS} />

      <AnimatePresence mode="wait">
        {step === 'quiz' && (
          <motion.div key={`quiz-${quizIdx}`} {...slideIn}>
            <QuizScreen
              q={quiz[quizIdx]} idx={quizIdx} total={quiz.length}
              answers={answers} setAnswers={setAnswers}
              onAdvance={advanceQuiz} lang={lang}
            />
          </motion.div>
        )}
        {step === 'reveal' && (
          <motion.div key="reveal" {...slideIn}>
            <RevealOpenRaffles sports={answers.sports || []} onAdvance={afterReveal} lang={lang} />
          </motion.div>
        )}
        {step === 'email' && (
          <motion.div key="email" {...slideIn}>
            <EmailGate
              email={email} setEmail={setEmail}
              displayName={displayName} setDisplayName={setDisplayName}
              age={age} setAge={setAge} rules={rules} setRules={setRules}
              onSubmit={saveLeadAndAdvance} busy={busy} error={emailError} lang={lang}
            />
          </motion.div>
        )}
        {step === 'match' && (
          <motion.div key="match" {...slideIn}>
            <PredictionMatch raffle={raffle} lang={lang} onAdvance={() => setStep('pick')} />
          </motion.div>
        )}
        {step === 'pick' && (
          <motion.div key="pick" {...slideIn}>
            <Predict1X2
              raffle={raffle} ctx={ctx} mode={mode}
              pick={pick} setPick={setPick}
              onAdvance={() => setStep('score')} lang={lang}
            />
          </motion.div>
        )}
        {step === 'score' && (
          <motion.div key="score" {...slideIn}>
            <PredictScore
              raffle={raffle} ctx={ctx} mode={mode}
              homeGoals={homeGoals} awayGoals={awayGoals}
              setHomeGoals={setHomeGoals} setAwayGoals={setAwayGoals}
              onAdvance={() => setStep('review')} lang={lang}
            />
          </motion.div>
        )}
        {step === 'review' && (
          <motion.div key="review" {...slideIn}>
            <PredictReview
              raffle={raffle} pick={pick}
              homeGoals={homeGoals} awayGoals={awayGoals}
              skillAnswer={answers.skill}
              onSubmit={submitEntry} busy={busy} error={serverError} lang={lang}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
