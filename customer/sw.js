/* RozBazaar service worker — this is what makes a notification arrive
   even when the app/tab is fully closed. The browser keeps this file
   running in the background (separate from the page itself) purely to
   listen for two things: a push arriving, and someone tapping it. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'RozBazaar', body: '', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/rozbazaar_logo_remove_backgrounds.png',
      badge: '/rozbazaar_logo_remove_backgrounds.png',
      data: { url: data.url || '/' },
      vibrate: [120, 60, 120]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
