/**
 * BackOfficePeli - admin surface for the /peli raffle.
 *
 * Edit prize amount/label/currency, partner config, 3 embedded videos,
 * enable/disable the raffle, view entries.
 */
import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Loader2, Save, Power } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki-hq-admin-token';

const BackOfficePeli = () => {
  // iter82 · Task 2.2 — shell-injected token short-circuits the per-page gate.
  const _shellCtx = useOutletContext() || {};
  const [_tokenLocal, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const token = _shellCtx.token || _tokenLocal;
  const [_authedLocal, setAuthed] = useState(false);
  const authed = !!_shellCtx.token || _authedLocal;
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entryCount, setEntryCount] = useState(0);
  const [status, setStatus] = useState('');

  const load = async (tk) => {
    setBusy(true);
    setAuthError('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/peli/config`, {
        headers: { 'X-Admin-Token': tk },
      });
      if (r.status === 401) { setAuthError('Wrong token.'); setAuthed(false); return; }
      const d = await r.json();
      setConfig(d.config);
      setEntryCount(d.entry_count || 0);
      const eR = await fetch(`${BACKEND}/api/admin/peli/entries?limit=200`, {
        headers: { 'X-Admin-Token': tk },
      });
      const eD = await eR.json();
      setEntries(eD.entries || []);
      setAuthed(true);
      try { localStorage.setItem(TOKEN_KEY, tk); } catch {}
    } catch (e) {
      setAuthError(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (token) load(token); }, []); // eslint-disable-line

  const auth = (e) => { e.preventDefault(); if (token) load(token); };

  const updateConfig = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const updateVideo = (i, patch) => setConfig((c) => {
    const videos = [...(c.videos || [])];
    videos[i] = { ...videos[i], ...patch };
    return { ...c, videos };
  });

  const save = async () => {
    setBusy(true);
    setStatus('');
    try {
      const body = {
        prize_label: config.prize_label || '',
        partner_name: config.partner_name || '',
        partner_url: config.partner_url || '',
        partner_disclosure: config.partner_disclosure || '',
        videos: (config.videos || []).slice(0, 3).map((v) => ({
          id: v.id, title: v.title || '', caption: v.caption || '',
        })),
        enabled: !!config.enabled,
      };
      const r = await fetch(`${BACKEND}/api/admin/peli/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setConfig(d);
      setStatus('Saved.');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div className="container-wide py-16 max-w-md" data-testid="bo-peli-auth">
        <h1 className="display text-2xl mb-4">Back-office · Peli</h1>
        <form onSubmit={auth} className="space-y-3">
          <input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2"
            style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
            data-testid="bo-peli-token"
          />
          <button type="submit" disabled={busy} className="mono"
                  style={{ padding: '10px 16px', background: 'var(--ink)', color: 'var(--bg)', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700 }}>
            ENTER
          </button>
          {authError && <div className="mono text-red-600" style={{ fontSize: 11 }}>{authError}</div>}
        </form>
      </div>
    );
  }

  if (!config) {
    return <div className="container-wide py-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="container-wide py-10" data-testid="bo-peli-page">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="display text-3xl">Peli · raffle admin</h1>
        <Link to="/back-office" className="mono" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--ink)', fontWeight: 700 }}>
          ← BACK-OFFICE
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="panel p-5" style={{ background: 'var(--bg)' }}>
            <h2 className="display mb-3" style={{ fontSize: 18, fontWeight: 800 }}>Prize</h2>
            <label className="block">
              <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>LABEL</span>
              <input
                value={config.prize_label || ''}
                onChange={(e) => updateConfig({ prize_label: e.target.value })}
                placeholder='e.g. "Operator bonus" or "Editorial prize pack"'
                className="w-full px-3 py-2"
                style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
                data-testid="bo-peli-prize-label"
              />
            </label>
          </section>

          <section className="panel p-5" style={{ background: 'var(--bg)' }}>
            <h2 className="display mb-3" style={{ fontSize: 18, fontWeight: 800 }}>Partner</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>NAME</span>
                <input value={config.partner_name || ''} onChange={(e) => updateConfig({ partner_name: e.target.value })}
                       className="w-full px-3 py-2" style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
                       data-testid="bo-peli-partner-name" />
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>URL</span>
                <input value={config.partner_url || ''} onChange={(e) => updateConfig({ partner_url: e.target.value })}
                       className="w-full px-3 py-2" style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
                       data-testid="bo-peli-partner-url" />
              </label>
              <label className="block">
                <span className="mono block mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>DISCLOSURE</span>
                <input value={config.partner_disclosure || ''} onChange={(e) => updateConfig({ partner_disclosure: e.target.value })}
                       className="w-full px-3 py-2" style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
                       data-testid="bo-peli-partner-disclosure" />
              </label>
            </div>
          </section>

          <section className="panel p-5" style={{ background: 'var(--bg)' }}>
            <h2 className="display mb-3" style={{ fontSize: 18, fontWeight: 800 }}>3 Videos</h2>
            <div className="space-y-4">
              {(config.videos || []).slice(0, 3).map((v, i) => (
                <div key={v.id || i} className="border-l-2 pl-3" style={{ borderColor: 'var(--border-strong)' }}>
                  <div className="mono mb-1" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>VIDEO #{i + 1}</div>
                  <input value={v.title || ''} placeholder="Title"
                         onChange={(e) => updateVideo(i, { title: e.target.value })}
                         className="w-full px-3 py-2 mb-2"
                         style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
                         data-testid={`bo-peli-video-${i}-title`} />
                  <input value={v.caption || ''} placeholder="Caption (optional)"
                         onChange={(e) => updateVideo(i, { caption: e.target.value })}
                         className="w-full px-3 py-2"
                         style={{ border: '1px solid var(--border-strong)', background: 'var(--bg)' }}
                         data-testid={`bo-peli-video-${i}-caption`} />
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5 flex items-center justify-between gap-4" style={{ background: 'var(--bg)' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!config.enabled}
                     onChange={(e) => updateConfig({ enabled: e.target.checked })}
                     data-testid="bo-peli-enabled" />
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', fontWeight: 700 }}>
                <Power className="inline w-3 h-3 mr-1" /> RAFFLE ENABLED
              </span>
            </label>
            <button onClick={save} disabled={busy} data-testid="bo-peli-save"
                    className="mono inline-flex items-center gap-2"
                    style={{ padding: '12px 18px', background: 'var(--ink)', color: 'var(--bg)', fontSize: 11, letterSpacing: '0.22em', fontWeight: 700, borderRadius: 2 }}>
              <Save size={14} />{busy ? 'SAVING…' : 'SAVE'}
            </button>
          </section>
          {status && <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{status}</div>}
        </div>

        <div>
          <section className="panel p-5" style={{ background: 'var(--bg)' }}>
            <h2 className="display mb-3" style={{ fontSize: 18, fontWeight: 800 }}>
              Entries · <span className="mono" style={{ fontSize: 14 }}>{entryCount}</span>
            </h2>
            {entries.length === 0 ? (
              <p className="mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--muted)' }}>NO ENTRIES YET</p>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 600 }} data-testid="bo-peli-entries">
                <table className="w-full font-serif" style={{ fontSize: 13 }}>
                  <thead>
                    <tr className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
                      <th className="text-left py-2">WHEN</th>
                      <th className="text-left py-2">NAME</th>
                      <th className="text-left py-2">PHONE</th>
                      <th className="text-left py-2">EMAIL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2" style={{ color: 'var(--muted)' }}>
                          {(e.submitted_at || '').slice(0, 16).replace('T', ' ')}
                        </td>
                        <td className="py-2">{e.name}</td>
                        <td className="py-2">{e.phone}</td>
                        <td className="py-2">{e.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default BackOfficePeli;
