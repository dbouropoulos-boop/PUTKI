/**
 * PUTKI · scroll-depth listener
 *
 * Fires `page_interaction` { interaction_type: "scroll_50" } the first
 * time the user passes the 50% mark of the page. Once per page only.
 *
 * Important bounce-fix per spec §2e: this MUST NOT fire on mount. GA4
 * treats a session that fires zero engagement events as a bounce —
 * firing page_interaction at page-load inflates engaged users and
 * silently corrupts the bounce metric the decision tree reads.
 *
 * Returns a cleanup function so React effects can detach the listener
 * on unmount (e.g. when the user navigates away before reaching 50%).
 */
import { track } from './track';

export function watchScrollDepth(content_type) {
  if (typeof window === 'undefined') return () => {};
  let fired = false;
  const onScroll = () => {
    if (fired) return;
    const doc = document.documentElement || document.body;
    const reached = (window.scrollY + window.innerHeight) / (doc.scrollHeight || 1);
    if (reached >= 0.5) {
      fired = true;
      track('page_interaction', { interaction_type: 'scroll_50', content_type });
      window.removeEventListener('scroll', onScroll);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}
