import React, { useEffect, useRef, useState } from 'react';
import { Activity, Flame, Trophy, Radio, Bell, Zap } from 'lucide-react';
import { useActivityFeed, useIntlActivityFeed, timeAgo } from '../data/mockStreams';
import { useLang } from '../context/LanguageContext';

const ICON_MAP = {
  live:    Radio,
  win:     Trophy,
  jackpot: Zap,
  score:   Activity,
  heat:    Flame,
  dial:    Bell,
};

const EventRow = ({ ev, lang, fresh }) => {
  const Icon = ICON_MAP[ev.icon] || Activity;
  return (
    <div
      className={`activity-event ${fresh ? 'is-fresh' : ''}`}
      data-testid={`activity-event-${ev.id}`}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'flex-start',
      }}
    >
      <div
        className="led-square"
        style={{
          width: 28, height: 28, flexShrink: 0,
          borderRadius: 4, background: 'var(--bg)',
          border: `1px solid ${ev.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: ev.color, boxShadow: fresh ? `0 0 0 0 ${ev.color}` : 'none',
        }}
      >
        <Icon strokeWidth={1.6} size={14} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="mono" style={{
          fontSize: 9.5, letterSpacing: '0.22em', color: ev.color,
          fontWeight: 700, marginBottom: 3,
        }}>
          {lang === 'en' ? ev.labelEn : ev.labelFi}
        </div>
        <div className="font-serif" style={{
          fontSize: 13.5, lineHeight: 1.35, color: 'var(--ink)', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {lang === 'en' ? ev.primaryEn : ev.primaryFi}
        </div>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)',
          fontWeight: 500, marginTop: 4,
          display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lang === 'en' ? ev.secondaryEn : ev.secondaryFi}
          </span>
          <span>{timeAgo(ev.ts, lang)}</span>
        </div>
      </div>
    </div>
  );
};

// Inline section variant — used on Home between hero & live tiles
export const ActivityFeedInline = () => {
  const { lang } = useLang();
  const [tab, setTab] = useState('suomi'); // 'suomi' | 'intl'
  const fiEvents = useActivityFeed(10);
  const intlEvents = useIntlActivityFeed(9);
  const events = tab === 'intl' ? intlEvents : fiEvents;
  const prevTopId = useRef(events[0]?.id);
  const [freshId, setFreshId] = useState(null);

  useEffect(() => {
    if (events[0]?.id !== prevTopId.current) {
      prevTopId.current = events[0]?.id;
      setFreshId(events[0]?.id);
      const t = setTimeout(() => setFreshId(null), 1800);
      return () => clearTimeout(t);
    }
  }, [events]);

  return (
    <section
      className="py-10 sm:py-12 relative"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      data-testid="activity-feed-section"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
          <div>
            <div className="eyebrow mb-2 inline-flex items-center gap-2">
              <span className="led" style={{ background: '#E8924A' }} />
              {lang === 'en' ? 'LIVE FEED · LAST EVENTS' : 'LIVE-VIRTA · UUSIMMAT'}
            </div>
            <h2 className="display text-2xl sm:text-3xl">
              {lang === 'en' ? 'What\u2019s happening right now' : 'Mitä juuri nyt tapahtuu'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Scene tab toggle (default Suomi) */}
            <div
              className="inline-flex items-stretch rounded-[3px] overflow-hidden"
              style={{ border: '1px solid var(--border-strong)' }}
              data-testid="activity-feed-scene-toggle"
            >
              {[
                { k: 'suomi', fi: 'SUOMI',          en: 'FINNISH' },
                { k: 'intl',  fi: 'KANSAINVÄLINEN', en: 'INTERNATIONAL' },
              ].map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => setTab(opt.k)}
                  data-testid={`activity-feed-tab-${opt.k}`}
                  className="mono"
                  style={{
                    padding: '8px 14px', fontSize: 10.5, letterSpacing: '0.16em', fontWeight: 700,
                    background: tab === opt.k ? 'var(--ink)' : 'transparent',
                    color: tab === opt.k ? 'var(--bg)' : 'var(--muted)',
                    transition: 'background 200ms ease, color 200ms ease',
                  }}
                >
                  {lang === 'en' ? opt.en : opt.fi}
                </button>
              ))}
            </div>
            <div className="mono hidden sm:block" style={{
              fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600,
            }}>
              {lang === 'en' ? 'AUTO-UPDATE · 10 S' : 'PÄIVITTYY · 10 S'}
            </div>
          </div>
        </div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div
          className="overflow-x-auto scrollbar-hide"
          style={{ scrollSnapType: 'x mandatory' }}
          data-testid="activity-feed-scroller"
        >
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
            {events.slice(0, 9).map((ev) => (
              <div
                key={ev.id}
                className={`panel panel-hover relative shrink-0 ${ev.id === freshId ? 'event-fresh' : ''}`}
                style={{
                  width: 280, scrollSnapAlign: 'start',
                  minHeight: 96, padding: 0, overflow: 'hidden',
                }}
              >
                <EventRow ev={ev} lang={lang} fresh={ev.id === freshId} />
                {ev.id === freshId && (
                  <span className="event-fresh-stripe" style={{ background: ev.color }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mono mt-3" style={{
          fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600,
        }}>
          {tab === 'intl'
            ? (lang === 'en'
                ? 'INTERNATIONAL SCENE · DOES NOT FEED THE FINNISH P*RKELE-MITTARI — DIAL STAYS FINNISH-ONLY'
                : 'KANSAINVÄLINEN SKENE · EI SYÖTÄ SUOMEN P*RKELE-MITTARIA — MITTARI PYSYY SUOMI-LÄHTÖISENÄ')
            : (lang === 'en'
                ? 'MOCK FEED · PHASE 2.0 BRIDGE — REAL SIGNALS COMING SOON'
                : 'MOCK-VIRTA · PHASE 2.0 SILTA — OIKEAT SIGNAALIT TULOSSA')}
        </div>
      </div>
    </section>
  );
};

// Optional fixed left-rail variant for inner pages (xl screens only)
export const ActivityFeedRail = () => {
  const { lang } = useLang();
  const events = useActivityFeed(10);
  const prevTopId = useRef(events[0]?.id);
  const [freshId, setFreshId] = useState(null);

  useEffect(() => {
    if (events[0]?.id !== prevTopId.current) {
      prevTopId.current = events[0]?.id;
      setFreshId(events[0]?.id);
      const t = setTimeout(() => setFreshId(null), 1800);
      return () => clearTimeout(t);
    }
  }, [events]);

  return (
    <aside
      className="fixed z-30 hidden xl:block panel"
      style={{
        left: 24, top: 120, width: 280, maxHeight: 'calc(100vh - 160px)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
      data-testid="activity-feed-rail"
    >
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow inline-flex items-center gap-2 mb-1">
          <span className="led" style={{ background: '#E8924A' }} />
          {lang === 'en' ? 'LIVE FEED' : 'LIVE-VIRTA'}
        </div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {lang === 'en' ? 'LAST 10 EVENTS' : 'UUSIMMAT 10'}
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }} className="scrollbar-hide">
        {events.map((ev) => (
          <EventRow key={ev.id} ev={ev} lang={lang} fresh={ev.id === freshId} />
        ))}
      </div>
    </aside>
  );
};

export default ActivityFeedInline;
