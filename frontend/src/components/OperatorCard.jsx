import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const scoreColor = (score) => {
  if (score >= 90) return '#8B1E1A'; // KIIRASTULI
  if (score >= 80) return '#C8423C'; // MYRSKY
  if (score >= 70) return '#E8924A'; // KUUMA
  if (score >= 60) return '#7A7E83'; // HAALEA
  return '#2C5F8D';
};

export const OperatorRow = ({ operator, rank }) => {
  const color = scoreColor(operator.score);
  return (
    <div className="grid grid-cols-12 gap-3 sm:gap-6 py-6 items-center border-t border-subtle-border" data-testid={`operator-row-${operator.slug}`}>
      <div className="col-span-1 font-display font-black text-2xl sm:text-4xl tabular text-ink">
        {String(rank).padStart(2, '0')}
      </div>
      <div className="col-span-7 sm:col-span-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[3px] bg-ink text-paper flex items-center justify-center font-display font-bold text-xl flex-shrink-0">
            {operator.logo}
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-ink truncate">{operator.name}</div>
            <div className="font-serif text-[13px] text-muted-text truncate">{operator.oneLiner}</div>
          </div>
        </div>
      </div>
      <div className="col-span-4 sm:col-span-2 flex flex-col items-end sm:items-start">
        <div className="eyebrow mb-0.5">Mittari</div>
        <div className="flex items-baseline gap-1">
          <span className="font-display font-black text-3xl tabular" style={{ color }}>{operator.score}</span>
          <span className="font-display text-xs text-muted-text">/100</span>
        </div>
      </div>
      <div className="hidden sm:block col-span-2">
        <div className="eyebrow mb-0.5">Tarjous</div>
        <div className="font-display text-[13px] font-semibold text-ink">{operator.offer}</div>
      </div>
      <div className="col-span-12 sm:col-span-2 flex sm:justify-end mt-2 sm:mt-0">
        <Link to={`/kasinot/${operator.slug}`} className="btn-primary w-full sm:w-auto" data-testid={`operator-cta-${operator.slug}`}>
          Arvio <ArrowUpRight strokeWidth={1.8} className="ml-1.5" size={16} />
        </Link>
      </div>
    </div>
  );
};

export const OperatorTeaserCard = ({ operator }) => {
  const color = scoreColor(operator.score);
  return (
    <Link
      to={`/kasinot/${operator.slug}`}
      data-testid={`operator-teaser-${operator.slug}`}
      className="editorial-card editorial-card-hover block p-5 sm:p-6"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-[3px] bg-ink text-paper flex items-center justify-center font-display font-bold text-xl">
          {operator.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-bold tracking-tight text-ink truncate">{operator.name}</div>
          <div className="font-serif text-[12px] text-muted-text">{operator.license} · {operator.payout}</div>
        </div>
        <div className="text-right">
          <div className="font-display font-black text-2xl tabular leading-none" style={{ color }}>{operator.score}</div>
          <div className="font-display text-[10px] uppercase tracking-wider text-muted-text mt-1">Mittari</div>
        </div>
      </div>
      <div className="font-serif text-[14px] text-ink mb-4 line-clamp-2">{operator.oneLiner}</div>
      <div className="flex items-center justify-between pt-4 border-t border-subtle-border">
        <span className="font-display text-[13px] font-semibold text-ink">{operator.offer}</span>
        <span className="font-display text-[13px] font-semibold text-brand-blue">Arvio →</span>
      </div>
    </Link>
  );
};

export { scoreColor };
