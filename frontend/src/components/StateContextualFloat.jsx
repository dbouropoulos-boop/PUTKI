import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { CURRENT_DIAL } from '../data/mock';
import { useLang } from '../context/LanguageContext';

// Floating contextual element bottom-right, dial-state-driven
const StateContextualFloat = () => {
  const { lang } = useLang();
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  const state = CURRENT_DIAL.key;
  const hot = ['KUUMA', 'MYRSKY', 'KIIRASTULI'].includes(state);

  const config = hot
    ? {
        href: '/kasinot',
        label: 'MITTARI ' + CURRENT_DIAL.label,
        body: lang === 'en'
          ? '3 of the week\u2019s best offers active now →'
          : '3 viikon parasta tarjousta nyt voimassa →',
        accent: CURRENT_DIAL.color,
      }
    : {
        href: '/viikon-kortti',
        label: 'MITTARI ' + CURRENT_DIAL.label,
        body: lang === 'en'
          ? 'Read this week\u2019s card →'
          : 'Lue viikon kortti →',
        accent: CURRENT_DIAL.color,
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
