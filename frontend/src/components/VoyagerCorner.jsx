/**
 * VoyagerCorner — Final Architecture Step 5 · top-right hub strip card.
 *
 * Shows this week's Voyager rotation (operator + theme + prize summary)
 * when configured in /back-office/operators → Voyager rotation calendar.
 * Honest empty state when no week is scheduled.
 *
 * Lives top-right above the fold next to the dial cockpit. Reads
 * /api/voyager/current-week. No polling — voyager rotation moves weekly.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, ArrowRight, Calendar } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const VoyagerCorner = () => {
  const { lang } = useLang();
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/voyager/current-week`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;

  const week = data?.week || null;
  const isoWeek = data?.iso_week || '';

  return (
    <div
      className="panel"
      style={{
        padding: '20px 22px',
        minHeight: 200,
        borderLeft: '3px solid #E8924A',
      }}
      data-testid="voyager-corner"
    >
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
          <Gift strokeWidth={1.7} size={12} />
          {lang === 'en' ? 'VOYAGER · THIS WEEK' : 'VOYAGER · TÄMÄ VIIKKO'}
        </div>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {isoWeek}
        </div>
      </div>

      {week ? (
        <>
          <h3 className="font-serif mb-2" style={{ fontSize: 19, lineHeight: 1.2, color: 'var(--ink)' }}
              data-testid="voyager-corner-theme">
            {week.theme_name}
          </h3>
          <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
            {(week.operator_slug || '').toUpperCase()}
          </div>
          <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            {week.prize_summary}
          </p>
          <Link
            to="/voita-palkinto"
            className="mt-4 inline-flex items-center gap-2 mono"
            style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 700 }}
            data-testid="voyager-corner-cta"
          >
            {lang === 'en' ? 'CLAIM →' : 'LUNASTA →'}
            <ArrowRight strokeWidth={1.7} size={13} />
          </Link>
        </>
      ) : (
        <div data-testid="voyager-corner-empty">
          <div className="mono inline-flex items-center gap-2 mb-3"
               style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
            <Calendar strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'NO ROTATION SCHEDULED YET' : 'EI ROTAATIOTA AJASTETTU VIELÄ'}
          </div>
          <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            {lang === 'en'
              ? 'Voyager rotation is configured weekly in the back-office. The current week\u2019s prize will surface here as soon as it\u2019s scheduled.'
              : 'Voyager-rotaatio ajastetaan viikoittain back-officessa. Tämän viikon palkinto näkyy täällä heti kun se on aikataulutettu.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoyagerCorner;
