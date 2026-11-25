/* Service worker : l'application s'ouvre sans réseau.
   Changez VERSION à chaque mise en ligne pour forcer la mise à jour des fichiers. */
const VERSION = "sika-v4";
const SHELL = ["./", "index.html", "css/styles.css", "js/config.js", "js/auth.js", "js/storage.js", "js/sync.js", "js/app.js", "js/lock.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; // les polices Google passent par le réseau et le cache du navigateur
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); } return res; }).catch(() => hit || (r.mode === "navigate" ? caches.match("index.html") : undefined));
    return hit || net;
  }));
});
