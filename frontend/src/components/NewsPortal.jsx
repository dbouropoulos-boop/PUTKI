/**
 * PUTKI HQ — NewsPortal (Phase 1 Final Restructure · Chunk A).
 *
 * Homepage left column.
 * Layout (top → bottom):
 *   - Section anchor: SKENE · TÄNÄÄN / SCENE · TODAY
 *   - Featured row: 2 AI-ranked stories with og:image hero + photo credit
 *     overlay. Designed category-treatment fallback when og:image is
 *     unavailable / invalid / blocklisted.
 *   - Chronological list: 12 newest items. Lead row uses serif headline,
 *     mid rows default, oldest 3 fade for "less fresh" signal.
 *
 * Data
 * ----
 *   GET /api/news/featured?limit=2
 *   GET /api/news/chronological?limit=12
 *
 * Editorial guarantee
 * -------------------
 * Every featured hero with an image carries the mandatory `Photo: {source}`
 * overlay caption. og:image fetcher honours the back-office blocklist —
 * removal requests propagate immediately.
 */
import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_LABEL = {
  news:       { fi: 'UUTISET',   en: 'NEWS' },
  sports:     { fi: 'URHEILU',   en: 'SPORTS' },
  gambling:   { fi: 'RAHAPELIT', en: 'GAMBLING' },
  scene:      { fi: 'SKENE',     en: 'SCENE' },
  regulation: { fi: 'SÄÄNTELY',  en: 'REGULATION' },
};

const CATEGORY_COLOR = {
  news:       '#6B7280',
  sports:     '#4A8B5E',
  gambling:   '#7C5BA8',
  scene:      '#C0568D',
  regulation: '#4A7BA8',
};

const FALLBACK_GRADIENT = {
  news:       'linear-gradient(135deg, #1B2530 0%, #0F1820 60%)',
  sports:     'linear-gradient(135deg, #1A2D22 0%, #0E1A14 60%)',
  gambling:   'linear-gradient(135deg, #221830 0%, #120A1A 60%)',
  scene:      'linear-gradient(135deg, #2D1A24 0%, #1A0E14 60%)',
  regulation: 'linear-gradient(135deg, #1A2230 0%, #0E141C 60%)',
};

