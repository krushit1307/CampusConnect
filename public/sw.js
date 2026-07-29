/**
 * Service Worker for Web Push Notifications
 *
 * Listens for 'push' events from the backend and displays native browser notifications.
 * Also handles 'notificationclick' events to focus or open the CampusConnect app.
 */

const CACHE_NAME = "campusconnect-v1";
const urlsToCache = ["/", "/manifest.json", "/icon-192x192.png", "/icon-512x512.png"];

// Install event: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Push event: handle incoming push payloads from the backend
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

// Notification click event: handle user interaction with the notification
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
  );
});
