/**
 * useTimeAgo — formats a timestamp as "12m ago" and auto-refreshes every 60s
 * so all timestamps decay live without page reload.
 */
import { useEffect, useState } from 'react';

const _format = (ts, lang, t) => {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return t('time_decay.just_now');
  if (m < 60) return t('time_decay.minutes_ago', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('time_decay.hours_ago', { count: h });
  const d = Math.floor(h / 24);
  return t('time_decay.days_ago', { count: d });
};

export const useTimeAgo = (timestamp, lang, t) => {
  const [val, setVal] = useState(() => _format(timestamp, lang, t));
  useEffect(() => {
    setVal(_format(timestamp, lang, t));
    const id = setInterval(() => setVal(_format(timestamp, lang, t)), 60000);
    return () => clearInterval(id);
  }, [timestamp, lang, t]);
  return val;
};
