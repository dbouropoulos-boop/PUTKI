/**
 * Layer2StatusPanel - Phase 4 Week 1/2 operational monitoring widget.
 *
 * Surfaces the six Layer 2 signal pollers (Twitch · NHL · RSS · F1 ·
 * Football · Reddit-dormant) with last-tick timestamp, document count,
 * dormant warnings, and a "Aja nyt" force-tick button per worker.
 *
 * Polls /api/admin/layer2/status every 20 s.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, Play } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/formatTime';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 20_000;

const fmtAge = (iso, lang) => {
  if (!iso || iso === 'None') return '-';
  try {
    return formatTimeAgo(iso.replace(' ', 'T'), lang);
  } catch { return '-'; }
};

const fmtStamp = (iso) => {
  if (!iso || iso === 'None') return '-';
  return iso.replace('T', ' ').slice(0, 19);
};

const WORKER_META = {
  twitch:   { coll: 'stream_signals',   label: 'TWITCH',   cadence: 60,   summary: (s) => `${s?.active_streams ?? 0} live · ${s?.total_viewers ?? 0} katsojaa` },
  nhl:      { coll: 'sports_signals',   label: 'NHL',      cadence: 300,  summary: (s) => `${s?.games_active ?? 0} ottelua` },
  rss:      { coll: 'news_signals',     label: 'RSS',      cadence: 900,  summary: (s) => `${s?.matched_count ?? 0} osumaa · ${(s?.feeds || []).length} syötettä` },
  f1:       { coll: 'f1_signals',       label: 'F1',       cadence: 3600, summary: (s) => s?.race_active ? `${s?.race_name || ''} · ${(s?.finnish_drivers || []).length} suomalaista` : 'ei aktiivista kisaa' },
  football: { coll: 'football_signals', label: 'JALKAPALLO', cadence: 600,  summary: (s) => `${s?.matches_active ?? 0} ottelua · ${s?.finnish_scoring_matches ?? 0} suomalaisosumaa` },
  reddit:   { coll: 'social_signals',   label: 'REDDIT',   cadence: 3600, summary: (s) => `${s?.mention_count ?? 0} mainintaa` },
};

const stateForWorker = (key, coll) => {
  if (!coll) return { color: '#6b7280', label: 'EI DATAA' };
  if (coll.latest_summary?.dormant) return { color: '#C8423C', label: 'DORMANT' };
  const meta = WORKER_META[key];
  if (!meta || !coll.latest_captured_at) return { color: '#6b7280', label: '-' };
  const t = new Date(String(coll.latest_captured_at).replace(' ', 'T'));
  const ageSec = Math.floor((Date.now() - t.getTime()) / 1000);
  if (ageSec > meta.cadence * 3) return { color: '#C8423C', label: 'JÄÄNYT JUMIIN' };
  if (ageSec > meta.cadence * 1.5) return { color: '#E8924A', label: 'VANHENTUNUT' };
  return { color: '#2c7a4b', label: 'OK' };
};

const Layer2StatusPanel = ({ token }) => {
  const { lang } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyWorker, setBusyWorker] = useState(null);
  const [lastTickResult, setLastTickResult] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${BACKEND}/api/admin/layer2/status`, {
        credentials: 'include',
        headers: { 'X-Admin-Token': token },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const onForceTick = async (worker) => {
    if (!token) return;
    setBusyWorker(worker);
    setLastTickResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/layer2/tick?worker=${worker}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      const body = await r.json();
      setLastTickResult({ worker, status: r.status, body });
      await load();
    } catch (e) {
      setLastTickResult({ worker, status: 0, body: { error: String(e) } });
    } finally {
      setBusyWorker(null);
    }
  };

  const colls = data?.collections || {};
  const workers = ['twitch', 'nhl', 'rss', 'f1', 'football', 'reddit'];

  return (
    <div className="panel mb-6" style={{ padding: '18px 20px' }} data-testid="layer2-status-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}>
          LAYER 2 · SIGNAALIPOLLERIT
        </div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)' }}>
          SSE · {data?.sse_subscribers ?? 0} kuuntelijaa
        </div>
      </div>

      {error ? (
        <div className="mono mb-3" style={{ fontSize: 10.5, color: '#C8423C', letterSpacing: '0.12em' }}>
          VIRHE · {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5" data-testid="layer2-workers-grid">
        {workers.map((key) => {
          const meta = WORKER_META[key];
          const coll = colls[meta.coll] || null;
          const state = stateForWorker(key, coll);
          const summary = coll?.latest_summary ? meta.summary(coll.latest_summary) : '-';
          return (
            <div
              key={key}
              data-testid={`layer2-worker-${key}`}
              className="flex items-center gap-3"
              style={{
                padding: '12px 14px',
                background: '#fbfaf7',
                border: '1px solid #e8e4dc',
                borderRadius: 2,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: state.color, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--ink)', fontWeight: 700 }}>
                    {meta.label}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.12em', color: state.color, fontWeight: 600 }}>
                    {state.label}
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                  {summary}
                </div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.06em', marginTop: 2 }}>
                  {coll?.doc_count ?? 0} dok · {fmtAge(coll?.latest_captured_at, lang)} · {fmtStamp(coll?.latest_captured_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onForceTick(key)}
                disabled={busyWorker === key || !token}
                data-testid={`layer2-tick-${key}-btn`}
                className="mono"
                style={{
                  background: '#1a1a1a',
                  color: '#fff',
                  padding: '6px 10px',
                  fontSize: 9.5,
                  letterSpacing: '0.16em',
                  border: 'none',
                  cursor: busyWorker === key ? 'wait' : 'pointer',
                  opacity: !token || busyWorker === key ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 1,
                }}
              >
                {busyWorker === key ? (<><Loader2 size={10} className="animate-spin" /> AJETAAN</>) : (<><Play size={10} /> AJA NYT</>)}
              </button>
            </div>
          );
        })}
      </div>

      {data?.latest_dial ? (
        <div className="mono mt-4" style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '0.1em' }} data-testid="layer2-latest-dial">
          MITTARI · {data.latest_dial.composite_score?.toFixed(1)} · {data.latest_dial.state_key} · ajuri: {data.latest_dial.primary_driver}
        </div>
      ) : null}

      {lastTickResult ? (
        <div className="mono mt-3" style={{ padding: '10px 12px', background: '#fbfaf7', border: '1px solid #e8e4dc', fontSize: 10, color: 'var(--muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} data-testid="layer2-last-tick">
          <strong style={{ color: 'var(--ink)', letterSpacing: '0.14em' }}>VIIMEISIN · {lastTickResult.worker.toUpperCase()} · HTTP {lastTickResult.status}</strong>
          {'\n'}{JSON.stringify(lastTickResult.body?.workers || lastTickResult.body, null, 2)}
        </div>
      ) : null}
    </div>
  );
};

export default Layer2StatusPanel;
