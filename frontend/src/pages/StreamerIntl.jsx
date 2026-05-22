import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Info } from 'lucide-react';
import StreamerAvatar from '../components/StreamerAvatar';
import { useStreamers } from '../hooks/useRegistry';
import { useLang } from '../context/LanguageContext';

// V2 honesty pass — INTL streamer page reads /api/streamers?market=intl.
// Live state/playing/viewers no longer surface (real values come from
// Step 2 webhook handlers via /api/signals/live).

const IntlStreamerCard = ({ streamer, scenes }) => {
  const scene = scenes[streamer.scene] || { iso: '?', tint: 'transparent' };

  return (
    <Link
      to={`#`}
      onClick={(e) => e.preventDefault()}
      className="panel panel-hover block overflow-hidden"
      style={{ background: scene.tint }}
      data-testid={`intl-streamer-${streamer.slug}`}
    >
      <div className="relative aspect-[5/4] overflow-hidden flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
        <StreamerAvatar streamer={streamer} size={140} shape="circle" />
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-[2px] mono"
          style={{ background: 'rgba(10,10,10,0.85)', color: '#F5F3EE', fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 700 }}
          data-testid={`intl-iso-${streamer.slug}`}
        >
          {scene.iso}
        </div>
        <div
          className="absolute bottom-3 left-3 px-2 py-0.5 rounded-[2px] mono"
          style={{ background: 'rgba(10,10,10,0.85)', color: '#F5F3EE', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 600 }}
        >
          {streamer.platform.toUpperCase()}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display font-bold tracking-tight" style={{ color: 'var(--ink)', fontSize: 16 }}>{streamer.name}</div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>{streamer.followers}</div>
        </div>
        {streamer.origin && (
          <div className="mono mt-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
            {streamer.origin.toUpperCase()}
          </div>
        )}
        {streamer.sub ? (
          <p className="font-serif mt-3 text-[13px] leading-snug" style={{ color: 'var(--muted)' }}>{streamer.sub}</p>
        ) : (
          <div className="mt-3 mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500 }}>{streamer.platform.toUpperCase()}</div>
        )}
      </div>
    </Link>
  );
};

const StreamerIntl = () => {
  const { lang } = useLang();
  const { data: streamers, intlScenes } = useStreamers({ market: 'intl' });
  const sceneOrder = ['intl_global', 'intl_swedish', 'intl_dutch', 'intl_norwegian'];
  const [tab, setTab] = useState('intl_global');
  const filtered = useMemo(() => streamers.filter((s) => s.scene === tab), [tab, streamers]);
  const scene = intlScenes[tab] || { label_fi: '', label_en: '', iso: '?', tint: 'transparent' };

  return (
    <div data-testid="intl-streamers-page">
      <section className="container-wide pt-12 sm:pt-16 pb-6">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3 inline-flex items-center gap-2">
            <Globe strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'INTERNATIONAL SCENE · PUTKI HQ COVERAGE' : 'KANSAINVÄLINEN SKENE · PUTKI HQ -KATTAUS'}
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5" data-testid="intl-page-title">
            {lang === 'en' ? 'The slot scene beyond Finland' : 'Slot-skene Suomen rajojen ulkopuolella'}
          </h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>
            {lang === 'en'
              ? <>PUTKI HQ covers the global slot-streaming scene — from Stake-era superstars to the Swedish, Dutch and Norwegian scenes — without losing its Finnish identity. <strong style={{ color: 'var(--ink)' }}>The dial stays Finnish-only.</strong> International activity surfaces here, never feeds the P*rkele-mittari.</>
              : <>PUTKI HQ kattaa myös globaalin slot-skenen — Stake-aikakauden supertähdet, ruotsalaiset, hollantilaiset ja norjalaiset — kadottamatta suomalaista identiteettiään. <strong style={{ color: 'var(--ink)' }}>PUTKI HQ pysyy suomi-lähtöisenä.</strong> Kansainvälinen aktiviteetti näkyy täällä, mutta ei syötä P*rkele-mittaria.</>}
          </p>
          <div className="mt-5">
            <Link to="/striimaajat" className="btn-ghost" data-testid="intl-back-link">
              ← {lang === 'en' ? 'Back to Finnish streamers' : 'Takaisin suomalaisiin striimaajiin'}
            </Link>
          </div>
        </div>
      </section>

      {/* Country tab strip */}
      <section className="container-wide pb-6">
        <div
          className="overflow-x-auto scrollbar-hide -mx-5 px-5"
          data-testid="intl-tabs"
        >
          <div className="inline-flex items-stretch rounded-[3px] overflow-hidden" style={{ border: '1px solid var(--border-strong)' }}>
            {sceneOrder.map((k) => {
              const s = intlScenes[k] || { iso: '?', label_fi: k, label_en: k };
              const count = streamers.filter((x) => x.scene === k).length;
              const active = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  data-testid={`intl-tab-${k}`}
                  className="mono"
                  style={{
                    padding: '12px 18px',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    fontWeight: 700,
                    background: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    transition: 'background 200ms ease, color 200ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.iso} · {(lang === 'en' ? s.label_en : s.label_fi).toUpperCase()} <span style={{ opacity: 0.6 }}>· {count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Active scene blurb */}
      <section className="container-wide pb-8">
        <div
          className="panel p-5 sm:p-6"
          style={{ background: scene.tint, borderLeft: '3px solid var(--ink)' }}
          data-testid={`intl-scene-blurb-${tab}`}
        >
          <div className="eyebrow mb-2 inline-flex items-center gap-2">
            <Info strokeWidth={1.5} size={12} />
            {scene.iso} · {(lang === 'en' ? scene.label_en : scene.label_fi).toUpperCase()}
          </div>
          <p className="font-serif" style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 }}>
            {lang === 'en'
              ? 'PUTKI HQ surfaces this scene editorially; activity here does not feed the dial.'
              : 'PUTKI HQ nostaa tämän skenen toimituksellisesti; aktiviteetti täällä ei syötä mittaria.'}
          </p>
        </div>
      </section>

      {/* Streamer grid */}
      <section className="container-wide pb-12 sm:pb-16">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5" data-testid="intl-grid">
            {filtered.map((s) => <IntlStreamerCard key={s.slug} streamer={s} scenes={intlScenes} />)}
          </div>
        ) : (
          <div className="panel p-10 text-center mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }} data-testid="intl-empty">
            {lang === 'en' ? 'NO STREAMERS YET — SCENE COMING SOON' : 'EI STRIIMAAJIA VIELÄ — SKENE TULOSSA'}
          </div>
        )}
      </section>

      {/* Footer reminder */}
      <section className="container-wide py-10">
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.7 }}>
          {lang === 'en'
            ? 'INTERNATIONAL ACTIVITY DOES NOT FEED THE P*RKELE-MITTARI · DIAL MEASURES THE FINNISH SCENE EXCLUSIVELY'
            : 'KANSAINVÄLINEN AKTIVITEETTI EI SYÖTÄ P*RKELE-MITTARIA · MITTARI MITTAA YKSINOMAAN SUOMEN SKENETTÄ'}
        </div>
      </section>
    </div>
  );
};

export default StreamerIntl;
