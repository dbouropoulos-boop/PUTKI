import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import StreamerCard from '../components/StreamerCard';
import { STREAMERS } from '../data/mock';

const StreamerIndex = () => {
  const navigate = useNavigate();
  const live = STREAMERS.filter((s) => s.live);
  const offline = STREAMERS.filter((s) => !s.live);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [form, setForm] = useState({ name: '', channel: '', why: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mock submission — Phase 2 wires to Supabase
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
            MITTARI-SEURANTA · <span className="mono">{STREAMERS.length}</span> STRIIMAAJAA
          </div>
          <h1 className="display text-4xl sm:text-6xl mb-5">Suomen seuratut slot-striimaajat</h1>
          <p className="prose-mittari max-w-2xl" style={{ color: 'var(--muted)' }}>
            Toimituksellinen valinta — ei kaikki, vaan ne, joiden seuraaminen kannattaa. Tier 1 ja Tier 2 -nimet, sekä uusi Kick-aalto. Päivittyy reaaliajassa.
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <div className="flex items-baseline gap-3 mb-6">
            <span className="led mt-1"></span>
            <h2 className="display text-2xl sm:text-3xl">
              Livenä nyt · <span className="mono" style={{ fontWeight: 500 }}>{live.length}</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {live.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide">
          <h2 className="display text-2xl sm:text-3xl mb-6">Offline</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {offline.map((s) => (
              <StreamerCard key={s.slug} streamer={s} />
            ))}
          </div>

          {/* Submit-a-streamer link (Phase 1.5 addition) */}
          <div className="mt-12 text-center">
            <button
              onClick={() => setSubmitOpen(true)}
              className="mono inline-flex items-center gap-2 hover:underline"
              style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}
              data-testid="suggest-streamer-trigger"
            >
              <Plus strokeWidth={1.6} size={14} />
              Ehdota striimaajaa
            </button>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-narrow text-center">
          <h2 className="display text-3xl sm:text-4xl mb-4">Saa ilmoitus livenä</h2>
          <p className="font-serif mb-7" style={{ color: 'var(--muted)' }}>Sähköposti, Telegram tai web push. Ilmaista. Ei spämmiä.</p>
          <button onClick={() => navigate('/aloita')} className="btn-primary" data-testid="streamer-index-cta">
            Aloita ilmoitukset →
          </button>
        </div>
      </section>

      {/* Submit modal */}
      {submitOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => !submitDone && setSubmitOpen(false)}
          data-testid="suggest-modal"
        >
          <div
            className="panel p-7 sm:p-10 w-full max-w-md"
            style={{ background: 'var(--bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {submitDone ? (
              <div className="text-center py-6">
                <div className="led mx-auto mb-5" style={{ background: '#E8924A' }}></div>
                <h3 className="display text-2xl mb-3">Kiitos.</h3>
                <p className="font-serif" style={{ color: 'var(--muted)' }}>Toimitus käy ehdotuksesi läpi viikon sisällä.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="eyebrow mb-2">EHDOTA</div>
                    <h3 className="display text-2xl sm:text-3xl">Uusi striimaaja seurantaan</h3>
                  </div>
                  <button onClick={() => setSubmitOpen(false)} aria-label="Sulje" style={{ color: 'var(--muted)' }}>
                    <X strokeWidth={1.5} size={20} />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="eyebrow block mb-2">STRIIMAAJAN NIMI</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Esim. Slotsband"
                      data-testid="suggest-name"
                      className="w-full font-serif"
                      style={{ padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 15 }}
                    />
                  </div>
                  <div>
                    <label className="eyebrow block mb-2">TWITCH / KICK / YOUTUBE URL</label>
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
                    <label className="eyebrow block mb-2">MIKSI TÄTÄ KANNATTAA SEURATA <span style={{ textTransform: 'none', letterSpacing: 0 }}>(valinnainen)</span></label>
                    <textarea
                      value={form.why}
                      onChange={(e) => setForm({ ...form, why: e.target.value })}
                      placeholder="Yksi rivi. Toimitus arvostaa rehellisyyttä."
                      rows={3}
                      data-testid="suggest-why"
                      className="w-full font-serif"
                      style={{ padding: '12px 14px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 15, resize: 'vertical' }}
                    />
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="btn-primary w-full" data-testid="suggest-submit">
                      Lähetä ehdotus →
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
