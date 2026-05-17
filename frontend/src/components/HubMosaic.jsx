/**
 * HubMosaic — Final Architecture Step 5 · Zone 2.
 *
 * 5-card centerpiece mosaic. Cards are PRE-DEFINED categories (not free-form
 * feed items). Each card queries /api/feed with its own source/kind filter
 * and renders up to 3 items inside. Every card has its own honest empty
 * state. Polls every 30 s.
 *
 * Cards (left → right):
 *   1. Streamerit live      — kind=stream_live (twitch + kick rolled up)
 *   2. Urheilu nyt          — source=sports
 *   3. Tuoreet hetket       — kind=moment (YouTube big_wins + similar)
 *   4. Foorumit kuumana     — source=forum
 *   5. Mittari live         — source=editorial (latest editorial drops)
 */
import React, { useEffect, useState } from 'react';
import { Radio, Trophy, Sparkles, MessageSquare, Newspaper, ExternalLink } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_INTERVAL_MS = 30_000;
const ITEMS_PER_CARD = 3;

const CARDS = [
  {
    key: 'streamerit_live',
    query: 'kind=stream_live',
    icon: Radio,
    accent: '#C8423C',
    livePill: true,
    fi: { eyebrow: 'STREAMERIT · LIVE', title: 'Streamerit live', empty: 'EI LIVE-STRIIMEJÄ JUURI NYT · WEBHOOKIT ODOTTAVAT TWITCH / KICK -AVAIMIA' },
    en: { eyebrow: 'STREAMERS · LIVE', title: 'Streamers live now', empty: 'NO LIVE STREAMS RIGHT NOW · WEBHOOKS WAIT FOR TWITCH / KICK KEYS' },
  },
  {
    key: 'urheilu_nyt',
    query: 'source=sports',
    icon: Trophy,
    accent: '#5A7BB8',
    fi: { eyebrow: 'URHEILU · NYT', title: 'Urheilu nyt', empty: 'EI URHEILUTAPAHTUMIA · API-FOOTBALL / LIIGA RSS ODOTTAA AVAIMIA' },
    en: { eyebrow: 'SPORTS · NOW', title: 'Sports now', empty: 'NO SPORTS EVENTS · API-FOOTBALL / LIIGA RSS PENDING KEYS' },
  },
  {
    key: 'tuoreet_hetket',
    query: 'kind=moment',
    icon: Sparkles,
    accent: '#E8924A',
    fi: { eyebrow: 'TUOREET HETKET', title: 'Tuoreet hetket', empty: 'EI HETKIÄ HAVAITTU · YOUTUBE-KLIPPIDETEKTIO ODOTTAA AVAINTA' },
    en: { eyebrow: 'FRESH MOMENTS', title: 'Fresh moments', empty: 'NO MOMENTS DETECTED YET · YOUTUBE CLIP DETECTION PENDING KEY' },
  },
  {
    key: 'foorumit_kuumana',
    query: 'source=forum',
    icon: MessageSquare,
    accent: '#7A7E83',
    fi: { eyebrow: 'FOORUMIT KUUMANA', title: 'Foorumit kuumana', empty: 'FOORUMIT HILJAA · SCRAPER ODOTTAA URL-PISTETTÄ' },
    en: { eyebrow: 'FORUMS HEATING UP', title: 'Forums heating up', empty: 'FORUMS QUIET · SCRAPER ENDPOINT PENDING' },
  },
  {
    key: 'mittari_live',
    query: 'source=editorial',
    icon: Newspaper,
    accent: '#3B5BA5',
    fi: { eyebrow: 'PUTKI HQ · LIVE', title: 'PUTKI HQ live', empty: 'TOIMITUS EI OLE JULKAISSUT VIIMEISTEN TUNTIEN AIKANA' },
    en: { eyebrow: 'PUTKI HQ · LIVE', title: 'PUTKI HQ live', empty: 'EDITORIAL HAS NOT PUBLISHED IN THE LAST FEW HOURS' },
  },
];

const useFeed = (query) => {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/feed?${query}&limit=${ITEMS_PER_CARD}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) { setItems(d.items || []); setLoaded(true); }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [query]);
  return { items, loaded };
};

