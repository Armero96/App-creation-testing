// =====================================================================
// Jobits — service worker
// A small script the browser runs alongside the app. It keeps a copy of
// the app's files so the app can open without internet.
//
// Strategy: "network first". When online, always fetch the latest file
// (and update the saved copy). When offline, use the saved copy.
// =====================================================================

// Change the version when the list of files changes, so old copies get cleaned up
const CACHE_NAME = "jobits-v1";

// Every file the app needs to work offline (paths relative to this file)
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./fonts/PressStart2P-Regular.ttf",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Install: save a copy of all app files
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting(); // start using this version right away
});

// Activate: delete copies saved by older versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim(); // take control of the open app immediately
});

// Fetch: every time the app asks for a file
self.addEventListener("fetch", (event) => {
  // Only handle normal "get a file" requests from our own site
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Online: update the saved copy, then use the fresh file
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        // Offline: use the saved copy (or the main page as a last resort)
        caches.match(event.request).then((saved) => saved || caches.match("./index.html"))
      )
  );
});
