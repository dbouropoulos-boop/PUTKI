/**
 * StreamerAlertModal — the conversion funnel that captures the actual
 * subscriber. Email required, phone + Telegram username optional.
 *
 * Posts to /api/alerts/streamer. Renders a confirmation state on success.
 */
import React, { useEffect, useState } from 'react';
import { X, Bell, CheckCircle2 } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const StreamerAlertModal = ({ streamer, platform = 'twitch', onClose }) => {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // Reset state every time we open for a new streamer
  useEffect(() => {
    if (streamer) {
      setEmail(''); setPhone(''); setTelegram('');
      setSubmitting(false); setDone(false); setError(null);
    }
  }, [streamer]);

  // ESC closes
  useEffect(() => {
    if (!streamer) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streamer, onClose]);

  if (!streamer) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const channels = ['email'];
      if (phone.trim()) channels.push('sms');
      if (telegram.trim()) channels.push('telegram');
      const r = await fetch(`${BACKEND}/api/alerts/streamer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim() || null,
          telegram_username: telegram.trim() || null,
          streamer_login: streamer.user_login,
          streamer_name: streamer.user_name || streamer.user_login,
          platform,
          channels,
        }),
      });
      if (!r.ok) {
        const detail = (await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`;
        throw new Error(detail);
      }
      setDone(true);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="streamer-alert-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          maxWidth: 460,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="mono inline-flex items-center gap-2"
               style={{ fontSize: 10, letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)' }}>
            <Bell strokeWidth={1.9} size={12} />
            {t('alert_modal.eyebrow').toUpperCase()}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="streamer-alert-close"
            className="opacity-70 hover:opacity-100"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
          >
            <X strokeWidth={1.6} size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center" data-testid="streamer-alert-success">
            <CheckCircle2 strokeWidth={1.6} size={42} style={{ color: '#2c7a4b', margin: '8px auto 14px' }} />
            <h3 className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 }}>
              {t('alert_modal.success_title')}
            </h3>
            <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
              {t('alert_modal.success_body').split('{name}').reduce((acc, part, i) =>
                i === 0
                  ? [part]
                  : [...acc,
                      <strong key="n" style={{ color: 'var(--ink)' }}>
                        {streamer.user_name || streamer.user_login}
                      </strong>, part], [])}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mono"
              style={{
                padding: '11px 18px',
                fontSize: 11,
                letterSpacing: '0.22em',
                fontWeight: 700,
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 2,
              }}
            >
              {t('alert_modal.close').toUpperCase()}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <h3 className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
              {t('alert_modal.title').replace('{name}', streamer.user_name || streamer.user_login)}
            </h3>
            <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              {t('alert_modal.body').replaceAll('{name}', streamer.user_name || streamer.user_login)}
            </p>

            <label className="block">
              <span className="mono mb-2 block" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                {t('alert_modal.email_label').toUpperCase()}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('alert_modal.email_placeholder')}
                data-testid="streamer-alert-email-input"
                className="mono w-full"
                style={{
                  padding: '12px 14px', borderRadius: 2,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)', color: 'var(--ink)',
                  outline: 'none', fontSize: 13, letterSpacing: '0.04em',
                }}
              />
            </label>

            <label className="block">
              <span className="mono mb-2 block" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                {t('alert_modal.phone_label').toUpperCase()}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('alert_modal.phone_placeholder')}
                data-testid="streamer-alert-phone-input"
                className="mono w-full"
                style={{
                  padding: '12px 14px', borderRadius: 2,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)', color: 'var(--ink)',
                  outline: 'none', fontSize: 13, letterSpacing: '0.04em',
                }}
              />
            </label>

            <label className="block">
              <span className="mono mb-2 block" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                {t('alert_modal.telegram_label').toUpperCase()}
              </span>
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder={t('alert_modal.telegram_placeholder')}
                data-testid="streamer-alert-telegram-input"
                className="mono w-full"
                style={{
                  padding: '12px 14px', borderRadius: 2,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)', color: 'var(--ink)',
                  outline: 'none', fontSize: 13, letterSpacing: '0.04em',
                }}
              />
            </label>

            {error && (
              <div className="mono" style={{ fontSize: 11, color: '#C8423C', letterSpacing: '0.14em' }}
                   data-testid="streamer-alert-error">
                {t('alert_modal.error').toUpperCase()} · {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              data-testid="streamer-alert-submit"
              className="mono w-full"
              style={{
                padding: '14px 18px',
                fontSize: 12,
                letterSpacing: '0.22em',
                fontWeight: 700,
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: 'none',
                cursor: submitting ? 'wait' : 'pointer',
                borderRadius: 2,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? t('alert_modal.submitting').toUpperCase() : t('alert_modal.submit').toUpperCase()}
            </button>

            <div className="mono text-center" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', opacity: 0.7 }}>
              {t('alert_modal.disclaimer').toUpperCase()}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StreamerAlertModal;
