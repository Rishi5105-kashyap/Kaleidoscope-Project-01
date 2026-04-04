self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open('kaleidoscope-store-v2').then((cache) => cache.addAll([
            './index.html',
            './script.js?v=7',
            './style.css?v=7'
        ]))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== 'kaleidoscope-store-v2').map(k => caches.delete(k))
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Network-first strategy so edits show up instantly
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
