/**
 * PUTKI HQ — NowPlayingTicker (Phase 1 sprint follow-up).
 *
 * Continuous horizontal-scrolling slot ticker. Distinct from the news
 * ticker — slower cadence, gambling-data domain. Each slot is clickable
 * and filters the StreamersBand above to streamers playing it.
 *
 * Data: GET /api/streamers/now-playing
 * Refresh: 60s
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
// Slot data changes less frequently than news — keep this calmer than
// the news ticker (40 px/s vs ~55 px/s).
const SLOTS_PIXELS_PER_SECOND = 40;

const NowPlayingTicker = ({ onSlotClick, activeSlot }) => {
  const { lang } = useLang();
  const [slots, setSlots] = useState([]);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/streamers/now-playing`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (cancelled || !d) return;
          setSlots(d.slots || []);
          setCategoryCount(d.slot_category_streams_count || 0);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const label = lang === 'en' ? 'NOW PLAYING' : 'PELISSÄ NYT';

  // Dynamic animation duration based on actual track width.
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(180);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const loopPx = el.scrollWidth / 2;
      if (loopPx > 0) setDuration(Math.max(60, loopPx / SLOTS_PIXELS_PER_SECOND));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slots]);

  if (loading) {
    return (
      <div
        data-testid="now-playing-ticker"
        data-state="loading"
        style={{
          borderTop: '1px solid var(--hairline, #221E1B)',
          borderBottom: '1px solid var(--hairline, #221E1B)',
          padding: '9px 32px', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.16em',
          color: 'var(--muted, #9C9587)', opacity: 0.7,
        }}
      >{label} · LOADING…</div>
    );
  }

  // Empty state — either pure scene mode (zero slot/casino streams) or
  // "title not declared" mode (slot/casino streams live but their titles
  // don't mention a specific registered slot — common on Kick where the
  // stream title is marketing fluff and the actual slot is visible only
  // in the video itself).
  if (slots.length === 0) {
    const hasCategoryStreams = categoryCount > 0;
    const copy = hasCategoryStreams
      ? (lang === 'en'
          ? `${categoryCount} slot stream${categoryCount === 1 ? '' : 's'} live · titles not declared`
          : `${categoryCount} slottistriim${categoryCount === 1 ? 'i' : 'iä'} käynnissä · slotteja ei merkitty otsikkoon`)
      : (lang === 'en'
          ? 'No slot streams right now · Pure scene mode'
          : 'Ei slottistriimejä juuri nyt · Puhdas skene -tila');
    return (
      <div
        data-testid="now-playing-ticker"
        data-state={hasCategoryStreams ? 'category-only' : 'empty'}
        data-category-count={categoryCount}
        style={{
          borderTop: '1px solid var(--hairline, #221E1B)',
          borderBottom: '1px solid var(--hairline, #221E1B)',
          padding: '9px 32px', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.10em',
          color: 'var(--muted, #9C9587)', opacity: 0.85,
        }}
      >
        <span style={{ fontWeight: 700, marginRight: 12 }}>{label}</span>
        ·
        <span style={{ marginLeft: 12 }}>{copy}</span>
      </div>
    );
  }

  // Build ticker payload — duplicate for seamless scroll
  const items = [...slots, ...slots];

  return (
    <div
      data-testid="now-playing-ticker"
      data-state="ok"
      style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        borderBottom: '1px solid var(--hairline, #221E1B)',
        padding: '10px 32px',
        display: 'flex', alignItems: 'center', gap: 18,
        overflow: 'hidden', position: 'relative',
      }}
    >
      <style>{`
        @keyframes slotsTicker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        [data-testid="now-playing-ticker"] .ticker-track {
          animation-name: slotsTicker;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        [data-testid="now-playing-ticker"]:hover .ticker-track,
        [data-testid="now-playing-ticker"]:focus-within .ticker-track {
          animation-play-state: paused;
        }
      `}</style>
      <span style={{
        flex: '0 0 auto', fontFamily: 'ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.22em', fontWeight: 700,
        color: 'var(--ink, #ECE6D8)', whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="ticker-track" ref={trackRef} style={{
          display: 'inline-flex', gap: 24, whiteSpace: 'nowrap',
          animationDuration: `${duration}s`,
        }}>
          {items.map((slot, i) => {
            const isActive = activeSlot && activeSlot.toLowerCase() === slot.name.toLowerCase();
            return (
              <button
                key={`${slot.name}-${i}`}
                type="button"
                data-testid="now-playing-item"
                data-slot={slot.name}
                onClick={() => onSlotClick?.(slot.name)}
                style={{
                  background: 'transparent', border: 0, padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  letterSpacing: '0.10em',
                  color: isActive ? '#D4B445' : 'var(--ink, #ECE6D8)',
                  opacity: isActive ? 1 : 0.85,
                  whiteSpace: 'nowrap',
                }}
              >
                {slot.name}
                <span style={{
                  marginLeft: 6, color: 'var(--muted, #9C9587)',
                  opacity: 0.7,
                }}>×{slot.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NowPlayingTicker;
