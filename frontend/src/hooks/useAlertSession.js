/**
 * useAlertSession - minimal localStorage-backed session hook for the
 * bell-icon alert manager.
 *
 * On mount it reads `putki.alert_session` from localStorage. The flow:
 *   1. requestCode(email)   → POST /api/alerts/streamer/request-code
 *   2. verifyCode(email, c) → POST /api/alerts/streamer/verify-code
 *      → token persisted; subscriptions auto-fetched.
 *   3. listSubscriptions()  → GET  /api/alerts/streamer/subscriptions
 *   4. removeSubscription(id) → DELETE /api/alerts/streamer/subscriptions/:id
 *   5. logout() → POST /api/alerts/streamer/logout + clear localStorage
 *
 * 401 responses auto-clear the session (the server already TTL-deletes
 * expired tokens; UI just needs to forget it).
 */
import { useCallback, useEffect, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const LS_KEY = 'putki.alert_session';

function _readLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function _writeLS(obj) {
  try {
    if (obj) localStorage.setItem(LS_KEY, JSON.stringify(obj));
    else localStorage.removeItem(LS_KEY);
  } catch { /* noop */ }
}

export const useAlertSession = () => {
  const [session, setSession] = useState(() => _readLS());
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const _bearer = useCallback(() => (
    session?.token ? { Authorization: `Bearer ${session.token}` } : {}
  ), [session]);

  const refresh = useCallback(async () => {
    if (!session?.token) { setSubs([]); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/alerts/streamer/subscriptions`, {
        headers: _bearer(),
      });
      if (r.status === 401) {
        _writeLS(null); setSession(null); setSubs([]); return;
      }
      if (!r.ok) { setError(`http_${r.status}`); return; }
      const d = await r.json();
      setSubs(d.items || []);
    } catch (e) {
      setError(e.message || 'network');
    } finally {
      setLoading(false);
    }
  }, [session, _bearer]);

  useEffect(() => {
    if (session?.token) refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const requestCode = useCallback(async (email) => {
    setError(null);
    const r = await fetch(`${BACKEND}/api/alerts/streamer/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.detail || `http_${r.status}`);
      return { ok: false, reason: j.detail || `http_${r.status}` };
    }
    return { ok: true };
  }, []);

  const verifyCode = useCallback(async (email, code) => {
    setError(null);
    const r = await fetch(`${BACKEND}/api/alerts/streamer/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.detail || `http_${r.status}`);
      return { ok: false, reason: j.detail || `http_${r.status}` };
    }
    const j = await r.json();
    const next = { token: j.token, email: j.email, expires_at: j.expires_at };
    _writeLS(next); setSession(next);
    return { ok: true };
  }, []);

  const removeSubscription = useCallback(async (id) => {
    if (!session?.token) return { ok: false };
    const r = await fetch(`${BACKEND}/api/alerts/streamer/subscriptions/${id}`, {
      method: 'DELETE', headers: _bearer(),
    });
    if (r.ok) {
      setSubs((cur) => cur.filter((s) => s.id !== id));
      return { ok: true };
    }
    return { ok: false };
  }, [session, _bearer]);

  const logout = useCallback(async () => {
    if (session?.token) {
      try {
        await fetch(`${BACKEND}/api/alerts/streamer/logout`, {
          method: 'POST', headers: _bearer(),
        });
      } catch { /* noop */ }
    }
    _writeLS(null); setSession(null); setSubs([]);
  }, [session, _bearer]);

  return {
    session, subs, loading, error,
    isAuthed: !!session?.token,
    requestCode, verifyCode, removeSubscription, refresh, logout,
  };
};

export default useAlertSession;
