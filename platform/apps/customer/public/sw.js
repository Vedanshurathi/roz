/* RozBazaar (customer) — service worker. Lets order updates reach the phone even when the app is
   closed (order confirmed, vendor on the way, bill ready, delivered, slot reminders), and opens the
   app on tap. Delivery receipts go through the RozBazaar API (registered as /sw.js?api=<api origin>). */
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

/* Only paths on this site are opened — a push can never send someone to another website. */
function safePath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
    ? url
    : '/orders';
}

self.addEventListener('push', (event) => {
  let d = { title: 'RozBazaar', body: '' };
  try {
    d = Object.assign(d, event.data.json());
  } catch (e) {
    if (event.data) d.body = event.data.text();
  }
  event.waitUntil(
    Promise.all([
      track(d.nid, 'delivered'),
      self.registration.showNotification(d.title, {
        body: d.body,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        vibrate: [120, 60, 120],
        data: { nid: d.nid || null, url: safePath(d.url) },
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    Promise.all([
      track(data.nid, 'opened'),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const url = data.url || '/orders';
        for (const c of list) {
          if ('focus' in c) {
            // Bring the open app forward, then show the right screen (navigate() can refuse; focus is enough).
            return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(url).catch(() => w) : w));
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
      }),
    ]),
  );
});
