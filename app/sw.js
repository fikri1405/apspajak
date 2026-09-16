/* Bump this version whenever shell files change. Dataset updates use SAVE_DATA. */
importScripts('./validate.js');
const SHELL_CACHE = 'pg-pajak-shell-v1';
const DATA_CACHE = 'pg-pajak-data-v1';
const DATA_URL = new URL('./data/pajak.json', self.location.href).href;
const SHELL = ['./', './index.html', './styles.css', './app.js', './validate.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const absolute = path => new URL(path, self.location.href).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL.map(path => new Request(absolute(path), { cache: 'reload' })));
    const data = await caches.open(DATA_CACHE);
    const existing = await data.match(DATA_URL);
    if (!existing) {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Data tidak dapat diunduh.');
      PajakData.validate(await response.clone().json());
      await data.put(DATA_URL, response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('pg-pajak-shell-') && name !== SHELL_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.searchParams.has('refresh')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.href === DATA_URL) {
    event.respondWith((async () => (await (await caches.open(DATA_CACHE)).match(DATA_URL)) || fetch(event.request))());
  } else if (event.request.mode === 'navigate' && url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    event.respondWith((async () => (await (await caches.open(SHELL_CACHE)).match(absolute('./index.html'))) || fetch(event.request))());
  } else if (SHELL.map(absolute).includes(url.href)) {
    event.respondWith((async () => (await (await caches.open(SHELL_CACHE)).match(event.request)) || fetch(event.request))());
  }
});
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(DATA_CACHE);
      if (event.data.type === 'SAVE_DATA') {
        const dataset = PajakData.validate(event.data.dataset);
        // One atomic cache replacement after validation. A failed download never gets here.
        await cache.put(DATA_URL, new Response(JSON.stringify(dataset), { headers: { 'Content-Type': 'application/json;charset=utf-8' } }));
        port.postMessage({ ok: true });
      } else if (event.data.type === 'READ_DATA') {
        const response = await cache.match(DATA_URL);
        if (!response) throw new Error('Daftar belum tersimpan.');
        const dataset = PajakData.validate(await response.json());
        const shell = await caches.open(SHELL_CACHE);
        const ready = (await Promise.all(SHELL.map(path => shell.match(absolute(path))))).every(Boolean);
        port.postMessage({ ok: true, dataset, ready });
      } else throw new Error('Permintaan tidak dikenal.');
    } catch (error) { port.postMessage({ ok: false, error: error.message }); }
  })());
});
