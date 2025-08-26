// GitHub Pages 루트(/)에 배치하세요.
// 페이지가 열려 있을 때 showNotification을 위한 최소 서비스워커.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
