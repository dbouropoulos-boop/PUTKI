/**
 * BackOfficePlaybook — upload PDF playbook + monitor outbound queue.
 *
 * Single-doc model: admin uploads ONE universal PDF. Every Voita lock-in
 * triggers an email_outbox row with that PDF attached. When RESEND_API_KEY
 * is configured, the send-worker flushes the queue automatically.
 *
 * Endpoints used:
 *   GET  /api/admin/playbook                  → { current, outbox }
 *   POST /api/admin/playbook/upload  (PDF)    → updates current
 *   GET  /api/admin/playbook/download         → streams current PDF
 *   POST /api/admin/playbook/outbox/{id}/resend
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fmtKb = (b) => (b == null ? '—' : `${(b / 1024).toFixed(1)} KB`);
const fmtIso = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('fi-FI'); } catch { return iso; }
};

const StatusPill = ({ status }) => {
  const tone = status === 'sent' ? '#6FA37D'
    : status === 'failed' ? '#C13B2C'
    : status === 'sending' ? '#5BA0E8' : '#E89248';
  return (
    <span style={{
      padding: '2px 8px', fontFamily: 'ui-monospace, monospace',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.16em',
      color: tone, border: `1px solid ${tone}`,
      textTransform: 'uppercase',
    }}>{status || 'pending'}</span>
  );
};

const BackOfficePlaybook = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const headers = useMemo(() => ({ 'X-Admin-Token': token }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/playbook`, { headers });
      if (r.ok) setData(await r.json());
    } catch (e) { setStatus(`Network: ${e.message}`); }
  }, [headers, token]);

  useEffect(() => { if (authed) refresh(); }, [authed, refresh]);
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [authed, refresh]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus('File >5 MB — please slim down'); return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('PDF only'); return;
    }
    setBusy(true); setStatus('Uploading…');
    const fd = new FormData();
    fd.append('file', file, file.name);
    try {
      const r = await fetch(`${BACKEND}/api/admin/playbook/upload`, {
        method: 'POST', headers, body: fd,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setStatus(`Upload failed: ${j.detail || r.status}`);
        return;
      }
      setStatus('✓ Uploaded · new entries will attach this PDF immediately');
      await refresh();
    } catch (err) { setStatus(`Network: ${err.message}`); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const resend = async (id) => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/playbook/outbox/${id}/resend`, {
        method: 'POST', headers,
      });
      if (!r.ok) { setStatus(`Resend failed (${r.status})`); return; }
      setStatus('✓ Marked pending — worker will retry');
      refresh();
    } catch (e) { setStatus(`Network: ${e.message}`); }
  };

  const downloadHref = `${BACKEND}/api/admin/playbook/download`;

  if (!authed) return <AuthGate authError={authError} setToken={setToken} onSubmit={checkAuth} />;

  const cur = data?.current;
  const outbox = data?.outbox || { counts: {}, rows: [] };
  const counts = outbox.counts || {};

  return (
    <div data-testid="bo-playbook-page" style={{
      maxWidth: 1180, margin: '0 auto', padding: '40px 32px 80px',
      color: 'var(--ink, #ECE6D8)',
    }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/back-office" style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          color: 'var(--muted)', letterSpacing: '0.08em', textDecoration: 'none',
        }}>← BACK OFFICE</Link>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 400,
          margin: '6px 0 0', letterSpacing: '-0.02em',
        }}>Playbook · <em style={{ color: '#E89248', fontStyle: 'italic' }}>upload + queue</em></h1>
        <p style={{
          margin: '6px 0 0', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em',
        }}>One universal PDF · attached to every Voita lock-in welcome email.</p>
      </header>

      {status && (
        <div data-testid="bo-pb-status" style={{
          marginBottom: 16, padding: '10px 14px',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          color: status.startsWith('✓') ? '#6FA37D' : (status.toLowerCase().includes('fail') || status.toLowerCase().includes('error') || status.toLowerCase().includes('network')) ? '#C13B2C' : 'var(--ink)',
          letterSpacing: '0.04em',
        }}>{status}</div>
      )}

      {/* Current PDF card */}
      <section style={{
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        padding: 24, marginBottom: 28,
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.22em', color: '#E89248', fontWeight: 700,
            marginBottom: 8,
          }}>CURRENT PLAYBOOK</div>
          {cur ? (
            <>
              <div data-testid="bo-pb-current-name" style={{
                fontFamily: 'Georgia, serif', fontSize: 22, lineHeight: 1.2,
                color: 'var(--ink)', letterSpacing: '-0.01em',
              }}>{cur.filename}</div>
              <div style={{
                marginTop: 6, fontFamily: 'ui-monospace, monospace',
                fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em',
              }}>{fmtKb(cur.size_bytes)} · uploaded {fmtIso(cur.uploaded_at)} · sha {String(cur.sha256 || '').slice(0, 12)}…</div>
            </>
          ) : (
            <div data-testid="bo-pb-empty" style={{
              fontFamily: 'Georgia, serif', fontSize: 18, fontStyle: 'italic',
              color: 'var(--muted)',
            }}>No playbook uploaded yet — entries are still queued, the PDF attaches automatically once you upload.</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label data-testid="bo-pb-upload-label" htmlFor="bo-pb-upload-input" style={{
            background: '#E89248', color: '#0A0A0B',
            padding: '12px 18px', textAlign: 'center',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            fontWeight: 800, letterSpacing: '0.16em',
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}>{busy ? 'UPLOADING…' : (cur ? 'REPLACE PDF' : 'UPLOAD PDF')}</label>
          <input id="bo-pb-upload-input" data-testid="bo-pb-upload-input"
            type="file" accept="application/pdf" disabled={busy}
            onChange={onUpload}
            style={{ display: 'none' }} />
          {cur && (
            <a href={downloadHref} target="_blank" rel="noopener noreferrer"
              data-testid="bo-pb-preview-link" style={{
                background: 'transparent', color: 'var(--ink)',
                padding: '10px 18px', textAlign: 'center',
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                letterSpacing: '0.10em', textDecoration: 'none',
                border: '1px solid var(--hairline)',
              }}>PREVIEW ↗</a>
          )}
        </div>
      </section>

      {/* Queue summary */}
      <section data-testid="bo-pb-queue" style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: 12, flexWrap: 'wrap', gap: 12,
        }}>
          <h2 style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)',
            margin: 0, textTransform: 'uppercase',
          }}>EMAIL QUEUE</h2>
          <div style={{
            display: 'flex', gap: 18, flexWrap: 'wrap',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            color: 'var(--muted)',
          }}>
            {['pending', 'sending', 'sent', 'failed'].map((k) => (
              <span key={k} data-testid={`bo-pb-count-${k}`}>
                <span style={{ letterSpacing: '0.18em' }}>{k.toUpperCase()}</span>{' '}
                <strong style={{ color: 'var(--ink)' }}>{counts[k] || 0}</strong>
              </span>
            ))}
            {outbox.tracking && (
              <>
                <span data-testid="bo-pb-tracking-opens" style={{ color: 'var(--muted)' }}>
                  <span style={{ letterSpacing: '0.18em' }}>OPENS</span>{' '}
                  <strong style={{ color: '#6FA37D' }}>{outbox.tracking.opens_total || 0}</strong>
                </span>
                <span data-testid="bo-pb-tracking-clicks" style={{ color: 'var(--muted)' }}>
                  <span style={{ letterSpacing: '0.18em' }}>CLICKS</span>{' '}
                  <strong style={{ color: '#6FA37D' }}>{outbox.tracking.clicks_total || 0}</strong>
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{
          border: '1px solid var(--hairline)', background: 'var(--hairline)',
          display: 'flex', flexDirection: 'column', gap: 1,
        }}>
          {outbox.rows.length === 0 && (
            <div style={{
              background: 'var(--surface)', padding: '24px 20px',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              color: 'var(--muted)', letterSpacing: '0.04em', textAlign: 'center',
            }}>No queued messages yet.</div>
          )}
          {outbox.rows.map((r) => (
            <div key={r.id} data-testid={`bo-pb-row-${r.id}`} style={{
              background: 'var(--surface)', padding: '14px 18px',
              display: 'grid', gridTemplateColumns: '180px 1fr 90px auto auto', gap: 18,
              alignItems: 'center',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
            }}>
              <span style={{ color: 'var(--muted)' }}>{fmtIso(r.scheduled_at)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--ink)' }}>
                  <strong>{r.to_name || '(no name)'}</strong> &lt;{r.to}&gt;
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                  {r.subject}{r.missing_attachment ? ' · ⚠ awaits playbook' : ''}
                  {r.last_error ? ` · ${r.last_error}` : ''}
                </div>
              </div>
              <div data-testid={`bo-pb-row-tracking-${r.id}`} style={{
                color: 'var(--muted)', fontSize: 10, letterSpacing: '0.06em',
                textAlign: 'right', lineHeight: 1.5,
              }}>
                <div>OPEN <strong style={{ color: (r.open_count || 0) > 0 ? '#6FA37D' : 'var(--muted)' }}>{r.open_count || 0}</strong></div>
                <div>CLICK <strong style={{ color: (r.click_count || 0) > 0 ? '#6FA37D' : 'var(--muted)' }}>{r.click_count || 0}</strong></div>
              </div>
              <StatusPill status={r.status} />
              {r.status !== 'sent' && (
                <button type="button"
                  data-testid={`bo-pb-resend-${r.id}`}
                  onClick={() => resend(r.id)} style={{
                    padding: '6px 12px', background: 'transparent',
                    color: '#E89248', border: '1px dashed #E89248',
                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                    letterSpacing: '0.14em', cursor: 'pointer',
                  }}>RETRY →</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <p style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
        color: 'var(--muted)', letterSpacing: '0.04em', lineHeight: 1.6,
      }}>
        Send-worker flushes <strong>pending → sending → sent</strong> once <code>RESEND_API_KEY</code> is set in <code>backend/.env</code>.
        Until then, every lock-in still queues correctly — the worker drains the backlog on first run.
      </p>
    </div>
  );
};

export default BackOfficePlaybook;
