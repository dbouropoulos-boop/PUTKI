import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

// Fetches the Telegram channel URL from /api/settings (set via /back-office),
// renders an inline button beneath any email-capture surface.
// While the channel is unset, the button is disabled and shows a "coming soon" pill.

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const TelegramSubscribeButton = ({ compact = false, dataTestId = 'telegram-subscribe' }) => {
  const { lang } = useLang();
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/settings/public`)
      .then((r) => r.ok ? r.json() : { telegram_channel: null })
      .then((d) => {
        if (cancelled) return;
        const v = d.telegram_channel || null;
        setUrl(v);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const handleClick = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const labelOn  = lang === 'en' ? 'Subscribe via Telegram' : 'Tilaa Telegramissa';
  const labelOff = lang === 'en' ? 'Telegram — coming soon' : 'Telegram — tulossa';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!url}
      className="btn-secondary w-full"
      data-testid={dataTestId}
      aria-disabled={!url}
      style={{
        marginTop: 8,
        padding: compact ? '10px 16px' : '14px 20px',
        minHeight: compact ? 40 : 48,
        background: url ? 'var(--surface)' : 'var(--surface-2)',
        borderColor: url ? 'var(--ink)' : 'var(--border-strong)',
        color: url ? 'var(--ink)' : 'var(--muted)',
        cursor: url ? 'pointer' : 'not-allowed',
        opacity: loaded ? 1 : 0.6,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <Send strokeWidth={1.7} size={13} />
      <span>{url ? labelOn : labelOff}</span>
    </button>
  );
};

export default TelegramSubscribeButton;
