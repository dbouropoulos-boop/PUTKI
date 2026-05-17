import React, { useEffect, useState, useRef } from 'react';
import { DIAL_STATES } from '../constants/dial';

// Helper: state hot check (re-used in breathing amplitude)
const isHotState = (s) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(s);

// Dial V2 — cockpit-grade instrument
// - Mechanical bezel (concentric rings)
// - Hierarchical ticks (major + minor)
// - Tapered needle with counterweight
// - State-colored active arc, muted inactive arcs
// - Spring physics needle settle
// - Pulse glow on KUUMA+ states

const STATE_ORDER = ['KYLMA', 'HAALEA', 'KUUMA', 'MYRSKY', 'KIIRASTULI'];

const ARC_COLORS = {
  KYLMA:      '#2C5F8D',
  HAALEA:     '#7A7E83',
  KUUMA:      '#E8924A',
  MYRSKY:     '#C8423C',
  KIIRASTULI: '#8B1E1A',
};

// Arc geometry: 240° sweep, starting at -210° (lower-left) to 30° (lower-right)
const ARC_START = -210;
const ARC_END = 30;
const ARC_TOTAL = ARC_END - ARC_START; // 240
const SEG_SWEEP = ARC_TOTAL / 5;       // 48 each

const valueToAngle = (value) => ARC_START + (ARC_TOTAL * value) / 100;

const polar = (cx, cy, r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx, cy, r, startDeg, endDeg) => {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
};

// Spring physics — needle settles with damped oscillation
const useSpringAngle = (target, deps = []) => {
  const [angle, setAngle] = useState(target);
  const angleRef = useRef(target);
  const velocityRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const stiffness = 90;
    const damping = 11;
    const mass = 1.1;
    let last = performance.now();

    const step = (now) => {
      const dtRaw = (now - last) / 1000;
      const dt = Math.min(dtRaw, 0.033); // cap to ~30fps slice for stability
      last = now;

      const x = angleRef.current;
      const v = velocityRef.current;
      const force = -stiffness * (x - target) - damping * v;
      const a = force / mass;
      const newV = v + a * dt;
      const newX = x + newV * dt;
      angleRef.current = newX;
      velocityRef.current = newV;
      setAngle(newX);

      if (Math.abs(newX - target) > 0.05 || Math.abs(newV) > 0.05) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        angleRef.current = target;
        velocityRef.current = 0;
        setAngle(target);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, [target, ...deps]);

  return angle;
};

