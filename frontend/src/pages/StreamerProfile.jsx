import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bell, Mail, MessageCircle } from 'lucide-react';
import Dial from '../components/Dial';
import MomentCard from '../components/MomentCard';
import StreamerCard from '../components/StreamerCard';
import { STREAMERS, MOMENTS, OPERATORS } from '../data/mock';

const SCHEDULE = [
  { day: 'Maanantai',   time: '19:00 – 23:30', games: 'Sweet Bonanza, Gates of Olympus' },
  { day: 'Tiistai',     time: '20:00 – 00:30', games: 'Fire in the Hole 2, San Quentin' },
  { day: 'Keskiviikko', time: '— Off' },
  { day: 'Torstai',     time: '20:00 – 02:00', games: 'Slot-illan suosikit, katsojien valinnat' },
  { day: 'Perjantai',   time: '21:00 – 04:00', games: 'Iso-illan striimi — kaikki pelit' },
  { day: 'Lauantai',    time: '— Off' },
  { day: 'Sunnuntai',   time: '18:00 – 22:00', games: 'Megaways-spesiaali' },
];

const SOCIAL_POSTS = [
  { platform: 'Twitter',   handle: '@', when: '2 t sitten', text: 'Tänään 19:00 livenä. Pragmaticin Sweet Bonanza 1000 ja kaikki uutuudet.' },
  { platform: 'Instagram', handle: '@', when: '8 t sitten', text: 'Eilinen klippi sai 84k katsojaa Twitterissä. Klippi tulee YouTubeen huomenna.' },
  { platform: 'TikTok',    handle: '@', when: 'Eilen',      text: 'AndyPyron Fire in the Hole 2 -reaktio — täysi versio kanavalla.' },
];

