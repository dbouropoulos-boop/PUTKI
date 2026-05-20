/**
 * ConfettiBurst — one-shot canvas confetti, ~1.2s, ~50 particles.
 *
 * Mount it with a unique `triggerKey` (e.g. the prize UUID) and it'll
 * fire once. Re-mount with a new key to fire again. Respects
 * `prefers-reduced-motion: reduce` (renders nothing).
 *
 * Designed to layer over the Voyager pass: pointer-events:none, absolute
 * positioning is the parent's job.
 *
 * Zero deps — pure RAF + canvas.
 */
import React, { useEffect, useRef } from 'react';

const COLORS = ['#FFBF6B', '#FFE5BF', '#6FA37D', '#FFFFFF', '#C13B2C'];

const ConfettiBurst = ({ triggerKey, count = 60, durationMs = 1300 }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // Size canvas to its rendered box (DPR-aware so it stays crisp).
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    // Emitter sits where the prize number is — roughly upper-third.
    const ox = W / 2;
    const oy = H * 0.32;

    const particles = Array.from({ length: count }, () => {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 220 + Math.random() * 240;
      return {
        x: ox + (Math.random() - 0.5) * 40,
        y: oy + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 8,
        size: 4 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
      };
    });

    const start = performance.now();
    const gravity = 720; // px/sec²

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      ctx.clearRect(0, 0, W, H);
      // Quadratic fade-out the last 35% of the run.
      const alpha = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
      ctx.globalAlpha = alpha;
      const dt = 1 / 60;
      for (const p of particles) {
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [triggerKey, count, durationMs]);

  return (
    <canvas ref={canvasRef}
      data-testid="voyager-confetti"
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 2,
      }} />
  );
};

export default ConfettiBurst;
