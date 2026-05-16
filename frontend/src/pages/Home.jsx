import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Trophy } from 'lucide-react';
import DialCockpit from '../components/DialCockpit';
import StreamerCard from '../components/StreamerCard';
import MomentCard from '../components/MomentCard';
import { OperatorTeaserCard } from '../components/OperatorCard';
import { STREAMERS, OPERATORS, MOMENTS, CURRENT_DIAL, DIAL_STATES } from '../data/mock';
import { useLang } from '../context/LanguageContext';

const isHotState = (state) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

// English headlines per state
const STATE_HEADLINES_EN = {
  KYLMA:      'The dial is KYLMÄ. The scene is asleep.',
  HAALEA:     'The dial is HAALEA. Steady background hum.',
  KUUMA:      'The dial is KUUMA. The slot scene is warming up for tonight.',
  MYRSKY:     'The dial is MYRSKY. Streams packed, clips spawning.',
  KIIRASTULI: 'The dial is KIIRASTULI. Don\u2019t look away.',
};

const Home = () => {
  const { lang, t } = useLang();
  const state = CURRENT_DIAL.key;
  const hot = isHotState(state);
  const liveStreamers = STREAMERS.filter((s) => s.live);
  const featuredMoment = MOMENTS[0];
  const otherMoments = MOMENTS.slice(1, 4);
  const topOperators = OPERATORS.slice(0, 4);
  const headline = lang === 'en' ? STATE_HEADLINES_EN[state] : DIAL_STATES[state].headline;

  const totalViewers = liveStreamers.reduce((a, s) => a + s.viewers, 0);

  return (
    <div data-testid="home-page">
      <section className="container-wide pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="flex flex-col items-center text-center animate-fade-up">
          <DialCockpit state={state} />

          <h1
            className="display mt-12 sm:mt-14 max-w-4xl"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.05, color: 'var(--ink)' }}
            data-testid="hero-headline"
          >
            {headline}
          </h1>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-6 items-center">
            {hot ? (
              <>
                <Link to="/kasinot" className="btn-primary" data-testid="hero-cta-primary">
                  {t('home.cta_play')}
                  <ArrowRight strokeWidth={1.8} className="ml-2" size={14} />
                </Link>
                <Link to="/striimaajat" className="btn-ghost" data-testid="hero-cta-secondary">
                  {t('home.cta_watch_live')} ({liveStreamers.length}) →
                </Link>
              </>
            ) : (
              <>
                <Link to="/aloita" className="btn-primary" data-testid="hero-cta-primary">
                  {t('home.cta_notify')}
                  <ArrowRight strokeWidth={1.8} className="ml-2" size={14} />
                </Link>
                <Link to="/striimaajat" className="btn-ghost" data-testid="hero-cta-secondary">
                  {t('home.cta_watch_live')} →
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* LIVE STRIP */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <div className="eyebrow mb-2">{t('common.live_now').toUpperCase()}</div>
              <h2 className="display text-2xl sm:text-3xl">
                <span className="mono" style={{ fontWeight: 500 }}>{liveStreamers.length}</span> {t('common.streamers')},{' '}
                <span className="mono" style={{ fontWeight: 500 }}>
                  {totalViewers.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ')}
                </span>{' '}
                {t('common.viewers')}
              </h2>
            </div>
            <Link to="/striimaajat" className="btn-ghost hidden sm:inline-flex" data-testid="live-strip-view-all">
              {t('btn.view_all_streamers')}
            </Link>
          </div>
        </div>
        <div className="container-wide overflow-x-auto scrollbar-hide" data-testid="live-strip">
          <div className="flex gap-4 pb-2">
            {liveStreamers.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>
        </div>
      </section>

      {/* NOTIFICATION CAPTURE */}
      <section
        className="py-16 sm:py-20"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="container-narrow text-center">
          <Bell strokeWidth={1.3} size={42} style={{ color: 'var(--brand-blue)' }} className="mx-auto mb-7" />
          <h2 className="display text-3xl sm:text-5xl mb-4" data-testid="email-capture-headline">
            {t('home.email_headline')}
          </h2>
          <p className="font-serif mb-10" style={{ color: 'var(--muted)', fontSize: 17 }}>
            {t('home.email_sub')}
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder={t('home.placeholder_email')}
              className="flex-1 mono"
              style={{
                padding: '18px 20px',
                borderRadius: 4,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontSize: 13,
                letterSpacing: '0.08em',
                outline: 'none',
              }}
              data-testid="email-capture-input"
            />
            <button type="submit" className="btn-primary" data-testid="email-capture-submit">
              {t('btn.subscribe')}
            </button>
          </form>
          <div className="mt-7 flex flex-col items-center gap-1.5">
            <div className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink)', fontWeight: 500 }}>
              ↳ <span style={{ fontWeight: 600 }}>4 283</span> {t('home.email_proof')}
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              {t('home.email_micro')}
            </div>
          </div>
        </div>
      </section>

      {/* MOMENTS */}
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

      {/* RANKING */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <div className="eyebrow mb-2">{t('home.ranking_eyebrow')}</div>
              <h2 className="display text-2xl sm:text-4xl">{t('home.ranking_title')}</h2>
            </div>
            <Link to="/kasinot" className="btn-ghost hidden sm:inline-flex" data-testid="ranking-teaser-view-all">
              {t('btn.full_comparison')}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {topOperators.map((op) => (
              <OperatorTeaserCard key={op.slug} operator={op} />
            ))}
          </div>

          <div className="mt-8 sm:hidden">
            <Link to="/kasinot" className="btn-secondary w-full">
              {t('btn.full_comparison_long')}
            </Link>
          </div>
        </div>
      </section>

      {/* RALLY + WEEKLY */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <Link
            to="/peli"
            className="block relative overflow-hidden panel panel-hover group"
            style={{ minHeight: 360 }}
            data-testid="minigame-teaser"
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #141414 50%, #1F1F1F 100%)' }} />
            <div
              className="absolute inset-0 opacity-40"
              style={{ background: 'radial-gradient(ellipse at 80% 30%, rgba(232,146,74,0.18) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(90,123,184,0.16) 0%, transparent 55%)' }}
            />
            <div className="absolute inset-0 opacity-30" style={{
              background: 'radial-gradient(circle at 15% 25%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 45% 85%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 85% 15%, #F5F3EE 1px, transparent 1.5px)',
              backgroundSize: '120px 120px, 180px 180px, 220px 220px, 90px 90px',
            }} />

            <div className="relative p-7 sm:p-10 flex flex-col h-full" style={{ minHeight: 360, color: '#F5F3EE' }}>
              <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
                {t('home.rally_eyebrow')}
              </div>
              <h3 className="display text-4xl sm:text-5xl mb-3" style={{ color: '#F5F3EE' }}>500€ Weezybet</h3>
              <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,243,238,0.7)', fontWeight: 500 }}>
                {t('home.rally_terms')}
              </div>

              <div className="mt-auto">
                <div
                  className="inline-flex items-center gap-3 px-4 py-2.5 mb-6"
                  style={{ background: 'rgba(245,243,238,0.08)', borderRadius: 3, border: '1px solid rgba(245,243,238,0.14)' }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>{t('home.rally_this_week')}</div>
                    <div className="mono mt-0.5" style={{ fontSize: 14, letterSpacing: '-0.01em', color: '#F5F3EE', fontWeight: 500 }}>{t('home.rally_stats')}</div>
                  </div>
                </div>

                <span
                  className="inline-flex items-center justify-center mono"
                  style={{ background: '#F5F3EE', color: '#0A0A0A', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, padding: '14px 22px', borderRadius: 4 }}
                >
                  {t('btn.play_round')}
                </span>
              </div>
            </div>
          </Link>

          <Link
            to="/viikon-kortti"
            className="panel panel-hover block p-7 sm:p-10 flex flex-col"
            style={{ minHeight: 360 }}
            data-testid="weeklycard-teaser"
          >
            <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              {t('home.weekly_eyebrow')}
            </div>
            <h3 className="display text-2xl sm:text-3xl mb-4 leading-tight" style={{ color: 'var(--ink)' }}>
              {t('home.weekly_headline')}
            </h3>
            <div className="mono mb-6" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 500 }}>
              {t('home.weekly_sub')}
            </div>

            <div className="mt-auto">
              <div className="flex flex-wrap gap-2 mb-7">
                {['Tappara — TPS', 'Carolina — Florida', 'F1 Monza', 'Liverpool — Arsenal', 'HJK — KuPS'].map((f) => (
                  <span
                    key={f}
                    className="mono"
                    style={{ fontSize: 11, letterSpacing: '0.06em', padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 3, color: 'var(--ink)', fontWeight: 500 }}
                  >
                    {f}
                  </span>
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
