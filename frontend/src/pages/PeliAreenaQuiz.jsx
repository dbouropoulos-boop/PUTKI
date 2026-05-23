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
        <ArrowLeft size={14} strokeWidth={1.6} /> Takaisin Peliareenaan
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="quiz_gambling_literacy"
          eyebrow="TIETOISUUSTESTI · ALOITTELIJA"
          headline={<>10 kysymystä. ~3 minuuttia.<br />Saat heti tietää, missä olet.</>}
          tagline="Testaa rahapelimatematiikan perusteet (RTP, volatiliteetti, house edge), bankroll-hallinnan, pelipsykologian ja vastuullisuuden. Pelaa ilman sähköpostia — jokainen vastaus selitetään, joten opit silloinkin, kun vastaat väärin."
          howToPlay={[
            'Vastaa 10 kysymykseen omalla tahdillasi — voit ottaa aikalisän milloin tahansa.',
            'Lukitset vastauksen klikkaamalla vaihtoehtoa. Selityksen näet, kun siirryt eteenpäin.',
            'Lopussa näet oikeat vastaukset, profiilisi sekä paikkasi viikon turnauksessa.',
          ]}
          scoring={[
            'Jokainen oikein vastattu kysymys = 1 piste (max 10).',
            'Tasapelissä nopeampi pelaaja sijoittuu paremmin.',
            'Viikon paras pisteytys julkaistaan etunimellä — sähköpostia ei näytetä.',
          ]}
          ctaLabel="Aloita testi"
          startTestId="quiz-start-btn"
          onStart={start}
        />
      )}
      {stage === 'playing' && currentQ && (
        <Playing
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
          result={previewResult}
          session={session}
          onUnlocked={(full) => { setFullResult(full); setStage('unlocked'); }}
        />
      )}
      {stage === 'unlocked' && fullResult && <Unlocked result={fullResult} previewResult={previewResult} />}
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

const Playing = ({ q, index, total, pickedNow, onPick, onNext }) => {
  const progress = ((index + (pickedNow ? 1 : 0)) / total) * 100;
  return (
    <div data-testid={`quiz-question-${index + 1}`}>
      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', marginBottom: 8 }}>
          KYSYMYS {index + 1} / {total}
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
        {q.prompt_fi}
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
              <span>{opt.label_fi}</span>
            </button>
          );
        })}
      </div>

      {pickedNow && (
        <RevealCard
          // We don't know the correct answer until finish — show neutral
          // "thank you, here's the explanation" UX via the playing screen.
          // The actual right/wrong reveal happens on the Preview stage with
          // full per-question feedback. (Keeps server as source of truth.)
          onNext={onNext}
          index={index}
          total={total}
        />
      )}
    </div>
  );
};

const RevealCard = ({ onNext, index, total }) => (
  <div style={{
    marginTop: 24, padding: 16,
    background: 'var(--surface-2)', borderRadius: 4,
    border: '1px solid var(--border)',
  }}>
    <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
      Vastaus tallennettu. Saat täydet selitykset kunkin kysymyksen kohdalta lopussa.
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
      {index + 1 >= total ? 'Näytä tulos' : 'Seuraava kysymys'} <ChevronRight size={12} strokeWidth={2.5} />
    </button>
  </div>
);

// ── Preview ────────────────────────────────────────────────────

const Preview = ({ result, session, onUnlocked }) => {
  const pct = result.pct;
  const right = result.score;
  const total = result.total;
  return (
    <div data-testid="quiz-preview">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
        TULOKSESI · ESIKATSELU
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px',
      }}>
        {right}<span style={{ color: 'var(--muted)' }}>/{total}</span>
      </h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 32px' }}>
        Oikeissa vastauksissa olit {pct.toFixed(0)}%:n tasolla.
        Esikatsellaan profiili: <strong style={{ color: 'var(--ink)' }}>{result.persona_preview.title}</strong>.
      </p>

      {/* Per-question feedback (this is the educational payoff that's free) */}
      <div style={{ marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          KYSYMYSKOHTAINEN SELITYS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.answers.map((a) => (
            <AnswerFeedback key={a.q_id} a={a} />
          ))}
        </div>
      </div>

      {/* Email gate */}
      <EmailGate
        session={session}
        score={right}
        total={total}
        onUnlocked={onUnlocked}
      />

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
          ← Palaa Peliareenaan
        </Link>
      </div>
    </div>
  );
};

