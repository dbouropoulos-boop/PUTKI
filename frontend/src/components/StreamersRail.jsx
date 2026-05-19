/**
 * PUTKI HQ — StreamersRail (Phase 1 Final · Chunk B refinement v3).
 *
 * Compact tabs + slim rows.
 *
 * Header: three tabs — TWITCH · KICK · YOUTUBE — each with a (n / m) count.
 * Active tab indicated by a colored underline (platform color).
 *
 * Per-row layout (~64px tall):
 *   [96×54 thumbnail] · handle + game · viewer count
 *   Compact, scannable, no oversized hero tiles.
 *
 * Offline streamers in the active platform fold below into a slim toggle,
 * each as a single line (handle + "offline · 2d").
 *
 * Honest empty states for dormant platforms (Kick API 403 · YouTube quiet).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PLATFORMS = ['twitch', 'kick', 'youtube'];
const PLATFORM_META = {
  twitch:  { label: 'TWITCH',  color: '#9146FF', baseUrl: 'https://twitch.tv/' },
  kick:    { label: 'KICK',    color: '#53FC18', baseUrl: 'https://kick.com/' },
  youtube: { label: 'YOUTUBE', color: '#FF0000', baseUrl: 'https://youtube.com/' },
};

const fmtViewers = (n) => {
  if (n == null) return '—';
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const uptime = (startedAt) => {
  if (!startedAt) return '';
  try {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${String(mins % 60).padStart(2, '0')}m`;
  } catch { return ''; }
};

const buildThumb = (url) => {
  if (!url) return null;
  const minute = Math.floor(Date.now() / 60000);
  if (url.includes('{width}') && url.includes('{height}')) {
    return `${url.replace('{width}', '192').replace('{height}', '108')}?t=${minute}`;
  }
  return `${url}${url.includes('?') ? '&' : '?'}t=${minute}`;
};

// ── LIVE row ──────────────────────────────────────────────────────────────
const LiveRow = ({ streamer, platform, justArrived }) => {
  const meta = PLATFORM_META[platform];
  const handle = streamer.user_login || streamer.user_name || streamer.channel || '?';
  const displayName = streamer.user_name || handle;
  const game = streamer.game_name || streamer.category || '';
  const viewers = streamer.viewer_count;
  const thumb = buildThumb(streamer.thumbnail_url);
  const up = uptime(streamer.started_at);
  const href = streamer.profile_url || `${meta.baseUrl}${handle}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="streamer-row"
      data-platform={platform}
      data-live="1"
      style={{
        display: 'grid', gridTemplateColumns: '72px 1fr auto',
        gap: 12, alignItems: 'center',
        padding: '10px 0', borderBottom: '1px solid var(--hairline, #221E1B)',
        textDecoration: 'none', color: 'inherit',
        transition: 'padding-left 160ms ease',
        animation: justArrived ? 'rowArrive 1600ms ease-out 1' : undefined,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.paddingLeft = '4px'; }}
      onMouseLeave={(e) => { e.currentTarget.style.paddingLeft = '0'; }}
    >
      {/* Thumbnail 72×40 (16:9) */}
      <div style={{
        position: 'relative', width: 72, height: 40,
        background: thumb
          ? `#0B0A09 url(${thumb}) center/cover no-repeat`
          : 'linear-gradient(135deg, #1B1816, #0F0D0B)',
        borderLeft: `2px solid ${meta.color}`,
        overflow: 'hidden',
      }}>
        {/* tiny LIVE dot bottom-left */}
        <span aria-hidden style={{
          position: 'absolute', bottom: 3, left: 4,
          width: 5, height: 5, borderRadius: 999,
          background: '#C13B2C',
          boxShadow: justArrived ? '0 0 0 3px rgba(193,59,44,0.35)' : 'none',
        }} />
        {/* uptime micro */}
        {up && (
          <span style={{
            position: 'absolute', top: 2, right: 3,
            background: 'rgba(0,0,0,0.55)',
            color: 'rgba(255,255,255,0.92)',
            fontFamily: 'ui-monospace, monospace', fontSize: 8,
            letterSpacing: '0.06em', padding: '1px 3px',
          }}>{up}</span>
        )}
      </div>

      {/* Handle + game */}
      <div style={{ minWidth: 0 }}>
        <div data-testid="streamer-handle" style={{
          color: 'var(--ink)', fontSize: 13, fontWeight: 600,
          letterSpacing: '-0.01em', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{displayName}</div>
        {game && (
          <div style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.04em', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{game}</div>
        )}
      </div>

      {/* Viewer count */}
      <div style={{ textAlign: 'right' }}>
        <div data-testid="streamer-viewers" style={{
          color: 'var(--ink)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 700, fontSize: 15, lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>{fmtViewers(viewers)}</div>
      </div>
    </a>
  );
};

// ── OFFLINE row ───────────────────────────────────────────────────────────
const OfflineRow = ({ streamer, platform, lang }) => {
  const meta = PLATFORM_META[platform];
  const handle = streamer.user_login || streamer.user_name || streamer.channel || '?';
  const displayName = streamer.user_name || handle;
  const href = streamer.profile_url || `${meta.baseUrl}${handle}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="streamer-offline-row"
      data-platform={platform}
      style={{
        display: 'grid', gridTemplateColumns: '8px 1fr auto',
        gap: 10, alignItems: 'baseline',
        padding: '5px 0', textDecoration: 'none', color: 'inherit',
      }}
    >
      <span style={{
        display: 'inline-block', width: 3, height: 3, borderRadius: 999,
        background: meta.color, opacity: 0.45,
      }} />
      <span style={{
        color: 'var(--ink, #ECE6D8)', fontSize: 11.5, opacity: 0.65,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{displayName}</span>
      <span style={{
        color: 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 9,
        letterSpacing: '0.06em',
      }}>offline</span>
    </a>
  );
};

// ── Tab button ────────────────────────────────────────────────────────────
const Tab = ({ platform, active, liveCount, totalCount, onClick }) => {
  const meta = PLATFORM_META[platform];
  const dim = totalCount === 0;
  return (
    <button
      type="button"
      data-testid={`streamers-tab-${platform}`}
      data-active={active ? '1' : '0'}
      onClick={onClick}
      style={{
        flex: '1 1 0', background: 'transparent',
        border: 0, borderBottom: active ? `2px solid ${meta.color}` : '2px solid transparent',
        padding: '8px 4px 9px', cursor: 'pointer',
        color: active ? '#FFFFFF' : 'var(--muted, #9C9587)',
        opacity: dim && !active ? 0.55 : 1,
        textAlign: 'center',
        transition: 'color 160ms ease, border-color 160ms ease',
      }}
    >
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.20em', fontWeight: 700,
      }}>{meta.label}</div>
      <div style={{
        color: active ? meta.color : 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.08em', marginTop: 3,
      }}>{liveCount} / {totalCount}</div>
    </button>
  );
};

const StreamersRail = () => {
  const { lang } = useLang();
  const [data, setData] = useState({ twitch: [], kick: [], youtube: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('twitch');
  const [showOffline, setShowOffline] = useState(false);
  const [showAllLive, setShowAllLive] = useState(false);
  const prevLiveRef = useRef(new Set());

  // Visible cap so the rail stays balanced with the news column on the left.
  // 6 ≈ matches the height of 2 featured cards + the top of the chrono list.
  const LIVE_VISIBLE_CAP = 6;

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
      } catch { return []; }
    };
    const load = async () => {
      const [t, k, y] = await Promise.all([
        loadOne('twitch'), loadOne('kick'), loadOne('youtube'),
      ]);
      if (cancelled) return;
      setData({ twitch: t, kick: k, youtube: y });
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const isLive = (s) => (s.is_live ?? (s.viewer_count != null && s.viewer_count >= 0 && !!s.thumbnail_url));
  const counts = Object.fromEntries(
    PLATFORMS.map((p) => {
      const arr = data[p] || [];
      return [p, { live: arr.filter(isLive).length, total: arr.length }];
    }),
  );

  const activeList = (data[activeTab] || []);
  const live = activeList.filter(isLive)
    .sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
  const offline = activeList.filter((s) => !isLive(s));

  // arrival tracking
  const liveKey = (s) => `${activeTab}:${s.user_login || s.user_name || s.channel || 'x'}`;
  const currentLiveKeys = new Set(live.map(liveKey));
  const justArrivedSet = new Set();
  if (!loading) {
    currentLiveKeys.forEach((k) => {
      if (!prevLiveRef.current.has(k)) justArrivedSet.add(k);
    });
  }
  useEffect(() => {
    const id = setTimeout(() => { prevLiveRef.current = currentLiveKeys; }, 1800);
    return () => clearTimeout(id);
  });

  // tab-switch effect: reset offline expansion + live expansion
  useEffect(() => {
    setShowOffline(false);
    setShowAllLive(false);
  }, [activeTab]);

  const liveToRender = showAllLive ? live : live.slice(0, LIVE_VISIBLE_CAP);
  const hiddenLiveCount = Math.max(0, live.length - LIVE_VISIBLE_CAP);

  return (
    <aside data-testid="streamers-rail" style={{ paddingTop: 4 }}>
      <style>{`
        @keyframes rowArrive {
          0%   { background-color: rgba(111,163,125,0.0); }
          25%  { background-color: rgba(111,163,125,0.10); }
          100% { background-color: rgba(111,163,125,0); }
        }
      `}</style>

      {/* Header eyebrow */}
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', paddingBottom: 8,
      }}>
        <span
          data-testid="streamers-rail-anchor"
          style={{
            color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
            fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
          }}
        >{lang === 'en' ? 'LIVE · NOW' : 'LIVE · NYT'}</span>
      </div>

      {/* Tabs */}
      <div
        data-testid="streamers-tabs"
        role="tablist"
        style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--hairline, #221E1B)',
          marginBottom: 4,
        }}
      >
        {PLATFORMS.map((p) => (
          <Tab
            key={p}
            platform={p}
            active={activeTab === p}
            liveCount={counts[p].live}
            totalCount={counts[p].total}
            onClick={() => setActiveTab(p)}
          />
        ))}
      </div>

      {/* Body */}
      {loading && (
        <div data-testid="streamers-loading" style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.14em', padding: '14px 0',
        }}>LOADING…</div>
      )}

      {!loading && activeList.length === 0 && (
        <div data-testid={`streamers-empty-${activeTab}`} style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.10em', padding: '14px 0', lineHeight: 1.7,
        }}>{activeTab === 'kick'
          ? 'KICK API DORMANT.\nFollow @putki on Kick to see live tiles here.'
          : activeTab === 'youtube'
            ? (lang === 'en' ? 'NO YOUTUBE STREAMERS YET.\nDirectory expanding.' : 'EI YOUTUBE-STREAMAAJIA VIELÄ.\nLuettelo laajenee.')
            : (lang === 'en' ? 'NO STREAMERS TRACKED HERE.' : 'EI SEURATTUJA STREAMAAJIA.')}</div>
      )}

      {!loading && liveToRender.map((s) => {
        const k = liveKey(s);
        return (
          <LiveRow
            key={k}
            streamer={s}
            platform={activeTab}
            justArrived={justArrivedSet.has(k)}
          />
        );
      })}

      {/* "+N more live" toggle when capped */}
      {!loading && hiddenLiveCount > 0 && (
        <button
          type="button"
          data-testid="streamers-show-more-live"
          onClick={() => setShowAllLive((v) => !v)}
          style={{
            width: '100%', textAlign: 'left',
            background: 'transparent', border: 0, padding: '8px 0',
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
            borderTop: '1px solid var(--hairline, #221E1B)',
            marginTop: 4,
          }}
        >
          {showAllLive
            ? (lang === 'en' ? '▾ SHOW LESS' : '▾ NÄYTÄ VÄHEMMÄN')
            : (lang === 'en' ? `▸ +${hiddenLiveCount} MORE LIVE` : `▸ +${hiddenLiveCount} LISÄÄ LIVENÄ`)}
        </button>
      )}

      {!loading && live.length === 0 && activeList.length > 0 && (
        <div data-testid={`streamers-no-live-${activeTab}`} style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.10em', padding: '14px 0',
        }}>{lang === 'en' ? 'NO ONE LIVE ON THIS PLATFORM RIGHT NOW.' : 'KUKAAN EI OLE LIVENÄ TÄLLÄ ALUSTALLA JUURI NYT.'}</div>
      )}

      {/* Offline toggle */}
      {!loading && offline.length > 0 && (
        <div data-testid="streamers-offline-block" style={{
          marginTop: 10, paddingTop: 8,
          borderTop: '1px solid var(--hairline, #221E1B)',
        }}>
          <button
            type="button"
            data-testid="streamers-offline-toggle"
            onClick={() => setShowOffline((v) => !v)}
            style={{
              width: '100%', textAlign: 'left',
              background: 'transparent', border: 0, padding: '4px 0',
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showOffline
              ? (lang === 'en' ? `▾ HIDE ${offline.length} OFFLINE` : `▾ PIILOTA ${offline.length} OFFLINE`)
              : `▸ ${offline.length} OFFLINE`}
          </button>
          {showOffline && (
            <div style={{ marginTop: 4 }}>
              {offline.map((s) => (
                <OfflineRow
                  key={liveKey(s)}
                  streamer={s}
                  platform={activeTab}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Directory link */}
      <div style={{
        paddingTop: 14, marginTop: 14,
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
          {lang === 'en' ? 'ALL STREAMERS →' : 'KAIKKI STREAMARIT →'}
        </Link>
      </div>
    </aside>
  );
};

export default StreamersRail;
