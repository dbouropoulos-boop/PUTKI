/**
 * PUTKI HQ - AboutStrip (Phase 1 Final · Chunk B).
 *
 * Compact "Who we are" editorial paragraph that lives on the homepage
 * between the ExploreBlocks and the EditorialFooter.
 *
 * Reuses i18n keys `tietoa.title` + `tietoa.lead`. Links through to the
 * full `/tietoa-meista` page.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const AboutStrip = () => {
  const { lang } = useLang();
  return (
    <section
      data-testid="home-about-strip"
      style={{
        borderTop: '1px solid var(--hairline, #221E1B)',
        padding: '40px 0 28px',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 280px) 1fr',
        gap: 56, alignItems: 'baseline',
      }} className="about-strip-grid">
        <div>
          <span style={{
            color: 'var(--muted, #9C9587)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', fontWeight: 700,
            textTransform: 'uppercase',
          }}>{lang === 'en' ? 'WHO WE ARE' : 'KEITÄ ME OLEMME'}</span>
          <h2 data-testid="about-strip-title" style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: 26, lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: '#FFFFFF',
            margin: '10px 0 0',
            maxWidth: 280,
          }}>{lang === 'en'
            ? 'Mittari measures. Editors interpret. You decide.'
            : 'Mittari mittaa. Toimitus tulkitsee. Sinä päätät.'}</h2>
        </div>
        <div>
          <p data-testid="about-strip-body" style={{
            color: 'var(--ink, #ECE6D8)', fontSize: 15.5, lineHeight: 1.65,
            margin: '0 0 18px', maxWidth: 720,
          }}>{lang === 'en'
            ? "PUTKI HQ is an independent newsroom covering Finland\u2019s casino, streamer and sports-betting scene. We aggregate from twelve named sources, classify every story with a deterministic algorithm, and require a cited outlet inside the first 400 characters of every article. We do not take operator deposits. We do not advertise gambling. Editorial \u2014 not advertising."
            : "PUTKI HQ on itsenäinen toimitus, joka seuraa Suomen kasino-, striimaaja- ja vedonlyönti­skeneä. Aggregoimme kahdestatoista nimetystä lähteestä, luokittelemme jokaisen jutun deterministisellä algoritmilla ja vaadimme nimeltä mainitun lähteen jokaisen artikkelin ensimmäisten 400 merkin sisällä. Emme ota operaattori­talletuksia. Emme mainosta rahapelejä. Toimitus \u2014 ei mainontaa."}</p>
          <Link
            to="/tietoa-meista"
            data-testid="about-strip-cta"
            style={{
              color: 'var(--ink, #ECE6D8)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11, letterSpacing: '0.18em', fontWeight: 700,
              textDecoration: 'underline', textUnderlineOffset: 4,
            }}
          >{lang === 'en' ? 'READ THE FULL MANIFESTO →' : 'LUE KOKO MANIFESTI →'}</Link>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .about-strip-grid {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }
        }
      `}</style>
    </section>
  );
};

export default AboutStrip;
