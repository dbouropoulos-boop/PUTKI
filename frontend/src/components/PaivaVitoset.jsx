/**
 * PaivaVitoset - "Päivän tärpit · Today's market watch"
 *
 * Phase 1 rebuild (Section 7 of the brief):
 *   1. Daily Market Watch Card at the top of the section (Sharpness +
 *      30-day sparkline + band label).
 *   2. Soundbite pick cards - scannable in <1s; click-to-expand reveals
 *      structural analysis + bookmaker + reporting citations + disclosure.
 *   3. Sharpness bar + modifier per pick.
 *   4. Track record line at the bottom (journalism framing - market consensus,
 *      not "did we win bets").
 *
 * Backend feeds:
 *   GET /api/odds/featured     - picks with Sharpness object attached
 *   GET /api/odds/market-watch - daily score + sparkline
 *
 * Removed in this rebuild:
 *   - Orange Telegram CTA bar (Section 7f)
 *   - Modal subscription overlay (consolidated to single CTA elsewhere)
 *   - Confidence-band color noise (uses semantic data-accent + state colors only)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, Zap, TrendingDown, Calculator } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 5 * 60_000;

const BAND_LABELS = {
  tight:     { fi: 'Markkinat ovat tiukat',         en: 'Markets are tight' },
  clear:     { fi: 'Markkinat ovat selkeät',        en: 'Markets are clear' },
  mixed:     { fi: 'Markkinat ovat sekoittuneet',   en: 'Markets are mixed' },
  loose:     { fi: 'Markkinat ovat löysät',         en: 'Markets are loose' },
  scattered: { fi: 'Markkinat ovat hajallaan',      en: 'Markets are scattered' },
};

const fmtKickoff = (iso, lang) => {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    const now = new Date();
    const diffH = (dt.getTime() - now.getTime()) / 3600_000;
    const locale = lang === 'en' ? 'en-GB' : 'fi-FI';
    const dateFmt = new Intl.DateTimeFormat(locale, {
      weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Helsinki',
    });
    const timeFmt = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki',
    });
    if (diffH < 0) return (lang === 'en' ? 'LIVE' : 'LIVENÄ');
    if (diffH < 24) return `${lang === 'en' ? 'Today' : 'Tänään'} ${timeFmt.format(dt)}`;
    return `${dateFmt.format(dt)} · ${timeFmt.format(dt)}`;
  } catch { return ''; }
};

const Sparkline = ({ points }) => {
  if (!points || points.length === 0) return null;
  const W = 200, H = 32, P = 2;
  const vals = points.map((p) => p.score);
  const lo = Math.min(...vals, 30);
  const hi = Math.max(...vals, 100);
  const range = Math.max(1, hi - lo);
  const stepX = (W - P * 2) / Math.max(1, points.length - 1);
  const path = points.map((p, i) => {
    const x = P + i * stepX;
    const y = P + (H - P * 2) * (1 - (p.score - lo) / range);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const lastX = P + (points.length - 1) * stepX;
  const lastY = P + (H - P * 2) * (1 - (vals[vals.length - 1] - lo) / range);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} data-testid="market-watch-sparkline"
         style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="var(--data-accent, #4FB3A5)" strokeWidth={1.6} />
      <circle cx={lastX} cy={lastY} r={2.8} fill="var(--data-accent, #4FB3A5)">
        <animate attributeName="r" values="2.8;4.2;2.8" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};

const SharpnessBar = ({ value, modifier, lang, onVerify }) => {
  const pct = Math.max(0, Math.min(100, value || 0));
  const mod = modifier
    ? (modifier === 'tightened'
        ? { icon: Zap,           label_fi: 'tiukentunut tänään', label_en: 'tightened today' }
        : { icon: TrendingDown,  label_fi: 'löystynyt tänään',   label_en: 'softened today'  })
    : null;
  return (
    <div className="flex items-center gap-3 flex-wrap" data-testid="sharpness-bar">
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.10em', color: 'var(--ink)', fontWeight: 700 }}>
        Sharpness {value}/100
      </div>
      <div style={{
        position: 'relative', width: 120, height: 4, background: 'rgba(122,126,131,0.20)',
        borderRadius: 1, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: 'var(--data-accent, #4FB3A5)',
          transition: 'width 600ms ease',
        }} />
      </div>
      {mod && (
        <span className="mono inline-flex items-center gap-1"
              style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 600 }}>
          <mod.icon strokeWidth={1.7} size={11} />
          {lang === 'en' ? mod.label_en : mod.label_fi}
        </span>
      )}
      {onVerify && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVerify(); }}
          data-testid="verify-math-toggle"
          className="mono inline-flex items-center gap-1"
          style={{
            fontSize: 10, letterSpacing: '0.16em', color: 'var(--data-accent, #4FB3A5)',
            fontWeight: 700, background: 'transparent', border: '1px solid currentColor',
            padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
          }}
        >
          <Calculator strokeWidth={1.8} size={11} />
          {lang === 'en' ? 'MATH' : 'MATEMATIIKKA'}
        </button>
      )}
    </div>
  );
};

/**
 * VerifyMathPanel - worksheet-style breakdown of the Sharpness components.
 * Per Phase 1 user spec: plain-language labels, editorial layout, deterministic-
 * note closing line. Replaces a code block with an inline math worksheet.
 */
