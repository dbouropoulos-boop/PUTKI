/**
 * Voyager — Next week + signup routing.
 *
 * Spec §4.6: the page must NOT dead-end. Two onward CTAs: streamer
 * alerts (so visitors don't miss next week) and Mestari diagnostic
 * (the 90-second cold-acquisition entry surface).
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Mail } from 'lucide-react';

const NextWeek = ({ lang, rotationISO }) => {
  const fmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fi-FI', {
        day: 'numeric', month: 'long',
      }).format(new Date(rotationISO));
    } catch { return ''; }
  }, [lang, rotationISO]);
  return (
    <section data-testid="voyager-next" style={{
      padding: '40px 24px 56px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          letterSpacing: '0.24em', fontWeight: 700, color: 'var(--muted)',
        }}>{lang === 'en' ? 'NEXT WEEK' : 'ENSI VIIKOLLA'}</span>
        <h2 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700,
          fontSize: 'clamp(22px, 2.8vw, 30px)', lineHeight: 1.2,
          letterSpacing: '-0.01em', color: 'var(--ink)',
          margin: '10px 0 18px',
        }}>
          {lang === 'en'
            ? `New pick drops ${fmt}. Catch it.`
            : `Uusi valinta julkaistaan ${fmt}. Älä missaa.`}
        </h2>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          <Link to="/striimaajat" data-testid="voyager-next-streamers"
            style={{
              padding: '16px 18px', background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'var(--ink)',
            }}>
            <Bell strokeWidth={1.5} size={18} style={{ flexShrink: 0 }} />
            <div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
              }}>{lang === 'en' ? 'STREAMER ALERTS' : 'STRIIMAAJAT'}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
                marginTop: 4,
              }}>{lang === 'en' ? 'Get notified when they go live →' : 'Ilmoitukset livestä →'}</div>
            </div>
          </Link>
          <Link to="/mestari" data-testid="voyager-next-mestari"
            style={{
              padding: '16px 18px', background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              textDecoration: 'none', color: 'var(--ink)',
            }}>
            <Mail strokeWidth={1.5} size={18} style={{ flexShrink: 0 }} />
            <div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700,
              }}>{lang === 'en' ? 'BETTING TIPS' : 'VEDONLYÖNTIVINKIT'}</div>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700,
                marginTop: 4,
              }}>{lang === 'en' ? '90s diagnostic + 5-day primer →' : '90 s diagnostiikka + 5 päivän opas →'}</div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NextWeek;