export const Dial = ({
  size = 'large',
  state = 'KUUMA',
  showLabel = true,
}) => {
  const stateObj = DIAL_STATES[state] || DIAL_STATES.KUUMA;
  const px = size === 'large' ? 480 : size === 'medium' ? 280 : 64;
  const isSmall = size === 'small';
  const isMedium = size === 'medium';

  // Geometry
  const cx = px / 2;
  const cy = px / 2;
  const outerR = px * 0.46;      // bezel outer
  const arcR = px * 0.38;        // colored arc radius
  const tickInnerR = arcR + (isSmall ? 4 : 8);
  const tickMajorR = arcR + (isSmall ? 6 : 14);
  const labelR = arcR + (isSmall ? 0 : 26);

  const strokeWidth = isSmall ? 6 : isMedium ? 14 : 22;

  const targetAngle = valueToAngle(stateObj.value);
  const settledAngle = useSpringAngle(targetAngle, [state]);

  // Continuous "breathing" drift — needle wavers ±2-3° around the settled angle
  // so the instrument never feels frozen. Disabled for tiny dials.
  const [breath, setBreath] = useState(0);
  useEffect(() => {
    if (isSmall) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      // Two superimposed sines for organic motion (frequencies don't divide evenly)
      const amp = isHotState(state) ? 2.6 : 1.6;
      const drift = Math.sin(t * 0.85) * amp + Math.sin(t * 1.37 + 0.6) * (amp * 0.4);
      setBreath(drift);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSmall, state]);

  const angle = settledAngle + breath;

  // Major ticks: 6 (5 state boundaries + endpoints)
  const majorTicks = Array.from({ length: 6 }, (_, i) => ARC_START + (i * ARC_TOTAL) / 5);
  // Minor ticks: 3 between each pair of major ticks → 15 total
  const minorTicks = [];
  for (let seg = 0; seg < 5; seg++) {
    const segStart = ARC_START + seg * SEG_SWEEP;
    for (let m = 1; m <= 3; m++) {
      minorTicks.push(segStart + (m * SEG_SWEEP) / 4);
    }
  }

  // State labels
  const stateLabels = STATE_ORDER.map((key, i) => ({
    key,
    label: DIAL_STATES[key].label,
    // Center of each segment
    angle: ARC_START + (i + 0.5) * SEG_SWEEP,
  }));

  const needleLen = arcR - (isSmall ? 4 : 22);
  const needleTip = polar(cx, cy, needleLen, angle);
  const counterEnd = polar(cx, cy, isSmall ? -8 : -22, angle);

  const isHot = ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);
  const activeColor = ARC_COLORS[state];

  return (
    <div className="flex flex-col items-center" style={{ width: '100%', maxWidth: px }} data-testid={`dial-${size}`}>
      <svg
        width="100%"
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxWidth: px, height: 'auto' }}
      >
        <defs>
          {/* Subtle radial gradient on dial face */}
          <radialGradient id={`face-${size}`} cx="50%" cy="48%" r="60%">
            <stop offset="0%"   stopColor="var(--bg)" stopOpacity="0" />
            <stop offset="65%"  stopColor="var(--bg)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.06" />
          </radialGradient>

          {/* Needle drop shadow */}
          <filter id={`needle-shadow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>

          {/* Active arc glow for KUUMA+ */}
          {isHot && (
            <filter id={`arc-glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Bezel — outer ring */}
        {!isSmall && (
          <>
            <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r={outerR - 5} fill="none" stroke="var(--border)" strokeWidth="1" />
            {/* Inner chamfer highlight (subtle) */}
            <circle cx={cx} cy={cy} r={outerR - 9} fill="none" stroke="var(--ink)" strokeWidth="0.5" opacity="0.15" />
          </>
        )}

        {/* Dial face gradient */}
        {!isSmall && <circle cx={cx} cy={cy} r={outerR - 10} fill={`url(#face-${size})`} />}

        {/* All 5 arc segments — inactive dim, active glows */}
        {STATE_ORDER.map((key, i) => {
          const sa = ARC_START + i * SEG_SWEEP + 0.6; // tiny gap between segments
          const ea = ARC_START + (i + 1) * SEG_SWEEP - 0.6;
          const isActive = key === state;
          return (
            <path
              key={key}
              d={arcPath(cx, cy, arcR, sa, ea)}
              fill="none"
              stroke={ARC_COLORS[key]}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              opacity={isActive ? 1 : 0.12}
              filter={isActive && isHot ? `url(#arc-glow-${size})` : undefined}
              style={{
                color: ARC_COLORS[key],
                transition: 'opacity 600ms ease',
              }}
              className={isActive && isHot ? 'arc-glow' : ''}
            />
          );
        })}

        {/* Minor ticks */}
        {!isSmall && minorTicks.map((a, i) => {
          const inner = polar(cx, cy, tickInnerR, a);
          const outer = polar(cx, cy, tickInnerR + 5, a);
          return (
            <line
              key={`mi-${i}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--ink)"
              strokeWidth={0.7}
              opacity={0.35}
            />
          );
        })}

        {/* Major ticks */}
        {!isSmall && majorTicks.map((a, i) => {
          const inner = polar(cx, cy, tickInnerR, a);
          const outer = polar(cx, cy, tickMajorR, a);
          return (
            <line
              key={`ma-${i}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--ink)"
              strokeWidth={1.6}
              opacity={0.75}
            />
          );
        })}

        {/* State name labels (around arc, large only) */}
        {!isSmall && !isMedium && stateLabels.map((s) => {
          const p = polar(cx, cy, labelR, s.angle);
          return (
            <text
              key={`lbl-${s.key}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: '0.18em',
                fill: s.key === state ? ARC_COLORS[s.key] : 'var(--muted)',
                opacity: s.key === state ? 1 : 0.5,
              }}
            >
              {s.label}
            </text>
          );
        })}

        {/* Needle — tapered, with counterweight */}
        <g filter={`url(#needle-shadow-${size})`}>
          {/* Counterweight (small fin past pivot) */}
          {!isSmall && (
            <line
              x1={cx}
              y1={cy}
              x2={counterEnd.x}
              y2={counterEnd.y}
              stroke="var(--needle)"
              strokeWidth={isMedium ? 4 : 5}
              strokeLinecap="round"
              opacity={0.85}
            />
          )}
          {/* Main needle — tapered using two strokes */}
          <line
            x1={cx}
            y1={cy}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="var(--needle)"
            strokeWidth={isSmall ? 1.6 : isMedium ? 3 : 4.5}
            strokeLinecap="round"
          />
          {/* Needle tip accent — pick up state color when hot */}
          <line
            x1={cx + (needleTip.x - cx) * 0.7}
            y1={cy + (needleTip.y - cy) * 0.7}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={isHot ? activeColor : 'var(--needle)'}
            strokeWidth={isSmall ? 1.6 : isMedium ? 3 : 4.5}
            strokeLinecap="round"
          />
        </g>

        {/* Central hub */}
        <circle cx={cx} cy={cy} r={isSmall ? 3 : isMedium ? 9 : 14} fill="var(--ink)" />
        <circle cx={cx} cy={cy} r={isSmall ? 1.2 : isMedium ? 3.5 : 5.5} fill="var(--bg)" />
      </svg>

      {showLabel && (
        <div className="flex flex-col items-center mt-1">
          {!isSmall && (
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'var(--muted)',
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              P*RKELE-MITTARI
            </div>
          )}
          <div
            className="display state-pulse"
            style={{
              fontSize: isSmall ? 11 : isMedium ? 36 : 64,
              fontWeight: 900,
              color: activeColor,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
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
