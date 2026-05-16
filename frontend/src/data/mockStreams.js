// Phase 2.0 — mocked real-time streams driving "liveness" UI.
// All data is synthetic; no backend yet. Hooks emit on intervals so the UI
// "breathes" with new events / counters / toasts.
import { useEffect, useRef, useState } from 'react';

// ─────────────── Activity Feed events (Mittari-flavoured) ───────────────
// Event types: dial-state-change | streamer-live | big-win | jackpot-hit |
// operator-score-change | forum-heat-spike

const STREAMER_NAMES = [
  'Jarttu84', 'JugiPelaa', 'AndyPyro', 'OgumTV', 'pact', 'Ella',
  'Korpisoturi', 'Slotsband', 'monnirs', 'Lyijyleka', 'Huispaaja',
];
const GAMES = [
  'Sweet Bonanza 1000', 'Gates of Olympus', 'Big Bass Splash',
  'Money Train 4', 'Fire in the Hole 2', 'The Dog House Megaways',
  'Razor Returns', 'Sugar Rush', 'Wanted Dead or a Wild',
];
const OPERATORS = [
  'Weezybet', 'Norge Kasino', 'Tilttarkka', 'Cast Casino',
  'RapidPlay', 'Paf', 'KruunaBet',
];
const FORUM_TOPICS = [
  'Ylilauta /pelit/', 'Suomi24 Kasinot', 'Reddit r/finland',
  'Telegram-ryhmä', 'Twitter #slotit',
];
const STATES = ['KYLMÄ', 'HAALEA', 'KUUMA', 'MYRSKY', 'KIIRASTULI'];
const STATE_COLORS = {
  'KYLMÄ': '#2C5F8D', 'HAALEA': '#7A7E83', 'KUUMA': '#E8924A',
  'MYRSKY': '#C8423C', 'KIIRASTULI': '#8B1E1A',
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const formatEur = (n) => '€' + Math.round(n).toLocaleString('fi-FI').replace(/,/g, ' ');

const generateEvent = () => {
  const types = [
    'streamer-live', 'big-win', 'big-win', 'big-win',
    'jackpot-hit', 'forum-heat-spike', 'operator-score-change',
    'dial-state-change',
  ];
  const type = pick(types);
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ts = new Date();

  switch (type) {
    case 'streamer-live': {
      const name = pick(STREAMER_NAMES);
      return {
        id, type, ts,
        icon: 'live', color: '#C8423C',
        labelFi: 'STRIIMARI LIVENÄ',
        labelEn: 'STREAMER LIVE',
        primaryFi: `${name} aloitti striimin`,
        primaryEn: `${name} just went live`,
        secondaryFi: pick(GAMES),
        secondaryEn: pick(GAMES),
      };
    }
    case 'big-win': {
      const name = pick(STREAMER_NAMES);
      const game = pick(GAMES);
      const amt = formatEur(Math.random() * 28000 + 1200);
      return {
        id, type, ts,
        icon: 'win', color: '#E8924A',
        labelFi: 'ISO VOITTO',
        labelEn: 'BIG WIN',
        primaryFi: `${name} osui — ${amt}`,
        primaryEn: `${name} hit ${amt}`,
        secondaryFi: game,
        secondaryEn: game,
      };
    }
    case 'jackpot-hit': {
      const op = pick(OPERATORS);
      const amt = formatEur(Math.random() * 80000 + 12000);
      return {
        id, type, ts,
        icon: 'jackpot', color: '#8B1E1A',
        labelFi: 'JACKPOT',
        labelEn: 'JACKPOT',
        primaryFi: `${op} jakoi ${amt}`,
        primaryEn: `${op} paid out ${amt}`,
        secondaryFi: 'Sattui pelaajalle',
        secondaryEn: 'Random Finnish player',
      };
    }
    case 'operator-score-change': {
      const op = pick(OPERATORS);
      const dir = Math.random() > 0.45 ? '↑' : '↓';
      const delta = (Math.random() * 4 + 0.5).toFixed(1);
      return {
        id, type, ts,
        icon: 'score', color: dir === '↑' ? '#5A7BB8' : '#7A7E83',
        labelFi: 'MITTARI-PISTE',
        labelEn: 'MITTARI SCORE',
        primaryFi: `${op} ${dir}${delta}`,
        primaryEn: `${op} ${dir}${delta}`,
        secondaryFi: dir === '↑' ? 'Maksunopeus parani' : 'Asiakaspalvelu hidastui',
        secondaryEn: dir === '↑' ? 'Payout speed improved' : 'Support response slowed',
      };
    }
    case 'forum-heat-spike': {
      const f = pick(FORUM_TOPICS);
      const topic = pick(['Sweet Bonanza', 'Pact Kick', 'Andypyron klippi', 'Weezybet bonus', 'F1 Monza']);
      return {
        id, type, ts,
        icon: 'heat', color: '#E8924A',
        labelFi: 'FOORUMI KUUMENI',
        labelEn: 'FORUM HEAT',
        primaryFi: `${topic} nousi ${f}`,
        primaryEn: `${topic} trending on ${f}`,
        secondaryFi: `+${Math.round(Math.random() * 240 + 60)} viestiä 30 min`,
        secondaryEn: `+${Math.round(Math.random() * 240 + 60)} posts in 30 min`,
      };
    }
    case 'dial-state-change':
    default: {
      const from = pick(STATES);
      let to = pick(STATES);
      while (to === from) to = pick(STATES);
      return {
        id, type, ts,
        icon: 'dial', color: STATE_COLORS[to],
        labelFi: 'MITTARI MUUTTUI',
        labelEn: 'DIAL CHANGED',
        primaryFi: `${from} → ${to}`,
        primaryEn: `${from} → ${to}`,
        secondaryFi: 'Signaalit fuusioitu',
        secondaryEn: 'Signals fused',
      };
    }
  }
};

// Seed the feed with a few past events so the UI is never empty.
const seedFeed = () => {
  const arr = [];
  for (let i = 0; i < 6; i++) {
    const e = generateEvent();
    e.ts = new Date(Date.now() - (i * 60_000 + Math.random() * 90_000));
    arr.push(e);
  }
  return arr;
};

export const useActivityFeed = (max = 12) => {
  const [events, setEvents] = useState(seedFeed);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setEvents((prev) => [generateEvent(), ...prev].slice(0, max));
      const next = 8000 + Math.random() * 9000; // 8–17 s
      timer = setTimeout(tick, next);
    };
    let timer = setTimeout(tick, 4500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [max]);

  return events;
};

