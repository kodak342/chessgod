// Offline cache: network first (so updates arrive), cache as the fallback.
const CACHE = 'chess-coach-v1';
const PRE = ['./', './stockfish/engine.json', './stockfish/stockfish-19-lite-single.js', './stockfish/stockfish-19-lite-single.wasm'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(PRE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; })
      .catch(() => caches.match(r).then((m) => m || (r.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
