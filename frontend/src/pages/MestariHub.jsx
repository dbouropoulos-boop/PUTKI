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
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sun, Moon } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const BLUE = '#5B8DEE';

// Locked default — used as fallback while the back-office landing copy
// fetch is in flight (zero content shift on first paint).
const FALLBACK = {
  eyebrow_fi: 'MESTARI · TOIMITUKSELLISIA DIAGNOSTIIKKOJA · TUTKIMUSTYÖKALUJA',
  eyebrow_en: 'MESTARI · EDITORIAL DIAGNOSTICS · RESEARCH TOOLS',
  headline_fi: 'Mikä diagnostiikka?',
  headline_en: 'Which diagnostic?',
  subtitle_fi: 'Mestari rakentaa tutkimukseen perustuvia työkaluja.',
  subtitle_en: 'Mestari builds research-grounded tools.',
  trust_line_fi: 'Tutkimus- ja opetustyökaluja. Ei rahapelineuvontaa. Vain opetuskäyttöön.',
  trust_line_en: 'Research and educational tools. Not gambling advice. For educational use only.',
  method_label_fi: 'MENETELMÄ · MITEN MESTARI ANALYSOI',
  method_label_en: 'METHOD · HOW MESTARI ANALYSES',
  method_body_fi: '',
  method_body_en: '',
  card_sports_kicker_fi: 'URHEILUVEDONLYÖNTI', card_sports_kicker_en: 'SPORTS BETTING',
  card_sports_title_fi: 'Millainen urheiluvedonlyöjä sinä olet?',
  card_sports_title_en: 'What kind of sports bettor are you?',
  card_sports_oneliner_fi: 'Miten luet ottelua ja markkinaa.',
  card_sports_oneliner_en: 'How you read a match and the market.',
  card_poker_kicker_fi: 'POKERI', card_poker_kicker_en: 'POKER',
  card_poker_title_fi: 'Millainen pokeripelaaja sinä olet?',
  card_poker_title_en: 'What kind of poker player are you?',
  card_poker_oneliner_fi: 'Miten luet pöytää ja pelaajia.',
  card_poker_oneliner_en: 'How you read a table and the players.',
  card_blackjack_kicker_fi: 'BLACKJACK', card_blackjack_kicker_en: 'BLACKJACK',
  card_blackjack_title_fi: 'Millainen blackjack-pelaaja sinä olet?',
  card_blackjack_title_en: 'What kind of blackjack player are you?',
  card_blackjack_oneliner_fi: 'Miten luet peliä ja sen todennäköisyyksiä.',
  card_blackjack_oneliner_en: 'How you read the game and its odds.',
};

const DIAGNOSTIC_KEYS = ['sports', 'poker', 'blackjack'];

const HubCard = ({ k, copy, lang, testid }) => (
  <Link to={`/mestari/${k}`} data-testid={testid} style={{
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
    }}>{lang === 'en' ? copy[`card_${k}_kicker_en`] : copy[`card_${k}_kicker_fi`]}</span>
    <h3 data-testid={`${testid}-title`} style={{
      fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700,
      lineHeight: 1.15, letterSpacing: '-0.015em', margin: 0,
      color: 'var(--ink)',
    }}>{lang === 'en' ? copy[`card_${k}_title_en`] : copy[`card_${k}_title_fi`]}</h3>
    <p style={{
      fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.5,
      color: 'var(--muted)', margin: 0,
    }}>{lang === 'en' ? copy[`card_${k}_oneliner_en`] : copy[`card_${k}_oneliner_fi`]}</p>
    <div style={{
      marginTop: 'auto', paddingTop: 14,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10,
        letterSpacing: '0.20em', fontWeight: 700, color: 'var(--muted)',
      }}>{lang === 'en' ? '5 QUESTIONS · 90 SEC' : '5 KYSYMYSTÄ · 90 SEK'}</span>
      <span data-testid={`${testid}-cta`} style={{
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
        }}>{lang === 'en' ? copy.eyebrow_en : copy.eyebrow_fi}</div>
        <h1 data-testid="mestari-hub-headline" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(36px, 5.6vw, 56px)', lineHeight: 1.04,
          letterSpacing: '-0.022em', color: 'var(--ink)',
          margin: '0 0 18px',
        }}>{lang === 'en' ? copy.headline_en : copy.headline_fi}</h1>
        <p data-testid="mestari-hub-subtitle" style={{
          fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.55,
          color: 'var(--ink)', margin: '0 0 14px', maxWidth: 760,
        }}>{lang === 'en' ? copy.subtitle_en : copy.subtitle_fi}</p>
        <p data-testid="mestari-hub-trust-line" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.06em', color: 'var(--muted)', margin: '0 0 36px',
          maxWidth: 760, lineHeight: 1.6,
        }}>{lang === 'en' ? copy.trust_line_en : copy.trust_line_fi}</p>

        <div data-testid="mestari-hub-grid" className="mestari-hub-grid" style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          {DIAGNOSTIC_KEYS.map((k) => (
            <HubCard key={k} k={k} copy={copy} lang={lang}
              testid={`mestari-hub-card-${k}`} />
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
          }}>{lang === 'en' ? copy.method_label_en : copy.method_label_fi}</span>
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.55,
            color: 'var(--ink)', margin: '12px 0 0', maxWidth: 720,
          }}>{lang === 'en' ? copy.method_body_en : copy.method_body_fi}</p>
        </div>
      </section>
    </div>
  );
};

export default MestariHub;
