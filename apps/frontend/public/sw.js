/* Rumera storefront service worker — deliberately scoped.
 *
 * Goals:
 *  - Offline shell for public browsing (catalogue, journal, recipes)
 *  - Never cache auth, account, admin, checkout, or API/BFF responses
 *  - Network-first navigations with /offline fallback
 *  - Cache-first for hashed /_next/static assets
 *  - Explicit versioning + skipWaiting coordinated by the page
 *
 * Keep policy strings in sync with lib/pwa/config.ts.
 */
const VERSION = "rumera-pwa-v1";
const PRECACHE = `${VERSION}-precache`;
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

const PRECACHE_URLS = [
  "/offline",
  "/logo/Rumera-Light.svg",
  "/logo/Rumra-Dark.svg",
  "/logo/Rumera-Light.png",
  "/logo/Rumra-Dark.png",
];

const NEVER_CACHE_PREFIXES = [
  "/api/",
  "/admin",
  "/account",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/forbidden",
];

const SENSITIVE_QUERY = ["token", "access_token", "callbackUrl", "session"];

function neverCache(url) {
  const path = url.pathname;
  if (
    NEVER_CACHE_PREFIXES.some(
      (p) => path === p || path.startsWith(p + "/") || path.startsWith(p),
    )
  ) {
    return true;
  }
  for (const key of SENSITIVE_QUERY) {
    if (url.searchParams.has(key)) return true;
  }
  // Cross-origin API / media — do not pin in the SW cache.
  if (url.origin !== self.location.origin) return true;
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    if (offline) return offline;
    return new Response("آفلاین هستید", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (neverCache(url)) return;

  // Navigations (document)
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Next static chunks & fonts
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.match(/\.(?:woff2?|ttf|otf|css|js)$/)
  ) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // Brand + offline assets
  if (url.pathname.startsWith("/logo/") || url.pathname === "/offline") {
    event.respondWith(cacheFirstStatic(request));
  }
});
