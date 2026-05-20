/**
 * PUTKI HQ — BackOfficeTelegram.
 *
 * One-pane monitoring for the Telegram pipeline introduced in Sprint B:
 *   - Webhook info + one-click re-register
 *   - Bound Voita raffle entries (telegram_chat_id present)
 *   - Mittari subscribers (total / active+bound / 24h fresh)
 *   - Update audit log (last N webhook hits with handler verdict)
 *   - PUTKI lead summary (cross-surface lead counts piggybacked here)
 *
 * Read-only except the "Re-set webhook" action which calls
 * POST /api/admin/telegram/set-webhook with the current preview URL.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBackOfficeToken, AuthGate } from '../hooks/useBackOfficeToken';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Pill = ({ label, value, hint, tone = 'ink' }) => {
  const colorMap = {
    ink: 'var(--ink)',
    accent: '#E8C26E',
    ok: '#6FA37D',
    warn: '#D4B445',
    err: '#C13B2C',
  };
  return (
    <div data-testid={`bo-tg-stat-${label.toLowerCase().replace(/\s+/g, '-')}`} style={{
      flex: 1, minWidth: 140,
      padding: '14px 16px',
      background: 'var(--surface, #141210)',
      border: '1px solid var(--hairline, #221E1B)',
    }}>
      <div style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
        letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
        marginBottom: 6,
      }}>{label.toUpperCase()}</div>
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700,
        color: colorMap[tone] || colorMap.ink,
        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {hint && (
        <div style={{
          marginTop: 6, fontFamily: 'ui-monospace, monospace',
          fontSize: 10, color: 'var(--muted)', letterSpacing: '0.04em',
        }}>{hint}</div>
      )}
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontFamily: 'ui-monospace, monospace', fontSize: 11,
    letterSpacing: '0.24em', fontWeight: 700, color: 'var(--ink)',
    margin: '32px 0 12px', textTransform: 'uppercase',
  }}>{children}</h2>
);

const BackOfficeTelegram = () => {
  const { token, authed, authError, checkAuth, setToken } = useBackOfficeToken();
  const [hookInfo, setHookInfo] = useState(null);
  const [boundEntries, setBoundEntries] = useState(null);
  const [subscribers, setSubscribers] = useState(null);
  const [logEntries, setLogEntries] = useState(null);
  const [leadSummary, setLeadSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const headers = useMemo(() => ({
    'Content-Type': 'application/json', 'X-Admin-Token': token,
  }), [token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    const j = async (path) => {
      try {
        const r = await fetch(`${BACKEND}/api${path}`, { headers });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    };
    const [hi, be, subs, log, leads] = await Promise.all([
      j('/admin/telegram/webhook-info'),
      j('/admin/telegram/bound-entries?limit=20'),
      j('/admin/mittari/subscribers?limit=20'),
      j('/admin/telegram/log?limit=30'),
      j('/admin/leads/summary'),
    ]);
    setHookInfo(hi);
    setBoundEntries(be);
    setSubscribers(subs);
    setLogEntries(log);
    setLeadSummary(leads);
  }, [headers, token]);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const onResetWebhook = useCallback(async () => {
    if (busy) return;
    setBusy(true); setActionMsg('');
    const targetUrl = `${BACKEND}/api/webhooks/telegram`;
    try {
      const r = await fetch(`${BACKEND}/api/admin/telegram/set-webhook`, {
        method: 'POST', headers,
        body: JSON.stringify({ url: targetUrl, drop_pending_updates: true }),
      });
      const j = await r.json();
      if (j.ok) setActionMsg(`✓ Webhook registered to ${targetUrl}`);
      else setActionMsg(`✗ ${j.description || j.error || 'unknown error'}`);
      await fetchAll();
    } catch (e) {
      setActionMsg(`✗ ${e.message}`);
    } finally { setBusy(false); }
  }, [busy, headers, fetchAll]);

  if (!authed) {
    return <AuthGate token={token} setToken={setToken} onSubmit={checkAuth}
              error={authError} title="Back-office · Telegram" />;
  }

  const wh = hookInfo?.result || hookInfo || {};
  const whUrl = wh.url || '';
  const whHealthy = !!whUrl && !wh.last_error_message;
  const pendingUpdates = wh.pending_update_count || 0;

  return (
    <div data-testid="bo-telegram-page" style={{
      maxWidth: 1080, margin: '0 auto',
      padding: 'clamp(20px, 4vw, 40px)',
      color: 'var(--ink)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 14, flexWrap: 'wrap', marginBottom: 20,
      }}>
        <div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            letterSpacing: '0.24em', color: '#E8C26E', fontWeight: 700,
            marginBottom: 6,
          }}>BACK-OFFICE · TELEGRAM</div>
          <h1 style={{
            fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700,
            margin: 0, letterSpacing: '-0.015em',
          }}>Bot pipeline monitor</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={fetchAll}
            data-testid="bo-tg-refresh"
            style={{
              padding: '10px 16px', background: 'var(--surface)',
              color: 'var(--ink)', border: '1px solid var(--border-strong, #3A322B)',
              fontFamily: 'ui-monospace, monospace', fontSize: 11,
              letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
            }}>↻ REFRESH</button>
          <Link to="/back-office" data-testid="bo-tg-back" style={{
            padding: '10px 16px', background: 'transparent',
            color: 'var(--muted)', textDecoration: 'none',
            border: '1px solid var(--hairline)',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.18em', fontWeight: 700,
          }}>← BACK-OFFICE</Link>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4,
      }}>
        <Pill label="WEBHOOK" value={whHealthy ? '✓ LIVE' : '✗ OFF'}
          hint={whUrl ? whUrl.replace(/^https?:\/\//, '').slice(0, 28) + '…' : 'not registered'}
          tone={whHealthy ? 'ok' : 'err'} />
        <Pill label="PENDING UPDATES" value={pendingUpdates}
          tone={pendingUpdates > 10 ? 'warn' : 'ink'}
          hint="Queued on Telegram side" />
        <Pill label="VOITA BOUND" value={leadSummary?.telegram?.voita_bound ?? '—'}
          hint="entries w/ chat_id" tone="accent" />
        <Pill label="MITTARI BOUND" value={leadSummary?.telegram?.mittari_bound_active ?? '—'}
          hint="active subscribers" tone="accent" />
      </div>

      {/* Pointer to editable copy */}
      <div data-testid="bo-tg-copy-pointer" style={{
        marginTop: 14, padding: '10px 14px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        color: 'var(--muted)', letterSpacing: '0.04em',
      }}>
        Welcome + post-bind copy is now templated.{' '}
        <Link to="/back-office/email-templates" data-testid="bo-tg-copy-pointer-link"
          style={{ color: '#5B8DEE', textDecoration: 'underline' }}>
          Edit `telegram_welcome` + `telegram_bound` in the templates editor →
        </Link>
      </div>

      {/* Webhook info detail + reset */}
      <SectionTitle>Webhook registration</SectionTitle>
      <div style={{
        padding: '18px 20px',
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.20em', color: 'var(--muted)', marginBottom: 4 }}>URL</div>
          <div data-testid="bo-tg-webhook-url" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            color: 'var(--ink)', wordBreak: 'break-all',
          }}>{whUrl || '— not set —'}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.20em', color: 'var(--muted)', marginBottom: 4 }}>LAST ERROR</div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            color: wh.last_error_message ? '#C13B2C' : '#6FA37D',
          }}>{wh.last_error_message || '— none —'}</div>
          {wh.last_error_date && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              at {new Date(wh.last_error_date * 1000).toLocaleString()}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.20em', color: 'var(--muted)', marginBottom: 4 }}>ALLOWED UPDATES</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            {(wh.allowed_updates || []).join(', ') || 'all'}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5,
            letterSpacing: '0.20em', color: 'var(--muted)', marginBottom: 4 }}>IP ADDRESS</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            {wh.ip_address || '—'}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <button type="button" onClick={onResetWebhook} disabled={busy}
          data-testid="bo-tg-reset-webhook"
          style={{
            padding: '12px 22px',
            background: busy ? 'var(--surface)' : '#E8C26E',
            color: busy ? 'var(--muted)' : '#0B0A09',
            border: 0, cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            letterSpacing: '0.22em', fontWeight: 800,
          }}>{busy ? 'REGISTERING…' : '↻ RE-SET WEBHOOK TO THIS HOST'}</button>
        {actionMsg && (
          <span data-testid="bo-tg-action-result" style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 11,
            color: actionMsg.startsWith('✓') ? '#6FA37D' : '#C13B2C',
            letterSpacing: '0.04em',
          }}>{actionMsg}</span>
        )}
      </div>

      {/* Cross-surface lead summary */}
      <SectionTitle>PUTKI leads · acquisition snapshot</SectionTitle>
      <div data-testid="bo-tg-leads" style={{
        padding: '16px 20px',
        background: 'var(--surface)', border: '1px solid var(--hairline)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
          {['mestari', 'voita', 'mittari'].map((s) => {
            const tot = leadSummary?.counts?.[s] ?? 0;
            const fresh = leadSummary?.fresh_24h?.[s] ?? 0;
            return (
              <div key={s} data-testid={`bo-tg-lead-${s}`}>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  letterSpacing: '0.22em', color: 'var(--muted)', fontWeight: 700,
                  marginBottom: 4,
                }}>{s.toUpperCase()}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{tot}</div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 10,
                  color: fresh > 0 ? '#6FA37D' : 'var(--muted)', marginTop: 2,
                }}>+{fresh} / 24h</div>
              </div>
            );
          })}
          <div data-testid="bo-tg-lead-total">
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.22em', color: '#E8C26E', fontWeight: 700,
              marginBottom: 4,
            }}>TOTAL</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#E8C26E' }}>
              {leadSummary?.counts?.total ?? 0}
            </div>
            <div style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              color: 'var(--muted)', marginTop: 2,
            }}>across all surfaces</div>
          </div>
        </div>
      </div>

      {/* Voita bound entries */}
      <SectionTitle>Voita raffle · bound entries (latest 20)</SectionTitle>
      {!boundEntries || !boundEntries.items?.length ? (
        <div data-testid="bo-tg-no-bound-entries" style={{
          padding: 22, color: 'var(--muted)', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.18em',
        }}>NO BOUND ENTRIES YET</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)' }}>
          <table data-testid="bo-tg-bound-table" style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
            color: 'var(--ink)',
          }}>
            <thead style={{ background: 'var(--surface)' }}>
              <tr>
                {['BOUND AT', 'RAFFLE', 'CHAT ID', 'USERNAME', 'PICK', 'SCORE', 'CONF'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontWeight: 700, letterSpacing: '0.16em',
                    color: 'var(--muted)', fontSize: 10,
                    borderBottom: '1px solid var(--hairline)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boundEntries.items.map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {e.telegram_bound_at ? new Date(e.telegram_bound_at).toLocaleString().slice(0, 16) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.raffle_slug}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>{e.telegram_chat_id}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {e.telegram_username ? `@${e.telegram_username}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)', color: '#E8C26E' }}>
                    {e.prediction_one_x_two || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {e.predicted_home_goals}–{e.predicted_away_goals}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {e.confidence ? `${e.confidence}/5` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mittari subscribers */}
      <SectionTitle>Mittari · signal subscribers</SectionTitle>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <Pill label="TOTAL ROWS" value={subscribers?.total ?? '—'} tone="ink" />
        <Pill label="ACTIVE+BOUND" value={subscribers?.active_bound ?? '—'} tone="ok"
          hint="receiving pings" />
        <Pill label="LATEST PAGE" value={subscribers?.count ?? '—'} tone="ink" hint="page size 20" />
      </div>
      {!subscribers || !subscribers.items?.length ? (
        <div data-testid="bo-tg-no-subscribers" style={{
          padding: 22, color: 'var(--muted)', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.18em',
        }}>NO SUBSCRIBERS YET</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)' }}>
          <table data-testid="bo-tg-subscribers-table" style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: 'var(--ink)',
          }}>
            <thead style={{ background: 'var(--surface)' }}>
              <tr>
                {['BOUND AT', 'CHAT ID', 'USERNAME', 'ACTIVE'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontWeight: 700, letterSpacing: '0.16em',
                    color: 'var(--muted)', fontSize: 10,
                    borderBottom: '1px solid var(--hairline)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscribers.items.map((s, i) => (
                <tr key={s.pending_id || i}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {s.telegram_bound_at ? new Date(s.telegram_bound_at).toLocaleString().slice(0, 16) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {s.telegram_chat_id || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                    {s.telegram_username ? `@${s.telegram_username}` : '—'}
                  </td>
                  <td style={{
                    padding: '10px 12px', borderBottom: '1px solid var(--hairline)',
                    color: s.active && s.telegram_chat_id ? '#6FA37D' : 'var(--muted)',
                  }}>
                    {s.active && s.telegram_chat_id ? '✓ active' : (s.active ? 'pending' : 'stopped')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit log */}
      <SectionTitle>Webhook · audit log (latest 30)</SectionTitle>
      {!logEntries || !logEntries.items?.length ? (
        <div data-testid="bo-tg-no-log" style={{
          padding: 22, color: 'var(--muted)', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--hairline)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          letterSpacing: '0.18em',
        }}>NO WEBHOOK HITS LOGGED</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)' }}>
          <table data-testid="bo-tg-log-table" style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: 'var(--ink)',
          }}>
            <thead style={{ background: 'var(--surface)' }}>
              <tr>
                {['RECEIVED', 'UPDATE_ID', 'CHAT_ID', 'KIND', 'HANDLED'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontWeight: 700, letterSpacing: '0.16em',
                    color: 'var(--muted)', fontSize: 10,
                    borderBottom: '1px solid var(--hairline)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logEntries.items.map((row, i) => {
                const r = row.result || {};
                const handled = r.handled;
                return (
                  <tr key={row.update_id || i}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                      {row.received_at ? new Date(row.received_at).toLocaleString().slice(0, 16) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                      {row.update_id || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)' }}>
                      {row.chat_id || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--hairline)', color: '#E8C26E' }}>
                      {r.kind || '—'}
                    </td>
                    <td style={{
                      padding: '10px 12px', borderBottom: '1px solid var(--hairline)',
                      color: handled ? '#6FA37D' : '#C13B2C',
                    }}>{handled ? '✓' : '✗'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{
        marginTop: 36, color: 'var(--muted)',
        fontFamily: 'ui-monospace, monospace', fontSize: 11,
        letterSpacing: '0.04em', lineHeight: 1.55,
      }}>
        Audit log auto-grows from <code>/api/webhooks/telegram</code>. Subscribers can self-unsubscribe via <code>/stop</code>.
        Telegram delivery failures (chat blocked / not started) are silently ignored and logged at debug level.
      </p>
    </div>
  );
};

export default BackOfficeTelegram;
