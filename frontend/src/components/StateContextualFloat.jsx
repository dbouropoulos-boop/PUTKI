import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { dialLabel } from '../constants/dial';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass: reads /api/dial. No mock CURRENT_DIAL import.
// When dial is KUUMA+ → /kasinot CTA; KYLMA/HAALEA → /viikon-kortti CTA.
// Hidden entirely when the dial is at the static-seed KYLMA fallback
// (any_real=false AND no signals yet) so it doesn't pretend to point
// readers at "active offers" that haven't been audited.

const StateContextualFloat = () => {
  const { lang } = useLang();
  const [closed, setClosed] = useState(false);
  const [dial, setDial] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND}/api/dial`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDial(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (closed || !dial?.state) return null;

  const stateKey = dial.state.key;
  const hot = ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(stateKey);
  const anyReal = !!dial.any_real;

  // Honesty guard - don't surface a "hot offers" link from a first-boot
  // KYLMA fallback. Only surface if we have a real recomputed snapshot.
  if (!anyReal && stateKey === 'KYLMA') return null;

  const meterWord = lang === 'en' ? 'METER' : 'MITTARI';
  const config = hot
    ? {
        href: '/kasinot',
        label: `${meterWord} ${dialLabel(stateKey, lang)}`,
        body: lang === 'en'
          ? 'The meter is hot - see the operator ranking →'
          : 'Mittari on kuuma - katso operaattorisijoitus →',
        accent: dial.state.color,
      }
    : {
        href: '/viikon-kortti',
        label: `${meterWord} ${dialLabel(stateKey, lang)}`,
        body: lang === 'en'
          ? 'Read this week\u2019s card →'
          : 'Lue viikon kortti →',
        accent: dial.state.color,
      };

  return (
    <Link
      to={config.href}
      className="fixed bottom-4 left-4 lg:left-auto lg:right-4 z-30 panel panel-hover flex items-start gap-3 px-4 py-3 max-w-xs"
      style={{ background: 'var(--bg)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.35)' }}
      data-testid="state-contextual-float"
    >
      <span className="mt-1 inline-block flex-shrink-0" style={{ width: 8, height: 8, borderRadius: 999, background: config.accent }} />
      <div className="flex-1 min-w-0">
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 700, color: config.accent }}>
          {config.label}
        </div>
        <div className="mono mt-1" style={{ fontSize: 12, letterSpacing: '0.02em', color: 'var(--ink)', fontWeight: 500 }}>
          {config.body}
        </div>
      </div>
      <button
        onClick={(e) => { e.preventDefault(); setClosed(true); }}
        aria-label="Close"
        className="ml-2 -mr-1"
        style={{ color: 'var(--muted)' }}
        data-testid="state-float-close"
      >
        <X strokeWidth={1.5} size={14} />
      </button>
    </Link>
  );
};

export default StateContextualFloat;
