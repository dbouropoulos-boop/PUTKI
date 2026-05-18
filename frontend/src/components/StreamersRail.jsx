/**
 * PUTKI HQ — StreamersRail (Phase 1 Final · Chunk B refinement).
 *
 * Editorial tile redesign — no more circular avatars.
 *
 * LIVE tiles
 * ----------
 *   Real Twitch stream thumbnail (16:9, full rail width) with platform
 *   hairline on the left edge, viewer count as a stat, game name as a
 *   mono eyebrow, uptime overlaid bottom-right of the thumbnail.
 *   Sorted by viewer_count descending across all platforms.
 *
 * OFFLINE
 * -------
 *   Collapsed below the live tiles into a single "N offline" toggle.
 *   Each row is a slim handle + "offline · 2d" line, no avatar circles.
 *
 * Honest empty states
 * -------------------
 *   When a platform has no data (Kick API dormant, YouTube quiet) we
 *   render a single-line note instead of pretending. No fake streamers.
 *
 * Data
 * ----
 *   GET /api/streamers/live              (twitch default)
 *   GET /api/streamers/live?platform=kick
 *   GET /api/streamers/live?platform=youtube
 *
 *   Each item: {user_login, user_name, title, viewer_count, game_name,
 *               thumbnail_url, profile_url, started_at, follower_count}
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_META = {
  twitch:  { label: 'TWITCH',  color: '#9146FF', baseUrl: 'https://twitch.tv/' },
  kick:    { label: 'KICK',    color: '#53FC18', baseUrl: 'https://kick.com/' },
  youtube: { label: 'YOUTUBE', color: '#FF0000', baseUrl: 'https://youtube.com/' },
};

const initials = (name) =>
  (name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??';

const fmtViewers = (n) => {
  if (n == null) return '—';
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const uptime = (startedAt) => {
  if (!startedAt) return '';
  try {
    const start = new Date(startedAt);
    const mins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${String(rem).padStart(2, '0')}m`;
  } catch {
    return '';
  }
};

const offlineSince = (lastSeenIso, lang) => {
  if (!lastSeenIso) return lang === 'en' ? 'offline' : 'offline';
  try {
    const t = new Date(lastSeenIso);
    const hrs = Math.floor((Date.now() - t.getTime()) / 3600000);
    if (hrs < 24) return `offline · ${hrs}h`;
    return `offline · ${Math.floor(hrs / 24)}d`;
  } catch {
    return 'offline';
  }
};

const buildThumb = (url, login) => {
  if (!url) return null;
  // Twitch template substitution + cache-bust per minute so a paused
  // stream's thumbnail doesn't go stale for the user's session.
  const minute = Math.floor(Date.now() / 60000);
  if (url.includes('{width}') && url.includes('{height}')) {
    return `${url.replace('{width}', '480').replace('{height}', '270')}?t=${minute}`;
  }
  return `${url}${url.includes('?') ? '&' : '?'}t=${minute}`;
};

// ── LIVE tile ─────────────────────────────────────────────────────────────
const LiveTile = ({ streamer, platform, justArrived }) => {
  const meta = PLATFORM_META[platform];
  const handle = streamer.user_login || streamer.user_name || streamer.channel || '?';
  const displayName = streamer.user_name || handle;
  const game = streamer.game_name || streamer.category || '';
  const viewers = streamer.viewer_count;
  const thumb = buildThumb(streamer.thumbnail_url, handle);
  const up = uptime(streamer.started_at);
  const href = streamer.profile_url || `${meta.baseUrl}${handle}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="streamer-tile"
      data-platform={platform}
      data-live="1"
      style={{
        display: 'block', position: 'relative',
        background: 'var(--surface, #141210)',
        border: '1px solid var(--hairline, #221E1B)',
        borderLeft: `2px solid ${meta.color}`,
        textDecoration: 'none', color: 'inherit',
        overflow: 'hidden',
        transition: 'transform 200ms ease, border-color 200ms ease',
        animation: justArrived ? 'tileArrive 1800ms ease-out 1' : undefined,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Thumbnail */}
      <div style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        background: thumb
          ? `#0B0A09 url(${thumb}) center/cover no-repeat`
          : `linear-gradient(135deg, #1B1816, #0F0D0B)`,
        overflow: 'hidden',
      }}>
        {/* Bottom gradient for legibility */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.85) 100%)',
          pointerEvents: 'none',
        }} />
        {/* LIVE dot (top-left, on thumb) */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(11,10,9,0.75)', padding: '3px 7px',
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: '#C13B2C',
            animation: justArrived ? 'liveDotPulse 1800ms ease-out 1' : undefined,
          }} />
          <span style={{
            color: '#FFFFFF',
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.20em', fontWeight: 700,
          }}>LIVE</span>
        </div>
        {/* Platform mark — top-right */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(11,10,9,0.75)', padding: '3px 7px',
          color: meta.color,
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.18em', fontWeight: 700,
          backdropFilter: 'blur(4px)',
        }}>{meta.label}</div>
        {/* Uptime — bottom-right */}
        {up && (
          <div style={{
            position: 'absolute', bottom: 8, right: 10,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.10em',
          }}>{up}</div>
        )}
        {/* Game name — bottom-left */}
        {game && (
          <div style={{
            position: 'absolute', bottom: 8, left: 10,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            maxWidth: '60%', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{game}</div>
        )}
      </div>

      {/* Below-thumb metadata */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto',
        alignItems: 'baseline', gap: 10,
        padding: '12px 14px 13px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div data-testid="streamer-handle" style={{
            color: '#FFFFFF', fontSize: 15, fontWeight: 700,
            letterSpacing: '-0.01em', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{displayName}</div>
          {streamer.follower_count > 0 && (
            <div style={{
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.06em', marginTop: 2,
            }}>{fmtViewers(streamer.follower_count)} {streamer.follower_count === 1 ? 'follower' : 'followers'}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div data-testid="streamer-viewers" style={{
            color: '#FFFFFF',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700, fontSize: 22, lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>{fmtViewers(viewers)}</div>
          <div style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 9,
            letterSpacing: '0.18em', marginTop: 3,
          }}>{(viewers || 0) === 1 ? 'VIEWER' : 'VIEWERS'}</div>
        </div>
      </div>
    </a>
  );
};

// ── OFFLINE row (slim) ────────────────────────────────────────────────────
const OfflineRow = ({ streamer, platform, lang }) => {
  const meta = PLATFORM_META[platform];
  const handle = streamer.user_login || streamer.user_name || streamer.channel || '?';
  const displayName = streamer.user_name || handle;
  const since = offlineSince(streamer.last_seen_at || streamer.last_offline_at, lang);
  const href = streamer.profile_url || `${meta.baseUrl}${handle}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="streamer-offline-row"
      data-platform={platform}
      style={{
        display: 'grid', gridTemplateColumns: '10px 1fr auto',
        alignItems: 'baseline', gap: 10,
        padding: '7px 12px', borderTop: '1px solid var(--hairline, #221E1B)',
        textDecoration: 'none', color: 'inherit',
        transition: 'background 160ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        display: 'inline-block', width: 4, height: 4, borderRadius: 999,
        background: meta.color, opacity: 0.5,
      }} />
      <span style={{
        color: 'var(--ink, #ECE6D8)', fontSize: 12.5,
        letterSpacing: '-0.005em', lineHeight: 1.3,
        opacity: 0.72, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{displayName}</span>
      <span style={{
        color: 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.08em',
      }}>{since}</span>
    </a>
  );
};

const StreamersRail = () => {
  const { lang } = useLang();
  const [twitch, setTwitch] = useState([]);
  const [kick, setKick] = useState([]);
  const [youtube, setYoutube] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOffline, setShowOffline] = useState(false);
  const prevLiveRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    const loadOne = async (platform) => {
      try {
        const url = platform === 'twitch'
          ? `${BACKEND}/api/streamers/live`
          : `${BACKEND}/api/streamers/live?platform=${platform}`;
        const r = await fetch(url);
        if (!r.ok) return [];
        const d = await r.json();
        return d.streamers || d.items || [];
      } catch {
        return [];
      }
    };
    const load = async () => {
      const [t, k, y] = await Promise.all([
        loadOne('twitch'), loadOne('kick'), loadOne('youtube'),
      ]);
      if (cancelled) return;
      setTwitch(t); setKick(k); setYoutube(y);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Cross-platform sort
  const tag = (arr, platform) => arr.map((s) => ({ ...s, _platform: platform }));
  const all = [...tag(twitch, 'twitch'), ...tag(kick, 'kick'), ...tag(youtube, 'youtube')];
  // Live = items with thumbnail or viewer_count > 0 or explicit is_live flag
  const isLive = (s) => (s.is_live ?? (s.viewer_count != null && s.viewer_count >= 0 && !!s.thumbnail_url));
  const live = all.filter(isLive)
    .sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
  const offline = all.filter((s) => !isLive(s));

  // Build the just-arrived set: anyone in `live` whose key was NOT in prev
  const liveKey = (s) => `${s._platform}:${s.user_login || s.user_name || s.channel || 'x'}`;
  const currentLiveKeys = new Set(live.map(liveKey));
  const justArrivedSet = new Set();
  if (!loading && prevLiveRef.current.size > 0) {
    currentLiveKeys.forEach((k) => {
      if (!prevLiveRef.current.has(k)) justArrivedSet.add(k);
    });
  }
  // Defer ref update so first paint shows pulse, subsequent paints don't
  useEffect(() => {
    const t = setTimeout(() => {
      prevLiveRef.current = currentLiveKeys;
    }, 2000);
    return () => clearTimeout(t);
  });

  return (
    <aside data-testid="streamers-rail" style={{ paddingTop: 4 }}>
      <style>{`
        @keyframes tileArrive {
          0%   { box-shadow: 0 0 0 0 rgba(111,163,125,0.0); }
          25%  { box-shadow: 0 0 0 2px rgba(111,163,125,0.45), 0 0 0 6px rgba(111,163,125,0.15); }
          100% { box-shadow: 0 0 0 0 rgba(111,163,125,0); }
        }
        @keyframes liveDotPulse {
          0%   { box-shadow: 0 0 0 0 rgba(193,59,44,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(193,59,44,0); }
          100% { box-shadow: 0 0 0 0 rgba(193,59,44,0); }
        }
      `}</style>

      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingBottom: 12, borderBottom: '1px solid var(--hairline, #221E1B)',
        marginBottom: 14,
      }}>
        <span
          data-testid="streamers-rail-anchor"
          style={{
            color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
            fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
          }}
        >{lang === 'en' ? 'LIVE · NOW' : 'LIVE · NYT'}</span>
        <span data-testid="streamers-rail-counts" style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.14em',
        }}>{loading ? '…' : `${live.length} / ${all.length}`}</span>
      </div>

      {/* LIVE TILES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div data-testid="streamers-loading" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.14em', padding: 14,
          }}>LOADING…</div>
        )}
        {!loading && live.length === 0 && (
          <div data-testid="streamers-no-live" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.10em', padding: '14px 4px',
            lineHeight: 1.6,
          }}>{lang === 'en'
            ? 'NO ONE LIVE RIGHT NOW.\nCheck back at evening peak.'
            : 'KUKAAN EI OLE LIVENÄ JUURI NYT.\nKurkkaa ilta-aikaan.'}</div>
        )}
        {live.map((s) => {
          const k = liveKey(s);
          return (
            <LiveTile
              key={k}
              streamer={s}
              platform={s._platform}
              justArrived={justArrivedSet.has(k)}
            />
          );
        })}
      </div>

      {/* OFFLINE TOGGLE */}
      {!loading && offline.length > 0 && (
        <div data-testid="streamers-offline-block" style={{
          marginTop: 18, borderTop: '1px solid var(--hairline, #221E1B)',
          paddingTop: 10,
        }}>
          <button
            type="button"
            data-testid="streamers-offline-toggle"
            onClick={() => setShowOffline((v) => !v)}
            style={{
              width: '100%', textAlign: 'left',
              background: 'transparent', border: 0, padding: '6px 0',
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showOffline
              ? (lang === 'en' ? `▾ HIDE ${offline.length} OFFLINE` : `▾ PIILOTA ${offline.length} OFFLINE`)
              : (lang === 'en' ? `▸ ${offline.length} OFFLINE` : `▸ ${offline.length} OFFLINE`)}
          </button>
          {showOffline && (
            <div style={{ marginTop: 4 }}>
              {offline.map((s) => (
                <OfflineRow
                  key={liveKey(s)}
                  streamer={s}
                  platform={s._platform}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIRECTORY LINK */}
      <div style={{
        paddingTop: 16, marginTop: 16,
        borderTop: '1px solid var(--hairline, #221E1B)',
      }}>
        <Link
          to="/striimaajat"
          data-testid="streamers-rail-see-all"
          style={{
            color: 'var(--ink, #ECE6D8)', textDecoration: 'underline',
            textUnderlineOffset: 4, fontFamily: 'ui-monospace, monospace',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          }}
        >
          {lang === 'en'
            ? `ALL ${all.length || ''} STREAMERS →`
            : `KAIKKI ${all.length || ''} STREAMARIA →`}
        </Link>
      </div>
    </aside>
  );
};

export default StreamersRail;
