/**
 * PUTKI HQ Hub — Phase 3 V2 Final Architecture Step 5.
 *
 * Layout (top → bottom, anchored against final architecture):
 *   Zone 1  · Compact top strip: dial cockpit top-left, Voyager corner top-right.
 *             Both above the fold. State headline + share + dial history beneath.
 *   Zone 2  · HubMosaic — 5 category cards (Streamerit live, Urheilu nyt,
 *             Tuoreet hetket, Foorumit kuumana, Mittari live). 30 s poll.
 *   Zone 3  · ZonePublicationDepth — 8 archive entry points
 *             (Kasinot, Striimaajat, Profiilit, Skene, Sääntely,
 *              Sponsoroinnit, Raha, Pelit).
 *   Zone 4  · Games strip (Rally / Voita Palkinto / Weekly Card).
 *   Zone 5  · Capture form (newsletter / Telegram / push).
 *   Footer  · EditorialFooter — accountability stamp.
 *
 * HIDDEN per architecture: Pulssi + Operaattoritapahtumat surfaces are not
 * rendered (no "Tulossa" placeholders) until their data layer is built.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, MessageCircle, Smartphone, Trophy, Gift } from 'lucide-react';
import DialCockpit from '../components/DialCockpit';
import MostReadRail from '../components/MostReadRail';
import DialSubscriptionCTA from '../components/DialSubscriptionCTA';
import LiveActivityFeed from '../components/LiveActivityFeed';
import StreamerLiveGrid from '../components/StreamerLiveGrid';
import PaivaVitoset from '../components/PaivaVitoset';
import SocialProofBar from '../components/SocialProofBar';
import StickyTelegramCTA from '../components/StickyTelegramCTA';
import WinnersCorner from '../components/WinnersCorner';
import EditorialFooter from '../components/EditorialFooter';
import UTMBanner from '../components/UTMBanner';
import TelegramSubscribeButton from '../components/TelegramSubscribeButton';
import ShareButton from '../components/ShareButton';
import PhaseOneDiscoveryRow from '../components/PhaseOneDiscoveryRow';
import { dialReading } from '../constants/dial';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const isHotState = (state) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

// State headlines — short Bloomberg-rhythm reading for the dial section.
// Per Section 13c of the Phase 1 brief. Plain-language explanations live
// in dialReading() in constants/dial.js (consumes live streams + viewers).
const STATE_HEADLINES_FI = {
  KYLMA:      'Mittari on TYYNI.',
  HAALEA:     'Mittari on VIRE.',
  KUUMA:      'Mittari on VIPINÄ.',
  MYRSKY:     'Mittari on MEININKI.',
  KIIRASTULI: 'Mittari on PERKELE.',
};
const STATE_HEADLINES_EN = {
  KYLMA:      'Mittari is CALM.',
  HAALEA:     'Mittari is BUZZ.',
  KUUMA:      'Mittari is ACTIVE.',
  MYRSKY:     'Mittari is ROLLING.',
  KIIRASTULI: 'Mittari is PERKELE.',
};

// CockpitContext + LiveDataTicker + ActivityStats removed in Phase 1 cleanup
// per brief Section 12c (single live-status surface; PRIMARY DRIVER strip
// moves to Phase 2 Explore section if it returns at all).

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

// Zone 5 — capture form (newsletter signup). Lives below the mosaic + Zone 3.
const CaptureSection = () => {
  const { t, lang } = useLang();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const onSubmit = (e) => { e.preventDefault(); setDone(true); console.log('hero-capture', email); };

  return (
    <section
      className="py-12 sm:py-16"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      data-testid="zone-capture"
    >
      <div className="container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="eyebrow mb-3">
              {lang === 'en' ? 'HUB · ZONE 5 · ALERTS' : 'HUB · ZONE 5 · ILMOITUKSET'}
            </div>
            <h2 className="display text-2xl sm:text-4xl mb-4" style={{ lineHeight: 1.1 }}>
              {lang === 'en' ? 'Don\u2019t miss when your favourite streamer goes live' : 'Älä missaa kun lempi-striimari menee liveen'}
            </h2>
            <p className="font-serif" style={{ fontSize: 15.5, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Mittari signals the moment something happens. Email · Telegram · phone. Daily roll-up, no spam.'
                : 'Mittarin signaali heti kun jotain tapahtuu. Sähköposti · Telegram · puhelin. Päivittäinen kooste, ei spämmiä.'}
            </p>
            <div className="mt-7 flex items-center gap-5">
              <Mail strokeWidth={1.4} size={18} style={{ color: 'var(--muted)' }} />
              <MessageCircle strokeWidth={1.4} size={18} style={{ color: 'var(--muted)' }} />
              <Smartphone strokeWidth={1.4} size={18} style={{ color: 'var(--muted)' }} />
            </div>
          </div>
          <div data-testid="hero-capture">
            {done ? (
              <div className="panel p-5 flex items-center gap-3" style={{ background: 'var(--bg)' }}>
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
                  {lang === 'en' ? 'Subscribe to PUTKI HQ alerts →' : 'Tilaa PUTKI HQ -ilmoitukset →'}
                </button>
                <TelegramSubscribeButton dataTestId="hero-capture-telegram" />
              </form>
            )}
            <div className="mt-5 space-y-1 mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
              <div>{lang === 'en' ? 'DAILY · 1 EMAIL' : 'PÄIVITTÄIN · 1 SÄHKÖPOSTI'}</div>
              <div>{lang === 'en' ? '0 SPAM · 0 STRINGS' : '0 SPÄMMIÄ · 0 EHTOA'}</div>
              <SubscriberCount lang={lang} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Zone 4 — dial-state-aware games row (Rally / Voita Palkinto / Weekly Card)
const GamesSection = ({ state, t, lang }) => {
  const isHot = isHotState(state);
  const rallyTile = (
    <Link to="/peli" className="block relative overflow-hidden panel panel-hover group"
          style={{ minHeight: 320 }} data-testid="minigame-teaser">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #141414 50%, #1F1F1F 100%)' }} />
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 80% 30%, rgba(232,146,74,0.18) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(90,123,184,0.16) 0%, transparent 55%)' }} />
      <div className="relative p-7 sm:p-10 flex flex-col h-full" style={{ minHeight: 320, color: '#F5F3EE' }}>
        <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
          {t('home.rally_eyebrow')}
        </div>
        <h3 className="display text-4xl sm:text-5xl mb-3" style={{ color: '#F5F3EE' }}>500€ Weezybet</h3>
        <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,243,238,0.7)', fontWeight: 500 }}>{t('home.rally_terms')}</div>
        <div className="mt-auto">
          <span className="inline-flex items-center justify-center mono"
                style={{ background: '#F5F3EE', color: '#0A0A0A', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, padding: '14px 22px', borderRadius: 4 }}>
            {t('btn.play_round')}
          </span>
        </div>
      </div>
    </Link>
  );

  const visitorTile = (
    <Link to="/voita-palkinto" className="block relative overflow-hidden panel panel-hover group"
          style={{ minHeight: 320 }} data-testid="visitor-teaser">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A0F0A 60%, #2D1810 100%)' }} />
      <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(232,146,74,0.32) 0%, transparent 55%), radial-gradient(circle at 25% 80%, rgba(200,66,60,0.18) 0%, transparent 50%)' }} />
      <div className="relative p-7 sm:p-10 flex flex-col h-full" style={{ minHeight: 320, color: '#F5F3EE' }}>
        <div className="mono mb-3 inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
          <Gift strokeWidth={1.5} size={12} />
          {lang === 'en' ? 'WIN A PRIZE · ONE SPIN' : 'VOITA PALKINTO · YKSI PYÖRÄYTYS'}
        </div>
        <h3 className="display text-4xl sm:text-5xl mb-3" style={{ color: '#F5F3EE' }}>
          {lang === 'en' ? 'Free spin. Claim at Weezybet.' : 'Ilmainen kierros. Lunasta Weezybetissä.'}
        </h3>
        <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,243,238,0.7)', fontWeight: 500 }}>
          {lang === 'en' ? 'FOR ENTERTAINMENT ONLY · NO BETTING' : 'VAIN VIIHTEEKSI · EI VEDONLYÖNTIÄ'}
        </div>
        <div className="mt-auto">
          <span className="inline-flex items-center gap-2 mono"
                style={{ background: '#E8924A', color: '#0A0A0A', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, padding: '14px 22px', borderRadius: 4 }}>
            {lang === 'en' ? 'PLAY NOW' : 'PELAA NYT'} <ArrowRight strokeWidth={1.7} size={14} />
          </span>
        </div>
      </div>
    </Link>
  );

  const weeklyTile = (
    <Link to="/viikon-kortti" className="panel panel-hover block p-7 sm:p-10 flex flex-col"
          style={{ minHeight: 320 }} data-testid="weeklycard-teaser">
      <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>{t('home.weekly_eyebrow')}</div>
      <h3 className="display text-2xl sm:text-3xl mb-4 leading-tight" style={{ color: 'var(--ink)' }}>{t('home.weekly_headline')}</h3>
      <div className="mono mb-6" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 500 }}>{t('home.weekly_sub')}</div>
      <div className="mt-auto">
        <span className="btn-ghost group-hover:text-brand-blue">
          <Trophy strokeWidth={1.5} size={14} className="mr-2" />
          {t('btn.read_full_card')}
        </span>
      </div>
    </Link>
  );

  return (
    <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }} data-testid="games-section">
      <div className="container-wide">
        <div className="mono mb-6 inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}
             data-testid={`games-section-state-${isHot ? 'hot' : 'cold'}`}>
          <span className="led" style={{ background: isHot ? '#E8924A' : '#5A7BB8' }} />
          {isHot
            ? (lang === 'en' ? `MITTARI · ${state} — ACTION MODE, RALLY UP TOP` : `MITTARI · ${state} — TOIMINTATILA, RALLY KÄRJESSÄ`)
            : (lang === 'en' ? `MITTARI · ${state} — QUIET HOUR, FREE SPIN UP TOP` : `MITTARI · ${state} — HILJAINEN HETKI, ILMAISKIERROS KÄRJESSÄ`)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {isHot ? (<>{rallyTile}{visitorTile}</>) : (<>{visitorTile}{rallyTile}</>)}
        </div>
        <div className="mt-6">{weeklyTile}</div>
      </div>
    </section>
  );
};

const Home = () => {
  const { lang, t } = useLang();
  const [dial, setDial] = useState(null);
  const [liveStats, setLiveStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDial(d); })
      .catch(() => {});
    const loadStats = () => fetch(`${BACKEND}/api/data/live-stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d) setLiveStats(d); })
      .catch(() => {});
    loadStats();
    const id = setInterval(loadStats, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const state = dial?.state?.key || 'KYLMA';
  const hot = isHotState(state);
  const headline = (lang === 'en' ? STATE_HEADLINES_EN : STATE_HEADLINES_FI)[state] || '';
  const reading = dialReading(state, lang, {
    streams: liveStats?.twitch_live,
    viewers: liveStats?.twitch_viewers,
  });

  return (
    <div data-testid="home-page">
      <UTMBanner />

      {/* ZONE 1 — compact top strip: dial top-left, Voyager top-right */}
      <section
        className="relative overflow-hidden"
        style={{
          '--glow-color': hot ? 'rgba(232,146,74,0.28)' : 'rgba(122,126,131,0.16)',
          '--glow-color-2': hot ? 'rgba(200,66,60,0.16)' : 'rgba(44,95,141,0.14)',
        }}
        data-testid="zone-hero"
      >
        <div className="hero-glow" />
        <div className="absolute inset-0 grid-bg pointer-events-none" style={{ zIndex: 0 }} />
        <div className="scanlines absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />

        <div className="container-wide pt-6 pb-8 relative" style={{ zIndex: 2 }}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-8 lg:gap-10 items-start"
               data-testid="hero-strip">
            {/* TOP-LEFT — dial cockpit (compact) */}
            <div className="flex flex-col items-start" data-testid="hero-dial-slot">
              <div className="eyebrow mb-2" data-testid="hero-eyebrow">
                {t('hero.eyebrow').toUpperCase()}
              </div>
              <h1 className="display mb-3"
                  style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, color: 'var(--ink)', maxWidth: 620, fontWeight: 700 }}
                  data-testid="hero-value-prop">
                {lang === 'en' ? 'Finland\u2019s scene temperature' : 'Suomen skenen lämpötila'}
              </h1>
              <div className="flex items-center justify-center w-full lg:justify-start">
                <DialCockpit state={state} compact />
              </div>
              <p className="font-serif mt-4"
                 style={{ fontSize: 14.5, color: 'var(--ink)', maxWidth: 560, lineHeight: 1.55 }}
                 data-testid="hero-dial-reading">
                {reading}
              </p>
              <p className="mono mt-2"
                 style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', maxWidth: 560, lineHeight: 1.4, fontWeight: 600 }}
                 data-testid="hero-headline">
                {headline.toUpperCase()}
              </p>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <a
                  href="#zone-capture"
                  data-testid="hero-cta-primary"
                  className="mono inline-flex items-center gap-2"
                  style={{
                    padding: '13px 22px',
                    background: '#E8924A', color: '#0A0A0A',
                    fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
                    border: 'none', cursor: 'pointer', borderRadius: 2,
                    textDecoration: 'none',
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.querySelector('[data-testid="zone-capture"]');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {t('hero.cta_primary').toUpperCase()} →
                </a>
                <Link to="/menetelma" className="btn-ghost" data-testid="hero-cta-secondary">
                  {t('hero.cta_secondary')}
                </Link>
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

            {/* TOP-RIGHT — Phase 1 (Section 3b): The "PUBLISHED CONTENT"
                stats card is removed. The news carousel that replaces it
                ships in Sprint 3.b — for now we leave the right column
                empty so the dial dominates the section per the brief. */}
            <div data-testid="hero-activity-slot" />
          </div>
        </div>
      </section>

      <div id="dial-cta">
        <DialSubscriptionCTA
          dialState={state}
          streamCount={liveStats?.twitch_live || 0}
          viewerCount={liveStats?.twitch_viewers || 0}
          sportsCount={liveStats?.sports_events || 0}
        />
      </div>
      <MostReadRail />
      <SocialProofBar />
      <WinnersCorner />

      {/* WHAT IS PUTKI HQ — value proposition / "we are media, not a casino" */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
               data-testid="zone-whatis">
        <div className="container-wide">
          <div className="eyebrow mb-3" data-testid="whatis-eyebrow">{t('whatis.eyebrow').toUpperCase()}</div>
          <h2 className="display text-3xl sm:text-4xl lg:text-5xl mb-4" style={{ lineHeight: 1.08, maxWidth: 880 }}
              data-testid="whatis-title">
            {t('whatis.title')}
          </h2>
          <p className="prose-mittari mb-8" style={{ maxWidth: 780, fontSize: 16 }} data-testid="whatis-lede">
            {t('whatis.lede')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="whatis-pillars">
            {['p1', 'p2', 'p3'].map((k) => (
              <article key={k} className="panel p-5" style={{ background: 'var(--bg)' }}
                       data-testid={`whatis-${k}`}>
                <h3 className="display mb-2" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
                  {t(`whatis.${k}_t`)}
                </h3>
                <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {t(`whatis.${k}_b`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pre-Launch Polish — Dioni's compressed homepage flow:
          1. Live data ticker (top)
          2. Hero (Dial + ActivityStats)
          3. Streamer live · "Mitä tapahtuu nyt" (carousel 4 cards)
          4. Päivän Vitoset · betting consensus + Telegram CTA
          5. Live Activity Feed excerpt → /uutiset
          6. Capture form
          Vertical rhythm: 40px (py-10) between zones. */}

      <div className="py-10" style={{ borderTop: '1px solid var(--border)' }} data-testid="zone-streamer-live">
        <StreamerLiveGrid />
      </div>

      <div className="py-10" style={{ borderTop: '1px solid var(--border)' }} data-testid="zone-paivan-vitoset">
        <PaivaVitoset />
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }}>
        <LiveActivityFeed />
        <div className="container-wide pb-10">
          <Link
            to="/uutiset"
            data-testid="home-uutiset-link"
            className="mono inline-flex items-center gap-2"
            style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, textDecoration: 'none' }}
          >
            {t('home.see_all_news').toUpperCase()}
          </Link>
        </div>
      </div>

      {/* ZONE 5 — capture form */}
      <CaptureSection />

      {/* Pulssi + Operaattoritapahtumat: HIDDEN until commercial decisions land
          per FINAL ARCHITECTURE — no "Tulossa" placeholders. */}

      {/* ACCOUNTABILITY FOOTER */}
      <section className="py-10" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
               data-testid="hub-accountability-section">
        <div className="container-wide">
          <EditorialFooter byline="PUTKI HQ" readMinutes={2} />
        </div>
      </section>

      <PhaseOneDiscoveryRow />

      <StickyTelegramCTA />
    </div>
  );
};

export default Home;
