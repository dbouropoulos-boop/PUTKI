/**
 * PUTKI HQ - /peliareena/tietoraape (Insight Reveal · iter56, i18n iter60)
 *
 * Scratch-card style game. 6 tiles on a board, each hides one micro-
 * lesson about gambling literacy. Click to reveal - no wrong answers,
 * the educational payoff IS the revealed fact.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Share2 } from 'lucide-react';
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

const PeliAreenaInsight = () => {
  const { lang } = useLang();
  const [stage, setStage] = useState('intro');
  const [session, setSession] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [preview, setPreview] = useState(null);
  const [full, setFull] = useState(null);

  const start = async () => {
    const s = await post('/api/mini-games/insight/start');
    setSession(s); setRevealed({}); setStage('playing');
  };

  const reveal = async (q_id) => {
    if (revealed[q_id]) return;
    const r = await post('/api/mini-games/insight/reveal', {
      play_id: session.play_id, anon_id: session.anon_id, q_id,
    });
    setRevealed(prev => ({ ...prev, [q_id]: r.tile }));
  };

  const finish = async () => {
    const r = await post('/api/mini-games/insight/finish', {
      play_id: session.play_id, anon_id: session.anon_id,
    });
    setPreview(r); setStage('preview');
  };

  const revealedCount = Object.keys(revealed).length;
  const total = session?.tile_count || 0;

  return (
    <div data-testid="peliareena-insight" style={{ padding: '32px 24px 80px', maxWidth: 920, margin: '0 auto' }}>
      <Link to="/peliareena" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> {pickPA(lang, 'hub.back')}
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="insight_reveal"
          eyebrow={pickPA(lang, 'in.eyebrow')}
          headline={pickPA(lang, 'in.headline')}
          tagline={pickPA(lang, 'in.tagline')}
          howToPlay={[pickPA(lang, 'in.howTo.1'), pickPA(lang, 'in.howTo.2'), pickPA(lang, 'in.howTo.3')]}
          scoring={[pickPA(lang, 'in.score.1'), pickPA(lang, 'in.score.2'), pickPA(lang, 'in.score.3')]}
          ctaLabel={pickPA(lang, 'in.cta.start')}
          startTestId="insight-start-btn"
          onStart={start}
        />
      )}

      {stage === 'playing' && session && (
        <div data-testid="insight-board">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)' }}>
              {interpolate(pickPA(lang, 'in.opened'), { n: revealedCount, total })}
            </div>
            <button
              onClick={finish}
              disabled={revealedCount === 0}
              data-testid="insight-finish-btn"
              style={{
                padding: '8px 16px', background: 'transparent',
                border: '1px solid var(--ink)', color: 'var(--ink)',
                fontFamily: 'inherit', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.2em', textTransform: 'uppercase',
                cursor: revealedCount === 0 ? 'not-allowed' : 'pointer',
                opacity: revealedCount === 0 ? 0.5 : 1,
                borderRadius: 4,
              }}
            >
              {pickPA(lang, 'in.finish')}
            </button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14,
          }}>
            {session.tiles.map((t, i) => {
              const r = revealed[t.id];
              return (
                <div
                  key={t.id}
                  onClick={() => reveal(t.id)}
                  data-testid={`insight-tile-${i + 1}`}
                  style={{
                    minHeight: 180, padding: 18,
                    border: r ? '1px solid var(--ink)' : '1px dashed var(--border)',
                    background: r ? 'var(--surface)' : 'var(--surface-2)',
                    borderRadius: 6, cursor: r ? 'default' : 'pointer',
                    transition: 'all 220ms ease',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                  onMouseEnter={(e) => { if (!r) e.currentTarget.style.borderColor = 'var(--ink)'; }}
                  onMouseLeave={(e) => { if (!r) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  {!r ? (
                    <>
                      <Sparkles size={20} strokeWidth={1.4} style={{ color: 'var(--muted)' }} />
                      <div style={{
                        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 18,
                        color: 'var(--muted)', letterSpacing: '-0.01em',
                      }}>
                        {lang === 'en' ? `Tile ${i + 1}` : `Laatta ${i + 1}`}
                      </div>
                      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)' }}>
                        {lang === 'en' ? 'CLICK TO REVEAL' : 'KLIKKAA AVATAKSESI'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700 }}>
                        {r.topic_tag?.toUpperCase()}
                      </div>
                      <div style={{
                        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20,
                        color: 'var(--ink)', letterSpacing: '-0.01em',
                      }}>
                        {langField(r, 'prompt', lang) || r.prompt_fi}
                      </div>
                      <p style={{ fontFamily: 'Georgia, serif', fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                        {langField(r, 'explanation', lang) || r.explanation_fi}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stage === 'preview' && preview && (
        <InsightPreview lang={lang} preview={preview} session={session}
          fullResult={full}
          onUnlocked={(r) => { setFull(r); }} />
      )}
    </div>
  );
};

const InsightPreview = ({ lang, preview, session, onUnlocked, fullResult }) => {
  return (
    <div data-testid="insight-preview">
      <IdentityCardFlow
        preview={preview}
        session={session}
        gameSlug="insight"
        unlockPath="/api/mini-games/insight/unlock"
        onUnlocked={onUnlocked}
      />

      {fullResult && (
        <div style={{ marginTop: 36 }}>
          <InsightUnlocked lang={lang} result={fullResult} />
        </div>
      )}

      <div style={{ marginTop: 36, marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          {lang === 'en' ? 'REVEALED LESSONS' : 'AVATUT OPIT'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {preview.revealed_tiles.map(t => (
            <div key={t.id} style={{ padding: 14, border: '1px solid var(--border)', borderLeft: '4px solid #3F8A4D', background: 'var(--surface)', borderRadius: 4 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: '#3F8A4D', fontWeight: 700, marginBottom: 6 }}>
                {t.topic_tag?.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>
                {langField(t, 'prompt', lang) || t.prompt_fi}
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                {langField(t, 'explanation', lang) || t.explanation_fi}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link to="/peliareena" data-testid="insight-preview-back" style={btnGhost}>
          {pickPA(lang, 'quiz.back')}
        </Link>
      </div>
    </div>
  );
};

const InsightUnlocked = ({ lang, result }) => {
  const title = (lang === 'en' && result.persona.title_en) || result.persona.title;
  const tagline = (lang === 'en' && result.persona.tagline_en) || result.persona.tagline;
  const shareText = (lang === 'en' && result.share_text_en) || result.share_text;
  const share = () => {
    fetch(`${BACKEND}/api/mini-games/share/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_slug: 'insight_reveal', play_id: result.play_id }),
    }).catch(() => {});
    if (navigator.share) navigator.share({ text: shareText, url: window.location.href });
    else { navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
           alert(lang === 'en' ? 'Share text copied.' : 'Jakoteksti kopioitu.'); }
  };
  return (
    <div data-testid="insight-unlocked">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 12 }}>
        {pickPA(lang, 'in.unlocked.eyebrow')}
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
        <StatBox label={pickPA(lang, 'in.unlocked.score')} value={`${result.score}/${result.max_score}`} />
        <StatBox label={pickPA(lang, 'in.unlocked.pct')} value={`${result.pct.toFixed(0)}%`} />
        <StatBox label={interpolate(pickPA(lang, 'in.unlocked.rank'), { week: result.tournament_week_iso })} value={`#${result.rank}`} />
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
          {pickPA(lang, 'in.unlocked.boardTitle')}
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
        <button onClick={share} data-testid="insight-share-btn" style={btnPrimary}>
          <Share2 size={14} strokeWidth={1.8} /> {pickPA(lang, 'quiz.share')}
        </button>
        <Link to="/peliareena" data-testid="insight-unlocked-back" style={btnGhost}>{pickPA(lang, 'quiz.back')}</Link>
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

export default PeliAreenaInsight;
