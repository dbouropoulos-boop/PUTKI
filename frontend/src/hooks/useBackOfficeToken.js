/**
 * useBackOfficeToken - shared back-office auth hook.
 *
 * iter94 — migrated from sessionStorage-stored X-Admin-Token header to
 * a signed httpOnly cookie session served by /api/admin/auth/login.
 *
 * Dual-path during the migration window:
 *   1. PRIMARY · cookie session. On successful login the backend
 *      sets `putki_admin_session` (httpOnly, SameSite=Lax). The SPA
 *      only stores an "I'm authed" hint in sessionStorage so the
 *      reload doesn't re-prompt; the actual auth payload is never
 *      readable from JS.
 *   2. LEGACY · sessionStorage token + X-Admin-Token header. Older
 *      tabs that already have a token persisted keep working — on
 *      mount we exchange that token for a fresh cookie session and
 *      clear the sessionStorage entry.
 *
 * Hook return shape (unchanged for callers):
 *   { token, setToken, authed, authError, checkAuth, logout }
 *
 * `token` is now an opaque sentinel string ("cookie-session") once the
 * cookie session is live. Existing admin pages that still spread it
 * into a header continue to work (the backend cookie path takes
 * precedence — the header value is ignored when a valid cookie is
 * present).
 */
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const LEGACY_TOKEN_KEY = 'putki-hq-admin-token';
const AUTHED_HINT_KEY = 'putki-hq-admin-authed';
const COOKIE_SENTINEL = 'cookie-session';

const credentialsInit = (extra = {}) => ({
  credentials: 'include',
  ...extra,
});

const legacyTokenStore = {
  get() {
    try { return sessionStorage.getItem(LEGACY_TOKEN_KEY) || ''; } catch { return ''; }
  },
  clear() {
    try { sessionStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* noop */ }
  },
};

const authedHint = {
  get() {
    try { return sessionStorage.getItem(AUTHED_HINT_KEY) === '1'; } catch { return false; }
  },
  set(v) {
    try {
      if (v) sessionStorage.setItem(AUTHED_HINT_KEY, '1');
      else sessionStorage.removeItem(AUTHED_HINT_KEY);
    } catch { /* noop */ }
  },
};

/**
 * POST /api/admin/auth/login {token}. On 200 the backend sets the
 * httpOnly cookie; we just need to remember "yes, authed" locally.
 */
async function exchangeTokenForCookie(token) {
  const r = await fetch(`${BACKEND}/api/admin/auth/login`, credentialsInit({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }));
  if (r.status === 401) return { ok: false, status: 401 };
  if (!r.ok) return { ok: false, status: r.status };
  const body = await r.json().catch(() => ({}));
  return { ok: true, body };
}

async function probeWhoami() {
  try {
    const r = await fetch(`${BACKEND}/api/admin/auth/whoami`, credentialsInit());
    if (r.status === 200) {
      const body = await r.json().catch(() => ({}));
      return { ok: true, body };
    }
    return { ok: false, status: r.status };
  } catch (e) {
    return { ok: false, error: e.message || 'Network' };
  }
}

export const useBackOfficeToken = () => {
  // Inside <BackOfficeShell />: trust the shell's outlet context.
  const shellCtx = useOutletContext() || {};
  const shellToken = shellCtx?.token || '';

  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  // checkAuth(candidate?) — accepts the operator's typed token, runs
  // the cookie exchange, returns truthy on success. Used by AuthGate.
  const checkAuth = useCallback(async (candidate) => {
    const tk = (candidate ?? token).trim();
    if (!tk) { setAuthError('Token required.'); return false; }
    setAuthError('');
    const res = await exchangeTokenForCookie(tk);
    if (!res.ok) {
      if (res.status === 401) setAuthError('Wrong token.');
      else setAuthError(`HTTP ${res.status || '???'}`);
      setAuthed(false);
      return false;
    }
    setAuthed(true);
    authedHint.set(true);
    setToken(COOKIE_SENTINEL);
    return true;
  }, [token]);

  // On mount: (a) if a legacy sessionStorage token still exists, hand
  // it to the new login endpoint to upgrade to a cookie session and
  // wipe the local copy; (b) otherwise probe /whoami so a fresh reload
  // skips the AuthGate when the cookie is still valid.
  useEffect(() => {
    if (shellToken) return;
    let cancelled = false;

    const bootstrap = async () => {
      const legacy = legacyTokenStore.get();
      if (legacy) {
        const upgrade = await exchangeTokenForCookie(legacy);
        legacyTokenStore.clear();
        if (cancelled) return;
        if (upgrade.ok) {
          setAuthed(true);
          authedHint.set(true);
          setToken(COOKIE_SENTINEL);
          return;
        }
        // legacy token rejected — fall through to whoami probe
      }
      const probe = await probeWhoami();
      if (cancelled) return;
      if (probe.ok) {
        setAuthed(true);
        authedHint.set(true);
        setToken(COOKIE_SENTINEL);
      } else {
        authedHint.set(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [shellToken]);

  const logout = useCallback(async () => {
    setToken('');
    setAuthed(false);
    setAuthError('');
    authedHint.set(false);
    legacyTokenStore.clear();
    try {
      await fetch(`${BACKEND}/api/admin/auth/logout`, credentialsInit({ method: 'POST' }));
    } catch { /* network failure — local state already cleared */ }
  }, []);

  if (shellToken) {
    // Inside the shell: shell owns auth lifecycle. Mirror the contract.
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
    <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, margin: '0 0 16px', color: 'var(--ink)' }}>
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
          marginTop: 16, padding: '10px 18px', background: 'var(--ember, #D9461E)', color: '#FFFFFF',
          border: 0, fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
          letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer',
        }}>UNLOCK →</button>
    </form>
  </div>
);
