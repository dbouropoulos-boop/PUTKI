/**
 * PUTKI HQ — Aikatappo · Napautus (Flappy-style arcade · iter57)
 *
 * One-tap mechanic: click/tap or press Space to flap. A bird (chip token)
 * falls under gravity; pipes (gates) scroll left. Score = pipes passed.
 * Canvas-rendered, mobile-first.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import GameIntroPanel from '../components/peliareena/GameIntroPanel';
import { ArcadePreview, ArcadeUnlocked } from './PeliAreenaSnake';

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
    const ink = cs.getPropertyValue('--ink').trim() || '#ECE6D8';
    const border = cs.getPropertyValue('--border').trim() || '#221E1B';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Faint cross-hatch
    ctx.strokeStyle = border;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }

    // Pipes (amber gates)
    ctx.fillStyle = '#D4B445';
    st.pipes.forEach(p => {
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY - PIPE_GAP / 2);
      ctx.fillRect(p.x, p.gapY + PIPE_GAP / 2, PIPE_W, H - (p.gapY + PIPE_GAP / 2));
    });

    // Bird (chip token)
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(st.bird.x, st.bird.y, st.bird.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(st.bird.x, st.bird.y, st.bird.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }, []);

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
        <ArrowLeft size={14} strokeWidth={1.6} /> Takaisin Peliareenaan
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="arcade_tap"
          eyebrow="AIKATAPPO · NAPAUTUS"
          headline={<>Yksi napautus.<br />Älä osu mihinkään.</>}
          tagline="Yksinkertaisin mahdollinen ohjaus — yksi näppäin, koko peli. Pidä token-kolikko ilmassa ja kuljeta se amber-värisistä porteista läpi. Mitä useamman portin ohitat, sitä korkeammat pisteet."
          howToPlay={[
            'Napauta peliä tai paina välilyöntiä lentääksesi.',
            'Pysy ilmassa ja kuljeta token porttien välistä.',
            'Yhteen porttiin osuminen tai putoaminen päättää pelin.',
          ]}
          scoring={[
            '1 piste per ohitettu portti.',
            'Liian nopeat pelisessiot eivät pääse leaderboardille (anti-cheat).',
            'Tasapelissä nopeampi peliaika sijoittuu paremmin.',
          ]}
          ctaLabel="Aloita peli"
          startTestId="tap-start-btn"
          onStart={start}
          controlsHint="OHJAUS · NAPAUTA RUUTUA · TAI PAINA VÄLILYÖNTIÄ"
        />
      )}

      {stage === 'playing' && (
        <div data-testid="tap-board">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}>
              PISTEET
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
            Napauta peliä tai paina välilyöntiä lentääksesi
          </p>
        </div>
      )}

      {stage === 'preview' && preview && (
        <ArcadePreview preview={preview} session={session} sport="tap"
                       onUnlocked={(r) => { setFull(r); setStage('unlocked'); }} />
      )}
      {stage === 'unlocked' && full && (
        <ArcadeUnlocked result={full} preview={preview} gameSlug="arcade_tap" />
      )}
    </div>
  );
};

const btnPrimary = {
  padding: '14px 28px', background: 'var(--ink)', color: 'var(--bg)',
  border: 'none', borderRadius: 4, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24,
};

export default PeliAreenaTap;
