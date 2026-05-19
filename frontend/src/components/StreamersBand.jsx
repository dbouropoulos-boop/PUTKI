/**
 * PUTKI HQ — StreamersBand (Carousel redesign · 2026-05-19).
 *
 * Restored the old StreamerLiveGrid carousel energy on top of the
 * editorial chassis. The cards now carry social-proof signals that
 * matter: follower scale, viewer momentum, top-N FI ranking. Streak
 * stays out until we have multi-day data — honest empty states first.
 *
 * Visible chrome (per card):
 *   • LIVE badge with pulsing red dot (top-left)
 *   • Viewer count + Eye icon overlay (top-right)
 *   • Hover-zoom on thumbnail
 *   • Top-N FI rank ribbon (only when applicable)
 *   • Display name in restrained serif (improved type, not just bigger)
 *   • Game subtitle (only when the API returns one)
 *   • Uptime chip (only when `started_at` is real)
 *   • Social-proof row: follower count chip · viewer trend chip
 *   • "ASETA HÄLYTYS" button → opens StreamerAlertModal
 *   • Editorial-pick badge when an editorial meta line is published
 *
 * Horizontal scroll on every viewport (desktop + mobile) with scroll-snap.
 * Slot filter from the now-playing ticker keeps working through the
 * `slotFilter` prop.
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Eye, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import StreamerAlertModal from './StreamerAlertModal';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PLATFORMS = ['twitch', 'kick', 'youtube'];
const PLATFORM_META = {
  twitch:  { label: 'TWITCH',  color: '#9146FF', baseUrl: 'https://twitch.tv/' },
  kick:    { label: 'KICK',    color: '#53FC18', baseUrl: 'https://kick.com/' },
  youtube: { label: 'YOUTUBE', color: '#FF0033', baseUrl: 'https://youtube.com/' },
};

const fmtCount = (n) => {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1000)}k`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const uptimeChip = (startedAt) => {
  if (!startedAt) return null;
  try {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    if (mins < 60) return `${mins}m on air`;
    const h = Math.floor(mins / 60);
    return `${h}h ${String(mins % 60).padStart(2, '0')}m on air`;
  } catch { return null; }
};

const buildThumb = (url) => {
  if (!url) return null;
  const minute = Math.floor(Date.now() / 60000); // cache-bust every minute
  if (url.includes('{width}') && url.includes('{height}')) {
    return `${url.replace('{width}', '640').replace('{height}', '360')}?t=${minute}`;
  }
  return `${url}${url.includes('?') ? '&' : '?'}t=${minute}`;
};

// ── Card ───────────────────────────────────────────────────────────────
const StreamerCard = ({ streamer, platform, lang, viewerDelta, rank, alertSignal, onAlertClick }) => {
  const meta = PLATFORM_META[platform];
  const handle = (streamer.user_login || streamer.user_name || streamer.channel || '?').toLowerCase();
  const displayName = streamer.user_name || handle;
  const game = streamer.game_name || streamer.category || '';
  const viewers = streamer.viewer_count;
  const followers = streamer.follower_count;
  const thumb = buildThumb(streamer.thumbnail_url);
  const up = uptimeChip(streamer.started_at);
  const href = streamer.profile_url || `${meta.baseUrl}${handle}`;
  // Tooltip / hover line: only published editorial meta surfaces.
  const editorialLine = lang === 'en'
    ? (streamer.meta_line_en || streamer.meta_en)
    : (streamer.meta_line_fi || streamer.meta_fi);
  const hasEditorialPick = !!(streamer.meta_line_fi || streamer.meta_line_en
                              || streamer.meta_fi || streamer.meta_en);

  const trendUp = viewerDelta?.delta > 0;
  const trendDown = viewerDelta?.delta < 0;
  const trendColor = trendUp ? '#6FA37D' : (trendDown ? '#C8423C' : 'var(--muted)');
  const trendArrow = trendUp ? '▲' : (trendDown ? '▼' : null);

  const stopBubble = (e) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <article
      data-testid={`streamer-card-${handle}`}
      data-platform={platform}
      className="streamer-card-v2"
      style={{
        position: 'relative',
        flex: '0 0 320px',
        width: 320,
        background: 'var(--surface, #141210)',
        border: '1px solid var(--hairline, #221E1B)',
        overflow: 'hidden',
        scrollSnapAlign: 'start',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
      }}
    >
      {/* Thumbnail */}
      <a href={href} target="_blank" rel="noreferrer noopener"
        data-testid="streamer-card-thumb-link"
        style={{
          position: 'relative', display: 'block',
          aspectRatio: '16/9',
          background: '#0B0A09',
          overflow: 'hidden',
        }}>
        {thumb ? (
          <img src={thumb} alt={displayName} loading="lazy"
            className="streamer-thumb-img"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: 'block',
              transition: 'transform 480ms ease',
            }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'grid', placeItems: 'center',
            color: 'rgba(245,243,238,0.4)', fontFamily: 'ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.20em',
          }}>NO PREVIEW</div>
        )}

        {/* LIVE badge top-left with pulse */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', background: '#C8423C',
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.22em', fontWeight: 700, color: '#FFFFFF',
        }}>
          <span aria-hidden style={{
            width: 6, height: 6, borderRadius: 999, background: '#FFFFFF',
            animation: 'pulseDot 1.6s ease-in-out infinite',
          }} />
          LIVE
        </div>

        {/* Top-N rank ribbon (only when applicable) */}
        {rank && rank <= 5 && (
          <div data-testid="streamer-rank-badge" style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            padding: '3px 9px',
            background: 'rgba(212,180,69,0.92)', color: '#0B0A09',
            fontFamily: 'ui-monospace, monospace', fontSize: 9,
            letterSpacing: '0.20em', fontWeight: 800,
          }}>
            #{rank} {lang === 'en' ? 'TOP FI' : 'TOP FI'}
          </div>
        )}

        {/* Viewers overlay top-right */}
        {viewers != null && (
          <div data-testid="streamer-card-viewers-overlay" style={{
            position: 'absolute', top: 10, right: 10,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 9px',
            background: 'rgba(11,10,9,0.82)',
            backdropFilter: 'blur(6px)',
            color: '#FFFFFF',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.10em', fontWeight: 700,
          }}>
            <Eye strokeWidth={1.8} size={11} />
            {fmtCount(viewers)}
          </div>
        )}

        {/* Uptime chip bottom-right (only if real) */}
        {up && (
          <div data-testid="streamer-card-uptime" style={{
            position: 'absolute', bottom: 10, right: 10,
            padding: '3px 8px',
            background: 'rgba(11,10,9,0.82)',
            backdropFilter: 'blur(6px)',
            color: 'rgba(255,255,255,0.94)',
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.10em',
          }}>{up}</div>
        )}

        {/* Editorial pick badge bottom-left (only when published meta exists) */}
        {hasEditorialPick && (
          <div data-testid="streamer-card-editorial-badge" style={{
            position: 'absolute', bottom: 10, left: 10,
            padding: '3px 8px',
            background: '#0e2b1a',
            border: '1px solid #2b5a3e',
            color: '#9ad4a9',
            fontFamily: 'ui-monospace, monospace', fontSize: 9,
            letterSpacing: '0.20em', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            ★ EDITORIAL
            {/* Bell — visible on every PUBLISHED card; pulses if a
                per-streamer notification fired in the last 60min */}
            <span
              data-testid="streamer-card-bell"
              data-pulse={alertSignal?.count > 0 ? '1' : '0'}
              className={alertSignal?.count > 0 ? 'streamer-bell-pulse' : 'streamer-bell-static'}
              title={alertSignal?.count > 0
                ? (lang === 'en'
                    ? `${alertSignal.count} alert${alertSignal.count === 1 ? '' : 's'} dispatched in the last hour`
                    : `${alertSignal.count} hälytystä lähetetty viimeisen tunnin sisällä`)
                : (lang === 'en' ? 'Alerts armed' : 'Hälytys käytössä')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: alertSignal?.count > 0 ? '#FFD66E' : '#9ad4a9',
              }}
            >
              <Bell strokeWidth={2} size={10} fill={alertSignal?.count > 0 ? '#FFD66E' : 'none'} />
            </span>
          </div>
        )}
      </a>

      {/* Body */}
      <div style={{
        padding: '14px 16px 14px',
        display: 'flex', flexDirection: 'column', gap: 8, flex: 1,
      }}>
        {/* Display name — restrained serif, not aggressively big */}
        <a href={href} target="_blank" rel="noreferrer noopener"
          data-testid="streamer-card-name"
          style={{
            color: 'var(--ink, #ECE6D8)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 17, fontWeight: 600,
            letterSpacing: '-0.01em', lineHeight: 1.15,
            textDecoration: 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{displayName}</a>

        {/* Game category (only if API has it) */}
        {game && (
          <div data-testid="streamer-card-game" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{game}</div>
        )}

        {/* Social-proof row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2,
        }} data-testid="streamer-card-social-proof">
          {followers != null && (
            <span data-testid="streamer-card-followers" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 7px', background: 'var(--bg, #0B0A09)',
              border: '1px solid var(--hairline, #221E1B)',
              color: 'var(--muted)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.06em',
            }}>
              <Users strokeWidth={1.8} size={10} />
              {fmtCount(followers)} {lang === 'en' ? 'followers' : 'seuraajaa'}
            </span>
          )}
          {trendArrow && (
            <span data-testid="streamer-card-trend" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 7px', background: 'var(--bg, #0B0A09)',
              border: `1px solid ${trendColor}55`,
              color: trendColor,
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.06em', fontWeight: 700,
            }}>
              {trendArrow} {fmtCount(Math.abs(viewerDelta.delta))} {lang === 'en' ? 'this hr' : 'tunti'}
            </span>
          )}
        </div>

        {/* Editorial line — hover only on desktop */}
        {editorialLine && (
          <div data-testid="streamer-card-context"
            className="streamer-context-line"
            style={{
              color: 'var(--ink, #ECE6D8)', fontSize: 11.5,
              lineHeight: 1.55, marginTop: 4,
              opacity: 0, maxHeight: 0, overflow: 'hidden',
              transition: 'opacity 220ms ease, max-height 220ms ease',
              borderLeft: `1px solid ${meta.color}55`, paddingLeft: 8,
            }}
          >{editorialLine}</div>
        )}

        {/* Alert CTA */}
        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          <button type="button"
            data-testid={`streamer-card-alert-btn-${handle}`}
            onClick={(e) => { stopBubble(e); onAlertClick(streamer); }}
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'transparent',
              color: 'var(--ink, #ECE6D8)',
              border: '1px solid var(--border-strong, #3A332E)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
              letterSpacing: '0.20em', fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ink, #ECE6D8)'; e.currentTarget.style.color = '#0B0A09'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink, #ECE6D8)'; }}
          >
            <Bell strokeWidth={1.8} size={12} />
            {lang === 'en' ? 'SET ALERT' : 'ASETA HÄLYTYS'}
          </button>
        </div>
      </div>
    </article>
  );
};

// ── Tab ────────────────────────────────────────────────────────────────
const Tab = ({ platform, active, liveCount, totalCount, onClick }) => {
  const meta = PLATFORM_META[platform];
  const dim = totalCount === 0;
  return (
    <button type="button"
      data-testid={`band-tab-${platform}`}
      data-active={active ? '1' : '0'}
      onClick={onClick}
      style={{
        background: 'transparent', border: 0,
        borderBottom: active ? `2px solid ${meta.color}` : '2px solid transparent',
        padding: '12px 18px 13px', cursor: 'pointer',
        color: active ? '#FFFFFF' : 'var(--muted, #9C9587)',
        opacity: dim && !active ? 0.5 : 1,
        display: 'flex', alignItems: 'baseline', gap: 8,
        transition: 'color 160ms ease, border-color 160ms ease',
      }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
        letterSpacing: '0.24em', fontWeight: 700,
      }}>{meta.label}</span>
      <span style={{
        color: active ? meta.color : 'var(--muted, #9C9587)',
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.08em',
      }}>{liveCount}/{totalCount}</span>
    </button>
  );
};

