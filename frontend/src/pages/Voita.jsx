/**
 * Voita — Guess-the-winner raffle (/voita).
 *
 * GATED. The feature flag `voita_feature_enabled` lives in
 * /api/settings/public (admin-toggleable via PUT /api/admin/settings).
 *
 * When disabled (default), renders the "Pian saatavilla" placeholder
 * matching the design mock. When enabled, renders the active raffle.
 *
 * IMPORTANT: Per the Phase 1 brief — do not capture any emails on this
 * page until the user provides explicit legal sign-off from "Sako".
 * Until then the page collects ZERO PII even when the flag is on.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Voita = () => {
  const { lang } = useLang();
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useDocumentMeta({
    title: lang === 'en' ? 'Voita — Coming soon · PUTKI HQ' : 'Voita — Tulossa · PUTKI HQ',
    description: lang === 'en'
      ? "PUTKI HQ's guess-the-winner raffle. Opens after editorial legal review."
      : 'PUTKI HQ:n voittoennustus-arvonta. Avautuu toimituksellisen lain­opillisen tarkistuksen jälkeen.',
    canonical: `${BACKEND}/voita`,
  });

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => { if (!stop) { setEnabled(!!d.voita_feature_enabled); setLoaded(true); } })
      .catch(() => { if (!stop) setLoaded(true); });
    return () => { stop = true; };
  }, []);

  return (
    <div data-testid="voita-page" style={{
      maxWidth: 1180, margin: '0 auto', padding: '0 32px',
    }}>
      {/* HERO — gated state */}
      <section data-testid={enabled ? 'voita-hero-active' : 'voita-hero-gated'} style={{
        position: 'relative',
        padding: '64px 0 48px',
        minHeight: 320,
        overflow: 'hidden',
      }}>
        {/* watermark VOITA */}
        <span aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: '5%',
          fontFamily: 'Georgia, serif', fontWeight: 900,
          fontSize: 'clamp(180px, 28vw, 320px)',
          letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.025)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>VOITA</span>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 720 }}>
          <span style={{
            color: '#C13B2C',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', fontWeight: 700,
          }}>{enabled
            ? (lang === 'en' ? 'VOITA · LIVE' : 'VOITA · KÄYNNISSÄ')
            : (lang === 'en' ? 'VOITA · COMING SOON' : 'VOITA · TULOSSA')}</span>

          {!loaded ? (
            <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 48, margin: '14px 0' }}>…</h1>
          ) : enabled ? (
            <>
              <h1 data-testid="voita-active-title" style={{
                fontFamily: 'Georgia, serif', fontWeight: 700,
                fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
                letterSpacing: '-0.02em', color: '#FFFFFF',
                margin: '12px 0 18px',
              }}>{lang === 'en'
                ? 'Predict the winner. Win the prize.'
                : 'Arvaa voittaja. Voita palkinto.'}</h1>
              <p style={{
                color: 'var(--ink, #ECE6D8)', fontSize: 16, lineHeight: 1.55,
                maxWidth: 580, margin: 0,
              }}>{lang === 'en'
                ? "This week's raffle is live. Pick your winner — editorial team draws the prize after the match. Free to enter. No deposit. No betting."
                : "Tämän viikon arvonta on käynnissä. Valitse voittajasi — toimitus arpoo palkinnon ottelun jälkeen. Ilmainen osallistua. Ei talletusta. Ei vedonlyöntiä."}</p>
              <div style={{ marginTop: 24, color: 'var(--muted, #9C9587)',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.18em', fontWeight: 600,
              }} data-testid="voita-active-form-stub">
                {/* The actual form lands here once Sako legal sign-off
                    arrives and we're cleared to capture predictions. */}
                FORM CAPTURE — DEFERRED PENDING LEGAL SIGN-OFF
              </div>
            </>
          ) : (
            <>
              <h1 data-testid="voita-placeholder" style={{
                fontFamily: 'Georgia, serif', fontWeight: 700,
                fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
                letterSpacing: '-0.02em', color: '#FFFFFF',
                margin: '12px 0 18px',
              }}>{lang === 'en' ? 'Coming soon' : 'Pian saatavilla'}</h1>
              <p style={{
                color: 'var(--ink, #ECE6D8)', fontSize: 16, lineHeight: 1.55,
                maxWidth: 580, margin: '0 0 22px',
              }}>{lang === 'en'
                ? "PUTKI HQ's guess-the-winner editorial raffle. Coming after legal review. Free to enter, no deposit, no betting. Sports prediction only — pick the winner, editorial draws the prize."
                : "PUTKI HQ:n voittajan-ennustus-arvonta. Avautuu lain­opillisen tarkistuksen jälkeen. Ilmainen osallistua, ei talletusta, ei vedonlyöntiä. Vain urheilun ennustamista — arvaa voittaja, toimitus arpoo palkinnon."}</p>
              <span data-testid="voita-disabled-cta" style={{
                color: 'var(--muted, #9C9587)',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.18em', fontWeight: 700,
              }}>{lang === 'en' ? 'AWAITING APPROVAL' : 'ODOTTAA HYVÄKSYNTÄÄ'}</span>
            </>
          )}
        </div>
      </section>

      {/* WHAT TO EXPECT — works for both states */}
      <section data-testid="voita-explainer" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '32px 0',
      }}>
        <span style={{
          color: 'var(--muted, #9C9587)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, display: 'block',
          marginBottom: 14,
        }}>{lang === 'en' ? 'WHAT TO EXPECT' : 'MITÄ ODOTTAA'}</span>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1, background: 'var(--hairline, #221E1B)',
        }} className="voita-explainer-grid">
          {[
            ['01', lang === 'en' ? 'Pick the winner' : 'Valitse voittaja',
             lang === 'en' ? 'Choose between teams or competitors in the marquee match of the week.' : 'Valitse joukkueiden tai kilpailijoiden välillä viikon kärki­ottelussa.'],
            ['02', lang === 'en' ? 'Editorial draws' : 'Toimitus arpoo',
             lang === 'en' ? 'Among correct predictions, the editorial team draws one winner. No algorithm picks.' : 'Oikeiden ennustusten joukosta toimitus arpoo yhden voittajan. Algoritmi ei valitse.'],
            ['03', lang === 'en' ? 'Prize on your terms' : 'Palkinto sinun ehdoillasi',
             lang === 'en' ? 'Editorial product — no deposit, no betting, no operator account required.' : 'Toimituksellinen tuote — ei talletusta, ei vedonlyöntiä, ei operaattori­tiliä.'],
          ].map(([n, t, b]) => (
            <div key={n} style={{
              padding: '20px 22px',
              background: 'var(--surface, #141210)',
            }}>
              <div style={{
                color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
                fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1,
              }}>{n}</div>
              <div style={{
                color: '#FFFFFF', fontFamily: 'Georgia, serif',
                fontWeight: 700, fontSize: 17, marginTop: 8, marginBottom: 6,
              }}>{t}</div>
              <p style={{
                color: 'var(--ink, #ECE6D8)', fontSize: 13, lineHeight: 1.5,
                margin: 0, opacity: 0.88,
              }}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Editorial position pointer */}
      <section data-testid="voita-position" style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '24px 0 48px',
      }}>
        <p style={{
          color: 'var(--muted, #9C9587)', fontSize: 12.5, margin: 0,
          fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em',
          lineHeight: 1.7,
        }}>{lang === 'en'
          ? 'Read the full editorial position on '
          : 'Lue koko toimituksellinen kanta sivulla '}
          <Link to="/tietoa-meista" style={{
            color: 'var(--ink, #ECE6D8)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>{lang === 'en' ? 'About' : 'Tietoa meistä'}</Link>.</p>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .voita-explainer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Voita;
