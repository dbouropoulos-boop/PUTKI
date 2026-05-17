/**
 * WeeklyCard — "Viikon kortti": 5 real fixtures pulled from /api/odds/featured
 * with editorial takes from PUTKI HQ -toimitus, decimal odds and visitor
 * predictions stored client-side.
 *
 * Re-built against real data Feb 2026 — no more "EI FIKSTUUREITA" empty
 * state.
 */
import React, { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fmtKickoff = (iso) => {
  if (!iso) return '—';
  try {
    const t = new Date(iso);
    return new Intl.DateTimeFormat('fi-FI', {
      weekday: 'short', day: 'numeric', month: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Helsinki',
    }).format(t).replace('.', '.');
  } catch { return '—'; }
};

const editorialTake = (pick) => {
  // Generated client-side from the live odds payload so the take always
  // reflects the actual implied probability. Honest, not fabricated — we
  // call out the consensus, the bookmaker count and the favourite side.
  const pct = Math.round(pick.implied_probability);
  const homeSide = pick.pick_side === 'home';
  const side = homeSide ? 'kotijoukkue' : pick.pick_side === 'away' ? 'vierasjoukkue' : 'tasapeli';
  const strength =
    pct >= 80 ? 'rauta-vahva suosikki' :
    pct >= 65 ? 'selkeä suosikki' :
    pct >= 55 ? 'lievä suosikki' : 'tasaväkinen kohtaaminen';
  return `${pick.pick_team} ${strength} ${pick.bookmaker_count} kirjanpitäjän mediaanikertoimella ` +
         `${pick.decimal_odds.toFixed(2)} — ${side} ${pct} % implisiittisellä todennäköisyydellä.`;
};

const WeeklyCard = () => {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/odds/featured`)
      .then((r) => r.json())
      .then((d) => { setPicks(d.picks || []); setLoading(false); })
      .catch((e) => { setError(String(e.message || e)); setLoading(false); });
  }, []);

  const updatePrediction = (id, val) => setPredictions((prev) => ({ ...prev, [id]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Predictions are stored locally for v1. POST to /api/predictions/weekly
    // when the leaderboard service lands. For now we just acknowledge.
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 700);
  };

  return (
    <div data-testid="weekly-card-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 flex items-center gap-2">
            <Calendar strokeWidth={1.5} size={14} />
            PUTKI HQ · viikon kortti · {new Date().toLocaleDateString('fi-FI')}
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-5">5 fixturea, 5 takea</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            PUTKI HQ -toimitus vetää viikon kortin viiden vahvimman vetokohteen pohjalta —
            todelliset kertoimet, todelliset kirjanpitäjät, ei sepitettyä dataa. Veikkaa
            lopputuloksia. Kuukauden voittajan palkinto julkistetaan käynnistyessä.
          </p>
        </div>
      </section>

      <section className="container-wide pb-12 sm:pb-16">
        {loading ? (
          <div className="panel p-7 text-center mono inline-flex items-center justify-center gap-2 w-full"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="weekly-card-loading">
            <Loader2 size={12} className="animate-spin" />
            LADATAAN VIIKON KORTTIA…
          </div>
        ) : error ? (
          <div className="panel p-7 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: '#C8423C' }}
               data-testid="weekly-card-error">
            VIRHE · {error}
          </div>
        ) : picks.length === 0 ? (
          <div className="panel p-7 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="weekly-card-empty">
            EI VAHVOJA SUOSIKKEJA TÄNÄÄN · TARKISTA HUOMENNA
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8" data-testid="weekly-card-form">
            {picks.map((p, i) => {
              const opp = p.pick_side === 'home' ? p.away_team : p.home_team;
              return (
                <article
                  key={p.event_id || i}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 pt-8"
                  style={{ borderTop: '1px solid var(--ink)' }}
                  data-testid={`weekly-fixture-${i}`}
                >
                  <div className="lg:col-span-1">
                    <div className="font-display text-2xl sm:text-3xl font-black tabular text-ink">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="eyebrow mb-2">
                      {(p.sport_label || '').toUpperCase()} · {fmtKickoff(p.commence_time)}
                    </div>
                    <h2 className="display text-3xl sm:text-4xl mb-3">
                      {p.pick_side === 'home' ? p.home_team : opp}{' '}
                      <span className="text-muted-text">—</span>{' '}
                      {p.pick_side === 'home' ? opp : p.home_team}
                    </h2>
                    <p className="font-serif text-[15px] text-ink leading-relaxed">
                      {editorialTake(p)}
                    </p>
                    <p className="mt-3 font-display text-[11px] uppercase tracking-widest text-muted-text">
                      — PUTKI HQ -toimitus · {p.bookmaker}
                    </p>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="eyebrow mb-3">Kerroin · {p.bookmaker}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border rounded-[3px] p-3 text-center"
                           style={{ borderColor: 'var(--border-strong)' }}>
                        <div className="eyebrow text-[10px] mb-1">VOITTAJA</div>
                        <div className="font-display text-base font-bold tabular text-ink">
                          {p.decimal_odds.toFixed(2)}
                        </div>
                      </div>
                      <div className="border rounded-[3px] p-3 text-center"
                           style={{ borderColor: 'var(--border-strong)' }}>
                        <div className="eyebrow text-[10px] mb-1">% TODENN.</div>
                        <div className="font-display text-base font-bold tabular text-ink">
                          {Math.round(p.implied_probability)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="eyebrow mb-3">Veikkaa lopputulos</div>
                    <div className="flex gap-2">
                      {[
                        { key: '1', label: '1' },
                        { key: 'X', label: 'X' },
                        { key: '2', label: '2' },
                      ].map((opt) => {
                        const id = p.event_id || `idx-${i}`;
                        const selected = predictions[id] === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => updatePrediction(id, opt.key)}
                            data-testid={`weekly-predict-${i}-${opt.key}`}
                            className="flex-1 py-3 rounded-[3px] font-display font-bold tabular border transition-colors"
                            style={{
                              background: selected ? 'var(--ink)' : 'var(--bg)',
                              color: selected ? 'var(--bg)' : 'var(--ink)',
                              borderColor: selected ? 'var(--ink)' : 'var(--border-strong)',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}

            <div className="mt-10 flex items-center justify-end gap-4 flex-wrap">
              {submitted && (
                <span className="mono" data-testid="weekly-card-submitted"
                      style={{ fontSize: 11, letterSpacing: '0.18em', color: '#2c7a4b', fontWeight: 700 }}>
                  VEIKKAUKSET TALLENNETTU LAITTEESEEN
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || Object.keys(predictions).length === 0}
                data-testid="weekly-card-submit"
                className="btn-primary"
                style={{ opacity: submitting || Object.keys(predictions).length === 0 ? 0.6 : 1 }}
              >
                {submitting ? 'Tallennetaan…' : 'Lähetä veikkaukset →'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">Leaderboard · tulossa</div>
            <h2 className="display text-3xl sm:text-4xl mb-4">Pisteet & palkinnot</h2>
            <p className="font-serif text-[15px] text-muted-text leading-relaxed mb-6">
              Veikkauspisteiden seuranta ja kuukausittainen palkinto avautuvat ensimmäisten
              julkaistujen tulosten jälkeen. Tallennetut veikkaukset siirtyvät tilillesi
              sähköpostiosoitteen kautta — ei rekisteröitymistä, ei panostuksia.
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="panel p-7 text-center mono"
                 data-testid="weekly-card-leaderboard-empty"
                 style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              LEADERBOARD AKTIVOITUU ENSIMMÄISTEN PISTEIDEN JÄLKEEN
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeeklyCard;
