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
import { Lock, RefreshCw, Webhook, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Hammer, Loader2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const FEED_REBUILD_TIMESTAMP_KEY = 'putki-hq-admin-last-feed-rebuild';

const fmtUtcStamp = (iso) => {
  if (!iso) return '—';
  try { return iso.replace('T', ' ').slice(0, 19) + ' UTC'; } catch { return iso; }
};
const POLL_MS = 30_000;

const useToken = () => {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('putki-hq-admin-token') || ''; } catch { return ''; }
  });
  return [token, (v) => { setToken(v); try { localStorage.setItem('putki-hq-admin-token', v); } catch {} }];
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

const Stat = ({ label, value, testid }) => (
  <div className="panel" style={{ padding: '10px 12px', background: 'var(--bg)' }} data-testid={testid}>
    <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.20em', color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
    <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 4 }}>
      {typeof value === 'number' ? value : '—'}
    </div>
  </div>
);


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

  // Force-rebuild state — persists last-rebuild timestamp + result across reloads.
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(() => {
    try {
      const raw = localStorage.getItem(FEED_REBUILD_TIMESTAMP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [rebuildError, setRebuildError] = useState('');

  // Twitch verify state — surfaces OAuth probe + subscription summary.
  const [twitchVerifyBusy, setTwitchVerifyBusy] = useState(false);
  const [twitchVerifyResult, setTwitchVerifyResult] = useState(null);
  const [twitchVerifyError, setTwitchVerifyError] = useState('');

  // Kick verify state.
  const [kickVerifyBusy, setKickVerifyBusy] = useState(false);
  const [kickVerifyResult, setKickVerifyResult] = useState(null);
  const [kickVerifyError, setKickVerifyError] = useState('');

  // YouTube verify state.
  const [youtubeVerifyBusy, setYoutubeVerifyBusy] = useState(false);
  const [youtubeVerifyResult, setYoutubeVerifyResult] = useState(null);
  const [youtubeVerifyError, setYoutubeVerifyError] = useState('');

  // Pending confirm dialog for force-resubscribe (dry-run preview).
  const [pendingConfirm, setPendingConfirm] = useState(null);

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
    // First leg: dry-run preview. Confirm modal opens before the real call.
    setBusy(source);
    setLastAction(null);
    try {
      const r = await fetch(`${BACKEND}/api/webhooks/resubscribe/${source}?dry_run=true`, {
        method: 'POST',
        headers: headers(),
      });
      const raw = await r.text();
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      if (!r.ok) {
        setLastAction({ source, status: r.status, body });
        return;
      }
      setPendingConfirm({ source, dryRun: body });
    } catch (e) {
      setLastAction({ source, status: 0, body: { detail: String(e) } });
    } finally {
      setBusy(null);
    }
  }, [headers]);

  const onConfirmResubscribe = useCallback(async () => {
    if (!pendingConfirm) return;
    const source = pendingConfirm.source;
    setPendingConfirm(null);
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
  }, [headers, fetchStatus, pendingConfirm]);

  const onForceRebuild = useCallback(async () => {
    setRebuildBusy(true);
    setRebuildError('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/feed/rebuild`, {
        method: 'POST',
        headers: headers(),
      });
      const raw = await r.text();
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      if (!r.ok) {
        setRebuildError(`HTTP ${r.status} · ${body.detail || raw || 'tuntematon virhe'}`);
        return;
      }
      const summary = {
        rebuilt_at: body.rebuilt_at,
        candidates: body.candidates,
        upserted: body.upserted,
        pruned: body.pruned,
        signals_scanned: body.signals_scanned,
        published_scanned: body.published_scanned,
        triggered_at: new Date().toISOString(),
      };
      setRebuildResult(summary);
      try { localStorage.setItem(FEED_REBUILD_TIMESTAMP_KEY, JSON.stringify(summary)); } catch {}
    } catch (e) {
      setRebuildError(String(e));
    } finally {
      setRebuildBusy(false);
    }
  }, [headers]);

  const onTwitchVerify = useCallback(async () => {
    setTwitchVerifyBusy(true);
    setTwitchVerifyError('');
    try {
      const r = await fetch(`${BACKEND}/api/webhooks/twitch/verify`, { headers: headers() });
      const raw = await r.text();
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      if (!r.ok) {
        setTwitchVerifyError(`HTTP ${r.status} · ${body.detail || body.error || raw || 'tuntematon virhe'}`);
        setTwitchVerifyResult(null);
        return;
      }
      setTwitchVerifyResult({ ...body, verified_at: new Date().toISOString() });
    } catch (e) {
      setTwitchVerifyError(String(e));
    } finally {
      setTwitchVerifyBusy(false);
    }
  }, [headers]);

  const onKickVerify = useCallback(async () => {
    setKickVerifyBusy(true);
    setKickVerifyError('');
    try {
      const r = await fetch(`${BACKEND}/api/webhooks/kick/verify`, { headers: headers() });
      const raw = await r.text();
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      if (!r.ok) {
        setKickVerifyError(`HTTP ${r.status} · ${body.detail || body.error || raw || 'tuntematon virhe'}`);
        setKickVerifyResult(null);
        return;
      }
      setKickVerifyResult({ ...body, verified_at: new Date().toISOString() });
    } catch (e) {
      setKickVerifyError(String(e));
    } finally {
      setKickVerifyBusy(false);
    }
  }, [headers]);

  const onYoutubeVerify = useCallback(async () => {
    setYoutubeVerifyBusy(true);
    setYoutubeVerifyError('');
    try {
      const r = await fetch(`${BACKEND}/api/webhooks/youtube/verify`, { headers: headers() });
      const raw = await r.text();
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
      if (!r.ok) {
        setYoutubeVerifyError(`HTTP ${r.status} · ${body.detail || body.error || raw || 'tuntematon virhe'}`);
        setYoutubeVerifyResult(null);
        return;
      }
      setYoutubeVerifyResult({ ...body, verified_at: new Date().toISOString() });
    } catch (e) {
      setYoutubeVerifyError(String(e));
    } finally {
      setYoutubeVerifyBusy(false);
    }
  }, [headers]);


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

        {/* Force-rebuild panel — Step 4 operational button */}
        <div className="panel mb-6" style={{ padding: '18px 20px', borderLeft: '3px solid #3B5BA5' }}
             data-testid="webhooks-force-rebuild-panel">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="mono inline-flex items-center gap-2 mb-2"
                   style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3B5BA5', fontWeight: 700 }}>
                <Hammer strokeWidth={1.7} size={13} />
                SYÖTTEEN UUDELLEENRAKENNUS
              </div>
              <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                Käynnistää aggregointityön välittömästi. Käytä kun ensimmäinen webhook saapuu, kun rebuild-worker
                jumittaa, tai kun toimitus haluaa nähdä julkaisun heti hubilla ennen seuraavaa 60 s sykliä.
              </p>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}
                   data-testid="webhooks-force-rebuild-last-stamp">
                VIIMEISIN AJO · {rebuildResult?.rebuilt_at ? fmtUtcStamp(rebuildResult.rebuilt_at) : 'EI VIELÄ AJETTU'}
              </div>
            </div>
            <button
              type="button"
              onClick={onForceRebuild}
              disabled={rebuildBusy}
              className="btn-primary mono inline-flex items-center gap-2"
              style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, padding: '12px 18px', opacity: rebuildBusy ? 0.7 : 1 }}
              data-testid="webhooks-force-rebuild-button"
            >
              {rebuildBusy ? (
                <Loader2 strokeWidth={1.8} size={13} className="animate-spin" />
              ) : (
                <Hammer strokeWidth={1.8} size={13} />
              )}
              {rebuildBusy ? 'AJETAAN…' : 'PAKOTA SYÖTTEEN UUDELLEENRAKENNUS'}
            </button>
          </div>

          {rebuildError ? (
            <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: '#C8423C', fontWeight: 600, lineHeight: 1.5 }}
                 data-testid="webhooks-force-rebuild-error">
              VIRHE · {rebuildError}
            </div>
          ) : null}

          {rebuildResult && !rebuildError ? (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3"
                 data-testid="webhooks-force-rebuild-stats">
              <Stat label="EHDOKKAITA" value={rebuildResult.candidates} testid="rebuild-stat-candidates" />
              <Stat label="UPSERTOITU" value={rebuildResult.upserted} testid="rebuild-stat-upserted" />
              <Stat label="POISTETTU"  value={rebuildResult.pruned}     testid="rebuild-stat-pruned" />
              <Stat label="SIGNAALEJA" value={rebuildResult.signals_scanned}   testid="rebuild-stat-signals" />
              <Stat label="JULKAISUJA" value={rebuildResult.published_scanned} testid="rebuild-stat-published" />
            </div>
          ) : null}
        </div>

        {/* Twitch connection verify panel — proves OAuth + lists subscriptions */}
        <div className="panel mb-6" style={{ padding: '18px 20px', borderLeft: '3px solid #9146FF' }}
             data-testid="twitch-verify-panel">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="mono inline-flex items-center gap-2 mb-2"
                   style={{ fontSize: 11, letterSpacing: '0.22em', color: '#9146FF', fontWeight: 700 }}>
                <Webhook strokeWidth={1.7} size={13} />
                TWITCH · YHTEYDEN VARMENNUS
              </div>
              <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                Vaihtaa client_credentials → app-access-token ja hakee nykyiset EventSub-tilaukset.
                Ei luo uusia tilauksia. Käytä ennen kuin painat &quot;Pakota uudelleentilaus&quot;.
              </p>
              {twitchVerifyResult ? (
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 600, lineHeight: 1.6 }}
                     data-testid="twitch-verify-summary">
                  TILAUKSIA · {twitchVerifyResult.subscriptions?.total ?? 0}
                  {' · '}KÄYTÖSSÄ {twitchVerifyResult.subscriptions?.total_cost ?? 0}
                  /{twitchVerifyResult.subscriptions?.max_total_cost ?? '?'}
                  {' · '}OAUTH {twitchVerifyResult.ok ? '✓' : '✗'}
                </div>
              ) : (
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                  EI VIELÄ VARMISTETTU
                </div>
              )}
            </div>
            <button type="button" onClick={onTwitchVerify} disabled={twitchVerifyBusy}
                    className="btn-primary mono inline-flex items-center gap-2"
                    style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, padding: '12px 18px',
                             background: '#9146FF', opacity: twitchVerifyBusy ? 0.7 : 1 }}
                    data-testid="twitch-verify-button">
              {twitchVerifyBusy ? <Loader2 strokeWidth={1.8} size={13} className="animate-spin" />
                                 : <CheckCircle2 strokeWidth={1.8} size={13} />}
              {twitchVerifyBusy ? 'YHDISTETÄÄN…' : 'VARMENNA TWITCH-YHTEYS'}
            </button>
          </div>
          {twitchVerifyError ? (
            <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: '#C8423C', fontWeight: 600 }}
                 data-testid="twitch-verify-error">
              VIRHE · {twitchVerifyError}
            </div>
          ) : null}
        </div>

        {/* Kick connection verify panel — same shape as Twitch, green accent */}
        <div className="panel mb-6" style={{ padding: '18px 20px', borderLeft: '3px solid #53FC18' }}
             data-testid="kick-verify-panel">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="mono inline-flex items-center gap-2 mb-2"
                   style={{ fontSize: 11, letterSpacing: '0.22em', color: '#3FAA10', fontWeight: 700 }}>
                <Webhook strokeWidth={1.7} size={13} />
                KICK · YHTEYDEN VARMENNUS
              </div>
              <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                Vaihtaa client_credentials → app token ja hakee Kickin webhook-signing-julkisen avaimen.
                Ei luo uusia tilauksia.
              </p>
              {kickVerifyResult ? (
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 600, lineHeight: 1.6 }}
                     data-testid="kick-verify-summary">
                  TILAUKSIA · {kickVerifyResult.subscriptions?.total ?? 0}
                  {' · '}OAUTH {kickVerifyResult.ok ? '✓' : '✗'}
                  {' · '}PUBLIC KEY {kickVerifyResult.public_key_reachable ? '✓' : '✗'}
                </div>
              ) : (
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                  EI VIELÄ VARMISTETTU
                </div>
              )}
            </div>
            <button type="button" onClick={onKickVerify} disabled={kickVerifyBusy}
                    className="btn-primary mono inline-flex items-center gap-2"
                    style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, padding: '12px 18px',
                             background: '#53FC18', color: '#0A0A0A', opacity: kickVerifyBusy ? 0.7 : 1 }}
                    data-testid="kick-verify-button">
              {kickVerifyBusy ? <Loader2 strokeWidth={1.8} size={13} className="animate-spin" />
                                : <CheckCircle2 strokeWidth={1.8} size={13} />}
              {kickVerifyBusy ? 'YHDISTETÄÄN…' : 'VARMENNA KICK-YHTEYS'}
            </button>
          </div>
          {kickVerifyError ? (
            <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: '#C8423C', fontWeight: 600 }}
                 data-testid="kick-verify-error">
              VIRHE · {kickVerifyError}
            </div>
          ) : null}
        </div>

        {/* YouTube PubSub verify panel — red accent */}
        <div className="panel mb-6" style={{ padding: '18px 20px', borderLeft: '3px solid #FF0033' }}
             data-testid="youtube-verify-panel">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="mono inline-flex items-center gap-2 mb-2"
                   style={{ fontSize: 11, letterSpacing: '0.22em', color: '#C8423C', fontWeight: 700 }}>
                <Webhook strokeWidth={1.7} size={13} />
                YOUTUBE · YHTEYDEN VARMENNUS
              </div>
              <p className="font-serif" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                Tarkistaa Data API -avaimen toimivuuden ja kertoo PubSubHubbub-tilausten lukumäärän
                (vuokra-aika ~5–10 vrk, automaattinen uusinta tulossa).
              </p>
              {youtubeVerifyResult ? (
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink)', fontWeight: 600, lineHeight: 1.6 }}
                     data-testid="youtube-verify-summary">
                  DATA API {youtubeVerifyResult.data_api_reachable ? '✓' : '✗'}
                  {' · '}AKTIIVISIA VUOKRIA · {youtubeVerifyResult.lease_summary?.active ?? 0}
                  {' · '}48 H VANHENEMASSA · {youtubeVerifyResult.lease_summary?.expiring_within_48h ?? 0}
                </div>
              ) : (
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>
                  EI VIELÄ VARMISTETTU
                </div>
              )}
            </div>
            <button type="button" onClick={onYoutubeVerify} disabled={youtubeVerifyBusy}
                    className="btn-primary mono inline-flex items-center gap-2"
                    style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, padding: '12px 18px',
                             background: '#FF0033', opacity: youtubeVerifyBusy ? 0.7 : 1 }}
                    data-testid="youtube-verify-button">
              {youtubeVerifyBusy ? <Loader2 strokeWidth={1.8} size={13} className="animate-spin" />
                                  : <CheckCircle2 strokeWidth={1.8} size={13} />}
              {youtubeVerifyBusy ? 'YHDISTETÄÄN…' : 'VARMENNA YOUTUBE-YHTEYS'}
            </button>
          </div>
          {youtubeVerifyError ? (
            <div className="mono mt-4" style={{ fontSize: 10.5, letterSpacing: '0.12em', color: '#C8423C', fontWeight: 600 }}
                 data-testid="youtube-verify-error">
              VIRHE · {youtubeVerifyError}
            </div>
          ) : null}
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

      {/* Confirm modal — gates execution of resubscribe behind a preview */}
      {pendingConfirm ? (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 24,
          }}
          data-testid="resubscribe-confirm-modal"
          onClick={() => setPendingConfirm(null)}
        >
          <div
            className="panel"
            style={{ padding: '24px 28px', maxWidth: 640, width: '100%', background: 'var(--bg)', borderLeft: '3px solid #E8924A' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mono inline-flex items-center gap-2 mb-3"
                 style={{ fontSize: 11, letterSpacing: '0.22em', color: '#E8924A', fontWeight: 700 }}>
              <AlertTriangle strokeWidth={1.7} size={13} />
              VAHVISTA · {pendingConfirm.source.toUpperCase()} RESUBSCRIBE
            </div>
            <div className="font-serif mb-4" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>
              Tämä luo <strong>{pendingConfirm.dryRun?.plan_count ?? 0}</strong> oikeaa webhook-tilausta {pendingConfirm.source === 'twitch' ? 'Twitchin Helix-EventSub-rajapintaan' : 'Kickin events-rajapintaan'}.
              {' '}{pendingConfirm.dryRun?.would_skip?.length ? `${pendingConfirm.dryRun.would_skip.length} ohitetaan jo olemassa.` : ''}
              {' '}{pendingConfirm.dryRun?.would_error?.length ? `${pendingConfirm.dryRun.would_error.length} virhettä esikatselussa.` : ''}
            </div>
            <div className="mono mb-4"
                 style={{ fontSize: 10.5, letterSpacing: '0.10em', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.55, maxHeight: 220, overflowY: 'auto' }}
                 data-testid="resubscribe-confirm-plan">
              {(pendingConfirm.dryRun?.would_create || []).slice(0, 20).map((p, i) => (
                <div key={i}>
                  {p.slug} · {p.event}{p.user_id ? ` · uid ${p.user_id}` : ''}
                </div>
              ))}
              {(pendingConfirm.dryRun?.would_create || []).length > 20 ? (
                <div>… ja {pendingConfirm.dryRun.would_create.length - 20} muuta</div>
              ) : null}
              {(pendingConfirm.dryRun?.would_create || []).length === 0 ? (
                <div>EI UUSIA TILAUKSIA — KAIKKI JO OLEMASSA</div>
              ) : null}
            </div>
            {(pendingConfirm.dryRun?.would_error?.length ?? 0) > 0 ? (
              <div className="mono mb-4" style={{ fontSize: 10.5, letterSpacing: '0.10em', color: '#C8423C', fontWeight: 600, lineHeight: 1.6 }}
                   data-testid="resubscribe-confirm-errors">
                ESIKATSELUVIRHEET:
                {(pendingConfirm.dryRun.would_error || []).slice(0, 5).map((e, i) => (
                  <div key={i} style={{ marginLeft: 8 }}>· {e.slug || '?'} — {e.error || `HTTP ${e.status_code}`}</div>
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setPendingConfirm(null)} className="btn-ghost mono"
                      data-testid="resubscribe-confirm-cancel">
                PERUUTA
              </button>
              <button type="button" onClick={onConfirmResubscribe}
                      disabled={(pendingConfirm.dryRun?.plan_count ?? 0) === 0}
                      className="btn-primary mono"
                      style={{ background: '#E8924A', color: '#0A0A0A', fontWeight: 700, letterSpacing: '0.14em',
                               opacity: (pendingConfirm.dryRun?.plan_count ?? 0) === 0 ? 0.4 : 1 }}
                      data-testid="resubscribe-confirm-execute">
                LUO {pendingConfirm.dryRun?.plan_count ?? 0} TILAUSTA →
              </button>
            </div>
          </div>
        </div>
      ) : null}

      </div>
    </div>
  );
};

export default BackOfficeWebhooks;
