/* Lakisa service worker — lightweight and safe by design.
 *
 * - Static, versioned assets (/_next/static/*, /brand/*, /icons/*,
 *   /fonts/*) are cached (stale-while-revalidate): they are immutable
 *   (hashed) or brand files, so serving them from cache can never show
 *   the wrong user anything.
 * - EVERYTHING else — pages, /api/*, /dashboard, /admin, navigation —
 *   is network-only: the worker never caches a page or an API response,
 *   so an authenticated page can never leak to another user or go stale.
 * - Non-GET requests pass through untouched.
 * - No precache on install: the first install is instant and cannot
 *   serve stale HTML.
 */

const CACHE_NAME = "lakisa-static-v1";

// Same-origin prefixes whose responses are safe to cache.
const STATIC_PREFIXES = ["/_next/static/", "/brand/", "/icons/", "/fonts/"];

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", () => {
  // Activate the new worker as soon as it is ready.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Network-only for everything that is not a static asset: pages,
  // /api/*, /dashboard, /admin, R2 images served through the API.
  if (!isStaticAsset(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      // Always refresh in the background; serve the cache instantly
      // when we have it (stale-while-revalidate).
      const refresh = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => undefined);
      if (cached) return cached;
      const fresh = await refresh;
      if (fresh) return fresh;
      // Offline and nothing cached: fail like there was no worker.
      throw new Error("Network unavailable for " + url.pathname);
    })(),
  );
});
