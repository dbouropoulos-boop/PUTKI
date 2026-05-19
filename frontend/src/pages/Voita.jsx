/**
 * PUTKI HQ — Voita listing page (gated).
 *
 * Renders one of three states:
 *   - Gated (feature_enabled = false): "Tulossa" placeholder + explainer.
 *   - Enabled but no public raffles: "Tulossa" placeholder with a softer
 *     "next raffle drops shortly" tone.
 *   - Enabled with raffles: vertical list of marquee matches with
 *     entries_close_at countdown + per-raffle CTA.
 *
 * /voita itself never captures PII. Step 1 (entry capture) lives at
 * /voita/{slug}. Step 2 (marketing opt-in) lives at /voita/{slug}/kiitos.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const fmtDate = (iso, lang) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === 'en' ? 'en-GB' : 'fi-FI', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

// Real status badge derived from raffle.status + entries_close_at.
const statusBadge = (r, lang) => {
  const now = Date.now();
  const close = r.entries_close_at ? new Date(r.entries_close_at).getTime() : 0;
  const remaining = close - now;
  if (r.status === 'paid') return { label: lang === 'en' ? 'PAID' : 'MAKSETTU', color: '#9ad4a9', bg: '#0e2b1a' };
  if (r.status === 'drawn') return { label: lang === 'en' ? 'DRAWN' : 'ARVOTTU', color: '#E8C26E', bg: '#2b220e' };
  if (r.status === 'closed') return { label: lang === 'en' ? 'CLOSED' : 'SULJETTU', color: 'var(--muted)', bg: 'var(--bg)' };
  if (close && remaining > 0 && remaining < 2 * 3600 * 1000) {
    return { label: lang === 'en' ? 'CLOSING SOON' : 'SULKEUTUU PIAN', color: '#C13B2C', bg: '#2b0e0e' };
  }
  return { label: lang === 'en' ? 'ENTRY OPEN' : 'AVOIN', color: '#6FA37D', bg: '#0e1a14' };
};

// "Your record" — local lookup from last entry session.
const useYourRecord = () => {
  const [rec, setRec] = useState(null);
  useEffect(() => {
    let stop = false;
    let email = null;
    try {
      // sessionStorage may carry the email from the most recent entry on
      // this device. Fall back to looking through all voita:* keys.
      const keys = Object.keys(window.sessionStorage || {});
      for (const k of keys) {
        if (!k.startsWith('voita:')) continue;
        try {
          const v = JSON.parse(window.sessionStorage.getItem(k));
          if (v && v.email) { email = v.email; break; }
        } catch {}
      }
    } catch {}
    if (!email) return;
    fetch(`${BACKEND}/api/voita/your-record?email=${encodeURIComponent(email)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!stop && d && d.raffles_played > 0) setRec(d); })
      .catch(() => {});
    return () => { stop = true; };
  }, []);
  return rec;
};

// Sport-themed gradient for the card background. Real photos overlay on top.
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

const RaffleCard = ({ r, lang }) => {
  const badge = statusBadge(r, lang);
  const grad = SPORT_GRADIENT[r.sport] || SPORT_GRADIENT.football;
  const emoji = SPORT_EMOJI[r.sport] || '🎯';
  const prize = (r.prize_distribution?.payouts || []).reduce((s, p) => s + (p.amount_eur || 0), 0);
  const entries = r.entries_count || 0;

  // Real time-left (when open).
  const now = Date.now();
  const close = r.entries_close_at ? new Date(r.entries_close_at).getTime() : 0;
  const remaining = close - now;
  let timeLeft = null;
  if (r.status === 'open' && remaining > 0) {
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    timeLeft = h >= 1 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <Link to={`/voita/${r.slug}`}
      data-testid={`voita-raffle-card-${r.slug}`}
      data-status={r.status}
      style={{
        position: 'relative', display: 'block',
        background: grad, border: '1px solid var(--hairline)',
        padding: '24px 22px 22px', textDecoration: 'none',
        overflow: 'hidden', minHeight: 200,
        transition: 'transform 180ms cubic-bezier(.2,.7,.3,1), box-shadow 180ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 18px 40px -18px rgba(0,0,0,0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}>
      {/* Giant ghost emoji as background watermark */}
      <span aria-hidden style={{
        position: 'absolute', right: -20, bottom: -40,
        fontSize: 220, opacity: 0.06, lineHeight: 1, pointerEvents: 'none',
      }}>{emoji}</span>
      {/* Status row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span data-testid={`voita-status-${r.slug}`} style={{
          background: badge.bg, color: badge.color,
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.22em', fontWeight: 700,
          padding: '4px 8px', border: `1px solid ${badge.color}55`,
        }}>{badge.label}</span>
        <span style={{
          background: 'rgba(0,0,0,0.4)', color: '#FFFFFF',
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
          letterSpacing: '0.22em', fontWeight: 700,
          padding: '4px 8px', border: '1px solid rgba(255,255,255,0.15)',
        }}>{(r.sport || '').toUpperCase()}{r.league ? ` · ${r.league.toUpperCase()}` : ''}</span>
      </div>

      {/* Matchup */}
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700,
        color: '#FFFFFF', lineHeight: 1.05, letterSpacing: '-0.02em',
        marginBottom: 16, position: 'relative',
      }}>
        {r.home_team}<br />
        <span style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: 18 }}>vs</span><br />
        {r.away_team}
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', position: 'relative' }}>
        <span style={{
          background: 'rgba(0,0,0,0.4)', color: '#FFFFFF',
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.14em', fontWeight: 700, padding: '4px 8px',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>👥 {entries} {lang === 'en' ? 'ENTRIES' : 'OSALLIST.'}</span>
        {timeLeft && (
          <span data-testid={`voita-time-left-${r.slug}`} style={{
            background: 'rgba(232,194,110,0.18)', color: '#FFE5A8',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.14em', fontWeight: 700, padding: '4px 8px',
            border: '1px solid rgba(232,194,110,0.4)',
          }}>⏱ {timeLeft}</span>
        )}
      </div>

      {/* Prize chip + CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.12)',
        position: 'relative',
      }}>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: 2 }}>
            {lang === 'en' ? 'PRIZE POOL' : 'PALKINTOPOTTI'}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#FFE5A8', lineHeight: 1 }}>
            €{prize}
          </div>
        </div>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.22em', fontWeight: 800, color: '#0B0A09',
          background: '#E8C26E', padding: '12px 16px',
        }}>{lang === 'en' ? 'ENTER →' : 'OSALLISTU →'}</div>
      </div>
    </Link>
  );
};

const YourRecordStrip = ({ lang }) => {
  const rec = useYourRecord();
  if (!rec) return null;
  return (
    <div data-testid="your-record-strip" style={{
      marginBottom: 14, padding: '12px 16px',
      background: '#1a1810', border: '1px solid #E8C26E55',
      fontFamily: 'ui-monospace, monospace', fontSize: 11,
      letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
    }}>
      <span style={{ color: '#E8C26E' }}>{lang === 'en' ? 'YOUR RECORD' : 'TILASTOSI'}</span>
      <span>{rec.raffles_played} {lang === 'en' ? 'PLAYED' : 'PELATTU'}</span>
      <span>·</span>
      <span>{rec.wins} {lang === 'en' ? 'WIN' + (rec.wins === 1 ? '' : 'S') : 'VOITTO' + (rec.wins === 1 ? '' : 'A')}</span>
      <span>·</span>
      <span>€{rec.eur_won} {lang === 'en' ? 'WON' : 'VOITETTU'}</span>
    </div>
  );
};

const Voita = () => {
  const { lang } = useLang();
  const [enabled, setEnabled] = useState(false);
  const [raffles, setRaffles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useDocumentMeta({
    title: lang === 'en' ? 'Voita — PUTKI HQ' : 'Voita — PUTKI HQ',
    description: lang === 'en'
      ? "PUTKI HQ's guess-the-winner editorial raffle. Free to enter, no deposit."
      : 'PUTKI HQ:n voittaja-ennustus -arvonta. Ilmainen osallistua, ei talletusta.',
    canonical: `${BACKEND}/voita`,
  });

  useEffect(() => {
    let stop = false;
    fetch(`${BACKEND}/api/voita/raffles`)
      .then((r) => r.ok ? r.json() : { items: [], feature_enabled: false })
      .then((d) => {
        if (stop) return;
        setEnabled(!!d.feature_enabled);
        setRaffles(d.items || []);
        setLoaded(true);
      })
      .catch(() => { if (!stop) setLoaded(true); });
    return () => { stop = true; };
  }, []);

  return (
    <div data-testid="voita-page" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px' }}>
      <section data-testid={enabled && raffles.length > 0 ? 'voita-hero-active' : 'voita-hero-gated'}
        style={{ position: 'relative', padding: '64px 0 36px', minHeight: 320, overflow: 'hidden' }}>
        {/* Editorial hero photo — Nano Banana floodlit stadium */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url('/hero/voita.jpg')`,
          backgroundSize: 'cover', backgroundPosition: 'center 30%',
          filter: 'saturate(0.85)',
        }} />
        {/* Gradient overlay — heavy on the left for headline legibility */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, rgba(11,10,9,0.94) 0%, rgba(11,10,9,0.82) 45%, rgba(11,10,9,0.40) 80%, rgba(11,10,9,0.20) 100%)',
        }} />
        <span aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: '5%',
          fontFamily: 'Georgia, serif', fontWeight: 900,
          fontSize: 'clamp(180px, 28vw, 320px)',
          letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.045)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>VOITA</span>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 720 }}>
          <span style={{
            color: '#C13B2C', fontFamily: 'ui-monospace, monospace',
            fontSize: 10, letterSpacing: '0.24em', fontWeight: 700,
          }}>{enabled && raffles.length > 0
            ? (lang === 'en' ? 'VOITA · LIVE RAFFLES' : 'VOITA · KÄYNNISSÄ')
            : (lang === 'en' ? 'VOITA · COMING SOON' : 'VOITA · TULOSSA')}</span>

          {!loaded ? (
            <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 48, margin: '14px 0' }}>…</h1>
          ) : enabled && raffles.length > 0 ? (
            <>
              <h1 data-testid="voita-active-title" style={{
                fontFamily: 'Georgia, serif', fontWeight: 700,
                fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
                letterSpacing: '-0.02em', color: '#FFFFFF', margin: '12px 0 18px',
              }}>{lang === 'en' ? 'Predict the winner. Win the prize.' : 'Arvaa voittaja. Voita palkinto.'}</h1>
              <p style={{ color: 'var(--ink, #ECE6D8)', fontSize: 16, lineHeight: 1.55, maxWidth: 580, margin: 0 }}>
                {lang === 'en'
                  ? "Free entry. No deposit. No betting. Sako-reviewed editorial raffle — pick the winner and predict the score."
                  : 'Ilmainen osallistua. Ei talletusta. Ei vedonlyöntiä. Sakon hyväksymä toimituksellinen arvonta — arvaa voittaja ja ennusta lopputulos.'}
              </p>
            </>
          ) : (
            <>
              <h1 data-testid="voita-placeholder" style={{
                fontFamily: 'Georgia, serif', fontWeight: 700,
                fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.05,
                letterSpacing: '-0.02em', color: '#FFFFFF', margin: '12px 0 18px',
              }}>{lang === 'en' ? 'Coming soon' : 'Pian saatavilla'}</h1>
              <p style={{ color: 'var(--ink, #ECE6D8)', fontSize: 16, lineHeight: 1.55, maxWidth: 580, margin: '0 0 22px' }}>
                {lang === 'en'
                  ? "PUTKI HQ's guess-the-winner editorial raffle. Coming after legal review. Free to enter, no deposit, no betting."
                  : 'PUTKI HQ:n voittaja-ennustus -arvonta. Avautuu lainopillisen tarkistuksen jälkeen. Ilmainen osallistua, ei talletusta, ei vedonlyöntiä.'}
              </p>
              <span data-testid="voita-disabled-cta" style={{
                color: 'var(--muted, #9C9587)',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.18em', fontWeight: 700,
              }}>{lang === 'en' ? 'AWAITING APPROVAL' : 'ODOTTAA HYVÄKSYNTÄÄ'}</span>
            </>
          )}
        </div>
      </section>

      {/* Live raffles list */}
      {enabled && raffles.length > 0 && (
        <section data-testid="voita-raffles" style={{
          borderTop: '1px solid var(--hairline, #221E1B)',
          padding: '24px 0 40px',
        }}>
          <YourRecordStrip lang={lang} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
            {raffles.map((r) => <RaffleCard key={r.id} r={r} lang={lang} />)}
          </div>
        </section>
      )}

      {/* WHAT TO EXPECT — shows on both states */}
      <section data-testid="voita-explainer" style={{ borderTop: '1px solid var(--hairline, #221E1B)', padding: '32px 0' }}>
        <span style={{
          color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.24em', fontWeight: 700, display: 'block', marginBottom: 14,
        }}>{lang === 'en' ? 'HOW IT WORKS' : 'NÄIN SE TOIMII'}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--hairline, #221E1B)' }} className="voita-explainer-grid">
          {[
            ['01', lang === 'en' ? 'Predict 1-X-2 + closest score' : 'Arvaa 1-X-2 + lopputulos',
             lang === 'en' ? 'Pick the winner and the score. Free entry — email only.' : 'Valitse voittaja ja maalimäärä. Ilmainen osallistua — vain sähköposti.'],
            ['02', lang === 'en' ? 'Scoring' : 'Pisteytys',
             lang === 'en' ? '3 pts for correct 1-X-2. Best-of: 5 exact score / 3 goal-difference / 1 total-goals.' : '3 pistettä oikeasta 1-X-2:sta. Paras: 5 tarkka, 3 maaliero, 1 maalisumma.'],
            ['03', lang === 'en' ? 'Top 5 win' : 'Top 5 voittaa',
             lang === 'en' ? 'Top 5 entries by points win a prize. Ties broken by deterministic random draw.' : 'Top 5 eniten pisteitä saanutta voittaa. Tasapelit ratkaistaan toistettavalla satunnaisarvalla.'],
          ].map(([n, t, b]) => (
            <div key={n} style={{ padding: '20px 22px', background: 'var(--surface, #141210)' }}>
              <div style={{ color: '#C13B2C', fontFamily: 'ui-monospace, monospace', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>{n}</div>
              <div style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 17, marginTop: 8, marginBottom: 6 }}>{t}</div>
              <p style={{ color: 'var(--ink, #ECE6D8)', fontSize: 13, lineHeight: 1.5, margin: 0, opacity: 0.88 }}>{b}</p>
            </div>
          ))}
        </div>
      </section>

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
        @media (max-width: 900px) {
          .voita-explainer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Voita;
