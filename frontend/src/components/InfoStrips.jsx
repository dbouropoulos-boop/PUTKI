/**
 * PUTKI HQ — InfoStrips (Phase 1 sprint follow-up).
 *
 * Two thin info strips that sit immediately under the rolling news ticker:
 *
 *   1. OrientationStrip — static, copy-switches between first-visit and
 *      returning copy via `localStorage`. No cookie consent needed
 *      (legitimate-interest non-tracking flag).
 *   2. NewsroomLiveStrip — monospace metric strip with stories-today /
 *      named-outlets / last-publish-age / Mittari score & delta /
 *      "UPDATED LIVE". Refreshes every 30s.
 *
 * Both honour PUTKI HQ's editorial register: low contrast, no animation,
 * no dismissal, no decoration.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'putki_visited';

// ── OrientationStrip ───────────────────────────────────────────────────
export const OrientationStrip = () => {
  const { lang } = useLang();
  const [firstVisit, setFirstVisit] = useState(true);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      setFirstVisit(!seen);
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Strict cookie / private mode — show first-visit copy, never set flag
    }
  }, []);

  const firstCopy = lang === 'en'
    ? "PUTKI HQ · Finland\u2019s independent gambling-culture publication · News from 12 outlets · Streamer scene · Market signals · "
    : "PUTKI HQ · Suomen riippumaton rahapelijulkaisu · Uutiset 12 lähteestä · Striimiskene · Markkinasignaalit · ";
  const returningCopy = lang === 'en'
    ? "PUTKI HQ · 12 sources · Editorial — not advertising · "
    : "PUTKI HQ · 12 lähdettä · Toimituksellinen — ei mainontaa · ";

  return (
    <div
      data-testid="orientation-strip"
      data-first-visit={firstVisit ? '1' : '0'}
      style={{
        background: 'var(--bg, #0B0A09)',
        borderBottom: '1px solid var(--hairline, #221E1B)',
        padding: '7px 32px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 10.5,
        letterSpacing: '0.06em',
        color: 'var(--ink, #ECE6D8)',
        opacity: 0.55,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {firstVisit ? firstCopy : returningCopy}
      <Link
        to="/menetelma"
        data-testid="orientation-strip-method-link"
        style={{
          color: 'var(--amber, #C97A3A)',
          textDecoration: 'underline', textUnderlineOffset: 3,
        }}
      >/menetelma{firstVisit ? '' : ' →'}</Link>
    </div>
  );
};

// ── NewsroomLiveStrip ──────────────────────────────────────────────────
export const NewsroomLiveStrip = () => {
  const { lang } = useLang();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND}/api/newsroom/live-stats`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancelled && d) { setStats(d); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <div
        data-testid="newsroom-live-strip"
        data-state="loading"
        style={{
          background: 'var(--bg, #0B0A09)',
          borderBottom: '1px solid var(--hairline, #221E1B)',
          padding: '7px 32px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--muted, #9C9587)',
          opacity: 0.55,
        }}
      >
        NEWSROOM · LOADING…
      </div>
    );
  }
  if (!stats) return null;

  const delta = stats.mittari_delta;
  const arrow = delta == null ? '' : (delta > 0 ? '▲' : (delta < 0 ? '▼' : '─'));
  const arrowColor = delta == null
    ? 'var(--muted, #9C9587)'
    : (delta > 0 ? '#6FA37D' : (delta < 0 ? '#C13B2C' : 'var(--muted, #9C9587)'));

  return (
    <div
      data-testid="newsroom-live-strip"
      data-state="ok"
      style={{
        background: 'var(--bg, #0B0A09)',
        borderBottom: '1px solid var(--hairline, #221E1B)',
        padding: '7px 32px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 10,
        letterSpacing: '0.14em',
        color: 'var(--ink, #ECE6D8)',
        opacity: 0.55,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textTransform: 'uppercase',
      }}
    >
      <span>NEWSROOM</span>
      <span style={{ opacity: 0.45, margin: '0 9px' }}>·</span>
      <span data-testid="newsroom-stories-today">{stats.stories_today} {lang === 'en' ? 'STORIES TODAY' : 'JUTTUA TÄNÄÄN'}</span>
      <span style={{ opacity: 0.45, margin: '0 9px' }}>·</span>
      <span data-testid="newsroom-named-outlets">{stats.named_outlets} {lang === 'en' ? 'NAMED OUTLETS' : 'NIMETTYÄ LÄHDETTÄ'}</span>
      <span style={{ opacity: 0.45, margin: '0 9px' }}>·</span>
      <span data-testid="newsroom-last-publish">
        {lang === 'en' ? 'LAST PUBLISH ' : 'VIIMEISIN '}{stats.last_publish_minutes_ago == null ? '—' : `${stats.last_publish_minutes_ago}m`}{lang === 'en' ? ' AGO' : ''}
      </span>
      {stats.mittari_score != null && (
        <>
          <span style={{ opacity: 0.45, margin: '0 9px' }}>·</span>
          <span data-testid="newsroom-mittari">
            MITTARI {stats.mittari_score}
            {arrow && (
              <span style={{ color: arrowColor, marginLeft: 6 }}>
                {arrow} {delta == null ? '' : Math.abs(delta)}
              </span>
            )}
          </span>
        </>
      )}
      <span style={{ opacity: 0.45, margin: '0 9px' }}>·</span>
      <span data-testid="newsroom-live-tag" style={{ color: '#6FA37D' }}>
        {lang === 'en' ? 'UPDATED LIVE' : 'PÄIVITTYY LIVENÄ'}
      </span>
    </div>
  );
};

export default { OrientationStrip, NewsroomLiveStrip };
