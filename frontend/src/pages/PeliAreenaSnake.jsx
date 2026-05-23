/**
 * PUTKI HQ — Aikatappo · Mato (Snake arcade · iter57)
 *
 * 20×20 grid, canvas-rendered. Player controls direction with arrow keys
 * / WASD on desktop and swipe gestures on mobile. Score = food eaten;
 * snake grows by 1 cell per food. Game-over on wall hit OR self-collision.
 * Score submission protected server-side by min-seconds-per-point timing.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Share2, Trophy } from 'lucide-react';
import { ConsentEmailGate } from './PeliAreenaSharedGate';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const GRID = 20;       // cells per side
const CELL = 22;       // px per cell
const TICK_MS = 110;   // game speed

const post = async (path, body) => {
  const r = await fetch(`${BACKEND}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

const randCell = (occupied) => {
  while (true) {
    const c = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!occupied.some(s => s.x === c.x && s.y === c.y)) return c;
  }
};

const PeliAreenaSnake = () => {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    food: { x: 5, y: 5 }, score: 0, alive: true,
  });
  const [stage, setStage] = useState('intro'); // intro · playing · preview · unlocked
  const [session, setSession] = useState(null);
  const [score, setScore] = useState(0);
  const [preview, setPreview] = useState(null);
  const [full, setFull] = useState(null);
  const tickRef = useRef(null);
  const touchRef = useRef(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const st = stateRef.current;
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--surface').trim() || '#14110d';
    const grid = cs.getPropertyValue('--border').trim() || '#221E1B';
    const ink = cs.getPropertyValue('--ink').trim() || '#ECE6D8';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cv.width, cv.height);

    // Light grid texture
    ctx.strokeStyle = grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID * CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(GRID * CELL, i * CELL); ctx.stroke();
    }

    // Food (amber)
    ctx.fillStyle = '#D4B445';
    ctx.beginPath();
    ctx.arc(st.food.x * CELL + CELL / 2, st.food.y * CELL + CELL / 2, CELL * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    st.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? ink : ink;
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.3, 1 - i * 0.04);
      ctx.fillRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4);
    });
    ctx.globalAlpha = 1;
  }, []);

  const tick = useCallback(() => {
    const st = stateRef.current;
    if (!st.alive) return;
    st.dir = st.nextDir;
    const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID
        || st.snake.some(s => s.x === head.x && s.y === head.y)) {
      st.alive = false;
      finishGame(st.score);
      return;
    }
    st.snake.unshift(head);
    if (head.x === st.food.x && head.y === st.food.y) {
      st.score += 1;
      setScore(st.score);
      st.food = randCell(st.snake);
    } else {
      st.snake.pop();
    }
    draw();
  }, [draw]);

  const finishGame = async (finalScore) => {
    if (!session) return;
    if (tickRef.current) clearInterval(tickRef.current);
    try {
      const r = await post(`/api/mini-games/arcade/snake/submit`, {
        play_id: session.play_id, anon_id: session.anon_id, score: finalScore,
      });
      setPreview(r);
      setStage('preview');
    } catch (e) {
      alert(`Virhe: ${e.message}`);
    }
  };

  const setDir = (dx, dy) => {
    const cur = stateRef.current.dir;
    // No 180° reversal
    if (cur.x === -dx && cur.y === -dy) return;
    stateRef.current.nextDir = { x: dx, y: dy };
  };

  useEffect(() => {
    if (stage !== 'playing') return;
    const onKey = (e) => {
      const map = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
      };
      const v = map[e.key];
      if (v) { e.preventDefault(); setDir(v[0], v[1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  // Mobile swipe support
  useEffect(() => {
    if (stage !== 'playing') return;
    const cv = canvasRef.current;
    if (!cv) return;
    const onStart = (e) => { touchRef.current = e.touches[0]; };
    const onEnd = (e) => {
      const start = touchRef.current;
      if (!start) return;
      const end = e.changedTouches[0];
      const dx = end.clientX - start.clientX;
      const dy = end.clientY - start.clientY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 20) setDir(dx > 0 ? 1 : -1, 0);
      } else if (Math.abs(dy) > 20) {
        setDir(0, dy > 0 ? 1 : -1);
      }
    };
    cv.addEventListener('touchstart', onStart, { passive: true });
    cv.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      cv.removeEventListener('touchstart', onStart);
      cv.removeEventListener('touchend', onEnd);
    };
  }, [stage]);

  const start = async () => {
    const s = await post('/api/mini-games/arcade/snake/start');
    setSession(s);
    stateRef.current = {
      snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
      food: randCell([{ x: 10, y: 10 }]), score: 0, alive: true,
    };
    setScore(0);
    setStage('playing');
    setTimeout(() => {
      draw();
      tickRef.current = setInterval(tick, TICK_MS);
    }, 50);
  };

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  return (
    <div data-testid="peliareena-snake" style={{ padding: '32px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
      <Link to="/peliareena" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> Takaisin Peliareenaan
      </Link>

      {stage === 'intro' && (
        <div data-testid="snake-intro">
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
            AIKATAPPO · MATO
          </div>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontWeight: 700,
            fontSize: 'clamp(32px, 5vw, 48px)', lineHeight: 1.1,
            letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 16px',
          }}>
            Yksi mato.<br />Niin pitkä kuin ehdit.
          </h1>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6, color: 'var(--muted)', maxWidth: 600 }}>
            Käytä nuolinäppäimiä tai WASDia desktopilla. Mobiilissa pyyhkäise.
            Älä osu seinään tai itseesi. Viikon korkein pisteytys palkitaan tunnustuksella.
          </p>
          <button onClick={start} data-testid="snake-start-btn" style={btnPrimary}>
            Aloita peli <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {stage === 'playing' && (
        <div data-testid="snake-board">
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
            width={GRID * CELL}
            height={GRID * CELL}
            style={{ display: 'block', maxWidth: '100%', width: GRID * CELL, height: 'auto',
                     border: '1px solid var(--border)', borderRadius: 4, touchAction: 'none' }}
          />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, maxWidth: 240 }}>
            <span />
            <button onClick={() => setDir(0, -1)} data-testid="snake-up" style={btnArrow}>↑</button>
            <span />
            <button onClick={() => setDir(-1, 0)} data-testid="snake-left" style={btnArrow}>←</button>
            <button onClick={() => setDir(0, 1)} data-testid="snake-down" style={btnArrow}>↓</button>
            <button onClick={() => setDir(1, 0)} data-testid="snake-right" style={btnArrow}>→</button>
          </div>
        </div>
      )}

      {stage === 'preview' && preview && (
        <ArcadePreview preview={preview} session={session} sport="snake"
                       onUnlocked={(r) => { setFull(r); setStage('unlocked'); }} />
      )}
      {stage === 'unlocked' && full && (
        <ArcadeUnlocked result={full} preview={preview} />
      )}
    </div>
  );
};

// ─── Shared preview + unlocked (used by snake + tap) ───

export const ArcadePreview = ({ preview, session, sport, onUnlocked }) => (
  <div data-testid={`${sport}-preview`}>
    <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
      PELI PÄÄTTYI · TULOKSESI
    </div>
    <h1 style={{
      fontFamily: 'Georgia, serif', fontWeight: 700,
      fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
      letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px',
    }}>
      {preview.score}<span style={{ color: 'var(--muted)', fontSize: '0.5em' }}> pistettä</span>
    </h1>
    {!preview.valid_for_leaderboard && (
      <p data-testid={`${sport}-invalid-warn`} style={{
        background: 'rgba(200,66,60,0.10)', border: '1px solid #C8423C',
        padding: 12, borderRadius: 4, fontFamily: 'Georgia, serif', fontSize: 13,
        color: '#C8423C', margin: '0 0 24px',
      }}>
        Pelisessio oli liian lyhyt — tämä pisteytys ei pääse leaderboardille.
        Voit silti tallentaa sähköpostisi turnausuutiskirjeeseen.
      </p>
    )}
    <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 32px' }}>
      Esikatselu: <strong style={{ color: 'var(--ink)' }}>{preview.persona_preview.title}</strong>.
      Aikaa: {preview.elapsed_seconds}s.
    </p>
    <ConsentEmailGate
      gameSlug={sport}
      session={session}
      unlockPath={`/api/mini-games/arcade/${sport}/unlock`}
      onUnlocked={onUnlocked}
      headline="Liity turnaukseen ja saa viikon tulokset sähköpostiin"
    />
  </div>
);

export const ArcadeUnlocked = ({ result, preview }) => {
  const share = () => {
    if (navigator.share) navigator.share({ text: result.share_text, url: window.location.href });
    else { navigator.clipboard.writeText(`${result.share_text} ${window.location.href}`); alert('Jakoteksti kopioitu.'); }
  };
  return (
    <div data-testid="arcade-unlocked">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 12 }}>
        TURNAUSPAIKKA VARATTU
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px',
      }}>{result.persona.title}</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 24px' }}>
        {result.persona.tagline}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatBox label="PISTEET" value={result.score} />
        <StatBox label={`SIJA · ${result.tournament_week_iso}`} value={`#${result.rank}`} />
      </div>

      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
        VIIKON TOP 10
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        {result.leaderboard.map(row => (
          <li key={row.rank} style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
            background: row.rank === result.rank ? 'var(--surface-2)' : 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'Georgia, serif', fontSize: 15,
          }}>
            <span style={{ color: 'var(--ink)' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginRight: 10 }}>#{row.rank}</span>
              {row.display_name}
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>{row.score} pistettä</span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <button onClick={share} style={btnPrimary}>
          <Share2 size={14} strokeWidth={1.8} /> Jaa tulos
        </button>
        <Link to="/peliareena" style={btnGhost}>Peliareenaan</Link>
      </div>
    </div>
  );
};

const StatBox = ({ label, value }) => (
  <div style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4 }}>
    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--ink)' }}>{value}</div>
  </div>
);

const btnPrimary = {
  padding: '14px 28px', background: 'var(--ink)', color: 'var(--bg)',
  border: 'none', borderRadius: 4, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24,
};
const btnGhost = {
  padding: '12px 20px', background: 'transparent', color: 'var(--ink)',
  border: '1px solid var(--ink)', borderRadius: 4,
  fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 8,
};
const btnArrow = {
  padding: '12px 0', background: 'var(--surface)', color: 'var(--ink)',
  border: '1px solid var(--border)', borderRadius: 4,
  fontSize: 22, cursor: 'pointer', fontFamily: 'inherit',
};

export default PeliAreenaSnake;
