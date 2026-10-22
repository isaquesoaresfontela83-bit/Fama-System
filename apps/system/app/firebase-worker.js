/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
self.addEventListener('install', () => { void self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil((async () => { const url = new URL('/', self.location.origin); const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); for (const client of windows) {
    if (new URL(client.url).origin === url.origin) {
        await client.focus();
        return;
    }
} await self.clients.openWindow(url.href); })()); });
const query = new URL(self.location.href).searchParams;
const keys = ['apiKey', 'projectId', 'appId', 'messagingSenderId'];
const config = Object.fromEntries(keys.map(key => [key, query.get(key) || '']));
if (keys.every(key => config[key])) {
    const app = initializeApp(config);
    const messaging = getMessaging(app);
    onBackgroundMessage(messaging, payload => { const data = payload.data || {}; return self.registration.showNotification(data.title || 'Fama System', { body: data.body || 'Você tem uma atualização no Fama.', icon: '/fama-piscinas-mark.png', tag: data.eventId || 'fama-update', data: { url: '/' } }); });
}
