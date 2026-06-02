// Alias of service-worker.js — kill-switch. See service-worker.js for
// rationale. Some older deploys registered the SW as `/sw.js`, so we
// ship the same kill-switch under both names.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) {}
  })());
});
self.addEventListener('fetch', () => {});
