/**
 * Mestari · Poker / Blackjack diagnostic page.
 *
 * One reusable page driven by the `diagnostic` prop ("poker" or
 * "blackjack"). Mirrors the sports-betting diagnostic's visual design
 * exactly - same header, hero, disclaimer block, CTA, sub-CTA strip,
 * 4-stat block, method strip - but pulls the diagnostic-specific copy
 * from a single COPY constant below.
 *
 * Section 3 of the build brief: this page template is non-negotiable.
 * The trust framing (disclaimer + "no gambling advice" copy + value
 * block at the report) is the product's legal posture and must appear,
 * in full, on every diagnostic page.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import SiteMasthead from '../components/SiteMasthead';
import { track, fireMestariStart, fireMestariCompletion, slugifyProfile } from '../lib/track';
import { watchScrollDepth } from '../lib/scrollDepth';
import useEmailGateTracking from '../hooks/useEmailGateTracking';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const BLUE = '#5B8DEE';

const COPY = {
  poker: {
    domain: 'poker',
    hero_kicker_fi: 'Mestari · Toimituksellinen diagnostiikka · Tutkimustyökalu',
    hero_kicker_en: 'Mestari · Editorial diagnostic · Research tool',
    headline_fi: 'Millainen pokeripelaaja sinä olet?',
    headline_en: 'What kind of poker player are you?',
    sub_fi: '90 sekunnin diagnostiikka, joka perustuu vakiintuneeseen pokeriteoriaan. Vastaa viiteen kysymykseen siitä, miten pelaat pöydässä - saat henkilökohtaisen pelaajaprofiilin ja 5 päivän pelikirjan siitä, miten taitava pokeri on rakennettu.',
    sub_en: 'A 90-second diagnostic grounded in established poker theory. Answer five questions about how you play a table - receive a personal player profile and a 5-day playbook on how skilled poker is structured.',
    disclaimer_strong_fi: 'Tämä on tutkimus- ja opetustyökalu.',
    disclaimer_strong_en: 'This is a research and educational tool.',
    disclaimer_rest_fi: ' Mestari tutkii, miten pelaajat lähestyvät pokeria ja miten taitava pelaaminen on rakennettu. Se ei ole rahapelineuvontaa, se ei mainosta rahapelaamista, eikä se koskaan kerro mitä lyödä vetoa. Vain opetuskäyttöön.',
    disclaimer_rest_en: ' Mestari studies how players approach poker and how skilled play is structured. It is not gambling advice, it does not promote gambling, and it will never tell you what to wager. For educational use only.',
    hero_stat_num: '2',
    hero_stat_unit_fi: ' akselia',
    hero_stat_unit_en: ' axes',
    hero_stat_desc_fi: 'TYYLI KARTOITETTU VALIKOIVUUDEN JA AGGRESSION MUKAAN - VAKIINTUNUT POKERIN MALLI.',
    hero_stat_desc_en: 'STYLE MAPPED ON SELECTIVITY AND AGGRESSION - THE ESTABLISHED MODEL OF POKER PLAY.',
    method_label_fi: 'MENETELMÄ · MITEN MESTARI ANALYSOI',
    method_label_en: 'METHOD · HOW MESTARI ANALYSES',
    method_body_fi: 'Mestari soveltaa vakiintunutta kaksiakselista pokerityylin mallia - kuinka valikoivasti pelaaja käyttää käsiä ja kuinka aggressiivisesti hän panostaa - sijoittaakseen jokaisen pelaajan tunnistettuun profiiliin.',
    method_body_en: 'Mestari applies the established two-axis model of poker style - how selective a player is with hands, and how aggressive they are with bets - to place each player on a recognised profile.',
  },
  blackjack: {
    domain: 'blackjack',
    hero_kicker_fi: 'Mestari · Toimituksellinen diagnostiikka · Tutkimustyökalu',
    hero_kicker_en: 'Mestari · Editorial diagnostic · Research tool',
    headline_fi: 'Millainen blackjack-pelaaja sinä olet?',
    headline_en: 'What kind of blackjack player are you?',
    sub_fi: '90 sekunnin diagnostiikka, joka perustuu pelin matematiikkaan. Vastaa viiteen kysymykseen siitä, miten pelaat käden - saat henkilökohtaisen pelaajaprofiilin ja 5 päivän pelikirjan siitä, miten blackjack todella toimii.',
    sub_en: 'A 90-second diagnostic grounded in the mathematics of the game. Answer five questions about how you play a hand - receive a personal player profile and a 5-day playbook on how blackjack actually works.',
    disclaimer_strong_fi: 'Tämä on tutkimus- ja opetustyökalu.',
    disclaimer_strong_en: 'This is a research and educational tool.',
    disclaimer_rest_fi: ' Mestari tutkii, miten pelaajat lähestyvät blackjackia ja miten pelin matematiikka oikeasti toimii. Se ei ole rahapelineuvontaa, se ei mainosta rahapelaamista, eikä se koskaan kerro mitä lyödä vetoa. Vain opetuskäyttöön.',
    disclaimer_rest_en: ' Mestari studies how players approach blackjack and how the game\u2019s mathematics actually work. It is not gambling advice, it does not promote gambling, and it will never tell you what to wager. For educational use only.',
    hero_stat_num: '',
    hero_stat_unit_fi: 'Ratkaistu',
    hero_stat_unit_en: 'Solved',
    hero_stat_desc_fi: 'BLACKJACKIN PERUSSTRATEGIA ON JULKAISTU, MATEMAATTISESTI RATKAISTU TULOS - EI MIELIPIDE.',
    hero_stat_desc_en: 'BLACKJACK BASIC STRATEGY IS A PUBLISHED, MATHEMATICALLY SOLVED RESULT - NOT OPINION.',
    method_label_fi: 'MENETELMÄ · MITEN MESTARI ANALYSOI',
    method_label_en: 'METHOD · HOW MESTARI ANALYSES',
    method_body_fi: 'Mestari mittaa pelaajaa blackjackin tunnetun matematiikan - jokaisen käden julkaistun oikean pelitavan - mukaan, sijoittaakseen hänet tunnistettuun pelitiedon ja kurin profiiliin.',
    method_body_en: 'Mestari measures a player against the known mathematics of blackjack - the published correct play for every hand - to place them on a recognised profile of game knowledge and discipline.',
  },
};

// Constant stats (Section 3, item 7) - three are the same across diagnostics.
const CONSTANT_STATS = [
  { num: '0', unit_fi: ' muokkausta', unit_en: ' overrides',
    desc_fi: 'Ei toimituksen sormea mallissa. Sama data, sama tulos.',
    desc_en: 'No editorial finger on the model. Same data, same output.' },
  { num: '5', unit_fi: ' päivää', unit_en: ' days',
    desc_fi: 'Strukturoitu pelikirja sähköpostiisi.',
    desc_en: 'Structured playbook to your inbox.' },
  { num: '90', unit_fi: ' sek', unit_en: ' sec',
    desc_fi: '5 kysymystä. Yksi tulos. Pelikirja sähköpostiisi.',
    desc_en: '5 questions. One result. Playbook to your inbox.' },
];

// ── Quiz flow ───────────────────────────────────────────────────────

const QuizFlow = ({ diagnostic, lang, onExit }) => {
  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState('loading'); // loading | q | report | gate | done
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  // iter97k · canonical gate tracking. enabled flag scopes the
  // email_gate_displayed push to the moment the gate actually renders
  // (step === 'report' here), not on QuizFlow mount.
  const gate = useEmailGateTracking({
    content_type: 'mestari',
    funnel_state: 'mestari_result',
    enabled: step === 'report',
  });

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/mestari/diagnostic/${diagnostic}/meta`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (stop || !d) return;
        setMeta(d);
        setStep('q');
        // iter97k · fire mestari_start on quiz mount. Idempotent via
        // sessionStorage — if the user clicked through from /mestari
        // hub it already fired there, this is a no-op.
        fireMestariStart('mestari');
      })
      .catch(() => setErr('network'));
    return () => { stop = true; };
  }, [diagnostic]);

  // iter97k · fire result_viewed once when the report is first shown.
  // The slugified profile key gives the analytics guy a clean 11-cohort
  // cut in GA4 (per spec §6) — drift-resistant lower-snake-case.
  // useRef guard absorbs StrictMode double-invoke + late `result`
  // updates that could otherwise re-fire after the first render.
  // Also fires telegram_cta_displayed since the report screen shows
  // the @Putkihq_bot CTA right next to the email gate.
  const resultViewedFired = React.useRef(false);
  useEffect(() => {
    if (step !== 'report' || !result?.profile) return;
    if (resultViewedFired.current) return;
    resultViewedFired.current = true;
    track('result_viewed', {
      content_type: 'mestari',
      result_profile: slugifyProfile(result.profile.key || result.profile.name_en || ''),
    });
    track('telegram_cta_displayed', {
      content_type: 'mestari', funnel_state: 'mestari_result',
    });
  }, [step, result]);

  const answer = (opt) => {
    if (!meta) return;
    const q = meta.questions[idx];
    const next = [...answers, { q: q.id, opt: opt.id }];
    setAnswers(next);
    if (idx + 1 < meta.questions.length) {
      setIdx(idx + 1);
      return;
    }
    // Last question answered → fire mestari_completion (with elapsed
    // sessionStorage timer) BEFORE the resolve fetch so the event lands
    // even if the user closes the tab during /resolve latency.
    fireMestariCompletion('mestari');
    // Resolve when last question is answered.
    fetch(`${BACKEND}/api/mestari/diagnostic/${diagnostic}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: next }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => { setResult(d); setStep('report'); })
      .catch(() => setErr('resolve_failed'));
  };

  const submit = (e) => {
    e?.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('invalid_email');
      return;
    }
    setSubmitting(true);
    fetch(`${BACKEND}/api/mestari/diagnostic/lead`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, name: name || undefined, diagnostic,
        profile_key: result?.profile?.key,
        scores: result?.scores, lang,
      }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then(() => {
        // iter97k · email_submitted is the primary conversion goal. Push
        // only on successful POST so we don't count network failures.
        gate.onSubmit();
        setStep('done');
      })
      .catch(() => setErr('submit_failed'))
      .finally(() => setSubmitting(false));
  };

  if (step === 'loading') {
    return (
      <div data-testid="mestari-diag-loading" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
        {lang === 'en' ? 'Loading diagnostic…' : 'Ladataan diagnostiikkaa…'}
      </div>
    );
  }

  if (step === 'q' && meta) {
    const q = meta.questions[idx];
    return (
      <div data-testid="mestari-diag-quiz" style={{
        maxWidth: 580, margin: '0 auto', padding: '32px 24px',
        color: 'var(--ink)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <button type="button" onClick={onExit} data-testid="mestari-diag-exit" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            background: 'transparent', border: 0, color: 'var(--muted)',
            cursor: 'pointer', letterSpacing: '0.15em',
          }}>← PUTKI HQ</button>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            color: 'var(--muted)', letterSpacing: '0.14em',
          }} data-testid="mestari-diag-progress">{`${idx + 1} / ${meta.questions.length}`}</span>
        </div>
        <div style={{
          height: 2, background: 'var(--border)', marginBottom: 36, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            width: `${((idx) / meta.questions.length) * 100}%`,
            background: BLUE,
          }} />
        </div>
        <h2 data-testid={`mestari-diag-q-${q.id}`} style={{
          fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700,
          lineHeight: 1.2, letterSpacing: '-0.015em', margin: '0 0 6px',
          color: 'var(--ink)',
        }}>{lang === 'en' ? q.en : q.fi}</h2>
        {(q.hint_en || q.hint_fi) && (
          <p data-testid={`mestari-diag-hint-${q.id}`} style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
            letterSpacing: '0.04em', color: 'var(--muted)',
            margin: '0 0 22px', lineHeight: 1.55,
          }}>{lang === 'en' ? (q.hint_en || '') : (q.hint_fi || '')}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt) => (
            <button key={opt.id} type="button"
              data-testid={`mestari-diag-opt-${q.id}-${opt.id}`}
              onClick={() => answer(opt)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                padding: '14px 16px', textAlign: 'left',
                fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.5,
                color: 'var(--ink)', cursor: 'pointer',
                transition: 'border-color 180ms ease, background 180ms ease',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = BLUE; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <span style={{ fontWeight: 700 }}>{lang === 'en' ? opt.en : opt.fi}</span>
              {(opt.subtitle_en || opt.subtitle_fi) && (
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  color: 'var(--muted)', letterSpacing: '0.02em',
                  lineHeight: 1.5, fontWeight: 400,
                }}>{lang === 'en' ? (opt.subtitle_en || '') : (opt.subtitle_fi || '')}</span>
              )}
            </button>
          ))}
        </div>
        {err && <div style={{ color: '#C13B2C', marginTop: 18, fontSize: 13 }}>{err}</div>}
      </div>
    );
  }

  if (step === 'report' && result) {
    const profile = result.profile;
    const playbook = result.playbook || [];
    return (
      <div data-testid="mestari-diag-report" style={{
        maxWidth: 640, margin: '0 auto', padding: '32px 24px', color: 'var(--ink)',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.22em', fontWeight: 700, color: BLUE,
        }}>{lang === 'en' ? 'YOUR PROFILE' : 'PROFIILISI'}</span>
        <h2 data-testid="mestari-diag-report-name" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.1,
          letterSpacing: '-0.02em', margin: '12px 0 12px',
        }}>{lang === 'en' ? profile.name_en : profile.name_fi}</h2>
        <p data-testid="mestari-diag-report-tagline" style={{
          fontFamily: 'Georgia, serif', fontSize: 18, fontStyle: 'italic',
          color: 'var(--muted)', margin: '0 0 18px',
        }}>{lang === 'en' ? profile.tagline_en : profile.tagline_fi}</p>
        <p data-testid="mestari-diag-report-desc" style={{
          fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.6,
          color: 'var(--ink)', margin: '0 0 18px',
        }}>{lang === 'en' ? profile.desc_en : profile.desc_fi}</p>

        {/* Social-proof line - "where you sit in the distribution".
            Pulled from the profile doc so back-office can edit per profile.
            Rendered as a left-bordered subtle band so it reads as
            substance (a real stat) rather than marketing. */}
        {(profile.social_proof_en || profile.social_proof_fi) && (
          <div data-testid="mestari-diag-social-proof" style={{
            borderLeft: '2px solid #5BA0E8',
            padding: '8px 14px', marginBottom: 22,
            background: 'rgba(91,160,232,0.04)',
            fontFamily: 'Georgia, serif', fontSize: 14.5,
            lineHeight: 1.5, color: 'var(--muted)', fontStyle: 'italic',
          }}>
            {lang === 'en' ? profile.social_proof_en : profile.social_proof_fi}
          </div>
        )}

        {/* iter75 - 3-cell stat strip on the profile card.
            Mirrors the hub stat strip pattern; gives the user three
            concrete take-aways before the email gate even loads.
            Each cell is optional - we only render cells whose data is
            present, so older profile docs without these fields degrade
            cleanly. */}
        {(profile.rarity_pct || profile.common_pitfall_en || profile.upgrade_en) && (
          <div data-testid="mestari-diag-profile-stats" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            border: '1px solid var(--border)', marginBottom: 28,
            background: 'var(--surface)',
          }}>
            {profile.rarity_pct ? (
              <div data-testid="mestari-diag-stat-rarity" style={{
                padding: '14px 16px',
                borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                  letterSpacing: '0.22em', fontWeight: 700, color: 'var(--muted)',
                }}>{lang === 'en' ? 'RARITY' : 'YLEISYYS'}</span>
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
                  color: 'var(--ink)', letterSpacing: '-0.01em',
                }}>{profile.rarity_pct}%</span>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  color: 'var(--muted)', letterSpacing: '0.04em',
                }}>{lang === 'en' ? 'of players' : 'pelaajista'}</span>
              </div>
            ) : null}
            {(profile.common_pitfall_en || profile.common_pitfall_fi) ? (
              <div data-testid="mestari-diag-stat-pitfall" style={{
                padding: '14px 16px',
                borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                  letterSpacing: '0.22em', fontWeight: 700, color: '#C66B5E',
                }}>{lang === 'en' ? 'COMMON PITFALL' : 'TYYPILLINEN ANSA'}</span>
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.4,
                  color: 'var(--ink)', fontWeight: 500,
                }}>{lang === 'en' ? profile.common_pitfall_en : profile.common_pitfall_fi}</span>
              </div>
            ) : null}
            {(profile.upgrade_en || profile.upgrade_fi) ? (
              <div data-testid="mestari-diag-stat-upgrade" style={{
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                  letterSpacing: '0.22em', fontWeight: 700, color: '#6FA37D',
                }}>{lang === 'en' ? 'NEXT UPGRADE' : 'SEURAAVA TASO'}</span>
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.4,
                  color: 'var(--ink)', fontWeight: 500,
                }}>{lang === 'en' ? profile.upgrade_en : profile.upgrade_fi}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* iter86 · Phase 3 v2 — Telegram-first CTA at the top of the
            result gate. Email signup remains below as a secondary fall-
            back, but the Telegram path is the canonical journey. */}
        <a href={`https://t.me/Putkihq_bot?start=mestari_${diagnostic}`}
           target="_blank" rel="noopener noreferrer"
           data-testid="mestari-diag-telegram-cta"
           onClick={() => track('telegram_clicked', {
             content_type: 'mestari', funnel_state: 'mestari_result',
           })}
           style={{
             display: 'block',
             background: 'linear-gradient(135deg, #229ED9 0%, #1B7BAB 100%)',
             color: '#FFFFFF', borderRadius: 8, padding: '18px 22px',
             textDecoration: 'none', marginBottom: 16,
             boxShadow: '0 6px 20px rgba(34, 158, 217, 0.22)',
             transition: 'transform 200ms ease, box-shadow 200ms ease',
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.transform = 'translateY(-2px)';
             e.currentTarget.style.boxShadow = '0 10px 28px rgba(34, 158, 217, 0.32)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.transform = 'translateY(0)';
             e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 158, 217, 0.22)';
           }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 22,
            }}>{'\u2708\uFE0E'}</div>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.22em', fontWeight: 800, opacity: 0.85,
                textTransform: 'uppercase', marginBottom: 2,
              }}>{lang === 'en' ? 'GET IT NOW · ON TELEGRAM' : 'SAA NYT · TELEGRAMISSA'}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.35,
                fontWeight: 600, letterSpacing: '-0.005em',
              }}>{lang === 'en'
                ? `Your ${diagnostic} report + the 5-day playbook delivered in chat. No email, no waiting.`
                : `${diagnostic === 'sports' ? 'Urheilu' : diagnostic === 'poker' ? 'Pokeri' : 'Blackjack'}-raportti ja 5 päivän pelikirja chattiin. Ilman sähköpostia, heti.`}</div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: '#FFFFFF', color: '#1B7BAB',
              borderRadius: 999, fontFamily: 'ui-monospace, monospace',
              fontSize: 11, letterSpacing: '0.18em', fontWeight: 800,
              textTransform: 'uppercase', flexShrink: 0,
            }}>
              @Putkihq_bot →
            </span>
          </div>
        </a>

        {/* Email gate · secondary path (kept for users who prefer email). */}
        <div data-testid="mestari-diag-gate" style={{
          padding: 20, background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', marginBottom: 8,
          }}>{lang === 'en' ? 'OR · BY EMAIL' : 'TAI · SÄHKÖPOSTILLA'}</div>
          <h3 style={{
            fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
            margin: '0 0 8px', letterSpacing: '-0.01em',
          }}>{lang === 'en' ? 'Get the full report + 5-day playbook' : 'Hanki täysi raportti + 5 päivän pelikirja'}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, margin: '0 0 14px' }}>
            {lang === 'en'
              ? 'We use your email to send this single report and the 5-day playbook. No spam, unsubscribe anywhere.'
              : 'Käytämme sähköpostiasi tämän raportin ja 5 päivän pelikirjan lähettämiseen. Ei roskapostia, voit perua milloin tahansa.'}
          </p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              data-testid="mestari-diag-name-input"
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'en' ? 'Name (optional)' : 'Nimi (valinnainen)'}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                padding: '12px 14px', fontFamily: 'ui-monospace, monospace',
                fontSize: 13, color: 'var(--ink)',
              }}
            />
            <input
              data-testid="mestari-diag-email-input"
              onFocus={gate.onFieldFocus}
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={lang === 'en' ? 'you@example.com' : 'sinä@esimerkki.fi'}
              required
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                padding: '12px 14px', fontFamily: 'ui-monospace, monospace',
                fontSize: 13, color: 'var(--ink)',
              }}
            />
            <button type="submit" disabled={submitting}
              data-testid="mestari-diag-submit"
              style={{
                background: BLUE, color: '#0B0A09', border: 0,
                padding: '14px 16px', fontFamily: 'ui-monospace, monospace',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.22em',
                textTransform: 'uppercase', cursor: submitting ? 'wait' : 'pointer',
              }}>{submitting ? (lang === 'en' ? 'SENDING…' : 'LÄHETETÄÄN…') : (lang === 'en' ? 'SEND ME MY REPORT →' : 'LÄHETÄ RAPORTTI →')}</button>
            {err && <span style={{ color: '#C13B2C', fontSize: 12 }}>{err}</span>}
          </form>
        </div>

        {/* Playbook outline (titles only - full body lands by email once copy ships) */}
        <div data-testid="mestari-diag-playbook-outline" style={{ marginTop: 28 }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', fontWeight: 700, color: 'var(--muted)',
          }}>{lang === 'en' ? '5-DAY PLAYBOOK' : '5 PÄIVÄN PELIKIRJA'}</span>
          <ol style={{ paddingLeft: 18, margin: '10px 0 0' }}>
            {playbook.map((d) => (
              <li key={d.day} style={{
                fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.55,
                color: 'var(--ink)', marginBottom: 6,
              }}>
                <strong>{lang === 'en' ? d.title_en : d.title_fi}</strong>
                {' - '}
                <span style={{ color: 'var(--muted)' }}>{lang === 'en' ? d.summary_en : d.summary_fi}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (step === 'done' && result) {
    const v = result.value_block;
    return (
      <div data-testid="mestari-diag-confirm" style={{
        maxWidth: 640, margin: '0 auto', padding: '40px 24px', color: 'var(--ink)',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.22em', fontWeight: 700, color: '#6FA37D',
        }}>{lang === 'en' ? '✓ REPORT SENT' : '✓ RAPORTTI LÄHETETTY'}</span>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.1,
          letterSpacing: '-0.02em', margin: '12px 0 12px',
        }}>{lang === 'en' ? 'Check your inbox.' : 'Tarkista sähköpostisi.'}</h2>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.6, color: 'var(--ink)',
          margin: '0 0 28px',
        }}>
          {lang === 'en'
            ? `Your full ${diagnostic} profile and the 5-day playbook are on their way. Each day arrives the morning after the previous one.`
            : `Täysi ${diagnostic === 'poker' ? 'pokeri' : 'blackjack'}-profiilisi ja 5 päivän pelikirja ovat matkalla. Jokainen päivä saapuu seuraavana aamuna edellisen jälkeen.`}
        </p>

        {/* Section 7.3 value block - required on every diagnostic. */}
        <div data-testid="mestari-diag-value-block" style={{
          padding: '22px 22px', background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', fontWeight: 700, color: BLUE,
            textTransform: 'uppercase',
          }} data-testid="mestari-diag-value-kicker">
            {lang === 'en' ? v.kicker_en : v.kicker_fi}
          </span>
          <p style={{
            fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.65,
            color: 'var(--ink)', margin: '12px 0 0',
          }} data-testid="mestari-diag-value-body">
            {lang === 'en' ? v.body_en : v.body_fi}
          </p>
        </div>

        <Link to="/mestari" data-testid="mestari-diag-back-hub"
          style={{
            display: 'inline-block', marginTop: 28,
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.18em', color: 'var(--muted)', textDecoration: 'none',
            borderBottom: '1px solid var(--border)', paddingBottom: 4,
          }}>{lang === 'en' ? '← BACK TO DIAGNOSTICS' : '← TAKAISIN DIAGNOSTIIKKOIHIN'}</Link>
      </div>
    );
  }

  return null;
};

