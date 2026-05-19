/**
 * PUTKI HQ — Back-office Dispatch Previewer.
 *
 * Left column:  list of cycles (last 14d, newest first).
 * Right column: side-by-side preview of all three channels for the
 *               selected cycle — rendered body + raw payload + recipient
 *               count, plus per-send "Flag for review" controls.
 *
 * The previewer is read-mostly. The only write is `Flag for review`, which
 * upserts into `dispatch_review_flags`. Channel-mode and test-send controls
 * live next door on `/back-office/optin-segments`.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const CHANNEL_TONE = {
  email: { label: 'EMAIL', accent: '#9ac4d4', surface: '#0e1a2b', border: '#2b4a5a' },
  sms: { label: 'SMS', accent: '#d4a89a', surface: '#2b1a0e', border: '#5a3a2b' },
  telegram: { label: 'TELEGRAM', accent: '#a89ad4', surface: '#1a0e2b', border: '#3a2b5a' },
};

const FLAG_REASONS = [
  { value: 'tone_off', label: 'Tone off-brand' },
  { value: 'factually_incorrect', label: 'Factually incorrect' },
  { value: 'legal_concern', label: 'Legal / GDPR concern' },
  { value: 'formatting', label: 'Formatting / rendering' },
  { value: 'other', label: 'Other (see note)' },
];

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch { return iso; }
};

// ── Flag dialog (inline; no portal). Dropdown + optional note.
const FlagInlineForm = ({ initial, onSubmit, onCancel, busy }) => {
  const [reason, setReason] = useState(initial?.reason || 'tone_off');
  const [note, setNote] = useState(initial?.note || '');
  return (
    <div data-testid="flag-form" style={{
      marginTop: 8, padding: 12, background: 'var(--bg)',
      border: '1px dashed var(--border-strong)',
    }}>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 4 }}>
          REASON
        </div>
        <select value={reason} onChange={(e) => setReason(e.target.value)}
          data-testid="flag-reason-select"
          style={{ width: '100%', background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 12 }}>
          {FLAG_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 4 }}>
          NOTE (OPTIONAL · MAX 600 CHARS)
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))}
          rows={3} data-testid="flag-note-input"
          placeholder="What's wrong / what should we fix?"
          style={{ width: '100%', background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: 8, fontFamily: 'inherit', fontSize: 12, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onSubmit({ reason, note })} disabled={busy}
          data-testid="flag-submit"
          style={{
            padding: '7px 14px', background: '#E8C26E', color: '#0B0A09', border: 0,
            fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
          }}>{busy ? 'SAVING…' : 'SAVE FLAG'}</button>
        <button type="button" onClick={onCancel} disabled={busy}
          data-testid="flag-cancel"
          style={{
            padding: '7px 14px', background: 'transparent', color: 'var(--muted)',
            border: '1px solid var(--border-strong)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700,
            cursor: 'pointer',
          }}>CANCEL</button>
      </div>
    </div>
  );
};

// ── Single send row inside a channel card.
const SendRow = ({ send, token, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const flag = send.flag;

  const submitFlag = async ({ reason, note }) => {
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/dispatch/logs/${send.id}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ reason, note }),
      });
      if (r.ok) { setEditing(false); onChanged && onChanged(); }
    } finally { setBusy(false); }
  };
  const removeFlag = async () => {
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/admin/dispatch/logs/${send.id}/flag`, {
        method: 'DELETE', headers: { 'X-Admin-Token': token },
      });
      onChanged && onChanged();
    } finally { setBusy(false); }
  };

  return (
    <div data-testid={`send-row-${send.id}`} style={{
      padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--hairline)',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#FFFFFF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {send.recipient}
        </span>
        <span data-testid={`send-mode-${send.id}`} style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700,
          color: send.mode === 'live' ? '#6FA37D' : '#E8C26E',
        }}>{(send.mode || 'dry_run').toUpperCase()}</span>
        {flag ? (
          <button type="button" onClick={removeFlag} disabled={busy}
            data-testid={`flag-pill-${send.id}`}
            title={`${flag.reason}${flag.note ? ' · ' + flag.note : ''}`}
            style={{
              padding: '3px 8px', background: '#2b220e', color: '#E8C26E',
              border: '1px solid #5a4a2b',
              fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em',
              fontWeight: 700, cursor: 'pointer',
            }}>⚑ {flag.reason.toUpperCase()} · CLEAR</button>
        ) : (
          <button type="button" onClick={() => setEditing(!editing)} disabled={busy}
            data-testid={`flag-btn-${send.id}`}
            style={{
              padding: '3px 8px', background: 'transparent', color: 'var(--muted)',
              border: '1px solid var(--border-strong)',
              fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em',
              fontWeight: 700, cursor: 'pointer',
            }}>{editing ? 'CLOSE' : 'FLAG FOR REVIEW'}</button>
        )}
      </div>
      {editing && !flag && (
        <FlagInlineForm onSubmit={submitFlag} onCancel={() => setEditing(false)} busy={busy} />
      )}
    </div>
  );
};

// ── Channel card in the side-by-side preview pane.
const ChannelCard = ({ channel, data, token, onChanged }) => {
  const tone = CHANNEL_TONE[channel];
  const [tab, setTab] = useState('rendered');
  if (!data || !data.recipient_count) {
    return (
      <div data-testid={`channel-card-${channel}-empty`} style={{
        flex: 1, minWidth: 280, padding: 16,
        background: tone.surface, border: `1px solid ${tone.border}`,
      }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: tone.accent, fontWeight: 700, marginBottom: 12 }}>
          {tone.label}
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
          NO SENDS IN THIS CYCLE
        </div>
      </div>
    );
  }
  return (
    <div data-testid={`channel-card-${channel}`} style={{
      flex: 1, minWidth: 280,
      background: tone.surface, border: `1px solid ${tone.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: `1px solid ${tone.border}`,
      }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: tone.accent, fontWeight: 700 }}>
          {tone.label}
        </div>
        <div data-testid={`recipient-count-${channel}`} style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
          {data.recipient_count} <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', color: tone.accent, fontWeight: 700 }}>RECIPIENTS</span>
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${tone.border}` }}>
        {['rendered', 'raw', 'recipients'].map((t) => (
          <button type="button" key={t} onClick={() => setTab(t)}
            data-testid={`tab-${channel}-${t}`}
            style={{
              flex: 1, padding: '8px 6px', background: tab === t ? 'var(--bg)' : 'transparent',
              color: tab === t ? '#FFFFFF' : 'var(--muted)',
              border: 0, borderRight: `1px solid ${tone.border}`,
              fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em',
              fontWeight: 700, cursor: 'pointer',
            }}>{t.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ padding: 14, maxHeight: 480, overflow: 'auto' }}>
        {tab === 'rendered' && (
          <pre data-testid={`rendered-${channel}`} style={{
            margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#FFFFFF',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55,
          }}>{data.rendered_text || '—'}</pre>
        )}
        {tab === 'raw' && (
          <pre data-testid={`raw-${channel}`} style={{
            margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--ink)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
          }}>{JSON.stringify(data.payload || {}, null, 2)}</pre>
        )}
        {tab === 'recipients' && (
          <div data-testid={`recipients-${channel}`}>
            {(data.sends || []).map((s) => (
              <SendRow key={s.id} send={s} token={token} onChanged={onChanged} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const BackOfficeDispatchPreview = () => {
  const { token, setToken, authed, authError, checkAuth } = useBackOfficeToken();
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);

  const loadCycles = useCallback(async () => {
    if (!token || !authed) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/dispatch/cycles?days=${days}&limit=50`, {
        headers: { 'X-Admin-Token': token },
      });
      const j = await r.json();
      setCycles(j.items || []);
      if (!selected && (j.items || []).length > 0) {
        setSelected(j.items[0].id);
      }
    } catch { /* leave previous */ }
  }, [token, authed, days, selected]);

  const loadDetail = useCallback(async () => {
    if (!token || !authed || !selected) { setDetail(null); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/dispatch/cycles/${selected}`, {
        headers: { 'X-Admin-Token': token },
      });
      if (r.ok) setDetail(await r.json());
      else setDetail(null);
    } finally { setLoading(false); }
  }, [token, authed, selected]);

  useEffect(() => { loadCycles(); }, [loadCycles]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const channels = useMemo(() => detail?.per_channel || {}, [detail]);

  if (!authed) {
    return <AuthGate token={token} setToken={setToken} onSubmit={checkAuth} error={authError} title="Dispatch previewer" />;
  }

  return (
    <div data-testid="back-office-dispatch-preview" style={{
      maxWidth: 1480, margin: '0 auto', padding: '32px 32px 64px', color: 'var(--ink)',
    }}>
      <Link to="/back-office" style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em',
        color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
      }}>← BACK-OFFICE</Link>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap', marginTop: 16, marginBottom: 6 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 36,
          letterSpacing: '-0.02em', color: '#FFFFFF', margin: 0,
        }}>Dispatch previewer</h1>
        <Link to="/back-office/optin-segments" data-testid="link-to-overrides" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em',
          color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 4,
        }}>Channel-mode overrides &amp; test-send →</Link>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, maxWidth: 880, lineHeight: 1.55 }}>
        Review the last {days} days of dispatch cycles side-by-side across Email / SMS / Telegram.
        Click any send to flag it (Tone / Factual / Legal / Formatting / Other) — flags drive the
        rollout decision before flipping a segment live.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>WINDOW</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            data-testid="window-select"
            style={{ background: 'var(--bg)', color: '#FFFFFF', border: '1px solid var(--border-strong)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 12 }}>
            <option value={7}>7 DAYS</option>
            <option value={14}>14 DAYS</option>
            <option value={30}>30 DAYS</option>
          </select>
        </label>
        <button type="button" onClick={loadCycles}
          data-testid="refresh-cycles"
          style={{
            padding: '6px 12px', background: 'transparent', color: 'var(--ink)',
            border: '1px solid var(--border-strong)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em',
            fontWeight: 700, cursor: 'pointer',
          }}>↻ REFRESH</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        {/* List */}
        <div data-testid="cycle-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cycles.length === 0 ? (
            <div data-testid="cycle-list-empty" style={{
              color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.14em', padding: 24, border: '1px dashed var(--border)',
            }}>
              NO CYCLES IN WINDOW.
            </div>
          ) : cycles.map((c) => {
            const active = c.id === selected;
            const counts = (c.results || []).reduce((acc, r) => {
              acc[r.channel] = (r.delivered || 0) + (r.dry_run || 0);
              return acc;
            }, {});
            return (
              <button key={c.id} type="button" onClick={() => setSelected(c.id)}
                data-testid={`cycle-card-${c.id}`}
                style={{
                  textAlign: 'left', padding: '12px 14px',
                  background: active ? '#1a1810' : 'var(--surface)',
                  border: `1px solid ${active ? '#E8C26E' : 'var(--hairline)'}`,
                  cursor: 'pointer', color: 'inherit',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>
                    {c.cycle_date}
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.18em', fontWeight: 700,
                    color: c.dry_run ? '#E8C26E' : '#6FA37D' }}>
                    {c.test_send ? 'TEST' : (c.dry_run ? 'DRY-RUN' : 'LIVE')}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)' }}>
                  EMAIL {counts.email || 0} · SMS {counts.sms || 0} · TELEGRAM {counts.telegram || 0}
                </div>
                <div style={{ marginTop: 4, fontFamily: 'ui-monospace, monospace', fontSize: 9.5, color: 'var(--muted)' }}>
                  {fmtDate(c.finished_at || c.started_at)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview pane */}
        <div data-testid="preview-pane">
          {!selected || !detail ? (
            <div data-testid="preview-empty" style={{
              color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.14em', padding: 32, border: '1px dashed var(--border)',
            }}>
              {loading ? 'LOADING…' : 'SELECT A CYCLE TO PREVIEW.'}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', marginBottom: 4 }}>
                    CYCLE
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>
                    {detail.cycle.cycle_date} · {detail.cycle.dry_run ? 'DRY-RUN' : 'LIVE'}
                    {detail.cycle.test_send ? ' · TEST SEND' : ''}
                  </div>
                </div>
                <div data-testid="flag-count" style={{
                  marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.18em',
                  color: detail.flag_count > 0 ? '#E8C26E' : 'var(--muted)', fontWeight: 700,
                }}>
                  ⚑ {detail.flag_count} FLAG{detail.flag_count === 1 ? '' : 'S'}
                </div>
              </div>
              <div data-testid="channel-grid" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <ChannelCard channel="email" data={channels.email} token={token} onChanged={loadDetail} />
                <ChannelCard channel="sms" data={channels.sms} token={token} onChanged={loadDetail} />
                <ChannelCard channel="telegram" data={channels.telegram} token={token} onChanged={loadDetail} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackOfficeDispatchPreview;
