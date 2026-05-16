import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Gamepad2 } from 'lucide-react';
import { MINIGAME_LEADERBOARD } from '../data/mock';

const PRIZE_TIERS = [
  { tier: '1', prize: '500 €',  details: 'Weezybet-bonus, kotiutettavissa heti.' },
  { tier: '2', prize: '250 €',  details: 'Weezybet-bonus.' },
  { tier: '3', prize: '100 €',  details: 'Weezybet-bonus.' },
  { tier: '4–5', prize: '50 €', details: 'Ilmaiskierrokset (Sweet Bonanza 1000).' },
  { tier: '6–7', prize: '25 €', details: 'Ilmaiskierrokset.' },
];

const MiniGame = () => {
  return (
    <div data-testid="minigame-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 flex items-center gap-2">
            <Gamepad2 strokeWidth={1.5} size={14} />
            Viikon kierros · Vk 21
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-6">Weezy Rally — Imatran etappi</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            Käy lävitse Imatran karavaanitie. Vältä esteet, kerää pisteitä, päihitä muut suomalaiset. Tämän viikon palkintosumma <span className="text-ink font-semibold tabular">925 €</span>. Pelin sponsoroi Weezybet. Pelaaminen on ilmaista.
          </p>
        </div>
      </section>

      <section className="container-wide pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12">
          {/* GAME EMBED */}
          <div className="lg:col-span-8">
            <div className="aspect-[16/10] bg-ink relative overflow-hidden rounded-[4px] flex items-center justify-center" data-testid="game-embed">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #FBFAF8 0, #FBFAF8 1px, transparent 1px, transparent 30px)' }}></div>
              <div className="relative text-center text-paper">
                <Gamepad2 strokeWidth={1.2} size={64} className="mx-auto mb-6 opacity-80" />
                <div className="font-display text-2xl font-bold tracking-tight mb-2">Peli ladataan...</div>
                <div className="font-serif text-sm text-paper/70 max-w-sm mx-auto">
                  Mini-peli toimii tässä Phase 2:ssa. Tällä hetkellä paikkamerkki — leaderboard alla on aktiivinen.
                </div>
                <button className="btn-primary mt-6 bg-paper text-ink hover:bg-[#F4F2EE]" data-testid="game-start">
                  Aloita kierros (demo) →
                </button>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Palkinto', value: '925 €' },
                { label: 'Pelaajat',  value: '4 280' },
                { label: 'Aikaa jäljellä', value: '2 pv 14 h' },
              ].map((s) => (
                <div key={s.label} className="editorial-card p-4">
                  <div className="eyebrow mb-1">{s.label}</div>
                  <div className="font-display text-xl sm:text-2xl font-bold text-ink tabular">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="editorial-card p-6">
              <div className="eyebrow mb-3">Säännöt</div>
              <ul className="space-y-2 font-serif text-[14px] text-ink">
                <li>· Pelaa kerran päivässä, paras tulos lasketaan.</li>
                <li>· Ei talletusta, ei luottokorttia.</li>
                <li>· Voittajat julkistetaan sunnuntaina.</li>
                <li>· Palkinnot lähetetään Weezybet-tilille.</li>
                <li>· 18+ vain.</li>
              </ul>
            </div>

            <div className="editorial-card p-6">
              <div className="eyebrow mb-3">Palkinnot</div>
              <table className="w-full font-display text-[13px]">
                <tbody>
                  {PRIZE_TIERS.map((p) => (
                    <tr key={p.tier} className="border-b border-subtle-border last:border-0">
                      <td className="py-2.5 pr-2 font-semibold tabular text-ink w-12">{p.tier}.</td>
                      <td className="py-2.5 pr-2 tabular text-ink font-semibold">{p.prize}</td>
                      <td className="py-2.5 text-[12px] text-muted-text">{p.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Link to="/peli/aiemmat" className="btn-ghost text-[13px]" data-testid="past-weeks-link">
              Aiempien viikkojen leaderboard →
            </Link>
          </aside>
        </div>
      </section>

      {/* LEADERBOARD */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <Trophy strokeWidth={1.5} size={14} />
            Top 10 — Vk 21
          </div>
          <h2 className="display text-3xl sm:text-4xl mb-8">Tämän viikon kärki</h2>

          <table className="w-full">
            <thead>
              <tr className="border-b border-ink">
                <th className="text-left py-3 eyebrow w-16">Sija</th>
                <th className="text-left py-3 eyebrow">Pelaaja</th>
                <th className="text-right py-3 eyebrow">Pisteet</th>
                <th className="text-right py-3 eyebrow">Palkinto</th>
              </tr>
            </thead>
            <tbody>
              {MINIGAME_LEADERBOARD.map((p) => (
                <tr key={p.rank} className="border-b border-subtle-border" data-testid={`leaderboard-row-${p.rank}`}>
                  <td className="py-4 font-display font-bold tabular text-ink text-2xl">{String(p.rank).padStart(2, '0')}</td>
                  <td className="py-4 font-display text-[15px] font-semibold text-ink">{p.name}</td>
                  <td className="py-4 text-right font-display text-[15px] font-semibold tabular text-ink">{p.score.toLocaleString('fi-FI')}</td>
                  <td className="py-4 text-right font-display text-[13px] tabular text-muted-text">{p.prize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MiniGame;
