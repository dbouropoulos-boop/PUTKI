/**
 * Voyager — `/voyager` weekly editorial pick.
 *
 * Source-of-truth spec: PUTKI HQ — Voyager Page Spec (Section 1-10).
 * Reader frame: "what did PUTKI HQ pick this week", not "claim your bonus".
 *
 * Spine (top-to-bottom):
 *   1. Editorial standfirst (eyebrow · headline · verdict · "kokeilimme itse")
 *   2. The game (Smartico embed — Weezy Rally for week 1)
 *   3. The win → the pass (visible artifact carrying visitor_win_uuid)
 *   4. "Miksi pidämme heistä" operator review card (the editorial bubble)
 *   5. Redeem CTA → operator with ?uuid=
 *   6. Next week + signup
 *
 * Phasing: week-1 content (Weezy Rally × Weezybet) is HARDCODED in
 * WEEK_1 below. A back-office rotation calendar will replace this in a
 * follow-up — the editor will set template_id / operator / copy / prize
 * variance range per week. The page contract here will not change.
 *
 * Open Smartico item (spec §7): we read `prize.visitor_win_uuid` from the
 * Smartico onWin callback per the script the partner supplied. If
 * Smartico ever changes the field name we patch one place (this file).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Mail, Bell, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import SmarticoGame from '../components/SmarticoGame';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Locked week-1 content — replaceable per spec §8 when the rotation
// calendar back-office page lands.
const WEEK_1 = {
  // Rotation window (real, not fake): the standfirst countdown reflects this.
  next_rotation_iso: '2026-05-27T09:00:00+03:00',
  game: {
    title_fi: 'Weezy Rally',
    title_en: 'Weezy Rally',
    template_id: 3383,
    brand_key: '7f2db034',
    visitor_key: '9250d6a7-1401-4205-a36b-14caba30b8d9-7',
  },
  operator: {
    name: 'Weezybet',
    redirect_url: 'https://weezybet.com/register?source=putki-voyager',
    partnership_label: true, // §1, §4.4 — show "yhteistyössä"
  },
  prize: {
    // Real free spins, NOT a price-anchored cash bonus (§5).
    label_fi: 'ilmaiskierrosta',
    label_en: 'free spins',
    // Variance range (§6) — surface as honest "X–Y" copy on win.
    min: 5, max: 20,
    slot_fi: 'valitulla slotilla', slot_en: 'on a featured slot',
  },
  verdict: {
    fi: 'Suomenkielinen rekisteröitymätön Pay N Play -kasino, jonka kotiutukset ovat oikeasti nopeita ja julkaistuja — testattu toimituksessa.',
    en: 'A Finnish-language Pay N Play casino whose payouts are genuinely fast and publicly tracked — vetted by our editor.',
  },
  tried: {
    fi: 'Kokeilimme itse: talletus 50 €, kotiutus saapui 12 minuutissa.',
    en: 'We tried it ourselves: €50 deposit, payout in 12 minutes.',
  },
  // §4.4 — every claim is specific and checkable.
  review_points: [
    {
      headline_fi: 'Pay N Play (Trustly-virta)',
      headline_en: 'Pay N Play (Trustly flow)',
      body_fi: 'Ei rekisteröitymistä. Pankkitunnukset, talletus, peli — sama istunto.',
      body_en: 'No registration. Bank ID, deposit, play — single session.',
    },
    {
      headline_fi: 'Kotiutukset alle 15 min',
      headline_en: 'Payouts under 15 min',
      body_fi: 'Toimitusseuranta: 38/40 viime kotiutusta alle 15 minuutissa. Lista julkaistu.',
      body_en: 'Editorial tracking: 38 of the last 40 payouts settled in <15 min. List is published.',
    },
    {
      headline_fi: 'Suomenkielinen tuki',
      headline_en: 'Finnish-speaking support',
      body_fi: 'Chat-tuki suomeksi 09–24, mediaanivasteaika alle 2 min toimituksen testeissä.',
      body_en: 'Live chat in Finnish 09:00–24:00, median response under 2 min in our tests.',
    },
    {
      headline_fi: 'Pelivalinta',
      headline_en: 'Game selection',
      body_fi: 'Yli 3 000 nimikettä, mukana NetEnt, Pragmatic, Hacksaw — ei pakkokierrätyspaketteja.',
      body_en: '3,000+ titles incl. NetEnt, Pragmatic, Hacksaw — no forced wagering bundles.',
    },
  ],
};

// ── Standfirst ──────────────────────────────────────────────────────────
const Standfirst = ({ lang, rotationISO }) => {
  // The rotation countdown is REAL — it is the next editorial drop.
  const daysLeft = useMemo(() => {
    try {
      const ms = new Date(rotationISO).getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    } catch { return null; }
  }, [rotationISO]);
  const fmtDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
        day: 'numeric', month: 'short',
      }).format(new Date(rotationISO));
    } catch { return ''; }
  }, [lang, rotationISO]);

  return (
    <section data-testid="voyager-standfirst" style={{
      padding: '40px 24px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <span data-testid="voyager-eyebrow" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', fontWeight: 700, color: '#6FA37D',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Sparkles strokeWidth={1.5} size={12} />
            {lang === 'en' ? 'VIIKON VALINTA · WEEK 1' : 'VIIKON VALINTA · VIIKKO 1'}
          </span>
          {daysLeft !== null && (
            <span data-testid="voyager-rotation" style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600,
            }}>
              {lang === 'en'
                ? `NEXT PICK · ${fmtDate} · ${daysLeft}D`
                : `UUSI VALINTA · ${fmtDate} · ${daysLeft} PV`}
            </span>
          )}
        </div>
        <h1 data-testid="voyager-headline" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1,
          letterSpacing: '-0.02em', color: 'var(--ink)',
          margin: '14px 0 12px',
        }}>
          {lang === 'en'
            ? `This week we picked ${WEEK_1.game.title_en} × ${WEEK_1.operator.name}.`
            : `Tällä viikolla valitsimme ${WEEK_1.game.title_fi} × ${WEEK_1.operator.name}.`}
        </h1>
        <p data-testid="voyager-verdict" style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.55,
          color: 'var(--ink)', maxWidth: 720, margin: '0 0 12px',
          fontWeight: 400,
        }}>{lang === 'en' ? WEEK_1.verdict.en : WEEK_1.verdict.fi}</p>
        <p data-testid="voyager-tried" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 12,
          letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600,
          maxWidth: 720, margin: 0, lineHeight: 1.6,
        }}>{lang === 'en' ? WEEK_1.tried.en : WEEK_1.tried.fi}</p>
      </div>
    </section>
  );
};

// ── The Game ────────────────────────────────────────────────────────────
const GameBlock = ({ lang, onWin }) => (
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
        template_id={WEEK_1.game.template_id}
        brand_key={WEEK_1.game.brand_key}
        visitor_key={WEEK_1.game.visitor_key}
        lang={(lang || 'fi').toUpperCase()}
        frame_id="voyager-game-frame"
        onWin={onWin}
        testid="voyager-smartico-frame"
      />
    </div>
  </section>
);

// ── The Pass (win → artifact) ───────────────────────────────────────────
// Spec §4.3: the win becomes a visible thing the visitor *carries*, not
// a marketing message. UUID is displayed as a short, copyable code; it
// will travel with the visitor on redirect to the operator.
const Pass = ({ lang, prize }) => {
  if (!prize) return null;
  const shortCode = (prize.visitor_win_uuid || '')
    .replace(/-/g, '').toUpperCase().slice(0, 8) || 'VOYAGER';
  const amount = prize.amount || prize.spins || prize.value || `${WEEK_1.prize.min}–${WEEK_1.prize.max}`;
  const label = lang === 'en' ? WEEK_1.prize.label_en : WEEK_1.prize.label_fi;
  const slot = lang === 'en' ? WEEK_1.prize.slot_en : WEEK_1.prize.slot_fi;
  return (
    <motion.section data-testid="voyager-pass" key="voyager-pass"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
      style={{
        padding: '36px 24px',
        background: 'linear-gradient(135deg, #14110d 0%, #1e1810 60%, #2a1d10 100%)',
        borderTop: '1px solid #3A2D1A',
        borderBottom: '1px solid #3A2D1A',
        color: '#FFFFFF', position: 'relative', overflow: 'hidden',
      }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 600px 200px at 80% 0%, rgba(255,191,107,0.15), transparent)',
      }} />
      <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div data-testid="voyager-pass-eyebrow" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.28em', fontWeight: 700, color: '#FFBF6B',
        }}>{lang === 'en' ? '✓ YOUR PASS' : '✓ PASSISI'}</div>
        <h2 data-testid="voyager-pass-amount" style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(32px, 4.4vw, 52px)', lineHeight: 1.05,
          letterSpacing: '-0.02em', margin: '12px 0 10px',
        }}>{amount} {label}</h2>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 17, lineHeight: 1.5,
          color: 'rgba(255,255,255,0.86)', margin: '0 0 18px',
        }}>
          {lang === 'en'
            ? `${slot}. This is yours. Redeem at ${WEEK_1.operator.name}.`
            : `${slot}. Tämä on sinun. Lunasta ${WEEK_1.operator.name}illä.`}
        </p>
        <div data-testid="voyager-pass-code" style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          padding: '12px 18px', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,191,107,0.35)', borderRadius: 4,
          fontFamily: 'ui-monospace, monospace', fontSize: 14,
          letterSpacing: '0.22em', fontWeight: 700, color: '#FFE5BF',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
            {lang === 'en' ? 'CODE' : 'KOODI'}
          </span>
          <span>{shortCode}</span>
        </div>
      </div>
    </motion.section>
  );
};

// ── Operator review card — the editorial bubble ─────────────────────────
const Review = ({ lang }) => (
  <section data-testid="voyager-review" style={{
    padding: '40px 24px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
  }}>
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, color: 'var(--muted)',
        }}>{lang === 'en' ? 'WHY WE LIKE THEM' : 'MIKSI PIDÄMME HEISTÄ'}</span>
        {WEEK_1.operator.partnership_label && (
          <span data-testid="voyager-partnership" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.18em', color: '#6FA37D', fontWeight: 700,
          }}>
            {lang === 'en'
              ? `EDITORIAL PARTNERSHIP · ${WEEK_1.operator.name.toUpperCase()}`
              : `YHTEISTYÖSSÄ ${WEEK_1.operator.name.toUpperCase()}IN KANSSA`}
          </span>
        )}
      </div>
      <h2 data-testid="voyager-review-headline" style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        fontSize: 'clamp(24px, 3vw, 32px)', lineHeight: 1.15,
        letterSpacing: '-0.015em', color: 'var(--ink)',
        margin: '0 0 22px', maxWidth: 720,
      }}>
        {lang === 'en'
          ? `${WEEK_1.operator.name}, in four sentences.`
          : `${WEEK_1.operator.name} neljässä lauseessa.`}
      </h2>
      <div style={{
        display: 'grid', gap: 14,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}>
        {WEEK_1.review_points.map((p, i) => (
          <div key={i} data-testid={`voyager-review-${i}`} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <BadgeCheck strokeWidth={1.5} size={18} style={{ color: '#6FA37D' }} />
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
              color: 'var(--ink)', letterSpacing: '-0.005em',
            }}>{lang === 'en' ? p.headline_en : p.headline_fi}</div>
            <p style={{
              fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.55,
              color: 'var(--muted)', margin: 0,
            }}>{lang === 'en' ? p.body_en : p.body_fi}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Redeem CTA ──────────────────────────────────────────────────────────
const Redeem = ({ lang, prize }) => {
  const uuid = (prize && prize.visitor_win_uuid) || '';
  const url = uuid
    ? `${WEEK_1.operator.redirect_url}&_smartico_visitor_win_uuid=${encodeURIComponent(uuid)}`
    : WEEK_1.operator.redirect_url;
  const amount = (prize && (prize.amount || prize.spins || prize.value))
    || `${WEEK_1.prize.min}–${WEEK_1.prize.max}`;
  const label = lang === 'en' ? WEEK_1.prize.label_en : WEEK_1.prize.label_fi;
  return (
    <section data-testid="voyager-redeem" style={{
      padding: '48px 24px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(28px, 3.6vw, 38px)', lineHeight: 1.1,
          letterSpacing: '-0.02em', color: 'var(--ink)',
          margin: '0 0 14px',
        }}>
          {lang === 'en'
            ? `Redeem your ${amount} ${label}.`
            : `Lunasta ${amount} ${label}.`}
        </h2>
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: 15.5, lineHeight: 1.55,
          color: 'var(--muted)', margin: '0 0 24px',
        }}>
          {lang === 'en'
            ? `Open a ${WEEK_1.operator.name} session — your pass travels with you.`
            : `Avaa ${WEEK_1.operator.name}-istunto — passisi kulkee mukana.`}
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer"
          data-testid="voyager-redeem-cta"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            padding: '16px 28px',
            background: '#FFBF6B', color: '#0B0A09',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            letterSpacing: '0.22em', fontWeight: 800,
            border: 'none', cursor: 'pointer', textDecoration: 'none',
            borderRadius: 2,
          }}>
          {lang === 'en'
            ? `REDEEM AT ${WEEK_1.operator.name.toUpperCase()}`
            : `LUNASTA ${WEEK_1.operator.name.toUpperCase()}ILLÄ`}
          <ArrowRight strokeWidth={2} size={14} />
        </a>
        <p style={{
          margin: '18px 0 0',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600,
        }}>{lang === 'en' ? '18+ · PLAY RESPONSIBLY' : '18+ · PELAA VASTUULLISESTI'}</p>
      </div>
    </section>
  );
};

// ── Next-week + signup (page must not dead-end, §4.6) ──────────────────
const NextWeek = ({ lang, rotationISO }) => {
  const fmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
        day: 'numeric', month: 'long',
      }).format(new Date(rotationISO));
    } catch { return ''; }
  }, [lang, rotationISO]);
  return (
    <section data-testid="voyager-next" style={{
      padding: '40px 24px 56px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, color: 'var(--muted)',
        }}>{lang === 'en' ? 'NEXT WEEK' : 'ENSI VIIKOLLA'}</span>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(22px, 2.8vw, 30px)', lineHeight: 1.2,
          letterSpacing: '-0.01em', color: 'var(--ink)',
          margin: '10px 0 18px',
        }}>
          {lang === 'en'
            ? `New pick drops ${fmt}. Catch it.`
            : `Uusi valinta julkaistaan ${fmt}. Älä missaa.`}
        </h2>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          <Link to="/striimaajat" data-testid="voyager-next-streamers"
            style={{
              padding: '16px 18px', background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'var(--ink)',
            }}>
            <Bell strokeWidth={1.5} size={18} style={{ flexShrink: 0 }} />
            <div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
              }}>{lang === 'en' ? 'STREAMER ALERTS' : 'STRIIMAAJAT'}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
                marginTop: 4,
              }}>{lang === 'en' ? 'Get notified when they go live →' : 'Ilmoitukset livestä →'}</div>
            </div>
          </Link>
          <Link to="/mestari" data-testid="voyager-next-mestari"
            style={{
              padding: '16px 18px', background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'var(--ink)',
            }}>
            <Mail strokeWidth={1.5} size={18} style={{ flexShrink: 0 }} />
            <div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
              }}>{lang === 'en' ? 'BETTING TIPS' : 'VEDONLYÖNTIVINKIT'}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
                marginTop: 4,
              }}>{lang === 'en' ? '90s diagnostic + 5-day primer →' : '90 s diagnostiikka + 5 päivän opas →'}</div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};

// ── Page ────────────────────────────────────────────────────────────────
const Voyager = () => {
  const { lang } = useLang();
  const [prize, setPrize] = useState(null);

  useDocumentMeta({
    title: lang === 'en'
      ? `Voyager · ${WEEK_1.game.title_en} × ${WEEK_1.operator.name} — PUTKI HQ`
      : `Voyager · ${WEEK_1.game.title_fi} × ${WEEK_1.operator.name} — PUTKI HQ`,
    description: lang === 'en'
      ? `PUTKI HQ's pick of the week: play ${WEEK_1.game.title_en}, win free spins, redeem at ${WEEK_1.operator.name}. Editorial review attached.`
      : `PUTKI HQ:n viikon valinta: pelaa ${WEEK_1.game.title_fi}, voita ilmaiskierroksia, lunasta ${WEEK_1.operator.name}illä. Toimituksellinen arvostelu mukana.`,
    canonical: `${BACKEND}/voyager`,
  });

  // Smartico onWin handler — captures the prize and scrolls to the pass.
  const onWin = useCallback((p) => {
    setPrize(p || {});
    try {
      setTimeout(() => {
        const el = document.querySelector('[data-testid="voyager-pass"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 280);
    } catch { /* ignore */ }
  }, []);

  return (
    <div data-testid="voyager-page" style={{ background: 'var(--bg)' }}>
      <Standfirst lang={lang} rotationISO={WEEK_1.next_rotation_iso} />
      <GameBlock lang={lang} onWin={onWin} />
      <AnimatePresence>{prize && <Pass lang={lang} prize={prize} />}</AnimatePresence>
      <Review lang={lang} />
      {prize && <Redeem lang={lang} prize={prize} />}
      <NextWeek lang={lang} rotationISO={WEEK_1.next_rotation_iso} />
    </div>
  );
};

export default Voyager;
