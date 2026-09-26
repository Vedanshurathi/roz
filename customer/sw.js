/* RozBazaar service worker — this is what makes a notification arrive
   even when the app/tab is fully closed. The browser keeps this file
   running in the background (separate from the page itself) purely to
   listen for two things: a push arriving, and someone tapping it. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* Delivery tracking for admin → "who got it / who opened it": the push carries the notification id
   (nid); this reports "delivered" when it reaches the phone and "opened" when it is tapped.
   notification_track() only sets those two timestamps. */
const RB_SUPA = 'https://srvpfyjmwaruebbkqkdj.supabase.co', RB_KEY = 'sb_publishable__x6pa1NvoGWJtntByA8QEw_CfNUP5ZV';
function rbTrack(nid, ev) {
  if (!nid) return Promise.resolve();
  return fetch(RB_SUPA + '/rest/v1/rpc/notification_track', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: RB_KEY },
    body: JSON.stringify({ p_id: nid, p_event: ev }), keepalive: true
  }).catch(() => {});
}

self.addEventListener('push', (event) => {
  let data = { title: 'RozBazaar', body: '', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(Promise.all([rbTrack(data.nid, 'delivered'),
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: data.url || '/', nid: data.nid || null },
      vibrate: [120, 60, 120]
    })]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const nid = event.notification.data?.nid;
  event.waitUntil(Promise.all([rbTrack(nid, 'opened'),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })]));
});
