/**
 * PUTKI HQ — Tämän viikon mestarit (Weekly champions banner) · iter57
 *
 * Auto-pulls rank-1 from each active game for the current ISO week.
 * Renders only when at least one game has a ranked player. Designed to
 * sit between NewsTicker and ExploreBlocks on the homepage — restrained
 * editorial styling, never gambling marketing.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ChevronRight } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const WeeklyChampionsBanner = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND}/api/mini-games/champions`)
      .then(r => r.json())
      .then(d => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || !data.has_data) return null;
  const champions = data.champions.slice(0, 5);

  return (
    <section
      data-testid="weekly-champions-banner"
      style={{
        marginTop: 28, padding: '20px 0',
        borderTop: '1px solid var(--hairline, var(--border))',
        borderBottom: '1px solid var(--hairline, var(--border))',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 14, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <Trophy size={14} strokeWidth={1.7} style={{ color: '#A0750F' }} />
          <span className="mono" style={{
            fontSize: 11, letterSpacing: '0.24em', color: '#A0750F', fontWeight: 700,
          }}>
            TÄMÄN VIIKON MESTARIT · {data.week_iso}
          </span>
        </div>
        <Link
          to="/peliareena"
          data-testid="champions-banner-cta"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: 'var(--muted)', textDecoration: 'none',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.20em', fontWeight: 700,
          }}
        >
          PELIAREENAAN <ChevronRight size={12} strokeWidth={2} />
        </Link>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(champions.length, 5)}, minmax(0, 1fr))`,
        gap: 0,
      }}>
        {champions.map((c, i) => (
          <Link
            key={c.game_slug}
            to={c.play_url}
            data-testid={`champion-${c.game_slug}`}
            style={{
              display: 'block', textDecoration: 'none',
              padding: '12px 16px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
              transition: 'background 160ms ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div className="mono" style={{
              fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)',
              fontWeight: 700, marginBottom: 4,
            }}>
              {c.game_title_fi.toUpperCase()}
            </div>
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700,
              color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.15,
              marginBottom: 2,
            }}>
              {c.champion_name}
            </div>
            <div className="mono" style={{
              fontSize: 11, letterSpacing: '0.06em', color: '#A0750F', fontWeight: 600,
            }}>
              {c.score_label}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default WeeklyChampionsBanner;
