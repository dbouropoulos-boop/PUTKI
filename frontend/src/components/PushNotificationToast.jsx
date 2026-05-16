import React from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotification } from '../data/mockStreams';
import { useLang } from '../context/LanguageContext';

// Mocked push notification — fires on dial "spike" intervals.
// Top-right desktop, top-center mobile.
export const PushNotificationToast = () => {
  const { lang } = useLang();
  const { push, dismiss } = usePushNotification();
  if (!push) return null;

  return (
    <div
      className="fixed z-50 push-toast-anim"
      style={{
        top: 64, right: 24, maxWidth: 360, width: 'calc(100vw - 48px)',
      }}
      data-testid="push-toast"
    >
      <div
        className="panel flex items-start gap-3"
        style={{
          padding: '14px 16px', background: 'var(--bg)',
          borderColor: push.color, borderWidth: 1,
          boxShadow: `0 0 0 1px ${push.color}33, 0 18px 48px -10px rgba(0,0,0,0.45)`,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 4, flexShrink: 0,
          background: push.color, color: '#F5F3EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell strokeWidth={1.6} size={16} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: push.color, fontWeight: 700 }}>
            MITTARI · {lang === 'en' ? push.titleEn : push.title}
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600, marginTop: 4, lineHeight: 1.3 }} className="font-display">
            {lang === 'en' ? push.bodyEn : push.bodyFi}
          </div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, marginTop: 6 }}>
            {lang === 'en' ? 'TAP TO OPEN MITTARI' : 'AVAA MITTARI'}
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          data-testid="push-toast-dismiss"
          style={{ color: 'var(--muted)', flexShrink: 0 }}
        >
          <X strokeWidth={1.6} size={14} />
        </button>
      </div>
    </div>
  );
};

export default PushNotificationToast;
