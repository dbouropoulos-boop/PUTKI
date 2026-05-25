/**
 * BettingTipsHub - public `/vihjeet` page.
 *
 * Daily tabs (Today / Tomorrow / This week) + 7-day calendar strip.
 * Every pick card renders five social-share buttons (Telegram, X,
 * Facebook, WhatsApp, Instagram) so the editorial picks become a
 * distribution surface, not a dead-end.
 */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Calendar, Loader2, Send, Twitter, Facebook, MessageCircle, Instagram, Link as LinkIcon, Check, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { useLang } from '../context/LanguageContext';
import { formatKickoff } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PUBLIC_SITE = (typeof window !== 'undefined' && window.location?.origin) || '';

const isoOf = (d) => d.toISOString().slice(0, 10);

const dayLabel = (iso, lang) => {
  try {
    const dt = new Date(`${iso}T12:00:00`);
    const locale = lang === 'en' ? 'en-GB' : 'fi-FI';
    return dt.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
};

const ShareButtons = ({ pick, lang, t }) => {
  const [copied, setCopied] = useState(false);

  const caption = t('tips.share_caption', {
    team: pick.pick_team,
    odds: pick.decimal_odds.toFixed(2),
    pct: Math.round(pick.implied_probability),
  });
  const url = `${PUBLIC_SITE}/vihjeet?ref=share&pick=${encodeURIComponent(pick.event_id || pick.pick_team)}`;
  const enc = (s) => encodeURIComponent(s);
  const full = `${caption} ${url}`;

  const links = [
    { key: 'telegram',  icon: Send,           label: t('tips.share_telegram'),  href: `https://t.me/share/url?url=${enc(url)}&text=${enc(caption)}` },
    { key: 'x',         icon: Twitter,        label: t('tips.share_x'),         href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(caption)}` },
    { key: 'facebook',  icon: Facebook,       label: t('tips.share_facebook'),  href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(caption)}` },
    { key: 'whatsapp',  icon: MessageCircle,  label: t('tips.share_whatsapp'),  href: `https://api.whatsapp.com/send?text=${enc(full)}` },
  ];

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const onInstagram = async () => {
    // Instagram has no web-share intent - copy caption and surface a hint.
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  };

  return (
    <div className="flex items-center flex-wrap gap-2" data-testid={`tips-share-${pick.event_id || pick.pick_team}`}>
      <span className="mono mr-1" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
        {t('tips.share').toUpperCase()}
      </span>
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <a
            key={l.key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`tips-share-${l.key}-${pick.event_id || pick.pick_team}`}
            aria-label={l.label}
            className="flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: 'var(--bg)', border: '1px solid var(--border-strong)',
              color: 'var(--ink)', textDecoration: 'none', transition: 'transform 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <Icon strokeWidth={1.6} size={14} />
          </a>
        );
      })}
      <button
        type="button"
        onClick={onInstagram}
        data-testid={`tips-share-instagram-${pick.event_id || pick.pick_team}`}
        aria-label={t('tips.share_instagram')}
        className="flex items-center justify-center"
        style={{
          width: 32, height: 32, borderRadius: 999,
          background: 'var(--bg)', border: '1px solid var(--border-strong)',
          color: 'var(--ink)', cursor: 'pointer',
        }}
      >
        <Instagram strokeWidth={1.6} size={14} />
      </button>
      <button
        type="button"
        onClick={onCopy}
        data-testid={`tips-share-copy-${pick.event_id || pick.pick_team}`}
        aria-label={t('tips.share_copy')}
        className="mono inline-flex items-center gap-1"
        style={{
          padding: '7px 11px', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700,
          background: copied ? '#2c7a4b' : 'var(--bg)', color: copied ? '#fff' : 'var(--ink)',
          border: '1px solid ' + (copied ? '#2c7a4b' : 'var(--border-strong)'),
          borderRadius: 2, cursor: 'pointer',
        }}
      >
        {copied ? <Check size={11} /> : <LinkIcon size={11} />}
        {(copied ? t('tips.copied') : t('tips.share_copy')).toUpperCase()}
      </button>
    </div>
  );
};

