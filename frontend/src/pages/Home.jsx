import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, MessageCircle, Smartphone, Trophy, Gift, Newspaper } from 'lucide-react';
import DialCockpit from '../components/DialCockpit';
import MomentCard from '../components/MomentCard';
import { OperatorTeaserCard } from '../components/OperatorCard';
import LiveTilesGrid from '../components/LiveTilesGrid';
import UTMBanner from '../components/UTMBanner';
import { ActivityFeedInline } from '../components/ActivityFeed';
import { SocialProofTicker } from '../components/SocialProofTicker';
import TelegramSubscribeButton from '../components/TelegramSubscribeButton';
import ShareButton from '../components/ShareButton';
import DialHistoryMiniChart from '../components/DialHistoryMiniChart';
import { useOperators } from '../hooks/useRegistry';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const isHotState = (state) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

// V2 honesty pass: STATE_HEADLINES kept (editorial copy, not data).
// Removed: MOMENTS, INTL_MOMENTS, CURRENT_DIAL, DIAL_STATES, STREAMERS, MISSED_FI, MISSED_EN —
// all fake live data. Now reads dial from /api/dial and missasit/moments from /api/published.
const STATE_HEADLINES_FI = {
  KYLMA:      'Mittari on KYLMÄ. Skene nukkuu.',
  HAALEA:     'Mittari on HAALEA. Tasaista taustakohinaa.',
  KUUMA:      'Mittari on KUUMA. Slot-skene lämpenee illaksi.',
  MYRSKY:     'Mittari on MYRSKY. Striimit täynnä, klippejä syntyy.',
  KIIRASTULI: 'Mittari on KIIRASTULI. Älä katso pois.',
};
const STATE_HEADLINES_EN = {
  KYLMA:      'The dial is KYLMÄ. The scene is asleep.',
  HAALEA:     'The dial is HAALEA. Steady background hum.',
  KUUMA:      'The dial is KUUMA. The slot scene is warming up for tonight.',
  MYRSKY:     'The dial is MYRSKY. Streams packed, clips spawning.',
  KIIRASTULI: 'The dial is KIIRASTULI. Don\u2019t look away.',
};

// MISSASIT EILEN — pulled from /api/published?surface=missasit_eilen.
// Empty state when the editorial pipeline hasn't shipped anything yet.
const MissasitEilenSection = ({ lang }) => {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/published?surface=missasit_eilen&limit=6`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setItems(d.items || []); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section
      className="py-12 sm:py-14"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      data-testid="missasit-eilen-section"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-7 gap-3 flex-wrap">
          <div>
            <div className="eyebrow mb-2">{lang === 'en' ? 'WHAT YOU MISSED · LAST 24 H' : 'MISSASIT EILEN · 24 H'}</div>
            <h2 className="display text-2xl sm:text-3xl">
              {lang === 'en' ? 'Mittari noticed these while you were away' : 'Mittari huomasi nämä poissaolossasi'}
            </h2>
          </div>
        </div>
        {!loaded ? null : items.length === 0 ? (
          <div className="panel p-7 text-center" data-testid="missasit-eilen-empty">
            <Newspaper strokeWidth={1.4} size={20} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              {lang === 'en'
                ? 'NO 24H EDITORIAL YET · MOMENT-COMMENTARY SURFACES FROM REAL CLIP DETECTIONS ONCE POLLERS HAVE API KEYS'
                : 'EI 24H-TOIMITUSTA VIELÄ · HETKI-KOMMENTAARIT SYNTYVÄT OIKEISTA KLIPPIHAVAINNOISTA KUN POLLERIT SAAVAT API-AVAIMET'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="panel panel-hover" style={{ padding: '14px 16px' }} data-testid={`missasit-card-${item.id}`}>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
                  {(item.content_type || '').replace(/_/g, ' ').toUpperCase()}
                </div>
                <p className="font-serif mt-2" style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink)' }}>
                  {String(item.text || '').slice(0, 200)}{(item.text || '').length > 200 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// CockpitContext — Phase 3 Pääsyy + Viimeisin piikki lines below the dial.
// Polls /api/cockpit every 30s; degrades silently if endpoint not available.
const CockpitContext = ({ lang }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cockpit`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setData(d);
      } catch {}
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!data) return null;

  const driverLabel = (data.primary_driver_label && data.primary_driver_label[lang]) || data.primary_driver_label?.fi || '';
  const spike = data.last_spike;

  return (
    <div className="mt-5 flex flex-col items-center gap-2" data-testid="cockpit-context">
      {driverLabel && (
        <div
          className="mono inline-flex items-center gap-2"
          style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}
          data-testid="cockpit-paasyy"
        >
          <span style={{ color: 'var(--muted)' }}>{lang === 'en' ? 'PRIMARY DRIVER' : 'PÄÄSYY'} ·</span>
          {driverLabel}
        </div>
      )}
      {spike && spike.text && (
        <div
          className="mono inline-flex items-center gap-2 max-w-md text-center"
          style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.5 }}
          data-testid="cockpit-viimeisin-piikki"
        >
          <span style={{ color: '#E8924A' }}>{lang === 'en' ? 'LATEST SPIKE' : 'VIIMEISIN PIIKKI'} ·</span>
          <span style={{ color: 'var(--ink)' }}>{spike.text.length > 90 ? spike.text.slice(0, 90) + '…' : spike.text}</span>
        </div>
      )}
    </div>
  );
};