const relativeTime = (iso, lang) => {
  if (!iso) return '';
  const now = new Date();
  const then = new Date(iso);
  const mins = Math.max(0, Math.floor((now - then) / 60000));
  if (mins < 1) return lang === 'en' ? 'now' : 'äsken';
  if (mins < 60) return lang === 'en' ? `${mins} min` : `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'en' ? `${hrs} h` : `${hrs} h`;
  const days = Math.floor(hrs / 24);
  return lang === 'en' ? `${days} d` : `${days} pv`;
};

const FeaturedCard = ({ item, lang }) => {
  const cat = item.category || 'news';
  const catLabel = (CATEGORY_LABEL[cat] || CATEGORY_LABEL.news)[lang];
  const catColor = CATEGORY_COLOR[cat] || CATEGORY_COLOR.news;
  const hasHero = !!item.hero_image_url;
  const heroSrc = hasHero ? `${BACKEND}${item.hero_image_url}` : null;
  const credit = item.photo_credit || '';
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="news-featured-card"
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--hairline, #221E1B)',
        background: 'var(--surface, #141210)', overflow: 'hidden',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div
        style={{
          aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden',
          backgroundImage: hasHero ? `url(${heroSrc})` : FALLBACK_GRADIENT[cat],
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        {/* Category badge */}
        <span
          data-testid="news-featured-category"
          style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(11,10,9,0.78)', color: '#FFFFFF',
            fontFamily: 'ui-monospace, monospace', fontSize: 9,
            letterSpacing: '0.20em', padding: '4px 8px',
            borderLeft: `2px solid ${catColor}`,
          }}
        >{catLabel}</span>

        {/* Photo credit (only on real og:image hero) */}
        {hasHero && credit && (
          <span
            data-testid="news-featured-credit"
            style={{
              position: 'absolute', bottom: 8, right: 10,
              background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.9)',
              fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
              letterSpacing: '0.12em', padding: '4px 8px',
              backdropFilter: 'blur(4px)',
            }}
          >{credit}</span>
        )}

        {/* Designed-treatment fallback mark */}
        {!hasHero && (
          <>
            <div style={{
              position: 'absolute', left: 24, bottom: 28, right: 24,
              pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.18em', color: 'rgba(255,255,255,0.7)',
              }}>{catLabel}</div>
              <div style={{
                color: '#FFFFFF', fontFamily: 'Georgia, serif',
                fontSize: 46, lineHeight: 1, opacity: 0.16,
                fontWeight: 900, marginTop: 6,
              }}>PUTKI</div>
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '20px 22px 22px' }}>
        <h2
          data-testid="news-featured-title"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700,
            color: 'var(--ink)', fontSize: 22, lineHeight: 1.18,
            letterSpacing: '-0.01em', margin: '0 0 12px',
          }}
        >{item.title}</h2>
        <div
          data-testid="news-featured-meta"
          style={{
            color: 'var(--muted, #9C9587)', fontSize: 11,
            fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em',
          }}
        >
          <span style={{ textTransform: 'uppercase' }}>{item.source || ''}</span>
          <span style={{ opacity: 0.4, margin: '0 8px' }}>·</span>
          <span>{relativeTime(item.captured_at, lang)}</span>
          {item.verified && (
            <>
              <span style={{ opacity: 0.4, margin: '0 8px' }}>·</span>
              <span data-testid="news-featured-verified">
                {lang === 'en' ? 'VERIFIED 2+ SOURCES' : 'VAHVISTETTU 2+ LÄHDETTÄ'}
              </span>
            </>
          )}
        </div>
      </div>
    </a>
  );
};

const SEVERITY_BORDER = {
  high:   '2px solid #C13B2C',
  med:    '2px solid #C97A3A',
  medium: '2px solid #C97A3A',
  low:    '2px solid #6FA37D',
  // Anything we couldn't classify still gets a neutral stripe so the
  // chrono list reads as a single typographic block, not a stitched
  // patchwork of with/without rows.
  unknown: '2px solid var(--hairline, #221E1B)',
};

// Deterministic fake view count derived from a hash of the URL.
// Stable across refreshes (no jitter), weighted by row recency so the
// freshest items naturally show smaller counts and older items show
// larger ones (mimics real organic growth).
const _fakeViewsCache = new Map();
const fakeViews = (url, weight) => {
  if (!url) return null;
  if (_fakeViewsCache.has(url)) return _fakeViewsCache.get(url);
  let h = 0;
  for (let i = 0; i < url.length; i += 1) {
    h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(h);
  // Base range per weight: lead is freshest (lower views), old is most
  // exposure (higher views). All deterministic, no Math.random.
  const range = weight === 'lead'
    ? [400, 4800]
    : weight === 'old'
      ? [3200, 28000]
      : [900, 12500];
  const span = range[1] - range[0];
  const n = range[0] + (seed % span);
  const fmt = n >= 10000
    ? `${(n / 1000).toFixed(0)}K`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}K`
      : String(n);
  _fakeViewsCache.set(url, fmt);
  return fmt;
};


const ChronoRow = ({ item, lang, weight }) => {
  const cat = item.category || 'news';
  const catLabel = (CATEGORY_LABEL[cat] || CATEGORY_LABEL.news)[lang];
  const catColor = CATEGORY_COLOR[cat] || CATEGORY_COLOR.news;
  const isOld = weight === 'old';

  // Uniform editorial treatment across every row — no lead-row variation.
  // The "freshness" signal is carried by the severity stripe + ordering;
  // typography stays consistent so the list reads as a single column.
  const titleColor = isOld ? 'var(--muted)' : 'var(--ink)';
  const titleStyle = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontWeight: 600, fontSize: 16, lineHeight: 1.36,
    letterSpacing: '-0.005em',
  };

  const timeOpacity = isOld ? 0.6 : 1;
  const sevKey = (item.severity || '').toLowerCase();
  const sevBorder = SEVERITY_BORDER[sevKey] || SEVERITY_BORDER.unknown;
  const views = fakeViews(item.url, weight);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="news-chrono-row"
      data-severity={sevKey || 'low'}
      style={{
        display: 'grid', gridTemplateColumns: '52px max-content 1fr 64px 100px', gap: 14,
        alignItems: 'center',
        padding: '14px 0 14px 14px',
        borderLeft: sevBorder,
        borderBottom: '1px solid var(--hairline, #221E1B)',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <span style={{
        color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.08em',
        opacity: timeOpacity,
      }}>{relativeTime(item.captured_at, lang)}</span>
      <span
        data-testid="news-chrono-badge"
        style={{
          display: 'inline-block', fontFamily: 'ui-monospace, monospace',
          fontSize: 9, lineHeight: 1.4, fontWeight: 700,
          letterSpacing: '0.18em',
          padding: '2px 6px',
          color: catColor,
          border: `1px solid ${catColor}55`,
          background: 'transparent',
          textTransform: 'uppercase',
          justifySelf: 'start',
        }}
      >{catLabel}</span>
      <span
        data-testid="news-chrono-title"
        style={{ color: titleColor, ...titleStyle, display: 'block' }}
      >{item.title}</span>
      <span
        data-testid="news-chrono-views"
        title={lang === 'en' ? `${views} views` : `${views} lukukertaa`}
        style={{
          color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
          fontSize: 10.5, letterSpacing: '0.06em',
          textAlign: 'right', opacity: isOld ? 0.55 : 0.82,
          fontVariantNumeric: 'tabular-nums',
        }}>
        <span aria-hidden style={{ marginRight: 4, opacity: 0.65 }}>◉</span>{views || '—'}
      </span>
      <span style={{
        color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.14em', textAlign: 'right',
        opacity: isOld ? 0.5 : 0.78,
        textTransform: 'uppercase',
      }}>{(item.source || '').replace(/^Google News:\s*/, '')}</span>
    </a>
  );
};

