/**
 * PUTKI HQ — StreamersRail (Phase 1 Final Restructure · Chunk A).
 *
 * Homepage right column. Platform-aware streamer rail.
 *
 * Groups streamers under three clearly-marked platform headers:
 *   - TWITCH (purple chip)
 *   - KICK (green chip)
 *   - YOUTUBE (red chip)
 *
 * Each avatar carries a tiny platform dot in its corner. Live streamers
 * get a green ring; offline ones are dimmed. No constant pulse animation —
 * a one-time `arrivePulse` plays only when a streamer transitions from
 * offline → live within the current session.
 *
 * Data
 * ----
 *   GET /api/streamers/live              (platform=twitch)
 *   GET /api/streamers/live?platform=kick
 *   GET /api/streamers/live?platform=youtube
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PLATFORM_META = {
  twitch:  { label: 'TWITCH',  chipBg: '#9146FF', chipColor: '#FFFFFF', chipMark: 'tw', avatarDot: '#9146FF' },
  kick:    { label: 'KICK',    chipBg: '#53FC18', chipColor: '#0B0A09', chipMark: 'k',  avatarDot: '#53FC18' },
  youtube: { label: 'YOUTUBE', chipBg: '#FF0000', chipColor: '#FFFFFF', chipMark: '▶',  avatarDot: '#FF0000' },
};

const initials = (name) => (name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??';

const fmtViewers = (n) => {
  if (!n && n !== 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const uptime = (startedAt, lang) => {
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

const StreamerRow = ({ streamer, platform, justArrived }) => {
  const meta = PLATFORM_META[platform];
  const live = !!streamer.is_live;
  const handle = streamer.user_login || streamer.user_name || streamer.handle || streamer.channel || '?';
  const game = streamer.game_name || streamer.category || streamer.title || '';
  const viewers = streamer.viewer_count;
  const up = uptime(streamer.started_at, 'fi');

  const ring = live
    ? `0 0 0 1.5px #6FA37D`
    : '0 0 0 1.5px transparent';

  return (
    <div
      data-testid="streamer-row"
      data-platform={platform}
      data-live={live ? '1' : '0'}
      style={{
        display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10,
        padding: '7px 0', alignItems: 'center',
        transition: 'padding 160ms ease',
      }}
    >
      <div style={{ position: 'relative', width: 32, height: 32 }}>
        <div
          data-testid="streamer-avatar"
          style={{
            width: 32, height: 32, borderRadius: 999,
            background: streamer.profile_image_url ? `url(${streamer.profile_image_url}) center/cover` : '#2A2622',
            color: 'var(--ink, #ECE6D8)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: ring,
            transition: 'box-shadow 200ms ease, transform 200ms ease',
            opacity: live ? 1 : 0.6,
            animation: justArrived ? 'arrivePulse 1400ms ease-out 1' : undefined,
          }}
        >
          {!streamer.profile_image_url && initials(handle)}
        </div>
        {/* Platform chip */}
        <span style={{
          position: 'absolute', bottom: -2, right: -3,
          width: 12, height: 12, borderRadius: 999,
          background: meta.avatarDot, color: meta.chipColor,
          fontFamily: 'ui-monospace, monospace', fontSize: 7, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--bg, #0B0A09)',
        }} aria-hidden>
          {platform === 'twitch' ? 't' : platform === 'kick' ? 'k' : 'y'}
        </span>
      </div>
      <div>
        <div
          data-testid="streamer-handle"
          style={{
            color: '#FFFFFF', fontSize: 13, fontWeight: 600,
            letterSpacing: '-0.01em', lineHeight: 1.2,
            opacity: live ? 1 : 0.78,
          }}
        >{handle}</div>
        <div style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.04em', marginTop: 2, opacity: 0.85,
        }}>
          {live ? (
            <>
              {fmtViewers(viewers)}
              {game && <><span style={{ opacity: 0.6, margin: '0 6px' }}>·</span>{game}</>}
              {up && <><span style={{ opacity: 0.6, margin: '0 6px' }}>·</span>{up}</>}
            </>
          ) : (
            <>offline</>
          )}
        </div>
      </div>
    </div>
  );
};

