import React from 'react';
import { Link } from 'react-router-dom';

export const MomentCard = ({ moment, featured = false }) => {
  return (
    <article
      className="editorial-card editorial-card-hover overflow-hidden flex flex-col"
      data-testid={`moment-card-${moment.id}`}
    >
      <div className="relative aspect-[16/9] bg-subtle-border overflow-hidden">
        <img src={moment.thumb} alt={moment.headline} className="w-full h-full object-cover" />
        <div className="absolute top-3 left-3 bg-paper px-2.5 py-1 rounded-[2px] font-display text-[10px] font-bold tracking-widest uppercase text-ink">
          {moment.streamer}
        </div>
        <div className="absolute bottom-3 right-3 bg-ink text-paper px-3 py-1 rounded-[2px] font-display text-sm font-bold tabular tracking-tight">
          {moment.win}
        </div>
      </div>
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <div className="eyebrow mb-2">{moment.game}</div>
        <h3 className={`font-display font-bold tracking-tight text-ink mb-3 ${featured ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
          {moment.headline}
        </h3>
        <p className="font-serif text-[15px] leading-relaxed text-ink mb-5 flex-1">
          {moment.body}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-subtle-border">
          <span className="font-display text-[12px] text-muted-text">{moment.source}</span>
          <Link
            to={`/kasinot/${moment.operator}`}
            className="font-display text-[13px] font-semibold text-brand-blue hover:text-ink"
            data-testid={`moment-operator-link-${moment.id}`}
          >
            {moment.operatorName} →
          </Link>
        </div>
      </div>
    </article>
  );
};

export default MomentCard;