const PickCard = ({ pick, lang, t }) => {
  const opp = pick.pick_side === 'home' ? pick.away_team : pick.home_team;
  const pct = Math.round(pick.implied_probability);
  const sideKey =
    pick.pick_side === 'home' ? 'weekly.side_home'
    : pick.pick_side === 'away' ? 'weekly.side_away'
    : 'weekly.side_draw';
  const strengthKey =
    pct >= 80 ? 'weekly.strength_iron'
    : pct >= 65 ? 'weekly.strength_clear'
    : pct >= 55 ? 'weekly.strength_slight'
    : 'weekly.strength_even';
  const take = t('weekly.take_template', {
    team: pick.pick_team,
    strength: t(strengthKey),
    count: pick.bookmaker_count,
    odds: pick.decimal_odds.toFixed(2),
    side: t(sideKey),
    pct,
  });
  return (
    <article
      data-testid={`tips-pick-${pick.event_id || pick.pick_team}`}
      className="panel p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5"
      style={{ background: 'var(--bg)', borderRadius: 4 }}
    >
      <div className="lg:col-span-7">
        <div className="eyebrow mb-2">
          {(pick.sport_label || '').toUpperCase()} · {formatKickoff(pick.commence_time, lang)}
        </div>
        <h3 className="display mb-2" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' }}>
          {pick.pick_team} <span style={{ color: 'var(--muted)' }}>vs</span> {opp}
        </h3>
        <div className="mono mb-3 inline-flex items-center gap-2"
             style={{ fontSize: 10, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
          {t('tips.editorial_take').toUpperCase()}
        </div>
        <p className="font-serif" style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.55 }}>
          {take}
        </p>
      </div>
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="border rounded-[3px] p-3 text-center"
               style={{ borderColor: 'var(--border-strong)' }}>
            <div className="eyebrow text-[10px] mb-1">{t('weekly.odds_label').toUpperCase()}</div>
            <div className="font-display text-base font-bold tabular text-ink">
              {pick.decimal_odds.toFixed(2)}
            </div>
          </div>
          <div className="border rounded-[3px] p-3 text-center"
               style={{ borderColor: 'var(--border-strong)' }}>
            <div className="eyebrow text-[10px] mb-1">{t('weekly.prob_short')}</div>
            <div className="font-display text-base font-bold tabular text-ink">
              {pct}%
            </div>
          </div>
        </div>
        <ShareButtons pick={pick} lang={lang} t={t} />
      </div>
    </article>
  );
};