const StreamerProfile = () => {
  const { slug } = useParams();
  const streamer = STREAMERS.find((s) => s.slug === slug) || STREAMERS[0];
  const moments = MOMENTS.filter((m) => m.streamer === streamer.name).concat(MOMENTS).slice(0, 4);
  const operators = OPERATORS.slice(0, 4);
  const related = STREAMERS.filter((s) => s.slug !== streamer.slug).slice(0, 5);

  return (
    <div data-testid={`streamer-profile-${streamer.slug}`}>
      {/* HERO */}
      <section className="container-wide pt-10 sm:pt-16 pb-10 sm:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-7">
            <div className="eyebrow mb-3">{streamer.platform.toUpperCase()} · {streamer.followers} seuraajaa</div>
            <h1 className="display text-5xl sm:text-7xl lg:text-8xl mb-6">{streamer.name}</h1>

            {streamer.live ? (
              <div className="flex items-center gap-2 mb-6" data-testid="live-status">
                <span className="w-2.5 h-2.5 rounded-full bg-dial-myrsky animate-live-pulse"></span>
                <span className="font-display text-[13px] font-bold tracking-widest uppercase text-dial-myrsky">LIVE NYT</span>
                <span className="font-serif text-[15px] text-muted-text ml-3">pelaa {streamer.playing} · {streamer.viewers.toLocaleString('fi-FI')} katsojaa</span>
              </div>
            ) : (
              <div className="mb-6 font-display text-[14px] text-muted-text uppercase tracking-wider">
                OFFLINE — Seuraava striimi tänään klo 19:00
              </div>
            )}

            {streamer.sub && <p className="prose-mittari mb-8 max-w-xl">{streamer.sub}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <button className="btn-primary" data-testid="follow-streamer">
                <Bell strokeWidth={1.7} size={16} className="mr-2" />
                Saa ilmoitus kun {streamer.name} menee liveen
              </button>
            </div>

            <div className="mt-5 flex items-center gap-4 text-[12px] font-display text-muted-text">
              <span className="flex items-center gap-1.5"><Mail size={13} strokeWidth={1.5} /> Sähköposti</span>
              <span className="flex items-center gap-1.5"><MessageCircle size={13} strokeWidth={1.5} /> Telegram</span>
              <span>Web push</span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="aspect-square overflow-hidden border border-subtle-border bg-subtle-border">
              <img src={streamer.photo} alt={streamer.name} className="w-full h-full object-cover" />
            </div>
            <div className="mt-6 flex justify-center">
              <Dial size="medium" state={streamer.dial} />
            </div>
            <p className="text-center mt-3 font-display text-[12px] text-muted-text tracking-wide">
              Henkilökohtainen Mittari-tila
            </p>
          </div>
        </div>
      </section>

      {/* LIVE PREVIEW */}
      {streamer.live && (
        <section className="border-y border-subtle-border py-8">
          <div className="container-wide">
            <div className="aspect-video bg-ink relative overflow-hidden rounded-[4px] flex items-center justify-center">
              <img src={streamer.photo} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
              <div className="relative text-center text-paper">
                <span className="w-3 h-3 rounded-full bg-dial-myrsky inline-block animate-live-pulse mr-2"></span>
                <span className="font-display text-sm font-bold tracking-widest uppercase">LIVE — {streamer.viewers.toLocaleString('fi-FI')}</span>
                <div className="mt-3 font-display text-2xl">Katso {streamer.name}n striimi {streamer.platform.toLowerCase()}issä →</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MITTARI COMMENTARY */}
      <section className="container-wide py-12 sm:py-16">
        <div className="container-narrow !px-0">
          <div className="eyebrow mb-3">Mittari {streamer.name}sta</div>
          <h2 className="display text-3xl sm:text-4xl mb-6">Tasaista työtä, ei sirkusta.</h2>
          <div className="prose-mittari">
            <p>
              {streamer.name} ei kuulu siihen joukkoon, joka huutaa kameralle joka spinnillä. Tyyli on tarkasteltu, panostus malttava. Yhteisön sisäpiirissä häntä pidetään yhtenä luotetuimmista lähteistä uusiin Pragmatic-julkaisuihin: kun hän nostaa pelin, kannattaa kuunnella.
            </p>
            <p>
              Mittarin huomio: viime kuukauden striimitiheys on ollut tasainen — viisi sessiota viikossa, kestot kahdesta kuuteen tuntiin. Bonuksen metsästäminen ei näy aikatauluissa, ja se on hyvä asia.
            </p>
          </div>
        </div>
      </section>

      {/* BIGGEST MOMENTS */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Suurimmat hetket</div>
          <h2 className="display text-3xl sm:text-4xl mb-10">{streamer.name}n parhaat klipit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {moments.map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">Aikataulu</div>
            <h2 className="display text-3xl sm:text-4xl mb-4">Viikko {streamer.name}lla</h2>
            <p className="font-serif text-[15px] text-muted-text leading-relaxed">
              Pohjautuu viimeisen kuuden viikon striimihistoriaan. Päivittyy automaattisesti.
            </p>
          </div>
          <div className="lg:col-span-7">
            <table className="w-full">
              <tbody>
                {SCHEDULE.map((row) => (
                  <tr key={row.day} className="border-b border-subtle-border">
                    <td className="py-4 pr-4 font-display text-[14px] font-semibold text-ink w-32">{row.day}</td>
                    <td className="py-4 pr-4 font-display text-[14px] tabular text-ink">{row.time}</td>
                    <td className="py-4 font-serif text-[13px] text-muted-text">{row.games || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* OPERATORS WHERE THEY PLAY */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Missä {streamer.name} pelaa</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">Operaattorit viimeisen 30 päivän aikana</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {operators.map((op) => (
              <Link key={op.slug} to={`/kasinot/${op.slug}`} className="editorial-card editorial-card-hover p-5" data-testid={`streamer-op-${op.slug}`}>
                <div className="w-10 h-10 rounded-[3px] bg-ink text-paper flex items-center justify-center font-display font-bold text-lg mb-3">
                  {op.logo}
                </div>
                <div className="font-display text-base font-bold text-ink">{op.name}</div>
                <div className="font-serif text-[12px] text-muted-text mt-1">{op.offer}</div>
                <div className="font-display text-[12px] text-brand-blue font-semibold mt-3">Arvio →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Sosiaalisesta mediasta</div>
          <h2 className="display text-3xl sm:text-4xl mb-8">{streamer.name} muualla</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOCIAL_POSTS.map((p, i) => (
              <div key={i} className="editorial-card p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="eyebrow">{p.platform}</span>
                  <span className="font-display text-[11px] text-muted-text tabular">{p.when}</span>
                </div>
                <p className="font-serif text-[15px] text-ink leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RELATED */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3">Samankaltaisia</div>
          <h2 className="display text-2xl sm:text-3xl mb-6">Muita seurattavia</h2>
        </div>
        <div className="container-wide overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-2">
            {related.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StreamerProfile;