const AnswerFeedback = ({ a }) => {
  const ok = a.is_correct;
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
          KYSYMYS {a.order} · {ok ? 'OIKEIN' : `VÄÄRIN (oikea: ${a.correct.toUpperCase()})`}
        </span>
      </div>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, margin: 0 }}>
        {a.explanation_fi}
      </p>
    </div>
  );
};

// ── Email gate ─────────────────────────────────────────────────

const EmailGate = ({ session, score, total, onUnlocked }) => {
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
      const r = await post('/api/mini-games/quiz/unlock', {
        play_id: session.play_id,
        anon_id: session.anon_id,
        email, name, consent: true,
      });
      onUnlocked(r);
    } catch (e2) {
      setError(`Tallennus epäonnistui: ${e2.message}`);
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
          AVAA TÄYDET TULOKSET · LIITY TURNAUKSEEN
        </span>
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        Saat henkilökohtaiset vahvuudet, kuilut ja sijoituksen viikolla
      </h2>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 16px' }}>
        Annetulla sähköpostilla saat: täydellisen profiilisi, sen mihin kannattaa keskittyä, sekä
        viikon turnaussi sijoituksen ja viikkokirjeet (4 viestiä/viikko: avajaiset, väliaika, sulkemisilmoitus, tulokset).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 12 }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sinun.sahkoposti@esimerkki.fi"
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
          placeholder="Etunimi (ei pakollinen — käytetään leaderboardissa)"
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
          Hyväksyn, että Putki HQ tallentaa sähköpostini ja pelin tuloksen
          voidakseen lähettää minulle henkilökohtaiset tulokset ja
          viikoittaisen turnauksen päivitykset. Voin perua tilauksen
          koska tahansa. Lue lisää{' '}
          <a href="/tietosuoja" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
            tietosuojaselosteesta
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
        {submitting ? 'Tallennetaan…' : 'Avaa tulokset + Liity turnaukseen'}
      </button>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: 'var(--muted)', textAlign: 'center', margin: '10px 0 0' }}>
        Ei rahaa, ei kortteja, ei ostopakkoa. Voit perua koska tahansa.
      </p>
    </form>
  );
};

// ── Unlocked ───────────────────────────────────────────────────

const Unlocked = ({ result, previewResult }) => {
  const share = () => {
    fetch(`${BACKEND}/api/mini-games/share/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_slug: 'quiz_gambling_literacy', play_id: result.play_id }),
    }).catch(() => {});
    if (navigator.share) {
      navigator.share({ text: result.share_text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${result.share_text} ${window.location.href}`);
      alert('Jakoteksti kopioitu leikepöydälle.');
    }
  };
  return (
    <div data-testid="quiz-unlocked">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 12 }}>
        TÄYSI PROFIILI · TURNAUS PAIKAN VARATTU
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px',
      }}>
        {result.persona.title}
      </h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 24px' }}>
        {result.persona.tagline}
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28,
      }}>
        <StatCard label="OIKEIN" value={`${result.score}/${result.total}`} />
        <StatCard label="TULOS-%" value={`${result.pct.toFixed(0)}%`} />
        <StatCard label={`SIJA · ${result.tournament_week_iso}`} value={`#${result.rank}`} />
      </div>

      <PanelTwoCol
        leftTitle="VAHVUUTESI"
        leftItems={result.strengths}
        rightTitle="KEHITETTÄVÄT KOHDAT"
        rightItems={result.gaps}
      />

      <div style={{ marginTop: 32 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          VIIKON TURNAUS · TOP 10
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
          <Share2 size={14} strokeWidth={1.8} /> Jaa tulos
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
          ← Palaa Peliareenaan
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
