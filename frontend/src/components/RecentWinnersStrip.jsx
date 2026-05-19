/**
 * PUTKI HQ — RecentWinnersStrip.
 *
 * Compact social-proof block. Single-line per winner, monospace meta,
 * collapsed header — reads as a quiet operational receipt, not a
 * trophy case. Renders nothing when there are no paid raffles yet.
 */
import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fmtDate = (iso, lang) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fi-FI', {
      day: '2-digit', month: 'short',
    });
  } catch { return ''; }
};


const RecentWinnersStrip = () => {
  const { lang } = useLang();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/voita/raffles?status=paid&limit=3`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => { if (!stop) setItems(d.items || []); })
      .catch(() => { if (!stop) setItems([]); });
    return () => { stop = true; };
  }, []);

  if (items === null || items.length === 0) return null;

  // Flatten winners across all paid raffles into one tidy list.
  const rows = items.flatMap((r) =>
    (r.winners || [])
      .filter((w) => w.display_label)
      .map((w) => ({
        key: `${r.raffle_slug}-${w.position}`,
        slug: r.raffle_slug,
        match: `${r.home_team} ${r.result_score} ${r.away_team}`,
        league: r.league ? r.league.toUpperCase() : '',
        position: w.position,
        label: w.display_label,
        amount: w.prize_amount_eur,
        type: (w.prize_type || 'cash').toUpperCase(),
        paid_at: r.paid_at,
      })),
  );

  if (rows.length === 0) return null;

  return (
    <section data-testid="voita-recent-winners" style={{
      marginBottom: 18,
      padding: '10px 14px',
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        color: 'var(--muted)', fontFamily: 'ui-monospace, monospace',
        fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 700,
        marginBottom: 8, textTransform: 'uppercase',
      }}>
        <span style={{ color: '#6FA37D' }}>●</span>
        <span>{lang === 'en' ? 'Recently paid' : 'Maksetut viimeksi'}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{rows.length} {lang === 'en' ? 'winners' : 'voittajaa'}</span>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {rows.map((w) => (
          <div key={w.key} data-testid={`voita-winner-${w.key}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 1fr auto auto',
              gap: 10, alignItems: 'baseline',
              padding: '4px 0',
              fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
              borderBottom: '1px dashed var(--hairline)',
            }}>
            <span style={{ color: '#E8C26E', fontWeight: 700 }}>#{w.position}</span>
            <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {w.label} <span style={{ color: 'var(--muted)' }}>· {w.match}</span>
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 700 }}>{fmtDate(w.paid_at, lang)}</span>
            <span style={{ color: 'var(--ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              €{w.amount} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 9.5, letterSpacing: '0.14em' }}>{w.type}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RecentWinnersStrip;
