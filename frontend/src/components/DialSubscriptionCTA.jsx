/**
 * DialSubscriptionCTA — Editorial Nordic CTA placed UNDER (never inside) the dial.
 *
 * Dial design is untouched. This is a separate panel that rotates its
 * messaging based on the current Mittari state:
 *   • TYYNI / KYLMA       → "Set an alert for when the scene wakes up"
 *   • VIRE / HAALEA       → "Get a daily summary"
 *   • VIPINÄ / KUUMA      → "Scene active — get pinged"
 *   • MEININKI / MYRSKY   → "Scene rolling — alert me on next surge"
 *   • PERKELE / KIIRA.    → "Scene perkele — don't miss the next clip"
 *
 * Channels: Telegram (active), SMS (active), Email (active). All three POST
 * to /api/subscribe/dial-alerts.
 */
import React, { useState } from 'react';
import { Bell, Send, Mail, MessageSquare, Loader2, Check, X, Flame, Zap, Lightbulb, Snowflake, Trophy } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATE_CONFIG = {
  KIIRASTULI: { icon: Trophy,    color: '#C13B2C', tone: 'jackpot' },
  MYRSKY:     { icon: Flame,     color: '#C97A3A', tone: 'rush' },
  KUUMA:      { icon: Zap,       color: '#D4B445', tone: 'warm' },
  HAALEA:     { icon: Lightbulb, color: '#6FA37D', tone: 'slow' },
  KYLMA:      { icon: Snowflake, color: '#5C8A8A', tone: 'dry' },
};

const ChannelButton = ({ icon: Icon, label, color, onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className="mono inline-flex items-center justify-center gap-2"
    style={{
      padding: '13px 18px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
      background: 'var(--bg)', color: 'var(--ink)',
      border: '1px solid var(--border-strong)', borderRadius: 2,
      cursor: 'pointer', flex: 1, minWidth: 0,
      transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = color; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
  >
    <Icon strokeWidth={1.8} size={13} />
    {label.toUpperCase()}
  </button>
);

const SubscribeModal = ({ channel, lang, t, onClose }) => {
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // 'ok' | 'error'
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setStatus(null);
    try {
      const r = await fetch(`${BACKEND}/api/subscribe/dial-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, contact, min_state: 'MEININKI' }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${r.status}`);
      }
      setStatus('ok');
    } catch (e) {
      setStatus('error'); setError(String(e.message || e));
    } finally { setBusy(false); }
  };

  const placeholder = channel === 'telegram' ? '@putki_user'
    : channel === 'sms' ? '+358 40 123 4567'
    : 'you@example.com';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      data-testid="dial-cta-modal"
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 4, maxWidth: 420, width: '100%' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="mono inline-flex items-center gap-2" style={{ fontSize: 10, letterSpacing: '0.24em', fontWeight: 700 }}>
            <Bell strokeWidth={1.9} size={12} />
            {t(`dial_cta.modal_eyebrow_${channel}`).toUpperCase()}
          </div>
          <button type="button" onClick={onClose} data-testid="dial-cta-modal-close" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, color: 'var(--ink)' }}>
            <X strokeWidth={1.6} size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {status === 'ok' ? (
            <div className="text-center py-4" data-testid="dial-cta-success">
              <Check strokeWidth={1.6} size={36} className="mx-auto mb-3" style={{ color: '#2c7a4b' }} />
              <h3 className="display" style={{ fontSize: 20, fontWeight: 800 }}>{t('dial_cta.success_title')}</h3>
              <p className="font-serif mt-2" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{t('dial_cta.success_body')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3" data-testid="dial-cta-form">
              <h3 className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{t(`dial_cta.modal_title_${channel}`)}</h3>
              <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>{t('dial_cta.modal_body')}</p>
              <input
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={placeholder}
                data-testid="dial-cta-contact"
                className="w-full px-3 py-2.5"
                style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, borderRadius: 2 }}
              />
              {status === 'error' && (
                <div className="mono" data-testid="dial-cta-error" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#C8423C', fontWeight: 600 }}>{error.toUpperCase()}</div>
              )}
              <button type="submit" disabled={busy} data-testid="dial-cta-submit" className="mono w-full inline-flex items-center justify-center gap-2"
                style={{ padding: '12px 16px', background: 'var(--ink)', color: 'var(--bg)', fontSize: 12, letterSpacing: '0.22em', fontWeight: 700, border: 'none', borderRadius: 2, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? <><Loader2 size={13} className="animate-spin" />{t('dial_cta.submitting').toUpperCase()}</> : t('dial_cta.subscribe').toUpperCase()}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const DialSubscriptionCTA = ({ dialState = 'KYLMA', streamCount = 0, viewerCount = 0, sportsCount = 0 }) => {
  const { lang, t } = useLang();
  const [modal, setModal] = useState(null);
  const cfg = STATE_CONFIG[dialState] || STATE_CONFIG.KYLMA;
  const Icon = cfg.icon;

  return (
    <section className="container-wide py-6" data-testid="dial-subscription-cta">
      <div className="panel p-5 sm:p-6" style={{ background: 'var(--bg)', borderLeft: `3px solid ${cfg.color}` }}>
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center" style={{ width: 44, height: 44, background: cfg.color, color: '#fff', borderRadius: 4 }}>
              <Icon strokeWidth={1.7} size={22} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="display" style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}
                data-testid="dial-cta-title">
              {t(`dial_cta.${cfg.tone}_title`)}
            </h3>
            <div className="mono mt-1" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}
                 data-testid="dial-cta-stats">
              {streamCount} {t('dial_cta.streams_live').toUpperCase()}
              {' · '}{viewerCount.toLocaleString()} {t('dial_cta.viewers').toUpperCase()}
              {sportsCount > 0 ? <>{' · '}{sportsCount} {t('dial_cta.matches').toUpperCase()}</> : null}
            </div>
            <p className="font-serif mt-2" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              {t(`dial_cta.${cfg.tone}_subtitle`)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4" data-testid="dial-cta-channels">
          <ChannelButton icon={Send}        label={t('dial_cta.telegram')} color="#229ED9" onClick={() => setModal('telegram')} testid="dial-cta-telegram" />
          <ChannelButton icon={MessageSquare} label={t('dial_cta.sms')}    color="#25D366" onClick={() => setModal('sms')}      testid="dial-cta-sms" />
          <ChannelButton icon={Mail}        label={t('dial_cta.email')}    color="#5A5A5A" onClick={() => setModal('email')}    testid="dial-cta-email" />
        </div>
        <div className="mono mt-3" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, opacity: 0.8 }}>
          {t('dial_cta.social_proof').toUpperCase()}
        </div>
      </div>
      {modal && <SubscribeModal channel={modal} lang={lang} t={t} onClose={() => setModal(null)} />}
    </section>
  );
};

export default DialSubscriptionCTA;
