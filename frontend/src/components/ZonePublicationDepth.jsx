/**
 * ZonePublicationDepth — Final Architecture Step 5 · Zone 3.
 *
 * Eight archive entry points to Mittari's publication depth, in the exact
 * pillar order specified by editorial:
 *   1. /kasinot         · Kasinot (operator archive)
 *   2. /striimaajat     · Striimaajat (streamer archive)
 *   3. /profiilit       · Profiilit (lifestyle / culture profiles)
 *   4. /skene           · Skene (scene news)
 *   5. /saantely        · Sääntely (regulatory)
 *   6. /sponsoroinnit   · Sponsoroinnit (sponsor watch)
 *   7. /raha            · Raha (money commentary)
 *   8. /pelit           · Pelit (game literacy)
 *
 * Each card carries bait copy — not a generic label — to surface what's
 * actually in that archive without lying about volume.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Tv, UserSquare2, Users, Scale, Megaphone, Coins, Dice5, ArrowUpRight,
} from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const PILLARS = [
  {
    slug: 'kasinot',
    to: '/kasinot',
    icon: Building2,
    fi: { eyebrow: 'KASINOT', title: 'Kasinot · vertailu', body: 'Toimituksen näkemys jokaiselle operaattorille — rating, plussat, miinukset, sisäpiiriarvio.' },
    en: { eyebrow: 'CASINOS', title: 'Casinos · comparison', body: 'Editorial verdict on every operator — rating, pros, cons, insider read.' },
  },
  {
    slug: 'striimaajat',
    to: '/striimaajat',
    icon: Tv,
    fi: { eyebrow: 'STRIIMAAJAT', title: 'Striimaajat · arkisto', body: 'Suomalainen striimiskene profiileina — kuka pelaa missä, milloin ja kenen rahalla.' },
    en: { eyebrow: 'STREAMERS', title: 'Streamers · archive', body: 'Finland\u2019s stream scene as profiles — who plays where, when, on whose dime.' },
  },
  {
    slug: 'profiilit',
    to: '/profiilit',
    icon: UserSquare2,
    fi: { eyebrow: 'PROFIILIT', title: 'Profiilit', body: 'Lifestyle-pelaajien tarinat — ihmiset numeroiden takana, kahden viikon välein.' },
    en: { eyebrow: 'PROFILES', title: 'Profiles', body: 'Lifestyle-gambler stories — the people behind the numbers, biweekly.' },
  },
  {
    slug: 'skene',
    to: '/skene',
    icon: Users,
    fi: { eyebrow: 'SKENE', title: 'Skene · viikoittain', body: 'Kanavasiirrot, uudet kasvot ja skenen liikkeet — tiivis raportti maanantaisin, keskiviikkoisin, perjantaisin.' },
    en: { eyebrow: 'SCENE', title: 'Scene · weekly', body: 'Channel moves, fresh faces, scene shifts — tight reports Mon · Wed · Fri.' },
  },
  {
    slug: 'saantely',
    to: '/saantely',
    icon: Scale,
    fi: { eyebrow: 'SÄÄNTELY', title: 'Sääntely · 2027 lisenssi', body: 'Suomen rahapelilain käännöskohdat, kommentaarit ja seuraukset — maanantain päivitys.' },
    en: { eyebrow: 'REGULATORY', title: 'Regulation · 2027 licence', body: 'Finland\u2019s gambling law turning points and their fallout — Monday update.' },
  },
  {
    slug: 'sponsoroinnit',
    to: '/sponsoroinnit',
    icon: Megaphone,
    fi: { eyebrow: 'SPONSORIVALVONTA', title: 'Sponsoroinnit', body: 'Kuka maksaa kelle ja mistä — operaattori-striimari-akselin valvonta keskiviikkoisin.' },
    en: { eyebrow: 'SPONSOR WATCH', title: 'Sponsorships', body: 'Who pays whom for what — operator-streamer axis watch, Wednesdays.' },
  },
  {
    slug: 'raha',
    to: '/raha',
    icon: Coins,
    fi: { eyebrow: 'RAHA', title: 'Raha · kommentaarit', body: 'Voitot, tappiot ja matematiikan tylyt totuudet — tiistain kolumni.' },
    en: { eyebrow: 'MONEY', title: 'Money · commentary', body: 'Wins, losses, the cold truth of the math — Tuesday column.' },
  },
  {
    slug: 'pelit',
    to: '/pelit',
    icon: Dice5,
    fi: { eyebrow: 'PELILUKUTAITO', title: 'Pelit', body: 'Slotit · ruletti · blackjack · poker · craps · live · bonusmatematiikka — laudalle ennen pöytään.' },
    en: { eyebrow: 'GAME LITERACY', title: 'Games', body: 'Slots · roulette · blackjack · poker · craps · live · bonus math — on the board before at the table.' },
  },
];

const ZonePublicationDepth = () => {
  const { lang } = useLang();
  return (
    <section
      className="py-12 sm:py-16"
      style={{ borderTop: '1px solid var(--border)' }}
      data-testid="zone-publication-depth"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="eyebrow mb-2" data-testid="zone-depth-eyebrow">
              {lang === 'en' ? 'HUB · ZONE 3 · PUBLICATION DEPTH' : 'HUB · ZONE 3 · JULKAISUN SYVYYS'}
            </div>
            <h2 className="display text-2xl sm:text-3xl" data-testid="zone-depth-heading">
              {lang === 'en' ? 'Eight ways into Mittari\u2019s archive' : 'Kahdeksan reittiä Mittarin arkistoon'}
            </h2>
            <p className="font-serif mt-3 max-w-2xl" style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.55 }}>
              {lang === 'en'
                ? 'Mittari is not a live ticker pretending to be a paper. It is a paper that happens to know what is live. Start anywhere.'
                : 'Mittari ei ole livetikkeri joka teeskentelee lehteä. Se on lehti joka sattuu tietämään mikä on live. Aloita mistä haluat.'}
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          data-testid="zone-depth-grid"
        >
          {PILLARS.map((p) => {
            const Icon = p.icon;
            const copy = lang === 'en' ? p.en : p.fi;
            return (
              <Link
                key={p.slug}
                to={p.to}
                className="panel panel-hover block group"
                style={{ padding: '20px 22px', minHeight: 180 }}
                data-testid={`zone-depth-card-${p.slug}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="mono inline-flex items-center gap-2"
                       style={{ fontSize: 10, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
                    <Icon strokeWidth={1.6} size={13} />
                    {copy.eyebrow}
                  </div>
                  <ArrowUpRight
                    strokeWidth={1.5}
                    size={16}
                    style={{ color: 'var(--muted)', transition: 'transform 0.2s ease' }}
                    className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>
                <h3 className="font-serif text-lg mb-2" style={{ color: 'var(--ink)', lineHeight: 1.25 }}>
                  {copy.title}
                </h3>
                <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {copy.body}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ZonePublicationDepth;
