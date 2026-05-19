/**
 * Peli — Monthly raffle entry page.
 *
 * REPLACES the old Smartico game leaderboard. PUTKI HQ is a media company,
 * not a gambling platform. This page collects raffle entries (name, phone,
 * email) and surfaces:
 *   • current prize (editable via /back-office/peli)
 *   • 3 embedded videos (editable via back-office)
 *   • Weezybet partnership disclosure
 *   • clear "for entertainment only · no betting" notice
 */
import React, { useEffect, useState } from 'react';
import { Gift, Shield, BadgeCheck, Trophy, ArrowDown, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const RaffleForm = ({ t, onSuccess, disabled }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/peli/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, consent }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${r.status}`);
      }
      onSuccess();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="peli-raffle-form">
      <div>
        <label className="mono block mb-1" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {t('peli.raffle_name').toUpperCase()}
        </label>
        <input
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('peli.raffle_name_ph')}
          data-testid="peli-raffle-name"
          className="w-full px-4 py-3"
          style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, borderRadius: 2 }}
        />
      </div>
      <div>
        <label className="mono block mb-1" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {t('peli.raffle_phone').toUpperCase()}
        </label>
        <input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('peli.raffle_phone_ph')}
          data-testid="peli-raffle-phone"
          className="w-full px-4 py-3"
          style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, borderRadius: 2 }}
        />
      </div>
      <div>
        <label className="mono block mb-1" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
          {t('peli.raffle_email').toUpperCase()}
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('peli.raffle_email_ph')}
          data-testid="peli-raffle-email"
          className="w-full px-4 py-3"
          style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, borderRadius: 2 }}
        />
      </div>
      <label className="flex items-start gap-3 cursor-pointer" data-testid="peli-raffle-consent-label">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          data-testid="peli-raffle-consent"
          style={{ marginTop: 4 }}
        />
        <span className="font-serif" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          {t('peli.raffle_consent')}
        </span>
      </label>
      {error && (
        <div className="mono" data-testid="peli-raffle-error"
             style={{ fontSize: 11, letterSpacing: '0.14em', color: '#C8423C', fontWeight: 600 }}>
          {error.toUpperCase()}
        </div>
      )}
      <button
        type="submit"
        disabled={!consent || submitting || disabled}
        data-testid="peli-raffle-submit"
        className="mono inline-flex items-center gap-2 w-full justify-center"
        style={{
          padding: '14px 22px',
          background: (!consent || submitting || disabled) ? 'var(--muted)' : 'var(--ink)',
          color: 'var(--bg)',
          fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
          border: 'none',
          cursor: (!consent || submitting || disabled) ? 'not-allowed' : 'pointer',
          borderRadius: 2, opacity: (!consent || submitting || disabled) ? 0.6 : 1,
        }}
      >
        {submitting
          ? t('peli.raffle_submitting').toUpperCase()
          : t('peli.raffle_submit').toUpperCase()}
      </button>
    </form>
  );
};

const VideoEmbed = ({ video, t }) => {
  const id = (video?.youtube_id || '').trim();
  if (!id) {
    return (
      <div
        data-testid={`peli-video-empty-${video?.id || 'x'}`}
        className="panel flex flex-col items-center justify-center"
        style={{ aspectRatio: '16/9', background: '#0A0A0A', color: 'rgba(245,243,238,0.55)', borderRadius: 4 }}
      >
        <span className="mono text-center px-4" style={{ fontSize: 11, letterSpacing: '0.22em', fontWeight: 600 }}>
          {t('peli.raffle_video_soon').toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    <div className="panel overflow-hidden" data-testid={`peli-video-${video.id}`} style={{ borderRadius: 4 }}>
      <div className="relative" style={{ aspectRatio: '16/9', background: '#000' }}>
        <iframe
          title={video.title || `video ${video.id}`}
          src={`https://www.youtube.com/embed/${encodeURIComponent(id)}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>
      {(video.title || video.caption) && (
        <div className="p-3" style={{ background: 'var(--bg)' }}>
          {video.title && (
            <div className="display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
              {video.title}
            </div>
          )}
          {video.caption && (
            <div className="font-serif" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
              {video.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Peli = () => {
  const { lang, t } = useLang();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useDocumentMeta({
    title: lang === 'en'
      ? 'Monthly raffle · PUTKI HQ'
      : 'Kuukauden arvonta · PUTKI HQ',
    description: lang === 'en'
      ? 'PUTKI HQ monthly editorial raffle. For entertainment only. No betting. No deposit.'
      : 'PUTKI HQ:n kuukausittainen toimituksellinen arvonta. Vain viihteeksi. Ei vedonlyöntiä. Ei talletusta.',
    canonical: `${BACKEND}/peli`,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/peli/config`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setConfig(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const scrollToForm = () => {
    const el = document.getElementById('peli-entry');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const videos = config?.videos || [
    { id: 'v1' }, { id: 'v2' }, { id: 'v3' },
  ];
  const entryCount = config?.entry_count || 0;
  const enabled = config?.enabled !== false;
  const prizeLabel = config?.prize_label || '';
  const prizeAmount = config?.prize_amount;
  const prizeCurrency = config?.prize_currency || 'EUR';
  const prizeText = prizeAmount
    ? `${prizeAmount} ${prizeCurrency === 'EUR' ? '€' : prizeCurrency}${prizeLabel ? ` · ${prizeLabel}` : ''}`
    : (prizeLabel || (lang === 'en' ? 'To be announced' : 'Julkistetaan pian'));

  return (
    <div data-testid="peli-page">
      {/* HERO — Phase 1 Final · Voyager-restyled */}
      <section data-testid="peli-hero" style={{
        position: 'relative', overflow: 'hidden',
        borderBottom: '1px solid var(--hairline, #221E1B)',
      }}>
        {/* Editorial hero photo — Nano Banana slot-reel macro */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url('/hero/peli.jpg')`,
          backgroundSize: 'cover', backgroundPosition: 'right center',
          filter: 'saturate(0.92)',
        }} />
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, rgba(11,10,9,0.94) 0%, rgba(11,10,9,0.82) 45%, rgba(11,10,9,0.55) 80%, rgba(11,10,9,0.40) 100%)',
        }} />

        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 1180, margin: '0 auto', padding: '64px 32px 56px',
        }}>
          <div style={{ maxWidth: 760 }}>
            <span data-testid="peli-eyebrow" style={{
              color: '#6FA37D',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.24em', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Gift strokeWidth={1.5} size={12} />
              PELI · VOYAGER
            </span>
            <h1 data-testid="peli-title" style={{
              fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700,
              fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: 1.04,
              letterSpacing: '-0.025em', color: '#FFFFFF',
              margin: '14px 0 14px',
            }}>{prizeText}</h1>
            <p style={{
              color: 'var(--ink, #ECE6D8)', fontSize: 16, lineHeight: 1.55,
              maxWidth: 620, margin: '0 0 22px', opacity: 0.92,
            }}>{t('peli.raffle_subline')}</p>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
              <button
                type="button"
                onClick={scrollToForm}
                data-testid="peli-hero-cta"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '13px 22px',
                  background: '#FFFFFF', color: '#0B0A09',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11.5, letterSpacing: '0.22em', fontWeight: 700,
                  border: 'none', cursor: 'pointer', borderRadius: 2,
                }}
              >
                {t('peli.raffle_submit').toUpperCase()}
                <ArrowDown strokeWidth={2} size={13} />
              </button>
              <span data-testid="peli-entry-count" style={{
                color: 'var(--muted, #9C9587)',
                fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.16em',
              }}>
                {entryCount > 0
                  ? (lang === 'en' ? `${entryCount} ENTRIES` : `${entryCount} OSALLISTUJAA`)
                  : (lang === 'en' ? 'OPEN NOW' : 'AUKI NYT')}
              </span>
            </div>

            <p data-testid="peli-disclaimer-hero" style={{
              display: 'inline-block', padding: '7px 12px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 10.5, letterSpacing: '0.20em', fontWeight: 700,
              color: 'var(--ink, #ECE6D8)',
              background: 'var(--surface, #141210)',
              border: '1px solid var(--border-strong, #3A3530)',
              borderRadius: 2, margin: 0,
            }}>{t('peli.raffle_disclaimer')}</p>
          </div>
        </div>
      </section>

      {/* VIDEOS */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-6">{t('peli.raffle_videos_t').toUpperCase()}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="peli-videos">
            {videos.slice(0, 3).map((v, idx) => (
              <VideoEmbed key={v.id || idx} video={v} t={t} />
            ))}
          </div>
        </div>
      </section>

      {/* RAFFLE ENTRY FORM */}
      <section id="peli-entry" className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <div className="eyebrow mb-4 inline-flex items-center gap-2">
              <Trophy strokeWidth={1.5} size={12} />
              {t('peli.raffle_prize_label').toUpperCase()}
            </div>
            <h2 className="display text-3xl sm:text-4xl mb-3" style={{ lineHeight: 1.1 }}>
              {prizeText}
            </h2>
            <p className="prose-mittari max-w-prose mb-4">
              {t('peli.raffle_form_sub')}
            </p>
            <div className="mono" data-testid="peli-entry-count"
                 style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
              {entryCount > 0
                ? t('peli.raffle_count', { n: entryCount }).toUpperCase()
                : t('peli.raffle_zero').toUpperCase()}
            </div>
            {config?.partner_name && (
              <div className="panel p-4 mt-6" style={{ background: 'var(--bg)' }} data-testid="peli-partner">
                <div className="mono mb-1" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                  {t('peli.raffle_partner').toUpperCase()}
                </div>
                <a
                  href={config.partner_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="display"
                  style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', textDecoration: 'none' }}
                >
                  {config.partner_name}
                </a>
                {config.partner_disclosure && (
                  <div className="font-serif mt-1" style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {config.partner_disclosure}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="panel p-6 sm:p-8" style={{ background: 'var(--bg)' }} data-testid="peli-form-card">
            <h3 className="display mb-2" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>
              {t('peli.raffle_form_t')}
            </h3>
            {!enabled ? (
              <div className="mono py-6" data-testid="peli-raffle-closed"
                   style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.18em', textAlign: 'center', fontWeight: 600 }}>
                {t('peli.raffle_closed').toUpperCase()}
              </div>
            ) : success ? (
              <div className="py-6 text-center" data-testid="peli-raffle-success">
                <CheckCircle2 strokeWidth={1.5} size={40} className="mx-auto mb-3" style={{ color: '#3D8B5C' }} />
                <div className="display mb-2" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>
                  {t('peli.raffle_success_t')}
                </div>
                <p className="font-serif" style={{ color: 'var(--muted)', fontSize: 14 }}>
                  {t('peli.raffle_success_b')}
                </p>
              </div>
            ) : loading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 strokeWidth={1.5} size={24} className="animate-spin" style={{ opacity: 0.45 }} />
              </div>
            ) : (
              <RaffleForm t={t} onSuccess={() => setSuccess(true)} disabled={!enabled} />
            )}
          </div>
        </div>
      </section>

      {/* TRUST / DISCLOSURE */}
      <section className="py-12" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container-wide">
          <div className="eyebrow mb-6">{t('peli.trust').toUpperCase()}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="peli-trust">
            <div className="panel p-4 flex items-center gap-3" style={{ background: 'var(--bg)' }}>
              <BadgeCheck strokeWidth={1.5} size={20} style={{ color: 'var(--ink)', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
                {(lang === 'en' ? 'FOR ENTERTAINMENT ONLY' : 'VAIN VIIHTEEKSI')}
              </span>
            </div>
            <div className="panel p-4 flex items-center gap-3" style={{ background: 'var(--bg)' }}>
              <Shield strokeWidth={1.5} size={20} style={{ color: 'var(--ink)', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
                {(lang === 'en' ? 'NO BETTING ACTIVITY' : 'EI VEDONLYÖNTIÄ')}
              </span>
            </div>
            <div className="panel p-4 flex items-center gap-3" style={{ background: 'var(--bg)' }}>
              <Trophy strokeWidth={1.5} size={20} style={{ color: 'var(--ink)', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
                {(lang === 'en' ? 'FREE TO ENTER' : 'ILMAINEN OSALLISTUMINEN')}
              </span>
            </div>
            <div className="panel p-4 flex items-center gap-3" style={{ background: 'var(--bg)' }}>
              <Gift strokeWidth={1.5} size={20} style={{ color: 'var(--ink)', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
                {(lang === 'en' ? 'EDITORIAL TEAM DRAWS WINNER' : 'TOIMITUS ARPOO VOITTAJAN')}
              </span>
            </div>
          </div>
          <p className="font-serif mt-6" style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 720, lineHeight: 1.6 }}>
            {lang === 'en'
              ? 'PUTKI HQ is an editorial media company, not a casino or gambling operator. This raffle is a free promotional draw — no deposit, no stake, no betting activity takes place.'
              : 'PUTKI HQ on toimituksellinen mediayhtiö, ei kasino tai vedonlyöntioperaattori. Tämä arvonta on ilmainen promootio — ei talletusta, ei panostusta, ei vedonlyöntiä.'}
          </p>
          <p className="mono mt-3" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            <Link to="/uutiset" data-testid="peli-uutiset-link" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
              {t('peli.activity_all').toUpperCase()}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default Peli;
