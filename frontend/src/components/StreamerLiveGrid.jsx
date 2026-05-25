/**
 * StreamerLiveGrid - Multi-platform live Twitch/Kick/YouTube carousel +
 * "ASETA HÄLYTYS" conversion funnel.
 *
 * Tabs swap between platforms. Each card opens StreamerAlertModal on
 * Follow Alert click - that's the actual signup path (email + phone +
 * Telegram). No more "open Twitch in new tab" link.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ExternalLink, Eye, Users, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import StreamerAlertModal from './StreamerAlertModal';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 30_000;

const PLATFORMS = [
  { key: 'twitch',  label: 'TWITCH',  accent: '#9146FF' },
  { key: 'kick',    label: 'KICK',    accent: '#53FC18' },
  { key: 'youtube', label: 'YOUTUBE', accent: '#FF0033' },
];

const fmtNumber = (n) => {
  if (n == null) return '-';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
};

const fmtAgo = (iso, t) => {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    const mins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000));
    if (mins < 60) return t('uutiset.ago_m').replace('{n}', mins);
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ${t('streamer_live.live_for')}`;
  } catch { return ''; }
};

const StreamerCard = ({ s, onAlert, t }) => (
  <div
    data-testid={`streamer-card-${s.user_login}`}
    className="panel panel-hover overflow-hidden flex flex-col"
    style={{ borderRadius: 4 }}
  >
    <a
      href={s.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative overflow-hidden block"
      style={{ aspectRatio: '16/9', background: '#0A0A0A' }}
    >
      {s.thumbnail_url ? (
        <img
          src={s.thumbnail_url}
          alt={`${s.user_name || s.user_login}`}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          style={{ display: 'block' }}
        />
      ) : (
        <div className="w-full h-full grid place-items-center mono"
             style={{ color: 'rgba(245,243,238,0.4)', fontSize: 11, letterSpacing: '0.18em' }}>
          {t('streamer_live.no_preview').toUpperCase()}
        </div>
      )}
      <div
        className="absolute top-2 left-2 mono inline-flex items-center gap-1.5"
        style={{
          fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 700,
          color: '#fff', background: '#C8423C',
          padding: '4px 8px', borderRadius: 2,
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: '#fff',
          animation: 'pulse 1.8s ease-in-out infinite',
        }} />
        {t('common.live')}
      </div>
      {s.viewer_count != null && (
        <div
          className="absolute top-2 right-2 mono inline-flex items-center gap-1.5"
          style={{
            fontSize: 10, letterSpacing: '0.14em', fontWeight: 700,
            color: '#fff', background: 'rgba(10,10,10,0.78)',
            backdropFilter: 'blur(4px)', padding: '4px 8px', borderRadius: 2,
          }}
        >
          <Eye strokeWidth={1.8} size={11} />
          {fmtNumber(s.viewer_count)}
        </div>
      )}
    </a>

    <div className="p-4 flex flex-col gap-2 flex-1" style={{ background: 'var(--bg)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
          {s.user_name || s.user_login}
        </div>
        <a href={s.profile_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink strokeWidth={1.4} size={13} style={{ color: 'var(--muted)' }} />
        </a>
      </div>
      {s.title && (
        <div
          className="font-serif"
          style={{
            fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
          title={s.title}
        >
          {s.title}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mono pt-1"
           style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
        <span>{(s.game_name || t('streamer_live.just_chatting')).toUpperCase()}</span>
        {typeof s.follower_count === 'number' && (
          <span className="inline-flex items-center gap-1">
            <Users strokeWidth={1.7} size={10} />
            {fmtNumber(s.follower_count)}
          </span>
        )}
      </div>
      {s.started_at && (
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', opacity: 0.7 }}>
          {fmtAgo(s.started_at, t).toUpperCase()}
        </div>
      )}
      <button
        type="button"
        data-testid={`streamer-alert-cta-${s.user_login}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAlert(s); }}
        className="mono mt-auto inline-flex items-center justify-center gap-1.5"
        style={{
          padding: '10px 14px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
          background: 'var(--ink)', color: 'var(--bg)',
          border: 'none', borderRadius: 2, cursor: 'pointer',
        }}
      >
        <Bell strokeWidth={1.9} size={12} />
        {t('streamer_live.set_alert').toUpperCase()}
      </button>
    </div>
  </div>
);

const StreamerLiveGrid = () => {
  const { t } = useLang();
  const [platform, setPlatform] = useState('twitch');
  const [data, setData] = useState({});  // { twitch: {...}, kick: {...}, youtube: {...} }
  const [alertTarget, setAlertTarget] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 4;

  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (p) => {
    try {
      const r = await fetch(`${BACKEND}/api/streamers/live${p === 'twitch' ? '' : `?platform=${p}`}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData((prev) => ({ ...prev, [p]: d }));
      setLastRefresh(Date.now());
    } catch {
      // silent - show empty state
    }
  }, []);

  useEffect(() => {
    PLATFORMS.forEach((p) => load(p.key));
    const id = setInterval(() => PLATFORMS.forEach((p) => load(p.key)), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const active = data[platform] || {};
  const streamers = active.streamers || [];
  const dormant = active.dormant;

  // Reset page index whenever platform or count changes so the new tab
  // starts at the first card.
  useEffect(() => { setPage(0); }, [platform, streamers.length]);

  const totalPages = Math.max(1, Math.ceil(streamers.length / PAGE_SIZE));
  const pageStreamers = streamers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < streamers.length;

  const counts = useMemo(() => {
    const out = {};
    PLATFORMS.forEach((p) => {
      const d = data[p.key];
      out[p.key] = d ? (d.streamers?.length || 0) : null;
    });
    return out;
  }, [data]);

  return (
    <section className="container-wide" data-testid="streamer-live-grid">
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="mono mb-1.5 inline-flex items-center gap-2" style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#2c7a4b', boxShadow: '0 0 6px #2c7a4b' }} />
            {t('streamer_live.eyebrow').toUpperCase()}
            {lastRefresh && (
              <span style={{ opacity: 0.55, fontWeight: 500 }} data-testid="streamer-live-last-refresh">
                · {t('streamer_live.refresh_30s').toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="display" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
            {t('streamer_live.title')}
          </h2>
        </div>
        {/* Carousel nav - desktop only; mobile uses native scroll-snap */}
        {streamers.length > PAGE_SIZE && (
          <div className="hidden sm:inline-flex items-center gap-2" data-testid="streamer-carousel-nav">
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={!canPrev}
              data-testid="streamer-carousel-prev"
              aria-label="Edellinen"
              className="inline-flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: 2,
                background: 'var(--bg)',
                border: '1px solid var(--border-strong)',
                color: 'var(--ink)',
                cursor: canPrev ? 'pointer' : 'not-allowed',
                opacity: canPrev ? 1 : 0.35,
              }}
            >
              <ChevronLeft strokeWidth={1.7} size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={!canNext}
              data-testid="streamer-carousel-next"
              aria-label="Seuraava"
              className="inline-flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: 2,
                background: 'var(--bg)',
                border: '1px solid var(--border-strong)',
                color: 'var(--ink)',
                cursor: canNext ? 'pointer' : 'not-allowed',
                opacity: canNext ? 1 : 0.35,
              }}
            >
              <ChevronRight strokeWidth={1.7} size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-1 mb-5 flex-wrap" data-testid="streamer-platform-tabs">
        {PLATFORMS.map((p) => {
          const isActive = p.key === platform;
          const c = counts[p.key];
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlatform(p.key)}
              data-testid={`streamer-tab-${p.key}`}
              className="mono inline-flex items-center gap-2 transition-colors"
              style={{
                padding: '8px 14px',
                fontSize: 11,
                letterSpacing: '0.22em',
                fontWeight: 700,
                background: isActive ? 'var(--ink)' : 'transparent',
                color: isActive ? 'var(--bg)' : 'var(--muted)',
                border: `1px solid ${isActive ? 'var(--ink)' : 'var(--border-strong)'}`,
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: p.accent }} />
              {p.label}
              {c != null && (
                <span style={{ opacity: 0.7, fontWeight: 500 }}>· {c}</span>
              )}
            </button>
          );
        })}
      </div>

      {dormant ? (
        <div className="panel p-8 text-center"
             data-testid="streamer-live-dormant">
          <div className="mono mb-2" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
            {platform.toUpperCase()} · {(active.reason || '').includes('blocked')
              ? (t('streamer_live.dormant_blocked') || 'API TEMPORARILY UNAVAILABLE').toUpperCase()
              : (active.reason || '').includes('not_configured')
                ? t('streamer_live.dormant_key').toUpperCase()
                : t('streamer_live.empty').toUpperCase()}
          </div>
          <p className="font-serif" style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.55 }}>
            {(active.reason || '').includes('blocked')
              ? (t('streamer_live.dormant_blocked_body') || 'Kick API is currently rate-limiting server-side requests. Our roster is intact - we\u2019ll reconnect once their endpoint reopens.')
              : t('empty.no_streams_body')}
          </p>
        </div>
      ) : streamers.length === 0 ? (
        <div className="panel p-8 text-center"
             data-testid="streamer-live-empty">
          <div className="display mb-2" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
            {t('empty.no_streams_title')}
          </div>
          <p className="font-serif mb-5" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 420, margin: '0 auto 16px' }}>
            {t('empty.no_streams_body')}
          </p>
          <button
            type="button"
            onClick={() => setAlertTarget({ user_login: '*', user_name: t('streamer_live.bulk_title'), profile_url: '#' })}
            data-testid="streamer-live-empty-cta"
            className="mono inline-flex items-center justify-center gap-2"
            style={{
              padding: '10px 16px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
              background: 'var(--ink)', color: 'var(--bg)', border: 'none', borderRadius: 2, cursor: 'pointer',
            }}
          >
            <Bell strokeWidth={1.9} size={12} />
            {t('streamer_live.set_alert').toUpperCase()}
          </button>
        </div>
      ) : (
        <>
          {/* Mobile swipe lane */}
          <div
            className="sm:hidden flex gap-4 overflow-x-auto pb-3 -mx-4 px-4"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            data-testid="streamer-live-swipe"
          >
            {streamers.slice(0, 8).map((s) => (
              <div key={s.user_login}
                   style={{ scrollSnapAlign: 'start', flex: '0 0 80%', minWidth: 280 }}>
                <StreamerCard s={s} onAlert={setAlertTarget} t={t} />
              </div>
            ))}
          </div>
          {/* Desktop/tablet grid (carousel-feel: 4 visible per page) */}
          <div
            className="hidden sm:grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            data-testid="streamer-live-list"
          >
            {pageStreamers.map((s) => (
              <StreamerCard key={s.user_login} s={s} onAlert={setAlertTarget} t={t} />
            ))}
            {/* Bulk wildcard alert card - last tile in the grid */}
            <button
              type="button"
              onClick={() => setAlertTarget({ user_login: '*', user_name: t('streamer_live.bulk_title'), profile_url: '#' })}
              data-testid="streamer-bulk-alert-card"
              className="panel panel-hover flex flex-col text-left"
              style={{
                background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 60%, #232020 100%)',
                color: '#F5F3EE',
                border: '1px solid rgba(232,146,74,0.35)',
                borderRadius: 4, cursor: 'pointer',
                padding: 20, minHeight: 220,
                aspectRatio: 'auto',
              }}
            >
              <div className="mono mb-3 inline-flex items-center gap-2"
                   style={{ fontSize: 10, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
                <Bell strokeWidth={1.9} size={12} />
                {t('streamer_live.bulk_eyebrow').toUpperCase()}
              </div>
              <h3 className="display mb-3" style={{ fontSize: 18, fontWeight: 700, color: '#F5F3EE', lineHeight: 1.2 }}>
                {t('streamer_live.bulk_title')}
              </h3>
              <p className="font-serif mb-5" style={{ fontSize: 13, color: 'rgba(245,243,238,0.7)', lineHeight: 1.5 }}>
                {t('streamer_live.bulk_body')}
              </p>
              <span
                className="mono mt-auto inline-flex items-center justify-center gap-2"
                style={{
                  padding: '12px 14px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
                  background: '#E8924A', color: '#0A0A0A', borderRadius: 2,
                }}
              >
                <Bell strokeWidth={1.9} size={12} />
                {t('streamer_live.bulk_cta').toUpperCase()}
              </span>
            </button>
          </div>
          {streamers.length > 4 && (
            <div className="mt-4">
              <a
                href="/striimaajat"
                className="mono inline-flex items-center gap-2"
                style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, textDecoration: 'none' }}
                data-testid="streamer-live-view-all"
              >
                {t('streamer_live.view_all').toUpperCase()} · {(active.count ?? streamers.length)} {t('streamer_live.live_count').toUpperCase()} →
              </a>
            </div>
          )}
        </>
      )}

      <StreamerAlertModal
        streamer={alertTarget}
        platform={platform}
        onClose={() => setAlertTarget(null)}
      />
    </section>
  );
};

export default StreamerLiveGrid;