const Calendar7Day = ({ days, activeIso, onPick, lang, t }) => {
  // Build a 7-day array; some days may have no picks (still show as empty).
  const today = new Date();
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = isoOf(d);
    const dayObj = days.find((x) => x.date === iso);
    cells.push({
      iso,
      label: dayLabel(iso, lang),
      count: (dayObj?.picks || []).length,
    });
  }
  return (
    <div className="overflow-x-auto" data-testid="tips-calendar">
      <div className="eyebrow mb-3">{t('tips.cal_eyebrow').toUpperCase()}</div>
      <div className="flex gap-2 min-w-fit pb-2">
        {cells.map((c) => {
          const active = c.iso === activeIso;
          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => onPick(c.iso)}
              data-testid={`tips-calendar-day-${c.iso}`}
              className="text-left"
              style={{
                minWidth: 130, padding: 14,
                background: active ? 'var(--ink)' : 'var(--bg)',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'),
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', opacity: 0.7, fontWeight: 700 }}>
                {c.label.toUpperCase()}
              </div>
              <div className="display mt-1" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                {c.count > 0 ? c.count : '-'}
              </div>
              <div className="mono mt-1" style={{ fontSize: 9.5, letterSpacing: '0.18em', opacity: 0.7 }}>
                {c.count > 0
                  ? t('tips.cal_picks', { n: c.count }).toUpperCase()
                  : t('tips.cal_empty').toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TIPS_TELEGRAM_HANDLE = 'putkihq_vinkit';
const TIPS_TELEGRAM_URL = `https://t.me/${TIPS_TELEGRAM_HANDLE}`;
const MODAL_DISMISSED_KEY = 'putki-tips-modal-dismissed';

const TelegramConversionModal = ({ lang, t, viewedPicks }) => {
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(MODAL_DISMISSED_KEY) === '1'; } catch {}
    if (dismissed) return;
    if (viewedPicks >= 3 && !open) {
      setOpen(true);
      fetch(`${BACKEND}/api/signup/count`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setSubs(d?.count ?? null))
        .catch(() => {});
    }
  }, [viewedPicks, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(MODAL_DISMISSED_KEY, '1'); } catch { /* noop: storage unavailable */ }
  };

  if (!open) return null;

  return (
    <div
      data-testid="tips-telegram-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 4, maxWidth: 480, width: '100%' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="mono inline-flex items-center gap-2" style={{ fontSize: 10, letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)' }}>
            <Send strokeWidth={1.9} size={12} />
            {t('tips.modal_eyebrow').toUpperCase()}
          </div>
          <button type="button" onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', opacity: 0.7 }} data-testid="tips-telegram-modal-close">
            <X strokeWidth={1.6} size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <h3 className="display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>{t('tips.modal_title')}</h3>
          <p className="font-serif" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{t('tips.modal_body')}</p>
          <ul className="space-y-2" style={{ fontSize: 13.5, color: 'var(--ink)' }}>
            {['tips.modal_b1', 'tips.modal_b2', 'tips.modal_b3', 'tips.modal_b4'].map((k) => (
              <li key={k} className="flex items-start gap-2 font-serif">
                <CheckCircle2 strokeWidth={1.7} size={14} style={{ color: '#2c7a4b', marginTop: 3, flexShrink: 0 }} />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <a
            href={TIPS_TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="tips-telegram-cta"
            className="mono w-full inline-flex items-center justify-center gap-2"
            style={{
              padding: '14px 18px', fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
              background: '#229ED9', color: '#FFFFFF', textDecoration: 'none', borderRadius: 2,
            }}
          >
            <Send strokeWidth={1.9} size={13} />
            {t('tips.modal_cta_telegram').toUpperCase()}
            {subs != null && <span style={{ opacity: 0.85 }}>· {subs}</span>}
          </a>
          <button
            type="button"
            disabled
            data-testid="tips-whatsapp-cta"
            className="mono w-full inline-flex items-center justify-center gap-2"
            style={{
              padding: '12px 18px', fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
              background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border-strong)', borderRadius: 2, cursor: 'not-allowed', opacity: 0.7,
            }}
          >
            <MessageCircle strokeWidth={1.9} size={13} />
            {t('tips.modal_cta_whatsapp').toUpperCase()}
          </button>
          <button type="button" onClick={close} className="mono w-full text-center" data-testid="tips-modal-skip" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {t('tips.modal_skip').toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

const BettingTipsHub = () => {
  const { lang, t } = useLang();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'tomorrow' | 'week'
  const [calendarIso, setCalendarIso] = useState(null);
  const [viewedPicksCount, setViewedPicksCount] = useState(0);
  const seenPicks = useRef(new Set());

  useDocumentMeta({
    title: lang === 'en' ? 'Tips · PUTKI HQ' : 'Vinkit · PUTKI HQ',
    description: lang === 'en'
      ? 'Real betting tips for the next 7 days - shareable to Telegram, X, Facebook, WhatsApp, Instagram.'
      : 'Aitoja vedonlyöntivinkkejä seuraavalle 7 päivälle - jaettavissa Telegramiin, X:ään, Facebookiin, WhatsAppiin ja Instagramiin.',
    canonical: `${BACKEND}/vihjeet`,
  });

  useEffect(() => {
    fetch(`${BACKEND}/api/odds/upcoming?days=7&top_per_day=5`)
      .then((r) => r.json())
      .then((d) => { setDays(d.days || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const todayIso    = isoOf(new Date());
  const tomorrowIso = isoOf(new Date(Date.now() + 86400e3));

  const activePicks = useMemo(() => {
    if (activeTab === 'week') return days.flatMap((d) => d.picks || []);
    if (activeTab === 'today') {
      const iso = calendarIso || todayIso;
      return (days.find((d) => d.date === iso)?.picks) || [];
    }
    if (activeTab === 'tomorrow') {
      return (days.find((d) => d.date === tomorrowIso)?.picks) || [];
    }
    return [];
  }, [days, activeTab, calendarIso, todayIso, tomorrowIso]);

  // Track unique picks the user has scrolled through - drives the
  // Telegram conversion modal threshold (opens after 3 unique picks).
  useEffect(() => {
    let changed = false;
    activePicks.forEach((p) => {
      const key = p.event_id || `${p.pick_team}-${p.commence_time}`;
      if (key && !seenPicks.current.has(key)) {
        seenPicks.current.add(key);
        changed = true;
      }
    });
    if (changed) setViewedPicksCount(seenPicks.current.size);
  }, [activePicks]);

  return (
    <div data-testid="betting-tips-page">
      <TelegramConversionModal lang={lang} t={t} viewedPicks={viewedPicksCount} />
      <section className="container-wide pt-12 sm:pt-20 pb-8 sm:pb-10">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 inline-flex items-center gap-2">
            <Calendar strokeWidth={1.5} size={13} />
            {t('tips.eyebrow').toUpperCase()}
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-5">{t('tips.title')}</h1>
          <p className="prose-mittari max-w-2xl">{t('tips.lede')}</p>
        </div>
        <div
          data-testid="tips-editorial-disclaimer"
          className="panel mt-7 px-5 py-4 inline-flex items-start gap-3"
          style={{ background: 'rgba(232,146,74,0.08)', border: '1px solid rgba(232,146,74,0.35)', maxWidth: 760, borderRadius: 4 }}
        >
          <AlertCircle strokeWidth={1.8} size={18} style={{ color: '#E8924A', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="mono mb-1" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
              {t('tips.disclaimer_eyebrow').toUpperCase()}
            </div>
            <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>
              {t('tips.disclaimer_body')}
            </p>
          </div>
        </div>
      </section>

      <section className="container-wide pb-10 sm:pb-14">
        <div className="flex items-center gap-2 mb-7 flex-wrap" data-testid="tips-tabs">
          {[
            { key: 'today',    label: t('tips.tab_today') },
            { key: 'tomorrow', label: t('tips.tab_tomorrow') },
            { key: 'week',     label: t('tips.tab_week') },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setCalendarIso(null); }}
              data-testid={`tips-tab-${tab.key}`}
              className="mono"
              style={{
                padding: '10px 16px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
                background: activeTab === tab.key ? 'var(--ink)' : 'var(--bg)',
                color: activeTab === tab.key ? 'var(--bg)' : 'var(--ink)',
                border: '1px solid var(--border-strong)', cursor: 'pointer', borderRadius: 2,
              }}
            >
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        <Calendar7Day
          days={days}
          activeIso={calendarIso || (activeTab === 'tomorrow' ? tomorrowIso : todayIso)}
          onPick={(iso) => { setCalendarIso(iso); setActiveTab(iso === tomorrowIso ? 'tomorrow' : 'today'); }}
          lang={lang}
          t={t}
        />

        <div className="mt-8 space-y-5" data-testid="tips-picks-list">
          {loading ? (
            <div className="panel p-7 text-center mono inline-flex items-center justify-center gap-2 w-full"
                 style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}>
              <Loader2 size={12} className="animate-spin" />
              {t('weekly.loading').toUpperCase()}
            </div>
          ) : activePicks.length === 0 ? (
            <div className="panel p-7 text-center mono"
                 style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)' }}
                 data-testid="tips-picks-empty">
              {t('tips.empty_day').toUpperCase()}
            </div>
          ) : (
            activePicks.map((p) => <PickCard key={p.event_id || `${p.pick_team}-${p.commence_time}`} pick={p} lang={lang} t={t} />)
          )}
        </div>
      </section>
    </div>
  );
};

export default BettingTipsHub;
