import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Trophy } from 'lucide-react';
import DialCockpit from '../components/DialCockpit';
import StreamerCard from '../components/StreamerCard';
import MomentCard from '../components/MomentCard';
import { OperatorTeaserCard } from '../components/OperatorCard';
import { STREAMERS, OPERATORS, MOMENTS, CURRENT_DIAL } from '../data/mock';

// Fix 1: state-aware hero CTA hierarchy
const isHotState = (state) => ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

const Home = () => {
  const state = CURRENT_DIAL.key;
  const hot = isHotState(state);
  const liveStreamers = STREAMERS.filter((s) => s.live);
  const featuredMoment = MOMENTS[0];
  const otherMoments = MOMENTS.slice(1, 4); // 3 more, total 4 (per Fix 3)
  const topOperators = OPERATORS.slice(0, 4);

  return (
    <div data-testid="home-page">
      {/* HERO with DialCockpit */}
      <section className="container-wide pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="flex flex-col items-center text-center animate-fade-up">
          <DialCockpit state={state} />

          <h1
            className="display mt-12 sm:mt-14 max-w-4xl"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.05, color: 'var(--ink)' }}
            data-testid="hero-headline"
          >
            {CURRENT_DIAL.headline}
          </h1>

          {/* Fix 1: state-aware CTA hierarchy — only ONE primary */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-6 items-center">
            {hot ? (
              <>
                <Link to="/kasinot" className="btn-primary" data-testid="hero-cta-primary">
                  Pelaa nyt — viikon kuumimmat kasinot
                  <ArrowRight strokeWidth={1.8} className="ml-2" size={14} />
                </Link>
                <Link to="/striimaajat" className="btn-ghost" data-testid="hero-cta-secondary">
                  Katso ketkä ovat livenä ({liveStreamers.length}) →
                </Link>
              </>
            ) : (
              <>
                <Link to="/aloita" className="btn-primary" data-testid="hero-cta-primary">
                  Saa ilmoitus kun mittari lämpenee
                  <ArrowRight strokeWidth={1.8} className="ml-2" size={14} />
                </Link>
                <Link to="/striimaajat" className="btn-ghost" data-testid="hero-cta-secondary">
                  Katso ketkä ovat livenä →
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* LIVE NOW STRIP */}
      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <div className="eyebrow mb-2">LIVENÄ JUURI NYT</div>
              <h2 className="display text-2xl sm:text-3xl">
                <span className="mono" style={{ fontWeight: 500 }}>{liveStreamers.length}</span> striimaajaa,{' '}
                <span className="mono" style={{ fontWeight: 500 }}>
                  {liveStreamers.reduce((a, s) => a + s.viewers, 0).toLocaleString('fi-FI').replace(/,/g, ' ')}
                </span>{' '}
                katsojaa
              </h2>
            </div>
            <Link to="/striimaajat" className="btn-ghost hidden sm:inline-flex" data-testid="live-strip-view-all">
              Kaikki striimaajat →
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

      {/* Fix 2: NOTIFICATION CAPTURE — upgraded treatment */}
      <section
        className="py-16 sm:py-20"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="container-narrow text-center">
          <Bell strokeWidth={1.3} size={42} style={{ color: 'var(--brand-blue)' }} className="mx-auto mb-7" />
          <h2 className="display text-3xl sm:text-5xl mb-4" data-testid="email-capture-headline">
            Saa ilmoitus kun lempi-striimari menee liveen
          </h2>
          <p className="font-serif mb-10" style={{ color: 'var(--muted)', fontSize: 17 }}>
            Ei spämmiä. Ei ehtoja. Vain Mittarin signaali, kun jotain oikeasti tapahtuu.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder="ETUNIMI@ESIMERKKI.FI"
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
              Tilaa Mittari →
            </button>
          </form>
          <div className="mt-7 flex flex-col items-center gap-1.5">
            <div className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink)', fontWeight: 500 }}>
              ↳ <span style={{ fontWeight: 600 }}>4 283</span> suomalaista saa Mittari-ilmoituksia.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              PÄIVITTÄIN · 1 SÄHKÖPOSTI · 0 SPÄMMIÄ
            </div>
          </div>
        </div>
      </section>

      {/* Fix 3: BIGGEST MOMENTS — data panels */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <div className="eyebrow mb-2">PÄIVÄN HETKIÄ</div>
              <h2 className="display text-2xl sm:text-4xl">Mittari poimi nämä</h2>
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

      {/* CASINO RANKING TEASER */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-10">
            <div>
              <div className="eyebrow mb-2">MITTARI-VERTAILU</div>
              <h2 className="display text-2xl sm:text-4xl">Suomen rehellisin kasinolista</h2>
            </div>
            <Link to="/kasinot" className="btn-ghost hidden sm:inline-flex" data-testid="ranking-teaser-view-all">
              Koko vertailu →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {topOperators.map((op) => (
              <OperatorTeaserCard key={op.slug} operator={op} />
            ))}
          </div>

          <div className="mt-8 sm:hidden">
            <Link to="/kasinot" className="btn-secondary w-full">
              Katso täydellinen vertailu →
            </Link>
          </div>
        </div>
      </section>

      {/* Fix 5 + Fix 6: WEEZY RALLY + TOPI'S WEEKLY CARD upgraded */}
      <section className="py-12 sm:py-20" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* WEEZY RALLY — substantial illustrated card */}
          <Link
            to="/peli"
            className="block relative overflow-hidden panel panel-hover group"
            style={{ minHeight: 360 }}
            data-testid="minigame-teaser"
          >
            {/* Dark forest stage background */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, #0A0A0A 0%, #141414 50%, #1F1F1F 100%)',
              }}
            />
            {/* Subtle headlight beams */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse at 80% 30%, rgba(232,146,74,0.18) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(90,123,184,0.16) 0%, transparent 55%)',
              }}
            />
            {/* Snow flecks */}
            <div className="absolute inset-0 opacity-30" style={{
              background:
                'radial-gradient(circle at 15% 25%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 45% 85%, #F5F3EE 1px, transparent 1.5px), radial-gradient(circle at 85% 15%, #F5F3EE 1px, transparent 1.5px)',
              backgroundSize: '120px 120px, 180px 180px, 220px 220px, 90px 90px',
            }} />

            <div className="relative p-7 sm:p-10 flex flex-col h-full" style={{ minHeight: 360, color: '#F5F3EE' }}>
              <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>
                VIIKON KIERROS · WEEZY RALLY
              </div>
              <h3 className="display text-4xl sm:text-5xl mb-3" style={{ color: '#F5F3EE' }}>500€ Weezybet</h3>
              <div className="mono mb-7" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(245,243,238,0.7)', fontWeight: 500 }}>
                IMATRA · EI TALLETUSTA · EI EHTOJA
              </div>

              <div className="mt-auto">
                <div
                  className="inline-flex items-center gap-3 px-4 py-2.5 mb-6"
                  style={{ background: 'rgba(245,243,238,0.08)', borderRadius: 3, border: '1px solid rgba(245,243,238,0.14)' }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 600 }}>TÄLLÄ VIIKOLLA</div>
                    <div className="mono mt-0.5" style={{ fontSize: 14, letterSpacing: '-0.01em', color: '#F5F3EE', fontWeight: 500 }}>1 247 pelaajaa · paras 2:17.3</div>
                  </div>
                </div>

                <span
                  className="inline-flex items-center justify-center mono"
                  style={{
                    background: '#F5F3EE',
                    color: '#0A0A0A',
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    padding: '14px 22px',
                    borderRadius: 4,
                  }}
                >
                  Pelaa kierros →
                </span>
              </div>
            </div>
          </Link>

          {/* TOPI'S WEEKLY CARD — editorial preview */}
          <Link
            to="/viikon-kortti"
            className="panel panel-hover block p-7 sm:p-10 flex flex-col"
            style={{ minHeight: 360 }}
            data-testid="weeklycard-teaser"
          >
            <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              TOPIN VIIKON KORTTI · VKO 21
            </div>
            <h3 className="display text-2xl sm:text-3xl mb-4 leading-tight" style={{ color: 'var(--ink)' }}>
              Tappara on tulessa, mutta TPS:n maalivahti pelaa 4. peliä peräkkäin. Mittari sanoo: arvoa kotijoukkueessa.
            </h3>
            <div className="mono mb-6" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 500 }}>
              + 4 MUUTA VEIKKAUSTA · 5 FIXTUREA · 5 TAKEA
            </div>

            <div className="mt-auto">
              <div className="flex flex-wrap gap-2 mb-7">
                {['Tappara — TPS', 'Carolina — Florida', 'F1 Monza', 'Liverpool — Arsenal', 'HJK — KuPS'].map((f) => (
                  <span
                    key={f}
                    className="mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      padding: '6px 10px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 3,
                      color: 'var(--ink)',
                      fontWeight: 500,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <span className="btn-ghost group-hover:text-brand-blue">
                <Trophy strokeWidth={1.5} size={14} className="mr-2" />
                Lue koko kortti →
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
