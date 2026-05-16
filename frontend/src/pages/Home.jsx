import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, MessageCircle, Smartphone, Trophy } from 'lucide-react';
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
import { OPERATORS, MOMENTS, CURRENT_DIAL, DIAL_STATES, STREAMERS } from '../data/mock';
import { useLang } from '../context/LanguageContext';

const isHotState = (state) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

const STATE_HEADLINES_EN = {
  KYLMA:      'The dial is KYLMÄ. The scene is asleep.',
  HAALEA:     'The dial is HAALEA. Steady background hum.',
  KUUMA:      'The dial is KUUMA. The slot scene is warming up for tonight.',
  MYRSKY:     'The dial is MYRSKY. Streams packed, clips spawning.',
  KIIRASTULI: 'The dial is KIIRASTULI. Don\u2019t look away.',
};

// "Missasit eilen" — auto-card moments from previous 24h (mocked)
const MISSED_FI = [
  { id: 'me1', streamer: 'Korpisoturi', game: 'Money Train 4',  intensity: 'MYRSKY', win: '€24,800', headline: 'Korpisoturi veti yön — heräsi vasta klo 4.', body: 'Sinä nukuit, hän voitti. Kahdeksan tuntia sessioo, kahdeksan tunnin aikana €24 800.', source: 'Twitch · 04:12', operator: 'tilttarkka', operatorName: 'Tilttarkka' },
  { id: 'me2', streamer: 'Slotsband',   game: 'Razor Returns',    intensity: 'KUUMA',  win: '€7,400',  headline: 'Slotsband: rauhallinen ilta, isompi kuin näytti.', body: 'Klippi ei levinnyt sosiaalisessa mediassa — joten Mittari nostaa sen tässä.', source: 'Twitch · 22:47', operator: 'castcasino', operatorName: 'Cast Casino' },
];
const MISSED_EN = [
  { id: 'me1', streamer: 'Korpisoturi', game: 'Money Train 4',  intensity: 'MYRSKY', win: '€24,800', headline: 'Korpisoturi pulled an all-nighter — finished at 4 AM.', body: 'You slept, he won. Eight-hour session, €24,800 in those eight hours.', source: 'Twitch · 04:12', operator: 'tilttarkka', operatorName: 'Tilttarkka' },
  { id: 'me2', streamer: 'Slotsband',   game: 'Razor Returns',    intensity: 'KUUMA',  win: '€7,400',  headline: 'Slotsband: a quiet night, bigger than it looked.', body: 'The clip didn\u2019t go viral on social — so Mittari surfaces it here.', source: 'Twitch · 22:47', operator: 'castcasino', operatorName: 'Cast Casino' },
];

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
        <div>{lang === 'en' ? '4 283 FINNS SUBSCRIBE' : '4 283 SUOMALAISTA TILAA'}</div>
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
  const state = CURRENT_DIAL.key;
  const hot = isHotState(state);
  const featuredMoment = MOMENTS[0];
  const otherMoments = MOMENTS.slice(1, 4);
  const topOperators = OPERATORS.slice(0, 4);
  const missed = lang === 'en' ? MISSED_EN : MISSED_FI;
  const headline = lang === 'en' ? STATE_HEADLINES_EN[state] : DIAL_STATES[state].headline;

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
                    label: lang === 'en' ? CURRENT_DIAL.label : CURRENT_DIAL.label,
                    intensity: state,
                    headline,
                    color: CURRENT_DIAL.color,
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

      {/* MARQUEE FIXTURE STRIP */}
      <section
        className="relative overflow-hidden py-3"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
        data-testid="fixture-marquee"
      >
        <div className="marquee-track">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center shrink-0">
              {[
                { color: '#C8423C', a: 'LIIGA',   b: 'TAPPARA — TPS',         t: 'LA 18:30' },
                { color: '#5A7BB8', a: 'NHL',     b: 'CAROLINA — FLORIDA',     t: 'SU 02:00' },
                { color: '#E8924A', a: 'F1',      b: 'MONZA GP',               t: 'SU 16:00' },
                { color: '#7A7E83', a: 'PL',      b: 'LIVERPOOL — ARSENAL',    t: 'SU 18:30' },
                { color: '#8B1E1A', a: 'VEIKK.',  b: 'HJK — KUPS',             t: 'LA 18:00' },
                { color: '#2C5F8D', a: 'KICK',    b: 'PACT LIVE',              t: 'NYT' },
              ].map((it, i) => (
                <div key={`${rep}-${i}`} className="flex items-baseline gap-3 shrink-0 px-8">
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: it.color, fontWeight: 700 }}>{it.a}</span>
                  <span className="mono" style={{ fontSize: 13, letterSpacing: '0.02em', color: 'var(--ink)', fontWeight: 500 }}>{it.b}</span>
                  <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>{it.t}</span>
                  <span style={{ color: 'var(--border-strong)' }}>·</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF — live counters */}
      <SocialProofTicker />

      {/* ACTIVITY FEED — Mittari-flavoured live events */}
      <ActivityFeedInline />

      {/* LIVE TILES GRID — new conversion engine */}
      <LiveTilesGrid />

      {/* MISSASIT EILEN — auto-cards from prev 24h */}
      <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <div className="eyebrow mb-2">{lang === 'en' ? 'WHAT YOU MISSED · LAST 24 H' : 'MISSASIT EILEN · 24 H'}</div>
              <h2 className="display text-2xl sm:text-3xl">
                {lang === 'en' ? 'Mittari noticed these while you were away' : 'Mittari huomasi nämä poissaolossasi'}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {missed.map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        </div>
      </section>

      {/* MOMENTS — "Mittari poimi nämä" */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <div className="eyebrow mb-2">{t('home.update_label')}</div>
              <h2 className="display text-2xl sm:text-4xl">{t('home.moments_title')}</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="lg:row-span-2">
              <MomentCard moment={featuredMoment} featured />
            </div>
            {otherMoments.map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
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

      {/* RALLY + WEEKLY */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <Link to="/peli" className="block relative overflow-hidden panel panel-hover group" style={{ minHeight: 360 }} data-testid="minigame-teaser">
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

          <Link to="/viikon-kortti" className="panel panel-hover block p-7 sm:p-10 flex flex-col" style={{ minHeight: 360 }} data-testid="weeklycard-teaser">
            <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>{t('home.weekly_eyebrow')}</div>
            <h3 className="display text-2xl sm:text-3xl mb-4 leading-tight" style={{ color: 'var(--ink)' }}>{t('home.weekly_headline')}</h3>
            <div className="mono mb-6" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 500 }}>{t('home.weekly_sub')}</div>
            <div className="mt-auto">
              <div className="flex flex-wrap gap-2 mb-7">
                {['Tappara — TPS', 'Carolina — Florida', 'F1 Monza', 'Liverpool — Arsenal', 'HJK — KuPS'].map((f) => (
                  <span key={f} className="mono" style={{ fontSize: 11, letterSpacing: '0.06em', padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 3, color: 'var(--ink)', fontWeight: 500 }}>{f}</span>
                ))}
              </div>
              <span className="btn-ghost group-hover:text-brand-blue">
                <Trophy strokeWidth={1.5} size={14} className="mr-2" />
                {t('btn.read_full_card')}
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
