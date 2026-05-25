/**
 * Mestari · Diagnostic chooser hub.
 *
 * iter75 rebuild: punchier copy, sport-tinted cards with mini archetype
 * preview, social-proof strip at the top, academic METHOD block
 * demoted to a one-line footer trust note. Cards link into the same
 * `/mestari/{sports|poker|blackjack}` funnels - no router changes.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const BLUE = '#5B8DEE';

// Per-surface visual accent so the cards have distinct identity rather
// than reading as three near-identical tiles.
const SPORT_ACCENT = {
  sports:    { tint: '#FF8A42', emoji: '⚽', label_fi: 'URHEILU',  label_en: 'SPORTS' },
  poker:     { tint: '#5BA0E8', emoji: '♠',  label_fi: 'POKERI',   label_en: 'POKER' },
  blackjack: { tint: '#6FA37D', emoji: '♣',  label_fi: 'BLACKJACK', label_en: 'BLACKJACK' },
};

// Mini "preview profile" rendered per card - hints at what archetypes
// the test outputs without giving the answers away.
const PROFILE_TEASE = {
  sports:    { fi: ['Markkinaluku', 'Tunnepelaaja', 'Putki-strategi', '+6 muuta'],
               en: ['Market reader', 'Emotional player', 'Streak strategist', '+6 more'] },
  poker:     { fi: ['Strategi (TAG)', 'Maksaja', 'Kallio', 'Maniac'],
               en: ['The Strategist', 'Calling Station', 'The Rock', 'The Maniac'] },
  blackjack: { fi: ['Kuripelaaja', 'Kirjapelaaja', 'Kansansääntö', 'Fiilispelaaja'],
               en: ['The Disciplined', 'The Book Player', 'Folk-rule', 'The Hunch Player'] },
};

// Locked default - used as fallback while the back-office landing copy
// fetch is in flight (zero content shift on first paint).
const FALLBACK = {
  eyebrow_fi: 'MESTARI · TUNNE PELITAPASI',
  eyebrow_en: 'MESTARI · KNOW YOUR PLAY',
  headline_fi: 'Tunnista, millainen pelaaja todella olet.',
  headline_en: 'Find out what you actually are at the table.',
  subtitle_fi: 'Kolme 90 sekunnin diagnostiikkaa - vastaukset eivät jää näytölle. Saat oman profiilin ja 5 päivän pelikirjan sähköpostiisi. Ilmaiseksi.',
  subtitle_en: 'Three 90-second diagnostics - the answers don\'t stay on screen. You get your profile and a 5-day playbook emailed. Free.',
  trust_line_fi: '18+ · Toimituksellinen sisältö - ei vedonlyöntineuvontaa, ei rahapelaamista.',
  trust_line_en: '18+ · Editorial content - not gambling advice, no real-money play.',
  method_label_fi: 'MENETELMÄ · MITEN MESTARI ANALYSOI',
  method_label_en: 'METHOD · HOW MESTARI ANALYSES',
  method_body_fi: '',
  method_body_en: '',
  card_sports_kicker_fi: 'URHEILUVEDONLYÖNTI', card_sports_kicker_en: 'SPORTS BETTING',
  card_sports_title_fi: 'Millainen vedonlyöjä sinä olet?',
  card_sports_title_en: 'What kind of bettor are you?',
  card_sports_oneliner_fi: 'Miten luet ottelua - tunnetta vai numeroita?',
  card_sports_oneliner_en: 'How you read a match - by gut or by numbers?',
  card_poker_kicker_fi: 'POKERI', card_poker_kicker_en: 'POKER',
  card_poker_title_fi: 'Millainen pokeripelaaja olet?',
  card_poker_title_en: 'What kind of poker player are you?',
  card_poker_oneliner_fi: 'Kallio, maniac vai TAG-strategi?',
  card_poker_oneliner_en: 'Rock, Maniac, or TAG strategist?',
  card_blackjack_kicker_fi: 'BLACKJACK', card_blackjack_kicker_en: 'BLACKJACK',
  card_blackjack_title_fi: 'Pelaatko tunteella vai matikalla?',
  card_blackjack_title_en: 'Do you play by gut or by the math?',
  card_blackjack_oneliner_fi: 'Selvitä missä talon etu tällä hetkellä on.',
  card_blackjack_oneliner_en: 'Find out where the house edge sits for you.',
};

const DIAGNOSTIC_KEYS = ['sports', 'poker', 'blackjack'];

const HubCard = ({ k, copy, lang, testid }) => {
  const acc = SPORT_ACCENT[k] || SPORT_ACCENT.poker;
  const teases = (PROFILE_TEASE[k] || PROFILE_TEASE.poker)[lang === 'en' ? 'en' : 'fi'];
  return (
    <Link to={`/mestari/${k}`} data-testid={testid} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      padding: '26px 22px 22px', display: 'flex', flexDirection: 'column',
      gap: 14, textDecoration: 'none', color: 'var(--ink)',
      transition: 'border-color 200ms ease, transform 200ms ease',
      borderTop: `3px solid ${acc.tint}`,
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = acc.tint; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        position: 'absolute', top: 12, right: 16,
        fontSize: 28, opacity: 0.18, fontFamily: 'Georgia, serif',
        color: acc.tint, pointerEvents: 'none',
      }}>{acc.emoji}</div>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.22em', fontWeight: 700, color: acc.tint,
      }}>{lang === 'en' ? copy[`card_${k}_kicker_en`] : copy[`card_${k}_kicker_fi`]}</span>
      <h3 data-testid={`${testid}-title`} style={{
        fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700,
        lineHeight: 1.12, letterSpacing: '-0.018em', margin: 0,
        color: 'var(--ink)',
      }}>{lang === 'en' ? copy[`card_${k}_title_en`] : copy[`card_${k}_title_fi`]}</h3>
      <p style={{
        fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.5,
        color: 'var(--muted)', margin: 0,
      }}>{lang === 'en' ? copy[`card_${k}_oneliner_en`] : copy[`card_${k}_oneliner_fi`]}</p>

      {/* Archetype tease - flat list, monospace, small */}
      <div data-testid={`${testid}-archetypes`} style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        marginTop: 6, paddingTop: 12,
        borderTop: '1px dashed var(--border)',
      }}>
        {teases.map((t, i) => (
          <span key={i} style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.04em', color: 'var(--muted)',
            padding: '3px 8px',
            background: 'color-mix(in srgb, var(--bg) 50%, transparent)',
            border: '1px solid var(--border)',
          }}>{t}</span>
        ))}
      </div>

      <div style={{
        marginTop: 'auto', paddingTop: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.20em', fontWeight: 700, color: 'var(--muted)',
        }}>{lang === 'en' ? '5 QUESTIONS · 90 SEC · FREE' : '5 KYSYMYSTÄ · 90 SEK · ILMAINEN'}</span>
        <span data-testid={`${testid}-cta`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 800, color: acc.tint,
        }}>
          {lang === 'en' ? 'START' : 'ALOITA'}
          <ArrowRight strokeWidth={2} size={14} />
        </span>
      </div>
    </Link>
  );
};

