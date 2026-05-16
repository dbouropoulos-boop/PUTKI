import React from 'react';
import Dial from './Dial';
import CountUp from './CountUp';
import { DIAL_STATES, STREAMERS } from '../data/mock';
import { useLang } from '../context/LanguageContext';

const PanelStat = ({ label, value, sub, align = 'left', lang = 'fi' }) => {
  const isNumeric = typeof value === 'number';
  const formatLocale = lang === 'en' ? 'en-US' : 'fi-FI';
  const formatNum = (n) => {
    const r = Math.round(n);
    const s = r.toLocaleString(formatLocale);
    return lang === 'en' ? s : s.replace(/,/g, ' ');
  };
  return (
    <div style={{ textAlign: align }} className="px-3 sm:px-0">
      <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1 }}>
        {isNumeric ? (
          <CountUp to={value} duration={1400} format={formatNum} />
        ) : (
          value
        )}
      </div>
      {sub && (
        <div className="mono mt-2" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
};

export const DialCockpit = ({ state = 'KUUMA' }) => {
  const { lang, t } = useLang();
  const live = STREAMERS.filter((s) => s.live);
  const totalViewers = live.reduce((a, s) => a + s.viewers, 0);

  const contributors = ['ANDYPYRO €42K', 'PACT KICK 5.6K', 'F1 MONZA'];

  const now = new Date();
  const localeTag = lang === 'en' ? 'en-GB' : 'fi-FI';
  const fmt = new Intl.DateTimeFormat(localeTag, { timeZone: 'Europe/Helsinki', weekday: 'long', day: 'numeric' });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', hour12: false }).format(now);
  const hour = parseInt((hourStr.match(/\d{2}/) || ['00'])[0], 10);
  const todKey = hour >= 18 ? 'time.evening' : hour >= 12 ? 'time.afternoon' : hour >= 6 ? 'time.morning' : 'time.night';

  return (
    <div className="flex flex-col items-center w-full" data-testid="dial-cockpit">
      <div
        className="mono mb-8 inline-flex items-center gap-2"
        style={{ fontSize: 11, letterSpacing: '0.28em', color: 'var(--muted)', fontWeight: 600 }}
        data-testid="cockpit-mode-label"
      >
        <span className="inline-block" style={{ width: 6, height: 6, borderRadius: 999, background: '#E8924A' }} />
        {weekday.toUpperCase()} · {t(todKey)} · {t('time.month_day', { day })}
      </div>

      <div className="hidden md:grid w-full" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 32, alignItems: 'center' }}>
        <div className="flex justify-end">
          <PanelStat label={t('common.live_label')} value={live.length} sub={t('common.live_streamers')} align="right" lang={lang} />
        </div>
        <div className="flex flex-col items-center">
          <Dial size="large" state={state} />
        </div>
        <div className="flex justify-start">
          <PanelStat label={t('common.viewers_label')} value={totalViewers} sub={t('common.viewers_sub')} align="left" lang={lang} />
        </div>
      </div>

      <div className="md:hidden w-full flex flex-col items-center">
        <div className="flex justify-between w-full max-w-xs mb-6">
          <PanelStat label={t('common.live')} value={live.length} sub={t('common.live_streamers')} align="left" lang={lang} />
          <PanelStat label={t('common.viewers_label')} value={totalViewers} sub={t('common.viewers_sub')} align="right" lang={lang} />
        </div>
        <Dial size="large" state={state} />
      </div>

      <div
        className="mono mt-6 flex items-center gap-2 flex-wrap justify-center px-4"
        style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}
        data-testid="cockpit-contributors"
      >
        {contributors.map((c, i) => (
          <React.Fragment key={c}>
            <span>{c}</span>
            {i < contributors.length - 1 && <span style={{ color: 'var(--border-strong)' }}>·</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default DialCockpit;
