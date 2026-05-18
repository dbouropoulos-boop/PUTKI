/**
 * MittariStreak — Phase 1 Sprint 4 (Section 12a).
 *
 * Small low-contrast line under the dial section:
 *   • Between events:  "Viimeisin PERKELE: 14 päivää sitten"
 *   • During PERKELE:  "PERKELE — ensimmäinen kerta 14 päivään"
 *
 * Silent when no history yet (first deployment).
 */
import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 10 * 60_000;  // refresh every 10 min — streak rarely changes

const MittariStreak = () => {
  const { lang } = useLang();
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/dial/streak`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setStreak(d);
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!streak || !streak.label_fi) return null;

  return (
    <div
      data-testid="mittari-streak"
      className="mono mt-3"
      style={{
        fontSize: 10.5,
        letterSpacing: '0.16em',
        color: 'var(--muted)',
        fontWeight: 600,
      }}
    >
      {lang === 'en' ? streak.label_en : streak.label_fi}
    </div>
  );
};

export default MittariStreak;
