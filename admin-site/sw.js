/* RozBazaar Admin — service worker. Lets a notification reach the phone even when the
   site is closed: the browser wakes this file when a push arrives, shows it,
   and focuses/opens the site when it is tapped. Pushes are sent by the
   Supabase send-push function (see database/migrations/20260926d_*). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let d = { title: 'RozBazaar Admin', body: '', url: './' };
  try { d = Object.assign(d, event.data.json()); } catch (e) { if (event.data) d.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: './icon-192.png',
    badge: './badge-96.png',
    tag: 'rb-' + Date.now(),
    renotify: true,
    vibrate: [140, 70, 140],
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
