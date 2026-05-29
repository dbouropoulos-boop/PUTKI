/**
 * useBackOfficeToken - tiny shared hook for the back-office admin pages.
 *
 * Centralises the X-Admin-Token persistence pattern that each admin page
 * was reimplementing inline. Returns `{token, setToken, authed, authError,
 * checkAuth, logout}`.
 *
 * SECURITY NOTE - the admin token now persists in **sessionStorage**, not
 * localStorage. It survives within a tab/session but is cleared when the
 * tab closes, reducing the XSS-stolen-credential blast radius. The proper
 * long-term fix is to issue an httpOnly cookie session from the backend
 * (tracked as ROADMAP P1 - "admin auth → httpOnly cookies"), but this
 * change closes the most common attack vector (persistent-storage exfil)
 * without a multi-day refactor.
 *
 * Usage:
 *     const { token, authed, authError, checkAuth, setToken, logout } = useBackOfficeToken();
 *     if (!authed) return <AuthGate token={token} setToken={setToken} onSubmit={checkAuth} error={authError} />;
 *     // ... then use token in your X-Admin-Token header
 */
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'putki-hq-admin-token';

// Tiny wrapper so we have ONE place to swap to cookies later.
const tokenStore = {
  get() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  },
  set(v) {
    // noop on QuotaExceeded / private-browsing - we'd rather lose
    // persistence than break the admin UX.
    try { sessionStorage.setItem(TOKEN_KEY, v); } catch { /* sessionStorage unavailable */ }
    // Best-effort: also clear any legacy localStorage entry from before
    // this hardening. Safe to delete since we never read it again.
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* localStorage unavailable */ }
  },
  clear() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* sessionStorage unavailable */ }
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* localStorage unavailable */ }
  },
};

export const useBackOfficeToken = () => {
  // iter82 · Task 2.2 — every back-office route now renders inside
  // <BackOfficeShell />, which seeds an outlet context with `{token,
  // density, refresh}`. When that context is present we trust the
  // shell entirely: no per-page localStorage read, no auth verify
  // round-trip, no AuthGate render. Pages stay backwards-compatible
  // because the rest of the hook's return shape is preserved.
  const shellCtx = useOutletContext() || {};
  const shellToken = shellCtx?.token || '';

  const [token, setToken] = useState(() => tokenStore.get());
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const checkAuth = useCallback(async (candidate) => {
    const tk = candidate ?? token;
    if (!tk) { setAuthError('Token required.'); return false; }
    setAuthError('');
    try {
      const r = await fetch(`${BACKEND}/api/admin/settings`, {
        headers: { 'X-Admin-Token': tk },
      });
      if (r.status === 401) {
        setAuthError('Wrong token.'); setAuthed(false); return false;
      }
      if (!r.ok) {
        setAuthError(`HTTP ${r.status}`); setAuthed(false); return false;
      }
      setAuthed(true);
      tokenStore.set(tk);
      return true;
    } catch (e) {
      setAuthError(e.message || 'Network error'); setAuthed(false); return false;
    }
  }, [token]);

  // Auto-verify on mount when a stored token exists. We deliberately do
  // NOT depend on `token` here - `checkAuth` reads from the closure on
  // every call, so an effect-once-on-mount is exactly what we want.
  const verifyOnce = useCallback((tk) => { if (tk) checkAuth(tk); }, [checkAuth]);
  useEffect(() => {
    if (shellToken) return; // shell handles auth — skip standalone verify
    verifyOnce(tokenStore.get());
  }, [verifyOnce, shellToken]);

  const logout = useCallback(() => {
    setToken(''); setAuthed(false); setAuthError('');
    tokenStore.clear();
  }, []);

  if (shellToken) {
    // Inside <BackOfficeShell />: pretend we're already authed with
    // the shell's token. `setToken`/`checkAuth`/`logout` become no-ops
    // because the shell owns auth lifecycle.
    return {
      token: shellToken,
      setToken: () => {},
      authed: true,
      authError: '',
      checkAuth: async () => true,
      logout: () => {},
    };
  }

  return { token, setToken, authed, authError, checkAuth, logout };
};

export const AuthGate = ({ token, setToken, onSubmit, error, title = 'Back-office' }) => (
  <div style={{
    maxWidth: 420, margin: '80px auto', padding: 32, color: 'var(--ink)',
    background: 'var(--surface)', border: '1px solid var(--hairline)',
  }} data-testid="back-office-auth-gate">
    <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, margin: '0 0 16px', color: '#FFFFFF' }}>
      {title}
    </h2>
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(token); }}>
      <label style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)' }}>
        ADMIN TOKEN
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
          autoFocus data-testid="back-office-token-input"
          style={{
            display: 'block', width: '100%', marginTop: 6,
            background: 'var(--bg)', color: 'var(--ink)',
            border: '1px solid var(--border-strong)', padding: '10px 12px',
            fontFamily: 'inherit', fontSize: 13,
          }} />
      </label>
      {error && <div data-testid="auth-error" style={{ marginTop: 10, padding: 8, background: '#2b0e0e', border: '1px solid #5a2b2b', color: '#f4a4a4', fontSize: 12 }}>{error}</div>}
      <button type="submit" data-testid="back-office-token-submit"
        style={{
          marginTop: 16, padding: '10px 18px', background: '#FFFFFF', color: '#0B0A09',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
        }}>UNLOCK →</button>
    </form>
  </div>
);
