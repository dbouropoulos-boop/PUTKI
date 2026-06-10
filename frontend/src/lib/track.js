/**
 * PUTKI · analytics tracking module
 *
 * Pushes events to window.dataLayer; the GTM container (installed in
 * public/index.html) forwards to GA4. We do NOT talk to GA4 directly.
 *
 * Sticky attribution: the first time the user lands on the site within
 * a session we snapshot utm_source/utm_medium/utm_campaign/partner_id
 * from the URL into sessionStorage. Every subsequent track() call
 * merges that snapshot in — so an `email_submitted` 12 minutes after
 * landing still carries the partner that brought them in.
 *
 * Per spec §2: we do NOT install a `gtag('consent', 'default', ...)`
 * block here. Consent defaults are owned by the CMP (Cookiebot) wired
 * by the analytics guy in §4. Setting the default in two places would
 * make the two defaults fight.
 */

const ATTR_KEY = 'putki_attr';
const GATE_KEY = 'putki_gate_ts';
const MESTARI_START_KEY = 'putki_mestari_start_ts';

// ── attribution ──────────────────────────────────────────────────────

export function captureAttribution() {
  if (typeof window === 'undefined') return;          // SSR / react-snap guard
  if (sessionStorage.getItem(ATTR_KEY)) return;       // capture once per session
  const p = new URLSearchParams(window.location.search);
  sessionStorage.setItem(ATTR_KEY, JSON.stringify({
    utm_source:   p.get('utm_source')   || '(direct)',
    utm_medium:   p.get('utm_medium')   || '(none)',
    utm_campaign: p.get('utm_campaign') || '(none)',
    partner_id:   p.get('partner_id')   || p.get('utm_source') || '(none)',
  }));
}

// ── primary push ─────────────────────────────────────────────────────

export function track(event, params = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  let attr = {};
  try { attr = JSON.parse(sessionStorage.getItem(ATTR_KEY) || '{}'); }
  catch { /* corrupted sessionStorage → fall through with empty attr */ }
  window.dataLayer.push({ event, ...attr, ...params });   // attribution rides on EVERYTHING
}

// ── gate timer (email_gate_displayed → field focus / skip) ───────────

export function markGateShown() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(GATE_KEY, Date.now().toString());
}

export function secondsSinceGate() {
  if (typeof window === 'undefined') return 0;
  const t = parseInt(sessionStorage.getItem(GATE_KEY) || '0', 10);
  return t ? Math.round((Date.now() - t) / 1000) : 0;
}

// ── mestari completion timer (start CTA → completion) ────────────────
// Persisted in sessionStorage so it survives the hub→diagnostic→result
// component remounts. Cleared on completion so a second run starts fresh.

export function markMestariStart() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(MESTARI_START_KEY, Date.now().toString());
}

/**
 * Idempotent mestari_start dispatcher.
 *
 * The user can reach a diagnostic via two paths:
 *   1. /mestari hub → click a card → land on /mestari/{k}
 *   2. direct deeplink to /mestari/{k} (from a partner / search / email)
 *
 * Both paths must produce exactly ONE mestari_start per session. This
 * helper checks the sessionStorage timer as the dedup signal: first
 * call wins, subsequent calls (same session) are no-ops. Cleared by
 * fireMestariCompletion() so a second run starts a fresh timer.
 */
export function fireMestariStart(content_type) {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(MESTARI_START_KEY)) return;   // already started this session
  markMestariStart();
  track('mestari_start', { content_type: content_type || 'mestari' });
}

export function secondsSinceMestariStart() {
  if (typeof window === 'undefined') return 0;
  const t = parseInt(sessionStorage.getItem(MESTARI_START_KEY) || '0', 10);
  return t ? Math.round((Date.now() - t) / 1000) : 0;
}

export function clearMestariStart() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(MESTARI_START_KEY);
}

/**
 * Fire mestari_completion with elapsed seconds and clear the start
 * timer so a second diagnostic run on the same session starts fresh.
 * Safe to call without a prior fireMestariStart() — emits zero seconds
 * in that edge case rather than crashing.
 */
export function fireMestariCompletion(content_type) {
  const elapsed = secondsSinceMestariStart();
  track('mestari_completion', {
    content_type: content_type || 'mestari',
    completion_time_seconds: elapsed,
  });
  clearMestariStart();
}

// ── helpers ──────────────────────────────────────────────────────────

/** Lower-case, snake-case slug from any profile label. Stable across
 * casing / spacing drift so GA4 doesn't split one profile into many. */
export function slugifyProfile(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')    // strip diacritics
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
