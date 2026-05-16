import React, { useEffect, useState } from 'react';
import { Users, BookOpen, Radio, Newspaper } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// V2 honesty pass — formerly SocialProofTicker.
// No fabricated subscriber / watcher / "forum heat" numbers.
// Pulls only real, auditable counts: signups in DB, named sources in
// source_map, published editorial items, latest dial state.

const Cell = ({ icon: Icon, label, value, sub, color, testId }) => (
  <div
    className="panel"
    style={{
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      borderColor: 'var(--border)', flex: 1, minWidth: 0,
    }}
    data-testid={testId}
  >
    <div style={{
      width: 32, height: 32, borderRadius: 4, flexShrink: 0,
      background: 'var(--bg)', border: `1px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color,
    }}>
      <Icon strokeWidth={1.6} size={14} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        {label}
      </div>
      <div className="mono" style={{
        fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
        color: 'var(--ink)', lineHeight: 1.05, marginTop: 2,
      }}>
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', fontWeight: 500, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  </div>
);

export const SocialProofTicker = () => {
  const { lang } = useLang();
  const [data, setData] = useState({ subs: null, sources: null, published: null, dial: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [a, b, c, d] = await Promise.all([
          fetch(`${BACKEND}/api/signup/count`).then((r) => r.json()).catch(() => ({})),
          fetch(`${BACKEND}/api/sources/public`).then((r) => r.json()).catch(() => ({})),
          fetch(`${BACKEND}/api/published?limit=200`).then((r) => r.json()).catch(() => ({})),
          fetch(`${BACKEND}/api/dial`).then((r) => r.json()).catch(() => ({})),
        ]);
        if (!cancelled) setData({
          subs: a.count ?? 0,
          sources: b.total ?? 0,
          published: (c.items || []).length,
          dial: d.state || null,
        });
      } catch {}
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const fmt = (n) => (n == null ? '—' : n.toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' '));
  const dialLabel = data.dial?.label || (lang === 'en' ? 'NO SIGNAL' : 'EI SIGNAALIA');

  return (
    <section
      className="py-7 sm:py-8"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
      data-testid="mittari-pipeline-status"
    >
      <div className="container-wide">
        <div className="flex items-baseline justify-between mb-4">
          <div className="eyebrow inline-flex items-center gap-2">
            <span className="led" style={{ background: '#5A7BB8' }} />
            {lang === 'en' ? 'MITTARI · OPERATIONAL STATUS' : 'MITTARI · OPERATIIVINEN TILA'}
          </div>
          <div className="mono hidden sm:block" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
            {lang === 'en' ? 'AUDITABLE COUNTS · NO FABRICATION' : 'TARKISTETTAVAT LUVUT · EI KEKSITTYÄ DATAA'}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Cell
            icon={Users}
            label={lang === 'en' ? 'SUBSCRIBERS' : 'TILAAJAT'}
            value={fmt(data.subs)}
            sub={lang === 'en' ? 'IN NEWSLETTER DB' : 'TILAUSLISTALLA'}
            color="#5A7BB8"
            testId="status-subscribers"
          />
          <Cell
            icon={BookOpen}
            label={lang === 'en' ? 'NAMED SOURCES' : 'NIMETYT LÄHTEET'}
            value={fmt(data.sources)}
            sub={lang === 'en' ? 'EDITORIAL MAP · /LEHDISTO' : 'LÄHDEKARTTA · /LEHDISTO'}
            color="#E8924A"
            testId="status-sources"
          />
          <Cell
            icon={Newspaper}
            label={lang === 'en' ? 'PUBLISHED ITEMS' : 'JULKAISTUT JUTUT'}
            value={fmt(data.published)}
            sub={lang === 'en' ? 'EDITORIAL PIPELINE' : 'TOIMITUKSEN PUTKI'}
            color="#3B7A57"
            testId="status-published"
          />
          <Cell
            icon={Radio}
            label={lang === 'en' ? 'DIAL STATE' : 'MITTARIN TILA'}
            value={dialLabel}
            sub={lang === 'en' ? 'COMPUTED LIVE' : 'LASKETTU LIVE'}
            color={data.dial?.color || 'var(--muted)'}
            testId="status-dial"
          />
        </div>
      </div>
    </section>
  );
};

export default SocialProofTicker;
