/**
 * PUTKI HQ — StreamersBand (Phase 1 sprint follow-up).
 *
 * Full-width horizontal band that replaces the right-sidebar StreamersRail.
 * Editorial register: 16:9 stream thumbnails dominate, metadata restrained,
 * no platform-branding chrome on the cards themselves (tabs handle that).
 *
 * Behaviour
 * ---------
 *   - Tabs row (TWITCH · KICK · YOUTUBE) with platform-colored underline
 *   - 4–6 cards visible by default; "+N more live →" expansion when more
 *   - Mobile (≤768px): horizontal-scroll strip, cards keep size
 *   - Hover-affordance shows editorial context line (FI/EN) when present
 *   - Change indicator on viewer count when ≥1h of 24h-snapshot data exists
 *     for that streamer; suppressed otherwise (never fakes direction)
 *
 * `onSlotFilter` external callback — when the now-playing ticker is filtered
 * to a slot, the band filters to only the streamers playing that slot.
 */
import React, { useEffect, useState, useMemo } from 'react';
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
    return `${url.replace('{width}', '560').replace('{height}', '315')}?t=${minute}`;
  }
  return `${url}${url.includes('?') ? '&' : '?'}t=${minute}`;
};

// ── Card ───────────────────────────────────────────────────────────────
const StreamerCard = ({ streamer, platform, lang, viewerDelta }) => {
  const meta = PLATFORM_META[platform];
  const handle = streamer.user_login || streamer.user_name || streamer.channel || '?';
  const displayName = streamer.user_name || handle;
  const game = streamer.game_name || streamer.category || '';
  const viewers = streamer.viewer_count;
  const thumb = buildThumb(streamer.thumbnail_url);
  const up = uptime(streamer.started_at);
  const href = streamer.profile_url || `${meta.baseUrl}${handle}`;
  const editorialLine = lang === 'en' ? streamer.meta_en : streamer.meta_fi;

  const arrow = viewerDelta == null
    ? null
    : (viewerDelta.delta > 0 ? '▲' : (viewerDelta.delta < 0 ? '▼' : null));
  const arrowColor = viewerDelta?.delta > 0 ? '#6FA37D' : '#C13B2C';

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="streamer-card"
      data-platform={platform}
      style={{
        position: 'relative',
        flex: '0 0 280px', width: 280,
        textDecoration: 'none', color: 'inherit',
        transition: 'transform 200ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* 16:9 thumbnail */}
      <div style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        background: thumb
          ? `#0B0A09 url(${thumb}) center/cover no-repeat`
          : 'linear-gradient(135deg, #1B1816, #0F0D0B)',
        border: '1px solid var(--hairline, #221E1B)',
        boxShadow: '0 0 0 0 transparent',
        overflow: 'hidden',
      }}>
        {/* green ring for live (subtle, on border) */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          boxShadow: 'inset 0 0 0 1px rgba(111,163,125,0.55)',
          pointerEvents: 'none',
        }} />
        {/* LIVE pill bottom-left */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.65)', padding: '3px 8px',
          backdropFilter: 'blur(4px)',
        }}>
          <span aria-hidden style={{
            width: 5, height: 5, borderRadius: 999, background: '#C13B2C',
          }} />
          <span style={{
            color: '#FFFFFF',
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.20em', fontWeight: 700,
          }}>LIVE</span>
        </div>
        {/* uptime bottom-right */}
        {up && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            color: 'rgba(255,255,255,0.92)',
            background: 'rgba(0,0,0,0.55)', padding: '3px 7px',
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.10em',
          }}>{up}</div>
        )}
      </div>

      {/* metadata stack */}
      <div style={{ padding: '10px 0 0', position: 'relative' }}>
        <div data-testid="streamer-card-handle" style={{
          color: '#FFFFFF', fontSize: 15, fontWeight: 500,
          letterSpacing: '-0.01em', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{displayName}</div>
        {game && (
          <div data-testid="streamer-card-game" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
            letterSpacing: '0.06em', marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{game}</div>
        )}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span data-testid="streamer-card-viewers" style={{
            color: '#FFFFFF',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
          }}>{fmtViewers(viewers)}</span>
          <span style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.14em',
          }}>{(viewers || 0) === 1 ? 'VIEWER' : 'VIEWERS'}</span>
          {arrow && (
            <span data-testid="streamer-card-delta" style={{
              color: arrowColor,
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.08em', marginLeft: 'auto',
            }}>{arrow} {Math.abs(viewerDelta.delta)} {lang === 'en' ? 'last hr' : 'tunti'}</span>
          )}
        </div>

        {/* Editorial context — hover only on desktop */}
        {editorialLine && (
          <div
            data-testid="streamer-card-context"
            className="streamer-context-line"
            style={{
              color: 'var(--ink, #ECE6D8)', fontSize: 11.5,
              lineHeight: 1.5, marginTop: 8,
              opacity: 0, maxHeight: 0, overflow: 'hidden',
              transition: 'opacity 220ms ease, max-height 220ms ease',
              borderLeft: `1px solid ${meta.color}55`, paddingLeft: 8,
            }}
          >{editorialLine}</div>
        )}
      </div>

      <style>{`
        a[data-testid="streamer-card"]:hover .streamer-context-line {
          opacity: 0.92 !important;
          max-height: 120px !important;
        }
        @media (max-width: 768px) {
          .streamer-context-line { opacity: 0.85 !important; max-height: 120px !important; }
        }
      `}</style>
    </a>
  );
};

