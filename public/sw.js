// ==============================================================================
// PTN Payroll & PTN Time - Service Worker for Web Push Notifications
// บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
// ==============================================================================

const SW_VERSION = 'ptn-sw-v1.0';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Listen for incoming Push Events from server (even when app is closed / phone locked)
self.addEventListener('push', function(event) {
  var data = {
    title: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
    body: 'มีการแจ้งเตือนใหม่จากระบบ',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    url: '/',
    tag: 'ptn-push-' + Date.now()
  };

  if (event.data) {
    try {
      var json = event.data.json();
      data = Object.assign(data, json);
    } catch(e) {
      data.body = event.data.text();
    }
  }

  var options = {
    body: data.body,
    icon: data.icon || 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png',
    badge: data.badge || 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png',
    tag: data.tag || 'ptn-alert',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle click on notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // If a tab is already open, focus it and navigate
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