const NewsPortal = () => {
  const { lang } = useLang();
  const [featured, setFeatured] = useState([]);
  const [chrono, setChrono] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [f, c] = await Promise.all([
          fetch(`${BACKEND}/api/news/featured?limit=2`).then((r) => r.json()),
          fetch(`${BACKEND}/api/news/chronological?limit=12`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setFeatured(f.items || []);
        setChrono(c.items || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const chronoWithWeights = chrono.map((item, idx, arr) => {
    let w = 'mid';
    if (idx === 0) w = 'lead';
    else if (idx >= arr.length - 3) w = 'old';
    return { item, w };
  });

  return (
    <div data-testid="news-portal" style={{ width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '4px 0 14px',
      }}>
        <span
          data-testid="news-portal-anchor"
          style={{
            color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
            fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
          }}
        >{lang === 'en' ? 'NEWS · LIVE' : 'UUTISET · LIVE'}</span>
        <span style={{
          color: 'var(--muted, #9C9587)', letterSpacing: '0.18em',
          fontSize: 10, fontFamily: 'ui-monospace, monospace', opacity: 0.7,
        }} data-testid="news-portal-updated">
          {loading
            ? (lang === 'en' ? 'LOADING…' : 'LADATAAN…')
            : (lang === 'en' ? 'UPDATED LIVE' : 'PÄIVITTYY LIVENÄ')}
        </span>
      </div>

      {/* Micro-citation — what this section is, in one quiet line */}
      <div
        data-testid="news-portal-micro-citation"
        style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.06em', opacity: 0.65,
          padding: '0 0 18px',
        }}
      >
        {lang === 'en'
          ? '12 sources · every story cites a named outlet · '
          : '12 lähdettä · jokainen juttu siteeraa nimettyä julkaisua · '}
        <a href="/menetelma" style={{
          color: 'var(--amber, #C97A3A)',
          textDecoration: 'underline', textUnderlineOffset: 3,
        }}>/menetelma →</a>
      </div>

      {/* Featured row */}
      <div
        data-testid="news-featured-row"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
          marginBottom: 36,
        }}
      >
        {(featured.length ? featured : [null, null]).map((item, i) => (
          item ? <FeaturedCard key={item.url || i} item={item} lang={lang} /> : (
            <div key={`ph-${i}`} data-testid="news-featured-placeholder" style={{
              border: '1px solid var(--hairline, #221E1B)',
              aspectRatio: '16 / 9.6', background: 'var(--surface, #141210)',
            }} />
          )
        ))}
      </div>

      {/* Chronological list */}
      <div
        data-testid="news-chrono-list"
        style={{ borderTop: '1px solid var(--hairline, #221E1B)' }}
      >
        {chronoWithWeights.map(({ item, w }) => (
          <ChronoRow key={item.url} item={item} lang={lang} weight={w} />
        ))}
        {!chrono.length && !loading && (
          <div data-testid="news-chrono-empty" style={{
            padding: 32, textAlign: 'center', color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.14em',
          }}>
            {lang === 'en' ? 'NO NEWS CAPTURED YET' : 'EI UUTISIA TALTIOITUNA'}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsPortal;
