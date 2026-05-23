/**
 * PUTKI HQ — /peliareena (Mini-Game Hub) · iter55
 *
 * Phase 1 of the educational mini-game suite (Build Brief v2). Shows
 * the 5-game catalog (1 active + 4 "coming soon"), the current
 * weekly tournament state, the top-5 leaderboard, and the non-monetary
 * prize/recognition framing.
 *
 * Design rules per the brief:
 *   • Bright + playful but stays editorial (no slot-machine vibe)
 *   • Email is NEVER the gate to play — only to unlock full result + ranking
 *   • Honest counters (real plays_this_week, real ranked_players)
 *   • All copy in Finnish (beginner audience for online gambling literacy)
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ChevronRight, Lock, Clock, BookOpen, Zap, GitBranch } from 'lucide-react';
import GameTileArt from '../components/GameTileArt';
import { useLang } from '../context/LanguageContext';
import { pickPA, interpolate, langField } from '../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const GAME_ICONS = {
  quiz: BookOpen,
  scenario: GitBranch,
  reveal: Sparkles,
  arcade: Zap,
};

const PeliAreenaHub = () => {
  const { lang } = useLang();
  const [hub, setHub] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND}/api/mini-games/hub`)
      .then(r => r.json())
      .then(d => { if (alive) setHub(d); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  if (error) return <div className="p-8 mono text-sm" style={{ color: 'var(--ink)' }}>VIRHE: {error}</div>;
  if (!hub) return <div className="p-8 mono text-sm" style={{ color: 'var(--muted)' }}>{pickPA(lang, 'common.loading')}</div>;

  const t = hub.tournament;

  return (
    <div data-testid="peliareena-hub" style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
          {pickPA(lang, 'hub.eyebrow')}
        </div>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(36px, 5.5vw, 56px)', lineHeight: 1.05,
          letterSpacing: '-0.02em', color: 'var(--ink)', maxWidth: 780,
        }}>
          {pickPA(lang, 'hub.headline')}
        </h1>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6,
          color: 'var(--muted)', maxWidth: 640, marginTop: 16,
        }}>
          {pickPA(lang, 'hub.tagline')}
        </p>
      </div>

      {/* Tournament state */}
      <TournamentPanel t={t} lang={lang} />

      {/* Game grid */}
      <h2 className="mono" style={{
        fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)',
        fontWeight: 700, margin: '40px 0 16px',
      }}>{pickPA(lang, 'hub.games.heading')}</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {hub.games.map(g => <GameTile key={g.slug} game={g} lang={lang} />)}
      </div>

      {/* Brand-trust honest footer */}
      <div style={{
        marginTop: 56, padding: 20,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        borderRadius: 4,
      }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 8 }}>
          {pickPA(lang, 'hub.smallprint.title')}
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          {pickPA(lang, 'hub.smallprint.body')}
          {' '}<a href={hub.privacy_url} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>{pickPA(lang, 'hub.smallprint.privacyLink')}</a>.
        </p>
      </div>
    </div>
  );
};

const TournamentPanel = ({ t, lang }) => {
  const closes = new Date(t.closes_at);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.round((closes - now) / (3600 * 1000)));
  const daysLeft = Math.floor(hoursLeft / 24);
  const hoursRem = hoursLeft % 24;
  const daysSuffix = lang === 'en' ? 'd' : 'p';

  return (
    <div data-testid="peliareena-tournament-panel" style={{
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '20px 24px',
      borderRadius: 6,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
        gap: 16, alignItems: 'flex-start',
      }}>
        <div style={{ minWidth: 0, flex: '1 1 200px' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700 }}>
            {pickPA(lang, 'intro.weekLabel')} {t.week_iso} · {pickPA(lang, 'hub.tournament.active')}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Clock size={14} strokeWidth={1.6} style={{ color: 'var(--muted)' }} />
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
                {daysLeft}{daysSuffix} {hoursRem}h
              </span>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}>{pickPA(lang, 'hub.tournament.timeLeft')}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em' }}>
              {interpolate(pickPA(lang, 'hub.tournament.playsLine'), { plays: t.plays_this_week, players: t.ranked_players_this_week })}
            </div>
          </div>
        </div>
        <div style={{ minWidth: 240, flex: '1 1 240px' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 6 }}>
            {pickPA(lang, 'hub.tournament.leaderboardTitle')}
          </div>
          {(t.leaderboard_top || []).length === 0 ? (
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              {pickPA(lang, 'hub.tournament.empty')}
            </p>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {t.leaderboard_top.slice(0, 5).map((row, i) => (
                <li key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '2px 0', borderBottom: i < Math.min(4, t.leaderboard_top.length - 1) ? '1px dotted var(--border)' : 'none',
                  fontFamily: 'Georgia, serif', fontSize: 14,
                }}>
                  <span style={{ color: 'var(--ink)' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginRight: 8 }}>#{row.rank}</span>
                    {row.display_name}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>
                    {row.score}/10
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

const GameTile = ({ game, lang }) => {
  const Icon = GAME_ICONS[game.kind] || BookOpen;
  const active = game.status === 'active';
  const Wrapper = active ? Link : 'div';
  const wrapperProps = active ? { to: game.play_url } : {};
  const title = langField(game, 'title', lang) || game.title_fi;
  const subtitle = langField(game, 'subtitle', lang) || game.subtitle_fi;
  const duration = langField(game, 'duration', lang) || game.duration_fi;

  return (
    <Wrapper
      {...wrapperProps}
      data-testid={`peliareena-game-${game.slug}`}
      style={{
        display: 'block',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        borderRadius: 6,
        textDecoration: 'none',
        position: 'relative',
        opacity: active ? 1 : 0.55,
        transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
        cursor: active ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!active) return;
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.borderColor = 'var(--ink)';
        e.currentTarget.style.boxShadow = '0 12px 24px -12px rgba(0,0,0,0.18)';
      }}
      onMouseLeave={(e) => {
        if (!active) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Tile illustration */}
      <div style={{ position: 'relative', borderBottom: '1px solid var(--border)' }}>
        <GameTileArt kind={game.kind} slug={game.slug} />
        {!active && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8,
          }}>
            <Lock size={14} strokeWidth={1.6} style={{ color: '#F5F3EE' }} />
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#F5F3EE', fontWeight: 700 }}>
              {pickPA(lang, 'hub.coming')}
            </span>
          </div>
        )}
      </div>

      {/* Tile body */}
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon size={16} strokeWidth={1.7} style={{ color: 'var(--ink)' }} />
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700 }}>
            {game.kind.toUpperCase()} · {duration}
          </span>
        </div>
        <h3 style={{
          fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)',
          margin: '0 0 8px', letterSpacing: '-0.01em',
        }}>
          {title}
        </h3>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)',
          lineHeight: 1.5, margin: 0, minHeight: 42,
        }}>
          {subtitle}
        </p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          {active ? (
            <>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink)', fontWeight: 700 }}>
                {pickPA(lang, 'hub.playNow')}
              </span>
              <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--ink)' }} />
            </>
          ) : (
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)' }}>
              {pickPA(lang, 'hub.coming')}
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
};

export default PeliAreenaHub;
