/**
 * Voyager - Pass (win → editorial artifact).
 *
 * Spec §4.3: the win becomes a visible thing the visitor *carries*, not
 * a marketing message. UUID is rendered as a short, copyable code that
 * travels with the visitor on redirect to the operator.
 *
 * Slot-flip animation + confetti burst gives the win a moment of
 * weight; the variance feels earned, not announced.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ConfettiBurst from '../ConfettiBurst';

// 2-second number-roll: cycles through random values in the variance
// range then locks on the real prize. Falls straight to the final value
// if reduce-motion is on (or the component re-renders mid-animation).
const SlotFlipNumber = ({ target, min, max, durationMs = 1600, onLock }) => {
  const [display, setDisplay] = useState(target);
  const onLockRef = useRef(onLock);
  useEffect(() => { onLockRef.current = onLock; }, [onLock]);
  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplay(target);
      try { onLockRef.current && onLockRef.current(); } catch (e) { console.debug('[voyager] onLock failed', e); }
      return undefined;
    }
    const start = performance.now();
    let rafId = 0;
    let stopped = false;
    const lo = Math.max(0, Number(min) || 0);
    const hi = Math.max(lo, Number(max) || lo + 1);
    const tick = (now) => {
      if (stopped) return;
      const t = Math.min(1, (now - start) / durationMs);
      if (t < 1) {
        const step = Math.max(40, Math.round(40 + t * t * t * 240));
        const phase = Math.floor((now - start) / step);
        const rng = lo + Math.floor(((phase * 1103515245) % (hi - lo + 1)) + (hi - lo + 1)) % (hi - lo + 1);
        setDisplay(rng);
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        try { onLockRef.current && onLockRef.current(); } catch (e) { console.debug('[voyager] onLock failed', e); }
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(rafId); };
  }, [target, min, max, durationMs]);
  return <span data-testid="voyager-pass-flip">{display}</span>;
};

const Pass = ({ lang, prize, week }) => {
  // Prize amount: use the operator-supplied value when present, otherwise
  // pick a *real* random value inside the configured variance range. Hooks
  // run unconditionally - the null-prize early-return is below.
  const supplied = prize ? (prize.amount ?? prize.spins ?? prize.value) : null;
  const target = useMemo(() => {
    if (Number.isFinite(Number(supplied))) return Number(supplied);
    const lo = Number(week.prize.min) || 1;
    const hi = Number(week.prize.max) || lo + 1;
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }, [supplied, week.prize.min, week.prize.max]);
  const [confettiKey, setConfettiKey] = useState(0);
  const handleSlotLock = useCallback(() => {
    setConfettiKey((n) => n + 1);
  }, []);
  if (!prize) return null;
  const shortCode = (prize.visitor_win_uuid || '')
    .replace(/-/g, '').toUpperCase().slice(0, 8) || 'VOYAGER';
  const label = lang === 'en' ? week.prize.label_en : week.prize.label_fi;
  const slot = lang === 'en' ? week.prize.slot_en : week.prize.slot_fi;
  return (
    <motion.section data-testid="voyager-pass" key="voyager-pass"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
      style={{
        padding: '36px 24px',
        background: 'linear-gradient(135deg, #14110d 0%, #1e1810 60%, #2a1d10 100%)',
        borderTop: '1px solid #3A2D1A',
        borderBottom: '1px solid #3A2D1A',
        color: '#FFFFFF', position: 'relative', overflow: 'hidden',
      }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 600px 200px at 80% 0%, rgba(255,191,107,0.15), transparent)',
      }} />
      {confettiKey > 0 && <ConfettiBurst triggerKey={confettiKey} />}
      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div data-testid="voyager-pass-eyebrow" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.28em', fontWeight: 700, color: '#FFBF6B',
        }}>{lang === 'en' ? '✓ YOUR PASS' : '✓ PASSISI'}</div>
        <h2 data-testid="voyager-pass-amount" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(32px, 4.4vw, 52px)', lineHeight: 1.05,
          letterSpacing: '-0.02em', margin: '12px 0 10px',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <SlotFlipNumber target={target}
            min={week.prize.min} max={week.prize.max}
            onLock={handleSlotLock} />
          {' '}{label}
        </h2>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.5,
          color: 'rgba(255,255,255,0.86)', margin: '0 0 18px',
        }}>
          {lang === 'en'
            ? `${slot}. This is yours. Redeem at ${week.operator.name}.`
            : `${slot}. Tämä on sinun. Lunasta ${week.operator.name}illä.`}
        </p>
        <div data-testid="voyager-pass-code" style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          padding: '12px 18px', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,191,107,0.35)', borderRadius: 4,
          fontFamily: 'ui-monospace, monospace', fontSize: 14,
          letterSpacing: '0.22em', fontWeight: 700, color: '#FFE5BF',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
            {lang === 'en' ? 'CODE' : 'KOODI'}
          </span>
          <span>{shortCode}</span>
        </div>
      </div>
    </motion.section>
  );
};

export default Pass;
