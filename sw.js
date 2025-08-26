// 프로젝트/사용자 페이지 모두에서 동작하도록 index.html에서 './sw.js' 로 등록하세요.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsArr = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clientsArr.length) return clientsArr[0].focus();
    return clients.openWindow('./');
  })());
});
