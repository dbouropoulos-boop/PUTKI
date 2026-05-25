/**
 * StickyTelegramCTA - floating Telegram subscribe pill that fades in
 * after the user scrolls past the hero. Dismissable; remembers dismissal
 * for 7 days via localStorage. Used on the homepage + /viikon-kortti.
 */
import React, { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const TELEGRAM_HANDLE = 'putkihq_vinkit';
const TELEGRAM_URL = `https://t.me/${TELEGRAM_HANDLE}`;
const DISMISS_KEY = 'putki_sticky_telegram_dismissed_at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const StickyTelegramCTA = () => {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const at = parseInt(window.localStorage.getItem(DISMISS_KEY) || '0', 10);
      if (at && Date.now() - at < DISMISS_TTL_MS) {
        setDismissed(true);
        return;
      }
    } catch {}
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  };

  if (dismissed || !visible) return null;

  return (
    <div
      data-testid="sticky-telegram-cta"
      className="fixed z-40"
      style={{
        right: 24, bottom: 24,
        maxWidth: 320,
        background: '#229ED9',
        color: '#fff',
        borderRadius: 4,
        boxShadow: '0 16px 32px -8px rgba(0,0,0,0.35), 0 4px 8px -4px rgba(0,0,0,0.15)',
        animation: 'putki-slide-up 320ms ease-out',
      }}
    >
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="sticky-telegram-link"
        className="flex items-center gap-3 px-4 py-3"
        style={{ color: '#fff', textDecoration: 'none' }}
      >
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }}
        >
          <Send strokeWidth={1.9} size={16} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15 }}>
            {t('sticky.telegram_label')}
          </div>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.16em', opacity: 0.82, fontWeight: 600, marginTop: 2 }}>
            {t('sticky.telegram_sub').toUpperCase()}
          </div>
        </div>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        data-testid="sticky-telegram-dismiss"
        className="absolute"
        style={{
          top: 4, right: 4,
          background: 'transparent', border: 'none', color: '#fff',
          opacity: 0.78, cursor: 'pointer', padding: 4,
        }}
      >
        <X strokeWidth={1.7} size={12} />
      </button>
      <style>{`
        @keyframes putki-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default StickyTelegramCTA;
