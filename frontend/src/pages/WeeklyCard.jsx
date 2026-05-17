import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

// V2 honesty pass — WeeklyCard renders structure but no fabricated fixtures
// or leaderboard. Real fixtures wire via API-Football / NHL / Ergast / RSS
// in Step 2/Batch 3B once API keys are configured. Real leaderboard pulls
// from the predictions collection when real fixtures exist.
const WEEKLY_FIXTURES = [];
const LEADERBOARD = [];

const PAST_WEEKS = [];

const WeeklyCard = () => {
  const [predictions, setPredictions] = useState({});

  const updatePrediction = (id, val) => {
    setPredictions({ ...predictions, [id]: val });
  };

  return (
    <div data-testid="weekly-card-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 flex items-center gap-2">
            <Calendar strokeWidth={1.5} size={14} />
            Mittarin viikon kortti · Vk 21 · {new Date().toLocaleDateString('fi-FI')}
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-5">5 fixturea, 5 takea</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            Mittarin toimitus vetää viikon kortin. Veikkaa lopputuloksia ja kerää pisteitä — kuukauden voittaja saa 200 € palkinnon. Ei talletusta, ei panostusta.
          </p>
        </div>
      </section>

      <section className="container-wide pb-12 sm:pb-16">
        {WEEKLY_FIXTURES.length === 0 ? (
          <div className="panel p-7 text-center" data-testid="weekly-card-empty">
            <Calendar strokeWidth={1.4} size={20} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              EI FIKSTUUREITA VIELÄ · TOIMITUS LIITTYY API-FOOTBALL / NHL / ERGAST / LIIGA RSS -DATAAN KUN AVAIMET ON KONFIGUROITU
            </div>
          </div>
        ) : (
        <div className="space-y-8">
          {WEEKLY_FIXTURES.map((f, i) => (
            <article key={f.id} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 border-t border-ink pt-8" data-testid={`fixture-${f.id}`}>
              <div className="lg:col-span-1">
                <div className="font-display text-2xl sm:text-3xl font-black tabular text-ink">{String(i + 1).padStart(2, '0')}</div>
              </div>

              <div className="lg:col-span-5">
                <div className="eyebrow mb-2">{f.league} · {f.kickoff}</div>
                <h2 className="display text-3xl sm:text-4xl mb-3">{f.home} <span className="text-muted-text">—</span> {f.away}</h2>
                <p className="font-serif text-[15px] text-ink leading-relaxed">{f.take}</p>
                <p className="mt-3 font-display text-[11px] uppercase tracking-widest text-muted-text">— Mittarin toimitus</p>
              </div>

              <div className="lg:col-span-3">
                <div className="eyebrow mb-3">Kerroin</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-subtle-border rounded-[3px] p-3 text-center">
                    <div className="eyebrow text-[10px] mb-1">1</div>
                    <div className="font-display text-base font-bold tabular text-ink">{f.odds.h}</div>
                  </div>
                  <div className="border border-subtle-border rounded-[3px] p-3 text-center">
                    <div className="eyebrow text-[10px] mb-1">X</div>
                    <div className="font-display text-base font-bold tabular text-ink">{f.odds.x ?? '—'}</div>
                  </div>
                  <div className="border border-subtle-border rounded-[3px] p-3 text-center">
                    <div className="eyebrow text-[10px] mb-1">2</div>
                    <div className="font-display text-base font-bold tabular text-ink">{f.odds.a}</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="eyebrow mb-3">Veikkaa</div>
                <div className="flex gap-2">
                  {['1', 'X', '2'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={p === 'X' && !f.odds.x}
                      onClick={() => updatePrediction(f.id, p)}
                      data-testid={`predict-${f.id}-${p}`}
                      className={`flex-1 py-3 rounded-[3px] font-display font-bold tabular border transition-colors ${
                        predictions[f.id] === p
                          ? 'bg-brand-blue text-paper border-brand-blue'
                          : 'bg-paper text-ink border-subtle-border hover:border-ink'
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        )}

        {WEEKLY_FIXTURES.length > 0 && (
        <div className="mt-12 flex justify-end">
          <button className="btn-primary" data-testid="submit-predictions">
            Lähetä veikkaukset →
          </button>
        </div>
        )}
      </section>

      {/* LEADERBOARD */}
      <section className="border-t border-subtle-border py-12 sm:py-16">
        <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">Tämänkuun johtava</div>
            <h2 className="display text-3xl sm:text-4xl mb-4">Leaderboard</h2>
            <p className="font-serif text-[15px] text-muted-text leading-relaxed mb-6">
              Pisteet kertyvät joka viikko. Kuukauden lopussa kärki voittaa <span className="text-ink font-semibold">200 €</span>. Tasapelin sattuessa nopein voittaa.
            </p>
            <div className="editorial-card p-5">
              <div className="eyebrow mb-2">Palkinnot</div>
              <table className="w-full font-display text-[13px]">
                <tbody>
                  <tr className="border-b border-subtle-border"><td className="py-2 tabular font-semibold w-8">1.</td><td className="py-2 tabular text-ink font-semibold">200 €</td></tr>
                  <tr className="border-b border-subtle-border"><td className="py-2 tabular font-semibold">2.</td><td className="py-2 tabular text-ink font-semibold">100 €</td></tr>
                  <tr><td className="py-2 tabular font-semibold">3.</td><td className="py-2 tabular text-ink font-semibold">50 €</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-7">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink">
                  <th className="text-left py-3 eyebrow w-16">Sija</th>
                  <th className="text-left py-3 eyebrow">Pelaaja</th>
                  <th className="text-right py-3 eyebrow">Oikein</th>
                  <th className="text-right py-3 eyebrow">Pisteet</th>
                </tr>
              </thead>
              <tbody>
                {LEADERBOARD.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }} data-testid="leaderboard-empty">
                    EI VEIKKAUKSIA VIELÄ · TULOSPISTEET KERTYVÄT KUN FIKSTUURIT JULKAISTAAN
                  </td></tr>
                ) : LEADERBOARD.map((p) => (
                  <tr key={p.rank} className="border-b border-subtle-border">
                    <td className="py-4 font-display font-bold tabular text-ink text-xl">{String(p.rank).padStart(2, '0')}</td>
                    <td className="py-4 font-display text-[14px] font-semibold text-ink">{p.name}</td>
                    <td className="py-4 text-right font-display text-[14px] tabular text-muted-text">{p.score}/5</td>
                    <td className="py-4 text-right font-display text-[14px] font-semibold tabular text-ink">{p.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {PAST_WEEKS.length > 0 && (
      <section className="border-t border-subtle-border py-12">
        <div className="container-wide">
          <div className="eyebrow mb-3">Aiempia viikkoja</div>
          <h2 className="display text-2xl sm:text-3xl mb-6">Aikaisemmat kortit</h2>
          <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex gap-3">
              {PAST_WEEKS.map((w) => (
                <div key={w.week} className="editorial-card editorial-card-hover p-5 flex-shrink-0 w-56" data-testid={`past-week-${w.week}`}>
                  <div className="eyebrow mb-2">Viikko {w.week}</div>
                  <div className="font-display text-lg font-bold text-ink mb-1">{w.leader}</div>
                  <div className="font-display text-[13px] tabular text-muted-text">{w.points} pistettä</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
};

export default WeeklyCard;
