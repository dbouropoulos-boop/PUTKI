/**
 * PUTKI HQ — GameStatsStrip (iter58)
 *
 * Social-proof strip rendered on each individual game's subpage. Pulls
 * per-game public metrics from `GET /api/mini-games/stats/{slug}` and
 * shows: plays_finished this week + ranked players + current rank-1.
 * Stays HIDDEN when there's no data (no "0 plays" embarrassment).
 *
 * Mounted near the top of each PeliAreena* page intro screen so the
 * player sees real activity before they commit to playing.
 */
import React, { useEffect, useState } from 'react';
import { Trophy, Users, Play } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const GameStatsStrip = ({ gameSlug }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND}/api/mini-games/stats/${gameSlug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (alive && d) setStats(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [gameSlug]);

  if (!stats) return null;
  // Only show the strip when at least someone has finished a play.
  if (!stats.plays_finished) return null;

  return (
    <div
      data-testid={`game-stats-strip-${gameSlug}`}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 24,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        marginBottom: 28,
      }}
    >
      <Stat icon={<Play size={13} strokeWidth={1.7} />}
            label="PELATTU TÄLLÄ VIIKOLLA"
            value={stats.plays_finished} />
      <Stat icon={<Users size={13} strokeWidth={1.7} />}
            label="RANATTUA PELAAJAA"
            value={stats.ranked_players} />
      {stats.top_score > 0 && (
        <Stat icon={<Trophy size={13} strokeWidth={1.7} />}
              label="VIIKON JOHTO"
              value={`${stats.top_player} · ${stats.top_score}p`} />
      )}
    </div>
  );
};

const Stat = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
    <span style={{ color: 'var(--muted)' }}>{icon}</span>
    <div style={{ minWidth: 0 }}>
      <div className="mono" style={{
        fontSize: 9.5, letterSpacing: '0.20em', color: 'var(--muted)',
        fontWeight: 700, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15,
        color: 'var(--ink)', letterSpacing: '-0.005em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 220,
      }}>{value}</div>
    </div>
  </div>
);

export default GameStatsStrip;
