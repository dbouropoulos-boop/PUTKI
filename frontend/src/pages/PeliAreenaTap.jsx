/**
 * PUTKI HQ — Aikatappo · Napautus (Flappy-style arcade · iter57)
 *
 * One-tap mechanic: click/tap or press Space to flap. A bird (chip token)
 * falls under gravity; pipes (gates) scroll left. Score = pipes passed.
 * Canvas-rendered, mobile-first.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import GameIntroPanel from '../components/peliareena/GameIntroPanel';
import { ArcadePreview, ArcadeUnlocked, mix } from './PeliAreenaSnake';
import { useLang } from '../context/LanguageContext';
import { pickPA } from '../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const W = 360, H = 520;
const GRAVITY = 0.55;
const FLAP = -8.4;
const PIPE_GAP = 150;
const PIPE_W = 56;
const PIPE_SPACING = 230;
const SPEED = 2.4;

const post = async (path, body) => {
  const r = await fetch(`${BACKEND}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const PeliAreenaTap = () => {
  const { lang } = useLang();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(null);
  const [stage, setStage] = useState('intro');
  const [session, setSession] = useState(null);
  const [score, setScore] = useState(0);
  const [preview, setPreview] = useState(null);
  const [full, setFull] = useState(null);

  const reset = () => {
    stateRef.current = {
      bird: { y: H / 2, vy: 0, x: 80, r: 12 },
      pipes: [{ x: W + 40, gapY: 220 }, { x: W + 40 + PIPE_SPACING, gapY: 280 }],
      score: 0, alive: true, started: false,
    };
    setScore(0);
  };

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const st = stateRef.current;
    if (!st) return;
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--surface').trim() || '#14110d';
    const bg2 = cs.getPropertyValue('--surface-2').trim() || '#1B1814';
    const ink = cs.getPropertyValue('--ink').trim() || '#ECE6D8';
    const border = cs.getPropertyValue('--border').trim() || '#221E1B';

    // Sky vignette
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, bg2);
    sky.addColorStop(1, bg);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Faint horizontal scanlines for depth
    ctx.strokeStyle = border;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.35;
    for (let j = 0; j < H; j += 20) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Pipes — amber with cap detail + 3D shadow
    st.pipes.forEach(p => {
      const topH = p.gapY - PIPE_GAP / 2;
      const bottomY = p.gapY + PIPE_GAP / 2;
      const bottomH = H - bottomY;
      const drawPipe = (px, py, pw, ph) => {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px + 3, py + (py === 0 ? 0 : 3), pw, ph);
        // Body gradient
        const lin = ctx.createLinearGradient(px, py, px + pw, py);
        lin.addColorStop(0, '#A88A2D');
        lin.addColorStop(0.5, '#D4B445');
        lin.addColorStop(1, '#A88A2D');
        ctx.fillStyle = lin;
        ctx.fillRect(px, py, pw, ph);
        // Inner highlight stripe
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(px + 6, py, 4, ph);
      };
      const drawCap = (px, py, pw, ph) => {
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(px - 4 + 3, py + 3, pw + 8, ph);
        const lin = ctx.createLinearGradient(px, py, px + pw + 8, py);
        lin.addColorStop(0, '#8E711F');
        lin.addColorStop(0.5, '#E4C24F');
        lin.addColorStop(1, '#8E711F');
        ctx.fillStyle = lin;
        ctx.fillRect(px - 4, py, pw + 8, ph);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(px - 4, py + 2, pw + 8, 3);
      };
      drawPipe(p.x, 0, PIPE_W, topH);
      drawCap(p.x, topH - 18, PIPE_W, 18);
      drawPipe(p.x, bottomY, PIPE_W, bottomH);
      drawCap(p.x, bottomY, PIPE_W, 18);
    });

    // Bird (chip token) — rotates with velocity
    const b = st.bird;
    const rot = Math.max(-0.5, Math.min(1.1, b.vy / 16));
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(rot);
    // Outer ring (coin edge)
    const ring = ctx.createRadialGradient(0, 0, b.r - 4, 0, 0, b.r + 2);
    ring.addColorStop(0, ink);
    ring.addColorStop(1, mix(ink, '#000000', 0.45));
    ctx.fillStyle = ring;
    ctx.beginPath(); ctx.arc(0, 0, b.r + 1, 0, Math.PI * 2); ctx.fill();
    // Inner coin face
    const face = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.r);
    face.addColorStop(0, '#FFFFFF');
    face.addColorStop(0.5, ink);
    face.addColorStop(1, mix(ink, '#000000', 0.3));
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.arc(0, 0, b.r - 2, 0, Math.PI * 2); ctx.fill();
    // Center € symbol
    ctx.fillStyle = mix(bg, '#000000', 0.25);
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('€', 0, 1);
    ctx.restore();

    // Score HUD — top center
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(String(st.score), W / 2 + 1, 50 + 1);
    ctx.fillStyle = ink;
    ctx.fillText(String(st.score), W / 2, 50);

    // Pre-start tap-to-fly overlay
    if (!st.started) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H / 2 - 30, W, 60);
      ctx.font = 'bold 14px ui-monospace, monospace';
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.fillText(lang === 'en' ? 'TAP TO START' : 'NAPAUTA ALOITTAAKSESI', W / 2, H / 2 + 5);
    }
  }, [lang]);

  const finishGame = useCallback(async (finalScore) => {
    if (!session) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try {
      const r = await post('/api/mini-games/arcade/tap/submit', {
        play_id: session.play_id, anon_id: session.anon_id, score: finalScore,
      });
      setPreview(r);
      setStage('preview');
    } catch (e) {
      alert(`Virhe: ${e.message}`);
    }
  }, [session]);

  const step = useCallback(() => {
    const st = stateRef.current;
    if (!st || !st.alive) return;
    if (st.started) {
      st.bird.vy += GRAVITY;
      st.bird.y += st.bird.vy;
      st.pipes.forEach(p => { p.x -= SPEED; });

      // Spawn new pipe when last one crosses threshold
      const last = st.pipes[st.pipes.length - 1];
      if (last.x < W - PIPE_SPACING) {
        st.pipes.push({ x: last.x + PIPE_SPACING, gapY: 100 + Math.random() * (H - 200) });
      }
      // Cull
      while (st.pipes.length && st.pipes[0].x < -PIPE_W) {
        st.pipes.shift();
        st.score += 1;
        setScore(st.score);
      }
      // Collision
      const b = st.bird;
      if (b.y - b.r < 0 || b.y + b.r > H) {
        st.alive = false; finishGame(st.score); return;
      }
      for (const p of st.pipes) {
        if (b.x + b.r > p.x && b.x - b.r < p.x + PIPE_W) {
          if (b.y - b.r < p.gapY - PIPE_GAP / 2 || b.y + b.r > p.gapY + PIPE_GAP / 2) {
            st.alive = false; finishGame(st.score); return;
          }
        }
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(step);
  }, [draw, finishGame]);

  const flap = useCallback(() => {
    const st = stateRef.current;
    if (!st || !st.alive) return;
    st.started = true;
    st.bird.vy = FLAP;
  }, []);

  useEffect(() => {
    if (stage !== 'playing') return;
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); flap(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, flap]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const start = async () => {
    const s = await post('/api/mini-games/arcade/tap/start');
    setSession(s);
    reset();
    setStage('playing');
    setTimeout(() => { draw(); rafRef.current = requestAnimationFrame(step); }, 50);
  };

  return (
    <div data-testid="peliareena-tap" style={{ padding: '32px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
      <Link to="/peliareena" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> {pickPA(lang, 'hub.back')}
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="arcade_tap"
          eyebrow={pickPA(lang, 'tp.eyebrow')}
          headline={pickPA(lang, 'tp.headline')}
          tagline={pickPA(lang, 'tp.tagline')}
          howToPlay={[pickPA(lang, 'tp.howTo.1'), pickPA(lang, 'tp.howTo.2'), pickPA(lang, 'tp.howTo.3')]}
          scoring={[pickPA(lang, 'tp.score.1'), pickPA(lang, 'tp.score.2'), pickPA(lang, 'tp.score.3')]}
          ctaLabel={pickPA(lang, 'tp.cta.start')}
          startTestId="tap-start-btn"
          onStart={start}
          controlsHint={pickPA(lang, 'tp.controls')}
        />
      )}

      {stage === 'playing' && (
        <div data-testid="tap-board">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}>
              {pickPA(lang, 'sn.points')}
            </span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)' }}>
              {score}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={flap}
            onTouchStart={(e) => { e.preventDefault(); flap(); }}
            style={{ display: 'block', maxWidth: '100%', width: W, height: 'auto',
                     border: '1px solid var(--border)', borderRadius: 4,
                     touchAction: 'none', cursor: 'pointer' }}
          />
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
            {pickPA(lang, 'tp.hint')}
          </p>
        </div>
      )}

      {stage === 'preview' && preview && (
        <ArcadePreview preview={preview} session={session} sport="tap"
                       fullResult={full} gameSlug="arcade_tap"
                       onUnlocked={(r) => { setFull(r); }} />
      )}
    </div>
  );
};

// btnPrimary removed (unused after i18n cleanup)

export default PeliAreenaTap;
