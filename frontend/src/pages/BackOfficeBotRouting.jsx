/**
 * Back-office · Bot & Routing (iter76, Slice 1).
 *
 * Implements Doc 2 §C.3. Three panels:
 *   1. Bot config toggles (signal_unlock_mode, daily_dm_enabled, etc.)
 *   2. Partners table CRUD (affiliate routing - dormant at launch)
 *   3. Subscriber summary (read-only health-check of the funnel)
 *
 * Auth: same X-Admin-Token pattern used by other back-office pages.
 * Keeps the existing back-office visual language (Georgia headlines,
 * monospace meta, dark canvas) so it doesn't read like a different app.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki_back_office_token';

const Field = ({ label, hint, children, testid }) => (
  <div data-testid={testid} style={{
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: '10px 0', borderBottom: '1px dashed var(--border, #2a2722)',
  }}>
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 10,
      letterSpacing: '0.18em', fontWeight: 700, color: 'var(--muted, #9C8B6B)',
    }}>{label}</span>
    {children}
    {hint && (
      <span style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
        color: 'var(--muted, #9C8B6B)', lineHeight: 1.5,
      }}>{hint}</span>
    )}
  </div>
);

const Toggle = ({ on, onChange, testid, disabled }) => (
  <button type="button" disabled={disabled}
    onClick={() => !disabled && onChange(!on)}
    data-testid={testid}
    style={{
      width: 50, height: 26, padding: 0, border: 0, borderRadius: 999,
      background: on ? '#6FA37D' : '#3a3028',
      position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 180ms ease',
      opacity: disabled ? 0.5 : 1,
    }}>
    <span style={{
      position: 'absolute', top: 3, left: on ? 27 : 3,
      width: 20, height: 20, borderRadius: '50%',
      background: '#0B0A09', transition: 'left 180ms ease',
    }} />
  </button>
);

const Cell = ({ label, value, testid }) => (
  <div data-testid={testid} style={{
    padding: '12px 14px', flex: '1 1 0', minWidth: 0,
    borderRight: '1px solid var(--border, #2a2722)',
    display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <span style={{
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.22em', fontWeight: 700, color: 'var(--muted, #9C8B6B)',
    }}>{label}</span>
    <span style={{
      fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
      color: 'var(--ink, #F2EBE0)', letterSpacing: '-0.01em',
    }}>{value}</span>
  </div>
);

const PartnerRow = ({ p, onUpdate, onDelete, busy }) => {
  const togglePause = () => onUpdate({ ...p, status: p.status === 'live' ? 'paused' : 'live' });
  const statusColor = p.status === 'live' ? '#6FA37D' : '#9C8B6B';
  return (
    <tr data-testid={`bot-partner-row-${p.partner_key}`} style={{ borderTop: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{p.partner_key}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'Georgia, serif', fontSize: 13 }}>{p.display_name}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
        {(p.target_geos || []).join(', ') || '—'}
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{p.priority_weight || 0}</td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{
          padding: '2px 8px', border: `1px solid ${statusColor}`, color: statusColor,
          fontFamily: 'ui-monospace, monospace', fontSize: 9.5, fontWeight: 700,
          letterSpacing: '0.18em',
        }}>{(p.status || 'paused').toUpperCase()}</span>
      </td>
      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
        <button onClick={togglePause} disabled={busy}
          data-testid={`bot-partner-toggle-${p.partner_key}`}
          style={{
            padding: '4px 10px', background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.12em', cursor: 'pointer', marginRight: 6,
          }}>{p.status === 'live' ? 'PAUSE' : 'LIVE'}</button>
        <button onClick={() => window.confirm(`Delete partner ${p.partner_key}?`) && onDelete(p.partner_key)}
          disabled={busy} data-testid={`bot-partner-delete-${p.partner_key}`}
          style={{
            padding: '4px 10px', background: 'transparent',
            border: '1px solid #C8423C', color: '#C8423C',
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.12em', cursor: 'pointer',
          }}>DEL</button>
      </td>
    </tr>
  );
};

const BackOfficeBotRouting = () => {
  const [token, setToken] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem(TOKEN_KEY)) || '');
  const [authed, setAuthed] = useState(false);
  const [config, setConfig] = useState(null);
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [newPartner, setNewPartner] = useState({
    partner_key: '', display_name: '', affiliate_base_url: '',
    target_geos: 'FI', priority_weight: 10,
  });
  const [mint, setMint] = useState(null);   // { code, full_url, copied }

  const hdr = useCallback(() => ({ 'X-Admin-Token': token, 'Content-Type': 'application/json' }), [token]);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [c, p, s] = await Promise.all([
        fetch(`${BACKEND}/api/admin/bot/config`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/partners`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
        fetch(`${BACKEND}/api/admin/bot/subscribers/summary`, { headers: hdr() }).then((r) => r.ok ? r.json() : null),
      ]);
      if (!c) { setAuthed(false); setErr('auth failed'); return; }
      setConfig(c); setPartners((p && p.items) || []); setSummary(s); setAuthed(true);
    } catch (e) { setErr(String(e?.message || e)); }
  }, [token, hdr]);

  useEffect(() => { if (token) refreshAll(); }, [token, refreshAll]);

  const patchConfig = async (patch) => {
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/bot/config`, {
        method: 'PUT', headers: hdr(), body: JSON.stringify(patch),
      });
      if (r.ok) setConfig(await r.json());
      else setErr(`PUT config failed: ${r.status}`);
    } finally { setBusy(false); }
  };

  const upsertPartner = async (p) => {
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/partners`, {
        method: 'POST', headers: hdr(), body: JSON.stringify(p),
      });
      if (r.ok) await refreshAll();
      else setErr(`upsert partner failed: ${r.status}`);
    } finally { setBusy(false); }
  };

  const deletePartner = async (key) => {
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/admin/partners/${encodeURIComponent(key)}`, { method: 'DELETE', headers: hdr() });
      await refreshAll();
    } finally { setBusy(false); }
  };

  const mintTestLink = async () => {
    setBusy(true); setMint(null); setErr(null);
    try {
      // Pull today's top pick signal_id for traceability; falls back to a
      // marker when /api/odds/featured is empty.
      let signalId = null;
      try {
        const f = await fetch(`${BACKEND}/api/odds/featured`).then((r) => r.json());
        const top = (f?.picks || [])[0];
        signalId = top?.signal_id || top?.event_id || top?.id || null;
      } catch { /* noop - signal_id stays null */ }

      const r = await fetch(`${BACKEND}/api/admin/links/mint`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({
          signal_id: signalId || 'back_office_test',
          campaign: 'back_office_smoke',
          segment: 'all',
        }),
      });
      if (!r.ok) { setErr(`mint failed: ${r.status}`); return; }
      const body = await r.json();
      const fullUrl = `${BACKEND.replace(/\/$/, '')}/api/r/${body.code}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(fullUrl);
        copied = true;
      } catch { /* clipboard may be blocked - we still show the URL */ }
      setMint({ code: body.code, full_url: fullUrl, copied, signal_id: signalId });
    } finally { setBusy(false); }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)', padding: 48 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, margin: '0 0 24px' }}>Bot & Routing</h1>
        <input type="password" placeholder="Admin token" value={token}
          onChange={(e) => setToken(e.target.value)}
          data-testid="bot-routing-token-input"
          style={{ padding: 12, width: 340, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border, #2a2722)', fontFamily: 'ui-monospace, monospace' }} />
        <button onClick={() => { window.localStorage.setItem(TOKEN_KEY, token); refreshAll(); }}
          data-testid="bot-routing-login" style={{
            marginLeft: 8, padding: '12px 22px', background: '#E8C26E', color: '#0B0A09',
            border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em', fontWeight: 800, cursor: 'pointer',
          }}>UNLOCK</button>
        {err && <div style={{ marginTop: 12, color: '#C8423C', fontFamily: 'ui-monospace, monospace' }}>{err}</div>}
      </div>
    );
  }

  const m = config || {};
  const routingLive = m.signal_unlock_mode === 'routed';

  return (
    <div data-testid="bot-routing-page" style={{
      minHeight: '100vh', background: 'var(--bg, #0B0A09)', color: 'var(--ink, #F2EBE0)',
      padding: '32px 28px 64px', maxWidth: 1120, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <Link to="/back-office" data-testid="bot-routing-back"
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted, #9C8B6B)', textDecoration: 'none' }}>← BACK-OFFICE</Link>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, letterSpacing: '-0.018em', margin: '8px 0 6px' }}>Bot & Routing</h1>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--muted, #9C8B6B)', margin: 0, maxWidth: 560 }}>
            Master switches for the Telegram bot + affiliate router. Routing is dormant at launch — flip <em>signal_unlock_mode</em> to <strong>routed</strong> once a partner row is live.
          </p>
        </div>
        <button onClick={refreshAll} disabled={busy} data-testid="bot-routing-refresh"
          style={{ padding: '10px 18px', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', cursor: 'pointer' }}>
          {busy ? '…' : 'REFRESH'}
        </button>
      </div>

      {err && <div style={{ padding: 12, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#FF8A7F', marginBottom: 20, fontFamily: 'ui-monospace, monospace' }}>{err}</div>}

      {/* Subscriber summary */}
      {summary && (
        <div data-testid="bot-routing-summary" style={{ marginBottom: 32, border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap' }}>
          <Cell testid="bot-summary-total" label="TOTAL SUBS" value={summary.total} />
          <Cell testid="bot-summary-active-bound" label="ACTIVE + BOUND" value={summary.active_bound} />
          <Cell testid="bot-summary-consent" label="MARKETING OK" value={summary.consent_marketing} />
          <Cell testid="bot-summary-segments" label="SEGMENTS" value={Object.keys(summary.by_segment || {}).length} />
        </div>
      )}

      {/* Bot config */}
      <section data-testid="bot-routing-config" style={{ marginBottom: 36 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Bot config</h2>
        <Field testid="bot-cfg-unlock-mode"
          label="SIGNAL UNLOCK MODE"
          hint="informative: tap a locked signal → reveals in-app. routed: tap → affiliate partner. Flipping to 'routed' requires at least one LIVE partner row below.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <button onClick={() => patchConfig({ signal_unlock_mode: 'informative' })}
              data-testid="bot-cfg-mode-informative"
              style={{ padding: '8px 14px', background: !routingLive ? '#E8C26E' : 'transparent', color: !routingLive ? '#0B0A09' : 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer' }}>
              INFORMATIVE
            </button>
            <button onClick={() => patchConfig({ signal_unlock_mode: 'routed' })}
              data-testid="bot-cfg-mode-routed"
              disabled={!partners.some((p) => p.status === 'live')}
              style={{ padding: '8px 14px', background: routingLive ? '#E8C26E' : 'transparent', color: routingLive ? '#0B0A09' : 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer', opacity: partners.some((p) => p.status === 'live') ? 1 : 0.4 }}>
              ROUTED
            </button>
          </div>
        </Field>

        <Field testid="bot-cfg-verified-signup"
          label="REQUIRE VERIFIED SIGNUP"
          hint="When true, /start with no website-issued pending_id is rejected (user is told to sign up at putkihq.fi/signup first). Recommended: true.">
          <Toggle testid="bot-cfg-verified-toggle" on={!!m.require_verified_signup} onChange={(v) => patchConfig({ require_verified_signup: v })} disabled={busy} />
        </Field>

        <Field testid="bot-cfg-daily-dm"
          label="DAILY DM DISPATCH"
          hint="Per-subscriber DM of today's signals (Slice 2 fan-out). Off until Slice 2 ships.">
          <Toggle testid="bot-cfg-daily-dm-toggle" on={!!m.daily_dm_enabled} onChange={(v) => patchConfig({ daily_dm_enabled: v })} disabled={busy} />
        </Field>

        <Field testid="bot-cfg-stars"
          label="TELEGRAM STARS PREMIUM (STUB)"
          hint="Data-model stub only - no purchase flow wired. Toggle has no user-facing effect until Stars integration ships.">
          <Toggle testid="bot-cfg-stars-toggle" on={!!m.stars_premium_enabled} onChange={(v) => patchConfig({ stars_premium_enabled: v })} disabled={busy} />
        </Field>

        <Field testid="bot-cfg-sharpness"
          label="SHARPNESS BROADCAST FLOOR"
          hint="Top pick must beat this score (0-100) before the @putkihq channel broadcast fires. Default 70.">
          <input type="number" min="0" max="100" defaultValue={m.sharpness_min || 70}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n) && n >= 0 && n <= 100 && n !== m.sharpness_min) {
                patchConfig({ sharpness_min: n });
              }
            }}
            data-testid="bot-cfg-sharpness-input"
            style={{ width: 100, padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
        </Field>
      </section>

      {/* Partners table */}
      <section data-testid="bot-routing-partners" style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>Affiliate partners</h2>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', maxWidth: 640 }}>
          Empty at launch. Add a row + flip <strong>signal unlock mode</strong> to <strong>routed</strong> to switch monetisation on without a deploy. Routing is geo-gated: a partner only receives traffic from users in <em>target_geos</em>.
        </p>

        {/* Mint test link */}
        <div data-testid="bot-routing-mint" style={{
          border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 14,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700 }}>
              MINT TEST LINK
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginTop: 4 }}>
              Spins up a fresh <code>/api/r/&lt;code&gt;</code> against today&apos;s top pick + copies the URL to your clipboard. Use it to smoke-test the router without leaving the page.
            </div>
          </div>
          <button onClick={mintTestLink} disabled={busy}
            data-testid="bot-routing-mint-btn"
            style={{
              padding: '10px 16px', background: '#E8C26E', color: '#0B0A09', border: 0,
              fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.22em',
              fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
            }}>{busy ? '…' : '+ MINT LINK'}</button>
        </div>

        {mint && (
          <div data-testid="bot-routing-mint-result" style={{
            border: '1px dashed #E8C26E', padding: 12, marginBottom: 14,
            background: '#1a1610',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700 }}>
                CODE {mint.code} {mint.copied ? '· COPIED ✓' : '· COPY MANUALLY'}
              </span>
              <a href={mint.full_url} target="_blank" rel="noreferrer"
                data-testid="bot-routing-mint-open"
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: '#E8C26E', textDecoration: 'underline' }}>
                OPEN IN NEW TAB →
              </a>
            </div>
            <code data-testid="bot-routing-mint-url" style={{
              display: 'block', padding: 8, background: '#0B0A09', color: '#F2EBE0',
              fontFamily: 'ui-monospace, monospace', fontSize: 11, wordBreak: 'break-all',
              border: '1px solid var(--border)',
            }}>{mint.full_url}</code>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--muted)', marginTop: 6, letterSpacing: '0.08em' }}>
              SIGNAL: {mint.signal_id || 'back_office_test'} · In <strong>informative</strong> mode this 302s to /mittari · in <strong>routed</strong> mode it picks a LIVE geo-eligible partner.
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', marginBottom: 14 }}>
          <thead style={{ background: 'var(--surface, #141210)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>KEY</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>NAME</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>GEOS</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>PRIORITY</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>STATUS</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>NO PARTNERS · ROUTING IS DORMANT</td></tr>
            ) : partners.map((p) => (
              <PartnerRow key={p.partner_key} p={p} busy={busy} onUpdate={upsertPartner} onDelete={deletePartner} />
            ))}
          </tbody>
        </table>

        {/* Add row */}
        <div data-testid="bot-routing-partner-add" style={{ border: '1px dashed var(--border)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, alignItems: 'end' }}>
          <input type="text" placeholder="partner_key (e.g. veikkaus)" value={newPartner.partner_key}
            onChange={(e) => setNewPartner({ ...newPartner, partner_key: e.target.value })}
            data-testid="bot-partner-key-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <input type="text" placeholder="Display name" value={newPartner.display_name}
            onChange={(e) => setNewPartner({ ...newPartner, display_name: e.target.value })}
            data-testid="bot-partner-name-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'Georgia, serif', fontSize: 13 }} />
          <input type="text" placeholder="affiliate_base_url" value={newPartner.affiliate_base_url}
            onChange={(e) => setNewPartner({ ...newPartner, affiliate_base_url: e.target.value })}
            data-testid="bot-partner-url-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
          <input type="text" placeholder="target_geos (CSV: FI,SE)" value={newPartner.target_geos}
            onChange={(e) => setNewPartner({ ...newPartner, target_geos: e.target.value })}
            data-testid="bot-partner-geos-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <input type="number" placeholder="priority" value={newPartner.priority_weight}
            onChange={(e) => setNewPartner({ ...newPartner, priority_weight: parseInt(e.target.value, 10) || 0 })}
            data-testid="bot-partner-prio-input"
            style={{ padding: 8, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', fontSize: 12, width: '100%' }} />
          <button disabled={busy || !newPartner.partner_key.trim() || !newPartner.display_name.trim() || !newPartner.affiliate_base_url.trim()}
            data-testid="bot-partner-add-btn"
            onClick={() => {
              upsertPartner({
                partner_key: newPartner.partner_key,
                display_name: newPartner.display_name,
                affiliate_base_url: newPartner.affiliate_base_url,
                target_geos: newPartner.target_geos.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
                priority_weight: newPartner.priority_weight,
                status: 'paused',
              });
              setNewPartner({ partner_key: '', display_name: '', affiliate_base_url: '', target_geos: 'FI', priority_weight: 10 });
            }}
            style={{
              padding: '10px 16px', background: '#E8C26E', color: '#0B0A09', border: 0,
              fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', fontWeight: 800, cursor: 'pointer',
              opacity: busy ? 0.5 : 1,
            }}>+ ADD PARTNER</button>
        </div>
      </section>

      <p data-testid="bot-routing-footnote" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', lineHeight: 1.7 }}>
        SLICE 1 of 5 · Foundation. Daily DM dispatch (Slice 2), website signup form (Slice 3), Mini App (Slice 4), and the active affiliate router (Slice 5) ship in subsequent iterations.
      </p>
    </div>
  );
};

export default BackOfficeBotRouting;
