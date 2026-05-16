import React, { useState } from 'react';
import { Bell, Plus, X, Volume2 } from 'lucide-react';
import { STREAMERS } from '../data/mock';
import { useLang } from '../context/LanguageContext';
import StreamerVideoPreview from './StreamerVideoPreview';

// Phase 1.5 (Revised): Live tile grid with autoplay-style video previews + 1-click follow modal.
// Phase 2 will swap the visual placeholder for real Twitch/Kick muted-autoplay iframes.

const FollowModal = ({ streamer, onClose }) => {
  const { lang, t } = useLang();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    // Mock: Phase 2 wires to backend
    console.log('Follow', streamer.slug, email);
    setDone(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      data-testid="follow-modal"
    >
      <div className="panel p-6 sm:p-8 w-full max-w-md" style={{ background: 'var(--bg)' }} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-5">
            <div className="led mx-auto mb-5" style={{ background: '#E8924A' }} />
            <h3 className="display text-2xl mb-2">{lang === 'en' ? 'You\u2019re in.' : 'Olet listalla.'}</h3>
            <p className="font-serif" style={{ color: 'var(--muted)' }}>
              {lang === 'en' ? `We\u2019ll alert you next time ${streamer.name} goes live.` : `Ilmoitamme heti kun ${streamer.name} menee liveen.`}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <img src={streamer.photo} alt={streamer.name} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <div className="eyebrow mb-1">{lang === 'en' ? 'FOLLOW' : 'SEURAA'}</div>
                  <div className="font-display text-xl font-bold" style={{ color: 'var(--ink)' }}>{streamer.name}</div>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" style={{ color: 'var(--muted)' }}>
                <X strokeWidth={1.5} size={20} />
              </button>
            </div>
            <p className="font-serif mb-5" style={{ color: 'var(--muted)', fontSize: 15 }}>
              {lang === 'en'
                ? `Drop your email. We\u2019ll ping you the moment ${streamer.name} goes live.`
                : `Anna sähköposti — ilmoitamme kun ${streamer.name} menee liveen.`}
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('home.placeholder_email')}
                data-testid="follow-email-input"
                className="w-full mono"
                style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13, letterSpacing: '0.08em' }}
              />
              <button type="submit" className="btn-primary w-full" data-testid="follow-submit">
                {lang === 'en' ? 'Follow →' : 'Seuraa →'}
              </button>
            </form>
            <div className="mono mt-4 text-center" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              {t('home.email_micro')}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const LiveTile = ({ streamer, onFollow }) => {
  const { lang } = useLang();
  return (
    <div className="panel panel-hover relative overflow-hidden flex-shrink-0" style={{ width: 320, scrollSnapAlign: 'start' }} data-testid={`live-tile-${streamer.slug}`}>
      {/* Video preview — Twitch/Kick muted-autoplay; falls back to photo when offline */}
      <div className="relative aspect-video overflow-hidden scanlines" style={{ background: '#0A0A0A' }}>
        <StreamerVideoPreview
          streamer={streamer}
          className="absolute inset-0 w-full h-full"
          borderColor="#E8924A"
          testId={`live-preview-${streamer.slug}`}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(10,10,10,0.85) 100%)', pointerEvents: 'none' }} />

        {/* LIVE pill */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-[2px]" style={{ background: 'rgba(10,10,10,0.85)' }}>
          <span className="led" />
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', fontWeight: 700, color: '#F5F3EE' }}>LIVE</span>
        </div>

        {/* Platform pill */}
        <div className="absolute top-3 right-12 px-2 py-1 rounded-[2px] mono" style={{ background: 'rgba(10,10,10,0.85)', color: '#F5F3EE', fontSize: 10, letterSpacing: '0.18em', fontWeight: 600 }}>
          {streamer.platform.toUpperCase()}
        </div>

        {/* Follow button (bell + plus) */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFollow(streamer); }}
          aria-label="Follow"
          data-testid={`follow-btn-${streamer.slug}`}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(245,243,238,0.95)', color: '#0A0A0A' }}
        >
          <Bell strokeWidth={1.8} size={13} />
          <Plus strokeWidth={2.4} size={9} style={{ position: 'absolute', top: 4, right: 4 }} />
        </button>

        {/* Mute icon as ambient detail */}
        <Volume2 strokeWidth={1.4} size={14} className="absolute bottom-3 left-3" style={{ color: 'rgba(245,243,238,0.5)' }} />

        {/* Phase 3 surface cleanup: removed fake floating session balance indicator (we don't observe streamers' actual session P&L) */}

        {/* Streamer name overlay bottom-left */}
        <div className="absolute bottom-2.5 left-3 right-24">
          <div className="font-display font-bold tracking-tight" style={{ color: '#F5F3EE', fontSize: 16, lineHeight: 1.1 }}>
            {streamer.name}
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>NYT</div>
          <div className="font-serif text-[13px] mt-0.5 truncate" style={{ color: 'var(--ink)' }}>{streamer.playing}</div>
        </div>
        <div className="mono whitespace-nowrap" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
          {streamer.viewers.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, ' ')}
        </div>
      </div>
      {/* Session progress bar — mocked, increases over time */}
      <SessionProgress slug={streamer.slug} />
    </div>
  );
};

// Self-incrementing mock session progress (~3h max, +1% every ~6s)
const SessionProgress = ({ slug }) => {
  const [pct, setPct] = React.useState(() => {
    // Stable seed per streamer slug so layout doesn't shift wildly
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
    return Math.abs(h % 78) + 4;
  });
  React.useEffect(() => {
    const id = setInterval(() => setPct((p) => Math.min(99, p + 0.4)), 6000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      style={{
        height: 3, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden',
      }}
      data-testid={`session-progress-${slug}`}
    >
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`, background: '#E8924A', transition: 'width 1200ms linear',
          boxShadow: '0 0 8px rgba(232,146,74,0.55)',
        }}
      />
    </div>
  );
};

export const LiveTilesGrid = () => {
  const { lang, t } = useLang();
  const [followingStreamer, setFollowingStreamer] = useState(null);
  const live = STREAMERS.filter((s) => s.live).slice(0, 6);

  return (
    <section className="py-12 sm:py-14" style={{ borderTop: '1px solid var(--border)' }} data-testid="live-tiles-section">
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-7">
          <div>
            <div className="eyebrow mb-2 inline-flex items-center gap-2">
              <span className="led" /> {t('common.live_now').toUpperCase()}
            </div>
            <h2 className="display text-2xl sm:text-3xl">
              {lang === 'en' ? 'Live right now' : 'Livenä juuri nyt'} · <span className="mono" style={{ fontWeight: 500 }}>{live.length}</span>
            </h2>
          </div>
        </div>
      </div>

      <div className="container-wide overflow-x-auto scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
        <div className="grid grid-flow-col auto-cols-max gap-4 pb-2 lg:grid-flow-row lg:grid-cols-3 xl:grid-cols-4 lg:auto-cols-auto">
          {live.map((s) => (
            <LiveTile key={s.slug} streamer={s} onFollow={setFollowingStreamer} />
          ))}
        </div>
      </div>

      {followingStreamer && (
        <FollowModal streamer={followingStreamer} onClose={() => setFollowingStreamer(null)} />
      )}
    </section>
  );
};

export default LiveTilesGrid;
