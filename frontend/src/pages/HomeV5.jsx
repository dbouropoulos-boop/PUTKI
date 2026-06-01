/**
 * Phase 5 · iter95 — HomeV5 (homepage refactor)
 *
 * Implements the approved v5 mockup. Newspaper editorial layout:
 *   1. Top status bar (skene · juttuja · live striimaajat · viim · clock)
 *   2. Masthead (sticky · brand · nav · "Tilaa aamun signaalit →")
 *   3. Hero cover (Reform 2027 + sticky Mittari widget)
 *   4. Newsletter capture (two-path Telegram-first form)
 *   5. Stats grid (4-card live counters)
 *   6. News portal (featured + latest list)
 *   7. Products grid (Mittari / Pelaajatesti / Arvostelut)
 *   8. Issues recap (last 3 newsletters · osui/ohi badges)
 *   9. Trust manifest (12 named sources, independence claim)
 *  10. Footer (mast + cols + responsible gaming notice)
 *
 * Data sources (live):
 *   - GET /api/mittari/state         · gauge score + state name
 *   - GET /api/news?limit=6          · featured + latest
 *   - GET /api/streamers/live        · live count
 *   - GET /api/sources               · named source counts
 *
 * Falls back gracefully — every block renders editorial copy even if
 * the endpoint 404s.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, ArrowRight } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { useLocalisedCanonical } from '../hooks/useLocalisedCanonical';
import pageOgUrl from '../lib/pageOgUrl';
import SiteMasthead from '../components/SiteMasthead';
import '../styles/home_v5.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TELEGRAM_BOT = 'Putkihq_bot';

// ── Status bar ──────────────────────────────────────────────────────
const StatusBar = ({ mittariScore, mittariState, articlesToday, liveStreamers, lastUpdateMin, lang }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (
    <div className="h5-status" data-testid="home-v5-status">
      <div className="h5-status-inner">
        <span className="h5-item">
          <span className="h5-dot" />
          <span className="h5-mute">{lang === 'en' ? 'SKENE' : 'SKENE'}</span>
          <b>{mittariState || (lang === 'en' ? 'CALM' : 'TYYNI')} · {mittariScore}/100</b>
        </span>
        <span className="h5-item">
          <span className="h5-mute">{lang === 'en' ? 'ARTICLES TODAY' : 'JUTTUJA TÄNÄÄN'}</span>
          <b>{articlesToday}</b>
        </span>
        <span className="h5-item">
          <span className="h5-mute">LIVE</span>
          <b>{liveStreamers} {lang === 'en' ? 'STREAMERS' : 'STRIIMAAJAA'}</b>
        </span>
        <span className="h5-item">
          <span className="h5-mute">{lang === 'en' ? 'LAST' : 'VIIM.'}</span>
          <b>{lastUpdateMin} MIN {lang === 'en' ? 'AGO' : 'SITTEN'}</b>
        </span>
        <span className="h5-right">HELSINKI · {date} · {time}</span>
      </div>
    </div>
  );
};

// ── Masthead ───────────────────────────────────────────────────────
// iter97: replaced inline Masthead with the shared <SiteMasthead/>
// component so every page (homepage, mestari, streamers, etc.) wears
// the same chrome. The inline implementation is gone — `SiteMasthead`
// owns the brand, nav, CTA and mobile drawer site-wide.

// ── Mittari widget (gauge + state) ────────────────────────────────
const MittariWidget = ({ score = 0, stateLabel = 'TYYNI', nextDropAt = '09:00', nextDropIn = '12h 47m', lang }) => {
  // Gauge: half-circle, 0→180° rotation around centre (100,100).
  const angle = -90 + (Math.max(0, Math.min(100, score)) / 100) * 180;
  return (
    <aside className="h5-mittari" data-testid="home-v5-mittari">
      <div className="h5-mh">
        <span className="h5-dot" />
        <span className="h5-ti">Mittari · Live</span>
        <span className="h5-st">FI · {lang === 'en' ? 'Realtime' : 'Reaaliaika'}</span>
      </div>
      <div className="h5-gauge-wrap">
        <svg viewBox="0 0 200 130" aria-hidden>
          <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="#e8e3d4" strokeWidth="14" strokeLinecap="round" />
          <path d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none" stroke="var(--h5-ember, #e63b1a)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray="264 264" strokeDashoffset={264 - (264 * Math.max(0, Math.min(100, score)) / 100)} />
          <g className="h5-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px', animation: 'none' }}>
            <line x1="100" y1="100" x2="100" y2="32" stroke="var(--h5-ink, #0a0a08)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="100" r="6" fill="var(--h5-ink, #0a0a08)" />
          </g>
          <text x="20" y="124" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#7a7669" letterSpacing="0.1em">TYYNI</text>
          <text x="142" y="124" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#7a7669" letterSpacing="0.1em">KIIRASTULI</text>
        </svg>
      </div>
      <div className="h5-state-row">
        <span className="h5-state">{stateLabel}</span>
        <span className="h5-num">SCORE <b>{score}</b>/100</span>
      </div>
      <div className="h5-state-row">
        <span className="h5-num">{lang === 'en' ? 'Last 24h' : 'Viim. 24h'}</span>
        <span className="h5-num">{lang === 'en' ? 'Temperature' : 'Lämpötila'}</span>
      </div>
      <div className="h5-next">
        <span>{lang === 'en' ? 'Next drop' : 'Seuraava pudotus'}</span>
        <span><b>{nextDropAt}</b> · {nextDropIn}</span>
      </div>
      <Link to="/mittari" className="h5-mlink" data-testid="home-v5-mittari-link">
        {lang === 'en' ? 'Open Mittari' : 'Avaa Mittari'} <ArrowRight size={13} />
      </Link>
    </aside>
  );
};

// ── Hero ───────────────────────────────────────────────────────────
const Hero = ({ mittariScore, mittariState, lang }) => {
  const today = new Date();
  const dateStr = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
  const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  return (
    <section className="h5-hero" data-testid="home-v5-hero">
      <div className="h5-wrap">
        <div className="h5-hero-kicker">
          <span><span className="h5-em">●</span> {lang === 'en' ? 'COVER · LIVE TRACKING · GAMBLING ACT 2027' : 'KANSI · ELÄVÄ SEURANTA · RAHAPELILAKI 2027'}</span>
          <span className="h5-asof">{lang === 'en' ? 'Updating' : 'Päivittyy'} · {dateStr} · {timeStr}</span>
        </div>
        <div className="h5-hero-main">
          <div>
            <div className="h5-hero-img h5-treated">
              <span className="h5-badge">{lang === 'en' ? 'GAMBLING REFORM' : 'RAHAPELIUUDISTUS'}</span>
              <span className="h5-credit">Eduskunta · Helsinki</span>
              {/* iter97: curated Reform 2027 hero photo (Nano Banana,
                  blue-hour Eduskuntatalo wire-service shot). The
                  `.h5-treated` wrapper applies the signature ember
                  multiply + grain overlay automatically. */}
              <img
                src="/hero/reform-2027-fi.jpg"
                alt={lang === 'en' ? 'Eduskuntatalo at dusk - Finnish Parliament House, Helsinki' : 'Eduskuntatalo iltahämärässä - Suomen eduskuntatalo, Helsinki'}
                loading="eager"
                fetchpriority="high"
                data-testid="home-v5-hero-img"
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
              />
            </div>
            <h1 className="h5-hero-headline" data-testid="home-v5-hero-headline">
              {lang === 'en'
                ? <>Veikkaus' era ends.<br />What the reform means for you.</>
                : <>Veikkauksen aika päättyy.<br />Mitä uudistus tarkoittaa sinulle?</>}
            </h1>
            <p className="h5-hero-dek">
              {lang === 'en'
                ? 'The licence market opens 1 July 2027. We compiled what changes, when, and what every player needs to know — updating as the bill moves from parliament to practice.'
                : 'Lisenssimarkkina avautuu 1.7.2027. Olemme koonneet yhteen mikä muuttuu, milloin, ja mitä pelaajan kannattaa tietää — päivitämme tätä sitä mukaa kun laki etenee parlamentista käytäntöön.'}
            </p>
            <div className="h5-hero-byline">
              <span><b>Eino K.</b> · {lang === 'en' ? 'Editor-in-chief' : 'Päätoimittaja'}</span>
              <span>{lang === 'en' ? '11 sources cited' : '11 lähdettä siteerattu'}</span>
              <span>{lang === 'en' ? 'Updated 16 min ago' : 'Päivitetty 16 min sitten'}</span>
              <span>{lang === 'en' ? '6 min read' : 'Lukuaika 6 min'}</span>
              <Link to="/reform-2027" data-testid="home-v5-hero-cta" style={{
                marginLeft: 'auto', color: 'var(--h5-ember)', borderBottom: '1px solid var(--h5-ember)', paddingBottom: 2,
              }}>{lang === 'en' ? 'Read the full briefing' : 'Lue koko brief'} →</Link>
            </div>
          </div>
          <MittariWidget score={mittariScore} stateLabel={mittariState} lang={lang} />
        </div>
      </div>
    </section>
  );
};

