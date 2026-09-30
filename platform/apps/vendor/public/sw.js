/* RozBazaar Vendor — service worker. Lets an alert reach the phone even when the app is closed:
   the browser wakes this file when a push arrives (new order, slot starting, bill approved, cancel,
   rating, item review, daily summary), shows it, and opens the app when it is tapped.
   Delivery receipts go through the RozBazaar API (registered as /sw.js?api=<api origin>). */
const API = (() => {
  try {
    const u = new URL(new URL(self.location.href).searchParams.get('api') || '');
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1'
      ? u.origin
      : null;
  } catch (e) {
    return null;
  }
})();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function track(nid, event) {
  if (!API || !nid || !UUID.test(String(nid))) return Promise.resolve();
  return fetch(API + '/v1/public/notifications/' + nid + '/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'rozbazaar' },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => undefined);
}

self.addEventListener('push', (event) => {
  let d = { title: 'RozBazaar Vendor', body: '' };
  try {
    d = Object.assign(d, event.data.json());
  } catch (e) {
    if (event.data) d.body = event.data.text();
  }
  const loud = /order|slot|ऑर्डर|स्लॉट|🛒|🚚|⏰/i.test(d.title || '');
  event.waitUntil(
    Promise.all([
      track(d.nid, 'delivered'),
      self.registration.showNotification(d.title, {
        body: d.body,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        tag: 'rbv-' + Date.now(),
        renotify: true,
        requireInteraction: loud,
        vibrate: loud ? [200, 100, 200, 100, 300] : [140, 70, 140],
        data: { nid: d.nid || null },
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const nid = event.notification.data && event.notification.data.nid;
  event.waitUntil(
    Promise.all([
      track(nid, 'opened'),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) if ('focus' in c) return c.focus();
        return self.clients.openWindow ? self.clients.openWindow('/') : undefined;
      }),
    ]),
  );
});
