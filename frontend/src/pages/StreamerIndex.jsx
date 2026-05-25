import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X, Globe } from 'lucide-react';
import StreamerCard from '../components/StreamerCard';
import { useStreamers } from '../hooks/useRegistry';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const StreamerIndex = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const { data: streamers } = useStreamers({ market: 'fi' });

  // Pull real live state across all three platforms. Each call hits the
  // 60s-cached `/api/streamers/live?platform=...` endpoint so refreshing
  // this page is cheap. Bogus + blocked platforms quietly contribute zero
  // - we only surface streamers that are actually live RIGHT NOW.
  const [livePlatforms, setLivePlatforms] = useState({
    twitch: { items: [], dormant: false, reason: null },
    kick:   { items: [], dormant: false, reason: null },
    youtube:{ items: [], dormant: false, reason: null },
  });

  useEffect(() => {
    let cancelled = false;
    const fetchPlatform = async (p) => {
      try {
        const url = p === 'twitch'
          ? `${BACKEND}/api/streamers/live`
          : `${BACKEND}/api/streamers/live?platform=${p}`;
        const r = await fetch(url);
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        setLivePlatforms((prev) => ({
          ...prev,
          [p]: {
            items: d.streamers || [],
            dormant: !!d.dormant,
            reason: d.reason || null,
          },
        }));
      } catch { /* noop: live grid degrades to empty */ }
    };
    fetchPlatform('twitch');
    fetchPlatform('kick');
    fetchPlatform('youtube');
    return () => { cancelled = true; };
  }, []);

  // Editorial roster - match liveness by ANY of channel / slug / name
  // since Twitch login often diverges from our registered handle
  // (e.g. registry `andypyro` ↔ live `officialandypyro`, registry
  // `pact_` ↔ live `pact`). Permissive containment matching catches
  // those without admin churn.
  const rosterIds = streamers
    .map((s) => ({
      slug: (s.slug || '').toLowerCase(),
      channel: (s.channel || '').toLowerCase(),
      name: (s.name || '').toLowerCase(),
    }))
    .filter((r) => r.slug || r.channel || r.name);

  const _matchRoster = (login, displayName) => {
    const a = (login || '').toLowerCase().replace(/_+$/, '');
    const b = (displayName || '').toLowerCase();
    if (!a && !b) return false;
    return rosterIds.some((r) => {
      const cands = [r.slug, r.channel, r.name].filter(Boolean);
      return cands.some((c) => {
        const cc = c.replace(/_+$/, '');
        return cc === a || cc === b || (cc.length >= 4 && (a.includes(cc) || b.includes(cc) || (a && cc.includes(a)) || (b && cc.includes(b))));
      });
    });
  };

  const liveAll = [
    ...livePlatforms.twitch.items.map((it) => ({ ...it, _platform: 'twitch' })),
    ...livePlatforms.kick.items.map((it) => ({ ...it, _platform: 'kick' })),
    ...livePlatforms.youtube.items.map((it) => ({ ...it, _platform: 'youtube' })),
  ];
  const liveCovered = liveAll
    .filter((it) => _matchRoster(it.user_login, it.user_name))
    .sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));

  // Build the offline list = registry minus what's currently live.
  const liveLoginsSet = new Set(liveCovered.map((it) => (it.user_login || '').toLowerCase()));
  const liveNamesSet = new Set(liveCovered.map((it) => (it.user_name || '').toLowerCase()));
  const offline = streamers.filter((s) => {
    const a = (s.channel || s.slug || '').toLowerCase();
    const n = (s.name || '').toLowerCase();
    return !liveLoginsSet.has(a) && !liveNamesSet.has(n);
  });

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [form, setForm] = useState({ name: '', channel: '', why: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Streamer suggestion:', form);
    setSubmitDone(true);
    setTimeout(() => {
      setSubmitOpen(false);
      setSubmitDone(false);
      setForm({ name: '', channel: '', why: '' });
    }, 2200);
  };

  return (
    <div data-testid="streamer-index">
      <section className="container-wide pt-12 sm:pt-20 pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4">
            {t('streamer.eyebrow')} · <span className="mono">{streamers.length}</span> {t('common.streamers').toUpperCase()}
            {liveCovered.length > 0 && (
              <>
                {' · '}
                <span className="mono" data-testid="streamer-index-live-count" style={{ color: '#C13B2C' }}>
                  ● {liveCovered.length} LIVE NOW
                </span>
              </>
            )}
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5">{t('streamer.title')}</h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>
            {t('streamer.lede')}
          </p>
          <div className="mt-5">
            <Link
              to="/striimaajat/kansainvaliset"
              className="btn-secondary inline-flex items-center gap-2"
              data-testid="streamer-index-intl-link"
            >
              <Globe strokeWidth={1.6} size={13} />
              {t('streamer.intl_cta')}
            </Link>
          </div>
        </div>
      </section>

      {liveCovered.length > 0 && (
        <section className="py-10 sm:py-12" style={{ borderTop: '1px solid var(--border)' }} data-testid="streamer-index-live-strip">
          <div className="container-wide">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="led mt-1"></span>
              <h2 className="display text-2xl sm:text-3xl">
                {t('common.live_now')} · <span className="mono" style={{ fontWeight: 500 }}>{liveCovered.length}</span>
              </h2>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}>
              {liveCovered.map((it) => (
                <a
                  key={`${it._platform}-${it.user_login}`}
                  href={it.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`live-tile-${it._platform}-${it.user_login}`}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid #C13B2C',
                    background: 'var(--surface)',
                    textDecoration: 'none',
                  }}
                >
                  <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {it._platform} · {(it.game_name || '-').toString().slice(0, 24)}
                  </div>
                  <div className="display" style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                    {it.user_name || it.user_login}
                  </div>
                  <div className="font-serif" style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {it.title || '-'}
                  </div>
                  {typeof it.viewer_count === 'number' && (
                    <div className="mono" style={{ fontSize: 10, color: '#C13B2C', fontWeight: 700, letterSpacing: '0.12em', marginTop: 2 }}>
                      ● {it.viewer_count.toLocaleString()} VIEWERS
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-10 sm:py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <h2 className="display text-2xl sm:text-3xl mb-6">{t('streamer.eyebrow')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {offline.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => setSubmitOpen(true)}
              className="mono inline-flex items-center gap-2 hover:underline"
              style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}
              data-testid="suggest-streamer-trigger"
            >
              <Plus strokeWidth={1.6} size={14} />
              {t('streamer.suggest')}
            </button>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-narrow text-center">
          <h2 className="display text-3xl sm:text-4xl mb-4">{t('streamer.notify_title')}</h2>
          <p className="font-serif mb-7" style={{ color: 'var(--muted)' }}>{t('streamer.notify_sub')}</p>
          <button onClick={() => navigate('/aloita')} className="btn-primary" data-testid="streamer-index-cta">
            {t('btn.start_notifications')}
          </button>
        </div>
      </section>

      {submitOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => !submitDone && setSubmitOpen(false)}
          data-testid="suggest-modal"
        >
          <div className="panel p-7 sm:p-10 w-full max-w-md" style={{ background: 'var(--bg)' }} onClick={(e) => e.stopPropagation()}>
            {submitDone ? (
              <div className="text-center py-6">
                <div className="led mx-auto mb-5" style={{ background: '#E8924A' }}></div>
                <h3 className="display text-2xl mb-3">{t('streamer.suggest_thanks_title')}</h3>
                <p className="font-serif" style={{ color: 'var(--muted)' }}>{t('streamer.suggest_thanks_sub')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="eyebrow mb-2">{t('streamer.suggest').toUpperCase()}</div>
                    <h3 className="display text-2xl sm:text-3xl">{t('streamer.suggest_new')}</h3>
                  </div>
                  <button onClick={() => setSubmitOpen(false)} aria-label={t('common.menu_close')} style={{ color: 'var(--muted)' }}>
                    <X strokeWidth={1.5} size={20} />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="eyebrow block mb-2">{t('streamer.field_name')}</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t('streamer.placeholder_name')}
                      data-testid="suggest-name"
                      className="w-full font-serif"
                      style={{ padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 15 }}
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">{t('streamer.field_url')}</label>
                    <input
                      type="url"
                      required
                      value={form.channel}
                      onChange={(e) => setForm({ ...form, channel: e.target.value })}
                      placeholder="https://twitch.tv/..."
                      data-testid="suggest-channel"
                      className="w-full mono"
                      style={{ padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">
                      {t('streamer.field_why')} <span style={{ textTransform: 'none', letterSpacing: 0 }}>{t('streamer.field_why_opt')}</span>
                    </label>
                    <textarea
                      value={form.why}
                      onChange={(e) => setForm({ ...form, why: e.target.value })}
                      placeholder={t('streamer.placeholder_why')}
                      rows={3}
                      data-testid="suggest-why"
                      className="w-full font-serif"
                      style={{ padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 15, resize: 'vertical' }}
                    />
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="btn-primary w-full" data-testid="suggest-submit">
                      {t('streamer.send_suggestion')}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamerIndex;
