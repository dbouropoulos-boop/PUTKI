/**
 * WeeklyCard - "Viikon kortti": 5 real fixtures + gamified prize entry.
 *
 * Pulls /api/odds/featured for fixtures, /api/weekly/meta for the configurable
 * prize, /api/weekly/leaderboard for entry count + (settled) ranking. Submits
 * to /api/weekly/submit. Fully bilingual.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Trophy, Sparkles, Send, Link as LinkIcon, Check } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { formatKickoff, formatShortDate } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const PrizeBanner = ({ meta, lang, t }) => {
  if (!meta) return null;
  const cur = meta.prize_currency === 'EUR' ? '€' : meta.prize_currency;
  return (
    <div
      data-testid="weekly-prize-banner"
      className="panel mb-8 sm:mb-10 px-6 sm:px-7 py-6 flex items-center justify-between gap-5 flex-wrap"
      style={{
        background: 'linear-gradient(135deg, #0A0A0A 0%, #232020 100%)',
        color: '#F5F3EE',
        border: '1px solid rgba(232,146,74,0.35)',
        borderRadius: 4,
      }}
    >
      <div className="flex items-center gap-4">
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 52, height: 52, borderRadius: 2, background: 'rgba(232,146,74,0.16)', color: '#E8924A' }}
        >
          <Trophy strokeWidth={1.7} size={26} />
        </span>
        <div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
            {t('weekly.prize_label').toUpperCase()}
          </div>
          <div className="display" style={{ fontSize: 32, fontWeight: 800, color: '#F5F3EE', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>
            {cur}{Number(meta.prize_amount || 0).toLocaleString(lang === 'en' ? 'en-US' : 'fi-FI').replace(/,/g, lang === 'en' ? ',' : ' ')}
          </div>
          <div className="font-serif" style={{ fontSize: 13.5, color: 'rgba(245,243,238,0.7)', marginTop: 6 }}>
            {meta.prize_label}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,243,238,0.55)', fontWeight: 700 }}>
          {t('weekly.prize_won').toUpperCase()}
        </div>
        <div className="mono mt-2" style={{ fontSize: 12, letterSpacing: '0.14em', color: '#F5F3EE', fontWeight: 600 }}>
          {t('weekly.entries_count', { n: meta.entry_count ?? 0 }).toUpperCase()}
        </div>
      </div>
    </div>
  );
};

const EntryForm = ({ predictions, picks, meta, lang, t, onSubmit }) => {
  const [email, setEmail]     = useState('');
  const [channel, setChannel] = useState('telegram');
  const [handle, setHandle]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [ok, setOk]           = useState(false);
  const [success, setSuccess] = useState(null);  // { invite_code, tickets, invite_count }
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied]   = useState(false);

  // Sniff ?invite=CODE from the URL so referred users auto-fill the field.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const c = (sp.get('invite') || sp.get('ref') || '').toUpperCase().trim();
      if (c && /^[A-Z0-9]{6,12}$/.test(c)) setInviteCode(c);
    } catch (e) { console.warn('[weekly] invite-code parse failed', e); }
  }, []);

  const ready = picks.length > 0 && Object.keys(predictions).length === picks.length;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!ready) { setError(t('weekly.entry_pick_required')); return; }
    setBusy(true);
    try {
      const payload = {
        email: email.trim(),
        channel,
        handle: handle.trim(),
        picks: Object.entries(predictions).map(([event_id, pick]) => ({ event_id, pick })),
      };
      if (inviteCode) payload.invite_code = inviteCode;
      const r = await fetch(`${BACKEND}/api/weekly/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setOk(true);
      setSuccess(d);
      onSubmit?.();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const inviteUrl = success?.invite_code
    ? `${window.location.origin}/viikon-kortti?invite=${success.invite_code}`
    : '';

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { console.warn('[weekly] clipboard copy failed', e); }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PUTKI HQ - Weekly Card',
          text: t('weekly.invite_help'),
          url: inviteUrl,
        });
      } catch (e) { console.warn('[weekly] navigator.share failed', e); }
    } else {
      copyInvite();
    }
  };

  if (meta?.locked) {
    return (
      <div className="panel p-6 mono text-center"
           data-testid="weekly-locked-notice"
           style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--muted)' }}>
        {t('weekly.locked_notice')}
      </div>
    );
  }

  if (ok && success) {
    return (
      <div className="space-y-4" data-testid="weekly-entry-success">
        <div className="panel p-6" style={{ background: '#0A0A0A', color: '#F5F3EE', borderRadius: 4 }}>
          <div className="mono mb-2 inline-flex items-center gap-2"
               style={{ fontSize: 10, letterSpacing: '0.22em', color: '#2c7a4b', fontWeight: 700 }}>
            <Sparkles strokeWidth={1.9} size={12} />
            ✓ {t('weekly.submit_entry').toUpperCase()}
          </div>
          <p className="font-serif mb-4" style={{ fontSize: 14.5, color: '#F5F3EE', lineHeight: 1.5 }}>
            {t('weekly.submit_success')}
          </p>
          <div className="mono inline-flex items-center gap-2 mb-4"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: '#E8924A', fontWeight: 700 }}>
            🎟 {t('weekly.tickets', { n: success.tickets }).toUpperCase()}
            {success.invite_count > 0 && <span style={{ color: 'rgba(245,243,238,0.6)' }}>· {success.invite_count} kpl</span>}
          </div>
          <button
            type="button"
            onClick={() => { setOk(false); setSuccess(null); }}
            data-testid="weekly-entry-edit"
            className="mono"
            style={{
              padding: '8px 14px', fontSize: 10, letterSpacing: '0.22em', fontWeight: 700,
              background: 'transparent', color: '#F5F3EE',
              border: '1px solid rgba(245,243,238,0.3)', borderRadius: 2, cursor: 'pointer',
            }}
          >
            {t('weekly.submit_again').toUpperCase()}
          </button>
        </div>

        {/* Invite share card - viral loop */}
        <div className="panel p-5"
             data-testid="weekly-invite-card"
             style={{
               background: 'linear-gradient(135deg, #fff 0%, #fffaf3 100%)',
               border: '1px solid rgba(232,146,74,0.4)',
               borderRadius: 4,
             }}>
          <div className="eyebrow mb-2 inline-flex items-center gap-2"
               style={{ color: '#E8924A' }}>
            🎟 {t('weekly.invite_eyebrow').toUpperCase()}
          </div>
          <p className="font-serif mb-4" style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            {t('weekly.invite_help')}
          </p>
          <div className="mono mb-2" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
            {t('weekly.invite_label').toUpperCase()}
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              data-testid="weekly-invite-url"
              className="mono"
              style={{
                flex: 1, minWidth: 200, padding: '10px 12px', fontSize: 12,
                background: 'var(--bg)', border: '1px solid var(--border-strong)',
                color: 'var(--ink)', borderRadius: 2, outline: 'none',
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={copyInvite}
              data-testid="weekly-invite-copy"
              className="mono inline-flex items-center gap-1"
              style={{
                padding: '10px 14px', fontSize: 11, letterSpacing: '0.18em', fontWeight: 700,
                background: copied ? '#2c7a4b' : 'var(--ink)', color: copied ? '#fff' : 'var(--bg)',
                border: 'none', borderRadius: 2, cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} /> : <LinkIcon size={11} />}
              {(copied ? t('weekly.invite_copied') : t('weekly.invite_copy')).toUpperCase()}
            </button>
          </div>
          <button
            type="button"
            onClick={shareInvite}
            data-testid="weekly-invite-share"
            className="mono w-full inline-flex items-center justify-center gap-2"
            style={{
              padding: '11px 14px', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700,
              background: '#E8924A', color: '#0A0A0A',
              border: 'none', borderRadius: 2, cursor: 'pointer',
            }}
          >
            <Send strokeWidth={1.9} size={12} />
            {t('weekly.invite_share').toUpperCase()} →
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      data-testid="weekly-entry-form"
      className="panel p-6 sm:p-7 space-y-5"
      style={{ background: 'var(--surface)', borderRadius: 4 }}
    >
      <div>
        <div className="eyebrow mb-2 inline-flex items-center gap-2">
          <Trophy strokeWidth={1.7} size={12} />
          {t('weekly.submit_entry').toUpperCase()}
        </div>
        <p className="font-serif" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          {t('weekly.entry_disclaimer')}
        </p>
      </div>

      <label className="block">
        <span className="mono mb-1.5 block" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {t('weekly.entry_email').toUpperCase()} *
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('weekly.entry_email_ph')}
          data-testid="weekly-entry-email"
          className="font-serif"
          style={{
            width: '100%', padding: '11px 13px', fontSize: 14,
            background: 'var(--bg)', border: '1px solid var(--border-strong)',
            color: 'var(--ink)', borderRadius: 2, outline: 'none',
          }}
        />
      </label>

      <div>
        <span className="mono mb-2 block" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {t('weekly.entry_channel').toUpperCase()} *
        </span>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {['telegram', 'sms'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setChannel(opt); setHandle(''); }}
              data-testid={`weekly-entry-channel-${opt}`}
              className="mono"
              style={{
                padding: '11px 13px', fontSize: 11, letterSpacing: '0.18em', fontWeight: 700,
                background: channel === opt ? 'var(--ink)' : 'var(--bg)',
                color: channel === opt ? 'var(--bg)' : 'var(--ink)',
                border: '1px solid var(--border-strong)', cursor: 'pointer', borderRadius: 2,
              }}
            >
              {channel === opt ? '● ' : '○ '}
              {opt === 'telegram' ? t('weekly.entry_channel_tg') : t('weekly.entry_channel_sms')}
            </button>
          ))}
        </div>
        <input
          type={channel === 'sms' ? 'tel' : 'text'}
          required
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={channel === 'sms' ? t('weekly.entry_phone_ph') : t('weekly.entry_tg_ph')}
          data-testid="weekly-entry-handle"
          className="font-serif"
          style={{
            width: '100%', padding: '11px 13px', fontSize: 14,
            background: 'var(--bg)', border: '1px solid var(--border-strong)',
            color: 'var(--ink)', borderRadius: 2, outline: 'none',
          }}
        />
      </div>

      <details data-testid="weekly-invite-details" style={{ cursor: 'pointer' }}>
        <summary className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
          {t('weekly.have_invite').toUpperCase()}
        </summary>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder={t('weekly.invite_placeholder')}
          data-testid="weekly-invite-input"
          className="mono mt-2"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 12, letterSpacing: '0.18em',
            background: 'var(--bg)', border: '1px solid var(--border-strong)',
            color: 'var(--ink)', borderRadius: 2, outline: 'none',
          }}
        />
      </details>

      {error && (
        <div className="mono" data-testid="weekly-entry-error"
             style={{ fontSize: 11, letterSpacing: '0.12em', color: '#C8423C' }}>
          ⚠ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !ready}
        data-testid="weekly-entry-submit"
        className="mono inline-flex items-center gap-2"
        style={{
          padding: '13px 22px', fontSize: 12, letterSpacing: '0.22em', fontWeight: 700,
          background: ready ? '#E8924A' : 'var(--border-strong)',
          color: '#0A0A0A', border: 'none',
          cursor: busy || !ready ? 'default' : 'pointer', borderRadius: 2,
        }}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Trophy strokeWidth={1.9} size={12} />}
        {t('weekly.submit_entry').toUpperCase()} →
      </button>
    </form>
  );
};

