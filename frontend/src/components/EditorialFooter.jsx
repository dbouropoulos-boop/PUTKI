import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

// PUTKI HQ editorial accountability footer - per V2 Master Brief §10.3.
// Sits at the bottom of every editorial piece (profile, scene news, money commentary,
// cultural feature, game literacy, etc.). Carries byline + päivitetty timestamp +
// read time + change-log link. Placeholder "PUTKI HQ" until real bylines exist.
//
// Props:
//   - byline (default 'PUTKI HQ')
//   - updatedAt (ISO string; falls back to today)
//   - readMinutes (default 4)
//   - versionHref (default /paivityslog)

const fmtDate = (iso, lang) => {
  try {
    const d = iso ? new Date(iso) : new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    if (lang === 'en') return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    return `${dd}.${mm}.${yyyy} klo ${hh}:${mi}`;
  } catch {
    return '';
  }
};

export const EditorialFooter = ({
  byline = 'PUTKI HQ',
  updatedAt = null,
  readMinutes = 4,
  versionHref = '/paivityslog',
}) => {
  const { lang } = useLang();
  const stamp = fmtDate(updatedAt, lang);
  const readLabel = lang === 'en' ? `READ TIME ${readMinutes} MIN` : `LUKUAIKA ${readMinutes} MIN`;
  const updatedLabel = lang === 'en' ? `UPDATED ${stamp}` : `PÄIVITETTY ${stamp}`;
  const changesLabel = lang === 'en' ? 'CHANGES →' : 'MUUTOKSET →';

  return (
    <div
      data-testid="editorial-footer"
      className="mt-10 pt-6 flex flex-wrap items-center gap-x-6 gap-y-2"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 700 }}>
        {byline}
      </span>
      <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
        {updatedLabel}
      </span>
      <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
        {readLabel}
      </span>
      <Link to={versionHref} className="mono" data-testid="editorial-footer-changes" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--brand-blue, #5A7BB8)', fontWeight: 700 }}>
        {changesLabel}
      </Link>
    </div>
  );
};

export default EditorialFooter;
