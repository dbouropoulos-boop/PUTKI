/**
 * PUTKI HQ - Back-office · Mini-game analytics dashboard (iter58)
 *
 * Per-game metrics:
 *   • plays_started / plays_finished
 *   • leads_captured + conversion %
 *   • returning_pct (multi-week emails)
 *   • shares (from share-track telemetry)
 *   • current top player + score
 *
 * Filter by ISO week (or leave empty for all-time).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Lock, RefreshCw, Send } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const ADMIN_TOKEN_KEY = 'putki-admin-token';

const MiniGameAnalytics = () => {
  // iter82 · Task 2.2 — shell-injected token short-circuits the per-page gate.
  const _shellCtx = useOutletContext() || {};
  const [_tokenLocal, setToken] = useState(localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const token = _shellCtx.token || _tokenLocal;
  const [week, setWeek] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [announceStatus, setAnnounceStatus] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      const url = `${BACKEND}/api/admin/mini-games/analytics${week ? `?week=${week}` : ''}`;
      const r = await fetch(url, { headers: { 'X-Admin-Token': token } });
      const d = await r.json();
      setData(d);
    } finally { setBusy(false); }
  }, [token, week]);

  useEffect(() => { refresh(); }, [refresh]);

  const announceClosing = async (force) => {
    if (!window.confirm(force ? 'Pakota uudelleenlähetys (vaikka jo lähetetty)?' : 'Lähetä viikkomestarit Telegramiin?')) return;
    setAnnounceStatus(null);
    try {
      const url = `${BACKEND}/api/admin/mini-games/announce-closing${force ? '?force=true' : ''}`;
      const r = await fetch(url, { method: 'POST', headers: { 'X-Admin-Token': token } });
      setAnnounceStatus(await r.json());
    } catch (e) { setAnnounceStatus({ error: e.message }); }
  };

  if (!token) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 12 }}>
          <Lock size={12} strokeWidth={1.6} style={{ display: 'inline', marginRight: 6 }} />
          BACK-OFFICE LOGIN
        </div>
        <input
          type="password"
          placeholder="Admin token"
          data-testid="mga-token-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              localStorage.setItem(ADMIN_TOKEN_KEY, e.target.value);
              setToken(e.target.value);
            }
          }}
          style={inputStyle}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 8 }}>
            BACK-OFFICE · MINI-GAME ANALYTICS
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
            Pelidata
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="ISO week, esim 2026-W21"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            data-testid="mga-week-input"
            style={{ ...inputStyle, padding: '8px 12px', width: 180 }}
          />
          <button onClick={refresh} style={btnPrimary} data-testid="mga-refresh">
            <RefreshCw size={13} strokeWidth={1.5} style={{ marginRight: 6 }} /> REFRESH
          </button>
          <button onClick={() => announceClosing(false)} style={btn} data-testid="mga-announce">
            <Send size={13} strokeWidth={1.5} style={{ marginRight: 6 }} /> ILMOITA VIIKKO
          </button>
          <Link to="/back-office/mini-games" style={btn}>← QUESTIONS</Link>
        </div>
      </div>

      {announceStatus && (
        <div data-testid="mga-announce-status" style={{
          padding: 12, marginBottom: 20, borderRadius: 4,
          background: announceStatus.announced ? 'rgba(63,138,77,0.10)' : 'var(--surface)',
          border: `1px solid ${announceStatus.announced ? '#3F8A4D' : 'var(--border)'}`,
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          color: 'var(--ink)', letterSpacing: '0.06em',
        }}>
          {announceStatus.announced
            ? `LÄHETETTY · viikko ${announceStatus.week_iso}`
            : `EI LÄHETETTY · syy: ${announceStatus.reason || '?'} · viikko ${announceStatus.week_iso || ''}`}
          {!announceStatus.announced && announceStatus.reason !== 'no_winners' && (
            <button onClick={() => announceClosing(true)} style={{ ...btn, marginLeft: 12, fontSize: 10, padding: '4px 10px' }}>FORCE</button>
          )}
        </div>
      )}

      {busy && <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>Ladataan…</p>}

      {data && (
        <>
          {/* Totals */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <Stat label="ALOITETUT" value={data.totals.plays_started} />
            <Stat label="VALMISTUNEET" value={data.totals.plays_finished} />
            <Stat label="LEADIT" value={data.totals.leads_captured} />
            <Stat label="KONVERSIO" value={`${data.totals.conversion_pct}%`} accent />
            <Stat label="JAKAMISET" value={data.totals.shares} />
          </div>

          {/* Per-game table */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr repeat(6, 1fr) 1.4fr',
              padding: '10px 14px', background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'ui-monospace, monospace', fontSize: 10,
              letterSpacing: '0.18em', fontWeight: 700, color: 'var(--muted)',
            }}>
              <span>PELI</span><span>ALOIT</span><span>VALM</span><span>LEAD</span>
              <span>KONV %</span><span>PALAU %</span><span>JAOT</span><span>JOHTAJA</span>
            </div>
            {data.rows.map(r => (
              <div key={r.game_slug} data-testid={`mga-row-${r.game_slug}`} style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr repeat(6, 1fr) 1.4fr',
                padding: '12px 14px', borderBottom: '1px solid var(--border)',
                fontFamily: 'Georgia, serif', fontSize: 14, color: 'var(--ink)',
                alignItems: 'baseline',
              }}>
                <span style={{ fontWeight: 600 }}>{r.game_title_fi}</span>
                <span className="mono">{r.plays_started}</span>
                <span className="mono">{r.plays_finished}</span>
                <span className="mono">{r.leads_captured}</span>
                <span className="mono" style={{ color: r.conversion_pct >= 50 ? '#3F8A4D' : r.conversion_pct >= 25 ? '#A0750F' : 'var(--muted)' }}>
                  {r.conversion_pct}%
                </span>
                <span className="mono">{r.returning_pct}%</span>
                <span className="mono">{r.shares}</span>
                <span style={{ fontSize: 13, color: r.top_player ? 'var(--ink)' : 'var(--muted)' }}>
                  {r.top_player ? `${r.top_player} · ${r.top_score}` : '-'}
                </span>
              </div>
            ))}
          </div>

          <p className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12, letterSpacing: '0.08em' }}>
            {data.week_iso ? `VIIKKO ${data.week_iso}` : 'KOKO HISTORIA'} · GENEROITU {new Date(data.generated_at).toLocaleString('fi-FI')}
          </p>
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value, accent = false }) => (
  <div style={{
    padding: 16, border: '1px solid var(--border)',
    background: accent ? 'var(--surface-2)' : 'var(--surface)', borderRadius: 4,
  }}>
    <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.22em', color: '#5A7BB8', fontWeight: 700, marginBottom: 6 }}>
      {label}
    </div>
    <div style={{
      fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 28,
      color: accent ? '#A0750F' : 'var(--ink)',
    }}>{value}</div>
  </div>
);

const inputStyle = {
  width: '100%', padding: '12px 14px',
  border: '1px solid var(--border)', borderRadius: 4,
  fontFamily: 'inherit', fontSize: 14,
  background: 'var(--surface)', color: 'var(--ink)',
};
const btn = {
  padding: '8px 14px', background: 'transparent', color: 'var(--ink)',
  border: '1px solid var(--border)', borderRadius: 4,
  fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center',
};
const btnPrimary = { ...btn, background: 'var(--ink)', color: 'var(--bg)', border: 'none' };

export default MiniGameAnalytics;
