import React from 'react';
import { X, MapPin } from 'lucide-react';
import { useSignupToast } from '../data/mockStreams';
import { useLang } from '../context/LanguageContext';

// Bottom-left dismissible "X subscribed from Y" toast.
// Uses Finnish names + cities only (per user spec).
export const SignupToast = () => {
  const { lang } = useLang();
  const { toast, dismiss } = useSignupToast();
  if (!toast) return null;

  return (
    <div
      className="fixed z-40 hidden sm:flex items-start gap-3 panel signup-toast-anim"
      style={{
        left: 24, bottom: 24, padding: '12px 14px', maxWidth: 320,
        background: 'var(--bg)', borderColor: 'var(--ink)',
        boxShadow: '0 12px 36px -8px rgba(0,0,0,0.35)',
      }}
      data-testid="signup-toast"
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: 999,
          background: 'var(--brand-blue)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
        className="mono"
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
          {toast.name.charAt(0)}
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>
          {lang === 'en' ? 'NEW SUBSCRIBER' : 'UUSI TILAAJA'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, fontFamily: 'Inter, system-ui' }}>
          {toast.name}
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 500, marginLeft: 6 }}>
            {lang === 'en' ? 'just joined' : 'liittyi juuri'}
          </span>
        </div>
        <div className="mono inline-flex items-center gap-1 mt-1" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 600 }}>
          <MapPin strokeWidth={1.6} size={10} />
          {toast.city.toUpperCase()}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        data-testid="signup-toast-dismiss"
        style={{ color: 'var(--muted)', flexShrink: 0 }}
      >
        <X strokeWidth={1.6} size={14} />
      </button>
    </div>
  );
};

export default SignupToast;