const SubscriberCount = ({ lang }) => {
  const [n, setN] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/signup/count`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setN(d.count ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (n == null) return null;
  const fmt = n.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ');
  return <div data-testid="hero-subscriber-count">{lang === 'en' ? `${fmt} SUBSCRIBE` : `${fmt} TILAA`}</div>;
};

const HeroCapture = () => {
  const { t, lang } = useLang();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const onSubmit = (e) => { e.preventDefault(); setDone(true); console.log('hero-capture', email); };

  return (
    <div className="w-full max-w-md mx-auto lg:mx-0" data-testid="hero-capture">
      <h2
        className="display mb-3"
        style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, color: 'var(--ink)' }}
        data-testid="hero-capture-headline"
      >
        {lang === 'en' ? 'Don\u2019t miss when your favourite streamer goes live' : 'Älä missaa kun lempi-striimari menee liveen'}
      </h2>
      <p className="font-serif mb-7" style={{ fontSize: 15.5, color: 'var(--muted)', lineHeight: 1.55 }}>
        {lang === 'en'
          ? 'Mittari\u2019s signal the moment something happens. Email · Telegram · phone.'
          : 'Mittarin signaali heti kun jotain tapahtuu. Sähköposti · Telegram · puhelin.'}
      </p>

      {done ? (
        <div className="panel p-5 flex items-center gap-3" style={{ background: 'var(--surface)' }}>
          <div className="led" style={{ background: '#E8924A' }} />
          <div className="mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 600 }}>
            {lang === 'en' ? '✓ YOU\u2019RE IN. MITTARI WILL ALERT YOU.' : '✓ OLET LISTALLA. MITTARI HOITAA LOPUT.'}
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('home.placeholder_email')}
            className="mono w-full"
            style={{ padding: '20px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 14, letterSpacing: '0.08em', height: 64 }}
            data-testid="hero-capture-input"
          />
          <button type="submit" className="btn-primary w-full" data-testid="hero-capture-submit" style={{ padding: '18px 24px', minHeight: 56 }}>
            {lang === 'en' ? 'Subscribe to Mittari alerts →' : 'Tilaa Mittari-ilmoitukset →'}
          </button>
          <TelegramSubscribeButton dataTestId="hero-capture-telegram" />
        </form>
      )}

      <div className="mt-6 space-y-1 mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
        <div>{lang === 'en' ? 'DAILY · 1 EMAIL' : 'PÄIVITTÄIN · 1 SÄHKÖPOSTI'}</div>
        <div>{lang === 'en' ? '0 SPAM · 0 STRINGS' : '0 SPÄMMIÄ · 0 EHTOA'}</div>
        <SubscriberCount lang={lang} />
      </div>

      <div className="mt-7 flex items-center gap-5">
        <Mail strokeWidth={1.4} size={18} style={{ color: 'var(--muted)' }} />
        <MessageCircle strokeWidth={1.4} size={18} style={{ color: 'var(--muted)' }} />
        <Smartphone strokeWidth={1.4} size={18} style={{ color: 'var(--muted)' }} />
      </div>
    </div>
  );
};

const Home = () => {
  const { lang, t } = useLang();
  const [dial, setDial] = useState(null);
  const [moments, setMoments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${BACKEND}/api/dial`).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND}/api/published?surface=moments&limit=4`).then((r) => r.json()).catch(() => ({ items: [] })),
    ]).then(([d, p]) => {
      if (cancelled) return;
      setDial(d);
      setMoments(p?.items || []);
    });
    return () => { cancelled = true; };
  }, []);

  const state = dial?.state?.key || 'KYLMA';
  const hot = isHotState(state);
  const featuredMoment = moments[0];
  const otherMoments = moments.slice(1, 4);
  const { data: operators } = useOperators();
  const topOperators = operators.slice(0, 4);
  const headline = (lang === 'en' ? STATE_HEADLINES_EN : STATE_HEADLINES_FI)[state] || '';

  return (
    <div data-testid="home-page">
      <UTMBanner />

      {/* SPLIT HERO — dial left, capture right */}
      <section
        className="relative overflow-hidden"
        style={{
          '--glow-color': hot ? 'rgba(232,146,74,0.30)' : 'rgba(122,126,131,0.18)',
          '--glow-color-2': hot ? 'rgba(200,66,60,0.18)' : 'rgba(44,95,141,0.16)',
        }}
      >
        <div className="hero-glow" />
        <div className="absolute inset-0 grid-bg pointer-events-none" style={{ zIndex: 0 }} />
        <div className="scanlines absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />

        <div className="container-wide pt-8 sm:pt-14 pb-12 sm:pb-16 relative" style={{ zIndex: 2 }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_auto_0.85fr] gap-10 lg:gap-12 items-center animate-fade-up">
            {/* LEFT: cockpit dial */}
            <div className="flex flex-col items-center lg:items-center">
              <DialCockpit state={state} />
              <CockpitContext lang={lang} />
              <div className="mt-6 w-full max-w-md">
                <DialHistoryMiniChart currentState={state} />
              </div>
              <h1
                className="display mt-6 sm:mt-8 max-w-xl text-center"
                style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.18, color: 'var(--ink)' }}
                data-testid="hero-headline"
              >
                {headline}
              </h1>
              {/* State-aware secondary CTA strip */}
              <div className="mt-6 flex items-center gap-4">
                {hot ? (
                  <Link to="/kasinot" className="btn-ghost" data-testid="hero-cta-primary">
                    {t('home.cta_play')} <ArrowRight strokeWidth={1.7} size={13} className="ml-1.5" />
                  </Link>
                ) : (
                  <Link to="/viikon-kortti" className="btn-ghost" data-testid="hero-cta-primary">
                    {t('btn.read_full_card')}
                  </Link>
                )}
                <ShareButton
                  variant="dial"
                  payload={{
                    label: dial?.state?.label || '',
                    intensity: state,
                    headline,
                    color: dial?.state?.color || '#7A7E83',
                  }}
                  dataTestId="hero-share-dial"
                />
              </div>
            </div>

            {/* DIVIDER */}
            <div className="hidden lg:block" style={{ width: 1, height: '70%', background: 'var(--border-strong)', opacity: 0.6 }} aria-hidden />

            {/* RIGHT: capture */}
            <div className="flex justify-center lg:justify-start">
              <HeroCapture />
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE FIXTURE STRIP — honesty: kept structure for future real sports
          feed but renders an empty honesty notice until API-Football / Liiga RSS
          adapters are wired with real API keys. No more fabricated TAPPARA—TPS
          fixtures or fake LIVE NYT claims. */}
      <section
        className="relative overflow-hidden py-3"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
        data-testid="fixture-marquee"
      >
        <div className="container-wide">
          <div className="mono text-center" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en'
              ? '— SPORTS FIXTURE STRIP · API-FOOTBALL / LIIGA RSS PENDING KEYS —'
              : '— URHEILUFIKSTUURIT · API-FOOTBALL / LIIGA RSS ODOTTAA AVAIMIA —'}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF — live counters */}
      <SocialProofTicker />

      {/* ACTIVITY FEED — Mittari-flavoured live events */}
      <ActivityFeedInline />

      {/* LIVE TILES GRID — new conversion engine */}
      <LiveTilesGrid />

      {/* MISSASIT EILEN — auto-cards from prev 24h, pulled from /api/published */}
      <MissasitEilenSection lang={lang} />

      {/* MOMENTS — "Mittari poimi nämä" — pulled from /api/published?surface=moments */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <div className="eyebrow mb-2">{t('home.update_label')}</div>
              <h2 className="display text-2xl sm:text-4xl">{t('home.moments_title')}</h2>
            </div>
          </div>
          {moments.length === 0 ? (
            <div className="panel p-7 text-center" data-testid="moments-empty">
              <Newspaper strokeWidth={1.4} size={20} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
              <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                {lang === 'en'
                  ? 'NO MOMENTS PUBLISHED YET · TOIMITUS BUILDS THE PIPELINE'
                  : 'EI HETKIÄ JULKAISTU VIELÄ · TOIMITUS RAKENTAA PUTKEA'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="lg:row-span-2">
                {featuredMoment && <MomentCard moment={featuredMoment} featured />}
              </div>
              {otherMoments.map((m) => (
                <MomentCard key={m.id} moment={m} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RANKING TEASER */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <div className="eyebrow mb-2">{t('home.ranking_eyebrow')}</div>
              <h2 className="display text-2xl sm:text-4xl">{t('home.ranking_title')}</h2>
            </div>
            <Link to="/kasinot" className="btn-ghost hidden sm:inline-flex">{t('btn.full_comparison')}</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {topOperators.map((op) => (
              <OperatorTeaserCard key={op.slug} operator={op} />
            ))}
          </div>
          <div className="mt-8 sm:hidden">
            <Link to="/kasinot" className="btn-secondary w-full">{t('btn.full_comparison_long')}</Link>
          </div>
        </div>
      </section>

      {/* RALLY + WEEKLY (dial-state-aware game emphasis per Phase 2.6 brief) */}
      <GamesSection state={state} t={t} lang={lang} />
    </div>
  );
};

// Cross-promotion logic: KUUMA/MYRSKY/KIIRASTULI → Weezy Rally tile prominent (action mood);
// KYLMÄ/HAALEA → Voita Palkinto tile prominent (low-action, "play once, claim" simplicity).
const GamesSection = ({ state, t, lang }) => {
  const isHot = ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);
  const rallyTile = (
    <Link
      to="/peli"
      className="block relative overflow-hidden panel panel-hover group"
      style={{ minHeight: 360 }}
      data-testid="minigame-teaser"
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #141414 50%, #1F1F1F 100%)' }} />
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 80% 30%, rgba(232,146,74,0.18) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(90,123,184,0.16) 0%, transparent 55%)' }} />
      <div className="absolute inset-0 opacity-30" style={{
        background: 'radial-gradient(circle at 15% 25%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 45% 85%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 85% 15%, #F5F3EE 1px, transparent 1.5px)',
        backgroundSize: '120px 120px, 180px 180px, 220px 220px, 90px 90px',
      }} />
      <div className="relative p-7 sm:p-10 flex flex-col h-full" style={{ minHeight: 360, color: '#F5F3EE' }}>
        <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
          {t('home.rally_eyebrow')}
        </div>
        <h3 className="display text-4xl sm:text-5xl mb-3" style={{ color: '#F5F3EE' }}>500€ Weezybet</h3>
        <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,243,238,0.7)', fontWeight: 500 }}>{t('home.rally_terms')}</div>
        <div className="mt-auto">
          <div className="inline-flex items-center gap-3 px-4 py-2.5 mb-6" style={{ background: 'rgba(245,243,238,0.08)', borderRadius: 3, border: '1px solid rgba(245,243,238,0.14)' }}>
            <div>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>{t('home.rally_this_week')}</div>
              <div className="mono mt-0.5" style={{ fontSize: 14, letterSpacing: '-0.01em', color: '#F5F3EE', fontWeight: 500 }}>{t('home.rally_stats')}</div>
            </div>
          </div>
          <span className="inline-flex items-center justify-center mono" style={{ background: '#F5F3EE', color: '#0A0A0A', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, padding: '14px 22px', borderRadius: 4 }}>
            {t('btn.play_round')}
          </span>
        </div>
      </div>
    </Link>
  );

  const visitorTile = (
    <Link
      to="/voita-palkinto"
      className="block relative overflow-hidden panel panel-hover group"
      style={{ minHeight: 360 }}
      data-testid="visitor-teaser"
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A0F0A 60%, #2D1810 100%)' }} />
      <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(232,146,74,0.32) 0%, transparent 55%), radial-gradient(circle at 25% 80%, rgba(200,66,60,0.18) 0%, transparent 50%)' }} />
      <div className="relative p-7 sm:p-10 flex flex-col h-full" style={{ minHeight: 360, color: '#F5F3EE' }}>
        <div className="mono mb-3 inline-flex items-center gap-2" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
          <Gift strokeWidth={1.5} size={12} />
          {lang === 'en' ? 'WIN A PRIZE · ONE SPIN' : 'VOITA PALKINTO · YKSI PYÖRÄYTYS'}
        </div>
        <h3 className="display text-4xl sm:text-5xl mb-3" style={{ color: '#F5F3EE' }}>
          {lang === 'en' ? 'Free spin. Claim at Weezybet.' : 'Ilmainen kierros. Lunasta Weezybetissä.'}
        </h3>
        <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,243,238,0.7)', fontWeight: 500 }}>
          {lang === 'en' ? 'NO DEPOSIT · NO CARD · 18+' : 'EI TALLETUSTA · EI KORTTIA · 18+'}
        </div>
        <div className="mt-auto">
          <div className="mono mb-6" style={{ fontSize: 11.5, letterSpacing: '0.04em', color: 'rgba(245,243,238,0.85)', fontWeight: 500, lineHeight: 1.5 }}>
            {lang === 'en'
              ? 'Every spin wins. Pick up your prize on a brand-new Weezybet account in five minutes.'
              : 'Jokainen pyöräytys voittaa. Lunasta palkinto uudella Weezybet-tilillä viidessä minuutissa.'}
          </div>
          <span className="inline-flex items-center gap-2 mono" style={{ background: '#E8924A', color: '#0A0A0A', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, padding: '14px 22px', borderRadius: 4 }}>
            {lang === 'en' ? 'PLAY NOW' : 'PELAA NYT'} <ArrowRight strokeWidth={1.7} size={14} />
          </span>
        </div>
      </div>
    </Link>
  );

  const weeklyTile = (
    <Link to="/viikon-kortti" className="panel panel-hover block p-7 sm:p-10 flex flex-col" style={{ minHeight: 360 }} data-testid="weeklycard-teaser">
      <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>{t('home.weekly_eyebrow')}</div>
      <h3 className="display text-2xl sm:text-3xl mb-4 leading-tight" style={{ color: 'var(--ink)' }}>{t('home.weekly_headline')}</h3>
      <div className="mono mb-6" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 500 }}>{t('home.weekly_sub')}</div>
      <div className="mt-auto">
        <div className="mono mb-7" style={{ fontSize: 11.5, letterSpacing: '0.04em', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.5 }}>
          {lang === 'en'
            ? 'Weekly Card publishes Mittari\u2019s editorial take on Liiga, NHL, F1, Premier League and Veikkausliiga fixtures. Fixture data wires to API-Football and Liiga RSS once keys are configured.'
            : 'Viikon Kortti julkaisee Mittarin toimituksellisen näkemyksen Liigan, NHL:n, F1:n, Valioliigan ja Veikkausliigan otteluista. Fikstuuridata kytkeytyy API-Footballiin ja Liigan RSS:ään kun avaimet on konfiguroitu.'}
        </div>
        <span className="btn-ghost group-hover:text-brand-blue">
          <Trophy strokeWidth={1.5} size={14} className="mr-2" />
          {t('btn.read_full_card')}
        </span>
      </div>
    </Link>
  );

  return (
    <section
      className="py-12 sm:py-20"
      style={{ borderTop: '1px solid var(--border)' }}
      data-testid="games-section"
    >
      <div className="container-wide">
        {/* Dial-state awareness banner */}
        <div
          className="mono mb-6 inline-flex items-center gap-2"
          style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}
          data-testid={`games-section-state-${isHot ? 'hot' : 'cold'}`}
        >
          <span className="led" style={{ background: isHot ? '#E8924A' : '#5A7BB8' }} />
          {isHot
            ? (lang === 'en' ? `MITTARI · ${state} — ACTION MODE, RALLY UP TOP` : `MITTARI · ${state} — TOIMINTATILA, RALLY KÄRJESSÄ`)
            : (lang === 'en' ? `MITTARI · ${state} — QUIET HOUR, FREE SPIN UP TOP` : `MITTARI · ${state} — HILJAINEN HETKI, ILMAISKIERROS KÄRJESSÄ`)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {isHot ? (
            <>
              {rallyTile}
              {visitorTile}
            </>
          ) : (
            <>
              {visitorTile}
              {rallyTile}
            </>
          )}
        </div>
        <div className="mt-6">
          {weeklyTile}
        </div>
      </div>
    </section>
  );
};

export default Home;
