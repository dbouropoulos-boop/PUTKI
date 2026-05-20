/**
 * Mestari · Diagnostic chooser hub.
 *
 * Section 2.2 of the multi-diagnostic build brief. Same design language
 * as the individual diagnostic pages — Georgia headlines, blue accent,
 * editorial monospace meta. Three cards (sports betting, poker,
 * blackjack) in a grid that gracefully takes a fourth card later
 * without redesign.
 *
 * Compact trust line sits below the H1 — full trust block lives on each
 * individual diagnostic page (Section 3, item 4).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const BLUE = '#5B8DEE';

const DIAGNOSTICS = [
  {
    key: 'sports',
    path: '/mestari/sports',
    kicker_fi: 'URHEILUVEDONLYÖNTI',
    kicker_en: 'SPORTS BETTING',
    title_fi: 'Millainen urheiluvedonlyöjä sinä olet?',
    title_en: 'What kind of sports bettor are you?',
    one_liner_fi: 'Miten luet ottelua ja markkinaa.',
    one_liner_en: 'How you read a match and the market.',
    meta_fi: '5 KYSYMYSTÄ · 90 SEK',
    meta_en: '5 QUESTIONS · 90 SEC',
    testid: 'mestari-hub-card-sports',
  },
  {
    key: 'poker',
    path: '/mestari/poker',
    kicker_fi: 'POKERI',
    kicker_en: 'POKER',
    title_fi: 'Millainen pokeripelaaja sinä olet?',
    title_en: 'What kind of poker player are you?',
    one_liner_fi: 'Miten luet pöytää ja pelaajia.',
    one_liner_en: 'How you read a table and the players.',
    meta_fi: '5 KYSYMYSTÄ · 90 SEK',
    meta_en: '5 QUESTIONS · 90 SEC',
    testid: 'mestari-hub-card-poker',
  },
  {
    key: 'blackjack',
    path: '/mestari/blackjack',
    kicker_fi: 'BLACKJACK',
    kicker_en: 'BLACKJACK',
    title_fi: 'Millainen blackjack-pelaaja sinä olet?',
    title_en: 'What kind of blackjack player are you?',
    one_liner_fi: 'Miten luet peliä ja sen todennäköisyyksiä.',
    one_liner_en: 'How you read the game and its odds.',
    meta_fi: '5 KYSYMYSTÄ · 90 SEK',
    meta_en: '5 QUESTIONS · 90 SEC',
    testid: 'mestari-hub-card-blackjack',
  },
];

const HubCard = ({ d, lang }) => (
  <Link to={d.path} data-testid={d.testid} style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    padding: '24px 22px 22px', display: 'flex', flexDirection: 'column',
    gap: 12, textDecoration: 'none', color: 'var(--ink)',
    transition: 'border-color 200ms ease, transform 200ms ease',
  }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = BLUE; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
  >
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.22em', fontWeight: 700, color: BLUE,
    }}>{lang === 'en' ? d.kicker_en : d.kicker_fi}</span>
    <h3 data-testid={`${d.testid}-title`} style={{
      fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700,
      lineHeight: 1.15, letterSpacing: '-0.015em', margin: 0,
      color: 'var(--ink)',
    }}>{lang === 'en' ? d.title_en : d.title_fi}</h3>
    <p style={{
      fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.5,
      color: 'var(--muted)', margin: 0,
    }}>{lang === 'en' ? d.one_liner_en : d.one_liner_fi}</p>
    <div style={{
      marginTop: 'auto', paddingTop: 14,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.20em', fontWeight: 700, color: 'var(--muted)',
      }}>{lang === 'en' ? d.meta_en : d.meta_fi}</span>
      <span data-testid={`${d.testid}-cta`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.22em', fontWeight: 800, color: BLUE,
      }}>
        {lang === 'en' ? 'START' : 'ALOITA'}
        <ArrowRight strokeWidth={2} size={14} />
      </span>
    </div>
  </Link>
);

const MestariHub = () => {
  const { lang, toggle: toggleLang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  useDocumentMeta({
    title: lang === 'en'
      ? 'Mestari · Editorial diagnostics — PUTKI HQ'
      : 'Mestari · Toimituksellinen diagnostiikka — PUTKI HQ',
    description: lang === 'en'
      ? 'Three 90-second diagnostics — sports betting, poker, blackjack. Personal profile + 5-day playbook to your inbox. Research and educational tools.'
      : 'Kolme 90 sekunnin diagnostiikkaa — urheiluvedonlyönti, pokeri, blackjack. Henkilökohtainen profiili + 5 päivän pelikirja sähköpostiisi. Tutkimus- ja opetustyökaluja.',
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
        }}>
          {lang === 'en'
            ? 'MESTARI · EDITORIAL DIAGNOSTICS · RESEARCH TOOLS'
            : 'MESTARI · TOIMITUKSELLISIA DIAGNOSTIIKKOJA · TUTKIMUSTYÖKALUJA'}
        </div>
        <h1 data-testid="mestari-hub-headline" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(36px, 5.6vw, 56px)', lineHeight: 1.04,
          letterSpacing: '-0.022em', color: 'var(--ink)',
          margin: '0 0 18px',
        }}>{lang === 'en' ? 'Which diagnostic?' : 'Mikä diagnostiikka?'}</h1>
        <p data-testid="mestari-hub-subtitle" style={{
          fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.55,
          color: 'var(--ink)', margin: '0 0 14px', maxWidth: 760,
        }}>
          {lang === 'en'
            ? 'Mestari builds research-grounded tools for understanding how players think. Pick a diagnostic — each takes about 90 seconds and ends with a personal profile and a 5-day playbook.'
            : 'Mestari rakentaa tutkimukseen perustuvia työkaluja siihen, miten pelaajat ajattelevat. Valitse diagnostiikka — jokainen kestää noin 90 sekuntia ja päättyy henkilökohtaiseen profiiliin ja 5 päivän pelikirjaan.'}
        </p>
        <p data-testid="mestari-hub-trust-line" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.06em', color: 'var(--muted)', margin: '0 0 36px',
          maxWidth: 760, lineHeight: 1.6,
        }}>
          {lang === 'en'
            ? 'Research and educational tools. Not gambling advice. For educational use only.'
            : 'Tutkimus- ja opetustyökaluja. Ei rahapelineuvontaa. Vain opetuskäyttöön.'}
        </p>

        <div data-testid="mestari-hub-grid" className="mestari-hub-grid" style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          {DIAGNOSTICS.map((d) => (
            <HubCard key={d.key} d={d} lang={lang} />
          ))}
        </div>

        <div data-testid="mestari-hub-method" style={{
          marginTop: 48, padding: '24px 22px',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>{lang === 'en' ? 'METHOD · HOW MESTARI ANALYSES' : 'MENETELMÄ · MITEN MESTARI ANALYSOI'}</span>
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.55,
            color: 'var(--ink)', margin: '12px 0 0', maxWidth: 720,
          }}>
            {lang === 'en'
              ? 'Each diagnostic applies an established framework from its domain — published research on betting markets, the two-axis model of poker style, the mathematics of blackjack — to your answers. Deterministic scoring: same answers, same profile, no editorial spin.'
              : 'Jokainen diagnostiikka soveltaa oman alansa vakiintunutta mallia — julkaistua tutkimusta vedonlyöntimarkkinoista, pokerityylin kaksiakselista mallia, blackjackin matematiikkaa — vastauksiisi. Deterministinen pisteytys: samat vastaukset, sama profiili, ei toimituksen vaikutusta.'}
          </p>
        </div>
      </section>
    </div>
  );
};

export default MestariHub;