const VerifyMathPanel = ({ sharpness, lang }) => {
  if (!sharpness) return null;
  const c = sharpness.components || {};
  const w = sharpness.weights || {};
  const L_FI = {
    anchor: 'MATEMATIIKKA · MATH',
    ip: 'Markkinakerroin',
    ct: 'Konsensuksen tiukkuus',
    rm: 'Suunta 24 h',
    weight: 'Paino',
    score: 'Pisteet',
    weighted: 'Painotettu',
    no_history: 'Ei vielä 24 h historiaa - oletus 50.',
    closing: 'Sharpness on deterministinen. Sama data tuottaa aina saman pistemäärän.',
  };
  const L_EN = {
    anchor: 'MATEMATIIKKA · MATH',
    ip: 'Market odds',
    ct: 'Consensus tightness',
    rm: '24h direction',
    weight: 'Weight',
    score: 'Score',
    weighted: 'Weighted',
    no_history: 'No 24h history yet - defaults to 50.',
    closing: 'Sharpness is deterministic. The same data always produces the same score.',
  };
  const L = lang === 'en' ? L_EN : L_FI;
  const rows = [
    { name: L.ip, value: c.implied_prob_score, weight: w.implied_prob || 0.5 },
    { name: L.ct, value: c.consensus_tightness, weight: w.tightness || 0.3 },
    { name: L.rm, value: c.recency_momentum,   weight: w.momentum || 0.2,
      note: sharpness.has_momentum_history === false ? L.no_history : null },
  ];
  const fmt = (n) => (n == null ? '-' : Number(n).toFixed(1));

  return (
    <div data-testid="verify-math-panel"
         style={{
           marginTop: 12, padding: '14px 16px',
           background: 'var(--bg)', border: '1px solid var(--border)',
           borderLeft: '2px solid var(--data-accent, #4FB3A5)', borderRadius: 2,
         }}>
      <div className="mono mb-3"
           style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        {L.anchor}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left',  padding: '6px 8px 6px 0', fontWeight: 600, fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em' }}>
              {/* component name */}
            </th>
            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', width: 70 }}>
              {L.score}
            </th>
            <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', width: 70 }}>
              {L.weight}
            </th>
            <th style={{ textAlign: 'right', padding: '6px 0 6px 8px', fontWeight: 600, fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', width: 80 }}>
              {L.weighted}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="font-serif" style={{ padding: '8px 8px 8px 0', fontSize: 13, color: 'var(--ink)' }}>
                {r.name}
                {r.note && (
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 2, fontStyle: 'italic' }}>
                    {r.note}
                  </div>
                )}
              </td>
              <td className="mono" style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: 'var(--ink)' }}>{fmt(r.value)}</td>
              <td className="mono" style={{ padding: '8px', textAlign: 'right', fontSize: 13, color: 'var(--muted)' }}>× {r.weight.toFixed(2)}</td>
              <td className="mono" style={{ padding: '8px 0 8px 8px', textAlign: 'right', fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>
                {r.value != null ? (r.value * r.weight).toFixed(1) : '-'}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--border-strong)' }}>
            <td colSpan={3}
                className="mono"
                style={{ padding: '8px 8px 4px 0', textAlign: 'right', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.14em', fontWeight: 600 }}>
              {lang === 'en' ? 'TOTAL' : 'YHTEENSÄ'}
            </td>
            <td className="mono" style={{ padding: '8px 0 4px 8px', textAlign: 'right', fontSize: 16, color: 'var(--ink)', fontWeight: 800 }}>
              {sharpness.sharpness}/100
            </td>
          </tr>
        </tbody>
      </table>
      <p className="font-serif"
         style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 10, fontStyle: 'italic' }}>
        {L.closing}
      </p>
    </div>
  );
};

