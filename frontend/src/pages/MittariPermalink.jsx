/**
 * MittariPermalink — /m/:slug
 *
 * Phase 1 Sprint 4 — stub historical-snapshot page for share links.
 * Slug format: {state-slug}-{YYYY-MM-DD}, e.g. `perkele-2026-05-18`.
 *
 * Backend: GET /api/dial/permalink/{STATE_KEY}/{date}
 * Returns recorded state event for that day, or {found:false}.
 *
 * Full visual treatment (chart + share buttons + related articles)
 * lands in Phase 2. Today's job: parse the slug, fetch the event,
 * render the Mittari reading at that moment, and emit clean OG meta
 * so previews on Telegram / iMessage / X work.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';
import { DIAL_STATES, dialReading, dialLabel } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Slug → state key mapping. The slug uses the lowercase label form
// (tyyni / vire / vipina / meininki / perkele) so it's human-readable.
const SLUG_TO_KEY = {
  tyyni:     'KYLMA',
  vire:      'HAALEA',
  vipina:    'KUUMA',
  'vipinä':  'KUUMA',
  meininki:  'MYRSKY',
  perkele:   'KIIRASTULI',
};

const parseSlug = (slug) => {
  if (!slug) return null;
  const m = /^([a-zäö]+)-(\d{4}-\d{2}-\d{2})$/i.exec(slug);
  if (!m) return null;
  const stateSlug = m[1].toLowerCase();
  const key = SLUG_TO_KEY[stateSlug] || null;
  return key ? { key, date: m[2], stateSlug } : null;
};

const formatFinnishDate = (iso, lang) => {
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
      day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(d);
  } catch { return iso; }
};

const MittariPermalink = () => {
  const { lang } = useLang();
  const { slug } = useParams();
  const parsed = parseSlug(slug);
  const [event, setEvent] = useState(null);
  const [ogImageUrl, setOgImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parsed) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/dial/permalink/${parsed.key}/${parsed.date}`);
        if (!r.ok) throw new Error('not ok');
        const d = await r.json();
        if (!cancelled) setEvent(d);
      } catch {
        if (!cancelled) setEvent({ found: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
      // OG image lookup runs in parallel with event lookup. Falls back
      // silently if not yet generated (kill switch / first run / disabled).
      try {
        const r = await fetch(`${BACKEND}/api/og/mittari/${parsed.key}/${parsed.date}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled && d?.found && d.url) {
          // The og endpoint returns a `/api/static/og/...` relative URL.
          // Resolve against BACKEND so social scrapers see an absolute path.
          const abs = d.url.startsWith('http') ? d.url : `${BACKEND}${d.url}`;
          setOgImageUrl(abs);
        }
      } catch { /* silent — share preview will fall back to no og:image */ }
    })();
    return () => { cancelled = true; };
  }, [parsed]);

  const stateDef = parsed ? DIAL_STATES[parsed.key] : null;
  const label = stateDef ? (lang === 'en' ? stateDef.label_en : stateDef.label) : '';
  const reading = parsed
    ? dialReading(parsed.key, lang, {
        streams: event?.twitch_live,
        viewers: event?.twitch_viewers,
      })
    : '';

  useDocumentMeta({
    title: parsed
      ? (lang === 'en'
          ? `Mittari was ${label} on ${formatFinnishDate(parsed.date, lang)} — PUTKI HQ`
          : `Mittari oli ${label} ${formatFinnishDate(parsed.date, 'fi')} — PUTKI HQ`)
      : 'Mittari — PUTKI HQ',
    description: parsed
      ? (lang === 'en'
          ? `Mittari reading: ${reading}`
          : `Mittari-lukema: ${reading}`)
      : '',
    canonical: `${BACKEND}/m/${slug}`,
    ogTitle: parsed ? `${label} · ${formatFinnishDate(parsed.date, 'fi')}` : 'Mittari',
    ogDescription: reading || '',
    ogUrl: `${BACKEND}/m/${slug}`,
    ogImage: ogImageUrl || '',
  });

  if (!parsed) {
    return (
      <div className="container-wide py-20" data-testid="mittari-permalink-invalid">
        <h1 className="display text-4xl mb-4">Mittari</h1>
        <p className="font-serif" style={{ color: 'var(--muted)', fontSize: 15 }}>
          {lang === 'en'
            ? 'Invalid share link. Use the share button on the homepage to create a valid Mittari permalink.'
            : 'Virheellinen jakolinkki. Käytä etusivun jakopainiketta luodaksesi kelvollisen Mittari-pysyväislinkin.'}
        </p>
        <Link to="/" className="mono mt-6 inline-block"
              style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline' }}>
          {lang === 'en' ? '← BACK TO PUTKI HQ' : '← TAKAISIN PUTKI HQ:HON'}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-wide py-12 sm:py-20" data-testid="mittari-permalink-page">
      <div className="mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        MITTARI · {formatFinnishDate(parsed.date, 'fi')}
      </div>
      <h1
        className="display"
        data-testid="mittari-permalink-state"
        style={{
          fontSize: 'clamp(56px, 12vw, 140px)',
          fontWeight: 800,
          color: stateDef?.color || 'var(--ink)',
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          marginBottom: 16,
        }}
      >
        {label}
      </h1>
      {loading ? (
        <p className="font-serif" style={{ color: 'var(--muted)', fontSize: 15 }}>
          {lang === 'en' ? 'Loading…' : 'Ladataan…'}
        </p>
      ) : event && event.found === false ? (
        <p
          data-testid="mittari-permalink-not-found"
          className="font-serif"
          style={{ color: 'var(--muted)', fontSize: 15, maxWidth: 600 }}
        >
          {lang === 'en'
            ? `No Mittari state-change event recorded for ${dialLabel(parsed.key, 'en')} on ${formatFinnishDate(parsed.date, 'en')}. State events are persisted for 365 days.`
            : `Mittari ei kirjannut tila-muutosta ${dialLabel(parsed.key, 'fi')} kohdalle ${formatFinnishDate(parsed.date, 'fi')}. Tila-tapahtumat säilytetään 365 päivää.`}
        </p>
      ) : (
        <>
          <p
            data-testid="mittari-permalink-reading"
            className="font-serif"
            style={{ color: 'var(--ink)', fontSize: 22, lineHeight: 1.4, maxWidth: 720, marginBottom: 28 }}
          >
            {reading}
          </p>
          <div className="mono"
               style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
            putkihq.fi/m/{slug}
          </div>
        </>
      )}
      <Link
        to="/"
        data-testid="mittari-permalink-back"
        className="mono mt-12 inline-block"
        style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline' }}
      >
        {lang === 'en' ? '← BACK TO PUTKI HQ' : '← TAKAISIN PUTKI HQ:HON'}
      </Link>
    </div>
  );
};

export default MittariPermalink;
