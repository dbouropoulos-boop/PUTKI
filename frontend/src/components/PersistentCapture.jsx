import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail, MessageCircle, Smartphone, X, ChevronUp } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import TelegramSubscribeButton from './TelegramSubscribeButton';

// Phase 1.5 (Revised): persistent notification capture
// - Mobile: bottom sheet (~56px collapsed, expanded shows form)
// - Desktop: right-rail on inner pages (not on home — hero capture is dominant there)

const useIsDesktop = () => {
  const [d, setD] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
  useEffect(() => {
    const onR = () => setD(window.innerWidth >= 1024);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return d;
};

const CaptureForm = ({ compact = false }) => {
  const { t, lang } = useLang();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    console.log('persistent-capture', email);
    setDone(true);
  };

  if (done) {
    return (
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 600 }}>
        ✓ {lang === 'en' ? 'YOU\u2019RE IN.' : 'OLET LISTALLA.'}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid="persistent-capture-form">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('home.placeholder_email')}
        data-testid="persistent-capture-input"
        className="mono w-full"
        style={{ padding: compact ? '10px 12px' : '12px 14px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 12, letterSpacing: '0.08em' }}
      />
      <button type="submit" className="btn-primary w-full" data-testid="persistent-capture-submit" style={compact ? { padding: '10px 16px', minHeight: 40 } : undefined}>
        {t('btn.subscribe')}
      </button>
      <TelegramSubscribeButton compact dataTestId="persistent-capture-telegram" />
      <div className="flex items-center gap-3 mt-1 justify-center">
        <Mail strokeWidth={1.4} size={13} style={{ color: 'var(--muted)' }} />
        <MessageCircle strokeWidth={1.4} size={13} style={{ color: 'var(--muted)' }} />
        <Smartphone strokeWidth={1.4} size={13} style={{ color: 'var(--muted)' }} />
      </div>
    </form>
  );
};

export const PersistentCapture = () => {
  const { lang, t } = useLang();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [expanded, setExpanded] = useState(false);

  // Don't show on home (hero captures), signup, landing, or operator review pages (they have their own sticky CTA)
  const skipRoutes = ['/', '/aloita', '/landing'];
  const isOperatorReview = /^\/kasinot\/[^/]+$/.test(location.pathname);
  if (skipRoutes.includes(location.pathname) || isOperatorReview) return null;

  if (isDesktop) {
    return (
      <aside
        className="fixed z-30 hidden lg:block panel p-5"
        style={{
          right: 24,
          top: 120,
          width: 264,
          background: 'var(--surface)',
        }}
        data-testid="persistent-capture-desktop"
      >
        <div className="eyebrow mb-2">ASETA HÄLYTYS</div>
        <h3 className="display text-base mb-2" style={{ color: 'var(--ink)', lineHeight: 1.2 }}>
          Striimari liveen — sinä ekana
        </h3>
        <p className="font-serif mb-4" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          Mittarin signaali heti kun jotain tapahtuu.
        </p>
        <CaptureForm compact />
      </aside>
    );
  }

  // MOBILE bottom sheet
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        background: 'var(--bg)',
        borderTop: '1px solid var(--border-strong)',
        boxShadow: '0 -10px 30px -10px rgba(0,0,0,0.25)',
      }}
      data-testid="persistent-capture-mobile"
    >
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-5 py-4"
          data-testid="persistent-capture-expand"
        >
          <span className="mono inline-flex items-center gap-2" style={{ fontSize: 11.5, letterSpacing: '0.16em', color: 'var(--ink)', fontWeight: 600, textTransform: 'uppercase' }}>
            <span className="led" style={{ background: '#E8924A' }} />
            {t('btn.subscribe').replace(' →', '')}
          </span>
          <ChevronUp strokeWidth={1.6} size={18} style={{ color: 'var(--muted)' }} />
        </button>
      ) : (
        <div className="px-5 py-4">
          <div className="flex items-start justify-between mb-3">
            <h4 className="display text-base" style={{ color: 'var(--ink)' }}>
              Saa ilmoitus livenä
            </h4>
            <button onClick={() => setExpanded(false)} aria-label="Close" style={{ color: 'var(--muted)' }} data-testid="persistent-capture-collapse">
              <X strokeWidth={1.5} size={18} />
            </button>
          </div>
          <CaptureForm compact />
        </div>
      )}
    </div>
  );
};

export default PersistentCapture;
