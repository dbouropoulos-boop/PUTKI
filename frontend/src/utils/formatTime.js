/**
 * formatTime - centralized bilingual relative time + locale helpers.
 *
 * Used everywhere we render "2 min sitten" / "2 min ago" style timestamps.
 * Keep this the ONLY source of truth so FI/EN flip cleanly.
 */

const LOCALE = { fi: 'fi-FI', en: 'en-GB' };

/**
 * Relative-time formatter, e.g. "3h sitten" vs "3h ago".
 * @param {string|Date|number|null|undefined} when ISO string, Date, or epoch ms.
 * @param {'fi'|'en'} lang
 */
export const formatTimeAgo = (when, lang = 'fi') => {
  if (when == null || when === '') return '-';
  try {
    const dt = when instanceof Date ? when : new Date(when);
    const secs = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
    if (lang === 'en') {
      if (secs < 5)     return 'just now';
      if (secs < 60)    return `${secs}s ago`;
      if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
      if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
      return `${Math.floor(secs / 86400)}d ago`;
    }
    if (secs < 5)     return 'juuri nyt';
    if (secs < 60)    return `${secs}s sitten`;
    if (secs < 3600)  return `${Math.floor(secs / 60)} min sitten`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h sitten`;
    return `${Math.floor(secs / 86400)}d sitten`;
  } catch {
    return '-';
  }
};

/**
 * Live-duration formatter (e.g. how long a stream has been on air).
 *   FI: "14h 9 min livenä"
 *   EN: "14h 9 min live"
 */
export const formatLiveDuration = (startedIso, lang = 'fi') => {
  if (!startedIso) return '';
  try {
    const start = new Date(startedIso);
    const mins  = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
    const h     = Math.floor(mins / 60);
    const m     = mins % 60;
    const tail  = lang === 'en' ? 'live' : 'livenä';
    if (h > 0) return `${h}h ${m} min ${tail}`;
    return `${m} min ${tail}`;
  } catch {
    return '';
  }
};

/**
 * Locale-aware date formatter for kickoff-style strings.
 *   FI: "to 22.5. · 19:00"
 *   EN: "Thu 22 May · 19:00"
 */
export const formatKickoff = (iso, lang = 'fi') => {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    const locale = LOCALE[lang] || LOCALE.fi;
    const date = new Intl.DateTimeFormat(locale, {
      weekday: 'short', day: 'numeric', month: 'numeric',
      timeZone: 'Europe/Helsinki',
    }).format(dt);
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki',
    }).format(dt);
    return `${date} · ${time}`;
  } catch {
    return '';
  }
};

/**
 * Locale-aware short date (no time).
 *   FI: "22.5.2026"
 *   EN: "22/05/2026"
 */
export const formatShortDate = (date, lang = 'fi') => {
  try {
    const dt = date instanceof Date ? date : new Date(date || Date.now());
    return dt.toLocaleDateString(LOCALE[lang] || LOCALE.fi);
  } catch {
    return '';
  }
};
