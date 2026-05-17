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
import HubMosaic from '../components/HubMosaic';
import ZonePublicationDepth from '../components/ZonePublicationDepth';
import VoyagerCorner from '../components/VoyagerCorner';
import ActivityStats from '../components/ActivityStats';
import EditorialFooter from '../components/EditorialFooter';
import UTMBanner from '../components/UTMBanner';
import TelegramSubscribeButton from '../components/TelegramSubscribeButton';
import ShareButton from '../components/ShareButton';
import DialHistoryMiniChart from '../components/DialHistoryMiniChart';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const isHotState = (state) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

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

// CockpitContext — primary driver + last spike under the dial. 30 s poll.
const CockpitContext = ({ lang }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/cockpit`);
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
    <div className="mt-4 flex flex-col gap-1.5" data-testid="cockpit-context">
      {driverLabel && (
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}
             data-testid="cockpit-paasyy">
          <span style={{ color: 'var(--muted)' }}>{lang === 'en' ? 'PRIMARY DRIVER' : 'PÄÄSYY'} ·</span>
          {driverLabel}
        </div>
      )}
      {spike && spike.text && (
        <div className="mono inline-flex items-baseline gap-2 max-w-md"
             style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.5 }}
             data-testid="cockpit-viimeisin-piikki">
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
          {lang === 'en' ? 'NO DEPOSIT · NO CARD · 18+' : 'EI TALLETUSTA · EI KORTTIA · 18+'}
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

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDial(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const state = dial?.state?.key || 'KYLMA';
  const hot = isHotState(state);
  const headline = (lang === 'en' ? STATE_HEADLINES_EN : STATE_HEADLINES_FI)[state] || '';

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

        <div className="container-wide pt-6 sm:pt-10 pb-8 sm:pb-12 relative" style={{ zIndex: 2 }}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-8 lg:gap-10 items-start"
               data-testid="hero-strip">
            {/* TOP-LEFT — dial cockpit (compact) */}
            <div className="flex flex-col items-start" data-testid="hero-dial-slot">
              <div className="flex items-center justify-center w-full lg:justify-start">
                <DialCockpit state={state} compact />
              </div>
              <CockpitContext lang={lang} />
              <h1 className="display mt-5"
                  style={{ fontSize: 'clamp(20px, 2vw, 26px)', lineHeight: 1.2, color: 'var(--ink)', maxWidth: 560 }}
                  data-testid="hero-headline">
                {headline}
              </h1>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
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
              <div className="mt-5 w-full max-w-md">
                <DialHistoryMiniChart currentState={state} />
              </div>
            </div>

            {/* TOP-RIGHT — Phase 4: Activity stats panel replaces the
                previous Voyager corner. Voyager moves below the mosaic so
                the hero stays content-first + balanced (dial · stats grid). */}
            <div data-testid="hero-activity-slot" className="flex flex-col gap-4">
              <ActivityStats />
              <VoyagerCorner />
            </div>
          </div>
        </div>
      </section>

      {/* ZONE 2 — 5-card live mosaic */}
      <HubMosaic />

      {/* ZONE 3 — publication depth: 8 archive entry points */}
      <ZonePublicationDepth />

      {/* ZONE 4 — dial-state-aware games strip */}
      <GamesSection state={state} t={t} lang={lang} />

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
    </div>
  );
};

export default Home;
