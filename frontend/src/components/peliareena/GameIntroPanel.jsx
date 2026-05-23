/**
 * PUTKI HQ — Peliareena · GameIntroPanel (iter59)
 *
 * Standalone game-page intro shared by all 5 mini-games. Surfaces the
 * trust signals a player wants to see BEFORE committing 90 seconds of
 * their attention:
 *
 *   • Branded eyebrow + headline + tagline
 *   • Trust chips (Pelaa heti · GDPR · Viikkoturnaus · Ei rahaa)
 *   • "Miten pelataan" — 3 numbered steps
 *   • "Pisteytys" — what counts toward the leaderboard
 *   • Live weekly leaderboard (top 10) — gaming/trust signal
 *   • Big "Aloita peli" CTA
 *   • Honest small-print (no purchase, GDPR, weekly reset)
 *
 * The playing / preview / unlocked stages are owned by each game.
 */
import React, { useEffect, useState } from 'react';
import { ChevronRight, Trophy, Shield, ClockAlert, BadgeEuro, Sparkles } from 'lucide-react';
import GameStatsStrip from '../GameStatsStrip';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TRUST_CHIPS = [
  { icon: Sparkles,    label: 'Pelaa ilman sähköpostia' },
  { icon: Shield,      label: 'GDPR · vapaaehtoinen liittyminen' },
  { icon: ClockAlert,  label: 'Viikkoturnaus · nollautuu maanantaina' },
  { icon: BadgeEuro,   label: 'Ei rahaa · ei korttitietoja' },
];

