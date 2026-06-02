/**
 * service-worker.js · kill-switch (iter97c)
 *
 * Background: previous deploys of putkihq.fi shipped via CRA which by
 * default registers a precaching service worker. The current build no
 * longer ships one, but users whose browser still has the old SW
 * registered will keep running it indefinitely — including its stale
 * `/api/*` cache. Result: persistent 0/0/0/0 stats on the homepage,
 * even though the live backend has data and CORS is wide open.
 *
 * This file is a one-shot kill-switch: on install it skips waiting, on
 * activate it unregisters itself, wipes every Cache Storage entry, then
 * reloads every tab so the user gets a clean network-driven render.
 *
 * Safe to ship long-term — it's idempotent. Once unregistered, the
 * browser stops fetching this file. Any future user who registers a
 * legitimate SW will not be affected.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // Wipe every cache the old SW may have created.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* nothing we can do — keep going */ }
    try {
      await self.registration.unregister();
    } catch (e) { /* idempotent */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) { /* SW already gone — clients will see fresh on next reload */ }
  })());
});

// While we're still in the SW lifecycle, never intercept anything —
// let every fetch hit the network directly. This is the explicit
// pass-through behaviour, defending against any cached `fetch` handler
// from an older script that may briefly still be in scope.
self.addEventListener('fetch', () => { /* no-op: bypass */ });
