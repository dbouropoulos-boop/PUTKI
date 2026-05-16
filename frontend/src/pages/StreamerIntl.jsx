import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Info } from 'lucide-react';
import StreamerVideoPreview from '../components/StreamerVideoPreview';
import MomentCard from '../components/MomentCard';
import { INTL_STREAMERS, INTL_SCENES, INTL_MOMENTS } from '../data/mock';
import { useLang } from '../context/LanguageContext';

// Country-coded streamer card variation — same general layout, scene-specific tint + ISO badge.
const IntlStreamerCard = ({ streamer }) => {
  const scene = INTL_SCENES[streamer.scene];
  const live = streamer.live && streamer.channel;

  return (
    <Link
      to={`#`}
      onClick={(e) => e.preventDefault()}
      className="panel panel-hover block overflow-hidden"
      style={{ background: scene.tint }}
      data-testid={`intl-streamer-${streamer.slug}`}
    >
      <div className="relative aspect-[5/4] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        {live ? (
          <StreamerVideoPreview
            streamer={streamer}
            className="absolute inset-0 w-full h-full"
            testId={`intl-preview-${streamer.slug}`}
          />
        ) : (
          <img src={streamer.photo} alt={streamer.name} className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'brightness(0.7) grayscale(0.2)' }} />
        )}
        {/* ISO scene badge */}
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-[2px] mono"
          style={{ background: 'rgba(10,10,10,0.85)', color: '#F5F3EE', fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 700 }}
          data-testid={`intl-iso-${streamer.slug}`}
        >
          {scene.iso}
        </div>
        {live && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-[2px]" style={{ background: 'rgba(10,10,10,0.85)' }}>
            <span className="led" />
            <span className="mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: '#F5F3EE', fontWeight: 700 }}>LIVE</span>
          </div>
        )}
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
        <div className="mono mt-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }}>
          {streamer.origin.toUpperCase()}
        </div>
        {live ? (
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="font-serif text-[13px] truncate" style={{ color: 'var(--muted)' }}>{streamer.playing}</div>
            <div className="mono whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
              {streamer.viewers >= 1000 ? `${(streamer.viewers / 1000).toFixed(1).replace('.0', '')}K` : streamer.viewers}
            </div>
          </div>
        ) : streamer.sub ? (
          <p className="font-serif mt-3 text-[13px] leading-snug" style={{ color: 'var(--muted)' }}>{streamer.sub}</p>
        ) : (
          <div className="mt-3 mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500 }}>OFFLINE</div>
        )}
      </div>
    </Link>
  );
};

const StreamerIntl = () => {
  const { lang } = useLang();
  const [tab, setTab] = useState('global'); // global | swedish | dutch | norwegian
  const sceneOrder = ['global', 'swedish', 'dutch', 'norwegian'];
  const filtered = useMemo(() => INTL_STREAMERS.filter((s) => s.scene === tab), [tab]);
  const sceneMoments = useMemo(() => INTL_MOMENTS.filter((m) => m.scene === tab).slice(0, 4), [tab]);
  const scene = INTL_SCENES[tab];

  return (
    <div data-testid="intl-streamers-page">
      <section className="container-wide pt-12 sm:pt-16 pb-6">
        <div className="max-w-3xl">
          <div className="eyebrow mb-3 inline-flex items-center gap-2">
            <Globe strokeWidth={1.5} size={13} />
            {lang === 'en' ? 'INTERNATIONAL SCENE · MITTARI COVERAGE' : 'KANSAINVÄLINEN SKENE · MITTARI-KATTAUS'}
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5" data-testid="intl-page-title">
            {lang === 'en' ? 'The slot scene beyond Finland' : 'Slot-skene Suomen rajojen ulkopuolella'}
          </h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>
            {lang === 'en'
              ? <>Mittari covers the global slot-streaming scene — from Stake-era superstars to the Swedish, Dutch and Norwegian scenes — without losing its Finnish identity. <strong style={{ color: 'var(--ink)' }}>The dial stays Finnish-only.</strong> International activity surfaces here, never feeds the P*rkele-mittari.</>
              : <>Mittari kattaa myös globaalin slot-skenen — Stake-aikakauden supertähdet, ruotsalaiset, hollantilaiset ja norjalaiset — kadottamatta suomalaista identiteettiään. <strong style={{ color: 'var(--ink)' }}>Mittari pysyy suomi-lähtöisenä.</strong> Kansainvälinen aktiviteetti näkyy täällä, mutta ei syötä P*rkele-mittaria.</>}
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
              const s = INTL_SCENES[k];
              const count = INTL_STREAMERS.filter((x) => x.scene === k).length;
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
                  {s.iso} · {(lang === 'en' ? s.labelEn : s.labelFi).toUpperCase()} <span style={{ opacity: 0.6 }}>· {count}</span>
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
            {scene.iso} · {(lang === 'en' ? scene.labelEn : scene.labelFi).toUpperCase()}
          </div>
          <p className="font-serif" style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 }}>
            {lang === 'en' ? scene.blurbEn : scene.blurbFi}
          </p>
        </div>
      </section>

      {/* Streamer grid */}
      <section className="container-wide pb-12 sm:pb-16">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5" data-testid="intl-grid">
            {filtered.map((s) => <IntlStreamerCard key={s.slug} streamer={s} />)}
          </div>
        ) : (
          <div className="panel p-10 text-center mono" style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 600 }} data-testid="intl-empty">
            {lang === 'en' ? 'NO STREAMERS YET — SCENE COMING SOON' : 'EI STRIIMAAJIA VIELÄ — SKENE TULOSSA'}
          </div>
        )}
      </section>

      {/* Scene moments */}
      {sceneMoments.length > 0 && (
        <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="container-wide">
            <div className="eyebrow mb-3">{lang === 'en' ? 'SCENE MOMENTS · LAST 24 H' : 'SKENEN HETKET · 24 H'}</div>
            <h2 className="display text-2xl sm:text-3xl mb-7">
              {lang === 'en' ? `${scene.labelEn} · what we noticed` : `${scene.labelFi} · mitä huomasimme`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8" data-testid="intl-moments-grid">
              {sceneMoments.map((m) => <MomentCard key={m.id} moment={m} />)}
            </div>
          </div>
        </section>
      )}

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