const Leaderboard = ({ board, lang, t }) => {
  if (!board) return null;
  if (board.winner) {
    return (
      <div className="panel p-6" data-testid="weekly-winner-card"
           style={{ background: '#0A0A0A', color: '#F5F3EE', borderRadius: 4 }}>
        <div className="eyebrow mb-2 inline-flex items-center gap-2" style={{ color: '#E8924A' }}>
          <Trophy strokeWidth={1.7} size={12} />
          {t('weekly.winner_eyebrow').toUpperCase()}
        </div>
        <p className="display" style={{ fontSize: 22, fontWeight: 700, color: '#F5F3EE', lineHeight: 1.2 }}>
          🏆 …{board.winner.email_hash}
        </p>
        <p className="font-serif mt-2" style={{ fontSize: 13, color: 'rgba(245,243,238,0.7)' }}>
          {t('weekly.winner_drawn', { n: board.winner.correct_count })}
        </p>
      </div>
    );
  }
  if (!board.settled) {
    return (
      <div
        className="panel p-7 text-center mono"
        data-testid="weekly-leaderboard-unsettled"
        style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 600 }}
      >
        {t('weekly.leader_unsettled').toUpperCase()}
      </div>
    );
  }
  return (
    <ul className="panel divide-y" data-testid="weekly-leaderboard-list"
        style={{ background: 'var(--bg)' }}>
      {board.rows.map((r, i) => (
        <li key={r.email_hash + i} className="flex items-center justify-between px-5 py-3">
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 600 }}>
            #{String(i + 1).padStart(2, '0')} · …{r.email_hash}
          </span>
          <span className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink)', fontWeight: 700 }}>
            {t('weekly.leader_correct', { n: r.correct_count })}
          </span>
        </li>
      ))}
    </ul>
  );
};