const PickCard = ({ pick, idx, lang }) => {
  const [open, setOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const opp = pick.pick_side === 'home' ? pick.away_team : pick.home_team;
  const sharpness = pick.sharpness || {};
  const kickoff = fmtKickoff(pick.commence_time, lang);
  const consensusLabel = lang === 'en'
    ? `Market consensus · ${pick.bookmaker_count} bookmakers`
    : `Markkinakonsensus · ${pick.bookmaker_count} vedonlyöntiyhtiötä`;

  return (
    <li
      className="panel"
      data-testid={`pick-card-${idx}`}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`pick-card-${idx}-toggle`}
        className="w-full text-left"
        style={{ padding: '14px 18px', display: 'block', cursor: 'pointer', background: 'transparent', border: 'none' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="mono flex items-center justify-center shrink-0"
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              fontSize: 11, fontWeight: 700, color: 'var(--ink)',
            }}
          >
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="display"
                 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>
              {pick.pick_team} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>vs</span> {opp}
            </div>
            <div className="mono mt-1 inline-flex items-center gap-2 flex-wrap"
                 style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
              <span>{(pick.sport_label || '').toUpperCase()}</span>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <Clock strokeWidth={1.7} size={10} />
              <span>{kickoff}</span>
            </div>
            <div className="mono mt-2 inline-flex items-baseline gap-2"
                 style={{ fontSize: 12, color: 'var(--ink)', letterSpacing: '0.04em', fontWeight: 600 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {Number(pick.decimal_odds).toFixed(2)}
              </span>
              <span style={{ color: 'var(--muted)' }}>·</span>
              <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{pick.bookmaker}</span>
            </div>
            <div className="mono mt-2"
                 style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', fontWeight: 500 }}>
              {consensusLabel}
            </div>
            <div className="mt-3">
              <SharpnessBar
                value={sharpness.sharpness}
                modifier={sharpness.modifier}
                lang={lang}
                onVerify={() => setMathOpen((v) => !v)}
              />
            </div>
            {mathOpen && (
              <VerifyMathPanel sharpness={sharpness} lang={lang} />
            )}
          </div>
          <div className="mono shrink-0 flex items-center"
               style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', gap: 4 }}>
            {open
              ? <>{lang === 'en' ? 'CLOSE' : 'SULJE'} <ChevronUp strokeWidth={1.7} size={11} /></>
              : <>{lang === 'en' ? 'ANALYSIS' : 'ANALYYSI'} <ChevronDown strokeWidth={1.7} size={11} /></>
            }
          </div>
        </div>
      </button>
      {open && (
        <div data-testid={`pick-card-${idx}-expanded`}
             style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--surface)' }}>
          <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>
            {lang === 'en'
              ? `The bookmaker consensus has settled around ${pick.pick_team} at ${Number(pick.decimal_odds).toFixed(2)} across ${pick.bookmaker_count} books. Sharpness ${sharpness.sharpness}/100 - ${BAND_LABELS[sharpness.band || 'mixed'].en.toLowerCase()}.`
              : `Vedonlyöntiyhtiöiden konsensus on asettunut ${pick.pick_team} -joukkueeseen kertoimella ${Number(pick.decimal_odds).toFixed(2)} ${pick.bookmaker_count} kirjassa. Sharpness ${sharpness.sharpness}/100 - ${BAND_LABELS[sharpness.band || 'mixed'].fi.toLowerCase()}.`}
          </p>
          <p className="mono mt-2"
             style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en' ? `Sources: ${pick.bookmaker}` : `Lähde: ${pick.bookmaker}`}
            {sharpness.has_momentum_history === false && (
              <> · {lang === 'en' ? '24h momentum: not enough history' : '24 h momentti: ei riittävää historiaa'}</>
            )}
          </p>
          <p className="font-serif mt-3"
             style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, fontStyle: 'italic' }}
             data-testid={`pick-card-${idx}-disclosure`}>
            {lang === 'en'
              ? 'PUTKI HQ does not place bets. This is editorial analysis of market consensus.'
              : 'PUTKI HQ ei lyö vetoa. Tämä on toimituksellinen analyysi markkinakonsensuksesta.'}
          </p>
        </div>
      )}
    </li>
  );
};

