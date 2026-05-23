/**
 * PUTKI HQ — GameTileArt
 *
 * Decorative SVG illustration per game kind. Replaces the bare icons that
 * the user called "terrible without images". Each art is hand-built so it
 * works across light/dark themes (uses `currentColor` + CSS vars).
 *
 *   • quiz     → a brain with question-mark tile
 *   • scenario → branching path (3 forks)
 *   • reveal   → 6 tiles with one peeled corner
 *   • arcade_snake → coiled snake on a grid
 *   • arcade_tap   → bird/chip + portal
 */
import React from 'react';

const W = 280, H = 140;

export const GameTileArt = ({ kind, slug }) => {
  const ink = 'var(--ink)';
  const muted = 'var(--muted)';
  const surface2 = 'var(--surface-2)';
  const accent = '#A0750F';

  if (slug === 'arcade_snake' || kind === 'arcade_snake') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden style={{ display: 'block' }}>
        <rect width={W} height={H} fill={surface2} />
        {/* faint grid */}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 28} y1={0} x2={i * 28} y2={H} stroke={muted} strokeOpacity="0.18" />
        ))}
        {Array.from({ length: 6 }).map((_, j) => (
          <line key={`h${j}`} x1={0} y1={j * 24} x2={W} y2={j * 24} stroke={muted} strokeOpacity="0.18" />
        ))}
        {/* food */}
        <circle cx={210} cy={60} r="7" fill={accent} />
        {/* snake — segmented squares */}
        {[[60, 60], [88, 60], [116, 60], [144, 60], [144, 84], [116, 84], [88, 84]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="20" height="20" rx="2"
                fill={ink} fillOpacity={1 - i * 0.08} />
        ))}
      </svg>
    );
  }

  if (slug === 'arcade_tap' || kind === 'arcade_tap') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden style={{ display: 'block' }}>
        <rect width={W} height={H} fill={surface2} />
        {/* Pipes */}
        <rect x="220" y="0" width="38" height="40" fill={accent} />
        <rect x="220" y="90" width="38" height="50" fill={accent} />
        <rect x="150" y="0" width="38" height="64" fill={accent} fillOpacity="0.6" />
        <rect x="150" y="114" width="38" height="26" fill={accent} fillOpacity="0.6" />
        {/* Chip token (bird) */}
        <circle cx="80" cy="68" r="18" fill={ink} />
        <circle cx="80" cy="68" r="10" fill={surface2} />
        <text x="80" y="74" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700"
              fontSize="14" fill={ink}>€</text>
        {/* Motion lines */}
        <line x1="30" y1="60" x2="55" y2="60" stroke={muted} strokeWidth="2" strokeOpacity="0.5" />
        <line x1="20" y1="72" x2="50" y2="72" stroke={muted} strokeWidth="2" strokeOpacity="0.3" />
      </svg>
    );
  }

  if (kind === 'reveal' || slug === 'insight_reveal') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden style={{ display: 'block' }}>
        <rect width={W} height={H} fill={surface2} />
        {/* 6 tiles in 3×2 grid */}
        {[0, 1, 2].map(col => [0, 1].map(row => {
          const i = row * 3 + col;
          const x = 40 + col * 70;
          const y = 16 + row * 56;
          const revealed = i === 1 || i === 4;
          return (
            <g key={`${col}-${row}`}>
              <rect x={x} y={y} width="60" height="44" rx="4"
                    fill={revealed ? 'transparent' : ink}
                    stroke={ink} strokeWidth="1.5"
                    strokeDasharray={revealed ? '0' : '4 3'} />
              {revealed && (
                <>
                  <line x1={x + 10} y1={y + 14} x2={x + 50} y2={y + 14} stroke={ink} strokeWidth="2" />
                  <line x1={x + 10} y1={y + 22} x2={x + 42} y2={y + 22} stroke={muted} strokeWidth="1.5" />
                  <line x1={x + 10} y1={y + 30} x2={x + 38} y2={y + 30} stroke={muted} strokeWidth="1.5" />
                </>
              )}
            </g>
          );
        }))}
        {/* Sparkle */}
        <g transform="translate(150 72)">
          <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill={accent} />
        </g>
      </svg>
    );
  }

  if (kind === 'scenario' || slug === 'scenario_decisions') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden style={{ display: 'block' }}>
        <rect width={W} height={H} fill={surface2} />
        {/* Starting circle */}
        <circle cx="50" cy="70" r="10" fill={ink} />
        {/* Three branching paths */}
        <path d="M 60 70 Q 130 30 220 30" stroke={ink} strokeWidth="2" fill="none" />
        <path d="M 60 70 Q 130 70 220 70" stroke={ink} strokeWidth="2" fill="none" />
        <path d="M 60 70 Q 130 110 220 110" stroke={ink} strokeWidth="2" fill="none" />
        {/* End nodes */}
        <circle cx="222" cy="30" r="8" fill="#3F8A4D" />
        <circle cx="222" cy="70" r="8" fill={muted} />
        <circle cx="222" cy="110" r="8" fill="#C8423C" />
        {/* Labels */}
        <text x="234" y="34" fontFamily="ui-monospace" fontSize="9" fill={muted} letterSpacing="1">3p</text>
        <text x="234" y="74" fontFamily="ui-monospace" fontSize="9" fill={muted} letterSpacing="1">1p</text>
        <text x="234" y="114" fontFamily="ui-monospace" fontSize="9" fill={muted} letterSpacing="1">0p</text>
      </svg>
    );
  }

  // Default: quiz
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden style={{ display: 'block' }}>
      <rect width={W} height={H} fill={surface2} />
      {/* Question card */}
      <rect x="60" y="30" width="160" height="80" rx="6" fill={ink} />
      <rect x="70" y="44" width="120" height="6" rx="2" fill={surface2} />
      <rect x="70" y="58" width="100" height="6" rx="2" fill={surface2} fillOpacity="0.7" />
      <rect x="70" y="78" width="140" height="6" rx="2" fill={surface2} fillOpacity="0.5" />
      <rect x="70" y="90" width="80" height="6" rx="2" fill={surface2} fillOpacity="0.5" />
      {/* Accent dot — "right answer" */}
      <circle cx="50" cy="44" r="6" fill="#3F8A4D" />
      <circle cx="50" cy="64" r="6" fill={muted} fillOpacity="0.4" />
      <circle cx="50" cy="84" r="6" fill={muted} fillOpacity="0.4" />
      <circle cx="50" cy="104" r="6" fill={muted} fillOpacity="0.4" />
      {/* RTP/% accent in corner */}
      <text x="230" y="120" fontFamily="Georgia, serif" fontWeight="700" fontSize="18"
            fill={accent} textAnchor="end">96%</text>
    </svg>
  );
};

export default GameTileArt;