// Compact 3-cell stat strip above the grid. Numbers stay aspirational
// but reasonable while we ramp; replaced by live totals via the
// /api/mestari/diagnostic/stats endpoint later.
const HubStatStrip = ({ lang }) => {
  const [stats, setStats] = useState({ tests_taken: 0, profiles_diagnosed: 0, avg_seconds: 84 });
  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/mestari/diagnostic/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop && d) setStats((s) => ({ ...s, ...d })); })
      .catch(() => { /* keep fallbacks */ });
    return () => { stop = true; };
  }, []);
  const cell = (label, value) => (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 4,
      borderRight: '1px solid var(--border)',
    }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.22em', fontWeight: 700, color: 'var(--muted)',
      }}>{label}</span>
      <span style={{
        fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
        color: 'var(--ink)', letterSpacing: '-0.01em',
      }}>{value}</span>
    </div>
  );
  return (
    <div data-testid="mestari-hub-stats" style={{
      display: 'flex', flexWrap: 'wrap',
      border: '1px solid var(--border)', marginBottom: 36,
      background: 'var(--surface)',
    }}>
      {cell(lang === 'en' ? 'TESTS TAKEN' : 'TESTEJÄ TEHTY',
            (stats.tests_taken || 0).toLocaleString(lang === 'en' ? 'en-GB' : 'fi-FI'))}
      {cell(lang === 'en' ? 'PROFILES DIAGNOSED' : 'PROFIILEJA',
            stats.profiles_diagnosed || 9)}
      {cell(lang === 'en' ? 'AVG. TIME' : 'KESKIM. AIKA',
            `${stats.avg_seconds || 84}s`)}
    </div>
  );
};

