/**
 * PUTKI HQ — Mestari standalone diagnostic.
 *
 * Cold-acquisition workhorse. 5 quiz questions, 1-line zinger after each,
 * one-paragraph result tease, email gate ("Send me my report"),
 * confirmation. Drip-queue scheduling is Slice 4 (deferred); for now the
 * email captures into voita_lead with source=mestari so the drip worker
 * can pick it up when it ships.
 *
 * Reuses backend endpoints:
 *   GET  /api/settings/public            → voita_quiz_config + voita_predictor_profiles
 *   POST /api/voita/profile/resolve      → resolved profile from tags
 *   POST /api/voita/lead                 → lead capture (source=mestari)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Persistent home link — shared layout pattern.
const BackToHome = ({ lang }) => (
  <Link to="/" data-testid="back-to-home"
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      color: 'var(--ink, #ECE6D8)', textDecoration: 'none',
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.22em', fontWeight: 700,
      padding: '14px 0', opacity: 0.7,
      transition: 'opacity 200ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}>
    ← PUTKI <span style={{ color: 'var(--muted, #9C9587)' }}>HQ</span>
  </Link>
);

const slideIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.32, ease: [0.2, 0.7, 0.3, 1] },
};

// ── Quiz step ──────────────────────────────────────────────────────────
const QuestionStep = ({ q, idx, total, answers, setAnswers, onAdvance, lang }) => {
  const title = lang === 'en' ? q.title_en : q.title_fi;
  const sub = lang === 'en' ? q.sub_en : q.sub_fi;
  const lessonTitle = lang === 'en' ? (q.lesson_title_en || '') : (q.lesson_title_fi || '');
  const lessonNum = q.lesson_number || idx + 1;
  const answer = answers[q.key];
  const pick = (v) => {
    setAnswers({ ...answers, [q.key]: v });
    if (q.auto !== false) setTimeout(onAdvance, 320);
  };
  return (
    <div data-testid={`mestari-q-${q.key}`}>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', color: '#5B8DEE', fontWeight: 700, marginBottom: 10,
      }}>
        {lang === 'en' ? `QUESTION ${lessonNum} OF ${total}` : `KYSYMYS ${lessonNum} / ${total}`}
        {lessonTitle ? ` · ${lessonTitle.toUpperCase()}` : ''}
      </div>
      <h2 data-testid="mestari-q-title" style={{
        fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)',
        margin: '0 0 12px', letterSpacing: '-0.015em', lineHeight: 1.2,
      }}>{title}</h2>
      {sub && (
        <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '0 0 24px', lineHeight: 1.55 }}>{sub}</p>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {(q.options || []).map((o) => {
          const selected = answer === o.v;
          return (
            <motion.button key={o.v} whileTap={{ scale: 0.98 }} type="button"
              onClick={() => pick(o.v)}
              data-testid={`mestari-option-${q.key}-${o.v}`}
              style={{
                padding: '16px 18px', textAlign: 'left',
                background: selected ? 'rgba(91,141,238,0.12)' : 'var(--surface, #141210)',
                border: `1px solid ${selected ? '#5B8DEE' : 'var(--hairline, #221E1B)'}`,
                color: 'var(--ink)', fontSize: 14.5, lineHeight: 1.4,
                fontFamily: 'Georgia, serif', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
              <span style={{ fontSize: 20 }}>{o.emoji || '·'}</span>
              <span>{lang === 'en' ? o.label_en : o.label_fi}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// ── Zinger card (1-line reveal, 2s auto-advance, tap-to-skip) ──────────
const Zinger = ({ q, answer, onContinue, lang, isLast }) => {
  React.useEffect(() => {
    if (!q) return;
    const t = setTimeout(onContinue, 2000);
    return () => clearTimeout(t);
  }, [q, onContinue]);
  if (!q) return null;
  let zinger = lang === 'en' ? (q.zinger_en || '') : (q.zinger_fi || '');
  if (answer) {
    const opt = (q.options || []).find((o) => o.v === answer);
    const per = opt && (lang === 'en' ? opt.zinger_personalized_en : opt.zinger_personalized_fi);
    if (per) zinger = per;
  }
  const cta = lang === 'en'
    ? (isLast ? 'SEE YOUR PROFILE →' : 'CONTINUE →')
    : (isLast ? 'NÄYTÄ PROFIILISI →' : 'JATKA →');
  return (
    <div data-testid={`mestari-zinger-${q.key}`} onClick={onContinue}
      style={{
        padding: '40px 22px 32px', cursor: 'pointer',
        minHeight: 240, display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
      }}>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', color: '#5B8DEE', fontWeight: 700, marginBottom: 14,
      }}>
        {lang === 'en' ? `LESSON ${q.lesson_number} · IN YOUR PLAYBOOK` : `OPPI ${q.lesson_number} · PELIKIRJASSASI`}
      </div>
      <p data-testid="mestari-zinger-text" style={{
        fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)',
        lineHeight: 1.3, letterSpacing: '-0.01em', margin: '0 0 22px',
      }}>{zinger}</p>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>{cta}</div>
    </div>
  );
};

// ── Result tease ───────────────────────────────────────────────────────
const Tease = ({ profile, loading, onContinue, lang }) => {
  if (loading || !profile) {
    return (
      <div data-testid="mestari-tease-loading" style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {lang === 'en' ? 'COMPILING YOUR PROFILE…' : 'KOOSTAN PROFIILIASI…'}
        </div>
      </div>
    );
  }
  const name = lang === 'en' ? profile.name_en : profile.name_fi;
  const tease = lang === 'en' ? (profile.on_site_tease_en || profile.diagnosis_en || '') : (profile.on_site_tease_fi || profile.diagnosis_fi || '');
  return (
    <div data-testid="mestari-tease">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#5B8DEE', fontWeight: 700, marginBottom: 10 }}>
        {lang === 'en' ? 'YOUR PROFILE' : 'PROFIILISI'}
      </div>
      <h2 data-testid="mestari-profile-name" style={{
        fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: 'var(--ink)',
        margin: '0 0 16px', letterSpacing: '-0.02em', lineHeight: 1.05,
      }}>{name}</h2>
      <p data-testid="mestari-tease-paragraph" style={{
        color: 'var(--ink)', fontSize: 15, lineHeight: 1.6, margin: '0 0 22px', opacity: 0.94,
      }}>{tease}</p>
      <div style={{
        padding: '14px 16px', marginBottom: 28,
        background: 'rgba(91,141,238,0.08)', border: '1px solid rgba(91,141,238,0.3)',
      }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: '#5B8DEE', fontWeight: 700, marginBottom: 6 }}>
          {lang === 'en' ? 'LOCKED — EMAIL UNLOCKS' : 'LUKITTU — SÄHKÖPOSTI AVAA'}
        </div>
        <p style={{ color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.55, margin: 0, opacity: 0.9 }}>
          {lang === 'en'
            ? 'Full report: diagnosis · weakness · edge · what we\'ll do for you · plus a 5-day playbook on reading betting markets, one lesson per day.'
            : 'Täysi raportti: diagnoosi · heikkous · etu · mitä teemme puolestasi · sekä 5 päivän pelikirja vedonvälitysmarkkinoiden lukemiseen, yksi oppi päivässä.'}
        </p>
      </div>
      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={onContinue}
        data-testid="mestari-tease-continue"
        style={{
          padding: '15px 22px', width: '100%',
          background: '#5B8DEE', color: '#0B0A09', border: 0,
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
        }}>{lang === 'en' ? 'SEND ME MY REPORT →' : 'LÄHETÄ RAPORTTINI →'}</motion.button>
    </div>
  );
};

// ── Email gate ─────────────────────────────────────────────────────────
const Gate = ({ email, setEmail, rules, setRules, onSubmit, busy, error, lang }) => {
  const canSubmit = !!email && rules && !busy;
  return (
    <div data-testid="mestari-gate">
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#5B8DEE', fontWeight: 700, marginBottom: 8 }}>
        {lang === 'en' ? 'SEND ME MY REPORT' : 'LÄHETÄ RAPORTTINI'}
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.15 }}>
        {lang === 'en' ? 'Where do we send your playbook?' : 'Mihin lähetämme pelikirjasi?'}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
        {lang === 'en'
          ? 'Full report in 5 minutes. Lesson 1 tomorrow at 09:00. No spam — unsubscribe anytime.'
          : 'Täysi raportti 5 minuutissa. Oppi 1 huomenna klo 09. Ei spämmiä — peruuta milloin tahansa.'}
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={lang === 'en' ? 'your@email.com' : 'sähköpostisi@osoite.fi'}
          data-testid="mestari-email-input"
          style={{
            padding: '14px 16px', background: 'var(--surface)',
            border: '1px solid var(--hairline)', color: 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: '0.02em',
            outline: 'none',
          }} />
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)}
            data-testid="mestari-rules-checkbox"
            style={{ marginTop: 2, width: 18, height: 18 }} />
          <span style={{ lineHeight: 1.5, opacity: 0.92 }}>
            {lang === 'en'
              ? "I accept the privacy policy and want to receive the report + 5-day playbook."
              : 'Hyväksyn tietosuojan ja haluan vastaanottaa raportin + 5 päivän pelikirjan.'}
          </span>
        </label>
        {error && (
          <div data-testid="mestari-error" style={{
            color: '#C13B2C', fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.05em',
          }}>{error}</div>
        )}
        <motion.button whileTap={{ scale: 0.97 }} type="button"
          onClick={onSubmit} disabled={!canSubmit}
          data-testid="mestari-submit"
          style={{
            padding: '15px 22px',
            background: canSubmit ? '#5B8DEE' : 'var(--surface)',
            color: canSubmit ? '#0B0A09' : 'var(--muted)',
            border: canSubmit ? 0 : '1px solid var(--hairline)',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.22em', fontWeight: 800,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
          {busy ? '…' : (lang === 'en' ? 'SEND MY REPORT →' : 'LÄHETÄ RAPORTTI →')}
        </motion.button>
      </div>
    </div>
  );
};

// ── Confirmation ───────────────────────────────────────────────────────
const Confirmation = ({ email, profileName, lang }) => (
  <div data-testid="mestari-confirm">
    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#6FA37D', fontWeight: 700, marginBottom: 10 }}>
      ✓ {lang === 'en' ? 'PLAYBOOK ON ITS WAY' : 'PELIKIRJA MATKALLA'}
    </div>
    <h2 style={{
      fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 700, color: 'var(--ink)',
      margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.05,
    }}>{lang === 'en' ? 'Check your inbox.' : 'Tarkista sähköpostisi.'}</h2>
    <p style={{ color: 'var(--ink)', fontSize: 15, lineHeight: 1.6, margin: '0 0 6px', opacity: 0.94 }}>
      {lang === 'en' ? 'Your full report' : 'Täysi raporttisi'}
      {profileName && (lang === 'en' ? ` (${profileName})` : ` (${profileName})`)}
      {lang === 'en' ? ' lands at ' : ' saapuu osoitteeseen '}
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#5B8DEE' }}>{email}</span>
      {lang === 'en' ? ' within 5 minutes.' : ' 5 minuutin sisällä.'}
    </p>
    <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, margin: '0 0 24px' }}>
      {lang === 'en'
        ? "Lesson 1 of 5 arrives tomorrow at 09:00. One per day. Read at your pace."
        : 'Oppi 1/5 saapuu huomenna klo 09. Yksi per päivä. Lue omassa tahdissasi.'}
    </p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Link to="/voita" data-testid="mestari-confirm-voita"
        style={{
          padding: '13px 22px', background: 'var(--surface)', color: 'var(--ink)',
          border: '1px solid var(--border-strong)', textDecoration: 'none',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700,
        }}>{lang === 'en' ? 'THIS WEEK\'S RAFFLE →' : 'TÄMÄN VIIKON ARVONTA →'}</Link>
      <Link to="/" data-testid="mestari-confirm-home"
        style={{
          padding: '13px 22px', background: 'transparent', color: 'var(--muted)',
          border: '1px solid var(--hairline)', textDecoration: 'none',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700,
        }}>{lang === 'en' ? 'BACK TO PUTKI HQ' : 'TAKAISIN PUTKI HQ'}</Link>
    </div>
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────
const Mestari = () => {
  const { lang } = useLang();
  const [quiz, setQuiz] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState('intro');
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useDocumentMeta({
    title: lang === 'en' ? 'Mestari — What kind of bettor are you?' : 'Mestari — Mikä bettaaja sinä olet?',
    description: lang === 'en'
      ? "90-second diagnostic. Personal report + 5-day playbook to your inbox. Free, no deposit, no betting."
      : '90-sekunnin diagnostiikka. Henkilökohtainen raportti + 5 päivän pelikirja sähköpostiisi. Ilmainen.',
    canonical: `${BACKEND}/mestari`,
  });

  useEffect(() => {
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && Array.isArray(d.voita_quiz_config)) setQuiz(d.voita_quiz_config);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const composeTags = useCallback(() => {
    const tags = {};
    for (const q of quiz) {
      const v = answers[q.key];
      if (!v) continue;
      const opt = (q.options || []).find((o) => o.v === v);
      if (opt) tags[q.key] = opt.tag || opt.v;
    }
    return tags;
  }, [quiz, answers]);

  const advanceQ = useCallback(() => {
    setStep('zinger');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
  }, []);

  const afterZinger = useCallback(async () => {
    if (qIdx + 1 < quiz.length) {
      setQIdx(qIdx + 1);
      setStep('quiz');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
      return;
    }
    setProfileLoading(true);
    setStep('tease');
    try {
      const r = await fetch(`${BACKEND}/api/voita/profile/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: composeTags() }),
      });
      const j = await r.json();
      setProfile(j.profile || null);
    } catch { setProfile(null); }
    finally { setProfileLoading(false); }
  }, [qIdx, quiz.length, composeTags]);

  const submitLead = async () => {
    if (!email || !rules) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, raffle_slug: null, age_18_plus: true,
          favorite_sport: null, bet_frequency: null, sportsbooks: [],
          confidence: null, quiz_tags: composeTags(), lang,
          source: 'mestari',
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.detail || `HTTP ${r.status}`);
        return;
      }
      setStep('confirm');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop: cosmetic */ }
    } catch (e) {
      setError(e.message || 'Network');
    } finally { setBusy(false); }
  };

  const total = quiz.length || 5;
  const stepNumber = useMemo(() => {
    if (step === 'intro') return 0;
    if (step === 'quiz') return qIdx + 1;
    if (step === 'zinger') return qIdx + 1.5;
    if (step === 'tease') return total + 0.5;
    if (step === 'gate') return total + 1;
    if (step === 'confirm') return total + 2;
    return 0;
  }, [step, qIdx, total]);
  const progressPct = Math.min(100, Math.round((stepNumber / (total + 2)) * 100));

  return (
    <div data-testid="mestari-page" style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px 56px' }}>
      <BackToHome lang={lang} />

      {/* Progress strip */}
      {step !== 'intro' && step !== 'confirm' && (
        <div style={{
          height: 3, background: 'var(--hairline, #221E1B)', marginBottom: 36,
          position: 'relative', overflow: 'hidden',
        }}>
          <motion.div
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
            style={{
              height: '100%', background: '#5B8DEE',
              boxShadow: '0 0 12px rgba(91,141,238,0.4)',
            }} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div key="intro" {...slideIn} data-testid="mestari-intro">
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.24em', color: '#5B8DEE', fontWeight: 700, marginBottom: 16 }}>
              MESTARI · {lang === 'en' ? 'EDITORIAL DIAGNOSTIC' : 'TOIMITUKSELLINEN DIAGNOSTIIKKA'}
            </div>
            <h1 style={{
              fontFamily: 'Georgia, serif', fontWeight: 700,
              fontSize: 'clamp(36px, 5.5vw, 52px)', lineHeight: 1.05,
              letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 22px',
            }}>{lang === 'en' ? 'What kind of bettor are you?' : 'Mikä bettaaja sinä olet?'}</h1>
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, margin: '0 0 28px', maxWidth: 480 }}>
              {lang === 'en'
                ? '90-second diagnostic. Personal report + 5-day playbook on reading betting markets. Free. No deposit. No betting.'
                : '90-sekunnin diagnostiikka. Henkilökohtainen raportti + 5 päivän pelikirja vedonvälitysmarkkinoiden lukemiseen. Ilmainen. Ei talletusta. Ei vedonlyöntiä.'}
            </p>
            <motion.button whileTap={{ scale: 0.97 }} type="button"
              onClick={() => setStep('quiz')}
              data-testid="mestari-start-cta"
              disabled={!loaded || quiz.length === 0}
              style={{
                padding: '16px 28px', width: '100%',
                background: '#5B8DEE', color: '#0B0A09', border: 0,
                fontFamily: 'ui-monospace, monospace', fontSize: 12.5,
                letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
              }}>{lang === 'en' ? 'START THE DIAGNOSTIC →' : 'ALOITA DIAGNOSTIIKKA →'}</motion.button>
            <div style={{ marginTop: 18, display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700 }}>
              <span>{lang === 'en' ? '90 SEC' : '90 SEK'}</span>
              <span>·</span>
              <span>{lang === 'en' ? 'FREE' : 'ILMAINEN'}</span>
              <span>·</span>
              <span>{lang === 'en' ? 'EMAIL ONLY' : 'VAIN SÄHKÖPOSTI'}</span>
            </div>
          </motion.div>
        )}

        {step === 'quiz' && quiz[qIdx] && (
          <motion.div key={`q-${qIdx}`} {...slideIn}>
            <QuestionStep
              q={quiz[qIdx]} idx={qIdx} total={total}
              answers={answers} setAnswers={setAnswers}
              onAdvance={advanceQ} lang={lang}
            />
          </motion.div>
        )}

        {step === 'zinger' && quiz[qIdx] && (
          <motion.div key={`z-${qIdx}`} {...slideIn}>
            <Zinger
              q={quiz[qIdx]} answer={answers[quiz[qIdx].key]}
              onContinue={afterZinger} isLast={qIdx + 1 >= quiz.length} lang={lang}
            />
          </motion.div>
        )}

        {step === 'tease' && (
          <motion.div key="tease" {...slideIn}>
            <Tease profile={profile} loading={profileLoading}
              onContinue={() => setStep('gate')} lang={lang} />
          </motion.div>
        )}

        {step === 'gate' && (
          <motion.div key="gate" {...slideIn}>
            <Gate email={email} setEmail={setEmail}
              rules={rules} setRules={setRules}
              onSubmit={submitLead} busy={busy} error={error} lang={lang} />
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div key="confirm" {...slideIn}>
            <Confirmation email={email}
              profileName={profile ? (lang === 'en' ? profile.name_en : profile.name_fi) : ''}
              lang={lang} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Mestari;
