/**
 * PUTKI HQ — /peliareena/paatospolku (Scenario · iter56, i18n iter60)
 *
 * Branching decisions game. 5 real gambling scenarios with 3 options each.
 * Each option carries a hidden judgement score (0..3) which we surface
 * only AFTER the player picks — they learn the trade-off of every choice.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Share2 } from 'lucide-react';
import GameIntroPanel from '../components/peliareena/GameIntroPanel';
import { ConsentEmailGate } from './PeliAreenaSharedGate';
import IdentityCardFlow from '../components/peliareena/IdentityCardFlow';
import { useLang } from '../context/LanguageContext';
import { pickPA, interpolate, langField } from '../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const post = async (path, body) => {
  const r = await fetch(`${BACKEND}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const PeliAreenaScenario = () => {
  const { lang } = useLang();
  const [stage, setStage] = useState('intro');
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [pickedNow, setPickedNow] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fullResult, setFullResult] = useState(null);

  const start = async () => {
    const s = await post('/api/mini-games/scenario/start');
    setSession(s); setAnswers([]); setPickedNow(null); setStage('playing');
  };

  const currentIdx = answers.length;
  const currentSc = session?.scenarios?.[currentIdx];
  const total = session?.total || 0;

  const pick = (k) => { if (!pickedNow) setPickedNow(k); };
  const next = async () => {
    if (!pickedNow) return;
    const newAns = [...answers, { q_id: currentSc.id, picked: pickedNow }];
    setAnswers(newAns); setPickedNow(null);
    if (newAns.length >= total) {
      const r = await post('/api/mini-games/scenario/finish', {
        play_id: session.play_id, anon_id: session.anon_id, answers: newAns,
      });
      setPreview(r); setStage('preview');
    }
  };

  return (
    <div data-testid="peliareena-scenario" style={{ padding: '32px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
      <Link to="/peliareena" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> {pickPA(lang, 'hub.back')}
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="scenario_decisions"
          eyebrow={pickPA(lang, 'sc.eyebrow')}
          headline={pickPA(lang, 'sc.headline')}
          tagline={pickPA(lang, 'sc.tagline')}
          howToPlay={[pickPA(lang, 'sc.howTo.1'), pickPA(lang, 'sc.howTo.2'), pickPA(lang, 'sc.howTo.3')]}
          scoring={[pickPA(lang, 'sc.score.1'), pickPA(lang, 'sc.score.2'), pickPA(lang, 'sc.score.3')]}
          ctaLabel={pickPA(lang, 'sc.cta.start')}
          startTestId="scenario-start-btn"
          onStart={start}
        />
      )}

      {stage === 'playing' && currentSc && (
        <div data-testid={`scenario-q-${currentIdx + 1}`}>
          <div style={{ marginBottom: 24 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', marginBottom: 8 }}>
              {interpolate(pickPA(lang, 'sc.progress'), { n: currentIdx + 1, total })}
            </div>
            <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((currentIdx + (pickedNow ? 1 : 0)) / total) * 100}%`, background: 'var(--ink)', transition: 'width 220ms ease' }} />
            </div>
          </div>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontWeight: 700,
            fontSize: 'clamp(20px, 3vw, 26px)', lineHeight: 1.35,
            letterSpacing: '-0.01em', color: 'var(--ink)', margin: '0 0 20px',
          }}>
            {langField(currentSc, 'prompt', lang) || currentSc.prompt_fi}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentSc.options.map(opt => {
              const isPicked = pickedNow === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => pick(opt.key)}
                  disabled={!!pickedNow}
                  data-testid={`scenario-opt-${opt.key}`}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: `1px solid ${isPicked ? 'var(--ink)' : 'var(--border)'}`,
                    background: isPicked ? 'var(--surface-2)' : 'var(--surface)',
                    color: 'var(--ink)',
                    borderRadius: 4,
                    cursor: pickedNow ? 'default' : 'pointer',
                    fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.4,
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
            <div style={{
              marginTop: 24, padding: 16,
              background: 'var(--surface-2)', borderRadius: 4,
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                {pickPA(lang, 'sc.locked')}
              </p>
              <button onClick={next} data-testid="scenario-next-btn" style={{ ...btnPrimary, marginTop: 12, padding: '10px 20px' }}>
                {currentIdx + 1 >= total ? pickPA(lang, 'sc.showResult') : pickPA(lang, 'sc.next')} <ChevronRight size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      )}

      {stage === 'preview' && preview && (
        <ScenarioPreview lang={lang} preview={preview} session={session}
          fullResult={fullResult}
          onUnlocked={(r) => { setFullResult(r); }} />
      )}
    </div>
  );
};

const ScenarioPreview = ({ lang, preview, session, onUnlocked, fullResult }) => {
  return (
    <div data-testid="scenario-preview">
      {/* iter63 — Identity-first reveal + Micro-Yes ladder */}
      <IdentityCardFlow
        preview={preview}
        session={session}
        gameSlug="scenario"
        unlockPath="/api/mini-games/scenario/unlock"
        onUnlocked={onUnlocked}
      />

      {fullResult && (
        <div style={{ marginTop: 36 }}>
          <ScenarioUnlocked lang={lang} result={fullResult} />
        </div>
      )}
      <div style={{ marginTop: 36, marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          {pickPA(lang, 'sc.preview.optionsHeading')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {preview.answers.map(a => (
            <div key={a.q_id} style={{ padding: 14, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#5A7BB8', fontWeight: 700, marginBottom: 8 }}>
                {interpolate(pickPA(lang, 'sc.preview.youPicked'), { n: a.order, key: a.picked.toUpperCase(), score: a.picked_score })}
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {langField(a, 'prompt', lang) || a.prompt_fi}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {a.options_resolved.map(o => {
                  const wasPicked = o.key === a.picked;
                  return (
                    <div key={o.key} style={{
                      padding: '8px 12px',
                      background: wasPicked ? 'var(--surface-2)' : 'transparent',
                      borderLeft: `3px solid ${o.score === 3 ? '#3F8A4D' : o.score === 0 ? '#C8423C' : '#9C9587'}`,
                      fontFamily: 'Georgia, serif', fontSize: 13,
                    }}>
                      <div style={{ color: 'var(--ink)', marginBottom: 4 }}>
                        <span className="mono" style={{ fontSize: 10, color: '#5A7BB8', marginRight: 8, fontWeight: 700 }}>{o.key.toUpperCase()} · {o.score}/3</span>
                        {langField(o, 'label', lang) || o.label_fi}
                        {wasPicked && <Check size={12} strokeWidth={2} style={{ display: 'inline', marginLeft: 6, color: 'var(--ink)' }} />}
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.45 }}>{langField(o, 'explanation', lang) || o.explanation_fi}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link to="/peliareena" data-testid="scenario-preview-back" style={btnGhost}>
          {pickPA(lang, 'quiz.back')}
        </Link>
      </div>
    </div>
  );
};

const ScenarioUnlocked = ({ lang, result }) => {
  const title = (lang === 'en' && result.persona.title_en) || result.persona.title;
  const tagline = (lang === 'en' && result.persona.tagline_en) || result.persona.tagline;
  const shareText = (lang === 'en' && result.share_text_en) || result.share_text;
  const share = () => {
    fetch(`${BACKEND}/api/mini-games/share/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_slug: 'scenario_decisions', play_id: result.play_id }),
    }).catch(() => {});
    if (navigator.share) navigator.share({ text: shareText, url: window.location.href });
    else { navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
           alert(lang === 'en' ? 'Share text copied.' : 'Jakoteksti kopioitu.'); }
  };
  return (
    <div data-testid="scenario-unlocked">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 12 }}>
        {pickPA(lang, 'sc.unlocked.eyebrow')}
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px',
      }}>{title}</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 24px' }}>
        {tagline}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatBox label={pickPA(lang, 'sc.unlocked.score')} value={`${result.score}/${result.max_score}`} />
        <StatBox label={pickPA(lang, 'sc.unlocked.pct')} value={`${result.pct.toFixed(0)}%`} />
        <StatBox label={interpolate(pickPA(lang, 'sc.unlocked.rank'), { week: result.tournament_week_iso })} value={`#${result.rank}`} />
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          {pickPA(lang, 'sc.unlocked.boardTitle')}
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {result.leaderboard.map(row => (
            <li key={row.rank} style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
              background: row.rank === result.rank ? 'var(--surface-2)' : 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'Georgia, serif', fontSize: 15,
            }}>
              <span style={{ color: 'var(--ink)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 10 }}>#{row.rank}</span>
                {row.display_name}
              </span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>{row.score}/{result.max_score}</span>
            </li>
          ))}
        </ol>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <button onClick={share} data-testid="scenario-share-btn" style={btnPrimary}>
          <Share2 size={14} strokeWidth={1.8} /> {pickPA(lang, 'quiz.share')}
        </button>
        <Link to="/peliareena" data-testid="scenario-unlocked-back" style={btnGhost}>{pickPA(lang, 'quiz.back')}</Link>
      </div>
    </div>
  );
};

const StatBox = ({ label, value }) => (
  <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4 }}>
    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--ink)' }}>{value}</div>
  </div>
);

const btnPrimary = {
  padding: '14px 28px',
  background: 'var(--ink)', color: 'var(--bg)',
  border: 'none', borderRadius: 4, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', gap: 8,
  marginTop: 28,
};

const btnGhost = {
  padding: '12px 20px',
  background: 'transparent', color: 'var(--ink)',
  border: '1px solid var(--ink)', borderRadius: 4,
  fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 8,
};

export default PeliAreenaScenario;
