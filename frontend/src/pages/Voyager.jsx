/**
 * Voyager — `/game` weekly editorial pick.
 *
 * Source-of-truth spec: PUTKI HQ — Voyager Page Spec (Section 1-10).
 * Reader frame: "what did PUTKI HQ pick this week", not "claim your bonus".
 *
 * Spine (top-to-bottom):
 *   1. Masthead (← PUTKI HQ · VOYAGER · GAME OF THE WEEK)
 *   2. Standfirst (eyebrow · headline · verdict · "kokeilimme itse")
 *   3. Game block (Smartico embed)
 *   4. Pass (visible artifact carrying visitor_win_uuid) — shows on win
 *   5. Review (operator review card — the editorial bubble)
 *   6. Redeem CTA → operator (only after win)
 *   7. Next week + signup routing
 *
 * Phasing: week-1 content is the WEEK_1 default. The back-office
 * rotation calendar (settings.voyager_rotation → /api/voyager/active)
 * overrides per week. The page contract here does not change.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

import WEEK_1 from '../components/voyager/defaults';
import Masthead from '../components/voyager/Masthead';
import Standfirst from '../components/voyager/Standfirst';
import GameBlock from '../components/voyager/GameBlock';
import Pass from '../components/voyager/Pass';
import Review from '../components/voyager/Review';
import Redeem from '../components/voyager/Redeem';
import NextWeek from '../components/voyager/NextWeek';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Voyager = () => {
  const { lang } = useLang();
  const [prize, setPrize] = useState(null);
  // Active week from the back-office rotation calendar. Until the fetch
  // resolves we render the locked WEEK_1 so first paint is content-shift-free.
  const [activeWeek, setActiveWeek] = useState(WEEK_1);

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/voyager/active`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (stop || !d || !d.active) return;
        // Adapter: backend stores top-level flat keys (verdict_fi /
        // tried_en / etc) whereas components expect nested {fi,en}.
        // Translate once so we don't touch every consumer.
        const a = d.active;
        setActiveWeek({
          ...WEEK_1,
          ...a,
          verdict: { fi: a.verdict_fi || WEEK_1.verdict.fi, en: a.verdict_en || WEEK_1.verdict.en },
          tried: { fi: a.tried_fi || WEEK_1.tried.fi, en: a.tried_en || WEEK_1.tried.en },
          game: { ...WEEK_1.game, ...(a.game || {}) },
          operator: { ...WEEK_1.operator, ...(a.operator || {}) },
          prize: { ...WEEK_1.prize, ...(a.prize || {}) },
          review_points: (a.review_points && a.review_points.length)
            ? a.review_points : WEEK_1.review_points,
        });
      })
      .catch((e) => { console.warn('[voyager] fetch active failed', e); });
    return () => { stop = true; };
  }, []);

  useDocumentMeta({
    title: lang === 'en'
      ? `Voyager · ${activeWeek.game.title_en} × ${activeWeek.operator.name} — PUTKI HQ`
      : `Voyager · ${activeWeek.game.title_fi} × ${activeWeek.operator.name} — PUTKI HQ`,
    description: lang === 'en'
      ? `PUTKI HQ's pick of the week: play ${activeWeek.game.title_en}, win free spins, redeem at ${activeWeek.operator.name}. Editorial review attached.`
      : `PUTKI HQ:n viikon valinta: pelaa ${activeWeek.game.title_fi}, voita ilmaiskierroksia, lunasta ${activeWeek.operator.name}illä. Toimituksellinen arvostelu mukana.`,
    canonical: `${BACKEND}/game`,
  });

  // Smartico onWin handler — captures the prize and scrolls to the pass.
  const onWin = useCallback((p) => {
    setPrize(p || {});
    try {
      setTimeout(() => {
        const el = document.querySelector('[data-testid="voyager-pass"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 280);
    } catch (e) { console.debug('[voyager] scroll to pass failed', e); }
  }, []);

  return (
    <div data-testid="voyager-page" style={{ background: 'var(--bg)' }}>
      <Masthead lang={lang} />
      <Standfirst lang={lang} rotationISO={activeWeek.next_rotation_iso} week={activeWeek} />
      <GameBlock lang={lang} onWin={onWin} game={activeWeek.game} />
      <AnimatePresence>{prize && <Pass lang={lang} prize={prize} week={activeWeek} />}</AnimatePresence>
      <Review lang={lang} week={activeWeek} />
      {prize && <Redeem lang={lang} prize={prize} week={activeWeek} />}
      <NextWeek lang={lang} rotationISO={activeWeek.next_rotation_iso} />
    </div>
  );
};

export default Voyager;