const StreamersBand = ({ slotFilter, onClearSlotFilter }) => {
  const { lang } = useLang();
  const [data, setData] = useState({ twitch: [], kick: [], youtube: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('twitch');
  const [deltas, setDeltas] = useState({});
  const [alertStreamer, setAlertStreamer] = useState(null);
  const [alertSignals, setAlertSignals] = useState({});
  const scrollerRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  // Per-streamer alert signal — recently-dispatched notifications. Pulls
  // /api/streamers/recent-alerts every 60s; the bell on the card pulses
  // when the count is > 0 within the last 60min window.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/streamers/recent-alerts?within_minutes=60`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setAlertSignals(d.by_streamer || {});
      } catch { /* keep last good signals */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Toggle scroll-arrow visibility based on whether the carousel actually
  // overflows. On wide desktops the 12 active streamers may fit without
  // a horizontal scroll, in which case the arrows are pure noise.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [data, activeTab]);

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

  // Per-streamer viewer delta lookups
  useEffect(() => {
    let cancelled = false;
    const list = data[activeTab] || [];
    const enriched = {};
    Promise.all(list.slice(0, 20).map(async (s) => {
      const login = (s.user_login || s.user_name || s.channel || '').toLowerCase();
      if (!login) return;
      try {
        const r = await fetch(`${BACKEND}/api/streamers/viewer-delta?platform=${activeTab}&user_login=${encodeURIComponent(login)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.delta != null) enriched[login] = d;
      } catch {/* suppressed on failure */}
    })).then(() => { if (!cancelled) setDeltas(enriched); });
    return () => { cancelled = true; };
  }, [data, activeTab]);

  // Tab counts
  const isLive = (s) => (s.is_live ?? (!!s.thumbnail_url));
  const counts = Object.fromEntries(
    PLATFORMS.map((p) => {
      const arr = data[p] || [];
      return [p, { live: arr.filter(isLive).length, total: arr.length }];
    }),
  );

  // Sort by current viewers desc — that's also how we assign Top-5 rank
  const liveList = useMemo(() => (
    (data[activeTab] || [])
      .filter(isLive)
      .slice()
      .sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0))
  ), [data, activeTab]);

  // Slot filter from the now-playing ticker
  const slotFilteredList = useMemo(() => {
    if (!slotFilter) return liveList;
    const needle = slotFilter.toLowerCase();
    return liveList.filter((s) => {
      const text = `${(s.title || '').toLowerCase()} ${(s.game_name || '').toLowerCase()}`;
      return text.includes(needle);
    });
  }, [liveList, slotFilter]);

  // Build a rank map BEFORE the slot filter — rank reflects the platform leaderboard,
  // not the filtered subset.
  const rankByLogin = useMemo(() => {
    const m = {};
    liveList.forEach((s, i) => {
      const login = (s.user_login || s.user_name || s.channel || '').toLowerCase();
      if (login) m[login] = i + 1;
    });
    return m;
  }, [liveList]);

  const onAlertClick = useCallback((s) => setAlertStreamer(s), []);
  const closeAlert = useCallback(() => setAlertStreamer(null), []);

  const scrollBy = (px) => {
    if (scrollerRef.current) scrollerRef.current.scrollBy({ left: px, behavior: 'smooth' });
  };

  return (
    <section
      data-testid="streamers-band"
      style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        marginTop: 32, padding: '28px 0 28px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        paddingBottom: 8,
      }}>
        <span data-testid="streamers-band-anchor" style={{
          color: 'var(--muted, #9C9587)', letterSpacing: '0.24em',
          fontSize: 10, fontWeight: 700,
          fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase',
        }}>{lang === 'en' ? 'STREAMS · LIVE NOW' : 'STRIIMIT · LIVE NYT'}</span>
        <Link to="/striimaajat" data-testid="streamers-band-see-all" style={{
          color: 'var(--ink, #ECE6D8)', textDecoration: 'underline',
          textUnderlineOffset: 4,
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', fontWeight: 700,
        }}>{lang === 'en' ? 'ALL STREAMERS →' : 'KAIKKI STREAMARIT →'}</Link>
      </div>

      {/* Tabs */}
      <div data-testid="band-tabs" role="tablist" style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--hairline, #221E1B)',
        marginBottom: 20,
      }}>
        {PLATFORMS.map((p) => (
          <Tab key={p} platform={p} active={activeTab === p}
            liveCount={counts[p].live} totalCount={counts[p].total}
            onClick={() => setActiveTab(p)} />
        ))}
        {/* Carousel controls — only when content actually overflows */}
        {overflow && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={() => scrollBy(-340)}
            data-testid="band-scroll-left"
            aria-label="scroll left"
            style={{
              background: 'transparent', border: '1px solid var(--hairline, #221E1B)',
              width: 32, height: 32, cursor: 'pointer',
              color: 'var(--ink, #ECE6D8)', display: 'grid', placeItems: 'center',
            }}>
            <ChevronLeft strokeWidth={1.8} size={16} />
          </button>
          <button type="button" onClick={() => scrollBy(340)}
            data-testid="band-scroll-right"
            aria-label="scroll right"
            style={{
              background: 'transparent', border: '1px solid var(--hairline, #221E1B)',
              width: 32, height: 32, cursor: 'pointer',
              color: 'var(--ink, #ECE6D8)', display: 'grid', placeItems: 'center',
            }}>
            <ChevronRight strokeWidth={1.8} size={16} />
          </button>
        </div>
        )}
      </div>

      {/* Slot filter chip */}
      {slotFilter && (
        <div data-testid="band-slot-filter-active" style={{
          marginBottom: 16, padding: '8px 12px',
          background: 'var(--surface, #141210)',
          border: '1px solid var(--hairline, #221E1B)',
          borderLeft: '2px solid #D4B445',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.10em', color: 'var(--ink, #ECE6D8)',
          display: 'inline-flex', alignItems: 'center', gap: 12,
        }}>
          {lang === 'en' ? 'FILTERED · ' : 'SUODATETTU · '}
          <span style={{ color: '#D4B445', fontWeight: 700 }}>{slotFilter.toUpperCase()}</span>
          <button type="button" data-testid="band-slot-filter-clear" onClick={onClearSlotFilter}
            style={{
              background: 'transparent', border: 0, padding: 0,
              color: 'var(--muted, #9C9587)', cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.10em',
            }}>{lang === 'en' ? 'CLEAR ✕' : 'TYHJENNÄ ✕'}</button>
        </div>
      )}

      {/* Carousel */}
      <div ref={scrollerRef} data-testid="band-cards-row" className="band-cards-row-v2"
        style={{
          display: 'flex', gap: 16,
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          paddingBottom: 4,
          scrollbarWidth: 'thin',
        }}>
        {loading && (
          <div data-testid="band-loading" style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.14em', padding: '20px 0',
          }}>LOADING…</div>
        )}
        {!loading && slotFilteredList.length === 0 && (
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
        {!loading && slotFilteredList.map((s) => {
          const login = (s.user_login || s.user_name || s.channel || '').toLowerCase();
          return (
            <StreamerCard key={`${activeTab}:${login}`}
              streamer={s} platform={activeTab} lang={lang}
              viewerDelta={deltas[login]}
              rank={rankByLogin[login]}
              alertSignal={alertSignals[login]}
              onAlertClick={onAlertClick} />
          );
        })}
      </div>

      {/* Alert modal */}
      {alertStreamer && (
        <StreamerAlertModal streamer={alertStreamer} platform={activeTab} onClose={closeAlert} />
      )}

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(0.85); }
        }
        @keyframes bellPulse {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          15%      { transform: scale(1.2) rotate(-8deg); opacity: 1; }
          30%      { transform: scale(1.2) rotate(8deg); opacity: 1; }
          45%      { transform: scale(1.1) rotate(0deg); opacity: 0.8; }
        }
        .streamer-bell-pulse {
          animation: bellPulse 2.4s ease-in-out infinite;
          transform-origin: 50% 0%;
        }
        .streamer-bell-static {
          opacity: 0.65;
        }
        .streamer-card-v2:hover {
          transform: translateY(-2px);
          border-color: var(--border-strong, #3A332E) !important;
          box-shadow: 0 8px 28px -16px rgba(0,0,0,0.5);
        }
        .streamer-card-v2:hover .streamer-thumb-img {
          transform: scale(1.05);
        }
        .streamer-card-v2:hover .streamer-context-line {
          opacity: 0.92 !important;
          max-height: 120px !important;
        }
        @media (max-width: 768px) {
          .streamer-context-line { opacity: 0.85 !important; max-height: 120px !important; }
        }
        .band-cards-row-v2::-webkit-scrollbar { height: 6px; }
        .band-cards-row-v2::-webkit-scrollbar-thumb {
          background: var(--hairline, #221E1B); border-radius: 3px;
        }
      `}</style>
    </section>
  );
};

export default StreamersBand;
