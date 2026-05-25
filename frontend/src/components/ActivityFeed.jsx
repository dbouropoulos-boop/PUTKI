import React, { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass - formerly fake "live event" feed manufactured from
// data/mockStreams. Now reads /api/published only. Empty surface when
// the editorial pipeline hasn't published anything yet - no fabrication.

const timeAgo = (iso, lang) => {
  if (!iso) return '-';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return lang === 'en' ? `${diff}s ago` : `${diff}s sitten`;
  if (diff < 3600) return lang === 'en' ? `${Math.floor(diff / 60)}m ago` : `${Math.floor(diff / 60)}min sitten`;
  if (diff < 86400) return lang === 'en' ? `${Math.floor(diff / 3600)}h ago` : `${Math.floor(diff / 3600)}h sitten`;
  return lang === 'en' ? `${Math.floor(diff / 86400)}d ago` : `${Math.floor(diff / 86400)}pv sitten`;
};

const PublishedCard = ({ item, lang }) => {
  const title = item.content_type ? item.content_type.replace(/_/g, ' ').toUpperCase() : '';
  return (
    <div className="panel panel-hover" style={{ width: 280, padding: 0, overflow: 'hidden' }} data-testid={`published-card-${item.id}`}>
      <div style={{ padding: '14px 16px' }}>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
          {title}
        </div>
        <p className="font-serif" style={{ fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink)', marginTop: 8 }}>
          {String(item.text || '').slice(0, 160)}{(item.text || '').length > 160 ? '…' : ''}
        </p>
        <div className="mono mt-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
          {item.surface?.toUpperCase() || ''} · {timeAgo(item.published_at, lang)}
        </div>
      </div>
    </div>
  );
};

export const ActivityFeedInline = () => {
  const { lang } = useLang();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/published?limit=12`);
        const d = await r.json();
        if (!cancelled) { setItems(d.items || []); setLoaded(true); }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <section
      className="py-10 sm:py-12 relative"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      data-testid="published-feed-section"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
          <div>
            <div className="eyebrow mb-2 inline-flex items-center gap-2">
              <span className="led" style={{ background: '#E8924A' }} />
              {lang === 'en' ? 'EDITORIAL FEED · RECENTLY PUBLISHED' : 'TOIMITUKSEN VIRTA · UUSIMMAT JULKAISUT'}
            </div>
            <h2 className="display text-2xl sm:text-3xl">
              {lang === 'en' ? 'What PUTKI HQ has shipped' : 'Mitä PUTKI HQ on julkaissut'}
            </h2>
          </div>
          <div className="mono hidden sm:block" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en' ? 'AUTO-UPDATE · 60 S' : 'PÄIVITTYY · 60 S'}
          </div>
        </div>

        {!loaded ? null : items.length === 0 ? (
          <div className="panel p-7 text-center" data-testid="published-feed-empty">
            <Newspaper strokeWidth={1.4} size={20} style={{ color: 'var(--muted)', margin: '0 auto 10px' }} />
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
              {lang === 'en'
                ? 'NO PUBLISHED ITEMS YET · EDITORIAL PIPELINE IS WIRED BUT WAITING FOR FOUNDATIONAL RESEARCH'
                : 'EI JULKAISUJA VIELÄ · TOIMITUKSEN PUTKI ON KYTKETTY, ODOTTAA POHJATUTKIMUKSEN AINEISTOA'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }} data-testid="published-feed-scroller">
            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
              {items.slice(0, 9).map((item) => (
                <PublishedCard key={item.id} item={item} lang={lang} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// Optional rail variant for inner pages - same data, slimmer layout
export const ActivityFeedRail = () => {
  const { lang } = useLang();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/published?limit=10`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems(d.items || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <aside
      className="fixed z-30 hidden xl:block panel"
      style={{ left: 24, top: 120, width: 280, maxHeight: 'calc(100vh - 160px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      data-testid="published-feed-rail"
    >
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow inline-flex items-center gap-2 mb-1">
          <span className="led" style={{ background: '#E8924A' }} />
          {lang === 'en' ? 'EDITORIAL FEED' : 'TOIMITUKSEN VIRTA'}
        </div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {lang === 'en' ? 'LATEST PUBLISHED' : 'UUSIMMAT JULKAISUT'}
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }} className="scrollbar-hide">
        {items.length === 0 ? (
          <div style={{ padding: 14 }} className="mono" data-testid="published-feed-rail-empty">
            <span style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
              {lang === 'en' ? 'EMPTY' : 'TYHJÄ'}
            </span>
          </div>
        ) : items.map((item) => (
          <PublishedCard key={item.id} item={item} lang={lang} />
        ))}
      </div>
    </aside>
  );
};

export default ActivityFeedInline;
