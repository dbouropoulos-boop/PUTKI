import React, { useEffect, useRef, useState } from 'react';
import { Eye, Users, Flame, TrendingUp } from 'lucide-react';
import { useLiveCounters } from '../data/mockStreams';
import { useLang } from '../context/LanguageContext';

// Live social proof strip — subscriber count, watcher count, forum heat, weekly delta.
// Each cell flashes briefly when its value ticks.
const Cell = ({ icon: Icon, label, value, sub, color }) => {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div
      className="panel"
      style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
        borderColor: flash ? color : 'var(--border)',
        transition: 'border-color 600ms ease',
        flex: 1, minWidth: 0,
      }}
      data-testid={`social-proof-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 4, flexShrink: 0,
        background: 'var(--bg)', border: `1px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        <Icon strokeWidth={1.6} size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {label}
        </div>
        <div className={`mono ${flash ? 'flash-tick' : ''}`} style={{
          fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
          color: 'var(--ink)', lineHeight: 1.05, marginTop: 2,
        }}>
          {value}
        </div>
        {sub && (
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};

export const SocialProofTicker = () => {
  const { lang } = useLang();
  const { subs, watchers, heat } = useLiveCounters();
  const weekDelta = useRef(Math.round(subs * 0.018));
  // Recompute weekly tick-up sometimes
  useEffect(() => {
    const id = setInterval(() => {
      weekDelta.current = weekDelta.current + (Math.random() > 0.55 ? 1 : 0);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const fmt = (n) => n.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ');

  return (
    <section
      className="py-7 sm:py-8"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      data-testid="social-proof-strip"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-4">
          <div className="eyebrow inline-flex items-center gap-2">
            <span className="led" style={{ background: '#5A7BB8' }} />
            {lang === 'en' ? 'LIVE PULSE · MITTARI COMMUNITY' : 'LIVE-PULSSI · MITTARI-YHTEISÖ'}
          </div>
          <div className="mono hidden sm:block" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en' ? 'TICKING IN REAL TIME' : 'PÄIVITTYY REAALIAJASSA'}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Cell
            icon={Users}
            label={lang === 'en' ? 'SUBSCRIBERS' : 'TILAAJAT'}
            value={fmt(subs)}
            sub={lang === 'en' ? `+${fmt(weekDelta.current)} THIS WEEK` : `+${fmt(weekDelta.current)} TÄLLÄ VIIKOLLA`}
            color="#5A7BB8"
          />
          <Cell
            icon={Eye}
            label={lang === 'en' ? 'DIAL WATCHERS' : 'MITTARIN VAHTIJAT'}
            value={fmt(watchers)}
            sub={lang === 'en' ? 'WATCHING NOW' : 'JUURI NYT'}
            color="#E8924A"
          />
          <Cell
            icon={Flame}
            label={lang === 'en' ? 'FORUM HEAT' : 'FOORUMI-LÄMPÖ'}
            value={`${heat}°`}
            sub={lang === 'en' ? 'YLILAUTA · SUOMI24' : 'YLILAUTA · SUOMI24'}
            color="#C8423C"
          />
          <Cell
            icon={TrendingUp}
            label={lang === 'en' ? 'WEEKLY GROWTH' : 'VIIKKOKASVU'}
            value={`+${(weekDelta.current * 100 / Math.max(subs - weekDelta.current, 1)).toFixed(2)}%`}
            sub={lang === 'en' ? 'VS PREV WEEK' : 'VS EDELLINEN'}
            color="#8B1E1A"
          />
        </div>
      </div>
    </section>
  );
};

export default SocialProofTicker;
