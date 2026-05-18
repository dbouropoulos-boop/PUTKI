/**
 * WinnersCorner — rotating proof strip of last settled betting hits.
 *
 * Reads /api/winners/recent. Empty state surfaces an honest "Track record
 * begins this week" line so we never fake hits.
 */
import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const ROTATE_MS = 4500;

const WinnersCorner = () => {
  const { lang, t } = useLang();
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/winners/recent?limit=6`)
      .then((r) => r.json())
      .then((d) => { setItems(d.winners || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (!loaded) return null;

  if (!items.length) {
    return (
      <section
        data-testid="winners-corner"
        className="container-wide py-8"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center"
                  style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(232,146,74,0.12)', color: '#E8924A' }}>
              <Trophy strokeWidth={1.7} size={15} />
            </span>
            <div>
              <div className="eyebrow" style={{ color: '#E8924A' }}>{t('winners.eyebrow').toUpperCase()}</div>
              <div className="font-serif" style={{ fontSize: 14, color: 'var(--ink)', marginTop: 4 }}>
                {t('winners.empty')}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const w = items[idx];
  return (
    <section
      data-testid="winners-corner"
      className="container-wide py-8"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-3 flex items-center gap-3">
          <span className="flex items-center justify-center"
                style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(232,146,74,0.12)', color: '#E8924A' }}>
            <Trophy strokeWidth={1.7} size={18} />
          </span>
          <div>
            <div className="eyebrow" style={{ color: '#E8924A' }}>{t('winners.eyebrow').toUpperCase()}</div>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginTop: 2 }}>
              {t('winners.title')}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7" data-testid="winners-corner-row">
          <div className="font-serif" style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.35 }}>
            <strong>{w.pick_team}</strong>{' '}
            <span style={{ color: 'var(--muted)' }}>vs {w.opponent}</span>{' '}
            <span className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: '#2c7a4b', fontWeight: 700, marginLeft: 8 }}>
              @ {Number(w.odds).toFixed(2)} ✓
            </span>
            <span className="mono ml-2" style={{ fontSize: 12, letterSpacing: '0.12em', color: '#E8924A', fontWeight: 700 }}>
              {t('winners.units', { u: Number(w.profit ?? 0).toFixed(2) })}
            </span>
          </div>
          <div className="mono mt-1.5" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            {(w.sport || '').toUpperCase()} · {formatTimeAgo(w.settled_at, lang)}{idx > 0 ? ` · #${idx + 1}/${items.length}` : ''}
          </div>
        </div>

        <div className="lg:col-span-2 text-right">
          <Link
            to="/vihjeet"
            data-testid="winners-corner-link"
            className="mono"
            style={{
              fontSize: 10.5, letterSpacing: '0.22em', fontWeight: 700,
              color: 'var(--ink)', textDecoration: 'none',
            }}
          >
            {t('winners.see_all').toUpperCase()}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default WinnersCorner;
