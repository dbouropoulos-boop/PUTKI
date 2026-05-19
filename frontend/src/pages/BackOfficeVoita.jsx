/**
 * PUTKI HQ — BackOfficeVoita.
 *
 * CRUD for raffles + editable prize distribution + gate-flag board +
 * draw trigger. Once a raffle is `drawn` all edits are blocked.
 *
 * Gate flags (three must be true for a raffle to surface publicly):
 *   rules_url_set              · Sako rules confirmed at /voita/saannot
 *   prize_distribution_locked  · admin has finalised payouts
 *   match_populated            · team names + kickoff set
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLOR = {
  draft: { bg: '#1a1f2a', color: '#8b97aa', border: '#36404f' },
  open: { bg: '#0e2b1a', color: '#6FA37D', border: '#2b5a3e' },
  closed: { bg: '#2b1a0e', color: '#d4a89a', border: '#5a3a2b' },
  drawn: { bg: '#1a0e2b', color: '#a89ad4', border: '#3a2b5a' },
  paid: { bg: '#0e2b1a', color: '#FFD66E', border: '#7a5c1d' },
  archived: { bg: 'transparent', color: 'var(--muted)', border: 'var(--border-strong)' },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_COLOR[status] || STATUS_COLOR.draft;
  return (
    <span data-testid={`voita-status-${status}`} style={{
      display: 'inline-block', padding: '3px 8px',
      fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
      letterSpacing: '0.18em', fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{(status || 'draft').toUpperCase()}</span>
  );
};

const PrizePayoutEditor = ({ payouts, cap, onChange }) => {
  const total = payouts.reduce((s, p) => s + (Number(p.amount_eur) || 0), 0);
  const over = total > cap;

  const update = (i, patch) => {
    const next = payouts.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    onChange(next);
  };
  const addRow = () => {
    const nextPos = payouts.length ? Math.max(...payouts.map((p) => p.position || 0)) + 1 : 1;
    onChange([...payouts, { position: nextPos, amount_eur: 0, type: 'cash', note: '' }]);
  };
  const removeRow = (i) => onChange(payouts.filter((_, idx) => idx !== i));

  return (
    <div data-testid="prize-editor" style={{ display: 'grid', gap: 8 }}>
      {payouts.map((p, i) => (
        <div key={i} data-testid={`prize-row-${i}`} style={{
          display: 'grid', gridTemplateColumns: '60px 100px 100px 1fr auto', gap: 8, alignItems: 'center',
        }}>
          <input type="number" min={1} value={p.position}
            onChange={(e) => update(i, { position: Number(e.target.value) })}
            data-testid={`prize-position-${i}`}
            style={{ background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '6px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <input type="number" min={0} value={p.amount_eur}
            onChange={(e) => update(i, { amount_eur: Number(e.target.value) })}
            data-testid={`prize-amount-${i}`}
            style={{ background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '6px 8px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
          <select value={p.type || 'cash'} onChange={(e) => update(i, { type: e.target.value })}
            data-testid={`prize-type-${i}`}
            style={{ background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '6px 8px', fontFamily: 'inherit', fontSize: 12 }}>
            <option value="cash">cash</option>
            <option value="credit">credit</option>
            <option value="merch">merch</option>
          </select>
          <input type="text" value={p.note || ''} onChange={(e) => update(i, { note: e.target.value })}
            placeholder="note (optional)" data-testid={`prize-note-${i}`}
            style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '6px 8px', fontFamily: 'inherit', fontSize: 12 }} />
          <button type="button" onClick={() => removeRow(i)}
            data-testid={`prize-remove-${i}`}
            style={{ background: 'transparent', border: '1px solid #5a2b2b', color: '#C8423C', padding: '6px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', cursor: 'pointer' }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
        <button type="button" onClick={addRow} data-testid="prize-add-row"
          style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '6px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', cursor: 'pointer' }}>+ ADD POSITION</button>
        <span data-testid="prize-total" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em',
          color: over ? '#C8423C' : 'var(--muted)', fontWeight: over ? 700 : 400,
        }}>TOTAL · €{total} / €{cap}{over ? ' · OVER CAP' : ''}</span>
      </div>
    </div>
  );
};

const RaffleEditor = ({ raffle, token, onSaved, onDeleted }) => {
  const [form, setForm] = useState(() => ({
    title_fi: raffle.title_fi || '', title_en: raffle.title_en || '',
    summary_fi: raffle.summary_fi || '', summary_en: raffle.summary_en || '',
    sport: raffle.sport || '', league: raffle.league || '',
    home_team: raffle.home_team || '', away_team: raffle.away_team || '',
    kickoff_at: raffle.kickoff_at || '',
    entries_close_at: raffle.entries_close_at || '',
    image_url: raffle.image_url || '',
    prize_cap_eur: raffle.prize_cap_eur || 500,
    payouts: (raffle.prize_distribution?.payouts || []).slice(),
    scoring: raffle.scoring || { one_x_two_points: 3, exact_score_points: 5, goal_diff_points: 3, total_goals_points: 1 },
    gating: raffle.gating || { rules_url_set: false, prize_distribution_locked: false, match_populated: false },
    status: raffle.status || 'draft',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [drawHome, setDrawHome] = useState('');
  const [drawAway, setDrawAway] = useState('');
  const drawn = raffle.status === 'drawn' || raffle.status === 'paid';

  const markPaid = async () => {
    if (!window.confirm('Mark this raffle as PAID? Prizes must have actually been paid out before clicking. Surfaces the raffle on the public recent-winners strip.')) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/voita/raffles/${raffle.id}/mark-paid`, {
        method: 'POST', headers: { 'X-Admin-Token': token },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.detail || `HTTP ${r.status}`); return; }
      setInfo('MARKED PAID.');
      onSaved && onSaved();
    } finally { setBusy(false); }
  };

  const save = async () => {
    setError(''); setInfo(''); setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/voita/raffles/${raffle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          title_fi: form.title_fi, title_en: form.title_en,
          summary_fi: form.summary_fi, summary_en: form.summary_en,
          sport: form.sport, league: form.league,
          home_team: form.home_team, away_team: form.away_team,
          kickoff_at: form.kickoff_at, entries_close_at: form.entries_close_at,
          image_url: form.image_url || null,
          prize_cap_eur: Number(form.prize_cap_eur),
          prize_distribution: { mode: form.payouts.length > 1 ? 'tiered' : 'single', payouts: form.payouts },
          scoring: form.scoring,
          gating: form.gating,
          status: form.status,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.detail || `HTTP ${r.status}`); return; }
      setInfo('SAVED.');
      onSaved && onSaved();
    } finally { setBusy(false); }
  };

  const drawNow = async () => {
    if (drawHome === '' || drawAway === '') { setError('Score required for draw.'); return; }
    if (!window.confirm(`Draw raffle with final score ${drawHome}-${drawAway}? Result is locked once drawn.`)) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/voita/raffles/${raffle.id}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ home_goals: Number(drawHome), away_goals: Number(drawAway) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.detail || `HTTP ${r.status}`); return; }
      setInfo(`DRAWN · ${j.result.winners.length} WINNERS · ${j.result.scored_count} ENTRIES SCORED.`);
      onSaved && onSaved();
    } finally { setBusy(false); }
  };

  const del = async () => {
    if (!window.confirm(`Delete raffle "${raffle.slug}" and all its entries?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/voita/raffles/${raffle.id}`, {
        method: 'DELETE', headers: { 'X-Admin-Token': token },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.detail || `HTTP ${r.status}`);
        return;
      }
      onDeleted && onDeleted();
    } finally { setBusy(false); }
  };

  const Field = ({ label, children }) => (
    <label style={{ display: 'block' }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
  const TextInput = ({ value, onChange, ...rest }) => (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '8px 12px', fontFamily: 'inherit', fontSize: 13 }} {...rest} />
  );

  return (
    <div data-testid={`raffle-editor-${raffle.slug}`} style={{
      marginTop: 14, padding: '20px 22px',
      background: 'var(--surface)', border: '1px solid var(--hairline)',
    }}>
      {drawn && <div data-testid="raffle-drawn-lock" style={{
        marginBottom: 14, padding: 10,
        background: '#1a0e2b', border: '1px solid #3a2b5a',
        color: '#a89ad4', fontFamily: 'ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.18em',
      }}>RAFFLE DRAWN · RESULTS IMMUTABLE</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Field label="HOME TEAM"><TextInput value={form.home_team} onChange={(v) => setForm({ ...form, home_team: v })} disabled={drawn} /></Field>
        <Field label="AWAY TEAM"><TextInput value={form.away_team} onChange={(v) => setForm({ ...form, away_team: v })} disabled={drawn} /></Field>
        <Field label="SPORT"><TextInput value={form.sport} onChange={(v) => setForm({ ...form, sport: v })} disabled={drawn} /></Field>
        <Field label="LEAGUE"><TextInput value={form.league} onChange={(v) => setForm({ ...form, league: v })} disabled={drawn} /></Field>
        <Field label="KICKOFF (ISO)"><TextInput value={form.kickoff_at || ''} onChange={(v) => setForm({ ...form, kickoff_at: v })} disabled={drawn} placeholder="2026-05-25T18:00:00+03:00" /></Field>
        <Field label="ENTRIES CLOSE (ISO)"><TextInput value={form.entries_close_at || ''} onChange={(v) => setForm({ ...form, entries_close_at: v })} disabled={drawn} placeholder="defaults to kickoff" /></Field>
        <Field label="TITLE · FI"><TextInput value={form.title_fi} onChange={(v) => setForm({ ...form, title_fi: v })} disabled={drawn} /></Field>
        <Field label="TITLE · EN"><TextInput value={form.title_en} onChange={(v) => setForm({ ...form, title_en: v })} disabled={drawn} /></Field>
      </div>

      <Field label="CARD IMAGE URL (optional · used as photo backdrop on the active card)">
        <TextInput value={form.image_url} onChange={(v) => setForm({ ...form, image_url: v })}
          disabled={drawn} placeholder="/raffles/kups-hjk.jpg or https://…"
          data-testid="raffle-image-url-input" />
      </Field>
      {form.image_url && (
        <div style={{ marginTop: 8, marginBottom: 14, padding: 6, background: 'var(--bg)', border: '1px solid var(--hairline)' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700, marginBottom: 4 }}>CARD IMAGE PREVIEW</div>
          <img src={form.image_url} alt="raffle card preview" data-testid="raffle-image-preview"
            style={{ display: 'block', width: '100%', maxHeight: 160, objectFit: 'cover' }} />
        </div>
      )}

      <Field label="PRIZE CAP (€) · HARD MAX 500">
        <input type="number" min={0} max={500} value={form.prize_cap_eur}
          onChange={(e) => setForm({ ...form, prize_cap_eur: e.target.value })}
          disabled={drawn} data-testid="prize-cap-input"
          style={{ width: 120, background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '8px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 14 }} />
      </Field>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
          PRIZE DISTRIBUTION · POSITION × AMOUNT × TYPE
        </div>
        <PrizePayoutEditor payouts={form.payouts} cap={Number(form.prize_cap_eur || 500)}
          onChange={(next) => setForm({ ...form, payouts: next })} />
      </div>

      {/* Gating flags — match_populated is auto-derived (server-side) from home_team + away_team + kickoff_at presence */}
      <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        {[
          ['rules_url_set', 'RULES URL SET'],
          ['prize_distribution_locked', 'PRIZE LOCKED'],
        ].map(([key, label]) => (
          <label key={key} data-testid={`gating-${key}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', cursor: drawn ? 'not-allowed' : 'pointer',
            background: form.gating[key] ? '#0e2b1a' : 'var(--bg)',
            border: `1px solid ${form.gating[key] ? '#2b5a3e' : 'var(--border-strong)'}`,
            color: form.gating[key] ? '#9ad4a9' : 'var(--ink)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', fontWeight: 700,
          }}>
            <input type="checkbox" checked={!!form.gating[key]}
              onChange={(e) => setForm({ ...form, gating: { ...form.gating, [key]: e.target.checked } })}
              disabled={drawn} />
            {label}
          </label>
        ))}
        {/* Auto-derived read-only indicator */}
        <span data-testid="gating-match_populated-auto" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', cursor: 'default',
          background: raffle?.gating?.match_populated ? '#0e2b1a' : 'var(--bg)',
          border: `1px dashed ${raffle?.gating?.match_populated ? '#2b5a3e' : 'var(--border-strong)'}`,
          color: raffle?.gating?.match_populated ? '#9ad4a9' : 'var(--muted)',
          fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', fontWeight: 700,
        }} title="Auto-derived from home_team + away_team + kickoff_at being set.">
          {raffle?.gating?.match_populated ? '✓' : '○'} MATCH POPULATED (AUTO)
        </span>
      </div>

      {/* Status select */}
      <div style={{ marginTop: 14 }}>
        <Field label="STATUS">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            disabled={drawn} data-testid="raffle-status-select"
            style={{ background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '8px 12px', fontFamily: 'inherit', fontSize: 13 }}>
            <option value="draft">draft</option>
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="archived">archived</option>
          </select>
        </Field>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={save} disabled={busy || drawn}
          data-testid="raffle-save-btn"
          style={{ padding: '10px 22px', background: '#FFFFFF', color: '#0B0A09', border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, cursor: (busy || drawn) ? 'wait' : 'pointer' }}>
          {busy ? 'SAVING…' : 'SAVE'}
        </button>

        {!drawn && (
          <>
            <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em' }}>DRAW WITH FINAL SCORE</span>
            <input type="number" min={0} value={drawHome} onChange={(e) => setDrawHome(e.target.value)} placeholder="home"
              data-testid="draw-home" style={{ width: 70, background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '8px 10px', fontFamily: 'Georgia, serif', fontSize: 16, textAlign: 'center' }} />
            <span style={{ color: 'var(--muted)' }}>—</span>
            <input type="number" min={0} value={drawAway} onChange={(e) => setDrawAway(e.target.value)} placeholder="away"
              data-testid="draw-away" style={{ width: 70, background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '8px 10px', fontFamily: 'Georgia, serif', fontSize: 16, textAlign: 'center' }} />
            <button type="button" onClick={drawNow} disabled={busy}
              data-testid="raffle-draw-btn"
              style={{ padding: '10px 18px', background: 'transparent', color: '#FFD66E', border: '1px solid #5a4a1a', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? '…' : '▶ DRAW NOW'}
            </button>
          </>
        )}

        {!drawn && (
          <button type="button" onClick={del} disabled={busy}
            data-testid="raffle-delete-btn"
            style={{ padding: '10px 18px', background: 'transparent', color: '#C8423C', border: '1px solid #5a2b2b', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            DELETE
          </button>
        )}
      </div>

      {error && <div data-testid="raffle-editor-error" style={{ marginTop: 12, padding: 10, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
      {info && <div data-testid="raffle-editor-info" style={{ marginTop: 12, padding: 10, background: '#0e2b1a', border: '1px solid #2b5a3e', color: '#9ad4a9', fontSize: 12 }}>{info}</div>}

      {raffle.result && <div data-testid="raffle-winners" style={{ marginTop: 14, padding: 12, background: 'var(--bg)', border: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
            WINNERS · DRAW {raffle.result.drawn_at?.slice(0, 16).replace('T', ' ')}
            {raffle.paid_at && <span style={{ color: '#FFD66E', marginLeft: 12 }}>· PAID {raffle.paid_at?.slice(0, 10)}</span>}
          </span>
          {raffle.status === 'drawn' && (
            <button type="button" onClick={markPaid} disabled={busy}
              data-testid="raffle-mark-paid-btn"
              style={{
                padding: '8px 18px', background: '#FFD66E', color: '#0B0A09',
                border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                letterSpacing: '0.18em', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              }}>
              {busy ? '…' : '✓ MARK PAID'}
            </button>
          )}
        </div>
        {(raffle.result.winners || []).map((w) => (
          <div key={w.entry_id} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--ink)', marginBottom: 4 }}>
            #{w.position} · €{w.prize_amount_eur} {w.prize_type} · entry {w.entry_id?.slice(0, 8)} · {w.score} pts
          </div>
        ))}
      </div>}
    </div>
  );
};

const NewRaffleForm = ({ token, onCreated }) => {
  const [slug, setSlug] = useState('');
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/voita/raffles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          slug, home_team: home, away_team: away,
          prize_cap_eur: 500,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.detail || `HTTP ${r.status}`); return; }
      setSlug(''); setHome(''); setAway('');
      onCreated && onCreated();
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={create} data-testid="voita-new-form" style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18,
      padding: 14, background: 'var(--surface)', border: '1px solid var(--hairline)',
    }}>
      <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())}
        placeholder="slug e.g. liiga-finals-game-7" data-testid="voita-new-slug"
        style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '1 1 240px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
      <input value={home} onChange={(e) => setHome(e.target.value)} placeholder="Home"
        data-testid="voita-new-home" style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 180px', fontFamily: 'inherit', fontSize: 12 }} />
      <input value={away} onChange={(e) => setAway(e.target.value)} placeholder="Away"
        data-testid="voita-new-away" style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '8px 12px', flex: '0 0 180px', fontFamily: 'inherit', fontSize: 12 }} />
      <button type="submit" disabled={busy} data-testid="voita-new-submit"
        style={{ padding: '8px 18px', background: '#FFFFFF', color: '#0B0A09', border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? '…' : '+ NEW RAFFLE'}
      </button>
      {error && <div data-testid="voita-new-error" style={{ flex: '1 1 100%', padding: 8, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
    </form>
  );
};

const BackOfficeVoita = () => {
  const { token, setToken, authed, authError, checkAuth } = useBackOfficeToken();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!token || !authed) return;
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/voita/raffles`, { headers: { 'X-Admin-Token': token } });
      if (r.ok) { const d = await r.json(); setItems(d.items || []); }
    } finally { setLoading(false); }
  }, [token, authed]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: items.length,
    draft: items.filter((r) => r.status === 'draft').length,
    open: items.filter((r) => r.status === 'open').length,
    drawn: items.filter((r) => r.status === 'drawn').length,
    paid: items.filter((r) => r.status === 'paid').length,
  }), [items]);

  if (!authed) {
    return <AuthGate token={token} setToken={setToken} onSubmit={checkAuth} error={authError} title="Voita — raffles" />;
  }

  return (
    <div data-testid="back-office-voita" style={{
      maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/back-office" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← BACK-OFFICE</Link>
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: '#FFFFFF', margin: '16px 0 8px' }}>
        Voita raffles
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, maxWidth: 760, lineHeight: 1.55 }}>
        Manage marquee-match raffles. A raffle is invisible to the public until all three gates (rules / prize / match) are true AND <code style={{ color: 'var(--ink)' }}>voita_feature_enabled</code> is on. Once drawn, results lock and edits are blocked.
      </p>
      <div data-testid="voita-counts" style={{ display: 'flex', gap: 24, marginBottom: 18, fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em' }}>
        <span style={{ color: 'var(--muted)' }}>TOTAL <strong style={{ color: '#FFFFFF', marginLeft: 6 }}>{counts.all}</strong></span>
        <span style={{ color: 'var(--muted)' }}>DRAFT <strong style={{ color: '#FFFFFF', marginLeft: 6 }}>{counts.draft}</strong></span>
        <span style={{ color: 'var(--muted)' }}>OPEN <strong style={{ color: '#6FA37D', marginLeft: 6 }}>{counts.open}</strong></span>
        <span style={{ color: 'var(--muted)' }}>DRAWN <strong style={{ color: '#a89ad4', marginLeft: 6 }}>{counts.drawn}</strong></span>
        <span style={{ color: 'var(--muted)' }}>PAID <strong style={{ color: '#FFD66E', marginLeft: 6 }}>{counts.paid}</strong></span>
      </div>

      <NewRaffleForm token={token} onCreated={load} />

      {loading ? <div data-testid="voita-loading">LOADING…</div> : items.length === 0 ? (
        <div data-testid="voita-empty" style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.14em', padding: 32, textAlign: 'center', border: '1px dashed var(--border)' }}>
          NO RAFFLES YET.
        </div>
      ) : items.map((r) => (
        <div key={r.id} data-testid={`voita-card-${r.slug}`}>
          <div style={{
            padding: '14px 16px', background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer',
            marginTop: 14,
          }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
            <StatusPill status={r.status} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#FFFFFF', fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700 }}>
                {r.home_team || '—'} <span style={{ color: 'var(--muted)' }}>vs</span> {r.away_team || '—'}
              </div>
              <div style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.12em', marginTop: 2 }}>
                {r.slug} · {r.sport || '—'} · ENTRIES {r.entries_count || 0}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Object.entries(r.gating || {}).map(([k, v]) => (
                <span key={k} title={k} style={{
                  width: 14, height: 14,
                  background: v ? '#6FA37D' : 'var(--hairline)', borderRadius: 2,
                }} />
              ))}
            </div>
            <span style={{ color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em' }}>
              {openId === r.id ? 'CLOSE ▲' : 'EDIT ▾'}
            </span>
          </div>
          {openId === r.id && (
            <RaffleEditor raffle={r} token={token} onSaved={load} onDeleted={() => { setOpenId(null); load(); }} />
          )}
        </div>
      ))}
    </div>
  );
};

export default BackOfficeVoita;