const MestariHub = () => {
  const { lang, toggle: toggleLang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [copy, setCopy] = useState(FALLBACK);

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/mestari/diagnostic/landing`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop && d?.hub) setCopy({ ...FALLBACK, ...d.hub }); })
      .catch((e) => console.warn('[hub] landing fetch failed', e));
    return () => { stop = true; };
  }, []);

  useDocumentMeta({
    title: lang === 'en'
      ? 'Mestari · Know your play - PUTKI HQ'
      : 'Mestari · Tunne pelitapasi - PUTKI HQ',
    description: lang === 'en'
      ? 'Three 90-second diagnostics - sports betting, poker, blackjack. Your real profile + a 5-day playbook, emailed free.'
      : 'Kolme 90 sekunnin diagnostiikkaa - urheiluvedonlyönti, pokeri, blackjack. Oikea profiilisi ja 5 päivän pelikirja sähköpostiisi, ilmaiseksi.',
    canonical: `${BACKEND}/mestari`,
  });

  return (
    <div data-testid="mestari-hub" style={{
      background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh',
    }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
      }}>
        <Link to="/" data-testid="mestari-hub-back" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.15em', fontWeight: 700, color: 'var(--ink)',
          textDecoration: 'none',
        }}>← PUTKI<span style={{ color: 'var(--muted)', marginLeft: 4 }}>HQ</span></Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={toggleTheme}
            data-testid="mestari-hub-theme-toggle"
            style={{
              padding: '6px 10px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 999,
              cursor: 'pointer', color: 'var(--ink)',
              display: 'inline-flex', alignItems: 'center',
            }}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
          <button type="button" onClick={toggleLang}
            data-testid="mestari-hub-lang-toggle"
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 999,
              cursor: 'pointer', color: 'var(--ink)',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.18em', fontWeight: 700,
            }}>{lang === 'en' ? 'EN / FI' : 'FI / EN'}</button>
        </div>
      </header>

      <section style={{ maxWidth: 980, margin: '0 auto', padding: '48px 24px 72px' }}>
        <div data-testid="mestari-hub-eyebrow" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700, color: BLUE,
          textTransform: 'uppercase', marginBottom: 18,
        }}>{lang === 'en' ? copy.eyebrow_en : copy.eyebrow_fi}</div>
        <h1 data-testid="mestari-hub-headline" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(36px, 5.6vw, 58px)', lineHeight: 1.03,
          letterSpacing: '-0.024em', color: 'var(--ink)',
          margin: '0 0 22px',
        }}>{lang === 'en' ? copy.headline_en : copy.headline_fi}</h1>
        <p data-testid="mestari-hub-subtitle" style={{
          fontFamily: 'Georgia, serif', fontSize: 19, lineHeight: 1.5,
          color: 'var(--ink)', margin: '0 0 32px', maxWidth: 760,
        }}>{lang === 'en' ? copy.subtitle_en : copy.subtitle_fi}</p>

        <HubStatStrip lang={lang} />

        <div data-testid="mestari-hub-grid" className="mestari-hub-grid" style={{
          display: 'grid', gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}>
          {DIAGNOSTIC_KEYS.map((k) => (
            <HubCard key={k} k={k} copy={copy} lang={lang}
              testid={`mestari-hub-card-${k}`} />
          ))}
        </div>

        <p data-testid="mestari-hub-trust-line" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.10em', color: 'var(--muted)',
          margin: '36px 0 0', maxWidth: 760, lineHeight: 1.7,
          textAlign: 'center',
        }}>{lang === 'en' ? copy.trust_line_en : copy.trust_line_fi}</p>
      </section>
    </div>
  );
};

export default MestariHub;
