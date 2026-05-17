import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X, Globe } from 'lucide-react';
import StreamerCard from '../components/StreamerCard';
import { useStreamers } from '../hooks/useRegistry';
import { useLang } from '../context/LanguageContext';

const StreamerIndex = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const { data: streamers } = useStreamers({ market: 'fi' });
  // Live state is now sourced from real Twitch/Kick webhooks (Step 2). Until
  // those are wired with API keys, no streamer is rendered as "live" in this
  // surface — the entire roster shows as the editorial list and the dedicated
  // /api/signals/live endpoint surfaces real live streams elsewhere.
  const live = [];
  const offline = streamers;

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

      {live.length > 0 && (
        <section className="py-10 sm:py-12" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="container-wide">
            <div className="flex items-baseline gap-3 mb-6">
              <span className="led mt-1"></span>
              <h2 className="display text-2xl sm:text-3xl">
                {t('common.live_now')} · <span className="mono" style={{ fontWeight: 500 }}>{live.length}</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {live.map((s) => (
                <StreamerCard key={s.slug} streamer={s} />
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