const PlatformGroup = ({ platform, streamers, prevLiveSet }) => {
  const meta = PLATFORM_META[platform];
  const live = streamers.filter((s) => s.is_live);
  const offline = streamers.filter((s) => !s.is_live).slice(0, 2);
  const ordered = [...live, ...offline];

  return (
    <div data-testid={`platform-group-${platform}`} style={{ padding: '14px 0 6px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8,
      }}>
        <span style={{
          width: 14, height: 14, borderRadius: 3,
          background: meta.chipBg, color: meta.chipColor,
          fontFamily: 'ui-monospace, monospace', fontSize: 9, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }} aria-hidden>{meta.chipMark}</span>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', fontWeight: 700,
        }}>{meta.label}</span>
        <span style={{
          color: 'var(--ink-faint, #5E5A52)', marginLeft: 'auto',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.10em',
        }} data-testid={`platform-counts-${platform}`}>
          {live.length} LIVE
          {streamers.length - live.length > 0 ? ` · ${streamers.length - live.length} OFFLINE` : ''}
        </span>
      </div>
      {ordered.map((s) => {
        const key = (s.user_login || s.user_id || s.handle || s.channel || 'x') + ':' + platform;
        const justArrived = s.is_live && !prevLiveSet.has(key);
        return (
          <StreamerRow
            key={key}
            streamer={s}
            platform={platform}
            justArrived={justArrived}
          />
        );
      })}
      {!streamers.length && (
        <div style={{
          color: 'var(--ink-faint, #5E5A52)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.10em', padding: '6px 0',
        }} data-testid={`platform-empty-${platform}`}>
          {/* honest empty state — API dormant */}
          {meta.label === 'KICK' ? 'API DORMANT' : 'NO STREAMERS'}
        </div>
      )}
    </div>
  );
};

const StreamersRail = () => {
  const { lang } = useLang();
  const [twitch, setTwitch] = useState([]);
  const [kick, setKick] = useState([]);
  const [youtube, setYoutube] = useState([]);
  const [loading, setLoading] = useState(true);
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
      // build new live-set, detect arrivals
      const newLiveSet = new Set();
      [['twitch', t], ['kick', k], ['youtube', y]].forEach(([p, arr]) => {
        arr.forEach((s) => {
          if (s.is_live) {
            const key = (s.user_login || s.user_id || s.handle || s.channel || 'x') + ':' + p;
            newLiveSet.add(key);
          }
        });
      });
      // update state but read prev BEFORE replacing
      // setStreamers uses prev for the just-arrived flag on first render
      setTwitch(t);
      setKick(k);
      setYoutube(y);
      // delay the prev ref update to allow row to render with justArrived flag
      setTimeout(() => { prevLiveRef.current = newLiveSet; }, 1500);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const totalLive = [twitch, kick, youtube].reduce(
    (acc, arr) => acc + arr.filter((s) => s.is_live).length, 0,
  );
  const totalTracked = twitch.length + kick.length + youtube.length;

  return (
    <aside data-testid="streamers-rail" style={{ paddingTop: 4 }}>
      <style>{`
        @keyframes arrivePulse {
          0%   { box-shadow: 0 0 0 1.5px #6FA37D, 0 0 0 0 rgba(111,163,125,0.45); }
          60%  { box-shadow: 0 0 0 1.5px #6FA37D, 0 0 0 10px rgba(111,163,125,0); }
          100% { box-shadow: 0 0 0 1.5px #6FA37D, 0 0 0 0 rgba(111,163,125,0); }
        }
      `}</style>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingBottom: 12, borderBottom: '1px solid var(--hairline, #221E1B)',
        marginBottom: 10,
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
        }}>
          {loading ? '…' : `${totalLive} / ${totalTracked}`}
        </span>
      </div>

      <PlatformGroup platform="twitch" streamers={twitch} prevLiveSet={prevLiveRef.current} />
      <PlatformGroup platform="kick"    streamers={kick}    prevLiveSet={prevLiveRef.current} />
      <PlatformGroup platform="youtube" streamers={youtube} prevLiveSet={prevLiveRef.current} />

      <div style={{
        paddingTop: 14, borderTop: '1px solid var(--hairline, #221E1B)',
        marginTop: 10,
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
          {lang === 'en' ? `ALL ${totalTracked || ''} STREAMERS →` : `KAIKKI ${totalTracked || ''} STREAMARIA →`}
        </Link>
      </div>
    </aside>
  );
};

export default StreamersRail;
