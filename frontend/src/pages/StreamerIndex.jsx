import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StreamerCard from '../components/StreamerCard';
import { STREAMERS } from '../data/mock';

const StreamerIndex = () => {
  const navigate = useNavigate();
  const live = STREAMERS.filter((s) => s.live);
  const offline = STREAMERS.filter((s) => !s.live);

  return (
    <div data-testid="streamer-index">
      <section className="container-wide pt-12 sm:pt-20 pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">Mittari-seuranta · {STREAMERS.length} striimaajaa</div>
          <h1 className="display text-4xl sm:text-6xl mb-5">Suomen seuratut slot-striimaajat</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            Toimituksellinen valinta — ei kaikki, vaan ne, joiden seuraaminen kannattaa. Tier 1 ja Tier 2 -nimet, sekä uusi Kick-aalto. Päivittyy reaaliajassa.
          </p>
        </div>
      </section>

      <section className="border-t border-subtle-border py-10 sm:py-12">
        <div className="container-wide">
          <div className="flex items-baseline gap-3 mb-6">
            <span className="w-2 h-2 rounded-full bg-dial-myrsky animate-live-pulse mt-1"></span>
            <h2 className="display text-2xl sm:text-3xl">Livenä nyt · {live.length}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {live.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-subtle-border py-10 sm:py-12">
        <div className="container-wide">
          <h2 className="display text-2xl sm:text-3xl mb-6">Offline</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {offline.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-subtle-border py-12 sm:py-16 bg-[#F4F2EE]">
        <div className="container-narrow text-center">
          <h2 className="display text-3xl sm:text-4xl mb-4">Saa ilmoitus livenä</h2>
          <p className="font-serif text-muted-text mb-6">Sähköposti, Telegram tai web push. Ilmaista. Ei spämmiä.</p>
          <button onClick={() => navigate('/aloita')} className="btn-primary" data-testid="streamer-index-cta">
            Aloita ilmoitukset →
          </button>
        </div>
      </section>
    </div>
  );
};

export default StreamerIndex;
