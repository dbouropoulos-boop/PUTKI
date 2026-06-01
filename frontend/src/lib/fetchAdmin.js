/**
 * iter96 · fetchAdmin — canonical wrapper for back-office API calls.
 *
 * Why this exists. Until iter94 every admin fetch in the codebase did:
 *
 *   fetch(`${BACKEND}/api/admin/foo`, {
 *     headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
 *     body: JSON.stringify(body),
 *   })
 *
 * That made three things easy to get wrong:
 *   1. forgetting `credentials: 'include'` (broke the new cookie session),
 *   2. spreading the token via a hand-rolled header object,
 *   3. having 38 different copies of "parse JSON, error on non-OK".
 *
 * The cookie session (iter94) is now canonical. `fetchAdmin()` builds the
 * right request shape from a flat options object and parses JSON for you.
 * Pages that still pass `token` for back-compat keep working — the header
 * tags along, the cookie does the actual auth.
 *
 * Usage:
 *
 *   import { fetchAdmin } from '../lib/fetchAdmin';
 *
 *   // GET — returns parsed JSON or throws { status, body, message }
 *   const data = await fetchAdmin('/api/admin/queue?status=queued');
 *
 *   // POST with body
 *   await fetchAdmin('/api/admin/queue/123/approve', {
 *     method: 'POST',
 *     body: { selected_variant_index: 0 },
 *   });
 *
 *   // Raw response (no JSON parse, e.g. for sitemap.xml etc.)
 *   const res = await fetchAdmin('/api/admin/export', { parse: false });
 *
 *   // Legacy: still pass the token if you have one — it's appended as the
 *   // X-Admin-Token header for back-compat. Drop this once the page is
 *   // verified to work via cookie alone.
 *   await fetchAdmin('/api/admin/foo', { token });
 *
 * Error shape thrown on non-OK:
 *   { status: number, body: any, message: string }
 */
const BACKEND = process.env.REACT_APP_BACKEND_URL;

const isBodyMethod = (m) => m && /^(POST|PUT|PATCH|DELETE)$/i.test(m);

export const fetchAdmin = async (path, opts = {}) => {
  if (!path || !path.startsWith('/api/')) {
    throw new Error(`fetchAdmin: path must start with /api/ (got "${path}")`);
  }
  const {
    method = 'GET',
    body,
    headers = {},
    token,
    signal,
    parse = true,
  } = opts;

  const requestHeaders = { ...headers };
  if (token) requestHeaders['X-Admin-Token'] = token;
  if (isBodyMethod(method) && body !== undefined && !('Content-Type' in requestHeaders)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const init = {
    method,
    credentials: 'include',
    headers: requestHeaders,
    signal,
  };
  if (isBodyMethod(method) && body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(`${BACKEND}${path}`, init);
  if (!parse) return res;

  if (!res.ok) {
    let payload = null;
    try { payload = await res.json(); } catch { /* not JSON */ }
    const err = new Error(payload?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = payload;
    throw err;
  }
  // Some admin endpoints return 204 No Content
  if (res.status === 204) return null;
  try { return await res.json(); }
  catch { return null; }
};

/**
 * fetchAdminText — same wrapper but returns text. Useful for sitemap/CSV
 * endpoints that aren't JSON.
 */
export const fetchAdminText = async (path, opts = {}) => {
  const res = await fetchAdmin(path, { ...opts, parse: false });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
};

export default fetchAdmin;
