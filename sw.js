/* Natáčecí den – offline cache. App files: network first (updates arrive at once), libraries: cache first. Supabase data is never cached here, except script/breakdown PDFs (cache nd-docs) for offline use. */
const CACHE = "nd-v80";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "marika-klapka-192.png", "marika-klapka-512.png", "marika-klapka-180.png", "lib/pdf.min.mjs", "lib/pdf.worker.min.mjs"];
const DOCS = "nd-docs";
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== DOCS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (/supabase\.co$/.test(u.hostname)) {
    // scénáře a složky (PDF): uložené v zařízení, takže se otevřou i offline
    if (/\/storage\/v1\/object\/public\/docs\//.test(u.pathname) && !req.headers.get("range")) {
      e.respondWith(caches.open(DOCS).then(c => c.match(req.url).then(hit => hit || fetch(req).then(res => { if (res.ok && res.status === 200) c.put(req.url, res.clone()); return res; }))));
    }
    return;
  }
  const lib = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.hostname);
  if (lib) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === "opaque") { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; })));
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith(fetch(req, {cache: "no-store"}).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; }).catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
  }
});

// Upozornění (Web Push) – zobrazí se na iPhonu i na spárovaných Apple Watch
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Natáčení MARIKA", {
    body: d.body || "", tag: d.tag || "nd", renotify: true,
    icon: "marika-klapka-192.png", badge: "marika-klapka-192.png",
    data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  }));
});