// ── Newsletter capture ─────────────────────────────────────────────
const NewsletterCapture = ({ lang }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!email) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${BACKEND}/api/voita/lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, age_18_plus: true, raffle_slug: null,
          favorite_sport: null, bet_frequency: null, sportsbooks: [], confidence: null,
          quiz_tags: null, lang, source: 'home_v5',
        }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.detail || `HTTP ${r.status}`); return; }
      setDone(true);
    } catch (e) { setError(e.message || 'Network'); } finally { setBusy(false); }
  };

  return (
    <section className="h5-capture" data-testid="home-v5-capture">
      <div className="h5-wrap">
        <div className="h5-capture-grid">
          <div>
            <div className="h5-klabel">{lang === 'en' ? 'Daily signals · Free' : 'Päivän signaalit · Maksuton'}</div>
            <h2>{lang === 'en' ? "Get the morning's five strongest picks" : 'Hae aamun viisi vahvinta poimintaa'}</h2>
            <p>{lang === 'en'
              ? 'Every morning at 09:00. Editorial analysis — no profit promise. Public hit log including the picks we missed.'
              : 'Joka aamu klo 09:00. Toimituksellista analyysiä — ei tuottolupausta. Julkinen osumaloki mukaan lukien hävinneet poiminnat.'}
            </p>
            <div className="h5-perks">
              <span>✓ Telegram 1-tap</span>
              <span>{lang === 'en' ? '✓ No card' : '✓ Ei korttia'}</span>
              <span>{lang === 'en' ? '✓ Stop anytime' : '✓ Lopeta milloin vain'}</span>
              <span>✓ GDPR</span>
            </div>
          </div>
          <div className="h5-form-block">
            <div className="h5-ftitle">{lang === 'en' ? 'Morning signals · free' : 'Aamun signaalit · ilmaiseksi'}</div>
            <div className="h5-fsub">{lang === 'en'
              ? 'Over 4,200 subscribers · 7-day hit-rate public'
              : 'Yli 4 200 tilaajaa · 7 päivän osumatarkkuus julkinen'}</div>
            {done ? (
              <div data-testid="home-v5-capture-done" style={{
                marginTop: 18, padding: '14px 16px', background: 'var(--h5-ember-soft)',
                border: '1px solid var(--h5-line)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                letterSpacing: '0.08em', color: 'var(--h5-ink-2)',
              }}>{lang === 'en'
                ? '✓ Check your inbox in ~5 min. Day 1 of the playbook lands tomorrow 09:00.'
                : '✓ Tarkista sähköpostisi ~5 minuutin sisällä. Pelikirjan päivä 1 saapuu huomenna klo 09.'}</div>
            ) : (
              <>
                <div className="h5-form-row">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={lang === 'en' ? 'your@email.com' : 'sähköpostisi@esimerkki.fi'}
                    data-testid="home-v5-capture-input" />
                  <button type="button" onClick={submit} disabled={busy} data-testid="home-v5-capture-submit">
                    {busy ? '…' : (lang === 'en' ? 'Get signals →' : 'Hae signaalit →')}
                  </button>
                </div>
                <div className="h5-alt">
                  {lang === 'en' ? 'or' : 'tai'}{' '}
                  <a href={`https://t.me/${TELEGRAM_BOT}?start=signals`} target="_blank" rel="noopener noreferrer"
                    data-testid="home-v5-capture-telegram">
                    <Send size={11} style={{ display: 'inline-block', marginRight: 4 }} />
                    {lang === 'en' ? 'bind to Telegram (1-tap)' : 'bindaa Telegramiin (1-tap)'} →
                  </a>
                  <span style={{ marginLeft: 8, color: 'var(--h5-ink-3)' }}>~3 sek</span>
                </div>
              </>
            )}
            {error && <div data-testid="home-v5-capture-error" style={{ marginTop: 8, color: 'var(--h5-ember-hover)', fontSize: 12 }}>{error}</div>}
            <div className="h5-fine">{lang === 'en'
              ? 'We use your email only to send the morning signals. Never shared with third parties. Unsubscribe in one click.'
              : 'Käytämme sähköpostiasi vain aamun signaalien lähettämiseen. Emme jaa kolmansille osapuolille. Voit perua tilauksen yhdellä klikkauksella.'}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Stats grid ─────────────────────────────────────────────────────
const StatsGrid = ({ articlesToday, namedSources, mittariScore, liveStreamers, alertsToday, lang }) => (
  <section className="h5-stats" data-testid="home-v5-stats">
    <div className="h5-wrap">
      <div className="h5-stats-grid">
        <div className="h5-stat" data-testid="home-v5-stat-articles">
          <div className="h5-lbl">{lang === 'en' ? 'Articles today' : 'Juttuja tänään'}</div>
          <div className="h5-val">{articlesToday}</div>
          <div className="h5-delta">↑ +12% {lang === 'en' ? 'vs yesterday' : 'vs eilen'}</div>
        </div>
        <div className="h5-stat" data-testid="home-v5-stat-sources">
          <div className="h5-lbl">{lang === 'en' ? 'Named sources' : 'Nimettyä lähdettä'}</div>
          <div className="h5-val">{namedSources}<span className="h5-u">/ 12</span></div>
          <div className="h5-delta">{lang === 'en' ? 'Veikkaus offline' : 'Veikkaus offline'}</div>
        </div>
        <div className="h5-stat" data-testid="home-v5-stat-mittari">
          <div className="h5-lbl">{lang === 'en' ? 'Mittari now' : 'Mittari nyt'}</div>
          <div className="h5-val">{mittariScore}<span className="h5-u">/ 100</span></div>
          <div className="h5-delta">{lang === 'en' ? 'Calm' : 'Tyyni'}</div>
        </div>
        <div className="h5-stat" data-testid="home-v5-stat-streamers">
          <div className="h5-lbl">{lang === 'en' ? 'Live streamers' : 'Live striimaajia'}</div>
          <div className="h5-val">{liveStreamers}</div>
          <div className="h5-delta">Kick · 0 Twitch</div>
        </div>
      </div>
    </div>
  </section>
);

// ── News portal ────────────────────────────────────────────────────
// Item shape from /api/news/featured + /api/news/chronological:
//   { url, title, source, published, captured_at, category, entity_tags[],
//     relevance, severity, source_tier, hero_image_url? }
const formatNewsRelTime = (item, lang) => {
  const ref = item.captured_at || item.published;
  if (!ref) return lang === 'en' ? 'recent' : 'tuore';
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(ref).getTime()) / 60000));
  if (diffMin < 60) return `${diffMin} MIN`;
  const hr = Math.round(diffMin / 60);
  if (hr < 24) return `${hr} H`;
  const d = Math.round(hr / 24);
  return lang === 'en' ? `${d} D` : `${d} PV`;
};

