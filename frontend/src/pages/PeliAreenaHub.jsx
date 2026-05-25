/**
 * PUTKI HQ - /peliareena (Behavioral Profiler Hub) · iter64 pivot
 *
 * Capture-first single-flagship hub. The five-game arcade has been
 * killed (Snake / Tap / Insight / Quiz) and the behavioral profiler
 * is the ONLY entry point. Goal: drive every visitor into the
 * scenario profiler in <10 seconds.
 *
 * Design:
 *   • Single hero - "What kind of gambler are you really?"
 *   • One bold CTA → /peliareena/paatospolku
 *   • Trust signals row sits NEXT to the CTA (not below)
 *   • Social-proof line hidden until ≥50 plays exist (no "0 ranked players")
 *   • 5-profile preview strip - primes the user with the spectrum
 *     they'll be placed on
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Lock, Clock3 } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { pickPA } from '../i18n/peliareena';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// 5-profile spectrum preview (must match backend SCENARIO_PERSONAS keys)
const PROFILE_STRIP = [
  { key: 'cold_calculator',   fi: 'Kylmä laskija',         en: 'The Cold Calculator',   tone: 'high'   },
  { key: 'patient_tactician', fi: 'Kärsivällinen taktikko', en: 'The Patient Tactician', tone: 'high'   },
  { key: 'streak_chaser',     fi: 'Putken jahti',          en: 'The Streak Chaser',     tone: 'mid'    },
  { key: 'comeback_believer', fi: 'Comeback-uskoja',       en: 'The Comeback Believer', tone: 'low'    },
  { key: 'tilt_risk',         fi: 'Tilt-riski',            en: 'The Tilt Risk',         tone: 'lowest' },
];

const TONE_COLOR = {
  high:   '#3F8A4D',
  mid:    '#b07d18',
  low:    '#C8423C',
  lowest: '#7A2E2C',
};

const PeliAreenaHub = () => {
  const { lang } = useLang();
  const [hub, setHub] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/mini-games/hub`)
      .then(r => r.json())
      .then(setHub)
      .catch(() => {});
  }, []);

  // Social proof - only surface when honest (>= 50 finished plays this week)
  const playsThisWeek = hub?.tournament?.plays_this_week || 0;
  const showSocialProof = playsThisWeek >= 50;

  return (
    <div data-testid="peliareena-hub" style={{
      padding: '60px 24px 80px', maxWidth: 900, margin: '0 auto',
    }}>
      <div className="mono" style={{
        fontSize: 11, letterSpacing: '0.22em',
        color: '#b07d18', fontWeight: 700, marginBottom: 20,
      }}>
        {lang === 'en' ? 'PUTKI HQ · BEHAVIORAL PROFILER' : 'PUTKI HQ · PELAAJAPROFIILI'}
      </div>

      <h1 data-testid="hub-headline" style={{
        fontFamily: 'Georgia, Fraunces, serif', fontWeight: 700,
        fontSize: 'clamp(36px, 6vw, 60px)', lineHeight: 1.04,
        letterSpacing: '-0.02em', color: 'var(--ink)',
        margin: '0 0 18px', maxWidth: 760,
      }}>
        {lang === 'en'
          ? 'What kind of gambler are you really?'
          : 'Millainen pelaaja olet oikeasti?'}
      </h1>

      <p style={{
        fontFamily: 'Georgia, Newsreader, serif',
        fontSize: 19, lineHeight: 1.5, color: 'var(--muted)',
        maxWidth: 620, margin: '0 0 36px',
      }}>
        {lang === 'en'
          ? 'Six honest decisions. No trivia, no scores to memorise - just situations you\'ve already lived. We name your blind spot at the end. Free.'
          : 'Kuusi rehellistä päätöstä. Ei tietovisaa, ei pisteitä opeteltavaksi - vain tilanteita, jotka olet jo elänyt. Nimeämme sokean pisteesi lopussa. Ilmainen.'}
      </p>

      {/* Primary CTA + trust row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: 18, marginBottom: 44,
      }}>
        <Link
          to="/peliareena/paatospolku"
          data-testid="hub-start-cta"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--ink)', color: 'var(--bg)',
            padding: '18px 28px', borderRadius: 4, textDecoration: 'none',
            fontFamily: 'ui-monospace, JetBrains Mono, monospace',
            fontSize: 13, fontWeight: 700,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            transition: 'transform 180ms ease, background 180ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#b07d18'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {lang === 'en' ? 'Start the profiler · 90 seconds' : 'Aloita profilointi · 90 sekuntia'}
          <ChevronRight size={16} strokeWidth={2.4} />
        </Link>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px 18px',
          fontFamily: 'ui-monospace, JetBrains Mono, monospace',
          fontSize: 11, color: 'var(--muted)',
        }}>
          {[
            { icon: ShieldCheck, label: lang === 'en' ? 'No money · no card' : 'Ei rahaa · ei korttia' },
            { icon: Lock,        label: lang === 'en' ? 'GDPR · independent' : 'GDPR · riippumaton' },
            { icon: Clock3,      label: lang === 'en' ? '~90 seconds'        : '~90 sekuntia' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon size={12} strokeWidth={1.6} style={{ color: '#3f7d4a' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 5-profile spectrum preview */}
      <div data-testid="hub-spectrum" style={{
        borderTop: '1px solid var(--border)', paddingTop: 26, marginBottom: 36,
      }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: '0.22em',
          color: 'var(--muted)', fontWeight: 700, marginBottom: 14,
        }}>
          {lang === 'en' ? 'THE FIVE PROFILES YOU MIGHT LAND ON' : 'VIISI PROFIILIA, JOIHIN VOIT PÄÄTYÄ'}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}>
          {PROFILE_STRIP.map((p, i) => (
            <div key={p.key} data-testid={`hub-profile-${p.key}`} style={{
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${TONE_COLOR[p.tone]}`,
              padding: '14px 14px 16px',
              borderRadius: 3,
              background: 'var(--surface)',
            }}>
              <div className="mono" style={{
                fontSize: 9.5, letterSpacing: '0.13em',
                color: TONE_COLOR[p.tone], fontWeight: 700, marginBottom: 6,
              }}>
                {`0${i + 1} / 05`}
              </div>
              <div style={{
                fontFamily: 'Georgia, Fraunces, serif', fontSize: 16,
                fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2,
              }}>
                {lang === 'en' ? p.en : p.fi}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Social proof (only when honest) */}
      {showSocialProof && (
        <p data-testid="hub-social-proof" style={{
          fontFamily: 'ui-monospace, JetBrains Mono, monospace',
          fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em',
          margin: '0 0 28px',
        }}>
          {lang === 'en'
            ? `${playsThisWeek.toLocaleString('en-US')} people completed the profiler this week.`
            : `${playsThisWeek.toLocaleString('fi-FI')} ihmistä on suorittanut profilointin tällä viikolla.`}
        </p>
      )}

      {/* Honest fine print */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 22,
        fontFamily: 'Georgia, Newsreader, serif',
        fontSize: 13, lineHeight: 1.55, color: 'var(--muted)',
        maxWidth: 680,
      }}>
        <div className="mono" style={{
          fontSize: 9.5, letterSpacing: '0.22em',
          color: 'var(--ink)', fontWeight: 700, marginBottom: 8,
        }}>
          {lang === 'en' ? 'HONEST FINE PRINT' : 'REHELLINEN PIENI PRINTTI'}
        </div>
        {lang === 'en'
          ? 'The profiler is free. We ask for one email only after we\'ve named your profile and one blind spot - at peak curiosity, at your choice. No card details, no purchase, no third-party sharing. Cancel any time.'
          : 'Profilointi on ilmainen. Pyydämme yhden sähköpostin vasta kun profiili ja yksi sokea piste on nimetty - uteliaisuuden hetkellä, sinun valinnallasi. Ei korttitietoja, ei ostoa, ei kolmansille osapuolille. Peru milloin tahansa.'}
        {' '}
        <Link to="/tietosuoja" style={{ color: 'var(--ink)' }}>
          {lang === 'en' ? 'Privacy policy' : 'Tietosuojaseloste'}
        </Link>.
      </div>
    </div>
  );
};

export default PeliAreenaHub;
