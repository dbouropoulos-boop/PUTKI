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
        style={{ position: 'relative', padding: '64px 0 36px', minHeight: 260, overflow: 'hidden' }}>
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
          <div style={{ display: 'grid', gap: 14 }}>
            {raffles.map((r) => (
              <Link key={r.id} to={`/voita/${r.slug}`}
                data-testid={`voita-raffle-card-${r.slug}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 16,
                  padding: '20px 22px', background: 'var(--surface, #141210)',
                  border: '1px solid var(--hairline, #221E1B)', textDecoration: 'none',
                }}>
                <div>
                  <div style={{
                    color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace',
                    fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4,
                  }}>{(r.sport || '').toUpperCase()} {r.league ? `· ${r.league.toUpperCase()}` : ''}</div>
                  <div style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700 }}>
                    {r.home_team} <span style={{ color: 'var(--muted)' }}>vs</span> {r.away_team}
                  </div>
                  <div style={{ color: 'var(--muted, #9C9587)', fontSize: 12.5, marginTop: 6, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
                    {lang === 'en' ? 'Entries close' : 'Osallistuminen päättyy'}: {fmtDate(r.entries_close_at, lang)}
                  </div>
                </div>
                <div style={{ alignSelf: 'center', textAlign: 'right' }}>
                  <div style={{ color: '#FFD66E', fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700 }}>
                    €{(r.prize_distribution?.payouts || []).reduce((s, p) => s + (p.amount_eur || 0), 0)}
                  </div>
                  <div style={{ color: 'var(--muted, #9C9587)', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700 }}>
                    {lang === 'en' ? 'PRIZE POOL · ENTER →' : 'PALKINTOPOTTI · OSALLISTU →'}
                  </div>
                </div>
              </Link>
            ))}
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
