const NOTIFICATION_ROUTE_PARAM = "notification_route";
const PUSH_DEEP_LINK_MESSAGE = "CAMPUSCONNECT_PUSH_DEEP_LINK";

function normalizeTargetRoute(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const target = new URL(value, self.location.origin);
    return target.origin === self.location.origin && !target.pathname.includes("\\")
      ? `${target.pathname}${target.search}${target.hash}`
      : null;
  } catch {
    return null;
  }
}

function createLaunchUrl(targetRoute) {
  const url = new URL("/", self.location.origin);
  url.searchParams.set(NOTIFICATION_ROUTE_PARAM, targetRoute);
  return url.toString();
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "CampusConnect", body: event.data.text() };
  }

  const targetRoute = normalizeTargetRoute(
    payload.target_route || payload.data?.target_route || payload.data?.url || payload.url,
  );

  let title = payload.title || "CampusConnect";
  let body = payload.body || payload.message || "You have a new notification.";

  // Dynamic Push Notification Payload Formatter (Fallback for OS background notifications)
  if (payload.type && payload.payload) {
    const data = payload.payload;
    switch (payload.type) {
      case "EVENT_INVITE":
        title = "Event Invite";
        body = `${data.actor || "Someone"} invited you to ${data.target || "an event"}`;
        break;
      case "EVENT_CANCELLED":
        title = "Event Cancelled";
        body = `${data.target || "An event"} has been cancelled.`;
        break;
      case "EVENT_REMINDER":
        title = "Event Reminder";
        body = `Reminder: ${data.target || "An event"} is starting soon.`;
        break;
      case "NEW_POST":
        title = "New Post";
        body = `${data.actor || "Someone"} posted in ${data.target || "a club"}`;
        break;
      case "CLUB_INVITE":
        title = "Club Invite";
        body = `${data.actor || "Someone"} invited you to join ${data.target || "a club"}`;
        break;
      case "NEW_COMMENT":
        title = "New Comment";
        body = `${data.actor || "Someone"} commented on your post.`;
        break;
    }
  }

  const options = {
    body: body,
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.badge || "/icon-192x192.png",
    data: { target_route: targetRoute },
    tag: payload.tag || "campusconnect-notification",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * CampusConnect Custom Service Worker
 *
 * Listens for 'push' and 'notificationclick' events for push notifications.
 * Implements caching strategies for static asset performance and offline shell access.
 *
 * Caching Strategy:
 * - Cache First, Network Fallback: For static assets (.png, .jpg, .jpeg, .css, .woff2, .js)
 * - Network First, Cache Fallback: For HTML documents (ensures fresh shell, but works offline)
 *
 * Cache Invalidation:
 * - The `activate` event deletes old cache versions (e.g., deleting old caches when 'campus-static-v1' is active)
 * - `clients.claim()` forces the new service worker to take control immediately.
 */

const CACHE_NAME = "campus-static-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/favicon.png",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/fonts/space-grotesk-latin-400-normal.woff2",
  "/fonts/space-mono-latin-400-normal.woff2",
  // Add other critical CSS/JS bundles if known at build time
];

// =============================================================================
// INSTALL EVENT: Pre-cache critical static assets
// =============================================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing new service worker...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Pre-caching static assets");
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.error("[SW] Failed to pre-cache some assets:", err);
        });
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      }),
  );
});

// =============================================================================
// ACTIVATE EVENT: Clean up old caches and claim clients
// =============================================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that doesn't match the current CACHE_NAME
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        // Force the new service worker to take control of all pages immediately
        return self.clients.claim();
      }),
  );
});

// =============================================================================
// FETCH EVENT: Intercept requests and apply caching strategies
// =============================================================================
self.addEventListener("fetch", (event) => {
  // Bypass caching completely during local development to prevent conflicts with Vite's HMR
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    return;
  }
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  // Strategy 1: Cache First, Network Fallback (for static assets)
  if (
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Return from cache immediately
        }
        // Fallback to network if not in cache
        return fetch(request)
          .then((networkResponse) => {
            // Clone the response because it's a stream and can only be consumed once
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            // If offline and not in cache, return a generic fallback or nothing
            return new Response("Offline and asset not cached", { status: 503 });
          });
      }),
    );
    return;
  }

  // Strategy 2: Network First, Cache Fallback (for HTML documents)
  // This ensures users get the latest app shell, but can still load it offline.
  if (
    request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept")?.includes("text/html"))
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Update cache with fresh HTML
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline). Try to serve from cache.
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no HTML in cache, serve the dedicated offline page
          return caches.match("/offline.html");
        }),
    );
    return;
  }

  // Default: Pass through to network for API calls (live data)
  // We intentionally do NOT cache API responses here to ensure live data accuracy.
  event.respondWith(fetch(request));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetRoute = normalizeTargetRoute(event.notification.data?.target_route) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      const client = windowClients[0];
      if (client) {
        await client.focus();
        client.postMessage({ type: PUSH_DEEP_LINK_MESSAGE, target_route: targetRoute });
        return;
      }
      return clients.openWindow(createLaunchUrl(targetRoute));
    }),
  );
});
