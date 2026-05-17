/**
 * BackOfficeWebhooks — Final Architecture Step 2 operational surface.
 *
 * Per-source health row (Twitch / Kick / YouTube PubSub) with:
 *   • configured flag (env secret present?)
 *   • last-event timestamp + human-readable age
 *   • callback URL display
 *   • YouTube PubSubHubbub lease renewal indicator (yellow ≤48 h, red expired)
 *   • Colour-state: green within expected cadence, yellow stale, red dormant
 *     or sig-verification failure spike (failures count to be wired when
 *     backend tracks them)
 *   • Force-resubscribe button per source (admin POST /api/webhooks/resubscribe/{src})
 *
 * Polls /api/webhooks/status every 30 s.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, RefreshCw, Webhook, AlertTriangle, CheckCircle2, Clock, ArrowUpRight } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 30_000;

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('mittari-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('mittari-admin-token', v); } catch {} }];
};

const fmtAge = (seconds) => {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s sitten`;
  if (s < 3600) return `${Math.floor(s / 60)} min sitten`;
  if (s < 86400) return `${Math.floor(s / 3600)} h sitten`;
  return `${Math.floor(s / 86400)} pv sitten`;
};

const stateForSource = (configured, ageSeconds, expectedSeconds) => {
  if (!configured) return { key: 'dormant', label: 'DORMANT', color: '#7A7E83' };
  if (ageSeconds == null) return { key: 'waiting', label: 'WAITING', color: '#C8A24A' };
  if (ageSeconds <= expectedSeconds) return { key: 'healthy', label: 'HEALTHY', color: '#5FC79F' };
  if (ageSeconds <= expectedSeconds * 3) return { key: 'stale', label: 'STALE', color: '#E8924A' };
  return { key: 'failing', label: 'FAILING', color: '#C8423C' };
};

const PubsubLeaseIndicator = ({ lease }) => {
  if (!lease || lease.seconds_remaining == null) {
    return (
      <div className="mono inline-flex items-center gap-2"
           style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}
           data-testid="pubsub-lease-indicator-none">
        <Clock strokeWidth={1.5} size={12} />
        PUBSUB LEASE · NOT SUBSCRIBED
      </div>
    );
  }
  const secs = lease.seconds_remaining;
  const days = Math.floor(Math.abs(secs) / 86400);
  let color = '#5FC79F';
  let label = `${days} pv`;
  if (secs <= 0) { color = '#C8423C'; label = 'EXPIRED'; }
  else if (secs <= 48 * 3600) { color = '#C8A24A'; label = `${Math.floor(secs / 3600)} h LEFT`; }
  return (
    <div className="mono inline-flex items-center gap-2"
         style={{ fontSize: 10.5, letterSpacing: '0.18em', color, fontWeight: 700 }}
         data-testid={`pubsub-lease-indicator-${secs <= 0 ? 'expired' : secs <= 48 * 3600 ? 'expiring' : 'healthy'}`}>
      <Clock strokeWidth={1.7} size={12} />
      YOUTUBE PUBSUB LEASE · {label}
    </div>
  );
};

const SourceRow = ({ source, status, expectedSeconds, lastEvent, onResubscribe, busy }) => {
  const ageSeconds = lastEvent?.last_event_age_seconds;
  const ev = lastEvent?.last_event;
  const callbackUrl = status?.callback_urls?.[source] || '';
  const configured = !!status?.[`${source}_configured`];
  const st = stateForSource(configured, ageSeconds, expectedSeconds);

  return (
    <div className="panel"
         style={{ padding: '18px 20px', borderLeft: `3px solid ${st.color}` }}
         data-testid={`webhook-source-row-${source}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-3 mb-2">
            <div className="mono inline-flex items-center gap-2"
                 style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}>
              <Webhook strokeWidth={1.7} size={13} />
              {source.toUpperCase()}
            </div>
            <span className="mono inline-flex items-center gap-1.5 px-2 py-1"
                  style={{ background: 'var(--bg)', fontSize: 9.5, letterSpacing: '0.20em', color: st.color, fontWeight: 700, borderRadius: 3 }}
                  data-testid={`webhook-state-${source}`}>
              <span className="led" style={{ background: st.color, width: 6, height: 6 }} />
              {st.label}
            </span>
            {configured ? (
              <span className="mono inline-flex items-center gap-1"
                    style={{ fontSize: 9.5, letterSpacing: '0.18em', color: '#5FC79F', fontWeight: 600 }}>
                <CheckCircle2 strokeWidth={1.7} size={11} /> CONFIGURED
              </span>
            ) : (
              <span className="mono inline-flex items-center gap-1"
                    style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--muted)', fontWeight: 600 }}>
                <AlertTriangle strokeWidth={1.7} size={11} /> SECRET MISSING
              </span>
            )}
          </div>

          <div className="mono mb-1.5" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 500 }}>
            <span style={{ color: 'var(--ink)' }}>LAST EVENT:</span>{' '}
            {ev ? `${ev.event_type} · ${fmtAge(ageSeconds)}` : 'EI VIESTEJÄ VIELÄ'}
          </div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'var(--muted)', fontWeight: 500 }}>
            <span style={{ color: 'var(--ink)' }}>CALLBACK:</span>{' '}
            <span style={{ wordBreak: 'break-all' }} data-testid={`webhook-callback-${source}`}>
              {callbackUrl || '— (set ' + (source === 'twitch' ? 'TWITCH_EVENTSUB_CALLBACK_URL' : source === 'kick' ? 'KICK_WEBHOOK_URL' : 'YOUTUBE_PUBSUB_CALLBACK_URL') + ')'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onResubscribe(source)}
            disabled={busy === source}
            className="btn-ghost mono"
            style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700 }}
            data-testid={`webhook-resubscribe-${source}`}
          >
            <RefreshCw strokeWidth={1.7} size={12} className="mr-1.5" />
            {busy === source ? 'WORKING…' : 'FORCE RESUBSCRIBE'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BackOfficeWebhooks = () => {
  const [token, setToken] = useToken();
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [lastAction, setLastAction] = useState(null);

  const headers = useCallback((tok = token) => ({ 'Content-Type': 'application/json', 'X-Admin-Token': tok }), [token]);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/webhooks/status`);
      if (!r.ok) return;
      const d = await r.json();
      setStatus(d);
    } catch {}
  }, []);

  const tryAuth = useCallback(async (tok = token) => {
    if (!tok) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, { headers: headers(tok) });
      if (!r.ok) { setAuthError('Wrong token'); setAuthed(false); return; }
      setAuthed(true);
      setAuthError('');
      await fetchStatus();
    } catch {
      setAuthError('Network error');
    }
  }, [token, headers, fetchStatus]);

  useEffect(() => {
    if (!authed) return;
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [authed, fetchStatus]);

  const onResubscribe = useCallback(async (source) => {
    setBusy(source);
    setLastAction(null);
    try {
      const r = await fetch(`${BACKEND}/api/webhooks/resubscribe/${source}`, {
        method: 'POST',
        headers: headers(),
      });
      const raw = await r.text();
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      setLastAction({ source, status: r.status, body });
    } catch (e) {
      setLastAction({ source, status: 0, body: { detail: String(e) } });
    } finally {
      setBusy(null);
      fetchStatus();
    }
  }, [headers, fetchStatus]);

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="container-wide py-16" data-testid="webhooks-admin-auth">
          <div className="panel p-8 max-w-md mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Lock strokeWidth={1.6} size={16} />
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}>
                BACK-OFFICE · WEBHOOKS
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const t = (new FormData(e.currentTarget).get('token') || token || '').toString().trim();
              setToken(t);
              tryAuth(t);
            }}>
              <input
                name="token"
                type="password"
                defaultValue={token}
                placeholder="X-Admin-Token"
                className="mono w-full"
                style={{ padding: '14px', border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, letterSpacing: '0.08em', borderRadius: 4 }}
                data-testid="webhooks-admin-token-input"
              />
              {authError ? (
                <div className="mono mt-3" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: '#C8423C', fontWeight: 600 }}>
                  {authError.toUpperCase()}
                </div>
              ) : null}
              <button type="submit" className="btn-primary w-full mt-4" data-testid="webhooks-admin-auth-submit">
                UNLOCK →
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const sources = [
    { key: 'twitch', expected: status?.expected_cadence_seconds?.twitch ?? 3600 },
    { key: 'kick',   expected: status?.expected_cadence_seconds?.kick ?? 3600 },
    { key: 'youtube', expected: status?.expected_cadence_seconds?.youtube ?? 86400 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }} data-testid="back-office-webhooks">
      <div className="container-wide py-10">
        <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
          <div>
            <div className="eyebrow mb-2">BACK-OFFICE · WEBHOOKS</div>
            <h1 className="display text-3xl">Signaalivastaanottimet</h1>
            <p className="font-serif mt-2" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 640 }}>
              Twitch EventSub, Kick livestream, YouTube PubSubHubbub. Värikoodi näyttää onko vastaanotin terveessä kadensseissa.
              Päivitys joka 30 s. Force resubscribe palauttaa tilauksen kun signaalit ovat olleet hiljaa odotettua kauemmin.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/back-office" className="btn-ghost mono" data-testid="webhooks-admin-back">
              ← BACK-OFFICE
            </Link>
            <button onClick={fetchStatus} className="btn-ghost mono" data-testid="webhooks-admin-refresh">
              <RefreshCw strokeWidth={1.7} size={12} className="mr-1.5" /> REFRESH
            </button>
          </div>
        </div>

        <div className="panel mb-6" style={{ padding: '16px 20px' }} data-testid="webhooks-pubsub-lease-panel">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <PubsubLeaseIndicator lease={status?.youtube_pubsub_lease} />
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 600 }}
                 data-testid="webhooks-server-now">
              SERVER · {status?.now ? status.now.replace('T', ' ').slice(0, 19) : '—'} UTC
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3" data-testid="webhook-source-rows">
          {sources.map((s) => (
            <SourceRow
              key={s.key}
              source={s.key}
              status={status}
              expectedSeconds={s.expected}
              lastEvent={status?.last_webhook_signal_by_source?.[s.key]}
              onResubscribe={onResubscribe}
              busy={busy}
            />
          ))}
        </div>

        {lastAction ? (
          <div className="panel mt-6" style={{ padding: '14px 16px' }} data-testid="webhooks-last-action">
            <div className="mono mb-2" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--ink)', fontWeight: 700 }}>
              LAST ACTION · {lastAction.source.toUpperCase()} · HTTP {lastAction.status}
            </div>
            <pre className="mono" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(lastAction.body, null, 2)}
            </pre>
          </div>
        ) : null}

        <div className="mt-8 mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600, lineHeight: 1.7 }}>
          <div>
            <Link to="/back-office/queue" className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
              QUEUE <ArrowUpRight strokeWidth={1.6} size={11} />
            </Link>
            {' · '}
            <Link to="/back-office/operators" className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
              OPERATORS <ArrowUpRight strokeWidth={1.6} size={11} />
            </Link>
            {' · '}
            <Link to="/back-office/streamers" className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
              STREAMERS <ArrowUpRight strokeWidth={1.6} size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackOfficeWebhooks;
