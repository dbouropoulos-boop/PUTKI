/**
 * PUTKI HQ - Voita listing page.
 *
 * Page order (per editorial brief):
 *   1. Hero banner (editable copy + image via settings.voita_hero)
 *   2. Trust strip (€ paid total + raffles drawn + entrants - gated at 3k)
 *   3. Active raffles grid (FanDuel-style tall photo-led cards → quiz funnel)
 *   4. How it works (3-step explainer)
 *   5. Past winners (compact news-portal row list - NO quiz CTA)
 *
 * Paid + drawn raffles are explicitly read-only and never link into the
 * quiz funnel.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const SUBSCRIBER_GATE = 3000; // Show subscriber-style social proof only above this threshold.

const fmtDate = (iso, lang) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fi-FI', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

const fmtCountdown = (iso, lang) => {
  if (!iso) return null;
  const now = Date.now();
  const close = new Date(iso).getTime();
  const remaining = close - now;
  if (remaining <= 0) return null;
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  if (d >= 1) return `${d}d ${h}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
};

// Sport-themed gradient - sits under the (optional) photo overlay.
const SPORT_GRADIENT = {
  football: 'linear-gradient(135deg, #0e2b1a 0%, #1a4730 60%, #2b6f4e 100%)',
  icehockey: 'linear-gradient(135deg, #0e1a2b 0%, #1f3a5a 60%, #4a7aa6 100%)',
  nhl: 'linear-gradient(135deg, #0e1a2b 0%, #1f3a5a 60%, #4a7aa6 100%)',
  tennis: 'linear-gradient(135deg, #2b1a0e 0%, #5a3a1f 60%, #b08a4a 100%)',
  basketball: 'linear-gradient(135deg, #2b1a0e 0%, #6a3a1a 60%, #b8632c 100%)',
  f1: 'linear-gradient(135deg, #2b0e0e 0%, #5a1a1a 60%, #b03030 100%)',
  mma: 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 60%, #6a6a6a 100%)',
};
const SPORT_EMOJI = {
  football: '⚽', icehockey: '🏒', nhl: '🏒', tennis: '🎾',
  basketball: '🏀', f1: '🏎️', mma: '🥊',
};

// ── Trust strip ─────────────────────────────────────────────────────────
const TrustStrip = ({ paidRaffles, lang }) => {
  if (!paidRaffles || paidRaffles.length === 0) return null;
  let totalPaid = 0;
  let totalEntrants = 0;
  let totalWinners = 0;
  for (const r of paidRaffles) {
    const winners = (r.result && r.result.winners) || [];
    for (const w of winners) {
      totalPaid += w.amount_eur || 0;
      totalWinners += 1;
    }
    totalEntrants += r.entries_count || 0;
  }
  const items = [
    { label: lang === 'en' ? 'PAID TO WINNERS' : 'MAKSETTU VOITTAJILLE', value: `€${totalPaid}` },
    { label: lang === 'en' ? 'RAFFLES DRAWN' : 'ARVOTTUJA ARVONTOJA', value: paidRaffles.length },
    { label: lang === 'en' ? 'ENTRANTS' : 'OSALLISTUJAA', value: totalEntrants },
    { label: lang === 'en' ? 'WINNERS' : 'VOITTAJAA', value: totalWinners },
  ];
  return (
    <div data-testid="voita-trust-strip" style={{
      display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: 1, background: 'var(--hairline, #221E1B)',
      border: '1px solid var(--hairline, #221E1B)', marginTop: -1,
    }}>
      {items.map((it, i) => (
        <div key={i} data-testid={`trust-stat-${i}`} style={{
          background: 'var(--surface, #141210)',
          padding: '10px 16px', textAlign: 'left',
        }}>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.22em', color: 'var(--muted, #9C9587)',
            fontWeight: 700, marginBottom: 4,
          }}>{it.label}</div>
          <div style={{
            fontFamily: 'Georgia, serif', fontWeight: 700,
            fontSize: 20, color: 'var(--ink, #ECE6D8)',
            lineHeight: 1, letterSpacing: '-0.01em',
          }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
};

// ── Active raffle card (gamified, links into quiz funnel) ───────────────
const ActiveRaffleCard = ({ r, lang }) => {
  const grad = SPORT_GRADIENT[r.sport] || SPORT_GRADIENT.football;
  const emoji = SPORT_EMOJI[r.sport] || '🎯';
  const prize = (r.prize_distribution?.payouts || []).reduce((s, p) => s + (p.amount_eur || 0), 0);
  const entries = r.entries_count || 0;
  const countdown = fmtCountdown(r.entries_close_at, lang);
  const closingSoon = countdown && /^\d+m$/.test(countdown);
  const entriesClosed = r.status === 'closed';
  // Pill style: red-ish for closed, amber for closing soon, green for open.
  const pillBg = entriesClosed ? '#1a0e0e' : (closingSoon ? '#2b0e0e' : '#0e1a14');
  const pillFg = entriesClosed ? '#9C8B6B' : (closingSoon ? '#FF8A7F' : '#9ad4a9');
  const pillBorder = entriesClosed ? '#3a3028' : (closingSoon ? '#5a2b2b' : '#1f3a2a');
  const pillLabel = entriesClosed
    ? (lang === 'en' ? 'ENTRIES CLOSED' : 'OSALLISTUMINEN SULJETTU')
    : closingSoon
      ? (lang === 'en' ? 'CLOSING SOON' : 'SULKEUTUU PIAN')
      : (lang === 'en' ? 'ENTRY OPEN' : 'AVOIN');
  const ctaLabel = entriesClosed
    ? (lang === 'en' ? 'VIEW →' : 'KATSO →')
    : (lang === 'en' ? 'PLAY NOW →' : 'PELAA NYT →');

  return (
    <Link to={`/voita/${r.slug}`}
      data-testid={`voita-active-card-${r.slug}`}
      data-status={r.status}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        background: grad, border: '1px solid var(--hairline)',
        padding: '24px 22px 22px', textDecoration: 'none',
        overflow: 'hidden', minHeight: 420,
        transition: 'transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 24px 50px -22px rgba(0,0,0,0.7)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}>
      {/* Optional editorial photo overlay - sits between gradient and content. */}
      {r.image_url && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url('${r.image_url}')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.55,
        }} />
      )}
      {r.image_url && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.75) 100%)',
        }} />
      )}
      {/* Giant ghost emoji watermark */}
      <span aria-hidden style={{
        position: 'absolute', right: -20, bottom: -40,
        fontSize: 260, opacity: r.image_url ? 0.04 : 0.07,
        lineHeight: 1, pointerEvents: 'none', zIndex: 0,
      }}>{emoji}</span>

      {/* Status row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap', position: 'relative' }}>
        <span data-testid={`voita-status-${r.slug}`} style={{
          background: pillBg,
          color: pillFg,
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.22em', fontWeight: 700,
          padding: '4px 8px',
          border: `1px solid ${pillBorder}`,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {!entriesClosed && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: pillFg,
              animation: 'pulse 1.8s ease-in-out infinite',
            }} />
          )}
          {pillLabel}
        </span>
        <span style={{
          background: 'rgba(0,0,0,0.4)', color: '#FFFFFF',
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.22em', fontWeight: 700,
          padding: '4px 8px', border: '1px solid rgba(255,255,255,0.15)',
        }}>{(r.sport || '').toUpperCase()}{r.league ? ` · ${r.league.toUpperCase()}` : ''}</span>
      </div>

      {/* Matchup */}
      <div style={{
        fontFamily: 'Georgia, serif', fontWeight: 700,
        color: '#FFFFFF', lineHeight: 1.05, letterSpacing: '-0.02em',
        marginBottom: 22, position: 'relative', fontSize: 'clamp(28px, 3.4vw, 38px)',
      }}>
        {r.home_team}<br />
        <span style={{ color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', fontSize: '0.55em', fontWeight: 400 }}>vs</span><br />
        {r.away_team}
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap', position: 'relative' }}>
        <span style={{
          background: 'rgba(0,0,0,0.4)', color: '#FFFFFF',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.14em', fontWeight: 700, padding: '4px 8px',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>👥 {entries} {lang === 'en' ? 'ENTRIES' : 'OSALLIST.'}</span>
        {countdown && (
          <span data-testid={`voita-time-left-${r.slug}`} style={{
            background: 'rgba(232,194,110,0.18)', color: '#FFE5A8',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.14em', fontWeight: 700, padding: '4px 8px',
            border: '1px solid rgba(232,194,110,0.4)',
          }}>⏱ {lang === 'en' ? 'CLOSES IN ' : 'SULKEUTUU '}{countdown}</span>
        )}
      </div>

      {/* Prize chip + ENTER CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.12)',
        position: 'relative', marginTop: 'auto',
      }}>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: 2 }}>
            {lang === 'en' ? 'PRIZE POOL' : 'PALKINTOPOTTI'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700, color: '#FFE5A8', lineHeight: 1 }}>
            €{prize}
          </div>
        </div>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 800, color: '#0B0A09',
          background: entriesClosed ? '#9C8B6B' : '#E8C26E', padding: '13px 18px',
        }}>{ctaLabel}</div>
      </div>
    </Link>
  );
};

// ── Past raffle row (compact, NO quiz funnel link) ──────────────────────
const PastRaffleRow = ({ r, lang }) => {
  const result = r.result || {};
  const winners = result.winners || [];
  const topWinner = winners[0];
  const totalPayout = winners.reduce((s, w) => s + (w.amount_eur || 0), 0);
  const winnerName = topWinner
    ? (topWinner.display_name || topWinner.email_masked || '-')
    : '-';
  const date = fmtDate(result.drawn_at || r.kickoff_at, lang);
  return (
    <div data-testid={`voita-past-row-${r.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr auto auto auto',
        gap: 18, alignItems: 'center',
        padding: '14px 16px',
        borderBottom: '1px solid var(--hairline, #221E1B)',
      }}>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.14em', color: 'var(--muted, #9C9587)',
        fontWeight: 700,
      }}>{date}</div>
      <div style={{
        fontFamily: 'Georgia, serif', fontWeight: 600,
        fontSize: 15, color: 'var(--ink, #ECE6D8)',
        letterSpacing: '-0.01em',
      }}>
        {r.home_team} <span style={{ color: 'var(--muted, #9C9587)', fontWeight: 400, fontStyle: 'italic' }}>vs</span> {r.away_team}
        <span style={{
          marginLeft: 10, fontFamily: 'ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted, #9C9587)',
          fontWeight: 700,
        }}>· {(r.sport || '').toUpperCase()}</span>
      </div>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 13,
        color: 'var(--ink, #ECE6D8)', fontWeight: 700,
        letterSpacing: '0.04em', minWidth: 60, textAlign: 'right',
      }}>
        {result.home_goals != null && result.away_goals != null
          ? `${result.home_goals}-${result.away_goals}`
          : '-'}
      </div>
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
        color: '#FFE5A8', minWidth: 60, textAlign: 'right',
      }}>€{totalPayout}</div>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.06em', color: 'var(--muted, #9C9587)',
        fontWeight: 600, textAlign: 'right', minWidth: 140,
      }}>
        <span style={{ color: '#9ad4a9' }}>✦ </span>{winnerName}
        {winners.length > 1 && <span> +{winners.length - 1}</span>}
      </div>
    </div>
  );
};

const Voita = () => {
  const { lang } = useLang();
  const [enabled, setEnabled] = useState(false);
  const [raffles, setRaffles] = useState([]);
  const [hero, setHero] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useDocumentMeta({
    title: lang === 'en' ? 'Voita - PUTKI HQ' : 'Voita - PUTKI HQ',
    description: lang === 'en'
      ? "PUTKI HQ's guess-the-winner editorial raffle. Free to enter, no deposit."
      : 'PUTKI HQ:n voittaja-ennustus -arvonta. Ilmainen osallistua, ei talletusta.',
    canonical: `${BACKEND}/voita`,
  });

  useEffect(() => {
    let stop = false;
    Promise.all([
      fetch(`${BACKEND}/api/voita/raffles`).then((r) => r.ok ? r.json() : { items: [], feature_enabled: false }),
      fetch(`${BACKEND}/api/settings/public`).then((r) => r.ok ? r.json() : {}),
    ]).then(([rd, sd]) => {
      if (stop) return;
      setEnabled(!!rd.feature_enabled);
      setRaffles(rd.items || []);
      setHero(sd.voita_hero || null);
      setLoaded(true);
    }).catch(() => { if (!stop) setLoaded(true); });
    return () => { stop = true; };
  }, []);

  const activeRaffles = raffles.filter((r) => r.status === 'open' || r.status === 'closed');
  const pastRaffles = raffles.filter((r) => r.status === 'drawn' || r.status === 'paid');

  const eyebrow = hero ? (lang === 'en' ? hero.eyebrow_en : hero.eyebrow_fi) : '';
  const title = hero ? (lang === 'en' ? hero.title_en : hero.title_fi) : '';
  const subtitle = hero ? (lang === 'en' ? hero.subtitle_en : hero.subtitle_fi) : '';

  // Sport-driven hero accent: the *first* active raffle decides the
  // hero's colour story (icehockey blue, football green, etc.) and the
  // matchup ticker on the right. This earns ~60px of above-the-fold
  // space vs the old photo backdrop and makes the hero feel current -
  // it visibly changes the moment a new raffle goes live.
  const featuredRaffle = (enabled && activeRaffles.length > 0) ? activeRaffles[0] : null;
  const featuredSport = (featuredRaffle && featuredRaffle.sport) || 'football';
  const sportGradient = SPORT_GRADIENT[featuredSport] || SPORT_GRADIENT.football;
  const sportEmoji = SPORT_EMOJI[featuredSport] || '🎯';
  const sportLabel = featuredRaffle
    ? `${featuredSport}${featuredRaffle.league_label ? ` · ${featuredRaffle.league_label}` : ''}`.toUpperCase()
    : (lang === 'en' ? 'AWAITING NEXT MATCH' : 'ODOTTAA SEURAAVAA OTTELUA');

  return (
    <div data-testid="voita-page" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px' }}>
      {/* 1. HERO - compact band so the live raffles sit above the fold.
          The sport of the featured (first) active raffle now drives the
          colour story (gradient + accent emoji + matchup ticker on the
          right), so the hero visibly changes the moment a new raffle
          goes live and the photo decoration is gone. */}
      <section data-testid={enabled && activeRaffles.length > 0 ? 'voita-hero-active' : 'voita-hero-gated'}
        data-featured-sport={featuredSport}
        style={{ position: 'relative', padding: '40px 0 28px', minHeight: 240, overflow: 'hidden' }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: sportGradient,
        }} />
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, rgba(11,10,9,0.94) 0%, rgba(11,10,9,0.78) 45%, rgba(11,10,9,0.35) 80%, rgba(11,10,9,0.18) 100%)',
        }} />
        {/* Decorative sport accent: a big, low-opacity emoji acts as a
            silent watermark behind the matchup ticker on the right side.
            Replaces the VOITA letterform - more "current product"
            signal, less brand vanity. */}
        <span aria-hidden style={{
          position: 'absolute', top: '50%', right: '6%', zIndex: 1,
          transform: 'translateY(-50%)',
          fontSize: 'clamp(120px, 18vw, 220px)', lineHeight: 1,
          opacity: 0.08, pointerEvents: 'none', userSelect: 'none',
          filter: 'grayscale(0.3)',
        }}>{sportEmoji}</span>

        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap',
        }}>
          {/* Left: headline column */}
          <div style={{ maxWidth: 620, flex: '1 1 380px' }}>
            {!loaded ? (
              <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 32, margin: '8px 0', color: '#FFFFFF' }}>…</h1>
            ) : enabled && activeRaffles.length > 0 ? (
              <>
                <span data-testid="voita-eyebrow" style={{
                  color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
                  fontSize: 10, letterSpacing: '0.24em', fontWeight: 700,
                }}>{eyebrow}</span>
                <h1 data-testid="voita-active-title" style={{
                  fontFamily: 'Georgia, serif', fontWeight: 700,
                  fontSize: 'clamp(28px, 3.8vw, 42px)', lineHeight: 1.1,
                  letterSpacing: '-0.02em', color: '#FFFFFF', margin: '8px 0 12px',
                }}>{title}</h1>
                <p data-testid="voita-subtitle" style={{ color: 'rgba(236,230,216,0.88)', fontSize: 14.5, lineHeight: 1.5, maxWidth: 540, margin: 0 }}>
                  {subtitle}
                </p>
              </>
            ) : (
              <>
                <span style={{
                  color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
                  fontSize: 10, letterSpacing: '0.24em', fontWeight: 700,
                }}>{lang === 'en' ? 'VOITA · COMING SOON' : 'VOITA · TULOSSA'}</span>
                <h1 data-testid="voita-placeholder" style={{
                  fontFamily: 'Georgia, serif', fontWeight: 700,
                  fontSize: 'clamp(28px, 3.8vw, 42px)', lineHeight: 1.1,
                  letterSpacing: '-0.02em', color: '#FFFFFF', margin: '8px 0 12px',
                }}>{lang === 'en' ? 'Coming soon' : 'Pian saatavilla'}</h1>
                <p style={{ color: 'rgba(236,230,216,0.88)', fontSize: 14.5, lineHeight: 1.5, maxWidth: 540, margin: '0 0 14px' }}>
                  {lang === 'en'
                    ? "Next raffle drops shortly. Free to enter, no deposit, no betting."
                    : 'Seuraava arvonta julkaistaan pian. Ilmainen osallistua, ei talletusta, ei vedonlyöntiä.'}
                </p>
                <span data-testid="voita-disabled-cta" style={{
                  color: 'rgba(236,230,216,0.55)',
                  fontFamily: 'ui-monospace, monospace', fontSize: 11,
                  letterSpacing: '0.18em', fontWeight: 700,
                }}>{lang === 'en' ? 'AWAITING APPROVAL' : 'ODOTTAA HYVÄKSYNTÄÄ'}</span>
              </>
            )}
          </div>

          {/* Right: featured-raffle matchup ticker - the sport accent.
              Only shown when there's a featured raffle; otherwise the
              empty-state copy already lives in the left column. */}
          {featuredRaffle && (
            <Link to={`/voita/${featuredRaffle.slug}`}
              data-testid="voita-hero-featured"
              data-featured-slug={featuredRaffle.slug}
              style={{
                flex: '0 0 auto', maxWidth: 320,
                display: 'flex', flexDirection: 'column', gap: 8,
                textDecoration: 'none',
                padding: '12px 14px',
                background: 'rgba(11,10,9,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
                letterSpacing: '0.22em', color: 'rgba(255,255,255,0.55)',
                fontWeight: 700, textTransform: 'uppercase',
              }}>{lang === 'en' ? 'FEATURED · ' : 'PÄÄARVONTA · '}{sportLabel}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.15,
                fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em',
              }}>
                {featuredRaffle.home_team}{' '}
                <span style={{ color: 'rgba(236,230,216,0.6)', fontWeight: 400, fontStyle: 'italic' }}>vs</span>{' '}
                {featuredRaffle.away_team}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, marginTop: 2,
                fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.16em', color: '#E8C56F', fontWeight: 700,
                textTransform: 'uppercase',
              }}>
                <span>{lang === 'en' ? 'ENTER →' : 'OSALLISTU →'}</span>
                <span style={{ color: 'rgba(236,230,216,0.55)' }}>
                  {featuredRaffle.entries_count || 0} {lang === 'en' ? 'in' : 'mukana'}
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* 2. TRUST STRIP (real numbers from paid raffles) */}
      {loaded && pastRaffles.length > 0 && <TrustStrip paidRaffles={pastRaffles} lang={lang} />}

      {/* 3. ACTIVE RAFFLES */}
      {loaded && enabled && activeRaffles.length > 0 && (
        <section data-testid="voita-active-section" style={{
          padding: '24px 0 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 data-testid="voita-active-heading" style={{
              fontFamily: 'Georgia, serif', fontWeight: 700,
              fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--ink, #ECE6D8)',
              letterSpacing: '-0.01em', margin: 0,
            }}>{lang === 'en' ? 'Active raffles' : 'Käynnissä olevat arvonnat'}</h2>
            <span style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.18em', color: 'var(--muted, #9C9587)',
              fontWeight: 700,
            }}>{activeRaffles.length} {lang === 'en' ? (activeRaffles.length === 1 ? 'RAFFLE' : 'RAFFLES') : 'ARVONTAA'}</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 18,
          }}>
            {activeRaffles.map((r) => <ActiveRaffleCard key={r.id} r={r} lang={lang} />)}
          </div>
        </section>
      )}

      {/* If enabled but no active right now, render explicit empty state */}
      {loaded && enabled && activeRaffles.length === 0 && pastRaffles.length > 0 && (
        <section data-testid="voita-active-empty" style={{
          padding: '40px 0 24px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: 'Georgia, serif', fontWeight: 700,
            fontSize: 28, color: 'var(--ink, #ECE6D8)', margin: '0 0 8px',
          }}>{lang === 'en' ? 'Between raffles' : 'Arvontojen välissä'}</h2>
          <p style={{ color: 'var(--muted, #9C9587)', fontSize: 14, margin: 0 }}>
            {lang === 'en'
              ? 'No active raffle right now - the next match drops shortly.'
              : 'Ei käynnissä olevaa arvontaa juuri nyt - seuraava ottelu pian.'}
          </p>
        </section>
      )}

      {/* 4. HOW IT WORKS */}
      <section data-testid="voita-explainer" style={{ borderTop: '1px solid var(--hairline, #221E1B)', padding: '36px 0 16px' }}>
        <span style={{
          color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.24em', fontWeight: 700, display: 'block', marginBottom: 14,
        }}>{lang === 'en' ? 'HOW IT WORKS' : 'NÄIN SE TOIMII'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--hairline, #221E1B)' }} className="voita-explainer-grid">
          {[
            ['01', lang === 'en' ? 'Pick a match' : 'Valitse ottelu',
             lang === 'en' ? 'Choose from active raffles above. Free entry - email only.' : 'Valitse jokin yllä olevista käynnissä olevista arvonnoista. Ilmainen osallistua - vain sähköposti.'],
            ['02', lang === 'en' ? 'Predict 1-X-2 + score' : 'Ennusta 1-X-2 + lopputulos',
             lang === 'en' ? '3 pts for correct 1-X-2. Best-of bonus: 5 exact / 3 goal-diff / 1 total-goals.' : '3 pistettä oikeasta 1-X-2:sta. Bonus: 5 tarkka, 3 maaliero, 1 maalisumma.'],
            ['03', lang === 'en' ? 'Top entries win' : 'Parhaat voittavat',
             lang === 'en' ? 'Top entries by points win prizes. Ties broken by deterministic random draw.' : 'Eniten pisteitä saaneet voittavat. Tasapelit ratkaistaan toistettavalla satunnaisarvalla.'],
          ].map(([n, t, b]) => (
            <div key={n} style={{ padding: '20px 22px', background: 'var(--surface, #141210)' }}>
              <div style={{ color: '#C13B2C', fontFamily: 'ui-monospace, monospace', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>{n}</div>
              <div style={{ color: 'var(--ink, #ECE6D8)', fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 17, marginTop: 8, marginBottom: 6 }}>{t}</div>
              <p style={{ color: 'var(--ink, #ECE6D8)', fontSize: 13, lineHeight: 1.5, margin: 0, opacity: 0.82 }}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. PAST WINNERS - compact list, NO quiz funnel link */}
      {loaded && pastRaffles.length > 0 && (
        <section data-testid="voita-past-section" style={{ borderTop: '1px solid var(--hairline, #221E1B)', padding: '36px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 data-testid="voita-past-heading" style={{
              fontFamily: 'Georgia, serif', fontWeight: 700,
              fontSize: 'clamp(22px, 2.6vw, 28px)', color: 'var(--ink, #ECE6D8)',
              letterSpacing: '-0.01em', margin: 0,
            }}>{lang === 'en' ? 'Past winners' : 'Aiemmat voittajat'}</h2>
            <span style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.22em', color: 'var(--muted, #9C9587)', fontWeight: 700,
            }}>{lang === 'en' ? 'RESULT · ENTRIES NOT ACCEPTED' : 'TULOS · EI OSALLISTUMISTA'}</span>
          </div>
          <div style={{
            background: 'var(--surface, #141210)',
            border: '1px solid var(--hairline, #221E1B)',
          }}>
            {pastRaffles.map((r) => <PastRaffleRow key={r.id} r={r} lang={lang} />)}
          </div>
        </section>
      )}

      <section data-testid="voita-position" style={{ borderTop: '1px solid var(--hairline, #221E1B)', padding: '24px 0 48px' }}>
        <p style={{
          color: 'var(--muted, #9C9587)', fontSize: 12.5, margin: 0,
          fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em', lineHeight: 1.7,
        }}>{lang === 'en' ? 'See the full ' : 'Lue '}
          <Link to="/voita/saannot" style={{ color: 'var(--ink, #ECE6D8)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {lang === 'en' ? 'rules' : 'säännöt'}
          </Link>
          {lang === 'en' ? ' before entering.' : ' ennen osallistumista.'}</p>
      </section>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @media (max-width: 900px) {
          .voita-explainer-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          [data-testid^="voita-past-row-"] {
            grid-template-columns: 1fr !important;
            gap: 4px !important;
            text-align: left !important;
          }
          [data-testid^="voita-past-row-"] > * {
            text-align: left !important;
            min-width: 0 !important;
          }
          [data-testid="voita-trust-strip"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Voita;
