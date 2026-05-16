import React from 'react';
import { Link } from 'react-router-dom';

const formatViewers = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return `${n}`;
};

export const StreamerCard = ({ streamer, compact = false }) => {
  const { slug, name, platform, live, viewers, playing, photo } = streamer;
  return (
    <Link
      to={`/striimaajat/${slug}`}
      data-testid={`streamer-card-${slug}`}
      className="editorial-card editorial-card-hover block overflow-hidden flex-shrink-0"
      style={{ width: compact ? 240 : 260 }}
    >
      <div className="relative aspect-[5/4] bg-subtle-border overflow-hidden">
        <img src={photo} alt={name} className="w-full h-full object-cover" />
        {live && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-paper px-2 py-1 rounded-[2px]" data-testid={`live-badge-${slug}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-dial-myrsky animate-live-pulse"></span>
            <span className="font-display text-[10px] font-bold tracking-widest uppercase text-dial-myrsky">LIVE</span>
          </div>
        )}
        <div className="absolute top-3 right-3 bg-paper/90 px-2 py-0.5 rounded-[2px] font-display text-[10px] font-semibold tracking-wider uppercase text-ink">
          {platform}
        </div>
      </div>
      <div className="p-4">
        <div className="font-display text-[17px] font-bold tracking-tight text-ink">{name}</div>
        {live ? (
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <div className="font-serif text-[13px] text-muted-text truncate">{playing}</div>
            <div className="font-display text-[13px] font-semibold tabular text-ink whitespace-nowrap">{formatViewers(viewers)}</div>
          </div>
        ) : (
          <div className="mt-1 font-serif text-[13px] text-muted-text">Offline</div>
        )}
      </div>
    </Link>
  );
};

export default StreamerCard;
