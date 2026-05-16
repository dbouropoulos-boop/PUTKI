import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Gamepad2, Lightbulb, Send } from 'lucide-react';
import WeezyRally from '../components/WeezyRally';
import ShareButton from '../components/ShareButton';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const COOKIE_KEY = 'mittari_cookie_id';
const NAME_KEY = 'mittari_player_name';

const ensureCookieId = () => {
  try {
    let v = localStorage.getItem(COOKIE_KEY);
    if (!v) {
      v = (crypto.randomUUID && crypto.randomUUID()) || (`m-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(COOKIE_KEY, v);
    }
    return v;
  } catch {
    return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const PRIZE_TIERS = [
  { tier: '1', prize: '500 €', kind: 'kasino' },
  { tier: '2', prize: '250 €', kind: 'kasino' },
  { tier: '3', prize: '100 €', kind: 'kasino' },
  { tier: '4–5', prize: '50 €', kind: 'free spins' },
  { tier: '6–7', prize: '25 €', kind: 'free spins' },
];

const TIPS_FI = [
  'Pidä keskellä rauhassa — sivuun ehtii viime hetkellä.',
  'Sininen + tuo lisänopeutta. Kerää mahdollisimman paljon.',
  'Ensimmäiset 30 s ovat helppoja. Säästä keskittyminen viimeisille 30 s:lle.',
];
const TIPS_EN = [
  'Hold the centre — you can sidestep at the last moment.',
  'Blue + boosters give you speed. Grab as many as you can.',
  'The first 30 s are easy. Save your focus for the last 30.',
];

const MiniGame = () => {
  const { lang } = useLang();
  const cookieId = useMemo(() => ensureCookieId(), []);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [me, setMe] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fmt = (n) => n.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ');

  const refresh = async () => {
    try {
      const [lbRes, meRes] = await Promise.all([
        fetch(`${BACKEND}/api/game-scores/leaderboard?stage=imatra&limit=10`).then((r) => r.json()),
        fetch(`${BACKEND}/api/game-scores/me?cookie_id=${encodeURIComponent(cookieId)}&stage=imatra`).then((r) => r.json()),
      ]);
      setLeaderboard(lbRes.leaderboard || []);
      setMe(meRes);
    } catch {}
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, []);

  const onFinish = async (result) => {
    setSubmitting(true);
    setLastResult(result);
    try {
      try { localStorage.setItem(NAME_KEY, name || ''); } catch {}
      const r = await fetch(`${BACKEND}/api/game-scores`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie_id: cookieId, name: name || null, score: result.score,
          crashes: result.crashes, time_left: result.time_left, stage: 'imatra',
        }),
      });
      const submitted = await r.json();
      setLastResult({ ...result, submitted });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const tips = lang === 'en' ? TIPS_EN : TIPS_FI;

  // Tier color for leaderboard rank
  const rankColor = (rank) => {
    if (rank === 1) return '#8B1E1A';
    if (rank <= 3) return '#C8423C';
    if (rank <= 7) return '#E8924A';
    return '#7A7E83';
  };

  return (
    <div data-testid="minigame-page">
      <section className="container-wide pt-12 sm:pt-16 pb-8 sm:pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3 inline-flex items-center gap-2">
            <Gamepad2 strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'WEEKLY ROUND · WK' : 'VIIKON KIERROS · VK'} 21
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5">
            {lang === 'en' ? 'Weezy Rally — Imatra Stage' : 'Weezy Rally — Imatran etappi'}
          </h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>
            {lang === 'en'
              ? <>Drive through the Imatra rally road. Avoid obstacles, grab boosters, beat other Finns. This week{'\u2019'}s prize pool <span className="mono" style={{ color: 'var(--ink)' }}>925 €</span>. Sponsored by Weezybet. Free to play.</>
              : <>Käy lävitse Imatran karavaanitie. Vältä esteet, kerää nitroja, päihitä muut suomalaiset. Tämän viikon palkintosumma <span className="mono" style={{ color: 'var(--ink)' }}>925 €</span>. Sponsorina Weezybet. Pelaaminen on ilmaista.</>}
          </p>
        </div>
      </section>

      <section className="container-wide pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10">
          {/* GAME COLUMN */}
          <div className="lg:col-span-8">
            <WeezyRally key={lastResult?.submitted?.id || 'fresh'} onFinish={onFinish} lang={lang} />

            {/* End-screen + share */}
            {lastResult && (
              <div className="panel p-6 sm:p-7 mt-5" data-testid="rally-result">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="eyebrow mb-2">{lang === 'en' ? 'YOUR RUN' : 'SINUN AJOSI'}</div>
                    <div className="flex items-baseline gap-4">
                      <div className="mono" style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.04em', color: '#E8924A', lineHeight: 1 }}>
                        {fmt(lastResult.score)}
                      </div>
                      <div className="mono" style={{ fontSize: 13, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                        {lang === 'en' ? 'POINTS' : 'PISTETTÄ'}
                      </div>
                    </div>
                    {lastResult.submitted && (
                      <div className="mono mt-3" style={{ fontSize: 11.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                        {lang === 'en'
                          ? <>RANK <span style={{ color: 'var(--ink)' }}>{lastResult.submitted.rank}</span> / {lastResult.submitted.total}{lastResult.submitted.is_personal_best ? ' · NEW PERSONAL BEST' : ''}</>
                          : <>SIJA <span style={{ color: 'var(--ink)' }}>{lastResult.submitted.rank}</span> / {lastResult.submitted.total}{lastResult.submitted.is_personal_best ? ' · UUSI HENKILÖKOHTAINEN ENNÄTYS' : ''}</>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-start sm:items-end">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 32))}
                      placeholder={lang === 'en' ? 'Your name (for the leaderboard)' : 'Nimesi (leaderboardiin)'}
                      data-testid="rally-name-input"
                      className="mono"
                      style={{ padding: '10px 12px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 12, letterSpacing: '0.06em', minWidth: 240 }}
                    />
                    <button
                      onClick={() => onFinish(lastResult)}
                      disabled={submitting}
                      className="btn-secondary"
                      data-testid="rally-resubmit"
                    >
                      {lang === 'en' ? 'UPDATE NAME' : 'PÄIVITÄ NIMI'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-5 flex-wrap">
                  <ShareButton
                    variant="dial"
                    payload={{
                      label: `${fmt(lastResult.score)} pts`,
                      intensity: 'KUUMA',
                      headline: lang === 'en'
                        ? `${name || 'I'} scored ${fmt(lastResult.score)} on Mittari Weezy Rally — beat me?`
                        : `${name || 'Sain'} ${fmt(lastResult.score)} pistettä Mittarin Weezy Rallyssa — voitatko sen?`,
                      color: '#E8924A',
                    }}
                    label={lang === 'en' ? 'SHARE THIS RUN' : 'JAA TÄMÄ AJO'}
                    className="btn-primary"
                    dataTestId="rally-share"
                  />
                  <a
                    href={`mailto:?subject=${encodeURIComponent(lang === 'en' ? 'Beat my time on Mittari Weezy Rally' : 'Päihitä aikani Mittarin Weezy Rallyssa')}&body=${encodeURIComponent(`${BACKEND.replace(/\/$/, '')}/peli`)}`}
                    className="btn-ghost inline-flex items-center gap-2"
                    data-testid="rally-challenge"
                  >
                    <Send strokeWidth={1.6} size={13} />
                    {lang === 'en' ? 'CHALLENGE A FRIEND' : 'HAASTA KAVERI'}
                  </a>
                </div>
              </div>
            )}

            {/* Personal stats banner if previously played and no result yet */}
            {!lastResult && me?.best && (
              <div className="panel p-5 mt-5" data-testid="personal-stats">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="eyebrow mb-1.5">{lang === 'en' ? 'YOUR BEST · THIS WEEK' : 'SINUN PARAS · TÄLLÄ VIIKOLLA'}</div>
                    <div className="flex items-baseline gap-3">
                      <div className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
                        {fmt(me.best.score)}
                      </div>
                      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                        {lang === 'en' ? `RANK ${me.rank} / ${me.total}` : `SIJA ${me.rank} / ${me.total}`}
                      </div>
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                    {lang === 'en' ? 'HIT START AGAIN TO IMPROVE →' : 'PAINA START UUDESTAAN PARANTAAKSESI →'}
                  </div>
                </div>
              </div>
            )}

            {/* Stat strip */}
            <div className="mt-5 grid grid-cols-3 gap-3" data-testid="game-stats">
              <div className="panel p-4">
                <div className="eyebrow mb-1">{lang === 'en' ? 'PRIZE' : 'PALKINTO'}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>925 €</div>
              </div>
              <div className="panel p-4">
                <div className="eyebrow mb-1">{lang === 'en' ? 'PLAYERS' : 'PELAAJAT'}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                  {leaderboard.length > 0 ? fmt(4280 + leaderboard.length) : '4 280'}
                </div>
              </div>
              <div className="panel p-4">
                <div className="eyebrow mb-1">{lang === 'en' ? 'TIME LEFT' : 'AIKAA JÄLJ.'}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>2 pv 14 h</div>
              </div>
            </div>

            {/* Tips */}
            <div className="panel p-5 mt-5">
              <div className="eyebrow mb-3 inline-flex items-center gap-2">
                <Lightbulb strokeWidth={1.5} size={12} /> {lang === 'en' ? 'TIPS' : 'VINKIT'}
              </div>
              <ul className="space-y-1.5 font-serif" style={{ fontSize: 14, color: 'var(--ink)' }}>
                {tips.map((t, i) => <li key={i}>· {t}</li>)}
              </ul>
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="panel p-5">
              <div className="eyebrow mb-3">{lang === 'en' ? 'RULES' : 'SÄÄNNÖT'}</div>
              <ul className="space-y-2 font-serif" style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                <li>· {lang === 'en' ? 'Best score per week counts.' : 'Paras tulos viikossa lasketaan.'}</li>
                <li>· {lang === 'en' ? 'No deposit, no card.' : 'Ei talletusta, ei luottokorttia.'}</li>
                <li>· {lang === 'en' ? 'Winners announced Sunday.' : 'Voittajat julkistetaan sunnuntaina.'}</li>
                <li>· {lang === 'en' ? 'Prizes credited to Weezybet account.' : 'Palkinnot lähetetään Weezybet-tilille.'}</li>
                <li>· 18+</li>
              </ul>
            </div>

            <div className="panel p-5">
              <div className="eyebrow mb-3">{lang === 'en' ? 'PRIZES' : 'PALKINNOT'}</div>
              <div className="space-y-2.5">
                {PRIZE_TIERS.map((p) => (
                  <div key={p.tier} className="flex items-baseline justify-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <div className="flex items-baseline gap-2">
                      <span className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 700, width: 30 }}>
                        {p.tier}
                      </span>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{p.prize}</span>
                    </div>
                    <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                      {p.kind.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link to="/" className="btn-ghost text-[12px]" data-testid="past-weeks-link">
              {lang === 'en' ? 'Past leaderboards →' : 'Aiempien viikkojen leaderboardit →'}
            </Link>
          </aside>
        </div>
      </section>

      {/* LEADERBOARD */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-3 inline-flex items-center gap-2">
            <Trophy strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'TOP 10 · LIVE LEADERBOARD' : 'TOP 10 · LIVE LEADERBOARD'}
          </div>
          <h2 className="display text-3xl sm:text-4xl mb-8">
            {lang === 'en' ? 'This week\u2019s leaders' : 'Tämän viikon kärki'}
          </h2>

          {/* Personal rank banner */}
          {me?.best && (
            <div className="panel p-4 mb-5 flex items-center justify-between" data-testid="leaderboard-personal">
              <div className="flex items-center gap-4">
                <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: '#E8924A', letterSpacing: '-0.03em', minWidth: 60 }}>
                  #{me.rank}
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                    {lang === 'en' ? 'YOUR PLACE' : 'SINUN SIJASI'}
                  </div>
                  <div className="font-display font-bold" style={{ color: 'var(--ink)', fontSize: 16 }}>
                    {fmt(me.best.score)} {lang === 'en' ? 'pts' : 'pistettä'}
                  </div>
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                {lang === 'en' ? `OF ${me.total} PLAYERS` : `KAIKKIAAN ${me.total} PELAAJAA`}
              </div>
            </div>
          )}

          {leaderboard.length === 0 ? (
            <div className="panel p-7 text-center mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }} data-testid="leaderboard-empty">
              {lang === 'en' ? 'NO RUNS YET — BE THE FIRST →' : 'EI AJOJA VIELÄ — OLE ENSIMMÄINEN →'}
            </div>
          ) : (
            <div className="panel overflow-hidden" data-testid="leaderboard-table">
              <div className="grid" style={{ gridTemplateColumns: '60px 1fr 100px 110px', borderBottom: '1px solid var(--border-strong)' }}>
                <div className="eyebrow p-3">{lang === 'en' ? 'RANK' : 'SIJA'}</div>
                <div className="eyebrow p-3">{lang === 'en' ? 'PLAYER' : 'PELAAJA'}</div>
                <div className="eyebrow p-3 text-right">{lang === 'en' ? 'SCORE' : 'PISTEET'}</div>
                <div className="eyebrow p-3 text-right">{lang === 'en' ? 'PRIZE' : 'PALKINTO'}</div>
              </div>
              {leaderboard.map((row, i) => {
                const rank = i + 1;
                const prize = PRIZE_TIERS.find((p) => p.tier.includes(String(rank)) || (p.tier.includes('–') && rank >= +p.tier.split('–')[0] && rank <= +p.tier.split('–')[1]));
                return (
                  <div
                    key={row.id || i}
                    className="grid items-center"
                    style={{ gridTemplateColumns: '60px 1fr 100px 110px', borderBottom: '1px solid var(--border)', background: i === 0 ? 'rgba(139,30,26,0.06)' : 'transparent' }}
                    data-testid={`leaderboard-row-${rank}`}
                  >
                    <div className="mono p-3" style={{ fontSize: 22, fontWeight: 500, color: rankColor(rank), letterSpacing: '-0.03em' }}>
                      {String(rank).padStart(2, '0')}
                    </div>
                    <div className="font-display font-bold p-3" style={{ color: 'var(--ink)', fontSize: 14.5 }}>
                      {row.name || (lang === 'en' ? 'Anonymous' : 'Nimetön')}
                    </div>
                    <div className="mono p-3 text-right" style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                      {fmt(row.score)}
                    </div>
                    <div className="mono p-3 text-right" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
                      {prize ? prize.prize : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MiniGame;
