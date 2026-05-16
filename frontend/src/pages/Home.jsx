import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell } from 'lucide-react';
import Dial from '../components/Dial';
import StreamerCard from '../components/StreamerCard';
import MomentCard from '../components/MomentCard';
import { OperatorTeaserCard } from '../components/OperatorCard';
import { STREAMERS, OPERATORS, MOMENTS, CURRENT_DIAL } from '../data/mock';

const Home = () => {
  const liveStreamers = STREAMERS.filter((s) => s.live);
  const featuredMoment = MOMENTS[0];
  const otherMoments = MOMENTS.slice(1, 5);
  const topOperators = OPERATORS.slice(0, 4);

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="container-wide pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="flex flex-col items-center text-center animate-fade-up">
          <div className="eyebrow mb-6" data-testid="hero-date">{new Date().toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()} · ILTAPÄIVÄ</div>

          <Dial size="large" state={CURRENT_DIAL.key} />

          <h1 className="display text-4xl sm:text-5xl lg:text-6xl max-w-4xl mt-10 sm:mt-12" data-testid="hero-headline">
            {CURRENT_DIAL.headline}
          </h1>
          <p className="mt-6 max-w-2xl font-serif text-lg sm:text-xl text-muted-text leading-relaxed">
            Mittari mittaa Suomen slot-skenen lämpötilaa minuutilleen. Striimit, klipit, foorumit, urheilurytmi — yksi numero.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link to="/kasinot" className="btn-primary" data-testid="hero-cta-primary">
              Pelaa nyt — viikon kuumimmat kasinot
              <ArrowRight strokeWidth={1.8} className="ml-2" size={16} />
            </Link>
            <Link to="/striimaajat" className="btn-secondary" data-testid="hero-cta-secondary">
              Katso ketkä ovat livenä ({liveStreamers.length})
            </Link>
          </div>
        </div>
      </section>

      {/* LIVE NOW STRIP */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-6 sm:mb-8">
            <div>
              <div className="eyebrow mb-1">Livenä juuri nyt</div>
              <h2 className="display text-2xl sm:text-3xl">{liveStreamers.length} striimaajaa, {liveStreamers.reduce((a, s) => a + s.viewers, 0).toLocaleString('fi-FI')} katsojaa</h2>
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

      {/* EMAIL CAPTURE */}
      <section className="border-t border-subtle-border py-12 sm:py-16 bg-paper">
        <div className="container-narrow text-center">
          <Bell strokeWidth={1.4} size={36} className="mx-auto text-brand-blue mb-5" />
          <h2 className="display text-3xl sm:text-4xl mb-3" data-testid="email-capture-headline">
            Saa ilmoitus kun lempi-striimari menee liveen
          </h2>
          <p className="font-serif text-muted-text mb-7 text-[17px]">
            Ei spämmiä. Ei ehtoja. Vain Mittarin signaali, kun jotain oikeasti tapahtuu.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder="etunimi@esimerkki.fi"
              className="flex-1 px-4 py-3.5 rounded-[4px] border border-subtle-border bg-paper font-serif text-[15px] text-ink placeholder:text-muted-text focus:outline-none focus:border-ink"
              data-testid="email-capture-input"
            />
            <button type="submit" className="btn-primary" data-testid="email-capture-submit">
              Tilaa Mittari
            </button>
          </form>
          <div className="mt-6 font-display text-[13px] text-muted-text tabular">
            <strong className="font-semibold text-ink">4 283</strong> suomalaista saa Mittari-ilmoituksia.
          </div>
        </div>
      </section>

      {/* BIGGEST MOMENTS */}
      <section className="border-t border-subtle-border py-12 sm:py-20">
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-8 sm:mb-12">
            <div>
              <div className="eyebrow mb-1">Päivän hetkiä</div>
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
      <section className="border-t border-subtle-border py-12 sm:py-20 bg-[#F4F2EE]">
        <div className="container-wide">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="eyebrow mb-1">Mittari-vertailu</div>
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
            <Link to="/kasinot" className="btn-secondary w-full justify-center">
              Katso täydellinen vertailu →
            </Link>
          </div>
        </div>
      </section>

      {/* MINI GAME + WEEKLY CARD */}
      <section className="border-t border-subtle-border py-12 sm:py-20">
        <div className="container-wide grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <Link to="/peli" className="editorial-card editorial-card-hover p-8 sm:p-10 group" data-testid="minigame-teaser">
            <div className="eyebrow mb-3">Viikon peli</div>
            <h3 className="display text-3xl sm:text-4xl mb-3">Weezy Rally</h3>
            <p className="font-serif text-[15px] text-muted-text mb-6 leading-relaxed">
              Tämän viikon etappi: Imatra. Palkintona <span className="text-ink font-semibold tabular">500€</span> Weezybet-bonus. Ei talletusta, ei ehtoja.
            </p>
            <span className="btn-ghost group-hover:text-brand-blue">Pelaa kierros →</span>
          </Link>

          <Link to="/viikon-kortti" className="editorial-card editorial-card-hover p-8 sm:p-10 group" data-testid="weeklycard-teaser">
            <div className="eyebrow mb-3">Topin viikon kortti — vk 21</div>
            <h3 className="display text-3xl sm:text-4xl mb-3">5 fixturea, 5 takea</h3>
            <p className="font-serif text-[15px] text-muted-text mb-6 leading-relaxed">
              Tappara — TPS, Carolina — Florida, F1 Monza, Liverpool — Arsenal, HJK — KuPS. Veikkaa ja voita kuukausipalkinto.
            </p>
            <span className="btn-ghost group-hover:text-brand-blue">Lue koko kortti →</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
