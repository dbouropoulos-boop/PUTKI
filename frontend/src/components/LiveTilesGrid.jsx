import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass - formerly fake "live tile grid" pulling STREAMERS mock with
// hardcoded viewer counts and live: true flags. Now reads /api/signals/live
// which returns ONLY non-mocked signals from real Twitch/Kick/YouTube pollers.
// While external API keys are unset, the endpoint returns empty and this grid
// renders an honest empty state - no fabrication.

const StreamerLiveTile = ({ sig }) => {
  const slug = (sig.payload?.slug || sig.payload?.login || sig.payload?.channel || '').toLowerCase();
  const name = sig.payload?.display_name || sig.payload?.name || slug || 'Unknown';
  const viewers = sig.payload?.viewer_count ?? sig.payload?.viewers;
  const game = sig.payload?.game_name || sig.payload?.category;
  const platform = (sig.source || '').toUpperCase();
  const platformColor = sig.source === 'kick' ? '#3B7A57' : sig.source === 'youtube' ? '#C8423C' : '#9146FF';
  return (
    <div className="panel panel-hover" style={{ width: 280, padding: 0, overflow: 'hidden' }} data-testid={`live-tile-${slug}`}>
      <div style={{ padding: '14px 16px' }}>
        <div className="mono inline-flex items-center gap-2" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: platformColor, fontWeight: 700 }}>
          <span className="led" style={{ background: platformColor }} /> {platform} · LIVE
        </div>
        <h3 className="font-display mt-2" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{name}</h3>
        {game && <div className="font-serif" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{game}</div>}
        {typeof viewers === 'number' && (
          <div className="mono mt-2" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
            {viewers.toLocaleString('fi-FI').replace(/,/g, ' ')} VIEWERS
          </div>
        )}
      </div>
    </div>
  );
};

export const LiveTilesGrid = () => {
  const { lang } = useLang();
  const [signals, setSignals] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/signals/live?limit=6`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setSignals(d.signals || []); setLoaded(true); } })
        .catch(() => { if (!cancelled) setLoaded(true); });
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)' }} data-testid="live-tiles-section">
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-7">
          <div>
            <div className="eyebrow mb-2 inline-flex items-center gap-2">
              <span className="led" /> {lang === 'en' ? 'LIVE NOW' : 'LIVE NYT'}
            </div>
            <h2 className="display text-2xl sm:text-3xl">
              {lang === 'en' ? 'Live right now' : 'Livenä juuri nyt'} · <span className="mono" style={{ fontWeight: 500 }}>{signals.length}</span>
            </h2>
          </div>
        </div>

        {!loaded ? null : signals.length === 0 ? (
          <div className="panel p-7 text-center" data-testid="live-tiles-empty">
            <Radio strokeWidth={1.4} size={20} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              {lang === 'en'
                ? 'NO REAL-TIME STREAMER DATA YET · TWITCH / KICK / YOUTUBE POLLERS AWAIT API KEYS'
                : 'EI REAALIAIKAISTA STRIIMAAJADATAA · TWITCH / KICK / YOUTUBE -POLLERIT ODOTTAVAT API-AVAIMIA'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
            <div className="grid grid-flow-col auto-cols-max gap-4 pb-2 lg:grid-flow-row lg:grid-cols-3 xl:grid-cols-4 lg:auto-cols-auto">
              {signals.map((s, i) => (
                <StreamerLiveTile key={s.id || i} sig={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveTilesGrid;
