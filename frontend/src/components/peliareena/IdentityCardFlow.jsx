/**
 * PUTKI HQ — IdentityCardFlow (iter63)
 *
 * Drop-in replacement for the per-game preview/email-gate block.
 * Reads the `card` payload built server-side (mini_game_card.py) and
 * renders the identity-first reveal + micro-yes ladder flow.
 *
 * Props:
 *   preview     — full backend preview/finish response. Must include
 *                 `card`, `persona_preview`, `week_iso`.
 *   session     — { play_id, anon_id }
 *   gameSlug    — for share-tracking + testids (e.g. "quiz")
 *   unlockPath  — backend path to call on email submit
 *   onUnlocked  — (full_result) => void; called when the email gate
 *                 successfully unlocks the full personalised result.
 */
import React from 'react';
import IdentityResultCard from './IdentityResultCard';
import MicroYesGate from './MicroYesGate';
import { useLang } from '../../context/LanguageContext';
import { pickPA } from '../../i18n/peliareena';

const pickLang = (card, base, lang) => {
  if (!card) return '';
  const en = card[`${base}_en`];
  const fi = card[`${base}_fi`];
  if (lang === 'en' && en) return en;
  return fi || en || '';
};

const IdentityCardFlow = ({
  preview,
  session,
  gameSlug,
  unlockPath,
  onUnlocked,
}) => {
  const { lang } = useLang();
  const card = preview?.card || {};
  const persona = preview?.persona_preview || {};
  const profileTitle = (lang === 'en' && persona.title_en) || persona.title || '—';
  const weekISO = preview?.week_iso || '';

  return (
    <div data-testid={`${gameSlug}-identity-flow`}>
      <IdentityResultCard
        weekISO={weekISO}
        profileIndex={card.profile_index || '01 / 01'}
        profileTitle={profileTitle}
        verdict={pickLang(card, 'verdict', lang)}
        statLabel={pickLang(card, 'stat_label', lang)}
        statValue={Number(card.stat_value || 0)}
        statFootnote={pickLang(card, 'stat_footnote', lang)}
        hookText={pickLang(card, 'hook_text', lang)}
        weekLabel={pickPA(lang, 'intro.weekLabel')}
      />
      <MicroYesGate
        gameSlug={gameSlug}
        unlockPath={unlockPath}
        session={session}
        profileTitle={profileTitle}
        readLine={pickLang(card, 'read_line', lang)}
        onUnlocked={onUnlocked}
      />
    </div>
  );
};

export default IdentityCardFlow;