// ── Tab ────────────────────────────────────────────────────────────────
const Tab = ({ platform, active, liveCount, totalCount, onClick }) => {
  const meta = PLATFORM_META[platform];
  const dim = totalCount === 0;
  return (
    <button
      type="button"
      data-testid={`band-tab-${platform}`}
      data-active={active ? '1' : '0'}
      onClick={onClick}
      style={{
        background: 'transparent', border: 0,
        borderBottom: active ? `2px solid ${meta.color}` : '2px solid transparent',
        padding: '10px 16px 11px', cursor: 'pointer',
        color: active ? '#FFFFFF' : 'var(--muted, #9C9587)',
        opacity: dim && !active ? 0.5 : 1,
        display: 'flex', alignItems: 'baseline', gap: 8,
        transition: 'color 160ms ease, border-color 160ms ease',
      }}
    >
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', fontWeight: 700,
      }}>{meta.label}</span>
      <span style={{
        color: active ? meta.color : 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.08em',
      }}>{liveCount}/{totalCount}</span>
    </button>
  );
};

const VISIBLE_CAP = 6;

const StreamersBand = ({ slotFilter, onClearSlotFilter }) => {
  const { lang } = useLang();
  const [data, setData] = useState({ twitch: [], kick: [], youtube: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('twitch');
  const [showAll, setShowAll] = useState(false);
  const [deltas, setDeltas] = useState({});

  useEffect(() => {
    let cancelled = false;
    const loadOne = async (p) => {
      try {
        const url = p === 'twitch'
          ? `${BACKEND}/api/streamers/live`
          : `${BACKEND}/api/streamers/live?platform=${p}`;
        const r = await fetch(url);
        if (!r.ok) return [];
        const d = await r.json();
        return d.streamers || d.items || [];
      } catch { return []; }
    };
    const load = async () => {
      const [t, k, y] = await Promise.all([loadOne('twitch'), loadOne('kick'), loadOne('youtube')]);
      if (cancelled) return;
      setData({ twitch: t, kick: k, youtube: y });
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Fetch per-streamer viewer-deltas when the tab/data changes
  useEffect(() => {
    let cancelled = false;
    const list = data[activeTab] || [];
    const enriched = {};
    Promise.all(list.slice(0, VISIBLE_CAP * 2).map(async (s) => {
      const login = (s.user_login || s.user_name || s.channel || '').toLowerCase();
      if (!login) return;
      try {
        const r = await fetch(`${BACKEND}/api/streamers/viewer-delta?platform=${activeTab}&user_login=${encodeURIComponent(login)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.delta != null) enriched[login] = d;
      } catch {/* suppressed indicator on failure */}
    })).then(() => { if (!cancelled) setDeltas(enriched); });
    return () => { cancelled = true; };
  }, [data, activeTab]);

  // Tab counts (live = has thumbnail or is_live flag)
  const isLive = (s) => (s.is_live ?? (!!s.thumbnail_url));
  const counts = Object.fromEntries(
    PLATFORMS.map((p) => {
      const arr = data[p] || [];
      return [p, { live: arr.filter(isLive).length, total: arr.length }];
    }),
  );

  const liveList = (data[activeTab] || []).filter(isLive)
    .sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));

  // Apply slot filter — surface coordinates this through props
  const slotFilteredList = useMemo(() => {
    if (!slotFilter) return liveList;
    const needle = slotFilter.toLowerCase();
    return liveList.filter((s) => {
      const text = `${(s.title || '').toLowerCase()} ${(s.game_name || '').toLowerCase()}`;
      return text.includes(needle);
    });
  }, [liveList, slotFilter]);

  const visible = showAll ? slotFilteredList : slotFilteredList.slice(0, VISIBLE_CAP);
  const hiddenCount = Math.max(0, slotFilteredList.length - VISIBLE_CAP);

  // Reset cap on tab change
  useEffect(() => { setShowAll(false); }, [activeTab, slotFilter]);

  return (
    <section
      data-testid="streamers-band"
      style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        marginTop: 32, padding: '28px 0 24px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        paddingBottom: 8,
      }}>
        <span
          data-testid="streamers-band-anchor"
          style={{
            color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
            fontSize: 10, fontWeight: 700,
            fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
          }}
        >{lang === 'en' ? 'STREAMS · LIVE NOW' : 'STRIIMIT · LIVE NYT'}</span>
        <Link
          to="/striimaajat"
          data-testid="streamers-band-see-all"
          style={{
            color: 'var(--ink, #ECE6D8)', textDecoration: 'underline',
            textUnderlineOffset: 4,
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.18em', fontWeight: 700,
          }}
        >{lang === 'en' ? 'ALL STREAMERS →' : 'KAIKKI STREAMARIT →'}</Link>
      </div>

      {/* Tabs */}
      <div
        data-testid="band-tabs"
        role="tablist"
        style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--hairline, #221E1B)',
          marginBottom: 18,
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

      {/* Slot filter chip */}
      {slotFilter && (
        <div data-testid="band-slot-filter-active" style={{
          marginBottom: 16, padding: '8px 12px',
          background: 'var(--surface, #141210)',
          border: '1px solid var(--hairline, #221E1B)',
          borderLeft: '2px solid #D4B445',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.10em',
          color: 'var(--ink, #ECE6D8)',
          display: 'inline-flex', alignItems: 'center', gap: 12,
        }}>
          {lang === 'en' ? 'FILTERED · ' : 'SUODATETTU · '}
          <span style={{ color: '#D4B445', fontWeight: 700 }}>{slotFilter.toUpperCase()}</span>
          <button
            type="button"
            data-testid="band-slot-filter-clear"
            onClick={onClearSlotFilter}
            style={{
              background: 'transparent', border: 0, padding: 0,
              color: 'var(--muted, #9C9587)', cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.10em',
            }}
          >{lang === 'en' ? 'CLEAR ✕' : 'TYHJENNÄ ✕'}</button>
        </div>
      )}

      {/* Cards row (horizontal scroll on mobile) */}
      <div
        data-testid="band-cards-row"
        className="band-cards-row"
        style={{
          display: 'flex', gap: 20, flexWrap: 'wrap',
        }}
      >
        {loading && (
          <div data-testid="band-loading" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.14em', padding: '20px 0',
          }}>LOADING…</div>
        )}
        {!loading && visible.length === 0 && (
          <div data-testid={`band-empty-${activeTab}`} style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.10em', padding: '20px 0', lineHeight: 1.6,
          }}>{slotFilter
            ? (lang === 'en' ? `NO STREAMERS PLAYING ${slotFilter.toUpperCase()} RIGHT NOW.` : `KUKAAN EI PELAA ${slotFilter.toUpperCase()} JUURI NYT.`)
            : activeTab === 'kick'
              ? 'KICK API DORMANT.'
              : activeTab === 'youtube'
                ? (lang === 'en' ? 'NO YOUTUBE STREAMERS YET.' : 'EI YOUTUBE-STREAMAAJIA VIELÄ.')
                : (lang === 'en' ? 'NO ONE LIVE RIGHT NOW.' : 'KUKAAN EI OLE LIVENÄ JUURI NYT.')}</div>
        )}
        {!loading && visible.map((s) => {
          const login = (s.user_login || s.user_name || s.channel || '').toLowerCase();
          return (
            <StreamerCard
              key={`${activeTab}:${login}`}
              streamer={s}
              platform={activeTab}
              lang={lang}
              viewerDelta={deltas[login]}
            />
          );
        })}
      </div>

      {/* + N more live */}
      {!loading && hiddenCount > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            data-testid="band-show-more"
            onClick={() => setShowAll((v) => !v)}
            style={{
              background: 'transparent', border: 0, padding: '8px 0',
              color: 'var(--muted, #9C9587)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showAll
              ? (lang === 'en' ? '▾ SHOW LESS' : '▾ NÄYTÄ VÄHEMMÄN')
              : (lang === 'en' ? `▸ +${hiddenCount} MORE LIVE` : `▸ +${hiddenCount} LISÄÄ LIVENÄ`)}
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .band-cards-row {
            flex-wrap: nowrap !important;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            padding-bottom: 8px;
          }
          .band-cards-row > a {
            scroll-snap-align: start;
          }
        }
      `}</style>
    </section>
  );
};

export default StreamersBand;
