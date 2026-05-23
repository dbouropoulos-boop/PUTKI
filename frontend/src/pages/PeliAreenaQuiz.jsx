/**
 * PUTKI HQ — /peliareena/tietoisuustesti (Quiz Challenge) · iter55
 *
 * Phase 1 flagship game per Build Brief v2. Three states:
 *
 *   1. INTRO        — "10 kysymystä · ≈3 min" + "ALOITA"
 *   2. PLAYING      — 1 question at a time, options as cards, after pick
 *                     reveals the correct answer + a short explanation.
 *                     NO email required to play.
 *   3. PREVIEW      — score + persona name, with a locked panel for the
 *                     full personalized result (gated by email).
 *   4. UNLOCKED     — email captured → full persona breakdown, strengths,
 *                     gaps, tournament rank, share text.
 *
 * GDPR contract: consent checkbox MUST be ticked. Backend rejects without it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Lock, Trophy, Share2, ChevronRight } from 'lucide-react';
import GameIntroPanel from '../components/peliareena/GameIntroPanel';
import IdentityCardFlow from '../components/peliareena/IdentityCardFlow';
import { useLang } from '../context/LanguageContext';
import { pickPA, interpolate, langField } from '../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const post = async (path, body) => {
  const r = await fetch(`${BACKEND}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
};

const PeliAreenaQuiz = () => {
  const { lang } = useLang();
  const [stage, setStage] = useState('intro'); // intro · playing · preview · unlocked
  const [session, setSession] = useState(null); // { play_id, anon_id, questions, total }
  const [answers, setAnswers] = useState([]);   // [{ q_id, picked }]
  const [pickedNow, setPickedNow] = useState(null); // current question's chosen key
  const [previewResult, setPreviewResult] = useState(null);
  const [fullResult, setFullResult] = useState(null);

  const start = async () => {
    try {
      const s = await post('/api/mini-games/quiz/start');
      setSession(s);
      setAnswers([]);
      setPickedNow(null);
      setStage('playing');
    } catch (e) {
      alert(`Virhe: ${e.message}`);
    }
  };

  const currentIdx = answers.length;
  const currentQ = session?.questions?.[currentIdx];
  const total = session?.total || 0;

  const pick = (key) => {
    if (pickedNow) return; // already revealed for this question
    setPickedNow(key);
  };

  const next = async () => {
    if (!pickedNow) return;
    const newAnswers = [...answers, { q_id: currentQ.id, picked: pickedNow }];
    setAnswers(newAnswers);
    setPickedNow(null);

    if (newAnswers.length >= total) {
      // Finish
      try {
        const r = await post('/api/mini-games/quiz/finish', {
          play_id: session.play_id,
          anon_id: session.anon_id,
          answers: newAnswers,
        });
        setPreviewResult(r);
        setStage('preview');
      } catch (e) {
        alert(`Virhe lopetuksessa: ${e.message}`);
      }
    }
  };

  return (
    <div data-testid="peliareena-quiz" style={{ padding: '32px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
      <Link to="/peliareena" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> {pickPA(lang, 'hub.back')}
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="quiz_gambling_literacy"
          eyebrow={pickPA(lang, 'quiz.eyebrow')}
          headline={pickPA(lang, 'quiz.headline')}
          tagline={pickPA(lang, 'quiz.tagline')}
          howToPlay={[pickPA(lang, 'quiz.howTo.1'), pickPA(lang, 'quiz.howTo.2'), pickPA(lang, 'quiz.howTo.3')]}
          scoring={[pickPA(lang, 'quiz.score.1'), pickPA(lang, 'quiz.score.2'), pickPA(lang, 'quiz.score.3')]}
          ctaLabel={pickPA(lang, 'quiz.cta.start')}
          startTestId="quiz-start-btn"
          onStart={start}
        />
      )}
      {stage === 'playing' && currentQ && (
        <Playing
          lang={lang}
          q={currentQ}
          index={currentIdx}
          total={total}
          pickedNow={pickedNow}
          onPick={pick}
          onNext={next}
        />
      )}
      {stage === 'preview' && previewResult && (
        <Preview
          lang={lang}
          result={previewResult}
          session={session}
          fullResult={fullResult}
          onUnlocked={(full) => { setFullResult(full); }}
        />
      )}
    </div>
  );
};

// ── Intro ──────────────────────────────────────────────────────

const Intro = ({ onStart }) => (
  <div data-testid="quiz-intro">
    <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
      TIETOISUUSTESTI · ALOITTELIJA
    </div>
    <h1 style={{
      fontFamily: 'Georgia, serif', fontWeight: 700,
      fontSize: 'clamp(32px, 5vw, 48px)', lineHeight: 1.1,
      letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 16px',
    }}>
      10 kysymystä. ~3 minuuttia.<br />Saat välittömästi tietää, missä olet.
    </h1>
    <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6, color: 'var(--muted)', maxWidth: 600 }}>
      Tämä testi kattaa kolikkopelimatematiikan perusteet (RTP, volatiliteetti, house edge),
      bankroll-hallinnan, pelipsykologian ja vastuullisuuden. Pelaa ilman sähköpostia.
      Jokainen vastaus selitetään — opit silloinkin, kun vastaat väärin.
    </p>
    <button
      onClick={onStart}
      data-testid="quiz-start-btn"
      style={{
        marginTop: 28, padding: '14px 28px',
        background: 'var(--ink)', color: 'var(--bg)',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      Aloita testi <ChevronRight size={14} strokeWidth={2.5} />
    </button>
  </div>
);

// ── Playing ────────────────────────────────────────────────────

const Playing = ({ lang, q, index, total, pickedNow, onPick, onNext }) => {
  const progress = ((index + (pickedNow ? 1 : 0)) / total) * 100;
  return (
    <div data-testid={`quiz-question-${index + 1}`}>
      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', marginBottom: 8 }}>
          {interpolate(pickPA(lang, 'quiz.progress'), { n: index + 1, total })}
        </div>
        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--ink)', transition: 'width 220ms ease' }} />
        </div>
      </div>

      <h2 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(22px, 3.5vw, 28px)', lineHeight: 1.3,
        letterSpacing: '-0.01em', color: 'var(--ink)', margin: '0 0 20px',
      }}>
        {langField(q, 'prompt', lang) || q.prompt_fi}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {q.options.map(opt => {
          const isPicked = pickedNow === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onPick(opt.key)}
              disabled={!!pickedNow}
              data-testid={`quiz-option-${opt.key}`}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                border: `1px solid ${isPicked ? 'var(--ink)' : 'var(--border)'}`,
                background: isPicked ? 'var(--surface-2)' : 'var(--surface)',
                color: 'var(--ink)',
                borderRadius: 4,
                cursor: pickedNow ? 'default' : 'pointer',
                fontFamily: 'Georgia, serif',
                fontSize: 16,
                lineHeight: 1.4,
                transition: 'all 160ms ease',
                opacity: pickedNow && !isPicked ? 0.55 : 1,
                display: 'flex', gap: 12, alignItems: 'baseline',
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: '#5A7BB8', fontWeight: 700, flexShrink: 0 }}>{opt.key.toUpperCase()}</span>
              <span>{langField(opt, 'label', lang) || opt.label_fi}</span>
            </button>
          );
        })}
      </div>

      {pickedNow && (
        <RevealCard
          lang={lang}
          onNext={onNext}
          index={index}
          total={total}
        />
      )}
    </div>
  );
};

const RevealCard = ({ lang, onNext, index, total }) => (
  <div style={{
    marginTop: 24, padding: 16,
    background: 'var(--surface-2)', borderRadius: 4,
    border: '1px solid var(--border)',
  }}>
    <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
      {pickPA(lang, 'quiz.recorded')}
    </p>
    <button
      onClick={onNext}
      data-testid="quiz-next-btn"
      style={{
        marginTop: 12, padding: '10px 20px',
        background: 'var(--ink)', color: 'var(--bg)',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      {index + 1 >= total ? pickPA(lang, 'quiz.showResult') : pickPA(lang, 'quiz.next')} <ChevronRight size={12} strokeWidth={2.5} />
    </button>
  </div>
);

// ── Preview ────────────────────────────────────────────────────

const Preview = ({ lang, result, session, onUnlocked, fullResult }) => {
  return (
    <div data-testid="quiz-preview">
      {/* iter63 — Identity-first reveal + Micro-Yes ladder */}
      <IdentityCardFlow
        preview={result}
        session={session}
        gameSlug="quiz"
        unlockPath="/api/mini-games/quiz/unlock"
        onUnlocked={onUnlocked}
      />

      {/* Full unlocked detail panels render below after successful unlock */}
      {fullResult && (
        <div style={{ marginTop: 36 }}>
          <Unlocked lang={lang} result={fullResult} previewResult={result} />
        </div>
      )}

      {/* Per-question feedback retained as free educational payoff */}
      <div style={{ marginTop: 36, marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          {pickPA(lang, 'quiz.preview.feedbackHeading')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.answers.map((a) => (
            <AnswerFeedback key={a.q_id} a={a} lang={lang} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link to="/peliareena" data-testid="quiz-preview-back" style={{
          padding: '12px 20px',
          background: 'transparent', color: 'var(--ink)',
          border: '1px solid var(--ink)', borderRadius: 4,
          fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          {pickPA(lang, 'quiz.back')}
        </Link>
      </div>
    </div>
  );
};

const AnswerFeedback = ({ a, lang }) => {
  const ok = a.is_correct;
  const explanation = langField(a, 'explanation', lang) || a.explanation_fi;
  return (
    <div
      data-testid={`quiz-feedback-${a.order}`}
      style={{
        padding: 14,
        border: `1px solid ${ok ? '#3F8A4D' : '#C8423C'}`,
        borderLeft: `4px solid ${ok ? '#3F8A4D' : '#C8423C'}`,
        background: 'var(--surface)',
        borderRadius: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {ok ? <Check size={14} strokeWidth={2} style={{ color: '#3F8A4D' }} /> : <X size={14} strokeWidth={2} style={{ color: '#C8423C' }} />}
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: ok ? '#3F8A4D' : '#C8423C', fontWeight: 700 }}>
          {interpolate(pickPA(lang, 'quiz.preview.qLabel'), { n: a.order })} · {ok
            ? pickPA(lang, 'quiz.preview.correct')
            : interpolate(pickPA(lang, 'quiz.preview.wrong'), { key: a.correct.toUpperCase() })}
        </span>
      </div>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, margin: 0 }}>
        {explanation}
      </p>
    </div>
  );
};

// ── Email gate ─────────────────────────────────────────────────

const EmailGate = ({ lang, session, score, total, onUnlocked }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!consent) { setError(pickPA(lang, 'gate.consent.required')); return; }
    if (!email.includes('@')) { setError(pickPA(lang, 'gate.email.invalid')); return; }
    setSubmitting(true);
    try {
      const r = await post('/api/mini-games/quiz/unlock', {
        play_id: session.play_id,
        anon_id: session.anon_id,
        email, name, consent: true,
      });
      onUnlocked(r);
    } catch (e2) {
      setError(interpolate(pickPA(lang, 'gate.error.save'), { message: e2.message }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid="quiz-email-gate" style={{
      padding: 24,
      border: '2px solid var(--ink)',
      borderRadius: 6, background: 'var(--surface-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Trophy size={16} strokeWidth={1.8} style={{ color: 'var(--ink)' }} />
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}>
          {pickPA(lang, 'gate.eyebrow')}
        </span>
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {pickPA(lang, 'gate.defaultHeadline')}
      </h2>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 16px' }}>
        {pickPA(lang, 'gate.body')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={pickPA(lang, 'gate.email.placeholder')}
          data-testid="quiz-email-input"
          style={{
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'inherit', fontSize: 15,
            background: 'var(--bg)', color: 'var(--ink)',
          }}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={pickPA(lang, 'gate.name.placeholder')}
          data-testid="quiz-name-input"
          style={{
            padding: '12px 14px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'inherit', fontSize: 15,
            background: 'var(--bg)', color: 'var(--ink)',
          }}
        />
      </div>

      <label style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)',
        lineHeight: 1.5, marginBottom: 14, cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          data-testid="quiz-consent-checkbox"
          style={{ marginTop: 3, flexShrink: 0 }}
        />
        <span>
          {pickPA(lang, 'gate.consent')}{' '}
          <a href="/tietosuoja" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            {pickPA(lang, 'gate.consent.privacy')}
          </a>.
        </span>
      </label>

      {error && <p style={{ color: '#C8423C', fontFamily: 'Georgia, serif', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        data-testid="quiz-unlock-btn"
        style={{
          padding: '14px 24px',
          background: 'var(--ink)', color: 'var(--bg)',
          border: 'none', borderRadius: 4, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          width: '100%',
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? pickPA(lang, 'gate.submitting') : pickPA(lang, 'gate.submit')}
      </button>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: 'var(--muted)', textAlign: 'center', margin: '10px 0 0' }}>
        {pickPA(lang, 'gate.smallprint')}
      </p>
    </form>
  );
};

// ── Unlocked ───────────────────────────────────────────────────

const Unlocked = ({ lang, result, previewResult }) => {
  const share = () => {
    fetch(`${BACKEND}/api/mini-games/share/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_slug: 'quiz_gambling_literacy', play_id: result.play_id }),
    }).catch(() => {});
    const shareText = (lang === 'en' && result.share_text_en) || result.share_text;
    if (navigator.share) {
      navigator.share({ text: shareText, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      alert(lang === 'en' ? 'Share text copied to clipboard.' : 'Jakoteksti kopioitu leikepöydälle.');
    }
  };
  const title = (lang === 'en' && result.persona.title_en) || result.persona.title;
  const tagline = (lang === 'en' && result.persona.tagline_en) || result.persona.tagline;
  const strengths = (lang === 'en' && result.strengths_en) || result.strengths;
  const gaps = (lang === 'en' && result.gaps_en) || result.gaps;
  return (
    <div data-testid="quiz-unlocked">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 12 }}>
        {pickPA(lang, 'quiz.unlocked.eyebrow')}
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px',
      }}>
        {title}
      </h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 24px' }}>
        {tagline}
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28,
      }}>
        <StatCard label={pickPA(lang, 'quiz.unlocked.correct')} value={`${result.score}/${result.total}`} />
        <StatCard label={pickPA(lang, 'quiz.unlocked.pct')} value={`${result.pct.toFixed(0)}%`} />
        <StatCard label={interpolate(pickPA(lang, 'quiz.unlocked.rank'), { week: result.tournament_week_iso })} value={`#${result.rank}`} />
      </div>

      <PanelTwoCol
        leftTitle={pickPA(lang, 'quiz.unlocked.strengths')}
        leftItems={strengths}
        rightTitle={pickPA(lang, 'quiz.unlocked.gaps')}
        rightItems={gaps}
      />

      <div style={{ marginTop: 32 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          {pickPA(lang, 'quiz.unlocked.boardTitle')}
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {result.leaderboard.map((row) => (
            <li key={row.rank} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 14px',
              background: row.rank === result.rank ? 'var(--surface-2)' : 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'Georgia, serif', fontSize: 15,
            }}>
              <span style={{ color: 'var(--ink)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 10 }}>#{row.rank}</span>
                {row.display_name}
              </span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>
                {row.score}/{previewResult.total}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <button
          onClick={share}
          data-testid="quiz-share-btn"
          style={{
            padding: '12px 20px',
            background: 'var(--ink)', color: 'var(--bg)',
            border: 'none', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          <Share2 size={14} strokeWidth={1.8} /> {pickPA(lang, 'quiz.share')}
        </button>
        <Link
          to="/peliareena"
          data-testid="quiz-unlocked-back"
          style={{
            padding: '12px 20px',
            background: 'transparent', color: 'var(--ink)',
            border: '1px solid var(--ink)', borderRadius: 4,
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          {pickPA(lang, 'quiz.back')}
        </Link>
      </div>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4 }}>
    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--ink)' }}>{value}</div>
  </div>
);

const PanelTwoCol = ({ leftTitle, leftItems, rightTitle, rightItems }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
    <div style={{ padding: 16, border: '1px solid var(--border)', borderLeft: '4px solid #3F8A4D', background: 'var(--surface)', borderRadius: 4 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 8 }}>{leftTitle}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
        {leftItems.length === 0 ? <li>—</li> : leftItems.map(x => <li key={x}>{x}</li>)}
      </ul>
    </div>
    <div style={{ padding: 16, border: '1px solid var(--border)', borderLeft: '4px solid #C8423C', background: 'var(--surface)', borderRadius: 4 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#C8423C', fontWeight: 700, marginBottom: 8 }}>{rightTitle}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
        {rightItems.length === 0 ? <li>—</li> : rightItems.map(x => <li key={x}>{x}</li>)}
      </ul>
    </div>
  </div>
);

export default PeliAreenaQuiz;