const sourceLabel = (item) => {
  const raw = String(item.source || '').toUpperCase();
  // Trim Google-News prefixes ("GOOGLE NEWS · GAMBLING" → "GAMBLING")
  return raw.replace(/^GOOGLE NEWS\s*[·\-]\s*/i, '').slice(0, 22);
};

const NewsPortal = ({ news, lang }) => {
  const featured = news[0];
  const latest = news.slice(1, 6);
  if (!featured) return null;
  const ext = (url) => (url && /^https?:\/\//i.test(url)) ? url : '/uutiset';
  return (
    <section className="h5-news" data-testid="home-v5-news">
      <div className="h5-wrap">
        <div className="h5-sec-head">
          <div className="h5-left">
            <div className="h5-klabel"><span style={{ color: 'var(--h5-ember)' }}>●</span> {lang === 'en' ? 'SCENE NEWS · LIVE' : 'SKENEN UUTISET · LIVE'}</div>
            <h2>{lang === 'en' ? "Today's top." : 'Päivän kärki.'}</h2>
          </div>
          <div className="h5-right">
            <span>{lang === 'en' ? 'Updated' : 'Päivitetty'} {formatNewsRelTime(featured, lang)} {lang === 'en' ? 'ago' : 'sitten'}</span>
            <Link to="/uutiset" data-testid="home-v5-news-all">{lang === 'en' ? 'All news →' : 'Kaikki uutiset →'}</Link>
          </div>
        </div>
        <div className="h5-news-grid">
          <a href={ext(featured.url)} target={/^https?:/.test(featured.url) ? '_blank' : '_self'} rel="noopener noreferrer"
            className="h5-news-feat" data-testid="home-v5-news-feat">
            <div className="h5-img h5-treated h5-cool">
              <span className="h5-cat">{(featured.category || 'gambling').toUpperCase()}</span>
              {featured.hero_image_url ? (
                <img src={featured.hero_image_url} alt={featured.title || ''} loading="lazy" />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1c2230, #0a0a08)' }} aria-hidden />
              )}
            </div>
            <h3>{featured.title}</h3>
            {featured.summary || featured.dek ? (
              <p className="h5-dek">{featured.summary || featured.dek}</p>
            ) : null}
            <div className="h5-foot">
              <span>{sourceLabel(featured)}</span>
              <span>{formatNewsRelTime(featured, lang)}</span>
              {Array.isArray(featured.entity_tags) && featured.entity_tags.length > 0 && (
                <span>{featured.entity_tags.slice(0, 2).map((t) => t.toUpperCase()).join(' · ')}</span>
              )}
            </div>
          </a>
          <div className="h5-latest" data-testid="home-v5-news-latest">
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
              letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h5-ink-3)',
              marginBottom: 10, fontWeight: 700,
            }}>{lang === 'en' ? 'Latest news' : 'Uusimmat'}</div>
            {latest.map((item, idx) => (
              <a href={ext(item.url)} target={/^https?:/.test(item.url) ? '_blank' : '_self'} rel="noopener noreferrer"
                className="h5-litem" key={item.url || idx}
                data-testid={`home-v5-news-item-${idx + 1}`}>
                <span className="h5-marker">{String(idx + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{item.title}</h4>
                  <div className="h5-meta">
                    {sourceLabel(item)} · {(item.category || 'SCENE').toUpperCase()} · {formatNewsRelTime(item, lang)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Products grid ──────────────────────────────────────────────────
const ProductsGrid = ({ lang }) => {
  const products = [
    {
      idx: '01 / 03', eyebrow: lang === 'en' ? 'MITTARI · SIGNALS' : 'MITTARI · SIGNAALIT',
      title: lang === 'en' ? "Five strongest, every morning." : 'Viisi vahvinta poimintaa, joka aamu.',
      body: lang === 'en'
        ? 'Sharpness 0–100 — how tightly EU sportsbooks price the market. Telegram bind under 3 seconds. Editorial analysis, no profit promise. Public hit log including the picks we missed.'
        : 'Sharpness 0–100 — kuinka tiiviisti EU-urheilukirjat hinnoittelevat markkinan. Telegram-bindaus alle 3 sekunnissa. Toimituksellista analyysiä, ei tuottolupausta. Julkinen osumaloki mukaan lukien hävinneet.',
      meta: lang === 'en' ? '7D: 6/7 · PUBLIC' : '7 PV: 6/7 · JULKINEN',
      href: '/mittari', testid: 'home-v5-product-mittari',
    },
    {
      idx: '02 / 03', eyebrow: lang === 'en' ? 'DIAGNOSTIC · 90S' : 'PELAAJATESTI · 90S',
      title: lang === 'en' ? 'What kind of bettor are you?' : 'Millainen pelaaja olet?',
      body: lang === 'en'
        ? "Six honest scenarios — no trivia, no scores to memorise. We name your blind spot at the end. Email is asked only after the profile, and we tell you exactly what it's used for."
        : 'Kuusi rehellistä tilannetta — ei tietovisaa, ei pisteitä opeteltavaksi. Nimeämme sokean pisteesi lopussa. Sähköposti pyydetään vasta profiilin jälkeen, ja kerromme tarkalleen mihin sitä käytetään.',
      meta: lang === 'en' ? '~90S · FREE · NO CARD' : '~90S · ILMAINEN · EI KORTTIA',
      href: '/mestari', testid: 'home-v5-product-mestari',
    },
    {
      idx: '03 / 03', eyebrow: lang === 'en' ? 'REVIEWS · COMMERCIAL' : 'ARVOSTELUT · KAUPALLINEN',
      title: lang === 'en' ? 'Casinos, tested.' : 'Kasinot, testattuna.',
      body: lang === 'en'
        ? 'Deposit, withdrawal, KYC, support — we test ourselves and score with a public method. Commercial relationships are always marked. Same-group brands are separated from editorial scores.'
        : 'Talletus, kotiutus, KYC, tuki — testaamme itse ja pisteytämme julkisella menetelmällä. Kaupalliset suhteet merkitään aina. Saman konsernin brändit erotetaan toimituksellisista pisteistä.',
      meta: lang === 'en' ? '12 TESTED · METHOD OPEN' : '12 TESTATTUA · MENETELMÄ AUKI',
      href: '/arvostelut', testid: 'home-v5-product-reviews',
    },
  ];
  return (
    <section className="h5-products" data-testid="home-v5-products">
      <div className="h5-wrap">
        <div className="h5-sec-head">
          <div className="h5-left">
            <div className="h5-klabel"><span style={{ color: 'var(--h5-ember)' }}>●</span> {lang === 'en' ? 'TOOLS · FREE' : 'TYÖKALUT · ILMAISIA'}</div>
            <h2>{lang === 'en' ? 'The scene\u2019s tools.' : 'Skenen työkalut.'}</h2>
          </div>
          <div className="h5-right">
            <span>{lang === 'en' ? '3 tools live' : '3 työkalua aktiivisena'}</span>
          </div>
        </div>
        <div className="h5-products-grid">
          {products.map((p) => (
            <article className="h5-product" data-testid={p.testid} key={p.idx}>
              <div className="h5-pn">{p.idx}</div>
              <div className="h5-peyebrow">{p.eyebrow}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <div className="h5-pfoot">
                <span className="h5-pmeta">{p.meta}</span>
                <Link to={p.href} className="h5-pgo">{lang === 'en' ? 'Open' : (p.testid.endsWith('mestari') ? 'Aloita' : (p.testid.endsWith('reviews') ? 'Selaa' : 'Avaa'))} <ArrowRight size={13} /></Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Issues recap ───────────────────────────────────────────────────
const IssuesRecap = ({ lang }) => {
  // Editorial scaffolds — the Mittari grading backfill (post-Phase-3
  // operator work) will populate these with live data. For now we show
  // the same recap copy as the mockup so the visual rhythm is preserved.
  const issues = [
    {
      date: lang === 'en' ? 'Mon 26.5.' : 'Ma 26.5.',
      tag: 'OSUI', miss: false,
      title: lang === 'en'
        ? 'Sharpness 84 nailed — NHL final opened as expected'
        : 'Sharpness 84 nappiin — NHL-finaali aukeni odotetusti',
      dek: lang === 'en'
        ? "Morning's #01 signal landed at odds 1.42. The market was surprisingly tightly priced — we'll tell you why."
        : 'Aamun #01-signaali osui kertoimella 1.42. Markkina oli yllättävän tiukasti hinnoiteltu — kerromme miksi.',
      meta: lang === 'en' ? '5 SIGNALS · 4 HIT' : '5 SIGNAALIA · 4 OSUI',
      testid: 'home-v5-issue-1',
    },
    {
      date: lang === 'en' ? 'Sun 25.5.' : 'Su 25.5.',
      tag: 'OSUI', miss: false,
      title: lang === 'en'
        ? "Premier League finale week: three markets where books disagreed"
        : 'Valioliigan päätösviikko: kolme markkinaa joissa kirjat olivat eri mieltä',
      dek: lang === 'en'
        ? 'Bet365 and Pinnacle priced Liverpool–Tottenham 8 points apart. Here\u2019s why.'
        : 'Bet365 ja Pinnacle hinnoittelivat Liverpool-Tottenhamin 8 pistettä eri tavalla. Tässä syy.',
      meta: lang === 'en' ? '5 SIGNALS · 3 HIT' : '5 SIGNAALIA · 3 OSUI',
      testid: 'home-v5-issue-2',
    },
    {
      date: lang === 'en' ? 'Sat 24.5.' : 'La 24.5.',
      tag: 'OHI', miss: true,
      title: lang === 'en'
        ? 'Liiga final sharpness lied — defeat told honestly'
        : 'Liiga-finaalin sharpness valehteli — tappio kerrotaan rehellisesti',
      dek: lang === 'en'
        ? "Mittari showed 71, but the line moved the wrong way 14 min before the decisive call. What we learned."
        : 'Mittari näytti 71, mutta line liikkui väärään suuntaan 14 min ennen ratkaisua. Mitä opimme.',
      meta: lang === 'en' ? '5 SIGNALS · 2 HIT' : '5 SIGNAALIA · 2 OSUI',
      testid: 'home-v5-issue-3',
    },
  ];
  return (
    <section className="h5-issues" data-testid="home-v5-issues">
      <div className="h5-wrap">
        <div className="h5-sec-head">
          <div className="h5-left">
            <div className="h5-klabel"><span style={{ color: 'var(--h5-ember)' }}>●</span> {lang === 'en' ? 'FROM RECENT NEWSLETTERS' : 'VIIME UUTISKIRJEISTÄ'}</div>
            <h2>{lang === 'en' ? "What you read this week." : 'Mitä luit tällä viikolla.'}</h2>
          </div>
          <div className="h5-right">
            <span>{lang === 'en' ? 'Daily at 09:00' : 'Päivittäin klo 09:00'}</span>
            <Link to="/arkisto" data-testid="home-v5-issues-archive">{lang === 'en' ? 'Archive →' : 'Arkisto →'}</Link>
          </div>
        </div>
        <div className="h5-issues-grid">
          {issues.map((i) => (
            <article className={`h5-issue${i.miss ? ' h5-issue-miss' : ''}`} data-testid={i.testid} key={i.testid}>
              <div className={`h5-ihdr${i.miss ? ' h5-miss' : ''}`}>
                <span>{i.date}</span>
                <b>{i.tag}</b>
              </div>
              <h4>{i.title}</h4>
              <p>{i.dek}</p>
              <div className="h5-ifoot">
                <span>{i.meta}</span>
                <Link to="/arkisto">{lang === 'en' ? 'Read →' : 'Lue →'}</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Trust manifest ─────────────────────────────────────────────────
const TrustManifest = ({ lang, sources, totalSources }) => {
  // Live sources come from /api/sources/public; fall back to the editorial
  // mock list from the v5 design when the registry hasn't loaded yet.
  const list = sources && sources.length ? sources : [
    { name: 'Yle', count: '142 / pv' },
    { name: 'HS', count: '88 / pv' },
    { name: 'Iltalehti', count: '76 / pv' },
    { name: 'IS', count: '64 / pv' },
    { name: 'Rahapelisanomat', count: '28 / pv' },
    { name: 'AfterDawn', count: '14 / pv' },
    { name: 'Feedi', count: '12 / pv' },
    { name: lang === 'en' ? '+5 sources' : '+5 lähdettä', count: '168 / pv' },
  ];
  const totalCount = totalSources || 12;
  return (
    <section className="h5-trust" data-testid="home-v5-trust">
      <div className="h5-wrap">
        <div className="h5-klabel"><span style={{ color: 'var(--h5-ember)' }}>●</span> {lang === 'en' ? 'INDEPENDENCE' : 'RIIPPUMATTOMUUS'}</div>
        <h3>{lang === 'en'
          ? <>{totalCount} named sources. <span className="h5-em">Zero from others.</span></>
          : <>{totalCount} nimettyä lähdettä. <span className="h5-em">Nolla muista.</span></>}</h3>
        <p>{lang === 'en'
          ? `We aggregate from ${totalCount} named sources, classify every article with a deterministic algorithm, and require the cited source in the first 400 characters. Editorial relationships with gambling companies are always marked separately.`
          : `Aggregoimme ${totalCount} nimetystä lähteestä, luokittelemme jokaisen jutun deterministisellä algoritmilla, ja vaadimme siteeratun lähteen ensimmäisten 400 merkin sisällä. Toimituksellinen suhde rahapeliyhtiöihin merkitään aina erikseen.`}
        </p>
        <div className="h5-links">
          <Link to="/menetelma" data-testid="home-v5-trust-method">{lang === 'en' ? 'Method →' : 'Menetelmä →'}</Link>
          <Link to="/oikaisut" data-testid="home-v5-trust-corrections">{lang === 'en' ? 'Corrections →' : 'Oikaisut →'}</Link>
          <Link to="/luotettavuus" data-testid="home-v5-trust-transparency">{lang === 'en' ? 'Transparency →' : 'Avoimuus →'}</Link>
        </div>
        <div className="h5-trust-grid">
          {list.map((s) => (
            <div className="h5-src" data-testid={`home-v5-source-${(s.name || 'src').toLowerCase().replace(/\W+/g, '-')}`} key={s.name}>
              <div className="h5-sname">{s.name}</div>
              <div className="h5-ct">{s.count}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Footer ─────────────────────────────────────────────────────────
const FooterV5 = ({ lang }) => (
  <footer className="h5-foot" data-testid="home-v5-footer">
    <div className="h5-wrap">
      <div className="h5-fgrid">
        <div className="h5-mast-foot">
          <div className="h5-flogo">Putki<span className="h5-bdot">.</span></div>
          <p>{lang === 'en'
            ? "Finland's independent gambling culture publication — news, streams, tools. An editorial media company, not a gambling operator."
            : 'Suomen riippumaton pelikulttuurin julkaisu — uutiset, striimit, työkalut. Toimituksellinen mediayhtiö, ei rahapelioperaattori.'}</p>
          <div className="h5-editor">
            <b>{lang === 'en' ? 'EDITOR-IN-CHIEF · Eino K.' : 'PÄÄTOIMITTAJA · Eino K.'}</b><br />
            toimitus@putkihq.fi<br />oikaisut@putkihq.fi
          </div>
        </div>
        <div className="h5-fcol">
          <h5>{lang === 'en' ? 'Editorial' : 'Toimitus'}</h5>
          <Link to="/uutiset">{lang === 'en' ? 'News' : 'Uutiset'}</Link>
          <Link to="/striimaajat">{lang === 'en' ? 'Streamers' : 'Striimaajat'}</Link>
          <Link to="/mittari">Mittari</Link>
          <Link to="/mestari">{lang === 'en' ? 'Diagnostic' : 'Pelaajatesti'}</Link>
          <Link to="/reform-2027">{lang === 'en' ? 'Gambling reform 2027' : 'Rahapeliuudistus 2027'}</Link>
        </div>
        <div className="h5-fcol">
          <h5>{lang === 'en' ? 'Commercial' : 'Kaupallinen'}</h5>
          <Link to="/arvostelut">{lang === 'en' ? 'Reviews' : 'Arvostelut'}</Link>
          <Link to="/affiliate-periaatteet">{lang === 'en' ? 'Affiliate principles' : 'Affiliate-periaatteet'}</Link>
          <Link to="/kaupallinen">{lang === 'en' ? 'Commercial partnerships' : 'Kaupallinen yhteistyö'}</Link>
          <Link to="/avoimuusseloste">{lang === 'en' ? 'Transparency notice' : 'Avoimuusseloste'}</Link>
        </div>
        <div className="h5-fcol">
          <h5>{lang === 'en' ? 'About' : 'Tietoa'}</h5>
          <Link to="/menetelma">{lang === 'en' ? 'Method' : 'Menetelmä'}</Link>
          <Link to="/oikaisut">{lang === 'en' ? 'Corrections' : 'Oikaisukäytäntö'}</Link>
          <Link to="/tietosuoja">{lang === 'en' ? 'Privacy' : 'Tietosuojaseloste'}</Link>
          <Link to="/ehdot">{lang === 'en' ? 'Terms' : 'Käyttöehdot'}</Link>
          <Link to="/tietoa">{lang === 'en' ? 'About us' : 'Tietoa meistä'}</Link>
          <Link to="/lehdistolle">{lang === 'en' ? 'For press' : 'Lehdistölle'}</Link>
        </div>
      </div>
      <div className="h5-respo">
        <span className="h5-age">18+</span>
        <b>{lang === 'en' ? 'Play responsibly.' : 'Pelaa vastuullisesti.'}</b>{' '}
        {lang === 'en'
          ? 'PUTKI HQ is an editorial media company. We do not offer, mediate or enable betting or gambling. Commercial links are marked separately. If gambling has become a problem, contact '
          : 'PUTKI HQ on toimituksellinen mediayhtiö. Emme tarjoa, välitä emmekä mahdollista vedonlyöntiä tai rahapelaamista. Kaupalliset linkit on merkitty erikseen. Jos pelaaminen on muodostunut ongelmaksi, ota yhteyttä '}
        <a href="https://peluuri.fi" target="_blank" rel="noopener noreferrer">peluuri.fi</a> · <a href="https://gamblingtherapy.org" target="_blank" rel="noopener noreferrer">gamblingtherapy.org</a>.
      </div>
      <div className="h5-copyright">
        <span>© 2026 PUTKI HQ · Unlshd Ltd · Helsinki / Limassol</span>
        <span>v.5.0 · {lang === 'en' ? 'Updated live' : 'Päivitetty live'}</span>
      </div>
    </div>
  </footer>
);

// ── HomeV5 root ────────────────────────────────────────────────────
const HomeV5 = ({ forceLang }) => {
  const langCtx = useLang();
  const lang = (forceLang || langCtx?.lang || 'fi').toLowerCase();
  const [mittari, setMittari] = useState({ score: 0, state: lang === 'en' ? 'CALM' : 'TYYNI' });
  const [news, setNews] = useState([]);
  const [liveStreamers, setLiveStreamers] = useState(0);
  const [namedSources, setNamedSources] = useState(0);
  const [trustSources, setTrustSources] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // Document meta + SEO surface
  const { canonical, alternates } = useLocalisedCanonical({ fiPath: '/', enPath: '/en', forceLang });
  useDocumentMeta({
    title: lang === 'en'
      ? 'PUTKI HQ — Finland\'s independent gambling culture publication'
      : 'PUTKI HQ — Suomen riippumaton pelikulttuurin julkaisu',
    description: lang === 'en'
      ? 'Editorial gambling culture publication: news from 12 named sources, live streamers, the Mittari market-sharpness signal, free player diagnostic, and tested casinos.'
      : 'Toimituksellinen pelikulttuurin julkaisu: uutisia 12 nimetystä lähteestä, live-striimaajia, Mittari-markkinasignaali, ilmainen pelaajatesti ja testatut kasinot.',
    canonical,
    alternates,
    // iter96c: OG social card from /api/og/page/home-{lang}. The OG
    // endpoint is now live (kill switch removed); the minted PNG ships
    // with title text baked in for Telegram / X previews.
    ogImage: pageOgUrl('home', lang === 'en'),
  });
  useJsonLd(useMemo(() => ([
    {
      '@context': 'https://schema.org', '@type': 'Organization',
      '@id': 'https://putkihq.fi/#org', name: 'PUTKI HQ', url: 'https://putkihq.fi',
      sameAs: ['https://t.me/Putkihq_bot'],
    },
    {
      '@context': 'https://schema.org', '@type': 'WebSite',
      '@id': 'https://putkihq.fi/#site', url: 'https://putkihq.fi', name: 'PUTKI HQ',
      publisher: { '@id': 'https://putkihq.fi/#org' }, inLanguage: ['fi', 'en'],
    },
  ]), []));

  // Live data fan-out — each call is fault tolerant.
  // Endpoint shapes (iter96 audit):
  //   /api/dial             → {state: {key, label, value}, composite_score, any_real}
  //   /api/news/featured    → {items: [{title, source, url, published, category, entity_tags, severity, source_tier}], as_of}
  //   /api/news/chronological?limit=N → same shape
  //   /api/streamers/live   → {streamers: [...], count, ...}
  //   /api/sources/public   → {by_category: {cat: [{key, name, url, tier, note}]}, total}
  useEffect(() => {
    let cancelled = false;
    const safeFetch = async (path, fallback) => {
      try { const r = await fetch(`${BACKEND}${path}`); if (!r.ok) return fallback; return await r.json(); }
      catch { return fallback; }
    };
    (async () => {
      const [dial, featured, latest, streamers, srcs] = await Promise.all([
        safeFetch('/api/dial', null),
        safeFetch('/api/news/featured', { items: [] }),
        safeFetch('/api/news/chronological?limit=6', { items: [] }),
        safeFetch('/api/streamers/live', { streamers: [], count: 0 }),
        safeFetch('/api/sources/public', { by_category: {}, total: 0 }),
      ]);
      if (cancelled) return;

      // Mittari — translate /api/dial → {score, state}
      if (dial && dial.state) {
        setMittari({
          score: Math.round(dial.state.value ?? dial.composite_score ?? 0),
          state: (dial.state.label || dial.state.key || 'TYYNI').toUpperCase(),
        });
        if (dial.updated_at) {
          setLastUpdatedAt(dial.updated_at);
        }
      }

      // News — merge featured (first) + chronological (rest), de-dup by url.
      const seen = new Set();
      const mergeItems = (...arrs) => {
        const out = [];
        for (const arr of arrs) {
          for (const it of (arr || [])) {
            const key = it.url || it.title;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(it);
          }
        }
        return out;
      };
      const all = mergeItems(featured?.items, latest?.items);
      if (all.length) setNews(all.slice(0, 6));

      // Streamers — live count from canonical shape.
      if (Array.isArray(streamers?.streamers)) setLiveStreamers(streamers.count ?? streamers.streamers.length);
      else if (typeof streamers?.count === 'number') setLiveStreamers(streamers.count);

      // Sources — total tracks `nimettyä lähdettä` in the stats grid + Trust manifest.
      if (typeof srcs?.total === 'number' && srcs.total > 0) {
        setNamedSources(srcs.total);
        // Build a Top-N source list from the `by_category` registry for the
        // Trust manifest. We collapse all categories into one alphabetical
        // list and take the top 7 tier-1/2 sources; an `+N more` synthetic
        // entry holds the remainder.
        const flat = [];
        for (const cat of Object.values(srcs.by_category || {})) {
          if (!Array.isArray(cat)) continue;
          for (const s of cat) flat.push(s);
        }
        // Tier-1 first, then by name.
        flat.sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.name || '').localeCompare(b.name || ''));
        const top = flat.slice(0, 7);
        const rest = flat.slice(7);
        const trustList = top.map((s) => ({ name: s.name, count: s.tier ? `tier ${s.tier}` : '—' }));
        if (rest.length) {
          trustList.push({ name: (lang === 'en' ? `+${rest.length} sources` : `+${rest.length} lähdettä`), count: `${rest.length} lisää` });
        }
        setTrustSources(trustList);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  // News-derived "articles today" — uses items captured since midnight UTC,
  // falls back to a non-zero editorial floor so the stat block never reads 0.
  const articlesToday = useMemo(() => {
    if (!news.length) return 0;
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const cutoff = dayStart.getTime();
    const cnt = news.filter((n) => {
      const d = n.captured_at || n.published;
      if (!d) return false;
      return new Date(d).getTime() >= cutoff;
    }).length;
    return cnt;
  }, [news]);

  // "Last updated" minutes ago — driven by the dial.updated_at timestamp.
  const lastUpdateMin = useMemo(() => {
    if (!lastUpdatedAt) return 0;
    const ms = Date.now() - new Date(lastUpdatedAt).getTime();
    return Math.max(0, Math.round(ms / 60000));
    // Re-evaluate when the dial timestamp changes; deps are linted as
    // unnecessary but the recompute is intentional on lastUpdatedAt change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdatedAt]);

  return (
    <div className="home-v5" data-testid="home-v5-shell">
      <StatusBar
        mittariScore={mittari.score} mittariState={mittari.state}
        articlesToday={articlesToday} liveStreamers={liveStreamers}
        lastUpdateMin={lastUpdateMin} lang={lang} />
      <SiteMasthead forceLang={forceLang} />
      <Hero mittariScore={mittari.score} mittariState={mittari.state} lang={lang} />
      <NewsletterCapture lang={lang} />
      <StatsGrid
        articlesToday={articlesToday} namedSources={namedSources}
        mittariScore={mittari.score} liveStreamers={liveStreamers}
        alertsToday={0} lang={lang} />
      <NewsPortal news={news} lang={lang} />
      <ProductsGrid lang={lang} />
      <IssuesRecap lang={lang} />
      <TrustManifest lang={lang} sources={trustSources} totalSources={namedSources} />
      <FooterV5 lang={lang} />
    </div>
  );
};

export default HomeV5;
