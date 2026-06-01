/**
 * BackOfficeWeekly - admin surface for the gamified Weekly Card.
 *
 * Read prize meta, edit prize amount/currency/label, lock entries, settle
 * results (one 1/X/2 per event), draw a winner.
 */
import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Loader2, Lock, Unlock, Trophy, Save, Shuffle } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TOKEN_KEY = 'putki-hq-admin-token';

const BackOfficeWeekly = () => {
  // iter82 · Task 2.2 — shell-injected token short-circuits the per-page gate.
  const _shellCtx = useOutletContext() || {};
  const [_tokenLocal, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const token = _shellCtx.token || _tokenLocal;
  const [_authedLocal, setAuthed] = useState(false);
  const authed = !!_shellCtx.token || _authedLocal;
  const [authError, setAuthError] = useState('');
  const [busy, setBusy]         = useState(false);

  const [picks, setPicks]       = useState([]);
  const [meta, setMeta]         = useState(null);
  const [entries, setEntries]   = useState([]);
  const [results, setResults]   = useState({});
  const [prize, setPrize]       = useState({ amount: 100, currency: 'EUR', label: 'Weekly Card cash prize' });
  const [statusMsg, setStatusMsg] = useState('');
  const [winnerInfo, setWinnerInfo] = useState(null);

  const wk = meta?.week_key || '';

  const loadAll = async (tk) => {
    setBusy(true);
    try {
      const featR = await fetch(`${BACKEND}/api/odds/featured`);
      const featD = await featR.json();
      setPicks(featD.picks || []);

      const metaR = await fetch(`${BACKEND}/api/weekly/meta`);
      const metaD = await metaR.json();
      setMeta(metaD);
      setPrize({
        amount: metaD.prize_amount,
        currency: metaD.prize_currency,
        label: metaD.prize_label,
      });
      const seeded = {};
      (metaD.results || []).forEach((r) => { seeded[r.event_id] = r.pick; });
      setResults(seeded);

      const aR = await fetch(`${BACKEND}/api/admin/weekly/${metaD.week_key}`, {
        credentials: 'include',
        headers: { 'X-Admin-Token': tk },
      });
      if (aR.status === 401) { setAuthError('Wrong token.'); setAuthed(false); return; }
      const aD = await aR.json();
      setEntries(aD.entries || []);
      setAuthed(true);
      try { localStorage.setItem(TOKEN_KEY, tk); } catch {}
    } catch (e) {
      setAuthError(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (token) loadAll(token); }, []); // eslint-disable-line

  const auth = (e) => { e.preventDefault(); if (token) loadAll(token); };

  const savePrize = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/weekly/${wk}/prize`, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({
          prize_amount:   Number(prize.amount),
          prize_currency: prize.currency,
          prize_label:    prize.label,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatusMsg('✓ Prize updated');
      await loadAll(token);
    } catch (e) {
      setStatusMsg(`Error: ${e.message}`);
    } finally { setBusy(false); }
  };

  const toggleLock = async () => {
    setBusy(true);
    try {
      await fetch(`${BACKEND}/api/admin/weekly/${wk}/lock?locked=${!meta?.locked}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      await loadAll(token);
    } finally { setBusy(false); }
  };

  const saveResults = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      const payload = Object.entries(results)
        .filter(([, v]) => v)
        .map(([event_id, pick]) => ({ event_id, pick }));
      const r = await fetch(`${BACKEND}/api/admin/weekly/${wk}/results`, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify({ results: payload }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setStatusMsg(`✓ Settled ${d.settled_entries} entries`);
      await loadAll(token);
    } catch (e) {
      setStatusMsg(`Error: ${e.message}`);
    } finally { setBusy(false); }
  };

  const drawWinner = async () => {
    setBusy(true);
    setStatusMsg('');
    setWinnerInfo(null);
    try {
      const r = await fetch(`${BACKEND}/api/admin/weekly/${wk}/draw`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'X-Admin-Token': token },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setWinnerInfo(d);
      setStatusMsg('✓ Winner drawn');
      await loadAll(token);
    } catch (e) {
      setStatusMsg(`Error: ${e.message}`);
    } finally { setBusy(false); }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
        <form onSubmit={auth} className="panel w-full max-w-md p-7" data-testid="back-office-weekly-auth">
          <div className="eyebrow mb-3">PUTKI HQ · WEEKLY CARD</div>
          <h1 className="display text-2xl mb-4">Admin authentication</h1>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            data-testid="back-office-weekly-token"
            placeholder="••••••"
            className="mono w-full"
            style={{ padding: '14px 16px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)', outline: 'none', fontSize: 13 }}
            required
          />
          {authError && <div className="mono mt-3" style={{ fontSize: 11, color: '#C8423C' }}>{authError}</div>}
          <button type="submit" className="btn-primary w-full mt-5" disabled={busy} data-testid="back-office-weekly-auth-submit">
            {busy ? 'Checking…' : 'Continue →'}
          </button>
          <Link to="/back-office" className="btn-ghost mt-4 w-full justify-center">← Back office</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="container-narrow">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div className="eyebrow">PUTKI HQ · WEEKLY CARD ADMIN · {wk}</div>
          <Link to="/back-office" className="btn-ghost">← Back office</Link>
        </div>
        <h1 className="display text-3xl sm:text-4xl mb-2">Weekly Card</h1>
        <p className="font-serif mb-7" style={{ fontSize: 14, color: 'var(--muted)' }}>
          Edit the prize, lock entries, settle results, and draw the winner.
        </p>

        {statusMsg && (
          <div className="mono mb-5" data-testid="back-office-weekly-status"
               style={{ fontSize: 12, letterSpacing: '0.14em', color: statusMsg.startsWith('Error') ? '#C8423C' : '#2c7a4b' }}>
            {statusMsg}
          </div>
        )}

        <section className="panel p-7 mb-6" data-testid="back-office-weekly-prize">
          <div className="eyebrow mb-4 inline-flex items-center gap-2">
            <Trophy strokeWidth={1.6} size={12} />
            PRIZE
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">
            <input
              type="number"
              min="0"
              className="mono sm:col-span-3"
              data-testid="back-office-weekly-prize-amount"
              value={prize.amount}
              onChange={(e) => setPrize({ ...prize, amount: e.target.value })}
              style={{ padding: 12, borderRadius: 2, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
            <input
              className="mono sm:col-span-2"
              data-testid="back-office-weekly-prize-currency"
              value={prize.currency}
              onChange={(e) => setPrize({ ...prize, currency: e.target.value.toUpperCase() })}
              style={{ padding: 12, borderRadius: 2, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
            <input
              className="mono sm:col-span-7"
              data-testid="back-office-weekly-prize-label"
              value={prize.label}
              onChange={(e) => setPrize({ ...prize, label: e.target.value })}
              style={{ padding: 12, borderRadius: 2, border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button type="button" onClick={savePrize} disabled={busy} className="btn-primary inline-flex items-center gap-2"
                    data-testid="back-office-weekly-prize-save">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save prize
            </button>
            <button type="button" onClick={toggleLock} disabled={busy} className="btn-ghost inline-flex items-center gap-2"
                    data-testid="back-office-weekly-lock-toggle">
              {meta?.locked ? <Unlock size={12} /> : <Lock size={12} />}
              {meta?.locked ? 'Unlock entries' : 'Lock entries'}
            </button>
          </div>
        </section>

        <section className="panel p-7 mb-6" data-testid="back-office-weekly-results">
          <div className="eyebrow mb-4">SETTLE RESULTS · {picks.length} FIXTURES</div>
          {picks.length === 0 ? (
            <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>No fixtures from /api/odds/featured.</p>
          ) : (
            <ul className="space-y-3">
              {picks.map((p, i) => {
                const id = p.event_id || `idx-${i}`;
                return (
                  <li key={id} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 pb-3"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="sm:col-span-8 font-serif" style={{ fontSize: 14, color: 'var(--ink)' }}>
                      <span className="mono mr-2" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)' }}>
                        #{String(i + 1).padStart(2, '0')}
                      </span>
                      {p.home_team} <span style={{ color: 'var(--muted)' }}>-</span> {p.away_team}
                    </div>
                    <div className="sm:col-span-4 flex gap-2">
                      {['1', 'X', '2'].map((k) => {
                        const sel = results[id] === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setResults({ ...results, [id]: k })}
                            data-testid={`back-office-weekly-result-${i}-${k}`}
                            className="mono flex-1 py-2"
                            style={{
                              background: sel ? 'var(--ink)' : 'var(--bg)',
                              color: sel ? 'var(--bg)' : 'var(--ink)',
                              border: '1px solid var(--border-strong)', borderRadius: 2,
                              fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}
                          >{k}</button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" onClick={saveResults} disabled={busy || picks.length === 0}
                  className="btn-primary mt-5 inline-flex items-center gap-2" data-testid="back-office-weekly-results-save">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save results & settle entries
          </button>
        </section>

        <section className="panel p-7" data-testid="back-office-weekly-draw">
          <div className="eyebrow mb-4">ENTRIES · {entries.length}</div>
          {entries.length === 0 ? (
            <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>No entries yet.</p>
          ) : (
            <ul className="mb-5" style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
              {[...entries].sort((a, b) => (b.correct_count || 0) - (a.correct_count || 0)).map((e) => (
                <li key={e.id} className="grid grid-cols-12 gap-2 px-2 py-2"
                    style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <span className="mono col-span-4" style={{ color: 'var(--muted)' }}>{e.email}</span>
                  <span className="mono col-span-3">{e.channel} · {e.handle}</span>
                  <span className="mono col-span-3" style={{ color: 'var(--ink)' }}>{e.correct_count ?? 0}/5</span>
                  <span className="mono col-span-2" style={{ color: e.settled ? '#2c7a4b' : 'var(--muted)' }}>
                    {e.settled ? 'settled' : 'pending'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={drawWinner} disabled={busy || !meta?.results?.length || entries.length === 0}
                  className="btn-primary inline-flex items-center gap-2" data-testid="back-office-weekly-draw-btn">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
            Draw winner
          </button>
          {winnerInfo && (
            <div className="mono mt-5" data-testid="back-office-weekly-winner"
                 style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--ink)', background: 'var(--surface)', padding: 12, borderRadius: 2 }}>
              🏆 Winner: <strong>{winnerInfo.winner_email}</strong> · {winnerInfo.winner_handle} · {winnerInfo.winner.correct_count}/5 · drawn from {winnerInfo.winner.finalist_count} finalists
            </div>
          )}
          {meta?.winner && !winnerInfo && (
            <div className="mono mt-5" style={{ fontSize: 12, color: 'var(--muted)' }}>
              Already drawn: …{meta.winner.email_hash} · {meta.winner.correct_count}/5 · {new Date(meta.winner.drawn_at).toLocaleString()}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BackOfficeWeekly;
