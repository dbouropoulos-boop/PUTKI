import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

// Phase 1.5 (Revised): UTM banner - sits above the marquee ticker on the homepage
// when a recognized campaign is detected in URL.

export const UTMBanner = () => {
  const { lang } = useLang();
  const [closed, setClosed] = useState(false);

  if (typeof window === 'undefined' || closed) return null;
  const params = new URLSearchParams(window.location.search);
  const utm = params.get('utm_campaign');
  if (!utm) return null;

  const campaign = decodeURIComponent(utm).toUpperCase();
  const message = lang === 'en'
    ? `You arrived from the "${campaign}" newsletter. Follow your favourite streamer below - drop your email, we\u2019ll handle the rest.`
    : `Tulit "${campaign}" -uutiskirjeestä. Seuraa suosikkistriimaajaasi alta - anna sähköposti, hoidamme loput.`;

  return (
    <div
      className="relative border-b"
      style={{ background: 'rgba(90,123,184,0.08)', borderColor: 'var(--border)' }}
      data-testid="utm-banner"
    >
      <div className="container-wide py-2.5 flex items-center gap-4 justify-between">
        <div className="mono flex items-center gap-3 min-w-0" style={{ fontSize: 11.5, letterSpacing: '0.04em', color: 'var(--ink)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--brand-blue)', flexShrink: 0 }} />
          <span className="truncate">{message}</span>
        </div>
        <button
          onClick={() => setClosed(true)}
          aria-label="Close"
          className="flex-shrink-0"
          style={{ color: 'var(--muted)' }}
          data-testid="utm-banner-close"
        >
          <X strokeWidth={1.6} size={16} />
        </button>
      </div>
    </div>
  );
};

export default UTMBanner;
