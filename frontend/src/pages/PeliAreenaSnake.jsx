/**
 * PUTKI HQ - Aikatappo · Mato (Snake arcade · iter57)
 *
 * 20×20 grid, canvas-rendered. Player controls direction with arrow keys
 * / WASD on desktop and swipe gestures on mobile. Score = food eaten;
 * snake grows by 1 cell per food. Game-over on wall hit OR self-collision.
 * Score submission protected server-side by min-seconds-per-point timing.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Share2 } from 'lucide-react';
import GameIntroPanel from '../components/peliareena/GameIntroPanel';
import { ConsentEmailGate } from './PeliAreenaSharedGate';
import IdentityCardFlow from '../components/peliareena/IdentityCardFlow';
import { useLang } from '../context/LanguageContext';
import { pickPA, interpolate } from '../i18n/peliareena';

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

// Canvas helpers
const roundRect = (ctx, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};
export const mix = (hex1, hex2, t) => {
  const p = (h) => {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = p(hex1);
  const [r2, g2, b2] = p(hex2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
};

const PeliAreenaSnake = () => {
  const { lang } = useLang();
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
  const animRef = useRef(null);
  const touchRef = useRef(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const st = stateRef.current;
    const cs = getComputedStyle(document.documentElement);
    const bg = cs.getPropertyValue('--surface').trim() || '#14110d';
    const bg2 = cs.getPropertyValue('--surface-2').trim() || '#1B1814';
    const grid = cs.getPropertyValue('--border').trim() || '#221E1B';
    const ink = cs.getPropertyValue('--ink').trim() || '#ECE6D8';

    // Subtle vignette background
    const g = ctx.createRadialGradient(
      (GRID * CELL) / 2, (GRID * CELL) / 2, 40,
      (GRID * CELL) / 2, (GRID * CELL) / 2, GRID * CELL * 0.75,
    );
    g.addColorStop(0, bg2);
    g.addColorStop(1, bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);

    // Checkerboard grid (chess board, very subtle)
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if ((x + y) % 2 === 0) continue;
        ctx.fillStyle = grid;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;

    // Food - pulsing amber glow
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 180);
    const fx = st.food.x * CELL + CELL / 2;
    const fy = st.food.y * CELL + CELL / 2;
    const halo = ctx.createRadialGradient(fx, fy, 1, fx, fy, CELL * 0.9);
    halo.addColorStop(0, 'rgba(212,180,69,0.65)');
    halo.addColorStop(0.6, 'rgba(212,180,69,0.15)');
    halo.addColorStop(1, 'rgba(212,180,69,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(fx - CELL, fy - CELL, CELL * 2, CELL * 2);
    ctx.fillStyle = '#D4B445';
    ctx.beginPath();
    ctx.arc(fx, fy, CELL * 0.36 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(fx - CELL * 0.10, fy - CELL * 0.10, CELL * 0.10, 0, Math.PI * 2);
    ctx.fill();

    // Snake - rounded segments + gradient + glow on head
    st.snake.forEach((seg, i) => {
      const isHead = i === 0;
      const px = seg.x * CELL;
      const py = seg.y * CELL;
      const inset = 3;
      const w = CELL - inset * 2;
      const r = isHead ? 8 : 6;
      // Body shadow
      if (!isHead) {
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.18 - i * 0.005)})`;
        roundRect(ctx, px + inset, py + inset + 1, w, w, r);
        ctx.fill();
      }
      // Segment fill
      const lin = ctx.createLinearGradient(px, py, px, py + CELL);
      const fade = Math.max(0.55, 1 - i * 0.035);
      lin.addColorStop(0, mix(ink, '#000000', 1 - fade * 0.85));
      lin.addColorStop(1, mix(ink, '#000000', 1 - fade * 0.55));
      ctx.fillStyle = lin;
      roundRect(ctx, px + inset, py + inset, w, w, r);
      ctx.fill();
      // Head highlight + eyes
      if (isHead) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        roundRect(ctx, px + inset + 2, py + inset + 2, w - 4, w / 2 - 1, r - 2);
        ctx.fill();
        // Eyes oriented by direction
        const dirX = st.dir.x;
        const dirY = st.dir.y;
        const eyeR = 2.4;
        const cx = px + CELL / 2;
        const cy = py + CELL / 2;
        // Eye positions perpendicular to direction
        const offX = dirY === 0 ? 0 : 4 * (dirY > 0 ? 1 : -1) - dirY * 3;
        const offY = dirX === 0 ? 0 : 4 * (dirX > 0 ? 1 : -1) - dirX * 3;
        const e1 = { x: cx + dirX * 4 - (dirY ? 4 : 0), y: cy + dirY * 4 - (dirX ? 4 : 0) };
        const e2 = { x: cx + dirX * 4 + (dirY ? 4 : 0), y: cy + dirY * 4 + (dirX ? 4 : 0) };
        ctx.fillStyle = '#0A0A0A';
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(e1.x + dirX, e1.y + dirY, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + dirX, e2.y + dirY, 0.9, 0, Math.PI * 2); ctx.fill();
        // Suppress lint for unused offX/offY (debug positioning helpers)
        void offX; void offY;
      }
    });

    // Edge frame
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, GRID * CELL - 1, GRID * CELL - 1);
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
    if (animRef.current) clearInterval(animRef.current);
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
      // Continuous redraw at ~30fps so the food halo pulses smoothly
      const anim = setInterval(() => { if (stateRef.current?.alive) draw(); }, 33);
      animRef.current = anim;
    }, 50);
  };

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (animRef.current) clearInterval(animRef.current);
  }, []);

  return (
    <div data-testid="peliareena-snake" style={{ padding: '32px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
      <Link to="/peliareena" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--muted)', textDecoration: 'none', fontSize: 13,
        fontFamily: 'Georgia, serif', marginBottom: 24,
      }}>
        <ArrowLeft size={14} strokeWidth={1.6} /> {pickPA(lang, 'hub.back')}
      </Link>

      {stage === 'intro' && (
        <GameIntroPanel
          gameSlug="arcade_snake"
          eyebrow={pickPA(lang, 'sn.eyebrow')}
          headline={pickPA(lang, 'sn.headline')}
          tagline={pickPA(lang, 'sn.tagline')}
          howToPlay={[pickPA(lang, 'sn.howTo.1'), pickPA(lang, 'sn.howTo.2'), pickPA(lang, 'sn.howTo.3')]}
          scoring={[pickPA(lang, 'sn.score.1'), pickPA(lang, 'sn.score.2'), pickPA(lang, 'sn.score.3')]}
          ctaLabel={pickPA(lang, 'sn.cta.start')}
          startTestId="snake-start-btn"
          onStart={start}
          controlsHint={pickPA(lang, 'sn.controls')}
        />
      )}

      {stage === 'playing' && (
        <div data-testid="snake-board">
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
                       fullResult={full} gameSlug="arcade_snake"
                       onUnlocked={(r) => { setFull(r); }} />
      )}
    </div>
  );
};

// ─── Shared preview + unlocked (used by snake + tap) ───

export const ArcadePreview = ({ preview, session, sport, onUnlocked, fullResult, gameSlug }) => {
  const { lang } = useLang();
  return (
    <div data-testid={`${sport}-preview`}>
      {!preview.valid_for_leaderboard && (
        <p data-testid={`${sport}-invalid-warn`} style={{
          background: 'rgba(200,66,60,0.10)', border: '1px solid #C8423C',
          padding: 12, borderRadius: 4, fontFamily: 'Georgia, serif', fontSize: 13,
          color: '#C8423C', margin: '0 0 18px',
        }}>
          {pickPA(lang, 'ar.preview.invalid')}
        </p>
      )}
      <IdentityCardFlow
        preview={preview}
        session={session}
        gameSlug={sport}
        unlockPath={`/api/mini-games/arcade/${sport}/unlock`}
        onUnlocked={onUnlocked}
      />
      {fullResult && (
        <div style={{ marginTop: 36 }}>
          <ArcadeUnlocked result={fullResult} preview={preview} gameSlug={gameSlug || `arcade_${sport}`} />
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <Link to="/peliareena" data-testid={`${sport}-preview-back`} style={btnGhost}>
          {pickPA(lang, 'quiz.back')}
        </Link>
      </div>
    </div>
  );
};

export const ArcadeUnlocked = ({ result, gameSlug }) => {
  const { lang } = useLang();
  const title = (lang === 'en' && result.persona.title_en) || result.persona.title;
  const tagline = (lang === 'en' && result.persona.tagline_en) || result.persona.tagline;
  const shareText = (lang === 'en' && result.share_text_en) || result.share_text;
  const share = () => {
    if (gameSlug) {
      fetch(`${BACKEND}/api/mini-games/share/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_slug: gameSlug, play_id: result.play_id }),
      }).catch(() => {});
    }
    if (navigator.share) navigator.share({ text: shareText, url: window.location.href });
    else { navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
           alert(lang === 'en' ? 'Share text copied.' : 'Jakoteksti kopioitu.'); }
  };
  return (
    <div data-testid="arcade-unlocked">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3F8A4D', fontWeight: 700, marginBottom: 12 }}>
        {pickPA(lang, 'ar.unlocked.eyebrow')}
      </div>
      <h1 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05,
        letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px',
      }}>{title}</h1>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.5, color: 'var(--muted)', margin: '0 0 24px' }}>
        {tagline}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatBox label={pickPA(lang, 'ar.unlocked.points')} value={result.score} />
        <StatBox label={interpolate(pickPA(lang, 'ar.unlocked.rank'), { week: result.tournament_week_iso })} value={`#${result.rank}`} />
      </div>

      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, marginBottom: 12 }}>
        {pickPA(lang, 'ar.unlocked.boardTitle')}
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
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>{row.score}{pickPA(lang, 'ar.points.short')}</span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        <button onClick={share} style={btnPrimary}>
          <Share2 size={14} strokeWidth={1.8} /> {pickPA(lang, 'quiz.share')}
        </button>
        <Link to="/peliareena" data-testid={`${gameSlug}-unlocked-back`} style={btnGhost}>
          {pickPA(lang, 'quiz.back')}
        </Link>
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
