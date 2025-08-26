// index.html에서 './sw.js' 로 등록하세요 (상대경로!)
// GitHub Pages 프로젝트 사이트 경로에서 404 피함.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return clients.openWindow('./');
  })());
});
