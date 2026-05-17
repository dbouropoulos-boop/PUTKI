/**
 * StreamerLiveGrid — Phase 4 Pre-Launch Polish.
 *
 * Renders the top live Finnish Twitch streamers from /api/streamers/live
 * (real Helix data, 60s backend cache). Premium dashboard card layout:
 * thumbnail, LIVE pulse pill, viewer count, game name, follower count,
 * direct twitch.tv link. Honest empty state if no streamers are live.
 *
 * Used on Home as "Mitä tapahtuu nyt".
 */
import React, { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Eye, Users } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;

const fmtNumber = (n) => {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
};

const fmtAgo = (iso) => {
  if (!iso) return '';
  try {
    const t = new Date(iso);
    const mins = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
    if (mins < 60) return `${mins}min livenä`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}min livenä`;
  } catch { return ''; }
};

const StreamerCard = ({ s }) => (
  <a
    href={s.profile_url}
    target="_blank"
    rel="noopener noreferrer"
    data-testid={`streamer-card-${s.user_login}`}
    className="group block panel panel-hover overflow-hidden"
    style={{ textDecoration: 'none', color: 'inherit', borderRadius: 4 }}
  >
    {/* Thumbnail — Twitch returns a 640x360 preview URL */}
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: '16/9', background: '#0A0A0A' }}
    >
      {s.thumbnail_url ? (
        <img
          src={s.thumbnail_url}
          alt={`${s.user_name} · ${s.game_name || ''}`}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ display: 'block' }}
        />
      ) : (
        <div className="w-full h-full grid place-items-center mono"
             style={{ color: 'rgba(245,243,238,0.4)', fontSize: 11, letterSpacing: '0.18em' }}>
          NO PREVIEW
        </div>
      )}
      {/* LIVE pill — top-left */}
      <div
        className="absolute top-2 left-2 mono inline-flex items-center gap-1.5"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.22em',
          fontWeight: 700,
          color: '#fff',
          background: '#C8423C',
          padding: '4px 8px',
          borderRadius: 2,
        }}
      >
        <span
          className="inline-block"
          style={{
            width: 6, height: 6, borderRadius: 999, background: '#fff',
            animation: 'pulse 1.8s ease-in-out infinite',
          }}
        />
        LIVE
      </div>
      {/* Viewer pill — top-right */}
      <div
        className="absolute top-2 right-2 mono inline-flex items-center gap-1.5"
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          fontWeight: 700,
          color: '#fff',
          background: 'rgba(10,10,10,0.78)',
          backdropFilter: 'blur(4px)',
          padding: '4px 8px',
          borderRadius: 2,
        }}
      >
        <Eye strokeWidth={1.8} size={11} />
        {fmtNumber(s.viewer_count)}
      </div>
    </div>

    {/* Body */}
    <div className="p-4 flex flex-col gap-2" style={{ background: 'var(--bg)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
          {s.user_name}
        </div>
        <ExternalLink strokeWidth={1.4} size={13} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 3 }} />
      </div>
      {s.title && (
        <div
          className="font-serif"
          style={{
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={s.title}
        >
          {s.title}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mono pt-1"
           style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
        <span>{(s.game_name || 'JUST CHATTING').toUpperCase()}</span>
        {typeof s.follower_count === 'number' && (
          <span className="inline-flex items-center gap-1">
            <Users strokeWidth={1.7} size={10} />
            {fmtNumber(s.follower_count)}
          </span>
        )}
      </div>
      {s.started_at && (
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', opacity: 0.7 }}>
          {fmtAgo(s.started_at).toUpperCase()}
        </div>
      )}
    </div>
  </a>
);

const StreamerLiveGrid = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/streamers/live`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const streamers = data?.streamers || [];
  const dormant = data?.dormant;

  return (
    <section className="container-wide" data-testid="streamer-live-grid">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="mono mb-1.5" style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 700 }}>
            MITÄ TAPAHTUU NYT · TWITCH SUOMI
          </div>
          <h2 className="display" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            Suorat lähetykset livenä
          </h2>
        </div>
        <div className="mono inline-flex items-center gap-2"
             style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}
             data-testid="streamer-live-status">
          <span
            style={{
              width: 6, height: 6, borderRadius: 999,
              background: streamers.length ? '#2c7a4b' : '#7A7E83',
              boxShadow: streamers.length ? '0 0 6px #2c7a4b' : 'none',
            }}
          />
          {streamers.length ? `${streamers.length} LIVENÄ` : 'EI LIVELÄHETYKSIÄ'}
        </div>
      </div>

      {error ? (
        <div className="mono" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
             data-testid="streamer-live-error">
          VIRHE · {error}
        </div>
      ) : null}

      {dormant ? (
        <div className="panel p-8 text-center mono"
             style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
             data-testid="streamer-live-dormant">
          TWITCH-INTEGRAATIO ODOTTAA KONFIGURAATIOTA · {data?.reason?.toUpperCase()}
        </div>
      ) : streamers.length === 0 && data ? (
        <div className="panel p-8 text-center mono"
             style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
             data-testid="streamer-live-empty">
          KUKAAN SUOMENKIELINEN STRIIMAAJA EI OLE LIVENÄ JUURI NYT
        </div>
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          data-testid="streamer-live-list"
        >
          {streamers.slice(0, 8).map((s) => (
            <StreamerCard key={s.user_login} s={s} />
          ))}
        </div>
      )}
    </section>
  );
};

export default StreamerLiveGrid;
