/**
 * Peli — Conversion-optimized prize game page.
 *
 * Sections (in order, per Dioni's spec):
 *   1. HERO        — eyebrow, headline, prize amounts, CTA scroll
 *   2. IFRAME      — Smartico embed (placeholder URL until whitelist clears)
 *   3. PRIZES      — 500€ / 250€ / 100€ structure cards
 *   4. HOW TO PLAY — 4 numbered steps
 *   5. LEADERBOARD — honest live count from API (no fabricated 247 players)
 *   6. ACTIVITY    — auto-published article excerpt strip (trust signal)
 *   7. TRUST       — MGA / 18+ / Pelaa vastuullisesti / Suomenkielinen
 *
 * Replaces previous MiniGame component on /peli route.
 */
import React, { useEffect, useState } from 'react';
import { Gift, Trophy, Shield, BadgeCheck, ArrowDown, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import useDocumentMeta from '../hooks/useDocumentMeta';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// PLACEHOLDER URL — flip to the real Smartico embed URL when the whitelist
// clears. The shell, prize copy and CTA stay the same.
const SMARTICO_IFRAME_URL = process.env.REACT_APP_SMARTICO_URL || '';

const PRIZES = [
  { rank: '1.', amount: '500 €', label: 'Päävoitto', color: '#E8924A' },
  { rank: '2.', amount: '250 €', label: 'Hopea',     color: '#9C9FA3' },
  { rank: '3.', amount: '100 €', label: 'Pronssi',   color: '#A56D3A' },
];

const STEPS = [
  { n: 1, title: 'Aseta hälytys', body: 'Anna sähköposti ja saat ilmoituksen kierroksen alkaessa. Ei rekisteröitymistä, ei talletusta.' },
  { n: 2, title: 'Aloita peli',   body: 'Klikkaa "Aloita peli" -painiketta yllä. Smartico-pelialusta latautuu kehykseen.' },
  { n: 3, title: 'Kerää pisteitä', body: 'Pelin sisällä jokainen kierros kerää pisteitä, jotka näkyvät leaderboardilla reaaliajassa.' },
  { n: 4, title: 'Voita palkinto', body: 'Kuukauden top-3 saa palkinnon sähköpostitse. Voittajat julkistetaan kuun ensimmäisenä päivänä.' },
];

const TRUST_BADGES = [
  { icon: Shield,    label: 'MGA · LISENSOITU PELIALUSTA' },
  { icon: BadgeCheck,label: '18+ · IKÄRAJA TARKASTETAAN' },
  { icon: Trophy,    label: 'EI TALLETUSTA · ILMAISKILPAILU' },
  { icon: Gift,      label: 'SUOMENKIELINEN TOIMITUS' },
];

const Peli = () => {
  const [activity, setActivity] = useState([]);
  const [leaderCount, setLeaderCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useDocumentMeta({
    title: 'Peli — voita 500 € · PUTKI HQ',
    description: 'PUTKI HQ:n kuukausittainen palkintopeli — top-3 voittaa 500 € / 250 € / 100 €. Ei talletusta.',
    canonical: `${BACKEND}/peli`,
  });

  useEffect(() => {
    fetch(`${BACKEND}/api/content/published?limit=4`)
      .then((r) => r.json())
      .then((d) => { setActivity(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`${BACKEND}/api/signup/count`)
      .then((r) => r.ok ? r.json() : { count: null })
      .then((d) => setLeaderCount(d.count))
      .catch(() => {});
  }, []);

  const scrollToIframe = () => {
    const el = document.getElementById('peli-iframe');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-testid="peli-page">
      {/* HERO */}
      <section className="container-wide pt-12 sm:pt-20 pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 inline-flex items-center gap-2">
            <Gift strokeWidth={1.5} size={13} />
            PUTKI HQ · KUUKAUDEN KISA
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-5" style={{ lineHeight: 1.04 }}>
            Voita 500 €
          </h1>
          <p className="display text-2xl sm:text-3xl mb-4" style={{ color: 'var(--muted)', lineHeight: 1.25 }}>
            Ei talletusta. Ei panostusta. Top-3 voittaa.
          </p>
          <p className="prose-mittari max-w-2xl mb-6">
            Kuukausittainen palkintopeli. Pelaa selaimessa, kerää pisteitä,
            kärkikolmikko jakaa palkinnot kuun lopussa. Smartico-pelialusta vastaa
            pelitoiminnallisuudesta, PUTKI HQ -toimitus järjestää kisaa.
          </p>
          <button
            type="button"
            onClick={scrollToIframe}
            data-testid="peli-hero-cta"
            className="mono inline-flex items-center gap-2"
            style={{
              padding: '14px 22px',
              background: 'var(--ink)', color: 'var(--bg)',
              fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
              border: 'none', cursor: 'pointer', borderRadius: 2,
            }}
          >
            ALOITA PELI
            <ArrowDown strokeWidth={2} size={13} />
          </button>
        </div>
      </section>

      {/* IFRAME */}
      <section id="peli-iframe" className="container-wide pb-12"
               data-testid="peli-iframe-section">
        <div className="panel" style={{ background: '#0A0A0A', borderRadius: 4, overflow: 'hidden',
                                         border: '1px solid var(--border-strong)' }}>
          <div className="mono px-4 sm:px-5 py-3 flex items-center justify-between"
               style={{ background: 'rgba(255,255,255,0.04)', color: '#F5F3EE',
                        fontSize: 10, letterSpacing: '0.22em', fontWeight: 700,
                        borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span>SMARTICO PELIALUSTA</span>
            <span style={{ opacity: 0.6 }}>1200 × 800</span>
          </div>
          {SMARTICO_IFRAME_URL ? (
            <iframe
              title="Smartico Peli"
              src={SMARTICO_IFRAME_URL}
              data-testid="peli-iframe"
              style={{
                width: '100%', height: 720, border: 'none', display: 'block',
                background: '#0A0A0A',
              }}
            />
          ) : (
            <div className="text-center py-24 px-6 mono" data-testid="peli-iframe-placeholder"
                 style={{ color: '#F5F3EE', fontSize: 12, letterSpacing: '0.22em',
                          fontWeight: 600, lineHeight: 1.8 }}>
              <Loader2 strokeWidth={1.5} size={24} className="animate-spin mx-auto mb-5" style={{ opacity: 0.4 }} />
              PELIALUSTA ODOTTAA SMARTICO-WHITELISTAUSTA<br />
              <span style={{ opacity: 0.5, fontSize: 10.5, letterSpacing: '0.18em' }}>
                · OTA HÄLYTYS PÄÄLLE ALLE — ILMOITAMME KUN KISA AUKEAA ·
              </span>
            </div>
          )}
        </div>
      </section>

      {/* PRIZES */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-6">KUUKAUDEN PALKINNOT · ILMAISKILPAILU</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="peli-prizes">
            {PRIZES.map((p) => (
              <article
                key={p.rank}
                className="panel p-6"
                style={{ background: 'var(--bg)', borderTop: `4px solid ${p.color}`, borderRadius: 4 }}
                data-testid={`peli-prize-${p.rank.replace('.','')}`}
              >
                <div className="mono mb-3" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                  SIJA {p.rank}
                </div>
                <div className="display mb-1" style={{ fontSize: 40, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {p.amount}
                </div>
                <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: p.color, fontWeight: 700 }}>
                  {p.label.toUpperCase()}
                </div>
              </article>
            ))}
          </div>
          <p className="mono mt-5" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            * PALKINTOSUMMAT VAHVISTETAAN KUUKAUSITTAIN · MAKSU SÄHKÖPOSTIIN VOITTAJALLE
          </p>
        </div>
      </section>

      {/* HOW TO PLAY */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-6">MITEN PELATAAN · NELJÄ ASKELTA</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="peli-steps">
            {STEPS.map((s) => (
              <article key={s.n} className="panel p-6" style={{ background: 'var(--bg)' }}
                       data-testid={`peli-step-${s.n}`}>
                <div className="mono mb-3 inline-flex items-center justify-center"
                     style={{ width: 32, height: 32, borderRadius: 999,
                              background: 'var(--ink)', color: 'var(--bg)',
                              fontSize: 12, fontWeight: 800 }}>
                  {String(s.n).padStart(2,'0')}
                </div>
                <h3 className="display mb-2" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                  {s.title}
                </h3>
                <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* LEADERBOARD (honest) */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
            <div className="eyebrow inline-flex items-center gap-2">
              <Trophy strokeWidth={1.5} size={12} />
              LEADERBOARD
            </div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}
                 data-testid="peli-leader-count">
              {leaderCount != null ? `${leaderCount} PELAAJAA REKISTERÖITYNYT` : 'PÄIVITTYY KISAN ALKAESSA'}
            </div>
          </div>
          <div className="panel p-8 text-center mono" data-testid="peli-leaderboard-empty"
               style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600,
                        background: 'var(--bg)' }}>
            LEADERBOARD AKTIVOITUU KUN ENSIMMÄINEN KIERROS PELATAAN
          </div>
        </div>
      </section>

      {/* SITE ACTIVITY STRIP — proves PUTKI HQ is active */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6">
            <div className="eyebrow">VIIMEISIMMÄT UUTISET</div>
            <Link to="/uutiset" className="mono" data-testid="peli-uutiset-link"
                  style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700, textDecoration: 'none' }}>
              KATSO KAIKKI →
            </Link>
          </div>
          {loading ? (
            <div className="mono text-center" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.18em' }}>
              LADATAAN…
            </div>
          ) : activity.length === 0 ? (
            <div className="panel p-7 text-center mono"
                 style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.18em', background: 'var(--bg)' }}>
              UUSIA ARTIKKELEITA TULOSSA · LAYER 2 -TYÖNTEKIJÄT KESKITTYVÄT JUURI NYT
            </div>
          ) : (
            <ul className="space-y-3" data-testid="peli-activity-list">
              {activity.slice(0, 4).map((a) => (
                <li key={a.id} className="panel p-4 flex items-baseline gap-4 flex-wrap"
                    style={{ background: 'var(--bg)' }}>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
                    {(a.category || '').toUpperCase()}
                  </span>
                  <Link to={`/uutiset/${a.url_slug}`} className="font-serif"
                        style={{ fontSize: 15, color: 'var(--ink)', textDecoration: 'none', flex: 1, minWidth: 0 }}>
                    {a.headline}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* TRUST */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-6">LUOTETTAVUUS</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="peli-trust">
            {TRUST_BADGES.map((b, i) => {
              const Icon = b.icon;
              return (
                <div
                  key={i}
                  className="panel p-4 flex items-center gap-3"
                  style={{ background: 'var(--bg)' }}
                  data-testid={`peli-trust-${i}`}
                >
                  <Icon strokeWidth={1.5} size={20} style={{ color: 'var(--ink)', flexShrink: 0 }} />
                  <span className="mono"
                        style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mono mt-6" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.7 }}>
            PELAA VASTUULLISESTI · OTA YHTEYS{' '}
            <a href="https://peluuri.fi" target="_blank" rel="noopener noreferrer" className="underline">PELUURIIN</a>{' '}
            JOS PELAAMINEN HUOLESTUTTAA
          </p>
        </div>
      </section>
    </div>
  );
};

export default Peli;
