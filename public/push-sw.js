// Notifications des repas et de la pesée, envoyées par le serveur d'Élan.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Élan', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Élan';
  const options = {
    body: payload.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: payload.tag || 'elan',
    renotify: true,
    data: { url: payload.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
