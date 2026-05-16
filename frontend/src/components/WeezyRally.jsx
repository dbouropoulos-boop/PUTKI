import React, { useEffect, useRef, useState, useCallback } from 'react';

// Weezy Rally — lightweight canvas rally game.
// Cockpit aesthetic: dark, mono HUD, dial-state colored elements.
// Gameplay: vertically-scrolling road, swerve to avoid obstacles, score = distance × speed.
// Controls:
//   Desktop: ←/→ or A/D to steer; Space to brake; Up/Down to accelerate/brake
//   Mobile:  on-canvas touch — drag to steer; tap brake button
// Each play lasts until 3 crashes or 75 s elapse. Score then submitted.

const ROAD_COLOR = '#1A1A1A';
const ROAD_LINE  = '#3A3A3A';
const DIAL_AMBER = '#E8924A';
const DIAL_RED   = '#C8423C';

const STAGE_WIDTH = 6;          // 6 lanes wide visually; player can move continuously
const STAGE_LENGTH = 75;        // seconds
const PLAYER_WIDTH_PCT = 0.10;
const PLAYER_HEIGHT_PCT = 0.16;

export const WeezyRally = ({ onFinish, onTick, lang = 'fi' }) => {
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(STAGE_LENGTH);
  const [crashes, setCrashes] = useState(0);
  const [done, setDone] = useState(false);
  const [muted, setMuted] = useState(true);

  const stateRef = useRef({
    playerX: 0.5,            // 0..1 horizontal
    targetX: 0.5,
    speed: 4,                // visual scroll speed (units/sec)
    obstacles: [],           // {x, y, type}
    nitros: [],              // {x, y}
    keys: {},
    score: 0,
    crashes: 0,
    timeLeft: STAGE_LENGTH,
    lastT: 0,
    obstacleTimer: 0,
    nitroTimer: 8,
    running: false,
    invuln: 0,
    dragOffsetX: null,
  });

  // ── Resize canvas on mount + window resize ──
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Keyboard handlers ──
  useEffect(() => {
    const onDown = (e) => { stateRef.current.keys[e.key.toLowerCase()] = true; };
    const onUp   = (e) => { stateRef.current.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ── Touch handlers ──
  const handlePointerMove = useCallback((e) => {
    if (!stateRef.current.running) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const cx = (e.clientX !== undefined ? e.clientX : e.touches?.[0]?.clientX);
    if (cx == null) return;
    const localX = (cx - rect.left) / rect.width;
    stateRef.current.targetX = Math.max(0.05, Math.min(0.95, localX));
  }, []);

  // ── Game loop ──
  useEffect(() => {
    let raf;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const s = stateRef.current;
      if (!s.running) return;

      const dt = Math.min(0.05, (now - (s.lastT || now)) / 1000);
      s.lastT = now;

      // Read keys → targetX
      const k = s.keys;
      if (k['arrowleft'] || k['a']) s.targetX = Math.max(0.05, s.targetX - 0.6 * dt);
      if (k['arrowright'] || k['d']) s.targetX = Math.min(0.95, s.targetX + 0.6 * dt);
      if (k['arrowup'] || k['w']) s.speed = Math.min(9, s.speed + 1.2 * dt);
      if (k[' '] || k['arrowdown'] || k['s']) s.speed = Math.max(2, s.speed - 2.4 * dt);

      // Smooth steering toward target
      s.playerX += (s.targetX - s.playerX) * Math.min(1, dt * 8);

      // Obstacle generation
      s.obstacleTimer -= dt;
      if (s.obstacleTimer <= 0) {
        const lanes = STAGE_WIDTH;
        const lane = Math.floor(Math.random() * lanes) / (lanes - 1);
        const type = Math.random() < 0.7 ? 'cone' : 'rock';
        s.obstacles.push({ x: 0.05 + lane * 0.9, y: -0.15, type });
        s.obstacleTimer = Math.max(0.32, 1.0 - s.speed * 0.06 + Math.random() * 0.4);
      }
      s.nitroTimer -= dt;
      if (s.nitroTimer <= 0) {
        s.nitros.push({ x: 0.1 + Math.random() * 0.8, y: -0.15 });
        s.nitroTimer = 5 + Math.random() * 6;
      }

      // Move obstacles
      const advance = (s.speed * 0.42) * dt;
      s.obstacles.forEach((o) => (o.y += advance));
      s.nitros.forEach((n) => (n.y += advance));

      // Cull off-screen
      s.obstacles = s.obstacles.filter((o) => o.y < 1.2);
      s.nitros    = s.nitros.filter((n) => n.y < 1.2);

      // Collisions (player at y=0.85, w=PLAYER_WIDTH_PCT, h=PLAYER_HEIGHT_PCT)
      if (s.invuln > 0) s.invuln -= dt;
      const px = s.playerX;
      const py = 0.85;
      const pw = PLAYER_WIDTH_PCT, ph = PLAYER_HEIGHT_PCT;

      s.obstacles = s.obstacles.filter((o) => {
        const ow = 0.07, oh = 0.12;
        const hit =
          o.y + oh > py - ph * 0.5 && o.y < py + ph * 0.5 &&
          Math.abs(o.x - px) < (ow + pw) / 2;
        if (hit && s.invuln <= 0) {
          s.crashes += 1;
          s.invuln = 1.4;
          s.speed = Math.max(2, s.speed * 0.55);
          setCrashes(s.crashes);
          return false;
        }
        return true;
      });

      s.nitros = s.nitros.filter((n) => {
        const nw = 0.06, nh = 0.06;
        const hit =
          n.y + nh > py - ph * 0.5 && n.y < py + ph * 0.5 &&
          Math.abs(n.x - px) < (nw + pw) / 2;
        if (hit) {
          s.speed = Math.min(10, s.speed + 1.6);
          s.score += 250;
          return false;
        }
        return true;
      });

      // Score
      s.score += s.speed * 14 * dt;
      setScore(Math.round(s.score));

      // Time
      s.timeLeft = Math.max(0, s.timeLeft - dt);
      setTime(Math.ceil(s.timeLeft));

      // End conditions
      if (s.timeLeft <= 0 || s.crashes >= 3) {
        s.running = false;
        setRunning(false);
        setDone(true);
        onFinish?.({
          score: Math.round(s.score),
          crashes: s.crashes,
          time_left: Math.round(s.timeLeft),
          finished: s.timeLeft <= 0,
        });
      }
      onTick?.({ score: Math.round(s.score), time: Math.ceil(s.timeLeft), crashes: s.crashes, speed: s.speed });

      // ── DRAW ──
      const w = c.width / (window.devicePixelRatio || 1);
      const h = c.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      // Sky / horizon gradient (cockpit feel)
      const horizon = h * 0.18;
      const grad = ctx.createLinearGradient(0, 0, 0, horizon);
      grad.addColorStop(0, '#0A0A0A');
      grad.addColorStop(1, 'rgba(232,146,74,0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, horizon);

      // Road perspective
      const roadTopW = w * 0.18, roadBotW = w * 0.92;
      ctx.fillStyle = ROAD_COLOR;
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTopW / 2, horizon);
      ctx.lineTo(w / 2 + roadTopW / 2, horizon);
      ctx.lineTo(w / 2 + roadBotW / 2, h);
      ctx.lineTo(w / 2 - roadBotW / 2, h);
      ctx.closePath();
      ctx.fill();

      // Lane stripes
      const stripeOffset = (now * 0.3 * (s.speed / 4)) % 60;
      ctx.fillStyle = ROAD_LINE;
      for (let i = -1; i < 12; i++) {
        const t = (i * 60 + stripeOffset) / (h - horizon);
        const y0 = horizon + t * (h - horizon);
        const y1 = y0 + 22;
        if (y1 < horizon || y0 > h) continue;
        const wx0 = roadTopW + (roadBotW - roadTopW) * (y0 - horizon) / (h - horizon);
        const wx1 = roadTopW + (roadBotW - roadTopW) * (y1 - horizon) / (h - horizon);
        ctx.beginPath();
        ctx.moveTo(w / 2 - 4 * (wx0 / roadBotW), y0);
        ctx.lineTo(w / 2 + 4 * (wx0 / roadBotW), y0);
        ctx.lineTo(w / 2 + 4 * (wx1 / roadBotW), y1);
        ctx.lineTo(w / 2 - 4 * (wx1 / roadBotW), y1);
        ctx.closePath();
        ctx.fill();
      }

      // Edge lines
      ctx.strokeStyle = '#5A5A5A';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTopW / 2, horizon);
      ctx.lineTo(w / 2 - roadBotW / 2, h);
      ctx.moveTo(w / 2 + roadTopW / 2, horizon);
      ctx.lineTo(w / 2 + roadBotW / 2, h);
      ctx.stroke();

      // Helper: project (x: 0..1, y: 0..1) into screen coords with perspective
      const project = (x01, y01) => {
        const yPx = horizon + y01 * (h - horizon);
        const t = y01;
        const widthAtY = roadTopW + (roadBotW - roadTopW) * t;
        const xPx = w / 2 + (x01 - 0.5) * widthAtY;
        return { x: xPx, y: yPx, scale: 0.4 + t };
      };

      // Obstacles
      s.obstacles.forEach((o) => {
        if (o.y < 0) return;
        const p = project(o.x, o.y);
        const sz = 28 * p.scale;
        ctx.fillStyle = o.type === 'cone' ? DIAL_AMBER : '#7A7E83';
        ctx.beginPath();
        if (o.type === 'cone') {
          ctx.moveTo(p.x, p.y - sz / 2);
          ctx.lineTo(p.x + sz / 2, p.y + sz / 2);
          ctx.lineTo(p.x - sz / 2, p.y + sz / 2);
        } else {
          ctx.arc(p.x, p.y, sz / 2, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
      });

      // Nitros
      s.nitros.forEach((n) => {
        if (n.y < 0) return;
        const p = project(n.x, n.y);
        const sz = 18 * p.scale;
        ctx.fillStyle = '#5A7BB8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F5F3EE';
        ctx.font = `${Math.round(sz * 0.7)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', p.x, p.y);
      });

      // Player car
      {
        const pp = project(s.playerX, py);
        const carW = w * pw * pp.scale;
        const carH = h * ph * pp.scale * 0.6;
        if (s.invuln > 0 && Math.floor(now / 80) % 2 === 0) {
          ctx.globalAlpha = 0.4;
        }
        // body
        ctx.fillStyle = DIAL_RED;
        ctx.fillRect(pp.x - carW / 2, pp.y - carH / 2, carW, carH);
        // windshield
        ctx.fillStyle = '#0A0A0A';
        ctx.fillRect(pp.x - carW / 2 + 4, pp.y - carH / 2 + 4, carW - 8, carH * 0.35);
        // headlights
        ctx.fillStyle = '#F5F3EE';
        ctx.fillRect(pp.x - carW / 2 + 4, pp.y + carH / 2 - 6, 8, 4);
        ctx.fillRect(pp.x + carW / 2 - 12, pp.y + carH / 2 - 6, 8, 4);
        ctx.globalAlpha = 1;
      }

      // HUD top — speedometer arc + score + time + crashes already rendered as React overlay
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, []);

  const start = () => {
    const s = stateRef.current;
    s.playerX = 0.5;
    s.targetX = 0.5;
    s.speed = 4;
    s.obstacles = [];
    s.nitros = [];
    s.score = 0;
    s.crashes = 0;
    s.timeLeft = STAGE_LENGTH;
    s.invuln = 1.0;
    s.lastT = 0;
    s.obstacleTimer = 1;
    s.nitroTimer = 8;
    s.running = true;
    setScore(0);
    setCrashes(0);
    setTime(STAGE_LENGTH);
    setDone(false);
    setRunning(true);
  };

  return (
    <div className="relative" data-testid="weezy-rally" style={{ aspectRatio: '16 / 10', background: '#0A0A0A', borderRadius: 4, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: running ? 'none' : 'default' }}
        onPointerMove={handlePointerMove}
        onTouchMove={handlePointerMove}
      />

      {/* HUD */}
      {running && (
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none" data-testid="rally-hud">
          <div className="mono" style={{ background: 'rgba(10,10,10,0.7)', padding: '6px 10px', borderRadius: 3, color: '#F5F3EE' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.6)', fontWeight: 700 }}>
              {lang === 'en' ? 'SCORE' : 'PISTEET'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>{score.toLocaleString('fi-FI').replace(/,/g, ' ')}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mono" style={{ background: 'rgba(10,10,10,0.7)', padding: '6px 10px', borderRadius: 3, color: '#F5F3EE', textAlign: 'center' }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.6)', fontWeight: 700 }}>
                {lang === 'en' ? 'TIME' : 'AIKA'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: time < 10 ? DIAL_RED : '#F5F3EE' }}>
                {String(time).padStart(2, '0')}
              </div>
            </div>
            <div className="mono" style={{ background: 'rgba(10,10,10,0.7)', padding: '6px 10px', borderRadius: 3, color: '#F5F3EE', textAlign: 'center' }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.6)', fontWeight: 700 }}>
                {lang === 'en' ? 'CRASHES' : 'KOLAREITA'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: crashes >= 2 ? DIAL_RED : '#F5F3EE' }}>
                {crashes}/3
              </div>
            </div>
          </div>
        </div>
      )}

      {!running && !done && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(2px)' }}>
          <div className="text-center px-6">
            <div className="mono mb-3" style={{ fontSize: 11, letterSpacing: '0.24em', color: '#E8924A', fontWeight: 700 }}>
              WEEZY RALLY · IMATRA
            </div>
            <div className="display text-3xl sm:text-4xl mb-4" style={{ color: '#F5F3EE' }}>
              {lang === 'en' ? 'Run the stage. 75 seconds. 3 crashes max.' : 'Aja etappi. 75 sekuntia. Max 3 kolaria.'}
            </div>
            <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'rgba(245,243,238,0.6)', fontWeight: 600 }}>
              {lang === 'en' ? '← → / A D · STEER · SPACE · BRAKE · MOBILE: DRAG' : '← → / A D · OHJAUS · VÄLILYÖNTI · JARRU · MOBIILI: VEDÄ'}
            </div>
            <button
              type="button"
              onClick={start}
              className="btn-primary"
              data-testid="rally-start"
              style={{ background: '#E8924A', borderColor: '#E8924A', color: '#0A0A0A', padding: '16px 28px', minHeight: 56, fontSize: 13 }}
            >
              {lang === 'en' ? 'START STAGE →' : 'ALOITA ETAPPI →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeezyRally;
