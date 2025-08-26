// 프로젝트 사이트에서도 404 없이 동작하도록 루트가 아닌 상대경로로 등록하세요.
// (index.html에서 navigator.serviceWorker.register('./sw.js', { scope: './' }))

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

// 알림 클릭 시 홈으로 포커싱
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (allClients.length) {
      const client = allClients[0];
      client.focus();
      return;
    }
    await clients.openWindow('./');
  })());
});
