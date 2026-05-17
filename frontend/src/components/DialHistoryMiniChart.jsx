import React, { useEffect, useMemo, useState } from 'react';
import { DIAL_STATES } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass — DialHistoryMiniChart reads /api/dial/history.
// No mock generator. When the snapshots collection is empty (first boot),
// chart renders a flat current-value line rather than fabricated history.

const STATE_BANDS = [
  { key: 'KYLMA',     low: 0,  high: 24, color: '#2C5F8D' },
  { key: 'HAALEA',    low: 24, high: 48, color: '#7A7E83' },
  { key: 'KUUMA',     low: 48, high: 72, color: '#E8924A' },
  { key: 'MYRSKY',    low: 72, high: 90, color: '#C8423C' },
  { key: 'KIIRASTULI', low: 90, high: 100, color: '#8B1E1A' },
];

export const DialHistoryMiniChart = ({ width = 360, height = 84, currentState = 'KUUMA' }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/dial/history?limit=48`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setHistory(d.history || []); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const currentColor = DIAL_STATES[currentState]?.color || '#7A7E83';
  const currentLabel = DIAL_STATES[currentState]?.label || currentState;

  // Sort oldest → newest, extract numeric values.
  const data = useMemo(() => {
    if (!history.length) return [];
    const sorted = [...history].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    return sorted.map((s) => Math.max(0, Math.min(100, Math.round(s.composite_score || 0))));
  }, [history]);

  if (data.length < 2) {
    return (
      <div data-testid="dial-history-chart" style={{ width: '100%', maxWidth: width }}>
        <div className="mono mb-2 flex items-center justify-between" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          <span>MITTARI · 24 H</span>
          <span style={{ color: currentColor }}>{currentLabel}</span>
        </div>
        <div className="panel" style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
            EI HISTORIAA VIELÄ · KESKIVÄYLÄ KERTYY POLLAUSTEN MYÖTÄ
          </div>
        </div>
      </div>
    );
  }

  const max = 100, min = 0;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / (max - min)) * height,
    v,
  }));
  const path = points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div data-testid="dial-history-chart" style={{ width: '100%', maxWidth: width }}>
      <div className="mono mb-2 flex items-center justify-between" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        <span>MITTARI · {data.length} POLL</span>
        <span style={{ color: currentColor }}>{currentLabel}</span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dial-history-area" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={currentColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={currentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
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
