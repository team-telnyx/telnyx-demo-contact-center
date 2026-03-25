// Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Contact Center';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };
  if (data.image) {
    options.image = data.image;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/';
  const fullUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          // Post a message to tell the client to navigate
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: path });
          return client.focus();
        }
      }
      // No existing window — open new one
      return clients.openWindow(fullUrl);
    })
  );
});
