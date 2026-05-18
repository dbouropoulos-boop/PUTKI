/**
 * SocialProofBar — homepage credibility strip directly below the hero.
 *
 * Renders four real-data counters pulled from /api/data/live-stats and
 * /api/signup/count + Vitoset count from /api/odds/featured. All figures
 * are honest (zeros render zeros); no fabrication.
 */
import React, { useEffect, useState } from 'react';
import { Send, FileText, Tv, TrendingUp } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fmt = (n, lang) => {
  if (n == null) return '—';
  const s = Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI');
  return lang === 'en' ? s : s.replace(/,/g, ' ');
};

const SocialProofBar = () => {
  const { lang, t } = useLang();
  const [subs, setSubs]     = useState(null);
  const [stats, setStats]   = useState(null);
  const [picks, setPicks]   = useState(null);
  const [roster, setRoster] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const J = (url) => fetch(url).then((r) => r.ok ? r.json() : null).catch(() => null);
    Promise.all([
      J(`${BACKEND}/api/signup/count`),
      J(`${BACKEND}/api/data/live-stats`),
      J(`${BACKEND}/api/odds/featured`),
      J(`${BACKEND}/api/streamers/roster_summary`),
    ]).then(([sg, st, pk, sm]) => {
      if (cancelled) return;
      setSubs(sg?.count);
      setStats(st);
      setPicks((pk?.picks || []).length);
      setRoster(sm);
    });
    return () => { cancelled = true; };
  }, []);

  const trackedCount = roster?.tracked_total ?? 0;
  const liveCount = roster?.live ?? 0;
  const streamerValue = liveCount > 0
    ? `${trackedCount} · ${liveCount} ${lang === 'en' ? 'live' : 'live'}`
    : `${trackedCount}`;

  const items = [
    { icon: Send,       value: fmt(subs ?? 0, lang),                                label: t('social.subscribers'),       color: '#229ED9' },
    { icon: FileText,   value: fmt(stats?.articles_published_today ?? 0, lang),     label: t('social.articles_today'),    color: '#E8924A' },
    { icon: Tv,         value: streamerValue,                                       label: t('social.streamers_tracked'), color: '#9146FF' },
    { icon: TrendingUp, value: fmt(picks ?? 0, lang),                               label: t('social.picks_live'),        color: '#2c7a4b' },
  ];

  return (
    <section
      data-testid="social-proof-bar"
      className="border-y"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="container-wide py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-2">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div
              key={i}
              data-testid={`social-proof-${i}`}
              className="flex items-center gap-3"
              style={{ minWidth: 0 }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 34, height: 34, borderRadius: 2,
                  background: 'var(--bg)', border: '1px solid var(--border-strong)',
                  color: it.color,
                }}
              >
                <Icon strokeWidth={1.6} size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>
                  {it.value}
                </div>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase' }}>
                  {it.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SocialProofBar;
