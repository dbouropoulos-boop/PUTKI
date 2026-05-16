import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Sparkles, ArrowRight, KeyRound, Check, Clock } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const VISITOR_COOKIE = 'mittari_weezy_visitor_uuid';
const COOKIE_DAYS = 90;

// ── Cookie helpers ──
const setCookie = (name, value, days) => {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
    localStorage.setItem(name, value);
  } catch {}
};
const getCookie = (name) => {
  try {
    const ls = localStorage.getItem(name);
    if (ls) return ls;
    const m = document.cookie.split('; ').find((r) => r.startsWith(name + '='));
    return m ? decodeURIComponent(m.split('=')[1]) : null;
  } catch { return null; }
};

// ── Mocked Smartico-style spin-the-wheel placeholder ──
// Stays in Mittari aesthetic; gets swapped for real Smartico script when smartico_template_id is set.
const PLACEHOLDER_PRIZES = [
  { label: '50 € + 25 FS', kind: 'BIG', color: '#E8924A' },
  { label: '20 FS',         kind: 'OK',  color: '#5A7BB8' },
  { label: '100 €',         kind: 'BIG', color: '#C8423C' },
  { label: '10 FS',         kind: 'OK',  color: '#7A7E83' },
  { label: '50 FS',         kind: 'BIG', color: '#E8924A' },
  { label: '25 €',          kind: 'OK',  color: '#5A7BB8' },
];

const PlaceholderGame = ({ onWin }) => {
  const { lang } = useLang();
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const wheelRef = useRef(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const winIdx = Math.floor(Math.random() * PLACEHOLDER_PRIZES.length);
    const sliceAngle = 360 / PLACEHOLDER_PRIZES.length;
    const targetAngle = 1800 + (360 - winIdx * sliceAngle) - sliceAngle / 2;
    setAngle((prev) => prev + targetAngle);
    setTimeout(() => {
      setSpinning(false);
      const prize = PLACEHOLDER_PRIZES[winIdx];
      const visitor_win_uuid = (crypto.randomUUID && crypto.randomUUID()) || `vw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      onWin({ prize: prize.label, visitor_win_uuid });
    }, 4400);
  };

  const sliceAngle = 360 / PLACEHOLDER_PRIZES.length;

  return (
    <div className="relative" data-testid="visitor-placeholder-game">
      <div
        className="relative mx-auto"
        style={{ width: 320, height: 320, maxWidth: '90vw' }}
      >
        {/* Wheel */}
        <div
          ref={wheelRef}
          style={{
            width: '100%', height: '100%', borderRadius: '50%', position: 'relative',
            transform: `rotate(${angle}deg)`,
            transition: spinning ? 'transform 4.2s cubic-bezier(0.18, 0.85, 0.2, 1)' : 'none',
            boxShadow: '0 0 0 2px var(--ink), 0 14px 50px -10px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          {PLACEHOLDER_PRIZES.map((p, i) => {
            const startAngle = i * sliceAngle - 90;
            const endAngle = (i + 1) * sliceAngle - 90;
            const r = 160;
            const x1 = r + r * Math.cos((startAngle * Math.PI) / 180);
            const y1 = r + r * Math.sin((startAngle * Math.PI) / 180);
            const x2 = r + r * Math.cos((endAngle * Math.PI) / 180);
            const y2 = r + r * Math.sin((endAngle * Math.PI) / 180);
            const path = `M${r},${r} L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`;
            const labelAngle = startAngle + sliceAngle / 2;
            const lx = r + (r * 0.65) * Math.cos((labelAngle * Math.PI) / 180);
            const ly = r + (r * 0.65) * Math.sin((labelAngle * Math.PI) / 180);
            return (
              <svg key={i} viewBox={`0 0 ${r * 2} ${r * 2}`} className="absolute inset-0 w-full h-full">
                <path d={path} fill={p.color} stroke="rgba(10,10,10,0.4)" strokeWidth="1" />
                <text
                  x={lx}
                  y={ly}
                  fontSize="13"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  fill="#F5F3EE"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${labelAngle + 90} ${lx} ${ly})`}
                >
                  {p.label}
                </text>
              </svg>
            );
          })}
        </div>
        {/* Center hub */}
        <div
          className="absolute"
          style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 76, height: 76, borderRadius: '50%',
            background: 'var(--bg)', border: '2px solid var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
          }}
        >
          <Gift strokeWidth={1.5} size={28} style={{ color: 'var(--ink)' }} />
        </div>
        {/* Pointer */}
        <div
          className="absolute"
          style={{
            top: -10, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent',
            borderTop: '24px solid #C8423C',
            filter: 'drop-shadow(0 4px 8px rgba(200,66,60,0.5))',
          }}
        />
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        data-testid="visitor-spin-btn"
        className="btn-primary mx-auto mt-8 flex items-center gap-2"
        style={{ background: '#E8924A', borderColor: '#E8924A', color: '#0A0A0A', minWidth: 220, padding: '16px 28px' }}
      >
        {spinning ? (
          <>{lang === 'en' ? 'SPINNING\u2026' : 'PYÖRII\u2026'}</>
        ) : (
          <><Sparkles strokeWidth={1.7} size={14} /> {lang === 'en' ? 'SPIN ONCE' : 'PYÖRÄYTÄ KERRAN'}</>
        )}
      </button>

      <div className="mono mt-4 text-center" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
        {lang === 'en' ? 'PLACEHOLDER · ONE SPIN · NO ACCOUNT NEEDED' : 'PLACEHOLDER · YKSI PYÖRÄYTYS · EI TILIÄ TARVITA'}
      </div>
    </div>
  );
};

