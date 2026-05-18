/**
 * WeeklyCard — "Viikon kortti": 5 real fixtures from /api/odds/featured.
 * Fully bilingual via t() + formatTime helpers.
 */
import React, { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { formatKickoff, formatShortDate } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const WeeklyCard = () => {
  const { lang, t } = useLang();
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
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 700);
  };

  const editorialTake = (pick) => {
    const pct = Math.round(pick.implied_probability);
    const sideKey =
      pick.pick_side === 'home' ? 'weekly.side_home'
      : pick.pick_side === 'away' ? 'weekly.side_away'
      : 'weekly.side_draw';
    const strengthKey =
      pct >= 80 ? 'weekly.strength_iron'
      : pct >= 65 ? 'weekly.strength_clear'
      : pct >= 55 ? 'weekly.strength_slight'
      : 'weekly.strength_even';
    return t('weekly.take_template', {
      team: pick.pick_team,
      strength: t(strengthKey),
      count: pick.bookmaker_count,
      odds: pick.decimal_odds.toFixed(2),
      side: t(sideKey),
      pct,
    });
  };

  return (
    <div data-testid="weekly-card-page">
      <section className="container-wide pt-12 sm:pt-20 pb-10 sm:pb-12">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 flex items-center gap-2">
            <Calendar strokeWidth={1.5} size={14} />
            {t('weekly.eyebrow_now', { date: formatShortDate(new Date(), lang) }).toUpperCase()}
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-5">{t('weekly.title')}</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            {t('weekly.lede_real')}
          </p>
        </div>
      </section>

      <section className="container-wide pb-12 sm:pb-16">
        {loading ? (
          <div className="panel p-7 text-center mono inline-flex items-center justify-center gap-2 w-full"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="weekly-card-loading">
            <Loader2 size={12} className="animate-spin" />
            {t('weekly.loading').toUpperCase()}
          </div>
        ) : error ? (
          <div className="panel p-7 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: '#C8423C' }}
               data-testid="weekly-card-error">
            {t('weekly.error').toUpperCase()} · {error}
          </div>
        ) : picks.length === 0 ? (
          <div className="panel p-7 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="weekly-card-empty">
            {t('weekly.empty').toUpperCase()}
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
                      {(p.sport_label || '').toUpperCase()} · {formatKickoff(p.commence_time, lang)}
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
                      {t('weekly.byline')} · {p.bookmaker}
                    </p>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="eyebrow mb-3">{t('weekly.odds_label')} · {p.bookmaker}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border rounded-[3px] p-3 text-center"
                           style={{ borderColor: 'var(--border-strong)' }}>
                        <div className="eyebrow text-[10px] mb-1">{t('weekly.winner').toUpperCase()}</div>
                        <div className="font-display text-base font-bold tabular text-ink">
                          {p.decimal_odds.toFixed(2)}
                        </div>
                      </div>
                      <div className="border rounded-[3px] p-3 text-center"
                           style={{ borderColor: 'var(--border-strong)' }}>
                        <div className="eyebrow text-[10px] mb-1">{t('weekly.prob_short')}</div>
                        <div className="font-display text-base font-bold tabular text-ink">
                          {Math.round(p.implied_probability)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <div className="eyebrow mb-3">{t('weekly.pick_outcome')}</div>
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
                  {t('weekly.saved').toUpperCase()}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || Object.keys(predictions).length === 0}
                data-testid="weekly-card-submit"
                className="btn-primary"
                style={{ opacity: submitting || Object.keys(predictions).length === 0 ? 0.6 : 1 }}
              >
                {submitting ? t('weekly.saving') : t('weekly.submit')}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">{t('weekly.leader_coming')}</div>
            <h2 className="display text-3xl sm:text-4xl mb-4">{t('weekly.points_prizes')}</h2>
            <p className="font-serif text-[15px] text-muted-text leading-relaxed mb-6">
              {t('weekly.points_blurb')}
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="panel p-7 text-center mono"
                 data-testid="weekly-card-leaderboard-empty"
                 style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              {t('weekly.leader_empty').toUpperCase()}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeeklyCard;
