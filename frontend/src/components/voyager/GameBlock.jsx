/**
 * Voyager - The Game block (Smartico embed).
 *
 * Reuses the shared <SmarticoGame> component (idempotent SDK loader)
 * with the week's game template_id / brand_key / visitor_key.
 */
import React from 'react';
import SmarticoGame from '../SmarticoGame';

const GameBlock = ({ lang, onWin, game }) => (
  <section data-testid="voyager-game-block" style={{
    padding: '28px 16px',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
  }}>
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 14,
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)',
        }}>{lang === 'en' ? 'THE GAME · PLAY NOW' : 'PELI · PELAA NYT'}</span>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', fontWeight: 600, color: 'var(--muted)',
        }}>{lang === 'en' ? 'FREE · NO ACCOUNT · 18+' : 'ILMAINEN · EI TILIÄ · 18+'}</span>
      </div>
      <SmarticoGame
        template_id={game.template_id}
        brand_key={game.brand_key}
        visitor_key={game.visitor_key}
        lang={(lang || 'fi').toUpperCase()}
        frame_id="voyager-game-frame"
        onWin={onWin}
        testid="voyager-smartico-frame"
      />
    </div>
  </section>
);

export default GameBlock;
