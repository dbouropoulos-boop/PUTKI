/**
 * MostReadRail — homepage momentum signal.
 *
 * Surfaces the most-read article in the last hour as a single, low-noise
 * rail under the dial. Rotates through the top 5 every ~6s so first-time
 * visitors see real reader momentum without scrolling. Falls back to
 * all-time top reads if recent data is thin (cold start).
 */
import React, { useEffect, useState } from 'react';
import { Flame, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const ROTATE_MS = 6000;
const REFRESH_MS = 60000;

const fmtReads = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return `${n}`;
};

const MostReadRail = () => {
  const { lang, t } = useLang();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/content/most-read?hours=1&limit=5`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancelled && d?.items?.length) setItems(d.items); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setActive((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) return null;
  const current = items[active] || items[0];
  const reads = current.views_window || 0;

  return (
    <section className="container-wide py-4" data-testid="most-read-rail">
      <div className="flex items-stretch gap-3 sm:gap-4 group"
           style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center px-2 sm:px-3 py-3 flex-shrink-0"
             style={{ borderRight: '1px solid var(--border)' }}>
          <div className="mono inline-flex items-center gap-2"
               style={{ fontSize: 10, letterSpacing: '0.24em', color: '#E8924A', fontWeight: 800 }}>
            <Flame strokeWidth={2.0} size={13} />
            {t('most_read.eyebrow').toUpperCase()}
          </div>
        </div>

        <Link
          to={`/uutiset/${current.url_slug}`}
          data-testid={`most-read-link-${active}`}
          className="flex-1 min-w-0 flex items-center gap-3 py-3 px-1 hover:opacity-80 transition-opacity"
          style={{ textDecoration: 'none' }}
        >
          <div className="min-w-0 flex-1 flex items-baseline gap-2 sm:gap-3 flex-wrap">
            <span className="display truncate" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
              {current.headline}
            </span>
            <span className="mono inline-flex items-center gap-1 flex-shrink-0"
                  style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
              {fmtReads(reads)} {(reads === 1 ? t('most_read.read_one') : t('most_read.reads')).toUpperCase()}
            </span>
          </div>
          <ArrowUpRight strokeWidth={1.6} size={16}
                        style={{ color: 'var(--muted)', flexShrink: 0, opacity: 0.55 }}
                        className="group-hover:opacity-100 transition-opacity" />
        </Link>

        <div className="hidden sm:flex items-center px-3 flex-shrink-0"
             style={{ borderLeft: '1px solid var(--border)' }} data-testid="most-read-pager">
          {items.map((_, i) => (
            <span
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: 6, height: 6, borderRadius: 999,
                marginInline: 3,
                background: i === active ? 'var(--ink)' : 'var(--border-strong)',
                opacity: i === active ? 1 : 0.4,
                cursor: 'pointer',
                transition: 'background 250ms ease, opacity 250ms ease',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MostReadRail;
