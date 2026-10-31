// Speichert die App auf dem Handy, damit sie auch ohne Internet startet.
const CACHE = 'teilescanner-v1';
const FILES = ['./', 'index.html', 'matcher.js', 'ocr-worker.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'eng-data.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Netz zuerst (für Updates), sonst aus dem Speicher
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
