/**
 * iter96 · fetchAdmin — canonical wrappers for back-office API calls.
 *
 * Two flavours so callsites can pick the ergonomics they want:
 *
 *   adminFetch(path, opts?)  — DROP-IN replacement for `fetch()`.
 *     Returns the raw `Response` object, never throws on 4xx/5xx.
 *     Adds `credentials: 'include'` so the cookie session travels and
 *     auto-attaches `X-Admin-Token` if a `token` option (or the
 *     `useBackOfficeToken` shell-injected token) is supplied.
 *     Use this when the existing call does `if (r.ok) { ... }` or
 *     handles 401 → re-auth manually. Migrating from raw fetch is a
 *     simple URL prefix change.
 *
 *   fetchAdmin(path, opts?)  — ergonomic JSON wrapper.
 *     Returns parsed JSON on success, throws { status, body, message }
 *     on non-OK. Auto-serialises `body` to JSON + sets Content-Type.
 *     Best for new code or POSTs that don't need 401 nuance.
 *
 * Both share the same option shape:
 *   { method, body, headers, token, signal, parse }
 *
 * `parse` only matters for fetchAdmin (default true). Pass `parse: false`
 * to get the raw Response back through the JSON helper.
 */
const BACKEND = process.env.REACT_APP_BACKEND_URL;

const isBodyMethod = (m) => m && /^(POST|PUT|PATCH|DELETE)$/i.test(m);

/**
 * Build the shared fetch init for both wrappers. Returns the absolute URL
 * + RequestInit pair so callers can adapt response handling per flavour.
 */
const buildAdminRequest = (path, opts = {}) => {
  if (!path || !path.startsWith('/api/')) {
    throw new Error(`adminFetch: path must start with /api/ (got "${path}")`);
  }
  const { method = 'GET', body, headers = {}, token, signal, asFormData } = opts;
  const requestHeaders = { ...headers };
  if (token) requestHeaders['X-Admin-Token'] = token;
  // iter97i: when uploading FormData, the browser sets Content-Type with
  // the multipart boundary - we MUST NOT set it ourselves.
  if (isBodyMethod(method) && body !== undefined && body !== null
      && !asFormData && !(body instanceof FormData)
      && !('Content-Type' in requestHeaders)) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  const init = {
    method,
    credentials: 'include',
    headers: requestHeaders,
    signal,
  };
  if (isBodyMethod(method) && body !== undefined && body !== null) {
    init.body = (asFormData || body instanceof FormData)
      ? body
      : (typeof body === 'string' ? body : JSON.stringify(body));
  }
  return { url: `${BACKEND}${path}`, init };
};

/**
 * adminFetch — drop-in replacement for `fetch()` on /api/admin/* endpoints.
 * Returns the raw Response, never throws on 4xx/5xx. Cookie auto-included.
 */
export const adminFetch = (path, opts = {}) => {
  const { url, init } = buildAdminRequest(path, opts);
  return fetch(url, init);
};

export const fetchAdmin = async (path, opts = {}) => {
  const { parse = true } = opts;
  const res = await adminFetch(path, opts);
  if (!parse) return res;

  if (!res.ok) {
    let payload = null;
    try { payload = await res.json(); } catch { /* not JSON */ }
    const err = new Error(payload?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = payload;
    throw err;
  }
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
