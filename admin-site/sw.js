/* RozBazaar Admin — service worker. Lets a notification reach the phone even when the
   site is closed: the browser wakes this file when a push arrives, shows it,
   and focuses/opens the site when it is tapped. Pushes are sent by the
   Supabase send-push function (see database/migrations/20260926d_*). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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

self.addEventListener('push', event => {
  let d = { title: 'RozBazaar Admin', body: '', url: './' };
  try { d = Object.assign(d, event.data.json()); } catch (e) { if (event.data) d.body = event.data.text(); }
  event.waitUntil(Promise.all([rbTrack(d.nid, 'delivered'), self.registration.showNotification(d.title, {
    body: d.body,
    icon: './icon-192.png',
    badge: './badge-96.png',
    tag: 'rb-' + Date.now(),
    renotify: true,
    vibrate: [140, 70, 140],
    data: { url: './', nid: d.nid || null }
  })]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const nid = event.notification.data && event.notification.data.nid;
  event.waitUntil(Promise.all([rbTrack(nid, 'opened'), self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow ? self.clients.openWindow(self.registration.scope) : undefined;
  })]));
});
