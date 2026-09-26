/* RozBazaar Vendor — service worker. Lets an alert reach the phone even when the
   app is closed: the browser wakes this file when a push arrives (new order,
   slot starting, bill approved, cancel, rating, item review, daily summary),
   shows it, and opens the app when it is tapped. Pushes come from the Supabase
   send-push function (see database/migrations/20260926e_vendor_app_notifications.sql). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let d = { title: 'RozBazaar Vendor', body: '' };
  try { d = Object.assign(d, event.data.json()); } catch (e) { if (event.data) d.body = event.data.text(); }
  const loud = /order|slot|🛒|🚚|⏰/i.test(d.title || '');
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: './icon-192.png',
    badge: './badge-96.png',
    tag: 'rbv-' + Date.now(),
    renotify: true,
    requireInteraction: loud,
    vibrate: loud ? [200, 100, 200, 100, 300] : [140, 70, 140],
    data: { url: './' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow ? self.clients.openWindow(self.registration.scope) : undefined;
  }));
});