const DailyMarketWatchCard = ({ data, lang }) => {
  if (!data || data.score == null) return null;
  const band = BAND_LABELS[data.band] || BAND_LABELS.mixed;
  const heading = lang === 'en' ? 'Today\u2019s market watch' : 'Päivän markkinakatsaus';
  return (
    <div className="panel"
         data-testid="daily-market-watch"
         style={{
           background: 'var(--bg)',
           border: '1px solid var(--border-strong)',
           borderRadius: 4,
           padding: '18px 20px',
           marginBottom: 16,
         }}>
      <div className="mono mb-2"
           style={{ fontSize: 10.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        {heading.toUpperCase()}
      </div>
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div className="display"
             style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.05 }}>
          Sharpness {data.score}/100
          <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginLeft: 10, letterSpacing: '0.06em' }}>
            - {lang === 'en' ? band.en : band.fi}
          </span>
        </div>
        <Sparkline points={data.sparkline} />
      </div>
    </div>
  );
};

const PaivaVitoset = () => {
  const { lang } = useLang();
  const [data, setData] = useState(null);
  const [marketWatch, setMarketWatch] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [pR, mR] = await Promise.all([
        fetch(`${BACKEND}/api/odds/featured`),
        fetch(`${BACKEND}/api/odds/market-watch`),
      ]);
      if (pR.ok) setData(await pR.json());
      if (mR.ok) setMarketWatch(await mR.json());
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const picks = data?.picks || [];
  const dormant = data?.dormant;
  const sectionTitle = lang === 'en' ? 'Today\u2019s market watch' : 'Päivän tärpit';
  const sectionAnchor = lang === 'en'
    ? 'TODAY\u2019S TIPS · MARKET CONSENSUS'
    : 'PÄIVÄN TÄRPIT · MARKKINAKONSENSUS';

  return (
    <section className="container-wide" data-testid="paivan-vitoset">
      <div className="mb-5">
        <div className="mono mb-2"
             style={{ fontSize: 10.5, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 700 }}>
          {sectionAnchor}
        </div>
        <h2 className="display" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.08, color: 'var(--ink)' }}>
          {sectionTitle}
        </h2>
      </div>

      <DailyMarketWatchCard data={marketWatch} lang={lang} />

      {dormant ? (
        <div className="panel p-6 mono text-center"
             data-testid="paivan-vitoset-dormant"
             style={{ background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.18em' }}>
          {lang === 'en'
            ? 'TODAY\u2019S TIPS PUBLISHED AT 10:00'
            : 'PÄIVÄN TÄRPIT JULKAISTAAN KLO 10'}
        </div>
      ) : error ? (
        <div className="panel p-6 mono"
             style={{ background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.18em' }}>
          {lang === 'en'
            ? 'TIP GENERATION FAILED. EDITORIAL REVIEWING.'
            : 'TÄRPPIEN GENEROINTI EPÄONNISTUI. TOIMITUS TARKISTAA.'}
        </div>
      ) : picks.length === 0 ? (
        <div className="panel p-6 mono"
             style={{ background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.18em' }}>
          {lang === 'en' ? 'NO TIPS PUBLISHED YET TODAY' : 'EI VIELÄ TÄNÄÄN JULKAISTUJA TÄRPPEJÄ'}
        </div>
      ) : (
        <ol data-testid="picks-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {picks.map((p, i) => (
            <PickCard key={p.event_id || i} pick={p} idx={i} lang={lang} />
          ))}
        </ol>
      )}

      {/* Track record line - journalism framing per Section 7d */}
      <div className="mono mt-5"
           data-testid="paivan-vitoset-track-record"
           style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 500 }}>
        {lang === 'en'
          ? `Last 7 days · Market consensus tracked across ${picks.length} tips · 30-day Sharpness average: ${marketWatch?.score ?? '-'}/100`
          : `Viimeinen 7 päivää · Markkinakonsensus seurattu ${picks.length} tärpissä · 30 päivän Sharpness-keskiarvo: ${marketWatch?.score ?? '-'}/100`}
      </div>
    </section>
  );
};

export default PaivaVitoset;
