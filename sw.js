/* Natáčecí den – offline cache. App files: network first (updates arrive at once), libraries: cache first. Supabase data is never cached here. */
const CACHE = "nd-v9";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "nd-icon-192.png", "nd-icon-512.png", "nd-icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (/supabase\.co$/.test(u.hostname)) return;
  const lib = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.hostname);
  if (lib) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; })));
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith(fetch(req, {cache: "no-store"}).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; }).catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
  }
});
