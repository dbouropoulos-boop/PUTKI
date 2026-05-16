import React, { useEffect, useRef, useState } from 'react';

// Animate a number from 0 → target on mount with cubic-out easing.
// Format func to control display (e.g., thousand separator).
export const CountUp = ({
  to = 0,
  duration = 1200,
  start = 0,
  format = (n) => Math.round(n).toString(),
  className,
  style,
  testid,
}) => {
  const [v, setV] = useState(start);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;
    const step = (t) => {
      if (startTimeRef.current == null) startTimeRef.current = t;
      const p = Math.min((t - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(start + (to - start) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration, start]);

  return (
    <span className={className} style={style} data-testid={testid}>
      {format(v)}
    </span>
  );
};

export default CountUp;