// ─────────────── Phase 2.6 — international scene activity feed ───────────────
// Same generator shape but pulls international streamer/game/operator names.
const INTL_STREAMER_NAMES = [
  'Roshtein', 'Trainwreckstv', 'Classybeef', 'CasinoDaddy', 'SweetFlips', 'NederGaming', 'Halper-nl',
];
const INTL_OPERATORS = ['Stake', 'Roobet', 'BC.Game', 'Toaster.bet', 'Rollbit', 'TonyBet'];
const INTL_FORUMS = ['Reddit r/onlinegambling', 'Twitter #slots', 'Discord global slots', 'Kick chat'];

const generateIntlEvent = () => {
  const types = ['streamer-live', 'big-win', 'big-win', 'jackpot-hit', 'forum-heat-spike'];
  const type = pick(types);
  const id = `intl-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ts = new Date();
  const fmt = (n) => '€' + Math.round(n).toLocaleString('en-US');

  switch (type) {
    case 'streamer-live': {
      const name = pick(INTL_STREAMER_NAMES);
      return { id, type, ts, icon: 'live', color: '#C8423C',
        labelFi: 'KANSAINVÄLINEN · LIVE', labelEn: 'INTERNATIONAL · LIVE',
        primaryFi: `${name} aloitti striimin`, primaryEn: `${name} just went live`,
        secondaryFi: pick(GAMES), secondaryEn: pick(GAMES) };
    }
    case 'big-win': {
      const name = pick(INTL_STREAMER_NAMES);
      const amt = fmt(Math.random() * 80000 + 4000);
      return { id, type, ts, icon: 'win', color: '#E8924A',
        labelFi: 'ISO VOITTO · GLOBAL', labelEn: 'BIG WIN · GLOBAL',
        primaryFi: `${name} osui — ${amt}`, primaryEn: `${name} hit ${amt}`,
        secondaryFi: pick(GAMES), secondaryEn: pick(GAMES) };
    }
    case 'jackpot-hit': {
      const op = pick(INTL_OPERATORS);
      const amt = fmt(Math.random() * 220000 + 40000);
      return { id, type, ts, icon: 'jackpot', color: '#8B1E1A',
        labelFi: 'JACKPOT · GLOBAL', labelEn: 'JACKPOT · GLOBAL',
        primaryFi: `${op} jakoi ${amt}`, primaryEn: `${op} paid out ${amt}`,
        secondaryFi: 'Sattui pelaajalle', secondaryEn: 'Random player' };
    }
    case 'forum-heat-spike':
    default: {
      const f = pick(INTL_FORUMS);
      const topic = pick(['Roshtein clip', 'Trainwreck stake', 'Classybeef marathon', 'Sweet Bonanza max', 'Stake giveaway']);
      return { id, type, ts, icon: 'heat', color: '#E8924A',
        labelFi: 'FOORUMI · GLOBAL', labelEn: 'FORUM · GLOBAL',
        primaryFi: `${topic} nousi ${f}`, primaryEn: `${topic} trending on ${f}`,
        secondaryFi: `+${Math.round(Math.random() * 600 + 120)} viestiä 30 min`, secondaryEn: `+${Math.round(Math.random() * 600 + 120)} posts in 30 min` };
    }
  }
};

const seedIntl = () => {
  const arr = [];
  for (let i = 0; i < 5; i++) {
    const e = generateIntlEvent();
    e.ts = new Date(Date.now() - (i * 90_000 + Math.random() * 60_000));
    arr.push(e);
  }
  return arr;
};

export const useIntlActivityFeed = (max = 9) => {
  const [events, setEvents] = useState(seedIntl);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setEvents((prev) => [generateIntlEvent(), ...prev].slice(0, max));
      timer = setTimeout(tick, 12000 + Math.random() * 18000);
    };
    let timer = setTimeout(tick, 6500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [max]);
  return events;
};

// ─────────────── Live counters (subscribers, watchers, forum heat) ───────────────

export const useLiveCounters = (initial = { subs: 4283, watchers: 217, heat: 64 }) => {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => {
      setV((prev) => ({
        subs: prev.subs + (Math.random() > 0.5 ? 1 : 0) + (Math.random() > 0.85 ? 1 : 0),
        watchers: Math.max(40, Math.min(640, prev.watchers + Math.round((Math.random() - 0.5) * 14))),
        heat: Math.max(8, Math.min(98, prev.heat + Math.round((Math.random() - 0.5) * 6))),
      }));
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return v;
};

// ─────────────── Signup toasts (Finnish names + cities) ───────────────

const FI_NAMES = [
  'Antti', 'Jukka', 'Sanna', 'Mikko', 'Kaisa', 'Eemeli', 'Veera', 'Janne',
  'Heikki', 'Lilja', 'Petri', 'Saara', 'Tuomas', 'Anni', 'Markus', 'Eveliina',
  'Otso', 'Ville', 'Henna', 'Ilkka',
];
const FI_CITIES = [
  'Helsinki', 'Tampere', 'Turku', 'Oulu', 'Espoo', 'Vantaa', 'Jyväskylä',
  'Lahti', 'Kuopio', 'Pori', 'Joensuu', 'Lappeenranta', 'Vaasa', 'Rovaniemi',
  'Hämeenlinna', 'Mikkeli',
];

export const useSignupToast = () => {
  const [toast, setToast] = useState(null);
  const dismissed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const show = () => {
      if (cancelled) return;
      if (dismissed.current) return; // user dismissed → pause for the session
      const name = pick(FI_NAMES);
      const city = pick(FI_CITIES);
      const id = `${Date.now()}-${Math.random()}`;
      setToast({ id, name, city, ts: new Date() });
      // Auto-hide after 7s, then schedule next.
      hideTimer = setTimeout(() => {
        if (!cancelled) setToast(null);
      }, 7000);
      nextTimer = setTimeout(show, 25000 + Math.random() * 35000);
    };
    let nextTimer = setTimeout(show, 12000);
    let hideTimer;
    return () => {
      cancelled = true;
      clearTimeout(nextTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const dismiss = () => {
    dismissed.current = true;
    setToast(null);
  };

  return { toast, dismiss };
};

// ─────────────── Push notification (dial spike) ───────────────

export const usePushNotification = () => {
  const [push, setPush] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      // Only fire if the dial would "spike" (random gate)
      if (Math.random() > 0.55) {
        const event = generateEvent();
        // Convert to a push-style payload
        setPush({
          id: event.id,
          title: event.labelFi,
          titleEn: event.labelEn,
          bodyFi: event.primaryFi,
          bodyEn: event.primaryEn,
          color: event.color,
        });
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => !cancelled && setPush(null), 6500);
      }
      timer = setTimeout(tick, 35000 + Math.random() * 25000);
    };
    let timer = setTimeout(tick, 22000);
    let hideTimer;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  const dismiss = () => setPush(null);
  return { push, dismiss };
};

// ─────────────── Dial history (24h sparkline) ───────────────

export const generateDialHistory = (currentValue = 64, points = 48) => {
  // Walk backward from current value with bounded random walk in [0,100]
  const arr = [currentValue];
  for (let i = 1; i < points; i++) {
    const prev = arr[arr.length - 1];
    const drift = (Math.random() - 0.5) * 10;
    arr.push(Math.max(4, Math.min(99, prev + drift)));
  }
  return arr.reverse();
};

// ─────────────── Helpers ───────────────

export const timeAgo = (ts, lang = 'fi') => {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 5)  return lang === 'en' ? 'just now' : 'juuri nyt';
  if (diff < 60) return lang === 'en' ? `${diff}s ago` : `${diff}s sitten`;
  const m = Math.floor(diff / 60);
  if (m < 60)    return lang === 'en' ? `${m}m ago` : `${m}min sitten`;
  const h = Math.floor(m / 60);
  return lang === 'en' ? `${h}h ago` : `${h}h sitten`;
};
