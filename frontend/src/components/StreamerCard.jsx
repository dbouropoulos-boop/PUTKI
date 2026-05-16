import React from 'react';
import { Link } from 'react-router-dom';

const formatViewers = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return `${n}`;
};

export const StreamerCard = ({ streamer }) => {
  const { slug, name, platform, live, viewers, playing, photo } = streamer;
  return (
    <Link
      to={`/striimaajat/${slug}`}
      data-testid={`streamer-card-${slug}`}
      className="panel panel-hover block overflow-hidden flex-shrink-0"
      style={{ width: 260 }}
    >
      <div className="relative aspect-[5/4] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <img src={photo} alt={name} className="w-full h-full object-cover" />
        {live && (
          <div
            className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded-[2px]"
            style={{ background: 'rgba(10,10,10,0.85)' }}
            data-testid={`live-badge-${slug}`}
          >
            <span className="led"></span>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 700, color: '#F5F3EE' }}>LIVE</span>
          </div>
        )}
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-[2px] mono"
          style={{ background: 'rgba(10,10,10,0.85)', color: '#F5F3EE', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 600 }}
        >
          {platform.toUpperCase()}
        </div>
      </div>
      <div className="p-4">
        <div className="font-display font-bold tracking-tight" style={{ color: 'var(--ink)', fontSize: 17 }}>{name}</div>
        {live ? (
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div className="font-serif text-[13px] truncate" style={{ color: 'var(--muted)' }}>{playing}</div>
            <div className="mono whitespace-nowrap" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{formatViewers(viewers)}</div>
          </div>
        ) : (
          <div className="mt-1.5 mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500 }}>OFFLINE</div>
        )}
      </div>
    </Link>
  );
};

export default StreamerCard;