const WeeklyCard = () => {
  const { lang, t } = useLang();
  const [picks, setPicks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [predictions, setPredictions] = useState({});
  const [meta, setMeta]       = useState(null);
  const [board, setBoard]     = useState(null);
  const [submittedAt, setSubmittedAt] = useState(0);

  useEffect(() => {
    fetch(`${BACKEND}/api/odds/featured`)
      .then((r) => r.json())
      .then((d) => { setPicks(d.picks || []); setLoading(false); })
      .catch((e) => { setError(String(e.message || e)); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch(`${BACKEND}/api/weekly/meta`).then((r) => r.json()).then(setMeta).catch(() => {});
    fetch(`${BACKEND}/api/weekly/leaderboard`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [submittedAt]);

  const updatePrediction = (id, val) => setPredictions((prev) => ({ ...prev, [id]: val }));

  const editorialTake = (pick) => {
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
    return t('weekly.take_template', {
      team: pick.pick_team,
      strength: t(strengthKey),
      count: pick.bookmaker_count,
      odds: pick.decimal_odds.toFixed(2),
      side: t(sideKey),
      pct,
    });
  };

  const wkLabel = meta?.week_key ? meta.week_key.split('-W')[1] : '';

  return (
    <div data-testid="weekly-card-page">
      <section className="container-wide pt-12 sm:pt-20 pb-6 sm:pb-8">
        <div className="max-w-3xl">
          <div className="eyebrow mb-4 flex items-center gap-2">
            <Calendar strokeWidth={1.5} size={14} />
            {t('weekly.eyebrow_now', { date: formatShortDate(new Date(), lang) }).toUpperCase()}
          </div>
          <h1 className="display text-4xl sm:text-6xl lg:text-7xl mb-5">{t('weekly.title')}</h1>
          <p className="prose-mittari text-muted-text max-w-2xl">
            {t('weekly.lede_real')}
          </p>
        </div>
      </section>

      <section className="container-wide pb-12 sm:pb-16">
        <PrizeBanner meta={meta} lang={lang} t={t} />

        {/* How-it-works · 4 numbered steps. Gamified, scannable, prize prominent above. */}
        <div className="panel mb-8 sm:mb-10 p-6 sm:p-7" style={{ background: 'var(--bg)' }} data-testid="weekly-how-it-works">
          <div className="eyebrow mb-4 inline-flex items-center gap-2" style={{ color: '#E8924A' }}>
            <Sparkles strokeWidth={1.6} size={12} />
            {t('weekly.how_it_works').toUpperCase()}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex gap-3" data-testid={`weekly-step-${n}`}>
                <span
                  className="mono flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 30, height: 30, borderRadius: 999,
                    background: '#E8924A', color: '#0A0A0A',
                    fontSize: 13, fontWeight: 800,
                  }}
                >
                  {n}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="display" style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25 }}>
                    {t(`weekly.step_${n}_title`)}
                  </div>
                  <div className="font-serif mt-1.5" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {t(`weekly.step_${n}_body`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mono mt-5 pt-4" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600, borderTop: '1px solid var(--border)' }}>
            {t('weekly.scoring_rule').toUpperCase()}
          </div>
        </div>

        {loading ? (
          <div className="panel p-7 text-center mono inline-flex items-center justify-center gap-2 w-full"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="weekly-card-loading">
            <Loader2 size={12} className="animate-spin" />
            {t('weekly.loading').toUpperCase()}
          </div>
        ) : error ? (
          <div className="panel p-7 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: '#C8423C' }}
               data-testid="weekly-card-error">
            {t('weekly.error').toUpperCase()} · {error}
          </div>
        ) : picks.length === 0 ? (
          <div className="panel p-7 text-center mono"
               style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}
               data-testid="weekly-card-empty">
            {t('weekly.empty').toUpperCase()}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-8 space-y-8" data-testid="weekly-fixtures-col">
              {picks.map((p, i) => {
                const opp = p.pick_side === 'home' ? p.away_team : p.home_team;
                const id = p.event_id || `idx-${i}`;
                return (
                  <article
                    key={id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-5 pt-7"
                    style={{ borderTop: '1px solid var(--ink)' }}
                    data-testid={`weekly-fixture-${i}`}
                  >
                    <div className="sm:col-span-1">
                      <div className="font-display text-2xl font-black tabular text-ink">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                    </div>

                    <div className="sm:col-span-7">
                      <div className="eyebrow mb-2">
                        {(p.sport_label || '').toUpperCase()} · {formatKickoff(p.commence_time, lang)}
                      </div>
                      <h2 className="display text-2xl sm:text-3xl mb-3">
                        {p.pick_side === 'home' ? p.home_team : opp}{' '}
                        <span className="text-muted-text">-</span>{' '}
                        {p.pick_side === 'home' ? opp : p.home_team}
                      </h2>
                      <p className="font-serif text-[14.5px] text-ink leading-relaxed">
                        {editorialTake(p)}
                      </p>
                      <p className="mt-3 font-display text-[10.5px] uppercase tracking-widest text-muted-text">
                        {t('weekly.byline')} · {p.bookmaker} · {t('weekly.odds_label')} {p.decimal_odds.toFixed(2)}
                      </p>
                    </div>

                    <div className="sm:col-span-4">
                      <div className="eyebrow mb-2">{t('weekly.pick_outcome')}</div>
                      <div className="flex gap-2">
                        {[
                          { key: '1', label: '1' },
                          { key: 'X', label: 'X' },
                          { key: '2', label: '2' },
                        ].map((opt) => {
                          const selected = predictions[id] === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => updatePrediction(id, opt.key)}
                              data-testid={`weekly-predict-${i}-${opt.key}`}
                              className="flex-1 py-3 rounded-[3px] font-display font-bold tabular border transition-colors"
                              style={{
                                background: selected ? 'var(--ink)' : 'var(--bg)',
                                color: selected ? 'var(--bg)' : 'var(--ink)',
                                borderColor: selected ? 'var(--ink)' : 'var(--border-strong)',
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="lg:col-span-4 space-y-6" data-testid="weekly-entry-col">
              <EntryForm
                predictions={predictions}
                picks={picks}
                meta={meta}
                lang={lang}
                t={t}
                onSubmit={() => setSubmittedAt(Date.now())}
              />
            </aside>
          </div>
        )}
      </section>

      <section className="py-12 sm:py-16" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container-wide grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">
              {t('weekly.leader_eyebrow', { wk: wkLabel }).toUpperCase()}
            </div>
            <h2 className="display text-3xl sm:text-4xl mb-4">{t('weekly.points_prizes')}</h2>
            <p className="font-serif text-[15px] text-muted-text leading-relaxed">
              {t('weekly.points_blurb')}
            </p>
          </div>
          <div className="lg:col-span-7">
            <Leaderboard board={board} lang={lang} t={t} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeeklyCard;
