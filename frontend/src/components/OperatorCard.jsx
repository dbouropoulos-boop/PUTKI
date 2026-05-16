import React from 'react';
import { Link } from 'react-router-dom';
import CountUp from './CountUp';

// Tier-colored score per dial-state thresholds (Fix 4)
const scoreColor = (score) => {
  if (score >= 90) return '#8B1E1A'; // KIIRASTULI red-orange
  if (score >= 80) return '#C8423C'; // MYRSKY red
  if (score >= 70) return '#E8924A'; // KUUMA amber
  if (score >= 60) return '#7A7E83'; // HAALEA gray
  return '#2C5F8D';
};

const scoreState = (score) => {
  if (score >= 90) return 'KIIRASTULI';
  if (score >= 80) return 'MYRSKY';
  if (score >= 70) return 'KUUMA';
  if (score >= 60) return 'HAALEA';
  return 'KYLMA';
};

// Instrument-readout score block — large mono, "MITTARI" label, count-up animation
export const ScoreReadout = ({ score, size = 'md' }) => {
  const color = scoreColor(score);
  const state = scoreState(score);
  const sizes = {
    sm: { num: 28, label: 9, state: 9 },
    md: { num: 44, label: 9.5, state: 9.5 },
    lg: { num: 88, label: 11, state: 11 },
  };
  const s = sizes[size];
  return (
    <div className="flex flex-col items-end">
      <div className="mono" style={{ fontSize: s.label, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
        MITTARI
      </div>
      <div className="mono" style={{ fontSize: s.num, fontWeight: 500, letterSpacing: '-0.04em', color, lineHeight: 1 }} data-testid={`score-${score}`}>
        <CountUp to={score} duration={1100} format={(n) => Math.round(n).toString()} />
      </div>
      <div className="mono" style={{ fontSize: s.state, letterSpacing: '0.16em', color, fontWeight: 600, marginTop: 4 }}>
        {state}
      </div>
    </div>
  );
};

export const OperatorRow = ({ operator, rank }) => {
  return (
    <div
      className="grid grid-cols-12 gap-3 sm:gap-6 py-7 items-center"
      style={{ borderTop: '1px solid var(--border)' }}
      data-testid={`operator-row-${operator.slug}`}
    >
      <div className="col-span-1 mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)' }}>
        {String(rank).padStart(2, '0')}
      </div>
      <div className="col-span-7 sm:col-span-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-[3px] flex items-center justify-center font-display font-bold text-xl flex-shrink-0"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            {operator.logo}
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold tracking-tight truncate" style={{ color: 'var(--ink)' }}>{operator.name}</div>
            <div className="font-serif text-[13px] truncate" style={{ color: 'var(--muted)' }}>{operator.oneLiner}</div>
          </div>
        </div>
      </div>
      <div className="col-span-4 sm:col-span-2 flex flex-col items-end sm:items-start">
        <ScoreReadout score={operator.score} size="md" />
      </div>
      <div className="hidden sm:block col-span-2">
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>TARJOUS</div>
        <div className="mono mt-1" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{operator.offer}</div>
      </div>
      <div className="col-span-12 sm:col-span-2 flex sm:justify-end mt-2 sm:mt-0">
        <Link to={`/kasinot/${operator.slug}`} className="btn-primary w-full sm:w-auto" data-testid={`operator-cta-${operator.slug}`}>
          Arvio →
        </Link>
      </div>
    </div>
  );
};

export const OperatorTeaserCard = ({ operator }) => {
  return (
    <Link
      to={`/kasinot/${operator.slug}`}
      data-testid={`operator-teaser-${operator.slug}`}
      className="panel panel-hover block p-6"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-[3px] flex items-center justify-center font-display font-bold text-lg"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            {operator.logo}
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold tracking-tight truncate" style={{ color: 'var(--ink)' }}>{operator.name}</div>
            <div className="mono mt-0.5" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500 }}>
              {operator.license.toUpperCase()} · {operator.payout.toUpperCase()}
            </div>
          </div>
        </div>
        <ScoreReadout score={operator.score} size="sm" />
      </div>
      <div className="font-serif text-[14px] mb-5 line-clamp-2" style={{ color: 'var(--ink)' }}>{operator.oneLiner}</div>
      <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink)', fontWeight: 600 }}>{operator.offer}</span>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--brand-blue)', fontWeight: 600 }}>ARVIO →</span>
      </div>
    </Link>
  );
};

export { scoreColor, scoreState };