const VoitaPalkinto = () => {
  const { lang } = useLang();
  const [templateId, setTemplateId] = useState(null);
  const [loaderUrl, setLoaderUrl] = useState(null);
  const [brandKey, setBrandKey] = useState(null);
  const [winRecord, setWinRecord] = useState(() => {
    const v = getCookie(VISITOR_COOKIE);
    if (!v) return null;
    try {
      const meta = JSON.parse(localStorage.getItem(VISITOR_COOKIE + '_meta') || 'null');
      return meta;
    } catch { return null; }
  });
  const [showWinModal, setShowWinModal] = useState(false);

  // Fetch site settings — switch to real Smartico script when smartico_template_id is set
  useEffect(() => {
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => {
        if (d.smartico_template_id) setTemplateId(d.smartico_template_id);
        if (d.smartico_loader_url) setLoaderUrl(d.smartico_loader_url);
        if (d.smartico_brand_key) setBrandKey(d.smartico_brand_key);
      })
      .catch(() => {});
  }, []);

  // Inject Smartico SDK loader once both template_id and loader_url are set.
  // The Smartico SDK auto-discovers the #smartico-visitor-mode div via data-template-id.
  useEffect(() => {
    if (!templateId || !loaderUrl) return;
    if (document.querySelector(`script[data-mittari-smartico="1"]`)) return;
    const s = document.createElement('script');
    s.src = loaderUrl;
    s.async = true;
    s.dataset.mittariSmartico = '1';
    if (brandKey) s.dataset.smarticoBrandKey = brandKey;
    document.body.appendChild(s);
    return () => {
      try { document.body.removeChild(s); } catch {}
    };
  }, [templateId, loaderUrl, brandKey]);

  const persistWin = (payload) => {
    setCookie(VISITOR_COOKIE, payload.visitor_win_uuid, COOKIE_DAYS);
    try {
      localStorage.setItem(VISITOR_COOKIE + '_meta', JSON.stringify({
        ...payload,
        won_at: new Date().toISOString(),
      }));
    } catch {}
    setWinRecord({ ...payload, won_at: new Date().toISOString() });
    setShowWinModal(true);
  };

  const claimUrl = winRecord
    ? `https://weezybet.fi/register?visitor_win_uuid=${encodeURIComponent(winRecord.visitor_win_uuid)}&utm_source=mittari&utm_medium=visitor_mode&utm_campaign=voita_palkinto`
    : 'https://weezybet.fi/register';

  return (
    <div data-testid="voita-palkinto-page">
      {/* Hero */}
      <section className="container-wide pt-12 sm:pt-16 pb-8 sm:pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3 inline-flex items-center gap-2">
            <Gift strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'PRIZE GAME · VISITOR MODE' : 'PALKINTOPELI · VISITOR MODE'}
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5" data-testid="voita-headline">
            {lang === 'en'
              ? 'Win a prize. Play once. Claim at Weezybet.'
              : 'Voita palkinto. Pelaa kerran. Lunasta Weezybetissä.'}
          </h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>
            {lang === 'en'
              ? 'One spin. You win something. Register at Weezybet and the prize lands on your account in five minutes. No deposit. No card. 18+.'
              : 'Yksi kierros. Voitat palkinnon. Rekisteröidy Weezybetiin ja palkinto on tililläsi viidessä minuutissa. Ei talletusta, ei korttia. 18+.'}
          </p>
        </div>
      </section>

      {/* Game */}
      <section className="container-wide pb-12 sm:pb-16">
        {winRecord ? (
          // Returning-visitor claim prompt (per brief: replace game with claim-prompt)
          <div className="panel p-7 sm:p-10 max-w-2xl mx-auto text-center" data-testid="visitor-claim-prompt">
            <div className="led-square mx-auto mb-5" style={{
              width: 64, height: 64, borderRadius: 4, background: 'rgba(232,146,74,0.12)',
              border: '1px solid #E8924A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8924A',
            }}>
              <KeyRound strokeWidth={1.5} size={28} />
            </div>
            <div className="eyebrow mb-3" style={{ color: '#E8924A' }}>
              {lang === 'en' ? 'YOU\u2019VE ALREADY WON' : 'OLET JO VOITTANUT'}
            </div>
            <h2 className="display text-3xl mb-3">
              {lang === 'en'
                ? <>Your prize: <span style={{ color: '#E8924A' }}>{winRecord.prize}</span></>
                : <>Palkintosi: <span style={{ color: '#E8924A' }}>{winRecord.prize}</span></>}
            </h2>
            <p className="font-serif mb-7 max-w-md mx-auto" style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Register at Weezybet to claim. The visitor UUID below auto-credits the prize to your new account.'
                : 'Rekisteröidy Weezybetiin lunastaaksesi. Alla oleva visitor UUID hyvittää palkinnon uudelle tilillesi automaattisesti.'}
            </p>
            <a
              href={claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mx-auto inline-flex items-center gap-2"
              data-testid="visitor-claim-cta"
              style={{ background: '#E8924A', borderColor: '#E8924A', color: '#0A0A0A', padding: '16px 28px', minHeight: 56 }}
            >
              {lang === 'en' ? 'CLAIM AT WEEZYBET' : 'LUNASTA WEEZYBETISSÄ'} <ArrowRight strokeWidth={1.7} size={15} />
            </a>
            <div className="mono mt-5" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              UUID · <span data-testid="visitor-uuid">{winRecord.visitor_win_uuid}</span>
            </div>
            <div className="mono mt-4 inline-flex items-center gap-2" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              <Clock strokeWidth={1.5} size={11} />
              {lang === 'en' ? 'NEXT SPIN AVAILABLE NEXT WEEK' : 'SEURAAVA PYÖRÄYTYS ENSI VIIKOLLA'}
            </div>
          </div>
        ) : (
          // First-time visitor — show game (real Smartico when template_id is set, else placeholder)
          <div className="panel p-7 sm:p-10 max-w-2xl mx-auto" style={{ background: 'var(--surface)' }}>
            {templateId ? (
              <div data-testid="smartico-embed">
                <div
                  id="smartico-visitor-mode"
                  data-template-id={templateId}
                  style={{ minHeight: 420 }}
                />
                <div className="mono mt-4 text-center" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
                  {lang === 'en' ? 'SMARTICO VISITOR MODE · TEMPLATE ' : 'SMARTICO VISITOR MODE · TEMPLATE '} <span style={{ color: 'var(--ink)' }}>{templateId}</span>
                </div>
              </div>
            ) : (
              <PlaceholderGame onWin={persistWin} />
            )}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide max-w-4xl">
          <div className="eyebrow mb-3">{lang === 'en' ? 'HOW IT WORKS' : 'NÄIN SE TOIMII'}</div>
          <h2 className="display text-3xl mb-8">
            {lang === 'en' ? 'Three steps to your prize' : 'Kolme askelta palkintoosi'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { n: '01', fi: 'Pyöräytä rataa kerran. Jokainen pyöräytys voittaa.', en: 'Spin the wheel once. Every spin wins.' },
              { n: '02', fi: 'Palkintosi tallentuu automaattisesti — saat UUID:n.', en: 'Your prize is saved automatically — you receive a UUID.' },
              { n: '03', fi: 'Rekisteröidy Weezybetiin → palkinto tilillesi 5 minuutissa.', en: 'Register at Weezybet → prize on your account in 5 minutes.' },
            ].map((step) => (
              <div key={step.n} className="panel p-5">
                <div className="mono" style={{ fontSize: 32, fontWeight: 500, color: '#E8924A', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {step.n}
                </div>
                <p className="font-serif mt-3" style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {lang === 'en' ? step.en : step.fi}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-link to Weezy Rally */}
      <section className="container-wide py-10">
        <div className="panel p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap" style={{ borderLeft: '3px solid var(--brand-blue)' }}>
          <div>
            <div className="eyebrow mb-1.5">{lang === 'en' ? 'ALSO ON MITTARI' : 'MITTARILLA MYÖS'}</div>
            <h3 className="font-display font-bold" style={{ fontSize: 18, color: 'var(--ink)' }}>
              {lang === 'en' ? 'Weezy Rally · weekly leaderboard, weekly prizes' : 'Weezy Rally · viikoittainen leaderboard, viikoittaiset palkinnot'}
            </h3>
            <p className="font-serif mt-1" style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              {lang === 'en'
                ? 'A different game — competitive, weekly, defend your time.'
                : 'Eri peli — kilpailullinen, viikoittainen, puolusta aikaasi.'}
            </p>
          </div>
          <Link to="/peli" className="btn-secondary" data-testid="visitor-cross-rally">
            {lang === 'en' ? 'WEEZY RALLY →' : 'WEEZY RALLY →'}
          </Link>
        </div>
      </section>

      {/* Win modal */}
      {showWinModal && winRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowWinModal(false)}
          data-testid="visitor-win-modal"
        >
          <div
            className="panel p-7 sm:p-9 max-w-md w-full text-center"
            style={{ background: 'var(--bg)', borderColor: '#E8924A' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="led-square mx-auto mb-4" style={{
              width: 56, height: 56, borderRadius: 4, background: 'rgba(232,146,74,0.15)',
              border: '1px solid #E8924A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8924A',
            }}>
              <Check strokeWidth={2} size={26} />
            </div>
            <div className="eyebrow mb-3" style={{ color: '#E8924A' }}>
              {lang === 'en' ? 'YOU WON' : 'VOITIT'}
            </div>
            <h3 className="display text-3xl sm:text-4xl mb-3">
              {winRecord.prize}
            </h3>
            <p className="font-serif mb-6" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
              {lang === 'en'
                ? 'Your prize is held. Register at Weezybet to claim — auto-credited via your visitor UUID.'
                : 'Palkintosi on tallessa. Rekisteröidy Weezybetiin — visitor UUID hyvittää sen automaattisesti.'}
            </p>
            <a
              href={claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full"
              data-testid="visitor-modal-claim"
              style={{ background: '#E8924A', borderColor: '#E8924A', color: '#0A0A0A', padding: '14px 24px' }}
            >
              {lang === 'en' ? 'CLAIM AT WEEZYBET →' : 'LUNASTA WEEZYBETISSÄ →'}
            </a>
            <button
              onClick={() => setShowWinModal(false)}
              className="mono mt-4"
              style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}
              data-testid="visitor-modal-close"
            >
              {lang === 'en' ? 'I\u2019LL CLAIM LATER' : 'LUNASTAN MYÖHEMMIN'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoitaPalkinto;
