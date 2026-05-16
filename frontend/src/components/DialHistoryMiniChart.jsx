import React, { useMemo } from 'react';
import { generateDialHistory } from '../data/mockStreams';
import { DIAL_STATES } from '../data/mock';

// Compact 24h sparkline of dial value with state-color band thresholds.
const STATE_BANDS = [
  { key: 'KYLMA',     low: 0,  high: 24, color: '#2C5F8D' },
  { key: 'HAALEA',    low: 24, high: 48, color: '#7A7E83' },
  { key: 'KUUMA',     low: 48, high: 72, color: '#E8924A' },
  { key: 'MYRSKY',    low: 72, high: 90, color: '#C8423C' },
  { key: 'KIIRASTULI', low: 90, high: 100, color: '#8B1E1A' },
];

const colorForValue = (v) => STATE_BANDS.find((b) => v < b.high)?.color || '#8B1E1A';

export const DialHistoryMiniChart = ({ width = 360, height = 84, currentState = 'KUUMA' }) => {
  const data = useMemo(() => generateDialHistory(DIAL_STATES[currentState].value, 48), [currentState]);
  const currentColor = DIAL_STATES[currentState].color;

  const max = 100, min = 0;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / (max - min)) * height,
    v,
  }));

  const path = points.reduce((acc, p, i) =>
    acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`)
  , '');

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div data-testid="dial-history-chart" style={{ width: '100%', maxWidth: width }}>
      <div className="mono mb-2 flex items-center justify-between" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        <span>MITTARI · 24 H</span>
        <span style={{ color: currentColor }}>{DIAL_STATES[currentState].label}</span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dial-history-area" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={currentColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={currentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Threshold lines */}
        {STATE_BANDS.slice(0, -1).map((b) => (
          <line
            key={b.key}
            x1="0" y1={height - (b.high / 100) * height}
            x2={width} y2={height - (b.high / 100) * height}
            stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,4"
          />
        ))}
        <path d={areaPath} fill="url(#dial-history-area)" />
        <path d={path} fill="none" stroke={currentColor} strokeWidth="1.6" strokeLinejoin="round" />
        {/* Current point dot */}
        <circle cx={points[points.length - 1].x - 1} cy={points[points.length - 1].y} r="3" fill={currentColor}>
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="mono mt-1 flex justify-between" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
        <span>−24h</span>
        <span>−12h</span>
        <span>NYT</span>
      </div>
    </div>
  );
};

export default DialHistoryMiniChart;
