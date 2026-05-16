import React, { useEffect, useRef, useState } from 'react';

// Animate a number from previous → target with cubic-out easing.
// When the target value changes after mount, the displayed value flashes
// briefly to highlight the tick.
export const CountUp = ({
  to = 0,
  duration = 1200,
  start = 0,
  format = (n) => Math.round(n).toString(),
  className,
  style,
  testid,
  flashOnChange = true,
}) => {
  const [v, setV] = useState(start);
  const [flash, setFlash] = useState(false);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const fromRef = useRef(start);
  const mountedRef = useRef(false);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;
    const fromVal = fromRef.current;
    const step = (t) => {
      if (startTimeRef.current == null) startTimeRef.current = t;
      const p = Math.min((t - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(fromVal + (to - fromVal) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);

    if (flashOnChange && mountedRef.current) {
      setFlash(true);
      const ft = setTimeout(() => setFlash(false), 600);
      return () => {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(ft);
      };
    }
    mountedRef.current = true;
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration, flashOnChange]);

  return (
    <span
      className={`${className || ''} ${flash ? 'flash-tick' : ''}`}
      style={style}
      data-testid={testid}
    >
      {format(v)}
    </span>
  );
};

export default CountUp;
