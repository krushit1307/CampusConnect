<<<<<<< HEAD
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "CampusConnect Announcement";
    
    const options = {
      body: data.message,
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: {
        url: data.url || "/",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("Error processing push event:", error);
    // Fallback if data is not JSON
    event.waitUntil(
      self.registration.showNotification("CampusConnect Announcement", {
        body: event.data.text(),
        icon: "/favicon.png",
        badge: "/favicon.png",
        data: { url: "/" }
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  // This looks to see if the current is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it.
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
=======
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

// =============================================================================
// PUSH EVENT: Handle incoming push payloads from the backend
// =============================================================================
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.warn("Push event received but no data payload found.");
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error("Failed to parse push data as JSON:", e);
    data = { title: "CampusConnect", body: "You have a new notification." };
  }

  const title = data.title || "New Direct Message";
  const options = {
    body: data.body || "Click to view your messages.",
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/icon-192x192.png",
    data: data.data || {}, // Custom data to pass to the click handler
    vibrate: [200, 100, 200],
    tag: data.tag || "campusconnect-dm", // Group notifications
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// =============================================================================
// NOTIFICATION CLICK EVENT: Handle user interaction with notifications
// =============================================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/messages";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
>>>>>>> upstream/main
  );
});
