/**
 * PUTKI HQ — Voita raffle (post-Master-Brief).
 *
 * Pure 60-second prediction game. ZERO quiz / zinger / tease — that funnel
 * lives at `/mestari` now. This page exists only to capture a prediction
 * + a contact handle (Telegram primary, email fallback) so we can ping
 * the user with the result after kickoff.
 *
 * State machine:
 *   1. intro       — match hero with prize + entry count
 *   2. scout       — scout report (market consensus + team form + editorial)
 *   3. pick        — 1-X-2
 *   4. score       — exact score wheels
 *   5. confidence  — 1..5 confidence meter
 *   6. review      — prediction + max points reveal
 *   7. gate        — contact gate (Telegram deep-link primary · email fallback)
 *   8. confirm     — entry locked, "we'll ping you after kickoff"
 *
 * Telegram deep-link binding is stubbed to `t.me/Putkihq_bot?start={pending_id}`
 * — the real bot (Slice 3) will resolve the pending_id and DM the user
 * the entry confirmation + post-match result.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '../context/LanguageContext';
import RecentWinnersStrip from '../components/RecentWinnersStrip';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TELEGRAM_BOT = 'Putkihq_bot';

// ── Persistent home link (top-left) ────────────────────────────────────
const BackToHome = ({ lang }) => (
  <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px' }}>
    <Link to="/" data-testid="back-to-home"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: 'var(--ink)', textDecoration: 'none',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.22em', fontWeight: 700,
        padding: '14px 0', opacity: 0.7,
      }}>
      ← PUTKI <span style={{ color: 'var(--muted)' }}>HQ</span>
    </Link>
  </div>
);

const TOTAL_BEATS = 6; // intro→scout→pick→score→confidence→review (gate+confirm = epilogue)
const slideIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.32, ease: [0.2, 0.7, 0.3, 1] },
};

const ProgressBar = ({ step, total }) => (
  <div data-testid="progress-bar" style={{ marginBottom: 24, height: 3, background: 'var(--hairline)', position: 'relative', overflow: 'hidden' }}>
    <motion.div
      initial={false}
      animate={{ width: `${Math.min(100, Math.round((step / total) * 100))}%` }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
      style={{ height: '100%', background: '#E8C26E', boxShadow: '0 0 12px rgba(232,194,110,0.4)' }} />
  </div>
);

// ── Beat 1: Intro / match hero ─────────────────────────────────────────
const Intro = ({ raffle, onStart, lang }) => {
  const prize = (raffle.prize_distribution?.payouts || []).reduce((s, p) => s + (p.amount_eur || 0), 0);
  const kickoffStr = raffle.kickoff_at
    ? new Date(raffle.kickoff_at).toLocaleString(lang === 'en' ? 'en-GB' : 'fi-FI', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;
  return (
    <div data-testid="intro-step">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 12 }}>
        {(raffle.league || raffle.sport || '').toUpperCase()} · {lang === 'en' ? 'WEEKLY RAFFLE' : 'VIIKON ARVONTA'}
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontSize: 42, fontWeight: 700,
        color: 'var(--ink)', margin: '0 0 6px',
        letterSpacing: '-0.025em', lineHeight: 1.04,
      }}>{raffle.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {raffle.away_team}</h1>
      {kickoffStr && (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.10em', margin: '8px 0 18px' }}>
          {lang === 'en' ? 'KICKOFF · ' : 'ALKUSOITTO · '}{kickoffStr}
        </div>
      )}
      <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.55, margin: '6px 0 22px', maxWidth: 480 }}>
        {lang === 'en'
          ? 'Predict the result, lock in your entry, get pinged after kickoff. 60 seconds. Free. No deposit.'
          : 'Ennusta lopputulos, lukitse osallistuminen, saat ilmoituksen ottelun jälkeen. 60 sekuntia. Ilmainen. Ei talletusta.'}
      </p>
      <div style={{
        display: 'flex', gap: 14, padding: '14px 0',
        borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)',
        marginBottom: 24, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'PRIZE POOL' : 'PALKINTOPOTTI'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#E8C26E', lineHeight: 1 }}>€{prize}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>
            {lang === 'en' ? 'ENTRIES' : 'OSALLISTUNEET'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {raffle.entries_count || 0}
          </div>
        </div>
      </div>
      <motion.button whileTap={{ scale: 0.97 }} type="button"
        onClick={onStart} data-testid="intro-start-cta"
        style={{
          padding: '17px 28px', width: '100%',
          background: '#E8C26E', color: '#0B0A09',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
        }}>
        {lang === 'en' ? 'PLAY — 60 SECONDS →' : 'PELAA — 60 SEKUNTIA →'}
      </motion.button>
      <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.55, textAlign: 'center' }}>
        {lang === 'en' ? 'No betting. Editorial raffle. Rules apply.' : 'Ei vedonlyöntiä. Toimituksellinen arvonta. Säännöt voimassa.'}
      </p>
    </div>
  );
};

// ── Beat 2: Scout report ──────────────────────────────────────────────
const ScoutReport = ({ raffle, ctx, onAdvance, lang }) => {
  const odds = ctx?.odds;
  const form = ctx?.team_form;
  const dist = ctx?.pick_distribution;
  const editorial = ctx?.editorial_pick;

  // Strongest signal first — favourite
  const fav = odds ? ['home', 'draw', 'away'].reduce((best, k) => {
    const o = odds[k];
    if (!o) return best;
    if (!best || (o.implied_pct || 0) > (best.implied_pct || 0)) return { key: k, ...o };
    return best;
  }, null) : null;
  const favLabel = fav ? (fav.key === 'home' ? raffle.home_team : (fav.key === 'away' ? raffle.away_team : (lang === 'en' ? 'Draw' : 'Tasapeli'))) : null;

  return (
    <div data-testid="scout-step">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'SCOUT REPORT' : 'SKOUTTI­RAPORTTI'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 18px', letterSpacing: '-0.015em' }}>
        {lang === 'en' ? 'Here\u2019s what we know.' : 'Tässä mitä tiedämme.'}
      </h2>

      {fav ? (
        <div data-testid="scout-market" style={{
          padding: '14px 16px', marginBottom: 12,
          background: 'var(--surface)', border: '1px solid var(--hairline)',
        }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
            {lang === 'en' ? 'MARKET CONSENSUS' : 'MARKKINAKONSENSUS'}
          </div>
          <div style={{ color: 'var(--ink)', fontSize: 14, lineHeight: 1.55 }}>
            <strong style={{ color: '#E8C26E' }}>{favLabel}</strong>{' '}
            {lang === 'en' ? 'is favoured at' : 'on suosikki —'}{' '}
            <strong>{fav.implied_pct}%</strong>{' '}
            {lang === 'en' ? `implied probability across ${fav.n_books} bookmakers.` : `todennäköisyys ${fav.n_books} kirjassa.`}
          </div>
        </div>
      ) : null}

      {form && (form.home || form.away) && (
        <div data-testid="scout-form" style={{
          padding: '14px 16px', marginBottom: 12,
          background: 'var(--surface)', border: '1px solid var(--hairline)',
        }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
            {lang === 'en' ? 'RECENT FORM' : 'VIIME­MUOTO'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
            <div>
              <div style={{ opacity: 0.7, marginBottom: 2 }}>{raffle.home_team}</div>
              {form.home?.goals_per_game != null && <div>{lang === 'en' ? 'avg' : 'k.a.'} {form.home.goals_per_game} {lang === 'en' ? 'goals/game' : 'maalia/peli'}</div>}
              {form.home?.last_5 && <div style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.12em', fontSize: 11, opacity: 0.85 }}>{form.home.last_5}</div>}
            </div>
            <div>
              <div style={{ opacity: 0.7, marginBottom: 2 }}>{raffle.away_team}</div>
              {form.away?.goals_per_game != null && <div>{lang === 'en' ? 'avg' : 'k.a.'} {form.away.goals_per_game} {lang === 'en' ? 'goals/game' : 'maalia/peli'}</div>}
              {form.away?.last_5 && <div style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.12em', fontSize: 11, opacity: 0.85 }}>{form.away.last_5}</div>}
            </div>
          </div>
        </div>
      )}

      {editorial && (editorial.rationale_en || editorial.rationale_fi) && (
        <div data-testid="scout-editorial" style={{
          padding: '14px 16px', marginBottom: 12,
          background: '#1a1810', border: '1px solid rgba(232,194,110,0.35)',
        }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 6 }}>
            {lang === 'en' ? 'TOIMITUS · EDITORIAL READ' : 'TOIMITUKSEN VEIKKAUS'}
          </div>
          <div style={{ color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.55 }}>
            {(lang === 'en' ? editorial.rationale_en : editorial.rationale_fi) || ((lang === 'en' ? 'Editorial picks ' : 'Toimitus veikkaa ') + (editorial.one_x_two || ''))}
          </div>
        </div>
      )}

      {dist && dist.total > 0 && (
        <div data-testid="scout-distribution" style={{
          padding: '14px 16px', marginBottom: 16,
          background: 'var(--surface)', border: '1px solid var(--hairline)',
        }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
            {lang === 'en' ? 'OTHER PLAYERS PICKED' : 'MUUT PELAAJAT VEIKKASIVAT'}
          </div>
          <div style={{ display: 'flex', gap: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ink)' }}>
            <span><strong style={{ color: '#E8C26E' }}>{dist.pct?.['1'] || 0}%</strong> · 1</span>
            <span><strong style={{ color: '#E8C26E' }}>{dist.pct?.['X'] || 0}%</strong> · X</span>
            <span><strong style={{ color: '#E8C26E' }}>{dist.pct?.['2'] || 0}%</strong> · 2</span>
          </div>
        </div>
      )}

      <motion.button whileTap={{ scale: 0.97 }} type="button"
        onClick={onAdvance} data-testid="scout-continue"
        style={{
          padding: '15px 22px', width: '100%',
          background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
        }}>{lang === 'en' ? 'MAKE YOUR PICK →' : 'TEE VEIKKAUKSESI →'}</motion.button>
    </div>
  );
};

// ── Beat 3: 1-X-2 pick ─────────────────────────────────────────────────
const PickStep = ({ raffle, ctx, pick, setPick, onAdvance, lang }) => {
  const odds = ctx?.odds;
  const optionMeta = (v) => {
    if (!odds) return null;
    const key = v === '1' ? 'home' : (v === 'X' ? 'draw' : 'away');
    const o = odds[key];
    if (!o) return null;
    return { line: `${o.avg_decimal} · ${o.implied_pct}%` };
  };
  return (
    <div data-testid="prediction-pick">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'WHO WINS?' : 'KUKA VOITTAA?'}
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
                border: `1px solid ${active ? 'var(--ink)' : 'var(--border-strong)'}`,
              }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', opacity: active ? 0.7 : 0.55, marginTop: 6 }}>{opt.sub.toUpperCase()}</div>
              {meta && (
                <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 10, color: active ? '#E8C26E' : 'var(--muted)' }}>
                  {meta.line}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
      <motion.button whileTap={{ scale: 0.97 }} type="button"
        onClick={onAdvance} disabled={!pick}
        data-testid="predict-pick-continue"
        style={{
          marginTop: 18, padding: '14px 22px', width: '100%',
          background: pick ? '#E8C26E' : 'var(--surface)',
          color: pick ? '#0B0A09' : 'var(--muted)',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: pick ? 'pointer' : 'not-allowed',
        }}>{lang === 'en' ? 'PREDICT SCORE →' : 'ENNUSTA TULOS →'}</motion.button>
    </div>
  );
};

// ── Beat 4: Score wheels ───────────────────────────────────────────────
const ScoreStep = ({ raffle, homeGoals, awayGoals, setHomeGoals, setAwayGoals, onAdvance, lang }) => {
  const Step = ({ team, value, setValue, tid }) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => setValue(Math.max(0, value - 1))}
          data-testid={`predict-score-${tid}-minus`}
          style={{ width: 38, height: 38, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'Georgia, serif', fontSize: 22, cursor: 'pointer' }}>−</motion.button>
        <div data-testid={`predict-score-${tid}-value`} style={{ width: 60, fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => setValue(Math.min(20, value + 1))}
          data-testid={`predict-score-${tid}-plus`}
          style={{ width: 38, height: 38, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'Georgia, serif', fontSize: 22, cursor: 'pointer' }}>+</motion.button>
      </div>
    </div>
  );
  return (
    <div data-testid="prediction-score">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'WHAT\u2019S THE SCORE?' : 'LOPPUTULOS?'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.015em' }}>
        {lang === 'en' ? 'Pick the exact score.' : 'Veikkaa tarkka tulos.'}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        {lang === 'en' ? 'Closest score wins. Ties broken by exact → goal-difference → total.' : 'Lähimmäs voittaa. Tasatilanne: tarkka → maaliero → kokonaismaalit.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 0', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <Step team={raffle.home_team || 'HOME'} value={homeGoals} setValue={setHomeGoals} tid="home" />
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'var(--muted)', marginTop: 20 }}>—</span>
        <Step team={raffle.away_team || 'AWAY'} value={awayGoals} setValue={setAwayGoals} tid="away" />
      </div>
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onAdvance}
        data-testid="predict-score-continue"
        style={{
          marginTop: 18, padding: '14px 22px', width: '100%',
          background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: 'pointer',
        }}>{lang === 'en' ? 'SET CONFIDENCE →' : 'ASETA VARMUUS →'}</motion.button>
    </div>
  );
};

// ── Beat 5: Confidence meter ───────────────────────────────────────────
const ConfidenceStep = ({ confidence, setConfidence, onAdvance, lang }) => {
  const labelsFi = ['Veikkaus', 'Mutu', 'Tutkittu', 'Vahva', 'Lukko'];
  const labelsEn = ['Random', 'Hunch', 'Studied', 'Strong', 'Locked'];
  const labels = lang === 'en' ? labelsEn : labelsFi;
  return (
    <div data-testid="prediction-confidence">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'HOW SURE ARE YOU?' : 'KUINKA VARMA OLET?'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 18px', letterSpacing: '-0.015em' }}>
        {lang === 'en' ? 'Set your confidence.' : 'Aseta varmuutesi.'}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = confidence === n;
          return (
            <motion.button key={n} type="button" whileTap={{ scale: 0.95 }}
              data-testid={`confidence-${n}`}
              onClick={() => setConfidence(n)}
              style={{
                padding: '18px 6px', textAlign: 'center', cursor: 'pointer',
                background: active ? '#E8C26E' : 'var(--surface)',
                color: active ? '#0B0A09' : 'var(--ink)',
                border: `1px solid ${active ? '#E8C26E' : 'var(--border-strong)'}`,
              }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{n}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.14em', marginTop: 4, opacity: active ? 0.8 : 0.55 }}>{labels[n - 1].toUpperCase()}</div>
            </motion.button>
          );
        })}
      </div>
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
        {lang === 'en'
          ? 'Confidence is a self-report. It doesn\u2019t change scoring — but we\u2019ll show you whether sure picks hit more often.'
          : 'Varmuus on oma arviosi. Ei vaikuta pisteytykseen — mutta näytämme osuvatko varmat veikkaukset useammin.'}
      </p>
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onAdvance}
        disabled={!confidence}
        data-testid="confidence-continue"
        style={{
          marginTop: 18, padding: '14px 22px', width: '100%',
          background: confidence ? '#E8C26E' : 'var(--surface)',
          color: confidence ? '#0B0A09' : 'var(--muted)',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 700, cursor: confidence ? 'pointer' : 'not-allowed',
        }}>{lang === 'en' ? 'REVIEW →' : 'TARKISTA →'}</motion.button>
    </div>
  );
};

// ── Beat 6: Review ─────────────────────────────────────────────────────
const ReviewStep = ({ raffle, pick, homeGoals, awayGoals, confidence, onSubmit, lang }) => {
  const scoring = raffle.scoring || {};
  const maxPoints = (scoring.one_x_two_points || 3) + (scoring.exact_score_points || 5);
  return (
    <div data-testid="prediction-review">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'YOUR PREDICTION' : 'VEIKKAUKSESI'}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.34, ease: [0.2, 0.7, 0.3, 1] }}
        style={{ padding: '22px 22px', background: 'var(--surface)', border: '1px solid var(--hairline)', marginBottom: 18 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: 'var(--muted)', marginBottom: 4 }}>
          {raffle.home_team} <span style={{ color: 'var(--ink)' }}>{homeGoals}</span> — <span style={{ color: 'var(--ink)' }}>{awayGoals}</span> {raffle.away_team}
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginTop: 8 }}>
          {lang === 'en' ? 'PICK' : 'VEIKKAUS'} · {pick}{' · '}
          {lang === 'en' ? 'CONFIDENCE' : 'VARMUUS'} {confidence}/5
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
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onSubmit}
        data-testid="review-continue"
        style={{
          padding: '16px 22px', width: '100%',
          background: '#E8C26E', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
        }}>{lang === 'en' ? 'LOCK IT IN →' : 'LUKITSE →'}</motion.button>
    </div>
  );
};

// ── Beat 7: Contact gate (Telegram primary, email fallback) ────────────
const ContactGate = ({ pendingId, email, setEmail, age, setAge, rules, setRules, displayName, setDisplayName, onTelegram, onEmail, busy, error, lang }) => {
  const tgUrl = `https://t.me/${TELEGRAM_BOT}?start=${pendingId}`;
  const canEmail = !!email && age && rules && !busy;
  return (
    <div data-testid="contact-gate">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'ONE STEP LEFT' : 'YKSI VAIHE JÄLJELLÄ'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.15 }}>
        {lang === 'en' ? 'How should we ping you the result?' : 'Miten ilmoitamme tuloksen?'}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
        {lang === 'en'
          ? 'After kickoff we send you whether you won and where you ranked. One ping. No spam.'
          : 'Ottelun jälkeen kerromme voititko ja missä sijoituksessa. Yksi viesti. Ei spämmiä.'}
      </p>

      {/* Telegram — primary */}
      <a href={tgUrl} target="_blank" rel="noopener noreferrer"
        data-testid="contact-gate-telegram"
        onClick={onTelegram}
        style={{
          display: 'block', textDecoration: 'none',
          padding: '17px 22px', marginBottom: 14,
          background: '#229ED9', color: '#FFFFFF',
          fontFamily: 'ui-monospace, monospace', fontSize: 12.5,
          letterSpacing: '0.20em', fontWeight: 800,
          textAlign: 'center',
          boxShadow: '0 0 24px rgba(34,158,217,0.25)',
        }}>
        {lang === 'en' ? 'OPEN IN TELEGRAM →' : 'AVAA TELEGRAMISSA →'}
      </a>
      <p data-testid="contact-gate-telegram-explain" style={{
        fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.55,
        marginTop: -4, marginBottom: 22, textAlign: 'center',
      }}>
        {lang === 'en'
          ? `Opens @${TELEGRAM_BOT}. Tap START and your entry locks instantly.`
          : `Avaa @${TELEGRAM_BOT}. Paina START — osallistumisesi lukittuu heti.`}
      </p>

      {/* divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 18px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {lang === 'en' ? 'OR EMAIL' : 'TAI SÄHKÖPOSTILLA'}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
      </div>

      {/* Email — fallback */}
      <div style={{ display: 'grid', gap: 12 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={lang === 'en' ? 'your@email.com' : 'sähköpostisi@osoite.fi'}
          data-testid="contact-gate-email-input"
          style={{
            padding: '13px 14px', background: 'var(--surface)',
            border: '1px solid var(--hairline)', color: 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: '0.02em',
            outline: 'none',
          }} />
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
          placeholder={lang === 'en' ? 'Display name (optional, max 40 chars)' : 'Nimi (vapaaehtoinen, max 40 merkkiä)'}
          maxLength={40}
          data-testid="contact-gate-displayname-input"
          style={{
            padding: '13px 14px', background: 'var(--surface)',
            border: '1px solid var(--hairline)', color: 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 13, letterSpacing: '0.02em',
            outline: 'none',
          }} />
        <label style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', lineHeight: 1.5 }}>
          <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)}
            data-testid="contact-gate-age-checkbox"
            style={{ marginTop: 2, width: 18, height: 18 }} />
          <span>{lang === 'en' ? 'I am 18 years or older.' : 'Olen 18 vuotta täyttänyt.'}</span>
        </label>
        <label style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', lineHeight: 1.5 }}>
          <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)}
            data-testid="contact-gate-rules-checkbox"
            style={{ marginTop: 2, width: 18, height: 18 }} />
          <span>
            {lang === 'en' ? 'I accept the ' : 'Hyväksyn '}
            <Link to="/voita/saannot" target="_blank" style={{ color: '#E8C26E' }}>
              {lang === 'en' ? 'raffle rules' : 'arvonnan säännöt'}
            </Link>{lang === 'en' ? '.' : '.'}
          </span>
        </label>
        {error && (
          <div data-testid="contact-gate-error" style={{
            color: '#C13B2C', fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.05em',
          }}>{error}</div>
        )}
        <motion.button whileTap={{ scale: 0.97 }} type="button"
          onClick={onEmail} disabled={!canEmail}
          data-testid="contact-gate-email-submit"
          style={{
            padding: '14px 22px',
            background: canEmail ? 'var(--ink)' : 'var(--surface)',
            color: canEmail ? 'var(--bg)' : 'var(--muted)',
            border: canEmail ? 0 : '1px solid var(--hairline)',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.22em', fontWeight: 700,
            cursor: canEmail ? 'pointer' : 'not-allowed',
          }}>
          {busy ? '…' : (lang === 'en' ? 'LOCK IN BY EMAIL →' : 'LUKITSE SÄHKÖPOSTILLA →')}
        </motion.button>
      </div>
    </div>
  );
};

