import React from 'react';
import { Link } from 'react-router-dom';
import ShareButton from './ShareButton';

// State tint colors for moment data panels (Fix 3)
const STATE_TINTS = {
  KIIRASTULI: { color: '#8B1E1A', tint: 'rgba(139, 30, 26, 0.18)', tintDark: 'rgba(139, 30, 26, 0.35)' },
  MYRSKY:     { color: '#C8423C', tint: 'rgba(200, 66, 60, 0.16)', tintDark: 'rgba(200, 66, 60, 0.32)' },
  KUUMA:      { color: '#E8924A', tint: 'rgba(232, 146, 74, 0.16)', tintDark: 'rgba(232, 146, 74, 0.30)' },
  HAALEA:     { color: '#7A7E83', tint: 'rgba(122, 126, 131, 0.12)', tintDark: 'rgba(122, 126, 131, 0.24)' },
  KYLMA:      { color: '#2C5F8D', tint: 'rgba(44, 95, 141, 0.14)', tintDark: 'rgba(44, 95, 141, 0.28)' },
};

// Mini arc indicator for moment intensity
const MiniArc = ({ color }) => (
  <svg width="36" height="36" viewBox="0 0 36 36">
    <path
      d="M 6 28 A 14 14 0 0 1 30 28"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M 6 28 A 14 14 0 0 1 22 11"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const MomentCard = ({ moment, featured = false }) => {
  const intensity = moment.intensity || 'KUUMA';
  const tint = STATE_TINTS[intensity];

  return (
    <article
      className="overflow-hidden flex flex-col panel panel-hover"
      data-testid={`moment-card-${moment.id}`}
    >
      {/* DATA HERO PANEL — replaces stock photo (Fix 3) */}
      <div
        className="relative p-6 sm:p-8 flex flex-col justify-between"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${tint.tintDark} 0%, transparent 60%), #0A0A0A`,
          minHeight: featured ? 360 : 260,
          color: '#F5F3EE',
        }}
      >
        {/* Top row: streamer + mini arc */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
              STRIIMAAJA
            </div>
            <div className="mono mt-1.5" style={{ fontSize: 16, letterSpacing: '0.04em', fontWeight: 600 }}>
              {moment.streamer.toUpperCase()}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="mono text-right" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
              <div>VOITTO</div>
            </div>
            <MiniArc color={tint.color} />
          </div>
        </div>

        {/* Game name large */}
        <div>
          <div className="mono mb-3" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
            PELI
          </div>
          <div
            className="mono"
            style={{
              fontSize: featured ? 30 : 22,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1.05,
              color: '#F5F3EE',
            }}
          >
            {moment.game.toUpperCase()}
          </div>
        </div>

        {/* Amount won */}
        <div className="mt-6 flex items-end justify-between">
          <div
            className="mono"
            style={{
              fontSize: featured ? 56 : 38,
              fontWeight: 500,
              letterSpacing: '-0.04em',
              color: tint.color,
              lineHeight: 1,
            }}
          >
            {moment.win}
          </div>
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: '0.22em', fontWeight: 600, color: tint.color }}
            data-testid={`moment-intensity-${moment.id}`}
          >
            {intensity}
          </div>
        </div>
      </div>

      {/* Editorial body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col" style={{ background: 'var(--bg)' }}>
        <h3
          className={`font-display font-bold tracking-tight mb-3 ${featured ? 'text-2xl sm:text-3xl' : 'text-xl'}`}
          style={{ color: 'var(--ink)' }}
        >
          {moment.headline}
        </h3>
        <p className="font-serif text-[15px] leading-relaxed mb-5 flex-1" style={{ color: 'var(--ink)' }}>
          {moment.body}
        </p>
        <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
            {moment.source.toUpperCase()}
          </span>
          <div className="flex items-center gap-4">
            <ShareButton
              variant="moment"
              payload={{
                streamer: moment.streamer,
                game: moment.game,
                win: moment.win,
                headline: moment.headline,
                intensity,
              }}
              dataTestId={`moment-share-${moment.id}`}
            />
            {moment.operator ? (
              <Link
                to={`/kasinot/${moment.operator}`}
                className="mono"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--brand-blue)', fontWeight: 600 }}
                data-testid={`moment-operator-link-${moment.id}`}
              >
                {moment.operatorName.toUpperCase()} →
              </Link>
            ) : moment.scene ? (
              <span
                className="mono"
                style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700 }}
                data-testid={`moment-scene-${moment.id}`}
              >
                {moment.scene === 'global' ? 'INTL' : moment.scene === 'swedish' ? 'SWE' : moment.scene === 'dutch' ? 'NLD' : 'NOR'}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
};

export default MomentCard;
