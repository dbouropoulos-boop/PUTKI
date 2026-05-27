/**
 * /back-office/funnel - Historical conversion ladder (iter76e).
 *
 * Same 5 stages as the live snapshot on /back-office/bot-routing, but
 * plotted day-over-day. Two charts:
 *   1. STACKED COUNTS - one tinted area per stage so the editor can
 *      eyeball which step is driving (or strangling) volume.
 *   2. TRAILING 7-DAY END-TO-END RATE - computed client-side from the
 *      daily buckets; surfaces "is the funnel improving?" in one glance.
 *
 * Auth: reuses the same X-Admin-Token + localStorage key the bot-routing
 * page uses, so admins log in once and both pages are unlocked.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki_back_office_token';

const STAGES = [
  { key: 'signup',       label: 'Signup',         color: '#5B8DEE' },
  { key: 'bound',        label: 'Bound',          color: '#6FA37D' },
  { key: 'dm_sent',      label: 'DM sent',        color: '#E8C26E' },
  { key: 'tma_open',     label: 'Mini App open',  color: '#C13B2C' },
  { key: 'unlock_click', label: 'Unlock click',   color: '#A0750F' },
];


const BackOfficeFunnelHistory = () => {
  const [token, setToken] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem(TOKEN_KEY)) || '');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/bot/funnel/history?days=${days}`, {
        headers: { 'X-Admin-Token': token },
      });
      if (!r.ok) { setAuthed(false); setErr(`auth failed (${r.status})`); return; }
      setData(await r.json());
      setAuthed(true);
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  }, [token, days]);

  useEffect(() => { if (token) refresh(); }, [token, refresh]);

  // Trailing 7-day end-to-end rate (signup -> unlock_click).
  const trailing = useMemo(() => {
    if (!data?.rows) return [];
    const window = 7;
    return data.rows.map((row, i) => {
      const from = Math.max(0, i - window + 1);
      const slice = data.rows.slice(from, i + 1);
      const s = slice.reduce((a, r) => a + r.signup, 0);
      const u = slice.reduce((a, r) => a + r.unlock_click, 0);
      return { day: row.day.slice(5), rate: s ? Math.round((u / s) * 1000) / 10 : 0 };
    });
  }, [data]);

  const chartRows = useMemo(
    () => (data?.rows || []).map((r) => ({ ...r, day: r.day.slice(5) })),
    [data],
  );

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)', padding: 48 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, margin: '0 0 24px' }}>Funnel · 30-day history</h1>
        <input type="password" placeholder="Admin token" value={token}
          onChange={(e) => setToken(e.target.value)}
          data-testid="funnel-history-token-input"
          style={{ padding: 12, width: 340, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border, #2a2722)', fontFamily: 'ui-monospace, monospace' }} />
        <button onClick={() => { window.localStorage.setItem(TOKEN_KEY, token); refresh(); }}
          data-testid="funnel-history-login"
          style={{ marginLeft: 8, padding: '12px 22px', background: '#E8C26E', color: '#0B0A09', border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer' }}>
          UNLOCK
        </button>
        {err && <div style={{ marginTop: 12, color: '#C8423C', fontFamily: 'ui-monospace, monospace' }}>{err}</div>}
      </div>
    );
  }

  return (
    <div data-testid="funnel-history-page" style={{
      minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)',
      padding: '32px 28px 64px', maxWidth: 1200, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <div>
          <Link to="/back-office/bot-routing" data-testid="funnel-history-back"
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted, #9C8B6B)', textDecoration: 'none' }}>← BOT & ROUTING</Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, letterSpacing: '-0.018em', margin: '8px 0 6px' }}>
            Funnel · {days}-day history
          </h1>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 640 }}>
            Day-over-day breakdown of the same 5 stages on the live snapshot. Use it to spot which step is improving (or decaying) week-over-week.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} disabled={busy}
              data-testid={`funnel-history-range-${d}`}
              style={{
                padding: '8px 12px',
                background: days === d ? '#E8C26E' : 'transparent',
                color: days === d ? '#0B0A09' : 'var(--ink)',
                border: '1px solid var(--border)',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
              }}>{d}D</button>
          ))}
        </div>
      </div>

      {err && <div style={{ padding: 12, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#FF8A7F', marginBottom: 20, fontFamily: 'ui-monospace, monospace' }}>{err}</div>}

      {/* Totals strip */}
      {data?.totals && (
        <div data-testid="funnel-history-totals" style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid var(--border)', marginBottom: 28 }}>
          {STAGES.map((s, i) => (
            <div key={s.key} data-testid={`funnel-history-total-${s.key}`} style={{
              flex: '1 1 0', padding: '14px 16px',
              borderRight: i < STAGES.length - 1 ? '1px solid var(--border)' : 'none',
              borderTop: `3px solid ${s.color}`,
            }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
                {s.label.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: s.color }}>
                {data.totals[s.key]}
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.06em', marginTop: 2 }}>
                TOTAL · {days}D
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bars per stage */}
      <section data-testid="funnel-history-bars" style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Daily volume</h2>
        <div style={{ width: '100%', height: 320, background: '#141210', border: '1px solid var(--border)', padding: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 10, right: 18, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2722" />
              <XAxis dataKey="day" tick={{ fill: '#9C8B6B', fontFamily: 'ui-monospace, monospace', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9C8B6B', fontFamily: 'ui-monospace, monospace', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0B0A09', border: '1px solid #2a2722', fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.1em' }} />
              {STAGES.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} stackId="x" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Trailing 7-day end-to-end rate */}
      <section data-testid="funnel-history-rate" style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
          Trailing 7-day end-to-end rate
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 700, marginLeft: 12 }}>
            SIGNUP → UNLOCK CLICK
          </span>
        </h2>
        <div style={{ width: '100%', height: 280, background: '#141210', border: '1px solid var(--border)', padding: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trailing} margin={{ top: 10, right: 18, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2722" />
              <XAxis dataKey="day" tick={{ fill: '#9C8B6B', fontFamily: 'ui-monospace, monospace', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9C8B6B', fontFamily: 'ui-monospace, monospace', fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={{ background: '#0B0A09', border: '1px solid #2a2722', fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
              <Line type="monotone" dataKey="rate" stroke="#E8C26E" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--muted)', marginTop: 8, letterSpacing: '0.06em', lineHeight: 1.6 }}>
          Each point = (unlock_clicks ÷ signups) over the last 7 days ending on that date. A flat-or-falling line means the funnel is leaking somewhere; the daily volume chart above shows where.
        </p>
      </section>

      <p data-testid="funnel-history-footnote" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', lineHeight: 1.7 }}>
        Bucketed by UTC day. The live 24h snapshot lives on <Link to="/back-office/bot-routing" style={{ color: 'var(--muted)' }}>Bot &amp; Routing</Link>.
      </p>
    </div>
  );
};

export default BackOfficeFunnelHistory;
