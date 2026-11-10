// Service worker mínimo: existe para o navegador oferecer "Instalar app".
// Não faz cache: os dados sempre vêm do servidor.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));
