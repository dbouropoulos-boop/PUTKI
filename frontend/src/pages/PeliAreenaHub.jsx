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
import { Trophy, Sparkles, ChevronRight, Lock, Clock, BookOpen } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const GAME_ICONS = {
  quiz: BookOpen,
  scenario: Sparkles,
  reveal: Sparkles,
  arcade: Trophy,
};

const PeliAreenaHub = () => {
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
  if (!hub) return <div className="p-8 mono text-sm" style={{ color: 'var(--muted)' }}>Ladataan…</div>;

  const t = hub.tournament;

  return (
    <div data-testid="peliareena-hub" style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
          PUTKI HQ · PELIAREENA
        </div>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(36px, 5.5vw, 56px)', lineHeight: 1.05,
          letterSpacing: '-0.02em', color: 'var(--ink)', maxWidth: 780,
        }}>
          Viisi pientä peliä. Yksi viikkoturnaus. Opi pelaamalla.
        </h1>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6,
          color: 'var(--muted)', maxWidth: 640, marginTop: 16,
        }}>
          Pelaa ilman sähköpostia. Kun haluat henkilökohtaiset tuloksesi ja paikan
          viikon turnauksessa, anna sähköpostisi — siitä alkaa oikea palaute.
          Palkinnot ovat tunnustuksia ja pääsyjä, ei rahaa.
        </p>
      </div>

      {/* Tournament state */}
      <TournamentPanel t={t} />

      {/* Game grid */}
      <h2 className="mono" style={{
        fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)',
        fontWeight: 700, margin: '40px 0 16px',
      }}>VIIKON 5 PELIÄ</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {hub.games.map(g => <GameTile key={g.slug} game={g} />)}
      </div>

      {/* Brand-trust honest footer */}
      <div style={{
        marginTop: 56, padding: 20,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        borderRadius: 4,
      }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 8 }}>
          REHELLINEN PIENI PRINTTI
        </div>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
          Palkinnot: viikon mestaruus + pääsy laajempiin sisältöihin. Ei rahaa, ei rahanarvoista.
          Pelin pelaaminen ei vaadi ostoa. Sähköpostin antaminen on vapaaehtoista —
          se on vaatimus vain turnauksen rankaukseen ja täysiin tuloksiin.
          Voit perua tilauksesi koska tahansa.
          {' '}<a href={hub.privacy_url} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>Tietosuojaseloste</a>.
        </p>
      </div>
    </div>
  );
};

const TournamentPanel = ({ t }) => {
  const closes = new Date(t.closes_at);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.round((closes - now) / (3600 * 1000)));
  const daysLeft = Math.floor(hoursLeft / 24);
  const hoursRem = hoursLeft % 24;

  return (
    <div data-testid="peliareena-tournament-panel" style={{
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '20px 24px',
      borderRadius: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700 }}>
            VIIKKO {t.week_iso} · AKTIIVINEN
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Clock size={14} strokeWidth={1.6} style={{ color: 'var(--muted)' }} />
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
                {daysLeft}p {hoursRem}h
              </span>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}>JÄLJELLÄ</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em' }}>
              {t.plays_this_week} suoritettua pelitestiä · {t.ranked_players_this_week} ranattua pelaajaa
            </div>
          </div>
        </div>
        <div style={{ minWidth: 240, flex: '1 1 240px' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 6 }}>
            VIIKON JOHTO
          </div>
          {(t.leaderboard_top || []).length === 0 ? (
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              Olisitko sinä viikon ensimmäinen pelaaja?
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

const GameTile = ({ game }) => {
  const Icon = GAME_ICONS[game.kind] || BookOpen;
  const active = game.status === 'active';
  const Wrapper = active ? Link : 'div';
  const wrapperProps = active ? { to: game.play_url } : {};

  return (
    <Wrapper
      {...wrapperProps}
      data-testid={`peliareena-game-${game.slug}`}
      style={{
        display: 'block',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 20,
        borderRadius: 6,
        textDecoration: 'none',
        position: 'relative',
        opacity: active ? 1 : 0.6,
        transition: 'transform 180ms ease, border-color 180ms ease',
        cursor: active ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => active && (e.currentTarget.style.transform = 'translateY(-2px)') && (e.currentTarget.style.borderColor = 'var(--ink)')}
      onMouseLeave={(e) => active && (e.currentTarget.style.transform = 'translateY(0)') && (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Icon size={20} strokeWidth={1.6} style={{ color: active ? 'var(--ink)' : 'var(--muted)' }} />
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700 }}>
          {game.kind.toUpperCase()} · {game.duration_fi}
        </span>
      </div>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {game.title_fi}
      </h3>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
        {game.subtitle_fi}
      </p>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        {active ? (
          <>
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--ink)', fontWeight: 700 }}>PELAA NYT</span>
            <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--ink)' }} />
          </>
        ) : (
          <>
            <Lock size={12} strokeWidth={1.6} style={{ color: 'var(--muted)' }} />
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)' }}>TULOSSA</span>
          </>
        )}
      </div>
    </Wrapper>
  );
};

export default PeliAreenaHub;
