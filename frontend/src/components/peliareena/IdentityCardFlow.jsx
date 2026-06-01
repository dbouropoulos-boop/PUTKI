/**
 * PUTKI HQ - IdentityCardFlow (iter63 · revised iter93)
 *
 * Drop-in replacement for the per-game preview/email-gate block.
 * Reads the `card` payload built server-side (mini_game_card.py) and
 * renders the identity-first reveal flow.
 *
 * Phase 3 · iter93 — `MicroYesGate` (email capture) removed. Mini-games
 * are repositioned as pure educational surfaces — readers play to learn
 * the psychology of gambling, with NO email required. The previous
 * funnel reactivates via the `enableGate` prop when (and only when)
 * editorial decides to re-monetise mini-games.
 *
 * Props:
 *   preview     - full backend preview/finish response. Must include
 *                 `card`, `persona_preview`, `week_iso`.
 *   session     - { play_id, anon_id } (kept for downstream analytics,
 *                 still recorded server-side even without email)
 *   gameSlug    - for share-tracking + testids (e.g. "quiz")
 *   unlockPath  - retained but unused while enableGate=false. Reserved
 *                 for future re-activation.
 *   onUnlocked  - reserved for future re-activation.
 *   enableGate  - opt-in flag (default false). True → render the legacy
 *                 MicroYesGate; false → render the no-email positioning
 *                 strip.
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

const NoEmailPositioning = ({ lang, gameSlug }) => (
  <div data-testid={`${gameSlug}-no-email-positioning`} style={{
    marginTop: 28, padding: '20px 22px',
    background: 'var(--surface)',
    border: '1px solid var(--line, var(--border))',
    borderLeft: '3px solid var(--ember, #D9461E)',
    fontFamily: 'Inter, system-ui, sans-serif',
  }}>
    <div style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
      color: 'var(--ember-strong, #B53618)', marginBottom: 8,
      textTransform: 'uppercase',
    }}>{lang === 'en' ? 'NO EMAIL REQUIRED' : 'EI SÄHKÖPOSTIA TARVITA'}</div>
    <p style={{
      fontSize: 15, lineHeight: 1.55, color: 'var(--ink)',
      margin: 0,
    }}>{lang === 'en'
      ? 'Play a moment — learn the psychology of gambling. No email required.'
      : 'Pelaa hetki — opi pelaamisen psykologiasta. Ei sähköpostia tarvita.'}</p>
  </div>
);

const IdentityCardFlow = ({
  preview,
  session,
  gameSlug,
  unlockPath,
  onUnlocked,
  enableGate = false,
}) => {
  const { lang } = useLang();
  const card = preview?.card || {};
  const persona = preview?.persona_preview || {};
  const profileTitle = (lang === 'en' && persona.title_en) || persona.title || '-';
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
      {enableGate ? (
        <MicroYesGate
          gameSlug={gameSlug}
          unlockPath={unlockPath}
          session={session}
          profileTitle={profileTitle}
          personaKey={persona.key || ''}
          readLine={pickLang(card, 'read_line', lang)}
          onUnlocked={onUnlocked}
        />
      ) : (
        <NoEmailPositioning lang={lang} gameSlug={gameSlug} />
      )}
    </div>
  );
};

export default IdentityCardFlow;