const MosaicRow = ({ item, accent, showLivePill }) => {
  const isExternal = item.url && /^https?:\/\//.test(item.url);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="mono truncate"
             style={{ fontSize: 9.5, letterSpacing: '0.20em', color: accent, fontWeight: 700 }}>
          {item.eyebrow || item.source.toUpperCase()}
        </div>
        {showLivePill ? (
          <span className="mono inline-flex items-center gap-1.5 shrink-0"
                style={{ fontSize: 9, letterSpacing: '0.22em', color: '#C8423C', fontWeight: 700 }}>
            <span className="led" style={{ background: '#C8423C', width: 6, height: 6 }} />
            LIVE
          </span>
        ) : null}
      </div>
      <div className="font-serif"
           style={{ fontSize: 14, lineHeight: 1.35, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {item.title}
      </div>
      {item.body ? (
        <div className="mono mt-1.5 truncate"
             style={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'var(--muted)', fontWeight: 500 }}>
          {item.body}
        </div>
      ) : null}
    </>
  );
  const rowStyle = {
    display: 'block',
    padding: '11px 12px',
    borderTop: '1px solid var(--border)',
  };
  if (item.url) {
    return (
      <a href={item.url} target={isExternal ? '_blank' : undefined}
         rel={isExternal ? 'noopener noreferrer' : undefined}
         style={rowStyle} data-testid={`mosaic-row-${item.id}`}>
        {body}
      </a>
    );
  }
  return (
    <div style={rowStyle} data-testid={`mosaic-row-${item.id}`}>
      {body}
    </div>
  );
};

const MosaicCategoryCard = ({ card }) => {
  const { lang } = useLang();
  const copy = lang === 'en' ? card.en : card.fi;
  const { items, loaded } = useFeed(card.query);
  const Icon = card.icon;

  return (
    <div className="panel flex flex-col"
         style={{ minHeight: 260, borderTop: `3px solid ${card.accent}` }}
         data-testid={`mosaic-card-${card.key}`}>
      <div className="px-4 pt-4 pb-2">
        <div className="mono inline-flex items-center gap-2 mb-2"
             style={{ fontSize: 9.5, letterSpacing: '0.22em', color: card.accent, fontWeight: 700 }}>
          <Icon strokeWidth={1.7} size={12} />
          {copy.eyebrow}
        </div>
        <h3 className="font-serif" style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.25 }}>
          {copy.title}
        </h3>
      </div>
      <div className="flex-1 flex flex-col" data-testid={`mosaic-card-${card.key}-rows`}>
        {!loaded ? null : items.length === 0 ? (
          <div className="px-4 py-5 flex-1 flex items-center" data-testid={`mosaic-card-${card.key}-empty`}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.55 }}>
              {copy.empty}
            </div>
          </div>
        ) : (
          items.map((it) => (
            <MosaicRow key={it.id} item={it} accent={card.accent} showLivePill={card.livePill} />
          ))
        )}
      </div>
    </div>
  );
};

const HubMosaic = () => {
  const { lang } = useLang();

  return (
    <section
      className="py-10 sm:py-14"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      data-testid="hub-mosaic"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-7 flex-wrap gap-3">
          <div>
            <div className="eyebrow mb-2" data-testid="hub-mosaic-eyebrow">
              {lang === 'en' ? 'HUB · ZONE 2 · LIVE MOSAIC' : 'HUB · ZONE 2 · LIVEMOSAIIKKI'}
            </div>
            <h2 className="display text-2xl sm:text-3xl" data-testid="hub-mosaic-heading">
              {lang === 'en' ? 'What\u2019s live now, in five frames' : 'Mikä on live juuri nyt, viisi ruutua'}
            </h2>
          </div>
          <div className="mono inline-flex items-center gap-2"
               style={{ fontSize: 10, letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 600 }}
               data-testid="hub-mosaic-poll-indicator">
            <span className="led" style={{ background: '#5FC79F' }} />
            {lang === 'en' ? 'POLL · 30 S · REAL SIGNALS ONLY' : 'PÄIVITYS · 30 S · VAIN OIKEAT SIGNAALIT'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4"
             data-testid="hub-mosaic-grid">
          {CARDS.map((card) => (
            <MosaicCategoryCard key={card.key} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HubMosaic;