const GameIntroPanel = ({
  gameSlug,
  eyebrow,
  headline,
  tagline,
  howToPlay,
  scoring,
  ctaLabel,
  onStart,
  startTestId,
  controlsHint,
}) => {
  const [board, setBoard] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND}/api/mini-games/leaderboard/${gameSlug}?limit=10`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setBoard(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [gameSlug]);

  return (
    <div data-testid={`game-intro-panel-${gameSlug}`}>
      <GameStatsStrip gameSlug={gameSlug} />

      {/* Hero */}
      <div className="mono" style={{
        fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8',
        fontWeight: 700, marginBottom: 12,
      }}>
        {eyebrow}
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(32px, 5vw, 48px)', lineHeight: 1.08,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 16px',
      }}>
        {headline}
      </h1>
      <p style={{
        fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6,
        color: 'var(--muted)', maxWidth: 600, margin: '0 0 20px',
      }}>
        {tagline}
      </p>

      {/* Trust chips */}
      <div
        data-testid={`game-trust-chips-${gameSlug}`}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          margin: '0 0 28px',
        }}
      >
        {TRUST_CHIPS.map(({ icon: Icon, label }) => (
          <span key={label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            borderRadius: 999,
            fontFamily: 'Georgia, serif', fontSize: 12.5,
            color: 'var(--ink)', lineHeight: 1.2,
          }}>
            <Icon size={12} strokeWidth={1.8} style={{ color: 'var(--muted)' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Primary CTA */}
      <button
        onClick={onStart}
        data-testid={startTestId}
        style={{
          padding: '15px 30px',
          background: 'var(--ink)', color: 'var(--bg)',
          border: 'none', borderRadius: 4, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          margin: '0 0 36px',
        }}
      >
        {ctaLabel || 'Aloita peli'} <ChevronRight size={14} strokeWidth={2.5} />
      </button>

      {/* How to play + Scoring (2-up on desktop) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14, margin: '0 0 32px',
      }}>
        <Panel title="MITEN PELATAAN" accent="var(--ink)">
          <ol style={{
            margin: 0, padding: 0, listStyle: 'none',
            counterReset: 'how 0',
          }}>
            {howToPlay.map((step, i) => (
              <li key={i} style={{
                counterIncrement: 'how 1',
                position: 'relative',
                padding: '10px 0 10px 32px',
                borderBottom: i < howToPlay.length - 1 ? '1px dotted var(--border)' : 'none',
                fontFamily: 'Georgia, serif', fontSize: 14.5,
                color: 'var(--ink)', lineHeight: 1.5,
              }}>
                <span className="mono" style={{
                  position: 'absolute', left: 0, top: 12,
                  fontSize: 11, fontWeight: 700, color: '#5A7BB8',
                  letterSpacing: '0.06em',
                }}>0{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          {controlsHint && (
            <p className="mono" style={{
              marginTop: 10, fontSize: 10.5, letterSpacing: '0.12em',
              color: 'var(--muted)', lineHeight: 1.5,
            }}>
              {controlsHint}
            </p>
          )}
        </Panel>

        <Panel title="PISTEYTYS" accent="#A0750F">
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
          }}>
            {scoring.map((line, i) => (
              <li key={i} style={{
                padding: '8px 0',
                borderBottom: i < scoring.length - 1 ? '1px dotted var(--border)' : 'none',
                fontFamily: 'Georgia, serif', fontSize: 14.5,
                color: 'var(--ink)', lineHeight: 1.5,
                display: 'flex', gap: 10, alignItems: 'baseline',
              }}>
                <span style={{
                  flexShrink: 0,
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#A0750F',
                  display: 'inline-block',
                  transform: 'translateY(-2px)',
                }} />
                {line}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Live leaderboard */}
      <LeaderboardBlock gameSlug={gameSlug} board={board} />

      {/* Footer disclaimer */}
      <p style={{
        marginTop: 28,
        fontFamily: 'Georgia, serif', fontSize: 12.5,
        color: 'var(--muted)', lineHeight: 1.55,
        maxWidth: 620,
      }}>
        Pelin pelaaminen ei vaadi sähköpostia. Tulokset ja viikon turnaus avautuvat,
        kun annat sähköpostisi vapaaehtoisesti. Viikon mestaruus on tunnustus —
        ei rahaa eikä rahanarvoista palkintoa.
      </p>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────

const Panel = ({ title, accent, children }) => (
  <div style={{
    border: '1px solid var(--border)',
    borderLeft: `3px solid ${accent}`,
    background: 'var(--surface)',
    borderRadius: 4,
    padding: '14px 18px 16px',
  }}>
    <div className="mono" style={{
      fontSize: 10.5, letterSpacing: '0.22em', color: accent,
      fontWeight: 700, marginBottom: 6,
    }}>{title}</div>
    {children}
  </div>
);

const LeaderboardBlock = ({ gameSlug, board }) => {
  const rows = (board && board.leaderboard) || [];
  const ranked = (board && board.ranked_players) || 0;
  return (
    <div data-testid={`game-leaderboard-${gameSlug}`}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 12,
        flexWrap: 'wrap', gap: 8,
      }}>
        <div className="mono" style={{
          fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)',
          fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Trophy size={13} strokeWidth={1.8} style={{ color: '#A0750F' }} />
          VIIKON TOP 10
        </div>
        <span className="mono" style={{
          fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)',
        }}>
          {board?.week_iso ? `VIIKKO ${board.week_iso}` : '—'} · {ranked} pelaajaa
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          data-testid={`game-leaderboard-empty-${gameSlug}`}
          style={{
            padding: '16px 18px',
            border: '1px dashed var(--border)',
            borderRadius: 4,
            background: 'var(--surface)',
          }}
        >
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: 14.5,
            color: 'var(--muted)', margin: 0, lineHeight: 1.5,
          }}>
            Tämä viikko on vielä pisteyttämättä. Olisitko sinä viikon ensimmäinen pelaaja?
          </p>
        </div>
      ) : (
        <ol style={{
          margin: 0, padding: 0, listStyle: 'none',
          border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden',
        }}>
          {rows.map((row, i) => (
            <li key={row.rank} style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr auto',
              alignItems: 'baseline',
              padding: '10px 14px',
              background: i === 0 ? 'var(--surface-2)' : 'var(--surface)',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              fontFamily: 'Georgia, serif', fontSize: 15,
              color: 'var(--ink)',
            }}>
              <span className="mono" style={{
                fontSize: 11.5, fontWeight: 700,
                color: row.rank === 1 ? '#A0750F' : 'var(--muted)',
                letterSpacing: '0.06em',
              }}>
                #{row.rank}
              </span>
              <span style={{
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                paddingRight: 12,
              }}>
                {row.display_name}
              </span>
              <span className="mono" style={{
                fontSize: 12.5, fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '0.04em',
              }}>
                {row.score}p
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default GameIntroPanel;
