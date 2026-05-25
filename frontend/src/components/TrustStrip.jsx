/**
 * TrustStrip - homepage trust signals. Honest, non-promotional.
 * Sits between the Live Activity Feed and the Capture form.
 */
import React from 'react';
import { Shield, BadgeCheck, FileText, Layers } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const TrustStrip = () => {
  const { t } = useLang();
  const badges = [
    { icon: Shield,     label: t('trust.responsible') },
    { icon: BadgeCheck, label: t('trust.editorial') },
    { icon: FileText,   label: t('trust.open_method') },
    { icon: Layers,     label: t('trust.layer2') },
  ];
  return (
    <section className="py-10" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
             data-testid="trust-strip">
      <div className="container-wide">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((b, i) => {
            const Icon = b.icon;
            return (
              <div
                key={i}
                className="panel p-4 flex items-center gap-3"
                style={{ background: 'var(--bg)' }}
                data-testid={`trust-strip-${i}`}
              >
                <Icon strokeWidth={1.5} size={20} style={{ color: 'var(--ink)', flexShrink: 0 }} />
                <span className="mono"
                      style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.4 }}>
                  {b.label.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustStrip;
