const CACHE = "meu-veiculo-v510-rc2";
const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "validation.css",
  "app.js",
  "cloud.js",
  "firebase-config.js",
  "jszip.min.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-32.png",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "desenvolvedor.png",
  "data/dataset_veicular_app.csv",
  "data/cadastros_veicular_app.csv",
  "data/exportacao_veicular_app.xlsx",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("index.html", copy));
          return response;
        })
        .catch(() => caches.match("index.html")),
    );
    return;
  }

  const networkFirst =
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/cloud.js") ||
    url.pathname.endsWith("/firebase-config.js") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/data/dataset_veicular_app.csv");

  event.respondWith(
    networkFirst
      ? fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(event.request))
      : caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
