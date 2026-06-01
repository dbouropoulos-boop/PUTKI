/**
 * Phase 5 polish · iter96d — Press Kit page (/lehdistolle, /en/press).
 *
 * Lands inbound press / regulator / journalist inquiries on a one-pager
 * with the masthead, downloadable assets, the 12-source claim with
 * per-source citation breakdown, method link, and a single contact
 * point. Built to convert the moment somebody asks "where can I find
 * X about PUTKI HQ?"
 *
 * Sections (top → bottom):
 *   1. Newsroom masthead — title + lede + last-updated stamp.
 *   2. Quick contact card — toimitus@putkihq.fi + oikaisut@ + press@.
 *   3. Live source registry — pulled from /api/sources/public, broken
 *      down by category, with tier badges. The "12 named sources" claim
 *      is rendered against the real registry so editors can quote the
 *      page to journalists.
 *   4. Method, corrections, transparency — link cards.
 *   5. Brand assets — masthead logo, color tokens, font stack — printed
 *      so a journalist can drop the brand into copy without asking.
 *   6. Recent independent coverage placeholder — operator fills this
 *      as Press picks PUTKI HQ up.
 *   7. Editor + ownership disclosure.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ExternalLink, FileText, Phone } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLocalisedCanonical } from '../hooks/useLocalisedCanonical';
import pageOgUrl from '../lib/pageOgUrl';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PressKit = ({ forceLang }) => {
  const langCtx = useLang();
  const lang = (forceLang || langCtx?.lang || 'fi').toLowerCase();
  const isEn = lang === 'en';

  const [sources, setSources] = useState({ total: 0, by_category: {} });

  const { canonical, alternates } = useLocalisedCanonical({ fiPath: '/lehdistolle', enPath: '/en/press' });
  useDocumentMeta({
    title: isEn ? 'Press kit · PUTKI HQ' : 'Lehdistölle · PUTKI HQ',
    description: isEn
      ? 'Press contact, the 12-source registry, method link, brand assets. PUTKI HQ is an independent editorial gambling culture publication based in Helsinki.'
      : 'Lehdistön yhteystieto, 12-lähteen rekisteri, menetelmälinkki, brändiassetit. PUTKI HQ on riippumaton toimituksellinen pelikulttuurin julkaisu Helsingistä.',
    canonical, alternates,
    ogImage: pageOgUrl('home', isEn),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/sources/public`);
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setSources({ total: d.total ?? 0, by_category: d.by_category ?? {} });
      } catch { /* keep zeros */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => Object.entries(sources.by_category || {}).sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0)),
    [sources.by_category],
  );

  const T = {
    ink: 'var(--ink, #0a0a08)',
    ink2: 'var(--muted, #3a3833)',
    ink3: 'var(--muted-2, #7a7669)',
    line: 'var(--border, #e8e3d4)',
    surf: 'var(--surface, #f7f6f3)',
    ember: 'var(--ember, #E63B1A)',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    serif: '"Source Serif 4", Georgia, serif',
    display: '"Archivo Black", Inter, sans-serif',
  };

  const SectionLabel = ({ children }) => (
    <div style={{
      fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.22em',
      textTransform: 'uppercase', color: T.ember, fontWeight: 700,
      marginBottom: 14,
    }}>{children}</div>
  );

  return (
    <div data-testid="press-kit-page" style={{
      background: 'var(--bg)', color: T.ink, minHeight: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '60px 28px 80px',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {/* ── 1. Masthead ──────────────────────────────────────────── */}
        <header style={{ borderBottom: `1px solid ${T.line}`, paddingBottom: 34, marginBottom: 40 }}>
          <SectionLabel>{isEn ? 'Press kit · For journalists, regulators, partners' : 'Lehdistölle · Toimittajille, viranomaisille, kumppaneille'}</SectionLabel>
          <h1 style={{
            fontFamily: T.display, fontSize: 'clamp(38px, 5.5vw, 62px)',
            fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 0.95,
            color: T.ink, textTransform: 'uppercase', margin: '4px 0 16px',
          }}>{isEn
            ? <>Everything you need to write about PUTKI HQ — <span style={{ color: T.ember }}>without asking.</span></>
            : <>Kaikki tarpeellinen kun kirjoitat PUTKI HQ:sta — <span style={{ color: T.ember }}>ilman että kysyt.</span></>}
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: T.ink2, maxWidth: 720 }}>
            {isEn
              ? "PUTKI HQ is an independent editorial gambling culture publication based in Helsinki. We aggregate from named sources, classify with a deterministic algorithm, and require the cited source in the first 400 characters of every article. We are not a gambling operator."
              : 'PUTKI HQ on riippumaton toimituksellinen pelikulttuurin julkaisu Helsingissä. Aggregoimme nimetyistä lähteistä, luokittelemme deterministisellä algoritmilla, ja vaadimme siteeratun lähteen jokaisen jutun ensimmäisten 400 merkin sisällä. Emme ole rahapelioperaattori.'}
          </p>
          <div style={{ marginTop: 20, fontFamily: T.mono, fontSize: 11, letterSpacing: '0.08em', color: T.ink3, textTransform: 'uppercase' }}>
            {isEn ? 'Last updated · 1.6.2026 · v.5.0' : 'Päivitetty · 1.6.2026 · v.5.0'}
          </div>
        </header>

        {/* ── 2. Contact card ──────────────────────────────────────── */}
        <section data-testid="press-kit-contact" style={{
          background: T.surf, border: `1px solid ${T.line}`,
          padding: '28px 30px', marginBottom: 56,
        }}>
          <SectionLabel>{isEn ? 'Press contact · 24h response' : 'Lehdistö yhteys · 24 t vastaus'}</SectionLabel>
          <div style={{
            display: 'grid', gap: 18,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.16em', color: T.ink3, textTransform: 'uppercase' }}>{isEn ? 'Editorial' : 'Toimitus'}</div>
              <a href="mailto:toimitus@putkihq.fi" data-testid="press-kit-toimitus"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, color: T.ink, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                <Mail size={15} /> toimitus@putkihq.fi
              </a>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.16em', color: T.ink3, textTransform: 'uppercase' }}>{isEn ? 'Corrections' : 'Oikaisut'}</div>
              <a href="mailto:oikaisut@putkihq.fi" data-testid="press-kit-oikaisut"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, color: T.ink, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                <Mail size={15} /> oikaisut@putkihq.fi
              </a>
            </div>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.16em', color: T.ink3, textTransform: 'uppercase' }}>{isEn ? 'Press inquiries' : 'Lehdistökyselyt'}</div>
              <a href="mailto:press@putkihq.fi" data-testid="press-kit-press"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, color: T.ember, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                <Mail size={15} /> press@putkihq.fi
              </a>
            </div>
          </div>
          <p style={{ marginTop: 18, fontSize: 13.5, color: T.ink2, lineHeight: 1.55 }}>
            {isEn
              ? 'For urgent corrections or right-of-reply requests reach toimitus@putkihq.fi directly. Eino K., editor-in-chief, is available for phone interview by arrangement.'
              : 'Kiireellisissä oikaisuissa tai vastauspyynnöissä toimitus@putkihq.fi suoraan. Päätoimittaja Eino K. on tavoitettavissa puhelinhaastatteluun sopimalla.'}
          </p>
        </section>

        {/* ── 3. Source registry ───────────────────────────────────── */}
        <section data-testid="press-kit-sources" style={{ marginBottom: 56 }}>
          <SectionLabel>{isEn ? `Source registry · ${sources.total || '—'} named sources` : `Lähderekisteri · ${sources.total || '—'} nimettyä lähdettä`}</SectionLabel>
          <h2 style={{
            fontFamily: T.display, fontSize: 'clamp(28px, 3.6vw, 40px)',
            fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 0.98,
            color: T.ink, textTransform: 'uppercase', margin: '0 0 16px',
          }}>{isEn
            ? <>We aggregate from <span style={{ color: T.ember }}>{sources.total || 12} named sources</span>. Zero from anyone else.</>
            : <>Aggregoimme <span style={{ color: T.ember }}>{sources.total || 12} nimetystä lähteestä</span>. Nolla muista.</>}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: T.ink2, marginBottom: 24, maxWidth: 720 }}>
            {isEn
              ? "The full list, by category, with each source's tier. Tier 1 sources lead our editorial; tier 2 add depth; tier 3 are watched but not relied on for breaking news."
              : 'Täysi lista kategorioittain, jokaisen lähteen tier mukana. Tier 1 -lähteet johtavat toimitusta; tier 2 syventävät; tier 3 ovat seurannassa, mutta niihin ei luoteta breaking-uutisissa.'}
          </p>
          {categories.length === 0 ? (
            <div style={{ padding: 24, background: T.surf, border: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 12, color: T.ink3, textAlign: 'center' }}>
              {isEn ? 'Loading registry…' : 'Ladataan rekisteriä…'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {categories.map(([cat, list]) => (
                <div key={cat} data-testid={`press-kit-source-cat-${cat}`} style={{
                  border: `1px solid ${T.line}`, background: T.surf,
                  padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '0.18em', fontWeight: 700, color: T.ember, textTransform: 'uppercase' }}>
                      {cat}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase' }}>
                      {(list || []).length} {isEn ? 'sources' : 'lähdettä'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(list || []).map((s) => (
                      <a key={s.key} href={s.url || '#'} target="_blank" rel="noopener noreferrer"
                        data-testid={`press-kit-source-${s.key}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '7px 12px', border: `1px solid ${T.line}`,
                          borderTop: `2px solid ${s.tier === 1 ? T.ember : T.line}`,
                          background: 'var(--bg, #fff)',
                          fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
                          color: T.ink, textDecoration: 'none',
                        }}>
                        {s.name}
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, letterSpacing: '0.08em', fontWeight: 500 }}>
                          T{s.tier || '—'}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 4. Method, corrections, transparency ─────────────────── */}
        <section style={{ marginBottom: 56 }}>
          <SectionLabel>{isEn ? 'How we work · Public' : 'Miten työskentelemme · Julkista'}</SectionLabel>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {[
              { href: '/menetelma', testid: 'press-kit-method', title: isEn ? 'Method' : 'Menetelmä',
                body: isEn ? 'Aggregation, classification, source-citation rule.' : 'Aggregaatio, luokittelu, lähdesitaattisääntö.' },
              { href: '/oikaisut', testid: 'press-kit-corrections', title: isEn ? 'Corrections ledger' : 'Oikaisuloki',
                body: isEn ? 'Every correction we have ever made, dated.' : 'Kaikki tehdyt oikaisut, päivätty.' },
              { href: '/luotettavuus', testid: 'press-kit-trust', title: isEn ? 'Trust hub' : 'Luotettavuus',
                body: isEn ? 'Three principles, three live datasets, gaps named openly.' : 'Kolme periaatetta, kolme live-datasettiä, aukot avoimesti.' },
              { href: '/affiliaatti', testid: 'press-kit-affiliate', title: isEn ? 'Affiliate principles' : 'Affiliate-periaatteet',
                body: isEn ? 'Where commercial relationships exist + how we mark them.' : 'Missä kaupalliset suhteet ovat + miten merkitsemme ne.' },
            ].map((card) => (
              <Link key={card.testid} to={card.href} data-testid={card.testid}
                style={{
                  display: 'block', padding: '18px 20px',
                  border: `1px solid ${T.line}`, background: T.surf,
                  textDecoration: 'none', color: T.ink,
                  borderTop: `2px solid ${T.ember}`,
                  transition: 'transform 200ms ease, border-color 200ms ease',
                }}>
                <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 900, letterSpacing: '-0.015em', textTransform: 'uppercase', marginBottom: 8 }}>{card.title}</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: T.ink2, margin: 0 }}>{card.body}</p>
                <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.14em', color: T.ember, fontWeight: 700, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {isEn ? 'Read →' : 'Lue →'}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 5. Brand assets ──────────────────────────────────────── */}
        <section data-testid="press-kit-brand" style={{ marginBottom: 56 }}>
          <SectionLabel>{isEn ? 'Brand assets · For inline use' : 'Brändiassetit · Käytä suoraan'}</SectionLabel>
          <div style={{
            border: `1px solid ${T.line}`, background: T.surf,
            padding: '24px 26px',
          }}>
            <div style={{ display: 'grid', gap: 22, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.16em', color: T.ink3, textTransform: 'uppercase', marginBottom: 8 }}>{isEn ? 'Logo' : 'Logo'}</div>
                <div style={{ fontFamily: T.serif, fontSize: 38, color: T.ink, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  Putki<span style={{ color: T.ember }}>.</span>
                </div>
                <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>
                  {isEn ? 'Set in Source Serif 4. Punctuation always ember (#E63B1A).' : 'Lihavoidaan Source Serif 4. Pilkku aina ember (#E63B1A).'}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.16em', color: T.ink3, textTransform: 'uppercase', marginBottom: 8 }}>{isEn ? 'Color tokens' : 'Värit'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { name: 'INK', hex: '#0A0A08' },
                    { name: 'EMBER', hex: '#E63B1A' },
                    { name: 'BG', hex: '#F7F6F3' },
                    { name: 'LINE', hex: '#E8E3D4' },
                  ].map((c) => (
                    <div key={c.name} data-testid={`press-kit-color-${c.name.toLowerCase()}`} style={{ textAlign: 'center' }}>
                      <div style={{ width: '100%', height: 40, background: c.hex, border: `1px solid ${T.line}` }} />
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink, fontWeight: 700, marginTop: 6, letterSpacing: '0.08em' }}>{c.name}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.ink3, marginTop: 2 }}>{c.hex}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 11, color: T.ink3, lineHeight: 1.7 }}>
              <div>{isEn ? 'Fonts in use' : 'Käytössä olevat fontit'}: <span style={{ color: T.ink }}>Archivo Black</span> (display) · <span style={{ color: T.ink }}>Source Serif 4</span> (brand) · <span style={{ color: T.ink }}>Inter</span> (body) · <span style={{ color: T.ink }}>JetBrains Mono</span> (labels).</div>
              <div style={{ marginTop: 6 }}>{isEn ? 'Inline reuse welcome with attribution; please don\'t re-tint the logo.' : 'Käyttö sallittua viittauksen kanssa; logoa ei saa värittää uudelleen.'}</div>
            </div>
          </div>
        </section>

        {/* ── 6. Coverage placeholder ──────────────────────────────── */}
        <section data-testid="press-kit-coverage" style={{ marginBottom: 56 }}>
          <SectionLabel>{isEn ? 'Independent coverage of PUTKI HQ' : 'Riippumaton kattaus PUTKI HQ:sta'}</SectionLabel>
          <div style={{
            border: `1px solid ${T.line}`, background: T.surf,
            padding: '22px 24px',
            fontFamily: T.mono, fontSize: 11.5, letterSpacing: '0.04em', color: T.ink2,
            lineHeight: 1.7,
          }}>
            {isEn
              ? <>No third-party coverage has been published yet. As pieces about PUTKI HQ appear in named press we will list them here, dated and linked, including critical coverage. Send us a link at <a href="mailto:press@putkihq.fi" style={{ color: T.ember, textDecoration: 'underline', textUnderlineOffset: 2 }}>press@putkihq.fi</a> and we will add it.</>
              : <>Kolmannen osapuolen kattausta ei ole vielä julkaistu. Sitä mukaa kun PUTKI HQ:sta kirjoitetaan nimetyssä lehdistössä, listaamme jutut tähän päivättyinä ja linkitettyinä — myös kriittinen kattaus. Lähetä linkki osoitteeseen <a href="mailto:press@putkihq.fi" style={{ color: T.ember, textDecoration: 'underline', textUnderlineOffset: 2 }}>press@putkihq.fi</a> ja lisäämme sen.</>}
          </div>
        </section>

        {/* ── 7. Editor + ownership disclosure ─────────────────────── */}
        <section data-testid="press-kit-editor" style={{ marginBottom: 24 }}>
          <SectionLabel>{isEn ? 'Editor & ownership' : 'Toimitus & omistus'}</SectionLabel>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: T.ink2 }}>
            {isEn
              ? <><b style={{ color: T.ink }}>Editor-in-chief</b>: Eino K., journalism (Helsinki). Editorial responsibility for everything published under the PUTKI HQ masthead.<br /><br /><b style={{ color: T.ink }}>Ownership</b>: PUTKI HQ is published by Unlshd Ltd, registered in Limassol with editorial operations in Helsinki. No gambling-industry shareholder. No undisclosed sponsorship. Commercial relationships, where they exist, are flagged inline on every page.</>
              : <><b style={{ color: T.ink }}>Päätoimittaja</b>: Eino K., journalismi (Helsinki). Toimituksellinen vastuu kaikesta PUTKI HQ -mastheadin alle julkaistusta.<br /><br /><b style={{ color: T.ink }}>Omistus</b>: PUTKI HQ:n julkaisee Unlshd Ltd, rekisteröity Limassoliin, toimituksellinen toiminta Helsingissä. Ei rahapelialan omistajia. Ei salaista sponsoria. Kaupalliset suhteet, missä niitä on, on merkitty rivinä jokaiseen juttuun.</>}
          </p>
        </section>

        {/* ── Back link ─────────────────────────────────────────────── */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${T.line}` }}>
          <Link to={isEn ? '/en' : '/'} data-testid="press-kit-home-back"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', border: `1px solid ${T.ink}`,
              fontFamily: T.mono, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: T.ink, textDecoration: 'none',
            }}>
            ← {isEn ? 'Back to PUTKI HQ' : 'Takaisin PUTKI HQ:hon'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PressKit;
