import React, { useEffect, useState } from 'react';
import { DIAL_STATES } from '../data/mock';

// The Mittari signature component: P*rkele-mittari.
// Sizes: large (480), medium (280), small (64). SVG-based, animated needle.

const STATE_ORDER = ['KYLMA', 'HAALEA', 'KUUMA', 'MYRSKY', 'KIIRASTULI'];

const ARC_COLORS = [
  '#2C5F8D', // KYLMÄ
  '#7A7E83', // HAALEA
  '#E8924A', // KUUMA
  '#C8423C', // MYRSKY
  '#8B1E1A', // KIIRASTULI
];

// Convert value 0..100 → angle on a 220° arc starting at -200° (left-bottom) to 20° (right-bottom)
const valueToAngle = (value) => {
  const start = -200; // left-bottom
  const end = 20; // right-bottom
  return start + ((end - start) * value) / 100;
};

export const Dial = ({ size = 'large', state = 'KUUMA', showLabel = true, animatedNeedle = true }) => {
  const stateObj = DIAL_STATES[state] || DIAL_STATES.KUUMA;
  const px = size === 'large' ? 480 : size === 'medium' ? 280 : 64;
  const strokeWidth = size === 'large' ? 14 : size === 'medium' ? 10 : 5;

  const [angle, setAngle] = useState(valueToAngle(0));

  useEffect(() => {
    // Animate to target on mount / state change
    const target = valueToAngle(stateObj.value);
    let raf;
    const start = performance.now();
    const duration = animatedNeedle ? 900 : 0;
    const initial = angle;
    const animate = (t) => {
      const elapsed = t - start;
      const p = duration === 0 ? 1 : Math.min(elapsed / duration, 1);
      // cubic-bezier-ish ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setAngle(initial + (target - initial) * eased);
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [state, animatedNeedle]);

  // SVG geometry
  const cx = px / 2;
  const cy = px * 0.58;
  const r = px * 0.40;

  // Build 5 colored arc segments
  const arcStart = -200;
  const arcEnd = 20;
  const totalSweep = arcEnd - arcStart; // 220
  const segSweep = totalSweep / 5;

  const polarToCartesian = (centerX, centerY, radius, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: centerX + radius * Math.cos(rad), y: centerY + radius * Math.sin(rad) };
  };

  const arcPath = (radius, startAngle, endAngle) => {
    const s = polarToCartesian(cx, cy, radius, startAngle);
    const e = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${e.x} ${e.y}`;
  };

  const needleLen = r - strokeWidth / 2 - (size === 'small' ? 3 : 8);
  const needleEnd = polarToCartesian(cx, cy, needleLen, angle);

  // Tick marks (only for large + medium)
  const showTicks = size !== 'small';
  const ticks = showTicks
    ? Array.from({ length: 11 }, (_, i) => {
        const a = arcStart + (i * totalSweep) / 10;
        const outer = polarToCartesian(cx, cy, r + strokeWidth / 2 + 4, a);
        const inner = polarToCartesian(cx, cy, r + strokeWidth / 2 + (i % 5 === 0 ? 14 : 8), a);
        return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major: i % 5 === 0 };
      })
    : [];

  const isHot = ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

  return (
    <div className={`flex flex-col items-center ${size === 'small' ? 'gap-0' : 'gap-3'}`} data-testid={`dial-${size}`}>
      <svg
        width={px}
        height={size === 'small' ? px : px * 0.78}
        viewBox={`0 0 ${px} ${px * 0.78}`}
        className={isHot && size !== 'small' ? 'animate-live-pulse' : ''}
        style={{ animationDuration: '2.4s' }}
      >
        {/* 5 colored arc segments */}
        {ARC_COLORS.map((color, i) => {
          const sa = arcStart + i * segSweep;
          const ea = arcStart + (i + 1) * segSweep;
          return (
            <path
              key={i}
              d={arcPath(r, sa, ea)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              opacity={STATE_ORDER[i] === state ? 1 : 0.22}
            />
          );
        })}

        {/* Ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="#0A0A0A"
            strokeWidth={t.major ? 1.4 : 0.8}
            opacity={t.major ? 0.9 : 0.45}
          />
        ))}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={size === 'small' ? 3 : size === 'medium' ? 8 : 14} fill="#0A0A0A" />
        <circle cx={cx} cy={cy} r={size === 'small' ? 1.4 : size === 'medium' ? 3 : 5} fill="#FBFAF8" />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="#0A0A0A"
          strokeWidth={size === 'large' ? 4 : size === 'medium' ? 2.6 : 1.6}
          strokeLinecap="round"
        />

        {/* Inner ring shadow */}
        <circle
          cx={cx}
          cy={cy}
          r={r - strokeWidth}
          fill="none"
          stroke="#E8E5DF"
          strokeWidth={0.6}
          opacity={size === 'small' ? 0 : 0.7}
        />
      </svg>

      {showLabel && (
        <div className="flex flex-col items-center">
          {size !== 'small' && (
            <div className="eyebrow mb-1.5">P*rkele-mittari</div>
          )}
          <div
            className={`font-display font-black tracking-tight ${
              size === 'large' ? 'text-5xl sm:text-6xl' : size === 'medium' ? 'text-3xl' : 'text-xs'
            }`}
            style={{ color: stateObj.color }}
            data-testid={`dial-state-label-${stateObj.key}`}
          >
            {stateObj.label}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dial;