// ── Landing → Quiz wrapper ───────────────────────────────────────────

const MestariDiagnostic = ({ diagnostic }) => {
  const fallback = COPY[diagnostic];
  const { lang } = useLang();
  const [started, setStarted] = useState(false);
  const [landing, setLanding] = useState(fallback);

  // Fetch editable landing copy. Falls back to the hardcoded constants
  // (zero content-shift on first paint, exact same UX as before).
  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/mestari/diagnostic/${diagnostic}/meta`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (stop || !d?.landing) return;
        setLanding({ ...fallback, ...d.landing });
      })
      .catch(() => { /* keep fallback */ });
    return () => { stop = true; };
  }, [diagnostic, fallback]);

  const c = landing;

  // iter97k · Mestari lane landing events (intro page mount).
  // useRef guard absorbs React StrictMode double-invoke in dev.
  const landingFired = React.useRef(false);
  useEffect(() => {
    if (landingFired.current) return;
    landingFired.current = true;
    track('landing_view', { content_type: 'mestari' });
    const cleanup = watchScrollDepth('mestari');
    const t = setTimeout(() => track('delayed_pageview', { content_type: 'mestari' }), 3000);
    return () => { cleanup(); clearTimeout(t); };
  }, [diagnostic]);

  const stats = useMemo(() => [
    {
      num: c.hero_stat_num,
      unit_fi: c.hero_stat_unit_fi,
      unit_en: c.hero_stat_unit_en,
      desc_fi: c.hero_stat_desc_fi,
      desc_en: c.hero_stat_desc_en,
    },
    ...CONSTANT_STATS,
  ], [c]);

  useDocumentMeta({
    title: lang === 'en'
      ? `Mestari · ${diagnostic === 'poker' ? 'Poker' : 'Blackjack'} diagnostic - PUTKI HQ`
      : `Mestari · ${diagnostic === 'poker' ? 'Pokeri' : 'Blackjack'}-diagnostiikka - PUTKI HQ`,
    description: lang === 'en' ? c.sub_en : c.sub_fi,
    canonical: `${BACKEND}/mestari/${diagnostic}`,
  });

  if (started) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <QuizFlow diagnostic={diagnostic} lang={lang} onExit={() => setStarted(false)} />
      </div>
    );
  }

  return (
    <div data-testid={`mestari-${diagnostic}-page`} style={{
      background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh',
    }}>
      <SiteMasthead />

      <section style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px 24px' }}>
        <div data-testid={`mestari-${diagnostic}-hero-eyebrow`} style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 700, color: BLUE,
          textTransform: 'uppercase', marginBottom: 18,
        }}>{lang === 'en' ? c.hero_kicker_en : c.hero_kicker_fi}</div>
        <h1 data-testid={`mestari-${diagnostic}-hero-headline`} style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(36px, 5.6vw, 56px)', lineHeight: 1.04,
          letterSpacing: '-0.022em', color: 'var(--ink)',
          margin: '0 0 18px',
        }}>{lang === 'en' ? c.headline_en : c.headline_fi}</h1>
        <p data-testid={`mestari-${diagnostic}-hero-sub`} style={{
          fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.55,
          color: 'var(--ink)', margin: '0 0 24px', maxWidth: 720,
        }}>{lang === 'en' ? c.sub_en : c.sub_fi}</p>

        <div data-testid={`mestari-${diagnostic}-disclaimer`} style={{
          padding: '18px 20px', border: '1px solid var(--border)',
          background: 'var(--surface)', marginBottom: 30, maxWidth: 720,
        }}>
          <p style={{
            margin: 0, fontFamily: 'Georgia, serif', fontSize: 15.5,
            lineHeight: 1.55, color: 'var(--ink)',
          }}>
            <strong>{lang === 'en' ? c.disclaimer_strong_en : c.disclaimer_strong_fi}</strong>
            <span style={{ color: 'var(--muted)' }}>{lang === 'en' ? c.disclaimer_rest_en : c.disclaimer_rest_fi}</span>
          </p>
        </div>

        <button type="button" onClick={() => { fireMestariStart('mestari'); setStarted(true); }}
          data-testid={`mestari-${diagnostic}-cta`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '14px 22px', background: BLUE, color: '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12,
            fontWeight: 800, letterSpacing: '0.22em', cursor: 'pointer',
            textTransform: 'uppercase',
          }}>
          {lang === 'en' ? 'START THE DIAGNOSTIC' : 'ALOITA DIAGNOSTIIKKA'}
          <ArrowRight strokeWidth={2} size={14} />
        </button>
        <div data-testid={`mestari-${diagnostic}-sub-cta`} style={{
          marginTop: 14, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600,
        }}>{lang === 'en'
          ? '90 SECONDS · FREE · NO DEPOSIT · NO GAMBLING'
          : '90 SEKUNTIA · MAKSUTON · EI TALLETUSTA · EI RAHAPELEJÄ'}</div>
      </section>

      {/* 4-stat block */}
      <section data-testid={`mestari-${diagnostic}-stats`} style={{
        maxWidth: 920, margin: '0 auto', padding: '40px 24px',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'grid', gap: 18,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}>
          {stats.map((s, i) => (
            <div key={`stat-${s.num || s.unit_en}-${i}`} data-testid={`mestari-${diagnostic}-stat-${i}`}>
              <div style={{
                fontFamily: 'Georgia, serif', fontWeight: 700,
                fontSize: 'clamp(28px, 3.6vw, 36px)', lineHeight: 1,
                letterSpacing: '-0.02em', color: BLUE,
              }}>{s.num}{lang === 'en' ? s.unit_en : s.unit_fi}</div>
              <p style={{
                margin: '10px 0 0', fontFamily: 'ui-monospace, monospace',
                fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--muted)',
                lineHeight: 1.55,
              }}>{lang === 'en' ? s.desc_en : s.desc_fi}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Method strip */}
      <section data-testid={`mestari-${diagnostic}-method`} style={{
        maxWidth: 920, margin: '0 auto', padding: '40px 24px 80px',
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, color: 'var(--muted)',
        }}>{lang === 'en' ? c.method_label_en : c.method_label_fi}</span>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.6,
          color: 'var(--ink)', margin: '12px 0 0', maxWidth: 720,
        }}>{lang === 'en' ? c.method_body_en : c.method_body_fi}</p>
      </section>
    </div>
  );
};

export default MestariDiagnostic;