// ── Beat 8: Confirmation ───────────────────────────────────────────────
const Confirmation = ({ raffle, channel, pendingId, lang }) => (
  <div data-testid="confirm-step">
    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#6FA37D', fontWeight: 700, marginBottom: 10 }}>
      ✓ {lang === 'en' ? 'ENTRY LOCKED' : 'OSALLISTUMINEN LUKITTU'}
    </div>
    <h2 style={{
      fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 700, color: 'var(--ink)',
      margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.05,
    }}>{lang === 'en' ? 'You\u2019re in.' : 'Olet mukana.'}</h2>
    <p style={{ color: 'var(--ink)', fontSize: 15, lineHeight: 1.6, margin: '0 0 18px', opacity: 0.94 }}>
      {channel === 'telegram'
        ? (lang === 'en'
          ? `Open Telegram and press START on @${TELEGRAM_BOT} to confirm. We\u2019ll ping you the result after kickoff.`
          : `Avaa Telegram ja paina START botissa @${TELEGRAM_BOT} vahvistaaksesi. Ilmoitamme tuloksen ottelun jälkeen.`)
        : (lang === 'en'
          ? 'Result lands in your inbox after kickoff. One ping. No spam.'
          : 'Tulos saapuu sähköpostiisi ottelun jälkeen. Yksi viesti. Ei spämmiä.')}
    </p>
    {channel === 'telegram' && pendingId && (
      <a href={`https://t.me/${TELEGRAM_BOT}?start=${pendingId}`} target="_blank" rel="noopener noreferrer"
        data-testid="confirm-telegram-reopen"
        style={{
          display: 'inline-block', textDecoration: 'none', marginBottom: 18,
          padding: '12px 22px', background: '#229ED9', color: '#FFFFFF',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.20em', fontWeight: 800,
        }}>{lang === 'en' ? 'OPEN TELEGRAM →' : 'AVAA TELEGRAM →'}</a>
    )}
    <div style={{
      padding: '14px 16px', marginBottom: 22,
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      fontSize: 13, color: 'var(--ink)', lineHeight: 1.55,
    }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
        {lang === 'en' ? 'YOUR ENTRY' : 'OSALLISTUMISESI'}
      </div>
      {raffle.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {raffle.away_team}
    </div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Link to="/mestari" data-testid="confirm-mestari-cta"
        style={{
          padding: '13px 22px', background: 'var(--surface)', color: 'var(--ink)',
          border: '1px solid var(--border-strong)', textDecoration: 'none',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700,
        }}>{lang === 'en' ? 'TAKE THE DIAGNOSTIC →' : 'TEE DIAGNOSTIIKKA →'}</Link>
      <Link to="/" data-testid="confirm-home"
        style={{
          padding: '13px 22px', background: 'transparent', color: 'var(--muted)',
          border: '1px solid var(--hairline)', textDecoration: 'none',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700,
        }}>{lang === 'en' ? 'BACK TO PUTKI HQ' : 'TAKAISIN PUTKI HQ'}</Link>
    </div>
  </div>
);

// ── Container ──────────────────────────────────────────────────────────
const VoitaRaffle = () => {
  const { lang } = useLang();
  const { slug } = useParams();
  const [raffle, setRaffle] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState('intro');
  const [pick, setPick] = useState('');
  const [homeGoals, setHomeGoals] = useState(1);
  const [awayGoals, setAwayGoals] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState(false);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [channel, setChannel] = useState(null); // 'telegram' | 'email'
  const [pendingId] = useState(() => {
    // Stable deep-link binding token. Slice 3 bot resolves this against
    // the entry record. UUID-style hex (no PII).
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  });

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
    const map = { intro: 0, scout: 1, pick: 2, score: 3, confidence: 4, review: 5, gate: 6, confirm: 6 };
    return map[step] ?? 0;
  }, [step]);

  const advance = useCallback((next) => {
    setStep(next);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);

  const submitEntry = useCallback(async (viaChannel) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${BACKEND}/api/voita/raffles/${slug}/enter`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || `pending+${pendingId}@putkihq.fi`,
          prediction_one_x_two: pick,
          predicted_home_goals: homeGoals,
          predicted_away_goals: awayGoals,
          rules_accepted: true,
          display_name: displayName.trim() || null,
          confidence,
          contact_channel: viaChannel,
          pending_id: pendingId,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || `HTTP ${res.status}`);
        return false;
      }
      try {
        sessionStorage.setItem(`voita:${slug}:entry`, JSON.stringify({
          entry_id: j.entry_id, position: j.position,
          prediction: pick, home: homeGoals, away: awayGoals,
          confidence, channel: viaChannel, pending_id: pendingId,
        }));
      } catch {}
      setChannel(viaChannel);
      return true;
    } catch (e) {
      setError(e.message || 'Network');
      return false;
    } finally { setBusy(false); }
  }, [busy, slug, email, pick, homeGoals, awayGoals, displayName, confidence, pendingId]);

  const handleTelegram = useCallback(async () => {
    // Fire-and-forget commit the entry with channel=telegram so the bot
    // can resolve `pending_id` when the user lands on /start. We don't
    // block the link click — the new tab opens immediately.
    submitEntry('telegram');
    advance('confirm');
  }, [submitEntry, advance]);

  const handleEmail = useCallback(async () => {
    if (!email || !age || !rules) return;
    const ok = await submitEntry('email');
    if (ok) advance('confirm');
  }, [email, age, rules, submitEntry, advance]);

  if (!loaded) return <div style={{ padding: 64, color: 'var(--muted)', textAlign: 'center' }} data-testid="voita-raffle-loading">…</div>;
  if (!raffle) {
    return (
      <div data-testid="voita-raffle-not-found" style={{ maxWidth: 720, margin: '64px auto', padding: '0 32px', color: 'var(--ink)' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32 }}>{lang === 'en' ? 'Raffle not found' : 'Arvontaa ei löydy'}</h1>
        <p><Link to="/voita" style={{ color: 'var(--ink)' }}>← Voita</Link></p>
      </div>
    );
  }

  return (
    <div data-testid="voita-raffle-page" style={{ color: 'var(--ink)' }}>
      <BackToHome lang={lang} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 24px 64px' }}>
        <RecentWinnersStrip />
        <ProgressBar step={stepNumber} total={TOTAL_BEATS} />

        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div key="intro" {...slideIn}>
              <Intro raffle={raffle} onStart={() => advance('scout')} lang={lang} />
            </motion.div>
          )}
          {step === 'scout' && (
            <motion.div key="scout" {...slideIn}>
              <ScoutReport raffle={raffle} ctx={ctx} onAdvance={() => advance('pick')} lang={lang} />
            </motion.div>
          )}
          {step === 'pick' && (
            <motion.div key="pick" {...slideIn}>
              <PickStep raffle={raffle} ctx={ctx} pick={pick} setPick={setPick}
                onAdvance={() => advance('score')} lang={lang} />
            </motion.div>
          )}
          {step === 'score' && (
            <motion.div key="score" {...slideIn}>
              <ScoreStep raffle={raffle}
                homeGoals={homeGoals} awayGoals={awayGoals}
                setHomeGoals={setHomeGoals} setAwayGoals={setAwayGoals}
                onAdvance={() => advance('confidence')} lang={lang} />
            </motion.div>
          )}
          {step === 'confidence' && (
            <motion.div key="confidence" {...slideIn}>
              <ConfidenceStep confidence={confidence} setConfidence={setConfidence}
                onAdvance={() => advance('review')} lang={lang} />
            </motion.div>
          )}
          {step === 'review' && (
            <motion.div key="review" {...slideIn}>
              <ReviewStep raffle={raffle} pick={pick}
                homeGoals={homeGoals} awayGoals={awayGoals}
                confidence={confidence}
                onSubmit={() => advance('gate')} lang={lang} />
            </motion.div>
          )}
          {step === 'gate' && (
            <motion.div key="gate" {...slideIn}>
              <ContactGate
                pendingId={pendingId}
                email={email} setEmail={setEmail}
                age={age} setAge={setAge}
                rules={rules} setRules={setRules}
                displayName={displayName} setDisplayName={setDisplayName}
                onTelegram={handleTelegram} onEmail={handleEmail}
                busy={busy} error={error} lang={lang} />
            </motion.div>
          )}
          {step === 'confirm' && (
            <motion.div key="confirm" {...slideIn}>
              <Confirmation raffle={raffle} channel={channel} pendingId={pendingId} lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VoitaRaffle;
